import React from 'react';
import { useExerciseStore } from '../exercise.store';
import { getExerciseProgressDisplay } from '../exercise.runtime';
import { interruptPracticeSession } from '../exercise.interruption';

export const ExerciseStrip: React.FC = () => {
  const activeExercise = useExerciseStore((s) => s.activeExercise);
  const phase = useExerciseStore((s) => s.phase);
  const currentRound = useExerciseStore((s) => s.currentRound);
  const currentStepIndex = useExerciseStore((s) => s.currentStepIndex);
  const advanceToNextStep = useExerciseStore((s) => s.advanceToNextStep);
  const getCurrentStep = useExerciseStore((s) => s.getCurrentStep);

  // Handle Escape key to interrupt practice session
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeExercise) {
        e.preventDefault();
        interruptPracticeSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeExercise]);

  // Build progress display from stable primitive values (no derived snapshots in selector)
  const progress = React.useMemo(() => {
    return getExerciseProgressDisplay(
      activeExercise,
      phase,
      currentRound,
      currentStepIndex,
    );
  }, [activeExercise, phase, currentRound, currentStepIndex]);

  // Get current tempo rate if available
  const currentTempoRate = React.useMemo(() => {
    const step = getCurrentStep?.();
    return step?.tempoRate && step.tempoRate !== 1.0 ? step.tempoRate : null;
  }, [getCurrentStep, currentStepIndex]);

  if (!activeExercise || !progress) return null;

  const phaseIcon: Record<string, string> = {
    idle: '',
    listening: '🎧',
    'pre-recording': '⏳',
    recording: '🎤',
    comparing: '⚖️',
    waiting: '⏸',
    'round-complete': '✅',
    'exercise-complete': '🎉',
  };

  return (
    <div style={{
      height: 28,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 12px',
      background: 'rgba(0,0,0,0.40)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
      fontSize: 11,
    }}>
      <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
        {activeExercise.icon} {activeExercise.name}
      </span>

      {currentTempoRate && (
        <span style={{ fontSize: 10, color: 'rgba(100,200,255,0.85)', fontWeight: 600 }}>
          Tempo {Math.round(currentTempoRate * 100)}%
        </span>
      )}

      <span style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: progress.totalRounds }, (_, i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background:
                i < progress.round
                  ? '#4ade80'
                  : i === progress.round
                  ? '#fbbf24'
                  : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </span>

      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
        R{progress.round + 1}/{progress.totalRounds}
      </span>

      <span style={{ flex: 1, color: 'rgba(255,255,255,0.72)' }}>
        {phaseIcon[phase]} {progress.instruction}
      </span>

      {phase === 'comparing' && (
        <button
          onClick={advanceToNextStep}
          style={{
            padding: '2px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.72)',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Next ▶
        </button>
      )}

      {phase === 'exercise-complete' && (
        <span style={{ color: '#4ade80', fontWeight: 700 }}>
          Complete!
        </span>
      )}

      <button
        onClick={() => interruptPracticeSession()}
        style={{
          padding: '2px 10px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.38)',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
};
