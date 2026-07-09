/**
 * auto-lyrics.service.ts — W11
 * Auto-fetch synced lyrics from lrclib.net + match to Genius text
 */

import { parseTaggedLyrics } from '../blocks/parser/tagged-lyrics.parser';
import type { DetectedBlock } from '../blocks/parser/tagged-lyrics.parser';
import type { PersistedSyncMarker, PersistedTextBlock } from '../types/persistence.types';
import { computeLocalStopWords } from '../utils/block-utils';
import { TAXONOMY_VERSION } from '../blocks/parser/block-taxonomy';

// ── Types ──────────────────────────────────────────────

/**
 * §7 Calibration: tuning parameters for block-first-line sync.
 * Pass optional override to blockFirstLineSync() for grid search.
 */
export interface SyncTuning {
  MIN_CANDIDATE_SCORE: number;
  K: number;
  MIN_SPATIAL_FLOOR: number;
  UNIQUENESS_POWER: number;
  SIGMA_CAP: number;
  WORDS_WINDOW: number;
}

export const DEFAULT_TUNING: SyncTuning = {
  MIN_CANDIDATE_SCORE: 0.40,
  K: 10,
  MIN_SPATIAL_FLOOR: 0.15,
  UNIQUENESS_POWER: 3,
  SIGMA_CAP: 0.25,
  WORDS_WINDOW: 3,
};

export interface LrcLine {
  time: number; // seconds
  text: string;
}

export interface LrcResult {
  lines: LrcLine[];
  rawSynced: string;
  fetchedAt: number;
  confidence?: number; // от последнего match
  sourceId?: number;   // TC-096: lrclib version ID — для точного сравнения "та же версия?"
  duration?: number;   // TC-096: track duration (requested), для fetchLrcVersions scoring
  versionDuration?: number; // TC-096-FIX: lrclib API version's reported duration (always known when sourceId exists)
}

interface MatchResult {
  markers: PersistedSyncMarker[];
  blocks: PersistedTextBlock[];
  confidence: number;
  lyricsLines: string[];  // rawLyricsArray — clean lyrics WITHOUT bracket tags for IDB storage
}

/**
 * TC-LRCPICKER-01: LRC version from lrclib search results.
 * Includes metadata needed for version picker UI.
 */
export interface LrcVersion {
  id: number;                  // lrclib version ID
  artistName: string;
  trackName: string;
  duration: number;            // seconds (from lrclib API)
  durationDelta: number;       // |duration - trackDuration|
  lineCount: number;           // number of synced lines
  lrcText: string;             // raw syncedLyrics from lrclib
  score: number;               // relevance score (higher = better)
}

// ── State ──────────────────────────────────────────────

const _cache = new Map<string, LrcResult>();
let _lastPrefetchedTitle: string | null = null;
// W11: trackId-based skip tracking (вместо timeout-based флагов)
let _autoSyncedTrackId: number | null = null;

// ── Init — сервис сам слушает track-loaded ─────────────

document.addEventListener('track-loaded', (e: Event) => {
  const d = (e as CustomEvent).detail;
  if (_lastPrefetchedTitle && d?.duration && d.duration > 0) {
    refetchWithDuration(d.duration).catch(() => {});
  }
});

// ── Public API ─────────────────────────────────────────

export function parseTitleToArtistTrack(
  title: string,
): { artist: string; track: string } {
  // Убираем суффиксы: (Remastered), (Live), feat., ft.
  const cleaned = title
    .replace(/\s*[\(\[](remastered|live|acoustic|demo|edit|remix|feat\.?.*|ft\.?.*)[\)\]]/gi, '')
    .trim();

  // Разделители: " - " / " – " / " — "
  const match = cleaned.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (match) {
    return {
      artist: match[1].trim(),
      track: match[2].trim(),
    };
  }

  // New: fallback — unspaced dash as separator (for "Artist-Title", "Артист-Название")
  const dashFallback = cleaned.match(/^(.+?)[-–—](.+)$/);
  if (dashFallback) {
    const artist = dashFallback[1].trim();
    const track = dashFallback[2].trim();
    if (artist.length >= 2 && track.length >= 1) {
      return { artist, track };
    }
  }

  // Нет разделителя — весь title как track
  return { artist: '', track: cleaned };
}

export function prefetch(title: string): void {
  _lastPrefetchedTitle = title;
  const { artist, track } = parseTitleToArtistTrack(title);
  if (!artist || !track) return;

  // Fire-and-forget
  _fetchLrclib(artist, track, undefined).catch(() => {});
}

/** Prefetch with known duration — much faster lrclib response */
export function prefetchWithDuration(title: string, duration: number): void {
  _lastPrefetchedTitle = title;
  const { artist, track } = parseTitleToArtistTrack(title);
  if (!artist || !track) return;

  // Fire-and-forget WITH duration — lrclib returns exact match
  _fetchLrclib(artist, track, Math.round(duration)).catch(() => {});
}

export async function refetchWithDuration(duration: number): Promise<void> {
  if (!_lastPrefetchedTitle) return;
  const { artist, track } = parseTitleToArtistTrack(_lastPrefetchedTitle);
  if (!artist || !track) return;

  const cached = _cache.get(_cacheKey(_lastPrefetchedTitle));
  // Рефетч только если первый результат слабый или отсутствует
  if (cached && (cached.confidence ?? 1) >= 0.6) return;

  await _fetchLrclib(artist, track, Math.round(duration)).catch(() => {});
}

export function getCached(title: string): LrcResult | null {
  return _cache.get(_cacheKey(title)) ?? null;
}

export async function waitForCache(
  title: string,
  timeoutMs: number = 30000,
): Promise<LrcResult | null> {
  // Сначала проверяем сразу
  const cached = getCached(title);
  if (cached) return cached;

  // Ждём с polling каждые 200ms
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const result = getCached(title);
      if (result) {
        resolve(result);
        return;
      }
      if (Date.now() - startTime >= timeoutMs) {
        resolve(null); // Timeout
        return;
      }
      setTimeout(check, 200);
    };
    setTimeout(check, 200);
  });
}

/**
 * Parse raw LRC string into LrcResult.
 * Wrapper around private _parseLrc for use in upload.service.ts
 * and migration flows.
 */
/** @deprecated Import from lrc-parser.service instead */
export function parseLrcString(rawLrc: string): LrcResult {
  const lines = _parseLrc(rawLrc);
  return {
    lines,
    rawSynced: rawLrc,
    fetchedAt: Date.now(),
    confidence: 1.0, // Local parse = high confidence
  };
}

/**
 * Convert LRC result to markers + clean lyrics lines.
 * Used when Genius text is NOT available (ZIP import with LRC only).
 * Creates M1 markers with lineIndex mapped to clean display array.
 * blocks = [] (user can create blocks later in Block Editor).
 */
export function lrcToMarkers(lrcResult: LrcResult): {
  markers: PersistedSyncMarker[];
  lyricsLines: string[];
} {
  const displayLines: string[] = [];
  const markers: PersistedSyncMarker[] = [];

  for (let i = 0; i < lrcResult.lines.length; i++) {
    const lrcLine = lrcResult.lines[i];
    // Skip empty lines — they should not appear in display
    if (!lrcLine.text.trim()) continue;

    const displayIdx = displayLines.length;
    displayLines.push(lrcLine.text);

    markers.push({
      id: `lrc-${i}-${Date.now()}`,
      lineIndex: displayIdx,
      time: lrcLine.time,
      text: lrcLine.text,
    });
  }

  return { markers, lyricsLines: displayLines };
}

/**
 * TC-010: Block-First Line Sync
 * 
 * Architecture:
 *   LRC lines = display + timing (drift ≈ 0)
 *   Genius blocks = structure overlay (types, performers)
 *   
 * Algorithm:
 *   1. LRC lines become the display array (track.lyrics)
 *   2. Each LRC line gets a marker with its exact timestamp
 *   3. For each Genius block, find its first content line in LRC
 *   4. Assign LRC lines to blocks by time range
 *   5. Block metadata (type, performer) from Genius
 */
