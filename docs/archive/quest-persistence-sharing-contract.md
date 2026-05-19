# Quest Persistence & Sharing Contract Memo

**Status:** Contract Freeze  
**Last Updated:** 2024  
**Related Docs:** [quest-scenario-system.md](./quest-scenario-system.md), [quest-authoring-flow.md](./quest-authoring-flow.md), [quest-entry-surface.md](./quest-entry-surface.md)

---

## 1. Purpose

### 1.1 Why This Memo Exists

The Quest System architecture has frozen several key principles:
- Generator provenance matters
- Sharing later should exchange definitions, not runtime state
- Quest/Scenario/Run/Card must stay separate

**Before implementation spreads**, we need exact contract thinking for:
- What gets persisted locally?
- What is ephemeral runtime only?
- What is shareable later?
- What could belong to ZIP/package later?
- What should never be shared?
- What should never be stored as user-facing source of truth?

This memo defines clean persistence and sharing contracts to prevent architectural drift.

### 1.2 Scope

This memo covers:
1. **GeneratorDef** — generator family definitions
2. **ScenarioSpec** — declarative scenario specifications
3. **ScenarioProgram** — executable step sequences
4. **QuestCardDef** — motivational wrappers
5. **QuestRun** — runtime execution instances
6. **Evidence** — mastery signals
7. **Mastery** — aggregated mastery state

For each entity, we define:
- Persistence contract (what/where/when)
- Sharing contract (what/how/never)
- Relationship to current recipeId system
- Future relation to track/album packages

---

## 2. Entity Contracts

### 2.1 GeneratorDef

**What it is:** Generator family definition with metadata and generation logic

**Persistence Contract:**
- **Persisted:** Metadata only (id, family, version, name, icon, description, defaults, surface)
- **NOT persisted:** Generation function (code cannot be serialized)
- **Location:** Generator registry (in-memory, code-based)
- **When:** At app initialization (registered from code)

**Sharing Contract:**
- **Shareable:** Metadata only (as reference, not full definition)
- **NOT shareable:** Generation function (code is not portable)
- **Format:** JSON reference `{ generatorId: "echo-v1", family: "echo", version: "1.0.0" }`
- **Use case:** ScenarioSpec references generator by id/family/version

**Ephemeral:**
- Generation function (exists only in code)
- Runtime validation logic
- Capability gating logic

**Never:**
- Never persist generation function (code cannot be serialized)
- Never share generation function (couples sender/receiver implementations)
- Never store as user-facing source of truth (generators are code, not data)

**Relationship to recipeId:**
- Current: `recipeId` is hardcoded string ("echo-drill", "3-take-challenge")
- Future: `recipeId` becomes `generatorId` (references generator in registry)
- Migration: Generators include `recipeId` for backward compatibility
- Transitional: Recipe wrappers map `recipeId` → `generatorId` during migration

**Future relation to packages:**
- Generators are code, not data — cannot be packaged
- Track packages reference generators by id (assumes generator exists in app)
- Album packages reference generators by id (assumes generator exists in app)
- Custom generators require app update (cannot be distributed in packages)


---

### 2.2 ScenarioSpec

**What it is:** Declarative specification of a practice scenario (semantic dimensions)

**Persistence Contract:**
- **Persisted:** Full spec (all semantic dimensions)
- **Location:** Embedded in QuestCardDef (not standalone)
- **When:** When QuestCard is saved to library
- **Format:** JSON-serializable object

**Sharing Contract:**
- **Shareable:** YES — full spec is portable
- **Format:** JSON object with semantic dimensions
- **Use case:** Share QuestCard with embedded ScenarioSpec
- **Validation:** Recipient validates spec against local generator capabilities

**Ephemeral:**
- Nothing — spec is pure data, fully serializable

**Never:**
- Never persist without QuestCard wrapper (spec is not standalone)
- Never share without generator reference (recipient needs generator to execute)
- Never store runtime state in spec (spec is declarative, not stateful)

**Relationship to recipeId:**
- Current: No ScenarioSpec exists (recipes are hardcoded)
- Future: ScenarioSpec replaces hardcoded recipe parameters
- Migration: Extract semantic dimensions from recipe params
- Transitional: Recipe wrappers generate ScenarioSpec from params

**Future relation to packages:**
- Track packages include ScenarioSpecs (embedded in QuestCards)
- Album packages include ScenarioSpecs (embedded in QuestCards)
- ScenarioSpecs are portable (JSON, no code dependencies)
- Recipient validates spec against local generator capabilities

**Example ScenarioSpec:**
```json
{
  "id": "spec-echo-chorus-001",
  "family": "echo",
  "scope": { "blockId": "chorus-1" },
  "tempo": 1.0,
  "backing": "instrumental",
  "listenMode": "reference",
  "recordMode": "standard",
  "reviewStep": "compare",
  "progressGate": { "type": "rounds", "count": 3 },
  "evidence": ["completion", "x-y"]
}
```

