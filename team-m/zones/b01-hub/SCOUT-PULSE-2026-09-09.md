# SCOUT-PULSE · факт-шит «ПУЛЬС: текущее состояние» · 2026-09-09

**Собрал:** explore-скаут CEO_1 · **repo:** main @ 7590dbd · **Для:** прогон Б «ПУЛЬС-нервная система: агент-на-механизм» (берёт CEO_1 по разделению с 007_2).
**Errata CEO_1 (после сверки с моим ls):** скаут сообщил «src/bridges/ ПУСТО» — **неверно**: `src/bridges/live-guard.ts` существует (frozen-манифест 2/2 = AudioEngineV2 + live-guard; я листинговал файл лично). Совместимость `src/audio/compat/` — правда пуста (patchV1 снесён Волной A). Остальное采信 скауту с file:line.

## 1. Конституция — каноны (PULSE-RUN-CONSTITUTION.md, 123 стр)
Цепь 001→005→002→001→009 (строгая последовательность) · DUAL-MAP (две независимые карты, diff>одной) · PIXEL-BASE-FIRST (база→реализация→сверка) · EXTRACTION-СИГНАТУРА `(value,{intermediate})` · SURFACE-SMOKE (машинный перебор: ровно одна поверхность побеждает) · DUAL-TRACK (T-ВИЗУАЛ через песочницу; T-МЕТРО прямо в 007) · 301-роутинг 🔴-вопросов (исключение CEO_1) · правило каналов (артефакт=папка+строка) · §12 (вставки поверх свежего моста) · микро-протокол (база доказательств+009-формат+замер 006)

## 2. Зоны (PULSE-ZONES.yaml, 12+1)
Поля: id/name/agent/status/paths/focus/forbidden/rule · 12 патрулей: B01-HUB(pilot) B09 B08 PHONE(audit) B01-screen · B01-mixer B02 B03 B06 B04 B01-fx B05 (wave1/2) + sandbox B09-facade · chain: `001→005→002→001→009` :12
**Покрытие: 127/477 файлов = 26%, 350 сирот, 16/21 hold без зоны (перемер 301 07.09) · ловушка: --zone требует ТОЧНЫЙ id**

## 3. Гейты verify:ci (6): events (коллизии LEGACY-ключей) · parity (bridge↔wrappers A/B/C) · reach (BFS-граф, --zone) · inert (census фасада) · docvis (G-3b privacy-доки) · junction (G-7 пары declared↔used, TOML-резолв, носитель junction-registry.yaml) · verify:refs отдельно

## 4. Ростер агентов (.opencode/agent/ = 33 файла)
Цепные: 001 (co-architect) · 002 (стресс ≥3 удара) · 005 (ресёрч context7) · 009 (суд read-only) · operator (big-pickle) · **006 — НОВЫЙ: переписан под MiMo V2.5 vision (коммит f389b05, 7 железных правил: ① фото-зрение ② паспорт от 007→анализ→шаги≤10 Никите→скрины→вердикт ③ таблица шагов ④ РЕЦЕПТ не фикс (применяет Оператор) ⑤ вердикт с фактами (мне кажется ≠ вердикт) ⑥ frozen не трогает, коммитит 007 ⑦ DIAGNOSTICS-LOG-YYYY-MM-DD формат АНОМАЛИЯ→ГИПОТЕЗЫ→ПРОВЕРКА→ДИАГНОЗ→РЕЦЕПТ→СКРИН→СТАТУС)**
Зонные: 11 промптов-файлов есть, **agent-factory НЕТ** (B01-screen без промпта — дыра) · 007/008 (+.high) · CEO_1 (claude-opus-5-thinking!) · скауты arch/gateway/sync
Модели: цепь GLM5.3-free · vision MiMo · executor big-pickle

## 5. Слой взаимодействия
SHARED-REGISTRY: §0 протокол (кто-где, 3 метки, ловушки, команда 00) + ПРОЧТЕНО-таблица + LOG сверху (§12) · INBOX.md: таблица agent|task|status|updated (63 отчёта; TTL-правило из INFRA-PACK в долгострое) · TRIGGERS/: 14 файлов, формат `[HH:MM] от X · что (коммит) · ТВОЙ ШАГ · СПЕКА · ПРИЁМКА`, >10 строк архив, живой только 006/007/301 (mtime 07.09) · CHANNEL: 10 файлов, **7 живых** (b01-hub свежайший, REFORM, 5 зонных), 3 застыли (005, 003, YT)

