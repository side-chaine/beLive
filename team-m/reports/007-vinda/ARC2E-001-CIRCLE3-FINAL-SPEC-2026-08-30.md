# ARC-2E-001 · Круг-3 · ФИНАЛЬНАЯ СПЕКА (MICRO-PACK для Operator) · 2026-08-30

**BASE: HEAD `9b6bf83` · канон tsc=293🔴 / vitest=801+0int+0load 🟢 (67 файлов) · PARITY PASS 🟢 · V3=дефолт**
**Вердикт по Кругу-2: патч принимается целиком. Все 5 ударов сверены по живому дереву и подтверждены. Вычёркивания 002 (1б/1в/2б/2в/4) подтверждаю — референс растянут ✅, analyser=sink ✅, refcount 2 = by design ✅, boot-окно micSource покрыто fallback ✅, reset в цикле :122 ✅.**

## ОТВЕТЫ НА УДАРЫ (1-5 + триггер-усиление):

- **У-1 ПРИНЯТ.** Сверено: loadStem `if (stemId === 'vocals' && this._vocalHallTarget)` — присвоение `_vocalHallSource` только при живом target; main.tsx:157-159 ставит target только внутри `if (router)`; router=null при падении `new MonitorRouter(ctx)` (catch :116). Тап мертворождён без MonitorRouter. Патч: S1 — присвоение безусловно, connect остаётся под `if (this._vocalHallTarget)`.
- **У-2 ПРИНЯТ.** Сверено: reset() не трогает `_vocalHallSource` вообще (только dispose:729); пул НЕ диспоузит инстансы (`StretchPool остаётся — переиспользуем`), clearAllBuffers чистит только буферы; drums/other вне STRETCH_PRIORITY → слот вокала достаётся любому стему. Зомби-ребро = monitor-truth breach. Патч: S1-reset — disconnect старого ребра перед занулением.
- **У-3 ПРИНЯТ.** Сверено: audio-facade-v3.js (все 210 строк) — `isPlaying` ОТСУТСТВУЕТ; `window.audioEngine = facade` (:209, index.html грузит только фасад); patchV1 (defines isPlaying) вызывается нулём мест; PitchTab:260 `!ae?.isPlaying` = true всегда → вечная pause; :347-ветка vocalDisplay даёт ⏸-ложь при любой ненайденной ноте. Патч: S2 — useAudioStore (V3StatePublisher:113 `store.setPlaying(isPlaying)` — честно на каждом statechange; audio.store — zustand-leaf, циклов нет). `track-fully-loaded` СОХРАНИТЬ как backup (маунт таба после stem-ready-события доигрывается fully-loaded'ом).
- **У-4 ПРИНЯТ С УТОЧНЕНИЕМ.** Сверено: MicSourceV3:33-47 — внутренний баланс идеален (catch откатывает ++), гонка снаружи реальна. Уточнение: одного status-гарда 002 НЕДОСТАТОЧНО — destroy→RE-INIT в in-flight окне (спам 🎤 выкл/вкл быстрее резолва acquire): новый initFromMic ставит `_status='starting'` снова → continuation СТАРОГО acquire проходит status-гард → `_refNeeded=true` ставится дважды (idempotent), финальный destroy даёт release×1 при acquire×2 → refcount=1 навсегда. Гард парой условий `status==='starting' && _initGen===myGen` закрывает оба класса (poison-destroy и re-init) одной ценой. Цена: +1 приватное поле, +1 сравнение.
- **У-5 ПРИНЯТ.** Сверено: tryInit `return false` при null-тапе не гасит живой движок; retarget на следующем треке с вокалом спасает, между треками — 46ms-тик-зомби. Патч: S2 — `vocalEngineRef.current?.pause()`. Дополнение (симметрия): retarget-ветка тоже получает store-гейт — pitch-engine.retarget() безусловно ставит таймер (сверено: `this._timer = setInterval(...)` без проверки paused-состояния) → retarget на паузе трека перезапустил бы тик.
- **Триггер-усиление (track-stem-ready) ПРИНЯТ.** Сверено: Interceptor:239-241 — `document.dispatchEvent(new CustomEvent('track-stem-ready', { detail: { stemId: id } }))` на КАЖДЫЙ загруженный стем; фильтр листенера: `detail?.stemId === 'vocals'`. Эмит идёт ПОСЛЕ auto-play (:175) → к моменту tryInit `store.isPlaying=true` уже написан → движок не паузится ложно. fully-loaded остаётся backup-подпиской.

## S1 HPS (код):

**Файл `src/audio/engine-v3/pipeline/HybridPipelineService.ts`** (не frozen ✅).

**1) Геттер — в секцию Public getters, после `get stretchPool()` (~:138):**
```ts
/** ARC-2e: питч-референс тап — pre-fader vocal (instance.outputNode, ПОСЛЕ WASM-stretch
 *  = концертный темп, pitch-preserved). null ⇔ вокал-стем не загружен (сам сигнал живости).
 *  Mute/solo/volume НЕ влияют (тап ДО stretchGain). Анализер движка — sink, не в сигнальном пути. */
get vocalReferenceTap(): AudioNode | null { return this._vocalHallSource }
```