export function blockFirstLineSync(
  geniusText: string,
  lrcResult: LrcResult,
  tuning?: Partial<SyncTuning>,
): MatchResult {
  // 1. Parse Genius → blocks with metadata
  const tagResult = parseTaggedLyrics(geniusText);
  
  // 007-DEBUG: Log parseTaggedLyrics output to diagnose Bridge truncation
  if (import.meta.env.DEV) {
    console.log('[007-SCAN] parseTaggedLyrics output:');
    console.log(`  Total blocks: ${tagResult.blocks.length}`);
    console.log(`  hasStructure: ${tagResult.hasStructure}`);
    tagResult.blocks.forEach((b, i) => {
      console.log(`  Block ${i} [${b.type}]: "${b.label}" — ${b.contentLines.length} contentLines`);
      if (b.type === 'bridge') {
        console.log(`    [007-CRITICAL] Bridge contentLines:`, b.contentLines);
      }
    });
  }
  
  // 2. Build display lines from LRC
  const displayLines: string[] = [];
  const markers: PersistedSyncMarker[] = [];
  
  // TC-010-FIX3: LRC offset removed — search API provides correct version
  // No offset needed when using proper LRC timestamps
  
  for (let i = 0; i < lrcResult.lines.length; i++) {
    const lrcLine = lrcResult.lines[i];
    if (!lrcLine.text.trim()) continue;
    
    const displayIdx = displayLines.length;
    displayLines.push(lrcLine.text);
    
    markers.push({
      id: `lrc-${i}-${Date.now()}`,
      lineIndex: displayIdx,
      time: lrcLine.time,  // TC-010-FIX3: No offset — raw LRC time
      text: lrcLine.text,
    });
  }
  
  // TC-6D: Compute global stop words from ALL LRC lines using shared utility.
  // Words appearing in >40% of lines (FREQ_THRESHOLD in block-utils.ts) are
  // filtered from fingerprints to prevent Chorus↔Post-Chorus false matches.
  // computeLocalStopWords normalizes internally — pass raw displayLines.
  const _globalStopWords = computeLocalStopWords(
    displayLines.map((_, i) => i),
    displayLines
  );
  
  // ═══════════════════════════════════════════════════════════════
  // TC-120: LRC Sanitization
  // Фильтруем строки-заглушки ("♪", "...", "~") чтобы они не
  // раздували M и не искажали gap/ratio в DP.
  // ═══════════════════════════════════════════════════════════════
  const FILLER_REGEX = /[♪~…\.\s]/g;
  function isFillerLine(text: string): boolean {
    return text.replace(FILLER_REGEX, '').length === 0;
  }
  
  const validIndices: number[] = [];
  for (let i = 0; i < displayLines.length; i++) {
    if (!isFillerLine(displayLines[i])) validIndices.push(i);
  }
  const M = validIndices.length;
  
  const origIdxToValidRank = new Map<number, number>();
  validIndices.forEach((origIdx, rank) => origIdxToValidRank.set(origIdx, rank));
  
  // ═══════════════════════════════════════════════════════════════
  // TC-121: Candidate Collection + Jaccard bag-of-words + ECC uniqueness
  // ═══════════════════════════════════════════════════════════════
  
  // §7 Calibration: verified via grid search (108 combos on MJ+Runaway+A1/A2/A6).
  // All 4 params confirmed optimal at current defaults. Runaway requires UP≥3.
  const cfg: SyncTuning = { ...DEFAULT_TUNING, ...tuning };
  const MIN_CANDIDATE_SCORE = cfg.MIN_CANDIDATE_SCORE;
  const K = cfg.K;
  const MIN_SPATIAL_FLOOR = cfg.MIN_SPATIAL_FLOOR;
  const UNIQUENESS_POWER = cfg.UNIQUENESS_POWER;
  const WORDS_WINDOW = cfg.WORDS_WINDOW;
  
  interface Candidate {
    lrcIdx: number;        // исходный индекс в displayLines (для результата)
    validRank: number;     // ранг среди валидных строк (для скоринга)
    rawScore: number;      // Jaccard bag-of-words score
    uniqueness: number;    // ECC uniqueness блока
    spatialPenalty: number;
    upc: number;           // финальный вес для DP
  }
  
  function buildWordSet(lines: string[], maxLines: number, stopWords: Set<string>): Set<string> {
    const words = new Set<string>();
    let taken = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const norm = _normalizeText(trimmed);
      for (const w of norm.split(/\s+/)) {
        if (w.length > 2 && !stopWords.has(w)) words.add(w);
      }
      taken++;
      if (taken >= maxLines) break;
    }
    return words;
  }
  
  function jaccardOverlap(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const w of a) if (b.has(w)) intersection++;
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
  
  function getValidWindowLines(startPos: number, count: number): string[] {
    const out: string[] = [];
    for (let p = startPos; p < validIndices.length && out.length < count; p++) {
      out.push(displayLines[validIndices[p]]);
    }
    return out;
  }
  
  // ── Step 1: базовая структура блоков + ожидаемые линии ──
  const blocks: PersistedTextBlock[] = [];
  const expectedLines: number[] = [];
  for (let bi = 0; bi < tagResult.blocks.length; bi++) {
    const block = tagResult.blocks[bi];
    const contentLines = block.contentLines.filter((l: string) => l.trim());
    expectedLines.push(contentLines.length);
    blocks.push({
      id: `auto-block-${bi}`,
      name: block.label,
      lineIndices: [],
      type: block.type,
      contentLines: block.contentLines,
      originalTag: block.originalTag,
      instrument: block.instrument,
      reviewRequired: block.reviewRequired,
      taxonomyVersion: TAXONOMY_VERSION,
      // @ts-expect-error — diagnostic field, not in PersistedTextBlock
      _expectedLines: contentLines.length,
    });
  }
  
  const totalExpectedLines = expectedLines.reduce((s, n) => s + n, 0);
  // S = глобальный коэффициент сжатия: M валидных LRC-строк / totalExpectedLines
  const S = totalExpectedLines > 0 ? M / totalExpectedLines : 1;
  
  // Prefix sum для gap-штрафа. cumExpectedLines[0] = 0.
  const cumExpectedLines: number[] = [0];
  for (let i = 0; i < expectedLines.length; i++) {
    cumExpectedLines.push(cumExpectedLines[i] + expectedLines[i]);
  }
  
  // ── Step 2: G_ratio (гибрид: textRatio + rankRatio) ──
  const N = tagResult.blocks.length;
  const gRatio: number[] = [];
  {
    let cumText = 0;
    for (let i = 0; i < N; i++) {
      const textRatio = totalExpectedLines > 0 ? cumText / totalExpectedLines : 0.5;
      const rankRatio = N > 1 ? i / (N - 1) : 0.5;
      gRatio.push(0.6 * textRatio + 0.4 * rankRatio);
      cumText += expectedLines[i];
    }
  }
  
  const SIGMA = Math.max(0.08, Math.min(cfg.SIGMA_CAP, 1.5 / Math.max(1, N)));
  
  function calcSpatialPenalty(gR: number, validRank: number): number {
    if (M === 0) return MIN_SPATIAL_FLOOR;
    const lR = validRank / M;
    const raw = Math.exp(-Math.pow(gR - lR, 2) / (2 * SIGMA * SIGMA));
    return Math.max(raw, MIN_SPATIAL_FLOOR);
  }
  
  // ── Step 3: Candidate collection per block ──
  const allCandidates: Candidate[][] = [];
  for (let bi = 0; bi < N; bi++) {
    const contentLines = tagResult.blocks[bi].contentLines.filter((l: string) => l.trim());
    if (contentLines.length === 0) {
      allCandidates.push([]);
      continue;
    }
    
    const wordsG = buildWordSet(contentLines, WORDS_WINDOW, _globalStopWords);
    
    // Полный проход по ВСЕМ валидным LRC-строкам (без окна/курсора)
    const rawPool: { validRank: number; lrcIdx: number; rawScore: number }[] = [];
    for (let p = 0; p < M; p++) {
      const wordsL = buildWordSet(getValidWindowLines(p, WORDS_WINDOW), WORDS_WINDOW, _globalStopWords);
      const rawScore = jaccardOverlap(wordsG, wordsL);
      if (rawScore >= MIN_CANDIDATE_SCORE) {
        rawPool.push({ validRank: p, lrcIdx: validIndices[p], rawScore });
      }
    }
    
    // ECC uniqueness — один раз на блок
    let matchMass = 0;
    for (const c of rawPool) {
      const normalized = (c.rawScore - MIN_CANDIDATE_SCORE) / (1 - MIN_CANDIDATE_SCORE);
      matchMass += Math.pow(Math.max(0, normalized), UNIQUENESS_POWER);
    }
    const uniqueness = Math.max(0.2, Math.min(1.0, 1.0 / Math.max(1, matchMass)));
    
    // UPC на каждого кандидата
    const scored: Candidate[] = rawPool.map(c => {
      const spatial = calcSpatialPenalty(gRatio[bi], c.validRank);
      return {
        lrcIdx: c.lrcIdx,
        validRank: c.validRank,
        rawScore: c.rawScore,
        uniqueness,
        spatialPenalty: spatial,
        upc: c.rawScore * uniqueness * spatial,
      };
    });
    
    scored.sort((a, b) => b.upc - a.upc || a.lrcIdx - b.lrcIdx);
    allCandidates.push(scored.slice(0, K));
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TC-122: Global Spatial-Sequence DP
  // Forward pass с GLOBAL lookback (ВСЕ предки, не только ближайший).
  // Индексация напрямую по bi (0..N-1) — БЕЗ nonEmptyBlockIndices.
  // ═══════════════════════════════════════════════════════════════
  
  interface DpCell {
    totalScore: number;
    prevBlockIdx: number;  // исходный индекс блока-предшественника (-1 = начало цепи)
    prevK: number;         // индекс кандидата у предшественника
    resolved: boolean;
  }
  
  const dp: DpCell[][] = allCandidates.map(cands =>
    cands.map(() => ({ totalScore: 0, prevBlockIdx: -1, prevK: -1, resolved: false }))
  );
  
  // Forward pass — GLOBAL lookback (ВСЕ prevBi, не только ближайший).
  // ЛЮБОЙ блок без валидного предка может стартовать сам на своём upc.
  // Это устраняет структурную дыру: если первое звено цепи резолвится
  // на слабом/случайном совпадении (Intro с 50%), оно блокирует все
  // следующие блоки монотонностью. DP выбирает глобально лучшую цепочку.
  for (let bi = 0; bi < N; bi++) {
    for (let k = 0; k < allCandidates[bi].length; k++) {
      const cand = allCandidates[bi][k];
      let bestTotal = -Infinity;
      let bestPrevBi = -1;
      let bestPrevK = -1;
      
      for (let prevBi = 0; prevBi < bi; prevBi++) {
        for (let pk = 0; pk < allCandidates[prevBi].length; pk++) {
          const prevCand = allCandidates[prevBi][pk];
          if (!dp[prevBi][pk].resolved) continue;
          // Строгая монотонность в исходном index-пространстве
          if (prevCand.lrcIdx >= cand.lrcIdx) continue;
          
          // Gap-штраф в valid rank пространстве (без filler-строк)
          const actualGap = cand.validRank - prevCand.validRank;
          // Исправленная формула: cumExpectedLines[bi] - cumExpectedLines[prevBi],
          // БЕЗ +1 (см. §0.1 MACRO — off-by-one fix)
          const expectedLinesSum = cumExpectedLines[bi] - cumExpectedLines[prevBi];
          const expectedScaled = expectedLinesSum * S;
          const penalty = Math.pow(
            (actualGap - expectedScaled) / (expectedScaled + 0.5), 2
          );
          
          const total = dp[prevBi][pk].totalScore + cand.upc - penalty;
          
          if (total > bestTotal) {
            bestTotal = total;
            bestPrevBi = prevBi;
            bestPrevK = pk;
          }
        }
      }
      
      if (bestPrevBi >= 0) {
        dp[bi][k] = {
          totalScore: bestTotal,
          prevBlockIdx: bestPrevBi,
          prevK: bestPrevK,
          resolved: true,
        };
      } else if (cand.upc > 0) {
        // Fallback: нет валидного предка — блок стартует сам.
        // DP взвесит: слабый start vs. полное отсутствие цепочки.
        dp[bi][k] = {
          totalScore: cand.upc,
          prevBlockIdx: -1,
          prevK: -1,
          resolved: true,
        };
      }
    }
  }
  
  // Backward trace — глобальный максимум среди ВСЕХ resolved ячеек
  const _lrcStartIdx: (number | null)[] = new Array(N).fill(null);
  const _chosenMatchScore: (number | null)[] = new Array(N).fill(null);
  
  let globalBestBi = -1, globalBestK = -1, globalBestTotal = -Infinity;
  for (let bi = 0; bi < N; bi++) {
    for (let k = 0; k < dp[bi].length; k++) {
      if (dp[bi][k].resolved && dp[bi][k].totalScore > globalBestTotal) {
        globalBestTotal = dp[bi][k].totalScore;
        globalBestBi = bi;
        globalBestK = k;
      }
    }
  }
  
  if (globalBestBi >= 0) {
    let curBi = globalBestBi;
    let curK = globalBestK;
    while (curBi >= 0) {
      _lrcStartIdx[curBi] = allCandidates[curBi][curK].lrcIdx;
      _chosenMatchScore[curBi] = allCandidates[curBi][curK].rawScore;
      
      const cell = dp[curBi][curK];
      if (cell.prevBlockIdx < 0) break;
      curBi = cell.prevBlockIdx;
      curK = cell.prevK;
    }
  } else {
    console.warn('[TC-122] GSS-DP: no resolved chain found — all blocks fall back to Pass 2');
  }

  // ═══ CGP (Containment Guard Point) — Pass 2.5 Quality Control ═══
  // Проверяет границы блоков после DP, ДО Section 4 и Pass 3.
  // Корректирует _lrcStartIdx для блоков с weak containment (первая LRC-строка
  // не совпадает с первой Genius-строкой). Логи только в DEV mode.
  const _GENIUS_FIRST_LINES: string[] = [];
  for (let bi = 0; bi < N; bi++) {
    const gl = (tagResult.blocks[bi]?.contentLines ?? []).filter((l: string) => l.trim());
    _GENIUS_FIRST_LINES.push(gl.length > 0 ? gl[0] : '');
  }

  function _containmentScore(geniusLine: string, lrcLine: string): number {
    const gNorm = _normalizeText(geniusLine);
    const lNorm = _normalizeText(lrcLine);
    const gWords = gNorm.split(/\s+/).filter(w => w.length > 2);
    const lWords = new Set(lNorm.split(/\s+/).filter(w => w.length > 2));
    if (gWords.length === 0) return 1;
    let match = 0;
    for (const w of gWords) if (lWords.has(w)) match++;
    return match / gWords.length;
  }

  if (import.meta.env.DEV) console.log('╔═══ CGP ═══');
  for (let bi = 0; bi < N; bi++) {
    const currentIdx = _lrcStartIdx[bi];
    const currentScore = _chosenMatchScore[bi];
    if (currentIdx == null || currentIdx < 0) {
      if (import.meta.env.DEV) console.log(`  Block ${bi} [${tagResult.blocks[bi]?.type ?? '?'}]: NOT MAPPED (skip)`);
      continue;
    }

    // CGP only checks blocks where DP was highly confident (rawScore ≈ 1.0).
    // Low rawScore means DP couldn't find a clean match — don't override.
    // §7 CANDIDATE: порог 0.9 не откалиброван — выведен из зазора между Outro (1.0) и MJ Intro (0.667).
    // Требует grid search (27 комбинаций) вместе с MIN_CANDIDATE_SCORE, SIGMA, UNIQUENESS_POWER.
    if (currentScore != null && currentScore < 0.9) {
      if (import.meta.env.DEV) console.log(`  Block ${bi} [${tagResult.blocks[bi]?.type ?? '?'}] "${tagResult.blocks[bi]?.label ?? ''}": low confidence (skip)`);
      continue;
    }

    const geniusFirst = _GENIUS_FIRST_LINES[bi];
    if (!geniusFirst) {
      if (import.meta.env.DEV) console.log(`  Block ${bi} [${tagResult.blocks[bi]?.type ?? '?'}]: empty Genius (skip)`);
      continue;
    }

    const currentLrcLine = displayLines[currentIdx];
    const contain = _containmentScore(geniusFirst, currentLrcLine);
    const isLowContain = contain < 0.6;

    // Search forward by positional scan over displayLines (FLCG/BVP spec: линейный проход, break на первом containment≥0.8)
    // НЕ используем allCandidates (top-K, upc-сортировка — может пропустить ближайший правильный кандидат)
    // Search bound: до следующего MAPPED блока (чтобы не украсть его первую строку)
    let nextBlockStart = displayLines.length;
    for (let nb = bi + 1; nb < N; nb++) {
      const ns = _lrcStartIdx[nb];
      if (ns != null && ns >= 0 && ns > currentIdx) {
        nextBlockStart = ns;
        break;
      }
    }
    const expectedLines = (tagResult.blocks[bi]?.contentLines ?? []).filter((l: string) => l.trim()).length;
    const maxSearchIdx = Math.min(currentIdx + 1 + Math.max(4, expectedLines * 2), nextBlockStart);
    let bestForwardIdx = -1;
    let bestForwardContain = 0;
    let bestForwardRawScore = 0;
    for (let idx = currentIdx + 1; idx < maxSearchIdx; idx++) {
      const candLrcLine = displayLines[idx];
      if (!candLrcLine?.trim()) continue;
      const candContain = _containmentScore(geniusFirst, candLrcLine);
      if (candContain >= 0.8) {
        // First adequate match — stop immediately (FLCG spec: "break on first containment ≥ 0.8")
        bestForwardIdx = idx;
        bestForwardContain = candContain;
        bestForwardRawScore = candContain;
        break;
      }
      if (candContain > bestForwardContain) {
        bestForwardContain = candContain;
        bestForwardIdx = idx;
        bestForwardRawScore = candContain;
      }
    }

    // CGP corrects when: (a) first line containment is weak, AND (b) a better forward candidate exists
    const wouldCorrect = isLowContain && bestForwardIdx >= 0 && bestForwardContain >= 0.6;

    if (wouldCorrect) {
      _lrcStartIdx[bi] = bestForwardIdx;
      _chosenMatchScore[bi] = bestForwardRawScore;
    }

    if (import.meta.env.DEV) {
      console.log(
        `  Block ${bi} [${tagResult.blocks[bi]?.type ?? '?'}] "${tagResult.blocks[bi]?.label ?? ''}":\n` +
        `    Genius first line: "${geniusFirst.substring(0, 60)}"\n` +
        `    Current LRC[${currentIdx}]="${currentLrcLine.substring(0, 60)}"\n` +
        `    currentScore=${currentScore != null ? currentScore.toFixed(3) : 'N/A'}  containment=${contain.toFixed(3)}\n` +
        `    forward search: ${bestForwardIdx >= 0 ? `LRC[${bestForwardIdx}]="${displayLines[bestForwardIdx].substring(0, 60)}" contain=${bestForwardContain.toFixed(3)} rawScore=${bestForwardRawScore.toFixed(3)}` : 'no candidate'}\n` +
        `    → ${wouldCorrect ? '🟡 CORRECTED: LRC[' + currentIdx + ']→LRC[' + bestForwardIdx + ']' : '✅ no-op'}`
      );
    }
  }
  if (import.meta.env.DEV) console.log('╚═══ END CGP ═══');
  
  // ── Применяем _lrcStartIdx / _matchScore к blocks[] ──
  for (let bi = 0; bi < N; bi++) {
    if (_lrcStartIdx[bi] !== null) {
      (blocks[bi] as any)._lrcStartIdx = _lrcStartIdx[bi];
      (blocks[bi] as any)._matchScore = _chosenMatchScore[bi];
    }
  }
  
  // 4. Assign LRC line ranges to blocks
  //    Block N owns lines from its startIdx to block N+1's startIdx
  let _prevChronoEnd = -1;  // DIAG-CHRONO tracker
  // ═══ TC-130: Occupied-Line Guard ═══
  // Предотвращает пересечение lineIndices при немонотонном startIdx.
  // Блоки, обработанные раньше, уже заняли некоторые LRC индексы.
  // Следующие блоки пропускают занятые.
  const occupied = new Set<number>();
  for (let i = 0; i < blocks.length; i++) {
    const startIdx = (blocks[i] as any)._lrcStartIdx;
    if (startIdx == null || startIdx < 0) continue;
    
    // DIAG-CHRONO: log chrono violations
    if (import.meta.env.DEV && startIdx < _prevChronoEnd) {
      console.warn(
        `[DIAG-CHRONO] Block ${i} [${blocks[i].type}] "${blocks[i].name}": ` +
        `startIdx=${startIdx} < prevEnd=${_prevChronoEnd} → CHRONO VIOLATION`
      );
    }
    
    // Find next block's start
    let endIdx = displayLines.length;
    for (let j = i + 1; j < blocks.length; j++) {
      const nextStart = (blocks[j] as any)._lrcStartIdx;
      // Fix C: Skip chrono-violated nextStart (< startIdx). Prevents blocks
      // from getting zero or negative range when a later block maps to an
      // earlier LRC line.
      if (nextStart != null && nextStart >= 0 && nextStart > startIdx) {
        endIdx = nextStart;
        break;
      }
    }
    
    blocks[i].lineIndices = [];
    // Fix D: Cap range to prevent blocks from taking too many lines
    // when adjacent blocks are NOT MAPPED (no startIdx boundary)
    // Fix D: Cap range to prevent blocks from taking too many lines
    // when adjacent blocks are NOT MAPPED (no startIdx boundary)
    // TC-141: Tight cap с минимальной эластичностью.
    // expectedLines — жёсткая граница. Блок с 8 строками НЕ может
    // съесть idx 8,9 (припев). +1 эластичность только для коротких блоков
    // (1 строка, ad-libs в LRC).
    const expectedLines = (blocks[i] as any)._expectedLines ?? 0;
    const elasticity = expectedLines <= 1 ? 1 : 0;  // только 1-строчные блоки
    const cappedEnd = expectedLines > 0
      ? Math.min(endIdx, startIdx + expectedLines + elasticity)
      : endIdx;
    for (let k = startIdx; k < cappedEnd; k++) {
      if (occupied.has(k)) continue;  // TC-130: skip already taken
      blocks[i].lineIndices.push(k);
      occupied.add(k);                // TC-130: mark as taken
    }
    
    // TC-010-FIX: Add contentLines for WagonTrain display
    // Guard: не перезаписываем contentLines если lineIndices пуст
    // (блок мог найти startIdx но не получить строк из-за коллизии)
    if (blocks[i].lineIndices.length > 0) {
      blocks[i].contentLines = blocks[i].lineIndices.map(
        (idx: number) => displayLines[idx]
      );
      _prevChronoEnd = Math.max(...blocks[i].lineIndices);
    }
  }

  // TC-6B: _oversized diagnostic flag (NOT a trim — nextStart logic is authoritative)
  // If a block got significantly more LRC lines than expected, mark it for diagnostics.
  for (let i = 0; i < blocks.length; i++) {
    const cl = blocks[i].contentLines;
    if (!cl || cl.length === 0) continue;
    if (blocks[i].lineIndices.length > Math.ceil(cl.length * 1.5)) {
      (blocks[i] as any)._oversized = true;
    }
  }

  // ═══ TC-BUG-03-B: Пасс 2 — позиционный fallback для NOT MAPPED блоков ═══
  // Для блоков, которые не удалось замапить на LRC строки (score < 0.5),
  // назначаем lineIndices на основе позиции между соседними MAPPED блоками.
  for (let i = 0; i < blocks.length; i++) {
    const startIdx = (blocks[i] as any)._lrcStartIdx;
    // Пропустить уже замапленные блоки (есть startIdx И lineIndices реально заполнены)
    if (startIdx != null && startIdx >= 0 && blocks[i].lineIndices.length > 0) continue;
    const blockContent = blocks[i].contentLines;
    // TC-6C: Don't skip Solo/Instrumental with empty content — they can take gap lines
    const isEmptySolo = blocks[i].type === 'solo' || blocks[i].type === 'instrumental';
    if (!blockContent || blockContent.length === 0) {
      if (!isEmptySolo) continue;
    }

    let neededLines: number;
    // TC-6C: Solo/Instrumental with no content take full gap
    if (isEmptySolo && (!blockContent || blockContent.length === 0)) {
      neededLines = 0;  // calculated after availableGap
    } else {
      neededLines = blockContent?.length ?? 0;
    }

    // Найти предыдущий блок с lineIndices
    let prevEnd = -1;
    for (let p = i - 1; p >= 0; p--) {
      if (blocks[p].lineIndices.length > 0) {
        prevEnd = Math.max(...blocks[p].lineIndices);
        break;
      }
    }

    // Найти следующий блок с lineIndices
    let nextStart = displayLines.length;
    let nextBlockIdx = -1;
    for (let n = i + 1; n < blocks.length; n++) {
      if (blocks[n].lineIndices.length > 0) {
        nextStart = Math.min(...blocks[n].lineIndices);
        nextBlockIdx = n;
        break;
      }
    }

    const availableGap = nextStart - (prevEnd + 1);
    // TC-6C: Empty Solo/Instrumental takes full available gap
    const isGapTakeAll = isEmptySolo && neededLines === 0;
    const effectiveNeeded = isGapTakeAll ? availableGap : neededLines;
    const takeFromGap = Math.min(effectiveNeeded, availableGap);

    if (takeFromGap > 0) {
      // Есть свободное окно между блоками — берём оттуда
      blocks[i].lineIndices = Array.from(
        { length: takeFromGap },
        (_, k) => prevEnd + 1 + k
      );
      // TC-6C: Mark gap-assigned Solo/Instrumental
      if (isEmptySolo) {
        (blocks[i] as any)._instrumentalGap = true;
      }
    }
    
    // Fix H1: sync contentLines after gap fill for blocks with empty content
    if (blocks[i].lineIndices.length > 0 && !blocks[i].contentLines?.length) {
      blocks[i].contentLines = blocks[i].lineIndices.map((idx: number) => displayLines[idx]);
    }
    
    // Если всё ещё не хватает строк — отнимаем от следующего блока с капом 50%
    const stillNeeded = isGapTakeAll ? 0 : neededLines - blocks[i].lineIndices.length;
    if (stillNeeded > 0 && nextBlockIdx >= 0) {
      const nextBlock = blocks[nextBlockIdx];
      // Fix C: Don't steal from correctly mapped blocks (score >= 0.5)
      const nextScore = (nextBlock as any)._matchScore || 0;
      if (nextScore < 0.5) {
        const cap = Math.floor(nextBlock.lineIndices.length * 0.5);
        const shiftFromNext = Math.min(stillNeeded, cap);

        if (shiftFromNext > 0) {
          // Забираем первые N строк следующего блока
          const stolen = nextBlock.lineIndices.splice(0, shiftFromNext);
          blocks[i].lineIndices.push(...stolen);
          // Обновляем contentLines следующего блока (без пересоздания)
          nextBlock.contentLines = nextBlock.lineIndices.map(
            (idx: number) => displayLines[idx]
          );
        }
      }
    }
  }

  // ═══ TC-BUG-03-B DIAG (убрать после верификации) ═══
  if (import.meta.env.DEV) {
    for (let di = 0; di < blocks.length; di++) {
      const b = blocks[di];
      const hasStart = (b as any)._lrcStartIdx;
      console.log(
        `[Pass2-DIAG] Block ${di} [${b.type}] "${b.name}": ` +
        `startIdx=${hasStart ?? 'null'}, lineIndices=${JSON.stringify(b.lineIndices)}`
      );
    }
  }

  // DEV diagnostics
  if (import.meta.env.DEV) {
    const found = blocks.filter(b => b.lineIndices.length > 0).length;
    const total = blocks.length;
    const linesWithBlocks = blocks.reduce((s, b) => s + b.lineIndices.length, 0);
    
    console.log(`[TC-010] Block-first sync:`);
    console.log(`  Display lines: ${displayLines.length} (from LRC)`);
    console.log(`  Markers: ${markers.length} (exact LRC timestamps)`);
    console.log(`  Blocks: ${found}/${total} mapped (${(found/total*100).toFixed(0)}%)`);
    console.log(`  Lines covered by blocks: ${linesWithBlocks}/${displayLines.length}`);
    
    for (let di = 0; di < blocks.length; di++) {
      const block = blocks[di];
      const startIdx = (block as any)._lrcStartIdx;
      const matchScore = (block as any)._matchScore;
      
      if (block.lineIndices.length > 0) {
        const first = block.lineIndices[0];
        const last = block.lineIndices[block.lineIndices.length - 1];
        const linesText = block.lineIndices.map((li: number) => `    LRC[${li}]="${displayLines[li]}"`).join('\n');
        const isGapAssign = (block as any)._instrumentalGap;
        console.log(
          `  ── Block ${di} [${block.type}] "${block.name}" ${isGapAssign ? '(gap-assigned)' : ''}──\n` +
          `  startIdx=${startIdx ?? 'null'} matchScore=${matchScore ? (matchScore*100).toFixed(0)+'%' : 'N/A'}\n` +
          `  range=${first}-${last} (${block.lineIndices.length} lines) time=${markers[first]?.time?.toFixed(1)}s-${markers[last]?.time?.toFixed(1)}s\n` +
          `  contentLines (Genius): ${((block as any).contentLines ?? []).slice(0, 3).join(' | ')}\n` +
          `  lineIndices (LRC text):\n${linesText.slice(0, 800)}`
        );
      } else {
        const geniusLines = ((block as any).contentLines ?? []).slice(0, 3);
        console.log(
          `  ── Block ${di} [${block.type}] "${block.name}" ──\n` +
          `  startIdx=${startIdx ?? 'null'} matchScore=${matchScore ? (matchScore*100).toFixed(0)+'%' : 'N/A'}\n` +
          `  NOT MAPPED — Genius lines: ${geniusLines.join(' | ')}`
        );
      }
    }
  }

  // ═══ PASS 3: Orphan Absorption (TC-094) ═══
  // Sweep-фаза: привязывает LRC-строки без блока (orphans)
  // к текстово-близкому MAPPED блоку.
  // TC-142: Content-Aware Orphan Routing — вместо "привяжи к предыдущему"
  // используем текстовое совпадение: orphan к блоку с максимальным word overlap.
  // Без TC-142: orphan "All I wanna say" привязался бы к Verse 1 (предыдущий),
  // и припев клеился бы к куплету.
  const indexToBlockMap = new Map<number, number>();
  for (let b = 0; b < blocks.length; b++) {
    for (const idx of blocks[b].lineIndices) {
      indexToBlockMap.set(idx, b);
    }
  }

  // ═══ TC-150: Structural Window Guard ═══
  // Снимок границ уже замапленных блоков ДО начала Pass 3. Намеренно статичный
  // (не пересчитывается по ходу цикла) — чтобы вся цепочка orphan'ов в одном
  // разрыве видела одно и то же окно, без дрейфа от собственных же присвоений.
  const mappedSnapshot: Array<{ bi: number; minIdx: number; maxIdx: number }> = [];
  for (let b = 0; b < blocks.length; b++) {
    if (blocks[b].lineIndices.length > 0) {
      mappedSnapshot.push({
        bi: b,
        minIdx: Math.min(...blocks[b].lineIndices),
        maxIdx: Math.max(...blocks[b].lineIndices),
      });
    }
  }

  // Для orphan-строки на LRC-индексе i возвращает диапазон СТРУКТУРНЫХ индексов
  // блоков (позиция в Genius-порядке), внутри которого contentmatch вообще
  // имеет право голоса.
  // loBi = структурный индекс ближайшего MAPPED-блока СЛЕВА от i (или 0, если нет).
  // hiBi = структурный индекс ближайшего MAPPED-блока СПРАВА от i (или последний, если нет).
  function findStructuralWindow(i: number): { loBi: number; hiBi: number } {
    // TC-150: orphan до ВСЕХ mapped-блоков → полный диапазон
    // (иначе окно коллапсирует на первом блоке, bi=0, и Chorus не виден)
    if (mappedSnapshot.length > 0) {
      const firstMappedMin = Math.min(...mappedSnapshot.map(m => m.minIdx));
      if (i < firstMappedMin) {
        return { loBi: 0, hiBi: blocks.length - 1 };
      }
    }

    let loBi = 0;
    let hiBi = blocks.length - 1;
    for (const m of mappedSnapshot) {
      if (m.maxIdx < i && m.bi > loBi) loBi = m.bi;
      if (m.minIdx > i && m.bi < hiBi) hiBi = m.bi;
    }
    if (loBi > hiBi) {
      if (import.meta.env.DEV) {
        console.warn(`[TC-150] window inversion at orphan i=${i}: loBi=${loBi} > hiBi=${hiBi}, сужаю до loBi`);
      }
      hiBi = loBi;
    }
    return { loBi, hiBi };
  }

  // TC-142 + TC-152: Precompute word sets для ВСЕХ блоков (включая NOT MAPPED).
  // Читаем ОРИГИНАЛЬНЫЙ Genius-текст из tagResult.blocks (НЕ blocks[b].contentLines,
  // который Section 4 строка 599 уже перезаписал на LRC-текст).
  // Без этого orphan "Never say goodbye" не находит Chorus 1.
  const blockWordSets: Map<number, Set<string>> = new Map();
  for (let b = 0; b < blocks.length; b++) {
    const contentLines = (tagResult.blocks[b]?.contentLines ?? []).filter((l: string) => l.trim());
    if (contentLines.length === 0) continue;
    const fpWords = new Set<string>();
    for (const cl of contentLines) {
      const norm = _normalizeText(cl);
      for (const w of norm.split(/\s+/)) {
        if (w.length > 2) fpWords.add(w);
      }
    }
    blockWordSets.set(b, fpWords);
  }

  let lastValidBlockIdx = -1;
  for (let i = 0; i < displayLines.length; i++) {
    if (indexToBlockMap.has(i)) {
      lastValidBlockIdx = indexToBlockMap.get(i)!;
      continue;
    }

    // TC-142 + TC-150: Content-aware orphan routing, ОГРАНИЧЕННЫЙ структурным окном
    const orphanNorm = _normalizeText(displayLines[i]);
    const orphanWords = new Set(orphanNorm.split(/\s+/).filter(w => w.length > 2));
    if (orphanWords.size > 0) {
      const { loBi, hiBi } = findStructuralWindow(i);   // ← TC-150: новая строка
      let bestBlock = lastValidBlockIdx;  // fallback: предыдущий
      let bestOverlap = 0;
      for (const [b, blockWords] of blockWordSets) {
        if (b < loBi || b > hiBi) continue;             // ← TC-150: новая строка (guard)
        let overlap = 0;
        for (const w of orphanWords) if (blockWords.has(w)) overlap++;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestBlock = b;
        } else if (overlap === bestOverlap && overlap > 0 && b === lastValidBlockIdx) {
          // TC-153: при равном overlap предпочесть lastValidBlockIdx
          // (принципиально, а не "первый по порядку итерации")
          bestBlock = b;
        }
      }

      if (bestBlock >= 0) {
        // ═══ TC-150-RT: Orphan routing trace ═══
        if (import.meta.env.DEV && bestBlock !== lastValidBlockIdx) {
          console.log(
            `[TC-150-RT] Orphan LRC[${i}]="${displayLines[i].substring(0, 50)}" ` +
            `window=[${loBi}..${hiBi}] ` +
            `contentMatch→bi=${bestBlock} ["${blocks[bestBlock].type}" "${blocks[bestBlock].name}"] ` +
            `overlap=${bestOverlap} ` +
            `\tfallback=${lastValidBlockIdx} ["${lastValidBlockIdx >= 0 ? blocks[lastValidBlockIdx].type + ' ' + blocks[lastValidBlockIdx].name : 'none'}"]`
          );
        } else if (import.meta.env.DEV) {
          console.log(
            `[TC-150-RT] Orphan LRC[${i}]="${displayLines[i].substring(0, 50)}" ` +
            `→ bi=${bestBlock} (${bestBlock === lastValidBlockIdx ? 'fallback' : 'content'}) overlap=${bestOverlap}`
          );
        }
        blocks[bestBlock].lineIndices.push(i);
        indexToBlockMap.set(i, bestBlock);
        continue;
      }

      // DEV: Log orphan with content words but no match
      if (import.meta.env.DEV) {
        console.log(
          `[TC-150-RT] Orphan LRC[${i}]="${displayLines[i].substring(0, 50)}" ` +
          `window=[${loBi}..${hiBi}] → NO_CONTENT_MATCH (lastValidBlockIdx=${lastValidBlockIdx})`
        );
      }
    }

    // DEV: Log filler orphan (no words → fallback to previous)
    if (import.meta.env.DEV) {
      console.log(
        `[TC-150-RT] Orphan LRC[${i}]="${displayLines[i].substring(0, 50)}" ` +
        `→ FILTER (no content words) lastValidBlockIdx=${lastValidBlockIdx}`
      );
    }

    // Fallback: attach to previous mapped block
    // (filler orphans with no meaningful words)
    if (lastValidBlockIdx !== -1) {
      blocks[lastValidBlockIdx].lineIndices.push(i);
      indexToBlockMap.set(i, lastValidBlockIdx);
    } else {
      // Before any mapped block — attach to first available
      for (let b = 0; b < blocks.length; b++) {
        if (blocks[b].lineIndices.length > 0) {
          blocks[b].lineIndices.push(i);
          indexToBlockMap.set(i, b);
          break;
        }
      }
    }
  }

  // Sort lineIndices + sync contentLines after orphan absorption
  // sort обязателен: orphans добавляются через push() в конец,
  // но могут оказаться перед старыми индексами (хронология!)
  for (let b = 0; b < blocks.length; b++) {
    if (blocks[b].lineIndices.length > 0) {
      blocks[b].lineIndices.sort((a, z) => a - z);
      blocks[b].contentLines = blocks[b].lineIndices.map((idx: number) => displayLines[idx]);
    }
  }

  // Clean up temp fields
  for (let i = 0; i < blocks.length; i++) {
    delete (blocks[i] as any)._lrcStartIdx;
    delete (blocks[i] as any)._matchScore;
    delete (blocks[i] as any)._expectedLines;  // TC-6A
    delete (blocks[i] as any)._isEmpty;         // TC-6A
    delete (blocks[i] as any)._oversized;        // TC-6B
    delete (blocks[i] as any)._instrumentalGap;   // TC-6C
  }
  
  return {
    markers,
    blocks,
    confidence: 1.0, // LRC timestamps are always exact
    lyricsLines: displayLines,
  };
}

