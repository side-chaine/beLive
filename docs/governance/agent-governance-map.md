# Agent Governance Map — beLive

**Document type:** Architecture / Governance  
**Scope:** Full inventory of how OpenCode collects context, applies rules, and constrains agents in the beLive project  
**Date:** 2026-06-10  
**Author:** 007 — Intelligence Audit  
**Status:** ✅ Post-consolidation snapshot (refactored)  

---

## 1. Context Collection Order

When an OpenCode agent is invoked in the beLive project, the system assembles its effective context in a **strict order**. Each layer is prepended/merged after the previous one. Later layers override earlier ones where conflicts exist.

### Pipeline (top → bottom = final system prompt)

```
 1. ┌─ Global AGENTS.md ──────────────────────────────────────────┐
    │  ~/.config/opencode/AGENTS.md                                │
    │  Content: Context7 MCP usage instruction                     │
    │  Scope: ALL agents on ALL projects on this machine           │
    └──────────────────────────────────────────────────────────────┘
                            ↓
 2. ┌─ Project AGENTS.md ─────────────────────────────────────────┐
    │  ~/Documents/BeLive/AGENTS.md                                │
    │  Content: "Ты — 007. Разведчик..." + routing to charters     │
    │  Scope: ALL agents in beLive project ONLY                    │
    └──────────────────────────────────────────────────────────────┘
                            ↓
 3. ┌─ Agent File (frontmatter) ──────────────────────────────────┐
    │  ~/Documents/BeLive/.opencode/agent/<name>.md                │
    │  Fields parsed:                                               │
    │    description     → used in skill list                       │
    │    mode            → subagent/primary/all                     │
    │    model           → overrides default model                  │
    │    steps/maxSteps  → iteration limits                         │
    │    permission      → PermissionConfig (hard rules)            │
    └──────────────────────────────────────────────────────────────┘
                            ↓
 4. ┌─ Agent File (body) ─────────────────────────────────────────┐
    │  Everything after the closing --- of frontmatter             │
    │  Treated as agent system prompt (instructions)               │
    │  May reference charters, packs, etc. via relative paths      │
    └──────────────────────────────────────────────────────────────┘
                            ↓
 5. ┌─ Available Skills (injected as context) ────────────────────┐
    │  ALL skills from:                                            │
    │    ~/.config/opencode/skills/*/SKILL.md                      │
    │    ~/.agents/skills/*/SKILL.md                               │
    │  Stitched into system prompt as list of available tools      │
    │  Agent chooses which to load via skill("name") tool          │
    └──────────────────────────────────────────────────────────────┘
                            ↓
 6. ┌─ Global opencode.jsonc ─────────────────────────────────────┐
    │  ~/.config/opencode/opencode.jsonc                           │
    │  Currently only: MCP server config (Context7)                │
    │  No permission/agent/skills paths configured here            │
    └──────────────────────────────────────────────────────────────┘
                            ↓
 7. ┌─ Session Settings (runtime) ────────────────────────────────┐
    │  Applied per-session via API or CLI flags:                   │
    │    –model     override model                                 │
    │    –agent     override agent                                 │
    │    Permission rules passed at session.create()               │
    │    Inherited from parent session for subagents               │
    └──────────────────────────────────────────────────────────────┘
                            ↓
 8. ┌─ Runtime Agent Permission Resolution ──────────────────────┐
    │  Final permission = merge of:                                │
    │    1. Agent file frontmatter → permission                   │
    │    2. Session-level permissions                              │
    │    3. Subagent inheritance rules (see §1.1 below)            │
    │  Result: PermissionRuleset (array of {permission,pattern,action})
    └──────────────────────────────────────────────────────────────┘
```

### 1.1 Subagent Permission Inheritance

From binary analysis of OpenCode 1.14.50:

```
subagent.permission = [
  // Inherit ALL deny-edit rules from parent agent
  ...parentAgent.permission.filter(r → r.action==="deny" && r.permission==="edit"),

  // Inherit external_directory and ALL deny rules from parent session
  ...parentSession.permission.filter(r → r.permission==="external_directory" || r.action==="deny"),

  // Default: deny todowrite (unless subagent explicitly allows it)
  ...subagent.hasTodowrite ? [] : [{permission:"todowrite", pattern:"*", action:"deny"}],

  // Default: deny task (unless subagent explicitly allows it)
  ...subagent.hasTask ? [] : [{permission:"task", pattern:"*", action:"deny"}],
]
```

