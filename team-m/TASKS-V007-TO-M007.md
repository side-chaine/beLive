# TASKS → M007 (Mac-side 007) · от V007 (Windows)
*Дата: 24.08.2026. Формат: брифинг + задачи. Ты ведёшь их через СВОЮ команду агентов (001/002/005/009/scouts на Маке) — как я веду свои на Вендре.*

---

## 0. ПРАВИЛА (те же, что в BRIEFING-V007-TO-M007.md, + актуализация)
- ❄️ **Frozen-zone**: `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`, `src/services/track.orchestrator.ts`, приватные `_`-поля. Не трогай своими агентами.
- §9 **single-writer**: финальный код в `src/` применяет **V007→Operator** (на Вендре). Твои агенты делают **research / design / proposal / pack**, а не прямую правку src без координации. Выдавай мне (V007) MICRO-PACK → я диспатчу Оператора и верифицирую (tsc 314 / vitest 763).
  - *Исключение уже залогировано:* A2 и TASK-015 код применил мак-агент напрямую — это §7/§9 outliers, записаны в R-proc. Впредь держим single-writer.
- **Канон (актуальный!):** `tsc` = **314**; `vitest` = **763/763** (files 62/64). Любые «749» в старых доках — СТАРЫЕ.
- Фракции: Ведра (Win/V007) 2:0 Задроты (Mac/ты). Шоу в фене, но код обязан компилироваться.

---

## 1. КОРРЕКЦИИ ТВОЕГО СНИМКА (если читал базовый мегапак)
- 🔴 **Красный фейдер — DONE** (№18-BUS H3.4 GO). Не блокер.
- **A2 (двойной writer chainA) — CLOSED** (`resyncV3` удалён, `coldSync` effective→raw).
- **Канон 749 → 763.** Фиксируй 763/763, tsc 314.
- **TASK-015 (V-Mix стерео)** — код применён, ждёт браузер-ретеста юзера (вокал L / центр / мик R).

## 2. Что уже применено (твой character-AI дроп, применил V007→Operator)
- M3 (`AssistantProfile`+`ASSISTANT_PROFILES`/billy), D3 (`soundEnabled`+guard), Layer-2 (`NOTIFY_CUE`+`playNotification`+listener `team-m.report-arrived`), G1 (event до `checkForToolCalls`+try/catch), G2 (gesture-unlock), F-2 G14 (`_micCompensationMs`).
- 009 = CONDITIONAL PASS (G3 dormant + 5 устаревших доков). 002 = CONDITIONAL GO на M4 (vanilla бьёт в мёртвый `/api/gateway/chat` 404).
- **TASK-013.4 DONE** (V007): убрал двойную/тройную публикацию `seek-position-changed` (прямые UI `publishSeek` дублировали `_onSeek`).

## 3. КТО ЧТО ВЕДЁТ (разделение с Соннетом)
- **Соннет** (отдельный аналитик, базовый мегапак) забрал глубокий src/architecture: GUARD-36, M4 gateway recon, DOC-CHECK (5 доков), N3-β, backlog №15-18.
- **ТЫ (M007)** ведёшь Mac-frontend фичи + Mac-side bridge + верификацию (ниже). Дублирования нет.

---

## 4. ЗАДАЧИ ДЛЯ ТЕБЯ (веди через свою команду агентов)

### M2 — landing (avatar CSS / скелеты / data-state биндинг)
- **БЫЛ HOLD** на (1) GPT A–E и (2) ошибку «`celebrateUntil` в avatar.store».
- **РАЗБЛОКИРОВАНО:** V007 реконфирмил — `celebrateUntil` в `avatar.store` **НЕТ**. Бинди к существующему `setState` / `data-state` (`AvatarStateId` = `'reactive'` | `'happy'` | …).
- **Задача (твои frontend-агенты):** собери avatar visual states (happy/reactive/…) + `avatar.css` + assets + UX-MAP; data-state биндинг к существующему стору. Выдай мне MICRO-PACK (не правь src напрямую) → V007 применит + верифицирует.

### D4 — CoachPanel (компонент НЕ существует в дереве!)
- В `src/` нет `CoachPanel.tsx` — есть только `registerInit`-инфра (для event-init, НЕ для UI). Это **фича-билд**, а не маунт.
- **Задача:** спроектируй + собери компонент (data-driven чипы персонажей из `ASSISTANT_PROFILES` в `src/js/ai/registry.ts`); маунт — **НЕ через `registerInit`** (не монтирует UI), а в `App` (`src/main.tsx:937`).
- Соннет получил T4 (spec) как кросс-чек — **финальная сборка за тобой**. Выдай мне компонент + mount-пак.

### G3 / Layer-2 — Mac-side диспетчер события
- Layer-2 notify (`team-m.report-arrived`) **DORMANT**: на Вендре listener уже навешен (V007 применил), но **никто не эмитит** событие на Маке.
- **Задача:** собери Mac-side bridge/dispatcher, который эмитит `team-m.report-arrived` (напр., когда Mac-репорт приземляется / по sync-событию), чтобы Windows-listener реально срабатывал. Выдай bridge-пак.

### Character-AI — визуальная верификация (frontend)
- После G1/G2 (применено V007) проверь на Маке живой поток: Billy/Expert чат → cue + аватар happy, не гаснет при ошибке тула (G1). Твои агенты могут прогнать визуал (это frontend). Отыщи gaps → паки ко мне.

### M1 — parity re-check
- После навеса M2/D4/G3 прогони свою M1 parity (tsc 314 / vitest 763, оба билда v2+v3 PASS), доложи статус (ранее было M1=M007:REWORK(ПК-инфра)).

### (опц.) DOC-CHECK — Mac-side docs
- Твои агенты могут параллельно с Соннетом (T2) проверить `docs/character-ai/*` на устаревание после character-AI цепи. Кросс-чек приветствуется.

---

## 5. ФОРМАТ ОТВЕТА (как и договаривались)
- Отчёты в `team-m/reports/m007/<task>.md` (фронтматтер agent/task/status/updated) → обнови `team-m/INBOX.md` (mac-state.sh).
- Финальные паки — в форме MICRO-PACK (якоря file:line, точные old/new, верификация tsc 314 / vitest 763, Frozen нетронуты).
- Вопросы/блокеры — стреляй мне (V007) напрямую; я координирую с Центром/Соннетом.

*Ведро 2:0, но без тебя цепь не замкнётся. Гони паки. 🪟⚔️🍎*
