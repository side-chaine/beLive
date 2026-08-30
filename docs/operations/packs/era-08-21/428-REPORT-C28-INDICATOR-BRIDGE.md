# 428-REPORT (C28) — ПАК B: МОСТ ИНДИКАЦИИ + R1-PROOF + ОТВЕТЫ А1–А4

**Коммит:** C28 = `c94f608` — pipeline-presence гейт + rAF-цикл (readMeterV3 живой), getVocalHallLevel + reconnect-фикс
**Верификация:** tsc 314 (diff error sets идентичен базе — 0 новых), vitest: 749 passed / 2 failed / 751 total (legacy, предсуществующие)
**Статус:** применён, ждёт ретеста ушами

---

## ОТВЕТЫ А1–А4 (по Ц3)

### А1 · busVol в V3 — закрыто одной строкой
Пользовательских bus-множителей в V3 **нет**: `_busAGain = 1.0` (stretch always active) и `_busBGain = 0.0` (Bus B dead, 067-D) — константы, создаются в конструкторе, применяются пост-mergeGain (chainA.outputNode → _busAGain → _outputGain). `busVolumes` отсутствуют и в сторе, и в sync (grep: 0 вхождений). Для активной шины множитель ≡ 1 → включение в effectiveGain нейтрально; если в будущем появятся bus-множители — единственное место для них `_effectiveGainOf` (raw × busVol), одна строка.

### А2 · chainA-ветки после C27 — единственный writer подтверждён
- `chainA.muteStem` / `chainA.setStemVolume` — **никто не вызывает** (grep по репо: 0 вызовов вне StemChain; из pipeline убраны в C27). Остались публичным API StemChain для совместимости, мёртвые.
- `chainA.soloStem` — остался единственный вызов: **только как писатель маски-предиката** (`_soloed` Set). Его побочная запись `stem.volume = 0/1` (в `_applySolo`) немедленно перезаписывается pipeline'ом в том же тике (`soloStem` → цикл `_applyEffectiveGain`).
- **Один конечный writer гейна = `_applyEffectiveGain`** (pipeline). chainA-логика ничего другого от вызовов не ждала (маска-предикат изолирована).

### А3 · VOC 15с — не каждый трек
VOC-флоу запускается только при `(needsL2 || needsL3) && track.syncMarkers?.length > 0` (dataVersion < 3/4 — старые треки, требующие онсет-коррекции). Для dataVersion ≥ 4 — **не запускается вовсе**. 15с — таймаут `awaitStemReady('vocals', 15000)` (fire-and-forget, не блокирует загрузку). Для треков с needsL2/L3 без вокального стема — ждёт полный таймаут и skip. **Backlog-кандидат (не сейчас):** ранний skip при известном отсутствии vocals-стема (дешёвый UX-фикс).

### А4 · Числовая дисциплина — принято, единая формула навсегда
**`tsc --noEmit`: 314 (база), diff error sets IDENTICAL — 0 новых.**
**`vitest run`: 749 passed / 2 failed / 751 total.** Failed — оба `src/legacy/engine-v3/__tests__` (`engine-v3.test.ts`, `vocal-mic.test.ts`): нерезолвящиеся импорты (`../MeterNodeV3`, `./V2Adapter`), предсуществующие (подтверждено stash-проверкой на чистой базе), **не регрессия**. Прошлая формулировка «749/749 — все зелёные» была неточной — legacy-суиты падали и тогда; протокол: одна формула, никаких «все зелёные» при failed-файлах.

---

## ПАК B — исполнение (решение (b) Ц3)

### Форензик-уточнение (426)
`readMeterV3` (патч 366) **уже существовал** в MixerPanel (:239-243). Застревание индикации — от **узкого гейта** `t3 && t3.state !== 'idle' && __belive.pipeline`: до первого play и в части пауз читался **заглушенный V2** (`ae.getStemMeterLevel` caged) → stale/нули. После bundle death этот путь дал бы вечные нули (риск Ц3).

### C28
1. **Гейт → pipeline-presence** (`!!__belive?.pipeline`, шаблон (iv) E1): pipeline есть → читаем из него (0 при незагруженном треке — корректно); иначе V2-fallback (№16, известная деградация).
2. **setInterval (10Hz) → rAF с троттлингом** по meterFps: тот же вызов `readMeterV3`, тот же источник — живой цикл. `timerRef`/`getTransport` удалены (чистка, 0 вхождений).
3. **R1-proof:** `getVocalHallLevel()` — Analyser-тап (fftSize 256, параллельный, не в сигнальном пути) на `_vocalHallSend` (pre-fader, только vocals). Оператор поймал дыру: `setVocalHallTarget` делает `disconnect()` без аргументов → рвал тап метра → **микрофикс reconnect** в C28 (2 строки).
4. **Бонус-чек C27 автоматически:** метры читаются ПОСЛЕ stretchGain → mute/solo отражаются в индикации (приглушённый стем падает к 0).

### Реестр
Мост: читает существующие метры, аудио-узлов не добавляет. R1-геттер: +1 AnalyserNode (параллельный тап) — не в сигнальном пути, живёт весь lifecycle (в reset не отключается; в dispose — teardown корректный).

---

## СЛЕДУЮЩИЙ ШАГ (ретест ушами + CDP R1-proof)

**Ретест индикации (пользователь, в сессии):**
1. Обычный режим (не Visual): индикация **живая**, движется с музыкой
2. Застревания нет — отжал solo → индикация остальных **сразу оживает** (раньше «приходилось задеть»)
3. Бонус-чек: mute/solo стема → его индикация **падает к 0**, другие живут

**CDP R1-proof (пользователь, DevTools-консоль, трек играет):**
```js
// В UI: mute vocals (кнопка M)
const p = window.__belive?.pipeline
await new Promise(r => setTimeout(r, 500))
console.log('vocals meter (после mute):', p?.getStemMeterLevel?.('vocals'))  // ~0
console.log('vocalHall level (после mute):', p?.getVocalHallLevel?.())        // >0 — вокал в зале
```
Ожидание: vocals ≈ 0 ∧ vocalHall > 0 → R1-proof ✅ (mute гасит основной микс, зал живёт).

Затем: бандл 4+ (П-8 → Visual → 389 → loop-cleared → takes/TRIM-BASIS → RTL → §H) → полный 425 + правка G4-инварианта → M3-GO.