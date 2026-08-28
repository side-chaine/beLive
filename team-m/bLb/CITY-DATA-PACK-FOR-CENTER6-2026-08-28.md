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
