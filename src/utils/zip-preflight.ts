/**
 * Pre-flight: расчёт суммарного размера ВСЕХ компонентов перед ZIP-экспортом.
 * Учитывает instrumental + vocals + stems + cover + bg + scenes.
 *
 * Architecture: «Sample & Tighten»
 * - threshold = zipSizeLimit - zipOverheadSlack (49MB)
 * - deficitMB считается от zipSizeLimit (50MB), не от threshold
 * - stemsToTranscode в порядке priorityChain из конфига
 * - wouldFitZip() — budget gate ДО сборки ZIP
 */
import { STEM_TRANSCODE_CONFIG } from '../config/stem-transcode.config';

export interface PreFlightInput {
  stemsData: Record<string, { data: ArrayBuffer; type: string }>;
  instrumentalByteLength?: number;
  vocalsByteLength?: number;
  coverByteLength?: number;
  bgByteLength?: number;
  scenesByteLength?: number;
}

export interface PreFlightResult {
  /** Суммарный размер ВСЕХ компонентов ZIP */
  predictedTotal: number;
  /** Нужен ли транскодинг (predictedTotal >= threshold = 49MB) */
  needsTranscode: boolean;
  /** Стемы для транскодинга в порядке priorityChain */
  stemsToTranscode: string[];
  /** Дефицит в MB (сколько не хватает до zipSizeLimit = 50MB) */
  deficitMB: number;
}

/**
 * Рассчитать pre-flight сумму и определить path.
 * Учитывает ВСЕ компоненты, а не только stemsData.
 * stemsToTranscode возвращается в порядке STEM_TRANSCODE_CONFIG.priorityChain.
 */
export function calcPreFlight(
  input: PreFlightInput,
  compressibleTypes: readonly string[]
): PreFlightResult {
  // Суммируем всё
  const stemsBytes = Object.values(input.stemsData).reduce(
    (sum, entry) => sum + entry.data.byteLength, 0
  );
  const instrumentalBytes = input.instrumentalByteLength ?? 0;
  const vocalsBytes = input.vocalsByteLength ?? 0;
  const coverBytes = input.coverByteLength ?? 0;
  const bgBytes = input.bgByteLength ?? 0;
  const scenesBytes = input.scenesByteLength ?? 0;

  const predictedTotal = stemsBytes + instrumentalBytes + vocalsBytes
    + coverBytes + bgBytes + scenesBytes;

  // Threshold от zipSizeLimit - slack (50MB - 1MB = 49MB)
  const threshold = STEM_TRANSCODE_CONFIG.zipSizeLimit - STEM_TRANSCODE_CONFIG.zipOverheadSlack;
  const needsTranscode = predictedTotal >= threshold;

  // stemsToTranscode в порядке priorityChain, только существующие стемы,
  // исключая protectedTypes
  const stemsToTranscode = needsTranscode
    ? STEM_TRANSCODE_CONFIG.priorityChain.filter(id =>
        input.stemsData[id] &&
        compressibleTypes.includes(id) &&
        !STEM_TRANSCODE_CONFIG.protectedTypes.includes(id)
      )
    : [];

  // Дефицит от zipSizeLimit (50MB), не от threshold
  const deficitMB = predictedTotal > STEM_TRANSCODE_CONFIG.zipSizeLimit
    ? Math.round((predictedTotal - STEM_TRANSCODE_CONFIG.zipSizeLimit) / (1024 * 1024))
    : 0;

  return { predictedTotal, needsTranscode, stemsToTranscode, deficitMB };
}

/**
 * Budget gate: проверка ДО сборки ZIP.
 * @returns true если finalBytes вписывается в zipSizeLimit
 */
export function wouldFitZip(finalBytes: number): boolean {
  return finalBytes < STEM_TRANSCODE_CONFIG.zipSizeLimit;
}

/**
 * Проверить финальный размер ZIP.
 * @throws Error если >= 50MB
 * Defense-in-depth: последний рубеж после generateInternalStream.
 */
export function assertZipSize(blob: Blob): void {
  if (blob.size >= STEM_TRANSCODE_CONFIG.zipSizeLimit) {
    throw new Error(
      `ZipSizeHardLimitError: ${blob.size} превышает лимит ${STEM_TRANSCODE_CONFIG.zipSizeLimit}`
    );
  }
}
