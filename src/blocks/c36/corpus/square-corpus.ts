// BL-048 · seam+square КОРПУС (RUN2-метод): конвертирует гипотезы §12 в факты.
//
// Источник блоков: lrclib даёт синхронизированный LRC + таймкоды, НО БЕЗ
// Genius-секций. Поэтому корпусный юнит = скользящее окно реальных LRC-строк
// сплиттимого размера (6..15) — на нём гоняем splitSquareRuleD /
// detectEchoBreakPoint / computeBalancedSplit и собираем статистику паттернов
// и гвардов. Это проверяет таксономию квадратов на живом тексте без Genius.
//
// Сеть: fetch кэшируется в cacheDir (инкрементально, офлайн-воспроизводимо) —
// lrclib rate-limit'ит, поэтому повторные прогоны не бьют API.

import { splitSquareRuleD, detectEchoBreakPoint, computeBalancedSplit } from '../../../utils/block-utils';

/** Кэш-хранилище (инъекция зависимости): позволяет юзать fs в ноде, а в
 *  тестах/app — in-memory, не требуя node:fs в контексте приложения. */
export interface CacheStore {
  get(key: string): string | null;
  set(key: string, data: string): void;
}

/** In-memory кэш (дефолт): не персистентен, но не требует node-окружения. */
export function memoryCache(): CacheStore {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => { m.set(k, v); },
  };
}

export interface LrcLine {
  t: number; // секунды
  text: string;
}

/** Парсер синхро-LRC lrclib: `[mm:ss.xx] text` (возможно несколько таймкодов). */
export function parseSyncedLrc(raw: string): LrcLine[] {
  const out: LrcLine[] = [];
  const re = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {continue;}
    const times: number[] = [];
    let m: RegExpExecArray | null;
    let last = 0;
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      times.push(parseInt(m[1], 10) * 60 + parseFloat(m[2]));
      last = re.lastIndex;
    }
    const text = line.slice(last).trim();
    if (!text) {continue;}
    out.push({ t: times[0] ?? 0, text });
  }
  return out;
}

export interface WindowStat {
  start: number; // индекс начала окна в lines
  size: number;
  ruleD: { split: number[]; matched: boolean; groupSize: number; copies: number };
  echo: number | null; // detectEchoBreakPoint (локальный индекс) или null
  balanced: number[]; // computeBalancedSplit(size)
  unisonCollapse: boolean; // все строки окна идентичны → 1 юнит
  tailGiant: boolean; // tail >= 3 * square (b >= 3a)
  anaphoraAnchor: boolean; // echo-якорь i<=1 ИЛИ pairs>=2
}

export interface CorpusStats {
  windows: number;
  byRuleDSplit: Record<string, number>; // "6,3" -> count
  ruleDMatched: number;
  echoHits: number;
  unisonCollapse: number;
  tailGiant: number;
  anaphoraAnchor: number;
  perTrack: Record<string, number>; // trackKey -> число окон
}

export interface CollectOpts {
  minSize?: number; // мин. размер окна (по умолч. 6)
  maxSize?: number; // макс. размер окна (по умолч. 15)
  step?: number; // шаг скольжения (по умолч. 1)
}

/** Скользящее окно по lines; для каждого окна — чистые замеры сплиттеров. */
export function collectSquareStats(
  lines: string[],
  opts: CollectOpts = {}
): WindowStat[] {
  const minSize = opts.minSize ?? 6;
  const maxSize = opts.maxSize ?? 15;
  const step = opts.step ?? 1;
  const stats: WindowStat[] = [];

  for (let size = minSize; size <= maxSize; size++) {
    for (let start = 0; start + size <= lines.length; start += step) {
      const window = lines.slice(start, start + size);
      const ruleD = splitSquareRuleD(window.map((_, i) => i), window);
      const echo = detectEchoBreakPoint(window.map((_, i) => i), window);
      const balanced = computeBalancedSplit(size);
      const unisonCollapse = new Set(window.map((w) => w.toLowerCase())).size === 1;
      const tailGiant =
        ruleD.matched && ruleD.split.length === 2 && ruleD.split[1] >= 3 * ruleD.split[0];
      // anaphora-anchor: echo-якорь на i<=1 ИЛИ >=2 пары совпадения (best-effort)
      let anchorPairs = 0;
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (window[i].toLowerCase() === window[j].toLowerCase()) {anchorPairs++;}
        }
      }
      const anaphoraAnchor = (echo !== null && echo <= 1) || anchorPairs >= 2;

      stats.push({
        start, size, ruleD, echo, balanced,
        unisonCollapse, tailGiant, anaphoraAnchor,
      });
    }
  }
  return stats;
}

