export const PROTOCOL_VERSION = 1 as const;
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const STALE_AFTER_MS = 1500;

export interface Envelope<T = unknown> {
  v: typeof PROTOCOL_VERSION;
  epoch: string;
  seq: number;
  ts: number;
  payload: T;
}

export type ControlPayload =
  | { type: 'play'; mediaTime: number; wallClockTime: number }
  | { type: 'pause'; mediaTime: number; wallClockTime: number }
  | { type: 'seek'; mediaTime: number; wallClockTime: number }
  | { type: 'state-snapshot'; currentTime: number; isPlaying: boolean; playbackRate: number; stemVolumes: Record<string, number>; loop: { start: number; end: number } | null; activeBlockId?: string }
  | { type: 'sync-request' }
  | { type: 'set-stem-volume'; stemId: string; volume: number }
  | { type: 'set-loop'; start: number; end: number }
  | { type: 'clear-loop' }
  | { type: 'set-playback-rate'; rate: number };

export type TriggerPayload =
  | { type: 'annotation'; points: { x: number; y: number }[]; action: 'draw' | 'clear' }
  | { type: 'focus-change'; target: string };

export class ReplayGuard {
  private epoch: string | null = null;
  private lastSeq = -1;
  accept(envelope: Envelope): boolean {
    if (envelope.v !== PROTOCOL_VERSION) return false;
    if (envelope.epoch !== this.epoch) { this.epoch = envelope.epoch; this.lastSeq = envelope.seq; return true; }
    if (envelope.seq <= this.lastSeq) return false;
    this.lastSeq = envelope.seq;
    return true;
  }
}

export class EnvelopeSender {
  private epoch = crypto.randomUUID();
  private seq = 0;
  newEpoch() { this.epoch = crypto.randomUUID(); this.seq = 0; }
  wrap<T>(payload: T): Envelope<T> {
    return { v: PROTOCOL_VERSION, epoch: this.epoch, seq: this.seq++, ts: Date.now(), payload };
  }
}

export function safeParseEnvelope(raw: unknown): Envelope | null {
  if (typeof raw !== 'string') return null;
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if ((parsed as Envelope).v !== PROTOCOL_VERSION) return null;
    return parsed as Envelope;
  } catch { return null; }
}

export function isStale(envelope: Envelope): boolean {
  return Date.now() - envelope.ts > STALE_AFTER_MS;
}
