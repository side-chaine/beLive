# 449-MICRO-PACK · №17-TRACE · КТО ДВИГАЕТ БЛОК/СЕКАЕТ (диагностика, нулевой риск)

**Цель:** поймать виновник прыжка на след. блок в квесте (post-445+447). Только console.log со стеками, поведение НЕ меняется. Паттерн C⁺-трейса (438), который уже доказал себя.

## EDIT 1 · src/takes/takes.store.ts:69 — трейс setActiveBlock
OLD:
```
    setActiveBlock: (blockId) => set({ activeBlockId: blockId }),
```
NEW:
```
    setActiveBlock: (blockId) => {
      // №17-TRACE (449): кто меняет активный блок панели тейков — стек в консоль
      if (import.meta.env.DEV) {
        const __st = new Error().stack?.split('\n').slice(1, 7).join(' << ');
        console.log(`[SET-BLOCK] -> ${blockId} | ${__st}`);
      }
      set({ activeBlockId: blockId });
    },
```

## EDIT 2 · src/components/WagonTrain.tsx:84 — маркер ручного клика по чипу
OLD:
```
  const handleWagonClick = (block: TextBlock) => {
```
NEW:
```
  const handleWagonClick = (block: TextBlock) => {
    // №17-TRACE (449): ручной клик по чипу блока
    if (import.meta.env.DEV) console.log(`[CHIP-CLICK] ${block.id}`);
```

## EDIT 3 · src/audio/engine-v3/pipeline/HybridPipelineService.ts:329 — стек на RECON-SEEK
OLD:
```
      console.log(`[RECON-SEEK] seek(time=${time.toFixed(2)}, rate=${rate.toFixed(3)}) gen=${myGen} isPlaying=${this._isPlaying}`)
```
NEW:
```
      console.log(`[RECON-SEEK] seek(time=${time.toFixed(2)}, rate=${rate.toFixed(3)}) gen=${myGen} isPlaying=${this._isPlaying} | ${(new Error().stack ?? '').split('\n').slice(1, 6).join(' << ')}`)
```
ВНИМАНИЕ: файл НЕ frozen (HybridPipelineService правился в C27/C31); правка только лог-строки.

## EDIT 4 · src/exercises/exercise.store.ts:205 — вход в advanceToNextStep
OLD:
```
  advanceToNextStep: () => {
    const exercise = get().activeExercise;
    if (!exercise) return;
```
NEW:
```
  advanceToNextStep: () => {
    const exercise = get().activeExercise;
    // №17-TRACE (449): если шаг квеста двинулся — видим кто вызвал
    if (import.meta.env.DEV && exercise) {
      const __st = new Error().stack?.split('\n').slice(1, 6).join(' << ');
      console.log(`[STEP-ADVANCE] stepIndex=${get().currentStepIndex} | ${__st}`);
    }
    if (!exercise) return;
```

## VERIFICATION
- tsc --noEmit = 314 (diff IDENTICAL)
- vitest files 61/63 (2 legacy load-error), tests 749/749
- FROZEN-OK: все 4 файла не frozen.

## ЧТО МЫ УВИДИМ В РЕТЕСТЕ (маркеры)
- `[CHIP-CLICK]` — юзер кликнул чип (ручная навигация)
- `[SET-BLOCK]` со стеком через auto-follow/TakesPanel — наш ли гвард сработал или пин мимо
- `[SET-BLOCK]` со стеком через WagonTrain — чип
- `[STEP-ADVANCE]` — движок квеста двигает шаг (наш главный подозреваемый №2!)
- `[RECON-SEEK] ... | <стек>` — КТО секет транспорт на старт след. блока
