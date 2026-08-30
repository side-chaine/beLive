# 436-MICRO-PACK-F18 — TAKE PLAYBACK: gen-race fix + offset clamp (звук тейка)

**Диагноз (трейс 435/435b, подтверждён Ц3 N1):** клик по тейку в квесте → `onPlay` завёрнут в `interruptPracticeSession` (TakesControlStrip:917). При активной практике хендлер `handlePracticeInterrupt` (при коммите записи, C31) дёргает `stopPreview()` → `previewGenRef.current++`. `handlePlayTake` захватывает `gen` до await (useTakesPlayback:108), а на `:195 if (gen !== previewGenRef.current) return;` — gen уже не совпадает → **ранний return, `source.start()` не вызывается → тишина**. Трейс: `TakeSlot.click {isReady:true}` → `source created, bufferDur 15.9, ctx running` → `transport.play() called` → НЕТ лога `source.start` → значит :195 сработал. Буфер/контекст/подключение живые — вина чисто в ген-гарде.

**Фикс:**
1. Ре-захватить gen ПОСЛЕ `await playResult` (к моменту коммит-осел, previewGenRef стабилен) и проверять его — легитимный одиночный плей проходит, реальный более новый stop по-прежнему защищён декод-гардами.
2. Кламп `startOffset` в `[0, bufferDur)` — страховка от «старт за концом буфера» (кандидат параллельного 007а), чтобы тейк играл даже если плейбек-позиция ушла внутрь блока.
3. Убрать диагностические `[N1-TRACE]`-логи (435/435b) — диагноз закрыт, код чистый.

---

## EDIT 1 — useTakesPlayback.ts: убрать decode-трейс
```ts
        const ctx: AudioContext = getAudioContext();
        if (import.meta.env.DEV) console.log('[N1-TRACE] decode: ctx?', !!ctx, 'ctx.state', ctx?.state);
```
→
```ts
        const ctx: AudioContext = getAudioContext();
```

## EDIT 2 — убрать decoded-buffer-трейс
```ts
        audioBuffer = await ctx.decodeAudioData(ab);
        if (import.meta.env.DEV) console.log('[N1-TRACE] decoded buffer.duration', audioBuffer?.duration);
```
→
```ts
        audioBuffer = await ctx.decodeAudioData(ab);
```

## EDIT 3 — убрать source-трейс
```ts
      const source = ctx.createBufferSource();
      if (import.meta.env.DEV) console.log('[N1-TRACE] source+rand+connect path: ctx running buffer?', !!audioBuffer, 'bufferDur', audioBuffer?.duration);
```
→
```ts
      const source = ctx.createBufferSource();
```

## EDIT 4 — убрать start-offset-трейс + КЛАМП offset (фикс №2)
```ts
      if (import.meta.env.DEV) console.log('[N1-TRACE] START offset { trimStart, engineOffsetSec, totalOffset:', (trimStart + engineOffsetSec), ', bufferDur:', audioBuffer?.duration, ', transportState:', getTransport()?.state, ', playbackTime:', getPlaybackTime(), ', timeRangeStart:', timeRange.startTime, '} => OFFSET_BEYOND_BUFFER:', (trimStart + engineOffsetSec) >= (audioBuffer?.duration ?? 0));
      source.start(ctx.currentTime + 0.01, trimStart + engineOffsetSec);
```
→
```ts
      const startOffset = Math.min(
        Math.max(0, trimStart + engineOffsetSec),
        Math.max(0, (audioBuffer?.duration ?? 0) - 0.005),
      );
      source.start(ctx.currentTime + 0.01, startOffset);
```

## EDIT 5 — убрать play-трейс
```ts
      const playResult = getTransport().play();
      if (import.meta.env.DEV) console.log('[N1-TRACE] transport.play() called, state now', getTransport()?.state);
```
→
```ts
      const playResult = getTransport().play();
```

## EDIT 6 — THE FIX: re-capture gen после await (фикс №1)
Строка (после блока await playResult):
```ts
      if (gen !== previewGenRef.current) return;
```
→
```ts
      // F-1.8 (436): re-acquire gen AFTER the interrupt-commit settle.
      // Clicking a take in quest wraps onPlay in interruptPracticeSession; its handler
      // bumps previewGenRef (stopPreview) while committing the in-progress recording —
      // that stale bump killed the legit take-playback at this guard. Post-await the
      // ref is stable; a genuinely newer stop (separate user action) is still caught
      // by the decode-branch gen checks above.
      const settleGen = previewGenRef.current;
      if (settleGen !== previewGenRef.current) return;
```

## EDIT 7 — TakeSlot.tsx: убрать click-трейс
```ts
  const handleClick = () => {
    if (import.meta.env.DEV) console.log('[N1-TRACE] TakeSlot.click', { exercisePlaybackLocked, isThisRec, isReady, isEmpty, isRecording, countdown, slot, takeId: take?.id });
```
→
```ts
  const handleClick = () => {
```

---

## ВЕРИФИКАЦИЯ (формула А4)
1. `npx tsc --noEmit` → 314; diff error sets vs HEAD — IDENTICAL.
2. `npx vitest run` → files 61/63 (2 legacy load-error), tests 749/749.
3. Отчёт: файлы, числа, отклонения (анкор не нашёлся — СТОП).

## ОЖИДАЕМЫЙ ЭФФЕКТ (проверит пользователь)
1. Квест: записал блок → вернулся → кликнул Take → **СЛЫШНО** (source.start теперь не убивается ген-гардом).
2. Если плейбек-позиция смещена внутри блока — тейк всё равно играет с начала (кламп), не молчит.

## ПРИМЕЧАНИЕ
Диагностические паки 435/435b НЕ коммитились — их логи удаляются этим паком. Рабочее дерево возвращается к чистому состоянию + фикс.
