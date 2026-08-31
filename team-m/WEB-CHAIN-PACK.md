# WEB-CHAIN PACK — beLive V3 → M3-GO (консолидированный, 2026-08-25)

> **Для web-архитекторов (Соннет и др. через WEB).** Локальные сабагенты (Ox Alpha Free) перегружены → работаем через WEB-цепочку. Суть та же: Hub пакует контекст + задачи в ОДИН файл, web-архитектор берёт задачу и возвращает пропозал. Hub (007_Винда, PC) верифицирует (`tsc`/`vitest`) и применяет через Оператора.
> Это консолидированная версия того, что раньше шло 3-мя частями MEGA-PACK — теперь одним файлом.

---

## 0. ЖЁСТКИЕ ОГРАНИЧЕНИЯ (читать первым!)

### ❄️ FROZEN ZONE — АБСОЛЮТНО НЕ ТРОГАТЬ (даже чтение для правки = стоп)
- `src/audio/core/AudioEngineV2.ts`
- `src/audio/compat/patchV1.ts`
- `src/bridges/*`
- `src/services/track.orchestrator.ts`
- приватные поля `_` (в любых файлах)

Любое упоминание правки frozen-файла → немедленная остановка и вопрос Боссу. Читать (для анализа, НЕ правки) можно.

### §9 SINGLE-WRITER
Код в `src/` пишет ТОЛЬКО **Оператор** по диспатчу Hub (007_Винда). **Web-архитектор возвращает ПРОПОЗАЛ** (текст + готовые diff-вставки), не правит репо напрямую.

### Канон (не ломать)
- `tsc` — **314** ошибок (дифф идентичен, это базовая линия, не «0»).
- `vitest` — **763/763** тестов зелёные.

---

## 1. Роли и координация
| Роль | Кто | Что делает |
|---|---|---|
| **Boss (Center)** | Никита | Архитектурные решения, подключает web-архитекторов, даёт `GO`. |
| **Hub** | 007_Винда (PC/V007) | Координатор/упаковщик/верификатор. Применяет код через Оператора. Владеет `team-m/*`, `opencode.json`. |
| **Mac-007** | Евгения (Mac) | Mac-side build: avatar UI/CSS, CoachPanel (D4), G3/Layer-2, проекции. Тоже берёт задачи из этого пакета. |
| **Web-архитекторы** | Соннет/др. через WEB | Берут задачу из §3, возвращают пропозал. |

**Канал связи:** репо-отчёты (`team-m/REGISTRY.md`, `SYNC-*.md`, `INBOX.md`), НЕ буфер Босса.

---

## 2. Ownership matrix (чтобы НЕ пересекаться)
| Зона | Владелец | Файлы / область |
|---|---|---|
| Audio-graph, V-Mix, mic, takes-запись v3 (MIC-source), music-bus parity | **PC / V007** | `MonitorRouter.ts`, `HybridPipelineService.ts`, `V2Adapter` (read), `takes/*`, `useStemStore` |
| Lyrics / word-sync engine, markers | **PC / V007** | `lyrics-events.ts` (r/w), `lyrics.bridge.ts` (**FROZEN-read**), `markers.store` (read) |
| Character-AI **логика/звук** | **PC / V007** | `registry.ts`, `ai-chat-ui.ts`, `CharacterSoundManager` |
| Avatar UI, CSS, **CoachPanel D4**, **G3 / Layer-2** bridge | **Mac-007** | `src/avatar/*`, `avatar.css`, `CoachPanel` (создать), `team-m.report-arrived` |
| Design / проекции, `html-projections`, `public/audio` (Mac-часть) | **Mac-007** | `html-projections/*` |
| Координация: `team-m/*`, `agent-registry/*`, `docs/governance/*`, `opencode.json`, `docs/INDEX.md`, REGISTRY | **Hub (007_Винда)** | только я / с моей санкции |
| **Frozen Zone (НИКТО)** | — | `AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_` |

