// BL-050-full · θ-КАЛИБРОВКА near-train на живом корпусе.
//
// Вопрос CEO_Orch: чист ли θ=0.8 — near срабатывает только в ожидаемых
// классах (nearOnly с сильным якорем), без новых ложных квадратов.
//
// Метрика:
//   hits      — near сработал (θ-поезд найден);
//   exactAlso — exact тоже сработал с тем же split (near избыточен, не вредит);
//   nearOnly  — near есть, exact нет → РАСШИРЕНИЕ (класс V3/Chorus 1);
//   strongAnchor — exactRatio > 0.5 (больше половины группы точно);
//   weakAnchor   — exactRatio == 0.5 (минимум допуска nearTrain — подозрительно).

import { normalizeText } from '../../../utils/block-utils';
import { exactTrain, nearTrain } from '../square-full';
import { fetchTrackLrc, type CacheStore, type TrackSpec } from './square-corpus';

export interface NearHitSample {
  track: string;
  start: number;
  size: number;
  groupSize: number;
  copies: number;
  exactRatio: number;
  split: number[];
  lines: string[];
}

export interface NearThetaStat {
  theta: number;
  /** 'loose' = exact ≥ ceil(g/2); 'strict' = exact > g/2. */
  anchor: 'loose' | 'strict';
  hits: number;
  exactAlso: number;
  nearOnly: number;
  strongAnchor: number;
  weakAnchor: number;
  /** nearOnly, отбитые гвардом tail-giant (b ≥ 3a) — «квадрат + длинный хвост». */
  tailGiantRejected: number;
  /** nearOnly, отбитые потолком юнитов (>4 → Римские выше IV). */
  romanCapRejected: number;
  /** nearOnly, выжившие после гвардов — реальные кандидаты в прод. */
  surviving: number;
  survivingStrong: number;
  survivingWeak: number;
  byGroupSize: Record<string, number>;
  bySplit: Record<string, number>;
  perTrack: Record<string, number>;
  samples: NearHitSample[];
}

export interface NearCalibOpts {
  thetas?: number[];
  /** Строгий majority-якорь near-train (exact > g/2). */
  strictAnchor?: boolean;
  minSize?: number;
  maxSize?: number;
  step?: number;
  maxSamples?: number;
}

/** Доля точно совпавших строк в первой копии группы g. */
function exactRatioOf(texts: readonly string[], g: number): number {
  if (g <= 0) {return 0;}
  let exact = 0;
  for (let k = 0; k < g; k++) {
    if (texts[k] === texts[g + k]) {exact++;}
  }
  return exact / g;
}

function emptyStat(theta: number, anchor: 'loose' | 'strict'): NearThetaStat {
  return {
    theta, anchor, hits: 0, exactAlso: 0, nearOnly: 0, strongAnchor: 0, weakAnchor: 0,
    tailGiantRejected: 0, romanCapRejected: 0, surviving: 0, survivingStrong: 0, survivingWeak: 0,
    byGroupSize: {}, bySplit: {}, perTrack: {}, samples: [],
  };
}

/** Гварды §12.3 — те же, что в square-full (tail-giant b≥3a, потолок 4 юнита). */
function guardVerdict(split: readonly number[]): 'tail-giant' | 'roman-cap' | null {
  if (split.length > 4) {return 'roman-cap';}
  if (split.length === 2 && split[1] >= 3 * split[0]) {return 'tail-giant';}
  return null;
}

/** Замер near-train по одному треку; мутирует агрегаты по θ. */
export function collectNearStats(
  lines: readonly string[],
  trackKey: string,
  stats: NearThetaStat[],
  opts: NearCalibOpts = {},
): void {
  const minSize = opts.minSize ?? 6;
  const maxSize = opts.maxSize ?? 20;
  const step = opts.step ?? 1;
  const maxSamples = opts.maxSamples ?? 40;
  const strictAnchor = opts.strictAnchor === true;

  const texts = lines.map((l) => normalizeText(l));

  for (let size = minSize; size <= maxSize; size++) {
    for (let start = 0; start + size <= lines.length; start += step) {
      const window = texts.slice(start, start + size);
      const exact = exactTrain(window);

      for (const st of stats) {
        const near = nearTrain(window, st.theta, strictAnchor);
        if (!near) {continue;}
        st.hits++;

        const key = near.split.join(',');
        st.bySplit[key] = (st.bySplit[key] ?? 0) + 1;
        const gk = String(near.groupSize);
        st.byGroupSize[gk] = (st.byGroupSize[gk] ?? 0) + 1;

        if (exact && exact.split.join(',') === key) {
          st.exactAlso++;
          continue;
        }

        st.nearOnly++;
        st.perTrack[trackKey] = (st.perTrack[trackKey] ?? 0) + 1;

        const ratio = exactRatioOf(window, near.groupSize);
        if (ratio > 0.5) {st.strongAnchor++;} else {st.weakAnchor++;}

        const verdict = guardVerdict(near.split);
        if (verdict === 'tail-giant') {
          st.tailGiantRejected++;
        } else if (verdict === 'roman-cap') {
          st.romanCapRejected++;
        } else {
          st.surviving++;
          if (ratio > 0.5) {st.survivingStrong++;} else {st.survivingWeak++;}
        }

        if (st.samples.length < maxSamples) {
          st.samples.push({
            track: trackKey, start, size,
            groupSize: near.groupSize, copies: near.copies,
            exactRatio: ratio, split: near.split,
            lines: lines.slice(start, start + size),
          });
        }
      }
    }
  }
}

export interface NearCalibReport {
  meta: {
    date: string;
    tracksInList: number;
    tracksOk: number;
    tracksFailed: number;
    minSize: number;
    maxSize: number;
    method: string;
  };
  byTheta: NearThetaStat[];
}

/** Прогон θ-калибровки по списку треков (кэш инъектируется). */
export async function runNearCalibration(
  specs: readonly TrackSpec[],
  cache: CacheStore,
  opts: NearCalibOpts = {},
): Promise<NearCalibReport> {
  const thetas = opts.thetas ?? [0.75, 0.8, 0.85];
  const anchor: 'loose' | 'strict' = opts.strictAnchor === true ? 'strict' : 'loose';
  const stats = thetas.map((t) => emptyStat(t, anchor));
  let ok = 0;
  let fail = 0;

  for (const spec of specs) {
    const key = `${spec.artist} - ${spec.track}`;
    try {
      const lines = await fetchTrackLrc(spec, cache);
      collectNearStats(lines.map((l) => l.text), key, stats, opts);
      ok++;
    } catch {
      fail++;
    }
  }

  return {
    meta: {
      date: new Date().toISOString(),
      tracksInList: specs.length,
      tracksOk: ok,
      tracksFailed: fail,
      minSize: opts.minSize ?? 6,
      maxSize: opts.maxSize ?? 20,
      method: 'RUN2 live lrclib sliding-window · near-train θ-sweep',
    },
    byTheta: stats,
  };
}
