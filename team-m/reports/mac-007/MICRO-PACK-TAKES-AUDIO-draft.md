# MICRO-PACK-TAKES-AUDIO · DRAFT (design-only) · 2026-08-25 · агент: Ф001 Со-Архитектор

**Основание:** team-m/MIGRATION-HOLES.md (последний большой P1-кластер, стресс-коррекция в хвосте подтвердила P1) · docs/PLAN-v3.3-CANONICAL.md §4/§5 · конвергенция с MICRO-PACK-B-SLICE-draft.md §7 (пост-revival мир учтён, конфликтов нет).
**Скоуп:** кластер тейков — «solo не solo» + stale-restore, мёртвый vocal-fade, natural-end без паузы, seek-from-idle. Ноль правок кода в этом паке — только дизайн.
**Ключевая архитектурная находка:** все четыре дефекта чинятся **без оживления фасада** — прямым публичным v3-API (`pipeline.setBusVolume/getBusVolume/muteStem`, `transport.play(initialOffset)`, helpers `takes.time.ts`). Пак устраняет последнего консьюмера `ae.set*Volume` среди четырёх «B-slice-бенефициаров» и потому **сужает** бласт-радиус B-slice (см. §2).

**Поправки к путям кластера (факт):** hook `src/takes/hooks/useTakesPlayback.ts`; strip `src/takes/components/TakesControlStrip.tsx`; transport `src/audio/engine-v3/core/TransportV3.ts`; pipeline `src/audio/engine-v3/pipeline/HybridPipelineService.ts`; время `src/takes/takes.time.ts` (helpers `getPlaybackTime/seekTo/isPlaying/setRate` уже существуют — hook импортирует только первые два).

---

## §1 Решения по 4 пунктам (file:line было → будет)

### 1.1 «Solo не solo» + stale-restore (`useTakesPlayback.ts:48-68`, :196-199)

**Было:** `applySoloMute` (:48-54) зовёт raw `ae.setInstrumentalVolume(0)/setVocalsVolume(0)` → сегодня под H4.1 (`main.tsx:290-291`) глотается → превью поверх бэкинга. После B-slice revival те же вызовы стали бы живыми писателями music-bus/vocal-bus (=duck всей программы — корректный звук, но через master-surface со всеми фfight-рисками §3 B-slice). `restoreVolumes` (:56-68) льёт значения из `audio.store` — они протухают относительно фактических bus-факторов (inst-фейдер ControlDeck пишет шину напрямую, мимо стора).

**Будет:** новый helper `src/takes/takes.duck.ts` (паттерн `takes.time.ts`: единая точка V3-aware аудио-логики тейков):

```ts
export interface DuckHandle { restore(): void }
export function duckProgram(opts?: {
  buses?: Array<'music-bus' | 'vocal-bus'>;   // default: обе
  rampMs?: number                              // 0 = мгновенно
}): DuckHandle | null
```

Маршрутизация внутри helper:
- **v3 + stems** (`__v3Active && __belive.pipeline && stemOrchestrator.all().length > 0`): snapshot `p.getBusVolume('music-bus')/('vocal-bus')` (публичный геттер HPS:545) → duck `p.setBusVolume(bus, 0)` (HPS:538, клампит и пересчитывает все стемы шины) → restore `p.setBusVolume(bus, snapshot)` — **точные актуальные значения**, стор не участвует. Превью остаётся слышимым: оно идёт мимо шин (`attachProgramSource` → `router.programInput`, FR-002 gain=1 всегда, MonitorRouter.ts:57-58, :281-284), нулятся только стемы внутри pipeline.
- **v3 + no-stems**: единственный носитель звука — stem `instrumental` (вне шин, инвариант A2.25, HPS:624). Duck `p.muteStem('instrumental', true)` (публичный HPS:525), restore `muteStem('instrumental', false)` — mute-флаг не трогает raw-volume bookkeeping, восстановление побитово точное. `instrumental` в stems-режиме НЕ трогаем никогда.
- **v2 / нет pipeline** (`__v3Active === false`): legacy-ветка дословно сегодняшняя — `ae.set*Volume(0)` + restore из `audio.store` (dual-mode паритет по образцу ControlDeck inst-фейдера).

Вызовы: `applySoloMute` → `duckProgram(); soloActiveRef.current = true` (handle в ref); `restoreVolumes` → `duckHandleRef.current?.restore()`. Тем же helper пользуется п.1.2 → один writer duck-состояния на флоу тейков.

