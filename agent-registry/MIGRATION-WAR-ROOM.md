# 🎛️ MIGRATION WAR-ROOM · beLive V3 → M3-GO
> **Ведущий:** 007 (координатор/упаковщик) · **Дата старта:** 24.08.2026
> **Ветка:** `backup/win-V3-finish_2-2026-08-23` (= `V3-finish_2`@`3c2ef73` + мак-мост доки). Аудио-работа идентична V3-finish_2.
> **Канон:** tsc **314** (`grep -c "error TS"`), vitest **763/763** (files 62/64). ❄️ Frozen: AudioEngineV2/patchV1/bridges/track.orchestrator + `_`-поля.

---

## 📊 PHASE BOARD

### ✅ DONE (закрыто, proof-of-change есть)
| Код | Что | Как закрыто |
|---|---|---|
| №17 | Сага холда вида (9 слоёв 442→464) | юзер-ретест ✅ |
| №18-BUS + красный фейдер | music-bus мастер-фейдер | юзер ✅ |
| TASK-014 | 🎤-тумблер + самоконтроль | юзер слышит себя ✅ |
| TASK-015 | V-Mix стерео (вокал L / минус центр / мик R) + **V007-006** (фейдеры post-fader) + **V007-008/TASK-015b** (мик ТОЛЬКО RIGHT — граф-гейт `_vmixMicGate`, иммунен к 🎤-тумблеру; отменяет неверный V007-007) | ✅ DONE (юзер-ретест: мик RIGHT, вокал L, музыка центр) |
| M3 (char-AI) | `AssistantProfile` тип + `ASSISTANT_PROFILES` (data-driven, Билли) | код (V007→Operator), tsc 314/vitest 763 ✅ |
| D3 (char-AI) | `soundEnabled` настройка (стор + guard в CharacterSoundManager) | код, tsc 314/vitest 763 ✅ |
| Layer-2 (char-AI) | notification cue `NOTIFY_CUE` + `playNotification()` + listener `team-m.report-arrived` | код (поправка M007: `setState`→`playNotification`), tsc 314 ✅ |
| G1 (char-AI fix) | event ДО `checkForToolCalls` + try/catch (не гасить кью/аватар при ошибке тула) | код (V007→Operator), tsc 314 ✅ |
| G2 (char-AI fix) | gesture-unlock AudioContext (Billy/Expert чаты раньше были mute) | код, tsc 314 ✅ |
| F-2 G14 | компенсация latency самоконтроля (~43мс) `_micCompensationMs` в MonitorRouter (setMicMonitor/setDelayMs/setCompensateTarget) | код, tsc 314/vitest 763 ✅ |
| A2 | двойной writer ликвидирован | код |
| TASK-001…009 | исследования 006 + VERIFY-PASS 007 | 006 OUTBOX + мои сверки |
| TASK-004 DRIFT | resolved-by-440 (440-MICRO-PACK) | юзер ✅ |
| TASK-009 | зелёный best сразу при записи (441) | юзер ✅ |
| TASK-013.4 | cleanup дублей `publishSeek` (double/triple `seek-position-changed` → единственный источник `_onSeek`) | код (V007→Operator), tsc 314/vitest 763 ✅ |
| V007-006 (TASK-015 fix) | V-Mix фейдеры музыки+вокала были **мёртвы**: `vmixCenterIn` питался от пустого orchestrator, `vmixVocalIn` — pre-fader. Кормим V-Mix-входы **post-fader** `stretchGain` из `HybridPipelineService` (`setVMixCenterTarget/setVMixVocalTarget`, переподключение в `play()`), убрали pre-fader double-feed в `MonitorRouter`. | код (V007→Operator), tsc 314/vitest 763 ✅ |
| V007-007 (TASK-015 mic-right) ⚠️ SUPERSEDED by V007-008 | Первая попытка: `setVMix(true)→setMicMonitor(false)`. Отвергнута цепью 001/002/009 — 🎤-тумблер (ControlDeck:410) перекрывает глушение. Заменено на граф-гейт TASK-015b. | — |
| V007-008 (TASK-015b mic-gate) | Цепь 001→002→009→Operator. Сериальный гейт `_vmixMicGate` ПОСЛЕ `_monitorGain` глушит мик-монитор на уровне графа при V-Mix (мик = только RIGHT через V-Mix-мастер). Иммунен к 🎤 UI, не трогает муз. монитор `_musicGain`, авто-восстанавливает 🎤 при V-Mix OFF. Отменяет V007-007. | код (цепь→Operator), tsc 314/vitest 763 ✅ |
| M4 unify (V007-009) | vanilla `AIChatUI.handleSend` → `aiHub.sendMessage` (живой бэкенд `/v1/chat/stream` через GatewayProvider уже есть — воскрешение фичи, не новый бэкенд). Цепь recon→002(finalize+stress)→009(verify+doc)→Operator. Удалён `streamOpenAI` (R1), `abortController`→`wasAborted`+`stopAllProviders`, ошибки через `onError`, once-guard `completionHandled` в `registry.onDone` (закрывает двойной onDone GatewayProvider → двойной playCue/tool). Удалён мёртвый `mapError`. | код (цепь→Operator), tsc 314/vitest 763 ✅ |

