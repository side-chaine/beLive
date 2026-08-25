> **СТАТУС Ф002 (007_Мак, 25.08): стресс-проверен 10/10 клеймов по file:line. R1 (Interceptor:169 без generation-check) ЭСКАЛИРОВАН Ц3. Готов к Оператору после ратификации Hub.**

# MICRO-PACK-B-SLICE · DRAFT (design-only) · 2026-08-25 · агент: Ф001 Со-Архитектор

**Основание:** docs/PLAN-v3.3-CANONICAL.md §4 · фундамент team-m/B-SLICE-AUDIT-2026-08-25.md
**Скоуп:** оживить 4 члена `js/audio-facade-v3.js` (`get audioContext`, `get isPlaying`, `setInstrumentalVolume`, `setVocalsVolume`) через pipeline/router; продлить гард `__v3Active`; `_applySolo-cleanup`. Ноль правок кода в этом паке — только дизайн.

**Поправки к путям брифа (факт):** фасад `js/audio-facade-v3.js`; адаптер `src/audio/engine-v3/V2Adapter.ts` (НЕ engine-v2); клетка `src/audio/engine-v3/integration/V2AudioCage.ts`; ControlDeck `src/components/ControlDeck.tsx`; тесты `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts`; solo-hook `src/takes/hooks/useTakesPlayback.ts`.

---

## §1 Edits — таблица точных правок

| # | Файл:строка | Было | Станет | Зачем |
|---|---|---|---|---|
| E1 | `js/audio-facade-v3.js` (вставка между :29 и :30) | члена нет | `get audioContext()` → `(window.__belive && (window.__belive.ctx \|\| (window.__belive.pipeline && window.__belive.pipeline.ctx))) \|\| null` в try/catch | Синглтон: main.tsx создаёт единственный ctx (`main.tsx:100 getAudioContext()`), pipeline построен на нём же (`main.tsx:157 new HybridPipelineService(ctx)`; публичный `get ctx()` HybridPipelineService.ts:135, «F-1 (431)»). Закрывает split-context monitor-mix.js:12 / useWaveformData.ts:62 и тихие деградации pitch-engine.ts:48 / recording.store:37 / FullAvatar:53 / audio-reactive:30 / rehearsal-trigger:281 (аудит §1c). takes.recorder.ts:106 уже читает ровно эту цепочку (`__belive?.pipeline?.ctx ?? ae.audioContext`) — оживает без правок |
| E2 | `js/audio-facade-v3.js` (там же) | члена нет | `get isPlaying()` → `const gt = window.__getTransport; const t = typeof gt === 'function' ? gt() : null; return !!t && t.state === 'playing';` в try/catch | Источник истины — публичный `TransportV3.get state` (TransportV3.ts:79), значения `'idle'|'ready'|'playing'|'paused'|'ended'` (core/types.ts:3); `__getTransport` экспортирован main.tsx:196. Оживает автопаузу (useTakesPlayback.ts:108), reference-listen (TakesPanel:1162,:1209), MonitorMixPanel:392, PitchTab:260/:347 (аудит §1d) |
| E3 | `js/audio-facade-v3.js:33` | `setInstrumentalVolume() {}, setVocalsVolume() {},` | реальные сеттеры (псевдокод ниже): clamp01; если не `__v3Active` → return (в v2 методы подменяет patchV1 целиком); `p = window.__belive?.pipeline`, нет → return; **stems-режим** (`window.__belive.stemOrchestrator?.all().length > 0`): inst → `p.setBusVolume('music-bus', c)`, voc → `p.setBusVolume('vocal-bus', c)`; **no-stems**: → `p.setStemVolume('instrumental'\|'vocals', c)` | Маршрут через pipeline/router: публичные `IPipelineController.setStemVolume` (IPipelineController.ts:45) и `setBusVolume` (HybridPipelineService.ts:538, clamp+пересчёт шины). Симметрия H3.4: instrumental вне шин (`busOf→null`, инвариант A2.25, HybridPipelineService.ts:624), поэтому no-stems ветка — raw stem. vocal-bus покрывает vocals+backing (:627) — задокументировать как «вокал-семья» |
| E4 | `src/main.tsx:100` (сразу после `const ctx = getAudioContext()`) | — | `;(window as any).__belive = (window as any).__belive \|\| {}; (window as any).__belive.ctx = ctx` | Сейчас `__belive` инициализируется только внутри async-IIFE (main.tsx:178) — до того E1 вернул бы null. Синхронная публикация даёт синглтон с первого тика (и в v2-конфиге тоже) |
| E5 | `src/main.tsx:140` | `if ((method === 'seekTo' \|\| method === 'setCurrentTime') && _v3Active)` | добавить в условие `\|\| method === 'setInstrumentalVolume' \|\| method === 'setVocalsVolume'` | Продление гарда на volume-члены — см. §2. Тот же блок, тот же флаг `_v3Active`, тот же writer `__setV3Active` (:148-151) |
| E6 | `src/main.tsx:290-291` | `__guardAeMethod('setInstrumentalVolume')`; `__guardAeMethod('setVocalsVolume')` | строки удалить; `setStemVolume`/`setStemsEnabled` (:292-293) оставить | Reconciliation H4.1 — см. §3. Обёртка для revival-членов инвертирует смысл: глотает легит UI-записи |
| E7 | `src/main.tsx:268` (комментарий H4.1) | «Self-contained: под обёрткой в v3-env фасад-no-op…» | переписать: «под обёрткой setStemVolume/setStemsEnabled остаются фасад-no-op; setInstrumentalVolume/setVocalsVolume REVIVED (B-slice) и из обёртки исключены» | Премис больше не всеобщий; коммент не должен врать следующему агенту |
| E8 | `src/audio/engine-v3/pipeline/StemChain.ts:95-103` (`_applySolo`) | пустая маска → всем `stem.volume = 1`; непустая → soloed 1, остальные 0 | убрать ВСЕ прямые записи `stem.volume`; оставить bookkeeping маски (`_soloed.add/delete`) + `isSoloActive()/isStemAudible()` как есть | `_applySolo-cleanup` (план §4c). Single-writer: `HybridPipelineService.soloStem` (:552-556) УЖЕ пересчитывает все гейны через `_applyEffectiveGain`, читая маску через `isStemAudible` (:617). Прямая запись в `stem.volume` = второй писатель, который после оживления шин гонится с bus-факторами. Смежное, тот же класс дефекта, вне скоупа пака: `StemChain.muteStem:74-77` тоже пишет volume напрямую |

