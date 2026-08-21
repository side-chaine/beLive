import React from 'react';
import { useTakesStore } from '../takes.store';
import { useExerciseStore } from '../../exercises/exercise.store';
import {
  registerPracticeInterruptHandler,
  unregisterPracticeInterruptHandler,
} from '../../exercises/exercise.interruption';

interface UsePracticeInterruptOptions {
  countdownRef: React.MutableRefObject<number | null>;
  timeCheckRef: React.MutableRefObject<number | null>;
  stopTimerRef: React.MutableRefObject<number | null>;
  deleteReRecordTimeoutRef: React.MutableRefObject<number | null>;
  recorderRef: React.MutableRefObject<any>;
  handleStopRef?: React.MutableRefObject<() => void>;
  onCountdownChange?: (value: number | null) => void;
  onRecorderAnalyserChange?: (analyser: AnalyserNode | null) => void;
  playingTakeId: string | null;
  stopPreview: (options?: { pauseEngine?: boolean }) => void;
  setCountdown: (value: number | null) => void;
}

interface UsePracticeInterruptReturn {
  handlePracticeInterrupt: () => void;
}

export function usePracticeInterrupt({
  countdownRef,
  timeCheckRef,
  stopTimerRef,
  deleteReRecordTimeoutRef,
  recorderRef,
  handleStopRef,
  onCountdownChange,
  onRecorderAnalyserChange,
  playingTakeId,
  stopPreview,
  setCountdown,
}: UsePracticeInterruptOptions): UsePracticeInterruptReturn {
  const handlePracticeInterrupt = React.useCallback(() => {
    // 1. Cancel countdown animation if active
    if (countdownRef.current) {
      cancelAnimationFrame(countdownRef.current);
      countdownRef.current = null;
    }
    
    // 2. Clear countdown state + callback
    setCountdown(null);
    onCountdownChange?.(null);
    
    // 3. Clear timers (timeCheck / stopTimer)
    if (timeCheckRef.current) {
      clearInterval(timeCheckRef.current);
      timeCheckRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (deleteReRecordTimeoutRef.current) {
      clearTimeout(deleteReRecordTimeoutRef.current);
      deleteReRecordTimeoutRef.current = null;
    }
    
    // 4. Recording in progress: COMMIT через штатный handleStop (F-1.6, 433).
    // Раньше здесь был cancel() без сохранения блоба: на границе блока в квесте
    // автопереход дёргал interrupt раньше автостопа (шаг 3 уже убил timeCheck)
    // и тейк терялся целиком. Коммит идёт через ту же ветку blob→decode→ready.
    // ⚠️ Делегирование = немедленный return: шаги 5-7 ниже синхронно стирают
    // analyser/recordingSlot, которые асинхронный коммит ещё прочитает.
    if (recorderRef.current?.isRecording) {
      if (handleStopRef?.current) {
        try {
          handleStopRef.current(); // async: сам остановит рекордер, занулит ref, закоммитит take
        } catch {
          try { recorderRef.current?.cancel(); } catch {}
          recorderRef.current = null;
        }
        return;
      }
      try { recorderRef.current.cancel(); } catch {}
      recorderRef.current = null;
    }
    
    // 5. Clear analyser exposure
    onRecorderAnalyserChange?.(null);
    
    // 6. Clear temporary in-flight round-capture runtime state
    // Prevents zombie recording UI
    const exerciseState = useExerciseStore.getState();
    if (exerciseState.roundCapture) {
      useExerciseStore.getState().clearRoundCapture();
    }
    
    // 7. Reset takes recording state via store
    if (useTakesStore.getState().isRecording) {
      useTakesStore.getState().cancelRecording();
    }
    
    // 8. Stop preview if currently previewing
    if (playingTakeId) {
      stopPreview({ pauseEngine: true });
    }
    
    if (import.meta.env.DEV) console.log('[TakesControlStrip] Practice session interrupted - cleaned up in-progress transactions');
  }, [
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
  ]);

  // Register practice interrupt handler for this component instance
  React.useEffect(() => {
    const HANDLER_ID = 'takes-control-strip';
    
    // Register the interrupt handler
    registerPracticeInterruptHandler(HANDLER_ID, handlePracticeInterrupt);
    
    // Cleanup on unmount
    return () => {
      unregisterPracticeInterruptHandler(HANDLER_ID);
    };
  }, [handlePracticeInterrupt]);

  return {
    handlePracticeInterrupt,
  };
}
