import { resolveBlockAlias, type BlockType } from './block-taxonomy';

export interface DetectedBlock {
  type: BlockType;
  label: string;
  originalTag: string;
  number?: number;
  artist?: string;
  startLineIndex: number;
  endLineIndex: number;
  contentLines: string[];
  confidence: number;
  reviewRequired: boolean;
}

export interface ParseResult {
  blocks: DetectedBlock[];
  unmatchedTags: string[];
  totalLines: number;
  coverage: number;
  hasStructure: boolean;
}

const BRACKET_RE = /^\s*\[([^\]]+)\]\s*$/;

const PREFIX_KEYWORDS = [
  'verse','chorus','pre-chorus','prechorus','pre chorus',
  'bridge','intro','outro','hook','refrain','interlude',
  'break','instrumental','solo',
  'куплет','припев','предприпев','пре-хорус','пре хорус',
  'бридж','интро','аутро','проигрыш','инструментал','вставка','соло',
];

const PREFIX_RE = new RegExp(
  `^\\s*((?:${PREFIX_KEYWORDS.join('|')})(?:\\s+\\d+)?)\\s*:\\s*$`, 'iu'
);

function detectBracketTag(line: string) {
  const m = line.match(BRACKET_RE);
  if (!m) return null;

  const content = m[1];
  let tagPart: string;
  let artist: string | undefined;

  const colonIdx = content.indexOf(':');
  if (colonIdx > 0) {
    const left = content.substring(0, colonIdx).trim();
    const leftNorm = left.toLowerCase().replace(/\s+\d+$/, '');
    if (resolveBlockAlias(leftNorm)) {
      tagPart = left;
      artist = content.substring(colonIdx + 1).trim() || undefined;
    } else {
      tagPart = content.trim();
    }
  } else {
    tagPart = content.trim();
  }

  return extractTagInfo(tagPart, `[${content}]`, 1.0, artist);
}

function detectPrefixTag(line: string) {
  const m = line.match(PREFIX_RE);
  if (!m) return null;
  return extractTagInfo(m[1].trim(), line.trim(), 0.9);
}

function extractTagInfo(
  tagText: string,
  raw: string,
  confidence: number,
  artist?: string,
) {
  let tag = tagText;
  let num: number | undefined;

  const spaceNum = tag.match(/^(.+?)\s+(\d+)$/);
  if (spaceNum) {
    tag = spaceNum[1].trim();
    num = parseInt(spaceNum[2], 10);
  } else {
    const noSpaceNum = tag.match(/^(.+?)(\d+)$/);
    if (noSpaceNum) {
      const candidate = noSpaceNum[1].trim();
      if (resolveBlockAlias(candidate)) {
        tag = candidate;
        num = parseInt(noSpaceNum[2], 10);
      }
    }
  }

  const alias = resolveBlockAlias(tag);
  if (!alias) return null;

  return {
    type: alias.type,
    tag: tag.toLowerCase(),
    number: num,
    artist,
    raw,
    confidence,
    reviewRequired: alias.reviewRequired,
  };
}

function detectTagLine(line: string) {
  return detectBracketTag(line) ?? detectPrefixTag(line);
}

const TYPE_LABELS: Record<BlockType, string> = {
  verse: 'Verse',
  chorus: 'Chorus',
  prechorus: 'Pre-Chorus',
  bridge: 'Bridge',
  interlude: 'Interlude',
  intro: 'Intro',
  outro: 'Outro',
};

/** Pre-filter to remove Genius.com noise patterns */
function filterGeniusNoise(text: string): string {
  const lines = text.split(/\r?\n/);
  const filtered: string[] = [];
  let skipUntilNextTag = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a bracket tag line [...]
    const isBracketTag = /^\s*\[.+\]\s*$/.test(line);

    // If we're in skip mode, only a bracket tag breaks us out
    if (skipUntilNextTag) {
      if (isBracketTag) {
        skipUntilNextTag = false;
        filtered.push(line);
      }
      // else: skip this line (noise after "you might also like")
      continue;
    }

    // Check for block-level skip triggers
    const lower = trimmed.toLowerCase();
    if (lower === 'you might also like') {
      skipUntilNextTag = true;
      continue;
    }

    // Individual line filters (existing patterns)
    if (!trimmed) { filtered.push(line); continue; } // keep empty lines
    if (lower.startsWith('see ') && lower.endsWith(' live')) continue;
    if (lower.includes('get tickets as low as')) continue;
    if (lower.includes('genius romanizations')) continue;
    if (lower.includes('genius translations')) continue;
    if (/^\$\d+/.test(trimmed)) continue;
    if (/^\d+embed$/i.test(lower.replace(/\s/g, ''))) continue;

    filtered.push(line);
  }

  return filtered.join('\n');
}