**TempoRate-хвост того же пункта:** `ae.setPlaybackRate(tempoRate)` (:162-165) и `ae.setPlaybackRate(1)` (:97-102) — фасадный `setPlaybackRate(){}` no-op (js/audio-facade-v3.js), вне revival-четвёрки → training-тейки молча без темпа. Замена: `setRate(tempoRate)` / `setRate(1)` из `takes.time.ts` (под v3 → `transport.setPlaybackRate`, паритет V2 — менялась скорость всей программы). Restore звать только если `previewTempoRateRef.current !== null` (как сегодня).

### 1.2 Vocal-fade мёртв (`TakesControlStrip.tsx:254-268`)

**Было:** в последней секунде pre-roll читается v2-only `(ae as any).stems?.get('vocals')?.gainNode` и гонится `linearRampToValueAtTime(0)` — в v3 `ae.stems` не существует, fade тихо пропускается (catch-ветка :266-268). Restore — эффекты TakesPanel (`:869-870`, `:921-922`, `:947-948` через `ae.setVocalsVolume`) — сегодня мёртвы под H4.1, после revival оживут, но с semantic-mismatch «raw-stem зеркало как bus-фактор» (R4).

**Будет:** новый **публичный** метод `HybridPipelineService.fadeBusVolume(busId, target, rampMs)` (рядом с `setBusVolume`, после :545):

```ts
/** Плавный фейд шины (TakesControlStrip pre-roll): bookkeeping сразу, гейн — рампой */
fadeBusVolume(busId: string, target: number, rampMs: number): void {
  const c = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 1
  this._busVolumes[busId] = c
  for (const id of this._chainA.stems.keys()) {
    if (this.busOf(id) !== busId) continue
    const sg = this._stretchGains.get(id)
    if (sg) this._rampGain(sg, this._effectiveGainOf(id), Math.max(0, rampMs))
  }
}
```

Свойства: состояние (`_busVolumes`) финализируется мгновенно, рампается только аудио через существующий `_rampGain` (:603-609) → **single-writer не нарушен** (никаких прямых `.gain.value` вне `_applyEffectiveGain`/`_rampGain` — static-grep тест :297 проходит без правки whitelist); повторный `setBusVolume` после фейда даёт мгновенную коррекцию 15мс — штатно. NaN/Infinity → no-op фактор 1 (паритет H2.5).

Call site (:254-268): при `__v3Active` — `const h = duckProgram({ buses: ['vocal-bus'], rampMs: Math.max(50, left * 1000) })` в ref `vocalFadeDuckRef`; legacy-ветка (gainNode-рамп) сохраняется дословно для v2-конфига. Snapshot-restore: `vocalFadeDuckRef.current?.restore()` во всех точках teardown рекордера — M2-abort (:238-243), `handleIntermediateWindowEnd` (:361-375), guard/finalize (:389-396), после `recorder.stop()` (:399-401) + unmount-cleanup. Взаимодействие с эффектами TakesPanel — §4/R4 (restore стрипа выполняется раньше, значения сходятся).

### 1.3 Natural-end не паузит транспорт (`useTakesPlayback.ts:108`)

**Было:** `if (ae?.isPlaying) void getTransport().pause()` — у v3-фасада члена `isPlaying` нет вообще (E2 B-slice его только добавит) → условие всегда falsy → после естественного конца тейка программа продолжает играть.

**Будет:** убрать зависимость от фасада: `if (options?.pauseEngine && isPlaying()) void getTransport().pause()` — `isPlaying()` уже существует в `takes.time.ts` (`getTransport()?.state === 'playing'`). Двойной защиты не боимся: `TransportV3.pause()` сам early-return при state≠playing (:171-172). E2 остаётся бенефициаром для остальных потребителей (reference-listen TakesPanel:1162/:1209, MonitorMixPanel, PitchTab) — этот фикс от него **не зависит** и закрывает «автопаузу» раньше mic-гейта.

### 1.4 seekTo-preview из idle теряется (`useTakesPlayback.ts:189` + `TransportV3.seek:204`)

**Было:** `seekTo(timeRange.startTime)` при state=`idle|ended` тихо возвращается (`TransportV3.seek:204` guard) → следующий `getTransport().play()` (:202) стартует clock с 0 → тейк (startOffset от trimStart) звучит мимо блока, бэкинг с начала.

**Будет:** state-aware старт на документированном контракте `play(initialOffset)` (TransportV3.ts:121-134: offset применяется ровно из idle/ended, «start-at-position in one call»):

