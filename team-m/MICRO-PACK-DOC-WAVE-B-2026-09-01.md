# MICRO-PACK · DOC-WAVE-B: КОНВОЙ ВОЛНЫ B «КОНТРАКТ-ЗАКРЫТИЕ» (доки синхронно с де-фризом) · 2026-09-01

**Автор:** 003 (пара 003+003_2, миссия-4) · **Фураж:** RAWDUMP-WAVE-BC 003_2 (12:58, живой инвентарь B/C после отсева эр) + скаут-P (43-разметка) + мой git-счёт 31 файла orchestrator (классифицированы по карте: 10 живых, остальные эра/архив)
**Версия:** v2.1-ДОГОН (B+): Волна B вошла в канон `a0c8aca` (18:30, 3 коммита) БЕЗ док-конвоя — хвост пойман ФВ-4 003_2 (23:18: SSOT-дивергенция машина 17/4545 vs доки 18/5137). Факт-чек 003 23:2x: манифест-note УЖЕ «2 зоны · 17 · 4545» (007 C1), frozen-zones:2/:3 + README:15 держат 18/5137, orchestrator-якоря в доках не легли. **Все правки DWB-1..4 актуальны дословно — меняется статус: НЕ «едет с волной», а «догоняет немедленно, одним коммитом 007».** Приоритет: SSOT-дивергенция живая прямо сейчас.
*История: v2.0 — стресс 002 «ДЕРЖИТ С УСЛОВИЯМИ» 7/7 внесено; v1 — самокоррекции wc.*
**Самокоррекция 003-1 (до стресса):** v1 содержала «−194» из памяти; факт = 592. **Самокоррекция-2 (002-независимо):** мой построчный счёт манифеста = 5138 vs wc 5137 (trailing-newline) → гейт-6 = измерять, не хардкодить.
**Статус:** СПЕКА-КОНВОЙ (ждёт: спеку КОДА Волны B от 007 по досье 301 → затем ОДИН коммит; доки не догоняют — урок E) · **Стресс:** 002 после сборки · **Верификатор:** 003_2 (ФВ-1 после применения)
**HEAD-SSOT на момент сборки:** `a8a3867` · канон: tsc=290 · vitest 808/69 · PARITY · frozen 18/18 машина
**Объект Волны B (код, 007):** track.orchestrator снос (0 импортёров — досье 301 + мой rg) + V2Adapter/IV2PublicContract (0 внешних вызовов; след = engine-v3/index.ts:59 export; **B/C-принадлежность — по вердикту досье-301, конвой от неё не зависит**) + 2 мёртвых fallback SyncEditorPanel (:104-107 громкость=1 ОТРАВЛЯЕТ — рабочий дефект по 200; :618-623 duration=0) + track.loader-шапка + lyrics.store:26-коммент. ⚠️ ГОЛОВА (201+301) на экспертизу контракта ДО применения — живее A.
**⚠️ Метод пары (урок :85):** классификация хвоста — по судьбе ФАЙЛА, не по лексике строки.

## DWB-1. Frozen-числа: 18 → 17 (orchestrator уходит из guard — гейт 200 уже объявил verify:frozen 17/18)

| # | Файл:строка (якорь) | Было → Стало |
|---|---|---|
| DWB-1a | docs/architecture/frozen-zones-v2.md:3 | «3 зоны · 18 файлов (AudioEngineV2 + track.orchestrator + 16 мостов вкл. live-guard), ~5 137 строк» → «2 зоны · 17 файлов (AudioEngineV2 + 16 мостов вкл. live-guard), ~4 545 строк (wc-факт: −592 orchestrator, 01.09, Волна B)» — цепочка: 5299 → A −162 → 5137 → B −592 → 4545 (все wc-верифицированы) |
| DWB-1b | docs/architecture/frozen-zones-v2.md:24 (таблица frozen: строка track.orchestrator; :18 = audioContext — не тот якорь, 002) | → «`src/services/track.orchestrator.ts` — 🗑 удалён 01.09, Волна B (0 импортёров; 1:1-копия живёт track.loader.ts; OVERRIDE). SHA — история манифеста» |
| DWB-1b2 | docs/architecture/frozen-zones-v2.md:58 (таблица цехов «DATA 📦 | track.orchestrator») | orchestrator из Frozen-колонки цеха → «track.orchestrator (снесён Волной B; приёмщик — track.loader.ts)» — иначе док самопротиворечит (:24 «удалён» vs :58 «frozen») |
| DWB-1c | docs/architecture/frozen-zones-v2.md 🔒-строка :2 | «операционный канон (18 файлов)» → «(17 файлов)» — синхронно с манифестом |
| DWB-1d | docs/architecture/README.md:15 | «3 зоны · 18 файлов · ~5 137» → «2 зоны · 17 файлов · ~4 545 (после Волны B: track.orchestrator −592 снесён)» |
| DWB-1e | frozen-manifest.json: guard-SHA track.orchestrator **+ note :3 «3 зоны · 18 файлов… wc=5137»** | SHA-строку удалить атомарно (У-1; замок проверит 17/17) + note → «2 зоны · 17 файлов… wc=4545» — иначе манифест сам себе противоречит (002-удар-2) |
| DWB-1f | src/foundation/event-bus/README.md:55 («verify:frozen, 18/18» — строка AW+2) + Frozen-блок (:60 orchestrator-строка, если жива после AW+) | :55 → «17/17»; orchestrator-строку → «удалён 01.09, Волна B» (по факту AW+2-структуры; 002-удар-2) |

