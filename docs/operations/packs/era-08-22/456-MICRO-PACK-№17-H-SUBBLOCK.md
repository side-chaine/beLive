# 456-MICRO-PACK · №17-H · КЛИК ПО СУББЛОКУ ВЫБИРАЕТ БЛОК ПАНЕЛИ (TASK-011)

**Находка юзера (22.08):** в TrackMap у каждого чипа блока есть субблоки («черточки внизу»). Клик по СУББЛОКУ не обновляет канвас/панель тейков (остаётся старый блок); клик по ТЕЛУ блока — обновляет.
**ROOT:** `WagonTrain.tsx` — `handleWagonClick` содержит `if (takesPanelActive) setActiveBlock(block.id)` (:104-107), а `handleSubBlockClick` делает только seek — setActiveBlock НЕТ.

## EDIT · src/components/WagonTrain.tsx — паритет субблока с блоком

OLD:
```
  const handleSubBlockClick = (block: TextBlock, subFirstLineIndex: number) => {
    interruptPracticeSession(() => {
      const marker = markers.find(m => m.lineIndex === subFirstLineIndex);
      if (!marker) return;

      const loopStore = useLoopStore.getState();
      if (loopStore.isLooping) {
        loopStore.rebindToBlock(block);
      }

      const transport = getTransport();
      if (transport && transport.state !== 'idle' && ((window as any).__v3Active || transport.orchestrator.all().length > 0)) {
        void transport.seek(marker.time);
        getStatePublisher()?.publishSeek(marker.time, transport.duration)
      } else {
        try { V2Adapter.getInstance().delegateSync('seekTo', marker.time) } catch {}
      }
    });
  };
```
NEW:
```
  const handleSubBlockClick = (block: TextBlock, subFirstLineIndex: number) => {
    interruptPracticeSession(() => {
      const marker = markers.find(m => m.lineIndex === subFirstLineIndex);
      if (!marker) return;

      const loopStore = useLoopStore.getState();
      if (loopStore.isLooping) {
        loopStore.rebindToBlock(block);
      }

      const transport = getTransport();
      if (transport && transport.state !== 'idle' && ((window as any).__v3Active || transport.orchestrator.all().length > 0)) {
        void transport.seek(marker.time);
        getStatePublisher()?.publishSeek(marker.time, transport.duration)
      } else {
        try { V2Adapter.getInstance().delegateSync('seekTo', marker.time) } catch {}
      }

      // TASK-011 / №17-H: клик по субблоку тоже выбирает блок панели тейков
      // (паритет с handleWagonClick; находка юзера 22.08)
      if (takesPanelActive) {
        setActiveBlock(block.id);
      }
    });
  };
```

## VERIFICATION (канон А4)
- tsc --noEmit = 314 (diff IDENTICAL)
- vitest files 61/63 (2 legacy load-error), tests 749/749
- FROZEN-OK: WagonTrain.tsx не frozen (уже правился в 449-трейсе).