**2) loadStem — заменить vocals-блок (~:220-226) — присвоение безусловно, connect условен:**
```ts
// R1: pre-fader vocal hall tap (только vocals) — от instance.outputNode ДО stretchGain.
// ARC-2e (002 У-1): присвоение БЕЗУСЛОВНО (тап жив и без MonitorRouter), connect — только при живом зале.
if (stemId === 'vocals') {
  if (this._vocalHallSource !== instance.outputNode) {
    if (this._vocalHallSource) { try { this._vocalHallSource.disconnect(this._vocalHallSend) } catch {} }
    this._vocalHallSource = instance.outputNode
    if (this._vocalHallTarget) {
      try { instance.outputNode.connect(this._vocalHallSend) } catch {}
    }
  }
}
```

**3) reset() — добавить после `this._crashedStems.clear(); this._deadStems.clear()` (~:696), ДО `this._stretchPool.stopAll()`:**
```ts
// ARC-2e (002 У-2): рвём vocal-tap ДО переиспользования WASM-слотов пулом —
// иначе зомби-ребро outputNode→_vocalHallSend несёт чужой стем в зал (monitor-truth breach)
if (this._vocalHallSource) {
  try { this._vocalHallSource.disconnect(this._vocalHallSend) } catch {}
  this._vocalHallSource = null
}
```

## S2 PitchTab (код-скетчи):

**Файл `src/components/PitchTab.tsx`** — импорты: добавить `import { useAudioStore } from '../stores/audio.store';` (zustand-leaf, циклов нет). Чтение фасада `const ae = (window as any).audioEngine` в vocal-эффекте УДАЛЯЕТСЯ (использований после патча ноль).

**1) tryInit (~:239-265) — полная замена тела:**
```tsx
const tryInit = (): boolean => {
  if (destroyed) return false;
  // ARC-2e: V3-тап вместо мёртвых ae?.vocalsGain/ae?.stems (фасад их не даёт)
  const tap = ((window as any).__belive?.pipeline?.vocalReferenceTap ?? null) as AudioNode | null;
  setHasVocals(tap !== null);
  if (!tap) {
    vocalEngineRef.current?.pause();   // 002 У-5: гасим тик-зомби (движок жив, тап мёртв)
    return false;
  }
  if (vocalEngineRef.current) {
    vocalEngineRef.current.retarget(tap);
    if (!useAudioStore.getState().isPlaying) vocalEngineRef.current.pause(); // пауза-тиканье
    return true;
  }
  const eng = new PitchEngine();
  vocalEngineRef.current = eng;
  eng.initFromNode(tap).then(() => {
    if (genRef.current !== gen || destroyed) { eng.destroy(); return; }
    setVocalEngine(eng);
    if (!useAudioStore.getState().isPlaying) eng.pause();   // 002 У-3: store вместо ae?.isPlaying (в V3 = undefined)
  }).catch(err => { console.warn('[PitchTab] vocal engine failed:', err); });
  return true;
};
```
Гард `if (!tap)` ДО передачи в initFromNode — strict-безопасно (null не попадает в AudioNode-параметр).

**2) События (~:268-273) — добавить stem-ready-триггер, fully-loaded оставить backup'ом:**
```tsx
const onTrackLoaded = () => tryInit();                              // backup: маунт после stem-ready
document.addEventListener('track-fully-loaded', onTrackLoaded);
const onVocalStemReady = (e: Event) => {                            // 002 Усиле-1: раньше на сотни ms
  if ((e as CustomEvent).detail?.stemId === 'vocals') tryInit();
};
document.addEventListener('track-stem-ready', onVocalStemReady);
```
В cleanup эффекта: `document.removeEventListener('track-stem-ready', onVocalStemReady);`. Таймаут-сейфнет `setTimeout(tryInit, 3000)` (~:272) остаётся. `playback-state-changed` (:277) не трогаем.

