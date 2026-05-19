import React from 'react';
import { useTakesStore } from '../takes.store';
import { useAudioStore } from '../../stores/audio.store';
import { TakesRecorder } from '../takes.recorder';
import { takeAssets } from '../takes.assets';
import { createTakeId } from '../takes.types';
import type { TakeMeta } from '../takes.types';
import { useExerciseStore } from '../../exercises/exercise.store';
import { isExerciseExecutionLocked } from '../../exercises/exercise.runtime';
import { RecipeCardPopover } from '../../exercises/components/RecipeCardPopover';
import {
  interruptPracticeSession,
} from '../../exercises/exercise.interruption';
import { useTakesPlayback } from '../hooks/useTakesPlayback';
import { useTakeDelete } from '../hooks/useTakeDelete';
import { usePracticeInterrupt } from '../hooks/usePracticeInterrupt';

interface TakesControlStripProps {
  activeBlockId: string;
  timeRange: { startTime: number; endTime: number };
  onCountdownChange?: (value: number | null) => void;
  compareMode?: 'off' | 'ab';
  onCompareModeChange?: (mode: 'off' | 'ab') => void;
  activeCompareSlot?: number | null;
  onActiveCompareSlotChange?: (slot: number | null) => void;
  onRecorderAnalyserChange?: (analyser: AnalyserNode | null) => void;
}

