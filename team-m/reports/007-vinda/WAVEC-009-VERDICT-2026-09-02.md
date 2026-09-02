# WAVEC-009 · ВЕРДИКТ НЕЗАВИСИМОГО СУДА (спека Волны C v2)

**009 · 2026-09-02 · HEAD 2080f70 · 5 сверок выполнены лично (rg/sed/статика).**

## ВЕРДИКТ: РЕШЕНО С УСЛОВИЯМИ

Ядро спеки дыр не имеет: Δ-математика замкнута (290−8=282, 808−5=803, 69−2=67, тесты 2+3=5 верифицированы по it()), замок принудителен (check-frozen.mjs:22-26 ERROR + SKIP_RE:41 только тесты), residue-7 тождествен У-1 (32 ключа карты − 25 подписок), mode-switch=(б) подтверждён (0 импортёров, beLiveSwitchMode = mode-switch.service:247, читатели через ?.), паритет-v2 достижим на HEAD (16 обёрток не-live имеют сигнал, plate = единственный knownGap).

## УСЛОВИЯ (оба — данные в коммит #0, не код)

1. **bridge-manifest.json: 18 → 20 записей.** Добавить: **exercise-events** {wrapper: exercise-events.ts, status: live, inBoot: true} — ЖИВОЙ В БУТЕ (main.tsx:18 импорт + :61 registerInit, тот же паттерн, что takes-events из У-2) · **block-editor-events** {wrapper: block-editor-events.ts, status: orphaned-wrapper} — экспорт только wrappers/index.ts:16, 0 вызовов init (класс mode-switch-events). Без них «полная инвентаризация» ложна — Волна D построит план retire по неполной карте.
2. **residueAllowlist = 7 ключей + prefix practice:*, НЕ «8»:** sync-editor-closed ОТСУТСТВУЕТ в LEGACY_EVENT_MAP (facade.ts:31 «ИСКЛЮЧЕНО как RESIDUE»; карта = 32 ключа) — «8» кладёт в манифест мёртвую запись (класс «10 GREEN»).

## УТОЧНЕНИЕ-3 (не блокер)
wrappers.smoke.test.ts живёт в src/foundation/event-bus/__tests__/ (НЕ bridges/__tests__) → не сносится, его 3 теста НЕ входят в Δ-5; переименование describe :8/:17/:25 в #15 корректно и достаточно.

## ГОТОВНОСТЬ: ДА — после внесения условий 1-2 в #0 (5 минут данных, без пересмотра архитектуры). От Никиты: явный GO на волну C (OVERRIDE-протокол graveyard-замка).

— 009 · финал цепи · цепь: скаут-007 → 001-К1 → 002-К2 → 001-К3-финал → 009-вердикт