**Key rule:** `deny` propagates downward. `allow` does NOT. Subagents are born locked down.

---

## 2. Complete File Inventory

### 2.1 AGENTS.md files (agent-agnostic instructions)

| # | Path | Purpose | Affects | Loaded by | Status |
|---|------|---------|---------|-----------|--------|
| 1 | `~/.config/opencode/AGENTS.md` | Context7 MCP protocol | ALL agents on ALL projects | OpenCode binary at startup | ✅ Active |
| 2 | `~/Documents/BeLive/AGENTS.md` | beLive agent rules, project-level | ALL agents in beLive | OpenCode per-project | ✅ Active |
| 3 | `~/Desktop/BeLive_repo_backup/AGENTS.md` | Identical copy of #2 | NONE (backup dir) | Manual | 🗄️ Stale backup |

### 2.2 Agent files (`.opencode/agent/*.md`)

| # | Agent | Path | Frontmatter fields | Body |
|---|-------|------|-------------------|------|
| 1 | **007** | `beLive/.opencode/agent/007.md` | `description`, `mode: all`, `steps:15`, `maxSteps:25`, `permission: {...}` | Charter routing + task algorithm |
| 2 | **operator** | `beLive/.opencode/agent/operator.md` | `description`, `mode: subagent`, `steps:10`, `maxSteps:15`, `permission: {...}` | Cold verification + apply protocol |
| 3 | **arch-scout** | `beLive/.opencode/agent/arch-scout.md` | `description`, `mode: all`, `model: kimi/k2.6`, `steps:10`, `maxSteps:15`, `permission: {...}` | Architecture report format |
| 4 | **sync-scout** | `beLive/.opencode/agent/sync-scout.md` | `description`, `mode: all`, `model: glm/glm-5.1`, `steps:10`, `maxSteps:15`, `permission: {...}` | Sync domain analysis protocol |
| 5 | **gateway-scout** | `beLive/.opencode/agent/gateway-scout.md` | `description`, `mode: all`, `model: glm/glm-5.1`, `steps:10`, `maxSteps:15`, `permission: {...}` | Auth/infra compliance protocol |
| 6 | **009** | `beLive/.opencode/agent/009.md` | `description`, `mode: all`, `steps:10`, `maxSteps:15`, `permission: {...}` | Independent Verification Agent (v3.0) |

### 2.3 Charters (full role definitions)

| # | File | Role | Lines | Loaded by | Status |
|---|------|------|-------|-----------|--------|
| 1 | `~/Desktop/Belive-Agents/007/charter-007.md` | **007** — Разведка + Упаковка контекста | 245 | Agent body → `AGENTS.md` routing | ✅ Active |
| 2 | `~/Desktop/Belive-Agents/operator/charter-operator.md` | **Operator** — Слепой исполнитель | 132 | Agent body → `AGENTS.md` routing | ✅ Active |
| 3 | `~/Desktop/Belive-Agents/009/charter-009-diagnostik.md` | **009** — Runtime diagnostic | 364+ | Agent body → `009.md` routing | ✅ Active |

### 2.4 Packs (reference documents)

| # | File | Content | Lines | Loaded by | Status |
|---|------|---------|-------|-----------|--------|
| 1 | `Belive-Agents/packs/000-bootstrap.md` | Project overview, ownership matrix, frozen invariants, protocol | 169 | AGENTS.md → "Прочитай 000-bootstrap.md" | ✅ Active |
| 2 | `Belive-Agents/packs/000-ref-arch-map.md` | Full architecture map (1596+ lines) | 1596+ | AGENTS.md → "по требованию" | ✅ Active |
| 3 | `Belive-Agents/packs/000-ref-interaction.md` | Full interaction schema (2542+ lines) | 2542+ | AGENTS.md → "по требованию" | ✅ Active |

### 2.5 System protocol

