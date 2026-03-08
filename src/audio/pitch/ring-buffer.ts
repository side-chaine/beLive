import type { PitchSample } from './types';

/**
 * Fixed-capacity circular buffer for PitchSample data.
 * Canvas reads via getRange() in rAF — no allocations on push.
 */
export class PitchRingBuffer {
  private _buf: PitchSample[];
  private _head = 0;
  private _len = 0;
  private _cap: number;

  constructor(capacity = 300) {
    this._cap = capacity;
    this._buf = new Array(capacity);
  }

  push(s: PitchSample): void {
    this._buf[this._head] = s;
    this._head = (this._head + 1) % this._cap;
    if (this._len < this._cap) this._len++;
  }

  /** Samples within time window [fromTime, toTime] in chronological order */
  getRange(fromTime: number, toTime: number): PitchSample[] {
    const out: PitchSample[] = [];
    for (let i = 0; i < this._len; i++) {
      const idx = (this._head - this._len + i + this._cap) % this._cap;
      const s = this._buf[idx];
      if (s.timestamp >= fromTime && s.timestamp <= toTime) out.push(s);
    }
    return out;
  }

  /** Last N samples in chronological order */
  getLatest(count: number): PitchSample[] {
    const n = Math.min(count, this._len);
    const out: PitchSample[] = [];
    for (let i = 0; i < n; i++) {
      const idx = (this._head - n + i + this._cap) % this._cap;
      out.push(this._buf[idx]);
    }
    return out;
  }

  clear(): void {
    this._head = 0;
    this._len = 0;
  }

  get length(): number {
    return this._len;
  }
}
