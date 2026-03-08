import { create } from 'zustand';
import { PitchEngine } from '../audio/pitch/pitch-engine';
import { activatePitchBridge } from '../audio/pitch/pitch-visual-bridge';
import { midiToNote, midiToCents } from '../audio/pitch/types';
import type { WorkletMessage } from '../audio/pitch/types';
import type { PitchStatus } from '../audio/pitch/pitch-engine';

interface PitchState {
  /* Status */
  status: PitchStatus;
  error: string | null;

  /* Current pitch (updated ~10Hz) */
  frequency: number | null;
  note: string | null;
  midi: number | null;
  cents: number;
  confidence: number;
  isSinging: boolean;

  /* Actions */
  startPitch: () => Promise<void>;
  stopPitch: () => void;
}

let _unsub: (() => void) | null = null;
let _bridgeCleanup: (() => void) | null = null;
let _lastUpdate = 0;
const THROTTLE_MS = 100; /* 10Hz */

export const usePitchStore = create<PitchState>((set, get) => ({
  status: 'idle',
  error: null,
  frequency: null,
  note: null,
  midi: null,
  cents: 0,
  confidence: 0,
  isSinging: false,

  startPitch: async () => {
    const s = get();
    if (s.status === 'running' || s.status === 'starting') return;

    const engine = PitchEngine.get();
    set({ status: 'starting', error: null });

    try {
      await engine.init();

      _unsub = engine.subscribe((msg: WorkletMessage) => {
        const now = performance.now();
        if (now - _lastUpdate < THROTTLE_MS) return;
        _lastUpdate = now;

        if (msg.type === 'pitch') {
          set({
            frequency: msg.frequency,
            note: midiToNote(msg.midi),
            midi: Math.round(msg.midi),
            cents: midiToCents(msg.midi),
            confidence: msg.confidence,
            isSinging: true,
          });
        } else if (msg.type === 'silence' || msg.type === 'no_pitch') {
          set({ isSinging: false });
        }
      });

      _bridgeCleanup = activatePitchBridge();
      set({ status: 'running' });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  stopPitch: () => {
    _unsub?.();
    _unsub = null;
    _bridgeCleanup?.();
    _bridgeCleanup = null;
    PitchEngine.get().destroy();
    set({
      status: 'idle',
      error: null,
      frequency: null,
      note: null,
      midi: null,
      cents: 0,
      confidence: 0,
      isSinging: false,
    });
  },
}));