**Не редактируется (осознанно):** ControlDeck.tsx (оба фейдера уже корректны — §3); useTakesPlayback.ts (оживает сам); TakesPanel/SyncEditorPanel/VolumeControls (бенефициары; зеркала стора остаются дисплеем); monitor-mix.js/pitch-engine и пр. (бенефициары E1/E2); IV2PublicContract.ts (оба имени уже в PUBLIC_METHODS :95-96 — без E5 адаптер честно форвардит их клетке, это и есть дыра).

Псевдокод E3 (для исполнителя):

```js
function __clamp01(v) { return (typeof v === 'number' && Number.isFinite(v)) ? Math.min(1, Math.max(0, v)) : null }
function __pipeline() { try { return window.__belive && window.__belive.pipeline } catch { return null } }
function __stemsMode() {
  const o = window.__belive && window.__belive.stemOrchestrator
  return !!(o && o.all && o.all().length > 0)
}
// setInstrumentalVolume(v):
const c = __clamp01(v); if (c === null || !window.__v3Active) return
const p = __pipeline(); if (!p) return
__stemsMode() ? p.setBusVolume('music-bus', c) : p.setStemVolume('instrumental', c)
// setVocalsVolume(v): то же, music-bus→vocal-bus, instrumental→vocals
```

---

## §2 Guard delegateSync — логика продления

**Канал атаки (аудит §2):** `V2AudioCage._zeroAllVolumes` (V2AudioCage.ts:106-107) зовёт `delegateSync('setInstrumentalVolume',0)/('setVocalsVolume',0)`; watchdog повторяет зануление 3× каждые 500мс (:59-67); `deactivate()` восстанавливает в 1 (:88-89). Плюс каскад свитча main.tsx:237-238. Сегодня это безопасно ТОЛЬКО потому, что сеттеры фасада no-op. После E3 канал пишет реальные нули/единицы в music-bus/vocal-bus → клетка глушит V3-стемы.

**Почему точка продления — main.tsx, а не V2Adapter:** план §4(b) запрещает дублирование в адаптере; интерцептор уже стоит (main.tsx:135-145) и является единственным местом между cage/cascade и адаптером; у него уже есть замыкание `_v3Active` и единый writer `__setV3Active` (:148-151, драйвер — V3DataInterceptor). V2Adapter — общий слой и для легитимного V2-recovery (M3); глушить его изнутри — ломать план.

