export type LineKind = 'lyric' | 'separator' | 'bracket' | 'non-lexical';

export type LineMapEntry = {
  rawLineIndex: number;
  kind: LineKind;
  contentLineIndex: number | null;
  text: string;
  alignable: boolean;
};