### 🟡 IN-FLIGHT — пусто (всё закрыто)
- ~~TASK-015 браузер-ретест — ✅ DONE (юзер подтвердил: мик RIGHT / вокал L / музыка центр).~~
- Ждём: твои INTAKE-настройки ИЛИ спеку Центра (425 / MIC-УШИ / M3-GO).

### 🟢 QUEUED (готовлю паки / ждут спеку)
| Код | Что | Статус | Кто спеку |
|---|---|---|---|
| MIC-УШИ-СЕССИЯ | solo-preview, vocal-fade, auto-pause, RTL-голос | нужен брифинг 006/Центр | 006 |
| M4 unify (аккуратный пак) | ✅ DONE (V007-009) — см. DONE выше | — | — |
| D4 CoachPanel | **компонент `CoachPanel` в дереве НЕ СУЩЕСТВУЕТ** (только `registerInit`-инфра) → фича-билд, нужна спека M007 (чипы персонажей). Маунт в App (main.tsx:937) — вторичен | ⛔ БЛОК: нет компонента/спеки | M007/Центр |
| 425 (+G4) | следующий макро-этап | **НУЖНА СПЕКА Центра/006** | Центр |
| M3-GO | финал миграции | блокируется 425 | Центр |

### 🔴 BLOCKED / NEEDS DECISION
- **425 + G4 + M3-GO** — ждут архитектурного брифинга (это зона Центра, не 007).
- **push/деплой** — 🔒 только по команде (scoped-override: бэкап-ветка).

---

## 🧭 МИГРАЦИОННЫЙ ХРЕБЕТ (к M3-GO)
```
[DONE №17/№18/TASK-014/015/A2/TASK-001..009]
        ↓
[F-2 G14: компенсация самоконтроля]  ← DONE ✅
        ↓
[MIC-УШИ-СЕССИЯ: solo/vocal-fade/auto-pause/RTL]  ← ждёт бриф 006
        ↓
[425 + G4]  ← СПЕКА ЦЕНТРА
        ↓
[M3-GO]  ← финал
```

---

## 📥 INTAKE — «куча других настроек» (бросай сюда!)
> Правило: кидай любые хотелки/баги/идеи — я их **стэкаю, классифицирую, ставлю в очередь**, ничего не теряется. Формат свободный, но полезно: `[тип] описание`.
> Типы: `BUG` / `FEATURE` / `UX` / `AUDIO` / `CONFIG` / `QUESTION`.

| # | От юзера | Тип | Статус |
|---|---|---|---|
| (ждём твои) | — | — | — |

---

## 🔗 CROSS-TEAM SYNC (V007 ⇄ M007)
> **M007** = Mac-side 007 (ведёт проект-007 на Маке: фронтенд/дизайн/character-AI/аватар/звук). **V007** (я) контролирует миграцию на Венде + координацию.
- **Канал:** Мак дропает отчёты в `team-m/reports/<agent>/<task>.md` (фронтматтер agent/task/status/updated) → `mac-state.sh` обновляет `team-m/INBOX.md` → V007 читает через монтаж.
- **Брифинг M007:** `team-m/BRIEFING-V007-TO-M007.md` (онбординг, Frozen-Zone, §9 single-writer, синхрон-протокол).
- **Правило записи:** М007 пишет `[@PROPOSAL]`/отчёты, НЕ правит `src/` напрямую (код применяет Оператор по dispatch V007). Исключение: текущий character-ai дроп Мака принят (компилируется, не-frozen) — V007 верифицирует (009) и стейкает.
- **Статус Мака (M1, 007-vinda):** ✅ tsc 314 / vitest 763 / PARITY PASS / оба билда (v2+v3) PASS / Frozen нетронут. См. `team-m/reports/007-vinda/m1-verification.md`.

