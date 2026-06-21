import React from 'react';

interface TempoSetupModalProps {
  onConfirm: (tempoRate: number, previewBetweenRounds: boolean) => void;
  onCancel: () => void;
}

export const TempoSetupModal: React.FC<TempoSetupModalProps> = ({ onConfirm, onCancel }) => {
  const [selectedTempo, setSelectedTempo] = React.useState<number>(100);
  const [previewBetweenRounds, setPreviewBetweenRounds] = React.useState<boolean>(false);

  const handleConfirm = () => {
    onConfirm(selectedTempo / 100, previewBetweenRounds);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 101,
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 400,
          width: '90%',
          background: 'rgba(20,20,20,0.95)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.60)',
          overflow: 'hidden',
          pointerEvents: 'auto',
          padding: '32px 24px',
          gap: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: 8 }}>
            Choose starting tempo
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
            Select the slowdown rate for the listen step
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="range"
              min="50"
              max="150"
              step="5"
              value={selectedTempo}
              onChange={(e) => setSelectedTempo(Number(e.target.value))}
              style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'rgba(255,255,255,0.10)',
                outline: 'none', WebkitAppearance: 'none', appearance: 'none',
              } as React.CSSProperties}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'rgba(100,200,255,0.95)' }}>
              {Math.round(selectedTempo)}%
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'right' }}>
              100% = original
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <input
            type="checkbox"
            id="preview-toggle"
            checked={previewBetweenRounds}
            onChange={(e) => setPreviewBetweenRounds(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'rgba(100,200,255,0.95)' }}
          />
          <label htmlFor="preview-toggle" style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', cursor: 'pointer', userSelect: 'none' }}>
            Preview previous take between rounds
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8,
              border: '1px solid rgba(100,200,255,0.40)',
              background: 'rgba(100,200,255,0.20)',
              color: 'rgba(100,200,255,0.95)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};
