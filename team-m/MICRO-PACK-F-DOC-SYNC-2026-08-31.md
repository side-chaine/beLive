# MICRO-PACK · ПАКЕТ F: ДОК-СИНХРОН (Д-1 «Доки-100», директива ФУНДАМЕНТ-100) · 2026-08-31

**Версия:** v2.0 — финал пары: v1.2 (стресс 002, 12 условий) + **F-13 от 003_2** (8 E-хвостов, принят 200 LOG 23:40; факт-чек 003 подтверждён 8/8) + 2 микро-правки 003_2 к F-9-3. Автор v1.2 признаёт прокол: собирал не перечитав канал — посты 003_2 23:03-23:12 уже содержали F-13 (урок: перед сборкой — перечитай канал пары!).
**Автор:** 003 (Док_Аудит, миссия-3) · **Стресс:** 002 ✅ · **Фураж:** DOC-SYNC-MAP + скаут-N (engine-v3 инвентарь) + факт-чеки 003
**Статус:** ГОТОВ К ПРИЁМУ 200 (для 007 — НЕ ПРИМЕНЯТЬ до приёма 200 → GO 🔴; 003 не правит)
**HEAD-SSOT на момент сборки:** `38338a3` (E применён в `15d466e`) · канон: tsc=290 🔴 · vitest=808+0int+0load 🟢 (69) · PARITY PASS 🟢 · frozen 21×SHA

**Цель пака (гейт Д-1):** живых РАСХОДИТСЯ = 0 в docs/. Пак синхронизирует тексты с кодом; сноса нет; pending-решения честно помечаются ярлыками (остаются 🔴 Никиты).

---

## F-1. transport-v3.md — rewrite перечня (зоны: **:4 + :28-47 + :85**)

**Было:** :4 шапка «15 модулей engine-v3/» · :28-47 плоский перечень 15 модулей (6 фантомов: VocalMixV3, MicrophoneV3, CrossfadeV3, CaptureBusV3, MeterNodeV3, RateParamV3 — файлов/классов нет, glob пуст; 002-условие-1 [БЛОКЕР]) · :85 «V3 имеет собственные модули (StemPlayerV3, LoopEngineV3, VocalMixV3, MicrophoneV3, CaptureBusV3 и др.)».

**Стало:**
- **:4:** «✅ PRODUCTION (30 модулей в 8 слоях engine-v3/, V2Adapter — мост к frozen V2)»
- **:28-47:** секция «## EngineV3 — состав (8 слоёв · 30 модулей · ~4 900 строк)» с деревом (ниже)
- **:85:** «V3 имеет собственные модули (StemPlayerV3, LoopEngineV3, DuckGuardV3Native и др.), но AudioContext — единый (V2 через V2Adapter)»

**Дерево (скаут-N, двойная верификация 002: LOC сошлись слой-в-слой):**
```
src/audio/engine-v3/           # 30 prod .ts/.tsx · 4914 LOC (+10 тест-файлов · 1817 LOC)
├── core/        4 файла 635   # TransportV3 317 · HybridClock 176 · StemOrchestrator 134 · types 8
├── pipeline/    6 файлов 1509 # HybridPipelineService 745 · StretchInstancePool 279 · StretchInstance 221
│                            #   StemChain 152 · IPipelineController 73 · HybridLoopStrategy 39
├── monitor/     5 файлов 893  # MonitorEngine 285 · MonitorRouter 283 · AutoMixController 120
│                            #   PulseCalibrator 114 · DeviceManager 91
├── integration/ 6 файлов 691  # V3DataInterceptor 250 · V3StatePublisher 202 · LoopEngineV3 88
│                            #   DuckGuardV3Native 66 · AudioCrashModal 64 · useAudioContextHealth 21
├── stems/       1 файл 344   # StemPlayerV3
├── services/    2 файла 164  # MicSourceV3 95 · RateThrottler 69
├── diagnostics/ 2 файла 390  # CaptureWorklet 264 · DuplicateAudioRouteChecker 126
└── корень       4 файла 288  # index 59 (getTransport) · V2Adapter 83 · IV2PublicContract 115 · vendor .d.ts
```
> Сноска (002-условие-11): «Счёт = production .ts/.tsx. Диагностический harness (~20 файлов .mjs/.json в diagnostics/) и тесты в счёт модулей не входят.»
> Таблица переноса имён (историческая, в док одной строкой): TransportV3→core/ · types→core/ · StemPlayerV3→stems/ · LoopEngineV3→integration/ · DuckGuardV3→integration/DuckGuardV3Native (замена, см. F-4.3) · V2Adapter, IV2PublicContract, index — корень. 6 фантомов в доке не упоминать.

