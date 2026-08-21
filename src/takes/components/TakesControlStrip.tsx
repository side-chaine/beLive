import React from 'react';
import { useTakesStore } from '../takes.store';
import { useAudioStore } from '../../stores/audio.store';
import { TakesRecorder } from '../takes.recorder';
import { takeAssets } from '../takes.assets';
import { createTakeId } from '../takes.types';
import type { TakeMeta } from '../takes.types';
import { useExerciseStore } from '../../exercises/exercise.store';
import { isExerciseExecutionLocked } from '../../exercises/exercise.runtime';
import {
  interruptPracticeSession,
} from '../../exercises/exercise.interruption';
import { useTakesPlayback } from '../hooks/useTakesPlayback';
import { useTakeDelete } from '../hooks/useTakeDelete';
import { usePracticeInterrupt } from '../hooks/usePracticeInterrupt';
import { getTransport } from '../../audio/engine-v3';
import { TakeSlot } from './TakeSlot';
import { getPlaybackTime, seekTo, setRate } from '../takes.time';

interface TakesControlStripProps {
  activeBlockId: string;
  timeRange: { startTime: number; endTime: number };
  onCountdownChange?: (value: number | null) => void;
  compareMode?: 'off' | 'ab';
  onCompareModeChange?: (mode: 'off' | 'ab') => void;
  activeCompareSlot?: number | null;
  onActiveCompareSlotChange?: (slot: number | null) => void;
  onRecorderAnalyserChange?: (analyser: AnalyserNode | null) => void;
  onRecordAbort?: (message: string) => void;
}