/**
 * TC-009: Adjust marker time when Genius line starts MID-LRC.
 * If Genius first word appears at position N inside LRC fragment,
 * interpolate time forward instead of using LRC-start.
 */
function adjustMarkerTime(
  rawText: string,
  matchedLrcTime: number,
  matchedLrcText: string,
  nextLrcTime: number | null,
): number {
  const rawNorm = _normalizeText(rawText);
  const lrcNorm = _normalizeText(matchedLrcText);
  
  const rawWords = rawNorm.split(/\s+/).filter(w => w);
  const lrcWords = lrcNorm.split(/\s+/).filter(w => w);
  
  if (rawWords.length === 0 || lrcWords.length === 0) return matchedLrcTime;
  
  // Find position of first Genius word in LRC
  const firstWord = rawWords[0];
  const positionInLrc = lrcWords.indexOf(firstWord);
  
  // Not found or starts at beginning → no adjustment
  if (positionInLrc <= 0) return matchedLrcTime;
  
  // Interpolate time
  const fraction = positionInLrc / lrcWords.length;
  const duration = nextLrcTime ? nextLrcTime - matchedLrcTime : 4.0;
  const adjustedTime = matchedLrcTime + fraction * duration;
  
  if (import.meta.env.DEV) {
    console.log(
      `[TC-009] Word-pos ${positionInLrc}/${lrcWords.length}: ` +
      `${matchedLrcTime.toFixed(2)}s → ${adjustedTime.toFixed(2)}s ` +
      `(+${(adjustedTime - matchedLrcTime).toFixed(2)}s) "${rawText.substring(0, 40)}"`
    );
  }
  
  return adjustedTime;
}

