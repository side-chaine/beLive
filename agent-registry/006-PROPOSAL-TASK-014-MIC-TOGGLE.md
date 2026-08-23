# [@PROPOSAL patch] · TASK-014 · Мик-тумблер ControlDeck → MicSourceV3 + самоконтроль · от 006 · 22.08
**Статус:** жду SYNC-OK 007 → dispatch Оператору. ❄️ Frozen не затронуты.

## ОТВЕТЫ НА ВОПРОСЫ

**Q1 (refcount):** ДА, держать +1 постоянно — ок. Refcount-дизайн MicSourceV3 явно под это (`acquire/release`, :21/:32/:45; «потребители берут stream через acquire/release» :4). Тумблер держит свой +1 весь ON-период; рекордер при записи добавляет СВОЙ +1 (:82) и снимает в teardown (:172). Toggle OFF во время активной записи: наш −1 не убьёт стрим (рекордерский +1 жив), монитор просто закроется. Toggle ON во время записи: +1 поверх — безопасно.

**Q2 (слайдер громкости):** живого сеттера в v3 НЕТ — API MicSourceV3 исчерпывается acquire/release/setDevice (:32/:45/:51). Паритет с V2 подтверждён комментом рекордера (:91 «Get raw mic stream (**unaffected by volume slider**)») — слайдер в V2 тоже не влиял на ЗАПИСЬ, он влиял на самоконтроль. Поэтому: громкость = **MonitorRouter._monitorGain** (каскад micInput→_micDelay→_monitorGain(:60, default 0.0=off)→_monitorMaster→monitorStream, :16/:84/:110-114) через новый публичный метод. Входной уровень в программу не нужен до F-2/v-Mix (в программу мик пойдёт только там — TASK-007).

**Q3 (самоконтроль):** каскад УЖЕ построен в MonitorRouter и ждёт подключения (:16 future-коммент «Mic (future)→MicDelayNode→MonitorGain»). Подключаем стрим → micInput, открываем _monitorGain. `_micDelay.delayTime=0` сейчас; компенсация латентности (G14, цель 0мс wired) — ОСОЗНАННО в F-2, не здесь.

## HUNKS

**E1 · src/audio/engine-v3/monitor/MonitorRouter.ts** (не frozen) — рядом с dumpState/recon-методами:
```ts
/** TASK-014: самоконтроль микра (наушники). G14 latency-компенсация — отдельный пак F-2. */
setMicMonitor(on: boolean, volume = 1.0): void {
  this._monitorGain.gain.value = on ? Math.max(0, Math.min(1, volume)) : 0
}
```

**E2 · src/main.tsx** — в блок диагностики __belive (рядом :174-178, где `.pipeline`) добавить строку (router в той же области видимости, :103):
```ts
;(window as any).__belive.monitorRouter = router
```
(замена легаси-глобала `__router` :111 — тот оставить для совместимости логов)

**E3 · src/components/ControlDeck.tsx :384-393** — заменить заглушку целиком:
```tsx
onClick={async () => {
  const belive = (window as any).__belive;
  const src = belive?.micSource;
  if (!src) return;
  if (micEnabled) {
    try { belive.monitorRouter?.setMicMonitor(false); } catch {}
    src.release();                       // −1; рекордерский +1 переживёт активную запись
    setMicEnabled(false);
    return;
  }
  try {
    await src.acquire();                 // +1; стрим живёт весь ON-период
    const ctx = belive?.pipeline?.ctx;
    const router = belive?.monitorRouter;
    if (ctx && router) {
      const node = ctx.createMediaStreamSource(await Promise.resolve(src.stream ?? null) ?? null);
```
⚠️ УТОЧНЕНИЕ ПЕРЕД НАПИСАНИЕМ: acquire() уже возвращает MediaStream — использовать его напрямую:
```tsx
  try {
    const stream = await src.acquire();
    const ctx = belive?.pipeline?.ctx;
    const router = belive?.monitorRouter;
    if (ctx && router) {
      const node = ctx.createMediaStreamSource(stream);
      node.connect(router.micInput);     // micInput GainNode(1.0) публичный (:23/:84)
      (belive.__micMonitorNode = node);
      router.setMicMonitor(true);
      setMicEnabled(true);
    } else {
      src.release();                     // нет монитора — не держим даром
      console.warn('[ControlDeck] mic monitor недоступен (нет router/ctx)');
    }
  } catch (e) { console.warn('[ControlDeck] mic enable failed', e); }
}}
```
OFF-ветка дополняется дисконнектом перед release():
```tsx
    try { (belive.__micMonitorNode as MediaStreamAudioSourceNode)?.disconnect(); } catch {}
    (window as any).__belive.__micMonitorNode = null;
    try { belive.monitorRouter?.setMicMonitor(false); } catch {}
    src.release();
    setMicEnabled(false);
    return;
```

**E4 · Cleanup-guard:** при смене трека/размонтировании ControlDeck тумблер НЕ трогаем (user-pref уровня stemsEnabled; стрим переживает track-change сознательно — микрофон системный).

## РИСКИ
- R1 LOW: двойное подключение при быстром ON/OFF/ON — гвард: если `__micMonitorNode` существует, reuse (disconnect старый перед новым).
- R2 LOW: `window.__belive.monitorRouter` отсутствует при холодном клике до бута AETHER — ветка else-release уже отрабатывает (не держим acquire впустую).
- R3 INFO: _micDelay=0 → возможен слышимый сдвиг самоконтроля vs программа на проводных наушниках — ЦЕЛЕВОЙ фикс G14 в F-2 (задокументировано в E1-комменте).
- R4 INFO: micEnabled-стейт компонента не переживает remount ControlDeck — при remount стрим останется запущенным без подсветки кнопки; опциональный хвост (след. пак): init-effect синхронизирует стейт из `__belive.__micMonitorNode!=null`.