**Порядок установки (гарантия «гард раньше любого re-zero»):** `interceptor.attachCage(v2Cage)` (main.tsx:122) только регистрирует клетку — `activate()` вызывается асинхронно при V3 auto-play, тогда как monkey-patch ставится синхронно в том же бут-тике (:135-145). Любой будущий activate/watchdog/deactivate выполняется поверх расширенного патча.

**Псевдокод (итоговое состояние блока):**

```ts
_adapter.delegateSync = ((method: string, ...args: any[]): any => {
  if (method === 'play' && _v3Active) { warn('[V2Interceptor] 🚫 V2.play() blocked'); return }
  if ((method === 'seekTo' || method === 'setCurrentTime'
       || method === 'setInstrumentalVolume'   // ← B-slice E5
       || method === 'setVocalsVolume')        // ← B-slice E5
      && _v3Active) {
    warn(`[V2Interceptor] 🚫 V2.${method}() blocked — V3 is active`)
    return
  }
  return _originalDelegate(method, ...args)
}) as typeof _adapter.delegateSync
```

**Что НЕ блокируем:** `setStemVolume/setStemMute/setStemsEnabled` — они целятся в собственные стемы V2; клетка обязана уметь их глушить (тест BusFader18:432 фиксирует проход `setStemMute`). До оживлённых бусов они не дотягиваются.

**Дисциплина предиката (зависимость от pending-E1 плана):** продление читает замыкание `_v3Active` этого же блока; новых алиасов не плодим; writer остаётся один — `__setV3Active`.

**Осознанный побочный эффект:** V2-recovery по FM-4 делает `__setV3Active(false)` ДО `cage.deactivate()` → restore(:88-89) проходит гард и пишет 1 в оживлённые бусы. В recovery-сценарии V3 уже мёртв, запись нейтральна — принять, прогнать в drill (риск R2).

---

## §3 Reconciliation H4.1 — семантика после оживления

**Было (контракт BusFader18:363-439):** setter НЕ зовётся при `__v3Active` (DEV-warn+return); зовётся в non-V3 ветке. Безопасно, потому что «facade-no-op underneath» (коммент main.tsx:268).

**Стало:** премис ломается точечно — два из четырёх обёрнутых членов становятся живыми писателями. Если оставить H4.1 как есть, он глотает ЛЕГИТИМНЫЕ UI-записи: ControlDeck vocal-fader (ControlDeck.tsx:279,:291), TakesPanel (:787-788,:869-870,:921-922,:947-948), SyncEditorPanel (:461,:464), VolumeControls (:76,:82), useTakesPlayback restore (:63-64). Инверсия защиты во вред.

**Правило reconciliation:** H4.1 продолжает защищать только членов, оставшихся no-op (`setStemVolume`, `setStemsEnabled`). Для revival-членов защита переносится на уровень канала (E5, delegateSync — против cage/cascade), а прямые `ae.*` вызовы становятся каналом доставки UI.

**Что меняется для ControlDeck dual-mode (№18-BUS):**
- Inst-fader (:190-235): без правок. Ветка `__v3 && hasMusicStems` пишет music-bus напрямую, мимо фасада, — теперь это ровно та же цель, куда писал бы оживлённый сеттер (E3 stems-ветка) → семантическая унификация без единой правки. Non-V3 ветка (`!__v3` + DC3-гард против DEV-warn спама :200,:221) продолжает звать `ae.setInstrumentalVolume` → в v2 его патчит patchV1.ts:32 (frozen, не трогаем).
- Vocal-fader (:274-301): зовёт `ae.setVocalsVolume(v)` безусловно + зеркало. После пака в v3 это живой writer в vocal-bus; зеркало `setStemVolume('vocals', v)` остаётся источником отображения. Двойной записи в ГЕЙН нет (стор и шина — разные слои), но появляется расхождение «зеркало vocals vs фактический фактор vocal-bus» — принять и задокументировать (R4).
- useTakesPlayback solo-mute (:48-68): `applySoloMute` зануляет обоих мастеров → в stems-режиме это music-bus 0 + vocal-bus 0 = duck всей программы (ровно то, чего дефект «solo не solo» не доставал); restore возвращает из audio.store. Координация с маской StemChain (E8): `_effectiveGainOf` перемножает факторы (raw × bus × audible), так что duck×stem-solo математически корректен; ушами проверить (§6).
- DEV-warn семантика: `[№18-BUS] ae.setInstrumentalVolume() ignored` для revival-членов появляться больше не должна; такое появление = регрессия E6.

---

## §4 BusFader18.test.ts — правки и добавления

Файл: `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts`.

