# MICRO-PACK B (428) — МОСТ ИНДИКАЦИИ (Явление B, решение (b) Ц3) + R1-PROOF ГЕТТЕР

## Контекст и разведка
**Форензик-уточнение (426):** MixerPanel УЖЕ содержит `readMeterV3` (патч 366, строки 239-243) и `isV3`-гейт (:247). Застревание индикации вызвано НЕ отсутствием моста, а:
1. **Узкий гейт:** `isV3 = t3 && t3.state !== 'idle' && __belive.pipeline` — до первого play (state 'idle') и в ряде пауз читает **заглушенный V2** (`ae.getStemMeterLevel`) → stale/нули. После bundle death V2-источник умрёт — вечные нули (риск Ц3).
2. **setInterval по meterFps (10Hz)** — дискретный цикл, не rAF. Ц3: «тот же вызов в том же rAF-цикле».

**R1-proof:** vocalHall-цепь (`_vocalHallSend`, pre-fader от instance.outputNode, только vocals) не имеет RMS-метра — для CDP-доказуемости (mute вокала → метр vocals 0 + hall-цепи ≠ 0) добавляем Analyser-тап (параллельный, не в сигнальном пути — как `_stretchMeters`).

## Правки

### 1. `src/components/MixerPanel.tsx` — гейт pipeline-presence + rAF-цикл

**1a. isV3-гейт (:247)** — заменить:
```ts
      const t3 = getTransport();
      const isV3 = !!(window as any).__belive?.pipeline;
```
(убрать `t3 && t3.state !== 'idle' &&` — pipeline-presence семантика (шаблон (iv) E1): если pipeline существует — читаем из него (0 при незагруженном треке — корректно); иначе V2 fallback. Убедиться, что `getTransport()` больше не нужен в этом эффекте — если да, убрать неиспользуемый импорт/переменную аккуратно, не трогая другие места).

**1b. Цикл (:237-266)** — setInterval → rAF с троттлингом по meterFps:
```ts
    const interval = 1000 / meterFps;

    const readMeterV3 = (stemId: string): number => {
      const pipeline = (window as any).__belive?.pipeline;
      if (!pipeline?.getStemMeterLevel) return 0;
      return pipeline.getStemMeterLevel(stemId) ?? 0;
    };

    let rafId = 0;
    let lastTs = 0;
    const tick = (ts: number) => {
      rafId = requestAnimationFrame(tick);
      if (ts - lastTs < interval) return;
      lastTs = ts;

      const isV3 = !!(window as any).__belive?.pipeline;
      const levels: Record<string, number> = {};
      if (isV3) {
        for (const stemId of orderedStems) {
          levels[stemId] = readMeterV3(stemId);
        }
      } else {
        const ae = (window as any).audioEngine;
        if (!ae?.getStemMeterLevel) return;
        for (const stemId of orderedStems) {
          levels[stemId] = ae.getStemMeterLevel(stemId) ?? 0;
        }
      }
      setMeterLevels(levels);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
```
- `timerRef` (:113, :245, :265) — удалить (больше не используется; проверить grep по файлу — если других использований нет, убрать и объявление).
- Тот же вызов `readMeterV3`, тот же источник (`getStemMeterLevel`) — только живой цикл.
- **Бонус-чек C27 автоматически:** `getStemMeterLevel` читает AnalyserNode ПОСЛЕ stretchGain — при mute/solo приглушённый стем показывает падение до 0 (эффективная маска отражается в индикации).

### 2. `src/audio/engine-v3/pipeline/HybridPipelineService.ts` — R1-proof геттер

**2a. Поле** (рядом с `_vocalHallSend`, ~:70):
```ts
  /** R1: Analyser-тап на vocal-hall send (pre-fader, только vocals) — параллельный, не в сигнальном пути */
  private _vocalHallMeter: AnalyserNode | null = null
```

**2b. Создание в конструкторе** (после создания `_vocalHallSend`, ~:86-87):
```ts
    this._vocalHallMeter = ctx.createAnalyser()
    this._vocalHallMeter.fftSize = 256
    this._vocalHallSend.connect(this._vocalHallMeter)
```

**2c. Публичный метод** (рядом с `getStemMeterLevel`, ~:498):
```ts
  /** R1: RMS-уровень vocal-hall цепи (pre-fader от instance.outputNode, до stretchGain).
   *  Mute/solo/volume vocals НЕ влияют на зал — метр доказывает это числами (CDP R1-proof). */
  getVocalHallLevel(): number {
    const meter = this._vocalHallMeter
    if (!meter) return 0
    try {
      meter.getFloatTimeDomainData(this._meterScratch)
      let sumSq = 0
      for (let i = 0; i < this._meterScratch.length; i++) sumSq += this._meterScratch[i] * this._meterScratch[i]
      return Math.sqrt(sumSq / this._meterScratch.length)
    } catch {
      return 0
    }
  }
```
(переиспользует `_meterScratch` — он уже есть; проверить, что `_meterScratch` инициализирован до первого вызова — он создаётся в конструкторе рядом с метрами).

**2d. Reset** (`reset()`, ~:550) — `_vocalHallMeter` НЕ отключать при смене трека (он висит на `_vocalHallSend`, который живёт весь lifecycle pipeline). Проверить: если в reset отключаются `_stretchGains`/`_stretchMeters` — метру hall не нужен disconnect. Ничего не добавлять, если disconnect-блоков для vocalHall нет.

### 3. Fallback-деградация (Ц3 §4.3)
Без pipeline MixerPanel читает V2 → stale — известное, покрывается №16, отдельной строки достаточно. Код не меняем.

## CDP R1-proof — сниппет для DevTools-консоли пользователя (после пака)
```js
// Трек играет, v3 активен. В UI: mute vocals (кнопка M).
const p = window.__belive?.pipeline
await new Promise(r => setTimeout(r, 500))
console.log('vocals meter (после mute):', p?.getStemMeterLevel?.('vocals'))  // → ~0
console.log('vocalHall level (после mute):', p?.getVocalHallLevel?.())         // → >0 (вокал в зале)
```
Ожидание: `vocals meter ≈ 0` ∧ `vocalHall level > 0` → R1-proof ✅ (mute гасит основной микс, зал живёт).

## Верификация (007)
- `npx tsc --noEmit` → 314.
- `npx vitest run` → **единая формулировка навсегда (А4): 751 total = 749 passed + 2 failed (оба — src/legacy/engine-v3/__tests__, предсуществующие, stash-подтверждено на чистой базе; не регрессия)**.
- Проверить: `getTransport` после 1a — остались ли использования в файле (если нет — убрать импорт; если да — оставить).
- Frozen: не трогаем. V2 — только чтение (не используется).
- Реестр: мост читает существующие метры; R1-геттер добавляет Analyser (параллельный тап, не в сигнальном пути) — освобождение в отчёте.
- Коммит: `C28: мост индикации — pipeline-presence гейт + rAF-цикл (readMeterV3), R1-proof геттер vocalHall` + `(428-REPORT)`.
- Живой ретест: индикация обоих режимов живая, движется с музыкой, реагирует на mute/solo (бонус-чек C27); затем CDP R1-proof сниппет.