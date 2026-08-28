# SUBAGENT SETUP — каноничная настройка субагентов (beLive · Ox Alpha week)

> Hub (007_Винда) — единственный, кто правит `opencode.json` (REGISTRY §0.3). Этот файл — инструкция «как правильно», адресована Mac-007 и любому, кто поднимает субагентов.

## 1. Какой файл авторитетен
- **АКТИВНЫЙ** конфиг = `opencode.json` в корне репо. Его грузит opencode при старте сессии в этом репо.
- Рядом лежат **альтернативные тир-конфиги** (НЕ для недели Ox Alpha, если не переключишь осознанно):
  - `opencode.json.low` → все на `opencode-go/deepseek-v4-flash`
  - `opencode.json.high` → `glm-5.2 / glm-5.1 / mimo-v2.5 / kimi-k2.6`, operator `deepseek-v4-flash-free`
  - `opencode.json.backup` → старый `glm/mimo/kimi` (без operator)
- ⚠️ **Mac:** если твой sshfs-монтаж падал за сессию, могла остаться локальная тень `/Users/evgenia/beLive-pc/opencode.json`. Перед стартом **сверь её с репо-шной** — иначе субагенты поедут на моделях из тени, а не `ox-alpha-free`.

## 2. Каноничный блок `agent` (уже применён в `opencode.json`)
```json
"agent": {
  "001":     { "model": "opencode/x-preview-f-free" },
  "002":     { "model": "opencode/x-preview-f-free" },
  "005":     { "model": "opencode/x-preview-f-free" },
  "008":     { "model": "opencode/x-preview-f-free" },
  "009":     { "model": "opencode/x-preview-f-free" },
  "explore": { "model": "opencode/x-preview-f-free" },
  "general": { "model": "opencode/x-preview-f-free" },
  "operator":{ "model": "opencode/big-pickle" }
}
```
> ⚠️ **ROOT CAUSE (2026-08-25):** ранее стояла модель `opencode/ox-alpha-free` — её **НЕТ** в каталоге провайдера (`opencode models`: hy3-free, mimo-v2.5-free, muse-spark-1.2-contributor-free, nemotron-*-free, x-preview-f-free). Из-за этого спавн падал «Endpoint is unavailable» у обеих сторон. Канон теперь: `opencode/x-preview-f-free` = та же модель, на которой работает сессия 007.
- `001/002/005/008/009` — recon / stress / booster / verify сабагенты → **ox-alpha-free (Unlimited)**.
- `explore` / `general` — research-скауты (цепочки deep-dive) → тоже **ox-alpha-free** (добавлено Hub'ом, протокол Соннета).
- `operator` — исполнитель кода (применяет MICRO-PACK) → `big-pickle` (оркестратор-класс, надёжен для патчей).
- `default_agent` = `007` (Hub/координатор) остаётся на модели сессии (оркестратор), НЕ на ox-alpha-free.

## 3. Как проверить, что сабагент реально на ox-alpha-free
- При спавне сабагента opencode показывает модель в заголовке ответа — проверь, что у 001/002/005/008/009/explore/general стоит `opencode/ox-alpha-free`.
- Или `cat opencode.json | grep ox-alpha-free` — должно быть 7 вхождений.
- Если видишь `opencode-go/*` или `big-pickle` у перечисленных — конфиг не тот (ты на `.low`/`.high` или на локальной тени). Вернись к `opencode.json`.

## 4. Владение и протокол изменений
- `opencode.json` — **SHARED-MUTABLE**. Меняет ТОЛЬКО Hub (007_Винда) по REGISTRY §0.3.
- Любая правка shared-полей = **одна строка в `team-m/INBOX.md`** (что + зачем).
- История: Mac-007 перебил модели на `ox-alpha-free` без INBOX-строки (нарушение §0.3), но совпало с волей Босса → ратифицировано. Вперёд Hub-owned.

## 5. Как сабагенты гоняются (GO_xxx)
См. REGISTRY §6. Цепочки `GO_001=[001→002→001→009]`, `GO_005=[005→002→009]`, `GO_009=[009]`, `GO_002=[002]` — все звенья на `ox-alpha-free`. Hub ставит задачу в Task Board (§7) → Босс пишет `GO_xxx` в сессии Мака → Мак спавнит цепь, результат кладёт в `team-m/reports/mac-007/`.

## 6. Шаблоны функций для канона v2 «General + Функция»
Спавн: `Task(subagent_type="general", prompt = ШАБЛОН_РОЛИ + ЗАДАЧА)`. Проверено на PC: контроль `GENERAL-OK`, боевая цепь N3-β закрыта с вердиктом RESOLVED.

### Ф001 — Со-Архитектор (recon/решение)
«Ты исполняешь ФУНКЦИЮ агента 001 "Со-Архитектор beLive" (репо /home/nikit/projects/beLive). Ищи элегантное/минимальное решение; факты ТОЛЬКО с file:line; Frozen Zone читать МОЖНО, править НЕЛЬЗЯ: src/audio/core/AudioEngineV2.ts, src/audio/compat/patchV1.ts, src/bridges/*, src/services/track.orchestrator.ts, приватные `_`-поля. Канон: tsc 314 ошибок / vitest 763.» + текст задачи.

### Ф002 — Стресс-тестер
«Ты исполняешь ФУНКЦИЮ агента 002 "Стресс-тестер beLive". Атакуй решение по краям: фактические ошибки в цитатах, контрпримеры (grep по src/), race/lifecycle, регрессии канона, frozen-риски. Каждый пункт `⚠️ РИСК` или `✅ OK` + обоснование с file:line; блокеры словом БЛОКЕР; в конце строка ИТОГО: N рисков / M блокеров.» + резюме решения Ф001.

### Ф009 — Независимый эксперт (вердикт)
«Ты исполняешь ФУНКЦИЮ агента 009 "Независимый эксперт beLive". Финальный вердикт (GO/NO-GO или RESOLVED/OPEN): проверь frozen-чистоту и полноту доказательной базы, учти атаки стрессера, приоритизируй риски P1/P2/P3, назови оставшиеся дыры. Ответ компактный.» + резюме Ф001+Ф002.

Цепочки: минимальная `[Ф001→Ф002→Ф009]`; полная GO_001 `[Ф001→Ф002→Ф001→Ф009]`. После рестарта процессов именной спавн `001/002/…` оживёт (канон v1) — шаблоны остаются как страховка и как общий стандарт для Mac-007.

— Hub (007_Винда). Вопросы — тегом в `team-m/REGISTRY.md` или `SYNC-*`.