## F-2. audio-engine.md — rewrite секции EngineV3 (зоны: **:15 + :1043-1059**)

**Было:** :15 «EngineV3: 7 production modules (TransportV3, V2Adapter, DuckGuardV3, MeterNodeV3 + support)» · :1043-1059 «7 production modules, 7 archived → src/legacy/engine-v3/» (путь мёртв — снесён W4) + перечни с фантомами.

**Стало:**
- **:15:** «EngineV3: 30 модулей в 8 слоях (core/pipeline/monitor/integration/stems/services/diagnostics + корень), ~4 900 строк — см. § EngineV3»
- **:1043-1059:** заголовок «## EngineV3 — Production Layer (post-W6, ARC-2c/d/e)»; текст: «30 модулей в 8 слоях, ~4 914 строк. V3 — дефолт с 28.08 (миграция финиширована, PROD-push `780db23`); V2 frozen-ядро остаётся в кодовой базе до полного вывода (M5 ⬜ — план Ц3, PLAN-v3.3 §0/§1).» + то же дерево, что в F-1. Секцию «Archived (7 → src/legacy/engine-v3/)» удалить; вместо неё строка истории: «7 ранних модулей W1-эры: часть влита в слои, часть снесена W4/W5; src/legacy/ убран из дерева.»
- ⚠️ (002-условие-5) Формулировка «runtime authority» ИСПОЛЬЗОВАНА БЫТЬ НЕ ДОЛЖНА — §2 PLAN-v3.3 говорит только «frozen = только чтение»; канон-нарратив: V3 = дефолт, V2 = frozen-хвост до M5.

## F-3. eventbus-цифра 29 → 28 (минимальные правки + 2 README)

**Факт (двойной пересчёт 003-python + 002):** union = **28 событий** (Audio 10 · Sync 8 · Catalog 4 · UI 3 · Track 2 · Practice 1 — `practice:state-changed`, единственное с двоеточием). Файлов event-bus = **33**.

| # | Файл:строка | Было → Стало |
|---|---|---|
| F3-1 | docs/architecture/eventbus-v2.md:2 | «6 каналов, 29 событий» → «6 каналов, 28 событий» |
| F3-2 | docs/architecture/eventbus-v2.md:31-32 | Practice 2 → 1 (`practice:state-changed`); **Total 29 → 28** (строки :26-30 уже верны — не трогать, 002-условие-8) |
| F3-3 | docs/architecture/eventbus-v2.md:39 | «29 типизированных payload'ов» → «28 типизированных payload'ов» |
| F3-4 | docs/architecture/README.md:11 | «6 каналов, 29 событий» → «6 каналов, 28 событий» (скрытый потребитель, 002-условие-6) |
| F3-5 | src/foundation/event-bus/README.md:4 | «6 channels, 27 typed events», audio=9 → «28 typed events», audio=10 (+`seek-position-changed`; 002-условие-6, строка в паке — Д-1 честно = 0 в docs/ + src-README) |

## F-4. BELIVEBASE-CHARTER.md — паспорт + честные статусы «На слом» (:63, :209-215)