Пересечение char-AI: **PC = логика/звук/чат**, **Mac = аватар/CSS/панель**. Файлы не пересекаются.

---

## 3. Задачи для WEB-цепочки
Для каждой: что сделать, что известно, что нужно получить, где файлы.

### T1 — DOC-CHECK (5 устаревших доков)
- **Суть:** документация разъехалась с кодом после character-AI цепи + TASK-013.4.
- **Файлы (проверить на актуальность):** `docs/architecture/avatar-visual-engine.md`, `docs/character-ai/RESEARCH-REPORT.md`, `docs/team-m-sync-proposal.md`, `agent-registry/MIGRATION-WAR-ROOM.md`, `agent-registry/006-007-registry.md`.
- **Что сделать:** прочитать each + сверить с реальным кодом (grep), выписать, что теперь неправда, предложить правки (пропозал).
- **Результат:** список right/correct + патчи доков.

### T2 — N3-β (стопать ли auto-chain после записи)
- **Суть:** решение НЕ принято. Код-маркер `🔧 Fix D (FM-N3)` есть в `HybridPipelineService.ts:678-679` (`_playStartTime=0`, `_currentRate=1.0` в reset) — это reset clock, НЕ продуктовое решение.
- **Что сделать:** FROZEN-READ `src/audio/core/AudioEngineV2.ts` + `src/bridges/lyrics.bridge.ts`, найти V2-эталонное поведение («остаёмся на блоке записи или auto-advance?»), вынести вердикт + пропозал для V3.
- **Результат:** вердикт N3-β + рекомендация (правка НЕ в frozen, а в V3-логику).

### T3 — word-sync / markers
- **Суть:** как маркеры слов синхрятся с аудио, где расхождения.
- **Файлы:** `src/foundation/event-bus/wrappers/lyrics-events.ts` (GUARD-36 тут, :71), `src/bridges/lyrics.bridge.ts` (FROZEN-read), `markers.store`.
- **Что сделать:** раскопать механизм маркеров, найти расхождения/DOC-долги.
- **Результат:** схема + пропозал правок (вне frozen).

### T4 — audio-graph / V-Mix parity
- **Суть:** stereo-разводка (vocals L / mic R / center) должна быть parity с V2.
- **Файлы:** `MonitorRouter.ts`, `HybridPipelineService.ts`, `V2Adapter` (read).
- **Что сделать:** свежим взглядом найти, где ещё разводка/панорама не равна V2-эталону.
- **Результат:** список несоответствий + пропозал.

### T5 — D4 CoachPanel (Mac-zone, BUILD)
- **Суть:** новый UI-компонент чипов персонажей.
- **Известно (recon Мака):** точка маунта `src/App.tsx:253` (сразу после `<BillyDock/>`), гейт `{coachPanelOpen && <CoachPanel/>}` по аналогии с `aiSettingsOpen && <AiSettingsModal/>` (`:258`). Флаг `coachPanelOpen` — в `ai-settings.store` (рядом с `soundEnabled`, D3) или новый `coach-panel.store`.
- **Данные:** `ASSISTANT_PROFILES` (billy) в `src/js/ai/registry.ts`.
- **Что сделать:** собрать `CoachPanel.tsx` (data-driven чипы, actions: select/guest-gate/sound). НЕ через `registerInit` — только в JSX `App`.
- **Результат:** пропозал компонента + маунт-правки. (Mac строит, Hub диспатчит Оператора.)

### T6 — G3 / Layer-2 мост `team-m.report-arrived` (Mac-zone)
- **Известно:** listener УЖЕ есть — `src/character/sound/CharacterSoundManager.ts:52` → `window.addEventListener('team-m.report-arrived', () => this.playNotification())`. Gap: никто не ЭМИТИТ на Маке.
- **Что сделать:** финализировать `src/character/notify-bridge.ts` (Mac-zone) с рабочим эмиттером. ⚠️ Браузер НЕ читает `fs`; vite не отдаёт `/team-m/INBOX.md` через fetch (только `public/`). Решение: положить INBOX в `public/team-m/INBOX.md` ИЛИ сравнивать content-hash. Polling ~1.5s.
- **Результат:** финальный `notify-bridge.ts` + `registerInit` в `src/character/index.ts`.

