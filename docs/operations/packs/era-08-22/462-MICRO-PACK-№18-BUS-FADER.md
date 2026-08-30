# 462-MICRO-PACK · №18-BUS + FADER · по спеке 006 v3.1 (DOC-CHECK 009: CONDITIONAL PASS → правки внесены)

**Источник истины:** `agent-registry/006-SPEC-MICROPACK-№18-BUS-FADER-v3.md` (читать ВМЕСТЕ с этим файлом).
**GO юзера:** красный фейдер (GROUP 3 H3.4).
**Порядок:** GROUP 1 → checkpoint → GROUP 2 → checkpoint → GROUP 3 → checkpoint → GROUP 4 → полный прогон.
**Канон после КАЖДОЙ группы:** tsc 314 (diff IDENTICAL) · vitest files 61/63 (2 legacy load-error), tests 749/749.
**❄️ Frozen:** AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts, существующие приватные _-поля.

## Чеклист групп
- [x] **G1** HybridPipelineService: _busVolumes/_crashedStems/_deadStems поля; crash двусторонний (:220 хендлер + _effectiveGainOf первая строка + play :272/seek :349 гварды); setBusVolume/getBusVolume API; формула raw×busFactor в _effectiveGainOf; busOf() хелпер (BUILTIN_STEMS роли, unknown→music-bus, instrumental→null); loadStem tail (_applyEffectiveGain в успехе, _deadStems в catch/no-slot).
- [x] **G2** Гигиена raw: applyAll пишет RAW (не effective); resyncV3 удалить (+тест TC-005 синхронно из stem-engine-sync.test.ts); main.tsx:299-305 «gains restored» УДАЛИТЬ; main.tsx:235 коммент; NaN-гарды stem.store:216-219 и pipeline :482-485.
- [x] **G3** Store+Sync+FADER: stem.store busVolumes слайс + setBusVolume экшн; EngineStateSnapshot += busVolumes; diffAndApply проводка V3/V2; stemsEnabled глушит music+backing (+applyAll cold-load страховка H3.3b); **ControlDeck красный фейдер dual-mode (H3.4 — GO юзера)**.
- [x] **G4** bootAether мини-гард 4 методов ae.*; Bus Volume Model декларация в паке; строка закрытия A2; 10 тестов минимум (clamp/NaN, формула×solo, static-grep whitelist, порядок setBusVolume ДО loadStem, crash двусторонний, NaN store, регресс №18, V2-path safeDelegate, cage-инвариант, dual-mode маршрутизация).

## Отложено (НЕ в этом паке)
Отдельные bus-фейдеры UI · fx-bus · pan · гейтинг остального ae.* surface · дедуп Effects · ремап scenarioMixOverride.

---

# ОТЧЁТ О ВЫПОЛНЕНИИ (Operator, GROUP 4 H4.2)

## Bus Volume Model (декларация)
`effective = clamp01(raw) × busFactor`, где `raw = _stemRawVolumes[stemId]` (пользовательский фейдер стема, пишется ТОЛЬКО applyAll/diffAndApply из стора — single-writer), `busFactor = getBusVolume(busOf(stemId))`.
Шины: `music-bus` (drums/bass/keys/guitar/other/backing), `vocal-bus` (vocals). Исключение: `instrumental` → `busOf()=null`, фактор 1.0 (master clock-tap инвариант A2.25 — не глушился шинами никогда). Unknown-стемы парятся к `music-bus` (паритет V2 AudioEngineV2.ts:1152).
Crash/dead: `_crashedStems`/`_deadStems` → effective 0 безусловно; resurrection только через успешный reload (`loadStem` tail), play/seek не воскрешают.
Хранение busVolumes: zustand slice (`stem.store`) + `_busVolumes` в pipeline (Map), НЕ сбрасывается `reset()`/`initStems`/`clearStems` (user-pref, паритет V2).
Проводка: store.setBusVolume → diffAndApply → V3 `pipeline.setBusVolume(id, v)` / V2 `safeDelegate(v2,'setBusVolume', id, v)`; coldSync/applyAll включают bus-секцию.

## Строка закрытия A2
Ответ A2: двойной writer существовал — coldSync (stem-engine-sync.ts:227) писал effective→raw (resyncV3 :297 — мёртвый код). Устранён Шагом GROUP 2 настоящего пака.

