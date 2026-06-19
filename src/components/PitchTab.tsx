import { useEffect, useRef, useState } from 'react';
import { usePianoStore } from '../stores/piano.store';
import { PitchEngine } from '../audio/pitch/pitch-engine';
import { midiToNote } from '../audio/pitch/types';
import type { WorkletMessage } from '../audio/pitch/types';
import { NoteQuantizer } from '../audio/pitch/note-quantizer';
import { PianoKeyboard } from './PianoKeyboard/PianoKeyboard';

// TC-PITCH-02: PitchTab — dock tab version of PianoOverlay
// Removed: position: fixed, bottom, zIndex (now rendered inside .panel)
// Added: height: 100%, min-height: 0 (rubber height for dock panel)

const S = {
  root: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
    padding: 0,
    background: 'var(--bl-surface-1, rgba(15, 15, 20, 0.95))',
    borderTop: '1px solid var(--bl-border, rgba(255,255,255,0.08))',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '5px 12px',
    fontSize: '13px',
    color: 'var(--bl-text-primary, #fff)',
  },
  btn: {
    padding: '4px 12px',
    borderRadius: 'var(--bl-radius-sm, 6px)',
    border: '1px solid var(--bl-border, rgba(255,255,255,0.12))',
    background: 'var(--bl-surface-2, rgba(255,255,255,0.08))',
    color: 'var(--bl-text-primary, #fff)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  micActive: {
    background: 'var(--bl-c-pitch-mic, #F97316)',
    borderColor: 'var(--bl-c-pitch-mic, #F97316)',
  },
  noteDisplay: {
    fontWeight: 700,
    fontSize: '15px',
    fontVariantNumeric: 'tabular-nums' as const,
    minWidth: '40px',
  },
  wingsContainer: {
    position: 'relative' as const,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  wingLeft: {
    position: 'absolute' as const,
    right: '50%',
    top: '15%',
    bottom: '15%',
    borderRadius: '4px 0 0 4px',
    transition: 'width 0.12s ease-out',
    background: 'linear-gradient(to right, rgba(155,89,182,0.05), rgba(155,89,182,0.9))',
    pointerEvents: 'none' as const,
  },
  wingRight: {
    position: 'absolute' as const,
    left: '50%',
    top: '15%',
    bottom: '15%',
    borderRadius: '0 4px 4px 0',
    transition: 'width 0.12s ease-out',
    background: 'linear-gradient(to left, rgba(231,76,60,0.05), rgba(231,76,60,0.9))',
    pointerEvents: 'none' as const,
  },
  noteInWings: {
    position: 'relative' as const,
    zIndex: 2,
    padding: '2px 10px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
    whiteSpace: 'nowrap' as const,
    transition: 'text-shadow 0.15s ease-out',
    letterSpacing: '0.5px',
    userSelect: 'none' as const,
  },
  vocalColor: { color: 'var(--bl-c-pitch-vocal, #3B82F6)' },
  micColor: { color: 'var(--bl-c-pitch-mic, #F97316)' },
  matchColor: { color: 'var(--bl-c-pitch-match, #22C55E)', fontWeight: 700 as const },
  label: { fontSize: '11px', opacity: 0.6 },
  spacer: { flex: 1 },
} as const;

/* ── Hook: engine → fast snap → note string + depth ── */

