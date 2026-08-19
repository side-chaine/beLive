export type StemId = string;

export type TransportState = 'idle' | 'ready' | 'playing' | 'paused' | 'ended';

export interface LoopPoints {
  start: number;
  end: number;
}
