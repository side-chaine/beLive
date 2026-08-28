---
agent: 007-vinda (Hub)
task: uncommitted-tails
status: delivered
updated: 2026-08-28
---

# 🧾 НЕЗАКОММИЧЕННЫЕ ХВОСТЫ · Что в рабочем дереве, чьё оно и что с ним делать

> Разведка: 007_Винда (git diff/log/ls, read-only, 28.08). Ветка `backup/win-V3-finish_2-2026-08-23`, +122 коммита до origin, push 🔒.
> Вывод: **всё незакоммиченное — легитимная работа 25-26.08, помеченная DONE в REGISTRY, но не доехавшая до коммита** по правилу Босса («остальной src/ миграции — по-прежнему некоммичен по правилу Босса», REGISTRY 25.08). Ничего подозрительного, ничего чужого.

---

## §1. SRC-ПРАВКИ (3 файла) — M4 unify + Character-AI M3

### 1.1 `src/js/ai/registry.ts` (+46 строк)
Два слоя работы, оба DONE по REGISTRY §2:
- **M4 unify (V007-009):** константа `ASSISTANT_RESPONSE_COMPLETED = 'assistant.response.completed'` + wrapped `onDone` с once-guard `completionHandled` в `AIHub.sendMessage` — единый контракт завершения для ВСЕХ провайдерских стримов. (REGISTRY: «M4 unify — ai-chat-ui.ts → aiHub.sendMessage, живой backend /v1/chat/stream, once-guard completionHandled. tsc 314 / vitest 763».)
- **Character-AI M3 (профили):** `AssistantProfile` interface + `ASSISTANT_PROFILES` (пока только `billy` с SoundCue-литералом) + `getProfileSound()`. TODO(M007/Mac, GPT A–E): English / Vocal Coach / Hero. Литерал вместо импорта CUE_DEFAULT — сознательный обход runtime-цикла registry↔CharacterSoundManager (закомментирован в коде).
- ⚠️ Нюанс: ратификация Волны-1 (REGISTRY, письмо k) гласила «getProfileSound = локальная ф-я в CoachPanel.tsx (registry.ts не трогать)» — фактически функция осела в registry.ts. Это дрейф решения, не баг кода (компилируется, канон не ломает); зафиксировать в REGISTRY при коммите.

### 1.2 `src/js/utils/stream-openai.ts` (DELETED, −39)
M4 unify: удалён мёртвый OpenAI-стример (заменён живым `/v1/chat/stream` через gateway). Совпадает с REGISTRY §2 DONE.

### 1.3 `src/js/ai/settings/ai-settings.store.ts` (UNTRACKED, новый)
Store настроек AI (связан с `AiSettingsModal.tsx`). Происхождение: INTAKE-настройки юзера / AI-config поток. В REGISTRY явно не отмечен — **кандидат на строку в реестр** при коммите.

**Канон с этими правками:** tsc=306 / vitest=767+5int+2load / PARITY PASS (замер 28.08 — правки в дереве, канон GREEN вместе с ними).

## §2. PACKAGE.JSON (+1) — G1-гейт преbuild-хук

```json
"prebuild": "mkdir -p public/team-m && cp -f team-m/INBOX.md public/team-m/INBOX.md"
```
Это закрытие гейта G1 (REGISTRY 25.08: «G1: mac-state.sh синк в public/team-m (Мак) + prebuild-хук в package.json (Hub)»). Артефакт хука уже в дереве: `public/team-m/INBOX.md` (untracked, генерируется).

## §3. DOCS-ПРАВКИ (3 файла) — координация и статусы

| Файл | Что | Легитимность |
|---|---|---|
| `docs/INDEX.md` (+10) | Секция «Mac↔PC Coordination» (REGISTRY/SYNC/INBOX навигация) | ✅ Hub-координация, 25.08 |
| `docs/PLAN-v3.3-CANONICAL.md` (+2/−1) | M3 ⬜→✅ (flip 2395c1e7, W1/W2 done) + лог-строка 26.08 (канон пост-flip 306/767+5+2, конвергенция Соннет+Ц3 по порядку W3→W4→W5) | ✅ по правилу самого PLAN: «Изменения дальше — только записью сюда» |
| `docs/governance/agent-governance-map.md` (+2) | Пометка 🗄️ HISTORICAL — не канон | ✅ REGISTRY §4: «HISTORICAL (помечено 2026-08-25)» |

