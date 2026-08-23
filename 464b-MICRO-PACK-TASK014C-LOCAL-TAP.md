# 464b-MICRO-PACK · TASK-014c · ЛОКАЛЬНЫЙ ТАП МОНИТОРА + ПРОБА

**Гипотеза тишины:** monitorStream-плейбек через hidden <audio> ненадёжен после async-acquire (гест/ленивый элемент). Решение: постоянный локальный тап `_monitorMaster → ctx.destination`. Тишина по умолчанию сохранена (music-gain=0, monitor-gain=0 до enable) — философия «ноды вечно, громкости гейтят» не нарушена. Программа идёт в destination отдельной веткой (_defaultBranch) — задвоения нет: _monitorMaster получает ТОЛЬКО music-tap(0)+mic.

## EDIT 1 · src/audio/engine-v3/monitor/MonitorRouter.ts — конструктор, сразу после строки
`    this._monitorGain.connect(this._monitorMaster)`
добавить:
```ts
    // №464b (TASK-014c): локальный тап монитора на реальный выход.
    // music-tap по умолчанию 0.0 + mic-gain 0.0 до enable ⇒ тап молчит до включения.
    this._monitorMaster.connect(ctx.destination)
```

## EDIT 2 · src/components/ControlDeck.tsx — ON-ветка, сразу ПОСЛЕ `router.setMicMonitor(true);`
вставить:
```tsx
                    setTimeout(() => {
                      try {
                        const g = (router as any)._monitorGain.gain.value;
                        const st = (ctx as AudioContext).state;
                        console.log(`[MON-PROBE] monitorGain=${g} ctx=${st}`);
                      } catch {}
                    }, 150);
```

## VERIFICATION
tsc ровно 314 (grep -c "error TS") · vitest tests 763/763 · FROZEN-OK (MonitorRouter не frozen).
