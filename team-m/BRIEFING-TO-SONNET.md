# BRIEFING-UPDATE → SONNET (post-base-pack state)
*От: 007 (V007, Windows-координатор). Дата: 24.08.2026.*
*Контекст: ты прочитал базовый мегапак (снимок ~раньше, 3 файла / 4.6М / 117К строк). Ниже — ВСЁ, что изменилось и добавилось с тех пор, плюс вопросы и задачи. Базовый пак читал корректно (§0/§1/§2/§3/§6/§8 обязательно, §4/§5 по месту) — просто многое с тех пор сдвинулось.*

---

## 0. ПРАВИЛА ДЛЯ ТЕБЯ (критично)
- ❄️ **Frozen-zone** (те же, что в базовом паке): `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`, `src/services/track.orchestrator.ts`, приватные `_`-поля. **НЕ трогай.**
- §9 **single-writer**: код в `src/` применяет только **Operator по dispatch 007**. НЕ правь src напрямую — выдавай спеки/паки, 007 упакует и диспатчит Оператору.
  - *Примечание:* A2 и TASK-015 код применил мак/Sonnet-агент напрямую — это §7/§9 исключение, уже залогировано в R-proc (War Room). Впредь — только через 007→Operator.
- **Канон (актуальный!):** `tsc` = **314** (`npx tsc --noEmit 2>&1 | grep -c "error TS"`); `vitest` = **763/763** (files 62/64, 2 legacy load-error). Любые «749» в старых доках — **СТАРЫЕ**.
- Cross-team: V007 (я, Windows) ⇄ M007 (ты / Mac-сторона). Фракции: **Ведра (Win) 2:0 Задроты (Mac)** — YouTube-шоу в фене, но код обязан компилироваться (314/763).

---

## 1. КОРРЕКЦИИ ТВОЕГО СНИМКА (ты сам это частично нашёл — подтверждаю)
- 🔴 **Красный фейдер — НЕ блокер, DONE.** GO дан (№18-BUS H3.4 GO). Живой прогон пользователя сейчас — это **TASK-015 (V-Mix стерео)**, а не фейдер. Фейдер по коду+тестам зелёный.
- **A2 (двойной writer chainA) — CLOSED.** `resyncV3` мёртвый код удалён, `coldSync` пишет effective→raw. Подтверждено буквально.
- **Тест-канон 749 → 763.** Фиксируй 763/763 и tsc 314 везде.
- **TASK-015 (V-Mix стерео)** — код применён (мак/Sonnet-агент), ждёт **браузер-ретеста пользователя** (вокал L / центр / мик R). Единственное, где нужен живой слух.

---

## 2. ПОЛНАЯ КАРТИНА — что сделано ПОСЛЕ базового пакета

### Character-AI цепь (Mac-дроп M007 + применил V007→Operator)
- **M3**: `AssistantProfile` тип + `ASSISTANT_PROFILES` (billy) в `src/js/ai/registry.ts`.
- **D3**: `src/js/ai/settings/ai-settings.store.ts` (`soundEnabled`) + guard в `CharacterSoundManager`.
- **Layer-2 notify**: `NOTIFY_CUE` + `playNotification()` + listener `team-m.report-arrived`.
- **G1**: событие ДО `checkForToolCalls` + try/catch (не гасить кью/аватар при ошибке тула).
- **G2**: gesture-unlock AudioContext в `CharacterSoundManager.init()` (Billy/Expert чаты раньше были mute).
- **F-2 G14**: `_micCompensationMs` в `MonitorRouter` (~43мс outputLatency компенсация самоконтроля).
- Всё применено через Operator, tsc 314/vitest 763, Frozen нетронут.
- **009** (verification) = **CONDITIONAL PASS**: нашёл G1/G2/G3 (Layer-2 dormant — нет диспетчера `team-m.report-arrived`) + **5 устаревших доков**.
- **002** (stress) = **CONDITIONAL GO** на M4: vanilla `ai-chat-ui` бьёт в мёртвый `/api/gateway/chat` (404).

### TASK-013.4 (сделано прямо сейчас)
- Убрал **двойную/тройную** публикацию `seek-position-changed`: прямые `publishSeek` из UI (TransportBar/WagonTrain/WaveformCanvas/useKeyboardShortcuts) дублировали `_onSeek` в `V3StatePublisher` (который и так публикует на каждый `transport.seek()`).
- Теперь единственный источник — `_onSeek`. Удалены висячие импорты `getStatePublisher`.
- Канон: 314/763, Frozen нетронут.