export const TakesControlStrip: React.FC<TakesControlStripProps> = ({
  activeBlockId, timeRange, onCountdownChange, compareMode = 'off', onCompareModeChange, activeCompareSlot, onActiveCompareSlotChange, onRecorderAnalyserChange,
}) => {
  const isRecording = useTakesStore(s => s.isRecording);
  const recordingSlot = useTakesStore(s => s.recordingSlot);
  const getBlockTakes = useTakesStore(s => s.getBlockTakes);
  const getNextEmptySlot = useTakesStore(s => s.getNextEmptySlot);
  const startRecording = useTakesStore(s => s.startRecording);
  const selectTake = useTakesStore(s => s.selectTake);
  const deleteTake = useTakesStore(s => s.deleteTake);

  // Exercise orchestration selectors
  const shouldTriggerRecord = useExerciseStore((s) => s.shouldTriggerRecord);
  const exerciseRecordSlot = useExerciseStore((s) => s.recordSlot);
  const exerciseRecordMode = useExerciseStore((s) => s.recordMode);
  const clearRecordTrigger = useExerciseStore((s) => s.clearRecordTrigger);
  const activeExercise = useExerciseStore((s) => s.activeExercise);
  const exerciseResolvedTimeRange = useExerciseStore((s) => s.resolvedTimeRange);
  const exercisePhase = useExerciseStore((s) => s.phase);
  const getCurrentStep = useExerciseStore((s) => s.getCurrentStep);
  
  // Round capture state for slot locking
  const roundCapture = useExerciseStore((s) => s.roundCapture);
  const setRoundCaptureLockedSlot = useExerciseStore((s) => s.setRoundCaptureLockedSlot);
  const setRoundCaptureRecorderArmed = useExerciseStore((s) => s.setRoundCaptureRecorderArmed);
  const setRoundCaptureResponseActive = useExerciseStore((s) => s.setRoundCaptureResponseActive);
  const setRoundCaptureWindowIndex = useExerciseStore((s) => s.setRoundCaptureWindowIndex);
  const clearRoundCapture = useExerciseStore((s) => s.clearRoundCapture);
  
  // Derive exercise playback lock - prevents preview/compare interference during active execution
  const exercisePlaybackLocked = isExerciseExecutionLocked(activeExercise, exercisePhase);

  const recorderRef = React.useRef<TakesRecorder | null>(null);
  const handleStopRef = React.useRef<() => void>(() => {});
  const handleInFlightStopRef = React.useRef<() => void>(() => {});
  const stopTimerRef = React.useRef<number | null>(null);
  const timeCheckRef = React.useRef<number | null>(null);
  const countdownRef = React.useRef<number | null>(null);
  const deleteReRecordTimeoutRef = React.useRef<number | null>(null);

  const [countdown, setCountdown] = React.useState<number | null>(null);
  const [recipesOpen, setRecipesOpen] = React.useState(false);
  
  // Reference playback constant
  const PLAYING_REFERENCE_ID = '__reference__';

  const blockTakes = getBlockTakes(activeBlockId);
  const nextSlot = getNextEmptySlot(activeBlockId);
  const PRE_ROLL_SEC = 3;
  const previewMode = useTakesStore(s => s.previewMode);
  const setPreviewMode = useTakesStore(s => s.setPreviewMode);
  
  // Preview/playback hook
  const { handlePlayTake, stopPreview, playingTakeId, setPlayingTakeId } = useTakesPlayback({
    activeBlockId,
    timeRange,
    previewMode,
  });
  
  // Delete slot hook
  const { handleDeleteSlot } = useTakeDelete({
    activeBlockId,
    blockTakes,
    playingTakeId,
    stopPreview,
    activeCompareSlot: activeCompareSlot ?? null,
    onActiveCompareSlotChange,
    deleteTake,
  });
  
  // Practice interrupt hook
  const { handlePracticeInterrupt } = usePracticeInterrupt({
    countdownRef,
    timeCheckRef,
    stopTimerRef,
    deleteReRecordTimeoutRef,
    recorderRef,
    onCountdownChange,
    onRecorderAnalyserChange,
    playingTakeId,
    stopPreview,
    setCountdown,
  });
  
  // Reference label - compact helper when compare is on but no reference selected
  const referenceHelperLabel = React.useMemo(() => {
    if (compareMode !== 'ab') return null;
    
    const bt = blockTakes;
    if (!bt) return null;
    
    if (bt.selectedSlot === null || bt.takes[bt.selectedSlot]?.status !== 'ready') {
      return '★ Pick Ref';
    }
    
    return null;
  }, [compareMode, blockTakes]);
  
  // Target label removed - moved to card-level semantics
  
  // Check if vocal reference is available
  const hasVocalReference = React.useMemo(() => {
    const ae = (window as any).audioEngine;
    return !!ae?.stems?.has?.('vocals');
  }, [activeBlockId]);

  // Cleanup helper for active recording timers
  const clearActiveRecordingTimers = React.useCallback(() => {
    if (timeCheckRef.current) {
      clearInterval(timeCheckRef.current);
      timeCheckRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (countdownRef.current) {
      cancelAnimationFrame(countdownRef.current);
      countdownRef.current = null;
    }
    if (deleteReRecordTimeoutRef.current) {
      clearTimeout(deleteReRecordTimeoutRef.current);
      deleteReRecordTimeoutRef.current = null;
    }
  }, []);

  const handleRecord = React.useCallback(async (targetSlot?: number) => {
    if (isRecording || countdown !== null) return;
    
    // Determine target slot: explicit parameter or fallback to next empty slot
    const slot = targetSlot ?? nextSlot;
    if (slot === null) return;
    
    // Detect tempo-aware training recording from current exercise step
    const currentStep = getCurrentStep();
    const tempoRate = currentStep?.tempoRate;
    const takeKind = currentStep?.takeKind;
    
    // Guard: prevent recording over existing take unless it's the current recording slot
    // Exception: allow overwrite if both existing and incoming are training takes
    // Exception: allow overwrite if both existing and incoming are tempo-tagged (ladder stages)
    const existingTake = blockTakes?.takes[slot];
    const isTrainingOverwrite = existingTake && takeKind === 'training' && existingTake.takeKind === 'training';
    const isTempoTaggedOverwrite = existingTake && tempoRate && existingTake.tempoRate && (takeKind === 'training' || takeKind === 'final');
    if (existingTake && !isRecording && !isTrainingOverwrite && !isTempoTaggedOverwrite) return; // Block retake for now
    
    // Determine effective time range: exercise resolvedTimeRange takes precedence during pre-recording
    const effectiveTimeRange =
      activeExercise && exercisePhase === 'pre-recording' && exerciseResolvedTimeRange
        ? exerciseResolvedTimeRange
        : timeRange;
    
    if (!effectiveTimeRange) return;
    
    const ae = (window as any).audioEngine;
    if (!ae) return;
    
    try {
      // Only force 1.0 playback rate if NOT a tempo-aware training record
      if (typeof ae.setPlaybackRate === 'function' && !tempoRate) {
        ae.setPlaybackRate(1);
      } else if (typeof ae.setPlaybackRate === 'function' && tempoRate) {
        ae.setPlaybackRate(tempoRate);
      }
      if (ae.microphone && !ae.microphone.enabled) await ae.enableMicrophone();
      
      // Detect line-scoped record stage: reduce pre-roll to 0 for line-range-scoped transactions
      const isLineScopedRecord = currentStep?.scope?.lineRange !== undefined;
      const effectivePreRoll = isLineScopedRecord ? 0 : PRE_ROLL_SEC;
      
      // Pre-roll seek and playback
      const preRollStart = Math.max(0, effectiveTimeRange.startTime - effectivePreRoll);
      const actualPreRoll = effectiveTimeRange.startTime - preRollStart;
      if (typeof ae.setCurrentTime === 'function') ae.setCurrentTime(preRollStart);
      ae.play();
      
      // Start recorder AFTER seek+play — engine is now at preRollStart position
      const recorder = new TakesRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      
      // Store start time for trim calculation
      const recorderStartedAt = performance.now();
      
      // Countdown UX (if pre-roll > 0.5s)
      if (actualPreRoll > 0.5) {
        setCountdown(Math.ceil(actualPreRoll));
        onCountdownChange?.(Math.ceil(actualPreRoll));
        await new Promise<void>((resolve) => {
          let remaining = Math.ceil(actualPreRoll);
          let vocalFadeScheduled = false;
          const tick = () => {
            const ct = ae.getCurrentTime?.() ?? 0;
            const left = Math.max(0, effectiveTimeRange.startTime - ct);
            if (left <= 0.05) { 
              setCountdown(null); 
              onCountdownChange?.(null);
              resolve(); 
              return; 
            }
            const nc = Math.ceil(left);
            if (nc !== remaining) { 
              remaining = nc; 
              setCountdown(remaining); 
              onCountdownChange?.(remaining);
            }
            
            // Smooth vocal fade in final countdown window (one-shot per countdown)
            if (!vocalFadeScheduled && left <= 1.0) {
              vocalFadeScheduled = true;
              try {
                const vocalsGain = (ae as any).stems?.get?.('vocals')?.gainNode;
                if (vocalsGain && vocalsGain.gain && typeof vocalsGain.gain.linearRampToValueAtTime === 'function') {
                  const ctx = (ae as any).audioContext;
                  if (ctx) {
                    const targetVocal = 0;
                    const fadeEndTime = ctx.currentTime + left;
                    vocalsGain.gain.linearRampToValueAtTime(targetVocal, fadeEndTime);
                  }
                }
              } catch (_) {
                // Fallback: if vocalsGain unavailable, continue without fade
              }
            }
            
            countdownRef.current = requestAnimationFrame(tick);
          };
          countdownRef.current = requestAnimationFrame(tick);
        });
      }
      
      // AT ACTUAL BLOCK START: activate visible recording state and expose analyser
      startRecording(activeBlockId, slot);
      onRecorderAnalyserChange?.(recorder.analyser ?? null);
      
      // Compute trimStartSec using already-armed recorder
      const detectedAtWall = performance.now();
      const engineNow = ae.getCurrentTime?.() ?? effectiveTimeRange.startTime;
      
      // [TRIM-BASIS] Log trim computation for standard visible path
      const rawDelta = engineNow - effectiveTimeRange.startTime;
      const rawDeltaSec = rawDelta;
      const rawDeltaMs = rawDelta * 1000;
      const wallDeltaSec = (detectedAtWall - recorderStartedAt) / 1000;
      const oldTrim = Math.max(0, wallDeltaSec - Math.max(0, rawDelta));
      
      // For tempo-aware training recording, convert engine progress to wall-time correctly
      const engineProgressSec = tempoRate ? rawDelta / tempoRate : rawDelta; // unclipped, scaled by tempo
      const computedTrim = Math.max(0, wallDeltaSec - engineProgressSec);
      const wasClippedBefore = oldTrim !== (wallDeltaSec - rawDeltaSec);
      const fixDeltaMs = (computedTrim - oldTrim) * 1000;
      
      console.log('[TRIM-BASIS]', {
        blockId: activeBlockId,
        slot,
        blockStart: effectiveTimeRange.startTime,
        engineNow,
        rawDeltaSec,
        rawDeltaMs,
        wasClippedBefore,
        wallDeltaSec,
        computedTrim,
        oldTrim,
        fixDeltaMs,
        tempoRate,
        takeKind,
      });
      
      (recorderRef.current as any).__trimStartSec = computedTrim;
      (recorderRef.current as any).__tempoRate = tempoRate;
      (recorderRef.current as any).__takeKind = takeKind;
      
      // Telemetry: capture late start offset (truth capture only)
      const lateStartOffsetSec = engineNow - effectiveTimeRange.startTime; // unclipped
      (recorderRef.current as any).__lateStartOffsetSec = lateStartOffsetSec;
      
      console.log('[Takes] Recorder armed early, visible REC started at engine time:', 
        ae.getCurrentTime?.()?.toFixed(3));
      // Start stop timer / safety timeout
      clearActiveRecordingTimers();
      const blockEnd = effectiveTimeRange.endTime;
      timeCheckRef.current = window.setInterval(() => {
        const ct = ae.getCurrentTime?.() ?? 0;
        if (ct >= blockEnd) handleStopRef.current();
      }, 100);
      // Adjust safety timeout for tempo-aware training record: slower tempo needs more wall-time
      const blockDurationSec = effectiveTimeRange.endTime - effectiveTimeRange.startTime;
      const adjustedDurationSec = tempoRate ? blockDurationSec / tempoRate : blockDurationSec;
      const safetyMs = (adjustedDurationSec + 5) * 1000;
      stopTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.isRecording) handleStopRef.current();
      }, safetyMs);
    } catch (err) {
      console.error('[Takes] Recording failed:', err);
      clearActiveRecordingTimers();
      setCountdown(null);
      onCountdownChange?.(null);
      useTakesStore.getState().cancelRecording();
    }
  }, [activeBlockId, timeRange, nextSlot, isRecording, countdown, startRecording, blockTakes, activeExercise, exercisePhase, exerciseResolvedTimeRange, getCurrentStep]);

  // Intermediate window end handler - keeps recorder session alive
  const handleIntermediateWindowEnd = React.useCallback(() => {
    if (timeCheckRef.current) {
      clearInterval(timeCheckRef.current);
      timeCheckRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    onRecorderAnalyserChange?.(null);
    setRoundCaptureResponseActive(false);

    // move exercise forward, but keep recorder session alive
    useExerciseStore.getState().advanceToNextStep();
  }, [onRecorderAnalyserChange, setRoundCaptureResponseActive]);

  // Round capture finalize handler - stops recorder and commits blob once
  const handleRoundCaptureFinalize = React.useCallback(async () => {
    if (timeCheckRef.current) {
      clearInterval(timeCheckRef.current);
      timeCheckRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording) {
      onRecorderAnalyserChange?.(null);
      setRoundCaptureResponseActive(false);
      setRoundCaptureRecorderArmed(false);
      clearRoundCapture();
      useTakesStore.getState().cancelRecording();
      return;
    }

    try {
      const blob = await recorder.stop();
      recorderRef.current = null;
      onRecorderAnalyserChange?.(null);

      setRoundCaptureResponseActive(false);
      setRoundCaptureRecorderArmed(false);

      // Blob sanity guard
      if (!blob || blob.size < 500) {
        clearRoundCapture();
        useTakesStore.getState().cancelRecording();
        return;
      }

      const currentSlot = useTakesStore.getState().recordingSlot;
      if (currentSlot === null) {
        clearRoundCapture();
        useTakesStore.getState().cancelRecording();
        return;
      }

      const takeId = createTakeId(activeBlockId, currentSlot);
      takeAssets.store(takeId, blob);

      const trimStartSec = (recorder as any).__trimStartSec ?? 0;
      const lateStartOffsetSec = (recorder as any).__lateStartOffsetSec ?? 0;
      console.log('[SYNC]', { 
        trim: trimStartSec.toFixed(4), 
        late: lateStartOffsetSec.toFixed(4),
        slot: currentSlot 
      });
      const meta: TakeMeta = {
        id: takeId,
        blockId: activeBlockId,
        slot: currentSlot,
        mimeType: recorder.mimeType,
        duration: null,
        recordedAt: Date.now(),
        status: 'processing',
        peaksReady: false,
        trimStartSec,
        lateStartOffsetSec,
      };

      useTakesStore.getState().finishRecording(meta);

      blob.arrayBuffer()
        .then(async (ab) => {
          const ctx2: AudioContext =
            ((window as any).audioEngine?.audioContext ??
             (window as any).audioEngine?._audioContext);
          if (!ctx2) return;
          const audioBuffer = await ctx2.decodeAudioData(ab);
          const { generatePeaks } = await import('../../sync/canvas/peaks');
          const ch = audioBuffer.getChannelData(0);
          const peaks = generatePeaks(ch, 0, ch.length, 200);
          const pv = new Float32Array(peaks.length);
          for (let i = 0; i < peaks.length; i++) pv[i] = peaks[i][1];
          takeAssets.cacheDecoded(takeId, audioBuffer, pv);

          const s = useTakesStore.getState();
          const bt = s.getBlockTakes(activeBlockId);
          const em = bt.takes[currentSlot];
          if (em) {
            s.finishRecording({
              ...em,
              duration: audioBuffer.duration - trimStartSec,
              status: 'ready',
              peaksReady: true,
            });
          }
        })
        .catch((err) => {
          console.error('[Takes] In-flight decode failed:', err);
        });

      clearRoundCapture();
      // IMPORTANT: do NOT ae.pause() here.
      // Bridge will see final isRecording OFF and advance final step.
    } catch (err) {
      console.error('[Takes] In-flight stop failed:', err);
      recorderRef.current = null;
      onRecorderAnalyserChange?.(null);
      setRoundCaptureResponseActive(false);
      setRoundCaptureRecorderArmed(false);
      clearRoundCapture();
      useTakesStore.getState().cancelRecording();
    }
  }, [
    activeBlockId,
    onRecorderAnalyserChange,
    setRoundCaptureResponseActive,
    setRoundCaptureRecorderArmed,
    clearRoundCapture,
  ]);

  // In-flight response capture for continuous flow (Call & Response)
  // In-flight capture path intentionally left unchanged in TAKE-SYNC-TRUTH wave.
  // Standard path is corrected first; in-flight alignment is evaluated separately.
  const handleInFlightRecord = React.useCallback(async (targetSlot?: number) => {
    const slot = targetSlot ?? nextSlot;
    if (slot === null) return;

    const ae = (window as any).audioEngine;
    if (!ae || !exerciseResolvedTimeRange) return;

    const currentStep = getCurrentStep();

    // CONTINUATION BRANCH - intermediate windows reuse same recorder session
    if (
      roundCapture?.active &&
      roundCapture.recorderArmed &&
      !roundCapture.responseActive &&
      recorderRef.current?.isRecording
    ) {
      // no new recorder, same round session
      setRoundCaptureWindowIndex(currentStep?.responseWindowIndex ?? roundCapture.currentWindowIndex);
      setRoundCaptureResponseActive(true);
      useExerciseStore.getState().setPhase('recording');
      onRecorderAnalyserChange?.(recorderRef.current.analyser ?? null);

      clearActiveRecordingTimers();
      const stopTime = exerciseResolvedTimeRange.endTime;
      timeCheckRef.current = window.setInterval(() => {
        const ct = ae.getCurrentTime?.() ?? 0;
        const isFinalWindow =
          (currentStep?.totalResponseWindows ?? 1) - 1 <= (currentStep?.responseWindowIndex ?? 0);

        if (ct >= stopTime) {
          if (isFinalWindow) {
            handleRoundCaptureFinalize();
          } else {
            handleIntermediateWindowEnd();
          }
        }
      }, 100);

      const safetyMs =
        (exerciseResolvedTimeRange.endTime - exerciseResolvedTimeRange.startTime + 5) * 1000;
      stopTimerRef.current = window.setTimeout(() => {
        const isFinalWindow =
          (currentStep?.totalResponseWindows ?? 1) - 1 <= (currentStep?.responseWindowIndex ?? 0);

        if (isFinalWindow) {
          handleRoundCaptureFinalize();
        } else {
          handleIntermediateWindowEnd();
        }
      }, safetyMs);

      return;
    }

    // FIRST WINDOW BRANCH - starts new recorder session
    try {
      // 1. Enable microphone if needed (hidden, no UI state yet)
      if (ae.microphone && !ae.microphone.enabled) {
        await ae.enableMicrophone();
      }

      // 2. Create and start recorder (armed but hidden - no UI state yet)
      const recorder = new TakesRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      
      // DO NOT expose analyser yet - keeps live trail hidden
      // onRecorderAnalyserChange?.(recorder.analyser ?? null); // ← NOT YET

      const recorderStartedAt = performance.now();

      // 3. Wait until engine reaches target start time
      await new Promise<void>((resolve) => {
        const waitForTarget = () => {
          const ct = ae.getCurrentTime?.() ?? 0;
          if (ct >= exerciseResolvedTimeRange.startTime) {
            const detectedAtWall = performance.now();
            const engineProgressSec = Math.max(
              0,
              ct - exerciseResolvedTimeRange.startTime
            );
            const wallDeltaSec = (detectedAtWall - recorderStartedAt) / 1000;
            const computedTrim = Math.max(0, wallDeltaSec - engineProgressSec);
            (recorderRef.current as any).__trimStartSec = computedTrim;
            resolve();
            return;
          }
          requestAnimationFrame(waitForTarget);
        };
        requestAnimationFrame(waitForTarget);
      });

      // 4. NOW activate UI state at actual response start
      startRecording(activeBlockId, slot);
      setRoundCaptureRecorderArmed(true);
      setRoundCaptureResponseActive(true);
      setRoundCaptureWindowIndex(currentStep?.responseWindowIndex ?? 0);
      useExerciseStore.getState().setPhase('recording');
      onRecorderAnalyserChange?.(recorder.analyser ?? null);

      // 5. Start stop timers
      const stopTime = exerciseResolvedTimeRange.endTime;
      const isFinalWindow =
        (currentStep?.totalResponseWindows ?? 1) - 1 <= (currentStep?.responseWindowIndex ?? 0);

      clearActiveRecordingTimers();
      timeCheckRef.current = window.setInterval(() => {
        const ct = ae.getCurrentTime?.() ?? 0;
        if (ct >= stopTime) {
          if (isFinalWindow) {
            handleRoundCaptureFinalize();
          } else {
            handleIntermediateWindowEnd();
          }
        }
      }, 100);

      const safetyMs =
        (exerciseResolvedTimeRange.endTime - exerciseResolvedTimeRange.startTime + 5) * 1000;
      stopTimerRef.current = window.setTimeout(() => {
        if (isFinalWindow) {
          handleRoundCaptureFinalize();
        } else {
          handleIntermediateWindowEnd();
        }
      }, safetyMs);
    } catch (err) {
      console.error('[Takes] In-flight recording failed:', err);
      clearActiveRecordingTimers();
      onRecorderAnalyserChange?.(null);
      setRoundCaptureRecorderArmed(false);
      setRoundCaptureResponseActive(false);
      clearRoundCapture();
      useTakesStore.getState().cancelRecording();
    }
  }, [
    activeBlockId,
    nextSlot,
    exerciseResolvedTimeRange,
    startRecording,
    onRecorderAnalyserChange,
    roundCapture,
    getCurrentStep,
    setRoundCaptureRecorderArmed,
    setRoundCaptureResponseActive,
    setRoundCaptureWindowIndex,
    handleIntermediateWindowEnd,
    handleRoundCaptureFinalize,
  ]);

  const handleStop = React.useCallback(async () => {
    if (countdownRef.current) { cancelAnimationFrame(countdownRef.current); countdownRef.current = null; }
    setCountdown(null);
    onCountdownChange?.(null);
    if (timeCheckRef.current) { clearInterval(timeCheckRef.current); timeCheckRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    const ae = (window as any).audioEngine;
    const recorder = recorderRef.current;
    if (typeof ae?.pause === 'function') ae.pause();
    if (!recorder || !recorder.isRecording) {
      useTakesStore.getState().cancelRecording();
      return;
    }
    try {
      const blob = await recorder.stop();
      recorderRef.current = null;
      
      // Clear analyser reference
      onRecorderAnalyserChange?.(null);
      const currentSlot = useTakesStore.getState().recordingSlot;
      if (currentSlot === null) {
        useTakesStore.getState().cancelRecording();
        return;
      }
      const takeId = createTakeId(activeBlockId, currentSlot);
      takeAssets.store(takeId, blob);
      const trimStartSec = (recorder as any).__trimStartSec ?? 0;
      const lateStartOffsetSec = (recorder as any).__lateStartOffsetSec ?? 0;
      const tempoRate = (recorder as any).__tempoRate;
      const takeKind = (recorder as any).__takeKind;
      const meta: TakeMeta = {
        id: takeId, blockId: activeBlockId, slot: currentSlot,
        mimeType: recorder.mimeType, duration: null,
        recordedAt: Date.now(), status: 'processing',
        peaksReady: false, trimStartSec, lateStartOffsetSec,
        ...(tempoRate !== undefined && { tempoRate }),
        ...(takeKind !== undefined && { takeKind }),
      };
      useTakesStore.getState().finishRecording(meta);
      blob.arrayBuffer().then(async (ab) => {
        const ctx2: AudioContext = ae?.audioContext ?? ae?._audioContext;
        if (!ctx2) return;
        const audioBuffer = await ctx2.decodeAudioData(ab);
        const { generatePeaks } = await import('../../sync/canvas/peaks');
        const ch = audioBuffer.getChannelData(0);
        const peaks = generatePeaks(ch, 0, ch.length, 200);
        const pv = new Float32Array(peaks.length);
        for (let i = 0; i < peaks.length; i++) pv[i] = peaks[i][1];
        takeAssets.cacheDecoded(takeId, audioBuffer, pv);
        useTakesStore.getState().bumpAssetRevision();
        const s = useTakesStore.getState();
        const bt2 = s.getBlockTakes(activeBlockId);
        const em = bt2.takes[currentSlot];
        if (!em) return;
        if (em.id !== takeId) return;
        s.finishRecording({ ...em, duration: audioBuffer.duration - trimStartSec, status: 'ready', peaksReady: true });
      }).catch(err => {
        console.error('[Takes] Decode failed:', err);
      });
    } catch (err) {
      console.error('[Takes] Stop failed:', err);
      onRecorderAnalyserChange?.(null);
      useTakesStore.getState().cancelRecording();
    }
  }, [activeBlockId]);

  handleStopRef.current = handleStop;

  // In-flight stop handler - does NOT pause engine (per-window finalize)
  const handleInFlightStop = React.useCallback(async () => {
    if (timeCheckRef.current) {
      clearInterval(timeCheckRef.current);
      timeCheckRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording) {
      onRecorderAnalyserChange?.(null);
      useTakesStore.getState().cancelRecording();
      return;
    }

    try {
      const blob = await recorder.stop();
      recorderRef.current = null;
      onRecorderAnalyserChange?.(null);

      // Blob sanity guard
      if (!blob || blob.size < 500) {
        useTakesStore.getState().cancelRecording();
        return;
      }

      const currentSlot = useTakesStore.getState().recordingSlot;
      if (currentSlot === null) {
        useTakesStore.getState().cancelRecording();
        return;
      }

      const takeId = createTakeId(activeBlockId, currentSlot);
      takeAssets.store(takeId, blob);

      const trimStartSec = (recorder as any).__trimStartSec ?? 0;
      const lateStartOffsetSec = (recorder as any).__lateStartOffsetSec ?? 0;
      const meta: TakeMeta = {
        id: takeId,
        blockId: activeBlockId,
        slot: currentSlot,
        mimeType: recorder.mimeType,
        duration: null,
        recordedAt: Date.now(),
        status: 'processing',
        peaksReady: false,
        trimStartSec,
        lateStartOffsetSec,
      };

      useTakesStore.getState().finishRecording(meta);

      blob.arrayBuffer()
        .then(async (ab) => {
          const ctx2: AudioContext =
            ((window as any).audioEngine?.audioContext ??
             (window as any).audioEngine?._audioContext);
          if (!ctx2) return;
          const audioBuffer = await ctx2.decodeAudioData(ab);
          const { generatePeaks } = await import('../../sync/canvas/peaks');
          const ch = audioBuffer.getChannelData(0);
          const peaks = generatePeaks(ch, 0, ch.length, 200);
          const pv = new Float32Array(peaks.length);
          for (let i = 0; i < peaks.length; i++) pv[i] = peaks[i][1];
          takeAssets.cacheDecoded(takeId, audioBuffer, pv);

          const s = useTakesStore.getState();
          const bt = s.getBlockTakes(activeBlockId);
          const em = bt.takes[currentSlot];
          if (em) {
            s.finishRecording({
              ...em,
              duration: audioBuffer.duration - trimStartSec,
              status: 'ready',
              peaksReady: true,
            });
          }
        })
        .catch((err) => {
          console.error('[Takes] In-flight decode failed:', err);
        });

      // IMPORTANT: no ae.pause() here
    } catch (err) {
      console.error('[Takes] In-flight stop failed:', err);
      recorderRef.current = null;
      onRecorderAnalyserChange?.(null);
      useTakesStore.getState().cancelRecording();
    }
  }, [activeBlockId, onRecorderAnalyserChange]);

  handleInFlightStopRef.current = handleInFlightStop;

  // Hidden exercise record trigger orchestration
  React.useEffect(() => {
    if (!shouldTriggerRecord) return;
    if (countdown !== null) return;
    
    // REMOVED: continuationAllowed for multi-window ownership
    // Recovery path: each window triggers independently
    if (isRecording) return;  // Standard guard

    clearRecordTrigger();
    
    // REMOVED: effectiveExerciseSlot from roundCapture.lockedSlot
    // Recovery path: use per-window slot semantics
    const effectiveExerciseSlot = exerciseRecordSlot ?? nextSlot;
    
    // REMOVED: locking logic for roundCapture
    // This metadata preserved but not used for runtime authority
    
    // Choose recording path based on capture mode
    if (exerciseRecordMode === 'in-flight') {
      handleInFlightRecord(effectiveExerciseSlot ?? undefined);
    } else {
      handleRecord(effectiveExerciseSlot ?? undefined);
    }
  }, [
    shouldTriggerRecord,
    exerciseRecordSlot,
    exerciseRecordMode,
    isRecording,
    countdown,
    clearRecordTrigger,
    nextSlot,
    handleRecord,
    handleInFlightRecord,
  ]);

  React.useEffect(() => {
    return () => {
      if (timeCheckRef.current) clearInterval(timeCheckRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (countdownRef.current) cancelAnimationFrame(countdownRef.current);
      if (deleteReRecordTimeoutRef.current) clearTimeout(deleteReRecordTimeoutRef.current);
      if (recorderRef.current?.isRecording) recorderRef.current.cancel();
      
      // Cleanup analyser on unmount
      onRecorderAnalyserChange?.(null);
      
      // Cleanup countdown on unmount
      onCountdownChange?.(null);
    };
  }, [onRecorderAnalyserChange, onCountdownChange]);

  // Auto-close recipe popover when panel loses activeBlockId or exercise starts
  React.useEffect(() => {
    if (!activeBlockId) {
      setRecipesOpen(false);
    }
  }, [activeBlockId]);

  return (
    <div style={styles.root}>
      {/* Centered hero cluster wrapper */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        {/* Neutral layout: Take 1 / Take 2 / Take 3 */}
        {[0, 1, 2].map(slot => {
          const take = blockTakes?.takes[slot] ?? null;
          const isEmpty = !take;
          const isReady = take?.status === 'ready';
          const isBest = blockTakes?.selectedSlot === slot;
          const isThisRec = isRecording && recordingSlot === slot;
          const isPlaying = playingTakeId === take?.id;
          const isCurrentVisible = compareMode === 'off' && activeCompareSlot === slot;

          return (
            <div
              key={slot}
              onClick={() => {
                // Interrupt practice first if active, then continue requested action
                interruptPracticeSession(() => {
                  // BLOCK: prevent take preview during active exercise execution
                  if (exercisePlaybackLocked) return;
                  
                  if (isThisRec) return;
                  // Empty slot → record to THIS slot
                  if (isEmpty && !isRecording && countdown === null) {
                    // Set this slot as future compare target before recording starts
                    onActiveCompareSlotChange?.(slot);
                    handleRecord(slot);
                    return;
                  }
                  // Play if ready
                  if (isReady) {
                    // Set active compare target
                    onActiveCompareSlotChange?.(slot);
                    
                    // Always play the clicked take
                    handlePlayTake(take.id);
                  }
                });
              }}
              onMouseEnter={(e) => {
                if (!isEmpty && !isThisRec && !exercisePlaybackLocked) {
                  e.currentTarget.style.transform = 'scale(1.015) translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.55)';
                  e.currentTarget.style.borderColor = isEmpty 
                    ? 'rgba(255,255,255,0.45)' 
                    : isBest 
                      ? 'rgba(0,200,83,0.85)' 
                      : 'rgba(255,140,0,0.85)';
                } else if (isEmpty && !exercisePlaybackLocked) {
                  // Empty card hover: invitation feel
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.48)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = isPlaying
                  ? `inset 0 0 0 2px ${isBest ? 'rgba(0,200,83,0.7)' : 'rgba(255,140,0,0.7)'}`
                  : (isEmpty ? 'none' : 'none');
                e.currentTarget.style.borderColor = isEmpty 
                  ? 'rgba(255,255,255,0.22)' 
                  : isBest 
                    ? 'rgba(0,200,83,0.55)' 
                    : isThisRec 
                      ? 'rgba(255,70,70,0.6)' 
                      : 'rgba(255,140,0,0.55)';
              }}
              style={{
                position: 'relative',
                width: 340,
                height: 64,
                borderRadius: 14,
                overflow: 'visible',
                cursor: (isReady || isEmpty) ? 'pointer' : 'default',
                border: `1px ${isEmpty ? 'dashed' : 'solid'} ${
                  isEmpty ? 'rgba(255,255,255,0.22)'
                    : isCurrentVisible ? 'rgba(100,200,255,0.8)'
                    : isBest ? 'rgba(0,200,83,0.55)'
                    : isThisRec ? 'rgba(255,70,70,0.6)'
                    : 'rgba(255,140,0,0.55)'
                }`,
                background:
                  isEmpty ? '#16171f'
                  : isCurrentVisible ? 'rgba(100,200,255,0.06)'
                  : isBest ? 'rgba(0,200,83,0.08)'
                  : isThisRec ? 'rgba(255,70,70,0.08)'
                  : 'rgba(255,140,0,0.08)',
                boxShadow: isPlaying
                  ? `inset 0 0 0 2px ${isBest 
                      ? 'rgba(0,200,83,0.7)' 
                      : 'rgba(255,140,0,0.7)'}`
                  : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isEmpty ? 'center' : 'flex-start',
                justifyContent: isEmpty ? 'center' : 'flex-end',
                padding: '8px 12px',
                transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out',
                transform: 'scale(1)',
              }}
            >
            {isEmpty ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 8px' }}>
                <span style={{ 
                  fontSize: 15, 
                  color: 'rgba(255,255,255,0.65)', 
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                }}>
                  Take {slot + 1}
                </span>
                <span style={{
                  fontSize: 10,
                  color: 'rgba(255,70,70,0.80)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  ● Record
                </span>
              </div>
            ) : (
              <>
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  padding: '8px 14px',
                  fontSize: 12, fontWeight: 800,
                  color: 'rgba(255,255,255,0.88)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {isThisRec ? '● ' : ''}
                    Take {slot + 1}
                  </span>
                  {/* Compact inline markers for compare semantics */}
                  {compareMode === 'ab' && isBest && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'rgba(247,201,72,0.98)',
                      background: 'rgba(247,201,72,0.18)',
                      padding: '3px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.03em',
                    }}>
                      Ref
                    </span>
                  )}
                  {compareMode === 'ab' && activeCompareSlot === slot && !isBest && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'rgba(0,200,83,0.98)',
                      background: 'rgba(0,200,83,0.18)',
                      padding: '3px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.03em',
                    }}>
                      Target
                    </span>
                  )}
                  {compareMode === 'ab' && activeCompareSlot === slot && isBest && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'rgba(255,255,255,0.98)',
                      background: 'rgba(255,255,255,0.25)',
                      padding: '3px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.03em',
                    }}>
                      Ref+Target
                    </span>
                  )}
                  {take?.tempoRate && take.tempoRate !== 1.0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'rgba(100,200,255,0.98)',
                      background: 'rgba(100,200,255,0.18)',
                      padding: '3px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.03em',
                    }}>
                      {Math.round(take.tempoRate * 100)}%
                    </span>
                  )}
                </div>
                
                {/* Hover actions: Star + Delete */}
                {isReady && !isThisRec && (
                  <div
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.opacity = '1'; 
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.opacity = '0'; 
                    }}
                    style={{
                      position: 'absolute',
                      top: 5, right: 5,
                      display: 'flex', gap: 4,
                      zIndex: 3,
                      opacity: exercisePlaybackLocked ? 0.3 : 0,
                      transition: 'opacity 0.15s',
                      pointerEvents: exercisePlaybackLocked ? 'none' : 'auto',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Interrupt practice first if active, then continue requested action
                        interruptPracticeSession(() => {
                          // BLOCK: prevent retake during exercise execution
                          if (exercisePlaybackLocked) return;
                          // Clear active compare if retaking current target
                          if (activeCompareSlot === slot) {
                            onActiveCompareSlotChange?.(null);
                          }
                          handleDeleteSlot(slot);
                          // Set this slot as future compare target before retake
                          onActiveCompareSlotChange?.(slot);
                          deleteReRecordTimeoutRef.current = window.setTimeout(() => handleRecord(slot), 150);
                        });
                      }}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: 'rgba(0,0,0,0.65)',
                        color: 'rgba(255,70,70,0.82)',
                        fontSize: 10, cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: exercisePlaybackLocked ? 0.5 : 1,
                      }}
                      disabled={exercisePlaybackLocked}
                      title={exercisePlaybackLocked ? 'Unavailable during exercise execution' : 'Retake'}
                    >⟳</button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Interrupt practice first if active, then continue requested action
                        interruptPracticeSession(() => {
                          // BLOCK: prevent star toggle during exercise execution
                          if (exercisePlaybackLocked) return;
                          const current = blockTakes?.selectedSlot;
                          selectTake(activeBlockId, current === slot ? null : slot);
                        });
                      }}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: 'rgba(0,0,0,0.65)',
                        color: isBest ? '#f7c948' : 'rgba(255,255,255,0.65)',
                        fontSize: 12, cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: exercisePlaybackLocked ? 0.5 : 1,
                      }}
                      disabled={exercisePlaybackLocked}
                      title={exercisePlaybackLocked ? 'Unavailable during exercise execution' : 'Set reference'}
                    >{isBest ? '★' : '☆'}</button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Interrupt practice first if active, then continue requested action
                        interruptPracticeSession(() => {
                          // BLOCK: prevent delete during exercise execution
                          if (exercisePlaybackLocked) return;
                          handleDeleteSlot(slot);
                        });
                      }}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: 'rgba(0,0,0,0.65)',
                        color: 'rgba(255,255,255,0.65)',
                        fontSize: 12, cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: exercisePlaybackLocked ? 0.5 : 1,
                      }}
                      disabled={exercisePlaybackLocked}
                      title={exercisePlaybackLocked ? 'Unavailable during exercise execution' : 'Delete take'}
                    >✕</button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      </div>
      
      {/* Right utility zone: stop button */}
      <div style={{ flex: 1 }} />
      
      {/* Stop button for recording */}
      {(isRecording || countdown !== null) && (
        <button style={styles.stopBtn} onClick={handleStop}>{'■'}</button>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'transparent', borderTop: 'none' },
  stopBtn: { background: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '14px', fontWeight: 700, lineHeight: '1', minWidth: '28px' },
};