/** Агрегация замеров окон в итоговую статистику корпуса. */
export function summarizeWindows(stats: WindowStat[], trackKey = ''): CorpusStats {
  const agg: CorpusStats = {
    windows: stats.length,
    byRuleDSplit: {},
    ruleDMatched: 0,
    echoHits: 0,
    unisonCollapse: 0,
    tailGiant: 0,
    anaphoraAnchor: 0,
    perTrack: {},
  };
  for (const w of stats) {
    if (w.ruleD.matched) {
      agg.ruleDMatched++;
      const key = w.ruleD.split.join(',');
      agg.byRuleDSplit[key] = (agg.byRuleDSplit[key] ?? 0) + 1;
    }
    if (w.echo !== null) {agg.echoHits++;}
    if (w.unisonCollapse) {agg.unisonCollapse++;}
    if (w.tailGiant) {agg.tailGiant++;}
    if (w.anaphoraAnchor) {agg.anaphoraAnchor++;}
  }
  if (trackKey) {agg.perTrack[trackKey] = stats.length;}
  return agg;
}

export interface TrackSpec {
  artist: string;
  track: string;
}

/**
 * Загрузить синхро-LRC трека из lrclib (RUN2), с кэшем через CacheStore.
 * Возвращает список строк. При сбое сети бросает — вызывающий решает.
 * Кэш-ключ = `artist - track` (без спецсимволов).
 */
export async function fetchTrackLrc(
  spec: TrackSpec,
  cache: CacheStore
): Promise<LrcLine[]> {
  const key = `${spec.artist} - ${spec.track}`.replace(/[^\wа-яёЁ .-]/gi, '_');
  const cached = cache.get(key);
  if (cached) {return JSON.parse(cached) as LrcLine[];}
  const q = encodeURIComponent(`${spec.artist} ${spec.track}`);
  const res = await fetch(`https://lrclib.net/api/search?q=${q}`);
  if (!res.ok) {throw new Error(`lrclib ${res.status} for ${spec.artist}/${spec.track}`);}
  const data = (await res.json()) as Array<{ syncedLyrics?: string }>;
  const best = data.find((d) => d.syncedLyrics) ?? data[0];
  if (!best?.syncedLyrics) {throw new Error(`lrclib: no syncedLyrics for ${spec.artist}/${spec.track}`);}
  const parsed = parseSyncedLrc(best.syncedLyrics);
  cache.set(key, JSON.stringify(parsed));
  return parsed;
}

/** Прогнать корпус треков: загрузка (кэш) + замеры + агрегация. */
export async function runCorpus(
  specs: TrackSpec[],
  cache: CacheStore = memoryCache()
): Promise<CorpusStats> {
  const combined = summarizeWindows([], '');
  for (const spec of specs) {
    const key = `${spec.artist} - ${spec.track}`;
    try {
      const lines = await fetchTrackLrc(spec, cache);
      const texts = lines.map((l) => l.text);
      const stats = collectSquareStats(texts);
      const part = summarizeWindows(stats, key);
      combined.windows += part.windows;
      combined.ruleDMatched += part.ruleDMatched;
      combined.echoHits += part.echoHits;
      combined.unisonCollapse += part.unisonCollapse;
      combined.tailGiant += part.tailGiant;
      combined.anaphoraAnchor += part.anaphoraAnchor;
      combined.perTrack[key] = part.windows;
      for (const [k, v] of Object.entries(part.byRuleDSplit)) {
        combined.byRuleDSplit[k] = (combined.byRuleDSplit[k] ?? 0) + v;
      }
    } catch (e) {
      // Сетевой сбой/rate-limit — трек пропускаем, не валим весь корпус.
      if (typeof console !== 'undefined') {
        console.warn(`[corpus] skip ${key}: ${(e as Error).message}`);
      }
    }
  }
  return combined;
}
