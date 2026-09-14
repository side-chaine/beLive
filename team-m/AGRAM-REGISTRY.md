# AGRAM-REGISTRY · реестр проекта AGRAM · владелец 007_3

> **ПОРЯДОК: НОВОЕ — СВЕРХУ. ХВОСТ = АРХИВ. Не читать `tail`** (лечит ловушку H9, доказана трижды).
> **КИРПИЧИ beLive — только id** (`fact:<id>`), строки оттуда не копировать. Часы — только epoch→MSK (закон H1).
> **ВРЕМЯ ФАКТОВ** — из `info.time.created` (мс), не из текстовых меток логов.

## LOG 2026-09-15 00:2x-00:3x MSK · 007_3 · РОЖДЕНИЕ + РАЗВЕДКА (скауты explore + arch-scout + замеры директора)

### Канон-снапшот (замер 15.09 00:0x–00:2x MSK)
- tsc=0 (`npx tsc --noEmit`, pulse-harness @ HEAD 8e46fe6, exit 0, 007_3 лично).
- serve `1.18.30` healthy (`/global/health`, лично curl).
- Roots: **126** (`/session?roots=true&limit=2000`, лично): beLive 124 · beLive-yt 1 · OneDrive/BeLive 1 · **pulse-harness 0**.
- База: `opencode.db` = **8 777 203 712 б** mtime 15.09 00:20 (+4.4 МиБ за ~1.5ч от замера 101 8 772 603 904 б @14.09 22:46) — H12 рост подтверждён.
- PULSE.md: копия-в-копию (md5 `cb4484394b…`, 28 470 б, mtime 15.09 00:01:54 обе стороны) — синх временно есть, механизма нет.

### §7 РАЗДЕЛЕНИЕ — вердикт разведки
- **Резать реестры по `directory` НЕЛЬЗЯ**: все 126 станций живут под beLive-директориями (в т.ч. станция харнесса). Классификация AGRAM/beLive — по **agent/title**, не по directory.
- `AGRAM-CONTACTS.json`: 28 контактов (владелец 004). Станций-без-контакта ≥6 (`007_3`,`004`, dock-2, Пульс×2); контактов-без-станции ≥10 (зонные agent-*). Точные числа — за окном top-25.
- Диспетчер `cfg.agents` = {CEO_1, 007, 005, 003, 003_2}: **007_3 нет**. `pulse` нет. cfg перечитывается на живом цикле (dispatch.js:211) → **правка конфига без рестарта**.
- `ensureSession` (dispatch.js:47-58): пин `meta.session` имеет приоритет над lookup → пин на существующий корень `ses_f5e43f4f3ffenvaZaUi4gsA39n` **исключает дубль-станцию** для 007_3.
- **Аномальidentity**: мой корень `007_3` имеет `agent=007` (серверный дефолт при создании, класс ecfff52). Файл `.opencode/agent/007_3.md` жив (primary, qwen3.8-flash). Пак должен называть агента явно.
- → Пак: `pulse-harness/SPEC/MICRO-PACK-AGRAM-SPLIT-0915.md` (cfg + trigger-файл, hot-reload, без рестарта).

