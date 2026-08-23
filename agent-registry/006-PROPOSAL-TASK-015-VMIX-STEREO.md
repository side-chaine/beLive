# [@PROPOSAL patch] · TASK-015 · V-Mix СТЕРЕО-РАЗВОДКА (vocals L / music center / mic R → MASTER) · от 006 · 22.08
**Статус:** жду SYNC-OK 007 → dispatch. ❄️ Frozen-read эталона VocalMix.ts; правки в StemOrchestrator/MonitorRouter/ControlDeck — не frozen.

## КЛЮЧЕВОЕ ОТКРЫТИЕ (упрощает S1)
`StemOrchestrator.addStem` (:51) УЖЕ подключает **только 'vocals'** вторым выходом к `vocalHallInput`! Значит:
- **Голос для L-канала берём БЕЗ новых тапов** — прямой коннект `vocalHallInput → vmixVocalIn` (входной гейн 1.0, до hall-обработки).
- Для ЦЕНТРА нужен «music без вокала» — programInput содержит вокал, поэтому добавляем точечный тап пер-стемно (единственное изменение оркестратора).

## ГРАФ ПАКЕТА (паритет VocalMix.ts: merger 2ch, без StereoPanner/Delay ⇒ latency 0)

### E1 · src/audio/engine-v3/core/StemOrchestrator.ts (S1)
```ts
private _vmixCenter: AudioNode | null = null;

/** TASK-015: тап центра v-Mix — все стемы КРОМЕ vocals. */
setVMixCenterTap(node: AudioNode | null): void {
  if (this._vmixCenter) for (const [id, st] of this.stems) {
    if (id !== 'vocals') { try { st.outputNode.disconnect(this._vmixCenter) } catch {} }
  }
  this._vmixCenter = node;
  if (node) for (const [id, st] of this.stems) {
    if (id !== 'vocals') st.outputNode.connect(node);
  }
}
```
И в `addStem` рядом с :51 (`if (id==='vocals' && _vocalHall)...`) добавить:
```ts
if (id !== 'vocals' && this._vmixCenter) stem.outputNode.connect(this._vmixCenter);
```
(id у игрока публичный: StemPlayerV3.ts:23; outputNode :79 — duckGain, внешний контракт не ломаем; тапы АДДИТИВНЫЕ — programMix не отключаем.)

### E2 · src/audio/engine-v3/monitor/MonitorRouter.ts (S3+S2)
Поля (рядом с micInput :25):
```ts
readonly vmixCenterIn = ctx.createGain()   // ← orchestrator.setVMixCenterTap
readonly vmixVocalIn  = ctx.createGain()   // ← vocalHallInput (вокал, L)
readonly vmixMicIn    = ctx.createGain()   // ← micInput (мик, R)
private readonly _vmixMerger = ctx.createChannelMerger(2)
private readonly _vmixMaster  = ctx.createGain()  // 0.0 = OFF
```
В constructor после мик-каскада (:114):
```ts
this.vmixCenterIn.connect(this._vmixMerger, 0, 0);
this.vmixCenterIn.connect(this._vmixMerger, 0, 1);  // центр = оба канала
this.vmixVocalIn.connect(this._vmixMerger, 0, 0);   // L
this.vmixMicIn.connect(this._vmixMerger, 0, 1);     // R
this._vmixMerger.connect(this._vmixMaster);         // БЕЗ delay-узлов ⇒ latency 0
this._vmixMaster.connect(ctx.destination);          // MASTER (рулинг Ц3)
this.vocalHallInput.connect(this.vmixVocalIn);      // S1: вокал уже тут (Orchestrator:51)
this.micInput.connect(this.vmixMicIn);              // S2: постоянный тап, мастер гейтит
```
Метод (рядом setRouteMain :139 — тот же паттерн crossfade 20ms):
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
⚠️ 464b-тап `_monitorMaster→ctx.destination` не конфликтует: его ветки (_musicGain/_monitorGain) по умолчанию 0.0.

### E3 · src/components/ControlDeck.tsx :349-374 (S4)
В обработчике кнопки VMix v3-ветку заменить (фасад оставить только для engineMode==='v2'):
```tsx
const router = (window as any).__belive?.monitorRouter;
if (router?.setVMix) {
  const next = !vocalMixEnabled;
  router.setVMix(next);
  useAudioStore.setState({ vocalMixEnabled: next });
} else if (ae) { /* legacy v2: старые enable/disableVocalMix */ }
```
title кнопки: «VMix — vocals L / music center / mic R (нужен включённый 🎤)».

### E4 · Связка с TASK-014 (порядок паков!)
E3 зависит от `__belive.monitorRouter` (E2 из ЭТОГО пака) и от 🎤-тумблера (463/464: стрим подключается к micInput только при 🎤 ON). **Без 🎤 ON правый канал молчит** — задокументировано в title. Рекомендация: применять ПОСЛЕ 463/464a/b.

## ИНТЕРАКЦИИ
- **S5 stemsEnabled×VMix:** №18-BUS H3.3 глушит music+backing через pipeline.setStemMuted (ДО outputNode) → центр замолкает автоматически, вокал L продолжает — это karaoke-minus-off режим, паритет духа FR-014. Задокументировать.
- **№18-BUS busFactor:** шина масштабирует stem.volume ДО тапов (outputNode последний в цепи :199) → центр и всё остальное честно следуют фейдеру.
- **Track-change:** pipeline.reset пересоздаёт стемы → addStem-хук (E1) сам восстанавливает центр-тап; VMix-стейт (мастер-гейн) переживает, т.к. узлы роутера статичны.
- **Latency 0:** в пути merger нет ни одного DelayNode — паритет эталона (TASK-001: без StereoPanner/Delay).

## РИСКИ
- R1 MED: забытый defaultBranch при ON = задвоение вокала (center+L) → crossfade в setVMix обязателен, тест: solo vocals при VMix ON слышен ТОЛЬКО слева.
- R2 LOW: merger up/down-mix правила — входы моно-гейны, ChannelMerger(2) принимает моно на каждый вход штатно (эталон работает так же).
- R3 INFO: mic R слышен только при 🎤 ON (TASK-014) — UX задокументирован в title кнопки.
- R4 LOW: VMix ON при no-stems треке: центр пуст (нет music-стемов), вокал L + mic R — вырожденный но корректный кейс; тест-ячейка.