**Править (describe 9, :363-439):**
1. `installGuard` (:365-381) — контракт-зеркало main.tsx после E6: список guard(...) сократить до `'setStemVolume'`, `'setStemsEnabled'`.
2. Кейс `'__v3Active=false → оригинал вызывается; __v3Active=true → DEV-warn+return'` (:393) — имя сохранить, сузить до двух методов; в конец добавить новый контракт: `ae.setInstrumentalVolume(0.9); expect(origInst).toHaveBeenCalledTimes(2)` — прямой вызов revival-члена ПРОХОДИТ при активном флаге.
3. Кейс `'cage-инвариант: гард задевает только ae.*, канал V2Adapter.delegateSync работает при __v3Active'` (:424) — ЗАМЕНИТЬ на инвертированный контракт: `'cage-инвариант v2: volume-члены блокируются в delegateSync при __v3Active; не-volume проходят; прямые ae.* revival-члены проходят'`. Тело — mock-адаптер с расширенной обёрткой (зеркало E5): `delegateSync('setInstrumentalVolume',0)` НЕ доходит до форвардера; `delegateSync('setStemMute','drums',true)` доходит; `ae.setInstrumentalVolume(1)` доходит до оригинала.

**Добавить (новый describe):** `'B-SLICE: revived facade (audioContext/isPlaying/volume → pipeline/router)'`, кейсы:
- `'setInstrumentalVolume @ v3+stems → pipeline.setBusVolume("music-bus"), НЕ setStemVolume'`
- `'setVocalsVolume @ v3+stems → pipeline.setBusVolume("vocal-bus") (включая backing)'`
- `'setInstrumentalVolume/setVocalsVolume @ v3-no-stems → pipeline.setStemVolume(instrumental/vocals)'`
- `'сеттеры клампят 0..1 и отбрасывают NaN/±Infinity (паритет V2/стора)'`
- `'сеттеры при __v3Active=false — no-op (в v2 методы подменяет patchV1)'`
- `'get audioContext → __belive.ctx ?? __belive.pipeline.ctx, один и тот же объект; второй AudioContext не создаётся'`
- `'get isPlaying → true только при transport.state === "playing"; без транспорта → false'`
- `'solo-duck сквозь факторы: applySoloMute(0,0) + активный stem-solo → эффективный гейн 0; restoreVolumes → raw × busFactor'`
- `'cage-watchdog ×3 через расширенный delegateSync не пишет в pipeline (гард E5)'`

Describe 10 (dual-mode H3.4, :445-511) — НЕ трогается: маршрутизация фейдера не меняется, зеркало `routeInstFader` (:447) актуально.

---

## §5 Risks & Frozen-check

| # | Риск | P | I | Митигация |
|---|---|---|---|---|
| R1 | Cage-watchdog/деактивация достаёт оживлённые сеттеры (E5 пропущен/откачен) → triple-zero глушит V3-стемы; deactivate шлёпает бусы в 1 | LOW (порядок установки гарантирован, цена максимальная) | HIGH | E5 обязателен в том же паке, ДО E3; тест «watchdog ×3»; console-маркер `[V2Interceptor] 🚫 … setInstrumentalVolume` в verify |
| R2 | V2-recovery: порядок FM-4 (`__setV3Active(false)` ДО `cage.deactivate()`) пропускает restore (:88-89) → запись 1 в music/vocal-bus поверх user-pref | MED | MED | Принять (recovery = V3 мёртв, дефолты нейтральны), зафиксировать в drill; опция на будущее — deactivate до флипа |
| R3 | Мультиписатель громкостей: `_applySolo` пишет stem.volume мимо `_effectiveGainOf`; добавляются bus-писатели → десинк маска/шины/стор | HIGH без E8 | MED | E8 в том же паке (single-writer через pipeline.soloStem :552-556); смежное `muteStem` (StemChain:74-77) — вне скоупа, зарегистрировать отдельно |
| R4 | Расхождение отображения: зеркала стора vs bus-факторы; устаревшие комменты H4.1; pending-E1 (алиасы предиката) | MED | MED | §3-правила; правка коммента E7; продление читает замыкание `_v3Active`, новых алиасов не создаём |
| R5 | Бенефициары E1 оживают внезапно: monitor-mix.js/useWaveformData переходят со СВОЕГО контекста на синглтон (чужие suspend/resume/close; recording.store:37-38 резюмит общий ctx) | LOW | MED | Аудит: ctx.close() никто не зовёт; verify-пункт «ровно один AudioContext» |