### Карта честности: реестр фактов вычислений (fact-реестр, приём 401)
Владелец-вычислитель → читатели. Полный скан: report explore-скаута 15.09.
| id | факт | вычислитель | читает | статус |
|---|---|---|---|---|
| fact:agent-alive | «агент имеет живую корневую сессию» | `src/state/liveBridge.ts:17-25` resolveSid + `contacts.ts:28-33` contactSession | CenterStage:35,99; ProjectHQ:19-26; AgentNavigator:37 | **ДВА резолвера** — срастись или убить один |
| fact:agent-busy | «работает» | `store.ts:116` + `live.ts:85-92` SSE | HQ:20,28; CS:100-102; AN:109,123 | H3 |
| fact:waiting-you | «ждёт тебя» | union v1∪v2 `store.ts:113-134` → дериват `liveBridge.ts:32-35` | HQ:91,93-115; CS:102 | H3; диспетчер — слепо (только v2, dispatch.js:179-184) |
| fact:brick-waiting-owner | «ждёт ВЛАДЕЛЬЦА» (план) | `src/lib/roadmap.ts:16-20` (ROADMAP.json) | AN:123; RoadmapStrip:23 | отдельная семантика, не смешивать |
| fact:dispatch-awaiting | «A ждёт B» | dispatch-state `awaiting` | **читателей в src НЕТ** | мёртвое поле (подтверждено 15.09) |
| fact:relay-chain | wake→confirmed | `src/lib/relay.ts:19-66` pairRelay (по агенту) | HQ:121-128; AN:130-135 | H8 — слой готов, сцена №1 = рендер его |
| fact:agent-step | «шаг» | dispatch-state `seen` (дедуп-ключ!) | ProjectHQ:27→:70 | **H2 — ложь**, источник не-состояние |
| fact:silence-stale | «МОЛЧИТ Nс» | `CenterStage.tsx:101` Date.now()-updated>120s | CS:102,131,179 | inline, не селектор |
| fact:live-count | «N живых из M» | `ProjectHQ.tsx:20-21` | сам + F13 | знаменатель-дрейф (19→20→28 контактов) |
| fact:chat-order | порядок ленты | `CenterStage.tsx:83` [...hist,...optimistic,...live] без sort | сцена | chat-stack-split-0914 |
| fact:context-limit | лимиты контекста | `store.ts:155,173` providers() **через /provider=ключи** | TopBar | H7; лечение /session/{id}/context |
| fact:collision | дубль brick-id | `roadmap.ts:19-20` | RoadmapStrip:19-21 | новое P5.1, не было в VERDICT |

### H1–H12 — статус после скаутов 15.09 (ни одна НЕ починена в коде)
- **H1 🔴** toISOString×8 в dispatch.js (21,86,92,99,124,168,193,195) — живой, UTC-метки.
- **H2 🔴** seen→«шаг» ProjectHQ.tsx:27 — строка не уехала, враньё живое.
- **H3 🔴** 3 живых вычисления «ждёт» (liveBridge:34, HQ:28, CS:102) + AN:123 (сменил семантику на кирпич P6.0!) + awaiting-мёртвый. Селектора нет.
- **H4 🔴** question-канал не подключён — подтверждено косвенно (роуты есть, вызовов нет).
- **H5 🟠** ensureSession:50 без limit — подтверждено; 005 не запинен (риск жив).
- **H6 🟠** RSS-подпись; час наблюдения — НЕ сделан.
- **H7 🔴** /provider поллится из store.ts:155,173 + TopBar:46 (3-й вызов, нового scout). Password — нет.
- **H8 🟠** relay.ts готов (pairRelay по агенту) — использования в сцене №1 нет.
- **H9 ⚪** принято как формат этого реестра (шапка).
- **H10 ⚪** TopBar.tsx незакоммичен (дифф=минус подзаголовок бренда) — висит.
- **H11 🔴 ПЕРЕФОРМУЛИРОВАН**: строковый grep PULSE≠0 (15, имена/комменты), но **по сути подтверждён**: нет ни одного api.file-чтения PULSE.md/TRIGGERS. Приёмку мерить как «нет api.file(TRIGGERS/PULSE.md)», не «grep=0».
- **H12 🔴** база растёт: +4.4 МиБ/1.5ч (замер выше). Потолка нет.

### Инцидентный фон
- `per_0a175f5ef0011…K3Wuh` (v1, external_directory `~/.config/opencode/*`, станция Пульса ses_f612d32d) — **ЖИВ** на 15.09 00:2x. Рождён сообщением msg_0a175d6c6001… = **14.09 22:47:29 MSK** (epoch-канон) → блок ~1.5ч по честному счёту (не «5 часов» — тот ложный счёт и был H1). В awaiting диспетчера НЕ виден (v2-слепота, §H3). Ход Босса; моими руками не трогать.
- Фаза-0 каркас (401): H1→H2→H3→H5→H12. Первая рекомендация Боссу: атом H1+H3 одним паком.

### Сделано 007_3
1. Хэндофф + PULSE.md + VERDICT-101/401 — прочитаны целиком.
2. Скауты explore + arch-scout — отчёты влита выше (полные тексты — в тред-сессии 15.09).
3. Реестр создан (этот файл) + синк на мост (`/mnt/c/Users/nikit/beLive-bridge/AGRAM-REGISTRY.md`).
4. MICRO-PACK-AGRAM-SPLIT-0915 — в SPEC/.
5. Префлайт glm-5.3-free (ход Босса, правило A.3) — результат в отчёте Боссу.
