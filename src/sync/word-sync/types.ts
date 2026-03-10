import type { LineMapEntry } from './line-map.types';

export type AlignableLine = {
  rawLineIndex: number;
  contentLineIndex: number;
  text: string;
};

export type WordTiming = {
  id: string;
  text: string;
  normalizedText?: string;
  start: number;
  end: number;
  confidence?: number;
  rawLineIndex: number;
  contentLineIndex: number;
  wordIndex: number;
  charStart?: number;
  charEnd?: number;
};

export type LineTiming = {
  rawLineIndex: number;
  contentLineIndex: number;
  text: string;
  start: number | null;
  end: number | null;
  confidence?: number;
  words: WordTiming[];
  anchorTime?: number;
};

export type SeparatorTiming = {
  rawLineIndex: number;
  time: number;
  kind: 'block-close' | 'gap';
  confidence?: number;
};

export type AudioSource = 'vocal-stem' | 'mix' | 'instrumental';
export type AlignmentMode = 'full' | 'anchored' | 'repair-window';

export type AlignmentResult = {
  source: 'ai-aligner';
  version: 1;
  trackId?: number | string;
  language?: string;
  lyricsHash: string;
  audioHash?: string;
  audioSource: AudioSource;
  provider?: string;
  providerVersion?: string;
  mode?: AlignmentMode;
  lines: LineTiming[];
  separators?: SeparatorTiming[];
};

export type AlignmentAnchor = {
  rawLineIndex: number;
  time: number;
  kind: 'line' | 'separator';
  hard?: boolean;
};

export type AlignmentWindow = {
  start: number;
  end: number;
  rawLineStart: number;
  rawLineEnd: number;
};

export type AlignmentJobRequest = {
  trackId?: string | number;
  mode: AlignmentMode;
  language?: string;
  lyricsHash: string;
  audioHash?: string;
  audioSource: AudioSource;
  rawLyrics: string;
  lineMap: LineMapEntry[];
  alignableLines: AlignableLine[];
  anchors?: AlignmentAnchor[];
  window?: AlignmentWindow;
};