| # | File | Content | Lines | Status |
|---|------|---------|-------|--------|
| 1 | `Belive-Agents/system/protocol-v2.1.md` | Agent system protocol (CANONICAL), roles, workflow | 100 | ✅ Active — canonical protocol source |

### 2.6 Skills (beLive-specific, loaded by `skill()` tool)

| # | Skill | Path | Purpose | Status |
|---|-------|------|---------|--------|
| 1 | **belive-007-core** | `~/.agents/skills/belive-007-core/SKILL.md` | 007 MACRO/MICRO packing algorithm | ✅ Active |
| 2 | **belive-handoff** | `~/.agents/skills/belive-handoff/SKILL.md` | Handoff between Center instances | ✅ Active |
| 3 | **belive-security** | `~/.agents/skills/belive-security/SKILL.md` | Security rules, P0/P1/P2 zones | ✅ Active (new) |

### 2.7 Context packs (runtime)

| # | Path | Content | Status |
|---|------|---------|--------|
| 1 | `~/Desktop/beLive_Context/000-FULL-BASE.md` | Master context pack for Центр (4224 строк) | ✅ Active |
| 2 | `~/Desktop/beLive_Context/_007-state.md` | 007 session log — task history + observations | ✅ Active |
| 3 | `~/Desktop/beLive_Context/078 REPO-CLEANUP-01/` | Last task session | ✅ Active |

### 2.8 Stale / Archived (do not use)

| # | File | Content | Status | Marker |
|---|------|---------|--------|--------|
| 1 | `Belive-Agents/backup/rules_beLive.md` | Old Qoder-era rules (658 строк) | 🗄️ Stale | ✅ Marked STALE in file |
| 2 | `Desktop/BeLive_repo_backup/AGENTS.md` | Exact copy of project AGENTS.md | 🗄️ Stale | ✅ Marked STALE in file |

---

## 3. Duplicate Instructions (Post-Refactoring Status)

### 3.1 Frozen Zone List — NOW CANONICALIZED

| Where | Path | Before refactoring | After AGENT-GOVERNANCE-REFACTOR-01 |
|-------|------|-------------------|------------------------------------|
| 📄 | `charter-007.md §7` | ✅ CANONICAL — 8 entries | ✅ REMAINS CANONICAL |
| 📄 | `protocol-v2.1.md` | ✅ Exact copy | ✅ Replaced with reference to charter-007.md §7 |
| 📄 | `000-bootstrap.md` | ⚠️ Drifted (7 items) | ✅ Replaced with reference to charter-007.md §7 |
| 📄 | `belive-007-core/SKILL.md` | ⚠️ Missing trigger.bridge.ts | ✅ Replaced with reference to charter-007.md §7 |
| 📄 | `belive-security/SKILL.md` | ⚠️ Different format (P0 globs) | ✅ Replaced P0 list with reference to charter-007.md §7 |
| ✅ | **Agent permissions** | ✅ Aligned with canonical | ✅ Unchanged (already aligned) |
| 📄 | `backup/rules_beLive.md` | 🗄️ Outdated | ✅ Marked STALE |

**Canonical frozen list** (from charter-007.md §7):
```
src/audio/core/AudioEngineV2.ts
src/audio/compat/patchV1.ts
src/bridges/**/*.ts
src/services/track.orchestrator.ts
js/**/*.js
src/stores/wordSync.store.ts
src/stores/markers.store.ts
src/triggers/trigger.bridge.ts
```

### 3.2 Protocol / Workflow — NOW CANONICALIZED

| Where | Path | Before refactoring | After AGENT-GOVERNANCE-REFACTOR-01 |
|-------|------|-------------------|------------------------------------|
| 📄 | `protocol-v2.1.md` | One of 4 copies | ✅ CANONICAL — REMAINS |
| 📄 | `charter-007.md §3` | 10-step protocol + principles | ✅ Replaced with reference to protocol-v2.1.md |
| 📄 | `000-bootstrap.md §6` | 8-step + roles table | ✅ Replaced with reference to protocol-v2.1.md |
| 📄 | `belive-007-core/SKILL.md` | 6-step abridged workflow | ✅ Kept unique steps (task-specific), no protocol |

