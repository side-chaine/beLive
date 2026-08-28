# ЗАДАНИЕ ЦЕНТРУ_6 (GLM 5.3) · ДИЗАЙН-ПРОРАБОТКА ГОРОДА beLiveBase
Дата: 2026-08-28 · От: 007_Мак (Far Light) + Босс · Все данные и коды — в приложениях ниже

---

## 0. СУТЬ ЗАДАЧИ

beLive — PWA для вокалистов: синхронизированная лирика со **светящимися словами** в реальном времени (Репетиция/Караоке/Концерт/Live), AI-персонаж Билли. Ядро бренда — «светящееся слово» на тёмной сцене.

Мы строим **beLiveBase — город будущего**: визуализацию кодового репозитория, где каждое здание = модуль кода, квартал = продуктовый район. Город генерируется из машиночитаемого кадастра (houses.yaml), поэтому визуал всегда синхронен с правдой репо.

**Город нужен для трёх вещей:**
1. Команде: с одного взгляда — что живо/строится/сносится, кто владелец. Клик → паспорт здания.
2. YouTube-каналу: «сегодня внедряем фичу X» → камера подлетает к зданию, оно загорается, человечная подпись. Город растёт вместе с проектом — нарратив канала.
3. Ощущение стратегии развития: строим одно, чтобы получить другое.

**Твоя задача:** финальная дизайн-проработка города — арт-направление, система форм, кодировка статусов, и живой HTML-прототип, который ЖРЁТ РЕАЛЬНЫЙ КАДАСТР (Приложение A) и рисует город. Скриншоты приложения beLive Босс приложит к этому сообщению — город обязан быть из той же вселенной, что и сцена.

---

## 1. ЧТО УЖЕ ПРОЙДЕНО (не наступать на грабли)

### 1.1 Каркас 007 (v1) — отклонён Боссом и раскритикован Опусом
Изотермические кубы, статус только цветом, подписи наезжают, кварталов не видно, подземка = строчка текста, город висит в пустоте. Код каркаса и честные ответы про его устройство — в Приложении A (блок 7) и в репо `team-m/bLb/bLb-SNAPSHOT.html`.

### 1.2 Диагноз Опуса (принимаем как ТЗ)
- **«Это не город, это диаграмма состояний в изометрии. Куб не может быть носителем смысла, потому что у куба нет характера.»**
- **Статус нельзя кодировать цветом.** YouTube-компрессия жрёт тонкие линии и тёмные градиенты, плюс дальтоники. Читаемость за 1 секунду даёт **силуэт + свет + структура, цвет только третьим слоем**. Легенда — признание поражения: статус читается БЕЗ неё.
- Что Опус забрал в концепт из каркаса (не потерять): тёмный сине-графитовый фон, **амбер-акцент — это и есть свет beLive, найден случайно, использовать как главного героя**, моно-типографика, паспорт справа, пунктирная дорога за горизонт, панель целей.
- Иерархия: высота = размер модуля, яркость окон = свежесть коммитов, толщина дороги = вес связи. Без чисел город — декорация, а не приборная панель (числа есть в Приложении A, блок 2).
- Кварталы обязаны читаться: дома стоят слипшимся комом — нужны границы районов.
- Подземка EventBus — самая интересная часть системы — должна быть нарисована, а не написана.
- Плотность и глубина: для YouTube город не может занимать 40% кадра в пустоте.

### 1.3 Макет Gemini «Night Stage» — текущая основа (Приложения B и C)
Gemini выдал: систему архетипов (tower/factory/plaza/arena/lab/gate/campus/archive), кодировку состояний силуэтом+светом (амберные окна / леса+вымпел ДЕМО / меловой пунктир+кран / ледяной куб-сейф / тент со шнуровкой / аварийная лента), палитру, математику изометрии, формулу высоты из LOC, живую подземку (пульс 84 BPM) и полный интерактивный HTML с режимами Житель/Инженер/Эфир и lower-third для стрима.

**Твоё отношение к макету Gemini:** аудит + развитие. Скажи прямо, что в нём сильно, что слабо, что противоречит данным/бренду из Приложения A — и дай финальный вариант.

---

## 2. ЧТО ЖДЁМ НА ВЫХОДЕ

1. **Арт-направление** одним абзацем: идея, настроение, почему это beLive (музыка, свет, сцена), а не generic sci-fi.
2. **Система форм:** архетипы зданий (силуэты, а не цвета) — башня/завод/площадь/арена/врата/кампус/архив/мастерская + правила этажности из метрик.
3. **Кодировка статусов силуэтом+светом** (alive/demo/planned/trash/conserved/frozen/external) — читается за 1 секунду без легенды, переживает YouTube-компрессию, безопасно для дальтоников.
4. **Кварталы:** границы районов, центр города (Площадь Каталог — guest-first), группировка из кадастра.
5. **Живая подземка EventBus:** 6 каналов / 29 событий (Приложение A, блок 3.2) как трассы с пакетами.
6. **YouTube-режим (Эфир):** камера к зданию при «внедрении фичи», lower-third, безопасные зоны под оверлеи стрима.
7. **ФИНАЛЬНЫЙ HTML-ПРОТОТИП:** один файл, без сборки и тяжёлых зависимостей (системные шрифты или один Google Font), данные — JSON между маркерами `/*CITY-STATE-START*/..END` (совместимо с нашим генератором city-gen.mjs), реальные 20 зданий из Приложения A с реальными метриками (высота = LOC, окна = свежесть), Chrome/Safari, цель < 500 KB, 30 FPS статика / 60 FPS динамика.

## 3. ЖЁСТКИЕ ОГРАНИЧЕНИЯ (нельзя нарушать)