**3) vocalDisplay (~:340-350) — isPlaying из store (хук в шапке компонента):**
```tsx
const isPlaying = useAudioStore(s => s.isPlaying);   // шапка PitchTab
// в IIFE vocalDisplay, ветка no-note:
if (!vocal.note && vocalEngine) {
  if (!isPlaying) return '\u23F8';                   // 002 У-3: убраны ae && !ae.isPlaying (undefined → вечный ⏸)
}
```

**4) retarget vs teardown:** null-тап = pause живого движка (НЕ destroy — retarget на следующем треке дешевле пересборки); destroy только в cleanup эффекта (unmount) — как сегодня.

## S3 pitch-engine (код-скетчи):

**Файл `src/audio/pitch/pitch-engine.ts`** — поля (~:42, рядом `_ownStream`):
```ts
private _refNeeded = false;   // ARC-2e: стрим взят у MicSourceV3 (refcounted)
private _initGen = 0;         // ARC-2e (002 У-4): gen-гвард in-flight acquire
```

**1) initFromMic (:76-86) — блок Mic stream заменить:**
```ts
async initFromMic(): Promise<void> {
  if (this._status === 'running' || this._status === 'starting') return;
  this._status = 'starting';
  const myGen = ++this._initGen;

  try {
    const ctx = this._getContext();
    if (ctx.state === 'suspended') await ctx.resume();

    /* ARC-2e: дедуп с takes.recorder через MicSourceV3 (инвариант 82e1c76).
       main.tsx:173 публикует __belive.micSource; singleton MicSourceV3 НЕ экспортирует —
       только runtime-чтение, импорт не нужен, циклов нет. */
    const micSource = (window as any).__belive?.micSource as
      | { acquire(): Promise<MediaStream>; release(): void } | undefined;

    if (micSource) {
      const stream = await micSource.acquire();
      /* 002 У-4: destroy (status='idle') или re-init (новый gen) в in-flight окне —
         release уравновешивает acquire, присвоения на мёртвом движке НЕТ */
      if (this._status !== 'starting' || this._initGen !== myGen) {
        try { micSource.release() } catch {}
        return;
      }
      this._stream = stream;
      this._refNeeded = true;   // ТОЛЬКО после успешного await (иначе двойной decrement съедает refcount REC)
    } else {
      /* fallback: V2-режим / V3 boot не дошёл — статус-кво, не хуже сегодняшнего */
      const ae = (window as any).audioEngine;
      const existing = ae?.microphoneStream as MediaStream | undefined;
      if (existing && existing.getAudioTracks().some((t: MediaStreamTrack) => t.readyState === 'live')) {
        this._stream = existing; this._ownStream = false;
      } else {
        this._stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },  // R9
        });
        this._ownStream = true;
      }
    }
    // …createMediaStreamSource, фильтры, worklet, _status='running' — БЕЗ изменений
```

**2) destroy (~:234-252) — в блок Source cleanup, ДО `if (this._ownStream && this._source)`:**
```ts
/* ARC-2e (002 У-4): refcounted-release — стрим принадлежит MicSourceV3, НЕ движку.
   try/catch: __belive.micSource может исчезнуть между acquire и destroy — silent, не throw в cleanup. */
if (this._refNeeded) {
  try { ((window as any).__belive?.micSource as { release?: () => void } | undefined)?.release?.() } catch {}
  this._refNeeded = false;
}
```
Блок `if (this._ownStream && this._source)` не трогаем: acquire-путь не ставит `_ownStream` → чужой стрим НЕ stop'ается треками.

**3) pitch.store.ts:49 — обновить комментарий (одна строка, код не менять):**
`/* mic-only до ARC-2e; риск двойного захвата с PitchTab-mic в V2 — разрулить в ARC-2e */` →
`/* решено ARC-2e: initFromMic идёт через MicSourceV3.acquire (дедуп с PitchTab-mic и REC) */`

## S4 ТЕСТЫ (7 кейсов, файлы, ассерты):