### T7 — char-AI avatar / CSS (Mac-zone)
- **Суть:** аватар-реакции (happy/idle/reactive), приоритет listening>happy>reactive>idle, reduced-motion.
- **Файлы:** `src/avatar/FullAvatar.tsx`, `src/avatar/FallbackAvatar.tsx`, `avatar.css` (`--bl-av-*`), `src/character/avatar.assets.ts`.
- **Результат:** пропозал стилей/пресетов.

### T8 — F-2 дубль (проверка)
- **Суть:** uncommitted `HybridPipelineService.ts`/`MonitorRouter.ts` (PC) vs пилот F-1/F-2. War Room уже помечает F-2 G14 (mic-comp) DONE.
- **Что сделать:** подтвердить, что uncommitted правки не конфликтуют с пилотом перед запуском.
- **Результат:** вердикт «безопасно / конфликт».

### 🔴 BLOCKED (ждут спеку Center/Босса)
- **425 + G4 + M3-GO** — архитектурная спека. НЕ начинаем без Босса.
- **MIC-УШИ-СЕССИЯ** (solo-preview, vocal-fade, auto-pause, RTL) — нужен бриф 006.

---

## 4. Статус (что уже DONE)
- ✅ **TASK-015 V-Mix stereo** — фейдеры post-fader (V007-006) + мик ТОЛЬКО RIGHT (V007-008/TASK-015b, граф-гейт `_vmixMicGate`). Юзер подтвердил.
- ✅ **Character-AI chain** — M3/D3/Layer-2 + G1/G2/F-2 G14. tsc 314 / vitest 763.
- ✅ **M4 unify (V007-009)** — `ai-chat-ui.ts` → `aiHub.sendMessage`, удалён `streamOpenAI`, once-guard `completionHandled`. tsc 314 / vitest 763.
- ✅ **№17/№18-BUS/TASK-014/A2/TASK-001..009/TASK-013.4** — DONE (War Room).
- 🟡 **D4/G3 recon ✅** — ждут пропозал Мака (T5/T6).

---

## 5. Как сдавать результат
Web-архитектор возвращает **пропозал** (markdown) содержащий:
1. `file:line` ссылки,
2. готовые diff-вставки (```ts блоки),
3. обоснование + риски,
4. отметку frozen-NOT-touched.

Куда класть: либо в ответ Боссу (Center), либо в `team-m/reports/web-arch/<task>.md`. Hub верифицирует (`tsc`/`vitest`) и диспатчит Оператора на применение. Мак видит применённое через sshfs-монтаж.

---

## 6. Быстрые ссылки (реальные пути, проверено на PC)
- `team-m/REGISTRY.md` — живой реестр координации (ownership, status, open Q, task board).
- `team-m/BRIEFING-MAC-007.md` — стоящий брифинг Мака.
- `team-m/SUBAGENT-SETUP.md` — канон настройки субагентов (для справки, локальные цепочки сейчас паузены).
- `agent-registry/MIGRATION-WAR-ROOM.md` — единственный источник правды по статусам.
- `docs/INDEX.md` — single-entry навигация.
- `docs/product-protocol-v2.1.md`, `docs/SYNC-PROTOCOL.md`, `team-m/SHARED-REGISTRY.md §0 (MAC-PC-BRIDGE-SPEC → historical-redirect)` — протоколы.

---

**Hub (007_Винда):** пак собран. Босс отдаёт этот файл web-архитекторам → получаем пропозалы → я применяю. Следующий `GO` от Босса двинет цепочку. 🪟⚔️🍎
