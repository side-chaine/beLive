/**
 * Fast pitch-to-note snap with octave jump guard.
 *
 * Normal note changes: INSTANT (0ms delay)
 * Octave jumps (±10-14 semitones): need 3 confirmations (~138ms)
 *
 * This prevents octave jumping on distorted vocals (harmonics/subharmonics)
 * while keeping the display razor-sharp and responsive.
 */

export interface QuantizedNote {
  midi: number;
  rawMidi: number;
  isNew: boolean;
}

const OCTAVE_GUARD_MIN = 10; // semitones — octave range start
const OCTAVE_GUARD_MAX = 14; // semitones — octave range end
const OCTAVE_CONFIRM = 3; // frames needed to confirm octave jump

export class NoteQuantizer {
  private _current: number | null = null;
  private _candidate: number | null = null;
  private _candidateCount = 0;

  reset(): void {
    this._current = null;
    this._candidate = null;
    this._candidateCount = 0;
  }

  quantize(rawMidi: number, confidence: number, _timestamp?: number): QuantizedNote | null {
    if (confidence < 0.5) return null;

    const nearest = Math.round(rawMidi);

    /* First note — snap immediately */
    if (this._current === null) {
      this._current = nearest;
      return { midi: nearest, rawMidi, isNew: true };
    }

    /* Same note — hold */
    if (nearest === this._current) {
      this._candidate = null;
      this._candidateCount = 0;
      return { midi: this._current, rawMidi, isNew: false };
    }

    /* Different note: check if octave-range jump */
    const dist = Math.abs(nearest - this._current);

    if (dist >= OCTAVE_GUARD_MIN && dist <= OCTAVE_GUARD_MAX) {
      /* OCTAVE JUMP — needs confirmation */
      if (nearest === this._candidate) {
        this._candidateCount++;
      } else {
        this._candidate = nearest;
        this._candidateCount = 1;
      }

      if (this._candidateCount >= OCTAVE_CONFIRM) {
        /* Confirmed real octave change */
        this._current = nearest;
        this._candidate = null;
        this._candidateCount = 0;
        return { midi: this._current, rawMidi, isNew: true };
      }

      /* Not yet confirmed — hold current */
      return { midi: this._current, rawMidi, isNew: false };
    }

    /* NORMAL NOTE CHANGE — instant switch */
    this._current = nearest;
    this._candidate = null;
    this._candidateCount = 0;
    return { midi: nearest, rawMidi, isNew: true };
  }
}
