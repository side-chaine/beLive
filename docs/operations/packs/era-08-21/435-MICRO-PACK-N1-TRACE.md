# 435-MICRO-PACK-N1-TRACE — диагностика цепочки воспроизведения тейка (без правки поведения)

**Контекст (Ц3 N1):** смоук шёл на C31; C32 (getAudioContext) уже в ветке, но согласно параллельному 007 тишина бы осталась — цепочка source→gain→ctx.destination статически верна, значит вина в runtime-состоянии. Главный кандидат: `source.start(ctx.currentTime+0.01, trimStart + engineOffsetSec)` — если пользователь вернулся в блок и плейбек-позиция ушла за длину буфера тейка, старт происходит ЗА концом буфера → тишина. Ц3 требует ТРАССИРОВКУ, не слепой фикс.

**Этот пак НЕ меняет поведение** — только DEV-only console.log на ключевых шагах цепочки blob→decode→buffer→source→offset→ctx.state. Логи под анкором `[N1-TRACE]`. После ретеста пользователь скидывает консоль → корень подтверждается → отдельный фикс-пак.

---

## Все EDIT'ы — файл `src/takes/hooks/useTakesPlayback.ts`

### EDIT 1 — после декода контекста (:117)
Строка:
```ts
        const ctx: AudioContext = getAudioContext();
```
(внутри try блока декода) →
```ts
        const ctx: AudioContext = getAudioContext();
        if (import.meta.env.DEV) console.log('[N1-TRACE] decode: ctx?', !!ctx, 'ctx.state', ctx?.state);
```

### EDIT 2 — после decodeAudioData (:118)
Строка:
```ts
        audioBuffer = await ctx.decodeAudioData(ab);
```
→
```ts
        audioBuffer = await ctx.decodeAudioData(ab);
        if (import.meta.env.DEV) console.log('[N1-TRACE] decoded buffer.duration', audioBuffer?.duration);
```

### EDIT 3 — перед созданием source (:153)
Строка:
```ts
      const source = ctx.createBufferSource();
```
→
```ts
      const source = ctx.createBufferSource();
      if (import.meta.env.DEV) console.log('[N1-TRACE] source+rand+connect path: ctx', ctx.state, 'buffer?', !!audioBuffer, 'bufferDur', audioBuffer?.duration);
```

### EDIT 4 — перед source.start (:200)
Строка:
```ts
      source.start(ctx.currentTime + 0.01, trimStart + engineOffsetSec);
```
→
```ts
      if (import.meta.env.DEV) console.log('[N1-TRACE] START offset { trimStart, engineOffsetSec, totalOffset:', (trimStart + engineOffsetSec), ', bufferDur:', audioBuffer?.duration, ', transportState:', getTransport()?.state, ', playbackTime:', getPlaybackTime(), ', timeRangeStart:', timeRange.startTime, '} => OFFSET_BEYOND_BUFFER:', (trimStart + engineOffsetSec) >= (audioBuffer?.duration ?? 0));
      source.start(ctx.currentTime + 0.01, trimStart + engineOffsetSec);
```

### EDIT 5 — после play() (:187)
Строка:
```ts
      const playResult = getTransport().play();
```
→
```ts
      const playResult = getTransport().play();
      if (import.meta.env.DEV) console.log('[N1-TRACE] transport.play() called, state now', getTransport()?.state);
```

Никаких изменений рендеринга, гейнов, подключений, логики. Только логи.

---

## ВЕРИФИКАЦИЯ
1. `npx tsc --noEmit` → 314; diff error sets vs HEAD — IDENTICAL (логи не меняют типы).
2. `npx vitest run` → files 61/63 (2 legacy load-error), tests 749/749.
3. Отчёт: файлы, числа, отклонения (анкор не нашёлся — СТОП).

## ПОСЛЕ
Пользователь ретестит: записал блок → вернулся → кликнул Take → копирует из консоли строки `[N1-TRACE]`. По `OFFSET_BEYOND_BUFFER: true` подтверждаем корень №2 и пишем фикс (кламп offset к [0, bufferDur) или играть с buffer-start вне зависимости от плейбек-позиции). НЕ коммитим этот пак — он диагностический; удалим логи при следующем фикс-паке.