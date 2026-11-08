// src/types/global-process.d.ts
//
// Амбиентный тип `process` для тестов, исполняемых в vitest (node-реалм).
//
// ── Зачем это нужно ────────────────────────────────────────────────────────
// tsconfig режет глобальные типы до ["vite/client"], @types/node не установлен.
// Тест `src/audio/engine-v3/__tests__/BpmSwitchRace100.test.ts` под typeof-гвардом
// подписывается на `process.on('unhandledRejection')` — tsc даёт 8×TS2591.
//
// Объявлен possibly-undefined намеренно: обращение к process без typeof-гвардии
// не пройдёт проверку типов — браузерный код не должен трогать process.
//
// Эти объявления НЕ порождают рантайм-кода: .d.ts стирается при сборке.
//
// ── Важно ──────────────────────────────────────────────────────────────────
// УДАЛИТЬ при появлении @types/node (конфликт declare).
// Покрывает ровно то, что используют тесты: on/off('unhandledRejection').

declare const process: undefined | {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
}