export function matchGeniusToLrc(
  geniusText: string,
  lrcResult: LrcResult,
): MatchResult {
  const geniusLines = geniusText.split('\n');

  // Парсим блоки из Genius тегов (parseTaggedLyrics — pure TS, без React/DOM)
  const tagResult = parseTaggedLyrics(geniusText);
  const hasStructure = tagResult.hasStructure && tagResult.blocks.length >= 1;

  // ── BUILD rawLyricsArray + blocks directly from tagResult.blocks ──
  // M2: no separator lines — M2 closing marker replaces separator lines.
  // Block lineIndices are built in RAW space during construction — no mapping needed.
  const rawLyricsArray: string[] = [];
  const blocks: PersistedTextBlock[] = hasStructure
    ? tagResult.blocks.map((b, bi) => {
        const lineIndices: number[] = [];
        for (const contentLine of b.contentLines) {
          const trimmed = contentLine.trim();
          if (!trimmed) continue;
          lineIndices.push(rawLyricsArray.length);
          rawLyricsArray.push(trimmed);
        }
        return {
          id: `auto-block-${bi}`,
          name: `Block ${bi + 1}`,
          lineIndices,
          type: b.type,
        };
      })
    : [];

  // Total non-empty lines (for confidence denominator)
  const rawLineCount = rawLyricsArray.filter(l => l !== '').length;

  // ── Pre-normalize ALL strings ONCE (avoid re-normalizing in hot loop) ──
  const normalizedRaw = rawLyricsArray.map(s => _normalizeText(s));
  const normalizedLrc = lrcResult.lines.map(l => _normalizeText(l.text));

  // ── Time-distance matching constants ──
  // totalRaw = total lines (no separators in M2 system)
  const totalRaw = Math.max(1, rawLyricsArray.length);
  // lastLrcTime = time of last LRC line WITH text (not track duration)
  const lastLrcTime = Math.max(1,
    lrcResult.lines.filter(l => l.text.trim()).slice(-1)[0]?.time ?? 1
  );
  const TIME_PENALTY_FACTOR = 0.5; // coefficient for distance penalty

  // ── Forward-first fuzzy match LRC → rawLyricsArray ──
  // Direct matching in RAW space — NO cleanLines/cleanToRaw mapping needed.
  // Forward-first preserves song order (chorus #1 before chorus #2).
  // LRC merge: when a single LRC line fails (score < 0.75), merge with next
  // LRC line and retry — handles LRC split-lines vs Genius whole lines.
  // TIME-DISTANCE PENALTY: prevents distant raw lines from stealing LRC times
  // (e.g., outro chorus stealing verse chorus time). effectiveScore = textScore - penalty.

  const markers: PersistedSyncMarker[] = [];
  const matchedRawIndices = new Set<number>();
  const usedLrcTimes = new Set<number>();  // TC-004: Track used LRC times to prevent duplicates
  let searchStart = 0;
  let matchedCount = 0;
  const t0 = import.meta.env.DEV ? performance.now() : 0;

  for (let li = 0; li < lrcResult.lines.length; li++) {
    const lrcLine = lrcResult.lines[li];
    if (!lrcLine.text.trim()) continue;

    let bestScore = 0;
    let bestRawIdx = -1;
    let bestEffective = 0;
    let mergedNorm = normalizedLrc[li];
    let mergedCount = 1; // how many LRC lines merged
    let mergedTime = lrcLine.time;

    // Expected raw position based on LRC time (linear interpolation)
    const expectedIdx = Math.round((mergedTime / lastLrcTime) * totalRaw);

    // Try matching: first as single line, then merged with next line(s)
    for (let attempt = 0; attempt < 3; attempt++) {  // TC-008: Allow 3-line merge
      bestScore = 0;
      bestRawIdx = -1;
      bestEffective = 0;

      // Pass 1: Forward-first search — take FIRST match with effectiveScore >= 0.75
      for (let i = searchStart; i < normalizedRaw.length; i++) {
        if (rawLyricsArray[i] === '') continue;
        if (matchedRawIndices.has(i)) continue;
        const score = _similarityNormalized(mergedNorm, normalizedRaw[i]);
        const timePenalty = (Math.abs(i - expectedIdx) / totalRaw) * TIME_PENALTY_FACTOR;
        const effective = score - timePenalty;
        if (effective >= 0.75) {
          bestScore = score;
          bestRawIdx = i;
          bestEffective = effective;
          break;
        }
      }

      // Pass 2: Global fallback (best-effective) — only if forward found nothing >= 0.75
      if (bestEffective < 0.75) {
        for (let i = 0; i < searchStart; i++) {
          if (rawLyricsArray[i] === '') continue;
          if (matchedRawIndices.has(i)) continue;
          const score = _similarityNormalized(mergedNorm, normalizedRaw[i]);
          const timePenalty = (Math.abs(i - expectedIdx) / totalRaw) * TIME_PENALTY_FACTOR;
          const effective = score - timePenalty;
          if (effective > bestEffective) {
            bestScore = score;
            bestRawIdx = i;
            bestEffective = effective;
          }
        }
      }

      if (bestEffective >= 0.75) break; // matched!

      // Not matched — try merging with next LRC line (max 3 lines)
      if (attempt < 2 && li + 1 + attempt < lrcResult.lines.length) {
        const nextLrc = lrcResult.lines[li + 1 + attempt];
        if (nextLrc.text.trim()) {
          mergedNorm = mergedNorm + ' ' + normalizedLrc[li + 1 + attempt];
          mergedCount = 2 + attempt;
          continue; // retry with merged text
        }
      }
      break; // no match even with merge
    }

    if (bestEffective >= 0.75 && bestRawIdx >= 0) {
      matchedRawIndices.add(bestRawIdx);
      usedLrcTimes.add(mergedTime);  // TC-004: Track this LRC time as used
      searchStart = bestRawIdx + 1; // always advance
      matchedCount++;

      // TC-009: Adjust time based on word position within LRC fragment
      const nextLrcTime = li + mergedCount < lrcResult.lines.length 
        ? lrcResult.lines[li + mergedCount].time 
        : null;
      const adjustedTime = adjustMarkerTime(
        rawLyricsArray[bestRawIdx], mergedTime, 
        lrcResult.lines[li].text, nextLrcTime
      );

      markers.push({
        id: `${Date.now()}-${bestRawIdx}-${Math.random().toString(36).substr(2, 5)}`,
        lineIndex: bestRawIdx,
        time: adjustedTime,  // TC-009: WAS mergedTime
        text: rawLyricsArray[bestRawIdx],
      });

      // Skip consumed LRC lines (if merged)
      if (mergedCount > 1) li += mergedCount - 1;
    }
  }

  if (import.meta.env.DEV) {
    const elapsed = (performance.now() - t0).toFixed(1);
    console.log(`[AutoLyrics] matching took ${elapsed}ms`);
  }

  // ── RESCUE PASS: time-constrained match for remaining unmatched raw lines ──
  // After main forward-first loop, some raw lines may be skipped even though
  // a valid LRC match exists (e.g., forward-first passed them by, or threshold
  // was borderline). Rescue pass gives them a second chance at lower threshold.
  // CRITICAL: Search is time-constrained — only LRC lines within ±15s of the
  // expected time (interpolated from neighboring matched markers). This prevents
  // chorus/verse lines from stealing LRC times from the wrong song position.
  const RESCUE_THRESHOLD = 0.55;
  const RESCUE_WINDOW_SEC = 15;
  const unmatchedRaw = rawLyricsArray
    .map((text, idx) => ({ text, idx }))
    .filter(({ text, idx }) => text !== '' && !matchedRawIndices.has(idx));

  if (unmatchedRaw.length > 0) {
    // Sort markers by lineIndex for time interpolation
    const byLine = [...markers].filter(m => m.markerType !== 'M2').sort((a, b) => a.lineIndex - b.lineIndex);
    const lastLrcTime = lrcResult.lines.length > 0 ? lrcResult.lines[lrcResult.lines.length - 1].time : 0;

    for (const { idx: rawIdx, text: rawText } of unmatchedRaw) {
      // Interpolate expected time from neighboring matched markers
      let timeBefore = 0;
      let timeAfter = lastLrcTime;
      for (const m of byLine) {
        if (m.lineIndex < rawIdx) timeBefore = m.time;
        if (m.lineIndex > rawIdx) { timeAfter = m.time; break; }
      }
      const expectedTime = (timeBefore + timeAfter) / 2;

      let bestScore = 0;
      let bestTime = -1;
      for (let li = 0; li < lrcResult.lines.length; li++) {
        const lrcLine = lrcResult.lines[li];
        if (!lrcLine.text.trim()) continue;
        // Time constraint: only search within window of expected time
        if (Math.abs(lrcLine.time - expectedTime) > RESCUE_WINDOW_SEC) continue;
        // TC-004: Skip LRC times already used by other markers
        if (usedLrcTimes.has(lrcLine.time)) continue;
        const score = _similarityNormalized(normalizedRaw[rawIdx], normalizedLrc[li]);
        // TC-004: Prefer closest time when scores are equal (not just first match)
        if (score > bestScore ||
            (score === bestScore && bestTime >= 0 && Math.abs(lrcLine.time - expectedTime) < Math.abs(bestTime - expectedTime))) {
          bestScore = score;
          bestTime = lrcLine.time;
        }
      }

      if (bestScore >= RESCUE_THRESHOLD && bestTime >= 0) {
        matchedRawIndices.add(rawIdx);
        usedLrcTimes.add(bestTime);  // TC-004: Track this LRC time as used
        matchedCount++;
        
        // TC-009: Adjust time based on word position for rescue markers
        const matchedLrcIdx = lrcResult.lines.findIndex(l => l.time === bestTime);
        const nextLrcTime = matchedLrcIdx >= 0 && matchedLrcIdx + 1 < lrcResult.lines.length
          ? lrcResult.lines[matchedLrcIdx + 1].time
          : null;
        const adjustedTime = adjustMarkerTime(
          rawText, bestTime,
          matchedLrcIdx >= 0 ? lrcResult.lines[matchedLrcIdx].text : rawText,
          nextLrcTime
        );
        
        markers.push({
          id: `rescue-${Date.now()}-${rawIdx}-${Math.random().toString(36).substr(2, 5)}`,
          lineIndex: rawIdx,
          time: adjustedTime,  // TC-009: WAS bestTime
          text: rawText,
        });
        if (import.meta.env.DEV) {
          console.log(`[AutoLyrics] rescued [${rawIdx}] score=${(bestScore * 100).toFixed(1)}% expected=${expectedTime.toFixed(1)}s → "${rawText}"`);
        }
      }
    }
  }

  // ── PASS 3: Word-Coverage Matching for N:M Line Break Mismatch (TC-008B) ──
  // After rescue pass, some lines may still be unmatched due to N:M line breaks
  // (Genius combined lines vs LRC split lines). Word-coverage scoring checks if
  // a sequence of LRC lines covers the words of a Genius line.
  const COVERAGE_THRESHOLD = 0.75;
  const EXTRA_PENALTY = 0.5; // penalty for extra words from adjacent LRC lines

  // Get still-unmatched lines after rescue pass
  const stillUnmatched = rawLyricsArray
    .map((text, idx) => ({ text, idx }))
    .filter(({ text, idx }) => text !== '' && !matchedRawIndices.has(idx));

  if (stillUnmatched.length > 0) {
    const byLine = [...markers].filter(m => m.markerType !== 'M2').sort((a, b) => a.lineIndex - b.lineIndex);
    const lastLrcTime = lrcResult.lines.length > 0 ? lrcResult.lines[lrcResult.lines.length - 1].time : 0;

    for (const { idx: rawIdx, text: rawText } of stillUnmatched) {
      // Interpolate expected time from neighboring matched markers
      let timeBefore = 0;
      let timeAfter = lastLrcTime;
      for (const m of byLine) {
        if (m.lineIndex < rawIdx) timeBefore = m.time;
        if (m.lineIndex > rawIdx) { timeAfter = m.time; break; }
      }
      const expectedTime = (timeBefore + timeAfter) / 2;
      const expectedLrcIdx = Math.round((expectedTime / lastLrcTime) * normalizedLrc.length);

      let bestCoverage = 0;
      let bestStartTime = -1;

      // Search ±10 LRC lines from expected position
      const searchRadius = 10;
      const searchStart = Math.max(0, expectedLrcIdx - searchRadius);
      const searchEnd = Math.min(normalizedLrc.length, expectedLrcIdx + searchRadius);

      const geniusWords = new Set(normalizedRaw[rawIdx].split(/\s+/).filter(w => w));

      for (let start = searchStart; start < searchEnd; start++) {
        // Progressive merge: add LRC lines until coverage stops improving
        const coveredWords = new Set<string>();
        const allLrcWords = new Set<string>();

        for (let end = start; end < Math.min(start + 5, normalizedLrc.length); end++) {
          const lrcWords = normalizedLrc[end].split(/\s+/).filter(w => w);
          lrcWords.forEach(w => {
            allLrcWords.add(w);
            if (geniusWords.has(w)) coveredWords.add(w);
          });

          const coverage = geniusWords.size > 0 ? coveredWords.size / geniusWords.size : 0;
          const extraRatio = allLrcWords.size > 0
            ? [...allLrcWords].filter(w => !geniusWords.has(w)).length / allLrcWords.size
            : 0;
          const score = coverage - extraRatio * EXTRA_PENALTY;

          if (score > bestCoverage) {
            bestCoverage = score;
            bestStartTime = lrcResult.lines[start].time;
          }

          // Stop if coverage is complete
          if (coverage >= 0.9) break;
        }
      }

      if (bestCoverage >= COVERAGE_THRESHOLD && bestStartTime >= 0) {
        matchedRawIndices.add(rawIdx);
        usedLrcTimes.add(bestStartTime);  // TC-004: Track this LRC time as used
        matchedCount++;
        
        // TC-009: Adjust time based on word position for word-coverage markers
        const matchedLrcIdx = lrcResult.lines.findIndex(l => l.time === bestStartTime);
        const nextLrcTime = matchedLrcIdx >= 0 && matchedLrcIdx + 1 < lrcResult.lines.length
          ? lrcResult.lines[matchedLrcIdx + 1].time
          : null;
        const adjustedTime = adjustMarkerTime(
          rawText, bestStartTime,
          matchedLrcIdx >= 0 ? lrcResult.lines[matchedLrcIdx].text : rawText,
          nextLrcTime
        );
        
        markers.push({
          id: `wcoverage-${Date.now()}-${rawIdx}-${Math.random().toString(36).substr(2, 5)}`,
          lineIndex: rawIdx,
          time: adjustedTime,  // TC-009: WAS bestStartTime
          text: rawText,
        });
        if (import.meta.env.DEV) {
          console.log(`[AutoLyrics] word-coverage [${rawIdx}] score=${(bestCoverage * 100).toFixed(1)}% expected=${expectedTime.toFixed(1)}s → "${rawText}"`);
        }
      }
    }
  }

  // Safety: ensure markers are in time order (LRC is sorted, but global fallback may disorder)
  markers.sort((a, b) => a.time - b.time);

  // Confidence: matched lines / total non-empty lines
  const confidence = rawLineCount > 0 ? matchedCount / rawLineCount : 0;

  // DEV: Log unmatched rawLyricsArray lines (grey lines in UI)
  if (import.meta.env.DEV) {
    const unmatched = rawLyricsArray
      .map((text, idx) => ({ text, idx }))
      .filter(({ text, idx }) => text !== '' && !matchedRawIndices.has(idx));
    if (unmatched.length > 0) {
      const diag = unmatched.map(u => {
        // Find best LRC match score for diagnostic
        let bestLrcScore = 0;
        let bestLrcIdx = -1;
        for (let li = 0; li < normalizedLrc.length; li++) {
          const score = _similarityNormalized(normalizedRaw[u.idx], normalizedLrc[li]);
          if (score > bestLrcScore) { bestLrcScore = score; bestLrcIdx = li; }
        }
        return `[${u.idx}] best=${(bestLrcScore * 100).toFixed(1)}% vs LRC[${bestLrcIdx}] → "${u.text}"`;
      });
      console.warn(
        `[AutoLyrics] ${unmatched.length} unmatched lines:`,
        diag,
      );
    }
  }

  // ── AUTO-CREATE M2 CLOSING MARKERS (with transition zone threshold) ──

  // DEV: Dump block 6 diagnostics (contains line 32 - "And I'm about to break")
  if (import.meta.env.DEV) {
    const block6 = blocks.find(b => b.id === 'auto-block-6');
    if (block6) {
      console.log(`[AutoM2-DIAG] Block 6 lines: ${block6.lineIndices.join(',')}`);
      for (const li of block6.lineIndices) {
        const marker = markers.find(m => m.markerType !== 'M2' && m.lineIndex === li);
        const text = rawLyricsArray[li] || 'N/A';
        console.log(`[AutoM2-DIAG]   Line ${li}: ${marker ? `MARKED at ${marker.time.toFixed(2)}s` : 'NO MARKER ← BUG!'} → "${text}"`);
      }
    }
    // Also show what lrclib has for "And I'm about to break"
    const lrclibBreak = lrcResult.lines.filter(l => l.text.includes('about to break'));
    console.log(`[AutoM2-DIAG] lrclib "about to break" lines:`, lrclibBreak.map(l => ({time: l.time, text: l.text})));
  }

  // DEV: Dump block 7 diagnostics (contains line 37)
  if (import.meta.env.DEV) {
    const block7 = blocks.find(b => b.id === 'auto-block-7');
    if (block7) {
      console.log(`[AutoM2-DIAG] Block 7 lines: ${block7.lineIndices.join(',')}`);
      for (const li of block7.lineIndices) {
        const marker = markers.find(m => m.markerType !== 'M2' && m.lineIndex === li);
        const text = rawLyricsArray[li] || 'N/A';
        console.log(`[AutoM2-DIAG]   Line ${li}: ${marker ? `MARKED at ${marker.time.toFixed(2)}s` : 'NO MARKER'} → "${text}"`);
      }
    }
  }

  const autoM2Count = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const nextBlock = blocks[i + 1] ?? null;

    if (!block.lineIndices.length) continue;

    const lastLine = Math.max(...block.lineIndices);
    const lastMarker = markers.find(
      m => m.markerType !== 'M2' && m.lineIndex === lastLine
    );
    if (!lastMarker) continue;

    // Calculate avgGap within this block
    const blockMarkers = block.lineIndices
      .map(li => markers.find(m => m.markerType !== 'M2' && m.lineIndex === li))
      .filter((m): m is PersistedSyncMarker => !!m)
      .sort((a, b) => a.time - b.time);

    let avgGap = 3.5; // default fallback
    if (blockMarkers.length >= 2) {
      const gaps = blockMarkers.slice(1).map((m, j) => m.time - blockMarkers[j].time);
      avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    }

    // Check if gap is large enough for M2 (transition zone threshold)
    let shouldCreateM2 = false;
    let gapToNext = 0;
    if (nextBlock && nextBlock.lineIndices.length) {
      const firstLineNext = Math.min(...nextBlock.lineIndices);
      const firstMarkerNext = markers.find(
        m => m.markerType !== 'M2' && m.lineIndex === firstLineNext
      );
      if (firstMarkerNext) {
        gapToNext = firstMarkerNext.time - lastMarker.time;
        shouldCreateM2 = gapToNext > avgGap * 1.5 && gapToNext > 2.0;
      }
    } else {
      // Last block — always create M2
      shouldCreateM2 = true;
    }

    if (import.meta.env.DEV) {
      console.log(`[AutoM2] Block ${block.id} (lines ${block.lineIndices.join(',')}): avgGap=${avgGap.toFixed(1)}s, gapToNext=${gapToNext.toFixed(1)}s, shouldCreate=${shouldCreateM2}`);
    }

    if (!shouldCreateM2) continue;

    // M2 time = after last vocal + buffer
    const m2Time = lastMarker.time + avgGap * 1.2;

    // Create M2 marker
    markers.push({
      id: `m2-auto-${block.id}-${Date.now()}`,
      lineIndex: -1,
      time: m2Time,
      text: ']',
      markerType: 'M2',
      afterBlockId: block.id,
      isSuggested: true,
      color: '#1a1a1a',
      blockType: 'closing',
    });

    if (import.meta.env.DEV) {
      console.log(`[AutoM2] Created M2 for block ${block.id} at ${m2Time.toFixed(2)}s`);
    }
  }

  // ── VALIDATION: All M1 markers must reference valid rawLyricsArray indices ──
  const allM1InBounds = markers
    .filter(m => m.markerType !== 'M2')
    .every(m => m.lineIndex >= 0 && m.lineIndex < rawLyricsArray.length);

  if (!allM1InBounds && import.meta.env.DEV) {
    const outOfBounds = markers
      .filter(m => m.markerType !== 'M2' && (m.lineIndex < 0 || m.lineIndex >= rawLyricsArray.length))
      .map(m => ({ lineIndex: m.lineIndex, text: m.text, time: m.time }));
    console.error('[AutoLyrics] MARKERS OUT OF BOUNDS:', outOfBounds);
  }

  return { markers, blocks, confidence, lyricsLines: rawLyricsArray };
}

