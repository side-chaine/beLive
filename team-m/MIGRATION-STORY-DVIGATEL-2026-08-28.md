# МИГРАЦИЯ V2→V3 · Сценарная фактура серии «ДВИГАТЕЛЬ» (YouTube)

**ДАТА:** 2026-08-28 · **УПАКОВАЛ:** 007 · **ИСТОЧНИКИ:** arch-scout + sync-scout + gateway-scout (2 прогона каждый), все цифры взяты строго из доков/repo
**СТАТУС:** V3 В ПРОДЕ (push 28.08, main `cdfb2eb..780db23`), тег `v2-final-production` на `cdfb2eb` сохранён специально для A/B-демо в серии

---

## СКЕЛЕТ СЕРИИ (7 эпизодов)

### EP1 · «Потолок» — почему старый двигатель перестал тянуть
- **Hook:** звук разваливается на части — vocals догоняет instrumental через hard-resync (drift > 0.01), длинные сессии = дрейф.
- V2 = `<audio>`-элементы, а не аудиограф: stem = fetch+decode+blob URL+HTMLAudioElement+GainNode; master clock = `instrumental.currentTime`; время зеркалилось через 4 независимые поверхности; две несводимые loop-системы (TrackMap vs Sync Editor).
- Скорость без качества: SoundTouch удалён ещё в Фазе I, playbackRate через pitch-preserve флаги браузера.
- Ядро заморожено (frozen-зона) — расти некуда: любой рост функционала упирался в запрет трогать AudioEngineV2/patchV1/bridges/orchestrator.
- Незакрытые гейты эпохи: Gate 3B BLOCKED, 24-bit decode ломается, production NO-GO (статус 06.08).
- **Cliffhanger:** решение переписать двигатель на ходу, не заглушая старый.

