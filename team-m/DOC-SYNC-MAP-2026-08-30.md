# DOC-SYNC-MAP · карта синхронизации доки ↔ кода

**Автор:** 003 (Док_Аудит) · **Начат:** 2026-08-30 16:46 MSK · **HEAD-SSOT:** `9b6bf83`
**Канон (раздельно по цвету):** `tsc=293` 🔴 · `vitest=801+0int+0load` 🟢 (67 файлов) · `PARITY PASS` 🟢
**Метод:** батчи 15–20 доков · доказательство = file:line/коммит · 003 ничего не правит (карта → 200 редиректы → 007 коммиты → 🔴 Никита)

**Статусы:** КАНОН (сверен, жив) · АРХИВ (устарел/заморожен) · ТРУП (_redirect-кандидат) · РАСХОДИТСЯ (жив, но врёт о коде)
**Скаут-пакет батча-1:** A = dead-path-скан (38/38) · B = arch-scout 8 ключевых · C = шапки/ссылки (28) · +3 факт-чека 003 (§11.3)

## Батч 1 — docs/architecture (38) · ЗАКРЫТ 17:15 · КАНОН 29 · РАСХОДИТСЯ 5 · ТРУП 1 · АРХИВ 3

| Док | Статус | Доказательство | Действие |
|---|---|---|---|
| audio-engine.md | РАСХОДИТСЯ | док:1043-1056 «7 production modules» ≠ факт ~30+ (core/pipeline/monitor после ARC-2d); док:1045 `src/legacy/engine-v3/` → факт `src/audio/engine-v3/`; док:868 `src/audio/store/audioStore.ts` → факт `src/stores/audio.store.ts`; нарратив «V2 frozen + V3 additive» устарел после финиша миграции 28.08 (bridge-retirement при этом точен: wrappers живы ✅) | список правок → 200 |
| show-architecture.md | КАНОН | store split (show/show-editor/show-presentation.store.ts) ✅ · Show/* компоненты ✅ · deck/modules.ts ✅; дрейф: док:475 `src/triggers/trigger.bridge.ts` мёртв (→ trigger.bus.ts) | минор-патч путей → 200 |
| sync-system.md | КАНОН | ⚠️ скаут-B ошибся, факт-чек 003: 5 alignment-сервисов ЖИВЫ в `src/sync/word-sync/services/` + `providers/gateway-align.provider.ts`; stores (wordSync/lyrics/audio) ✅; 0 мёртвых путей (скаут-A) | — |
| transport-v3.md | РАСХОДИТСЯ | док:53-55 пути `engine-v3/TransportV3.ts`,`types.ts` → факт `engine-v3/core/*`; из 15 заявленных модулей 5 НЕ существуют (VocalMixV3, MicrophoneV3, CrossfadeV3, CaptureBusV3, RateParamV3 — glob пуст); ядро живо: getTransport (index.ts:36), delegateSync (V2Adapter.ts:51), seek-position-changed (types.ts:26) ✅ | список правок → 200 |
| eventbus-v2.md | КАНОН | ядро event-bus.ts/types/facade/6 каналов ✅; дрейф: док:42 «1 активен wrapper» ≠ факт ~19 wrappers в активном использовании | минор-патч цифры |
| frozen-zones-v2.md | КАНОН | все 17 frozen-файлов физически на месте, список совпадает ✅; микродрейф: stem-reactive.bridge retire фактически завершён (wrapper жив рядом) | — |
| marker-system-spec.md | КАНОН | M1/M2 модель в markers.store ✅; draw-markers.ts ЖИВ: `src/sync/canvas/draw-markers.ts` (факт-чек 003); non-implemented части док сам честно помечает PLANNED | — |
| n-stem-architecture.md | КАНОН | stemTypes/stem.store/upload.service/MixerPanel ✅ (5/5 клеймов) | — |
| architecture-map-2.1.md | АРХИВ | шапка SUPERSEDED 28.08; 7 мёртвых путей; known (301 §6) — 156 КБ frozen-монолит | 🔴 #17 у Никиты (перенос в superseded/) |
| interaction-schema-2.1.md | АРХИВ | шапка SUPERSEDED; 8 мёртвых путей (phantom-bridges); known (301 §6) | 🔴 #17 у Никиты |
| LATENCY-REGISTRY.md | КАНОН | «Живой документ», 2 входящих (SHARED-REGISTRY, MIGRATION-STORY) | — |
| README.md | КАНОН | индекс v3, шапка-статусы корректны; 15 входящих | — |
| architecture-doctrine.md | КАНОН | frozen doctrine; 6 входящих; legacy-упоминания = текст доктрины, не статус | — |
| auth-system.md | РАСХОДИТСЯ | док:585,596 `src/handlers/auth.ts` → факт `gateway/src/handlers/auth.ts`; док:599 `src/auth/jwt.ts` — нет в репо; док:598 `src/index.ts` → факт `src/main.tsx`; шапка:8-10 линкует архивные interaction-schema-2.2/arch-map-2.2 | список правок → 200 |
| avatar-visual-engine.md | КАНОН | DEPLOYED; 11 входящих; frozen-ref — честные пометки | — |
| billi-ai-expert-system.md | КАНОН | волны A-D завершены (шапка); дрейф: док:154 `js/ai/providers/` → факт `src/js/ai/providers/` | минор-патч пути |
| block-first-lyrics-sync.md | КАНОН | PRODUCTION; DEPRECATED-секция matchGeniusToLrc корректно помечена (301 §4); битая ссылка:515 на несуществующий sync-accuracy-roadmap.md | линк-патч → 200 |
| block-scenes-editor.md | КАНОН | v2.0 живой контракт; 10 входящих | — |
| central-bridge.md | КАНОН | PRODUCTION; дрейф: док:42 `__tests__/stem-engine-sync.test.ts` → факт `src/foundation/reactions/__tests__/` | минор-патч пути |
| character-layer.md | РАСХОДИТСЯ | 6 мёртвых путей (док:23-48): `js/ai/settings/ai-settings.store`, `js/ai/registry`, `character/sound`, `__tests__/layer2-report-emitter` — везде опущен префикс src/; сам док — живой паспорт здания | список правок → 200 |
| control-surface-semantics.md | КАНОН | freeze candidate; 6 входящих; ⚠ «see Arch Map 2.1» — линк на SUPERSEDED-археологию | линк-патч → 200 |
| dock-standard.md | КАНОН | Implemented W1-7; 11 входящих; DEAD CODE L101 честно помечен | — |
| exercises-system.md | КАНОН | дрейф-пара: док:52 `src/takes/exercise/` → факт `src/exercises/`; док:1252 битая ссылка на sync-monitor-pitch-integration.md | минор-патч → 200 |
| feed-social-v2.md | КАНОН | ACTIVE; 5 входящих | — |
| init-registry.md | КАНОН | PRODUCTION; дрейф: док:39 битый тест-путь initRegistry.test.ts | минор-патч пути |
| lrc-parser-service.md | КАНОН | сервис ЖИВ `src/services/lrc-parser.service.ts` (факт-чек 003); near-орфан: 1 входящая, только DOC-TC-BACKLOG.yaml | 🔗 поднять связность (200) |
| metrics-system.md | РАСХОДИТСЯ | док:207 `metrics.bridge.ts` → факт `metrics-sync.service.ts` + `src/stores/metrics.store.ts`; док:211 `src/handlers/metrics.ts` → факт `gateway/src/handlers/metrics.ts`; шапка «gateway PENDING» — gateway-обработчик уже существует | список правок → 200 |
| monitor-mix-v2.md | КАНОН | Active v2.1, supersedes v1 корректно; 13 входящих | — |
| performance-quality-system.md | КАНОН | As-Built; 17 входящих; ⚠ линк на Arch Map 2.1 | линк-патч → 200 |
| practice-experience-layer.md | КАНОН | концепт-док; 9 входящих; Last Updated 2024 — старение, но кода не касается | — |
| reactive-lyrics-foundation.md | КАНОН | freeze candidate; 11 входящих | — |
| slot-matrix-system-v2.2.md | ТРУП | H1 «⚠️ DOCUMENTATION MISMATCH — ACTION REQUIRED» (L1) + «Do NOT use» (L9) — док сам запрещает себя; при этом 8 входящих ссылок, ВКЛЮЧАЯ README.md и docs/INDEX.md | 🔴 rewrite/redirect (живые индексы ведут на само-запрещённый док) |
| styles-system.md | КАНОН | freeze candidate; 12 входящих | — |
| takes-system.md | КАНОН | Active 0.4; дрейф: док:227 `takes.bridge.ts` → факт `takes.store.ts`/`takes.duck.ts` (bridges убраны); legacy L789 честно помечен | минор-патч пути |
| track-loading-pipeline.md | КАНОН | v1.0; 0 мёртвых путей; 11 входящих | — |
| track-meta-pipeline.md | КАНОН | v2.0; Essentia-legacy помечено; 10 входящих | — |
| w11-visual-boot-theming.md | АРХИВ | шапка «❄️ FROZEN» (L3) — as-built запись завершённой волны W11; 6 входящих | кандидат в packs/era-* (🔴 STORAGE-POLICY) |
| zip-pipeline.md | КАНОН | Production v2.0; 18 входящих (макс зоны); дрейф: док:503 `src/index.ts` → факт `src/main.tsx` | минор-патч пути |

### Топ-6 расхождений батча-1 (для сводки 200 → Никита)
1. **slot-matrix-system-v2.2.md — ТРУП с живыми индексами:** сам declares «Do NOT use», но README.md и docs/INDEX.md на него ссылаются. Rewrite или redirect — 🔴.
2. **transport-v3.md:** 5/15 заявленных модулей engine-v3 не существуют; структура после ARC-2d = core/pipeline/monitor/integration; 2 пути переехали в core/.
3. **audio-engine.md:** «7 production modules» ≠ факт ~30+; нарратив «V2 frozen + V3 additive» устарел после финиша миграции 28.08.
4. **character-layer.md:** 6 мёртвых путей из-за опущенного префикса src/.
5. **auth-system.md:** backend описан в src/handlers/, реальность — gateway/src/handlers/ (Cloudflare-воркер); шапка линкует архивные 2.2-доки.
6. **metrics-system.md:** «gateway PENDING DEPLOY» — а gateway/src/handlers/metrics.ts уже существует.

### Факт-чеки 003 (опровергну/подтверждено после скаутов)
- sync-system.md: 5 alignment-сервисов ЖИВЫ в `src/sync/word-sync/` (скаут-B искал только в src/services — опровергнуто прямым grep).
- draw-markers.ts ЖИВ: `src/sync/canvas/draw-markers.ts` (скаут-B не верифицировал — закрыто).
- lrc-parser.service.ts ЖИВ: `src/services/lrc-parser.service.ts`.
- auth: `gateway/src/handlers/auth.ts` существует (док врёт о корне src/).

## Батч 2 — docs/domain (1) + docs/* корень (20) · ЗАКРЫТ 17:34 · КАНОН 8 · РАСХОДИТСЯ 3 · ТРУП 2 · АРХИВ 8

| Док | Статус | Доказательство | Действие |
|---|---|---|---|
| INDEX.md | РАСХОДИТСЯ | «Last updated 2026-06-10» ≠ факт: активность team-m до 30.08; новые доки (feed-social-v2, frozen-zones-v2, eventbus-v2, transport-v3) в оглавлении ОТСУТСТВУЮТ (rg пуст); док:74 битый путь SYNC-HUB-TO-MAC (переехал в team-m/archive/) | список правок → 200 |
| glossary-owner.md | КАНОН | глоссарий 008 VMO-001…040 (26.08); пути валидны; 0 входящих (near-орфан) | 🔗 связность (200) |
| product-protocol-v2.1.md | РАСХОДИТСЯ | протокол v2.1 от 06-07; error-коды AUTH_CONFIG_ERROR/AUTH_TOKEN_EXPIRED в коде НЕ найдены (rg пуст); линки на архивные 2.2-доки (в superseded/) | список правок → 200 |
| BELIVEBASE-CHARTER.md | РАСХОДИТСЯ | док «Bridges — на слом 🗑» ↔ факт: src/bridges/* — FROZEN-зона, 14 мостов живы; «27 событий» ≠ 29 у eventbus-v2 (КАНОН); при этом 6 каналов event-bus ✅, engine-v3/core+monitor+stems ✅ (город-метафора точна) | 🔴 арбитраж (врёт о frozen-зоне) |
| BILI-CONTEXT.md | КАНОН | инварианты держатся (AudioEngineV2 frozen ✅, legacy-шелы js/ 6 шт ✅); контекст-пак 19.04 — старение, кода не касается | — |
| AUDIO-BEHAVIOR-SPEC.md | КАНОН | живой транспорт-контракт TR/LP/MX/SY/PT/RS/PR; журнал прогонов замер 07-28 — ре-ран статусов = мандат 007, не дефект доки | — |
| auth-system-freeze.md | КАНОН | осознанный FROZEN-снапшот 05-28 («по решению Центра»); клейм user.types.ts:6 AuthState подтверждён ТОЧНО; 2 мёртвых landing-пути честно в снапшоте эры | — |
| HISTORY-MAP-V2-V3-MIGRATION.md | АРХИВ | историческая карта до 08-06; финиш миграции 28.08 НЕ отражён (team-m/REGISTRY:43-45); «47 V3-файлов» (29e2c5ef) vs ~30+ модулей после ARC-2d — ретроспектива эры | packs/era-* (🔴 STORAGE-POLICY) |
| SYNC-PROTOCOL.md | КАНОН | ПК=канон ✅; хуки update-repo-state.sh (post-commit/merge/checkout — все 3 подтверждают вызов) ✅; REPO-STATE.md жив ✅; frozen-пути ✅ | — |
| MAC-PC-BRIDGE-SPEC.md | ТРУП (эра-труп) | «активно с 08-23», но топология/роли/протоколы полностью перекрыты SHARED-REGISTRY §0 (30.08, GO Никиты): дупликат канала; 10 входящих живут старой правдой | _redirect → SHARED-REGISTRY §0 |
| SYSTEM-REPORT-V007.md | АРХИВ | одноразовый отчёт «СИСТЕМА ЕДИНА» 08-23; 8 входящих — цитаты в team-m/*; процессная дескрипция эры настройки моста | packs/era-* |
| PLAN-v3.3-CANONICAL.md | КАНОН | живой канон-план (24 входящих); НО §1 статусы от 25.08: M5 ⬜, GO ⬜, E7 ⬜ — при фактическом финише V2→V3 + PROD-push 28.08 (REGISTRY:43-45: тег v2-final-production, FF-merge cdfb2eb..780db23) | статусы обновить (через 007/Ц3) |
| SCOUT-REPORT-gateway-audio-deps.md | АРХИВ | скаут-отчёт DRIFT-эры 07-18; 1 входящий; V2-зависимости Rehearsal после 28.08 уже не DRIFT | packs/era-* |
| MACRO-PACK-DUO-PHASE1.md | АРХИВ | макропак duo-эры 07-27 («009 верифицирован — готов к оператору»); 3 входящих; фаза поглощена выполнением | packs/era-* |
| SONNET-REPORT-13-DUO-STRATEGY.md | АРХИВ | duo/mikropak-эра 07-27; 4 входящих; «5 MICRO-PACKs готово» — история | packs/era-* |
| STRATEGY-V3-DUO-FIRST.md | АРХИВ | duo-first стратегия 07-27 — отменена фактом финиша FULL V3; 1 мёртвый путь V2AudioCage.ts (модуль удалён); 4 входящих | packs/era-* |
| TC-094-095-BATCH-REPORT.md | ТРУП | 0 входящих ссылок; 4 мёртвых пути (док:285-290: parsing.service, markerUtils, markers.store, AudioEngineV2 — все переехали); одноразовый TC-отчёт 06-30 | _redirect → 3 строки HISTORICAL |
| team-m-setup-prompt.md | АРХИВ | setup-промт эры настройки моста; инбокс-синк поглощён SHARED-REGISTRY; 5 входящих (аудиты+брифинги) | packs/era-* |
| team-m-sync-proposal.md | АРХИВ | предложение Cross-Team Sync 08-23 — принято и ПРЕВЗОЙДЕНО SHARED-REGISTRY; 2 мёртвых пути design-agent; 10 входящих | packs/era-* |
| 007-SPEC-STATUS.md | КАНОН | живой статус-реестр спеки (обновлять после каждого раунда, 07-28); 2 входящих | — |
| docs/domain/feed.md | КАНОН | СИЛЬНЫЙ: 9/9 handlers в gateway/src/handlers/feed.ts (handleGetFeedPosts:17 … handleDeleteComment:876) ✅; feed.store/feed-data/feed-ui в src/catalog/feed/ ✅; миграции 0001-0005 ✅; minor-path: док «src/feed/», факт src/catalog/feed/ | минор-патч пути → 200 |

### Перекрытие с SHARED-REGISTRY (пакет для 200)
MAC-PC-BRIDGE-SPEC + SYNC-PROTOCOL + SYSTEM-REPORT + team-m-setup-prompt + team-m-sync-proposal: топология моста, роли, инбокс-синк — всё поглощено SHARED-REGISTRY §0 (30.08). Один SHARED-REGISTRY = канал; прочие = _redirect/АРХИВ.

### Топ-расхождения батча-2
1. MAC-PC-BRIDGE-SPEC — эра-труп: «активно с 08-23», топология уже перекрыта SHARED-REGISTRY §0 (10 входящих живут старой правдой).
2. PLAN-v3.3 §1 — застывшие статусы (M5 ⬜/GO ⬜ от 25.08) при свершившемся финише + PROD-push 28.08.
3. BELIVEBASE-CHARTER — «Bridges на слом» vs frozen-живые мосты; «27 событий» vs 29 (eventbus-v2 = КАНОН).
4. INDEX.md — живой индекс без новых доков (4 отсутствуют в оглавлении).
5. product-protocol-v2.1 — error-коды протокола отсутствуют в коде; линки на архивные 2.2-доки.

## Батч 3 — docs/modernization (38 корень + handoff) · ЗАКРЫТ 19:52 · КАНОН 10 · РАСХОДИТСЯ 5 · АРХИВ 25 · ТРУП 0

**Системный факт батча:** счётные доки (00-ROADMAP, 01-BASELINE, MISSION-ZERO, 10-TSC, ADR-0009-числа) построены на Windows-срезе мёртвой ветки `067-e-regime-0` HEAD `d5c66bd` (git cat-file: объект не существует), где tsc=307; канон сегодня 293/801. Era-природа подтверждена: 23/38 — АРХИВ.

| Док | Статус | Доказательство | Действие |
|---|---|---|---|
| 00-ALERT.md | АРХИВ | челлендж-лог 29.08, alert закрыт 09-BLB17; 6 вх | packs/era-* |
| 00-BASE-DIAGNOSIS.md | АРХИВ | история дивергенции баз 29.08; 2 вх | packs/era-* |
| 00-INDEX.md | КАНОН | нав-хаб аудита (ведёт 007); без ложных клейм; 4 вх | — |
| 00-ROADMAP.md | АРХИВ | шапка:4-7 «Статус DRAFT · ветка 067-e-regime-0, HEAD d5c66bd · применены только .gitignore+MD»; волны W1-W6 применены 28.08 на другой линии (03-CITY-AUDIT §1 сам признаёт); 307≠293. ⚠️ кросс-чек 301: «живая карта» (DOCS-AUDIT-MANIFEST §0) — неточна | packs/era-* или пометка HISTORICAL |
| 01-ANSWERS-TO-007.md | АРХИВ | GO-list эры; 5 вх | packs/era-* |
| 01-BASELINE.md | РАСХОДИТСЯ | «снятое фактом» + tsc=307 — а база-коммит d5c66bd НЕ существует; канон 293; «1/6 скриптов» — Windows-срез, Linux: vitest 801/67 🟢; 31 вх (живые читают как текущий бейзлайн!) | шапка-ярлык SNAPSHOT-of-d5c66bd → 200 |
| 02-ANSWERS-TO-007.md | АРХИВ | три GO эры; 2 вх | packs/era-* |
| 02-PROGRAM-ROADMAP.md | АРХИВ | шапка:5 «⛔ УСТАРЕЛ — НЕ ИСПОЛНЯТЬ» подтверждена; снепшот 07-14; known (301 §0, 🔴 #15) | 🔴 #15 → superseded/ |
| 03-CITY-AUDIT-BRIEF.md | АРХИВ | бриф исполнен: кадастр v0.3 родился (houses.yaml), кросс-чек применён 14:27; числа устарели (62 теста → факт 69; 93 orphan — срез эры) | packs/era-* |
| 03-bLb-BRIEFING.md | АРХИВ | выжимка-черновик к 04; 1 вх | поглощён 04-bLb |
| 04-bLb-BRIEFING.md | КАНОН | живой концепт-бриф города bLb (Статус КОНЦЕПТ); 5 вх | — |
| 05-INITIATIVES-LEDGER.md | КАНОН | «Статус НА РЕВЬЮ» — реестр инициатив ждёт GO Никиты (живое pending-решение); 7 вх | — |
| 06-GPT-REFS.md | АРХИВ | битая ссылка на несуществующий 07-GPT-DESIGN-REFS.md; 1 вх | packs/era-* |
| 06-VISUAL-MAP-TO-bLb.md | КАНОН | ⭐ §1.1 планировка 9 районов/19 зданий/71 этаж ЗАИМСТВОВАНА в кадастр: houses.yaml шапка цитирует этот док; 3 вх | живой вход кадастра 707 |
| 07-INITIATIVES-SUMMARY.md | АРХИВ | сводка к GO, поглощена STEPS-FROM-NIKITA (301); 2 вх | packs/era-* |
| 08-PITCH-COUNTERCHECK.md | АРХИВ | ОТЗЫВАН доком 09-BLB17 (23:50); 6 вх — ретракт-история нужна для аудита | packs/era-* с ярлыком RETRACTED |
| 09-BLB17-RETRACTED-SYNCED-CHECK.md | КАНОН | запись решения-ретракта BLB-17 — живая реальность (инициатива отозвана); 2 вх (SHARED-REGISTRY, 11-REPLY) | — |
| 10-TSC-RECONCILE-296.md | АРХИВ | закрытое досье сведения к 296; канон ушёл на 293 (ARC-2a VIS-19 −3); «вопрос снят» самим доком; 2 вх | packs/era-* |
| 11-REGISTRY-REPLY.md | АРХИВ | ответ 007 эры 30.08 (HEAD 96d4c2d — тоже прошлое); 1 вх | packs/era-* |
| MISSION-ZERO-REPO-SCAN.md | АРХИВ | честно датирован 29.08; срез d5c66bd (tsc 307, 546 файлов, 62 теста ≠ факт 69); 7 вх | packs/era-* |
| REGISTRY.md | АРХИВ | era-хаб мёртвой ветки (шапка: «HEAD d5c66bd»); живые реестры = team-m/REGISTRY.md + SHARED-REGISTRY; 76 вх (!) — после решения по дубликатам нужны редиректы | 🔴 редиректы → 200 (после #11) |
| SRI-PATCH.md | РАСХОДИТСЯ | «готов к применению» — факт: integrity=0 в index.html (НЕ применён); scripts/check-sri.mjs существует; 10 вх | 🔴 применять/закрыть (ADR-0008) |
| ADR-0001…0006 | АРХИВ | решения выполнены волнами W1-W5 (изоляция, worklet-realm, typed contracts, V2-sequence, toolchain, state-arch); вх 16/9/11/16/15/11 | packs/era-* (записи решений) |
| ADR-0007-observability | РАСХОДИТСЯ | «один логгер» — НЕ доведено: BAC-109 console-гигиена ~363 в очереди (REGISTRY 28.08); 7 вх | хвост BAC-109 в очередь bLb-hygiene |
| ADR-0008-csp-sri | РАСХОДИТСЯ | SRI заявлен «немедленно», integrity=0; 11 вх | 🔴 вместе с SRI-PATCH |
| ADR-0009-testing | АРХИВ | принцип выполнен (vitest 801/67 🟢), но посылка «тесты не запускаются» мертва, числа 62≠69; 7 вх | packs/era-* |
| ADR-0010-dev-env | КАНОН | политика node_modules/install действует; 13 вх | — |
| ADR-0011-git-visibility | КАНОН | стратегия подтверждена: .gitignore:74-76 = docs/agents/, belive-api/ — ровно как декларирует; 14 вх | — |
| ADR-0012-dependency-manifest | КАНОН | политика package.json действует; 9 вх | — |
| ADR-0013-ci-gates | КАНОН | CI-гейты живы: deploy.yml + deploy-rehearsal.yml существуют, храповик; 11 вх | — |
| ADR-0014-monorepo | КАНОН | политика границ действует; 5 вх | — |
| ADR-0015-frozen-zones | РАСХОДИТСЯ | док: «заморожен один (AudioEngineV2)» → канон 4 зоны (+patchV1, bridges/*, track.orchestrator); .frozen-zones.json и check-frozen.mjs НЕ существуют — механизм не внедрён; 10 вх | 🔴 расширить до 4 зон или пометить superseded (замена: frozen-zones-v2.md = КАНОН, батч-1) |
| ADR-0016-w2-entry | АРХИВ | критерий входа W2 — пройден давно; 4 вх | packs/era-* |
| handoff/00-README-007.md | АРХИВ | 6 мёртвых SHA (стр.5, 211, 243-247; git cat-file d5c66bd → fatal, объект не существует) — 100% битых ссылок документации в одном файле (301 §3 подтверждён); 9 вх | 🔴 #14: починка SHA или packs/era-* |
| handoff/docs/* (19 дубли + findings/ 2) | АРХИВ-копия | байт-в-байт (sha256, перепроверено 003: 19 корневых + 2 findings); 257.1 КБ; 🔴 #11 на снос | 🔴 #11 (301 §1) |
| handoff/docs/REGISTRY.md (форк) | АРХИВ-копия | 23 688 б vs корень 26 533 б — рассинхрон с мёртвым бранчем 067-e-regime-0; known (301 §1) | 🔴 #11 вместе с dup-набором |

### Топ-находки батча-3
1. **06-VISUAL-MAP-TO-bLb §1.1 — единственный «живой» из эры:** его планировка 9/19/71 встроена в кадастр houses.yaml — эра модернизации оставила городу рабочий вход.
2. **ADR-блок живых политик (0010-0014):** dev-env, git-visibility, manifest, CI-гейты, монорепо — действуют, подтверждены файлами (.gitignore, deploy.yml).
3. **ADR-0015 — опасное расхождение:** frozen-механизм (json+gate) не внедрён, в доке 1 зона из 4 канонических. Кто читает ADR-0015 как источник frozen-списка — рискует.
4. **01-BASELINE (31 входящий!) читают как текущий бейзлайн,** а он срез несуществующего коммита — главный кандидат на шапку-ярлык.
5. **SRI-патч завис:** integrity=0, apply так и не случился.

## Батч 4 — docs/ поддеревья (154) · ЗАКРЫТ 21:01 · КАНОН 17 · РАСХОДИТСЯ 2 · АРХИВ 132 · ТРУП 2 (+1 CI-зомби)

**Канон обновлён (ARC-2e):** `tsc=293` 🔴 · `vitest=808+0int+0load` 🟢 (69 файлов) · `PARITY PASS` 🟢 · HEAD `0b0360f`.

**⭐ Системный факт батча (git-природа):** 71 .md из docs/ — **untracked/gitignored**: docs/sync 47 + docs/agents 7 + docs/agents-hub 17 (.gitignore:66/76/81). Они живут только на дисках ПК/Мака — теряются при чистом клоне. Это «тёмный этаж» doc-системы — для города bLb это этажи с категорией ghost-floor.

| Зона | Статус | Доказательство | Действие |
|---|---|---|---|
| docs/sync/ — 47 md (MASTER-SYNC-REGISTRY.md/.yaml, DOC-TC-BACKLOG.yaml, DOC-SYNC-FINAL-REPORT.md, reports/ 44) | АРХИВ (механизм-зомби) | вся зона gitignored (git ls-files = 0); 46/47 — раунд-отчёты одной даты 2026-06-10 (эра «Orc 001»); CI doc-sync-check.yml:20-55 — паттерны инертны (priority: P0/P1 — 0 совпадений, conflict/needs_update — lowercase при UPPER-статусах); DOC-TC-BACKLOG: 15 записей, все DONE; MASTER md «Generated 06-10» предшествует yaml (06-16) — генерация невозможна; система синка переехала в team-m/SHARED-REGISTRY | 🔴 судьба reports/ (снос vs архив) + фикс CI-гейта |
| docs/sync 2 yaml | РАСХОДИТСЯ | трекаются, но last_full_scan 2026-07-17 (снапшот эры); docs/INDEX.md:51 зовёт SOURCE OF TRUTH, а живой SSOT — SHARED-REGISTRY | шапка-ярлык HISTORICAL → 200 |
| docs/agents/ — 7 md | АРХИВ (gitignored) | 5/7 самопометки STALE (:1); «Intelligence Matrix» эры 08.06; MODEL-ROUTING-GUIDE «Утверждено» 06-19 — модели эры (008 MiMo/009 Kimi) не совпадают с текущими; канал 006↔007 живёт в agent-registry/ (rg 006 docs/agents = 0) | — |
| docs/agents-hub/ — 17 md | АРХИВ (gitignored) | gitignored :81 «не для публичного репо»; хаб раундов Sonnet Gate-3B эры 08.08 (mandates 240-245); REZUME:1 «УСТАРЕЛ»; пути вне репо (/Desktop/beLive_Context/) | — |
| docs/audit/ — 5 md | АРХИВ | рабочий фронт аудита эры 29.08 (00-INDEX ведёт 007; 04-SECRETS + 07-SWEEP: секреты найдены и почищены — MVSEP-ключ удалён tsc 212→211, check-secrets.mjs + pre-commit живут); для города = закрытые результаты + история | era-* при реформе (секретные значения не копировать!) |
| docs/audit/00-INDEX.md | КАНОН | живой фронт серии аудита (ведёт 007, старт 29.08), 5 входящих | — |
| docs/auto-lyrics/ — 5 md | КАНОН | ⭐ конвейер ЖИВ: auto-lyrics.service.ts 2152 строки (док:387 «2142» — минор); константы §11 1:1 (MIN_CANDIDATE_SCORE:0.40 :28 … WORDS_WINDOW:3 :33); lrc-parser 27 строк ре-экспорт; word-sync/ 17 файлов; тесты на месте; ONBOARDING-PATH near-орфан (0 вх) | минор: док:387 2142→2152 |
| docs/archive/superseded/ — 3 md | КАНОН (осознанный архив) | designated-место устаревших (301 §5); 2.2-дельты + scenario-stage-state-model с честной STALE-меткой | — |
| docs/governance/ — 3 md + DOMAIN-OWNERSHIP.yaml | КАНОН (ядро владения) | DOMAIN-OWNERSHIP.yaml:181-190 — живая матрица (governance owner 007/keeper 009 ✅ 1:1); agent-governance-map «HISTORICAL — не канон» (:3); GOVERNANCE-FINAL-FREEZE-01 — июньский базлайн, ownership 1:1 с YAML | freeze-док: шапка HISTORICAL → 200 |
| docs/character-ai/RESEARCH-REPORT.md | АРХИВ | research-отчёт эры (FullAvatar/FallbackAvatar/AIChatPanel — история); 7 вх | era-* |
| docs/guides/«Onboarding Route 2.1.md» | КАНОН | fast-entry guide жив; 1 вх | — |
| docs/sessions/2026-06-14-evening.md | АРХИВ | сессия-запись эры; 0 вх | era-* |
| docs/telegram/bot-catalog-integration.md | КАНОН | ⭐ TG-каталог ЖИВ: воркер belive-feed-bot/ (index/commands/tg/tracks.ts 52 LP ✅); фронт CatalogContent.tsx:14/:34 downloadTgTrack ✅; KV id bd9b1fdb… wrangler.toml:20 ✅; известный дрифт Content-Length (док:27 vs index.ts:86-93) — уже в team-m/REGISTRY:50-51 | закрыть CL-дрифт (200→007) |
| docs/operations/packs/ — 58 md | КАНОН (осознанный архив) | 58/58 tracked; INDEX эр 13+21+20+3 = 57 ✅; переезд по манифесту 301, GO Никиты; bootstrap §1 «не пересматривай» — соблюдено, проверена целостность | выжимки А+К — долг будущих сессий |
| docs/operations/context/ — 3 md | ТРУП-кандидат (untracked) | 0/3 tracked (?? git status); 013-HANDOFF pitch-chain эры (PitchChain/PitchNode/soundtouch-processor — мёртвые пути), 014-SPIKE Signalsmith (спайк закрыт S1-фиксом), GPT-DEEP-RESEARCH SoundTouch-эры | 🔴 packs/era-* или _redirect |
| docs/operations/archive/ — 2 md | КАНОН (осознанный архив) | MEGA-PACK в репо = stub 3910 б/60 строк (полный — мост tmp); HANDOFF 3474 б tracked — уникальный контент из §7 манифеста 301; 2/2 tracked | — |

### Топ-находки батча-4
1. **71 untracked .md в docs/** (sync 47 + agents 7 + agents-hub 17) — ghost-floors: gitignored-эры, живущие на дисках. Чистый клон их не увидит.
2. **CI doc-sync-check.yml — зомби-гейт:** формально жив (PR-триггер, exit 1), но шаги 2-4 инертны — гейтит пустоту.
3. **auto-lyrics + telegram — неожиданно сильные КАНОНЫ:** конвейер (2152-строчный сервис, константы 1:1) + TG-воркер (52 LP) живы и сверены клейм-в-клейм.
4. **superseded/ + packs/ — паттерн архивации работает:** образцовые осознанные архивы с честными ярлыками; реформа может опираться на образец.
5. **governance DOMAIN-OWNERSHIP.yaml — живое ядро владения** (007/009), freeze-док — исторический базлайн.

### 📋 ОЧЕРЕДЬ ПРАВОК — топ-10 расхождений (003 → 200/007, по диспатчу 200 от 21:00)

| # | Док/зона | Что врёт | Правка | Исполнитель |
|---|---|---|---|---|
| 1 | slot-matrix-system-v2.2.md | ТРУП с живыми индексами: H1 «Do NOT use», но README.md + docs/INDEX.md ссылаются | rewrite или redirect + убрать ссылки из индексов | 200 (редирект) + 007 (правка индексов) |
| 2 | ADR-0015-frozen-zone-policy.md | frozen = 1 зона (AudioEngineV2) vs канон 4 зоны; .frozen-zones.json + check-frozen.mjs НЕ существуют | расширить до 4 зон ИЛИ пометить superseded (живой носитель — frozen-zones-v2.md = КАНОН) | 200 → 🔴 Никита |
| 3 | 01-BASELINE.md (modernization) | 31 входящий читают как текущий бейзлайн; база — несуществующий d5c66bd (tsc=307 vs канон 293) | шапка-ярлык «HISTORICAL SNAPSHOT of dead branch 067-e-regime-0» | 200 |
| 4 | PLAN-v3.3-CANONICAL.md §1 | статусы от 25.08 (M5 ⬜/GO ⬜/E7 ⬜) при свершившемся финишe + PROD-push 28.08 (REGISTRY:43-45) | обновить статусы фаз | 007/Ц3 (канон-план — их мандат) |
| 5 | docs/INDEX.md | «Last updated 2026-06-10»; в оглавлении НЕТ eventbus-v2, frozen-zones-v2, feed-social-v2, transport-v3 (+ битый путь SYNC-HUB) | обновить оглавление + дату | 007 (коммит) по списку 200 |
| 6 | transport-v3.md + audio-engine.md | engine-v3 после ARC-2c/d/e: пути уехали в core/, 5 фантомных модулей (VocalMixV3…RateParamV3), «7 modules» ≠ ~30+; нарратив «V2 frozen + V3 additive» устарел | обновить перечни модулей и форм-фактуру | 007 (после Этапа-1 города) |
| 7 | docs/sync: 2 yaml + CI-гейт | INDEX.md:51 зовёт yaml SOURCE OF TRUTH, а это снапшот 2026-07-17; doc-sync-check.yml шаги 2-4 инертны (гейтит пустоту) | шапки HISTORICAL на yaml + 🔴 судьба гейта (фикс vs снос) | 200 → 007/Никита |
| 8 | modernization/REGISTRY.md | 76 входящих на era-хаб мёртвой ветки (шапка «HEAD d5c66bd»); живые реестры — team-m/ | после решения 🔴 #11 — редирект входящих | 200 (после #11) |
| 9 | MAC-PC-BRIDGE-SPEC.md + SYSTEM-REPORT-V007 | эра-трупы: топология/роли перекрыты SHARED-REGISTRY §0 (10+8 входящих живут старой правдой) | _redirect → SHARED-REGISTRY §0 | 200 |
| 10 | 71 untracked .md (docs/sync 47 + docs/agents 7 + agents-hub 17) | ghost-floors: gitignored, живут только на дисках; чистый клон не увидит | 🔴 STORAGE-POLICY: трекать/архивировать/сносить | Никита (по линии 301-манифестов) |

**Минор-пакет путей (один MICRO-PACK на всё, ~12 точечных правок):** character-layer (+src/ ×6) · auth-system (gateway/handlers) · metrics-system (metrics-sync.service + gateway) · takes/show (bridge→store/bus) · exercises (src/exercises/) · feed.md (src/catalog/feed/) · zip/init/central-bridge (main.tsx, tests-пути) · billi (+src/js/ai/) · eventbus-v2 (цифра wrappers) · auto-lyrics (2142→2152) · block-first/exercises (2 битые ссылки на несуществующие доки).

**🔴 вне очереди правок (решения, не правки):** SRI-PATCH применить/закрыть (integrity=0) · BELIVEBASE-CHARTER «Bridges на слом» — арбитраж против frozen-зоны · 02-PROGRAM-ROADMAP → superseded (🔴 #15, known) · operations/context 3 md → packs/era-*

## Батч 5 — team-m/ (272 единицы: 104 корневых + 12 опер-ядра + 81 reports + 66 archive + 7 bLb + 2 design-refs) · ЗАКРЫТ 21:39 · ЖИВО 34 · РАБОЧАЯ-ЭРА ~196 · ЭПОХА-ХВОСТ 3 · ТРУП-КАНД. 8 · РАСХОДИТСЯ 3

| Зона | Статус | Доказательство | Действие |
|---|---|---|---|
| **Опер-ядро** REGISTRY.md + SHARED-REGISTRY.md + INBOX.md | ЖИВОЙ МЕХАНИЗМ (не вердиктится) | REGISTRY послед. запись 28.08 (SSOT 007 — отстаёт от 30.08-потока); SHARED-REGISTRY жив 30.08 (командный SSOT); INBOX авто-реген (посл. 29.08) | — |
| FRONTS.md | РАСХОДИТСЯ | эра M3-дуэта: rg «город|кадастр|bLb» = 0; декрет 21:00 (город=Этап-1) не отражён; актуальные фронты — в ROADMAP-REPO-TO-CITY + SHARED | обновить под декрет или пометить историческим |
| AUDIT-REPORT-2026-08-30 (301) | КАНОН (срез на b0879ed) | ⚠️ §1.1 цифры устарели собственными манифестами 301: 33→28 мёртвых, 329→396 экспортов, 446→504 md | аннотация «см. пересчёт в DEAD-CODE-MANIFEST» → 200 |
| DEAD-CODE-MANIFEST + DOCS-AUDIT-MANIFEST (301) | КАНОН (реестры ожидания) | сносы C/D НЕ применены, ждут 🔴; в CADASTRE-PLAN:2 «НЕ ПРИМЕНЯТЬ, приложится когда C/D в каноне» | — |
| CADASTRE-SEED (исполнен) + CADASTRE-PLAN-v0.3.2-PRE + CROSSCHECK-REPLY (спор закрыт, применён) | КАНОН | сид пророс: houses.yaml v0.3 (незакоммиченный v0.3.1-стэйт: 5 файлов M в git); CROSSCHECK 6✅/3 позиций-решений; v0.3.2-PRE ждёт C/D | — |
| STEPS-FROM-NIKITA (24 позиции, 0 решено) | КАНОН (живой список ожидания) | пакеты A-E ждут 🔴; ни одна не помечена решённой в реестрах | — |
| ROADMAP-REPO-TO-CITY (200) | КАНОН | декрет 21:00 отражён: Этап-1=ГОРОД, Этап-2=МОСТ; MINOR: шапка HEAD-SSOT d024a41 отстала (факт 0b0360f) | шапку HEAD-SSOT обновить → 200 |
| **bLb/** 7 фокус-файлов (houses.yaml v0.3 + city-gen.mjs v3 + city-state.json + tour.yaml v0.3 + bLb-CITY-v0.2-quiet.html + MEGA-PROMPT + [city-description — задача, не файл]) | ЖИВО (ядро Этапа-1) | все 5 артефактов mtime 30.08 14:20-14:25 (последний прогон 707), git M (ждут коммита 007); houses.yaml meta честно = 0.3; v0.3.1 = стэйт-на-диске | коммит 007 (по диспатчу) |
| **design-refs/** MANIFEST + CONTEXT (+19 PNG) | ЖИВО (референс Этапа-1) | референсы ИИ-чата→правая рейка (04/12/13) — приоритет №1 владельца; CONTEXT.md:29,66 цитирует GTRACK-поля | — |
| **reports/007-vinda/** 28 md | СМЕШАННО: 17 живых ARC2A/D/E (30.08, цитируются в реестрах полными путями) + 11 эры 08-28 city-recon | ARC2D-001-CIRCLE3-FINAL-SPEC — SHARED:1619; ARC2E-VERDICT — SHARED:690; живой цепной архив ARC-эры | эра-хвосты → packs при реформе |
| **reports/008/** 3 md + 40 PNG | КАНОН (визуальная карта «как есть») | ROADMAP/CADASTRE-SEED/AUDIT/STEPS ссылаются; 🔴 #1: 34 МБ PNG — архив в мост или оставить | 🔴 вес (301) |
| **reports/m007 + mac-007 + mac-009/** 51 md | АРХИВ (эра 08-24..26) | mac-007: 49 драфтов M3-эры, INBOX «—»; 2 GO-задачи (security-audit-pivot, city-description) — артефакты не сданы | era-* при реформе |
| **archive/** 66 md + 1 patch | АРХИВ (осознанный) | вся эра 08-25 (базлайн-тейл 28.08, REGISTRY:36); НО паттерн не закреплён реестрово (в отличие от docs/archive/superseded) | зафиксировать паттерн в STORAGE-POLICY → 200 |
| ⚠️ **GTRACK-SPEC-2026-08-25.md** (в archive/) | РАСХОДИТСЯ | живая спека, застрявшая в архиве: design-refs/CONTEXT.md:29,66 цитирует «GTRACK-поля» как живые, но путь битый (CONTEXT даёт корневой team-m/GTRACK-SPEC, файл лежит в archive/) | вернуть в корень или _redirect → 200 |
| **reports/008/originals/** 34 МБ PNG | РАСХОДИТСЯ (вес) | открытое решение 🔴 #1 (ROADMAP/CADASTRE-SEED) | 🔴 архив в мост |
| team-m/** root: живое ядро 16** (BOOTSTRAP-707, AGENT-EXEC-MODEL, TRIGGER-PROTOCOL, OPERATING-RULES, MODEL-SWITCH-GUIDE, SUBAGENT-SETUP, SYNC-HANDOFF, PARITY-LEDGER, RED-DOSSIER-CATALOGBILLYCHAT, TZ-CITY-METRICS-RUN, MICRO-PACK-DEADCODE-REMOVAL, MICRO-PACK-DOCS-CLEANUP, SYNC-HUB-TO-MAC-29-city-audit, REPO-TO-CITY-MIGRATION-PLAN, BELIVEBASE-VISION, BRIEF-HY4-LEGACY-REMOVAL) | ЖИВО | мopup-статусы «ЧЕРНОВИК-ГОТОВ ждёт», «ОБЯЗАТЕЛЬНО», «живой леджер ушей» | — |
| team-m/** root: рабочая-эра ~77** (MICRO-PACK-WAVE1..5, V007-батчи, B-SLICE, BAC108, S3-VIDEO, MIGRATION-HOLES, CLOSURE-TABLE-M3-GO, CENTERS-SONNET ×3, брифинги 26/28, SYNC-HUB/MAC-TO ×37, WAVE-*) | АРХИВ-эры | применены/закрыты 28.08; входящие живы цитатами; SYNC-переписка пары эры | era-* при реформе |
| team-m/** root: эпоха-хвост 3** (BRIEFING-TO-SONNET, BRIEFING-V007-TO-M007, TASKS-V007-TO-M007 — все 24.08) | ЭПОХА-ХВОСТ | онбординг V007⇄M007 до эпохи SHARED-REGISTRY | era-* |
| team-m/** root: ТРУП-кандидаты 8** | ТРУП-КАНД. | 1) REPORT-TO-SONNET-VINDA-2026-08-26 — байт-дубль BRIEFING (sha256 равны, 9206 б, cmp IDENTICAL — 301 §1 подтверждён мной) · 2-6) MICRO-PACK-A1A2-CONTRACT, B1-EVENTS, PITCH-CONNECT, PC-MICSOURCE-RACE, PC-PROGRAM-CAPTURE — DRAFT/черновики, не применены · 7-8) FACTION-LINE, SHOW-pilot-01 — шоу-вне-канона | 🔴 снос/redirect по STORAGE-POLICY |
| Мёртвый путь-находка | — | src/js/audio-facade-v3.js — MISS: цитируется MICRO-PACK-PC-PROGRAM-CAPTURE + src/main.tsx:251 + V3StatePublisher.ts:177, но файла нет (есть только тест audio-facade-v3.test.ts) | 🟡 рабочая заметка для 007 |

### Топ-находки батча-5
1. **houses.yaml v0.3.1 — стэйт-на-диске, не в git:** 5 bLb-файлов M (ждут коммита 007 по диспатчу); meta честно = 0.3, реестры анонсируют v0.3.1 — дрейф наименования, не содержимого.
2. **GTRACK-SPEC — живая спека в архиве с битым путём:** design-refs/CONTEXT (живой вход Этапа-1) цитирует поля, путь ведёт в archive/ — кандидат №1 на возврат/redirect.
3. **FRONTS.md — расхождение с декретом 21:00:** 0 упоминаний города, живёт M3-эрой.
4. **VINDA-дубль подтверждён аппаратно** (sha256 + cmp) — труп-кандидат №1 в team-m.
5. **REGISTRY (SSOT 007) отстал от потока:** последние записи 28.08, вся оперативка 29-30.08 идёт через SHARED-REGISTRY — SSOT 007 «спит», его хвост — вопрос к 007/200.

### Остаток миссии: agent-registry/ (22) — Батч-6 · NEXT