/**
 * Extract clean lyrics from Genius text — IDENTICAL to rawLyricsArray construction.
 * Uses parseTaggedLyrics to ensure 1:1 index alignment with markers.
 * This is the SINGLE SOURCE OF TRUTH for what track.lyrics should contain.
 */
export function extractCleanLyrics(geniusText: string): string[] {
  const tagResult = parseTaggedLyrics(geniusText);
  if (tagResult.hasStructure && tagResult.blocks.length > 0) {
    const lines: string[] = [];
    for (const block of tagResult.blocks) {
      for (const contentLine of block.contentLines) {
        const trimmed = contentLine.trim();
        if (trimmed) lines.push(trimmed);
      }
    }
    return lines;
  }
  // No structure (plain text without bracket tags) → simple split
  return geniusText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

/**
 * TC-ZIP-03: Convert DetectedBlock[] (from parseTaggedLyrics) into PersistedTextBlock[]
 * without LRC timing. Used when user pastes tagged lyrics but lrclib has no match.
 *
 * Maps each block's contentLines to indices in cleanLyricLines by forward text search.
 */
export function detectedBlocksToPersistedBlocks(
  detectedBlocks: DetectedBlock[],
  cleanLyricLines: string[],
): PersistedTextBlock[] {
  const result: PersistedTextBlock[] = [];
  let cursor = 0;

  for (let i = 0; i < detectedBlocks.length; i++) {
    const block = detectedBlocks[i];
    const contentLines = block.contentLines.filter(l => l.trim());
    const lineIndices: number[] = [];

    for (const line of contentLines) {
      const trimmed = line.trim();
      // Search forward from cursor for robustness against duplicate lines
      const idx = cleanLyricLines.indexOf(trimmed, cursor);
      if (idx !== -1) {
        lineIndices.push(idx);
        cursor = idx + 1;
      }
    }

    result.push({
      id: `auto-block-${i}-${Date.now()}`,
      name: block.label,
      lineIndices,
      type: block.type,
      contentLines,
      originalTag: block.originalTag,
      instrument: block.instrument,
      reviewRequired: block.reviewRequired,
      taxonomyVersion: TAXONOMY_VERSION,
    });
  }

  // ZIP-DIAG: Log first 2 blocks for diagnostic verification
  if (import.meta.env.DEV) {
    console.log('[ZIP-DIAG] detectedBlocksToPersistedBlocks:', {
      inputBlocks: detectedBlocks.length,
      cleanLines: cleanLyricLines.length,
      outputBlocks: result.length,
      firstBlock: result[0] ? {
        name: result[0].name,
        lineIndices: result[0].lineIndices.slice(0, 5),
        type: result[0].type,
      } : null,
      secondBlock: result[1] ? {
        name: result[1].name,
        lineIndices: result[1].lineIndices.slice(0, 5),
        type: result[1].type,
      } : null,
      mismatches: result.filter(b => b.lineIndices.length === 0).length,
    });
  }

  return result;
}

export function markAutoSyncApplied(trackId: number): void {
  _autoSyncedTrackId = trackId;
}

export function shouldSkipEditorsForTrack(trackId: number): boolean {
  if (_autoSyncedTrackId === trackId) {
    _autoSyncedTrackId = null; // сбрасываем после первого использования
    return true;
  }
  return false;
}

// Backward compatibility aliases (для существующих вызовов)
export function shouldSkipBlockEditor(): boolean {
  return false; // больше не используется — всегда через shouldSkipEditorsForTrack
}

export function shouldSkipSyncEditor(): boolean {
  return false; // больше не используется — всегда через shouldSkipEditorsForTrack
}

// ── Internal ───────────────────────────────────────────

function _cacheKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[-–—]\s*/g, ' - ') // нормализуем все типы дефисов
    .trim();
}

