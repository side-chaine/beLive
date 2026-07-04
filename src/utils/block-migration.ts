/**
 * Lazy migration (on-read repair) для PersistedTextBlock.
 * Если taxonomyVersion отсутствует или меньше текущей — восстанавливает
 * недостающие поля дефолтами. Не трогает уже заполненные поля.
 */
import { TAXONOMY_VERSION } from '../blocks/parser/block-taxonomy';

export { TAXONOMY_VERSION };

export interface MigratePersistedBlockOptions {
  /** Какие типы считать речевыми (spoken, rap) — им не нужен instrument */
  speechTypes?: Set<string>;
}

export function migratePersistedBlock(
  block: Record<string, unknown>,
  options?: MigratePersistedBlockOptions,
): Record<string, unknown> {
  const type = (block.type as string) || 'verse';

  // Если всё актуально — skip
  if (block.taxonomyVersion != null && Number(block.taxonomyVersion) >= TAXONOMY_VERSION && block.originalTag != null) {
    return block;
  }

  const result: Record<string, unknown> = { ...block };

  // Догадка по типу (не оригинал! — помечено)
  if (result.originalTag == null) {
    // first-approximation: type → заглавный тип, типа 'chorus' → 'Chorus'
    result.originalTag = type.charAt(0).toUpperCase() + type.slice(1);
    // Помечаем как inferred (undefined = не оригинал)
    // При показе в UI: проверять result.originalTagHasOriginal === false
    result._originalTagInferred = true;
  }

  if (result.instrument == null && (options?.speechTypes?.has(type) === false)) {
    // instrument не восстанавливаем — это специфичная информация, догадка опасна
    // Лучше undefined, чем неверное предположение
  }

  if (result.taxonomyVersion == null || Number(result.taxonomyVersion) < TAXONOMY_VERSION) {
    result.taxonomyVersion = TAXONOMY_VERSION;
  }

  return result;
}
