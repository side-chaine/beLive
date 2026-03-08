import { PitchEngine } from './pitch-engine';
import type { WorkletMessage } from './types';

/**
 * Connects React PitchEngine output → legacy pianoKeyboard visual.
 * Sets externalMode=true so legacy Pitchy is bypassed.
 * Returns cleanup function.
 */
export function activatePitchBridge(): () => void {
  const piano = (window as any).pianoKeyboard;
  if (!piano || typeof piano.feedExternalPitch !== 'function') {
    console.warn('[PitchBridge] legacy pianoKeyboard not found');
    return () => {};
  }

  piano.externalMode = true;
  const engine = PitchEngine.get();

  const unsub = engine.subscribe((msg: WorkletMessage) => {
    if (msg.type === 'pitch') {
      piano.feedExternalPitch(msg.frequency, msg.confidence);
    } else if (msg.type === 'silence' || msg.type === 'no_pitch') {
      piano.clearExternalPitch();
    }
  });

  return () => {
    unsub();
    piano.externalMode = false;
    piano.clearExternalPitch();
  };
}