## DWB-2. HISTORICAL-якоря в живых доках (10 файлов по git-счёту)

| # | Файл (якорь-паттерн) | Правка |
|---|---|---|
| DWB-2a | docs/architecture/audio-engine.md (6 вхождений orchestrator — живые следы) | якорь-строка: «> 🗑️ track.orchestrator.ts удалён 01.09 (Волна B): 0 импортёров, 1:1-живизна — track.loader.ts. V3 transport-слой самодостаточен.» + точечные вхождения → «(удалён, Волна B)» |
| DWB-2b | docs/architecture/track-loading-pipeline.md (orchestrator — ядро темы дока) | якорь: «track.orchestrator снесён Волной B 01.09 — пайплайн описывает живой track.loader.ts (W4-замена, self-sufficient)» + вхождения пометить |
| DWB-2c | docs/architecture/n-stem-architecture.md (6 вхождений) | якорь-строка + вхождения → «(удалён, Волна B)» |
| DWB-2d | show-architecture.md:471 + zip-pipeline.md:221 + block-first-lyrics-sync.md:511/:911 + block-scenes-editor.md:537 | точечные вхождения → «(удалён, Волна B)». ⚠️ takes-system.md — **0 вхождений** (002: только «useExerciseOrchestrator» — другой) → **SKIP**, не править вслепую (живой счёт: 9 доков, не 10) |
| DWB-2e | docs/PLAN-v3.3-CANONICAL.md §2 (frozen-список «track.orchestrator») | ⚠️ через согласование Ц3: приписка-двойной-указатель (вердикт 003_2: «SSOT = frozen-manifest.json + frozen-zones-v2.md; текст — срез на дату») + скобка «(orchestrator удалён Волной B)» |
| DWB-2f | docs/SYNC-PROTOCOL.md:26 (frozen-список) | та же приписка-двойной-указатель (синхронно с PLAN — один паттерн, согласование Ц3) |
| DWB-2g | docs/BELIVEBASE-CHARTER.md:63 (паспорт Event Station — если orchestrator упомянут) | сверить по факту; при упоминании — скобка «(удалён, Волна B)» |

## DWB-3. Комменты-спутники кода (⚠️ зона 007 — в ЕГО спеке Волны B, конвой только ДЕКЛАРИРУЕТ)

- track.loader.ts:2 «1:1 копия track.orchestrator.ts:5-592 (FROZEN)…» → «заменил track.orchestrator (снесён Волной B 01.09); самодостаточен с W4» — у 007
- lyrics.store.ts:26 «The frozen track.orchestrator populates…» → «(истор.: orchestrator снесён Волной B)» — у 007
- stemTypes.ts:520, MixerPanel.tsx:6, CharacterSoundManager.ts:2 (RAWDUMP 003_2; ⚠️ 002: rg по тройке = 0 живых упоминаний — **сверить по факту ДО правки, клейм ≠ строка-факт**) — у 007

## DWB-4. Гейты конвоя (в гейт-отчёт Волны B одним блоком)

1. `git grep -n "track\.orchestrator" -- docs/ ':!docs/archive' ':!docs/operations' ':!docs/modernization/handoff'` → только якоря «удалён Волной B» + **эра-13 (002-удар-1, поимённо: HISTORY-MAP, SONNET-13, STRATEGY-DUO, MACRO-PACK, SYSTEM-REPORT, MAC-PC-BRIDGE, architecture-map-2.1, interaction-schema-2.1, MISSION-ZERO, 02-ANSWERS, ADR-0004, team-m-setup-prompt, team-m-sync-proposal + banners: w11, slot-matrix-v2.2, agent-governance-map, 03/04-bLb, ADR-0015, Onboarding, character-ai)** + PLAN/SYNC срез-приписки — все перечислены в ожидаемой таблице гейт-отчёта
2. `rg -c "18 файлов|3 зоны · 18|5 137|5137|18/18" docs/architecture/frozen-zones-v2.md docs/architecture/README.md frozen-manifest.json src/foundation/event-bus/README.md` → 0; «2 зоны · 17 файлов» + «17/17» присутствуют (002-удар-2: пробельный и без-пробельный паттерны)
3. `npm run verify:frozen` → exit 0 (17/17 — orchestrator из guard)
4. `rg -n "track\.orchestrator" src/ --type ts -g '!*.test.*'` → только комменты-якоря 007 (loader-шапка/lyrics.store)
5. Канон Δ0 · tsc/vitest по гейтам 007 (код-волна!) · SyncEditorPanel:104-107 — громкость больше не травится (гейт 007)
6. Смоук: frozen-zones + track-loading-pipeline глазами — якоря на месте; **число строк — измерить wc по 17 файлам в момент применения** (5138-артефакт trailing-newline, 002-удар-6; «~» страхует) и вписать измеренное

