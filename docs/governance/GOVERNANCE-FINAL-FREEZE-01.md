# 🏛️ GOVERNANCE FINAL FREEZE v1.0
## beLive Agent System — June 2026 Baseline

**Версия:** 1.0  
**Дата:** 2026-06-15  
**Автор:** 001 (CEO co-architect)  
**Статус:** ✅ FREEZE RECOMMENDATION  
**Действие:** Принять как July-safe governance baseline  
**Система:** Side_chaine_Vibe_Code (S-VC 1.2)

---

## СОДЕРЖАНИЕ

0. [Shared Context Layer (S-VC 1.2)](#0-shared-context-layer-s-vc-12)
1. [Final Role Architecture](#1-final-role-architecture)
2. [Source of Truth Map](#2-source-of-truth-map)
3. [Protocol Separation](#3-protocol-separation)
4. [CEO Vault Partition](#4-ceo-vault-partition)
5. [007 ↔ Operator Control Contract](#5-007--operator-control-contract)
6. [009 Independent Verification Contract](#6-009-independent-verification-contract)
7. [DOC-AWARE DEVELOPMENT Final DoD](#7-doc-aware-development-final-dod)
8. [Ownership / Keeper / Escalation Model](#8-ownership--keeper--escalation-model)
9. [Final Cleanup Rules](#9-final-cleanup-rules)
10. [Final Canonical Architecture](#10-final-canonical-architecture)
11. [Exact File Action Plan](#11-exact-file-action-plan)
12. [Risks Register](#12-risks-register)
13. [Freeze Recommendation](#13-freeze-recommendation)
14. [S-VC 1.2 Declaration](#14-s-vc-12-declaration)
15. [S-VC Maintenance Cycle](#15-s-vc-maintenance-cycle)

---

# 0. SHARED CONTEXT LAYER (S-VC 1.2)

## 0.1 Formal Declaration

`000-FULL-BASE.md` is the **Shared Context Layer** of the beLive project.

This is a foundational governance principle:

> **FULL-BASE is shared memory. It belongs to no single role. All roles read from it. No single role owns it.**

### 0.2 Who Reads It

| Роль | Зачем |
|------|-------|
| **001** | CEO co-architect — аудиты, freeze, координация |
| **002** | Stress-test specialist — контекст для сомнений и атак |
| **007** | Main agent — упаковка, DOC-CHECK, синхронизация |
| **009** | Independent verifier — drift detection, audit |
| **Центр** | Architect — архитектурные решения на основе контекста |

### 0.3 What FULL-BASE Is NOT

| Это НЕ | Это |
|--------|-----|
| ❌ Ownership-документ одной роли | ✅ Shared context — все роли читают |
| ❌ Authority для решений | ✅ Контекст для информированных решений |
| ❌ Замена protocol-v3.0.md | ✅ protocol-v3.0.md — агентский протокол |
| ❌ Замена registry | ✅ MASTER-SYNC-REGISTRY.yaml — source of truth |
| ❌ Замена charters | ✅ charter-*.md — ролевые определения |
| ❌ Замена DOC-CHECK | ✅ DOC-CHECK — процесс верификации |

### 0.4 Post-Session Maintenance

After any significant session:
1. **007** updates `000-FULL-BASE.md` — affected sections
2. **007** updates `MASTER-SYNC-REGISTRY.yaml` — health score
3. **007** updates `_007-state.md` — session log
4. **009** verifies drift at next VERDICT

This is **maintenance of shared memory**, not ownership by a single role.

---

# 1. FINAL ROLE ARCHITECTURE

## 1.1 Role Table

| Роль | Тип | Инстанс | Модель | Создан? |
|------|-----|---------|--------|---------|
| **001** | CEO co-architect | Сессия (manual) | Любая (по задаче) | ❌ Нет agent file |
| **002** | Stress-test specialist | Subagent 007 | Default | ❌ Нет agent file |
| **007** | Main agent, packer | Первый | Default (тяжёлая) | ✅ `.opencode/agent/007.md` |
| **009** | Independent verifier | Третий | Default | ✅ `.opencode/agent/009.md` |
| **Operator** | Blind executor | Второй (subagent) | Наследует от 007 | ✅ `.opencode/agent/operator.md` |
| **Центр** | On-demand architect | Отдельный (chat.z.ai) | Тяжёлая (GLM/Sonnet) | ❌ Вне OpenCode |

---

## 1.2 001 — CEO Co-Architect

| Аспект | Детали |
|--------|--------|
| **Responsibility** | Системные аудиты, финальные решения, консолидация governance, утверждение протоколов |
| **Что читает** | Весь стек: charters, packs, registry, governance docs, architecture docs |
| **Что пишет** | Governance docs, partition maps, freeze reports, protocol decisions |
| **Что НЕ делает** | Не пишет код, не создаёт TC, не запускает Operator |
| **Когда включается** | Старт новой фазы, конфликт 007↔009, frozen override без Центра, governance freeze |
| **Эскалация** | → Никита (если нужно human decision) |
| **Agent file** | ✅ РЕКОМЕНДУЕТСЯ СОЗДАТЬ — `.opencode/agent/001.md` (read-only режим с доступом ко всем docs) |
| **Permission model** | `read: allow` на всё; `edit: deny` на `src/`; `task: allow` (для запуска subagents); `bash: deny` |

---

## 1.3 002 — Stress-Test Specialist

| Аспект | Детали |
|--------|--------|
| **Responsibility** | Сомневаться во всём. Атаковать решения, искать дыры, проверять логику, находить confirmation bias |
| **Что читает** | MACRO-PACK + TC + diff от 007 |
| **Что пишет** | STRESS-REPORT: контраргументы, найденные проблемы, риски |
| **Что НЕ делает** | Не пишет код, не принимает решений, не делает DOC-CHECK |
| **Когда включается** | После крупного TC, перед frozen override, перед релизом |
| **Эскалация** | → 001 / Центр |
| **Agent file** | ✅ РЕКОМЕНДУЕТСЯ СОЗДАТЬ — `.opencode/agent/002.md` (read-only, режим сомнения) |
| **Trigger** | 007 вызывает `task(subagent_type="002")` когда задача高风险 или frozen override |

---

## 1.4 007 — Main Agent

| Аспект | Детали |
|--------|--------|
| **Responsibility** | Разведка, MACRO-PACK, MICRO-PACK, запуск Operator, верификация, DOC-CHECK first pass, registry update, CEO Vault sync |
| **Что читает** | charters → packs → ref docs → код проекта |
| **Что пишет** | context packs, MICRO-PACKs, registry updates, DOC-TC |
| **Что НЕ делает** | Не пишет код, не принимает архитектурных решений |
| **Контроль Operator** | Frontmatter permissions + subagent inheritance + MICRO-PACK изоляция + post-verify |
| **Эскалация** | → Центр (frozen override) → 001 (конфликт с 009) |
| **Agent file** | ✅ `.opencode/agent/007.md` |
| **DOC-CHECK owner** | First pass |

---

## 1.5 009 — Independent Verifier

| Аспект | Детали |
|--------|--------|
| **Responsibility** | Runtime audit, DOC-CHECK second pass, registry validation, FULL-BASE drift, random audit, VERDICT |
| **Что читает** | Код, docs, registry, diff — **НЕ читает отчёт 007** при random audit |
| **Что пишет** | VERDICT, audit trail, FULL-BASE-TC |
| **Что НЕ делает** | Не пишет код, не предлагает фиксы, не участвует в разработке |
| **Когда вызывается** | После DOC-CHECK 007, после каждых 10 TC (random audit) |
| **Блокировка** | Имеет право заблокировать COMPLETE если DOC-CHECK или Registry validation FAIL |
| **Agent file** | ✅ `.opencode/agent/009.md` |

---

## 1.6 Operator — Blind Executor

| Аспект | Детали |
|--------|--------|
| **Responsibility** | Cold verification, apply TC, tsc, vitest, report |
| **Что читает** | ТОЛЬКО MICRO-PACK (не видит MACRO-PACK) |
| **Что пишет** | Только код по TC (edit: allow) |
| **Что НЕ делает** | Не принимает решений, не импровизирует, не читает docs |
| **Ограничения** | max 2 файла, error = stop, no refactor |
| **Создаётся** | 007 через `task(subagent_type="operator")` |
| **Agent file** | ✅ `.opencode/agent/operator.md` |

---

## 1.7 Центр — On-Demand Architect

| Аспект | Детали |
|--------|--------|
| **Responsibility** | Архитектурные решения, TC roadmap, frozen override |
| **Что читает** | MACRO-PACK от 007 + FULL-BASE |
| **Что пишет** | TC roadmap, архитектурные решения |
| **Когда включается** | Только при frozen override или спорных решениях |
| **Инстанс** | Отдельный чат (chat.z.ai), не в OpenCode |
| **Контекст** | Получает MACRO-PACK от Никиты |

---

# 2. SOURCE OF TRUTH MAP

## 2.1 Layer Classification

| Layer | Определение |
|-------|-------------|
| **Canonical** | Единственный источник истины. Изменения = изменение системы. |
| **Reference** | Ссылается на canonical, не дублирует. Может кешировать для удобства. |
| **Runtime** | Читается агентами в работе. Временный контекст сессии. |
| **Creative/Private** | Не участвует в governance. Личное пространство идей. |
| **Archive** | Исторический слой. Не читается, не меняется. |

---

## 2.2 Final Truth Map

| Ресурс | Слой | Статус | Канонический источник | Риск если stale |
|--------|------|--------|----------------------|-----------------|
| **AGENTS.md (global)** | Canonical | ✅ Active | `~/.config/opencode/AGENTS.md` | 🟡 Средний — Context7 сломается |
| **AGENTS.md (project)** | Canonical | ✅ Active | `~/Documents/BeLive/AGENTS.md` | 🟡 Средний — 007 не узнает что читать |
| **`.opencode/agent/*.md` frontmatter** | Canonical | ✅ Active | `.opencode/agent/<name>.md` | 🔴 Высокий — permissions перестанут работать |
| **`.opencode/agent/*.md` body** | Canonical | ✅ Active | `.opencode/agent/<name>.md` | 🟡 Средний — агент не получит инструкции |
| **charter-007.md** | Canonical | ✅ Active | `~/Desktop/Belive-Agents/007/charter-007.md` | 🔴 Высокий — frozen zones устареют |
| **charter-009.md** | Canonical | ✅ Active | `~/Desktop/Belive-Agents/009/charter-009-diagnostik.md` | 🟡 Средний — 009 будет делать не то |
| **charter-operator.md** | Canonical | ✅ Active | `~/Desktop/Belive-Agents/operator/charter-operator.md` | 🟡 Средний — Operator нарушит протокол |
| **protocol-v3.0.md (agent gov)** | Canonical | ✅ Active | `~/Desktop/Belive-Agents/system/protocol-v3.0.md` | 🔴 Высокий — workflow сломается |
| **product-protocol-v2.1.md** | Canonical | ✅ Active | `~/Documents/BeLive/docs/product-protocol-v2.1.md` | 🟡 Средний — auth/AI API contracts |
| **MASTER-SYNC-REGISTRY.yaml** | Canonical | ✅ Active | `docs/sync/MASTER-SYNC-REGISTRY.yaml` | 🟡 Средний — health score неточен |
| **DOC-TC-BACKLOG.yaml** | Canonical | ✅ Active | `docs/sync/DOC-TC-BACKLOG.yaml` | 🟡 Средний — задачи потеряются |
| **DOMAIN-OWNERSHIP.yaml** | Canonical | ✅ Active | `docs/governance/DOMAIN-OWNERSHIP.yaml` | 🟢 Низкий — reference |
| **agent-governance-map.md** | Canonical | ✅ Active | `docs/governance/agent-governance-map.md` | 🟡 Средний — не отражает реальность |
| **000-bootstrap.md** | Canonical | ✅ Active | `~/Desktop/Belive-Agents/packs/000-bootstrap.md` | 🟡 Средний — 007 неверно стартует |
| **000-ref-arch-map.md** | Reference | ✅ Active | `~/Desktop/Belive-Agents/packs/000-ref-arch-map.md` | 🟡 Средний — код ушёл вперёд |
| **000-ref-interaction.md** | Reference | ✅ Active | `~/Desktop/Belive-Agents/packs/000-ref-interaction.md` | 🟡 Средний — код ушёл вперёд |
| **000-FULL-BASE.md** | Reference + **Mandatory Read for 007** | ✅ Active | `~/Desktop/beLive_Context/000-FULL-BASE.md` | 🔴 **ВЫСОКИЙ** — 007 в неверном контексте, решения без полной картины |
| **docs/architecture/*.md** | Reference | ✅ Active | `docs/architecture/*.md` | 🔴 Высокий — doc-code drift |
| **CEO Vault (Active Core)** | Reference | ✅ Active | `~/Desktop/BeLive_CEO/` (subset) | 🟡 Средний — creative drift |
| **CEO Vault (Creative/Private)** | Creative | 🎨 Active | `~/Desktop/BeLive_CEO/` (subset) | 🟢 Не влияет на код |
| **skills/*/SKILL.md** | Reference | ✅ Active | `.agents/skills/*/SKILL.md` | 🟡 Средний — алгоритмы устареют |
| **beLive_Context/[NNN]/** | Runtime | ⏳ Session | `~/Desktop/beLive_Context/` | 🟢 Разовый пакет |
| **beLive_Context/_007-state.md** | Runtime | ⏳ Session | `~/Desktop/beLive_Context/_007-state.md` | 🟢 История сессий |
| **MASTER-SYNC-REGISTRY.md** | Витрина | ⚠️ Derived | из YAML | 🟢 Low — все читают YAML |
| **ARCH-BASE.md** | Дубль | 🗄️ Deprecating | `docs/ARCH-BASE.md` | 🟡 Medium — дублирует FULL-BASE |
| **backup/rules_beLive.md** | Archive | 🗄️ Stale | `Belive-Agents/backup/` | 🟢 Marked STALE |
| **BeLive_repo_backup/AGENTS.md** | Archive | 🗄️ Stale | `Desktop/BeLive_repo_backup/` | 🟢 Marked STALE |

---

# 3. PROTOCOL SEPARATION

## 3.1 Проблема

Два файла с именем `protocol-v2.1.md` (теперь разведены):

| Файл | Путь | Про что | Кто читает |
|------|------|---------|-----------|
| **Agent Governance Protocol** | `~/Desktop/Belive-Agents/system/protocol-v3.0.md` | Роли, workflow, VERDICT, принципы | 007, 009, Operator |
| **Product Protocol** | `~/Documents/BeLive/docs/product-protocol-v2.1.md` | Auth OAuth, AI SSE, Surface transitions, Data schema, Error codes | Центр, разработчики |

## 3.2 Решение

| Действие | Файл | Новое имя |
|----------|------|-----------|
| ✅ **RENAMED** | `~/Desktop/Belive-Agents/system/protocol-v2.1.md` | → `protocol-v3.0.md` (уже v3.0 внутри, имя устарело) |
| ✅ **RENAMED** | `~/Documents/BeLive/docs/protocol-v2.1.md` | → `product-protocol-v2.1.md` (отражает содержимое) |
| ✅ **UPDATED** | `charter-007.md` | Ссылка на protocol | `protocol-v3.0.md` |
| ✅ **UPDATED** | `000-bootstrap.md` | Ссылка на protocol | `protocol-v3.0.md` |

## 3.3 Финальные определения

### Agent Governance Protocol (`protocol-v3.0.md`)

Содержит:
- Роли: Никита, Центр, 007, 009, Operator
- Workflow: PHASE 1 (Recon) → PHASE 2 (Execution) → PHASE 3 (Verification)
- Форматы: MACRO-PACK, MICRO-PACK, отчёт Оператора, отчёт 007, VERDICT 009
- Принципы: изоляция, атомарность, single writer, error=stop, doc-aware development
- Frozen zones: ссылка на charter-007.md §7
- VERDICT format

Ссылаются на него:
- `charter-007.md §3` → заменить ссылку
- `000-bootstrap.md §6` → заменить ссылку
- `agent-governance-map.md §3.2` → заменить ссылку

### Product Protocol (`product-protocol-v2.1.md`)

Содержит:
- OAuth flow (Google)
- JWT format
- AI SSE streaming
- Rate limits
- Surface transitions
- Data schemas
- Error codes

Ссылаются на него:
- `docs/architecture/auth-system.md`
- `docs/ARCH-BASE.md`

---

# 4. CEO VAULT PARTITION

## 4.1 Partition Scheme

Разделяю `~/Desktop/BeLive_CEO/` (141 файл) на 4 категории:

| Категория | Описание | Синхронизация с docs/ |
|-----------|---------|----------------------|
| **Active Core** | Bridge docs, patterns, architecture — должны быть в registry | ✅ Да |
| **Reference / Stubs** | Документы-заглушки, cheatsheets, списки | ⚠️ Нет, но не критично |
| **Creative / Private** | Маркетинг, контент, стратегия, идеи | ❌ Нет, творческое пространство |
| **Governance / Trackers** | CT-* файлы, трекеры, логи решений | ✅ Да (registry) |

## 4.2 Final Partition Map

### 🟢 Active Core (синхронизируется с docs/architecture/)

Эти файлы — **активная архитектурная документация**. Они должны быть в MASTER-SYNC-REGISTRY.yaml или добавлены туда.

```
bridge-audio.md
bridge-audio-reactive.md
bridge-blocks.md
bridge-cover-theme.md
bridge-exercise.md
bridge-live-guard.md
bridge-loop.md
bridge-lyrics.md
bridge-markers.md
bridge-mode-switch.md
bridge-mode.md
bridge-monitor.md
bridge-plate.md
bridge-stem-reactive.md
bridge-takes.md
bridge-text-style.md
bridge-time.md
bridge-track.md
audio-loader.md
authority-matrix.md
domain-note.md
event-surface.md
frozen-decisions-index.md
idb-service.md
marker-backbone.md
microphone-manager.md
patchV1-compat.md
prepared-catalog.md
scheduler-publication.md
stem-player.md
takes-surface.md
track-orchestrator.md
transport-authority.md
trigger-bridge.md
trigger-engine.md
vocal-mix.md
word-effects.md
word-sync-additive.md
wordSync-store.md
zip-pipeline.md
PATTERN-REGISTRY.md
P-A01.md through P-A13.md
P-D01.md through P-D05.md
P-P01.md through P-P04.md
P-R01.md through P-R05.md
P-S01.md through P-S05.md
smart-cell-catalog.md
DEMO-TRACKS-GUIDE.md
pipeline-demo-tracks.md
ai-lyrics-sync-service.md
recording-safe.md
BELIVE-CAPABILITIES.md
beLive-IDENTITY.md
beLive-RELEASE-CRITERIA.md
beLive-WORKFLOW.md
beLive-pattern-map.canvas
integration-plan.md
```

### 🟡 Reference / Stubs (справочные, не требуют синхронизации)

```
CHEATSHEET.md
BRIEFS-INDEX.md
BRIEFS/ (директория)
MOC-00-CORE.md
MOC-10-RELEASE.md
MOC-20-DOMAINS.md
MOC-30-CREATIVE.md
MOC-40-META.md
agent-config.md
```

### 🎨 Creative / Private (творческое пространство)

```
C01-story-arc.md
C02-visual-identity.md
C03-demo-scenarios.md
C04-content-map.md
C05-community-rituals.md
D01-release-countdown.md
D02-tech-debt-heat.md
D03-content-pipeline.md
D04-dependency-3d-map.md
R01-release-blockers.md
R02-release-nice-to-have.md
R03-post-release-v2.1.md
R04-demo-readiness.md
AG-cartographer.md
AG-guardian.md
AG-herald.md
AG-muse.md
AG-protocol.md
AG-scout.md
reel-templates.md
longform-ideas.md
community-voice.md
creative-hook.md
concert-surface.md
karaoke-surface.md
live-surface.md
rehearsal-surface.md
belive-pattern-map.canvas (творческая часть)
Без названия.base
Без названия.canvas
```

### 🔵 Governance / Trackers (синхронизируется)

```
CT-activity-feed.md
CT-BRIEFING.md
CT-decision-history.md
CT-nikita-profile.md
CT-session-log.md
CT-TODO.md
CT-vibecoder-sync.md
CEO-DASHBOARD.md
CEO/ (директория)
SONNET-HANDOFF.md
HANOOFF-CURRENT.md
release-blocker.md
04-CHANNELS-* (content plans - borderline creative/governance)
```

## 4.3 Registry Inclusion

**Что должно быть в MASTER-SYNC-REGISTRY.yaml:**
- Все bridge docs (bridge-*.md)
- Все pattern docs (P-*.md)
- PATTERN-REGISTRY.md
- Все architecture docs, которых нет в docs/architecture/
- frozen-decisions-index.md
- authority-matrix.md

**Что НЕ должно быть в registry:**
- Creative docs (C-*, D-*, R01-R04, AG-*)
- Stubs (MOC-*, CHEATSHEET.md)
- Session logs (CT-activity-feed, CT-session-log)
- Canvas files

---

# 5. 007 ↔ OPERATOR CONTROL CONTRACT

## 5.1 Contract Summary

```
╔══════════════════════════════════════════════════════════════╗
║               007 ↔ OPERATOR CONTROL CONTRACT                ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  007 → собирает MACRO-PACK → Центр решает TC                ║
║                                                              ║
║  007 → разбивает TC на MICRO-PACK                           ║
║       ├── 1 TC = 1 atomic change                            ║
║       ├── max 2 файла на MICRO-PACK                          ║
║       └── строгий формат (см. §5.2)                          ║
║                                                              ║
║  007 → task(subagent_type="operator") с MICRO-PACK          ║
║       ├── Operator НЕ видит MACRO-PACK                      ║
║       ├── Operator НЕ знает архитектурных решений            ║
║       └── Operator наследует deny-edit правила 007           ║
║                                                              ║
║  Operator → cold verify → apply → tsc → vitest → report     ║
║       ├── error = STOP (не чинить, доложить)                 ║
║       └── report содержит: статус, diff, логи                ║
║                                                              ║
║  007 → post-execution verify                                ║
║       ├── git diff — соответствует ли TC?                    ║
║       ├── tsc --noEmit — 0 новых ошибок?                     ║
║       ├── vitest — все проходят?                             ║
║       └── frozen zones — не тронуты?                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

## 5.2 MICRO-PACK Format (FINAL)

```markdown
📦 MICRO-PACK: TC-XXX
ЦЕЛЬ: [одна фраза]
ФАЙЛ: path/to/file.ts
ЗОНА: строки N-M (// ↓ TC-XXX START ... // ↑ TC-XXX END)
ДЕЙСТВИЕ: [точный код что вставить/заменить/удалить]
КОНТЕКСТ: [3 строки до, 3 строки после]
ЗАПРЕЩЕНО: [что не трогать — файлы, зоны, переменные]
ПРОВЕРКА: tsc --noEmit && vitest run --related
```

## 5.3 Control Mechanisms

| Механизм | Тип | Описание |
|----------|-----|----------|
| **Frontmatter permissions** | HARD | 007 `task: allow`; Operator `task: deny, skill: deny, webfetch: deny` |
| **Subagent inheritance** | HARD | Operator наследует все `deny-edit` правила 007 |
| **Context isolation** | SOFT | Operator получает только MICRO-PACK, не MACRO-PACK |
| **Cold verification** | SOFT | Operator проверяет anchor lines до apply |
| **Post-verify** | SOFT | 007 проверяет diff и тесты после Operator |
| **009 oversight** | SOFT | 009 может найти что Operator сломал (independent check) |

---

# 6. 009 INDEPENDENT VERIFICATION CONTRACT

## 6.1 When Called

| Триггер | Обязательно? |
|---------|-------------|
| После каждой реализации + DOC-CHECK 007 | ✅ MANDATORY |
| Каждые 10 TC — random audit | ✅ MANDATORY |
| При конфликте 007 ↔ Центр | 🔶 ESCALATION |
| Перед релизом | 🔶 ESCALATION |

## 6.2 What 009 Must Check

| Шаг | Что проверяет | Метод |
|-----|--------------|-------|
| 1 | Runtime verification | Анализ логов, скриншотов, поведения. Поиск регрессий. |
| 2 | DOC-CHECK second pass | Перепроверка документации **независимо** от 007 |
| 3 | Registry validation | MASTER-SYNC-REGISTRY.yaml статусы корректны? |
| 4 | FULL-BASE drift | Изменилась архитектурная модель? Нужен FULL-BASE-TC? |
| 5 | Random audit | Без чтения отчёта 007 — только код и docs |

## 6.3 What 009 Must Ignore

- **Не читать отчёт 007** при random audit
- **Не проверять качество кода** (это 007 + tsc)
- **Не оценивать архитектурные решения** (это Центр)
- **Не предлагать фиксы** (только report)
- **Не подтверждать свою же работу**

## 6.4 VERDICT Power

```yaml
VERDICT: PASS | FAIL | CONDITIONAL_PASS

Если FAIL:
  → Блокирует COMPLETE
  → Возвращает 007 + Центру
  → Причина: что именно не прошло
  
Если PASS:
  → Задача COMPLETE
  → Аудиторская запись в audit trail

CONDITIONAL_PASS:
  → PASS с замечаниями
  → DOC-TC создаётся, но не блокирует COMPLETE
```

## 6.5 Why 009 Is Not 007 Duplicate

| Аспект | 007 | 009 |
|--------|-----|-----|
| **Роль** | Разработчик контекста | Аудитор |
| **Отношение к коду** | Не пишет, но организует | Не пишет, не организует |
| **Отношение к docs** | First pass DOC-CHECK | Second pass (cross-audit) |
| **Confirmation bias** | Может пропустить ошибку | Ловит ошибки 007 |
| **Право блокировки** | Нет | ✅ Есть |
| **Random audit** | Нет | ✅ Каждые 10 TC |

---

# 7. DOC-AWARE DEVELOPMENT FINAL DoD

## 7.1 Definition of Done (Final)

Задача считается **COMPLETE** только после:

```
┌──────────────────────────────────────────────────────────────┐
│                    DO-CHECKLIST                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ [MANDATORY] 1. Реализация Operator'ом завершена          │
│                   (code change applied)                       │
│                                                              │
│  ✅ [MANDATORY] 2. Верификация 007:                          │
│                   ├── git diff соответствует TC              │
│                   ├── tsc --noEmit: 0 новых ошибок            │
│                   ├── vitest: все проходят                    │
│                   └── frozen zones: не тронуты                │
│                                                              │
│  ✅ [MANDATORY] 3. DOC-CHECK (007 first pass):               │
│                   ├── Определены затронутые домены            │
│                   ├── DOC_OK / UPDATE / CREATE                │
│                   └── Если нужно: DOC-TC создан               │
│                                                              │
│  ✅ [MANDATORY] 4. Registry updated:                         │
│                   ├── MASTER-SYNC-REGISTRY.yaml               │
│                   ├── DOC-TC-BACKLOG.yaml (если DOC-TC)       │
│                   └── health score пересчитан                 │
│                                                              │
│  ✅ [MANDATORY] 5. FULL-BASE drift check:                    │
│                   └── Новые домены/сервисы/потоки?            │
│                                                              │
│  ✅ [MANDATORY] 6. 009 independent verification:             │
│                   ├── Runtime audit                           │
│                   ├── DOC-CHECK second pass                   │
│                   ├── Registry validation                     │
│                   └── VERDICT: PASS                           │
│                                                              │
│  ✅ [CONDITIONAL] 7. DOC-TC resolved:                        │
│                   (если был создан — должен быть resolved)    │
│                                                              │
│  🟡 [OPTIONAL] 8. CEO Vault sync:                            │
│                   (перед push — bridge docs, patterns)        │
│                                                              │
│  🟡 [OPTIONAL] 9. _007-state.md log update:                  │
│                   (история сессий)                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 7.2 Статус после каждого шага

| Шаг | Статус |
|-----|--------|
| 1-2 выполнены | ✅ APPLIED |
| 1-3 выполнены | ✅ DOC-CHECKED |
| 1-4 выполнены | ✅ REGISTERED |
| 1-5 выполнены | ✅ DRIFT-CHECKED |
| 1-6 выполнены | ✅ **COMPLETE** |

---

# 8. OWNERSHIP / KEEPER / ESCALATION MODEL

## 8.1 Definitions

| Роль | Что делает |
|------|-----------|
| **Owner** | Решает **ЧТО** должно быть в домене. Принимает архитектурные решения. |
| **Keeper** | Следит **ЧТОБЫ** документация = код. Обновляет docs. |
| **DOC-TC initiator** | Кто создаёт задачу на обновление документации. |
| **Escalation target** | Кто решает если keeper не может решить проблему. |

## 8.2 Final Ownership Table

| Домен | Owner | Keeper | Escalation | DOC-TC initiator |
|-------|-------|--------|------------|-----------------|
| Architecture maps | Центр | 007 | 001 | 007 |
| Audio engine | Центр | 007 | 001 | 007 |
| Sync system | Центр | 007 | 001 | 007 |
| Auth system | Центр | 007 | 001 | 007 |
| AI / Billy | Центр | 007 | 001 | 007 |
| UI / Surfaces | Центр | 007 | 001 | 007 |
| Performance | Центр | 007 | 001 | 007 |
| Track pipelines | Центр | 007 | 001 | 007 |
| Theme | Центр | 007 | 001 | 007 |
| Telegram | Центр | 007 | 001 | 007 |
| **Governance** | **007** | **009** | **001** | **009** |
| **Registry** | **007** | **009** | **001** | **009** |
| Charters | 007 | 009 | 001 | 007 |
| Agent files | 007 | 009 | 001 | 007 |
| CEO Vault | 007 | 007 | 001 | 007 |

### Key insight

007 — **keeper** для всех доменов, но **009 — keeper для governance**.
Это гарантирует что governance документы проверяются независимо.

007 владеет governance, 009 следит за 007 в этой зоне.

---

# 9. FINAL CLEANUP RULES

## 9.1 Rules for Each Category

| Категория | Правило | Действие |
|-----------|---------|----------|
| **Stale doc** | Неактуален, код ушёл вперёд | Mark STALE в начале файла. Ссылка на актуальный источник. |
| **Orphan doc** | Нет референтов, никто не читает | Mark ORPHAN. Если через 30 дней никто не возразит → ARCHIVE. |
| **Superseded doc** | Заменён новым документом | Mark SUPERSEDED → `docs/archive/superseded/` |
| **Duplicate doc** | Две копии одного контента | Одна → canonical, другая → STALE + reference |
| **Hidden truth** | Вне registry, но содержит важную инфу | Добавить в registry или ingest в canonical |
| **Obsolete archive** | Старый бэкап | Mark STALE, не удалять (на диске) |

## 9.2 Actionable Items

| Файл | Статус | Действие |
|------|--------|----------|
| `docs/ARCH-BASE.md` | DUP | Mark: `⚠️ SUPERSEDED — см. 000-FULL-BASE.md` |
| `docs/protocol-v2.1.md` | RENAME | → `product-protocol-v2.1.md` (отражает содержимое) |
| `Belive-Agents/system/protocol-v2.1.md` | RENAME | → `protocol-v3.0.md` (уже v3 внутри) |
| `docs/scenario-stage-state-model.md` | STALE | Mark STALE в начале файла |
| `docs/practice-experience-layer.md` | needs_update | DOC-TC-007 существует, ждёт |
| `docs/dock-standard.md` | needs_update | DOC-TC-005 существует, ждёт |
| `Belive-Agents/backup/rules_beLive.md` | STALE | Уже marked ✅ |
| `BeLive_repo_backup/AGENTS.md` | STALE | Уже marked ✅ |

---

# 10. FINAL CANONICAL ARCHITECTURE

## 10.1 A. Canonical Layer (единственные источники истины)

| # | Ресурс | Путь |
|---|--------|------|
| 1 | Global AGENTS.md | `~/.config/opencode/AGENTS.md` |
| 2 | Project AGENTS.md | `~/Documents/BeLive/AGENTS.md` |
| 3 | Agent configs (frontmatter) | `.opencode/agent/*.md` |
| 4 | Agent bodies | `.opencode/agent/*.md` (body) |
| 5 | Charter 007 | `~/Desktop/Belive-Agents/007/charter-007.md` |
| 6 | Charter 009 | `~/Desktop/Belive-Agents/009/charter-009-diagnostik.md` |
| 7 | Charter Operator | `~/Desktop/Belive-Agents/operator/charter-operator.md` |
| 8 | Agent Governance Protocol | `~/Desktop/Belive-Agents/system/protocol-v3.0.md` |
| 9 | Product Protocol | `~/Documents/BeLive/docs/product-protocol-v2.1.md` |
| 10 | Sync Registry | `docs/sync/MASTER-SYNC-REGISTRY.yaml` |
| 11 | DOC-TC Backlog | `docs/sync/DOC-TC-BACKLOG.yaml` |
| 12 | Domain Ownership | `docs/governance/DOMAIN-OWNERSHIP.yaml` |
| 13 | Agent Governance Map | `docs/governance/agent-governance-map.md` |
| 14 | Bootstrap | `~/Desktop/Belive-Agents/packs/000-bootstrap.md` |
| 15 | Security Rules | `~/.agents/skills/belive-security/SKILL.md` |

## 10.2 B. Reference Layer (ссылаются, не дублируют)

| # | Ресурс | Путь |
|---|--------|------|
| 1 | Architecture Map | `docs/architecture/architecture-map-2.1.md` |
| 2 | Interaction Schema | `docs/architecture/interaction-schema-2.1.md` |
| 3 | Архитектурная карта (pack) | `~/Desktop/Belive-Agents/packs/000-ref-arch-map.md` |
| 4 | Interaction (pack) | `~/Desktop/Belive-Agents/packs/000-ref-interaction.md` |
| 5 | Domain docs (28 шт) | `docs/architecture/*.md` |
| 6 | FULL-BASE | `~/Desktop/beLive_Context/000-FULL-BASE.md` |
| 7 | Skills (belive-*) | `~/.agents/skills/*/SKILL.md` |
| 8 | Skills (cloudflare) | `~/.config/opencode/skills/*/SKILL.md` |
| 9 | CEO Vault Active Core | Bridge docs, patterns |

## 10.3 C. Runtime Layer (читаются агентами в работе)

| # | Ресурс | Путь |
|---|--------|------|
| 1 | Session state | `~/Desktop/beLive_Context/_007-state.md` |
| 2 | MACRO-PACK | `~/Desktop/beLive_Context/[NNN] [Name]/[NNN]-MACRO.md` |
| 3 | SCAN reports | `~/Desktop/beLive_Context/*.md` |
| 4 | Audit reports | `~/Desktop/beLive_Context/_FIELD-AUDIT-REPORT.md` и др. |

## 10.4 D. Creative / Private Layer

| # | Ресурс | Путь |
|---|--------|------|
| 1 | CEO Vault Creative | C-*, D-*, R01-R04, AG-* файлы |
| 2 | CEO Vault Reference | CHEATSHEET, MOC-*, BRIEFS/ |
| 3 | Canvas files | `*.canvas` |

## 10.5 E. Archive Layer

| # | Ресурс | Путь |
|---|--------|------|
| 1 | Qoder-era rules | `Belive-Agents/backup/rules_beLive.md` |
| 2 | AGENTS.md backup | `Desktop/BeLive_repo_backup/AGENTS.md` |
| 3 | Superseded arch maps | `docs/architecture/architecture-map-2.2.md` (скоро) |
| 4 | Superseded interaction | `docs/architecture/interaction-schema-2.2.md` (скоро) |

---

# 11. EXACT FILE ACTION PLAN

## 11.1 Keep (без изменений)

```
~/.config/opencode/AGENTS.md
~/.config/opencode/opencode.jsonc
~/Documents/BeLive/opencode.json
~/Documents/BeLive/AGENTS.md
.opencode/agent/007.md
.opencode/agent/009.md
.opencode/agent/operator.md
.opencode/agent/arch-scout.md
.opencode/agent/sync-scout.md
.opencode/agent/gateway-scout.md
~/Desktop/Belive-Agents/007/charter-007.md
~/Desktop/Belive-Agents/009/charter-009-diagnostik.md
~/Desktop/Belive-Agents/operator/charter-operator.md
~/Desktop/Belive-Agents/packs/000-bootstrap.md
~/Desktop/Belive-Agents/packs/000-ref-arch-map.md
~/Desktop/Belive-Agents/packs/000-ref-interaction.md
docs/sync/MASTER-SYNC-REGISTRY.yaml
docs/sync/DOC-TC-BACKLOG.yaml
docs/sync/MASTER-SYNC-REGISTRY.md (витрина — ok)
docs/governance/DOMAIN-OWNERSHIP.yaml
docs/governance/agent-governance-map.md
~/.agents/skills/belive-007-core/SKILL.md
~/.agents/skills/belive-handoff/SKILL.md
~/.agents/skills/belive-security/SKILL.md
docs/architecture/*.md (все 28)
~/Desktop/beLive_Context/000-FULL-BASE.md
~/Desktop/beLive_Context/_007-state.md
```

## 11.2 Rename

| Файл | → Новое имя | Причина |
|------|-----------|---------|
| ✅ `~/Desktop/Belive-Agents/system/protocol-v2.1.md` | → `protocol-v3.0.md` | Внутри v3.0, имя обманчиво |
| ✅ `~/Documents/BeLive/docs/protocol-v2.1.md` | → `product-protocol-v2.1.md` | Не agent protocol, а auth/AI/API |

## 11.3 Mark Stale

| Файл | Маркер |
|------|--------|
| `docs/ARCH-BASE.md` | `⚠️ SUPERSEDED — см. 000-FULL-BASE.md` |
| `docs/architecture/scenario-stage-state-model.md` | `🗄️ STALE — код использует practice-session` |

## 11.4 Create

| Файл | Причина |
|------|---------|
| `.opencode/agent/001.md` | 001 как read-only governance агент |
| `.opencode/agent/002.md` | 002 как stress-test subagent |
| `docs/archive/superseded/` | Папка для superseded документов |

## 11.5 Archive

| Файл | Куда |
|------|------|
| `docs/architecture/architecture-map-2.2.md` (superseded) | `docs/archive/superseded/architecture-map-2.2.md` |
| `docs/architecture/interaction-schema-2.2.md` (superseded) | `docs/archive/superseded/interaction-schema-2.2.md` |
| `docs/architecture/scenario-stage-state-model.md` (stale) | `docs/archive/superseded/scenario-stage-state-model.md` (после freeze) |

---

# 12. RISKS REGISTER

## 12.1 Known Risks

| # | Риск | Severity | Mitigation |
|---|------|----------|-----------|
| R1 | **Confirmation bias 007** — 007 может пропустить ошибку в своей работе | 🔴 HIGH | 009 independent verification (mandatory) |
| R2 | **Stale authority** — charter-007.md не обновлён, frozen zones не отражают код | 🔴 HIGH | DOC-CHECK после каждого TC обновляет |
| R3 | **Duplicate protocols** — два protocol-v2.1.md, путаница | 🟡 MED | RENAME (Action Plan §11.2) |
| R4 | **Registry drift** — MASTER-SYNC-REGISTRY.yaml не обновлён | 🟡 MED | 009 validation (mandatory) |
| R5 | **Hidden truth outside registry** — CEO Vault bridge docs не в registry | 🟡 MED | Partition map + registry inclusion plan |
| R6 | **Role overlap** — 007 и 009 начинают дублировать друг друга | 🟡 MED | Contract separation (§5, §6) |
| R7 | **No 001 agent file** — 001 не имеет инструментов в OpenCode | 🟡 MED | Create `.opencode/agent/001.md` |
| R8 | **ARCH-BASE.md дублирует FULL-BASE** | 🟢 LOW | Mark SUPERSEDED |
| R9 | **Scout models hardcoded** — arch-scout привязан к Kimi, не fallback | 🟢 LOW | Если модель недоступна — OpenCode падает? |
| R10 | **No charter for scouts** — agent files самодостаточны, но нет единого чартера | 🟢 LOW | Если agent body полон — не нужно |

## 12.2 Risk by Role

| Роль | Главные риски |
|------|--------------|
| 001 | Нет agent file, нет инструментов |
| 002 | Не существует, не может быть вызван |
| 007 | Confirmation bias, stale charter |
| 009 | Может стать формальностью (всегда PASS) |
| Operator | Может выйти за пределы MICRO-PACK (soft control) |

---

# 13. FREEZE RECOMMENDATION

## 13.1 What Can Be Frozen Now

| Элемент | Статус | Freeze |
|---------|--------|--------|
| **Role definitions** | ✅ Проверено аудитом | ✅ FREEZE |
| **Workflow (PHASE 1-2-3)** | ✅ Работает в production | ✅ FREEZE |
| **007 ↔ Operator contract** | ✅ Проверено на 80+ TC | ✅ FREEZE |
| **DOC-CHECK protocol** | ✅ Проверено на 20+ TC | ✅ FREEZE |
| **009 VERDICT contract** | ✅ Проверено на 10+ TC | ✅ FREEZE |
| **Registry format (YAML)** | ✅ CI-ready | ✅ FREEZE |
| **Canonical frozen zones** | ✅ Единый источник | ✅ FREEZE |
| **Domain ownership table** | ✅ Зафиксирована | ✅ FREEZE |

## 13.2 What Needs Change Before Freeze

| Элемент | Статус | Действие |
|---------|--------|----------|
| ~~Protocol rename~~ | ✅ Done | Two protocol files renamed and references updated |
| ~~ARCH-BASE.md~~ | ✅ Done | Marked SUPERSEDED |
| ~~001 agent file~~ | ✅ Done | Created `.opencode/agent/001.md` |
| **002 agent file** | ⏳ Рекомендация | Create or explicitly decide NOT to create |
| **CEO Vault partition** | ⏳ Pending | Apply partition map to registry |
| ~~Stale scenario doc~~ | ✅ Done | Already marked STALE |

## 13.3 No-Go Changes (Don't Touch Without Escalation)

| Изменение | Почему |
|-----------|--------|
| Удаление AGENTS.md | Поломает всю систему агентов |
| Удаление charter-007.md | Уничтожит frozen zones reference |
| Удаление operator.md | Оператор перестанет существовать |
| Изменение subagent inheritance | Платформенное изменение OpenCode |
| Слияние 007 и 009 | Уничтожит independent verification |
| Удаление DOC-CHECK из DoD | Нарушит DOC-AWARE DEVELOPMENT |
| Слияние двух protocol файлов | Разные сущности — нельзя |

## 13.4 July-Safe Governance Baseline

```
S-VC 1.2 — Система на июнь 2026:

✅ Shared Context Layer (FULL-BASE) — adopted
✅ 7 ролей (001/002/007/009/Operator/Центр/001 agent file)
✅ 2 протокола (Agent Governance / Product) — разведены
✅ 16 canonical файлов (+001.md)
✅ 1 registry (YAML machine-first)
✅ 28 architecture docs (reference)
✅ 141 CEO Vault файла (partitioned)
✅ DOC-AWARE DEVELOPMENT (6-step DoD)
✅ Independent verification (mandatory)
✅ Subagent isolation (hard enforcement)
✅ Frozen zones (single source)
✅ Domain ownership (YAML)
✅ Risk register (10 entries)
✅ FULL-BASE = Shared Context Layer (все роли читают)
✅ Post-session writeback — FULL-BASE + registry + _007-state.md
✅ 009 reads FULL-BASE for drift detection

Что не доделано:
- 002 не имеет agent file
- CEO Vault partition не отражена в registry
- ARCH-BASE.md — помечен SUPERSEDED
```

---

## APPENDIX: Final System Diagram (S-VC 1.2)

```
                         ┌──────────────────────────┐
                         │   SHARED CONTEXT LAYER    │
                         │    000-FULL-BASE.md       │
                         │   (Читают все роли)       │
                         └────────────┬─────────────┘
                                      │
                         NIKITA (Human PM)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
            001             007            009
      (CEO co-arch)   (Main Agent)   (Independent Verifier)
              │              │              │
              │     ┌────────┼────────┐     │
              │     │        │        │     │
              │     ▼        ▼        ▼     │
              │   Центр    Operator  Scouts │
              │   (Arch)   (Blind)   (RO)   │
              │              │              │
              │              002            │
              │         (Stress-test)       │
              │                            │
              └──────────REGISTRY───────────┘
                         
    CANONICAL:                         REFERENCE:
    charter-007.md                     docs/architecture/*.md
    charter-009.md                     packs/000-ref-*.md
    charter-operator.md                000-FULL-BASE.md
    protocol-v3.0.md                   CEO Vault (Active Core)
    product-protocol-v2.1.md
    MASTER-SYNC-REGISTRY.yaml          CREATIVE:
    DOC-TC-BACKLOG.yaml                CEO Vault (C-*, D-*, AG-*)
    DOMAIN-OWNERSHIP.yaml              Canvas files
    agent-governance-map.md
    .opencode/agent/*.md               ARCHIVE:
    AGENTS.md                          Belive-Agents/backup/
                                       BeLive_repo_backup/
```

---

## 14. S-VC 1.2 Declaration

### 14.1 What Is Side_chaine_Vibe_Code (S-VC 1.2)?

**Side_chaine_Vibe_Code (S-VC 1.2)** — единая операционная система вайбкодинга для проекта beLive.

Это название governance-архитектуры, зафиксированной в этом документе.
Не отдельный артефакт. Не новый слой бюрократии. **Имя текущей модели системы.**

### 14.2 Composition

| Компонент | Артефакт |
|-----------|----------|
| **Shared Context Layer** | `000-FULL-BASE.md` |
| **Roles** | 001 / 002 / 007 / 009 / Operator / Центр |
| **Agent protocol** | `protocol-v3.0.md` |
| **Product protocol** | `product-protocol-v2.1.md` |
| **Registry** | `MASTER-SYNC-REGISTRY.yaml` |
| **Task backlog** | `DOC-TC-BACKLOG.yaml` |
| **Charters** | charter-007.md, charter-009.md, charter-operator.md |
| **Governance map** | `agent-governance-map.md` |
| **Ownership** | `DOMAIN-OWNERSHIP.yaml` |
| **DoD** | DOC-AWARE DEVELOPMENT (6-step) |
| **Quality** | 009 independent verification (mandatory) |

### 14.3 Key Principle

> **FULL-BASE is shared context. All roles read it. No single role owns it.**
> 
> **Decisions come from roles, not from documents. Documents inform, roles decide.**
> 
> **007 verifies, 009 validates, Центр decides, Operator executes, 001 coordinates, 002 challenges.**

### 14.4 Status

```
S-VC 1.2 — June 2026 — ✅ FROZEN

All governance documents are aligned:
- Shared Context Layer: adopted
- Self-Improving Cycle: adopted (A→B→C→D→E)
- Protocols: separated
- Roles: defined (001 file created)
- Registry: YAML machine-first
- DoD: DOC-AWARE DEVELOPMENT + 009
- Maintenance: proof-based cleanup
- Frozen zones: single source
```

---

## 15. S-VC MAINTENANCE CYCLE

### 15.1 Purpose

Регулярный контур самоочистки и самоулучшения системы.

Система должна:
- сама находить дрейф
- сама предлагать cleanup
- сама требовать proof
- сама не допускать случайных удалений
- сама обновлять FULL-BASE только когда надо
- сама становиться чище после каждого цикла

### 15.2 Trigger Ownership Rule

Если команда пользователя совпадает с зарегистрированным триггером (`001, Optimization!`), агент **не имеет права спрашивать** дальнейших указаний.

Обязан автоматически:
1. Распознать триггер
2. Определить фазу (Phase A — Detect)
3. Определить владельца (001)
4. Вызвать владельца или начать свою фазу
5. После завершения фазы — автоматически инициировать следующую

**Цикл стартует автоматически.** Пользователь не участвует в последовательности фаз.

### 15.3 Autonomous Continuation Chain

```
Никита: "001, Optimization!"
    ↓
007 распознаёт триггер → вызывает 001 (Phase A)
    ↓
001 завершает Detect → AUDIT-REPORT → 007 (Phase B)
    ↓
007 завершает Propose → Optimization Plan → 009 (Phase C)
    ↓
009 завершает Approve → APPROVED → 007 + Operator (Phase D)
    ↓
007 + Operator завершают Execute → EXECUTION-REPORT → 007 (Phase E)
    ↓
007 завершает Writeback → вызывает 009 (Final Verify)
    ↓
009 завершает Verify → VERDICT
```

| Фаза | Владелец | Вызывает следующего |
|------|----------|-------------------|
| A (Detect) | 001 (или 007 как fallback) | → 007 |
| B (Propose) | 007 | → 009 |
| C (Approve) | 009 | → 007 |
| D (Execute) | 007 + Operator | → 007 |
| E (Writeback) | 007 | → 009 |
| Final Verify | 009 | → COMPLETE |

**Каждый агент вызывает следующего через `task()`.** Никаких вопросов пользователю между фазами.

### 15.4 Fallback: 001 Unavailable

Если 001 не имеет agent file или не отвечает:
- 007 выполняет Phase A (Detect) самостоятельно
- Пометка: "001 unavailable — 007 fallback"
- Продолжает цикл по Autonomous Continuation

### 15.5 Trigger Matrix

| Триггер | Действие |
|---------|----------|
| Health score registry падает ниже 75 | 001 запускает полный цикл |
| Появились stale/orphan docs | 001 → 007 audit |
| Hidden truth outside registry | 001 → 007 ingest |
| Dead code candidates найдены | 007 предлагает → 001 решает |
| После крупного TC (>5 файлов) | Partial cycle (scope = TC) |
| Никита: "001 — Оптимизация!" / "001, Optimization!" | Немедленный полный цикл |
| Раз в неделю (регулярно) | Полный цикл если есть что чистить |
| 007 обнаружил проблему | 007 → предлагает 001 → 001 решает |

### 15.6 Cycle (A → B → C → D → E)

```
Phase A — DETECT (001)
  → AUDIT-REPORT: stale/orphan/duplicate docs, dead code candidates, broken links
  → Timebox: 1 час
  
Phase B — PROPOSE (007)
  → OPTIMIZATION-PLAN: proof-based candidate list, TC roadmap, risks, rollback
  → Timebox: 30 мин
  
Phase C — APPROVE (009)
  → APPROVED / BLOCKED / PARTIAL / REQUEST MORE PROOF
  → REQUEST MORE PROOF = явный стоп-сигнал, не мягкий комментарий
  → Timebox: 15 мин
  
Phase D — EXECUTE (007 + Operator)
  → EXECUTION-REPORT: 1 изменение = 1 TC, docs ≠ code в разных TC
  → Timebox: 30 мин на TC
  
Phase E — WRITEBACK (007)
  → S-VC-MAINTENANCE-REPORT
  → FULL-BASE (ТОЛЬКО архитектурные изменения)
  → Timebox: 15 мин
```

**Total timebox:** весь цикл A→E — макс 2 часа.

### 15.7 Anti-Bloat Rule

**Maintenance cycle НЕ создаёт новые документы.**

| Разрешено | Запрещено |
|-----------|-----------|
| Mark STALE на мёртвых доках | Создавать новые .md |
| Mark SUPERSEDED на замещённых | Писать новые архитектурные описания |
| Обновлять registry статусы | Расширять существующие документы |
| Удалять dead code (с proof) | Добавлять новую бюрократию |
| Обновлять FULL-BASE (только архитектура) | "Улучшать память" после мелкого cleanup |

Если цикл хочет создать новый документ — это **не maintenance**, это **новая задача**. Остановить цикл, создать отдельный TC.

### 15.8 Hard Rules

| Правило | Санкция |
|---------|---------|
| Никаких удалений без доказательства | ❌ 009 блокирует |
| Никаких оптимизаций без scope | ❌ 009 блокирует |
| Docs cleanup ≠ code cleanup (разные TC) | ❌ 009 veto |
| 007 не одобряет сам себе спорные изменения | ❌ 009 override |
| Operator без финального одобренного TC | ❌ НЕ выполняется |
| FULL-BASE без архитектурного смысла | ❌ 007 не обновляет |
| Цикл не плодит новые документы | ❌ 009 блокирует |
| Trigger Ownership: не спрашивать пользователя при триггере | ❌ 009 найдет при audit |

### 15.9 Artifact

```
S-VC-MAINTENANCE-REPORT
─────────────────────
Дата:        YYYY-MM-DD
Цикл:        #N

SCOPE:       [что проверялось]
CANDIDATES:  N найдено, N подтверждено (proof-based)
APPROVED:    N изменений
REJECTED:    N отклонено 009 (с причинами)

EXECUTED:
  - Code cleanup: N файлов, -X строк
  - Docs cleanup: N документов (STALE/SUPERSEDED)
  - DOC-TC closed: N

SYNC HEALTH: N → N (только sync docs, не общий health проекта)
FULL-BASE:   changed / unchanged

ROI METRICS:
  Candidates found:    N
  Approved:            N
  Rejected:            N (by 009)
  Code lines removed:  -X
  DOC-TC closed:       N
  Sync health delta:   N → N
  ROI RATING:          HIGH / MED / LOW

ROLLBACK:    [если было откачено]
NEXT CYCLE:  [рекомендации]
```

**ROI Rating Guide:**
| Rating | Criteria |
|--------|----------|
| **HIGH** | >50 строк dead code или >3 DOC-TC closed |
| **MED** | 10-50 строк или 1-3 DOC-TC |
| **LOW** | <10 строк, только registry фиксы |

Ожидаемая динамика: Cycle 1 → HIGH → Cycle 2-3 → MED → Cycle 4+ → LOW (система чистая). Если после 5 циклов всё ещё HIGH — цикл слишком редкий.

### 15.10 Where Defined

| Аспект | Документ |
|--------|----------|
| Полная спецификация цикла | `agent-governance-map.md §12` |
| 007 как proposer + executor | `charter-007.md §15` |
| 009 как gatekeeper | `charter-009-diagnostik.md §8` |
| Краткий overview | `000-bootstrap.md §8` |

---

*GOVERNANCE FINAL FREEZE v1.1 — 2026-06-15 — S-VC 1.2 — Self-Improving Governance Cycle adopted*  
*Side_chaine_Vibe_Code (S-VC 1.2) — Shared Context Layer + Maintenance Cycle*  
*Baseline for July-safe agent governance. Freeze recommended pending 3 action items.*
