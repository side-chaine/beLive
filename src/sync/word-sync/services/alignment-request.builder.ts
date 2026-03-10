import type { LineMapEntry } from '../line-map.types';
import type {
  AlignableLine,
  AlignmentAnchor,
  AlignmentJobRequest,
  AlignmentMode,
  AlignmentWindow,
  AudioSource,
} from '../types';

export function rebuildDisplayLyricsFromLineMap(lineMap: LineMapEntry[]): string {
  return [...lineMap]
    .sort((a, b) => a.rawLineIndex - b.rawLineIndex)
    .map((entry) => entry.text)
    .join('\n');
}

export function buildAlignableLinesFromLineMap(
  lineMap: LineMapEntry[]
): AlignableLine[] {
  return lineMap
    .filter((entry) => entry.alignable && entry.contentLineIndex != null)
    .map((entry) => ({
      rawLineIndex: entry.rawLineIndex,
      contentLineIndex: entry.contentLineIndex as number,
      text: entry.text,
    }));
}

export type BuildAlignmentJobRequestInput = {
  trackId?: string | number;
  lineMap: LineMapEntry[];
  lyricsHash: string;
  audioSource: AudioSource;
  language?: string;
  audioHash?: string;
  mode?: AlignmentMode;
  anchors?: AlignmentAnchor[];
  window?: AlignmentWindow;
};

export function buildAlignmentJobRequest(
  input: BuildAlignmentJobRequestInput
): AlignmentJobRequest {
  const {
    trackId,
    lineMap,
    lyricsHash,
    audioSource,
    language,
    audioHash,
    mode = 'full',
    anchors,
    window,
  } = input;

  return {
    trackId,
    mode,
    language,
    lyricsHash,
    audioHash,
    audioSource,
    rawLyrics: rebuildDisplayLyricsFromLineMap(lineMap),
    lineMap,
    alignableLines: buildAlignableLinesFromLineMap(lineMap),
    anchors,
    window,
  };
}