## Применённые изменения по группам
- **G1** `src/audio/engine-v3/pipeline/HybridPipelineService.ts`: поля `_busVolumes/_crashedStems/_deadStems`; crash-handler пополняет `_crashedStems` (:220); `_effectiveGainOf` — первая строка 0 для crashed/dead + формула clamp(raw)×busFactor; play (:272)/seek (:349) гварды воскрешения; API `setBusVolume/getBusVolume`; хелпер `busOf()` (+import BUILTIN_STEMS); loadStem tail: успех → delete dead/crash + `_applyEffectiveGain`, catch/no-slot → `_deadStems.add`. Плюс H2.5 pipeline-side NaN-гард в setStemVolume.
- **G2** `applyAll` пишет RAW; `resyncV3` удалён целиком (+синхронно TC-005 из stem-engine-sync.test.ts); заодно удалены ставшие мёртвыми `effectiveGain()` и `MUSIC_STEMS` (tsconfig noUnusedLocals:true держит канон 314 — MUSIC_STEMS возвращён в G3 как потребитель H3.3/H3.3b); main.tsx «gains restored» блок удалён (факт. ~297–304; строка 305 `monitorEngine.setBackendMode('v3')` сохранена — off-by-one спеки, намерение = удалить только gains-block); коммент на :235; NaN-гарды stem.store setStemVolume.
- **G3** stem.store: слайс busVolumes + экшн setBusVolume (NaN-гард+кламп); EngineStateSnapshot.busVolumes во всех билдерах (subscribe/coldSync/snapshot); diffAndApply bus-секция после volume-loop (V3/V2 ветки); stemsEnabled V3-ветка: mute-цикл по MUSIC_STEMS через pipeline.setStemMuted (vocals/instrumental нетронуты) + страховка в applyAll (H3.3b); ControlDeck красный фейдер dual-mode (`src/components/ControlDeck.tsx`): V3+music-stems → setBusVolume('music-bus'), иначе V1/V2 → ae.setInstrumentalVolume + всегда зеркало setStemVolume('instrumental').
- **G4** bootAether мини-гард 4 методов ae.* (__v3Active → DEV-warn+return; self-contained блок перед before-track-change листенером; принято: assumes VITE_ENGINE=v3, в v2-конфиге patchV1WithV2 перезапишет обёртку позже); настоящая секция документации.

## Тесты (H4.3, 13+3 новых, все зелёные)
`src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts` (13): clamp/NaN таблица vs V2 · формула-матрица ×solo/mute/isolation/instrumental-инвариант/unknown→music-bus · setBusVolume ДО loadStem (порядок не важен) · crash двусторонний (handler→0, play/seek не воскрешают — дискриминатор .gain.value===1 при raw 0.42, reload воскрешает) · dead-stem chunkedLoad-reject → 0 → reload resurrect · регресс №18 (фейдер 37% переживает reset/initStems/clearStems) · single-writer static-grep (?raw: ровно 3 записи stretchGain.gain.value — 1 benign + 2 под crash-гвардом; единственный writer stem.volume) · NaN-гарды стора · H4.1 контракт-зеркало гарда (passthrough/blocked/cage-канал свободен) · dual-mode маршрутизация зеркалом ControlDeck (BUILTIN_STEMS роли).
`src/foundation/reactions/__tests__/stem-engine-sync.test.ts` (+3): V2-path safeDelegate('setBusVolume') + idempotent · V3-path pipeline.setBusVolume проводка · H3.3 stemsEnabled mute-цикл (music+backing only, vocals/instrumental нетронуты).

## Принятые риски
- N3 ordering: setBusVolume до loadStem безопасен (factor применяется в момент _applyEffectiveGain) — покрыто тестом.
- Off-by-one main.tsx :305 (см. G2 выше) — удалено ровно то, что задумано.
- bootAether-гард самодостаточен в v3; v2-конфиг перезапишет обёртку патчем позже — поведение V2 не меняется (cage-канал V2Adapter.delegateSync не оборачивается, покрыто тестом).

## Итог полного прогона (FULL RUN)
- `tsc --noEmit`: **314 ошибок** — канон, diff IDENTICAL ✓
- `vitest run`: files **62 passed / 2 failed (64)** — 2 failed = прежние legacy load-error ✓; tests **763/763 passed** (baseline 749 + 14 новых − 2 удалённых TC-005; превышение baseline ожидаемо и допустимо).
- Все чекпоинты G1–G4 PASS.