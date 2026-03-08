import styles from './PianoKeyboard.module.css';
import type { NotePhase } from '../../audio/pitch/note-tracker';

export interface NoteDisplay {
  noteName: string;
  phase: NotePhase;
}

/* ── Piano layout constants ──────────────────────── */

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
const WHITE_SET = new Set(['C','D','E','F','G','A','B']);

/**
 * Piano layout C2–C6:
 *   White keys: 4 octaves × 7 + 1 (C6) = 29
 *   Black keys: 4 octaves × 5 = 20
 *   Total: 49 keys
 *
 * Opacity fade:
 *   C2–B2: fade in  (0.15 → 1.0)
 *   C3–B5: full opacity (singer's range)
 *   C6:    fade out (0.5)
 */

const TOTAL_WHITES = 29;

interface KeyDef {
  id: string;       // "C4", "A#5"
  isBlack: boolean;
  left: number;     // % offset from container left
  width: number;    // % of container width
  opacity: number;  // fade effect
  label?: string;   // "C2".."C6" for C keys only
}

function keyOpacity(octave: number, noteIdx: number): number {
  if (octave === 2) return 0.15 + (noteIdx / 11) * 0.85;
  if (octave >= 3 && octave <= 5) return 1;
  return 0.5; // C6
}

function buildKeys(): { whites: KeyDef[]; blacks: KeyDef[] } {
  const whites: KeyDef[] = [];
  const blacks: KeyDef[] = [];
  let wi = 0; // white key sequential index

  const ww = 100 / TOTAL_WHITES;  // white key width %
  const bw = ww * 0.6;            // black key width %

  for (let oct = 2; oct <= 6; oct++) {
    for (let n = 0; n < 12; n++) {
      if (oct === 6 && n > 0) break; // stop after C6

      const note = NOTES[n];
      const id = `${note}${oct}`;
      const op = keyOpacity(oct, n);

      if (!WHITE_SET.has(note)) {
        /*
         * Black key positioning:
         *   When we encounter a black note, `wi` already points to the
         *   NEXT white key (because the previous white key incremented it).
         *   The boundary between previous and next white key = wi * ww.
         *   Black key is centered on that boundary.
         */
        blacks.push({
          id,
          isBlack: true,
          left: wi * ww - bw / 2,
          width: bw,
          opacity: op,
        });
      } else {
        whites.push({
          id,
          isBlack: false,
          left: wi * ww,
          width: ww,
          opacity: op,
          label: note === 'C' ? id : undefined,
        });
        wi++;
      }
    }
  }

  return { whites, blacks };
}

// Static — layout never changes
const KEYS = buildKeys();

/* ── Component ───────────────────────────────────── */

interface PianoKeyboardProps {
  /** Active vocal track notes with lifecycle phase */
  vocalNotes?: NoteDisplay[];
  /** Active mic notes with lifecycle phase */
  micNotes?: NoteDisplay[];
  /** @deprecated — backwards compat, use vocalNotes */
  vocalNote?: string | null;
  /** @deprecated — backwards compat, use micNotes */
  micNote?: string | null;
}

/** Find phase for a key: check new array first, fall back to legacy prop */
function findPhase(
  keyId: string,
  notes: NoteDisplay[] | undefined,
  legacyNote: string | null | undefined,
): NotePhase | null {
  if (notes && notes.length > 0) {
    for (let i = notes.length - 1; i >= 0; i--) {
      if (notes[i].noteName === keyId) return notes[i].phase;
    }
    return null;
  }
  /* Backwards compat: legacy single note = sustain */
  if (legacyNote && legacyNote === keyId) return 'sustain';
  return null;
}

export function PianoKeyboard({ vocalNotes, micNotes, vocalNote, micNote }: PianoKeyboardProps) {
  return (
    <div className={styles.keyboard}>
      {/* White keys first (z-index: 1) */}
      {KEYS.whites.map((k) => {
        const vPhase = findPhase(k.id, vocalNotes, vocalNote);
        const mPhase = findPhase(k.id, micNotes, micNote);
        const isMatch = vPhase === 'sustain' && mPhase === 'sustain';
        return (
          <div
            key={k.id}
            className={styles.whiteKey}
            style={{ left: `${k.left}%`, width: `${k.width}%`, opacity: k.opacity }}
            data-vocal={isMatch ? undefined : (vPhase || undefined)}
            data-mic={isMatch ? undefined : (mPhase || undefined)}
            data-match={isMatch ? 'true' : undefined}
          >
            {k.label && <span className={styles.label}>{k.label}</span>}
          </div>
        );
      })}

      {/* Black keys on top (z-index: 2) */}
      {KEYS.blacks.map((k) => {
        const vPhase = findPhase(k.id, vocalNotes, vocalNote);
        const mPhase = findPhase(k.id, micNotes, micNote);
        const isMatch = vPhase === 'sustain' && mPhase === 'sustain';
        return (
          <div
            key={k.id}
            className={styles.blackKey}
            style={{ left: `${k.left}%`, width: `${k.width}%`, opacity: k.opacity }}
            data-vocal={isMatch ? undefined : (vPhase || undefined)}
            data-mic={isMatch ? undefined : (mPhase || undefined)}
            data-match={isMatch ? 'true' : undefined}
          />
        );
      })}
    </div>
  );
}
