import type { LineMapEntry, LineKind } from './line-map.types';
import type { AlignableLine } from './types';

function normalizeLineEndings(rawLyrics: string): string {
  return rawLyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function classifyLine(text: string): LineKind {
  const trimmed = text.trim();

  if (trimmed.length === 0) return 'separator';

  if (/^\[[^\]]+\]$/.test(trimmed)) {
    return 'bracket';
  }

  const compact = trimmed.toLowerCase();
  if (
    /^(\p{L}+[-\s]?){2,}$/u.test(compact) &&
    /^(на|на-на|ла|ла-ла|па|па-па|da|la|na)([-\s].+)?$/iu.test(compact)
  ) {
    return 'non-lexical';
  }

  return 'lyric';
}

function isAlignable(kind: LineKind): boolean {
  return kind !== 'separator' && kind !== 'bracket';
}

export function buildLineMap(rawLyrics: string): {
  lineMap: LineMapEntry[];
  alignableLines: AlignableLine[];
} {
  const normalized = normalizeLineEndings(rawLyrics);
  const rawLines = normalized.split('\n');

  const lineMap: LineMapEntry[] = [];
  const alignableLines: AlignableLine[] = [];

  let contentLineIndex = 0;

  rawLines.forEach((text, rawLineIndex) => {
    const kind = classifyLine(text);
    const alignable = isAlignable(kind);

    const entry: LineMapEntry = {
      rawLineIndex,
      kind,
      contentLineIndex: alignable ? contentLineIndex : null,
      text,
      alignable,
    };

    lineMap.push(entry);

    if (alignable) {
      alignableLines.push({
        rawLineIndex,
        contentLineIndex,
        text,
      });
      contentLineIndex++;
    }
  });

  return { lineMap, alignableLines };
}

export function getLineMapEntry(
  lineMap: LineMapEntry[],
  rawLineIndex: number
): LineMapEntry | null {
  return lineMap.find((entry) => entry.rawLineIndex === rawLineIndex) ?? null;
}
