# MICRO-PACK V007 → Operator  (batch: G1 + G2 + F-2 G14)
**Coordinator:** 007 (V007, Windows). You are Operator — BLIND EXECUTOR.
**Rule:** Apply ONLY the diffs below. Do NOT touch any FROZEN file.
**FROZEN (never edit):** `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`,
`src/bridges/*`, `src/services/track.orchestrator.ts`, any `_` private field (note: this pack ADDS a new field `_micCompensationMs` and writes existing `_micDelay` — those are allowed; do NOT edit AudioEngineV2/patchV1/bridges/track.orchestrator).

---

## T1 — G1 fix: event BEFORE tool-calls (src/js/ui/ai-chat-ui.ts)
Current (vanilla path end):
```ts
      this.checkForToolCalls(fullText);

      // ▼ Единый контракт завершения для ВАНИЛЬНОГО пути (в обход aiHub.sendMessage)
      aiHub.dispatchEvent(new CustomEvent(ASSISTANT_RESPONSE_COMPLETED, {
        detail: { fullText, source: 'vanilla-chat' },
      }));
```
Replace with:
```ts
      // ▼ Единый контракт завершения для ВАНИЛЬНОГО пути — ДО tool-calls,
      // чтобы кью/аватар не пропали, если checkForToolCalls бросит (G1)
      aiHub.dispatchEvent(new CustomEvent(ASSISTANT_RESPONSE_COMPLETED, {
        detail: { fullText, source: 'vanilla-chat' },
      }));

      // tool-calls — нефатально: любой throw НЕ должен гасить уже отыгранный кью/аватар
      try {
        await this.checkForToolCalls(fullText);
      } catch (toolErr) {
        console.error('[ai-chat-ui] checkForToolCalls failed (non-fatal):', toolErr);
      }
```

## T2 — G2 fix: lazy gesture-unlock (src/character/sound/CharacterSoundManager.ts)
Current `init()`:
```ts
  init(): void {
    aiHub.on(ASSISTANT_RESPONSE_COMPLETED, () => this.playCue());
    if (typeof window !== 'undefined') {
      window.addEventListener('team-m.report-arrived', () => this.playNotification());
    }
  }
```
Replace with (insert gesture-unlock BEFORE the listeners):
```ts
  init(): void {
    // G2-fix: Billy/Expert-чаты никогда не зовут unlock() → AudioContext спит → звука нет.
    // Гарантируем resume по первому жесту юзера (autoplay-policy), до прихода ответа.
    if (typeof window !== 'undefined') {
      const unlockOnGesture = () => {
        this.unlock();
        window.removeEventListener('pointerdown', unlockOnGesture);
        window.removeEventListener('keydown', unlockOnGesture);
      };
      window.addEventListener('pointerdown', unlockOnGesture);
      window.addEventListener('keydown', unlockOnGesture);
    }
    aiHub.on(ASSISTANT_RESPONSE_COMPLETED, () => this.playCue());
    if (typeof window !== 'undefined') {
      window.addEventListener('team-m.report-arrived', () => this.playNotification());
    }
  }
```

## T3 — F-2 G14: mic self-monitor latency compensation (src/audio/engine-v3/monitor/MonitorRouter.ts)
### T3a — add stored field (after `private readonly _captureGain: GainNode`):
```ts
  private _micCompensationMs = 0; // G14: компенсация latency самоконтроля (ms); хранится, чтобы setDelayMs/setCompensateTarget не затирали
```

### T3b — setMicMonitor (apply compensation when ON):
Current:
```ts
  setMicMonitor(on: boolean, volume = 1.0): void {
    this._monitorGain.gain.value = on ? Math.max(0, Math.min(1, volume)) : 0
  }
```
Replace with:
```ts
  setMicMonitor(on: boolean, volume = 1.0): void {
    if (on) {
      // G14: компенсируем latency самоконтроля (~outputLatency, ~43мс на проводе),
      // чтобы мик в наушниках не опережал playback.
      const compMs = (this.programInput.context.outputLatency || 0) * 1000
      this._micCompensationMs = compMs
      this._micDelay.delayTime.value = compMs / 1000
    }
    this._monitorGain.gain.value = on ? Math.max(0, Math.min(1, volume)) : 0
  }
```

### T3c — setDelayMs (do NOT wipe mic compensation):
Current:
```ts
  setDelayMs(ms: number): void {
    const v = Math.max(0, Math.min(1000, ms)) / 1000
    this._mainDelay.delayTime.value = v
    this._micDelay.delayTime.value = 0
  }
```
Replace with:
```ts
  setDelayMs(ms: number): void {
    const v = Math.max(0, Math.min(1000, ms)) / 1000
    this._mainDelay.delayTime.value = v
    // G14: НЕ затираем компенсацию микрофона (раньше было =0). Возвращаем сохранённое значение.
    this._micDelay.delayTime.value = this._micCompensationMs / 1000
  }
```

### T3d — setCompensateTarget (do NOT wipe mic compensation):
Current:
```ts
  setCompensateTarget(t: 'monitor' | 'main'): void {
    if (t === 'monitor') {
      this._mainDelay.delayTime.value = 0
    } else {
      this._micDelay.delayTime.value = 0
    }
  }
```
Replace with:
```ts
  setCompensateTarget(t: 'monitor' | 'main'): void {
    if (t === 'monitor') {
      this._mainDelay.delayTime.value = 0
    } else {
      this._mainDelay.delayTime.value = 0 // main-path delay сброшен
    }
    // G14: mic-компенсация НЕ затирается (раньше this._micDelay = 0)
    this._micDelay.delayTime.value = this._micCompensationMs / 1000
  }
```

---

## VERIFY (mandatory before reporting back)
1. `npx tsc --noEmit 2>&1 | grep -c "error TS"` → MUST be exactly **314**.
2. `npm run test 2>&1 | tail -6` → vitest MUST be **763/763** (files 62/64, 2 legacy load-error expected).
3. Confirm NO frozen file modified: `git diff --stat` must NOT include AudioEngineV2.ts / patchV1.ts / bridges/* / track.orchestrator.ts.
4. Report: tsc count, vitest result, files changed, any error.