export const TakesControlStrip: React.FC<TakesControlStripProps> = ({
  activeBlockId, timeRange, onCountdownChange, compareMode = 'off', onCompareModeChange, activeCompareSlot, onActiveCompareSlotChange, onRecorderAnalyserChange, onRecordAbort,
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
  const [micError, setMicError] = React.useState<string | null>(null);
  const handleStopRef = React.useRef<() => void>(() => {});
  const handleInFlightStopRef = React.useRef<() => void>(() => {});
  const stopTimerRef = React.useRef<number | null>(null);
  const timeCheckRef = React.useRef<number | null>(null);
  const countdownRef = React.useRef<number | null>(null);
  const deleteReRecordTimeoutRef = React.useRef<number | null>(null);

  const [countdown, setCountdown] = React.useState<number | null>(null);
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
      // Rate: единый роутинг V3/V2 (М3) — tempoRate через TransportV3 при V3-фоне
      setRate(tempoRate ?? 1);
      if (ae.microphone && !ae.microphone.enabled) {
        const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
        if (engineMode !== 'v3') await ae.enableMicrophone(); // v3: acquisition внутри TakesRecorder.start() (F-1 431)
      }
      
      // Detect line-scoped record stage: reduce pre-roll to 0 for line-range-scoped transactions
      const isLineScopedRecord = currentStep?.scope?.lineRange !== undefined;
      const effectivePreRoll = isLineScopedRecord ? 0 : PRE_ROLL_SEC;
      
      // 🔧 422: recorder стартует ПЕРВЫМ (cold init MediaRecorder может занять секунды).
      // Пока он инициализируется, трек НЕ трогаем — pre-roll не протухает.
      const recorderInitStart = performance.now();
      const recorder = new TakesRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      if (recorder.lastError) {
        setMicError(recorder.lastError);
        recorderRef.current = null;
        console.error(`[Takes] запись не начата: микрофон (${recorder.lastError})`);
        return; // abort: pre-roll/playback не начинаем
      }
      setMicError(null);
      const recorderInitMs = performance.now() - recorderInitStart;
      
      // Store start time for trim calculation (база blob — СРАЗУ после старта рекордера)
      const recorderStartedAt = performance.now();
      
      // Pre-roll seek and playback — только после готовности рекордера
      const preRollStart = Math.max(0, effectiveTimeRange.startTime - effectivePreRoll);
      const actualPreRoll = effectiveTimeRange.startTime - preRollStart;
      const seekStart = performance.now();
      try { seekTo(preRollStart) } catch {}
      getTransport().play();
      const seekMs = performance.now() - seekStart;
      
      // Countdown UX (if pre-roll > 0.5s)
      if (actualPreRoll > 0.5) {
        setCountdown(Math.ceil(actualPreRoll));
        onCountdownChange?.(Math.ceil(actualPreRoll));
        await new Promise<void>((resolve) => {
          let remaining = Math.ceil(actualPreRoll);
          let vocalFadeScheduled = false;
          let stalenessStrikes = 0;
          const maxStalenessStrikes = 1;
          const wallStartMs = performance.now();
          const wallTimeoutMs = (actualPreRoll / (tempoRate ?? 1) + 2.5) * 1000;
          const tick = () => {
            const ct = getPlaybackTime();
            const left = Math.max(0, effectiveTimeRange.startTime - ct);
            // М2: staleness-гвард — если позиция УЖЕ внутри блока (pre-roll протух)
            if (ct > effectiveTimeRange.startTime + 0.05 && stalenessStrikes < maxStalenessStrikes) {
              stalenessStrikes++;
              try { seekTo(preRollStart) } catch {}
              countdownRef.current = requestAnimationFrame(tick);
              return;
            }
            if (left <= 0.05) { 
              setCountdown(null); 
              onCountdownChange?.(null);
              resolve(); 
              return; 
            }
            // М1: wall-clock ТОЛЬКО страховка (не источник цифры)
            if (performance.now() - wallStartMs > wallTimeoutMs) {
              setCountdown(null);
              onCountdownChange?.(null);
              useTakesStore.getState().cancelRecording();
              // М2-teardown: разбираем recorder/analyser — не оставляем тёплый микрофон
              recorderRef.current?.cancel();
              recorderRef.current = null;
              onRecorderAnalyserChange?.(null);
              clearActiveRecordingTimers();
              onRecordAbort?.(`Синхронизация pre-roll не удалась. Попробуй ещё раз.`);
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
      const engineNow = getPlaybackTime() || effectiveTimeRange.startTime;
      
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
      
      if (import.meta.env.DEV) console.log('[TRIM-BASIS]', {
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
        v3Active: (window as any).__v3Active,
        recorderInitMs,
        seekMs,
      });
      
      (recorderRef.current as any).__trimStartSec = computedTrim;
      (recorderRef.current as any).__tempoRate = tempoRate;
      (recorderRef.current as any).__takeKind = takeKind;
      
      // Telemetry: capture late start offset (truth capture only)
      const lateStartOffsetSec = engineNow - effectiveTimeRange.startTime; // unclipped
      (recorderRef.current as any).__lateStartOffsetSec = lateStartOffsetSec;
      
      if (import.meta.env.DEV) console.log('[Takes] Recorder armed early, visible REC started at engine time:', 
        getPlaybackTime().toFixed(3));
      // Start stop timer / safety timeout
      clearActiveRecordingTimers();
      const blockEnd = effectiveTimeRange.endTime;
      timeCheckRef.current = window.setInterval(() => {
        const ct = getPlaybackTime();
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
  }, [activeBlockId, timeRange, nextSlot, isRecording, countdown, startRecording, blockTakes, activeExercise, exercisePhase, exerciseResolvedTimeRange, getCurrentStep, onRecordAbort]);

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
      if (import.meta.env.DEV) console.log('[SYNC]', { 
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
        const ct = getPlaybackTime();
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
        const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
        if (engineMode !== 'v3') await ae.enableMicrophone(); // v3: acquisition внутри TakesRecorder.start() (F-1 431)
      }

      // 2. Create and start recorder (armed but hidden - no UI state yet)
      const recorder = new TakesRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      if (recorder.lastError) {
        setMicError(recorder.lastError);
        recorderRef.current = null;
        console.error(`[Takes] сценарная запись не начата: микрофон (${recorder.lastError})`);
        return;
      }

      // DO NOT expose analyser yet - keeps live trail hidden
      // onRecorderAnalyserChange?.(recorder.analyser ?? null); // ← NOT YET

      const recorderStartedAt = performance.now();

      // 3. Wait until engine reaches target start time
      await new Promise<void>((resolve) => {
        const waitForTarget = () => {
          const ct = getPlaybackTime();
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
        const ct = getPlaybackTime();
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
    // М3-parity: НЕ сбрасываем rate здесь — V2 в handleStop rate не трогал.
    // Восстановление делает exercise-флоу (TakesPanel:901-913 savedPlaybackRate → setPlaybackRate(savedPlaybackRate)).
    if (timeCheckRef.current) { clearInterval(timeCheckRef.current); timeCheckRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    const ae = (window as any).audioEngine;
    const recorder = recorderRef.current;
    if (typeof ae?.pause === 'function') getTransport().pause();
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
        {micError && (
          <div style={{
            position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)',
            padding: '3px 12px', borderRadius: '10px',
            background: 'rgba(220,60,60,0.92)', color: '#fff',
            fontSize: '12px', whiteSpace: 'nowrap', zIndex: 10,
          }}>
            🎤 {micError === 'permission-denied' ? 'Доступ к микрофону запрещён'
              : micError === 'no-device' ? 'Микрофон не найден'
              : micError === 'mic-source-unavailable' ? 'Аудио-движок ещё инициализируется'
              : 'Микрофон недоступен'}
          </div>
        )}
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
            <TakeSlot
              key={slot}
              slot={slot}
              take={take}
              isEmpty={isEmpty}
              isReady={isReady}
              isBest={isBest}
              isThisRec={isThisRec}
              isPlaying={isPlaying}
              isCurrentVisible={isCurrentVisible}
              compareMode={compareMode}
              activeCompareSlot={activeCompareSlot ?? null}
              exercisePlaybackLocked={exercisePlaybackLocked}
              isRecording={isRecording}
              countdown={countdown}
              onRecord={(s) => {
                interruptPracticeSession(() => {
                  if (exercisePlaybackLocked) return;
                  onActiveCompareSlotChange?.(s);
                  handleRecord(s);
                });
              }}
              onPlay={(takeId) => {
                interruptPracticeSession(() => {
                  if (exercisePlaybackLocked) return;
                  onActiveCompareSlotChange?.(slot);
                  handlePlayTake(takeId);
                });
              }}
              onSelectCompare={(slot) => onActiveCompareSlotChange?.(slot)}
              onRetake={() => {
                interruptPracticeSession(() => {
                  if (exercisePlaybackLocked) return;
                  if (activeCompareSlot === slot) onActiveCompareSlotChange?.(null);
                  handleDeleteSlot(slot);
                  onActiveCompareSlotChange?.(slot);
                  deleteReRecordTimeoutRef.current = window.setTimeout(() => handleRecord(slot), 150);
                });
              }}
              onStar={() => {
                interruptPracticeSession(() => {
                  if (exercisePlaybackLocked) return;
                  const current = blockTakes?.selectedSlot;
                  selectTake(activeBlockId, current === slot ? null : slot);
                });
              }}
              onDelete={() => {
                interruptPracticeSession(() => {
                  if (exercisePlaybackLocked) return;
                  handleDeleteSlot(slot);
                });
              }}
            />
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
