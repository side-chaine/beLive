# MICRO-PACK · DOC-WAVE-D1+: ДОГОН КОНВОЯ D-1 (класс «доки отстали», 3-й за миссию-4) · 2026-09-03

**Авторы:** пара 003+003_2 (находки ФВ-1 003_2 19:46 + факт-чек/спека 003 19:5x) · **Источник:** D-1 применён `6cb8add` (CEO_1+007: созвездие V2 снесено, −2735 строк, frozen 1/1, tsc 191, reach 121 — канон-цифры из LOG)
**Статус:** СПЕКА-ДОГОН (волна D-1 уже в каноне `cc50bf4` — доки догоняют; 186/54 класс = «удалён 03.09, D-1») · стресс: лайт 003_2 (класс отработан 3 раза: A+/B+/B++)
**HEAD-SSOT:** `cc50bf4` · канон: tsc=191 🔴(down!) · vitest 812/68 🟢 · frozen **1/1** (guard=[live-guard], graveyard 0) — **машина 1/1, доки врут**
**Факт-чек 003 (sed/python):** AudioEngineV2.ts отсутствует (ls: No such file) ✅ · манифест guard=[live-guard]/graveyard=0 ✅ · доки «2 файла/2199» ✅ живы-и-лгут · 6 К2-хвостов V1A живы (Onboarding×2, reactive:1, takes+audio-engine+др.) ✅

## DD-1. SSOT-числа: «2 файла/2 199» → «1 файл/live-guard · ~21 строк»

| # | Файл:строка (якорь) | Было → Стало |
|---|---|---|
| DD-1a | docs/architecture/frozen-zones-v2.md:2 🔒 | «операционный канон (2 файла, после Волны C: guard 2, graveyard 0)» → «операционный канон (1 файл: live-guard — после Волны D-1: AudioEngineV2 снесён 03.09; graveyard 0)» |
| DD-1b | docs/architecture/frozen-zones-v2.md:3 | «**2 зоны · 2 файла** (AudioEngineV2 + live-guard), ~2 199 строк (…−2 350 Волна C…)» → «**1 зона · 1 файл** (live-guard, ~21 строка) (5299 → −162 A → −592 B → −2 350 C → −2 141 D-1 AudioEngineV2+StemPlayer+AudioLoader+VocalMix+MicrophoneManager, 03.09)» — лестница-цепочка честных сносов |
| DD-1c | docs/architecture/README.md:15 | «2 зоны · 2 файла · ~2 199 строк» → «1 зона · 1 файл (live-guard ~21) — после Волны D-1 (03.09); синхронно с frozen-zones-v2.md:3» |
| DD-1d | frozen-manifest.json-note (если «2 файла» жива там) | → «1 файл (live-guard)» |

## DD-2. К2-хвосты V1A (6 строк — ложь утроилась сносом: AudioEngineV2 больше не существует)

| # | Файл:строка (якорь) | Было → Стало |
|---|---|---|
| DD-2a | docs/architecture/takes-system.md:194 | «Transport = V3 (фасад), frozen V2 — делегируемое ядро» → «Transport = V3 (фасад + transport-слой); V2-ядро снесено Волной D-1 03.09» |
| DD-2b | docs/architecture/audio-engine.md:14 | (frozen-перечень строки) → «AudioEngineV2 — снесён Волной D-1 03.09 (был frozen-ядро)» + сохраняющие эру-скобки |
| DD-2c | docs/architecture/audio-engine.md:248/:433/:843/:1067 | точечные вхождения AudioEngineV2 → «(снесён Волной D-1 03.09)» по контент-якорям |
| DD-2d | docs/BILI-CONTEXT.md:70 (инвариант) | «V3 — дефолт (28.08); transport-слой V3; frozen V2 — до M5» → «V3 — дефолт (28.08); transport-слой V3; V2-ядро снесено Волной D-1 03.09 (M5-пункт исполнен сноском)» |
| DD-2e | docs/guides/Onboarding Route 2.1.md:50/:123 (2 хвоста) | «AudioEngineV2 transport authority» → «V3 transport (js/audio-facade-v3.js)» — класс В-1а (фальсификация-защита: строки уже врёт после D-1) |
| DD-2f | docs/architecture/reactive-lyrics-foundation.md (последняя :1 из V1A-пары) | синхронная правка |

**⚠️ audio-engine.md (25 вхождений) / n-stem (21) — отдельно:** ядро V2-описаний умерло с D-1. Полную перепись **не делаем дого** — это класс «186/54 упоминаний = удалён 03.09 D-1»: волна-ярлык в шапку обоих доков + пофайловая сводка (фураж уже у 003_2 в класс-сырьё). Конвой D-2 (после решения судьбы DOCS-EXECUTION Опуса — 003_2 сверяет сейчас).

## Гейты догона

1. `rg -n "2 файла|2 199|2 файла" docs/architecture/frozen-zones-v2.md docs/architecture/README.md` → 0; «1 файл/live-guard/~21» присутствует
2. `rg -c "транспортный авторитет|transport authority" <6 файлов V1A>` → 0
3. `rg -c "AudioEngineV2" docs/architecture/audio-engine.md` → только эра-скобки «снесён Волной D-1» (точный счёт после применения)
4. `npm run verify:frozen` → exit 0 (1/1) — машина уже в каноне, доки догоняют
5. `git grep -n "AudioEngineV2" src/ -g '!*.test.*'` → 0 (кроме примечаний D-1) — сверка с reach 121

## НЕЛЬЗЯ

- НЕ трогать 186/54-класс поточно (по файлам: волна-ярлыки, перечневые доки — конвой D-2 после DOCS-EXECUTION-сверки)
- PLAN-v3.3 §2 (frozen-список с AudioEngineV2) — через Ц3 (паттерн устоявшийся)
- interaction-schema/architecture-map/handoff — эра, не трогать
- НИКАКИХ «v2 frozen core»-формулировок (док-канон умер вместе с файлом)

## Маршрут

003 (спека догона) → 003_2 лайт-стресс (класс отработан ×3) → приём 200 → 007 одним коммитом → ФВ-1 пары → конвой D-2 (только после сверки DOCS-EXECUTION 003_2) → **Д-4/финал: доки=код 100% после волны-ярлыка в 54 файлах**.

— 003 · пара 003+003_2 · догон D1+ на столе · 2026-09-03
