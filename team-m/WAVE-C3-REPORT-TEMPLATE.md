# ⛔ ОТЧЁТ ЦЕНТРУ_3 — исполнение волны срезки Легаси (шаблон)

> Заполняется Hub (007_Винда) ПЕРЕД применением каждой волны (pre) и ПОСЛЕ (post).
> Цель: доказать, что frozen-зона нетронута, канон не упал, parity/guard зелёные.

## META
- **Волна:** W# (1..5)
- **Дата:** YYYY-MM-DD
- **Цепочка:** [001→002→009] / GO_xxx
- **Оператор-пак:** team-m/MICRO-PACK-WAVE#.md (executable-версия)

## PRE-FLIP (до применения)
- tsc ошибок: ___ (канон 306)
- vitest passed: ___ (канон 767+5int+2load)
- PARITY (`npm run verify:parity`): PASS / FAIL
- Frozen-guard (`node team-m/bLb/frozen-guard.mjs`): GREEN / RED
- SHA256 frozen (ДО): приложен `frozen-baseline-sha.txt` (хэш совпадает с baseline) ✅

## ИЗМЕНЕНИЯ (только SAFE-файлы)
- Список затронутых safe-файлов: ___
- Frozen-файлы затронуты: НЕТ (обязательно НЕТ)
- `_`-поля тронуты: НЕТ

## POST-FLIP (после применения + верификации Оператором)
- tsc ошибок: ___ (не больше канона)
- vitest passed: ___ (не меньше канона)
- PARITY: PASS / FAIL
- Frozen-guard: GREEN / RED
- SHA256 frozen (ПОСЛЕ): идентичен ДО? ДА / НЕТ (если НЕТ → СТОП, откат)
- boot-smoke CDP V1 (V2-режим): OK / FAIL
- boot-smoke CDP V5 (V3-режим): OK / FAIL

## ВЕРДИКТ ЦЕПОЧКИ
- 001 (co-architect): ___
- 002 (stress-test): ___ рисков / ___ блокеров
- 009 (verify): RESOLVED / OPEN — ___
- **ИТОГО:** GO на следующую волну / СТОП

## NOTES / РИСКИ
- ___
