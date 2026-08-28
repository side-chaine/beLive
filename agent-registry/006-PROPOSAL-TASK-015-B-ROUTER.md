# [@PROPOSAL patch] · TASK-015 · PART B · MonitorRouter (S2/S3 — vmix subgraph + setVMix) · от 006 · 22.08
**Часть 2 из 3** (A=StemOrchestrator, C=ControlDeck). Статус: жду SYNC-OK 007 → dispatch. ❄️ Frozen-read эталона VocalMix.ts; правки в MonitorRouter — НЕ frozen.

## ГРАФ ПАКЕТА (паритет VocalMix.ts: merger 2ch, БЕЗ StereoPanner/Delay ⇒ latency 0)
```
music-стемы → (Orchestrator.setVMixCenterTap) ─┐
                                                 ├→ vmixCenterIn ─┬→ merger ch0
                                                 │               └→ merger ch1   (центр = оба канала)
vocalHallInput (вокал, только 'vocals' :51) ───→ vmixVocalIn ────→ merger ch0     (L)
micInput (тумблер 🎤 ON из 463/464) ───────────→ vmixMicIn ──────→ merger ch1     (R)
merger → _vmixMaster → ctx.destination  (MASTER, рулинг Ц3)
```

## E2 · src/audio/engine-v3/monitor/MonitorRouter.ts
Поля (рядом с `micInput` :25):
```ts
readonly vmixCenterIn = ctx.createGain()   // ← orchestrator.setVMixCenterTap (Part A)
readonly vmixVocalIn  = ctx.createGain()   // ← vocalHallInput (вокал, L)
readonly vmixMicIn    = ctx.createGain()   // ← micInput (мик, R)
private readonly _vmixMerger = ctx.createChannelMerger(2)
private readonly _vmixMaster  = ctx.createGain()  // 0.0 = OFF
```
В constructor после мик-каскада (:114, `this._monitorMaster.connect(this.monitorStream)`):
```ts
this.vmixCenterIn.connect(this._vmixMerger, 0, 0);
this.vmixCenterIn.connect(this._vmixMerger, 0, 1);  // центр = оба канала
this.vmixVocalIn.connect(this._vmixMerger, 0, 0);   // L
this.vmixMicIn.connect(this._vmixMerger, 0, 1);     // R
this._vmixMerger.connect(this._vmixMaster);         // БЕЗ delay-узлов ⇒ latency 0
this._vmixMaster.connect(ctx.destination);          // MASTER (рулинг Ц3)
this.vocalHallInput.connect(this.vmixVocalIn);      // S1: вокал уже тут (Orchestrator:51)
this.micInput.connect(this.vmixMicIn);              // S2: постоянный тап, мастер гейтит OFF
```
Метод (рядом `setRouteMain` :139 — тот же паттерн crossfade 20ms):
```ts
/** TASK-015: v-Mix стерео-разводка ON/OFF. ON: defaultBranch глушится (иначе вокал задвоится center+L). */
setVMix(on: boolean): void {
  const now = this.programInput.context.currentTime, r = now + 0.02;
  for (const g of [this._defaultBranch, this._vmixMaster]) g.gain.cancelScheduledValues(now);
  this._defaultBranch.gain.setValueAtTime(this._defaultBranch.gain.value, now);
  this._vmixMaster.gain.setValueAtTime(this._vmixMaster.gain.value, now);
  this._defaultBranch.gain.linearRampToValueAtTime(on ? 0 : 1, r);
  this._vmixMaster.gain.linearRampToValueAtTime(on ? 1 : 0, r);
  this.dumpState(`setVMix(${on})`);
}
isVMixOn(): boolean { return this._vmixMaster.gain.value > 0.5 }
```
⚠️ 464b-тап `_monitorMaster→ctx.destination` не конфликтует: его ветки (`_musicGain`/`_monitorGain`) по умолчанию 0.0.

## CROSS-REF
- Тап центра в Orchestrator → **Part A**.
- Кнопка ControlDeck + порядок применения + риски → **Part C**.