1. Визуал не имеет права врать: статусы/метрики — только из кадастра, ничего «нарисованного вручную» поверх правды.
2. Frozen-здания (охраняемое ядро AudioEngineV2/bridges) не могут выглядеть сносимыми или строящимися — они под пломбой, это смысл.
3. Паспорт здания генерируется из данных, не пишется руками в картинке.
4. Свет города = масштабированный свет слова: белый двухслойный glow (#fff, 8px/0.5 + 20px/0.25), неон #0dcaf0 вторым слоем, глубокий тёмный фон. Точные параметры — Приложение A, блок 6.

## 4. РЕФЕРЕНС НАСТРОЕНИЯ

Свет живого концерта: тёплый прожектор в темноте. Не игра. Сцена.

---

# ПРИЛОЖЕНИЕ A · ПОЛНЫЙ ПАКЕТ ДАННЫХ ОТ 007 (кадастр, метрики, граф, бренд, статусы, миграция)

# ОТВЕТ 007 → АРХИТЕКТУРНОМУ ЦЕНТРУ · ПАКЕТ ДАННЫХ beLiveBase
Дата: 2026-08-28 · Автор: 007_Мак (Far Light) · Репозиторий: beLive, ветка backup/win-V3-finish_2-2026-08-23
Формат: сырьё в fenced-блоках. Чего нет — `НЕТ ДАННЫХ`, не выдумано. Блоки 1–3 наверху.

---

## БЛОК 1 · КАДАСТР

### 1.1 Схема houses.yaml (текущая v0.1 + целевое расширение)

```yaml
# ТЕКУЩАЯ СХЕМА (v0.1-draft)
meta:
  version: string        # required
  date: yyyy-mm-dd       # required
  author: string         # required
  decisions: [string]    # optional, решения Босса
  note: string           # optional
houses:                  # required, список
  - id: string           # required: "001" | "003-005" | "infra" | "external"
    quarter: string      # required: человеческое имя квартала
    modules: [string]    # required: пути src/ (или внешние ресурсы)
    owner: string        # required: "center/007 (домен)"
    status: enum         # required: alive | alive-demo | planned | trash-w4 | trash-w5 | conserved | external
    frozen: [string]     # optional: frozen-файлы внутри
    placeholder: [string]# optional: .gitkeep-зоны планируемых зданий
    note: string         # optional
    risk: string         # optional
open-seams: [string]     # optional: открытые швы города

# ЦЕЛЕВОЕ РАСШИРЕНИЕ (что реально добавить на этой неделе без боли)
# УЖЕ СОБРАНО (блок 2), можно вносить в кадастр сразу:
#   size_loc: int, size_files: int,
#   activity_last_commit: yyyy-mm-dd, activity_touches_30d: int, activity_touches_90d: int,
#   purpose: string (одна фраза «зачем это живому человеку» — есть в city-state.json),
#   docs_url: string (известны для большинства, см. 1.3)
# ТРЕБУЕТ СКРИПТА НА PC (node), на этой неделе НЕ обещаем:
#   deps[] (import-граф), exports_count, coverage_pct, bundle_kb, since/until (first-commit даты)
```

### 1.2 Все записи houses.yaml как есть

```yaml
meta:
  version: 0.1-draft
  date: 2026-08-28
  author: mac
  decisions:
    - "Босс 28.08: дыры ownership — решает Мак; дефолт center/007 (keeper 007)"
    - "Босс 28.08: Karaoke/Concert — ПЛАНИРУЕМЫЕ здания, не delete; сначала Репетиция к проду, потом остальные режимы включая Live"
    - "Босс 28.08: фазы не должны перегружать финиш v2→v3; ротация ключей — не приоритет, после настройки"
  note: >
    Census заявляет 17 кварталов, строк фактически 18 (Арены внахлёст) —
    счёт уточнить перед final (Gate D).

houses:
  - id: 001
    quarter: Врата
    modules: [src/components/welcome, src/components/onboarding]
    owner: center/007 (governance-default)
    status: alive

  - id: 002
    quarter: Площадь Каталог
    modules: [src/catalog]
    owner: center/007 (новый домен catalog — закрыть в DOMAIN-OWNERSHIP.yaml)
    status: alive

  - id: 003-005
    quarter: Завод Studio
    modules: [src/audio/core, src/audio/compat, src/audio/engine-v3, src/stem]
    owner: center/007 (audio-engine, stem)
    status: alive
    frozen: [src/audio/core/AudioEngineV2.ts, src/audio/compat/patchV1.ts]
    trash-w4: [src/audio/engine-v3/V2Adapter.ts, src/audio/engine-v3/IV2PublicContract.ts, src/audio/engine-v3/SignalsmithAdapterService.bak.ts]

  - id: 006-008
    quarter: Академия Quest
    modules: [src/exercises, src/practice, src/takes]
    owner: center/007 (exercises, practice, takes)
    status: alive

  - id: 009-010
    quarter: Театр Show
    modules: [src/components/Show, src/services/show.html.ts, src/services/show.image.ts]
    owner: center/007 (show)
    status: alive

  - id: 011
    quarter: Башня Split
    modules: [src/components/monitor]
    owner: center/007 (monitor)
    status: alive

  - id: 012
    quarter: Ателье Styles
    modules: [src/theme, src/styles, src/data/textStylePresets, src/components/StylesDeck]
    owner: center/007 (theme); styles/data — center/007 (под theme, полудыра закрыта)
    status: alive

  - id: 013
    quarter: Лаб Notes
    modules: [src/audio/pitch, src/components/PianoKeyboard, src/js/main.js]
    owner: center/007 (audio-engine, частично)
    status: alive
    note: src/js/main.js — legacy PitchDetectionEngine, кандидат W6

  - id: 014
    quarter: Башня Билли
    modules: [src/billy, src/character]
    owner: center/007 (billi-ai); character — center/007 (под billi-ai; паспорт здания написать до final)
    status: alive
    risk: character саморегистрируется в initRegistry, но без паспорта здания

  - id: 018-019
    quarter: Мастерская Sync
    modules: [src/sync, src/stores/wordSync.store.ts, src/stores/markers.store.ts]
    owner: center/007 (sync-system, markers)
    status: alive
    frozen: [wordSync.store.ts (FROZEN-READ), markers.store.ts (FROZEN-READ)]

  - id: 020
    quarter: Площадь Hub
    modules: [src/feed]
    owner: center/007 (feed)
    status: alive-demo

  - id: 021-022
    quarter: Арены Karaoke/Concert
    modules: [src/components/KaraokeLyricsBoard, src/transitions, src/backgrounds]
    owner: center/007 (arenas; transitions/backgrounds под arenas)
    status: alive
    placeholder: [src/Karaoke, src/Concert]   # ПЛАНИРУЕМЫЕ здания (Босс 28.08)

  - id: 023
    quarter: Арена Live
    modules: [src/components/LiveControls, src/components/LiveSubtitle]
    owner: center/007 (live)
    status: alive

  - id: 029-030
    quarter: Дом профиля
    modules: [src/components/profile, src/avatar]
    owner: center/007 (avatar+profile; дыра закрыта)
    status: alive

  - id: 031
    quarter: AI Config
    modules: [src/js/ai, src/components/AiSettingsModal]
    owner: center/007 (ai-config)
    status: conserved   # AI deferred, инфраструктура законсервирована

  - id: 032
    quarter: Киностудия фонов
    modules: [src/backgrounds, src/services/block-scene.service.ts]
    owner: center/007 (scenes, частично)
    status: alive

  - id: 034
    quarter: Архив ДНК
    modules: [src/components/TrackInfoBoard, src/services/metadata-backfill.ts, src/structure]
    owner: center/007 (track-meta); structure — center/007 (под track-meta)
    status: alive

  - id: 038
    quarter: Старая мастерская блоков
    modules: [src/blocks]
    owner: center/007 (blocks, снос W5)
    status: trash-w5   # BAC-107, ещё смонтирована в App/main

  - id: infra
    quarter: Вне кварталов — инфраструктура города
    modules: [src/foundation, src/bridges, src/playback, src/runtime, src/deck, src/performance, src/stores, src/hooks, src/triggers, src/services, src/types, src/utils, src/config, src/test, src/__smoke__, src/App.tsx, src/main.tsx]
    owner: center/007 (все инфраструктурные домены)
    status: alive
    frozen: [src/bridges/*, src/services/track.orchestrator.ts]

  - id: external
    quarter: Внешние ресурсы (вне репо)
    modules: [Bank_beLive, kaggle-mms-notebook, cf-workers]
    owner: Босс/оператор
    status: external
    note: >
      Bank_beLive — внешний банк треков; prepare_batch.sh/fix_artifacts.js отсутствуют
      в репо (преемники research/scripts/*.py, research/mms-workbench-01/run.py);
      артефакты research/artifacts/*.json едут в город.

open-seams:
  - L1 exact hash dormant (lyricsHash "", map-2.1:934) — TODO Wave 5, не потерять
  - BAC-108: прод не должен бить localhost:8787 (VITE_GATEWAY_URL, 8d7b5c9)
  - slot-matrix контракт frozen, но док невалиден (MISMATCH) — rewrite до final
```

### 1.3 Поля, которые добавим на этой неделе без боли

```yaml
добавляем_сейчас:      # данные уже собраны (блок 2)
  - size_loc
  - size_files
  - activity_last_commit
  - activity_touches_30d
  - activity_touches_90d
  - purpose            # «зачем это живому человеку» — есть в city-state.json (team-m/bLb/city-state.json)
  - docs_url           # audio-engine.md, transport-v3.md, eventbus-v2.md, central-bridge.md,
                       # init-registry.md, frozen-zones-v2.md, n-stem-architecture.md, takes-system.md,
                       # exercises-system.md, billi-ai-expert-system.md, avatar-visual-engine.md,
                       # feed-social-v2.md, performance-quality-system.md, monitor-mix-v2.md,
                       # show-architecture.md, dock-standard.md, character-layer.md, zip-pipeline.md,
                       # track-loading-pipeline.md, track-meta-pipeline.md, block-scenes-editor.md
потом_скрипт_на_PC:    # нужен node, на Маке его нет
  - deps[]             # import-граф (ts-morph или самописный парсер)
  - exports_count
  - coverage_pct       # vitest coverage ещё не настроен
  - bundle_kb          # нужен прод-сборщик
  - since / until      # git log --diff-filter=A по доменам
```

---

## БЛОК 2 · МЕТРИКИ

Замерено 2026-08-28 по git (ветка backup/win-V3-finish_2-2026-08-23, HEAD 5090d9e).
`touches_30d/90d` = количество file-touch в коммитах за период (git log --name-only), НЕ число коммитов.
Всего в src/: 638 файлов.

```csv
domain,loc,files,exports,coverage_pct,touches_30d,touches_90d,last_commit,deps_in,deps_out,bundle_kb
components,25956,95,НЕТ ДАННЫХ,НЕТ ДАННЫХ,40,159,2026-08-27,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
audio,25003,92,НЕТ ДАННЫХ,НЕТ ДАННЫХ,138,145,2026-08-28,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
services,12883,37,НЕТ ДАННЫХ,НЕТ ДАННЫХ,13,128,2026-08-20,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
takes,6319,25,НЕТ ДАННЫХ,НЕТ ДАННЫХ,48,51,2026-08-27,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
stores,5074,44,НЕТ ДАННЫХ,НЕТ ДАННЫХ,21,62,2026-08-26,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
sync,4646,33,НЕТ ДАННЫХ,НЕТ ДАННЫХ,11,29,2026-08-27,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
catalog,4476,24,НЕТ ДАННЫХ,НЕТ ДАННЫХ,4,166,2026-08-20,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
exercises,3786,29,НЕТ ДАННЫХ,НЕТ ДАННЫХ,6,24,2026-08-23,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
slot-matrix,3296,13,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,2,2026-06-21,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
foundation,2844,36,НЕТ ДАННЫХ,НЕТ ДАННЫХ,51,51,2026-08-28,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
bridges,2513,18,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,6,2026-06-15,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
utils,2191,21,НЕТ ДАННЫХ,НЕТ ДАННЫХ,3,23,2026-08-19,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
blocks,2008,9,НЕТ ДАННЫХ,НЕТ ДАННЫХ,1,11,2026-08-20,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
hooks,1666,13,НЕТ ДАННЫХ,НЕТ ДАННЫХ,5,16,2026-08-27,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
triggers,1562,12,НЕТ ДАННЫХ,НЕТ ДАННЫХ,2,5,2026-08-20,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
js,1539,13,НЕТ ДАННЫХ,НЕТ ДАННЫХ,6,17,2026-08-28,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
billy,1425,12,НЕТ ДАННЫХ,НЕТ ДАННЫХ,1,9,2026-08-20,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
performance,1277,10,НЕТ ДАННЫХ,НЕТ ДАННЫХ,1,7,2026-08-20,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
Rehearsal,1056,9,НЕТ ДАННЫХ,НЕТ ДАННЫХ,1,37,2026-08-19,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
stem,988,4,НЕТ ДАННЫХ,НЕТ ДАННЫХ,2,3,2026-08-23,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
backgrounds,788,4,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,3,2026-06-17,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
theme,768,12,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,1,2026-06-29,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
feed,762,7,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,16,2026-06-24,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
transitions,667,1,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,0,2026-03-08,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
avatar,598,6,НЕТ ДАННЫХ,НЕТ ДАННЫХ,4,10,2026-08-25,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
types,573,8,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,7,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
practice,560,3,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,1,2026-07-04,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
legacy,428,9,НЕТ ДАННЫХ,НЕТ ДАННЫХ,9,9,2026-08-28,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
data,378,2,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,0,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
playback,291,4,НЕТ ДАННЫХ,НЕТ ДАННЫХ,1,2,2026-08-19,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
character,282,6,НЕТ ДАННЫХ,НЕТ ДАННЫХ,9,9,2026-08-25,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
deck,202,4,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,2,2026-06-03,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
styles,119,2,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,0,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
runtime,71,1,НЕТ ДАННЫХ,НЕТ ДАННЫХ,1,1,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
structure,65,1,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,1,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
config,44,1,НЕТ ДАННЫХ,НЕТ ДАННЫХ,0,1,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ,НЕТ ДАННЫХ
```

Примечание: `audio` включает frozen-ядро AudioEngineV2 (25k LOC вместе с engine-v3 AETHER — самым активным доменом прямо сейчас, 138 touches/30d). `legacy` высокий по активности из-за волн сноса W3-W5.

---

## БЛОК 3 · ГРАФ СВЯЗЕЙ

### 3.1 edges CSV (подтверждено доками; полный import-граф = НЕТ ДАННЫХ, нужен скрипт на PC)

```csv
from,to,kind,weight,frequency
src/services/track.orchestrator.ts,src/audio/core/AudioEngineV2.ts,import,1,per-track-load
src/bridges/audio.bridge.ts,AudioEngineV2,import+event,1,seek/play/pause
src/bridges/time-sync.ts,AudioEngineV2,poll,1,10Hz
src/triggers/trigger.bridge.ts,AudioEngineV2,poll(rAF),1,60Hz
src/foundation/event-bus/facade.ts,EventTarget.prototype,patch,1,every-event
js/ai/registry(aiHub),src/character/sound/CharacterSoundManager.ts,event,1,ASSISTANT_RESPONSE_COMPLETED
js/ai/registry(aiHub),src/character/layer2-report-emitter.ts,event,1,ASSISTANT_RESPONSE_COMPLETED
src/character/notify-bridge.ts,team-m/INBOX.md,http-poll,1,1.5s
src/sync/word-sync/providers/gateway-align.provider.ts,VITE_GATEWAY_URL/v1/align,http,1,per-align
src/main.tsx,src/bridges/live-guard,import,1,boot
src/main.tsx,src/character/index.ts,import(side-effect),1,boot
src/foundation/registry/initRegistry,character-layer+notify-bridge+layer2-report-emitter,init-registry,3,boot
полный import-граф,НЕТ ДАННЫХ,,,,
```

### 3.2 EventBus v2 (PRODUCTION, Facade dual-delivery; источник: docs/architecture/eventbus-v2.md, 2026-07-16)

```csv
channel,events,key_events
Audio,10,"track-loaded, playback-state-changed, seek-position-changed, track-stem-ready"
Track,2,"before-change, load-failed"
Catalog,4,"track-saved, tracks-changed, catalog-close, catalog-cleared"
Sync,8,"blocks-applied, active-line-changed, loop-set, loop-cleared, loop-completed"
UI,3,"mode-changed, block-scenes-loaded, camera-permission-resolved"
Practice,2,"practice:state-changed (объединяет 6 legacy events)"
Total,29,
```

Механика: producer → `EventTarget.prototype` (patch) → LEGACY_EVENT_MAP? → EventBus.publish (для 23 wrapper'ов) И оригинальный dispatch (для frozen bridges). Dedup 50ms, error isolation, source-tag v2|v3.
Полные publisher/subscriber по каждому из 29 событий: типизированы в `src/foundation/event-bus/types.ts` (29 payload'ов) — выгрузим отдельным прогоном по запросу.
Frozen: `src/foundation/event-bus/*` НЕ frozen; `src/bridges/*` ❄️ FROZEN.

### 3.3 Внешние ресурсы за городом

```csv
resource,where,protocol,criticality
Bank_beLive/{Artist}/{Track}/,локальный fs вне репо,fs,высокая (вход пайплайна word-sync)
Kaggle MMS notebook,облако Kaggle,https,средняя (есть локальный преемник research/mms-workbench-01/run.py)
belive-auth,Cloudflare Worker,https (OAuth/JWT),высокая (auth)
belive-ai,Cloudflare Worker,https,ОТСУТСТВУЕТ (H2, деплой не сделан)
belive-gateway,Cloudflare Worker (D1+KV),https /v1/align,высокая (alignment; прод НЕ должен бить localhost:8787 — BAC-108)
belive-mvsep,Cloudflare Worker (KV),https,средняя (stem separation; ключ ротировать — Gate S)
belive-feed-bot,Cloudflare Worker (KV),telegram webhook,низкая (демо фида)
belive-api,Cloudflare Worker,https,средняя
mock-align-server.mjs,localhost:8787 (dev),http,только dev
research/artifacts/*.json,в репо (14 файлов),fs,высокая (frozen artifact contract, едет в город)
```

---

## БЛОК 4 · РАЙОНЫ

```yaml
центр: Площадь Каталог (002)
почему_центр: "гость входит через Врата (001) и сразу видит витрину треков — guest-first доктрина; от каталога расходятся все сценарии: практика, шоу, синхронизация"
вложенность: "квартал → здание; суб-районов пока нет (появятся при росте, например Завод Studio → цеха core/engine-v3/stem)"
кварталы:
  - {id: 001, name: Врата, смысл: "вход без забора — гость сразу творит", houses: [welcome, onboarding]}
  - {id: 002, name: Площадь Каталог, смысл: "витрина треков, PORT-дропзона", houses: [catalog]}
  - {id: 003-005, name: Завод Studio, смысл: "здесь рождаются треки: движок, стемы, микшер", houses: [audio, stem]}
  - {id: 006-008, name: Академия Quest, смысл: "практика: тейки, упражнения, сценарии", houses: [exercises, practice, takes]}
  - {id: 009-010, name: Театр Show, смысл: "движок историй и сцены выступлений", houses: [Show, show-services]}
  - {id: 011, name: Башня Split, смысл: "мониторинг и микс", houses: [monitor]}
  - {id: 012, name: Ателье Styles, смысл: "темы, стили текста, пресеты", houses: [theme, styles, data]}
  - {id: 013, name: Лаб Notes, смысл: "питч-детекция, пианино", houses: [pitch, PianoKeyboard]}
  - {id: 014, name: Башня Билли, смысл: "мозг AI-персонажа: голос, эмоции, навыки", houses: [billy, character]}
  - {id: 018-019, name: Мастерская Sync, смысл: "двухслойная синхронизация лирики", houses: [sync]}
  - {id: 020, name: Площадь Hub, смысл: "лента и профили (демо)", houses: [feed]}
  - {id: 021-022, name: Арены Karaoke/Concert, смысл: "ПЛАНИРУЕМЫЕ арены — стройка после Репетиции", houses: [KaraokeLyricsBoard, transitions, backgrounds]}
  - {id: 023, name: Арена Live, смысл: "живое выступление: субтитры, контролы", houses: [LiveControls, LiveSubtitle]}
  - {id: 029-030, name: Дом профиля, смысл: "дом жителя: профиль, аватар", houses: [profile, avatar]}
  - {id: 031, name: AI Config, смысл: "законсервированная AI-инфраструктура", houses: [js/ai, AiSettingsModal]}
  - {id: 032, name: Киностудия фонов, смысл: "фоны режимов, блочные сцены", houses: [backgrounds, block-scene]}
  - {id: 034, name: Архив ДНК, смысл: "метаданные и структура треков", houses: [TrackInfoBoard, metadata-backfill, structure]}
  - {id: 038, name: Старая мастерская блоков, смысл: "под снос W5 (BAC-107)", houses: [blocks]}
  - {id: infra, name: Подземка, смысл: "EventBus-станция, исторические мосты, scheduler-доставка", houses: [foundation, bridges, playback, stores, triggers, runtime]}
  - {id: external, name: За городом, смысл: "склад Bank_beLive, облачные электростанции CF", houses: [Bank_beLive, kaggle, cf-workers]}
```

---

## БЛОК 5 · СТАТУСЫ

```yaml
enum:
  alive:        "живой модуль, активная разработка или эксплуатация"
  alive-demo:   "живой, но демо-качества (фид)"
  planned:      "чертёж: здание запланировано, кода нет или .gitkeep"
  trash-w4:     "приговорён к сносу волной W4 (ведёт PC)"
  trash-w5:     "приговорён к сносу волной W5 (ведёт PC)"
  conserved:    "заморожен до лучших времён (AI deferred)"
  external:     "внешний ресурс вне репо"
  frozen:       "НЕ отдельный статус, а флаг внутри alive: охраняемое ядро (frozen: [...])"

кто_меняет:
  alive/trash/conserved: "решение Босс + центр/007, фиксация в houses.yaml + REGISTRY"
  trash-w4/w5: "PC/Вёдра исполняет снос, Мак фиксирует статус в кадастре"
  planned→alive: "после реальной застройки (post-M3)"

сколько_сейчас: {alive: 15, alive-demo: 1, planned: 1, trash-w5: 1, conserved: 1, external: 1}  # всего 20 зданий на карте

переходы:
  - planned → alive (застройка)
  - alive → trash-w4/w5 (решение о сносе)
  - alive → conserved (консервация)
  - conserved → alive (разморозка AI)
  - trash-w4/w5 → (удаление из кадастра после сноса)
  - frozen-флаг снимается ТОЛЬКО решением Центра_3/Босса (OVERRIDE)

frozen_охрана_технически:
  механизм: "team-m/bLb/frozen-guard.mjs — read-only сканер: ловит НОВЫЕ safe→frozen импорты и V2-глобалы вне allowlist (REGISTRY §7 BAC-101..108)"
  спецификация: "FROZEN_SPEC: track.orchestrator, patchV1, AudioEngineV2, bridges/, live-guard; V2_GLOBALS: window.audioEngine/app/trackCatalog/liveMode/lyricsDisplay/markerManager/waveformEditor"
  allowlist: "EXPECTED_IMPORT_OFFENDERS (8 файлов), EXPECTED_GLOBAL_OFFENDERS (11 файлов) — легитимные потребители до флипа"
  baseline: "team-m/bLb/frozen-guard-baseline-2026-08-26.md — GREEN, новых нарушений нет"
  гейты: "каждая волна обязана: frozen-guard GREEN + SHA256 frozen-файлов идентичен + канон tsc/vitest (сейчас 302/761+5int+2load)"
  доктрина: "team-m/WAVE-FROZEN-INVARIANTS.md + docs/architecture/architecture-doctrine.md (инварианты 1-8)"
```

---

## БЛОК 6 · БРЕНД beLive

### 6.1 Цвета (реальные значения из кода: src/theme/tokens/primitive.ts, semantic.ts, src/triggers/word-effects.css)

```css
/* Нейтраль (тёмная тема, база) */
--neutral0:  #000000;  --neutral5:  #0a0a0a;  --neutral10: #111111;
--neutral15: #1a1a1a;  --neutral20: #222222;  --neutral30: #333333;
--neutral40: #444444;  --neutral50: #666666;  --neutral60: #888888;
--neutral70: #aaaaaa;  --neutral80: #cccccc;  --neutral90: #e0e0e0;

/* Акценты (semantic: accentPrimary = purple50, accentSecondary = blue50) */
--purple50: #9b59b6;   /* accentPrimary */
--blue50:   #3498db;   /* accentSecondary */
--orange50: #e67e22;
--red50:    #e74c3c;
--green50:  #2ecc71;

/* Свет слова (ядро бренда) */
--bl-active-color: #ffffff;              /* активное слово — белый */
--bl-neon-color:   #0dcaf0;              /* неон, rehearsal-safe cyan/teal */
--bl-dim-color:    rgba(255,255,255,0.5);/* неактивные слова */

/* Лирика (component tokens) */
lyrics.activeLine: textPrimary; lyrics.inactiveLine: textMuted; lyrics.futureLine: textSecondary;
```

Шрифты: НЕТ ДАННЫХ (вытащим из css отдельно; продукт использует системные + моно для технических панелей).
Логотип: НЕТ ДАННЫХ (Босс приложит).

### 6.2 «Светящееся слово» — точные параметры (src/triggers/word-effects.css, PRODUCTION)

```css
/* ДО слова (dim): */
opacity: 0.5; color: rgba(255,255,255,0.5); text-shadow: none; scale: 1;

/* ВО ВРЕМЯ (active) — базовый FX: */
--bl-active-color: #ffffff;
--bl-active-scale: 1.04;
--bl-active-glow:
  0 0 8px  rgba(255,255,255,0.5),
  0 0 20px rgba(255,255,255,0.25);
transition: opacity/color/text-shadow/transform, 0.12s ease;

/* Уровни фокуса (data-word-focus): */
off:    scale 1.01, glow none, opacity 0.95
soft:   scale 1.04, glow: 0 0 6px rgba(255,255,255,0.4), 0 0 14px rgba(255,255,255,0.2)
strong: scale 1.06, glow: 0 0 10px rgba(255,255,255,0.6), 0 0 24px rgba(255,255,255,0.35)

/* ПОСЛЕ (settled): тихая история — без glow, без анимаций, не конкурирует с активным */

/* Bounce (семейство FX): animation: bl-word-bounce 0.35s ease-out (0.25s lite / 0.45s ultra) */
/* Recording-safe clamp: при записи bounce=none, glow урезан */
/* Neon-семейство: text-shadow 0 0 6px var(--bl-neon-color) (#0dcaf0), strong: 0 0 8px */
/* Performance-тиры: lite/balanced/max/ultra — глубина glow и will-change зависят от тира */
```

Суть для города: **свет города = масштабированный свет слова** — белый активный свет с двухслойным белым glow (8px/0.5 + 20px/0.25), неон #0dcaf0 как вторичный, всё на глубоком тёмном фоне (neutral0-neutral15), переходы 0.12s ease.

### 6.3 Скриншоты продукта

НЕТ ДАННЫХ от 007 — Босс приложит к следующему сообщению (Репетиция, Караоке/Концерт, Билли).

---

## БЛОК 7 · ТЕКУЩИЙ КАРКАС

Скриншот приложит Босс. Файл: `team-m/bLb/bLb-SNAPSHOT.html` (открывается двойным кликом, без сборки).

```yaml
что_работает:
  - семантика статусов (живой/чертёж/снос/консервация/внешнее)
  - паспорт здания по клику
  - переключатель Житель/Инженер (человеческое vs file:line)
  - панель «Сейчас в игре» (стратегические цели)
  - подземка + дорога за город к внешним ресурсам
  - генерация из кадастра (city-gen.mjs сверяет houses.yaml ↔ карту, орёт о дрейфе)
что_бесит:
  - плоские одинаковые коробки — НЕТ иерархии (размер не отражает модуль)
  - НЕТ динамики и ощущения жизни/прогресса
  - подписи мелкие, сливаются
  - статус только цветом (ты прав: нужен силуэт+свет+структура)
что_оставить:
  - data-driven генерацию (визуал не врёт)
  - панель паспорта и целей
  - семантику статусов и подземку/внешнее
```

---

## БЛОК 8 · МИГРАЦИЯ v2→v3

```yaml
что_умирает:
  - "V2-switch machinery: __switchToV3, V2AudioCage, V2ResurrectionDetector, DuckGuardV3, ae-guard (W3 DONE, коммит 02e3ac9)"
  - "src/legacy/engine-v3/ — 7 орфан-модулей V3 (W4, живой LoopEngineV3 уже переехал в audio/engine-v3/integration/)"
  - "V2Adapter.ts + IV2PublicContract.ts + SignalsmithAdapterService.bak.ts (W4)"
  - "live-mode.stub.ts, waveform-editor.stub.ts, __restoreV2Engine, blocks-мост, FIXME facade.ts:51 (W5, BAC-107)"
  - "src/js classic layer: audio-facade-v3.js, monitor-mix.js, marker-manager.js и др. (W6, план)"
что_рождается:
  - "engine-v3 AETHER: TransportV3, HybridClock, StemOrchestrator, HybridPipeline (src/audio/engine-v3/, ~40 файлов, 138 touches/30d)"
  - "EventBus v2: 6 каналов, 29 событий, dual-delivery (PRODUCTION)"
  - "foundation: event-bus + reactions (central-bridge) + registry (init-registry)"
что_переезжает:
  - "W4 orchestrator re-point: 3 импортёра (MixerPanel:180, QuickActions:214, track.actions:7) переводятся с V2 на V3"
прогресс:
  волны: "W1 ✅ W2 ✅ W3 ✅ | W4/W5 — в процессе (ведёт PC) | W6 — план"
  канон: "tsc 302 / vitest 761+5int+2load (HEAD 5090d9e, 2026-08-28)"
  оценка: "~65-70% до M3-победы"
  даты: "волны идут 2026-08-23..28, M3-GO closure-таблица 18 строк готова (team-m/CLOSURE-TABLE-M3-GO-2026-08-28.md)"
событие_для_города: "переезд = снос старых корпусов Завода Studio + запуск новых цехов AETHER; город может показать это как стройку/переезд, а не перекраску"
```

---

## БЛОК 9 · YOUTUBE-РЕЖИМ

НЕТ ДАННЫХ — это решения Босса. Вопросы ему (ответы придут следующим сообщением):

```yaml
вопросы_Боссу:
  - разрешение и битрейт стрима/записи?
  - безопасные зоны под оверлеи (лицо/чат) — где нельзя класть важное?
  - длина сегмента «сегодня внедряем фичу X»: 20 секунд или 3 минуты?
  - камеру по городу вести руками или по скрипту?
  - нужна ли реактивность визуала на музыку/звук?
```

---

## БЛОК 10 · ТЕХНИКА

```yaml
хостинг: "Phase 0 — локальный файл из репо (file://); позже возможен GitHub Pages / CF Pages — концепт не должен блокировать"
регенерация: "ручная: node team-m/bLb/city-gen.mjs на PC (на Маке node нет); CI — позже, по желанию"
мобилка: "MVP — нет; десктоп-браузер"
fps: "30 достаточно для статики; 60 желательно для динамики (трафик/свет)"
вес_страницы: "цель < 500 KB, без внешних зависимостей"
сборка: "строго один .html (данные вшиты между маркерами /*CITY-STATE-START*/..END); city-gen.mjs перегенерирует состояние"
браузеры: "Chrome + Safari последние (Mac/PC)"
```

---

## БЛОК 11 · ГРАНИЦЫ СВОБОДЫ

```yaml
нельзя_трогать:
  - "семантику статусов и машинную правду из кадастра: визуал не имеет права врать о состоянии репо"
  - "frozen-зону: frozen-здания не могут выглядеть сносимыми/строящимися; их охраняет frozen-guard"
  - "данные паспорта: генерируются из кадастра, не пишутся руками в картинке"
бесит_в_каркасе:
  - "плоские одинаковые коробки без иерархии"
  - "ноль динамики и ощущения прогресса"
  - "статус только цветом (читаемость на YouTube-компрессии)"
референс_настроения: "Свет живого концерта: тёплый прожектор в темноте. Город должен светиться как сцена beLive — белый двухслойный glow активного слова (#fff, 8px/0.5 + 20px/0.25) в масштабе целого города, неон #0dcaf0 вторым слоем, всё на глубоком тёмном (neutral0-15). Не игра — сцена."
```

---

_Собрано 007_Маком 2026-08-28: git-метрики по диску, eventbus-v2.md, word-effects.css, theme tokens, frozen-guard.mjs, houses.yaml v0.1. Ждём арт-направление + живой HTML-прототип, жрущий кадастр._


---

# ПРИЛОЖЕНИЕ B · КАРКАС ГЕНЕРАТОРА ОТ GEMINI (архетипы, палитра, математика, gen.js)

# beLiveBase · Архитектурный каркас и генератор города

# beLiveBase · Архитектурный каркас генератора города
> **Статус:** Концепт-каркас v1 (Night Stage)  
> **Основа:** машиночитаемый кадастр `houses.yaml` + чистый SVG-рендер без внешних зависимостей.
* * *
## 1\. Архитектурные принципы
1. **Город из данных:** Никаких ручных SVG-координат для каждого полигона. Геометрия здания считается по формуле от архетипа (`arch`), метрик (`LOC` -> высота $h$) и свежести коммитов (`touches_30d` -> светимость окон).
2. **Система архетипов вместо одинаковых кубов:**
    *   `tower` (Башня): узкий вертикальный силуэт, маяк на крыше, ступенчатый сетбек.
    *   `factory` (Завод): широкий объём, ребристые световые фонари, дымоходы, внутренний тёплый свет.
    *   `plaza` (Площадь): заглубленная плита, концентрические кольца, осевой свет, легкий навес.
    *   `arena` (Арена): массивный контур, открытое ядро, световой конус в небо.
    *   `lab` (Мастерская/Лаб): светопрозрачный конёк, структурный каркас.
    *   `gate` (Врата): портальный проём со световым порогом.
    *   `campus` (Кампус): ступенчатая группа корпусов на общем подиуме.
    *   `archive` (Архив): глухой монолитный объём со щелевым холодным светом.
3. **Кодировка состояний (силуэт + свет):**
    *   `alive`: тёплые янтарные окна, активное дыхание ядра.
    *   `demo`: строительные леса вокруг здания + вымпел «ДЕМО».
    *   `planned`: меловой пунктирный каркас (`stroke-dasharray`) + монтажный кран.
    *   `frozen`: ледяной куб-сейф на крыше (`#B2DFF4`) + печать ядра.
    *   `conserved`: защитный тент с диагональной шнуровкой + спящий синий индикатор.
    *   `trash`: аварийная лента по периметру (`#E85433`), перекос геометрии, искры.
4. **Живая подземка (EventBus):**
    *   Векторные трассы между узлами с пульсирующими пакетами по таймингу (84 BPM).

* * *
## 2\. Математика изометрии и палитра

```javascript
const TW = 64, TH = 32, OX = 616, OY = 152;
const iso = (gx, gy) => ({
  x: OX + (gx - gy) * TW / 2,
  y: OY + (gx + gy) * TH / 2
});

const PAL = {
  void: '#05070D', plate: '#10131A', slab: '#030408',
  live: '#FFB33B', liveHot: '#FFE29A', liveDeep: '#B26417', ember: '#CC7D1E',
  frost: '#B2DFF4', frostDeep: '#4B6E81', chalk: '#BECCDD',
  hazard: '#E85433', standby: '#66667D', outer: '#484D59',
  mass: {
    alive: { top: '#30333A', l: '#1D1F26', r: '#111419' },
    frozen: { top: '#3C515A', l: '#263841', r: '#1A2930' },
    trash: { top: '#2A1B18', l: '#1A0E0C', r: '#100706' },
    conserved: { top: '#252530', l: '#171720', r: '#0F0E16' }
  }
};
```

* * *
## 3\. Базовый код чистого генератора (gen.js)

```javascript
/**
 * beLiveBase Engine Core · Clean Generator
 * Генерирует чистый SVG города из структуры данных
 */

const ARCH = {
  tower:   { base: 20, k: 1.50, inset: 0.16 },
  factory: { base: 14, k: 0.35, inset: 0.10 },
  arena:   { base: 12, k: 0.30, inset: 0.08 },
  lab:     { base: 12, k: 0.60, inset: 0.14 },
  archive: { base: 10, k: 0.40, inset: 0.16 },
  campus:  { base: 8,  k: 0.35, inset: 0.10 },
  house:   { base: 10, k: 0.45, inset: 0.20 },
  plaza:   { base: 4,  k: 0.05, inset: 0.06 },
  gate:    { base: 22, k: 0,    inset: 0.18 }
};

const heightOf = b => Math.round(ARCH[b.arch].base + ARCH[b.arch].k * Math.sqrt(b.loc || 1000));
const freshOf  = b => Math.max(0, Math.min(1, (b.t30 || 0) / 30));

const r2 = n => Math.round(n * 10) / 10;
const pts = a => a.map(p => r2(p.x) + ',' + r2(p.y)).join(' ');
const up = (p, h) => ({ x: p.x, y: p.y - h });
const cen = (gx, gy, w, d) => iso(gx + w / 2, gy + d / 2);

function corners(gx, gy, w, d, i) {
  return {
    T: iso(gx + i, gy + i),
    R: iso(gx + w - i, gy + i),
    B: iso(gx + w - i, gy + d - i),
    L: iso(gx + i, gy + d - i)
  };
}

function faces(gx, gy, w, d, h, i, skew, z) {
  const c0 = corners(gx, gy, w, d, i), sh = skew || 0, zo = z || 0;
  const c = { T: up(c0.T, zo), R: up(c0.R, zo), B: up(c0.B, zo), L: up(c0.L, zo) };
  const T = up(c0.T, h), R = up(c0.R, h), B = up(c0.B, h), L = up(c0.L, h);
  if (sh) { [T, R, B, L].forEach(p => { p.x += sh; }); }
  return { c, top: [T, R, B, L], lw: [L, B, c.B, c.L], rw: [B, R, c.R, c.B] };
}

function buildBuilding(b) {
  const A = ARCH[b.arch], h = heightOf(b), fresh = freshOf(b);
  const st = b.st, m = PAL.mass[st] || PAL.mass.alive, g = [];
  const f = faces(b.gx, b.gy, b.w, b.d, h, A.inset, st === 'trash' ? 3 : 0);

  // Стены и кровля
  g.push(`<polygon points="${pts(f.lw)}" fill="${m.l}"/>`);
  g.push(`<polygon points="${pts(f.rw)}" fill="${m.r}"/>`);
  g.push(`<polygon points="${pts(f.top)}" fill="${m.top}"/>`);

  // Детализация по архетипам (маяки, фонари, кровля)
  if (b.arch === 'tower') {
    const ap = cen(b.gx, b.gy, b.w, b.d), ty = ap.y - h - 14;
    g.push(`<line x1="${r2(ap.x)}" y1="${r2(ty)}" x2="${r2(ap.x)}" y2="${r2(ty - 22)}" stroke="${PAL.outer}" stroke-width="1.5"/>`);
    g.push(`<circle cx="${r2(ap.x)}" cy="${r2(ty - 24)}" r="3.2" fill="${PAL.live}"/>`);
  }

  // Охранная пломба frozen-ядра
  if (b.frozen === 'sealed') {
    const vx = b.gx + b.w * 0.58, vy = b.gy + b.d * 0.16, vh = h + 17;
    const ff = faces(vx, vy, b.w * 0.34, b.d * 0.5, vh, 0.02, 0, h);
    g.push(`<polygon points="${pts(ff.lw)}" fill="${PAL.mass.frozen.l}"/>`);
    g.push(`<polygon points="${pts(ff.rw)}" fill="${PAL.mass.frozen.r}"/>`);
    g.push(`<polygon points="${pts(ff.top)}" fill="${PAL.mass.frozen.top}" stroke="${PAL.frost}" stroke-width="1.2"/>`);
  }

  return g.join('');
}
```

* * *
## 4\. Следующие шаги интеграции с 007
1. Подключить реальные данные из `houses.yaml` взамен зашитых координат.
2. Привязать высоту зданий к актуальным `LOC` из бэклога / репозитория.
3. Пробросить 29 событий EventBus в генератор подземных маршрутов.

---

# ПРИЛОЖЕНИЕ C · ПОЛНЫЙ HTML МАКЕТ GEMINI «NIGHT STAGE» (текущая основа для аудита и развития)

# beLiveBase · Исходный код макета (Night Stage HTML)

# beLiveBase · Полный исходный код интерактивного макета (Night Stage)
Ниже находится полный, рабочий код интерактивного макета с SVG-генератором, системой форм, анимацией EventBus и YouTube-режимом. Вы можете скопировать его целиком и использовать как основу для интеграции в проект.

```plain
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>beLiveBase · Night Stage</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#05070D; --panel:#10131A; --panel2:#151820; --line:#1A2130; --line2:#242B38;
  --ink:#E9E4DC; --ink2:#A39E95; --ink3:#6D6860; --ink4:#46423A;
  --live:#FFB33B; --liveHot:#FFE29A; --liveDeep:#B26417; --frost:#B2DFF4; --hazard:#E85433;
  --verse:#3B9696; --gold:#B59D51; --chorus:#C54C4F; --bridge:#8D6CC2;
  --ease:cubic-bezier(0.16,1,0.3,1);
}
*{box-sizing:border-box} html,body{height:100%} body{margin:0;background:radial-gradient(circle at 50% 18%, rgba(204,125,30,.10), transparent 24%),var(--bg);color:var(--ink);font:16px/1.45 "IBM Plex Mono",monospace;overflow:hidden}
button{font:inherit}
#app{display:grid;grid-template-columns:280px minmax(700px,1fr) 360px;height:100vh}
#left,#right{background:linear-gradient(180deg,var(--panel),#0A0D13);position:relative;z-index:3}
#left{border-right:1px solid var(--line2);padding:24px 22px 18px}
#right{border-left:1px solid var(--line2);padding:24px 22px 20px;overflow:auto}
#stageWrap{position:relative;overflow:hidden;background:linear-gradient(180deg,#070A11,#05070D 24%,#05070D)}
#topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:28px}
.h1{font:700 34px/0.94 "Syne",system-ui;color:var(--ink);letter-spacing:.01em;max-width:9ch}
.kicker,.meta,.muted,.tiny{color:var(--ink3)}
.kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:12px;color:var(--live)}
.meta{font-size:12px}
.stack{display:grid;gap:24px}
.panelTitle{font:700 18px/1.05 "Syne",system-ui;color:var(--ink);margin:0 0 10px}
.goalList{display:grid;gap:12px;margin-top:12px}
.goal{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;color:var(--ink2);font-size:13px}
.goal b{color:var(--ink)}
.modeRow,.tabRow{display:flex;gap:8px;flex-wrap:wrap}
.chipBtn,.tabBtn,.smallBtn{background:transparent;border:1px solid var(--line2);color:var(--ink2);padding:10px 12px;border-radius:999px;cursor:pointer;transition:.18s color var(--ease),.18s border-color var(--ease),.18s transform var(--ease),.18s background var(--ease)}
.chipBtn:hover,.tabBtn:hover,.smallBtn:hover{color:var(--ink);border-color:#3A4352;transform:translateY(-1px)}
.chipBtn.on,.tabBtn.on{color:var(--live);border-color:rgba(255,179,59,.55);background:rgba(255,179,59,.08)}
.smallBtn{border-radius:10px;padding:8px 10px}
.metric{display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 0;border-top:1px solid var(--line)}
.metric:first-child{border-top:0}
.metric b{color:var(--ink)}
#canvasUI{position:absolute;inset:0;pointer-events:none}
#canvasUI > *{pointer-events:auto}
#cityHead{position:absolute;top:22px;left:28px;display:flex;gap:22px;align-items:flex-start}
#cityHead h2{margin:0;font:700 32px/1 "Syne",system-ui;color:var(--live);letter-spacing:.02em}
#cityHead .sub{font-size:12px;color:var(--ink3);margin-top:8px}
#svgHold{position:absolute;inset:0;display:grid;place-items:center}
svg{width:100%;height:100%;display:block}
#transport{position:absolute;left:22px;right:22px;bottom:18px;border:1px solid var(--line2);background:rgba(16,19,26,.92);display:grid;grid-template-columns:auto auto 1fr auto auto;gap:12px;align-items:center;padding:12px 14px;border-radius:18px;backdrop-filter:blur(8px)}
#legendMini{display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--ink3);font-size:11px}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
#featureBox{position:absolute;right:24px;bottom:96px;width:320px;border:1px solid var(--line2);background:rgba(16,19,26,.94);padding:16px 16px 14px;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.28)}
#featureBox h3{margin:0 0 6px;font:700 19px/1.06 "Syne",system-ui;color:var(--ink)}
#featureBox .eyebrow{color:var(--live);font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}
#featureBox p{margin:0;color:var(--ink2);font-size:13px}
#passport h3{margin:0 0 6px;font:700 28px/1 "Syne",system-ui;color:var(--ink)}
.badge{display:inline-block;padding:5px 9px;border-radius:999px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;border:1px solid currentColor;margin:12px 0 16px}
.p{color:var(--ink2);font-size:14px;margin:0 0 18px;max-width:30ch}
.kv{display:grid;gap:10px;margin:18px 0}
.kvRow{display:grid;grid-template-columns:86px 1fr;gap:10px;font-size:12px;padding:8px 0;border-top:1px solid var(--line)}
.kvRow:first-child{border-top:0}
.kvRow span:first-child{color:var(--ink3)}
.codeList{display:grid;gap:4px;font-size:12px;color:var(--ink2)}
#spec{display:none}.showSpec #spec{display:block}.showSpec #passport{display:none}
.sw{display:grid;grid-template-columns:88px 1fr;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}
.sw:first-child{border-top:0}.swatch{height:18px;border-radius:999px;border:1px solid rgba(255,255,255,.08)}
svg .bld{cursor:pointer;transition:opacity .18s var(--ease)}
svg .bld .pick{opacity:0;transition:opacity .16s var(--ease)}
svg .bld:hover .pick,svg .bld.sel .pick{opacity:1}
.dimmed .bld:not(.focus){opacity:.22}
.engineer .tech{opacity:1}.tech{opacity:0;transition:.18s opacity var(--ease)}
.lowerThird{position:absolute;left:28px;bottom:92px;display:none;gap:10px;align-items:flex-end}.broadcast .lowerThird{display:flex}
.lowerThird .bar{width:6px;height:64px;background:var(--live)}
.lowerThird .copy{padding:12px 16px;border:1px solid rgba(255,179,59,.4);background:rgba(16,19,26,.82)}
.lowerThird .copy b{display:block;font:700 24px/1 "Syne",system-ui;color:var(--ink);margin-bottom:6px}.lowerThird .copy span{color:var(--ink2);font-size:13px}
.select{background:transparent;color:var(--ink);border:1px solid var(--line2);border-radius:10px;padding:8px 10px;font:inherit}
.empty{display:grid;gap:12px;place-items:start;padding-top:18px}.empty b{font:700 22px/1.02 "Syne",system-ui}
.note{font-size:12px;color:var(--ink3)}
@media (max-width: 1200px){#app{grid-template-columns:250px 1fr 320px}.h1{font-size:28px}#featureBox{width:280px}}
@media (max-width: 980px){#app{grid-template-columns:1fr;grid-template-rows:auto 1fr auto}#left,#right{display:none}#transport{grid-template-columns:1fr;gap:10px}#featureBox{right:16px;left:16px;bottom:120px;width:auto}#cityHead h2{font-size:24px}}
@keyframes drift{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
#featureBox,.copy{animation:drift calc((60/84)*8s) ease-in-out infinite}
</style>
</head>
<body>
<div id="app">
  <aside id="left">
    <div id="topbar">
      <div>
        <div class="kicker">night stage</div>
        <div class="h1">beLiveBase</div>
      </div>
    </div>
    <div class="stack">
      <section>
        <div class="panelTitle">Суть</div>
        <div class="p">Город не про цветные кубы. Он про свет слова: что сейчас живёт, что строится, что держим под пломбой, и куда летит камера на стриме.</div>
      </section>
      <section>
        <div class="panelTitle">Сейчас в игре</div>
        <div class="goalList" id="goals"></div>
      </section>
      <section>
        <div class="panelTitle">Режим</div>
        <div class="modeRow">
          <button class="chipBtn on" data-mode="human">Житель</button>
          <button class="chipBtn" data-mode="engineer">Инженер</button>
          <button class="chipBtn" data-mode="broadcast">Эфир</button>
        </div>
      </section>
      <section>
        <div class="panelTitle">Почему это работает</div>
        <div class="metric"><span>Статус</span><b>силуэт + свет</b></div>
        <div class="metric"><span>Прогресс</span><b>свободная земля и стройка</b></div>
        <div class="metric"><span>beLive ДНК</span><b>светящееся слово → светящийся город</b></div>
      </section>
    </div>
  </aside>
  <main id="stageWrap">
    <div id="svgHold"><svg id="citySvg" viewBox="0 0 1320 700"></svg></div>
    <div id="canvasUI">
      <div id="cityHead"><div><h2>beLiveBase</h2><div class="sub" id="phaseLine"></div></div></div>
      <div id="featureBox">
        <div class="eyebrow">today's feature</div>
        <h3 id="featureTitle">Башня Билли</h3>
        <p id="featureText">Точка входа для YouTube: камера приходит сюда первой, потом уходит по подземке к активной фиче.</p>
      </div>
      <div class="lowerThird" id="lowerThird"><div class="bar"></div><div class="copy"><b id="ltTitle">Башня Билли</b><span id="ltText">Сегодня оживляем сердце города</span></div></div>
      <div id="transport">
        <div class="tabRow">
          <button class="tabBtn on" data-tab="city">Город</button>
          <button class="tabBtn" data-tab="spec">Концепт</button>
        </div>
        <select class="select" id="featureSelect"></select>
        <div id="legendMini">
          <span><i class="dot" style="background:#FFB33B"></i>живой</span>
          <span><i class="dot" style="background:#B2DFF4"></i>frozen</span>
          <span><i class="dot" style="background:#E85433"></i>снос</span>
          <span><i class="dot" style="background:#8D6CC2"></i>квартал Билли</span>
        </div>
        <div class="meta">84 BPM · HTML + SVG</div>
        <button class="smallBtn" id="focusBtn">Фокус на фиче</button>
      </div>
    </div>
  </main>
  <aside id="right">
    <section id="passport"></section>
    <section id="spec">
      <div class="kicker">арт-система</div>
      <h3 class="panelTitle">Night Stage</h3>
      <div class="p">Сцена ночью. Город сидит на тёмном планшете, а смысл рассказывает только свет: тёплый живой, ледяной frozen, рваный hazard, меловой planned.</div>
      <div class="panelTitle">Палитра</div>
      <div id="swatches"></div>
      <div class="panelTitle" style="margin-top:24px">Формы</div>
      <div class="codeList">
        <div>Башня: узкий силуэт, маяк на крыше, вертикальные окна.</div>
        <div>Завод: низкий широкий объём, ребристая крыша, трубы, внутренний жар.</div>
        <div>Площадь: провал в плите, кольца, осевой свет, навес как сцена.</div>
        <div>Арена: большой контур, пустой тёмный центр, луч вверх для эфира.</div>
        <div>Лабы: тёмное стекло, светится только конёк, без мультяшной крыши.</div>
      </div>
      <div class="panelTitle" style="margin-top:24px">Кодировка статусов</div>
      <div class="codeList">
        <div><b style="color:#FFB33B">живой</b>: тёплые окна, дыхание света.</div>
        <div><b style="color:#B2DFF4">frozen</b>: холодная пломба, без пульса.</div>
        <div><b style="color:#BECCDD">чертёж</b>: меловой контур и ghost-volume.</div>
        <div><b style="color:#66667D">консервация</b>: тент, standby LED.</div>
        <div><b style="color:#E85433">снос</b>: fence, искры, рваный свет.</div>
      </div>
      <div class="panelTitle" style="margin-top:24px">YouTube-режим</div>
      <div class="p">В эфире панель уходит, остаётся lower-third. Камера фокусит выбранную фичу, арена даёт луч, подземка пульсит до точки работы. Это уже почти готовый opening shot.</div>
    </section>
  </aside>
</div>
<script>
/* beLiveBase · генератор города из кадастра */
const PAL = {
  void:'#05070D', plate:'#10131A', plate2:'#151820', slab:'#030408',
  live:'#FFB33B', liveHot:'#FFE29A', liveDeep:'#B26417', ember:'#CC7D1E',
  frost:'#B2DFF4', frostDeep:'#4B6E81', chalk:'#BECCDD',
  hazard:'#E85433', standby:'#66667D', outer:'#484D59',
  ink:'#E9E4DC', ink2:'#A39E95', ink3:'#6D6860', ink4:'#46423A',
  hue:{verse:'#3B9696',gold:'#B59D51',chorus:'#C54C4F',bridge:'#8D6CC2',core:'#D7944C',waste:'#434853'},
  floor:{verse:'#08191B',gold:'#201A08',chorus:'#241212',bridge:'#191428',core:'#241706',waste:'#11141A'},
  mass:{
    alive:{top:'#30333A',l:'#1D1F26',r:'#111419'},
    demo:{top:'#292B30',l:'#191B1F',r:'#0E0F13'},
    frozen:{top:'#3C515A',l:'#263841',r:'#1A2930'},
    trash:{top:'#2A1B18',l:'#1A0E0C',r:'#100706'},
    conserved:{top:'#252530',l:'#171720',r:'#0F0E16'},
    external:{top:'#2A2E36',l:'#1C1F25',r:'#14161B'}
  }, tarp:'#34353B'
};
const BPM=84, BEAT=60/BPM;
const TW=64, TH=32, OX=616, OY=152;
const iso=(gx,gy)=>({x:OX+(gx-gy)*TW/2, y:OY+(gx+gy)*TH/2});

const CITY = {
  meta:{city:'beLiveBase',phase:'Phase 0 · чертежи',updated:'2026-08-28',cadastre:'houses.yaml v0.1',bpm:BPM},
  districts:[
    {id:'billy',lx:4.8,ly:-4.0,anch:"start",name:'КВАРТАЛ БИЛЛИ',code:'VMO-014',hue:'bridge',part:'BRIDGE',gx:3,gy:0,w:5,d:3,human:'Характер: голос, эмоции, реакция.'},
    {id:'stage',lx:11.0,ly:-2.2,anch:"start",name:'СЦЕНА',code:'VMO-009·023',hue:'chorus',part:'CHORUS',gx:8,gy:0,w:7,d:5,human:'Всё, что видит зал.'},
    {id:'core',lx:5.0,ly:9.8,anch:"middle",name:'ЯДРО',code:'VMO-003·013',hue:'core',part:'DRIVE',gx:4,gy:4,w:6,d:4,human:'Звук, синхрон, ноты. Тут греется.'},
    {id:'forum',lx:7.0,ly:15.8,anch:"middle",name:'ФОРУМ',code:'VMO-001·020',hue:'gold',part:'INTRO',gx:6,gy:9,w:6,d:4,human:'Вход, каталог, лента.'},
    {id:'atelier',lx:-1.6,ly:2.0,anch:"end",name:'АТЕЛЬЕ',code:'VMO-012·034',hue:'verse',part:'VERSE',gx:0,gy:4,w:4,d:5,human:'Как это выглядит и из чего собрано.'},
    {id:'campus',lx:2.4,ly:16.0,anch:"start",name:'КАМПУС',code:'VMO-006·029',hue:'verse',part:'VERSE',gx:1,gy:10,w:5,d:4,human:'Практика и дом жителя.'},
    {id:'waste',lx:16.6,ly:7.6,anch:"start",name:'ПУСТЫРЬ',code:'VMO-038',hue:'waste',part:'—',gx:12,gy:6,w:3,d:3,human:'Под снос. Скоро тут будет чисто.'}
  ],
  buildings:[
    {id:'billy',name:'Башня Билли',dist:'billy',arch:'tower',st:'alive',gx:4,gy:0,w:2,d:2,loc:4200,files:38,t30:34,human:'Мозг Билли: голос, эмоции, реакция на пение.',mods:['src/billy','src/character'],code:'014'},
    {id:'aiconfig',name:'AI Подстанция',dist:'billy',arch:'archive',st:'conserved',gx:7,gy:1,w:1,d:1,loc:700,files:9,t30:0,human:'Законсервирована. Свет выключен, вентиль закрыт.',mods:['src/js/ai','src/components/AiSettingsModal'],code:'031'},
    {id:'live',name:'Арена Live',dist:'stage',arch:'arena',st:'alive',gx:9,gy:0,w:3,d:3,loc:2600,files:21,t30:9,human:'Живой эфир: субтитры и контроль сцены.',mods:['src/components/LiveControls','src/components/LiveSubtitle'],code:'023'},
    {id:'arenas',name:'Арены Karaoke / Concert',dist:'stage',arch:'arena',st:'planned',gx:12,gy:1,w:3,d:3,loc:1400,files:11,t30:0,human:'Два зала в чертеже. Стройка сразу после пуска Репетиции.',mods:['src/Karaoke','src/Concert','src/transitions'],code:'021-022'},
    {id:'show',name:'Театр Show',dist:'stage',arch:'lab',st:'alive',gx:8,gy:3,w:2,d:2,loc:3000,files:26,t30:12,human:'Театр выступлений: сцены и сценарии.',mods:['src/components/Show','src/services/show.html.ts'],code:'009-010'},
    {id:'studio',name:'Завод Studio',dist:'core',arch:'factory',st:'alive',gx:5,gy:4,w:3,d:2,loc:9800,files:94,t30:61,human:'Здесь рождается звук. Движок v3 на сборке, ядро v2 под пломбой.',mods:['src/audio/core','src/audio/engine-v3','src/stem'],code:'003-005',frozen:'sealed',wave:'W4/W5'},
    {id:'split',name:'Башня Split',dist:'core',arch:'tower',st:'alive',gx:9,gy:5,w:1,d:2,loc:900,files:8,t30:4,human:'Мониторинг и микс. Смотрит на весь город.',mods:['src/components/monitor'],code:'011'},
    {id:'sync',name:'Мастерская Sync',dist:'core',arch:'lab',st:'alive',gx:4,gy:6,w:2,d:2,loc:2200,files:19,t30:22,human:'Светящееся слово собирают здесь: маркеры и word-sync.',mods:['src/sync'],code:'018-019',frozen:'read'},
    {id:'notes',name:'Лаб Notes',dist:'core',arch:'lab',st:'alive',gx:7,gy:6,w:2,d:2,loc:1800,files:16,t30:3,human:'Ноты и питч: слышит, какую ты взял.',mods:['src/audio/pitch','src/components/PianoKeyboard'],code:'013'},
    {id:'catalog',name:'Площадь Каталог',dist:'forum',arch:'plaza',st:'alive',gx:7,gy:9,w:3,d:3,loc:2000,files:17,t30:15,human:'Витрина треков и дропзона. Центр города.',mods:['src/catalog'],code:'002'},
    {id:'hub',name:'Площадь Hub',dist:'forum',arch:'plaza',st:'demo',gx:10,gy:9,w:2,d:2,loc:1100,files:12,t30:2,human:'Лента и профили. Пока витрина, половина света не включена.',mods:['src/feed'],code:'020'},
    {id:'gates',name:'Врата',dist:'forum',arch:'gate',st:'alive',gx:7,gy:12,w:3,d:1,loc:600,files:7,t30:5,human:'Вход без забора: гость сразу поёт.',mods:['src/components/welcome','src/components/onboarding'],code:'001'},
    {id:'styles',name:'Ателье Styles',dist:'atelier',arch:'lab',st:'alive',gx:1,gy:4,w:2,d:2,loc:1200,files:22,t30:8,human:'Темы, стили текста, пресеты.',mods:['src/theme','src/styles','src/data'],code:'012'},
    {id:'scenes',name:'Киностудия фонов',dist:'atelier',arch:'archive',st:'alive',gx:1,gy:6,w:2,d:2,loc:1500,files:14,t30:2,human:'Фоны режимов и блочные сцены.',mods:['src/backgrounds','src/services/block-scene.service.ts'],code:'032'},
    {id:'dna',name:'Архив ДНК',dist:'atelier',arch:'archive',st:'alive',gx:3,gy:6,w:1,d:2,loc:800,files:9,t30:0,human:'ДНК трека: структура и метаданные. Свет тут не горел месяц.',mods:['src/components/TrackInfoBoard','src/structure'],code:'034'},
    {id:'academy',name:'Академия Quest',dist:'campus',arch:'campus',st:'alive',gx:2,gy:10,w:3,d:2,loc:3400,files:31,t30:5,human:'Тейки, упражнения, сценарии практики.',mods:['src/exercises','src/practice','src/takes'],code:'006-008'},
    {id:'profile',name:'Дом профиля',dist:'campus',arch:'house',st:'alive',gx:2,gy:12,w:2,d:1,loc:500,files:6,t30:1,human:'Дом жителя: профиль и аватар.',mods:['src/components/profile','src/avatar'],code:'029-030'},
    {id:'blocks-old',name:'Старая мастерская',dist:'waste',arch:'lab',st:'trash',gx:12,gy:6,w:2,d:2,loc:1900,files:23,t30:0,human:'Огорожена. Под снос по BAC-107.',mods:['src/blocks'],code:'038',wave:'W5'}
  ],
  metro:[
    {id:'m1',from:'studio',to:'sync',ev:'audio:frame',pulse:1},
    {id:'m2',from:'studio',to:'notes',ev:'audio:pitch',pulse:1},
    {id:'m3',from:'studio',to:'live',ev:'transport:beat',pulse:1,via:[[8.6,3.4]]},
    {id:'m4',from:'sync',to:'show',ev:'word:active',pulse:1,via:[[6.6,3.6]]},
    {id:'m5',from:'billy',to:'catalog',ev:'billy:say',pulse:1,via:[[6.2,3.2],[6.6,8.6]]},
    {id:'m6',from:'catalog',to:'gates',ev:'track:load',pulse:1},
    {id:'m7',from:'catalog',to:'hub',ev:'feed:post',pulse:0},
    {id:'m8',from:'catalog',to:'academy',ev:'take:saved',pulse:0,via:[[5.6,10.2]]},
    {id:'m9',from:'styles',to:'catalog',ev:'theme:apply',pulse:0,via:[[3.2,8.6]]},
    {id:'m10',from:'dna',to:'catalog',ev:'track:meta',pulse:0},
    {id:'cut',from:'blocks-old',to:null,ev:'severed',pulse:0,via:[[11.4,8.2]]}
  ]
};
const ARCH={
  tower:{base:20,k:1.50,inset:0.16}, factory:{base:14,k:0.35,inset:0.10},
  arena:{base:12,k:0.30,inset:0.08}, lab:{base:12,k:0.60,inset:0.14},
  archive:{base:10,k:0.40,inset:0.16}, campus:{base:8,k:0.35,inset:0.10},
  house:{base:10,k:0.45,inset:0.20}, plaza:{base:4,k:0.05,inset:0.06}, gate:{base:22,k:0,inset:0.18}
};
const heightOf=b=>Math.round(ARCH[b.arch].base+ARCH[b.arch].k*Math.sqrt(b.loc));
const freshOf=b=>Math.max(0,Math.min(1,b.t30/30));
function seed(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const r2=n=>Math.round(n*10)/10;
const pts=a=>a.map(p=>r2(p.x)+','+r2(p.y)).join(' ');
const up=(p,h)=>({x:p.x,y:p.y-h});
const cen=(gx,gy,w,d)=>iso(gx+w/2,gy+d/2);
function corners(gx,gy,w,d,i){return{T:iso(gx+i,gy+i),R:iso(gx+w-i,gy+i),B:iso(gx+w-i,gy+d-i),L:iso(gx+i,gy+d-i)};}
function faces(gx,gy,w,d,h,i,skew,z){
  const c0=corners(gx,gy,w,d,i), sh=skew||0, zo=z||0;
  const c={T:up(c0.T,zo),R:up(c0.R,zo),B:up(c0.B,zo),L:up(c0.L,zo)};
  const T=up(c0.T,h),R=up(c0.R,h),B=up(c0.B,h),L=up(c0.L,h);
  if(sh){[T,R,B,L].forEach(p=>{p.x+=sh;});}
  return {c,top:[T,R,B,L],lw:[L,B,c.B,c.L],rw:[B,R,c.R,c.B]};
}
function windows(A,B0,h,cols,rows,rand,litFrac,warm,cold){
  const U={x:B0.x-A.x,y:B0.y-A.y}, out=[];
  const P=(u,v)=>({x:A.x+U.x*u,y:A.y+U.y*u+h*v});
  for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
    const u0=(c+0.30)/cols,u1=(c+0.70)/cols,v0=(r+0.28)/rows,v1=(r+0.66)/rows;
    const lit=rand()<litFrac, col=lit?warm:cold;
    out.push('<polygon points="'+pts([P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)])+'" fill="'+col+'"'+(lit?' class="win" style="--d:'+r2(rand()*8)+'s"':'')+'/>');
  }
  return out.join('');
}
function seal(x,y,s){
  const k=(s||1)*6,p=[];
  for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;p.push({x:x+Math.cos(a)*k,y:y+Math.sin(a)*k*0.62});}
  return '<polygon points="'+pts(p)+'" fill="#0C1A22" stroke="'+PAL.frost+'" stroke-width="1.3"/><line x1="'+r2(x-k*0.5)+'" y1="'+r2(y)+'" x2="'+r2(x+k*0.5)+'" y2="'+r2(y)+'" stroke="'+PAL.frost+'" stroke-width="1.3"/>';
}
function scaffold(b,h){
  const c=corners(b.gx,b.gy,b.w,b.d,ARCH[b.arch].inset-0.02), H=Math.max(h,14)+6, o=[], a=c.L, z=c.B;
  for(let k=0;k<=3;k++){const t=k/3,p={x:a.x+(z.x-a.x)*t,y:a.y+(z.y-a.y)*t};
    o.push('<line x1="'+r2(p.x)+'" y1="'+r2(p.y)+'" x2="'+r2(p.x)+'" y2="'+r2(p.y-H)+'" stroke="'+PAL.ink4+'" stroke-width="1"/>');}
  for(let k=1;k<=2;k++){const yy=H*k/3;
    o.push('<line x1="'+r2(a.x)+'" y1="'+r2(a.y-yy)+'" x2="'+r2(z.x)+'" y2="'+r2(z.y-yy)+'" stroke="'+PAL.ink4+'" stroke-width="1"/>');}
  return o.join('');
}
function fence(b){
  const c=corners(b.gx,b.gy,b.w,b.d,-0.06), o=[], ring=[c.T,c.R,c.B,c.L];
  o.push('<polygon points="'+pts(ring)+'" fill="none" stroke="'+PAL.hazard+'" stroke-width="1.6" stroke-dasharray="9 6" opacity="0.8" class="tape"/>');
  ring.forEach(p=>o.push('<line x1="'+r2(p.x)+'" y1="'+r2(p.y)+'" x2="'+r2(p.x)+'" y2="'+r2(p.y-9)+'" stroke="'+PAL.hazard+'" stroke-width="1.4" opacity="0.7"/>'));
  return o.join('');
}
function build(b){
  const A=ARCH[b.arch], h=heightOf(b), fresh=freshOf(b), rand=rng(seed(b.id));
  const st=b.st, m=PAL.mass[st==='alive'?'alive':st]||PAL.mass.alive, C=cen(b.gx,b.gy,b.w,b.d), g=[];
  const bloom=Math.max(b.w,b.d)*44;
  if(st==='alive'||st==='demo') g.push('<ellipse cx="'+r2(C.x)+'" cy="'+r2(C.y)+'" rx="'+r2(bloom)+'" ry="'+r2(bloom*0.5)+'" fill="url(#bloomWarm)" opacity="'+r2(0.10+fresh*0.34)+'"/>');
  else if(st==='trash') g.push('<ellipse cx="'+r2(C.x)+'" cy="'+r2(C.y)+'" rx="'+r2(bloom*0.8)+'" ry="'+r2(bloom*0.4)+'" fill="url(#bloomHazard)" opacity="0.35"/>');

  if(st==='planned'){
    const c=corners(b.gx,b.gy,b.w,b.d,0.06), cH=h;
    const T=up(c.T,cH),R=up(c.R,cH),B=up(c.B,cH),L=up(c.L,cH);
    g.push('<polygon points="'+pts([c.T,c.R,c.B,c.L])+'" fill="#0E1520" stroke="'+PAL.chalk+'" stroke-width="1" stroke-dasharray="7 5" opacity="0.5"/>');
    g.push('<polygon points="'+pts([T,R,B,L])+'" fill="none" stroke="'+PAL.chalk+'" stroke-width="1" stroke-dasharray="4 6" opacity="0.62"/>');
    [[c.L,L],[c.B,B],[c.R,R]].forEach(function(e){g.push('<line x1="'+r2(e[0].x)+'" y1="'+r2(e[0].y)+'" x2="'+r2(e[1].x)+'" y2="'+r2(e[1].y)+'" stroke="'+PAL.chalk+'" stroke-width="1" stroke-dasharray="3 5" opacity="0.4"/>');});
    const mid=iso(b.gx+b.w/2,b.gy+0.06), mid2=iso(b.gx+b.w/2,b.gy+b.d-0.06);
    g.push('<line x1="'+r2(mid.x)+'" y1="'+r2(mid.y)+'" x2="'+r2(mid2.x)+'" y2="'+r2(mid2.y)+'" stroke="'+PAL.chalk+'" stroke-width="1" stroke-dasharray="2 6" opacity="0.3"/>');
    const base=iso(b.gx+0.3,b.gy+0.3), mh=h+52;
    g.push('<line x1="'+r2(base.x)+'" y1="'+r2(base.y)+'" x2="'+r2(base.x)+'" y2="'+r2(base.y-mh)+'" stroke="'+PAL.ink4+'" stroke-width="2"/>');
    g.push('<g class="crane" style="transform-origin:'+r2(base.x)+'px '+r2(base.y-mh)+'px">'+
      '<line x1="'+r2(base.x-26)+'" y1="'+r2(base.y-mh)+'" x2="'+r2(base.x+40)+'" y2="'+r2(base.y-mh)+'" stroke="'+PAL.ink4+'" stroke-width="2"/>'+
      '<line x1="'+r2(base.x+28)+'" y1="'+r2(base.y-mh)+'" x2="'+r2(base.x+28)+'" y2="'+r2(base.y-mh+16)+'" stroke="'+PAL.ink4+'" stroke-width="1"/>'+
      '<rect x="'+r2(base.x+24)+'" y="'+r2(base.y-mh+16)+'" width="8" height="6" fill="'+PAL.ink4+'"/>'+
      '<circle cx="'+r2(base.x-26)+'" cy="'+r2(base.y-mh)+'" r="2.5" fill="'+PAL.live+'" class="beacon"/></g>');
    return g.join('');
  }
  if(b.arch==='plaza'){
    const c=corners(b.gx,b.gy,b.w,b.d,0.05), sunk=corners(b.gx,b.gy,b.w,b.d,0.20), on=st==='alive';
    g.push('<polygon points="'+pts([c.T,c.R,c.B,c.L])+'" fill="'+PAL.plate2+'"/>');
    g.push('<polygon points="'+pts([sunk.T,sunk.R,sunk.B,sunk.L])+'" fill="#0C1018" stroke="'+(on?PAL.live:PAL.standby)+'" stroke-width="'+(on?1.6:1)+'" '+(on?'':'stroke-dasharray="6 5"')+' opacity="'+(on?0.95:0.6)+'"/>');
    const cc=cen(b.gx,b.gy,b.w,b.d);
    if(on) g.push('<ellipse cx="'+r2(cc.x)+'" cy="'+r2(cc.y)+'" rx="'+r2(b.w*26)+'" ry="'+r2(b.w*13)+'" fill="url(#bloomWarm)" opacity="0.5" class="breath"/>');
    [c.T,c.R,c.B,c.L].forEach(function(p){
      g.push('<line x1="'+r2(p.x)+'" y1="'+r2(p.y)+'" x2="'+r2(p.x)+'" y2="'+r2(p.y-18)+'" stroke="'+PAL.ink4+'" stroke-width="1.2"/>');
      g.push('<circle cx="'+r2(p.x)+'" cy="'+r2(p.y-19)+'" r="2" fill="'+(on?PAL.liveHot:PAL.standby)+'"/>');});
    for(let k=1;k<=2;k++){
      const rc=corners(b.gx,b.gy,b.w,b.d,0.20+k*0.10);
      g.push('<polygon points="'+pts([rc.T,rc.R,rc.B,rc.L])+'" fill="none" stroke="'+(on?PAL.live:PAL.standby)+'" stroke-width="0.8" stroke-opacity="'+(on?r2(0.34-k*0.1):0.14)+'"/>');
    }
    if(on){
      const e1=iso(b.gx+0.2,b.gy+b.d/2), e2=iso(b.gx+b.w-0.2,b.gy+b.d/2);
      const e3=iso(b.gx+b.w/2,b.gy+0.2), e4=iso(b.gx+b.w/2,b.gy+b.d-0.2);
      g.push('<line x1="'+r2(e1.x)+'" y1="'+r2(e1.y)+'" x2="'+r2(e2.x)+'" y2="'+r2(e2.y)+'" stroke="'+PAL.live+'" stroke-width="1.2" stroke-opacity="0.28"/>');
      g.push('<line x1="'+r2(e3.x)+'" y1="'+r2(e3.y)+'" x2="'+r2(e4.x)+'" y2="'+r2(e4.y)+'" stroke="'+PAL.live+'" stroke-width="1.2" stroke-opacity="0.28"/>');
      const mc=corners(b.gx+b.w/2-0.3,b.gy+b.d/2-0.3,0.6,0.6,0);
      g.push('<polygon points="'+pts([mc.T,mc.R,mc.B,mc.L])+'" fill="'+PAL.liveHot+'" opacity="0.85" class="breath"/>');
    }
    if(b.id==='catalog'){
      const cp=corners(b.gx,b.gy,b.w,b.d,0.30), H=27;
      g.push('<polygon points="'+pts([up(cp.T,H),up(cp.R,H),up(cp.B,H),up(cp.L,H)])+'" fill="#181C24" stroke="'+PAL.live+'" stroke-width="0.8" opacity="0.92"/>');
      g.push('<polygon points="'+pts([up(cp.L,H),up(cp.B,H),up(cp.B,H-3),up(cp.L,H-3)])+'" fill="#3A2A16"/>');
      g.push('<polygon points="'+pts([up(cp.B,H),up(cp.R,H),up(cp.R,H-3),up(cp.B,H-3)])+'" fill="#241A0E"/>');
      [cp.T,cp.R,cp.B,cp.L].forEach(p=>g.push('<line x1="'+r2(p.x)+'" y1="'+r2(p.y)+'" x2="'+r2(p.x)+'" y2="'+r2(p.y-H)+'" stroke="'+PAL.ink4+'" stroke-width="1.4"/>'));
    }
    if(st==='demo'){
      g.push('<g class="scaff">'+scaffold(b,10)+'</g>');
      g.push('<text x="'+r2(cc.x)+'" y="'+r2(cc.y-26)+'" class="pennant">ДЕМО</text>');
    }
    return g.join('');
  }
  if(b.arch==='gate'){
    const c=corners(b.gx,b.gy,b.w,b.d,0.14), H=h+4, pw=0.34;
    [[b.gx+0.14,b.gy+0.14],[b.gx+b.w-0.14-pw,b.gy+0.14]].forEach(function(e){
      const ff=faces(e[0],e[1],pw,b.d-0.28,H,0,0);
      g.push('<polygon points="'+pts(ff.lw)+'" fill="'+m.l+'"/><polygon points="'+pts(ff.rw)+'" fill="'+m.r+'"/><polygon points="'+pts(ff.top)+'" fill="'+m.top+'"/>');});
    const lin=faces(b.gx+0.14,b.gy+0.2,b.w-0.28,b.d-0.4,H+10,0,0);
    g.push('<polygon points="'+pts(lin.lw)+'" fill="'+m.l+'"/><polygon points="'+pts(lin.rw)+'" fill="'+m.r+'"/><polygon points="'+pts(lin.top)+'" fill="'+m.top+'"/>');
    g.push('<polygon points="'+pts([c.T,c.R,c.B,c.L])+'" fill="url(#thresh)" opacity="0.55" class="breath"/>');
    const cc=cen(b.gx,b.gy,b.w,b.d);
    g.push('<polygon points="'+pts([{x:cc.x-34,y:cc.y-2},{x:cc.x+34,y:cc.y-2},{x:cc.x+74,y:cc.y-56},{x:cc.x-74,y:cc.y-56}])+'" fill="url(#gateBeam)" opacity="0.32"/>');
    return g.join('');
  }
  const skew=st==='trash'?3:0, f=faces(b.gx,b.gy,b.w,b.d,h,A.inset,skew);
  g.push('<polygon points="'+pts(f.lw)+'" fill="'+m.l+'"/>');
  g.push('<polygon points="'+pts(f.rw)+'" fill="'+m.r+'"/>');
  g.push('<polygon points="'+pts(f.top)+'" fill="'+m.top+'"/>');
  if(st!=='conserved'){
    const lw=f.lw, rw=f.rw;
    const wl=Math.hypot(lw[1].x-lw[0].x,lw[1].y-lw[0].y), wr=Math.hypot(rw[1].x-rw[0].x,rw[1].y-rw[0].y);
    const rows=Math.max(1,Math.floor(h/16));
    const litFrac=st==='trash'?0.04:st==='demo'?Math.max(0.12,fresh*0.4):Math.max(0.10,fresh);
    const warm=st==='trash'?PAL.hazard:PAL.liveHot, cold=st==='trash'?'#0E0705':'#131318';
    if(b.arch!=='archive'){
      g.push(windows(lw[0],lw[1],h,Math.max(1,Math.round(wl/14)),rows,rand,litFrac,warm,cold));
      g.push(windows(rw[0],rw[1],h,Math.max(1,Math.round(wr/14)),rows,rand,litFrac,warm,cold));
    } else {
      const slit=function(A0,B0){const U={x:B0.x-A0.x,y:B0.y-A0.y},o=[];
        for(let k=0;k<2;k++){const v=0.22+k*0.30;
          o.push('<polygon points="'+pts([{x:A0.x+U.x*0.2,y:A0.y+U.y*0.2+h*v},{x:A0.x+U.x*0.8,y:A0.y+U.y*0.8+h*v},{x:A0.x+U.x*0.8,y:A0.y+U.y*0.8+h*(v+0.05)},{x:A0.x+U.x*0.2,y:A0.y+U.y*0.2+h*(v+0.05)}])+'" fill="'+(fresh>0.05?PAL.liveDeep:'#101014')+'"/>');}
        return o.join('');};
      g.push(slit(lw[0],lw[1])+slit(rw[0],rw[1]));
    }
  }
  const top=f.top, T=top[0],R=top[1],B=top[2],L=top[3];
  if(b.arch==='tower'){
    const f2=faces(b.gx,b.gy,b.w,b.d,h+14,A.inset+0.14,0,h);
    g.push('<polygon points="'+pts(f2.lw)+'" fill="'+m.l+'"/><polygon points="'+pts(f2.rw)+'" fill="'+m.r+'"/><polygon points="'+pts(f2.top)+'" fill="'+m.top+'"/>');
    const ap=cen(b.gx,b.gy,b.w,b.d), ty=ap.y-h-14;
    g.push('<line x1="'+r2(ap.x)+'" y1="'+r2(ty)+'" x2="'+r2(ap.x)+'" y2="'+r2(ty-22)+'" stroke="'+PAL.ink4+'" stroke-width="1.5"/>');
    g.push('<circle cx="'+r2(ap.x)+'" cy="'+r2(ty-24)+'" r="13" fill="url(#bloomWarm)" class="beaconGlow"/>');
    g.push('<circle cx="'+r2(ap.x)+'" cy="'+r2(ty-24)+'" r="3.2" fill="'+PAL.live+'" class="beacon"/>');
  }
  if(b.arch==='factory'){
    const n=3, W=b.w-2*A.inset, rH=11, ridge=fresh>0.3?PAL.live:PAL.ink4;
    for(let k=0;k<n;k++){
      const u0=A.inset+W*(k+0.06)/n, u1=A.inset+W*(k+0.94)/n, um=(u0+u1)/2;
      const a1=iso(b.gx+u0,b.gy+A.inset), a2=iso(b.gx+u1,b.gy+A.inset);
      const b1=iso(b.gx+u0,b.gy+b.d-A.inset), b2=iso(b.gx+u1,b.gy+b.d-A.inset);
      const r1=iso(b.gx+um,b.gy+A.inset), r2p=iso(b.gx+um,b.gy+b.d-A.inset);
      g.push('<polygon points="'+pts([up(a1,h),up(r1,h+rH),up(r2p,h+rH),up(b1,h)])+'" fill="#0E1219"/>');
      g.push('<polygon points="'+pts([up(a2,h),up(r1,h+rH),up(r2p,h+rH),up(b2,h)])+'" fill="#1B222E"/>');
      if(fresh>0.25){
        const lp=(p,q,t)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
        const R1=up(r1,h+rH), R2=up(r2p,h+rH);
        g.push('<polygon points="'+pts([R1,R2,lp(R2,up(b2,h),0.46),lp(R1,up(a2,h),0.46)])+'" fill="'+PAL.liveDeep+'" opacity="'+r2(0.42+fresh*0.35)+'"/>');
      }
      g.push('<line x1="'+r2(r1.x)+'" y1="'+r2(r1.y-h-rH)+'" x2="'+r2(r2p.x)+'" y2="'+r2(r2p.y-h-rH)+'" stroke="'+ridge+'" stroke-width="1.4" stroke-opacity="0.85"/>');
    }
    if(fresh>0.3){
      const fl=iso(b.gx+b.w*0.5,b.gy+b.d*0.5);
      g.push('<ellipse cx="'+r2(fl.x)+'" cy="'+r2(fl.y-h-rH-6)+'" rx="'+r2(b.w*22)+'" ry="'+r2(b.w*9)+'" fill="url(#bloomWarm)" opacity="0.4" class="breath"/>');
    }
    [[0.16,0.86],[0.9,0.2]].forEach(function(e,k){
      const p=iso(b.gx+b.w*e[0],b.gy+b.d*e[1]), ch=30+k*10;
      g.push('<rect x="'+r2(p.x-2.5)+'" y="'+r2(p.y-h-ch)+'" width="5" height="'+ch+'" fill="'+m.r+'"/>');
      g.push('<rect x="'+r2(p.x-2.5)+'" y="'+r2(p.y-h-ch)+'" width="5" height="2" fill="'+PAL.ember+'"/>');
      if(fresh>0.3) for(let q=0;q<3;q++) g.push('<circle cx="'+r2(p.x)+'" cy="'+r2(p.y-h-ch-4)+'" r="'+(2.5+q)+'" fill="'+PAL.outer+'" class="smoke" style="--d:'+(q*2.4)+'s" opacity="0.4"/>');
    });
  }
  if(b.arch==='arena'){
    const f2=faces(b.gx,b.gy,b.w,b.d,h+13,A.inset+0.13,0), H=h+13;
    g.push('<polygon points="'+pts(f2.lw)+'" fill="'+m.l+'"/><polygon points="'+pts(f2.rw)+'" fill="'+m.r+'"/><polygon points="'+pts(f2.top)+'" fill="'+m.top+'"/>');
    const o=corners(b.gx,b.gy,b.w,b.d,A.inset+0.30);
    g.push('<polygon points="'+pts([up(o.T,H),up(o.R,H),up(o.B,H),up(o.L,H)])+'" fill="#0B0D12" stroke="'+PAL.live+'" stroke-width="1.5"/>');
    const cc=cen(b.gx,b.gy,b.w,b.d);
    g.push('<polygon points="'+pts([{x:cc.x-11,y:cc.y-H},{x:cc.x+11,y:cc.y-H},{x:cc.x+22,y:cc.y-H-118},{x:cc.x-22,y:cc.y-H-118}])+'" fill="url(#column)" class="column"/>');
  }
  if(b.arch==='lab'){
    const rH=11, rid1=iso(b.gx+b.w/2,b.gy+A.inset), rid2=iso(b.gx+b.w/2,b.gy+b.d-A.inset);
    g.push('<polygon points="'+pts([L,up(rid2,h+rH),up(rid1,h+rH),T])+'" fill="#141922"/>');
    g.push('<polygon points="'+pts([up(rid1,h+rH),up(rid2,h+rH),B,R])+'" fill="#0F131A"/>');
    if(fresh>0.15){
      const gl=[up(rid1,h+rH),up(rid2,h+rH),{x:rid2.x-9,y:rid2.y-h-rH+5},{x:rid1.x-9,y:rid1.y-h-rH+5}];
      g.push('<polygon points="'+pts(gl)+'" fill="'+PAL.liveDeep+'" opacity="'+r2(0.35+fresh*0.5)+'"/>');
    }
    g.push('<line x1="'+r2(rid1.x)+'" y1="'+r2(rid1.y-h-rH)+'" x2="'+r2(rid2.x)+'" y2="'+r2(rid2.y-h-rH)+'" stroke="'+(fresh>0.15?PAL.live:PAL.ink4)+'" stroke-width="'+(fresh>0.15?1.6:1)+'"/>');
  }
  if(b.arch==='archive') g.push('<polygon points="'+pts(top)+'" fill="none" stroke="'+PAL.frostDeep+'" stroke-width="1" opacity="0.5"/>');
  if(b.arch==='campus'){
    [[0.08,0.12,0.34,0.76,26],[0.44,0.10,0.24,0.44,34],[0.44,0.58,0.48,0.30,18]].forEach(function(s){
      const gx=b.gx+b.w*s[0], gy=b.gy+b.d*s[1], w=b.w*s[2], d=b.d*s[3];
      const ff=faces(gx,gy,w,d,h+s[4],0.04,0,h);
      g.push('<polygon points="'+pts(ff.lw)+'" fill="'+m.l+'"/><polygon points="'+pts(ff.rw)+'" fill="'+m.r+'"/><polygon points="'+pts(ff.top)+'" fill="'+m.top+'"/>');
      const lw=ff.lw;
      g.push(windows(lw[0],lw[1],s[4],Math.max(1,Math.round(Math.hypot(lw[1].x-lw[0].x,lw[1].y-lw[0].y)/14)),Math.max(1,Math.floor(s[4]/15)),rand,Math.max(0.12,fresh),PAL.liveHot,'#131318'));
    });
  }
  if(b.arch==='house'){
    const rH=12, rid1=iso(b.gx+b.w/2,b.gy+A.inset), rid2=iso(b.gx+b.w/2,b.gy+b.d-A.inset);
    g.push('<polygon points="'+pts([L,up(rid2,h+rH),up(rid1,h+rH),T])+'" fill="'+m.top+'"/>');
    g.push('<polygon points="'+pts([up(rid1,h+rH),up(rid2,h+rH),B,R])+'" fill="'+m.l+'"/>');
  }
  if(b.frozen==='sealed'){
    const vx=b.gx+b.w*0.58, vy=b.gy+b.d*0.16, vh=h+17;
    const ff=faces(vx,vy,b.w*0.34,b.d*0.5,vh,0.02,0,h), fm=PAL.mass.frozen;
    g.push('<polygon points="'+pts(ff.lw)+'" fill="'+fm.l+'"/><polygon points="'+pts(ff.rw)+'" fill="'+fm.r+'"/><polygon points="'+pts(ff.top)+'" fill="'+fm.top+'"/>');
    g.push('<polygon points="'+pts(ff.top)+'" fill="none" stroke="'+PAL.frost+'" stroke-width="1.2" opacity="0.9"/>');
    const cv=cen(vx,vy,b.w*0.34,b.d*0.5);
    g.push('<circle cx="'+r2(cv.x)+'" cy="'+r2(cv.y-vh-5)+'" r="20" fill="url(#bloomCold)" opacity="0.5"/>');
    g.push(seal(cv.x,cv.y-vh-5));
  }
  if(b.frozen==='read'){
    g.push('<polyline points="'+pts([f.lw[3],f.lw[2]])+'" fill="none" stroke="'+PAL.frost+'" stroke-width="2" opacity="0.5"/>');
    g.push('<polyline points="'+pts([f.rw[3],f.rw[2]])+'" fill="none" stroke="'+PAL.frost+'" stroke-width="2" opacity="0.3"/>');
    const cc=cen(b.gx,b.gy,b.w,b.d);
    g.push(seal(cc.x,cc.y-h-24,0.75));
  }
  if(st==='conserved'){
    const c=corners(b.gx,b.gy,b.w,b.d,A.inset-0.04), H=h+6;
    g.push('<polygon points="'+pts([up(c.T,H),up(c.R,H),up(c.B,H),up(c.L,H)])+'" fill="'+PAL.tarp+'"/>');
    g.push('<polygon points="'+pts([up(c.L,H),up(c.B,H),{x:c.B.x,y:c.B.y-4},{x:c.L.x,y:c.L.y-4}])+'" fill="'+PAL.tarp+'" opacity="0.75"/>');
    g.push('<line x1="'+r2(up(c.T,H).x)+'" y1="'+r2(up(c.T,H).y)+'" x2="'+r2(up(c.B,H).x)+'" y2="'+r2(up(c.B,H).y)+'" stroke="'+PAL.void+'" stroke-width="1" stroke-dasharray="4 4" opacity="0.8"/>');
    const cc=cen(b.gx,b.gy,b.w,b.d);
    g.push('<circle cx="'+r2(cc.x)+'" cy="'+r2(cc.y-H-3)+'" r="2.4" fill="'+PAL.standby+'" class="standby"/>');
  }
  if(st==='trash'){
    g.push(fence(b));
    const cc=cen(b.gx,b.gy,b.w,b.d);
    for(let k=0;k<5;k++){const rr=rng(seed(b.id+k))();
      g.push('<polygon points="'+pts([{x:cc.x-30+rr*60,y:cc.y+6+rr*8},{x:cc.x-24+rr*60,y:cc.y+2+rr*8},{x:cc.x-18+rr*60,y:cc.y+8+rr*8}])+'" fill="'+PAL.mass.trash.top+'"/>');}
    g.push('<circle cx="'+r2(cc.x)+'" cy="'+r2(cc.y-h-10)+'" r="2" fill="'+PAL.hazard+'" class="spark"/>');
  }
  if(st==='demo') g.push('<g class="scaff">'+scaffold(b,h)+'</g>');
  return g.join('');
}
function metroPath(m){
  const B=id=>CITY.buildings.find(x=>x.id===id);
  const a=B(m.from), pA=cen(a.gx,a.gy,a.w,a.d);
  let p='M '+r2(pA.x)+' '+r2(pA.y);
  (m.via||[]).forEach(function(v){const q=iso(v[0],v[1]);p+=' L '+r2(q.x)+' '+r2(q.y);});
  if(m.to){const z=B(m.to),pZ=cen(z.gx,z.gy,z.w,z.d);p+=' L '+r2(pZ.x)+' '+r2(pZ.y);}
  else{const l=(m.via||[]).slice(-1)[0],q=iso(l[0]+0.9,l[1]+0.6);p+=' L '+r2(q.x)+' '+r2(q.y);}
  return p;
}
const LANDMARKS=['billy','studio','catalog','live','gates'];
function buildSVG(){
  const s=[];
  s.push('<defs>'+
  '<radialGradient id="bloomWarm"><stop offset="0" stop-color="'+PAL.live+'" stop-opacity="0.55"/><stop offset="0.45" stop-color="'+PAL.liveDeep+'" stop-opacity="0.22"/><stop offset="1" stop-color="'+PAL.liveDeep+'" stop-opacity="0"/></radialGradient>'+
  '<radialGradient id="bloomCold"><stop offset="0" stop-color="'+PAL.frost+'" stop-opacity="0.6"/><stop offset="1" stop-color="'+PAL.frost+'" stop-opacity="0"/></radialGradient>'+
  '<radialGradient id="bloomHazard"><stop offset="0" stop-color="'+PAL.hazard+'" stop-opacity="0.45"/><stop offset="1" stop-color="'+PAL.hazard+'" stop-opacity="0"/></radialGradient>'+
  '<radialGradient id="cityGlow"><stop offset="0" stop-color="'+PAL.ember+'" stop-opacity="0.20"/><stop offset="1" stop-color="'+PAL.ember+'" stop-opacity="0"/></radialGradient>'+
  '<linearGradient id="column" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="'+PAL.live+'" stop-opacity="0.20"/><stop offset="1" stop-color="'+PAL.live+'" stop-opacity="0"/></linearGradient>'+
  '<linearGradient id="gateBeam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="'+PAL.live+'" stop-opacity="0.18"/><stop offset="1" stop-color="'+PAL.live+'" stop-opacity="0"/></linearGradient>'+
  '<radialGradient id="thresh"><stop offset="0" stop-color="'+PAL.liveHot+'" stop-opacity="0.42"/><stop offset="1" stop-color="'+PAL.live+'" stop-opacity="0.15"/></radialGradient>'+
  '<linearGradient id="roadOut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="'+PAL.outer+'" stop-opacity="0.9"/><stop offset="1" stop-color="'+PAL.outer+'" stop-opacity="0.05"/></linearGradient>'+
  '</defs>');
  const GX=15,GY=14,e=28;
  const P0=iso(0,0),P1=iso(GX,0),P2=iso(GX,GY),P3=iso(0,GY);
  s.push('<g id="ground">');
  s.push('<ellipse cx="'+r2(iso(7,7).x)+'" cy="'+r2(iso(7,7).y)+'" rx="560" ry="300" fill="url(#cityGlow)"/>');
  s.push('<polygon points="'+pts([{x:P3.x,y:P3.y+e},{x:P2.x,y:P2.y+e},P2,P3])+'" fill="'+PAL.slab+'"/>');
  s.push('<polygon points="'+pts([{x:P2.x,y:P2.y+e},{x:P1.x,y:P1.y+e},P1,P2])+'" fill="#06080C"/>');
  s.push('<polygon points="'+pts([P0,P1,P2,P3])+'" fill="'+PAL.plate+'"/>');
  s.push('<g id="grid">');
  for(let i=0;i<=GX;i++){const a=iso(i,0),b=iso(i,GY);s.push('<line x1="'+r2(a.x)+'" y1="'+r2(a.y)+'" x2="'+r2(b.x)+'" y2="'+r2(b.y)+'" stroke="#151A25" stroke-width="0.6"/>');}
  for(let i=0;i<=GY;i++){const a=iso(0,i),b=iso(GX,i);s.push('<line x1="'+r2(a.x)+'" y1="'+r2(a.y)+'" x2="'+r2(b.x)+'" y2="'+r2(b.y)+'" stroke="#151A25" stroke-width="0.6"/>');}
  s.push('</g>');
  CITY.districts.forEach(function(d){
    const c=corners(d.gx,d.gy,d.w,d.d,0.10);
    s.push('<polygon class="dfloor" data-d="'+d.id+'" points="'+pts([c.T,c.R,c.B,c.L])+'" fill="'+PAL.floor[d.hue]+'" stroke="'+PAL.hue[d.hue]+'" stroke-width="0.8" stroke-opacity="0.35"/>');
  });
  s.push('<g id="lots">');
  [[12,10,2,2],[12,12.3,2,1.7],[14.1,10,1,2],[0.6,0.8,2.2,2.2]].forEach(function(L){
    const c=corners(L[0],L[1],L[2],L[3],0.12);
    s.push('<polygon points="'+pts([c.T,c.R,c.B,c.L])+'" fill="#0D1118" stroke="'+PAL.chalk+'" stroke-width="0.8" stroke-dasharray="4 7" opacity="0.28"/>');
  });
  const lp=iso(13,14.1);
  s.push('<text x="'+r2(lp.x)+'" y="'+r2(lp.y)+'" class="lbl dim">СВОБОДНАЯ ЗЕМЛЯ · 4 УЧАСТКА</text></g>');
  s.push('</g><g id="metro">');
  CITY.metro.forEach(function(m){
    const p=metroPath(m), cut=m.id==='cut';
    s.push('<path id="r-'+m.id+'" d="'+p+'" fill="none" stroke="'+(cut?PAL.hazard:PAL.frostDeep)+'" stroke-width="'+(cut?1.2:2.2)+'" stroke-opacity="'+(cut?0.45:0.34)+'" '+(cut?'stroke-dasharray="3 7"':'')+'/>');
    if(!cut) s.push('<path d="'+p+'" fill="none" stroke="'+PAL.frost+'" stroke-width="0.7" stroke-opacity="0.2"/>');
  });
  CITY.metro.filter(m=>m.pulse).forEach(function(m,i){
    s.push('<circle r="2.6" fill="'+PAL.liveHot+'" class="pulse"><animateMotion dur="'+(BEAT*8).toFixed(2)+'s" repeatCount="indefinite" begin="'+(i*0.9).toFixed(2)+'s"><mpath href="#r-'+m.id+'"/></animateMotion></circle>');
  });
  s.push('</g>');
  const rp=iso(14.6,7.2), rq={x:rp.x+196,y:rp.y-116};
  s.push('<g id="outroad"><line x1="'+r2(rp.x)+'" y1="'+r2(rp.y)+'" x2="'+r2(rq.x)+'" y2="'+r2(rq.y)+'" stroke="url(#roadOut)" stroke-width="3" stroke-dasharray="10 8"/>'+
  '<g class="bld" data-id="__ext">'+
  '<polygon points="'+pts([{x:rq.x,y:rq.y-13},{x:rq.x+30,y:rq.y+2},{x:rq.x,y:rq.y+17},{x:rq.x-30,y:rq.y+2}])+'" fill="'+PAL.mass.external.top+'"/>'+
  '<polygon points="'+pts([{x:rq.x-30,y:rq.y+2},{x:rq.x,y:rq.y+17},{x:rq.x,y:rq.y+25},{x:rq.x-30,y:rq.y+10}])+'" fill="'+PAL.mass.external.l+'"/>'+
  '<polygon points="'+pts([{x:rq.x,y:rq.y+17},{x:rq.x+30,y:rq.y+2},{x:rq.x+30,y:rq.y+10},{x:rq.x,y:rq.y+25}])+'" fill="'+PAL.mass.external.r+'"/>'+
  '<text x="'+r2(rq.x)+'" y="'+r2(rq.y+44)+'" class="lbl dim">ЗА ГОРОДОМ · 2 ОБЪЕКТА</text></g></g>');
  s.push('<g id="city">');
  CITY.buildings.slice().sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy)||a.gx-b.gx).forEach(function(b){
    s.push('<g class="bld st-'+b.st+'" data-id="'+b.id+'">'+build(b)+'</g>');
  });
  s.push('</g><g id="plaques">');
  const boxes=[], CW={dname:7.2, lbl:6.3};
  const hit=(a,b)=>!(a.x2<b.x1-3||a.x1>b.x2+3||a.y2<b.y1-2||a.y1>b.y2+2);
  const boxOf=(x,y,w,h,anch)=>({x1:anch==='end'?x-w:anch==='start'?x:x-w/2, x2:anch==='end'?x:anch==='start'?x+w:x+w/2, y1:y, y2:y+h});
  CITY.districts.forEach(function(d){
    const p=iso(d.lx,d.ly), a=d.anch, sx=a==='end'?-8:a==='start'?8:0;
    const w=Math.max(d.name.length*CW.dname,(d.part+' · '+d.code).length*5.6);
    boxes.push(boxOf(p.x+sx,p.y-8,w,32,a));
    const x1=p.x+sx+(a==='end'?-58:a==='middle'?-34:0), x2=p.x+sx+(a==='start'?58:a==='middle'?34:0);
    let lead='';
    if(d.id!=='core'){
      const cs=[iso(d.gx,d.gy),iso(d.gx+d.w,d.gy),iso(d.gx+d.w,d.gy+d.d),iso(d.gx,d.gy+d.d)];
      let best=cs[0],bd=1e9;
      cs.forEach(function(c){const dd=Math.hypot(c.x-p.x,c.y-p.y);if(dd<bd){bd=dd;best=c;}});
      lead='<line x1="'+r2(p.x+sx)+'" y1="'+r2(p.y-6)+'" x2="'+r2(best.x)+'" y2="'+r2(best.y)+'" stroke="'+PAL.hue[d.hue]+'" stroke-width="0.8" stroke-opacity="0.18" stroke-dasharray="2 4"/>';
    }
    s.push('<g class="plq" data-d="'+d.id+'" text-anchor="'+a+'">'+lead+
    '<line x1="'+r2(x1)+'" y1="'+r2(p.y-9)+'" x2="'+r2(x2)+'" y2="'+r2(p.y-9)+'" stroke="'+PAL.hue[d.hue]+'" stroke-width="1" stroke-opacity="0.45"/>'+
    '<text x="'+r2(p.x+sx)+'" y="'+r2(p.y+6)+'" class="dname" fill="'+PAL.hue[d.hue]+'">'+d.name+'</text>'+
    '<text x="'+r2(p.x+sx)+'" y="'+r2(p.y+18)+'" class="dcode">'+d.part+' · '+d.code+'</text></g>');
  });
  s.push('</g><g id="marks">');
  const OFS={tower:64,factory:46,arena:34,plaza:48,gate:24,lab:26,archive:20,campus:44,house:20};
  CITY.buildings.filter(b=>LANDMARKS.indexOf(b.id)>=0)
    .sort((a,b)=>heightOf(b)-heightOf(a)).forEach(function(b){
    const c=cen(b.gx,b.gy,b.w,b.d), h=heightOf(b);
    const anchorY=c.y-h-(OFS[b.arch]||20);
    const label=b.name.toUpperCase(), w=label.length*CW.lbl;
    let ty=anchorY-20, guard=0, box=boxOf(c.x,ty-9,w,12,'middle');
    while(guard++<8 && boxes.some(o=>hit(box,o))){ ty-=16; box=boxOf(c.x,ty-9,w,12,'middle'); }
    boxes.push(box);
    s.push('<g class="mark" data-id="'+b.id+'">'+
    '<line x1="'+r2(c.x)+'" y1="'+r2(anchorY)+'" x2="'+r2(c.x)+'" y2="'+r2(ty+5)+'" stroke="'+PAL.ink4+'" stroke-width="0.8"/>'+
    '<circle cx="'+r2(c.x)+'" cy="'+r2(anchorY)+'" r="1.6" fill="'+PAL.ink3+'"/>'+
    '<text x="'+r2(c.x)+'" y="'+r2(ty)+'" class="lbl">'+label+'</text></g>');
  });
  s.push('</g><g id="hoverlbl"></g>');
  return s.join('');
}

const svg=document.getElementById('citySvg');
svg.innerHTML=buildSVG();
const body=document.body;
const featureBox=document.getElementById('featureBox');
const lowerThird=document.getElementById('lowerThird');
const featureTitle=document.getElementById('featureTitle');
const featureText=document.getElementById('featureText');
const ltTitle=document.getElementById('ltTitle');
const ltText=document.getElementById('ltText');
const phaseLine=document.getElementById('phaseLine');
phaseLine.textContent = CITY.meta.phase + ' · обновлено ' + CITY.meta.updated + ' · кадастр: ' + CITY.meta.cadastre;
const goals=document.getElementById('goals');
CITY.meta.goals = [
  {icon:'🏗',lead:'v2 → v3',text:'чистим старые кварталы и готовим место для новых арен'},
  {icon:'🎤',lead:'Rehearsal → prod',text:'первое здание должно работать на полной мощности'},
  {icon:'🚇',lead:'EventBus',text:'подземка должна быть видна, а не жить в подписи'},
  {icon:'📺',lead:'YouTube arc',text:'каждая фича получает свой пролёт камеры и свой кадр'}
];
goals.innerHTML = CITY.meta.goals.map(g=>'<div class="goal"><div>'+g.icon+'</div><div><b>'+g.lead+'</b><br>'+g.text+'</div></div>').join('');
const statusMeta={alive:['живой','#FFB33B'],demo:['demo','#B59D51'],planned:['чертёж','#BECCDD'],conserved:['консервация','#66667D'],trash:['под снос','#E85433']};
function passportHTML(b){
  const st=statusMeta[b.st]||['живой','#FFB33B'];
  return '<div class="kicker">паспорт здания</div>'+
    '<h3>'+b.name+'</h3>'+
    '<div class="meta">квартал '+b.code+' · '+b.dist+'</div>'+
    '<div class="badge" style="color:'+st[1]+'">'+st[0]+'</div>'+
    '<p class="p">'+b.human+'</p>'+
    '<div class="kv">'+
      '<div class="kvRow"><span>тип</span><span>'+b.arch+'</span></div>'+
      '<div class="kvRow"><span>высота</span><span>'+heightOf(b)+' px из метрики</span></div>'+
      '<div class="kvRow"><span>активность</span><span>'+b.t30+' touches / 30d</span></div>'+
      '<div class="kvRow"><span>масштаб</span><span>'+b.loc+' LOC · '+b.files+' files</span></div>'+
    '</div>'+
    '<div class="panelTitle" style="font-size:17px">модули</div>'+
    '<div class="codeList">'+b.mods.map(m=>'<div>'+m+'</div>').join('')+'</div>'+
    (b.wave?'<div class="note" style="margin-top:16px">волна миграции: '+b.wave+'</div>':'');
}
const right=document.getElementById('passport');
const select=document.getElementById('featureSelect');
select.innerHTML = CITY.buildings.filter(b=>['billy','studio','sync','live','catalog','blocks-old'].includes(b.id)).map(b=>'<option value="'+b.id+'">'+b.name+'</option>').join('');
const swatches=[['фон','#05070D'],['плита','#10131A'],['живой свет','#FFB33B'],['hot light','#FFE29A'],['frozen','#B2DFF4'],['hazard','#E85433'],['verse floor','#08191B'],['chorus floor','#241212'],['bridge floor','#191428']];
document.getElementById('swatches').innerHTML = swatches.map(([n,c])=>'<div class="sw"><div>'+n+'</div><div class="swatch" style="background:'+c+'"></div></div>').join('');
let selected='billy';
function focusBuilding(id){
  selected=id;
  const b=CITY.buildings.find(x=>x.id===id); if(!b) return;
  [...svg.querySelectorAll('.bld')].forEach(n=>{n.classList.remove('sel','focus'); if(n.dataset.id===id){n.classList.add('sel','focus');}});
  right.innerHTML=passportHTML(b);
  featureTitle.textContent=b.name;
  featureText.textContent=b.human;
  ltTitle.textContent=b.name;
  ltText.textContent='сегодня работаем здесь';
  const c=cen(b.gx,b.gy,b.w,b.d), scale=body.classList.contains('broadcast')?1.16:1.08;
  const tx=660-c.x*scale, ty=360-c.y*scale;
  svg.style.transition='transform .55s var(--ease)';
  svg.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';
}
right.innerHTML='<div class="empty"><b>Кликни по дому</b><div class="p">или выбери фичу внизу. Я начну с Башни Билли, потому что это правильный opening shot.</div></div>';
svg.addEventListener('click',e=>{
  const g=e.target.closest('.bld'); if(!g) return; const id=g.dataset.id; if(id==='__ext') return; focusBuilding(id); select.value=id;
});
select.addEventListener('change',e=>focusBuilding(e.target.value));
document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('on')); btn.classList.add('on');
  body.classList.remove('engineer','broadcast');
  if(btn.dataset.mode==='engineer') body.classList.add('engineer');
  if(btn.dataset.mode==='broadcast') body.classList.add('broadcast');
  body.classList.toggle('dimmed', btn.dataset.mode==='broadcast');
  featureBox.style.display = btn.dataset.mode==='broadcast' ? 'none' : 'block';
  focusBuilding(selected);
}));
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('on')); btn.classList.add('on');
  body.classList.toggle('showSpec', btn.dataset.tab==='spec');
}));
document.getElementById('focusBtn').addEventListener('click',()=>focusBuilding(select.value));
focusBuilding('billy');
</script>
</body>
</html>
```

---

_Конец пакета. Ждём: арт-направление + система форм + кодировка статусов + финальный HTML на реальном кадастре. Скриншоты приложения beLive — во вложениях к этому сообщению от Босса._