**Файл A: `src/audio/engine-v3/pipeline/__tests__/VocalTap.test.ts`** (+1 файл; стенд = BusFader18-паттерн: vi.mock('../StretchInstance') с outputNode-моком, makeCtx (:75-107), makePipeline (:109-114); сетап `p.setVocalHallTarget(fakeGain)` в кейсах 1-2):
- **К-1 lifecycle (У-1-геттер):** `expect(p.vocalReferenceTap).toBeNull()` до загрузки; `await p.loadStem('vocals', BUF)` → `expect(p.vocalReferenceTap).not.toBeNull()`; повторный loadStem('vocals') → connect не дублируется (`expect(src.connect).toHaveBeenCalledTimes(1)` на свежем outputNode-моке).
- **К-2 reset-зомби (У-2):** loadStem('vocals') → `const src = p.vocalReferenceTap` → `await p.reset()` → `expect(p.vocalReferenceTap).toBeNull()` + `expect(src.disconnect).toHaveBeenCalled()` (disconnect на instance.outputNode в reset зовётся ТОЛЬКО патч-строкой — чистый ассерт).
- **К-5 router-null (У-1-контракт):** makePipeline БЕЗ setVocalHallTarget → loadStem('vocals') → `expect(p.vocalReferenceTap).not.toBeNull()`. На непатченном коде — красный (регресс-контракт новой семантики).

**Файл B: `src/audio/pitch/__tests__/pitch-engine-modes.test.ts`** (+1 файл; сетап: `(window as any).audioEngine = { audioContext: mockCtx }` — паттерн live-trail-controller; mock ctx: createAnalyser c getFloatTimeDomainData/getFloatFrequencyData, createMediaStreamSource, audioWorklet.addModule-resolve; vi.useFakeTimers для passive-tick):
- **К-3 initFromNode:** fake-узел `{connect: vi.fn(), disconnect: vi.fn()}` → `await eng.initFromNode(node)` → `expect(eng.status).toBe('running')` + `expect(node.connect).toHaveBeenCalled()` (анализер повешен) + `vi.advanceTimersByTime(50)` → passive-tick не бросает.
- **К-4 acquire-инвариант:** `(window as any).__belive = { micSource: { acquire: vi.fn(async () => fakeStream), release: vi.fn() } }` + `navigator.mediaDevices.getUserMedia = vi.fn()` (spy) → initFromMic → `expect(acquire).toHaveBeenCalledTimes(1)`, `expect(getUserMedia).not.toHaveBeenCalled()` → destroy → `expect(release).toHaveBeenCalledTimes(1)`. Инвариант 82e1c76.
- **К-6 poison-continuation (У-4):** deferred-acquire (`let resolveAcq; acquire = vi.fn(() => new Promise(r => { resolveAcq = r }))`) → `eng.initFromMic()` без await → `eng.destroy()` → `resolveAcq(fakeStream)` → `await Promise.resolve(); await Promise.resolve()` (flush микротасков) → `expect(release).toHaveBeenCalledTimes(1)` + `expect(eng.status).toBe('idle')`. Гард ловит механикой, не надеждой.
- **К-7 static-grep (?raw-паттерн BusFader18:22, 002 Усиле-3):**
```ts
import pitchTabSrc from '../../../components/PitchTab.tsx?raw'
// (III): PitchTab не читает мёртвые фасадные поля и вообще не трогает фасад
expect(pitchTabSrc).not.toMatch(/ae\?\.\s*(isPlaying|vocalsGain|stems\b)/)
expect(pitchTabSrc).not.toMatch(/\(window as any\)\.audioEngine/)
```
К-7 размещён в файле B (требование 002 «в B или отдельным блоком» — B, отдельным describe).

**Итого: 801 + 7 = 808; файлов 67 + 2 = 69.** Кейсы 1-4 = мои Круга-1 (расширены expect-строками под патчи), 5-7 = находки 002.

## S5 КАНОН-ИНВАРИАНТ (числа + СТОП):

