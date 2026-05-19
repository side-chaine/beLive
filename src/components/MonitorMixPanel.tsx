import React from 'react';
import { useMonitorStore } from '../stores/monitor.store';
import { useAudioStore } from '../stores/audio.store';
import { getCalibration, saveCalibration } from '../services/device-calibrations';
import s from './MonitorMixPanel.module.css';

export function MonitorMixPanel() {
  const st = useMonitorStore();
  const audioSt = useAudioStore();
  const prevMasterRef = React.useRef(st.backVocalMasterLevel);
  const wasPlayingBeforeTestRef = React.useRef(false);
  const savedPositionRef = React.useRef(0);
  const previousDelayRef = React.useRef(st.delayMs);
  const tapTimestampsRef = React.useRef<number[]>([]);
  
  // Pulse session flag - tracks if playback was paused by Pulse ritual
  const pausedByPulseRef = React.useRef(false);
  
  // Line Up lock state - controls editing access
  const isLineUpLockedRef = React.useRef(true);
  const previousStatusRef = React.useRef('synced');
  const [, forceUpdate] = React.useState(0);

  // Load persisted source preference on mount
  React.useEffect(() => {
    const savedSource = localStorage.getItem('lineUp:source') as 'pulse' | 'voc' | null;
    if (savedSource && (savedSource === 'pulse' || savedSource === 'voc')) {
      useMonitorStore.getState().setLineUpSource(savedSource);
    }
  }, []);

  // Persist source preference when it changes
  React.useEffect(() => {
    localStorage.setItem('lineUp:source', st.lineUpSource);
    // Mirror to engine runtime
    (window as any).monitorMix?.setLineUpSource(st.lineUpSource);
  }, [st.lineUpSource]);

  // Load devices on mount
  React.useEffect(() => {
    st.refreshDevices();
  }, []);

  // Auto-apply known device calibration on panel mount / device change
  React.useEffect(() => {
    // Wait for devices to be loaded
    if (!st.devices || st.devices.length === 0) return;
    
    const selectedDeviceId = st.outputDeviceId || '';
    
    // No device selected → idle state
    if (!selectedDeviceId) {
      useMonitorStore.getState().setLineUpStatus('idle');
      useMonitorStore.getState().setLineUpDeviceLabel('');
      return;
    }
    
    // Find current device label
    const device = st.devices.find(d => d.deviceId === selectedDeviceId);
    const deviceLabel = device?.label || `Device ${selectedDeviceId.slice(0, 8)}`;
    
    // Check for saved calibration
    const calibration = getCalibration(selectedDeviceId);
    
    if (calibration) {
      // Calibration exists — check age and confidence
      const ageDays = (Date.now() - calibration.calibratedAt) / (1000 * 60 * 60 * 24);
      const isStale = ageDays > 7;
      const isLowConfidence = calibration.confidence === 'medium' || calibration.confidence === 'estimate' || calibration.confidence === 'fallback';
      
      // Apply the delay value immediately
      useMonitorStore.getState().setLineUpDelayMs(calibration.delayMs);
      useMonitorStore.getState().setLineUpDeviceLabel(deviceLabel);
      useMonitorStore.getState().setLineUpCalibratedAt(calibration.calibratedAt);
      
      // Apply to audio engine via setDelayMs
      st.setDelayMs(calibration.delayMs);
      
      if (isStale || isLowConfidence) {
        // Stale or low confidence → suggest recheck
        useMonitorStore.getState().setLineUpStatus('stale');
      } else {
        // Fresh + high confidence → synced
        useMonitorStore.getState().setLineUpStatus('synced');
      }
    } else {
      // No calibration found → ready for test
      useMonitorStore.getState().setLineUpStatus('ready');
      useMonitorStore.getState().setLineUpDelayMs(200); // Default estimate
      useMonitorStore.getState().setLineUpDeviceLabel(deviceLabel);
    }
  }, [st.devices, st.outputDeviceId]);

  // Keyboard handler for TAP input during test mode only (key '5')
  React.useEffect(() => {
    // Only activate when test is in progress
    if (!st.testInProgress) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore events from form elements
      const tagName = (e.target as HTMLElement)?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return;
      }

      // Key '5' triggers TAP action
      if (e.key === '5') {
        e.preventDefault();
        
        // Record tap timestamp (same logic as TAP button)
        const now = Date.now();
        tapTimestampsRef.current.push(now);
        
        const newCount = st.tapCount + 1;
        useMonitorStore.getState().setTapCount(newCount);
        useMonitorStore.getState().setTapSessionActive(true);
        
        // Calculate jitter/confidence after >= 3 taps
        if (tapTimestampsRef.current.length >= 3) {
          const timestamps = tapTimestampsRef.current;
          const intervals: number[] = [];
          for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
          }
          
          // Calculate mean interval
          const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          
          // Calculate standard deviation (jitter)
          const squaredDiffs = intervals.map(interval => Math.pow(interval - mean, 2));
          const variance = squaredDiffs.reduce((a, b) => a + b, 0) / intervals.length;
          const stdDev = Math.sqrt(variance);
          
          // Coefficient of variation for relative jitter
          const cv = stdDev / mean;
          
          // Determine confidence based on consistency
          let confidence: 'high' | 'medium' | 'low';
          let jitterMs: number;
          
          if (cv < 0.15) {
            confidence = 'high';
            jitterMs = stdDev;
          } else if (cv < 0.30) {
            confidence = 'medium';
            jitterMs = stdDev;
          } else {
            confidence = 'low';
            jitterMs = stdDev;
          }
          
          useMonitorStore.getState().setTapConfidence(confidence);
          useMonitorStore.getState().setTapJitter(jitterMs);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [st.testInProgress, st.tapCount]);

  // Cleanup active calibration session on panel unmount
  React.useEffect(() => {
    return () => {
      // If session is active, cancel it on unmount
      if (st.testInProgress) {
        // Stop test sequence
        (window as any).monitorMix?.stopSyncSequence();
        
        // Restore pre-session delay
        st.setDelayMs(st.preSessionDelayMs || st.delayMs);
        
        // Clear session state
        useMonitorStore.getState().setTestInProgress(false);
        useMonitorStore.getState().setCalibrationMode(null);
        
        // Reset tap session
        useMonitorStore.getState().resetTapSession();
      }
    };
  }, [st.testInProgress]);

  // Active-session source switching: handle Pulse/Voc changes during test
  React.useEffect(() => {
    // Only active during test in sound mode
    if (!st.testInProgress || st.calibrationMode !== 'sound') {
      return;
    }
    
    // Source is Pulse → ensure pulse sequence is running
    if (st.lineUpSource === 'pulse') {
      const mix = (window as any).monitorMix;
      const syncIntervalAliveBefore = !!mix?._syncInterval;
      if (mix && !mix._syncInterval && !mix._pulseScheduleTimer && !mix._syncTestActive) {
        // PART B: Use beginPulseCalibration instead of startTapSequence
        const currentLineUpDelay = useMonitorStore.getState().lineUpDelayMs;
        mix.beginPulseCalibration(currentLineUpDelay, 667);
      } else {
      }
    } else {
      // Source is Voc → stop pulse sequence
      const mix = (window as any).monitorMix;
      const syncIntervalAliveBefore = !!mix?._syncInterval;
      // PART B: Only stop sequence, do NOT end session
      (window as any).monitorMix?.stopSyncSequence();
    }
  }, [st.lineUpSource, st.testInProgress, st.calibrationMode]);

  // Safety guard: auto-switch to Pulse if track has no vocals
  React.useEffect(() => {
    if (audioSt.hasVocals === false && st.lineUpSource === 'voc') {
      // Track has no vocal stem, force switch to Pulse
      useMonitorStore.getState().setLineUpSource('pulse');
    }
  }, [audioSt.hasVocals, st.lineUpSource]);

  // Compute column activation states
  const splitActive = st.enabled && st.routeMainEnabled;
  const autoMixActive =
    st.autoIntroOn ||
    st.autoVerseOn ||
    st.autoPreChorusOn ||
    st.autoChorusOn ||
    st.autoBridgeOn ||
    st.autoOutroOn;

  const backVocalActive =
    st.backVocalIntroOn ||
    st.backVocalVerseOn ||
    st.backVocalPreChorusOn ||
    st.backVocalChorusOn ||
    st.backVocalBridgeOn ||
    st.backVocalOutroOn;

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const handleMasterBvLevelChange = (newValue: number) => {
    const delta = newValue - prevMasterRef.current;
    prevMasterRef.current = newValue;
    st.setBackVocalMasterLevel(newValue);

    // Apply delta to all active BV blocks, preserving relative differences
    if (st.backVocalIntroOn)     st.setBackVocalIntroLevel(clamp(st.backVocalIntroLevel + delta));
    if (st.backVocalVerseOn)     st.setBackVocalVerseLevel(clamp(st.backVocalVerseLevel + delta));
    if (st.backVocalPreChorusOn) st.setBackVocalPreChorusLevel(clamp(st.backVocalPreChorusLevel + delta));
    if (st.backVocalChorusOn)    st.setBackVocalChorusLevel(clamp(st.backVocalChorusLevel + delta));
    if (st.backVocalBridgeOn)    st.setBackVocalBridgeLevel(clamp(st.backVocalBridgeLevel + delta));
    if (st.backVocalOutroOn)     st.setBackVocalOutroLevel(clamp(st.backVocalOutroLevel + delta));
  };



  return (
    <div className={s.root}>
      {/* ===== CONSOLE GRID — 4 COLUMNS ===== */}
      <div className={s.consoleGrid}>
        {/* COLUMN 1 — Route */}
        <div className={s.section} data-col="route" data-active={splitActive ? "true" : "false"}>
          <div className={s.sectionTitle}>Route</div>
          
          <div className={s.sectionTop}>
            <div className={s.controlRow}>
              <span className={s.controlLabel}>Send music to</span>
              <select className={s.controlSelect}
                value={st.mainDeviceId}
                onChange={e => st.setMainOutputDevice(e.target.value)}>
                <option value="">System speakers</option>
                {st.devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId.slice(0,12)}
                  </option>
                ))}
              </select>
            </div>
            <button
              className={s.splitBtn}
              onClick={async () => {
                if (st.enabled && st.routeMainEnabled) {
                  st.disable();
                  st.setRouteMain(false);
                } else {
                  await st.enable({ skipMic: true });
                  st.setRouteMain(true);
                  st.setIncludeMusic(true);
                }
              }}>
              {st.enabled && st.routeMainEnabled ? 'STOP' : 'SPLIT'}
            </button>
            
            {/* Compact Music with me inside Route */}
            <div className={s.musicWithMeCompact}>
              <ToggleSliderRow
                label="Music with me"
                active={st.includeMusic}
                onToggle={() => st.setIncludeMusic(!st.includeMusic)}
                value={st.musicLevel}
                onValue={st.setMusicLevel}
                hideToggle />
            </div>
          </div>
          
          {/* Timing controls within Route */}
          <div className={s.routeTimingStack}>
            <div className={s.subTitle}>Timing</div>

            
            <div className={s.controlRow}>
              <span className={s.controlLabel}>Adjust timing on</span>
              <select className={s.controlSelect}
                value={st.compensateOn}
                onChange={e => st.setCompensateTarget(e.target.value as any)}>
                <option value="monitor">Headphones</option>
                <option value="main">Speakers</option>
              </select>
            </div>
            
            <div className={s.controlRow}>
              <span className={s.controlLabel}>🎧</span>
              <select className={s.controlSelect}
                value={st.outputDeviceId}
                onChange={e => st.setOutputDevice(e.target.value)}>
                <option value="">Default</option>
                {st.devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId.slice(0,8)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          

        </div>

        {/* COLUMN 2 — Line Up */}
        <div className={s.section} data-col="lineup" data-active={st.lineUpStatus !== 'idle' ? "true" : "false"}>
          <div className={s.sectionTitle}>Line Up</div>
                  
          {/* Status chip - always visible, compact */}
          {st.lineUpStatus !== 'idle' && (
            <div className={s.statusChipRow}>
              <span className={s.statusChip}>
                {st.lineUpStatus === 'ready' && 'Not synced'}
                {st.lineUpStatus === 'synced' && 'Synced'}
                {st.lineUpStatus === 'stale' && 'Recheck'}
                {st.lineUpStatus === 'estimated' && 'Estimated'}
                {st.lineUpStatus === 'testing' && (
                  <>
                    {st.calibrationMode === 'live' ? '🎵 Live' : '🔊 Sound'}
                  </>
                )}
              </span>
              <div className={s.sourceChips}>
                <button
                  className={`${s.sourceChip} ${st.lineUpSource === 'pulse' ? s.sourceChipActive : ''}`}
                  onClick={() => useMonitorStore.getState().setLineUpSource('pulse')}
                  type="button"
                >
                  Pulse
                </button>
                <button
                  className={`${s.sourceChip} ${st.lineUpSource === 'voc' ? s.sourceChipActive : ''} ${!audioSt.hasVocals ? s.sourceChipDisabled : ''}`}
                  onClick={() => {
                    if (audioSt.hasVocals) {
                      useMonitorStore.getState().setLineUpSource('voc');
                    }
                  }}
                  type="button"
                  disabled={!audioSt.hasVocals}
                  title={audioSt.hasVocals ? undefined : 'No vocal stem in this track'}
                >
                  Voc
                </button>
              </div>
              {st.lineUpDelayMs > 0 && st.lineUpStatus !== 'testing' && (
                <span className={s.delayChip}>{st.lineUpDelayMs}ms</span>
              )}
            </div>
          )}
                  
          {/* Calibration surface - one constant surface */}
          <div className={s.calibrationContainer}>
            {/* LOCKED state */}
            {isLineUpLockedRef.current && st.lineUpStatus !== 'testing' && (
              <button
                className={s.lockEditBtn}
                onClick={() => {
                  // ===== FORENSIC LOG: adjust-click =====
                  const ae = (window as any).audioEngine;
                  const isPlaying = ae?.isPlaying ?? false;
                  const aeCurrentTime = ae?.getCurrentTime?.() ?? ae?.currentTime ?? null;
                  
                  // Capture current state for session
                  
                  // Save pre-unlock status immediately
                  previousStatusRef.current = st.lineUpStatus;
                          
                  // Store pre-session baseline
                  previousDelayRef.current = st.delayMs;
                  wasPlayingBeforeTestRef.current = isPlaying;
                  
                  // Pulse ritual: if source is pulse and track is playing, pause playback
                  const isPulseSource = st.lineUpSource === 'pulse';
                  if (isPulseSource && isPlaying) {
                    // Save current playback position (CORRECTED: use getCurrentTime if available)
                    savedPositionRef.current = ae?.getCurrentTime?.() ?? ae?.currentTime ?? 0;
                    pausedByPulseRef.current = true;
                    
                    // Pause playback
                    ae.pause();
                  }
                  
                  // Auto-detect calibration mode based on playback state
                  // Pulse source always uses 'sound' mode regardless of actual playback
                  const mode: 'sound' | 'live' = isPulseSource ? 'sound' : (isPlaying ? 'live' : 'sound');
                                    
                  // Store session baseline in store
                  useMonitorStore.getState().setPreSessionDelayMs(st.delayMs);
                  useMonitorStore.getState().setPreSessionWasPlaying(isPlaying);
                  useMonitorStore.getState().setCalibrationMode(mode);
                          
                  // Update UI state
                  useMonitorStore.getState().setTestInProgress(true);
                  useMonitorStore.getState().setLineUpStatus('testing');
                  
                  // PART C: Calibration-first drum seed on Adjust open — strict priority
                  // PRIORITY 1: current device calibration
                  const calibration = getCalibration(st.outputDeviceId);
                  const calibrationDelay = (calibration && typeof calibration.delayMs === 'number' && isFinite(calibration.delayMs) && calibration.delayMs > 0)
                    ? calibration.delayMs
                    : null;
                  
                  // PRIORITY 2: current lineUpDelayMs from store (visible UI truth)
                  const currentLineUpDelay = useMonitorStore.getState().lineUpDelayMs;
                  const lineUpDelayValid = (typeof currentLineUpDelay === 'number' && isFinite(currentLineUpDelay) && currentLineUpDelay > 0);
                  
                  // PRIORITY 3: st.delayMs (fallback)
                  const initialDrumDelay = calibrationDelay ?? (lineUpDelayValid ? currentLineUpDelay : st.delayMs);
                  useMonitorStore.getState().setLineUpDelayMs(initialDrumDelay);
                          
                  // Unlock
                  isLineUpLockedRef.current = false;
                  forceUpdate(n => n + 1);
                          
                  // Reset tap session
                  useMonitorStore.getState().resetTapSession();
                  tapTimestampsRef.current = [];
                  
                  // PART B: Use beginPulseCalibration instead of suspendForPulseLineUp + startTapSequence
                  if (mode === 'sound' && st.lineUpSource === 'pulse') {
                    const mix = (window as any).monitorMix;
                    mix?.beginPulseCalibration?.(initialDrumDelay, 667);
                  }
                }}
                disabled={st.lineUpStatus === 'idle'}>
                <span className={s.lockIcon}>🔒</span>
                <span className={s.lockEditLabel}>Adjust</span>
              </button>
            )}
            
            {/* EDITING state */}
            {!isLineUpLockedRef.current && st.lineUpStatus === 'testing' && (
              <>
                {/* Inline helper text */}
                <div className={s.editingHelper}>
                  {st.calibrationMode === 'live' ? (
                    <>Turn until music sounds clean</>
                  ) : (
                    <>Turn until echo disappears</>
                  )}
                </div>
                        
                {/* Drum and controls - same surface, now active */}
                <div className={s.calibrationDrumWrapper}>
                  <div className={s.delayValueDisplay}>
                    <span className={s.msValue}>{st.lineUpDelayMs}</span>
                    <span className={s.msUnit}>ms</span>
                  </div>
                          
                  {/* Large step buttons */}
                  <div className={s.stepButtonsRow}>
                    <button
                      className={s.stepBtn}
                      onClick={() => {
                        const newMs = Math.max(0, st.lineUpDelayMs - 10);
                        useMonitorStore.getState().setLineUpDelayMs(newMs);
                        (window as any).monitorMix?.previewDelayMs(newMs);
                      }}>
                      −10
                    </button>
                    <button
                      className={s.stepBtn}
                      onClick={() => {
                        const newMs = Math.max(0, st.lineUpDelayMs - 5);
                        useMonitorStore.getState().setLineUpDelayMs(newMs);
                        (window as any).monitorMix?.previewDelayMs(newMs);
                      }}>
                      −5
                    </button>
                    <button
                      className={s.stepBtn}
                      onClick={() => {
                        const newMs = Math.min(500, st.lineUpDelayMs + 5);
                        useMonitorStore.getState().setLineUpDelayMs(newMs);
                        (window as any).monitorMix?.previewDelayMs(newMs);
                      }}>
                      +5
                    </button>
                    <button
                      className={s.stepBtn}
                      onClick={() => {
                        const newMs = Math.min(500, st.lineUpDelayMs + 10);
                        useMonitorStore.getState().setLineUpDelayMs(newMs);
                        (window as any).monitorMix?.previewDelayMs(newMs);
                      }}>
                      +10
                    </button>
                  </div>
                          
                  {/* Drum control */}
                  <CalibrationDrum
                    value={st.lineUpDelayMs}
                    onChange={(newMs) => {
                      useMonitorStore.getState().setLineUpDelayMs(newMs);
                      (window as any).monitorMix?.previewDelayMs(newMs);
                    }}
                  />
                </div>
                        
                {/* Inline actions */}
                <div className={s.editingActionsRow}>
                  <button
                    className={s.cancelInlineBtn}
                    onClick={() => {
                      // Stop test sequence
                      // PART B: Use endPulseCalibration instead of stopSyncSequence + restoreAfterPulseLineUp
                      (window as any).monitorMix?.endPulseCalibration?.();
                      
                      // Restore previous delay from pre-session baseline
                      const revertMs = previousDelayRef.current;
                      const ae = (window as any).audioEngine;
                      const aeIsPlayingBeforeRestore = ae?.isPlaying ?? false;
                      
                      st.setDelayMs(revertMs);
                      useMonitorStore.getState().setLineUpDelayMs(revertMs);
                              
                      // Restore previous line up state
                      const prevStatus = (previousStatusRef.current || 'synced') as any;
                      useMonitorStore.getState().setLineUpStatus(prevStatus);
                      useMonitorStore.getState().setTestInProgress(false);
                      useMonitorStore.getState().setCalibrationMode(null);
                      
                      // Resume playback if paused by Pulse ritual
                      if (pausedByPulseRef.current && wasPlayingBeforeTestRef.current) {
                        const ae = (window as any).audioEngine;
                        if (ae) {
                          // PART A: Remove strict > 0 gate, allow restore for valid position including 0
                          ae.setCurrentTime(savedPositionRef.current || 0);
                          void ae.play();
                        }
                        pausedByPulseRef.current = false;
                      }
                              
                      // Re-lock
                      isLineUpLockedRef.current = true;
                      forceUpdate(n => n + 1);
                              
                      // Clear refs and reset tap session
                      wasPlayingBeforeTestRef.current = false;
                      savedPositionRef.current = 0;
                      tapTimestampsRef.current = [];
                      useMonitorStore.getState().resetTapSession();
                    }}>
                    ↺ Cancel
                  </button>
                  <button
                    className={s.confirmInlineBtn}
                    onClick={() => {
                      // Stop test sequence
                      // PART B: Use endPulseCalibration instead of stopSyncSequence + restoreAfterPulseLineUp
                      (window as any).monitorMix?.endPulseCalibration?.();
                              
                      // Commit delay to audio engine and persist
                      const finalDelay = useMonitorStore.getState().lineUpDelayMs;
                      
                      useMonitorStore.getState().setLineUpDelayMs(finalDelay);
                      st.setDelayMs(finalDelay);
                              
                      // Save calibration to device memory
                      const deviceId = st.outputDeviceId;
                      if (deviceId) {
                        const device = st.devices.find(d => d.deviceId === deviceId);
                        const deviceLabel = device?.label || `Device ${deviceId.slice(0, 8)}`;
                                
                        saveCalibration(deviceId, {
                          label: deviceLabel,
                          delayMs: finalDelay,
                          confidence: 'high',
                          calibratedAt: Date.now(),
                        });
                      }
                              
                      // Update UI state
                      useMonitorStore.getState().setLineUpStatus('synced');
                      useMonitorStore.getState().setTestInProgress(false);
                      useMonitorStore.getState().setLineUpCalibratedAt(Date.now());
                      useMonitorStore.getState().setCalibrationMode(null);
                      
                      // Resume playback if paused by Pulse ritual
                      if (pausedByPulseRef.current && wasPlayingBeforeTestRef.current) {
                        const ae = (window as any).audioEngine;
                        if (ae) {
                          // PART A: Remove strict > 0 gate, allow restore for valid position including 0
                          ae.setCurrentTime(savedPositionRef.current || 0);
                          void ae.play();
                        }
                        pausedByPulseRef.current = false;
                      }
                              
                      // Re-lock
                      isLineUpLockedRef.current = true;
                      forceUpdate(n => n + 1);
                              
                      // Clear refs and reset tap session
                      wasPlayingBeforeTestRef.current = false;
                      savedPositionRef.current = 0;
                      tapTimestampsRef.current = [];
                      useMonitorStore.getState().resetTapSession();
                    }}>
                    ✓ Sounds right
                  </button>
                </div>
              </>
            )}
                    
            {/* LOCKED state - drum visible but disabled */}
            {isLineUpLockedRef.current && st.lineUpStatus !== 'testing' && st.lineUpStatus !== 'idle' && (
              <div className={s.calibrationDrumWrapper}>
                <div className={s.delayValueDisplay}>
                  <span className={s.msValue}>{st.lineUpDelayMs}</span>
                  <span className={s.msUnit}>ms</span>
                </div>
                        
                {/* Drum control - disabled in locked state */}
                <CalibrationDrum
                  value={st.lineUpDelayMs}
                  onChange={() => {}}
                  disabled={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3 — Auto Mix */}
        <div className={s.section} data-col="automix" data-active={autoMixActive || backVocalActive ? "true" : "false"}>
          <div className={s.sectionHeader}>
            <span className={s.sectionTitle}>Auto Mix</span>
            <div className={s.masterBvSpacer} />
            <div className={s.masterBvRow}>
              <button
                className={`${s.masterBvDot} ${st.backVocalMasterOn ? s.masterBvDotActive : ''}`}
                onClick={() => st.setBackVocalMaster(!st.backVocalMasterOn)}
                type="button"
              />
              <span className={s.masterBvLabel}>Back Vocal</span>
              <input type="range" className={`${s.masterBvSlider} ${st.backVocalMasterOn ? s.masterBvSliderActive : s.masterBvSliderInactive}`}
                min={0} max={100}
                value={Math.round(st.backVocalMasterLevel * 100)}
                onChange={e => handleMasterBvLevelChange(+e.target.value / 100)} />
              <span className={s.val}>{Math.round(st.backVocalMasterLevel * 100)}%</span>
            </div>
          </div>
          <div className={s.automixStack}>
            {/* Dual Auto Mix block rows — left: main, right: Back Vocal */}
            <DualAutoMixRow
              label="Intro"
              active={st.autoIntroOn}
              onToggle={() => st.setAutoIntro(!st.autoIntroOn)}
              value={st.autoIntroLevel}
              onValue={st.setAutoIntroLevel}
              bvActive={st.backVocalIntroOn}
              onBvToggle={() => st.setBackVocalIntro(!st.backVocalIntroOn)}
              bvValue={st.backVocalIntroLevel}
              onBvValue={st.setBackVocalIntroLevel} />
            <DualAutoMixRow
              label="Verse"
              active={st.autoVerseOn}
              onToggle={() => st.setAutoVerse(!st.autoVerseOn)}
              value={st.autoVerseLevel}
              onValue={st.setAutoVerseLevel}
              bvActive={st.backVocalVerseOn}
              onBvToggle={() => st.setBackVocalVerse(!st.backVocalVerseOn)}
              bvValue={st.backVocalVerseLevel}
              onBvValue={st.setBackVocalVerseLevel} />
            <DualAutoMixRow
              label="Pre-chorus"
              active={st.autoPreChorusOn}
              onToggle={() => st.setAutoPreChorus(!st.autoPreChorusOn)}
              value={st.autoPreChorusLevel}
              onValue={st.setAutoPreChorusLevel}
              bvActive={st.backVocalPreChorusOn}
              onBvToggle={() => st.setBackVocalPreChorus(!st.backVocalPreChorusOn)}
              bvValue={st.backVocalPreChorusLevel}
              onBvValue={st.setBackVocalPreChorusLevel} />
            <DualAutoMixRow
              label="Chorus"
              active={st.autoChorusOn}
              onToggle={() => st.setAutoChorus(!st.autoChorusOn)}
              value={st.autoChorusLevel}
              onValue={st.setAutoChorusLevel}
              bvActive={st.backVocalChorusOn}
              onBvToggle={() => st.setBackVocalChorus(!st.backVocalChorusOn)}
              bvValue={st.backVocalChorusLevel}
              onBvValue={st.setBackVocalChorusLevel} />
            <DualAutoMixRow
              label="Bridge"
              active={st.autoBridgeOn}
              onToggle={() => st.setAutoBridge(!st.autoBridgeOn)}
              value={st.autoBridgeLevel}
              onValue={st.setAutoBridgeLevel}
              bvActive={st.backVocalBridgeOn}
              onBvToggle={() => st.setBackVocalBridge(!st.backVocalBridgeOn)}
              bvValue={st.backVocalBridgeLevel}
              onBvValue={st.setBackVocalBridgeLevel} />
            <DualAutoMixRow
              label="Outro"
              active={st.autoOutroOn}
              onToggle={() => st.setAutoOutro(!st.autoOutroOn)}
              value={st.autoOutroLevel}
              onValue={st.setAutoOutroLevel}
              bvActive={st.backVocalOutroOn}
              onBvToggle={() => st.setBackVocalOutro(!st.backVocalOutroOn)}
              bvValue={st.backVocalOutroLevel}
              onBvValue={st.setBackVocalOutroLevel} />
          </div>
        </div>


      </div>
    </div>
  );
}

/* ── CalibrationDrum: wide tactile calibration control with moving ticks ── */
function CalibrationDrum({ value, onChange, disabled }: { value: number; onChange: (ms: number) => void; disabled?: boolean }) {
  const drumRef = React.useRef<HTMLDivElement>(null);
  const isDraggingRef = React.useRef(false);
  const dragStartXRef = React.useRef(0);
  const dragStartValueRef = React.useRef(0);
  const onChangeRef = React.useRef(onChange);

  // Keep onChange ref updated without causing listener re-registration
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !drumRef.current) return;
      
      const deltaX = e.clientX - dragStartXRef.current;
      const rect = drumRef.current.getBoundingClientRect();
      const msPerPixel = 500 / rect.width;
      const deltaMs = -deltaX * msPerPixel;  // Invert: drag right decreases value (strip moves left)
      const rawValue = dragStartValueRef.current + deltaMs;
      const snappedValue = Math.round(rawValue / 5) * 5; // Snap to 5ms
      const clampedValue = Math.max(0, Math.min(500, snappedValue));
      
      onChangeRef.current(clampedValue);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartValueRef.current = value;
  };

  // Generate tick marks
  const ticks = [];
  for (let ms = 0; ms <= 500; ms += 5) {
    const isMajor = ms % 25 === 0;
    const isLandmark = ms % 50 === 0;
    ticks.push({ ms, isMajor, isLandmark });
  }

  // Calculate position of the tick strip
  // Scale reads left-to-right: 0ms on left, 500ms on right
  // Center marker stays fixed; strip moves to align current value under marker
  const totalTicks = ticks.length;
  const currentTickIndex = value / 5;
  const tickSpacingPercentage = 100 / (totalTicks - 1);
  const stripOffset = 50 - (currentTickIndex * tickSpacingPercentage);

  return (
    <div
      ref={drumRef}
      className={`${s.calibrationDrum} ${disabled ? s.calibrationDrumDisabled : ''}`}
      onPointerDown={disabled ? undefined : handlePointerDown}
    >
      {/* Fixed center marker */}
      <div className={s.centerMarker} />
      
      {/* Moving tick strip */}
      <div
        className={s.tickStrip}
        style={{ transform: `translateX(${stripOffset}%)` }}
      >
        {ticks.map((tick) => (
          <div
            key={tick.ms}
            className={`${s.tick} ${tick.isLandmark ? s.tickLandmark : tick.isMajor ? s.tickMajor : s.tickMinor}`}
            style={{ left: `${(tick.ms / 500) * 100}%` }}
          >
            {tick.isLandmark && (
              <span className={s.tickLabel}>{tick.ms}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DualAutoMixRow: dual-lane control (main + Back Vocal) ── */
function DualAutoMixRow({
  label,
  active,
  onToggle,
  value,
  onValue,
  bvActive,
  onBvToggle,
  bvValue,
  onBvValue
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  value: number;       /* 0-1 */
  onValue: (v: number) => void;
  bvActive: boolean;
  onBvToggle: () => void;
  bvValue: number;     /* 0-1 */
  onBvValue: (v: number) => void;
}) {
  return (
    <div className={s.dualAutoMixRow}>
      {/* Left side: Main AutoMix */}
      <div className={s.dualLeft}>
        <button
          className={`${s.dotToggle} ${active ? s.dotToggleActive : ''}`}
          onClick={onToggle}
          type="button"
        />
        <span className={s.toggleLabel}>{label}</span>
        <input type="range" className={`${s.slider} ${!active ? s.sliderInactive : ''}`}
          min={0} max={100} value={Math.round(value * 100)}
          onChange={e => onValue(+e.target.value / 100)} />
        <span className={s.val}>{Math.round(value * 100)}%</span>
      </div>
      {/* Divider */}
      <div className={s.dualDivider} />
      {/* Right side: Back Vocal */}
      <div className={s.dualRight}>
        <button
          className={`${s.dotToggle} ${bvActive ? s.dotToggleActive : ''}`}
          onClick={onBvToggle}
          type="button"
        />
        <span className={s.bvLabel}>{label}</span>
        <input type="range" className={`${s.bvSlider} ${bvActive ? s.bvSliderActive : ''}`}
          min={0} max={100} value={Math.round(bvValue * 100)}
          onChange={e => onBvValue(+e.target.value / 100)} />
        <span className={s.val}>{Math.round(bvValue * 100)}%</span>
      </div>
    </div>
  );
}

/* ── ToggleSliderRow: blue dot activator + slider + % ── */
function ToggleSliderRow({ label, active, onToggle, value, onValue, hideToggle }: {
  label: string;
  active: boolean;
  onToggle: () => void;
  value: number;       /* 0-1 */
  onValue: (v: number) => void;
  hideToggle?: boolean;
}) {
  return (
    <div className={s.toggleRow}>
      {!hideToggle && (
        <button
          className={`${s.dotToggle} ${active ? s.dotToggleActive : ''}`}
          onClick={onToggle}
          type="button"
        />
      )}
      <span className={s.toggleLabel}>{label}</span>
      <input type="range" className={`${s.slider} ${!active ? s.sliderInactive : ''}`}
        min={0} max={100} value={Math.round(value * 100)}
        onChange={e => onValue(+e.target.value / 100)} />
      <span className={s.val}>{Math.round(value * 100)}%</span>
    </div>
  );
}
