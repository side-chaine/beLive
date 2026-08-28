# 🛰️ ROADMAP REPORT → SONNET (Mac M007 lead)

> **От:** 007 (Windows V007, координатор аудио-миграции) · **Кому:** Sonnet / M007 (Mac-сторона)
> **Дата:** 25.08.2026 · **Ветка:** `backup/win-V3-finish_2-2026-08-23` (аудио-работа идентична `V3-finish_2`)
> **Канон:** tsc **314** · vitest **763/763** · ❄️ Frozen: `AudioEngineV2`/`patchV1`/`bridges`/`track.orchestrator` + `_`-поля.

---

## 📍 ГДЕ МЫ СЕЙЧАС (phase board — Windows V007)

### ✅ DONE (закрыто, proof-of-change есть)
- **№17** Сага холда вида (9 слоёв 442→464) — юзер-ретест ✅
- **№18-BUS + красный фейдер** (music-bus мастер) — юзер ✅
- **TASK-014** 🎤-тумблер + самоконтроль — юзер слышит себя ✅
- **TASK-015** V-Mix стерео (вокал L / музыка центр / **мик R**):
  - **V007-006** — фейдеры музыки/вокала post-fader (были мертвы: `vmixCenterIn` от пустого orchestrator, `vmixVocalIn` pre-fader).
  - **V007-008 / TASK-015b** — мик ТОЛЬКО RIGHT через **граф-гейт** `_vmixMicGate` (цепь 001→002→009→Operator). Иммунен к 🎤-тумблеру, не трогает муз. монитор, авто-восстанавливает 🎤 при V-Mix OFF. **Юзер подтвердил: кайф, мик справа.**
- **A2** двойной writer ликвидирован · **TASK-001…009** (исследования 006 + VERIFY-PASS 007)
- **TASK-004 DRIFT** (440) · **TASK-009** (зелёный best сразу) · **TASK-013.4** (cleanup дублей `publishSeek`)
- **Character-AI цепь (M3/D3/Layer-2 + G1/G2/F-2 G14):** применена (V007→Operator), tsc 314/vitest 763, 009 CONDITIONAL PASS.
- **M4 unify (V007-009):** vanilla `AIChatUI.handleSend` → `aiHub.sendMessage` (живой бэкенд `/v1/chat/stream` через `GatewayProvider` уже есть). Удалён `streamOpenAI` (R1), `abortController`→`wasAborted`+`stopAllProviders`, ошибки через `onError`, once-guard `completionHandled` в `registry.onDone` (закрывает двойной onDone GatewayProvider → двойной playCue/tool). Удалён мёртвый `mapError`. tsc 314/vitest 763.

### 🟢 КАНОН ДЕРЖИТСЯ
`tsc` ровно **314**, `vitest` **763/763** после ВСЕХ правок. Frozen-зоны нетронуты.

---

## 🧭 ЧТО ВПЕРЕДИ (queue — нужно решение/спека)

| Код | Что | Статус | Кто спеку/ведёт |
|---|---|---|---|
| **M4 unify** | `AIChatUI.handleSend` → `aiHub.sendMessage` (убрать `streamOpenAI`, закрыть R1). Recon подтвердил: живой бэкенд `/v1/chat/stream` через `GatewayProvider` УЖЕ есть — это воскрешение фичи, не новый бэкенд. 3 P0-риска (002) закрыты. | ✅ DONE (V007-009): клиент-сайд пак применён, tsc 314/vitest 763 | V007 (Windows) |
| **D4 CoachPanel** | UI-панель чипов персонажей через `registerInit` | 🔴 БЛОК: компонент `CoachPanel` отсутствует в дереве (3-я ошибка M007: registerInit не монтирует UI) | **M007 (Mac)** — билд компонента + маунт в App |
| **G3 / Layer-2** | диспетчер `team-m.report-arrived` (cross-team bridge) | 💤 DORMANT — нет Mac-side моста | **M007 (Mac)** |
| **MIC-УШИ-СЕССИЯ** | solo-preview, vocal-fade, auto-pause, RTL-голос | нужен брифинг 006/Центр | 006 |
| **425 + G4 + M3-GO** | следующий макро-этап + финал миграции | 🔴 НУЖНА СПЕКА Центра/006 (это архитектура, не зона 007) | Центр |

---

## 🤝 CROSS-TEAM: что Mac-стороне (Sonnet/M007) забирать СЕЙЧАС
Полный список задач — `team-m/TASKS-V007-TO-M007.md`. Кратко, приоритеты:
1. **M2 landing** (avatar CSS/скелеты) — **UNBLOCK**: `celebrateUntil` в `avatar.store` НЕТ → биндить к существующему `setState`/data-state. GPT A–E ещё нужны для контента.
2. **D4 CoachPanel** — построить компонент + data-driven чипы персонажей + маунт в `App.tsx` (~main.tsx:937).
3. **G3 / Layer-2** — поднять диспетчер `team-m.report-arrived`, чтобы cross-team синк работал.
4. **character-AI visual verify** — чекнуть аватар/звук в браузере на Маке.
5. **M1 parity recheck** — подтвердить PARITY PASS на Mac-сборке.

---

## ❓ OPEN QUESTIONS к Sonnet (из предыдущего брифинга T1–T6)
- **GUARD-36** статус (vocal-hall guard при V-Mix) — подтверждён ли живым?
- **M4 gateway** — ✅ RESOLVED: recon показал живой путь `aiHub.sendMessage` → `GatewayProvider` (`${gatewayUrl}/v1/chat/stream`, gatewayUrl=VITE_GATEWAY_URL||localhost:8787). Мёртвый `/api/gateway/chat` удалён в V007-009. Новый бэкенд НЕ нужен.
- **DOC-CHECK** — 5 устаревших доков (009 нашёл): `docs/architecture/avatar-visual-engine.md`, `docs/character-ai/RESEARCH-REPORT.md`, `docs/team-m-sync-proposal.md` + WAR-ROOM/006-007-registry. Нужен пасс.
- **N3-β** (наблюдения из серии) — актуально ли ещё?
- **backlog №15–18** — что из этого ещё в силе?

---

## ⚠️ НАПОМИНАНИЕ (Frozen / §9 / канон)
- Любая правка `src/` идёт через V007-диспатч Operator'у (§9 single-writer). М007 пишет брифинги/отчёты, не правит `src/` напрямую.
- Канон 314/763 — любой пак обязан его держать.
- Frozen-зоны святы.

*Документ живой — 007 обновляет при каждом шаге.* 🫡
