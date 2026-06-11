import type { TriggerDetector, TriggerEvent } from '../trigger.types';
import { useWordSyncStore } from '../../stores/wordSync.store';
import { useLyricsStore } from '../../stores/lyrics.store';

export class WordLineDetector implements TriggerDetector {
  id = 'word-line';

  private _prevWordId: string | null = null;
  private _prevLineIndex = -1;
  private _lastTime = -1;

  private static DISCONTINUITY = 0.5;

  tick(time: number): TriggerEvent[] {
    const events: TriggerEvent[] = [];

    if (this._lastTime >= 0 && Math.abs(time - this._lastTime) > WordLineDetector.DISCONTINUITY) {
      this.reset();
    }
    this._lastTime = time;

    const lineIndex = useLyricsStore.getState().activeLineIndex;
    const ws = useWordSyncStore.getState();

    // ⚡ TC-AUDIO-P3: Skip processing when both current and previous line are cleared (track switch)
    if (lineIndex < 0 && this._prevLineIndex < 0) return events;

    // --- Line triggers ---
    if (lineIndex !== this._prevLineIndex) {
      if (this._prevLineIndex >= 0) {
        events.push({
          id: 'line-end', type: 'discrete', source: 'line-sync',
          value: 1, time, metadata: { lineIndex: this._prevLineIndex },
        });
      }
      if (lineIndex >= 0) {
        events.push({
          id: 'line-start', type: 'discrete', source: 'line-sync',
          value: 1, time, metadata: { lineIndex },
        });
      }
      if (this._prevWordId !== null) {
        events.push({
          id: 'word-end', type: 'discrete', source: 'word-sync',
          value: 1, time, metadata: { wordId: this._prevWordId, lineIndex: this._prevLineIndex },
        });
        this._prevWordId = null;
      }
      this._prevLineIndex = lineIndex;
    }

    if (lineIndex >= 0) {
      events.push({
        id: 'line-active', type: 'gate', source: 'line-sync',
        value: 1, time, metadata: { lineIndex },
      });
    }

    // --- Word triggers ---
    // Trigger word FX should follow fill-truth, not cue-truth,
    // otherwise progress and activation diverge.
    if (lineIndex >= 0 && ws.status === 'ready' && ws.hasUsableWordSyncForLine(lineIndex)) {
      const activeWord = ws.getFillWordForLine(lineIndex, time);

      if (activeWord) {
        const wordId = activeWord.id;

        if (wordId !== this._prevWordId) {
          if (this._prevWordId !== null) {
            events.push({
              id: 'word-end', type: 'discrete', source: 'word-sync',
              value: 1, time, metadata: { wordId: this._prevWordId, lineIndex },
            });
          }
          events.push({
            id: 'word-start', type: 'discrete', source: 'word-sync',
            value: 1, time, metadata: {
              wordId, wordText: activeWord.text,
              wordIndex: activeWord.wordIndex, lineIndex,
              confidence: activeWord.confidence,
              duration: activeWord.end - activeWord.start,
            },
          });
          this._prevWordId = wordId;
        }

        events.push({
          id: 'word-active', type: 'gate', source: 'word-sync',
          value: 1, time, metadata: {
            wordId, wordText: activeWord.text,
            wordIndex: activeWord.wordIndex, lineIndex,
            confidence: activeWord.confidence,
          },
        });

        const wordDuration = activeWord.end - activeWord.start;
        const rawProgress = wordDuration > 0
          ? Math.max(0, Math.min(1, (time - activeWord.start) / wordDuration))
          : 0;

        events.push({
          id: 'word-progress', type: 'continuous', source: 'word-sync',
          value: rawProgress, time, metadata: {
            wordId, wordText: activeWord.text,
            lineIndex, progress: rawProgress,
          },
        });
      } else {
        if (this._prevWordId !== null) {
          events.push({
            id: 'word-end', type: 'discrete', source: 'word-sync',
            value: 1, time, metadata: { wordId: this._prevWordId, lineIndex },
          });
          this._prevWordId = null;
        }
      }
    }

    return events;
  }

  reset(): void {
    this._prevWordId = null;
    this._prevLineIndex = -1;
    this._lastTime = -1;
  }
}