---

### 2.3 ScenarioProgram

**What it is:** Executable step sequence generated from ScenarioSpec

**Persistence Contract:**
- **Persisted:** NEVER
- **Location:** N/A (ephemeral runtime only)
- **When:** N/A (generated on-demand, disposed after execution)
- **Format:** N/A (not serializable)

**Sharing Contract:**
- **Shareable:** NEVER
- **Format:** N/A (not portable)
- **Use case:** N/A (runtime-only artifact)

**Ephemeral:**
- Everything — program is generated, executed, disposed
- Steps array
- Repeat logic
- Progress gate
- Evidence requests
- Interruption policy

**Never:**
- Never persist program (couples to implementation version)
- Never share program (not portable, not versionable)
- Never store as user-facing source of truth (program is generated, not authored)

**Relationship to recipeId:**
- Current: Exercise (equivalent to ScenarioProgram) is generated from recipe
- Future: ScenarioProgram is generated from ScenarioSpec by generator
- Migration: No change to runtime behavior (program is still ephemeral)
- Transitional: Recipe wrappers generate Exercise (current) or ScenarioProgram (future)

**Future relation to packages:**
- Programs are never packaged (ephemeral runtime artifact)
- Packages include ScenarioSpecs, not programs
- Recipient generates program from spec using local generator

---

### 2.4 QuestCardDef

**What it is:** Motivational wrapper + shareable unit (metadata + ScenarioSpec reference)

**Persistence Contract:**
- **Persisted:** Full card (metadata + embedded ScenarioSpec)
- **Location:** Local library (browser storage, future: cloud storage)
- **When:** When user saves custom quest or system creates default quest
- **Format:** JSON-serializable object

**Sharing Contract:**
- **Shareable:** YES — full card is portable
- **Format:** JSON object or ZIP package
- **Use case:** Share custom quests with other users
- **Validation:** Recipient validates embedded ScenarioSpec against local generator capabilities

**Ephemeral:**
- Nothing — card is pure data, fully serializable

**Never:**
- Never persist runtime state in card (card is definition, not execution)
- Never share without embedded ScenarioSpec (card is incomplete without spec)
- Never store generation logic in card (card is data, not code)

**Relationship to recipeId:**
- Current: RecipeDef (equivalent to QuestCardDef) references recipe by id
- Future: QuestCardDef embeds ScenarioSpec (no external reference)
- Migration: Extract ScenarioSpec from recipe params, embed in card
- Transitional: QuestCardDef includes both `recipeId` (backward compat) and `scenarioSpec` (future)

**Future relation to packages:**
- Track packages include QuestCards (curated set for specific song)
- Album packages include QuestCards (curated set for album)
- QuestCards are portable (JSON, no code dependencies)
- Recipient validates embedded ScenarioSpec against local generator capabilities

**Example QuestCardDef:**
```json
{
  "id": "card-echo-chorus-001",
  "name": "Echo Drill - Chorus",
  "icon": "🎧",
  "description": "Build muscle memory by echoing the original",
  "category": "drill",
  "difficulty": "beginner",
  "estimatedDuration": 600,
  "scenarioSpec": {
    "id": "spec-echo-chorus-001",
    "family": "echo",
    "scope": { "blockId": "chorus-1" },
    "tempo": 1.0,
    "backing": "instrumental",
    "progressGate": { "type": "rounds", "count": 3 }
  },
  "goalFraming": "Complete 3 rounds",
  "requiredCapabilities": ["recording", "backing-stems"]
}
```


---

### 2.5 QuestRun

**What it is:** Runtime instance of a quest execution (program + state + evidence)

**Persistence Contract:**
- **Persisted:** Partial (metadata + evidence only, NOT full state)
- **Location:** Local history (browser storage, future: cloud storage)
- **When:** After quest completion (for history/evidence)
- **Format:** JSON-serializable object (metadata + evidence, no program)

**Sharing Contract:**
- **Shareable:** NEVER (runtime state is not portable)
- **Format:** N/A (not shareable)
- **Use case:** N/A (local history only)

**Ephemeral:**
- ScenarioProgram (generated, not persisted)
- QuestState (current round, step, phase, resolved time range)
- Temporary flags (shouldTriggerRecord, recordSlot, recordMode)

**Persisted (after completion):**
- Quest metadata (questCardId, startedAt, completedAt)
- Evidence (completion, X/Y, pitch, timing, self-assessment)
- Result summary (roundsCompleted, roundsTotal, attempts)

**Never:**
- Never persist full runtime state (couples to implementation version)
- Never share runtime state (not portable, not versionable)
- Never store ScenarioProgram in run (program is ephemeral)

