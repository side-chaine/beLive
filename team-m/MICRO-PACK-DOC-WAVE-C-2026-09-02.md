# MICRO-PACK · DOC-WAVE-C: КОНВОЙ ВОЛНЫ C (15 труп-мостов, graveyard) · 2026-09-02 · НОЧНАЯ СМЕНА

**Авторы:** пара 003+003_2 (003 — спека; 003_2 — RAWDUMP-WAVE-BC §W4-сырьё + вердикт-совместная база) · **Фураж:** скаут-Q (ночной, very thorough: 38 файлов/200 вхождений, 3 слоя, 12 ловушек-фильтров) + FROZEN-AUDIT-301 (эталон bridge↔wrapper-пар :60-74) + скаут-P-хвосты
**Версия:** v2.1 — ночная сверка 003_2 (13:35, 6/7 зелёные → 3 уточнения внесены: rehearsal-DWC-6, тесты-сироты, w11-дефолт) поверх v2.0 (стресс 002, 7 условий). Фураж+: NIGHT-DOSSIER-PRESURVEY-CD 003_2 (матрица: SAFE×7 / РИСК×5 = known-gaps обёрток ДО сноса, коммит-1 = gaps+mode-switch-events-бут; rehearsal-trigger — ВНЕ Волны C). wc-факт 2181→**2198** (моя ошибка: live-guard=21 строка, не 3; 002-пересчёт: мосты-сумма 2347, 4545−2347=2198=2178+20; wc-пара 2199 — trailing-артефакт класса B), «removed»→только `"graveyard": {}` (краш Object.entries(undefined) — 002 прочитал скрипт), regex-дыра loop/mode-switch/audio-reactive, порядок **B++ → C**, контент-якоря везде, Соннет-цитата superseded раундом-2.
**Статус:** СПЕКА-КОНВОЙ v2 (ждёт: **сначала B++** [16 сед-строк, отдельный коммит — @007] → затем код Волны C 007 [⚠️ Соннет-раунд-2: **per-bridge, not batch** — HEAD-проводник ГОЛОВЫ по каждому мосту; разбиение решает 007] → доки = ОДНИМ коммитом с финальным код-коммитом) · **Верификатор:** 003_2 (ФВ-1 после применения)
**HEAD-SSOT на момент v2:** `f5b9318` (+10 от сборки v1: B++ НЕ применён [18 malformed живы — см. B++-пакет], D-CLN-1 в каноне, Никита-смоук V ПРОД) · канон: tsc=290 · vitest 808/69 · PARITY · frozen 17/17
**Объект Волны C (код, 007):** 15 graveyard-мостов (audio-reactive, audio, blocks, cover-theme, loop, lyrics, markers, mode-switch, mode, monitor, plate, stem-reactive, textStyle, time-sync, track — все src/bridges/*) + их тесты (аудит Д-2). После C: src/bridges/ = 1 файл (live-guard.ts). **Спорное решено (скаут-Q + манифест-канон):** stem-reactive.МОСТ = труп (0 импортёров, код не исполняется); живой регистрант = wrapper stem-reactive.ts:135-136; live-guard — НЕ сносится (guard-зона).

## DWC-1. Слой-1 ОПЕРАЦИОННОЕ ЯДРО (🔴 синхронно с волной — SSOT)

| # | Файл:якорь | Правка |
|---|---|---|
| DWC-1a | frozen-manifest.json: graveyard-блок (15 SHA) + note | graveyard → **`"graveyard": {}`** (⚠️ НЕ «removed»-ключ: checkBlock('graveyard', undefined) = TypeError-краш замка, 002-атака-2; пустой dict = «frozen OK: 2/2», exit 0 — проверено по скрипту) + note «после Волны C: guard 2, graveyard 0; 15 мостов — история». ⚠️ **Правка манифест-тела — в атомарном коммите 007 вместе с git rm мостов** (замок сам принуждает; конвой не трогает манифест до кода — иначе verify:frozen ERROR «отсутствует»). Предчек: `node -e "require('./frozen-manifest.json').graveyard"` |
| DWC-1b | docs/architecture/frozen-zones-v2.md:2-3 | «2 зоны · 17 файлов · ~4 545 строк» → «**2 зоны · 2 файла** (AudioEngineV2 + live-guard), ~2 198 строк (2178 + live-guard, wc на момент применения — 002-усиление: живая формула вместо константы)» + 🔒-строка «(17→2 после Волны C)» |
| DWC-1c | docs/architecture/frozen-zones-v2.md:27-39 (зона-таблица + «stem-reactive ❄️ в процессе retire» + «22/22 RETIRED») | зона src/bridges/* → «снесена Волной C 01.09 (15 труп-мостов по graveyard-манифесту; остался live-guard — guard-зона)»; stem-reactive-строку → graveyard-исход; счёт 22/22 → фактический |
| DWC-1d | docs/architecture/README.md:15 | «2 зоны · 17 файлов · ~4 545» → «2 зоны · 2 файла · ~2 198 (после Волн A+B+C: 17→2; формула 2178+live-guard; см. frozen-manifest.json)» |
| DWC-1e | src/foundation/event-bus/README.md:55-60 | «17/17» → «2/2 (guard)»; «ZERO TOUCH: src/bridges/* ❄️» → «src/bridges/ снесены Волной C (остался live-guard); wrapper-пары = замены — см. wrappers/» |
| DWC-1f | team-m/WAVE-FROZEN-INVARIANTS.md:9/:12/:32-34 | frozen-список → «guard: AudioEngineV2 + live-guard (после Волны C)»; check-команду под 2 файла; bridges-перечень → аннотация «снесены C» |
| DWC-1g | team-m/WAVE-EXEC-PLAYBOOK.md:10/:36/:51 | sha-инвентарь `find src/bridges` → live-guard одним путём (find по пустому каталогу падает — команда должна жить); «W4 Frozen НЕ трогать src/bridges/**» → «(снесены Волной C)» |
| DWC-1h | team-m/MICRO-PACK-FROZEN-GUARD-CI-2026-09-01.md:22-37 | graveyard-SHA-блок → «исполнен Волной C 01.09: 15 SHA в истории; guard 2» (док-спека FG-CI = историческая) |

## DWC-2. Слой-2 МЁРТВЫЕ ПУТИ-ЯКОРЯ (🟡 ~70 строк — паттерн «(снесён Волной C; замена — wrapper X)»)

| # | Зона (якоря по скаут-Q) | Правка |
|---|---|---|
| DWC-2a | **architecture-map-2.1.md** ⚠️ НО он SUPERSEDED/эра (моя карта: АРХИВ!) | ❌ НЕ ПРАВИТЬ (эра-канон пары: 301 §6 frozen-монолит — 🔴 #17 у Никиты). Скаут-Q дал 🟡 — отклоняю по карте: супрессед-док не конвоится. **В гейт-исключениях** |
| DWC-2b | interaction-schema-2.1.md (72 строки) | ❌ НЕ ПРАВИТЬ — SUPERSEDED (та же логика). В гейт-исключениях |
| DWC-2c | **живые доки с якорями-чтения (⚠️ ВСЕ — контент-якоря, номера = подсказка ДО B++; после B++ — ревификация):** Onboarding Route 2.1 («Inspect src/bridges/*.ts»-блок — переадресация на wrappers/: «инспект-список обновлён Волной C: живые обёртки audio-events, loop-events, position-sync, mode-events…») · slot-matrix-v2.2 (plate/textStyle-якоря → plate-events/text-style-events) · performance-quality:363-364 (stem-reactive.bridge → stem-reactive.ts wrapper; audio-reactive.bridge → audio-reactive.ts) · track-loading (таблица Bridges → wrappers; shorthand-формы «track.bridge» без .ts — regex-слепы, контролировать якорным листом) · zip:447-448 (track/cover-theme → track-events/cover-events) · block-first:910 · block-scenes:128/:137 · **n-stem — контент-якорь «все вхождения `.bridge` в доке» (~16 живых, не 4 заякорённых; TC-таблицы — аннотации по паттерну A)** · audio-engine (RETIRED-якоря честные — аннотация «путь мёртв с C» по паттерну A). **time-sync → position-sync: цель переадресации — по вердикту ГОЛОВЫ bridge↔wrapper-диффа** (301:74 «прямой замены нет» устарел, но дифф-слово — за ГОЛОВОЙ; в спеке — хедж) | Формула: `<мост>.bridge.ts:N` → `<мост>-events.ts:N (замена, Волна C снесла оригинал)` или аннотация-скобка |
| DWC-2d | w11-visual-boot-theming.md (16 вхожд. track/cover-theme, TC-таблицы) | аннотация-скобка «(снесён Волной C; замена track-events/cover-events)» — **дефолт 003_2 (13:35): скобки по класс-формуле DWC-2d, если 200 явно не отклонит** (диспатч 13:32 де-факто без исключений; при отклонении — снять. Снимается одной операцией, конвой не блокирует) |

## DWC-3. Слой-3 ПОЛИТИКИ/ЗОНЫ «src/bridges/* ❄️» (20 файлов — класс «зона исчезла»)

| # | Файлы | Правка |
|---|---|---|
| DWC-3a | BELIVEBASE-CHARTER:213 (Bridges «физ. снос — только по OVERRIDE») | → «✅ снос выполнен Волной C (OVERRIDE Никиты, 01.09); живая замена — EventBus-wrappers; live-guard — guard-зона» |
| DWC-3b | PLAN-v3.3 (контент-якорь «Срез на дату», :29 после B+) + SYNC-PROTOCOL (:6) | приписка B+ есть ✅ — обновить срез-строку до «после Волны C: guard = AudioEngineV2 + live-guard» (лёгкая правка даты-строки, Ц3-паттерн согласованный). ⚠️ характер-ai:156/ADR-0004:146/ADR-0015:17 — грепом не подтверждены (002): контент-поиск при применении |
| DWC-3c | центральные доки с зонными пометками: central-bridge:56, eventbus-v2:75, init-registry:70, show:470, block-scenes:536, character-ai:156, agent-governance-map:189, MAC-PC:62, SYSTEM-REPORT:84, MACRO-PACK:398, SONNET-13:222, STRATEGY-DUO:32/:162, team-m-setup:140, team-m-sync:47, ADR-0004:17/:105/:146, ADR-0015:3/:17, MISSION-ZERO:141/:154, 02-ANSWERS:203 | класс-формула одной строкой на файл: «src/bridges/* — снесены Волной C (graveyard-15; live-guard жив)» — точечно у каждой зон-строки. Эра-доки (MACRO/SONNET/STRATEGY/MAC-PC/SYSTEM-REPORT/team-m-*) — 🔴 решает 200: либо скобки, либо «эра, не трогать» (по нашей карте — эра; предлагаю НЕ трогать кроме заголовочных политик CHARTER/PLAN/SYNC/ADR-0015) |

## DWC-4. src-комменты (⚠️ зона 007 — конвой ДЕКЛАРИРУЕТ списком, не правит)

V3StatePublisher:128 (крупнейший: 4 FROZEN-пути → wrapper-пути) · App.tsx:92-103/:110-124 · main.tsx:3/:7/:9 · mode-switch.service:3 · track.loader:71 · lyrics.store:27 · useBackgroundManagers:149 · ThemeProvider:13/:25 · FullAvatar:23 · V3DataInterceptor:234 · MonitorRouter:170/:203 · event-bus/README:55-60 (это наш DWC-1e — док, наш) · **scripts/verify-bridge-parity.ts — BLOCKER-гейт: glob мостов после C = 0 → PARITY-гейт вырожден; 007 должен переключить паритет на manifest/эталон ДО применения (ловушка-11 скаута)** — код, зона 007.
**src/bridges/__tests__/ (2 теста-сироты: audio.bridge.test.ts, mode-switch.bridge.test.ts) — уточнение 003_2 13:35:** после git rm мостов сироты уронят tsc → в атомарный git rm Волны C (коммит-2 по матрице PRESURVEY), зона 007. Урожай Д-2 (201).

## DWC-6. ЯВНЫЕ ИСКЛЮЧЕНИЯ/ПАМЯТКИ (уточнение 003_2 13:35 + матрица PRESURVEY)

| # | Объект | Статус |
|---|---|---|
| DWC-6a | **rehearsal-trigger.bridge — ЖИВОЙ, ВНЕ Волны C!** (src/Rehearsal/bridge/, не src/bridges/; main.tsx:38 импорт + deep-link.service:91) | НЕ сносится в C; судьба — 301/ГОЛОВА (замена-writer не подключена — В-3-консалт 301). Конвой НЕ трогает его в доках отдельно; упоминания rehearsal-trigger-bridge — легит-имена живого |
| DWC-6b | **known-gaps обёрток ×5** (cover-theme/plate/markers/monitor/textStyle/track: TODO-заглушки, потерянные IDB-write/real-time-подписки) | НЕ блокер сноса (мосты не в буте!) — коммит-1 Волны C: 007 дописывает или честно помечает gaps; конвой-доки: wrapper-переадресации НЕ должны обещать функцию, которой нет — формулировка «замена — wrapper X (known-gaps: см. bridge-manifest Волны C)» для 5 РИСК-мостов |
| DWC-6c | **Гейт Соннета-уточнение (PRESURVEY §N1-флаг):** «0 живых листенеров playback-state-changed вне graveyard» — формально 3 живых (trigger-visual:208, PitchTab:284, stem-reactive.ts:167), но их кормит V3StatePublisher:130 (V3-эмиттер), НЕ V2-эмиттер (:1962, мёртв) | гейт-формулировка для 007: «0 слушателей, зависящих ОТ V2-ЭМИТТЕРА» — в гейт-отчёт C отдельной строкой (факт PRESURVEY, не наша проверка) |

## DWC-5. Гейты конвоя (в гейт-отчёт Волны C)

1. **SSOT-числа:** `rg -c "17 файлов|17/17|4 545" docs/architecture/frozen-zones-v2.md docs/architecture/README.md frozen-manifest.json src/foundation/event-bus/README.md` → 0; «2 файла»/«2/2» присутствуют; строка-LOC = **измерить wc на момент применения** (не константа — 002-усиление: само-исправляющийся SSOT)
2. **Мосты-имена в живых доках** (с фильтрами ловушек-12): `rg -n "(audio-reactive|audio|blocks|cover-theme|loop|lyrics|markers|mode-switch|mode|monitor|plate|stem-reactive|textStyle|track)\.bridge\.ts|bridges/time-sync" docs/ -g '!archive' -g '!operations' -g '!modernization/handoff' -g '!architecture-map-2.1.md' -g '!interaction-schema-2.1.md' -g '!w11*' -g '!04-bLb-BRIEFING.md' -g '!monitor-mix-v2.md'` → только аннотации «снесён Волной C / замена X». ⚠️ **Regex-фикс 002-атаки-3: длинные первыми (audio-reactive|mode-switch|loop — иначе 3 моста слепы)**; **исключения 002-атаки-4: 04-bLb:63 (эра-бриф) + monitor-mix-v2:340 (истор. RETIRED-секция :68/:315 — классифицировано, не трогаем)**; shorthand-формы без .ts — слепы, контролировать листом DWC-2c; аудит-счёт: база ~71 (002-пересчёт) → остаток классифицирован в отчёте
3. **Машина:** предчек `node -e "require('./frozen-manifest.json').graveyard"` (ключ жив, не removed) → `npm run verify:frozen` → exit 0 (**«frozen OK: 2/2», graveyard {}**) — замок сам проверит атомарность сноса
4. **Паритет-гейт НЕ вырожден:** 007 переключил scripts/verify-bridge-parity.ts ДО волны — машинный чек: `rg -c "manifest" scripts/verify-bridge-parity.ts` > 0 (002-атака-10: иначе блокер декларативен — вакуумный PARITY PASS без мостов ничего не проверяет)
5. `rg -n "src/bridges/" src/ --type ts -g '!*.test.*'` → только live-guard + аннотации «(снесён Волной C)» у 007
6. Смоук: frozen-zones + Onboarding-инспект-список + event-bus-README глазами
7. Канон Δ0 по код-гейтам 007 (two commits по Соннету: 007 решает разбиение; доки = с финальным)

## НЕЛЬЗЯ

- architecture-map-2.1 + interaction-schema-2.1 — SUPERSEDED, НЕ конвоить (скаут-Q 🟡 отклонён парой по карте; 🔴 #17 Никиты решает судьбу файлов, не конвой)
- эра-доки (MACRO/SONNET/STRATEGY/MAC-PC/SYSTEM-REPORT/team-m-setup/team-m-sync) — без решения 200 не трогать (DWC-3c — только CHARTER/PLAN/SYNC/ADR-0015 + центральные живые)
- 09-BLB17:90-91/:103 — ретракт-эра, аннотация факультативна (К3)
- **w11 (DWC-2d) — до решения 200 об эра-классе скобок: не трогать** (переведён из правок в приёмку)
- **Порядок жёсткий: B++ → Волна C-код → конвой** (B++ не применён на HEAD f5b9318 — 18 malformed живы; после B++ все DWC-2c-якоря ревифицировать)
- код и тесты мостов — зона 007 (комменты — по его списку DWC-4)
- verify-bridge-parity — блокер 007, конвой только требует его решения ДО волны
- stem-reactive: в доках переадресуем на wrapper, мост — труп по манифест-канону (спорное закрыто)

## Маршрут (ночная смена)

003 спека (эта) → **002 стресс** → 003_2 ночная сверка (RAWDUMP §W4 + ловушки-12 — его хлеб) → приём 200 → 007: волна C код (two commits) + конвой финальным → ФВ-1 пары → печать 006 (Д-КЕЙС 7: 2/2 + graveyard 0) → смоук Никиты.

— 003 + 003_2 · ночная смена · конвой C 🌙🚂