```ts
const tr = getTransport();
const fromIdle = tr.state === 'idle' || tr.state === 'ended';
// ...
const playResult = fromIdle ? tr.play(timeRange.startTime) : tr.play();
```

`seekTo` (:189) сохраняется — он правильный механизм для `playing` (live-seek) и `paused` (тихое перепозиционирование перед resume). `engineOffsetSec` (:219-220) после фикса читает позицию ≈ startTime → дрейф-компенсация работает как задумано. Отклонённая альтернатива: менять семантику `TransportV3.seek` из idle — blast radius на scrub UI/№17-pin неоправдан для точечного фикса.

---

## §2 Порядок применения относительно B-slice / E1

| Шаг | Что | Почему |
|---|---|---|
| 1 | **TAKES-AUDIO — можно и рекомендуется ДО B-slice** | Все правки не зависят от revival: работают поверх сегодняшнего v3 (pipeline-функции живы с №18-BUS, ретест юзера ✅). Ленд до revival убирает «инверсию в duck всей программы» из уравнения B-slice §3: после E6 hook уже не зовёт ни одного revival-члена → конфликт невозможен по построению |
| 2 | **B-slice (E1..E8)** | Без изменений. Ему идёт поправка: пункт §3 про useTakesPlayback («applySoloMute зануляет обоих мастеров…») помечать OBSOLETE-TAKES-AUDIO; кейс BusFader18 «solo-duck сквозь факторы: applySoloMute(0,0)…» переформулировать на `duckProgram()` (см. §3). Остальные потребители (VolumeControls, SyncEditorPanel, TakesPanel-эффекты) по-прежнему требуют E3/E6 |
| 3 | **E1 (канонизация предиката)** | Ортогонален. Дисциплина соблюдена: читаем только `(window as any).__v3Active` (тот же алиас, что `takes.time.ts`), новых алиасов не вводим, writer один — `__setV3Active` |
| Зависимости | Нет циклов | Единственная внутренняя зависимость: `takes.duck.ts` нужен и :1.1, и :1.2 — коммитить одним паком |

Риск обратного порядка (B-slice первым, TAKES-AUDIO позже): окно, где revived-сеттеры получают duck-всю-программу от hook'а + stale-restore из стора — работает, но ушами это «solo с побочным duck» и рестор чужих фейдеров. Не блокер, но порядок 1→2 чище. mic-гейт PLAN §5 (не назначать до закрытия B-slice) не нарушается: три из его ретест-ушей (solo-превью, vocal-fade, автопауза) этим паком закрываются раньше и ретестятся на той же сессии.

---

## §3 Тесты

### BusFader18.test.ts — новый describe `'MICRO-PACK-TAKES-AUDIO: duck/fade через pipeline'`
1. `duckProgram @ v3+stems: обе шины → 0 через setBusVolume; restore возвращает ТОЧНЫЙ snapshot (0.37/0.42), не стор` — включая нестандартные факторы.
2. `duckProgram @ v3+no-stems: muteStem("instrumental",true); raw-volume bookkeeping не тронут; restore возвращает effective = raw × busFactor`.
3. `duckProgram @ __v3Active=false: legacy-ветка ae.setInstrumentalVolume/setVocalsVolume спаями; pipeline не трогается` (dual-mode).
4. `fadeBusVolume: _busVolumes финален мгновенно (getBusVolume===0 сразу), а stretchGain получает linearRampToValueAtTime с концом окна rampMs` — smooth-контракт.
5. `fadeBusVolume: NaN/±Infinity → фактор 1, out-of-range → clamp` (паритет H2.5).
6. `solo-duck × stem-solo сквозь факторы` — переформулированный кейс из B-slice §4: `duckProgram({buses:[обе]}) + активная соло-маска → эффективный гейн всех стемов 0; restore → raw × busFactor × маска`.

### Новый файл `src/takes/hooks/__tests__/useTakesPlayback.test.tsx` (renderHook + vi.mock `engine-v3`/`takes.duck`)
1. `natural-end: source.onended при transport.state="playing" → pause() вызван; при "idle" → не вызван` (фикс 1.3).
2. `play-from-idle: state="idle" → play(startTime); state="paused"/"playing" → play() без offset, seekTo вызван` (фикс 1.4, таблица состояний).
3. `solo-режим: previewMode="solo" → duckProgram(); options.forceContext=true → не зовётся; смена previewMode на live → restore` (эффект :244-251).
4. `training-take: setRate(tempoRate) вызван; stopPreview → setRate(1) ровно один раз и только если tempo применялся` (фикс 1.1-хвост).