### 🟢 QUEUED (параллельный трек — Мак-сторона)
| Код | Что | Ведёт | Статус |
|---|---|---|---|
| Character-AI / Core | CharacterSoundManager + аватар/AI (`ASSISTANT_RESPONSE_COMPLETED`), research E1–E8 | M007 | ✅ дроп в дереве, tsc 314/vitest 763. M3/D3/Layer-2 ПРИМЕНЕНЫ (V007→Operator). M1=M007:REWORK(ПК-инфра) |
| M2 landing (avatar CSS/скелеты) | data-state биндинг, avatar.css, assets, UX-MAP | M007 | 🟡 HOLD: (1) ждёт GPT A–E; (2) ⚠️ M007 ошибся: `celebrateUntil` в `avatar.store` НЕТ → биндить к существующему `setState`/data-state |
| D4 CoachPanel | новый UI-панель чипов персонажей через `registerInit` | M007 | 🟡 QUEUED: нужен recon паттерна маунта UI-панелей (не диспатчил — избегаю слепого guess) |
| M4 unify | `AIChatUI.handleSend` → `aiHub.sendMessage` (убрать `streamOpenAI`, закрыть R1) | V007 (Windows) | ✅ DONE (V007-009): клиент-сайд пак применён, tsc 314/vitest 763. Mac-side роль — только verify на Mac-сборке |

---

## ⚠️ RISK REGISTER
- **R-proc (TASK-015):** код применён не через мой dispatch (мак/Sonnet-агент) → нарушение §7/§9. Код верифицирован, FROZEN-OK, канон зелёный. Записано в леджер доп34. *Action:* напомнить команде про single-writer при будущих правках.
- **R-branch:** работаем на `backup/win-*`; `V3-finish_2` чистый на `3c2ef73`. Merge не нужен (аудио идентично). Push бэкап-ветки — только по scoped-override.
  - **R-spec-425:** 425/G4/M3-GO без спеки Центра = не начинаем (это архитектура, не моя зона).
  - **R-doc (009):** найдено 5 устаревших доков (docs/architecture/avatar-visual-engine.md, docs/character-ai/RESEARCH-REPORT.md, docs/team-m-sync-proposal.md + WAR-ROOM/006-007-registry) — нужен DOC-CHECK пасс (V007).
  - **R-m4 (002):** RESOLVED — vanilla ai-chat-ui бил в несуществующий `/api/gateway/chat` (404); M4 (V007-009) перенаправил на живой `aiHub.sendMessage` (GatewayProvider `/v1/chat/stream`). 3 P0-риска закрыты (stopAllProviders, onError, once-guard). tsc 314/vitest 763 ✅
  - **R-d4 (3-я ошибка M007):** `registerInit` НЕ монтирует UI — D4 надо рендерить в App, не через registerInit.

---

## ▶️ NEXT ACTIONS (сегодня)
1. **ТЫ:** браузер-ретест TASK-015 + **проверь фикс V007-006** (фейдеры музыки/вокала в V-Mix теперь живые). Подтвердишь → закрываю TASK-015.
2. **Я:** TASK-013.4 DONE ✅ (дубли `publishSeek` убраны, tsc 314/vitest 763) · V007-006 DONE ✅ (V-Mix фейдеры применены, tsc 314/vitest 763).
3. **Я:** ✅ M4 (V007-009) DONE — пак применён (tsc 314/vitest 763). D4 (CoachPanel в App) — БЛОК (нет компонента, нужна спека M007).
4. **ТЫ:** кидай сюда свои «куча настроек» в INTAKE → я их распакую в очередь.
5. **ЦЕНТР/006:** брифинг MIC-УШИ-СЕССИИ и спека 425+G4+M3-GO.
6. **proj-конвейер:** `html-projections/` + `tools/proj` (форсит браузер, не VS Code). Коммит в backup-ветку — по твоей команде.

---

## CROSS-TEAM STATUS UPDATE (24.08 - после 009/002/explore)
> Перекрывает таблицу "QUEUED (Мак-сторона)" выше: строки M4/D4 частично устарели.

| Код | Статус (актуально) |
|---|---|
| Character-AI / Core | M3/D3/Layer-2 + G1/G2/G14 (V007-фиксы) ПРИМЕНЕНЫ (tsc 314/vitest 763). 009: CONDITIONAL PASS |
| M2 landing | HOLD: GPT A-E + celebrateUntil в avatar.store НЕТ |
| D4 CoachPanel | ⛔ БЛОК: компонент `CoachPanel` отсутствует в дереве (3-я ошибка M007: registerInit не монтирует UI, но и самого компонента нет) → нужна спека M007 (data-driven чипы персонажей). Маунт в App (main.tsx:937) — после создания |
| M4 unify | ✅ DONE (V007-009): vanilla → `aiHub.sendMessage`, живой бэкенд подтверждён (GatewayProvider `/v1/chat/stream`). R1 + 3 P0-риска закрыты. tsc 314/vitest 763 |
| G3 / Layer-2 | DORMANT: нет диспетчера team-m.report-arrived (ждём Mac bridge) |

---
*Документ живой — 007 обновляет при каждом шаге. War Room активен.* 🫡
