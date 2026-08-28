---
status: DECISION-PACK (ready to apply) · 2026-08-25 · agent: 007_Hub
basis: Ц3 frozen-verdict (V3-own file, inside-class writes legal); code-read MonitorRouter.ts
frozen: NONE (MonitorRouter.ts + ControlDeck.tsx — V3-own, not in frozen list)
---

# MICRO-PACK-PC-MONITOR-ROUTER — fix setCompensateTarget + debug tails + encapsulation getter

## Context (P1, PC-zone, frozen-CLEAN per Ц3 25.08)
`MonitorRouter.setCompensateTarget(:254-262)` zeroes `this._mainDelay.delayTime.value` in BOTH branches → for target `'main'` the main-path calibration delay (R8 seed, set via `setDelayMs`/PulseCalibrator) is lost → R8 calibration broken. Plus RECON-3 debug tails (`dumpState` calls) and an encapsulation break: `ControlDeck.tsx:413` reads `(router as any)._monitorGain`.

Ц3 verdict: V3-own file, inside-class writes legal; `(router as any)` = code smell fixed by getter. No OVERRIDE needed.

## Fix (all in V3-own files — legal per Ц3)
### 1. Store main compensation (mirror `_micCompensationMs`)
Add field near line 53:
```ts
private _mainCompensationMs = 0; // R8: main-path delay compensation (ms); stored so target-switch не затирает
```
In `setDelayMs(ms)` (line 246) — store before applying:
```ts
setDelayMs(ms: number): void {
  const clamped = Math.max(0, Math.min(1000, ms))
  this._mainCompensationMs = clamped
  const v = clamped / 1000
  this._mainDelay.delayTime.value = v
  this._micDelay.delayTime.value = this._micCompensationMs / 1000
}
```

### 2. setCompensateTarget — differentiate branches
```ts
setCompensateTarget(t: 'monitor' | 'main'): void {
  // 'monitor' → main path gets NO delay (monitor compensated via mic delay)
  // 'main'    → main path keeps its stored R8 calibration delay
  this._mainDelay.delayTime.value = t === 'monitor' ? 0 : this._mainCompensationMs / 1000
  this._micDelay.delayTime.value = this._micCompensationMs / 1000
}
```

### 3. Remove RECON-3 debug tails
- Delete `this.dumpState('constructor')` (line 158)
- Delete `this.dumpState(\`setRouteMain(${on})\`)` (line 191)
- Delete `this.dumpState(\`setVMix(${on})\`)` (line 209)
- Delete the `dumpState` method (lines 161-164, RECON-3 diagnostic).

### 4. Encapsulation getter (replaces `(router as any)._monitorGain`)
In MonitorRouter add:
```ts
/** Read-only monitor level for diagnostics (replaces ControlDeck `as any` access) */
get monitorLevel(): number { return this._monitorGain.gain.value }
```
In `src/components/ControlDeck.tsx:413` change:
```ts
const g = (router as any)._monitorGain.gain.value;
```
to:
```ts
const g = router.monitorLevel;
```

## Verify
- `npx tsc --noEmit` → 0 new (baseline 313); `npx vitest run` → 769.
- R8: after `setDelayMs(seed)` + `setCompensateTarget('main')`, `_mainDelay.delayTime.value === seed/1000` (calibration preserved).
- `setCompensateTarget('monitor')` → `_mainDelay.delayTime.value === 0`, mic delay intact.
- ControlDeck MON-PROBE logs `router.monitorLevel` (no `as any`).

## Notes
- This pack OWNS the MonitorRouter/HPS logic (PC-zone per REGISTRY §1). Mac's uncommitted WIP in these files is patch-transported to PC; this pack applies ON TOP of that WIP to fix the bug.
- Frozen: NONE touched.