Уровень честности: это 🟡 статика (моки транспорта/ctx); живое поведение — уши mic-сессии (§5). Proof-of-change для 1.3/1.4 — тесты 1-2 (изменение поведения зафиксировано ассертами).

---

## §4 Risks + Frozen-check

| # | Риск | P | I | Митигация |
|---|---|---|---|---|
| R1 | Окно «B-slice пролендил, TAKES-AUDIO ещё нет»: revived ae.set*Volume получают duck-программы от hook + stale-restore | MED | MED | Рекомендованный порядок §2 (TAKES-AUDIO первым); если наоборот — принять как временное поведение, не баг |
| R2 | Двойной writer vocal-bus: snapshot-restore стрипа vs эффекты TakesPanel (оживут по E6) пишут baseline из raw-зеркала | MED | LOW | Restore стрипа исполняется в teardown (раньше эффектов); значения сходятся (pre-fade snapshot == baseline в нормальном флоу). Расхождение возможно только при движении фейдера ВО время countdown — логировать `[TAKES-DUCK]`, принять |
| R3 | Пользователь двигает фейдер во время активного duck: ControlDeck пишет шину, restore потом затрёт snapshot-ом | HIGH | LOW | Паритет с сегодняшним v2-поведением (фейдер во время превью и так подавлялся H4.1); документируем, UX-решение вне скоупа |
| R4 | `fadeBusVolume` — рост публичной поверхности HPS | LOW | LOW | Реализация строго через `_rampGain`/`_effectiveGainOf`, без новых прямых writers → static-grep BusFader18:297 зелёный без правок |
| R5 | Метры стемов падают в 0 во время duck (meter-тап после volume/mute/solo, HPS:558) — ложная тревога «звук умер» при верификации | HIGH | LOW | Пункт §5-verify заранее: ожидаемое поведение, не регрессия |
| R6 | Panned-preview (`options.pan`) идёт напрямую в `ctx.destination` (:177-182) мимо program-bus — duck на него не влияет | LOW | LOW | Пре-existing (и сегодня так); отдельная запись в бэклог, не в этом паке |

**Frozen-Zone — подтверждение: паком НЕ задевается.**
- `AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts` — правок нет; legacy-ветки воспроизводят сегодняшние вызовы дословно;
- `_-поля` извне не читаются: только публичные `setBusVolume/getBusVolume/muteStem` + НОВЫЙ публичный `fadeBusVolume`; `busOf/_effectiveGainOf/_rampGain/_stretchGains` используются исключительно внутри собственного класса HPS;
- vendor WASM — нет. Все правки: `src/takes/*` (hook, strip, новый duck-helper), `HybridPipelineService.ts` (один публичный метод), два тест-файла.

---

## §5 Verify-чеклист (Near Light)

Автотест:
1. Канон: `tsc 313 / vitest passed 769+N, 0 новых ошибок, 0 новых skip` (формулировка А4).
2. BusFader18 расширенный (§3) зелёный; static-grep single-writer без правок whitelist.

Консоль/состояние (VITE_ENGINE=v3):
3. Duck/restore: `[TAKES-DUCK]` маркеры симметричны (duck↔restore), после стопа превью `getBusVolume('music-bus'/'vocal-bus')` равны pre-duck; `__belive.pipeline.muteStem`-флаг instrumental снят.
4. НОЛЬ варнов `[№18-BUS] ae.set*Volume ignored` от тейк-флоу (hook больше не ходит на master-surface) — появление = регрессия.
5. Метры стемов = 0 во время solo-превью — ОЖИДАЕМО (R5), метры превью-источника живут.

Уши (mic-сессия §5 плана — ровно её ретесты):
6. **Solo-превью**: тейк играет ПОВЕРХ заглушённой программы (stems-режим и no-stems), после конца — громкость вернулась точно (не из стора).
7. **Vocal-fade**: плавное затухание вокала за последнюю секунду countdown (не щелчок 15мс), после записи вокал восстановлен.
8. **Автопауза**: естественный конец тейка останавливает программу; стоп вручную до конца — программу НЕ паузит лишний раз (pause-engine только в onended-ветке).
9. **Seek-from-idle**: клик по тейку при остановленной программе → программа и тейк стартуют синхронно от начала блока (не с 0).
10. Регресс-уши: №17 (pin/цифры), №18 (фейдеры), v-Mix (центр-тап), Inst/Voc dual-mode — fadeBusVolume не задевает vmix/vocalHall тапы (они pre-fader, R1-proof).

---

*Статус: DRAFT, design-only, код не менялся, коммит не выполнялся.*