/**
 * TC-010-FIX3: Use search API to find BEST LRC version
 * /api/get returns wrong version (201s) — need search to pick correct duration match (203s)
 */
async function _fetchLrclib(
  artist: string,
  track: string,
  duration?: number,
): Promise<void> {
  const key = _cacheKey(`${artist} - ${track}`);
  try {
    // Use search API to find the BEST version
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(artist + ' ' + track)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'beLive/1.0' },
      signal: AbortSignal.timeout(30000),
    });

    if (!searchRes.ok) {
      // Fallback to old API
      await _fetchLrclibFallback(artist, track, duration);
      return;
    }

    const results = await searchRes.json();
    if (!Array.isArray(results) || results.length === 0) {
      await _fetchLrclibFallback(artist, track, duration);
      return;
    }

    // Filter to synced versions only
    const synced = results.filter((r: any) => r.syncedLyrics);
    if (synced.length === 0) {
      await _fetchLrclibFallback(artist, track, duration);
      return;
    }

    // Pick version with duration closest to our track
    let best = synced[0];
    if (duration) {
      let bestDiff = Math.abs((best.duration || 0) - duration);
      for (let i = 1; i < synced.length; i++) {
        const diff = Math.abs((synced[i].duration || 0) - duration);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = synced[i];
        }
      }
    }

    const lines = _parseLrc(best.syncedLyrics);
    _cache.set(key, {
      lines,
      rawSynced: best.syncedLyrics,
      fetchedAt: Date.now(),
      sourceId: best.id,
      duration: duration || undefined,
      versionDuration: best.duration || undefined,  // TC-096-FIX: lrclib version's reported duration
    });

    if (import.meta.env.DEV) {
      console.log(
        `[AutoLyrics] Selected LRC: id=${best.id} duration=${best.duration}s ` +
        `(requested=${duration ?? '?'}s, ` +
        `diff=${Math.abs((best.duration || 0) - (duration || 0)).toFixed(1)}s, ` +
        `${synced.length} synced versions available)`
      );
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[AutoLyrics] search failed, trying fallback:`, (e as Error)?.message);
    }
    await _fetchLrclibFallback(artist, track, duration);
  }
}

/**
 * TC-LRCPICKER-01: Fetch ALL matching synced LRC versions from lrclib.
 * Returns array sorted by score (best first).
 * Used by LRC Version Picker UI.
 */
export async function fetchLrcVersions(
  artist: string,
  title: string,
  trackDurationSec: number,
): Promise<LrcVersion[]> {
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://lrclib.net/api/search?q=${q}`);
    if (!res.ok) {
      console.warn(`[LRC-Picker] lrclib search failed: ${res.status}`);
      return [];
    }
    const results = await res.json();

    if (!Array.isArray(results)) return [];

    // Filter: must have syncedLyrics, duration within ±5s
    const synced = results.filter((r: any) =>
      r.syncedLyrics &&
      !r.instrumental &&
      Math.abs((r.duration || 0) - trackDurationSec) <= 5
    );

    // Score: duration proximity + line count
    const versions: LrcVersion[] = synced.map((r: any) => {
      const durationDelta = Math.abs((r.duration || 0) - trackDurationSec);
      const lineCount = (r.syncedLyrics || '').split('\n').filter(
        (l: string) => /^\[\d/.test(l)
      ).length;

      // Score: closer duration = better, more lines = slightly better
      const durationScore = Math.max(0, 10 - durationDelta * 2);
      const lineScore = Math.min(5, lineCount / 10);
      const score = durationScore + lineScore;

      return {
        id: r.id || 0,
        artistName: r.artistName || artist,
        trackName: r.trackName || r.name || title,
        duration: r.duration || 0,
        durationDelta,
        lineCount,
        lrcText: r.syncedLyrics,
        score,
      };
    });

    // Sort: best score first
    versions.sort((a, b) => b.score - a.score);

    console.log(
      `[LRC-Picker] Found ${versions.length} versions ` +
      `for "${artist} — ${title}" (${trackDurationSec}s)`
    );

    return versions;
  } catch (e) {
    console.warn('[LRC-Picker] fetch failed:', e);
    return [];
  }
}

