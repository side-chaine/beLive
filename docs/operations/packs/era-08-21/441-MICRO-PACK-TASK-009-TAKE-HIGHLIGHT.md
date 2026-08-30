# 441-MICRO-PACK · TASK-009 · Take-highlight на коммите (без Play)

> Упаковал: 007 · Источник: 006 OUTBOX (TASK-009 VERIFY-PASS) · Root N9
> Ц3 инвариант: relay 439b — «коммит записи сам выставляет selectedTakeId (и playingTakeId при автоплей-превью) на свежезаписанный тейк»

## Root (006 нашёл, 007 независимо прочитал takes.store.ts — подтверждено)
- `finishRecording` (src/takes/takes.store.ts:77-91) строит blockTakesMap как
  `[meta.blockId]: { ...bt, takes: newTakes }` — НЕ выставляет `selectedSlot`.
- `isBest` (зелёная рамка «best») = `blockTakes.selectedSlot === slot`
  (TakesControlStrip.tsx:889). Выставляется ТОЛЬКО в `selectTake` (:122-131, коллер onStar :934-939).
- → после записи `selectedSlot` остаётся старым/пустым → тейк оранжевый (дефолт), не «best».
- Коррекция брифа: Space-хандлер (useKeyboardShortcuts.ts:72-97) играет transport трека,
  НЕ трогает playingTakeId/selectedSlot. «Подсветка после Play» реально от клика
  onPlay→handlePlayTake (useTakesPlayback.ts:228), не от Space.

## Fix (1 строка, для Оператора)
Файл: src/takes/takes.store.ts
Внутри `finishRecording`, строка 88:

- БЫЛО: `[meta.blockId]: { ...bt, takes: newTakes },`
- СТАЛО: `[meta.blockId]: { ...bt, takes: newTakes, selectedSlot: meta.slot },`

`meta.slot` доступен (используется в :81). Идемпотентно при double-commit.
Не конфликтует с `playingTakeId` (независимый стейт).

## Verification (Оператор)
- `npx tsc --noEmit` → ожидаем 314 ошибок (идентично базе).
- `npx vitest run` → ожидаем 749/749 green.
- Proof-of-change (стандарт Ц3): браузер-ретест юзера — после записи тейк
  СРАЗУ зелёный (best) без клика Play. Зафиксировать трейс-строкой/скрином.

## FROZEN-комплаенс
- Правится: src/takes/takes.store.ts — НЕ в frozen-списке (frozen: AudioEngineV2, patchV1, bridges/*, track.orchestrator, private _). ✅
- Только чтение: TakesControlStrip.tsx, TakeSlot, useTakesPlayback.ts, useKeyboardShortcuts.ts.
