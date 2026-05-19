import React from 'react';
import { useExerciseStore } from '../exercise.store';
import { useBlocksStore } from '../../stores/blocks.store';

interface QuestCompletionMomentProps {}

export const QuestCompletionMoment: React.FC<QuestCompletionMomentProps> = () => {
  const completionMoment = useExerciseStore((s) => s.completionMoment);
  const clearCompletionMoment = useExerciseStore((s) => s.clearCompletionMoment);
  const blocks = useBlocksStore((s) => s.blocks);

  if (!completionMoment) return null;

  // Find block name for context
  const block = blocks.find((b) => b.id === completionMoment.blockId);
  const blockName = block?.name || completionMoment.blockId;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 24,
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(20,20,30,0.9) 0%, rgba(30,25,40,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        maxWidth: 320,
        pointerEvents: 'auto',
        zIndex: 50,
      }}
    >
      {/* Icon and title */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 48,
            lineHeight: 1,
          }}
        >
          {completionMoment.icon}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              textAlign: 'center',
            }}
          >
            {completionMoment.name}
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
            }}
          >
            {blockName}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '12px 0',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#4ade80',
            }}
          >
            {completionMoment.roundsCompleted}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Rounds
          </div>
        </div>

        <div
          style={{
            width: 1,
            background: 'rgba(255,255,255,0.08)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {completionMoment.roundsTotal}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Total
          </div>
        </div>
      </div>

      {/* Done button */}
      <button
        onClick={() => clearCompletionMoment()}
        style={{
          padding: '10px 24px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
        }}
      >
        Done
      </button>
    </div>
  );
};
