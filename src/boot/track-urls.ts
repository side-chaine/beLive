/**
 * Track blob-URL lifecycle (702-F0').
 *
 * Контракт: на хосте (`window.__belive`) в любой момент живёт НЕ БОЛЕЕ одного
 * набора blob-URL на трек. Каждая публикация сначала отзывает предыдущий набор.
 *
 * Зачем отдельный модуль: `Blob` держит сжатую копию стема живой до
 * `revokeObjectURL`, поэтому «забыли отозвать» = утечка ~6-8 МиБ на каждый
 * переход между треками. Логика вынесена из `aetherBoot.ts`, чтобы её можно
 * было проверить тестом, а не глазами в 200-строчном boot-е.
 */

export interface TrackUrlHost {
  trackUrls?: {
    instrumentalUrl?: string | null;
    vocalsUrl?: string | null;
  } | null;
}

/** Минимально нужная часть IDB-записи трека. */
export interface TrackUrlSource {
  instrumentalData?: ArrayBuffer | null;
  instrumentalType?: string | null;
  vocalsData?: ArrayBuffer | null;
  vocalsType?: string | null;
}

export type RevokeFn = (url: string) => void;

/**
 * Отозвать живые blob-URL на хосте и обнулить ключи.
 * Идемпотентна: повторный вызов на уже пустом хосте ничего не делает.
 */
export function revokeTrackUrls(
  host: TrackUrlHost,
  revoke: RevokeFn = (url) => URL.revokeObjectURL(url)
): void {
  const tu = host.trackUrls;
  if (!tu) return;

  for (const key of ['instrumentalUrl', 'vocalsUrl'] as const) {
    const url = tu[key];
    if (!url) continue;
    try {
      revoke(url);
    } catch {
      /* revoke не должен ломать смену трека */
    }
    tu[key] = null;
  }
}

/**
 * Опубликовать blob-URL нового трека.
 *
 * Порядок важен: СНАЧАЛА отзыв старого набора, ПОТОМ создание нового.
 * Обратный порядок оставил бы окно, в котором живы два набора.
 *
 * @returns объект с созданными URL (для тестов и диагностики)
 */
export function publishTrackUrls(
  host: TrackUrlHost,
  record: TrackUrlSource | null | undefined,
  create: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
  revoke: RevokeFn = (url) => URL.revokeObjectURL(url)
): { instrumentalUrl: string | null; vocalsUrl: string | null } {
  revokeTrackUrls(host, revoke);
  const tu = host.trackUrls || (host.trackUrls = { instrumentalUrl: null, vocalsUrl: null });

  if (record?.instrumentalData) {
    const blob = new Blob([record.instrumentalData], {
      type: record.instrumentalType ?? 'audio/mpeg',
    });
    tu.instrumentalUrl = create(blob);
  }
  if (record?.vocalsData) {
    const blob = new Blob([record.vocalsData], {
      type: record.vocalsType ?? 'audio/mpeg',
    });
    tu.vocalsUrl = create(blob);
  }

  return {
    instrumentalUrl: tu.instrumentalUrl ?? null,
    vocalsUrl: tu.vocalsUrl ?? null,
  };
}
