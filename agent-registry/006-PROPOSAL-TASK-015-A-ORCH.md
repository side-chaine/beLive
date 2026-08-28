# [@PROPOSAL patch] · TASK-015 · PART A · StemOrchestrator (S1 — center tap) · от 006 · 22.08
**Часть 1 из 3** (следующие: B=MonitorRouter, C=ControlDeck). Статус: жду SYNC-OK 007 → dispatch. ❄️ Frozen-read эталона VocalMix.ts; правки НЕ в frozen-зоне.

## КЛЮЧЕВОЕ ОТКРЫТИЕ (упрощает весь дизайн)
`StemOrchestrator.addStem` (src/audio/engine-v3/core/StemOrchestrator.ts:51) УЖЕ подключает **только 'vocals'** вторым выходом к `vocalHallInput`:
```ts
if (id === 'vocals' && this._vocalHall) stem.outputNode.connect(this._vocalHall)
```
Следствие:
- **Голос для L-канала v-Mix берём БЕЗ новых тапов** — прямой коннект `vocalHallInput → vmixVocalIn` (Part B).
- Для ЦЕНТРА нужен «music без вокала»: `programInput` содержит вокал, поэтому центр = точечный пер-стемный тап всех стемов КРОМЕ vocals.

## E1 · src/audio/engine-v3/core/StemOrchestrator.ts (S1)
Поле (рядом с `private _vocalHall` :18):
```ts
private _vmixCenter: AudioNode | null = null;

/** TASK-015: тап центра v-Mix — все стемы КРОМЕ vocals. Аддитивный (programMix не отключаем). */
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
В `addStem` рядом с :51 (`if (id==='vocals' && _vocalHall)...`) добавить:
```ts
if (id !== 'vocals' && this._vmixCenter) stem.outputNode.connect(this._vmixCenter);
```
(id публичный: StemPlayerV3.ts:23 `readonly id: StemId`; outputNode :79 — duckGain, внешний контракт не ломаем; тапы аддитивные, programMix не трогаем). `stems` приватен (:16) ⇒ метод живёт ВНУТРИ класса.

## CROSS-REF
- Полный граф пакета и узлы MonitorRouter → **Part B**.
- Кнопка ControlDeck + порядок применения + риски → **Part C**.
