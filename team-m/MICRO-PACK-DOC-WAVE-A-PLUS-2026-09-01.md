# MICRO-PACK · DOC-WAVE-A+: ДОГОН конвоя Волны A (хвосты, вскрытые ФВ-линией пары после `b0fa1d5`) · 2026-09-01

**Автор:** 003 (пара 003+003_2) · **Источник-находки:** 003_2 (вердикт по спорному-1: transport-v3:85 должен был идти в A; RAWDUMP-WAVE-BC: SSOT-расхождение event-bus/README) · **Факт-чек 003:** все 3 подтверждены sed по живому дереву `94b8cdb`
**Статус:** СПЕКА-ДОГОН (класс «доки отстали на <1ч» — ловим мгновенно, миссия-4) · стресс: лайт-проверка 003_2 (3 правки, якоря дословные) · 007 — в ближайший коммит
**HEAD-SSOT:** `94b8cdb` · канон: tsc=290 · vitest 808/69 · PARITY · frozen 18/18 машина

## Правки (3)

| # | Файл:строка (якорь) | Было → Стало |
|---|---|---|
| AW+1 | docs/architecture/transport-v3.md:85 (таблица «что frozen»: строка patchV1) | «\| `src/audio/compat/patchV1.ts` \| ❄️ FROZEN \|» → «\| `src/audio/compat/patchV1.ts` \| 🗑️ удалён 01.09, Волна A (мёртвый экспорт; памятник — frozen-manifest.json история) \|» — вердикт 003_2: строка «FROZEN» без файла = враньё с 12:51 |
| AW+2 | src/foundation/event-bus/README.md:55-60 (блок Frozen Zones) | ① строка «js/*.js ❄️» → «js-слой — снесён Волной A 01.09 (audio-engine.js, recorder-processor.js; живой фасад audio-facade-v3.js вне frozen)»; ② приписка после заголовка «Frozen Zones»: «Операционный канон — `frozen-manifest.json` (verify:frozen, 18/18) + док-SSOT `frozen-zones-v2.md`; списки ниже — срез на дату» (двойной указатель 003_2 — тот же паттерн, что предложен для PLAN/SYNC) |
| AW+3 | docs/architecture/audio-engine.md — контрольная точка | формулировка «(frozen, только чтение)» про AudioEngineV2 в шапке — БЕЗ изменений (F-2-канон); правка НЕ требуется, пункт = чек-протокол: применяющий 007 сверяет, что после A текст шапки не задет догоном (защита от коллизии с b0fa1d5-якорями) |

## Гейты

1. `rg -n "patchV1.*FROZEN|patchV1.*❄️" docs/architecture/transport-v3.md` → 0 (только «удалён»)
2. `rg -n "js/\*\.js ❄️" src/foundation/event-bus/README.md` → 0
3. `rg -c "frozen-manifest.json" src/foundation/event-bus/README.md docs/architecture/transport-v3.md` → ≥1 (указатели на SSOT-машину стоят)
4. Канон Δ0 · verify:frozen 18/18 не затронут (README вне манифеста)

## НЕЛЬЗЯ

- НЕ трогать frozen-zones/README-числа (b0fa1d5 уже всё поставил — не дублировать)
- НЕ менять AudioEngineV2-строки (док-канон F-2, до волны D)
- transport-v3:85 — правка ТОЛЬКО строки patchV1 (остальная таблица = волны C/D: AudioEngineV2/track.orchestrator-строки живут своей правдой до своих волн)

## Маршрут

003_2 вердикт + 003 факт-чек → спека → лайт-стресс 003_2 (подпись) → 007 ближайший коммит (можно вместе с В-1а v1.1 — файлы не пересекаются: transport-v3+event-bus-README vs 10 дока-файлов В-1а... ⚠️ В-1а тоже не трогает transport-v3 — чисто) → гейты AW+ → LOG-пара.

— 003 · по вердиктам 003_2 (спорное-1 принято: мой перенос в B был ошибкой — признано) · 2026-09-01
