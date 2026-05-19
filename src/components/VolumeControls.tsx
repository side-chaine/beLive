import React, { useCallback } from 'react';
import { useAudioStore } from '../stores/audio.store';
import { useStemStore } from '../stem/stem.store';
import { useModeStore } from '../stores/mode.store';
import { BpmControl } from './BpmControl';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

function Slider({ label, value, onChange, color, icon }: {
  label: string; value: number; onChange: (v: number) => void;
  color: string; icon: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minWidth: '140px',
      }}
    >
      <span style={{ width: 16, textAlign: 'center' }}>{icon}</span>
      <span
        style={{
          color: '#aaa',
          fontSize: 11,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{
          width: 80,
          height: 4,
          accentColor: color,
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          color: '#fff',
          fontSize: 11,
          minWidth: '24px',
          textAlign: 'right',
        }}
      >
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

export function VolumeControls() {
  const hasVocals = useAudioStore((s) => s.hasVocals);
  const vocalMix = useAudioStore((s) => s.vocalMixEnabled);
  const mic = useAudioStore((s) => s.micEnabled);
  const micVolume = useAudioStore((s) => s.micVolume);
  const instVol = useStemStore((s) => s.stemVolumes['instrumental'] ?? 1);
  const vocVol = useStemStore((s) => s.stemVolumes['vocals'] ?? 1);
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';

  const setInstVol = useCallback((v: number) => {
    const ae = (window as any).audioEngine;
    if (ae) ae.setInstrumentalVolume(v);
    useStemStore.getState().setStemVolume('instrumental', v);
  }, []);

  const setVocVol = useCallback((v: number) => {
    const ae = (window as any).audioEngine;
    if (ae) ae.setVocalsVolume(v);
    useStemStore.getState().setStemVolume('vocals', v);
  }, []);

  const toggleVocalMix = useCallback(() => {
    const ae = (window as any).audioEngine;
    if (!ae) return;
    if (vocalMix) ae.disableVocalMix();
    else ae.enableVocalMix();
  }, [vocalMix]);

  const toggleMic = useCallback(() => {
    const ae = (window as any).audioEngine;
    if (!ae) return;
    if (mic) ae.disableMicrophone();
    else ae.enableMicrophone();
  }, [mic]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        flexWrap: 'wrap',
      }}
    >
      <Slider label="Inst" value={instVol} onChange={setInstVol} color={color} icon="🎹" />
      {hasVocals && (
        <Slider label="Voc" value={vocVol} onChange={setVocVol} color={color} icon="🎤" />
      )}

      <div style={{ borderTop: '1px solid #333', paddingTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
        {hasVocals && (
          <button
            onClick={toggleVocalMix}
            style={{
              background: vocalMix ? `${color}33` : 'transparent',
              border: `1px solid ${vocalMix ? color : '#555'}`,
              color: vocalMix ? color : '#888',
              borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
              fontSize: 10, fontWeight: 600,
            }}
          >
            VMix {vocalMix ? 'ON' : 'OFF'}
          </button>
        )}
        <button
          onClick={toggleMic}
          style={{
            background: mic ? `${color}33` : 'transparent',
            border: `1px solid ${mic ? color : '#555'}`,
            color: mic ? color : '#888',
            borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
            fontSize: 10, fontWeight: 600,
          }}
        >
          🎤 {mic ? 'ON' : 'OFF'}
        </button>
        {mic && (
          <>
            <label style={{ color: '#aaa', fontSize: 11 }}>Mic</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={micVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                (window as any).audioEngine?.setMicrophoneVolume?.(v);
                useAudioStore.setState({ micVolume: v });
              }}
              style={{ width: 80 }}
            />
          </>
        )}
      </div>
      <BpmControl />
    </div>
  );
}