### Инструмент proj + html-projections
- Конвенция: самодостаточные `*.html` (inline css+js) класть в `html-projections/`. Плеер `tools/proj` копирует во временную папку Windows и **форсит Edge** (не VS Code). Дашборд миграции уже там: `html-projections/migration-dashboard.html`.
- Mac-сторона видит папку через монтаж — можешь класть свои проекции туда (самодостаточные!).

### Cross-team
- Мак-монтаж `~beLive-pc` отремонтирован; INBOX = 9 отчётов; синк жив.
- `team-m/FACTION-LINE.md` — Ведра 2:0 Задроты (шоу). Протокол (Frozen/§9/314/763) свят.

### Живой трекер
- `agent-registry/MIGRATION-WAR-ROOM.md` — единственный источник правды по статусам. Обновляю при каждом шаге.

---

## 3. КАРТА БЛОКОВ (что застряло и кто разблокирует)
| Узел | Блок | Кто |
|---|---|---|
| **D4 CoachPanel** | **Компонент `CoachPanel` вообще НЕТ в дереве** (только `registerInit`-инфра для event-init, не UI). Фича-билд → нужна спека M007 (data-driven чипы персонажей). Маунт в `App` (main.tsx:937) — вторичен. | M007 / Центр |
| **M4 unify chat** | vanilla путь → мёртвый `/api/gateway/chat` 404. Воскрешение фичи, не дедупликация. Решение gateway — архитектура. | Центр |
| **425 / G4 / M3-GO** | нужна спека макро-этапа | Центр |
| **MIC-УШИ-СЕССИЯ** | нужен бриф 006 (solo/vocal-fade/auto-pause/RTL) | 006 |
| **TASK-015** | браузер-ретест стерео (слух) | пользователь |

---

## 4. ВОПРОСЫ к тебе (важные узлы — проработай)
1. **GUARD «36 markers out of bounds»** — где в src, что триггерит, баг или ожидание? Атрибуируй.
2. **N3-β (останавливать ли авто-чейн)** — какое эталонное поведение V2? Рекомендация: стопать или нет.
3. **M4 gateway** — `/api/gateway/chat` реально мёртв или есть живой роут (Vite proxy `/api/...`)? Что показал stress-тест 002 про реальный путь чата? Какой минимальный unify не сломает live-chat?
4. **DOC-CHECK** — 009 нашёл 5 устаревших доков (`docs/architecture/avatar-visual-engine.md`, `docs/character-ai/RESEARCH-REPORT.md`, `docs/team-m-sync-proposal.md`, WAR-ROOM, 006-007-registry). Что в них теперь неправда после character-AI цепи + TASK-013.4? Предложи правки.
5. **D4 CoachPanel дизайн** — given `ASSISTANT_PROFILES` (billy) уже есть в `registry.ts`, предложи форму компонента (чипы по персонажам, какие действия). Маунт — НЕ через `registerInit` (не монтирует UI), а в `App` (main.tsx:937).
6. **Backlog решений №15-18** — можешь свести в sign-ready саммари из §1/§6, чтобы юзер подписал за одну сессию?

---

## 5. ЗАДАЧИ для тебя (конкретные, ныряй в §5/src)
- **T1 — GUARD-36**: grep `out of bounds` / `36 markers` в src, найди гвард, дай file:line, условие, severity, рекомендацию фикса. (Только анализ — не правь код.)
- **T2 — DOC-CHECK pass**: прочитай 5 доков, дифф против текущего src (character-AI цепь, TASK-013.4, красный фейдер), выдай список правок / patch-ready.
- **T3 — M4 gateway recon**: найди реальные endpoint'ы чата в src (`ai-chat-ui.ts` handleSend, `aiHub.sendMessage`, Vite proxy, любой `/api/gateway`), скажи реально ли 404 и какой живой путь. Выдай **аккуратный M4-план** (с 3 P0-фиксами 002) для 007 упаковать.
- **T4 — D4 CoachPanel spec**: спроектируй компонент (props, данные из `ASSISTANT_PROFILES`, точка маунта main.tsx:937). НЕ создавай файл (007 диспатчит через Operator) — только спецификацию/дизайн.
- **T5 — N3-β reference**: найди V2-поведение авто-чейна (стоп/не стоп), выдай рекомендацию.
- **T6 (опц.) — decisions backlog №15-18**: сведи в sign-ready док.

---

## 6. ФОРМАТ ОТВЕТА
Верни структурированный брифинг: **findings + рекомендации + открытые вопросы**. Ссылки `file:line` обязательны. Код не правь — только спеки/паки. Frozen — не трогай.