## НЕЛЬЗЯ

- НЕ трогать код (комменты — зона 007; конвой = .md + манифест-строка)
- НЕ трогать эра-файлы (HISTORY-MAP, SONNET-13, STRATEGY-DUO, MACRO-PACK, SYSTEM-REPORT, architecture-map-2.1, interaction-schema-2.1, MISSION-ZERO — история волн/снимков)
- PLAN/SYNC — ТОЛЬКО через согласование Ц3 (живой план); без ответа Ц3 к моменту волны — отложить эти 2 правки в B+ (догон), не блокировать конвой
- НЕ применять ДО код-спеки Волны B (007 по досье 301) + экспертизы ГОЛОВОЙ (200 п.1) — волна B живее A (ENGINE_MODE-ветки)
- **Атомарность коммита: код+конвой ОДИН коммит** (промежуточный пуш = verify:frozen красный: манифест-18 при удалённом файле) — 002-удар-5

## Маршрут (B+-догон)

003_2 ФВ-4-хвост (23:18) + факт-чек 003 (23:2x) → спека v2.1-догон → **007: немедленно одним коммитом** (код уже в каноне — доки догоняют) → двойной DOC-CHECK пары (гейты DWB-4) → LOG-конвой → печать 006 (Д-КЕЙС 6 видит 17/17 в доках тоже). Урок-постмортем (в §0-ловушки): волна без конвоя = SSOT-дивергенция в тот же час; конвой должен быть условием коммита волны, не соседним пакетом.

— 003 · пара 003+003_2 · миссия-4 · конвой B готов к поезду 🚂

---

# B++ · ФИКС-ПАКЕТ догона (находки двойного DOC-CHECK пары после `b882797`; вердикт 003_2 00:28 + независимый счёт 003 01:3x) · 2026-09-02 · НОЧНАЯ СМЕНА

**Класс «якорь-рендер»:** маркер легал ВНУТРИ имени файла — путь сломан, grep-гейтируемость падает. **Счёт 003_2: 13 вхождений / 6 доков; независимый счёт 003: 13 malformed + zip:221 + форматы-варианты = 16 строк / 7 доков** (у меня на 1 док больше: zip-pipeline:221 в моём rg). Эталоны правильного (уже в дереве): audio-engine:4 («track.orchestrator.ts удалён 01.09 (Волна B)») и lyrics.store:26 («ex-track.orchestrator, снесён Волной B»).

## Правки B++ (все malformed-якоря — единый sed-класс)

| # | Файлы (якорь-паттерн `orchestrator (удалён`) | Правка (по эталону) |
|---|---|---|
| B++-1 | docs/architecture/audio-engine.md:41/:115/:187/:357/:526/:788 (6) | `track.orchestrator (удалён, Волна B).ts:X` → `track.orchestrator.ts:X (удалён 01.09, Волна B)` — имя-файла ЦЕЛОЕ, маркер ПОСЛЕ |
| B++-2 | docs/architecture/n-stem-architecture.md:186/:646/:671/:681/:684/:687 (6) | тот же паттерн-эталон |
| B++-3 | docs/architecture/track-loading-pipeline.md:94 | `track.orchestrator (удалён, Волна B).ts` → `track.orchestrator.ts (удалён 01.09, Волна B)` + Owner-строка: живой владелец `track.loader.ts` (W4-замена), эра-скобка после |
| B++-4 | docs/architecture/show-architecture.md:471 · block-scenes-editor.md:537 · block-first-lyrics-sync.md:511 · zip-pipeline.md:221 | паттерн-эталон |

**Итого: 16 строк / 7 доков одним sed-проходом.** Рецепт sed (для 007):
`sed -i 's/track\.orchestrator (удалён, Волна B)\.ts/track.orchestrator.ts (удалён 01.09, Волна B)/g' <7 файлов>` + ручная правка track-loading:94 (Owner → track.loader.ts).

## Гейты B++

1. `rg -c "orchestrator \(удалён" docs/` → **0** (гейт 003_2)
2. `rg -c "track\.orchestrator\.ts.*удалён" docs/architecture/` → ≥14 (эталон-паттерн на месте)
3. Смоук: 3 дока глазами — имена файлов целые, маркеры после
4. Канон Δ0 · frozen 17/17 не затронут

@007 — одним sed-коммитом (можно с началом Волны C). После B++ → вторая подпись 003_2 → конвой B ЗАКРЫТ парой полностью.