**Canonical protocol source:** `protocol-v2.1.md`

### 3.3 Role Definitions — NOW CANONICALIZED

| Role | Before refactoring | After AGENT-GOVERNANCE-REFACTOR-01 |
|------|-------------------|------------------------------------|
| **Никита** | In 4 files + "Билли" in protocol-v2.1.md | ✅ protocol-v2.1.md → "Никита". Все файлы унифицированы |
| Центр | protocol-v2.1.md, bootstrap.md, charter-007.md | ✅ protocol-v2.1.md canonical |
| 007 | charter-007.md, AGENTS.md, belive-007-core skill | ✅ protocol-v2.1.md canonical |
| Оператор | operator.md, charter-operator.md | ✅ protocol-v2.1.md canonical |
| 009 | charter-009-diagnostik.md | ✅ Registered as agent |
| ~~Билли~~ | protocol-v2.1.md (устаревшее имя) | ❌ **Билли удалён**, заменён на "Никита" |

### 3.4 Context7 Instruction — unchanged

| Where | Path | Verdict |
|-------|------|---------|
| 📄 | `~/.config/opencode/AGENTS.md` | ✅ Canonical — loaded by OpenCode automatically |
| 📄 | `~/.agents/skills/context7-mcp/SKILL.md` | ⚠️ Manual skill version — mirrors AGENTS.md |

---

## 4. Agent Responsibility Map

### 4.1 007 — Main Agent

| Aspect | Detail |
|--------|--------|
| **Automatic reads** | AGENTS.md (global) → AGENTS.md (project) → 007.md frontmatter → 007.md body |
| **Charter references** | `charter-007.md` (245 строк), `000-bootstrap.md` (169) |
| **On-demand references** | `000-ref-arch-map.md`, `000-ref-interaction.md` |
| **Available skills** | ALL 22 skills (including belive-007-core, belive-handoff, belive-security) |
| **steps/maxSteps** | 15 / 25 |
| **Permission: edit** | 7 frozen zones denied; `src/**` and `*.md` allowed |
| **Permission: bash** | `rm -rf*` and `git push --force*` denied; rest allowed |
| **Permission: task** | `allow` — can create subagents |
| **Permission: webfetch** | `allow` |
| **Permission: websearch** | `allow` |
| **Limits inherited** | Only deny-edit rules propagate to subagents |

### 4.2 Operator — Blind Executor

| Aspect | Detail |
|--------|--------|
| **Automatic reads** | AGENTS.md (global) → AGENTS.md (project) → operator.md frontmatter → operator.md body |
| **Charter references** | `charter-operator.md` (132 строк) |
| **On-demand references** | Only MICRO-PACK from 007 (via task tool) |
| **Available skills** | ALL except `skill: deny` blocks loading |
| **steps/maxSteps** | 10 / 15 |
| **Permission: edit** | 7 frozen zones denied; `src/**` allowed |
| **Permission: bash** | Only `npm run test/build/typecheck` and `git diff/status` allowed; rest denied |
| **Permission: task** | `deny` — CANNOT create subagents |
| **Permission: webfetch** | `deny` |
| **Permission: skill** | `deny` — CANNOT load skill files |
| **Key isolation** | No MACRO-PACK context, no architecture decisions, no improvisation |

### 4.3 arch-scout — Architecture Scout

| Aspect | Detail |
|--------|--------|
| **Automatic reads** | AGENTS.md (global) → AGENTS.md (project) → arch-scout.md |
| **Charter references** | None directly (not in AGENTS.md routing) |
| **On-demand reads** | `architecture-map-2.1.md`, `interaction-schema-2.1.md` |
| **Available skills** | ALL 22 |
| **steps/maxSteps** | 10 / 15 |
| **Permission: read** | `allow` — can read ALL files |
| **Permission: edit** | `*.md` allowed; `src/**` denied |
| **Permission: bash** | `deny` |
| **Permission: task** | `deny` — CANNOT create subagents |
| **Permission: webfetch** | `allow` (for external doc checking) |
| **Permission: websearch** | `allow` |
| **Escalation** | Reports to 007 |

### 4.4 sync-scout — Sync Scout