## §4. TEAM-M ЧИСТКА (56 файлов, −1475 строк) — АРХИВАЦИЯ, не удаление

Все «deleted:» в git status = **перенос в `team-m/archive/`** (untracked): SYNC-письма 25.08 (ah/ai/aj/al/h/m/aa/ab/ae/af/ag/ah/ai/ak/c/e/f/g/i/j/n/o/q/r/x/y + MAC-серия), AUDIT-mac, B-SLICE-AUDIT, E1-PREDICATE-INVENTORY, FORWARD-HORIZON, GTRACK-SPEC, HANDOFF-MAC-007, M3-GO-VERIFY-PLAN, MIC-SESSION-METHODOLOGY, ROADMAP-FULL-LIGHT.
Модификации WAVE3/4/5 паков + WAVE-EXEC-PLAYBOOK + WAVE-FROZEN-INVARIANTS + WAVE-HANDOFF-INDEX + REGISTRY = doc-reconcile после финализации волн цепью (26h). Отчёты mac-007 (run1-4, roadmap-master, recon-d4-g3, glm-qwen-prompt) — правки Мака через sshfs.

## §5. UNTRACKED (новое, никогда не коммитилось)

| Путь | Что | Откуда |
|---|---|---|
| `agent-registry/` (8 новых) | PROPOSAL-паки 006 (015-A/B/C ORCH/ROUTER/CONTROLDECK, FEEDBOT), RECON-FEEDBOT, MICRO-PACK-V007-006..009, MIGRATION-WAR-ROOM | War Room 006/Ц3, 25.08 |
| `team-m/` (40+ новых) | MICRO-PACK'и (A1A2/B-SLICE/B1/BAC108/PC-*/R1/WAVE1-5/V007-*), PARITY-LEDGER, WAVE-доки, SYNC 26.08, BRIEFING'и, SHOW-pilot, SUBAGENT-SETUP, FACTION-LINE, archive/, scripts/mac-report.sh, sshfs-watchdog.sh | Вся координация 25-26.08 |
| `team-m/reports/007-vinda/` | Отчёты Вёдры (n3b-chain + **4 отчёта этой ночи**) | Hub |
| `html-projections/` | 5 проекций + README + `tools/proj` (скрипт доставки на Desktop) | 007/Мак, 26.08 |
| `public/audio/` | Mac-часть аудио-ассетов | Мак |
| `src/js/ai/settings/` | ai-settings.store.ts (§1.3) | см. выше |
| `docs/team-m-setup-prompt.md`, `docs/team-m-sync-proposal.md` | Доки team-m процесса | 25.08 |
| `._.DS_Store`, `.DS_Store` | macOS-мусор от sshfs-монтажа Мака | 🗑 в .gitignore, не коммитить |

## §6. ВЫВОД И РЕКОМЕНДАЦИЯ

1. **Всё незакоммиченное — известное, атрибутировано, канон не ломает.** Диверсий/чужих правок нет. Frozen-файлы не тронуты (git diff по frozen = пусто, frozen-guard GREEN).
2. **Это и есть «грязная база»** из REGISTRY (25.08): Operator-поезд волн W3→W4→W5 требует чистого закоммиченного базиса → **нужен один baseline-коммит хвостов** (src M4+Character-AI + docs + team-m + agent-registry) ДО старта волн.
3. **Перед коммитом** (на решение Босса): (а) `.DS_Store`-мусор — в .gitignore; (б) `public/team-m/INBOX.md` — решить: коммитить артефакт хука или gitignore (генерируется prebuild'ом); (в) строка в REGISTRY про getProfileSound-дрейф (§1.1) и ai-settings.store (§1.3).
4. **Коммит = только по GO Босса** (push🔒; scoped-override ветка).

---

*git diff/log/ls 28.08. Ничего не изменено. 🧾*
