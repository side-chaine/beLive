import { midiToNote } from './types';

/**
 * Note lifecycle state machine.
 *
 * SILENCE → ONSET → SUSTAIN → RELEASE → SILENCE
 *
 * Tracks active notes with onset/sustain/release phases
 * for visual fade rendering on PianoKeyboard.
 */
export type NotePhase = 'onset' | 'sustain' | 'release';

export interface ActiveNote {
  midi: number;
  noteName: string;
  startTime: number;
  endTime: number | null;
  phase: NotePhase;
}

const ONSET_CONFIDENCE = 0.6;
const OFFSET_CONFIDENCE = 0.4;
const MIN_NOTE_DURATION_MS = 80;
const CONFIRM_FRAMES = 3;
const SILENCE_GAP_FRAMES = 3;
const RELEASE_DURATION_MS = 400;
const MAX_ACTIVE_NOTES = 5;

type Phase = 'silence' | 'onset' | 'sustain' | 'release';

export class NoteTracker {
  private _phase: Phase = 'silence';
  private _currentMidi: number | null = null;
  private _noteStartTime = 0;
  private _onsetCount = 0;
  private _silenceCount = 0;
  private _releaseStartTime = 0;

  /** Currently visible notes (sustain + release) */
  readonly activeNotes: ActiveNote[] = [];

  reset(): void {
    this._phase = 'silence';
    this._currentMidi = null;
    this._onsetCount = 0;
    this._silenceCount = 0;
    this.activeNotes.length = 0;
  }

  /**
   * Feed a quantized note into the tracker.
   * @param midi — integer MIDI from NoteQuantizer (or null if silence)
   * @param confidence — YIN confidence
   * @param timestamp — performance.now() or audio time in ms
   */
  update(midi: number | null, confidence: number, timestamp: number): void {
    /* Garbage collect old release notes */
    this._gc(timestamp);

    switch (this._phase) {
      case 'silence':
        if (midi !== null && confidence > ONSET_CONFIDENCE) {
          this._phase = 'onset';
          this._currentMidi = midi;
          this._onsetCount = 1;
          this._noteStartTime = timestamp;
        }
        break;

      case 'onset':
        if (midi === this._currentMidi && confidence > ONSET_CONFIDENCE) {
          this._onsetCount++;
          if (this._onsetCount >= CONFIRM_FRAMES) {
            this._phase = 'sustain';
            this.activeNotes.push({
              midi: this._currentMidi!,
              noteName: midiToNote(this._currentMidi!),
              startTime: this._noteStartTime,
              endTime: null,
              phase: 'sustain',
            });
            this._trimActive();
          }
        } else {
          /* False onset */
          this._phase = 'silence';
          this._onsetCount = 0;
        }
        break;

      case 'sustain':
        if (midi === null || confidence < OFFSET_CONFIDENCE) {
          this._silenceCount++;
          if (this._silenceCount >= SILENCE_GAP_FRAMES) {
            this._endCurrentNote(timestamp);
          }
        } else if (midi !== this._currentMidi) {
          /* Note change without silence gap */
          this._endCurrentNote(timestamp);
          /* Start new note directly in sustain (already quantizer-confirmed) */
          this._currentMidi = midi;
          this._noteStartTime = timestamp;
          this._phase = 'sustain';
          this.activeNotes.push({
            midi: midi,
            noteName: midiToNote(midi),
            startTime: timestamp,
            endTime: null,
            phase: 'sustain',
          });
          this._trimActive();
        } else {
          this._silenceCount = 0;
        }
        break;

      case 'release':
        if (midi !== null && confidence > ONSET_CONFIDENCE) {
          this._phase = 'onset';
          this._currentMidi = midi;
          this._onsetCount = 1;
          this._noteStartTime = timestamp;
        } else {
          const elapsed = timestamp - this._releaseStartTime;
          if (elapsed > RELEASE_DURATION_MS) {
            this._phase = 'silence';
            this._currentMidi = null;
          }
        }
        break;
    }
  }

  private _endCurrentNote(timestamp: number): void {
    const duration = timestamp - this._noteStartTime;
    const last = this._findLastSustain();
    if (last && duration >= MIN_NOTE_DURATION_MS) {
      last.endTime = timestamp;
      last.phase = 'release';
      this._phase = 'release';
      this._releaseStartTime = timestamp;
    } else if (last) {
      /* Too short — remove */
      const idx = this.activeNotes.indexOf(last);
      if (idx >= 0) this.activeNotes.splice(idx, 1);
      this._phase = 'silence';
    } else {
      this._phase = 'silence';
    }
    this._silenceCount = 0;
  }

  private _findLastSustain(): ActiveNote | undefined {
    for (let i = this.activeNotes.length - 1; i >= 0; i--) {
      if (this.activeNotes[i].phase === 'sustain') return this.activeNotes[i];
    }
    return undefined;
  }

  private _gc(timestamp: number): void {
    for (let i = this.activeNotes.length - 1; i >= 0; i--) {
      const n = this.activeNotes[i];
      if (n.phase === 'release' && n.endTime !== null) {
        if (timestamp - n.endTime > RELEASE_DURATION_MS) {
          this.activeNotes.splice(i, 1);
        }
      }
    }
  }

  private _trimActive(): void {
    while (this.activeNotes.length > MAX_ACTIVE_NOTES) {
      this.activeNotes.shift();
    }
  }
}
