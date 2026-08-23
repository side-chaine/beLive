# 464b-MICRO-PACK · TASK-014c · ЛОКАЛЬНЫЙ ТАП МОНИТОРА В ВЫХОД

**Гипотеза тишины:** каскад мика завершается на monitorStream (MediaStreamAudioDestinationNode — виртуальный выход, сам не играет). Hidden `<audio>` DeviceManager ненадёжен после async-acquire: el.play() может отклониться (гест-кворк), а catch молчит. Программа слышна отдельно через `_defaultBranch→ctx.destination`.

**Фикс:** постоянный локальный тап `_monitorMaster → ctx.destination`. Тишина по умолчанию сохранена: _musicGain=0.0 (муз. тэп закрыт) + _monitorGain=0.0 (мик закрыт до setMicMonitor(true)). Философия «ноды вечно, громкости гейтят» не нарушена. Задвоения нет: в _monitorMaster входят ТОЛЬКО music-tap(0)+mic.

## EDIT 1 · src/audio/engine-v3/monitor/MonitorRouter.ts (конструктор)
СРАЗУ ПОСЛЕ строки:
```
    this._monitorGain.connect(this._monitorMaster)
```
добавить:
```ts
    // TASK-014c (464b): локальный тап монитора на реальный выход.
    // Тишина по умолчанию: _musicGain=0.0 + _monitorGain=0.0 до enable.
    this._monitorMaster.connect(ctx.destination)
```

## EDIT 2 · src/audio/engine-v3/monitor/DeviceManager.ts (_ensureAudio)
Перед `try { await el.play() }` добавить явные громкости, catch сделать НЕмолчаливым:
OLD (примерно):
```
    try { await el.play() } catch { /* user gesture needed */ }
```
NEW:
```
    el.volume = 1; el.muted = false
    try {
      await el.play()
      if (import.meta.env.DEV) console.log(`[DeviceManager] ${target} audio PLAYING`)
    } catch (e) {
      console.warn(`[DeviceManager] ${target} play() BLOCKED`, e)
    }
```

## VERIFICATION
tsc ровно 314 (grep -c "error TS") · vitest tests 763/763 · FROZEN-OK (MonitorRouter/DeviceManager не frozen).