function useStableVocalData(engine: PitchEngine | null): { note: string | null; subScore: number; noiseScore: number } {
  const [note, setNote] = useState<string | null>(null);
  const [subScore, setSubScore] = useState(0);
  const [noiseScore, setNoiseScore] = useState(0);
  const quantizerRef = useRef(new NoteQuantizer());
  const lastRef = useRef(0);
  const subEmaRef = useRef(0);
  const noiseEmaRef = useRef(0);
  const metersLastRef = useRef(0);
  const lastNoteRef = useRef<string | null>(null);
  const lastNoteTimeRef = useRef(0);

  useEffect(() => {
    if (!engine) {
      setNote(null);
      setSubScore(0);
      setNoiseScore(0);
      subEmaRef.current = 0;
      noiseEmaRef.current = 0;
      quantizerRef.current.reset();
      return;
    }

    const unsub = engine.subscribe((msg: WorkletMessage) => {
      const now = performance.now();
      if (now - lastRef.current < 46) return;
      lastRef.current = now;

      if (msg.type === 'pitch') {
        const qn = quantizerRef.current.quantize(msg.midi, msg.confidence);
        const noteName = qn ? midiToNote(qn.midi) : null;
        if (noteName) {
          lastNoteRef.current = noteName;
          lastNoteTimeRef.current = performance.now();
        }
        setNote(noteName);

        const rawSub = typeof msg.subScore === 'number' ? msg.subScore : 0;
        const rawNoise = typeof msg.noiseScore === 'number' ? msg.noiseScore : 0;
        subEmaRef.current = 0.15 * rawSub + 0.85 * subEmaRef.current;
        noiseEmaRef.current = 0.20 * rawNoise + 0.80 * noiseEmaRef.current;
        if (now - metersLastRef.current > 80) {
          metersLastRef.current = now;
          setSubScore(subEmaRef.current);
          setNoiseScore(noiseEmaRef.current);
        }
      } else {
        // Hold last note for 500ms instead of clearing immediately
        const holdMs = 500;
        const elapsed = performance.now() - lastNoteTimeRef.current;
        if (lastNoteRef.current && elapsed < holdMs) {
          setNote(lastNoteRef.current);
        } else {
          setNote(null);
          lastNoteRef.current = null;
        }
        // SUB: always decay on no_pitch (no pitch = no subharmonic info)
        subEmaRef.current *= 0.85;
        
        // NOISE: read from no_pitch message if available
        const noPitchNoise = msg && typeof msg === 'object' && 'noiseScore' in msg
          ? (msg as any).noiseScore : undefined;
        if (typeof noPitchNoise === 'number' && noPitchNoise > 0) {
          noiseEmaRef.current = 0.25 * noPitchNoise + 0.75 * noiseEmaRef.current;
        } else {
          noiseEmaRef.current *= 0.80;
        }
        
        const now2 = performance.now();
        if (now2 - metersLastRef.current > 80) {
          metersLastRef.current = now2;
          setSubScore(subEmaRef.current);
          setNoiseScore(noiseEmaRef.current);
        }
      }
    });

    return () => {
      unsub();
      quantizerRef.current.reset();
    };
  }, [engine]);

  return { note, subScore, noiseScore };
}

function useStableNote(engine: PitchEngine | null): string | null {
  const [note, setNote] = useState<string | null>(null);
  const quantizerRef = useRef(new NoteQuantizer());
  const lastRef = useRef(0);

  useEffect(() => {
    if (!engine) {
      setNote(null);
      quantizerRef.current.reset();
      return;
    }

    const unsub = engine.subscribe((msg: WorkletMessage) => {
      const now = performance.now();
      if (now - lastRef.current < 46) return;
      lastRef.current = now;

      if (msg.type === 'pitch') {
        const qn = quantizerRef.current.quantize(msg.midi, msg.confidence);
        setNote(qn ? midiToNote(qn.midi) : null);
      } else {
        setNote(null);
      }
    });

    return () => {
      unsub();
      quantizerRef.current.reset();
    };
  }, [engine]);

  return note;
}

/* ── Component ── */