## 6. DECISIONS.md (77 стр): N-секция (Никита, N-12 ПУЛЬС…N-1) · A-секция (архитектура, A-15 зонный патруль…A-1) · M-секция (порядки CEO_1) · «Ожидает слова Никиты» — 6 развилок

## 7. ИНВЕНТАРЬ МЕХАНИЗМОВ (будущие «нейроны»)
- **stores 33**: app/ai/ai-settings/audio/blocks/blockScene/camera/coachPanel/deck/ghost/lyrics/loop(+test)/markers/metrics/mode/monitor/mvsep/notify/piano/pitch/plate/practice-session/recording/show/show-editor/show-presentation/textStyle/track/trackInfo/ui/user-profile/wordSync
- **services 24**: auth/auto-lyrics/audio-analysis/block-scene/cover-art/cover-theme/device-calib/idb/lyrics/metrics-sync/mode-switch/mvsep(+polling)/parsing/playback-orchestrator/show.html/show.image/tg-upload/track.actions/track.loader/track-meta/upload/upload.actions/vocal-onset
- **audio/engine-v3 ≈56 файлов**: core(TransportV3/HybridClock/StemOrchestrator) · pipeline(HybridPipeline/StretchPool/StemChain/LoopStrategy) · stems(StemPlayerV3) · integration(V3StatePublisher/V3DataInterceptor/LoopEngine/DuckGuard/AudioCrashModal) · monitor(Router/AutoMix/PulseCalibrator/DeviceManager) · vendor(Signalsmith) · pitch/ (yin/note-tracker/quantizer) · diagnostics(MANIFEST-ы)
- **sync/**: word-sync(line-map/alignment/providers/confidence) · canvas(peaks/hit-testing) · services(batch-publish/zip-export) · store/selectors/components
- **exercises/**: generators(echo/call-response/backing-ladder/trade/fill-select/tempo-ladder) · runtime(+6 тестов) · store/scope-resolver/interruption/recipes/types · components(QuestEntry/ExerciseStrip/RecipeCard/TempoSetup/CompletionMoment)
- **deck/**: types/modules/registry/BillyChatModule · **foundation/event-bus: 30 файлов, 6 каналов, ~29 событий, 19 wrappers**
- пусто: src/bridges (КРОМЕ live-guard — см. errata), src/track, audio/compat
- **docs/architecture/ = 38 доменных документов** (dock-standard, control-surface-semantics, transport-v3, eventbus-v2, exercises-system, slot-matrix…) — готовые «карты механизмов»

## 8. Гранулярность сегодня
«Агент-на-зону» = 12 (инст) · «глаза-на-голову» = 5 пар 006 · **агентов УРОВНЯ МЕХАНИЗМА (per-store/service/engine-модуль) — НЕТ**. Event-bus 29 событий = готовые «синапсы». DIAGNOSTICS-LOG 006 = протокол «нервных импульсов» уже существует в зачатке.

## 9. Канон-цифры (из реестра, не пересняты)
main tsc=**181** (301, 07.09, на e2732e5 после СНОС-30) · vitest 812/68 · PARITY PASS · reach 0viol/21hold/0stale · junction 3 viol под GRACE (долг CF) · [SB]-гейты 276/803/2-2 (свой трек HEAD!)

## 10. HUB-QUEUE.md (90 стр): диспетчер=agent-rehearsal · Волна-0 (сейчас: зоны доигрывают, Z1 строится) · В1 «БОЛЬШОЙ ПЕРЕХОД ДОКА» (Z1 трансфер-пак одним заходом; ждёт 006+контракты×5+B1-B6) · В2 Studio · В3 Show/Pitch · В4 Quest/Split · В5 Z3-Z5 · трекA=песочница Z1-Z5 · трекB=зоны · конфликт-матрица 7 (слот App.tsx, левая панель, таймер…)