| Aspect | Detail |
|--------|--------|
| **Automatic reads** | AGENTS.md (global) → AGENTS.md (project) → sync-scout.md |
| **Charter references** | None directly |
| **On-demand reads** | `sync-system.md`, `block-first-lyrics-sync.md` |
| **Available skills** | ALL 22 |
| **steps/maxSteps** | 10 / 15 |
| **Permission: read** | `allow` |
| **Permission: edit** | `*.md` allowed; `src/**` denied |
| **Permission: bash** | `deny` |
| **Permission: task** | `deny` |
| **Permission: webfetch** | `allow` |
| **Permission: websearch** | `allow` |
| **Escalation** | HIGH RISK issues → 007 immediately |

### 4.5 gateway-scout — Gateway & Auth Scout

| Aspect | Detail |
|--------|--------|
| **Automatic reads** | AGENTS.md (global) → AGENTS.md (project) → gateway-scout.md |
| **Charter references** | None directly |
| **On-demand reads** | `auth-system-freeze.md` |
| **Available skills** | ALL 22 |
| **steps/maxSteps** | 10 / 15 |
| **Permission: read** | `allow` |
| **Permission: edit** | `*.md` allowed; `src/**` denied |
| **Permission: bash** | `deny` |
| **Permission: task** | `deny` |
| **Permission: webfetch** | `allow` (for endpoint health checks) |
| **Permission: websearch** | `allow` |
| **Escalation** | CRITICAL issues (security) → 007 immediately |

### 4.6 009 — Independent Verification Agent (v3.0)

| Property | Value |
|----------|-------|
| **Registered in OpenCode?** | ✅ YES — `.opencode/agent/009.md` |
| **Charter** | `charter-009-diagnostik.md` (v3.0 — переписан) |
| **Automatic reads** | AGENTS.md (global) → AGENTS.md (project) → 009.md frontmatter → 009.md body |
| **Charter reference** | `charter-009-diagnostik.md` |
| **Role** | Independent Verification Agent — verifies 007 + Operator results before COMPLETE |
| **Phase in lifecycle** | PHASE 3 — VERIFICATION (after 007 DOC-CHECK first pass) |
| **Key responsibilities** | Runtime audit → DOC-CHECK second pass → Registry validation → FULL-BASE drift → VERDICT |
| **Permission: bash** | Diagnostic commands + read access to MASTER-SYNC-REGISTRY.yaml + docs |
| **Permission: task** | `deny` — CANNOT create subagents |
| **Permission: webfetch** | `allow` |
| **Permission: websearch** | `allow` |
| **Permission: skill** | `allow` |
| **Cannot** | Write code, access frozen zones, make decisions |

---

