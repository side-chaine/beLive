# MICRO-PACK-V007-003 — TASK-013.4: убрать двойную публикацию seek

**Цель:** `_onSeek` в `V3StatePublisher` (подписан на `transport.addEventListener('seek', …)`)
уже зовёт `publishSeek` при КАЖДОМ `transport.seek()`. Прямые `publishSeek` из UI
в V3-ветках дают двойную (WaveformCanvas — тройную) публикацию `seek-position-changed`.
Убираем избыточные прямые вызовы; V2-fallback оставляем нетронутым.

**Канон (не нарушать):** `tsc` ровно 314, `vitest` 763/763. Frozen-зоны не трогать.

---

## Правки

### 1) src/components/TransportBar.tsx (строки ~43-45)
old:
```
          // V3 path — seek + publish через publisher (обновляет _lastPublishedTime!)
          // eventBus.publish НЕ используем — publisher.publishSeek() сам публикует событие
          void transport.seek(newTime);
          getStatePublisher()?.publishSeek(newTime, duration);
```
new:
```
          // V3 path — seek через transport; publisher сам публикует seek-position-changed
          // через _onSeek (V3StatePublisher) — publishSeek здесь не дублируем (#TASK-013.4)
          void transport.seek(newTime);
```

### 2) src/components/WagonTrain.tsx — ДВА одинаковых блока (строки ~108-109 и ~133-134)
Использовать replaceAll (обе копии идентичны, меняем одинаково).
old (2 строки, отступ 8 пробелов):
```
        void transport.seek(marker.time);
        getStatePublisher()?.publishSeek(marker.time, transport.duration)
```
new (оставляем seek, убираем publishSeek):
```
        void transport.seek(marker.time);
        // publishSeek идёт через _onSeek (V3StatePublisher) — не дублируем (#TASK-013.4)
```

### 3) src/sync/components/WaveformCanvas.tsx (строки ~441-451)
old:
```
            if (v3Active && t3) {
              void t3.seek(clampedTime)
              getStatePublisher()?.publishSeek(clampedTime, t3.duration)
            } else {
              V2Adapter.getInstance().delegateSync('seekTo', clampedTime)
            }
            // Публикуем seek-position-changed ТОЛЬКО после успешного seek
            eventBus.publish(EventBusChannel.Audio, 'seek-position-changed', {
              currentTime: clampedTime, duration,
            })
```
new:
```
            if (v3Active && t3) {
              void t3.seek(clampedTime)
              // V3: seek-position-changed публикует _onSeek (V3StatePublisher) — не дублируем (#TASK-013.4)
            } else {
              V2Adapter.getInstance().delegateSync('seekTo', clampedTime)
              // V2 fallback: публикуем вручную (иначе никто не узнает о seek)
              eventBus.publish(EventBusChannel.Audio, 'seek-position-changed', {
                currentTime: clampedTime, duration,
              })
            }
```

### 4) src/hooks/useKeyboardShortcuts.ts (строки ~51-53)
old:
```
                  const nt = Math.max(0, Math.min(d, ct + delta * 2))
                  void transport.seek(nt)
                  getStatePublisher()?.publishSeek(nt, d)
```
new:
```
                  const nt = Math.max(0, Math.min(d, ct + delta * 2))
                  void transport.seek(nt)
                  // publishSeek идёт через _onSeek (V3StatePublisher) — не дублируем (#TASK-013.4)
```

---

## После правок — верификация (Оператор)
1. `npx tsc --noEmit 2>&1 | grep -c "error TS"` → должно быть **314**.
2. `npx vitest run 2>&1 | tail -5` → **763 passed** (files 62/64).
3. `grep -rn "getStatePublisher()?.publishSeek" src/components src/sync src/hooks` →
   должно вернуть 0 совпадений (все прямые V3-вызовы убраны; остаться может только
   внутри V3StatePublisher.ts — это норма).
4. Frozen-зоны (`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`,
   приватные `_`) — НЕ ИЗМЕНЕНЫ. Подтвердить grep'ом по списку.

## Не трогать
- `src/audio/engine-v3/integration/V3StatePublisher.ts` (там `_onSeek` — источник правды).
- V2-fallback ветки (TransportBar:49-51, WagonTrain:111/136, WaveformCanvas V2, useKeyboardShortcuts V2).
- Любой frozen-файл.
