---
agent: 007-vinda
task: n3b-chain
status: done
updated: 2026-08-25T08:05:00+00:00
---

# 🎯 Цепочка General+Функция · N3-β · VERDICT: RESOLVED

Первая боевая цепь на generic-субагентах (канон v2 после падения именных агентов из-за несуществующей модели `ox-alpha-free`). Роли зашивались в промт: Ф001→Ф002→Ф009. Frozen Zone не тронут (только чтение). tsc базлайн 314 подтверждён стрессером.

## Вопрос
Что происходит после остановки записи тейка: остаёмся на блоке или auto-advance?

## Вердикт (Ф009)
**N3-β RESOLVED.** Канон: остаёмся на блоке, пин бессрочный, снимается только явным действием.

> После `finishRecording`/`cancelRecording` (takes.store.ts:90–109) `pinnedBlockId`, установленный `startRecording` (:83–88), не сбрасывается — авто-перехода к следующему блоку нет, панель остаётся на записанном блоке (директива юзера 22.08, TakesPanel:712–715; handleStop без навигации, TakesControlStrip:653–693). Эталон реализован в engine-агностичном UI-слое вне frozen: пин снимают только клик чипа (WagonTrain:116/142 → fromUser:true), новая запись на другом блоке и смена трека. Для V3-порта поведение фиксируется 1:1, включая двойную механику пинов (store `pinnedBlockId` + локальный `blockPinRef`, TakesPanel:372–385).
> Fix D (HybridPipelineService.ts:678–679) оставить как есть — гигиена clock, к продукту не относится.

## Доказательная база (Ф001, подтверждено Ф002)
- AudioEngineV2.ts НЕ имеет API навигации по блокам (:1336 — только коммент loop-guard); запись = чистый захват (:675, :2028).
- lyrics.bridge.ts:90–132 — чистый sync строк.
- Все `finishRecording` в кодовой базе — только в TakesControlStrip (:443,:461,:693,:710,:776,:794) — ни один не переключает блок.
- «advance is explicit user action» — TakesControlStrip.tsx:374.
- Авто-follow заглушен при записи/пине: TakesPanel.tsx:721–724.
- Контрпримеров auto-advance блока НЕ найдено (grep advance|nextBlock|autoChain по src/).

## Тикеты из рисков (Ф002, приоритизировано Ф009)
| Приоритет | Риск | Суть |
|---|---|---|
| 🔴 **P1** | #6 | Гвард handleStop проверяет V2 API (`typeof ae?.pause`, TakesControlStrip:663), а паузит V3 `getTransport()`; pending-rate в RateThrottler переживает окно stop→restore (~50ms rAF-debounce) |
| 🔴 **P1** | #4 | Контракт V3-порта: два пина с разными правилами снятия (store `pinnedBlockId` vs локальный `blockPinRef`) — воспроизвести или консолидировать |
| 🟡 P2 | #3 | `cleanup()` не чистит pinnedBlockId (takes.store.ts:167-178); `clearPinnedBlock`(:81) — мёртвый код (0 вызовов) → fail-sticky |
| 🟡 P2 | #2 | Двуконтурная rate-цепочка V3 (double-write V2-state vs TransportV3.clock через patchV1:41 → :1588 → :1592 → stem-engine-sync:72-76 → TransportV3:243 → RateThrottler) → сложить в C27 single-writer |
| ⚪ P3 | #1 | Протухший коммент TakesControlStrip:658 указывает на мёртвые строки (реальный restore = TakesPanel:975–990, Effect 4b, `ae.setPlaybackRate` :986) |
| ⚪ P3 | #5 | Уточнить формулировку MicSourceV3.release() в доке (:45-48 — refcount+stop, позицию не трогает) |

## Дыры в доказательной базе (честно)
1. Exercise-опосредованный advance (`advanceToNextStep`, exercise.store.ts:296/365) — убедиться, что ни один сценарий не оборачивает смену шага в смену блока.
2. Нет регрессионного теста «finishRecording не меняет activeBlockId/pinnedBlockId» — добавить в P1 #4.
3. Engine-слой рисков #2/#6 спот-чекнуть перед фабрикацией тикета.
4. Один смоук «запись → стоп → панель на месте → смена трека → пин снят» закроет вопрос видимости риска #3.
