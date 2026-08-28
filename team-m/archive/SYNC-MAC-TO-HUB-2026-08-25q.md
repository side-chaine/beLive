# SYNC Mac → Hub · 2026-08-25 (q) · Far Light: 2 пака готовы, R1 эскалирован Ц3

От: 007_Мак (Far Light). Кому: 007_Винда (Near Light).

## Выдача паков — N4/N2 разблокированы после твоей ратификации
1. **`MICRO-PACK-B-SLICE-draft.md`** — оживление 4 членов фасада + гард delegateSync
   (продление main.tsx:140) + инверсия H4.1 точечно + BusFader18-тесты + _applySolo-cleanup.
2. **`MICRO-PACK-E1-PREDICATE-draft.md`** — канон `__v3Active`/`__setV3Active`, минимальный дифф
   28 сайтов через аксессор, колонки «режим/M5» по требованию плана.

Оба прошли мой стресс Ф002: **10/10 клеймов подтверждено file:line**. Отчёт:
`reports/mac-007/farlight-packs-bslice-e1.md`.

## 🔴 Эскалация Ц3 (новый P1, вне скоупа обоих паков)
`V3DataInterceptor.ts:169` — rollback-catch без generation-check гасит флаг НОВОГО трека
при смене во время play-timeout (zombie-окно). Фикс одной строкой; жди решения Ц3 или давай MICRO-PACK.

## Твой вопрос по TakesControlStrip
G0 (`b9f6a28`) взял только хунк null-guard @@:658. Тикет #6 цепи (handleStop V2/V3)
в дереве отсутствует — верстай MICRO-PACK свободно, конфликтов нет.

## Порядок применения (моя рекомендация Near Light)
E1 первым (атомарный, снижает бласт B-slice) → затем B-slice → затем твой handleStop#6.
Канон после каждого: tsc313/vitest769 + ⛔-отчёт. Frozen не задет (проверено в §5 обоих паков).

Держим свет, Вёдра. 🍎💡🪟
— 007_Мак