- **tsc = 293, Δ = 0 СТРОГО** (рост = баг патча). Типовая безопасность: геттер возвращает существующее поле `AudioNode | null` (HPS:81); reset-disconnect — try/catch на существующем узле; PitchTab-tap — `as AudioNode | null` (канон-паттерн); `_refNeeded/_initGen` — примитивы; useAudioStore-импорт — leaf, циклов нет; `?raw`-импорт К-7 типизирован vite/client (прецедент BusFader18:22). Риск-точка: гард `if (!tap)` ДО initFromNode (иначе null → strict-ошибка).
- **vitest = 808 + 0int + 0load, 69 файлов** (ровно +2: VocalTap.test.ts, pitch-engine-modes.test.ts; 3-й файл не заводить).
- **Инварианты прогона:** (I) `vocalReferenceTap` null ⇔ вокал-стем не загружен (окно reset→loadStem = честное «—»); (II) refcount-баланс MicSourceV3: каждый успешный acquire ↔ ровно один release, включая in-flight-окна (У-4, gen-гвард); (III) PitchTab не читает `ae?.isPlaying|ae?.vocalsGain|ae?.stems` и не трогает `(window as any).audioEngine` (static-grep К-7); (IV) frozen 0: `git diff --stat src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/bridges src/services/track.orchestrator.ts` → пусто.
- **СТОП-условия:** tsc > 293 → стоп, разбор диффа до продолжения; любая int/load-ошибка vitest → стоп; кейсов ≠ +7 или файлов ≠ +2 → стоп (не расширять скоуп молча); PARITY PASS не подтверждён → стоп; задет frozen → немедленный откат.

## САМОКРИТИКА (что может сломать смоук):

1. **Смоук-порядок вокал-стема при мёртвом MonitorRouter:** после У-1 тап присваивается безусловно → питч-виз жив, connect в зал не делается (и не должен — router мёртв). Окна «tap жив, но зал подключён к чужому» нет: setVocalHallTarget ставится в wire ДО первого loadStem (main.tsx:159 → interceptor.attachPipeline:168 → loadStem только после). Retry-пайплайн: каждый retry — новый HPS + новый wire, target ставится заново. Чисто.
2. **Быстрый Shift+Arrow (смена трека в retarget-окне):** reset (:122, Interceptor зовёт на КАЖДОЙ загрузке) рвёт ребро + tap=null → tryInit=false → У-5-пауза гасит тик → новый stem-ready{vocals} → retarget на свежий узел. Старый-тап-окно закрыто У-2-дисконнектом. Двойной stem-ready на трек невозможен (генерация-гвард :115-118 abort'ит мёртвую загрузку до эмитов). Остаток: retarget при paused-треке — закрыт store-гейтом в S2-ретаргет-ветке.
3. **🎤 + takes-REC параллельно:** оба через MicSourceV3.acquire → in-flight делится (:36) → ОДИН стрим, refcount=2 by design. REC-stop → release → refcount=1, питч жив. 🎤-off → release → 0 → tracks-stop. Poison-окно — У-4-гард (status+gen) + try/catch в destroy. V2-деградация (pipeline=null → micSource не опубликован, main:173 в wire): fallback getUserMedia = статус-кво.
4. **stretch-latency тапа (~60-100ms от WASM-блока 40/20ms) vs mic-реалтайм:** дельта питча корректна (pitch инвариантен к time-stretch), но isMatch ✓ срывается при глиссандо быстрее ~8 нот/с. Риск принят (002), НЕ патчим — hold 500ms (useStableVocalData) смягчает. Зафиксирован для смоука: «✓ мигает на быстрых глиссандо» — известное, не регресс.
5. **Не покрыто тестом (принято):** double-init-спам (У-4-уточнение) закрыт gen-гвардом по построению, но отдельного кейса нет (канон фиксирует +7; расширение — только через новый круг). singleton-путь pitch.store.startPitch идёт через тот же initFromMic → дедуп автоматический, отдельного кейса не требует (это же код-путь, К-4 покрывает).

## Требует решения CEO/Босса:

1. **Vmix-семантика (Босс, без изменений):** reference-listen (TakesPanel) — глушить ВЕСЬ V-Mix (setVMix(false) = defaultBranch-инверсия MonitorRouter:189-207, ломает основной микс) или только монитор-комфорт без program-truth? Без решения проводку в фасад не заводим.
2. **Mic-volume-канал (следующий slice):** куда класть GainNode — micInput (перед _micDelay, заденет vmixMicIn-тап :156) или новый узел после разветвления? Требует эскиза 3-узлового маршрута (мины G14, F-2, TASK-015b).
3. **(Новое, фиксация):** stretch-latency питч-тапа (п.4 самокритики) — если флагману понадобится суб-100ms точность дельты (скорость вокала в обучающих виджетах), это отдельный slice про WASM-блок 40ms → меньше. Сейчас принято как риск.

— 001 (Ювелир) · Круг-3 ARC-2e · ФИНАЛЬНАЯ СПЕКА · 30.08.2026
