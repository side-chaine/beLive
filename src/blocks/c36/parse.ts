// parse.ts — токенизация, скоринг, парсинг Genius/LRC. Центр_36, research.
// Порт research-прототипа /tmp/c36v12/src/parse.js в TypeScript.
// Эмуляция _containmentScore по брифу §4.3: доля слов (>2 символов) строки Genius,
// найденных в LRC-строке. Оба опорных числа брифа воспроизводятся: 1.0 и 0.75.

export interface LrcLine {
  i?: number;
  t?: number;
  text: string;
}

export interface GeniusBlock {
  label: string;
  kind: string;
  lines: string[];
}

export interface Range {
  startIdx: number;
  endIdx: number;
}

export interface Dump {
  id?: string;
  track?: { artist?: string; title?: string; durationSec?: number };
  lrcLines: LrcLine[];
  geniusRaw?: string;
  geniusBlocks?: GeniusBlock[];
  expectedBlocks?: (Range & { i: number; label: string })[] | null;
  currentOutput?: (Range & { i: number; label?: string; kind?: string; lines?: number })[] | null;
  goldStatus?: string | null;
  raw?: unknown;
}

const STOPWORDS = new Set(['the', 'a', 'an', 'and']);

export function words(line: string | null | undefined): string[] {
  return String(line ?? '')
    .toLowerCase()
    .replace(/[()[\]{}"“”‘’,.;:!?…]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Эмуляция _containmentScore (бриф §4.3). Оба опорных числа брифа воспроизводятся
// на его примерах: полное вхождение → 1.0; строка с лишним ведущим словом → 0.75.
export function containment(gLine: string | null | undefined, lLine: string | null | undefined): number {
  const g = words(gLine);
  if (!g.length) {return 0;}
  const l = new Set(words(lLine));
  if (!l.size) {return 0;}
  let hit = 0;
  for (const w of g) {if (l.has(w)) {hit += 1;}}
  return hit / g.length;
}

export interface Idf {
  w: (word: string) => number;
}

// idf-веса по всему треку: df(w) = число LRC-строк, содержащих слово w.
export function buildIdf(lrcLines: LrcLine[], power: number): Idf {
  const df = new Map<string, number>();
  for (const l of lrcLines) {
    for (const w of new Set(words(l.text))) {df.set(w, (df.get(w) ?? 0) + 1);}
  }
  const N = Math.max(1, lrcLines.length);
  return {
    w: (word: string) => {
      const d = df.get(word) ?? 0;
      return 1 / Math.pow(1 + d / N, power); // редкое слово весит больше
    },
  };
}

// Взвешенное вхождение токенов gText в lText (направление Genius→LRC).
export function wcontain(gText: string | null | undefined, lText: string | null | undefined, idf?: Idf): number {
  const g = words(gText);
  if (!g.length) {
    // «Oh-oh, oh» и подобные: сравним по пустому токенайзеру нейтрально-положительно
    const l = words(lText);
    return l.length === 0 ? 0.4 : 0.1;
  }
  const l = new Set(words(lText));
  if (!l.size) {return 0;}
  let num = 0, den = 0;
  for (const w of g) {
    const weight = idf ? idf.w(w) : 1;
    den += weight;
    if (l.has(w)) {num += weight;}
  }
  return den > 0 ? num / den : 0;
}

// ── Парсинг Genius-разметки ──────────────────────────────────────────────────
// Вид: "[Verse 1]\nстроки...\n\n[Chorus]\n..."
// 16 канонических типов не перечисляем (SSOT в репо block-taxonomy.ts),
// здесь — research-подмножество, достаточное для замера.

const KIND_ORDER: [string, string][] = [
  ['pre-chorus', 'prechorus'],
  ['prechorus', 'prechorus'],
  ['post-chorus', 'postchorus'],
  ['chorus', 'chorus'],
  ['verse', 'verse'],
  ['bridge', 'bridge'],
  ['interlude', 'instrumental'],
  ['instrumental', 'instrumental'],
  ['intro', 'intro'],
  ['outro', 'outro'],
  ['solo', 'solo'],
  ['hook', 'hook'],
  ['refrain', 'refrain'],
];

export function kindOf(label: string): string {
  const low = label.toLowerCase();
  for (const [needle, kind] of KIND_ORDER) {if (low.includes(needle)) {return kind;}}
  return 'unknown';
}

// Гипотеза H0 (документируется в A12): пустой ведущий инструментальный тег
// ("[Instrumental Intro]") отбрасывается парсером — это подтверждается дампом:
// geniusBlocks эталона содержит ровно 12 блоков, начиная с "Verse 1".
export function parseGeniusRaw(raw: string | null | undefined): GeniusBlock[] {
  const out: GeniusBlock[] = [];
  let cur: GeniusBlock | null = null;
  for (const rawLine of String(raw ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    const tag = line.match(/^\[([^\]]+)\]$/);
    if (tag) {
      cur = { label: tag[1], kind: kindOf(tag[1]), lines: [] };
      out.push(cur);
    } else if (line.length > 0 && cur) {
      cur.lines.push(line);
    }
  }
  while (out.length && (out[0].kind === 'intro' || out[0].kind === 'instrumental') && out[0].lines.length === 0) {out.shift();}
  return out;
}

// Загрузка дампа belive.blocks-dump/1.
export function loadDump(obj: Dump) {
  const lrcLines = obj.lrcLines ?? [];
  const blocks = parseGeniusRaw(obj.geniusRaw);
  return {
    id: obj.id ?? (obj.track ? `${obj.track.artist} — ${obj.track.title}` : 'unknown'),
    goldStatus: obj.goldStatus ?? null,
    track: obj.track,
    lrcLines,
    geniusBlocks: blocks,
    expectedBlocks: obj.expectedBlocks ?? null,
    currentOutput: obj.currentOutput ?? null,
    raw: obj,
  };
}

export function hash8(text: string | null | undefined): string {
  // Короткий не-криптографический слепок строки для артефактов без копирайта.
  let h = 5381;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {h = ((h << 5) + h + s.charCodeAt(i)) | 0;}
  return (h >>> 0).toString(16).padStart(8, '0');
}