/**
 * TC-LRCPICKER-01: Parse an LRC version and return markers + blocks.
 * Reuses existing parseLrcString() + blockFirstLineSync().
 */
// TC-123: Text-hash cache for parseLrcVersion — identical text = identical result,
// even if timestamps differ. Prevents UI flicker when switching between LRC
// versions with the same lyrics text but different timings.
const _parseLrcCache = new Map<string, MatchResult>();

export function parseLrcVersion(
  version: LrcVersion,
  geniusText?: string,  // optional: Genius text for block structure
): MatchResult {
  // Build cache key from text only (not timestamps)
  const cacheKey = `${geniusText ?? ''}||${version.lrcText}`;
  const cached = _parseLrcCache.get(cacheKey);
  if (cached) return cached;

  const lrcResult = parseLrcString(version.lrcText);

  let result: MatchResult;
  if (geniusText) {
    // Genius provides block structure → better TrackMap
    result = blockFirstLineSync(geniusText, lrcResult);
  } else {
    // No Genius → markers only, no blocks
    const { markers, lyricsLines } = lrcToMarkers(lrcResult);
    result = { markers, blocks: [], confidence: 1.0, lyricsLines };
  }

  _parseLrcCache.set(cacheKey, result);
  return result;
}

/**
 * TC-096-02: Compute coverage of first N structural blocks.
 * Coverage = mapped blocks / CHECK_BLOCKS (default 3: Intro + Verse 1 + Chorus 1).
 * Если Intro не маппится, coverage падает ниже порога → триггер re-selection.
 */