function buildLabel(type: BlockType, num?: number): string {
  const base = TYPE_LABELS[type] ?? type;
  return num != null ? `${base} ${num}` : base;
}

export function parseTaggedLyrics(text: string): ParseResult {
  const cleaned = filterGeniusNoise(text);
  const lines = cleaned.split(/\r?\n/);
  const blocks: DetectedBlock[] = [];
  const unmatchedTags: string[] = [];

  let current: {
    type: BlockType;
    label: string;
    raw: string;
    number?: number;
    artist?: string;
    confidence: number;
    reviewRequired: boolean;
    contentLines: string[];
    startLine: number;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const detection = detectTagLine(line);

    if (detection) {
      if (current) {
        blocks.push(finalizeBlock(current, i - 1));
      }
      current = {
        type: detection.type,
        label: buildLabel(detection.type, detection.number),
        raw: detection.raw,
        number: detection.number,
        artist: detection.artist,
        confidence: detection.confidence,
        reviewRequired: detection.reviewRequired,
        contentLines: [],
        startLine: i + 1,
      };
    } else if (BRACKET_RE.test(line)) {
      const content = line.match(BRACKET_RE)?.[1];
      if (content) unmatchedTags.push(content);
      if (current) {
        blocks.push(finalizeBlock(current, i - 1));
        current = null;
      }
    } else if (current) {
      current.contentLines.push(line);
    }
  }

  if (current) {
    blocks.push(finalizeBlock(current, lines.length - 1));
  }

  // Filter: Interlude blocks with < 3 content lines are ignored
  const filteredBlocks = blocks.filter(b => {
    if (b.type === 'interlude') {
      const nonEmptyLines = b.contentLines.filter(l => l.trim()).length;
      return nonEmptyLines >= 3;
    }
    return true;
  });

  const totalContent = lines.filter(l =>
    l.trim() && !detectTagLine(l) && !BRACKET_RE.test(l)
  ).length;
  const covered = filteredBlocks.reduce(
    (s, b) => s + b.contentLines.filter(l => l.trim()).length, 0
  );

  // ── Auto-number repeated verse/chorus blocks ──
  const typesToNumber = new Set(['verse', 'chorus']);
  const typeCounts: Record<string, number> = {};
  for (const block of filteredBlocks) {
    typeCounts[block.type] = (typeCounts[block.type] || 0) + 1;
  }

  const typeOccurrences: Record<string, number> = {};
  const processedBlocks = filteredBlocks.map(block => {
    if (!typesToNumber.has(block.type)) return block;
    if (typeCounts[block.type] <= 1) return block;

    typeOccurrences[block.type] = (typeOccurrences[block.type] || 0) + 1;

    if (block.number !== undefined) return block; // respect explicit author number

    return {
      ...block,
      number: typeOccurrences[block.type],
      label: buildLabel(block.type, typeOccurrences[block.type]),
    };
  });

  return {
    blocks: processedBlocks,
    unmatchedTags,
    totalLines: lines.length,
    coverage: totalContent > 0 ? covered / totalContent : 0,
    hasStructure: filteredBlocks.length > 0,
  };
}

interface CurrentBlock {
  type: BlockType;
  label: string;
  raw: string;
  number?: number;
  artist?: string;
  confidence: number;
  reviewRequired: boolean;
  contentLines: string[];
  startLine: number;
}

function finalizeBlock(
  current: CurrentBlock,
  lastLineIndex: number,
): DetectedBlock {
  const content = [...current.contentLines];
  while (content.length > 0 && !content[content.length - 1].trim()) content.pop();
  let startOffset = 0;
  while (startOffset < content.length && !content[startOffset].trim()) startOffset++;
  const trimmed = content.slice(startOffset);

  return {
    type: current.type,
    label: current.label,
    originalTag: current.raw,
    number: current.number,
    artist: current.artist,
    startLineIndex: current.startLine + startOffset,
    endLineIndex: trimmed.length > 0
      ? current.startLine + startOffset + trimmed.length - 1
      : current.startLine,
    contentLines: trimmed,
    confidence: current.confidence,
    reviewRequired: current.reviewRequired,
  };
}