export function PitchTab() {
  const micActive = usePianoStore(s => s.micActive);
  const setMicActive = usePianoStore(s => s.setMicActive);

  const vocalEngineRef = useRef<PitchEngine | null>(null);
  const [vocalEngine, setVocalEngine] = useState<PitchEngine | null>(null);
  const micEngineRef = useRef<PitchEngine | null>(null);
  const [micEngine, setMicEngine] = useState<PitchEngine | null>(null);
  const genRef = useRef(0);
  const [hasVocals, setHasVocals] = useState<boolean | null>(null);

  /* ── Vocal engine — eager init + event-driven ── */
  useEffect(() => {
    const ae = (window as any).audioEngine;
    const gen = ++genRef.current;
    let destroyed = false;

    const tryInit = (): boolean => {
      if (destroyed) return false;
      const vocalsGain = ae?.vocalsGain as AudioNode | undefined;
      const aeHasVocals = ae?.stems?.has('vocals') ?? false;
      setHasVocals(aeHasVocals);

      if (!vocalsGain || !aeHasVocals) return false;

      if (vocalEngineRef.current) {
        vocalEngineRef.current.retarget(vocalsGain);
        return true;
      }

      const eng = new PitchEngine();
      vocalEngineRef.current = eng;
      eng.initFromNode(vocalsGain).then(() => {
        if (genRef.current !== gen || destroyed) {
          eng.destroy();
          return;
        }
        setVocalEngine(eng);
        if (!ae?.isPlaying) eng.pause();
      }).catch(err => {
        console.warn('[PitchTab] vocal engine failed:', err);
      });
      return true;
    };

    tryInit();

    const onTrackLoaded = () => tryInit();
    document.addEventListener('track-fully-loaded', onTrackLoaded);

    const onPlaybackState = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.isPlaying) vocalEngineRef.current?.resume();
      else vocalEngineRef.current?.pause();
    };
    window.addEventListener('playback-state-changed', onPlaybackState);

    const timeoutId = setTimeout(tryInit, 3000);

    return () => {
      destroyed = true;
      document.removeEventListener('track-fully-loaded', onTrackLoaded);
      window.removeEventListener('playback-state-changed', onPlaybackState);
      clearTimeout(timeoutId);
      if (vocalEngineRef.current) {
        vocalEngineRef.current.destroy();
        vocalEngineRef.current = null;
        setVocalEngine(null);
      }
    };
  }, []);

  /* ── Mic engine ── */
  useEffect(() => {
    console.log('[PitchTab] Mic engine useEffect, micActive:', micActive);
    if (!micActive) {
      if (micEngineRef.current) {
        console.log('[PitchTab] Mic engine cleanup (inactive)');
        micEngineRef.current.destroy();
        micEngineRef.current = null;
        setMicEngine(null);
      }
      return;
    }
    console.log('[PitchTab] Mic engine init...');
    const eng = new PitchEngine();
    micEngineRef.current = eng;
    eng.initFromMic().then(() => {
      console.log('[PitchTab] Mic engine initialized');
      setMicEngine(eng);
    }).catch(err => {
      console.warn('[PitchTab] mic engine failed:', err);
      setMicActive(false);
    });

    return () => {
      console.log('[PitchTab] Mic engine cleanup');
      eng.destroy();
      micEngineRef.current = null;
      setMicEngine(null);
    };
  }, [micActive, setMicActive]);

  /* ── Tab visibility — pause/resume engine ── */
  useEffect(() => {
    const el = document.getElementById('belive-react');
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting ?? true;
      if (visible) vocalEngineRef.current?.resume();
      else vocalEngineRef.current?.pause();
    }, { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Fast snap notes ── */
  const vocal = useStableVocalData(vocalEngine);
  const micNote = useStableNote(micEngine);

  const vocalDisplay = (() => {
    if (hasVocals === false) return '\u2014\u2014';
    if (hasVocals === null && !vocalEngine) return '\u2026';
    if (!vocal.note && vocalEngine) {
      const ae = (window as any).audioEngine;
      if (ae && !ae.isPlaying) return '\u23F8';
    }
    return vocal.note ?? '\u2014';
  })();

  const isMatch = !!(vocal.note && micNote && vocal.note === micNote);

  return (
    <div style={S.root}>
      <div style={S.controls}>
        <button
          style={{ ...S.btn, ...(micActive ? S.micActive : {}) }}
          onClick={() => setMicActive(!micActive)}
        >
          🎤 Mic
        </button>

        <span style={S.label}>vocal</span>

        <div style={S.wingsContainer}>
          <div style={{
            ...S.wingLeft,
            width: `${Math.max(vocal.subScore > 0.02 ? 3 : 0, Math.round(vocal.subScore * 42))}%`,
          }} />
          <span style={{
            ...S.noteInWings,
            textShadow: (() => {
              const s = vocal.subScore || 0;
              const n = vocal.noiseScore || 0;
              const d = Math.max(s, n);
              if (d < 0.03) return 'none';
              const c = s > n ? 'rgba(155,89,182,' : 'rgba(231,76,60,';
              return `0 0 ${4 + Math.round(d * 12)}px ${c}${0.6 + d * 0.4})`;
            })(),
          }}>
            {vocalDisplay}
          </span>
          <div style={{
            ...S.wingRight,
            width: `${Math.max(vocal.noiseScore > 0.02 ? 3 : 0, Math.round(vocal.noiseScore * 42))}%`,
          }} />
        </div>

        {micNote && (
          <>
            <span style={S.label}>mic</span>
            <span style={{ ...S.noteDisplay, ...S.micColor }}>{micNote}</span>
          </>
        )}
        {isMatch && <span style={S.matchColor}>✓</span>}
      </div>

      <PianoKeyboard vocalNote={vocal.note} micNote={micNote} />
    </div>
  );
}
