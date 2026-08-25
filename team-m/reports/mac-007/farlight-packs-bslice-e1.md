---
agent: mac-007
task: farlight-packs-bslice-e1
status: done
updated: 2026-08-25T15:00:00+00:00
---
# Far Light выдача: два MICRO-PACK (B-slice + E1) — стресс-проверены, ждут Оператора

## Паки (design-only, src/ не тронут)
1. `MICRO-PACK-B-SLICE-draft.md` — оживление 4 членов фасада: edits через pipeline/router
   (`setBusVolume` stems / `setStemVolume` no-stems; instrumental вне шин — A2.25 HPS:624 ✅),
   гард delegateSync продлением main.tsx:140 на volume-имена ✅, инверсия H4.1 точечно
   (main.tsx:290-291 только для revival-членов), BusFader18.test.ts :424 контракт-флип,
   _applySolo-cleanup = удаление прямых записей StemChain.ts:95-103 (soloStem HPS:552 уже writer).
   Нюанс: `__belive.ctx` публиковать синхронно после main.tsx:100 (сейчас async-IIFE :178).
2. `MICRO-PACK-E1-PREDICATE-draft.md` — канон `window.__v3Active`, writer `__setV3Active`
   (main.tsx:148-151) ✅; getter TransportV3:98 (0 консьюмеров) удаляется без шины;
   минимальный дифф 28 сайтов → аксессор foundation/predicate/v3-active.ts; колонки режимов/M5 в §3.

## Стресс Ф002: 10/10 клеймов подтверждено по file:line
main.tsx:132-151 ✅ · V2AudioCage:106-107 ✅ · TransportV3:98 ✅ · stem-engine-sync:22-26 ✅
(скрытый ридер внутри isV3Master — как и утверждал E1-пак) · Interceptor:164-178 ✅ · HPS busOf:623-628 ✅

## 🔴 P1 ЭСКАЛАЦИЯ Ц3 (вне скоупа E1)
`V3DataInterceptor.ts:169`: rollback-catch зовёт `__setV3Active(false)` БЕЗ проверки
`myGeneration === this._loadGeneration` → при смене трека во время 5s play-timeout
старый rollback гасит флаг НОВОГО трека (zombie-окно). Лечение одной строкой — generation-check.
Входит в B-slice/E1? Нет — самостоятельный фикс, просить решения Ц3.

## Ответ Виндe по TakesControlStrip
G0 (b9f6a28) забрал ТОЛЬКО хунк null-guard @@:658. Тикет #6 цепи (handleStop V2/V3)
в дереве ОТСУТСТВУЕТ — поле чистое, верстай MICRO-PACK свободно.

## Разблокировка Near Light
N4 (B-slice) и N2 (E1) ждут только твоей ратификации паков → Оператор → канон 313/769.
