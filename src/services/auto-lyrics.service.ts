/**
 * auto-lyrics.service.ts — W11
 * Auto-fetch synced lyrics from lrclib.net + match to Genius text
 */

import { parseTaggedLyrics } from '../blocks/parser/tagged-lyrics.parser';
import type { PersistedSyncMarker, PersistedTextBlock } from '../types/persistence.types';

// ── Types ──────────────────────────────────────────────

interface LrcLine {
  time: number; // seconds
  text: string;
}

interface LrcResult {
  lines: LrcLine[];
  rawSynced: string;
  fetchedAt: number;
  confidence?: number; // от последнего match
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
  timeoutMs: number = 17000,
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
  
  // 3. Map Genius blocks to LRC time ranges
  //    Find first content line of each block in LRC
  const normalizedDisplay = displayLines.map(l => _normalizeText(l));
  let lastMatchedLrcIdx = -1;
  
  const blocks: PersistedTextBlock[] = tagResult.blocks.map((block, bi) => {
    const contentLines = block.contentLines.filter(l => l.trim());
    const firstLine = contentLines[0];
    if (!firstLine) {
      return {
        id: `auto-block-${bi}`,
        name: block.label,
        lineIndices: [],
        type: block.type,
      };
    }
    
    // Find this Genius first line in LRC display
    const firstNorm = _normalizeText(firstLine.trim());
    let firstWords = firstNorm.split(/\s+/).filter(w => w.length > 2).slice(0, 4);
    // Fallback: short words like "yo", "oh", "we" are valid for matching.
    if (firstWords.length === 0) {
      firstWords = firstNorm.split(/\s+/).filter(w => w.length >= 2).slice(0, 4);
    }
    
    // Deduplicate: "All, all, all" → ["all"] — prevents score inflation
    // where 3 identical words matching 1 LRC word gives false 100%
    firstWords = [...new Set(firstWords)];
    
    // Supplement: if first line yields < 2 unique words (e.g., "All, all, all"),
    // add unique words from contentLines[1..2] to strengthen matching.
    // Genius = каркас: block structure tells us what lines belong together.
    // A single word "all" matching "All caught up in the eye of the storm" 
    // is a false positive. Adding "wanna","trade","this" from line 2 makes 
    // the match specific: only "All I wanna do is trade this life..." scores high.
    if (firstWords.length < 2 && contentLines.length > 1) {
      for (let v = 1; v < contentLines.length && firstWords.length < 3; v++) {
        const vNorm = _normalizeText(contentLines[v].trim());
        let vWords = vNorm.split(/\s+/).filter(w => w.length > 2);
        if (vWords.length === 0) {
          vWords = vNorm.split(/\s+/).filter(w => w.length >= 2);
        }
        for (const w of vWords) {
          if (!firstWords.includes(w)) {
            firstWords.push(w);
            if (firstWords.length >= 4) break;
          }
        }
        if (firstWords.length >= 3) break;
      }
    }
    
    let bestIdx = -1;
    let bestScore = 0;
    
    // Search FORWARD from last matched position (occurrence-aware)
    const searchStart = Math.max(0, lastMatchedLrcIdx);
    for (let i = searchStart; i < normalizedDisplay.length; i++) {
      const lrcNorm = normalizedDisplay[i];
      
      // TC-010-FIX2: Word-boundary match instead of substring includes
      // Prevents "you" matching "youre" — uses exact word matching
      const lrcWords = new Set(lrcNorm.split(/\s+/));
      const matchCount = firstWords.filter(w => lrcWords.has(w)).length;
      const score = firstWords.length > 0 ? matchCount / firstWords.length : 0;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    
    if (bestScore < 0.5 || bestIdx < 0) {
      if (import.meta.env.DEV) {
        console.warn(
          `[TC-010] Block "${block.label}" first line not found in LRC ` +
          `(best score: ${(bestScore * 100).toFixed(0)}%) → "${firstLine.substring(0, 40)}"`
        );
      }
      // ⚡ TC-BUG-01: Продвигаем lastMatchedLrcIdx даже при NOT MAPPED,
      // чтобы следующий блок не украл строки этого блока
      lastMatchedLrcIdx = Math.min(lastMatchedLrcIdx + 1, displayLines.length - 1);
      return {
        id: `auto-block-${bi}`,
        name: block.label,
        lineIndices: [],
        type: block.type,
        // ⚡ TC-BUG-03-A: Сохраняем contentLines из Genius даже при NOT MAPPED
        // (без таймингов, но с текстом — для отображения в TrackMap)
        contentLines: block.contentLines,
      };
    }
    
    lastMatchedLrcIdx = bestIdx;
    
    return {
      id: `auto-block-${bi}`,
      name: block.label,
      _lrcStartIdx: bestIdx,
      _matchScore: bestScore,
      type: block.type,
    } as any;
  });
  
  // 4. Assign LRC line ranges to blocks
  //    Block N owns lines from its startIdx to block N+1's startIdx
  for (let i = 0; i < blocks.length; i++) {
    const startIdx = (blocks[i] as any)._lrcStartIdx;
    if (startIdx == null || startIdx < 0) continue;
    
    // Find next block's start
    let endIdx = displayLines.length;
    for (let j = i + 1; j < blocks.length; j++) {
      const nextStart = (blocks[j] as any)._lrcStartIdx;
      if (nextStart != null && nextStart >= 0) {
        endIdx = nextStart;
        break;
      }
    }
    
    blocks[i].lineIndices = [];
    for (let k = startIdx; k < endIdx; k++) {
      blocks[i].lineIndices.push(k);
    }
    
    // TC-010-FIX: Add contentLines for WagonTrain display
    blocks[i].contentLines = blocks[i].lineIndices.map(
      (idx: number) => displayLines[idx]
    );
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
    
    for (const block of blocks) {
      if (block.lineIndices.length > 0) {
        const first = block.lineIndices[0];
        const last = block.lineIndices[block.lineIndices.length - 1];
        console.log(
          `  [${block.type}] "${block.name}": ` +
          `lines ${first}-${last} (${block.lineIndices.length}), ` +
          `time ${markers[first]?.time?.toFixed(1)}s-${markers[last]?.time?.toFixed(1)}s` +
          `${block.lineIndices.length > 8 ? ' ⚠️ >8 lines' : ''}`
        );
      } else {
        console.log(`  [${block.type}] "${block.name}": NOT MAPPED`);
      }
    }
  }
  
  // Clean up temp fields
  for (let i = 0; i < blocks.length; i++) {
    delete (blocks[i] as any)._lrcStartIdx;
    delete (blocks[i] as any)._matchScore;
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
      signal: AbortSignal.timeout(15000),
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
export function parseLrcVersion(
  version: LrcVersion,
  geniusText?: string,  // optional: Genius text for block structure
): MatchResult {
  const lrcResult = parseLrcString(version.lrcText);

  if (geniusText) {
    // Genius provides block structure → better TrackMap
    return blockFirstLineSync(geniusText, lrcResult);
  }

  // No Genius → markers only, no blocks
  const { markers, lyricsLines } = lrcToMarkers(lrcResult);
  return {
    markers,
    blocks: [],
    confidence: 1.0,
    lyricsLines,
  };
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
      { headers: { 'User-Agent': 'beLive/1.0' }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (!data.syncedLyrics) return;
    const lines = _parseLrc(data.syncedLyrics);
    _cache.set(key, { lines, rawSynced: data.syncedLyrics, fetchedAt: Date.now() });
    if (import.meta.env.DEV) {
      console.log(`[AutoLyrics] Fallback LRC: duration=${data.duration}s, ${lines.length} lines`);
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

function _similarity(a: string, b: string): number {
  const na = _normalizeText(a);
  const nb = _normalizeText(b);
  return _similarityNormalized(na, nb);
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