**Frozen-Zone — подтверждение: паком НЕ задевается.**
- `AudioEngineV2.ts` — правок нет (читался только для сверки `get audioContext` :1606);
- `patchV1.ts` — правок нет (v2-ветка подменяет методы фасада целиком; защита от двойного оживления встроена в early-return E3);
- `bridges/*`, `track.orchestrator.ts` — правок нет;
- `_`-поля извне не читаются: фасад использует только публичные поверхности (`__belive.ctx`, публичный геттер `pipeline.get ctx()`, публичный `transport.get state`, `orchestrator.all()`, публичные `pipeline.setBusVolume/setStemVolume`). Единственное касание приватного — E8 внутри собственного класса StemChain (`_applySolo`, `_soloed`) — инкапсуляция класса не нарушается, Tier-1 доступов нет.

---

## §6 Verify-чеклист (Near Light)

Автотест:
1. Канон 313/769 — зелёный, без новых skip.
2. `tsc` — 0 новых ошибок.
3. BusFader18 обновлённый (§4) — зелёный.

Консоль/состояние (VITE_ENGINE=v3):
4. Бут: `__v3Active=true`; при активации клетки ровно 3× `[V2Interceptor] 🚫 V2.setInstrumentalVolume()/setVocalsVolume() blocked`; НОЛЬ варнов `[№18-BUS] ae.set*Volume ignored` для revival-членов.
5. `window.__belive.ctx === window.__belive.pipeline.ctx === window.audioEngine.audioContext` (один объект); в системе ровно один AudioContext (monitor-mix больше не плодит свой).
6. `audioEngine.isPlaying` синхронен с транспортом; пауза take-listen реально ставит транспорт (автопауза).
7. Cage-drill: форс `__v2Cage.activate()` → стемы V3 продолжают звучать; `deactivate()` при активном `__v3Active` бусы не меняет.

Уши (мик-сессия §5 плана):
8. Solo-превью: duck программы при проигрывании тейка, unduck после — в stems-режиме и no-stems.
9. Vocal-fade: вокальный фейдер ControlDeck плавно ведёт вокал-семью (vocals+backing) в v3.
10. Автопауза: конец reference-listen в TakesPanel останавливает программу.
11. Регресс ранее закрытого ушами: v-Mix, №17, №18; Inst/Voc dual-mode (inst в stems = минус, no-stems = мастер).
12. Rollback-flip v3→v2: patchV1 перезаписывает сеттеры фасада — legacy-громкости работают, дублей контекста нет.

---
*Статус: DRAFT, design-only, код не менялся. Коммит не выполнялся.*


---

## §7 КОНВЕРГЕНЦИЯ с Near Light (письма u/v, 002 adversarial Hub) · 25.08
Статус исходного «10/10» уточнён: мои проверки подтверждали СУЩЕСТВОВАНИЕ site'ов,
но пропустили два поведенческих дефекта, найденных 002 Виндe. Оба воспроизведены мной:

### E5 CONFIRMED ✅ → принят вариант (a) Hub
`main.tsx:237-238`: каскад __switchToV3 зовёт delegateSync('setInstrumentalVolume'/'setVocalsVolume',0)
ДО взведения флага → после revival обнулил бы V3-бусы.
ФИКС: в monkey-patch main.tsx ~131-151 ДО флаговой ветки безусловный блок:
`if (method==='setInstrumentalVolume'||method==='setVocalsVolume'){ warn('[delegateSync] master-volume blocked'); return }`
Авторизованные UI-master записи после E6 идут прямым ae.* (мимо канала) — не страдают. Закрывает R2, сохраняет «3× blocked».

### E8 CONFIRMED ✅
`StemChain.muteStem:74-77` и `setStemVolume:80-83` пишут raw `stem.volume` мимо _applyEffectiveGain (единственный writer HPS:631-638).
ФИКС: оба → rejecting stub c warn '[StemChain] disabled (E8b): use pipeline.setStemVolume', сигнатуры сохранить.
Доп.: в HPS.soloStem:552-556 задокументировать loop только chainA (до подключения _chainB.outputNode).

### BusFader18.test.ts — +2 кейса (дизайн Hub)
1. «master-zero через delegateSync при __v3Active=false НЕ достигает forwarder» (регрессия DEFECT-1/E5)
2. «_busVolumes не меняются заблокированным cascade»

### R1 → Ц3 (уточнение Hub принято)
Фикс оборачивает ВЕСЬ catch V3DataInterceptor.ts:166-178 (там ещё pipeline.stop() + crash-событие), не только запись флага.