**Relationship to recipeId:**
- Current: ExerciseResult stores `recipeId` for history
- Future: QuestRun stores `questCardId` (references card, not recipe)
- Migration: Map `recipeId` → `questCardId` during migration
- Transitional: QuestRun includes both `recipeId` and `questCardId`

**Future relation to packages:**
- QuestRuns are never packaged (local history only)
- Evidence may be exported for analysis (separate from run)
- Mastery state may be exported for backup (separate from run)

**Example QuestRun (persisted after completion):**
```json
{
  "id": "run-001",
  "questCardId": "card-echo-chorus-001",
  "startedAt": 1704067200000,
  "completedAt": 1704067800000,
  "status": "completed",
  "evidence": [
    {
      "id": "ev-001",
      "type": "completion",
      "timestamp": 1704067800000,
      "data": {
        "roundsCompleted": 3,
        "roundsTotal": 3
      }
    }
  ]
}
```

---

### 2.6 Evidence

**What it is:** Captured mastery signals from quest execution

**Persistence Contract:**
- **Persisted:** Full evidence (type + timestamp + data)
- **Location:** Embedded in QuestRun (after completion)
- **When:** During quest execution (collected), after completion (persisted)
- **Format:** JSON-serializable object

**Sharing Contract:**
- **Shareable:** Optional (for analysis, not for quest exchange)
- **Format:** JSON array of evidence objects
- **Use case:** Export for analysis, backup, or mastery calculation
- **Privacy:** User consent required (evidence may contain performance data)

**Ephemeral:**
- Nothing — evidence is pure data, fully serializable

**Never:**
- Never persist without QuestRun context (evidence is meaningless without run)
- Never share without user consent (privacy concern)
- Never store raw audio in evidence (too large, privacy concern)

**Relationship to recipeId:**
- Current: No evidence collection (completion only)
- Future: Evidence is collected during quest execution
- Migration: Add evidence collection to existing recipes
- Transitional: Evidence is optional (not all quests collect evidence)

**Future relation to packages:**
- Evidence is never packaged (local history only)
- Evidence may be exported for analysis (separate from packages)
- Mastery state (derived from evidence) may be exported for backup

**Example Evidence:**
```json
{
  "id": "ev-001",
  "questRunId": "run-001",
  "type": "completion",
  "timestamp": 1704067800000,
  "data": {
    "roundsCompleted": 3,
    "roundsTotal": 3
  }
}
```

---

### 2.7 Mastery

**What it is:** Aggregated mastery state for a song/block (derived from evidence)

**Persistence Contract:**
- **Persisted:** Full mastery state (scores + progression state)
- **Location:** Local mastery store (browser storage, future: cloud storage)
- **When:** After each quest completion (updated incrementally)
- **Format:** JSON-serializable object

**Sharing Contract:**
- **Shareable:** Optional (for backup, not for quest exchange)
- **Format:** JSON object with mastery scores + progression state
- **Use case:** Export for backup, import for restore
- **Privacy:** User consent required (mastery reveals performance history)

**Ephemeral:**
- Nothing — mastery is pure data, fully serializable

**Never:**
- Never persist without song/block context (mastery is meaningless without context)
- Never share without user consent (privacy concern)
- Never store raw evidence in mastery (mastery is aggregated, not raw)

**Relationship to recipeId:**
- Current: No mastery tracking (no evidence collection)
- Future: Mastery is calculated from evidence
- Migration: Initialize mastery from historical evidence (if available)
- Transitional: Mastery is optional (not all songs have mastery data)

**Future relation to packages:**
- Mastery is never packaged (local state only)
- Mastery may be exported for backup (separate from packages)
- Mastery may be imported for restore (separate from packages)

**Example Mastery:**
```json
{
  "songId": "song-001",
  "blockId": "chorus-1",
  "scores": {
    "completion": 0.9,
    "accuracy": 0.85,
    "consistency": 0.8,
    "confidence": 0.9
  },
  "progressionState": {
    "currentTempo": 1.0,
    "currentBacking": "instrumental",
    "unlockedCapabilities": ["pitch-guide", "word-sync"]
  },
  "lastPracticed": 1704067800000,
  "totalPracticeTime": 3600000
}
```

---

## 3. Persistence Stack Recommendation

### 3.1 Local Persistence (Browser Storage)

**What to persist:**
- QuestCardDef (user library)
- QuestRun (history, after completion)
- Evidence (embedded in QuestRun)
- Mastery (aggregated state)

**Storage mechanism:**
- IndexedDB (structured data, large capacity)
- LocalStorage (fallback for small data)

**Schema:**
```
questCards/
  {cardId}.json — QuestCardDef

questRuns/
  {runId}.json — QuestRun (metadata + evidence)

mastery/
  {songId}/{blockId}.json — Mastery state
```

**Backup/Export:**
- Export all QuestCards as JSON array
- Export all QuestRuns as JSON array
- Export all Mastery as JSON array
- Import from JSON array (validate before import)

