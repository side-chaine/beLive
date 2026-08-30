# 464-MICRO-PACK · TASK-014b · ПРОБУДИТЬ МОНИТОРНЫЙ ВЫХОД (мик слышно!)

**ROOT (найден чтением):** каскад мика заканчивается на `monitorStream = ctx.createMediaStreamDestination()` (MonitorRouter:78,105,114). MediaStreamDestination НЕ играет на колонки сам. DeviceManager владеет hidden `<audio srcObject=monitorStream>`, но создаёт его ЛЕНИВО (`_ensureAudio` приватный, зовётся только из setSinkId-флоу). На свежей загрузке никто не играет monitorStream ⇒ тишина. Программа слышна отдельно: `_defaultBranch→ctx.destination` (MonitorRouter:91).

## EDIT 1 · src/audio/engine-v3/monitor/DeviceManager.ts — публичный пробудитель
Добавить публичный метод рядом с приватным `_ensureAudio`:
```ts
  /** TASK-014b: гарантированно поднять и запустить мониторный <audio> (self-monitoring). */
  async ensureMonitorPlaying(): Promise<void> {
    await this._ensureAudio('monitor')
  }
```

## EDIT 2 · src/main.tsx — сохранить инстанс и экспонировать
2a. Строку (~:106):
```
      monitorEngine.setBackend(router, ctx, new DeviceManager(router.monitorStream, router.mainStream))
```
заменить на:
```
      const deviceManager = new DeviceManager(router.monitorStream, router.mainStream)
      monitorEngine.setBackend(router, ctx, deviceManager)
```
2b. В блоке диагностики __belive (рядом `.monitorRouter = router`) добавить:
```
;(window as any).__belive.deviceManager = deviceManager
```
(если переменная вне скоупа блока __belive — объявить `let deviceManager: DeviceManager | null = null` рядом с `let router ... :100` и присваивать в try; экспонировать с null-check)

## EDIT 3 · src/components/ControlDeck.tsx — ON-ветка пробуждает монитор
В ON-ветке ПЕРЕД строкой `router.setMicMonitor(true)` вставить:
```tsx
                    try { await belive.deviceManager?.ensureMonitorPlaying?.(); } catch {}
```

## VERIFICATION
tsc 314 (grep -c "error TS") · vitest tests 763/763. FROZEN-OK.