export function computeCoverage(
  blocks: { lineIndices: number[] }[],
  checkBlocks: number = 3,
): number {
  if (!blocks || blocks.length === 0) return 0;
  const head = blocks.slice(0, checkBlocks);
  const mapped = head.filter(b => b.lineIndices && b.lineIndices.length > 0).length;
  return mapped / checkBlocks;
}

/**
 * TC-096-02: Try next-best LRC version when coverage of first N blocks is low.
 *
 * MAX 1 RETRY. Сравнение версий по sourceId, не по сырому тексту.
 * Длительность трека из кэша (реальная), fallback на LRC timestamp.
 */
export async function tryBetterLrcVersion(
  geniusText: string,
  currentLrc: {
    rawSynced: string;
    lines: { time: number }[];
    sourceId?: number;
    duration?: number;
    versionDuration?: number;  // TC-096-FIX: lrclib version's reported duration
  },
  currentMatchResult: { blocks: { lineIndices: number[] }[]; confidence: number },
  artist: string,
  track: string,
): Promise<{ version: LrcVersion; matchResult: MatchResult } | null> {
  const CHECK_BLOCKS = 3;
  const COVERAGE_THRESHOLD = 0.75;
  const MIN_CONFIDENCE = 0.5;

  // 1. Если coverage уже хороший — retry не нужен
  if (computeCoverage(currentMatchResult.blocks, CHECK_BLOCKS) >= COVERAGE_THRESHOLD) return null;

  // 2. Guard: низкий confidence = плохой Genius, не LRC проблема
  if (currentMatchResult.confidence < MIN_CONFIDENCE) return null;

  // 3. Реальная длительность: track duration → version's API duration → LRC timestamp → 0
  //    priority: currentLrc.duration (real track) → currentLrc.versionDuration (version's API duration)
  //    → last LRC timestamp → 0
  const trackDuration = currentLrc.duration
    ?? currentLrc.versionDuration
    ?? (currentLrc.lines.length > 0 ? currentLrc.lines[currentLrc.lines.length - 1].time : 0);
  const allVersions = await fetchLrcVersions(artist, track, trackDuration);
  if (allVersions.length <= 1) return null;

  // 4. Исключаем текущую версию по sourceId (не по сырому тексту)
  // Оба пути (_fetchLrclib и _fetchLrclibFallback) теперь сохраняют sourceId.
  // Если sourceId всё ещё нет — версия загружена через устаревший/неизвестный путь.
  // Retry невозможен — не рискуем перевыбрать ту же версию.
  if (!currentLrc.sourceId) {
    if (import.meta.env.DEV) {
      console.warn(
        `[TC-096] LRC retry skipped: sourceId missing (${artist} — ${track}). ` +
        `Version loaded via unrecognized path without version tracking.`
      );
    }
    return null;
  }
  const nextBest = allVersions.find(v => v.id !== currentLrc.sourceId);
  if (!nextBest) return null;

  // 5. Пробуем следующую
  const newResult = parseLrcVersion(nextBest, geniusText);
  const newCoverage = computeCoverage(newResult.blocks, CHECK_BLOCKS);
  const currentCoverage = computeCoverage(currentMatchResult.blocks, CHECK_BLOCKS);

  // 6. Только если coverage реально улучшился
  if (newCoverage <= currentCoverage) return null;

  if (import.meta.env.DEV) {
    console.log(
      `[TC-096] Switched LRC: version #${currentLrc.sourceId} → #${nextBest.id} ` +
      `(coverage: ${(currentCoverage * 100).toFixed(0)}% → ${(newCoverage * 100).toFixed(0)}%)`
    );
  }

  return { version: nextBest, matchResult: newResult };
}

/** Fallback to old /api/get endpoint if search fails */
async function _fetchLrclibFallback(
  artist: string,
  track: string,
  duration?: number,
): Promise<void> {
  const key = _cacheKey(`${artist} - ${track}`);
  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: track,
      ...(duration ? { duration: String(duration) } : {}),
    });
    const res = await fetch(
      `https://lrclib.net/api/get?${params.toString()}`,
      { headers: { 'User-Agent': 'beLive/1.0' }, signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (!data.syncedLyrics) return;
    const lines = _parseLrc(data.syncedLyrics);
    _cache.set(key, {
      lines,
      rawSynced: data.syncedLyrics,
      fetchedAt: Date.now(),
      sourceId: data.id,
      duration: duration || undefined,
      versionDuration: data.duration || undefined,
    });
    if (import.meta.env.DEV) {
      console.log(
        `[AutoLyrics] Fallback LRC: id=${data.id} duration=${data.duration}s ` +
        `(requested=${duration ?? '?'}s, ${lines.length} lines)`
      );
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[AutoLyrics] Fallback also failed:`, (e as Error)?.message);
    }
  }
}

function _parseLrc(syncedLyrics: string): LrcLine[] {
  const lines = syncedLyrics.split('\n');
  const result: LrcLine[] = [];

  // Парсим [offset:N] тег (миллисекунды → секунды)
  let offsetMs = 0;
  const offsetMatch = syncedLyrics.match(/\[offset:\s*(-?\d+)\]/);
  if (offsetMatch) offsetMs = parseInt(offsetMatch[1], 10);
  const offsetSec = offsetMs / 1000;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (/^\[offset:/i.test(line)) continue;

    // FIX (Центр): создаём НОВЫЙ RegExp для каждой строки
    // чтобы избежать проблемы с lastIndex у флага /g
    const timePatternClean = /\[\d{2}:\d{2}\.\d{2,3}\]/g;
    const text = line.replace(timePatternClean, '').trim();
    if (!text) continue;

    // Разворачиваем мультитаймкоды [00:12.00][01:24.00]text
    const times: number[] = [];
    const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      // 2 цифры → *10 (сотые), 3 цифры → миллисекунды
      const ms =
        m[3].length === 2
          ? parseInt(m[3], 10) * 10
          : parseInt(m[3], 10);
      times.push(min * 60 + sec + ms / 1000 + offsetSec);
    }

    for (const time of times) {
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export function _normalizeText(s: string): string {
  return s
    .toLowerCase()
    // Phase 0: NFD diacritics normalization — strip combining marks
    // "françois" → "francois", "é" → "e", "ç" → "c"
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Phase 0b: Cyrillic → Latin transliteration for cross-script matching
    // Enables matching "антонио вивальди" vs "antonio vivaldi"
    .replace(/[а-яё]/g, c => _CYR_TO_LAT[c] || c)
    // Phase 1: Remove word-INTERNAL punctuation (apostrophes, hyphens between letters)
    // These bind words together: "I'm" → "Im", "на-на" → "нана", "o'clock" → "oclock"
    // Must happen BEFORE Phase 2 to avoid "i m" from "i'm"
    .replace(/\p{L}[''`´\u2019-]\p{L}/gu, m => m.replace(/[''`´\u2019-]/g, ''))
    // Phase 2: Replace word-SEPARATING punctuation with space
    // This prevents "7-9-7" → "797" (wrong) and makes it "7 9 7" (correct)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cyrillic → Latin transliteration map for cross-script matching */
export const _CYR_TO_LAT: Record<string, string> = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo',
  'ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
  'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
  'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch',
  'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};

function _levenshtein(a: string, b: string): number {
  // Fast length-difference reject for long strings
  if (a.length > 100 || b.length > 100) return Math.abs(a.length - b.length);
  // Optimized: single-row DP instead of full 2D matrix (3-5x faster, less GC)
  const n = a.length, m = b.length;
  let prev = new Uint16Array(m + 1);
  let curr = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev]; // swap rows
  }
  return prev[m];
}

/** Compare already-normalized strings (no re-normalization) — used in hot matching loop */
function _similarityNormalized(na: string, nb: string): number {
  if (!na || !nb) return 0;

  // Substring match — penalty by length ratio
  // Prevents sub-lines from matching full lines (LRC split-lines vs Genius whole lines)
  // e.g. "Takes you out of the frame" ⊂ "Takes you out of the frame and puts your name to shame"
  // Full match = 1.0, partial = minLen/maxLen (~0.5 for half-lines)
  if (na.includes(nb) || nb.includes(na)) {
    const minLen = Math.min(na.length, nb.length);
    const maxLen = Math.max(na.length, nb.length);
    return minLen / maxLen;
  }

  // Levenshtein для коротких строк
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const dist = _levenshtein(na, nb);
  const levenshteinScore = 1 - dist / maxLen;

  // TC-008: Word-level Jaccard similarity (better for recombined lines)
  const wordSetA = new Set(na.split(/\s+/));
  const wordSetB = new Set(nb.split(/\s+/));
  const intersectionCount = [...wordSetA].filter(w => wordSetB.has(w)).length;
  const unionCount = new Set([...wordSetA, ...wordSetB]).size;
  const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;

  // Return BEST of: substring, Levenshtein, Jaccard
  return Math.max(levenshteinScore, jaccard);
}
