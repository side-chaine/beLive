# MICRO-PACK V007-006 — TASK-015 fix: V-Mix фейдеры музыки и вокала

**Автор:** 007 (coordinator) · **Исполнитель:** Operator (blind)
**Статус:** READY · **Frozen:** НЕ ТРОГАТЬ (`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-private поля)
**Канон:** `tsc --noEmit` ровно **314** · `vitest run` **763/763**

---

## 🐞 Баг (подтверждён в консоли + root-cause от explore-agent)
При активном V-Mix (`MonitorRouter.setVMix(true)`) красный фейдер музыки и слайдер вокала **не меняют звук**.
`ae.setStemVolume/setVocalsVolume ignored — V3 active` в логе — НЕ баг (это №18-BUS H4.1 gard по дизайну).

**Root cause (точный):**
- `vmixCenterIn` (центр/минус V-Mix сплита) питался ТОЛЬКО от `StemOrchestrator.setVMixCenterTap` → `stem.outputNode` оркестратора. В V3-pipeline режиме оркестратор **пуст** (стемы живут в `HybridPipelineService`) → `vmixCenterIn` получает 0 сигнала → красный фейдер (`pipeline.setBusVolume('music-bus')` → рампит `stretchGain` music-стемов) масштабирует сигнал, который НЕ доходит до `vmixCenterIn`. → тишина.
- `vmixVocalIn` питался от `vocalHallInput` (MonitorRouter:148), который тапает **pre-fader** вокал-сенд (`instance.outputNode` ДО `stretchGain`, HybridPipelineService:209). Слайдер вокала рампит `stretchGain`, который ВЫШЕ по графу → не влияет на `vmixVocalIn`. → тишина.
- В обычном (не V-Mix) режиме оба работают: музыка идёт `pipeline.outputNode → programInput → _defaultBranch` (stretchGain В пути). Баг только при V-Mix, т.к. `_defaultBranch` глушится, а единственный слышимый путь — merger от `vmixCenterIn`/`vmixVocalIn`, оба мертвы/pre-fader.

Фикс = скормить V-Mix-входы **post-fader** `stretchGain` из пайплайна (доделка TASK-015).

---

## 🔧 Правки (точные old→new)

### ФАЙЛ 1: `src/audio/engine-v3/pipeline/HybridPipelineService.ts`

**A) Приватные цели — после `private _vocalHallSource` (строка 81)**
```ts
  private _vocalHallTarget: AudioNode | null = null
  private _vocalHallSource: AudioNode | null = null
```
→
```ts
  private _vocalHallTarget: AudioNode | null = null
  private _vocalHallSource: AudioNode | null = null
  /** TASK-015 fix: V-Mix centre (music-минус) питается post-fader пайплайн-стемами */
  private _vmixCenterTarget: AudioNode | null = null
  /** TASK-015 fix: V-Mix vocal-L питается post-fader вокальным стемом */
  private _vmixVocalTarget: AudioNode | null = null
```

**B) Публичные сеттеры — сразу после метода `setVocalHallTarget` (после строки 181)**
```ts
  /** R1: задать цель vocal-hall (router.vocalHallInput). Вызывается из bootAether. */
  setVocalHallTarget(target: AudioNode | null): void {
    this._vocalHallTarget = target
    if (this._vocalHallSend && target) {
      try { this._vocalHallSend.disconnect() } catch {}
      this._vocalHallSend.connect(target)
      // 428: после полного disconnect пере-подключаем R1-метр (иначе тап разорван)
      if (this._vocalHallMeter) this._vocalHallSend.connect(this._vocalHallMeter)
    }
  }
```
→ (добавить два сеттера после)
```ts
  /** R1: задать цель vocal-hall (router.vocalHallInput). Вызывается из bootAether. */
  setVocalHallTarget(target: AudioNode | null): void {
    this._vocalHallTarget = target
    if (this._vocalHallSend && target) {
      try { this._vocalHallSend.disconnect() } catch {}
      this._vocalHallSend.connect(target)
      // 428: после полного disconnect пере-подключаем R1-метр (иначе тап разорван)
      if (this._vocalHallMeter) this._vocalHallSend.connect(this._vocalHallMeter)
    }
  }

  /** TASK-015 fix: задать цель V-Mix centre (router.vmixCenterIn) — post-fader music-стемы */
  setVMixCenterTarget(target: AudioNode | null): void {
    this._vmixCenterTarget = target
  }
  /** TASK-015 fix: задать цель V-Mix vocal-L (router.vmixVocalIn) — post-fader вокал */
  setVMixVocalTarget(target: AudioNode | null): void {
    this._vmixVocalTarget = target
  }
```

**C) loadStem — после `this._stretchGains.set(stemId, stretchGain)` (строка 214)**
```ts
        stretchGain.connect(this._chainA.mergeGain)
        this._stretchGains.set(stemId, stretchGain)
```
→
```ts
        stretchGain.connect(this._chainA.mergeGain)
        this._stretchGains.set(stemId, stretchGain)
        // TASK-015 fix: V-Mix centre = post-fader non-vocal стемы; vocal = post-fader вокал
        if (this._vmixCenterTarget && stemId !== 'vocals') {
          try { stretchGain.connect(this._vmixCenterTarget) } catch {}
        }
        if (this._vmixVocalTarget && stemId === 'vocals') {
          try { stretchGain.connect(this._vmixVocalTarget) } catch {}
        }
```

**D) play() reconnect loop (строки 273-278)**
```ts
      for (const [stemId, g] of this._stretchGains.entries()) {
        try { g.disconnect() } catch {}
        g.connect(this._chainA.mergeGain)
        const meter = this._stretchMeters.get(stemId)
        if (meter) g.connect(meter)
      }
```
→
```ts
      for (const [stemId, g] of this._stretchGains.entries()) {
        try { g.disconnect() } catch {}
        g.connect(this._chainA.mergeGain)
        const meter = this._stretchMeters.get(stemId)
        if (meter) g.connect(meter)
        // TASK-015 fix: вернуть V-Mix тапы (g.disconnect() выше снёс все исходящие рёбра)
        if (this._vmixCenterTarget && stemId !== 'vocals') {
          try { g.connect(this._vmixCenterTarget) } catch {}
        }
        if (this._vmixVocalTarget && stemId === 'vocals') {
          try { g.connect(this._vmixVocalTarget) } catch {}
        }
      }
```

### ФАЙЛ 2: `src/audio/engine-v3/monitor/MonitorRouter.ts`

**E) Убрать pre-fader двойную подачу вокала в vmixVocalIn (строка 148)**
```ts
    this._vmixMaster.connect(ctx.destination);          // MASTER (рулинг Ц3)
    this.vocalHallInput.connect(this.vmixVocalIn);      // вокал уже тут (Orchestrator addStem)
    this.micInput.connect(this.vmixMicIn);              // постоянный тап, мастер гейтит
```
→
```ts
    this._vmixMaster.connect(ctx.destination);          // MASTER (рулинг Ц3)
    this.micInput.connect(this.vmixMicIn);              // постоянный тап, мастер гейтит
```
(Примечание: `vocalHallInput → _vocalHallGain → _mainDelay` — R1 pre-fader hall — НЕ трогать, сохраняем инвариант.)

### ФАЙЛ 3: `src/main.tsx`

**F) Пробросить V-Mix цели при буте (после строки 164)**
```ts
          pipeline.outputNode.connect(router.programInput)
          pipeline.setVocalHallTarget(router.vocalHallInput)
```
→
```ts
          pipeline.outputNode.connect(router.programInput)
          pipeline.setVocalHallTarget(router.vocalHallInput)
          pipeline.setVMixCenterTarget(router.vmixCenterIn)
          pipeline.setVMixVocalTarget(router.vmixVocalIn)
```

---

## ✅ Верификация (Оператор обязан выполнить и отчитаться)
1. `npx tsc --noEmit 2>&1 | grep -c "error TS"` → ровно **314** (ни больше, ни меньше).
2. `npx vitest run 2>&1 | tail -5` → **763 passed** / 763 (files 62/64, 2 legacy load-error).
3. Frozen-зоны нетронуты: `grep -nE "AudioEngineV2|patchV1|src/bridges|track.orchestrator" src/audio/engine-v3/pipeline/HybridPipelineService.ts src/audio/engine-v3/monitor/MonitorRouter.ts src/main.tsx` → 0 совпадений (кроме легитимных упоминаний вне правок).
4. `git diff --stat` → только 3 файла выше.

## 📝 Формат отчёта Оператора
- Строка 1: `APPLIED` / `FAILED`
- tsc count, vitest count
- git diff --stat
- Любые отклонения от old-якорей (если текст не совпал — СТОП, не угадывать).
