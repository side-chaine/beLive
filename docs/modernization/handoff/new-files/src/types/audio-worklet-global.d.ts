// src/types/audio-worklet-global.d.ts
//
// Амбиентные типы AudioWorkletGlobalScope.
//
// ── Зачем это нужно ────────────────────────────────────────────────────────
// Код ворклета пишется в .ts-файле main-реалма, сериализуется через
// Function.prototype.toString() и исполняется уже внутри AudioWorkletGlobalScope.
// Проверяется он — в main-реалме, где этих глобал НЕ СУЩЕСТВУЕТ.
// Отсюда TS2304 «Cannot find name 'AudioWorkletProcessor'».
//
// Эти объявления НЕ порождают рантайм-кода: .d.ts полностью стирается при сборке.
// Они существуют ровно для того, чтобы tsc мог проверить код ДО сериализации.
//
// ── Важно ──────────────────────────────────────────────────────────────────
// Это НЕ замена ADR-0002 (вынос ворклетов в отдельные .js-файлы).
// Это страховка на переходный период. Когда ворклеты станут настоящими
// файлами, этот .d.ts станет не нужен — у них будет свой realm и свои типы.
//
// См. docs/modernization/ADR-0002-worklet-realm-extraction.md

/** Базовый класс процессоров AudioWorklet. Доступен только внутри ворклета. */
declare class AudioWorkletProcessor {
  /** Порт для обмена сообщениями с main-реалмом. */
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
}

/** Номер текущего кадра в AudioWorkletGlobalScope. */
declare const currentFrame: number;

/** Регистрирует процессор по имени в AudioWorkletGlobalScope. */
declare function registerProcessor(
  name: string,
  processorCtor: new (options?: any) => AudioWorkletProcessor
): void;
