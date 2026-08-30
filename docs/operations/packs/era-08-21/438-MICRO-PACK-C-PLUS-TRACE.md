# 438-MICRO-PACK — C⁺ трассировка гонки previewGenRef (N1, рулинг Ц3 §1)

**Цель:** инструментировать бампы `previewGenRef` с тегами/стеком + точки решения в `useTakesPlayback.ts` + маркер клика в `TakeSlot.tsx`, чтобы механически увидеть, **чей бамп и в каком порядке** убивает `source.start`. НЕ чинит баг — только трассирует (proof-of-change-база для B-фикса).

**Файлы (НЕ frozen):** `src/takes/hooks/useTakesPlayback.ts`, `src/takes/components/TakeSlot.tsx`.
**Запрет:** не трогать frozen (`AudioEngineV2`, `patchV1`, `bridges`, `track.orchestrator`, приватные `_`). Не удалять трейсы. Не коммитить (push 🔒).
**Верификация после правок:** `npx tsc --noEmit` → 314 ошибок (diff IDENTICAL); `npx vitest run` → 749/749.

---

## Правка 1 — `useTakesPlayback.ts`: хелпер трассы (после импортов, строка 8)
```ts
// C⁺-TRACE (438): тегированная инструментация бампов previewGenRef
function __traceGenBump(tag: string, val: number) {
  const stack = new Error().stack?.split('\n').slice(1, 5).join(' << ');
  console.log(`[GEN-BUMP] tag=${tag} val=${val} stack=${stack}`);
}
```

## Правка 2 — `useTakesPlayback.ts`: бамп в stopPreview (строки 64-65)
БЫЛО:
```ts
  const stopPreview = React.useCallback((options?: { pauseEngine?: boolean }) => {
    previewGenRef.current++;
```
СТАЛО:
```ts
  const stopPreview = React.useCallback((options?: { pauseEngine?: boolean }) => {
    previewGenRef.current++;
    __traceGenBump('stopPreview', previewGenRef.current);
```

## Правка 3 — `useTakesPlayback.ts`: старт handlePlayTake (строки 108-109)
БЫЛО:
```ts
    stopPreview();
    const gen = ++previewGenRef.current;
```
СТАЛО:
```ts
    stopPreview();
    const gen = ++previewGenRef.current;
    __traceGenBump('handlePlayTake-start', gen);
    console.log(`[PLAY-TAKE] enter takeId=${takeId} gen=${gen}`);
```

## Правка 4 — `useTakesPlayback.ts`: гвард :133 (после блока декода)
БЫЛО:
```ts
    if (gen !== previewGenRef.current) return;
    try {
      const ctx: AudioContext = getAudioContext();
```
СТАЛО:
```ts
    if (gen !== previewGenRef.current) {
      console.log(`[GEN-GUARD:133] BAIL gen=${gen} cur=${previewGenRef.current}`);
      return;
    } else {
      console.log(`[GEN-GUARD:133] PASS gen=${gen}`);
    }
    try {
      const ctx: AudioContext = getAudioContext();
```

## Правка 5 — `useTakesPlayback.ts`: no-op settleGen (строки 202-203) — оставить, добавить лог
БЫЛО:
```ts
      const settleGen = previewGenRef.current;
      if (settleGen !== previewGenRef.current) return;
```
СТАЛО:
```ts
      const settleGen = previewGenRef.current;
      console.log(`[GEN-SETTLE] gen=${gen} cur=${settleGen} (C33 no-op guard, kept benign)`);
```

## Правка 6 — `useTakesPlayback.ts`: source.start (строка 212)
БЫЛО:
```ts
      source.start(ctx.currentTime + 0.01, startOffset);
      setPlayingTakeId(takeId);
```
СТАЛО:
```ts
      console.log(`[GEN-SRC-START] REACHED startOffset=${startOffset.toFixed(3)} gain=${gain.gain.value} gen=${gen} cur=${previewGenRef.current}`);
      source.start(ctx.currentTime + 0.01, startOffset);
      setPlayingTakeId(takeId);
```

## Правка 7 — `useTakesPlayback.ts`: onended (строки 214-217)
БЫЛО:
```ts
      source.onended = () => {
        if (gen !== previewGenRef.current) return;
        stopPreview({ pauseEngine: true });
      };
```
СТАЛО:
```ts
      source.onended = () => {
        if (gen !== previewGenRef.current) {
          console.log(`[GEN-ONENDED] BAIL gen=${gen} cur=${previewGenRef.current}`);
          return;
        }
        console.log(`[GEN-ONENDED] natural-end gen=${gen}`);
        stopPreview({ pauseEngine: true });
      };
```

## Правка 8 — `TakeSlot.tsx`: маркер клика (handleClick, строка 38)
БЫЛО:
```ts
  const handleClick = () => {
    if (exercisePlaybackLocked) return;
```
СТАЛО:
```ts
  const handleClick = () => {
    console.log(`[TAKE-CLICK] slot=${slot} isReady=${isReady} isThisRec=${isThisRec} exercisePlaybackLocked=${exercisePlaybackLocked}`);
    if (exercisePlaybackLocked) return;
```

---

## Что ждёт 007 от трейса (когда пользователь кликнет тейк в квесте)
Последовательность `[TAKE-CLICK]` → `[GEN-BUMP]` (stack покажет usePracticeInterrupt vs handlePlayTake) → `[PLAY-TAKE]` → `[GEN-GUARD:133]` PASS/BAIL → `[GEN-SRC-START]` REACHED/нет → `[GEN-ONENDED]`.
Решение B-i/B-ii примет 007 по факту: чей бамп и пришёл ли он до или после source.start.