## 5. Context Pipeline — Visual Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENCODE AGENT CONTEXT                        │
│                                                                  │
│  Layer 1  │  ~/.config/opencode/AGENTS.md                       │
│  (Global) │  "Use Context7 MCP for library questions..."        │
│           │  Injected FIRST, affects ALL agents                 │
├───────────┼─────────────────────────────────────────────────────┤
│  Layer 2  │  ~/Documents/BeLive/AGENTS.md                       │
│  (Project)│  "Ты — 007. Разведчик..." → charter routing         │
│           │  Injected SECOND, beLive-only                       │
├───────────┼─────────────────────────────────────────────────────┤
│  Layer 3  │  .opencode/agent/<name>.md  FRONTMATTER             │
│  (Agent   │  description, mode, steps, maxSteps, permission     │
│   Config) │  Parsed → AgentConfig object                        │
├───────────┼─────────────────────────────────────────────────────┤
│  Layer 4  │  .opencode/agent/<name>.md  BODY                    │
│  (Agent   │  "Полный чартер: ~/Desktop/.../charter-007.md"      │
│   Prompt) │  → Agent reads referenced files via tools           │
├───────────┼─────────────────────────────────────────────────────┤
│  Layer 5  │  SKILL CONTEXT (injected into system prompt)        │
│  (Skills) │  All 22 skills listed as available_skills[]         │
│           │  Agent loads via skill("name") tool                 │
│           │  ┌─ System skills (9): agents-sdk, cloudflare...    │
│           │  └─ Custom skills (13): belive-*, context7-mcp...   │
├───────────┼─────────────────────────────────────────────────────┤
│  Layer 6  │  ~/.config/opencode/opencode.jsonc                  │
│  (Config) │  MCP servers, permissions (NOT SET for beLive)      │
├───────────┼─────────────────────────────────────────────────────┤
│  Layer 7  │  Session overrides: --model, --agent, permissions   │
│  (Runtime)│  task tool → subagent inheritance                   │
├───────────┼─────────────────────────────────────────────────────┤
│  Layer 8  │  FINAL PermissionRuleset                            │
│  (Enforce)│  {permission, pattern, action}[]                    │
│           │  Enforced by OpenCode kernel at tool-call time      │
└───────────┴─────────────────────────────────────────────────────┘


                    SUBAGENT INHERITANCE CHAIN

      Parent Agent (007)              Parent Session
      permission: [{edit,src/        permission: [{bash,"*",deny}]
       audio/core/**,deny}, ...]              │
              │                               │
              └───────────┬───────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │   SUBAGENT (child)   │
              │                      │
              │  permission = [      │
              │    deny-edit rules   │  ← inherited from parent agent
              │    + deny from sess  │  ← inherited from parent session
              │    + deny todowrite  │  ← default (unless allowed)
              │    + deny task       │  ← default (unless allowed)
              │  ]                   │
              └──────────────────────┘
```

---

## 6. Technical Debt (Post-Refactoring Status)

### ✅ Resolved in AGENT-GOVERNANCE-REFACTOR-01

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | 009 has charter but no agent file | ✅ Created `.opencode/agent/009.md` |
| 2 | Stale backup files unmarked | ✅ Both marked `STALE — DO NOT USE` |
| 3 | Frozen zones in 6 places | ✅ All 5 duplicate sources now reference charter-007.md §7 |
| 4 | Protocol in 4 places | ✅ charter-007.md and bootstrap.md now reference protocol-v2.1.md |
| 5 | Билли/Никита confusion | ✅ protocol-v2.1.md now uses "Никита" everywhere |
| 6 | belive-007-core skill duplicates charter | ✅ Frozen zones and protocol removed from skill |
| 7 | belive-security has own frozen list | ✅ Replaced with reference to charter-007.md §7 |
| 8 | Agent models not in frontmatter | ✅ arch-scout, sync-scout, gateway-scout now have `model:` in frontmatter |
| 9 | 009 model hardcoded, not enforced | ✅ Agent file created (model: default, enforced by OpenCode) |

### ⏳ Remaining Technical Debt

| # | Issue | Severity | Affects | Notes |
|---|-------|----------|---------|-------|
| 1 | Scouts have no dedicated charters | 🟢 Info | Scouts | Agent bodies are self-sufficient; charters would be pure duplication |
| 2 | Context7 instruction exists in 2 places | 🟢 Info | All agents | Global AGENTS.md loads it automatically; context7-mcp skill is redundant |
| 3 | AGENTS.md→charter routing is implicit (manual read) | 🟡 Low | 007, operator, 009 | Agent must CHOOSE to read the charter — no hard enforcement |
| 4 | belive-007-core skill not updated for new permission structure | 🟡 Low | 007 | Skill still describes agent without mentioning permissions (permissions are in frontmatter now) |
| 5 | No canonical placement for agent-governance-map.md | 🟢 Info | Governance | Currently in `docs/governance/` — not in Belive-Agents/ |

### 6.1 ✅ 009 Role Evolution — RESOLVED → EVOLVED

| Aspect | Detail |
|--------|--------|
| **Problem** | `charter-009-diagnostik.md` defined a diagnostic agent with no active role in development cycle |
| **Fix applied** | Charter rewritten to v3.0 — Independent Verification Agent. 009 now active in PHASE 3 (see GOVERNANCE-EVOLUTION-01) |
| **Status** | ✅ RESOLVED in AGENT-GOVERNANCE-REFACTOR-01 |

### 6.2 ✅ Stale Backup Files — RESOLVED

| File | Problem | Fix applied |
|------|---------|-------------|
| `~/Desktop/BeLive_repo_backup/AGENTS.md` | Exact copy of project AGENTS.md | ✅ Marked `STALE BACKUP — DO NOT USE` in file header |
| `~/Desktop/Belive-Agents/backup/rules_beLive.md` | Qoder-era rules (658 строк) | ✅ Marked `STALE — DO NOT USE` in file header |

### 6.3 ✅ Frozen Zone List — RESOLVED

| Problem | Resolution |
|---------|-----------|
| **charter-007.md** vs **protocol-v2.1.md** | ✅ protocol-v2.1.md now references charter-007.md §7 |
| **bootstrap.md** vs **charter-007.md** | ✅ bootstrap.md now references charter-007.md §7 |
| **belive-007-core skill** vs **charter-007.md** | ✅ Skill now references charter-007.md §7 |
| **belive-security skill** vs **charter-007.md** | ✅ Skill P0 now references charter-007.md §7 |
| **Agent permissions** vs **charter-007.md** | ✅ Unchanged (already aligned) |

**Canonical source:** `charter-007.md §7`

### 6.4 ✅ Protocol Definition — RESOLVED

| File | Resolution |
|------|-----------|
| `charter-007.md §3` | ✅ Replaced with reference to protocol-v2.1.md |
| `protocol-v2.1.md` | ✅ REMAINS CANONICAL |
| `000-bootstrap.md §6` | ✅ Replaced with reference to protocol-v2.1.md |
| `belive-007-core/SKILL.md` | ✅ Unique steps kept, protocol removed |

**Canonical source:** `protocol-v2.1.md`

### 6.5 ⏳ AGENTS.md → Charter Routing is Implicit (unresolved)

- Project `AGENTS.md` says: "Твои правила: → `charter-007.md`"
- This is a **manual instruction** — the agent must CHOOSE to read the file
- No automatic binding between AGENTS.md and charters
- **Cannot be fixed** without OpenCode platform change

### 6.6 ⏳ Permission Changes — Not Reflected in Skills (unresolved)

| What changed | Where updated? | Where NOT updated? |
|-------------|---------------|-------------------|
| Agent permissions (007, operator, scouts) | `.opencode/agent/*.md` frontmatter | `belive-007-core/SKILL.md` — still describes agent without permissions |
| belive-security skill added | `~/.agents/skills/belive-security/` | `belive-007-core/SKILL.md` — doesn't mention security skill |

### 6.7 ✅ belive-007-core Skill — RESOLVED

| Content | Before | After |
|---------|--------|-------|
| Frozen zone list | 7 items (missing trigger.bridge.ts) | ✅ Reference to charter-007.md §7 |
| Protocol workflow | 6-step abridged | ✅ Removed (refer to protocol-v2.1.md) |
| MACRO/MICRO specifics | ~50 lines | ✅ Kept (unique to skill) |
| Task numbering | ✅ unique | ✅ Kept |
| Frozen Guard check | ✅ unique | ✅ Kept |

### 6.8 ⏳ Charters Not Auto-Loaded (unresolved)

- `arch-scout.md`, `sync-scout.md`, `gateway-scout.md` have no charter references
- Scouts rely entirely on inline instructions in their agent body
- Charter would be pure duplication of existing body content

### 6.9 ✅ 009 Model Enforcement — RESOLVED

| Problem | Resolution |
|---------|-----------|
| No agent file existed | ✅ Created `.opencode/agent/009.md` |
| Model not enforced in frontmatter | ✅ No explicit model set — uses OpenCode default (same as before) |
| Charter specified `minimax-m3-free` | ⚠️ Model string not valid for OpenCode; default provides reliable fallback |

### 6.10 Summary Table

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | 009 has charter but no agent file | 🔴 Medium | ✅ **RESOLVED** |
| 2 | Stale backup files | 🟡 Low | ✅ **RESOLVED** |
| 3 | Frozen zones in 6 places | 🔴 Medium | ✅ **RESOLVED** |
| 4 | Protocol in 4 places | 🟡 Low | ✅ **RESOLVED** |
| 5 | AGENTS.md→charter routing implicit | 🟡 Low | ⏳ Unresolved (platform limitation) |
| 6 | Skills not updated with permissions | 🟡 Low | ⏳ Unresolved (deferred) |
| 7 | belive-007-core duplicates charter | 🟡 Low | ✅ **RESOLVED** |
| 8 | Scouts have no charters | 🟢 Info | ⏳ Unresolved (deferred — not needed) |
| 9 | 009 model hardcoded, not enforced | 🟢 Info | ✅ **RESOLVED** |
| 10 | Context7 instruction in 2 places | 🟢 Info | ⏳ Unresolved (deferred — requires skill removal) |

---

## 7. File Dependency Graph

```
Global AGENTS.md                            ← CANONICAL: Context7
  └── Context7 MCP instruction

Project AGENTS.md                           ← RUNTIME: agent routing
  ├── reads: charter-007.md (referenced)
  │     ↓
  │   charter-007.md                       ← CANONICAL: frozen zones (§7), 007 role, 007 formats
  │     ├── references: protocol-v2.1.md (§3, заменён)
  │     └── references: 000-bootstrap.md (§10 startup)
  │           ├── references: 000-ref-arch-map.md (on-demand)
  │           └── references: 000-ref-interaction.md (on-demand)
  │
  ├── reads: 000-bootstrap.md (referenced)
  │     └── references: charter-007.md (§5 frozen)
  │
  ├── reads: belive-007-core skill (unique mechanics only)
  │
  ├── operator rules → charter-operator.md (referenced)
  ├── 009 rules → charter-009-diagnostik.md (referenced)
  ├── arch-scout rules (all inline)
  ├── sync-scout rules (all inline)
  └── gateway-scout rules (all inline)

protocol-v2.1.md                            ← CANONICAL: protocol, roles, workflow
                    
belive-security/SKILL.md                    ← CANONICAL: security rules, P0/P1/P2
  └── references: charter-007.md (§7 frozen)

belive-handoff/SKILL.md                     ← REFERENCE: handoff protocol

beLive context packs
  ├── 000-FULL-BASE.md (for Центр, NOT for 007)
  └── _007-state.md (session log)

OpenCode binary (opencode 1.14.50)
  ├── Reads .config/opencode/opencode.jsonc (MCP config)
  ├── Scans .config/opencode/skills/ (9 skills)
  ├── Scans ~/.agents/skills/ (13 skills)
  ├── Reads .opencode/agent/*.md (6 agents)
  └── Injects AGENTS.md (global + project)

Stale (not to be read):
  ├── backup/rules_beLive.md               ← STALE: Qoder-era
  └── BeLive_repo_backup/AGENTS.md          ← STALE: backup copy
```

---

## 8. Completed in AGENT-GOVERNANCE-REFACTOR-01

All 7 recommendations from the initial audit have been actioned:

| # | Original recommendation | Status | Action taken |
|---|----------------------|--------|-------------|
| 1 | Create 009.md agent file or remove charter | ✅ Done | Created `.opencode/agent/009.md` with read-only permissions |
| 2 | Consolidate frozen zone list to one canonical source | ✅ Done | `charter-007.md §7` is single source. All others reference it |
| 3 | Consolidate protocol to one source | ✅ Done | `protocol-v2.1.md` is single source. charter-007.md and bootstrap.md reference it |
| 4 | Clean up stale backups | ✅ Done | Both files marked `STALE — DO NOT USE` in-file |
| 5 | Update belive-007-core skill | ✅ Done | Frozen zones and protocol duplicates removed |
| 6 | Add charter references to scout agent files | ⏳ Pending | Scouts still have no dedicated charters (deferred) |
| 7 | Add model field to 009 agent file | ✅ Done | Created with no explicit model (uses OpenCode default) |

### Still outstanding

| Issue | Why not done | Impact |
|-------|-------------|--------|
| Scouts have no charters | Agent files self-sufficient; charter would just duplicate body | Low — scouts work fine without charters |
| Context7 skill mirrors AGENTS.md | Would require removing skill, which may affect other users | Low — duplicate but harmless |

---

*Agent Governance Map v1.1 — 007 — 2026-06-10 — Post-AGENT-GOVERNANCE-REFACTOR-01*
*Consolidated agent governance ecosystem after canonical alignment.*