1. **:63:** «34 файла, 6 каналов, 27 событий» → **«33 файла, 6 каналов, 28 событий»**
2. **:212 SoundTouch (pitch/):** → «SoundTouch-стрейч удалён (S1/Signalsmith-фикс); каталог pitch/ жив в рантайме (yin-детекция — не SoundTouch)» (002-условие-4: формулировка «живёт в research/» была ЛОЖЬЮ — pitch/ импортируется рантаймом: pitch.store.ts, PitchTab.tsx, PianoKeyboard.tsx; rg «audio/pitch» по src/ — 4 живых файла)
3. **:213 Bridges:** → «❄️ FROZEN до полного вывода (frozen-zones-v2.md — 4 зоны); EventBus-обёртки взяли функцию (24→19), физический снос — только по OVERRIDE Никиты»
4. **:214 DuckGuardV3 (singleton):** → «Заменён: singleton снесён (W3 DELETE), жив native-вариант — integration/DuckGuardV3Native» (002-условие: «переименован» неточно — разные реализации)
5. **:215 main.tsx SoundTouch тесты (430 строк):** строку удалить — rg SoundTouch по src/main.tsx = 0 (подтверждено 002)

⚠️ Правки — текстовая маркировка в доке; код/FROZEN не трогаются. 002 red-flag-проверку прошёл: «к правке кода не ведут, двусмысленности нет».

## F-5. docs/sync — 2 yaml: шапки-комментарии HISTORICAL

В оба yaml (MASTER-SYNC-REGISTRY.yaml, DOC-TC-BACKLOG.yaml) под шапкой: `# ⚠️ HISTORICAL (31.08): снапшот эры синка 2026-06/07. Живой SSOT — team-m/SHARED-REGISTRY.md. CI-гейт doc-sync-check.yml инертен (судьба — 🔴).` Записи внутри и CI-файл не трогать.

## F-6. GOVERNANCE-FINAL-FREEZE-01.md — шапка HISTORICAL

Под шапкой: «> 🗄️ HISTORICAL (31.08): июньский базлайн. Живая матрица владения — docs/governance/DOMAIN-OWNERSHIP.yaml (1:1 с §8.2); координация — team-m/SHARED-REGISTRY.md §0.» §8.2 и тело не трогать.

## F-7. Срезы мёртвой ветки — ярлыки

- **01-BASELINE.md (:1-8):** «> 🗄️ HISTORICAL SNAPSHOT (31.08): срез ветки 067-e-regime-0, HEAD d5c66bd — коммит не существует в истории (git cat-file); tsc=307 среза ≠ канон 290. Живой канон-снапшот — SHARED-REGISTRY.»
- **00-ROADMAP.md (:4-8):** к статусу DRAFT приписка: «· волны W1-W6 применены 28.08 на другой линии (миграция финиширована); этот план — исторический срез 067-e-regime-0.»
- **MISSION-ZERO-REPO-SCAN.md (:1-3):** одна строка-ярлык (аналог BASELINE).

## F-8. PLAN-v3.3-CANONICAL.md — приписка к §1 (фронт Ц3)

К заголовку «## §1. ФАЗЫ И СТАТУСЫ (на 25.08)» приписка: «*(апдейт 31.08: волны W1-W6 применены, миграция финиширована, PROD-push `780db23` — см. team-m/REGISTRY.md:43-45; M5/E7/GO пересматривает Ц3)*».
⚠️ **§1-тело (:14-25) не трогать вовсе** (002-условие-9: проза-статусы — живой план Ц3; клейм «M3/M4 закрыты» в приписку НЕ включать — M4-закрытие REGISTRY:43-45 не подтверждает).

## F-9. Мелочь (контент-якоря, 002-условие-2)

1. **docs/INDEX.md:31** (актуальная строка post-E): «scenario-stage-state-model» → путь `archive/superseded/scenario-stage-state-model.md` (файл там ✅)
2. **docs/INDEX.md:59** (актуальная): строку «ARCH-BASE.md» удалить (файл отсутствует, gitignored-эра)
3. **performance-quality-system.md:354-357 (список scheduler-участников):** «trigger.bridge» → «trigger-visual.service» (реальный регистрант, :148-151); из того же списка вычистить «performance.bridge» (retired, App.tsx:26) и «billy.bridge» (фантом, жив billy.service — initBillyBridge:47-51 registerWriter). **Итоговый список после правки: «trigger-visual.service · stem-reactive.bridge»** — ⚠️ stem-reactive.bridge — ЖИВОЙ регистрант (bridge.ts:196-197 registerDetector/registerWriter, подключён main.tsx/App.tsx), НЕ вычищать! (микро-2 от 003_2)
4. ⚠️ Номера строк могли уехать с E-коммитом — при применении искать контент-якорями («scenario-stage-state-model», «ARCH-BASE», «trigger.bridge»), не вслепую по номерам.

