# MICRO-PACK V007 → Operator  (batch: M3 + D3 + Layer-2)
**Source of truth:** `team-m/reports/mac-007/work-start-m2-m3-m4.md` (M007 proposal, status:done/proposal)
**Coordinator:** 007 (V007, Windows). You are Operator — BLIND EXECUTOR.
**Rule:** Apply ONLY the diffs below. Do NOT touch any FROZEN file.
**FROZEN (never edit):** `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`,
`src/bridges/*`, `src/services/track.orchestrator.ts`, any `_` private field.

---

## T1 — M3 (additive): `AssistantProfile` type + `ASSISTANT_PROFILES`
File: `src/js/ai/registry.ts`
Append at END of file (after `export const aiHub = new AIHub();`):

```ts
// === Character-AI: data-driven assistant profiles (M3) ===
import type { CueSpec } from '../../character/sound/CharacterSoundManager';

export interface AssistantProfile {
  id: string;
  name: string;
  systemPrompt: string;
  soundProfile?: CueSpec;
  guestGate?: boolean; // true → гость НЕ допускается в платный чат (D4)
}

// Литерал (НЕ импорт значения CUE_DEFAULT — избегаем runtime-цикла registry↔CharacterSoundManager)
export const ASSISTANT_PROFILES: AssistantProfile[] = [
  {
    id: 'billy',
    name: 'Билли',
    systemPrompt: 'Ты — Билли, дружелюбный ИИ-помощник beLive.',
    soundProfile: { wave: 'sine', gain: 0.15, dur: 0.2, points: [[880, 0], [1760, 0.2]] },
    guestGate: false,
  },
  // TODO(M007/Mac, GPT A–E): English / Vocal Coach / Hero — реальные soundProfile
];

export function getProfileSound(id: string): CueSpec | undefined {
  return ASSISTANT_PROFILES.find((p) => p.id === id)?.soundProfile;
}
```

## T2 — D3 (new file + guard): `soundEnabled` setting
NEW FILE `src/js/ai/settings/ai-settings.store.ts`:
```ts
// src/js/ai/settings/ai-settings.store.ts
import { create } from 'zustand';

interface AISettingsState {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

export const useAISettingsStore = create<AISettingsState>((set) => ({
  soundEnabled: true,
  setSoundEnabled: (v) => set({ soundEnabled: v }),
}));

export const getSoundEnabled = (): boolean => useAISettingsStore.getState().soundEnabled;
```

EDIT `src/character/sound/CharacterSoundManager.ts`:
- Add import (near top, after existing imports):
  `import { getSoundEnabled } from '../../js/ai/settings/ai-settings.store';`
- In `playCue`, change the guard line FROM:
  `    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;`
  TO:
  `    if (!this.enabled || !getSoundEnabled() || !this.ctx || this.ctx.state !== 'running') return;`

## T3 — Layer-2 (CORRECTED from M007's wrong `setState`)
M007's proposal called `CharacterSoundManager.setState('notification')` — that method does NOT exist.
Correct implementation: add a dedicated notification cue + method + listener.

EDIT `src/character/sound/CharacterSoundManager.ts`:
- After `CUE_DEFAULT` block, add:
```ts
// Layer-2: мягкий cue прихода отчёта от Mac-команды (440→660, тише)
export const NOTIFY_CUE: CueSpec = {
  wave: 'sine',
  gain: 0.12,
  dur: 0.18,
  points: [[440, 0], [660, 0.18]],
};
```
- After `playCue(...)` method, add:
```ts
  /** Layer-2: мягкий cue прихода отчёта от Mac-команды. */
  playNotification(): void {
    this.playCue(NOTIFY_CUE);
  }
```
- In `init()`, AFTER the existing `aiHub.on(ASSISTANT_RESPONSE_COMPLETED, () => this.playCue());` line, add:
```ts
    if (typeof window !== 'undefined') {
      window.addEventListener('team-m.report-arrived', () => this.playNotification());
    }
```

---

## VERIFY (mandatory before reporting back)
1. `npx tsc --noEmit 2>&1 | grep -c "error TS"` → MUST be exactly **314**.
2. `npm run test 2>&1 | tail -6` → vitest MUST be **763/763** (files 62/64, 2 legacy load-error expected).
3. Confirm NO frozen file was touched (grep your own diff).
4. Report: tsc count, vitest result, list of files changed, any unexpected error.
