/**
 * Stem transcode configuration — «Sample & Tighten»
 * Определяет какие стемы подлежат пережатию при ZIP-экспорте.
 * 
 * Priority chain (строгий порядок, verified с Никитой):
 *   1. 'other'  — первый кандидат, наименее критичен для качества
 *   2. 'keys'   — второй кандидат (клавиши, приемлемая потеря)
 *   3. 'guitar' — третий кандидат (гитара)
 * 
 * Protected: drums, bass, vocals — НЕ сжимать, оригинальное качество.
 * 
 * ⚠️ IMPORTANT: stem ID = 'guitar' (не 'gtr'). 'gtr' — alias для filename
 *    классификации в upload.service.ts, не ключ в stemsData.
 */
export const STEM_TRANSCODE_CONFIG = {
  /** Priority chain: строгий порядок применения */
  priorityChain: ['other', 'keys', 'guitar'] as readonly string[],

  /** Whitelist кандидатов на пережатие */
  compressibleTypes: ['other', 'keys', 'guitar'] as readonly string[],

  /** Protected: эти стемы НЕ сжимаются (оригинальное качество) */
  protectedTypes: ['drums', 'bass', 'vocals', 'instrumental'] as readonly string[],

  /** Critical path: падение этих стемов → ABORT всего экспорта */
  criticalTypes: ['vocals'] as readonly string[],

  /** Битрейт для T0 (нормальный путь) */
  defaultBitrate: 128,

  /** Битрейт для tightening pass (64kbps, max 1 стэм) */
  fallbackBitrate: 64,

  /** Slack для ZIP overhead (export.json, alignment.json, headers) */
  zipOverheadSlack: 1 * 1024 * 1024, // 1MB

  /** Максимальная длительность стема для транскодинга (сек) */
  maxDurationSec: 240,

  /** Лимит ZIP-файла */
  zipSizeLimit: 50 * 1024 * 1024, // 50MB
} as const;

export type StemTranscodeConfig = typeof STEM_TRANSCODE_CONFIG;
