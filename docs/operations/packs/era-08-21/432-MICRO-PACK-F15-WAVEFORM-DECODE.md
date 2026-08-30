# 432-MICRO-PACK-F15 — WAVEFORM-V3 + TAKE-DECODE-FIX

**Контекст:** F-1 (C29) работает — запись и живая волна ОК. Остались: (1) статичная волна трека в Quest вечно «Loading waveform...» — TakesPanel берёт буферы из V2-API (`getAudioBuffer`/`ensureInstrumentalBuffer`, кейдж в v3); (2) тейк записан, но не становится `ready` → некликабелен — три сайта декода используют `ae?.audioContext ?? ae?._audioContext` с МОЛЧАЛИВЫМ `if (!ctx2) return`; в v3 это может быть undefined → тейк навсегда 'processing' без единой ошибки в консоли.

**Ключевой факт:** pipeline построен на синглтоне `getAudioContext()` (main.tsx :99 → `new HybridPipelineService(ctx)`), а геттер `pipeline.ctx` добавлен в C29. Синглтон живой в обоих режимах — используем его как первичный источник.

---

## EDIT 1 — `src/takes/components/TakesPanel.tsx`: инструментальная волна из v3-стемов

В эффекте `instrumentalBuffer` (начало ~:487). После строки:

```ts
    const ae = (window as any).audioEngine;
```

(та, что следует за `if (!duration) {...}`; перед комментарием `// Try sync first (if buffer already decoded)`) вставить:

```ts
    // F-1.5 (432): v3 — инструментал = сумма не-vocal стемов из pipeline (V2-API заглушён кейджем)
    const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
    if (engineMode === 'v3') {
      const pipeline = (window as any).__belive?.pipeline;
      const stems = pipeline?.chainA?.stems;
      if (pipeline && stems && stems.size > 0) {
        const instBufs: AudioBuffer[] = [];
        stems.forEach((st: any, id: string) => {
          if (id === 'vocals') return;
          const b = st.getBuffer?.();
          if (b) instBufs.push(b);
        });
        if (instBufs.length > 0) {
          const ref = instBufs[0];
          let len = 0;
          for (const b of instBufs) len = Math.max(len, b.length);
          const mixed = pipeline.ctx.createBuffer(ref.numberOfChannels, len, ref.sampleRate);
          for (let ch = 0; ch < ref.numberOfChannels; ch++) {
            const out = mixed.getChannelData(ch);
            for (const b of instBufs) {
              const src = b.getChannelData(Math.min(ch, b.numberOfChannels - 1));
              const n = Math.min(src.length, out.length);
              for (let i = 0; i < n; i++) out[i] += src[i];
            }
          }
          if (!cancelled) setInstrumentalBuffer(mixed);
          return;
        }
      }
      return; // v3: стемов ещё нет — V2-fallback бесполезен, ждём [duration]-реран
    }
```

## EDIT 2 — `src/takes/components/TakesPanel.tsx`: вокальная волна из v3-стема

В эффекте `vocalBuffer` (~:512). После строки:

```ts
    const ae = (window as any).audioEngine;
```

(перед `// Try sync first (buffer may already be decoded)`) вставить:

```ts
    // F-1.5 (432): v3 — вокальный буфер напрямую из стема 'vocals'
    const engineModeV = import.meta.env.VITE_ENGINE ?? 'v2';
    if (engineModeV === 'v3') {
      const stems = (window as any).__belive?.pipeline?.chainA?.stems;
      const vb = stems?.get?.('vocals')?.getBuffer?.() ?? null;
      if (vb) { if (!cancelled) setVocalBuffer(vb); }
      return;
    }
```

## EDIT 3 — `src/takes/components/TakesControlStrip.tsx`: импорт синглтона

К существующим импортам добавить:

```ts
import { getAudioContext } from '../../audio/core/audioContext';
```

## EDIT 4 — сайт декода №1 (exercise flow, ~:436)

```ts
          const ctx2: AudioContext =
            ((window as any).audioEngine?.audioContext ??
             (window as any).audioEngine?._audioContext);
          if (!ctx2) return;
```
заменить на:

```ts
          const ctx2: AudioContext = getAudioContext();
          if (!ctx2) { console.error('[Takes] нет AudioContext для декодирования'); return; }
```

## EDIT 5 — сайт декода №2 (handleStop, ~:686)

```ts
        const ctx2: AudioContext = ae?.audioContext ?? ae?._audioContext;
        if (!ctx2) return;
```
заменить на:

```ts
        const ctx2: AudioContext = getAudioContext();
        if (!ctx2) { console.error('[Takes] нет AudioContext для декодирования'); return; }
```

## EDIT 6 — сайт декода №3 (scenario flow, ~:771)

```ts
          const ctx2: AudioContext =
            ((window as any).audioEngine?.audioContext ??
             (window as any).audioEngine?._audioContext);
          if (!ctx2) return;
```
заменить на:

```ts
          const ctx2: AudioContext = getAudioContext();
          if (!ctx2) { console.error('[Takes] нет AudioContext для декодирования'); return; }
```

Примечание: сайты №1 и №3 текстово идентичны — различай по окружению (№1 рядом с `setRoundCaptureResponseActive(false)`, №3 рядом с `.then(async (ab)` после `finishRecording(meta)` в scenario FIRST WINDOW BRANCH).

---

## ВЕРИФИКАЦИЯ (формула А4)
1. `npx tsc --noEmit` → 314; diff error sets vs HEAD — IDENTICAL.
2. `npx vitest run` → 749/2/751.
3. Отчёт: файлы, числа, отклонения (анкор не нашёлся — СТОП, не импровизировать).

## ВНЕ СКОУПА
- Vocal-fade в countdown (:250-262) пишет V2 gainNode — в v3 no-op; парити-гэп, backlog-строка для Ц3.
- Персистентность тейков между перезагрузками (takeAssets in-memory) — существующее поведение V2, не регрессия.