## F-10. ADR-0015 — ярлык актуализации (подтверждён 002)

Под статусом-строкой шапки: «> ⚠️ АКТУАЛИЗАЦИЯ (31.08): живой носитель frozen-карты — `docs/architecture/frozen-zones-v2.md` (4 зоны: AudioEngineV2, patchV1, bridges/*, track.orchestrator). Механизм .frozen-zones.json/check-frozen.mjs из этого ADR не внедрён (glob пуст; судьба — 🔴). Инлайн-список ниже — исторический срез W1 (одна зона на тот момент).»

## F-11. SRI-PATCH.md + ADR-0008 — честные статус-ярлыки

- **SRI-PATCH.md (шапка):** «> ⚠️ СТАТУС на 31.08: НЕ применён — index.html содержит 0 integrity-атрибутов (rg-факт). Применять/закрыть — 🔴 Никиты (SEC-контур).»
- **ADR-0008 (шапка):** «> ⚠️ SRI-ветка не применена (0 integrity в index.html); CSP НЕ внедрён (нет ни в public/_headers, ни в meta index.html — проверено 31.08).» ⚠️ (002-условие-3: прежняя формулировка «CSP действует по факту» была ЛОЖЬЮ — в _headers 21 строка, CSP-строк 0.)

## F-12. ADR-0007 — приписка частичного исполнения

«> ⚠️ Исполнение частичное (31.08): BAC-109 console-гигиена (~363 вызова — источник team-m/REGISTRY.md:43) — в очереди bLb-hygiene; единый логгер не доведён.»

## F-13. E-хвосты + дельта-003_2 (8 правок; автор: 003_2, принят 200 LOG 23:40; факт-чек 003: 8/8 подтверждено на HEAD `38338a3`)

| # | Файл:строка (контент-якорь) | Было → Стало |
|---|---|---|
| F-13a | docs/governance/DOMAIN-OWNERSHIP.yaml:82 (якорь «slot-matrix.types») | `path: src/slot-matrix/slot-matrix.types.md` → `path: src/slot-matrix/slot-matrix.types.ts` (баг E: файл .ts; комментарий E1-5 сохранить) |
| F-13b | team-m/WEB-CHAIN-PACK.md:135 (якорь «product-protocol-v2.1») | `docs/product-protocol-v2.1.md` → `docs/archive/superseded/product-protocol-v2.1.md (архив)` (соседние MAC-PC-строки E репоинтнул, эту нет) |
| F-13c | docs/INDEX.md:3 (якорь «Last updated») | `2026-06-10` → `2026-08-31` (E заявлял в коммит-месседже 15d466e, не сделал) |
| F-13d | docs/architecture/slot-matrix-system-v2.2.md:1 (вставка 2-й строкой перед H1) | `> 🗄️ HISTORICAL (redirect 31.08): содержимое = Styles System (не Slot Matrix, бан 2026-05-20); живой носитель контракта — src/slot-matrix/slot-matrix.types.ts; индексы почищены E1-5.` |
| F-13e | docs/architecture/character-layer.md:23 + :37 | :23 `src/__tests__/layer2-report-emitter.test.ts` → `src/character/__tests__/layer2-report-emitter.test.ts`; :37 `js/ai/settings` → `src/js/ai/settings` (2 хвоста E-правки префиксов) |
| F-13f | docs/architecture/metrics-system.md:164 (якорь «Репетиции») | `metrics.bridge → metrics.store` → `metrics-sync.service → metrics.store` (согласовано с :208) |
| F-13g | docs/auto-lyrics/MASTER-ARCHITECTURE.md:387 + ONBOARDING-PATH.md:161 | `2142 строки` → `2152 строки` в ОБОИХ файлах (wc -l = 2152, двойная верификация 003_2 rg + 003 wc) |
| F-13h | team-m/ROADMAP-REPO-TO-CITY-2026-08-30.md:4 | `HEAD-SSOT: d024a41 · tsc=293 · vitest 779+0int+0load` → `HEAD-SSOT: 38338a3 · tsc=290 🔴 · vitest 808+0int+0load 🟢 (69)` |

---

## Гейты применения (007, после приёма 200 → 🔴/GO)

1. `tsc=290` (0 дельты — правки только .md)
2. `vitest=808+0int+0load` (69)
3. **Фантом-гейт (зоны расширены — теперь честный 0):** `rg -n "VocalMixV3|MicrophoneV3|CrossfadeV3|CaptureBusV3|MeterNodeV3|RateParamV3|DuckGuardV3\b" docs/architecture/transport-v3.md docs/architecture/audio-engine.md docs/BELIVEBASE-CHARTER.md` → **0** (`\b` не ловит легитимный DuckGuardV3Native — 002-условие-12)
4. **Число-гейт (расширен):** `rg -n "15 модулей|29 событий|27 событий|34 файла" docs/architecture/transport-v3.md docs/architecture/README.md docs/architecture/eventbus-v2.md docs/BELIVEBASE-CHARTER.md` → 0; `rg -n "27 typed events" src/foundation/event-bus/README.md` → 0
5. **Legacy-гейт:** `rg -n "src/legacy/engine-v3" docs/architecture/audio-engine.md` → 0
6. **Смоук:** INDEX открывается; :31 → superseded-путь, :59 удалена; performance-quality-список = «trigger-visual.service · stem-reactive.bridge» (stem-reactive НЕ тронут!); 3-4 изменённых дока глазами
7. `frozen-guard` GREEN (правки только .md; код/FROZEN не тронуты)
8. **(F-13-гейты, от 003_2):** `rg -c "2142" docs/auto-lyrics/` → 0 (обе правки легли) · `rg -n "types\.md" docs/governance/DOMAIN-OWNERSHIP.yaml` → 0 · `rg -n "docs/product-protocol" team-m/WEB-CHAIN-PACK.md` → 0 (только архив-путь) · `rg -n "Last updated" docs/INDEX.md` → дата 2026-08-31 · `sed -n '2p' docs/architecture/slot-matrix-system-v2.2.md` → HISTORICAL-редирект на месте

## НЕЛЬЗЯ

- НЕ трогать код и FROZEN-зону (F-4/F-10/F-11 — текст-маркировка в доках; двусмысленность → стоп-вопрос)
- НЕ трогать §1-тело PLAN-v3.3 (:14-25) — только приписка к заголовку §1
- НЕ чинить CI doc-sync-check.yml (судьба — 🔴)
- НЕ трогать yaml-записи истории (F-5 — только шапка-комментарий)
- НЕ сносить ничего; строки F-4:215 и F-9-2 удаляются как устаревшие строки-указатели (файлы-цели не существуют), не как снос контента
- Номера строк INDEX/performance-quality — применять контент-якорями (могли уехать)
- «runtime authority» в формулировки НЕ возвращать (002-условие-5)

## Маршрут

003 (спека v2.0 — сборка пары) → ~~стресс 002~~ ✅ (12 условий внесены, факт-чек атак подтверждён) → ~~F-13 от 003_2~~ ✅ (принят 200, факт-чек 003 8/8) → **приём 200** (проверка F-8 с Ц3) → 007 (применение) → **DOC-CHECK 003 + ревиз 003_2** (пара: две пары глаз) → гейт Д-1: `живых РАСХОДИТСЯ = 0` → UNLOCK города.

## Статус Д-1 после F v2.0

E + `15d466e` закрыли 10 · F v2.0 закрывает остаток: transport-v3 (:4/:28-47/:85), audio-engine (:15/:1043-1059), eventbus ×4 файла + src-README, CHARTER-паспорт+статусы, sync-yaml, GOVERNANCE, BASELINE/ROADMAP/MISSION-ZERO, PLAN-приписка, INDEX ×2 + дата, performance-quality-список, ADR-0015/0007/0008-SRI, **+ F-13: E-хвосты (DOMAIN-OWNERSHIP .md-баг, WEB-CHAIN-PACK, INDEX-дата, slot-matrix-шапка, character-layer ×2, metrics:164, auto-lyrics ×2, ROADMAP-шапка)**. **После применения = 0 живых расхождений доки↔код; pending-решения честно помечены.**

— 003 · Док_Аудит · миссия-3 · **v2.0 — сборка пары 003+003_2** · 2026-09-01

---

# F-14 · ДОВОДКА (двойной DOC-CHECK пары 003+003_2 после применения `21a72fc`/`ffc4bac`) · 2026-09-01

**Статус:** 4 хвоста нашёл 003_2 (Ф-3, LOG 07:03) + 5-й — 003 (независимый DOC-CHECK 07:1x: задвоение в :4, 007 журналировал «скрипт вставил рядом» — скобочный хвост остался). Оба верифицированы sed/rg лично. Правки — один коммит 007.

| # | Файл:строка (якорь) | Было → Стало |
|---|---|---|
| F14-1 | docs/architecture/eventbus-v2.md:32 (якорь «Total») | `\| **Total** \| **29** \|` → `\| **Total** \| **28** \|` (003_2: жирный 29 жил, гейт-4 слеп к `**29**`) |
| F14-2 | docs/INDEX.md:31 (якорь «scenario-stage») | путь → `archive/superseded/scenario-stage-state-model.md` (F-9-1 не легла) |
| F14-3 | docs/INDEX.md:59 (якорь «ARCH-BASE») | строку удалить (файл не существует; F-9-2 не легла) |
| F14-4 | docs/architecture/performance-quality-system.md:353-357 (якорь «Участники scheduler») | список «trigger.bridge / performance.bridge / billy.bridge» → «trigger-visual.service · stem-reactive.bridge» (F-9-3 не легла; stem-reactive ЖИВ — не тронуть; итог по микро-2 от 003_2) |
| F14-5 | docs/architecture/transport-v3.md:4 (якорь «PRODUCTION») | задвоение скобок починить: `✅ PRODUCTION (✅ PRODUCTION (30 модулей в 8 слоях engine-v3/, V2Adapter — мост к frozen V2) engine-v3/, V2Adapter как fallback для frozen)` → одну чистую строку: `✅ PRODUCTION (30 модулей в 8 слоях engine-v3/, V2Adapter — мост к frozen V2)` (нахождение 003: DOC-CHECK 07:1x — старая формулировка «как fallback» не вырезана, «fallback» ещё и устарел семантически: V2Adapter — мост, не fallback-режим) |

**Усиление гейтов (к п.8 гейтов спеки):**
- Гейт-4+: `rg -n "\*\*29\*\*" docs/architecture/eventbus-v2.md` → 0 (жирные цифры ловим)
- Гейт-3-фикс (дефект, 003_2 п.3): паттерн `DuckGuardV3\b` ловит 2 легитимных упоминания, предписанных спекой (transport-v3:79 истор-таблица переноса + CHARTER:214 честный статус) → уточнение: `rg -n "DuckGuardV3\b" <файлы> | grep -v "DuckGuardV3Native\|histor\|Заменён"` → 0; либо перенести DuckGuardV3-строку из фантом-гейта в число-гейт с тем же grep -v.

**После F-14:** двойной DOC-CHECK пары повторно → гейт Д-1 «живых РАСХОДИТСЯ = 0» закрыт честно → 200 → UNLOCK.

---

# F-15 · ХВОСТЫ-2 (находки 201 от 07:00/07:13, вынесенные из F-14 по Варианту-А) · 2026-09-01

**Маршрут-решение:** Вариант А (201, 07:13 §3, поддержка 003): F-14 уходит к 007 как есть (5 правок, уже собран) — UNLOCK не ждёт спорного; Х-2/Х-3 оформлены здесь отдельной доводкой. **⚠️ Х-3 — НЕ правка .md, а 🔴-задача на код+CI — вынесена в карточку Никиты через 200, в пак не входит.**

## Х-2 · Три числа frozen в живых доках (класс False-Green, 003_2 + 201 независимо)

| Источник (HEAD `ffc4bac`) | Число |
|---|---|
| docs/architecture/frozen-zones-v2.md:2 | «**17 файлов**, ~4 500 строк» |
| docs/architecture/README.md:15 | «**30 файлов**, ~6 932 строк» |
| BELIVEBASE-CHARTER.md:213 + ADR-0015:3 | «**4 зоны**» |

**Факт-чек 003 (01.09):** физический счёт frozen-зоны: AudioEngineV2 + patchV1 + track.orchestrator = 3 файла + **16 мостов** в src/bridges/ = **19 файлов** (плюс PLAN §2 расширяет: `_`-поля внутри frozen-файлов, vendor WASM — несводимо к счёту файлов). «4 зоны» — счёт ЗОН, не файлов — легитимная шкала, но в одном и том же доке нельзя смешивать без указания шкалы.

**Правки (2 строки + гейт):**
| # | Файл:строка | Было → Стало |
|---|---|---|
| F15-1 | docs/architecture/frozen-zones-v2.md:2 | «17 файлов, ~4 500 строк» → «**4 зоны · 19 файлов** (AudioEngineV2 + patchV1 + track.orchestrator + 16 мостов), ~5 299 строк (wc-факт 01.09: 3 ядра + 16 мостов)» — счёт по живому дереву 01.09 |
| F15-2 | docs/architecture/README.md:15 | «30 файлов, ~6 932 строк» → «**4 зоны · 19 файлов · ~5 299 строк** (синхронно с frozen-zones-v2.md:2)» |
| F15-3 | Гейт-4++ (усиление): `rg -n "\b17 файлов\b|\b30 файлов\b" docs/architecture/frozen-zones-v2.md docs/architecture/README.md` → 0; `rg -c "4 зоны" docs/architecture/frozen-zones-v2.md docs/architecture/README.md` → ≥1 в обоих (шкала «зоны» указана) |

**⚠️ Вопрос к 200/🔴 Никите (блокирует точную формулировку F15-1/2):** канон-число frozen — **4 зоны / 19 файлов** (факт-счёт 003 по живому дереву) или иная шкала (все `.gitkeep`? vendor)? Канонизация числа = условие Д-1 «доки=код 100%». F15-формулировки выше — по моему счёту; при ином каноне — заменить число, каркас правки тот же.

## Х-3 · 🔴 Заморозка не охраняется машиной — ВЫХОДИТ ЗА ФОРМАТ ПАКА (код+CI)

- ADR-0015:3 (ярлык F-10 честен): «Механизм .frozen-zones.json/check-frozen.mjs не внедрён» — `git grep check-frozen -- scripts .github` = пусто (201, 07:13 §2). **«frozen 0» в отчётах = вера, не проверка.**
- **Это 🔴-задача на код+CI** (создать .frozen-zones.json + check-frozen.mjs + CI-гейт), не правка .md — правки кода вне мандата 003 (bootstrap §5: «003 не правит код»; frozen-механизм к тому же в ADR-0015 помечен «судьба — 🔴»).
- **Действие 003:** внести в карточку 200 → 🔴 Никиты: «Д-5 God-object панель» уже есть в ФУНДАМЕНТ-100; добавить пункт «механическая охрана frozen (Х-3): .frozen-zones.json + гейт — отдельная мини-задача 007 после UNLOCK». До внедрения — каждый отчёт «frozen 0» снабжать припиской «по SHA-сверке, не по гейту» (практика 007 уже так делает — frozen 21×SHA).

## Х-4 · ⚪ Информационно (правки не требует, 201 §4)

SSOT доктрины: правила — `docs/architecture/architecture-doctrine.md`, факты — `frozen-zones-v2.md`; старый `architecture-map-2.1.md` §20 — SUPERSEDED, живых ссылок на него как на источник инвариантов оставаться не должно (скаут-O: в живых доках чисто).

## Гейты F-15 (для 007, после решения 🔴 по канон-числу)

1. Гейт-4++ (F15-3, выше) — зелёный
2. `rg -n "check-frozen" docs/modernization/ADR-0015-frozen-zone-policy.md` → ярлык «не внедрён» на месте (обновить формулировку только если механизм появится)
3. Канон Δ0 (правки 2 строк .md)

**Маршрут F-15:** 200 подтверждает канон-число (или уточняет 🔴) → стресс 002 (лёгкий, 2 правки) → 007 одним коммитом с F-14 (если 007 ещё не коммитил) или следом. UNLOCK не блокируется (Вариант А).
