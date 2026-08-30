# 463-MICRO-PACK · TASK-014 · ЖИВОЙ МИК-ТУМБЛЕР (MicSourceV3 + самоконтроль) · по [@PROPOSAL] 006

**SYNC-OK:** 007 прочитал `agent-registry/006-PROPOSAL-TASK-014-MIC-TOGGLE.md` полностью. Реализуем E1-E4 дословно + R1-гвард из рисков.
**Семантика:** ON = acquire(+1 навсегда до OFF) + стрим→micInput + самомонитор в наушники; OFF = дисконнект + release(−1; рекордерский +1 переживает активную запись). Слайдер громкости микра влияет только на самоконтроль (_monitorGain); запись всегда raw. Cleanup при track-change НЕ нужен (user-pref).

## EDIT 1 · src/audio/engine-v3/monitor/MonitorRouter.ts — публичный API
Рядом с dumpState/recon-методами добавить:
```ts
/** TASK-014: самоконтроль микра (наушники). G14 latency-компенсация — отдельный пак F-2. */
setMicMonitor(on: boolean, volume = 1.0): void {
  this._monitorGain.gain.value = on ? Math.max(0, Math.min(1, volume)) : 0
}
```

## EDIT 2 · src/main.tsx — экспозиция роутера
В блоке диагностики __belive (рядом со строкой `.pipeline = ...`, ~:174-178) добавить:
```ts
;(window as any).__belive.monitorRouter = router
```
Легаси `__router` (:111) ОСТАВИТЬ для совместимости логов.

## EDIT 3 · src/components/ControlDeck.tsx :379-392 — заменить onClick заглушки ЦЕЛИКОМ на:
```tsx
              onClick={async () => {
                const belive = (window as any).__belive;
                const src = belive?.micSource;
                if (!src) return;
                if (micEnabled) {
                  try { (belive.__micMonitorNode as MediaStreamAudioSourceNode)?.disconnect(); } catch {}
                  belive.__micMonitorNode = null;
                  try { belive.monitorRouter?.setMicMonitor(false); } catch {}
                  src.release();
                  setMicEnabled(false);
                  return;
                }
                try {
                  const stream = await src.acquire();
                  const ctx = belive?.pipeline?.ctx;
                  const router = belive?.monitorRouter;
                  if (ctx && router) {
                    // R1-гвард: быстрый ON/OFF/ON — переиспользуем слот
                    try { (belive.__micMonitorNode as MediaStreamAudioSourceNode)?.disconnect(); } catch {}
                    const node = ctx.createMediaStreamSource(stream);
                    node.connect(router.micInput);
                    belive.__micMonitorNode = node;
                    router.setMicMonitor(true);
                    setMicEnabled(true);
                  } else {
                    src.release();
                    console.warn('[ControlDeck] mic monitor недоступен (нет router/ctx)');
                  }
                } catch (e) { console.warn('[ControlDeck] mic enable failed', e); }
              }}
```
Остальной JSX кнопки и слайдер НЕ трогать (слайдер оставляем как есть — его ae.setMicrophoneVolume no-op в v3, реальный сеттер громкости самоконтроля придёт след. итерацией).

## VERIFICATION (канон А4)
tsc 314 (diff IDENTICAL) · vitest files 61+1?/63..64 (новых тестов нет), tests 763/763. FROZEN-OK: MonitorRouter/main.tsx/ControlDeck не frozen.

## РИСКИ (приняты, задокументированы 006)
R1 двойной коннект → гвард reuse ✅ включён · R2 холодный клик до бута → else-release ✅ · R3 _micDelay=0 сдвиг самоконтроля → целевой G14/F-2 · R4 micEnabled-стейт не переживает remount → опциональный хвост следующего пака.