### EP2 · «Стройка города» — V3 рождается
- **Метафора (BELIVEBASE-CHARTER):** город, 10 районов (Transport Center / DSP Factory / Event Station / Monitor Tower / Stem Depot / …), EventBus = дороги, у каждого модуля паспорт.
- **5 законов города:** изоляция («Transport не знает DSP, UI не знает AudioWorklet»), заменяемость (**«Сегодня Signalsmith — завтра AI Stretch. Transport всё равно»**), EventBus — единственная дорога, паспорт обязателен, технология — деталь реализации.
- Что построено: HybridPipeline (единый ctx, шины, single-writer гейна), StretchPool на Signalsmith WASM (STFT 20/40ms) через AudioWorklet, TransportV3 (253 строки, 5 состояний), MonitorRouter (V-Mix: mic→RIGHT, вокал→LEFT, музыка→centre), V2Adapter — единственный мост к frozen-ядру.
- Evidence-first эпоха: S5 PROVEN (байт-в-байт equivalence classifier'а), c44 INVALID (баг harness — повторный GO-контур), MEGA-PACK 185 (5.1MB, 112 записей, 8/8 гейтов).
- **Sync-фундамент (для зрителя простыми словами):** двухслойная модель времени — маркеры (цветные булавки на строках: M1 начало, M2 отрезает проигрыш — до M2 луп Chorus играл лишние 12 секунд) + word-sync (подсветка слова; принцип честности: уверенность < 0.55 → деградация к построчной подсветке, а не «выдуманная точность»). Genius = КАРКАС, lrclib LRC = ТАЙМИНГИ.
- **Cliffhanger:** двигатель построен. Но 7 стемов не влезают в память.

### EP3 · «Семь не влезает» — кризис RAM и DUO-перелом
- **Hook (verbatim Босса):** «на индикаторах микшера пусто», «звук идёт с небольшими прерываниями», «навигация не работает! BPM не работает!», «слегка флэнжерит», «скорее всего RAM не тянет».
- Математика: float32×2ch×4bytes = 55MB/стем; 7 стемов = ~385MB AudioBuffer + ~385–500MB WASM + React = **1.2–1.7GB working set** (2013 MBP, Chrome с вкладками). Суд 009: «RAM — архитектурная цена V3, не утечка».
- Адвокатская драма: 002 ошибся в битности (16bit = 27.5MB/стем), 001 отклонил атаку, 009 подтвердил REJECT — тройной контур 001→002→001→009.
- duration=0 = «корень всех проблем»: прогресс-бар скрыт, seek мёртв, BPM мёртв, 4 цепочки разорваны.
- **Перелом:** FULL-first была ошибкой (7 WASM, 7 точек синхронизации, race conditions) → DUO-first: 2 WASM ~140MB = 600–750MB вместо 1.2–1.7GB; MP-29 режет пул 7→3; лестница фиксов MP-19…MP-24 (Kill FR-014 → Transport Lock → Await play() → Promise.all).
- **Кульминация (verbatim Босса):** «слышно синхронно звучит инструментал со стэмами! все синхронно!» Десинхрон ударных побеждён.

### EP4 · «Полный свет» — охота на дыры
- **Hook:** за 1 час автономного прогона — MIGRATION-HOLES: 7×P1 + 8×P2; после двух adversarial-прогонов P1=5/P2=10.
- Драма инцидентов: fallback dead-zone (init упал → приложение НЕМЕЕ до reload, retry=0); program-capture пишет видео БЕЗ ЗВУКА end-to-end; mic-race (два getUserMedia → orphaned streams); R8-калибровка зануляется; V2-polling 100ms затирает корректные 60Hz от V3StatePublisher.
- **GUARD-36 — война двух аудитов (sync-драма):** Мак grep'ал литерал `GUARD-36` → 0 совпадений → «решено»; PC grep'ал `[GUARD]` → нашёл; sshfs-монтаж падал 2×, факты через битый канал. Финал: честная поправка Мака («мой grep отсёкся head -5»). Урок серии: **метка ≠ токен**, две команды сводят факты. (Проблема живая, pre-existing: при загрузке 52/55 маркеров out-of-bounds — в очереди bLb.)
- **Развязка:** Operator-поезд из 10 паков за день; F-1/F-2 пилот PASSED в браузере Босса: `[StretchPool] ✅ 7/7`, `[V2Cage] ✅ V2 silenced`, 5 стемов, autoplay.

### EP5 · «Флип и шесть волн» — переключение на живой двигатель
- **Hook:** флип = правка ОДНОЙ КОНСТАНТЫ одним коммитом (`2395c1e7`, engine-mode → v3).
- **TC-010 — убийство N:M-матчинга (sync-перелом):** легаси matchGeniusToLrc = 38 нечётких матчей в 3 прохода, системный дрейф −1.0…−2.8s (LRC-таймстампы были от НЕ ТОЙ версии трека: 201s vs 203s — детектив с подбором версии по длительности). После: LRC = единственный источник, матчинг по блокам (7-8 матчей), дрейф ≈ 0, код 450+ → 163 строки.
- Волны W1–W6 (leaves-first: режем safe-вызовы, frozen нетронут): W2b-регрессия (мёртвый writer `__v3Active` → фикс P1-throw); W3 −557/+5 (снос DuckGuardV3); **W4 = странгулятор frozen-оркестратора**: `track.loader.ts` — байт-идентичная копия frozen `track.orchestrator.ts:5-592` (591 строка) + re-point 3 импортёров + снос legacy (tsc 302→296); W5 — Block Editor МИГРИРОВАН не убит (openBlockEditor); W6 — мёртвые waveformEditor-ссылки.
- Цифры волн: tsc 313→296, vitest 761 (63/63 файлов), closure-таблица 18 строк (11 закрыто полностью), frozen **21×SHA256 идентичен во всех волнах**, frozen-guard GREEN (546 файлов скана).
- **Человеческое:** у Мака нет node — PC гоняет канон, Босс слушает ушами; W3/W4/W5-SMOKE пройдены живьём.

### EP6 · «Последний баг перед продом» — S1 + разведка
- **Hook:** прод-превью молчит. В консоли 7× `ReferenceError: q is not defined`.
- Механика: минификатор переименовал символы замыкания в blob-коде ворклета (вендор генерит worklet через `function.toString()`) — код, работавший в dev, умер в проде. 7 ошибок = 7 stretch-инстансов → вокал не готов → тишина.
- Фикс: штатный escape-hatch библиотеки `moduleUrl` → статический `public/vendor/SignalsmithStretch.mjs` без минификации (wasm встроен base64) + CF-заголовок Content-Type + автокопия в сборке (цепь 001→002→009, дельты 002: MIME для CF nosniff, анти-дрейф плагин).
- Твист: первое «не работает!» было ложной тревогой — кэш PWA + аудио-устройство Босса; S1-SMOKE: 7/7, play/seek/Space ✅.
- **Бонус-сцена (gateway-scout):** разведка перед продом находит в прод-авторе диагностический роут `/auth/debug-hmac`, отдающий БАЙТЫ JWT-СЕКРЕТА → цепь снимает роут в тот же день. «Разведка доложила — крепость закрыла ворота». (Ротация секрета — за Боссом.)
- Выкат: прод = реальный Google OAuth (mock выключен), AI Gateway — «потом». Push `cdfb2eb..780db23`, деплой верифицирован на CF Pages (app.mybelive.com) и GH Pages.

### EP7 · «Памятник» — эпилог
- **Hook:** A/B-демо — тег `v2-final-production` сохранён специально: старый и новый двигатель рядом.
- Наследие: frozen-зона — ни одного байта за всю миграцию (памятник); живой байт-идентичный двойник оркестратора = track.loader.ts; V2Adapter DEFER (4 импортёра); очередь bLb-эпохи.
- **AI-арка:** прод взрослеет по частям — сначала личность (реальный OAuth), потом интеллект (AI Gateway заморожен «на потом», но наработки законсервированы: aiHub-шина, Billy FSM patrol|groove|think|sleep, provider-абстракция; драма BAC-108: «никто не бьёт в localhost тихо» — warn в dev, throw в проде).
- **Итоговые цифры серии:** tsc 296 · vitest 761/63 · StretchPool 7/7 · RTL голоса 47→15–25ms · load-to-first-audio 1.1–1.4s · render quantum 2.9ms · STFT 20/40ms · 21 frozen-файл SHA-идентичен · MEGA-PACK 5.1MB/112 записей.
- **Финал:** «Город строится» — следующий квартал: AI District, примочки с latency-паспортом, «сегодня Signalsmith — завтра AI Stretch».

---

## VERBATIM-ЦИТАТЫ БОССА (золото для озвучки)
- «на индикаторах микшера пусто» · «звук идёт с небольшими прерываниями» · «навигация не работает! BPM не работает!» · «слегка флэнжерит» · «скорее всего RAM не тянет»
- «слышно синхронно звучит инструментал со стэмами! все синхронно!» (момент победы)
- Директива финального рывка: «закончить миграцию, ноль JS / ноль Легасив, только React + современная архитектура»

## ИСТОЧНИКИ (всё верифицировано скаутами чтением)
docs/HISTORY-MAP-V2-V3-MIGRATION.md · docs/architecture/audio-engine.md · docs/SONNET-REPORT-13-DUO-STRATEGY.md · docs/BELIVEBASE-CHARTER.md · docs/architecture/LATENCY-REGISTRY.md · docs/architecture/sync-system.md · docs/architecture/block-first-lyrics-sync.md · docs/architecture/marker-system-spec.md · docs/sync/MASTER-SYNC-REGISTRY.md · docs/character-ai/RESEARCH-REPORT.md · team-m/REGISTRY.md · team-m/PARITY-LEDGER.md · team-m/MIGRATION-HOLES.md · team-m/CLOSURE-TABLE-M3-GO-2026-08-28.md · team-m/ROADMAP-FINAL-STRETCH-2026-08-26.md · team-m/MICRO-PACK-BAC108.md · team-m/WAVE-HANDOFF-INDEX.md · team-m/archive/SYNC-MAC-TO-HUB-2026-08-25.md («ЧЕСТНАЯ ПОПРАВКА» — для сцены GUARD-36)

## ОСТАТОК (не критично для сценария)
REPORT-MIGRATION-AUDIT · WAVE-EXEC-PLAYBOOK/PREFLIP-BASELINE/FROZEN-INVARIANTS · MICRO-PACK-WAVE1..5 · AUDIO-BEHAVIOR-SPEC · sync код-сверка (wordSync.store ↔ sync-system.md §5.1) — при желании углубиться.
