# STUDIO-IMMERSION-B01-mixer · ПОГРУЖЕНИЕ В СРЕДУ STUDIO

**Зона:** B01-mixer «Studio — отдельная СРЕДА для проработки» (микшер / стемы / шины) · **Агент:** agent-studio (волна-1, формула Никиты ① погружение → ② доклад → ③ СТОП: план от Никиты)
**Канон на момент погружения:** HEAD `50ed5a1` (реестр-коммит поверх `26e9256` PHONE-аудит; src/ после `16d608c` НЕ менялся) · tsc 184/TS6133 102 · vitest 812/68 (канон, свой прогон НЕ запускал — диспатч запрещает, 007 гонял 06.09)
**Метод:** чтение хэндоффа `.opencode/agent/agent-studio.md` + PULSE-ZONES.yaml + DECISIONS (A-15, N-12) + хвост SHARED-REGISTRY + package.json + ядро зоны (7 файлов целиком) + смежные (stem-engine-sync, ControlDeck, modules.ts, InstrumentStrip, VolumeControls, BpmControl, тесты зоны) + гейты ПУЛЬСа (reach/junction/tsc) + grep-верификация фактов скаутов. src/ — только чтение.

---

## 0. СВОДКА ОДНОЙ СТРОКОЙ

**Studio жива:** MixerPanel — живой DOCK-модуль `'mixer'='Studio'` (modules.ts:72-81, order 25) → стем-стор `src/stem/` (Zustand, чистое состояние, 0 side-effects) → реактивный мост `stem-engine-sync.ts` (subscribe → diffAndApply) → `HybridPipelineService` (единственный writer гейна `_applyEffectiveGain`). Шины BusFader18 работают по формуле `effective = clamp(raw) × clamp(busFactor)`, ×0 при mute/вне-solo/краше/деде. **Два системных факта, которые надо держать в голове:** ① pipeline фактически single-path (Bus B varispeed отключён, помечен «будет удалён в 067-D full cleanup» — контракт двухшиности жив только в IPipelineController/StemChain); ② V-Mix-контрола в MixerPanel НЕТ — живёт в ControlDeck (кнопка VMix) и в MonitorRouter (B04-зона), в панели Studio только подгружаются тапы.

---

## 1. КАРТА ФАЙЛОВ ЗОНЫ (ядро 14 файлов · ~3.5K LOC · + смежные 4 файла)

### 1.1 Живое ядро (рендерится/исполняется в рантайме)

| Файл | LOC | Роль | Живость |
|---|---|---|---|
| `src/components/MixerPanel.tsx` | 362 | DOCK-модуль 'Studio': ChannelStrip (label+VU+fader+M/S), тулбар (Stems/Visual/Mic) | ✅ живой, modules.ts:72-81 → ControlDeck:55-56,568-576 |
| `src/components/MixerPanel.module.css` | 311 | стили микшера (channelStrip/fader/msButton/VU-meter-контейнеры) | ✅ живой |
| `src/stem/stem.store.ts` | 339 | Zustand-стор стемов + busVolumes (№18-BUS H3.1) + snapshot/order/automation | ✅ живой, подписан stem-engine-sync:66 |
| `src/stem/stemTypes.ts` | 521 | типы/константы: StemRole, ROLE_ROUTING, BUILTIN_STEMS 8 слотов, STEM_CAPACITY_BY_TIER, A2.25 | ✅ живой (импортируется MixerPanel:15, pipeline:19) |
| `src/stem/index.ts` | 40 | публичный re-export (Types+Constants+Store) | ✅ в reach-hold-листе (см. §4) |
| `src/audio/engine-v3/pipeline/HybridPipelineService.ts` | 745 | ядро pipeline: шины, формулы BusFader18, stretch-слоты, crash/dead, V-Mix тапы | ✅ живой (main.tsx:155-171 bootAether) |
| `src/audio/engine-v3/pipeline/IPipelineController.ts` | 73 | интерфейс между TransportV3 и pipeline (BusType 'A'\|'B') | ✅ живой контракт |
| `src/audio/engine-v3/pipeline/StemChain.ts` | 152 | группировка стемов по шине: mergeGain→muteGain→(DelayNode если B)→outputNode | ✅ живой (Bus A реально; Bus B — контракт-оболочка) |
| `src/audio/engine-v3/pipeline/StretchInstance.ts` | 221 | WASM-инстанс Signalsmith Stretch (на один стем) | ✅ живой |
| `src/audio/engine-v3/pipeline/StretchInstancePool.ts` | 279 | пул stretch-инстансов (MAX_STRETCH_INSTANCES) | ✅ живой |
| `src/audio/engine-v3/pipeline/HybridLoopStrategy.ts` | 39 | loop-стратегия | ✅ живой |
| `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts` | 522 | тест-сьют шин (5 describe / 14 it) | ✅ класс H-1, исключён из reach |
| `src/audio/engine-v3/pipeline/__tests__/VocalTap.test.ts` | 160 | тесты vocalReferenceTap (3 it) | ✅ класс H-1 |
| `src/stem/__tests__/stem.store.test.ts` | 88 | тесты стора (11 it) | ✅ класс H-1 |

**ВАЖНАЯ КОРРЕКЦИЯ ПУТЕЙ (скаут-факт подтверждён):** в PULSE-ZONES.yaml и в контексте диспатча пути `src/stores/stem*` / `src/components/MixerPanel*` — физически `src/stores/stem*` НЕ существует. Стем-стор живёт в **`src/stem/`** (stem.store.ts:14, MixerPanel.tsx:14), импортируется как `../stem/stem.store`. pipeline — `src/audio/engine-v3/pipeline/**` (подтверждено).

### 1.2 Смежные файлы (живость-карта, зона не владеет)

| Файл | LOC | Роль | Живость |
|---|---|---|---|
| `src/components/ControlDeck.tsx` | 581 | ДОК хаб: фейдеры Inst/Voc (№18-BUS H3.4), B±5/P/M, VMix, Mic, рендер tab-модулей | ✅ живой (B01-HUB зона) |
| `src/deck/modules.ts` | 114 | DOCK-реестр: 7 живых + 3 закомментированных | ✅ живой |
| `src/deck/registry.ts` | 50 | registerModule/getLazyComponent/getModulesForMode | ✅ живой |
| `src/foundation/reactions/stem-engine-sync.ts` | 250 | Engine Arbiter: subscribe→diffAndApply→pipeline | ✅ живой (main.tsx:33,61) |
| `src/components/InstrumentStrip.tsx` | 64 | Visual-режим (TC-VIS-09), рендерится MixerPanel:331 | ✅ живой (только в Visual+stemsEnabled) |
| `src/components/VolumeControls.tsx` | 181 | старый 'mix'-модуль | ⚪ НЕ монтируется (modules.ts:4-13 закомментирован) |
| `src/components/BpmControl.tsx` | 43 | ±5%-степпер | ⚪ НЕ монтируется (импортируется только VolumeControls:6,177) |

---

## 2. МОНТАЖ / МАРШРУТИЗАЦИЯ СОСТОЯНИЯ

### 2.1 Как MixerPanel попадает на экран
`deck/modules.ts:72-81` (id:'mixer', label:'Studio', order 25, modes rehearsal/karaoke/concert, lazy-import) → `ControlDeck.tsx:55-56` (`getLazyComponent(activeTabId)`) → рендер при `expanded` (`ControlDeck.tsx:568-576`, `{expanded && <div class=panel data-active-tab>…`}). Верхний уровень: `App.tsx:237-243` — ControlDeck рендерится условно (`syncOpen ? SyncEditorPanel : showActive ? ShowEditor : ControlDeck`). MixerPanel — вкладка DOCK, сосед TransportBar (ControlDeck:578).

### 2.2 Путь звука/состояния (однонаправленный, без прямых V2-вызовов)
```
MixerPanel fader/M/S
  → useStemStore.* (setStemVolume/setStemMute/setStemSolo/setStemsEnabled/setBusVolume)
  → useStemStore.subscribe (stem-engine-sync.ts:66-77, инициализирован main.tsx:33,61)
  → diffAndApply (:121-199) / coldSync/applyAll (:107-119, :211-233)
  → pipeline.setStemVolume (:136) · setBusVolume (:149) · muteStem (:160) · soloStem (:172) · setStemMuted MUSIC_STEMS (:192-195, H3.3)
  → HybridPipelineService → _applyEffectiveGain (:648-655) → stretchGain.gain (AudioParam)
  → AnalyserNode-тап пост-фейдера (:242-245) → window.__belive.pipeline.getStemMeterLevel → MixerPanel rAF-поллинг (:228-267)
```
MixerPanel явно фиксирует: «Прямой V2 вызов удалён — Engine Arbiter (stem-engine-sync) сам маршрутизирует» (MixerPanel.tsx:42,48,54).

### 2.3 window.__belive (монтируется main.tsx:170-176)
`pipeline, micSource, monitorRouter, stemOrchestrator, transport, deviceManager`. Зона читает через `(window as any).__belive`. Мост B01↔B04 (Split): main.tsx:156-161 — `pipeline.outputNode → router.programInput`; `setVocalHallTarget` (ARC-2e vocalReferenceTap), `setVMixCenterTarget/setVMixVocalTarget` (TASK-015).

### 2.4 События
Файлы зоны НЕ импортируют event-bus (0 publish/subscribe в зоне). События по теме (вне зоны, из wrappers): track-loaded/track-fully-loaded/track-stem-ready (V3DataInterceptor), vocalmix-state-changed/microphone-state-changed (MonitorRouter.ts:204 dispatches CustomEvent document-level), monitor-state-changed/route, playback-rate-changed. **Событий с 'bus' в имени НЕТ** — шины живут на уровне store/pipeline (store.busVolumes + pipeline._busVolumes), не на event-bus.

---

## 3. СТЕМ-СТОР (`src/stem/stem.store.ts`) — детали

- **Стейт:** loadedStems · stemVolumes/stemMutes/stemSolos/stemPans (Record<string,…> keyed by stemId, не хардкод) · **busVolumes (:40-41, №18-BUS H3.1)** — user-pref, **НЕ сбрасывается initStems/clearStems** (тест :282-287 «фейдер 37% переживает reset») · stemsEnabled (W10-001, instrumental default) · stemsLoading (TC-8.6A) · stemsMode (TC-10.6 tumbler) · _stemsBootRestored + публичный stemsBootRestored (TC-10.12 миграция с `_`) · stemDisplayOrder/stemAutomation (IDB TrackRecord-персист) · _lastSnapshot.
- **Экшены:** initStems :151 (preserve stemsEnabled/stemsMode/boot-flag), addStem :183, clearStems :196, setStemsEnabled :211, setStemsLoading :216, setStemsMode :219, setStemVolume :223 (**NaN-гард H2.5 первой строкой**), setStemMute/toggle :232/:238, setStemSolo/toggle :246/:252, setStemPan :260 (clamp −1..1), setBusVolume :268 (**NaN-гард + clamp 0..1**), setStemDisplayOrder :277, setStemAutomation :283, captureSnapshot/restoreSnapshot :289/:302 (W7 timestamp зарезервирован), getOrderedStemIds :313 (кастомный order или sortStemsForDisplay).
- **Deprecated-геттеры (:328-338):** `instrumentalVolume/vocalsVolume/hasVocals` помечены @deprecated («Use stemVolumes['instrumental'] instead»). **Мой grep: потребителей геттеров useStemStore НЕ НАЙДЕНО ни одного** — все hasVocals-потребители читают `useAudioStore(s => s.hasVocals)` (audio.store, не stem.store); mode-switch.service/mode-events работают с payload-полями событий, не со стором. Т.е. эти геттеры сейчас = музей/мёртвый балласт (держатся «для backward compat» по комменту :11). 301-стиль: кандидаты в накопительный батч — но формулирую как факт/вопрос, не как предложение.

---

## 4. PIPELINE И ШИНЫ BUSFADER18 — детали

### 4.1 Топология (single-path!)
- Контракт (IPipelineController): `BusType = 'A' | 'B'`. StemChain комментарий: Bus A (4× stretch) Vocals/Guitar/Bass/Keys·Drums; Bus B (3× varispeed) Drums/Other/Instrumental.
- **ФАКТ :105-114:** «067-D: single path — только Bus A (stretch) всегда активен»: `_busAGain.gain=1.0`, `_busBGain.gain=0.0`, `_chainB.outputNode НЕ подключается` (:114), `_chainB «будет удалён в 067-D full cleanup»` (:109). play (:293-296) — всегда stretch, switchBackend отключён (:442-444), assignStem отключён (:609-612, «053: терял буфер стема»). reset/dispose не пересоздают chainB (:689, :732).
- **реальная цепь (Bus A):** stems → chainA.mergeGain → chainA.muteGain → outputNode → _busAGain → _outputGain. (StemChain Mute-структура: `mergeGain → muteGain → [DelayNode если B] → outputGain`, delay 22.67ms = STFT 20ms + quantum 2.9ms, BUS_B_DELAY_SEC StemChain:16.)

### 4.2 Формула BusFader18 (`HybridPipelineService`)
```
_effectiveGainOf(stemId) (:628-637):
  crashed || dead → 0                       (H1.2/H1.5, двусторонний crash)
  muted || !chainA.isStemAudible → 0        (mute + solo-маска _soloed)
  иначе: clamp(raw) × clamp(busFactor)      (raw = _stemRawVolumes[stemId] ?? 1,
                                             busFactor = _busVolumes[bus] ?? 1; instrumental/effect → null → фактор 1.0)
busOf (:639-646):
  instrumental → null      (вне шин — master clock invariant A2.25, фактор 1.0)
  unknown → 'music-bus'    (паритет V2 :1152)
  vocal/backing → 'vocal-bus' · music → 'music-bus' · effect/fx → null (фактор 1.0)
```
- **ЕДИНСТВЕННЫЙ writer гейна:** `_applyEffectiveGain (:648-655)` — пишет `stretchGain.gain` рампой (_rampGain :619-626) и `stem.volume = target`. Тест single-writer static-grep (?raw-импорт): ровно 3 записи `stretchGain.gain.value` (loadStem init 1.0 + play/seek под crash-гвардом) и 1 write `stem.volume` (= target, :322).
- **setBusVolume :542-549:** clamp 0..1, NaN-гард, **re-apply всех стемов этой шины через busOf**. getBusVolume :550 (`?? 1`). fadeBusVolume :552-561 (TakesControlStrip pre-roll: bookkeeping сразу, гейн рампой).
- **Стор-зеркало:** stem.store.ts:268-273 setBusVolume → stem-engine-sync:149 → pipeline.setBusVolume. UI-проводка красного фейдера: ControlDeck.tsx:199/:220 — `setBusVolume('music-bus')`; H3.4 dual-mode: V3+music-stems → music-bus; иначе instrumental-зеркало (+ae.setInstrumentalVolume только вне __v3Active).
- **Crash/dead:** `_crashedStems` (:70, handler на instance.outputNode 'stretch-crash' :251-264: гейн→0 + метка) · `_deadStems` (:72, load-fail :273/:277). H1.5: успешный reload снимает метки и re-apply (:267-270). Resurrection-гвард в play/seek (:321-323, :401-402) — crashed не получает гейн обратно.
- **V-Mix тапы (:82-85):** `_vmixCenterTarget` (post-fader non-vocal стемы, центр) / `_vmixVocalTarget` (post-fader vocals, L). Сеттеры :191-198, подключение в loadStem (:235-239) и пере-подключение после play-reconnect (:305-309). **Управления V-Mix в MixerPanel НЕТ** — кнопка в ControlDeck:350-383 (router.setVMix → MonitorRouter:189-205, стерео-разводка music→центр оба канала / vocal→L / mic→R; диспатчит document-level vocalmix-state-changed → audio-events → audio.store).
- **VocalHall (ARC-2e):** `_vocalHallSend` — pre-fader тап (ДО stretchGain) только vocals (:75-79, :223-231), vocalReferenceTap (:141) — фейдер-независимый референс для питча (B06-стык). На непатченном коде присвоение только при живом router было бы красным — VocalTap К-5 покрывает.
- **Metering:** AnalyserNode-тап ПОСЛЕ gain (:242-245) → `getStemMeterLevel` RMS (:576-587), `getStemAnalyser` (:605-607). MixerPanel rAF-поллинг с тир-гейтом meterFps (STEM_CAPACITY_BY_TIER: lite 10 / balanced 20 / max 30 / ultra 60, meterStyle).

### 4.3 Тесты зоны (28 it — зелёные по канону)
- **BusFader18.test.ts (14 it):** clamp/NaN-таблица (8 вход) · порядок setBusVolume→loadStem · формула-матрица effective=clamp(raw)×busFactor + изоляция шин + instrumental вне шин + unknown→music-bus + ×solo-маска + mute-ветка · crash двусторонний (handler→0, play/seek не воскрешают, reload resurrect) · dead-stem H1.5 · регресс №18 «фейдер 37% переживает reset/initStems/clearStems» · single-writer static-grep · store NaN guards · H4.1 ae.* mini-gard (музей-контракт) · H3.4 dual-mode Inst-фейдер (3 it).
- **VocalTap.test.ts (3 it):** К-1 присвоение тапа без дубля ребра · К-2 reset рвёт зомби-ребро · К-5 router-null контракт У-1.
- **stem.store.test.ts (11 it):** начальное состояние / enabled / mode / volume / mute / solo / pan / snapshot-restore / addStem / loading / getOrderedStemIds.

---

## 5. ЖИВОСТЬ-КАРТА ([renamed]-кейс 301)

- **VolumeControls (модуль 'mix')** — запись закомментирована целиком: modules.ts:4-13 «v2.0: Mix controls moved to always-on dock bar (TC-DOCK-05/06/08/10)». **BpmControl** собственной записи НЕ имеет вовсе, единственный импортёр — VolumeControls:6,177 → **не работает в рантайме**. Замещён живым модулем 'mixer'='Studio' (modules.ts:72-81) → MixerPanel.
- **modules.ts итог:** 7 живых (show 29 / styles 38 / takes=Quest 28 / **mixer=Studio 25** / monitor=Split 35 / pitch=Notes 40 / billy 45) + 3 закомментированных (mix/tools/ai).
- **window.audioEngine в зоне:** VolumeControls 5 чтений (:76,82,88,102,169) · BpmControl 1 (:6) · InstrumentStrip 3 (:23,31,39) · **в pipeline/ — 0** (rg подтвердил). Замечание: InstrumentStrip (Visual-режим) при __v3Active пишет и стор, и ae.*, но ae-вызовы игнорируются обёрткой H4.1 (см. тест) — фактически в V3-режиме работает только стор-канал.
- **__v3Active в зоне:** MixerPanel:150 · ControlDeck:64/196/217 · **в pipeline — 0** (только тесты BusFader18).

---

## 6. ЦИФРЫ ПУЛЬСа ЗОНЫ (мой замер, 13:4x)

| Гейт | Результат | Комментарий |
|---|---|---|
| `node scripts/verify-reach.mjs` | **0 violations · hold 51 (18 H-2 · 6 H-3 · 4 H-4 · 3 H-5 · 12 H-6 · 8 H-1c) · excluded (H-1) 70 · stale 0 → PASS** | Зонные файлы в hold: VolumeControls.tsx, BpmControl.tsx, stem/index.ts (все — известные hold-классы: закомментированные/тупики). MixerPanel/stem.store/pipeline/** — НЕ в hold = живы |
| `npm run typecheck` | **184 errors · 102 TS6133 = Δ0** | совпадает с каноном 16d608c (замер 007 06.09) — новых ошибок сверх канона НЕТ |
| `node scripts/verify-junction.mjs` | pairs=7 **violations=3** (wrangler-env-d1, vite-url-ai-worker, vite-url-worker-src) · warns=2 · unverified=1 | СТЫК РАЗОРВАН — известный хвост CF-батча Д-3 (секреты/окружение), НЕ зоны B01-mixer |
| vitest | НЕ запускал | Канон 812/68 (007, 06.09) Δ0; диспатч запрещает тратить 20 минут |

---

## 7. ВОПРОСЫ НИКИТЕ (что уточнить перед планом развития Studio)

1. **Single-path Bus B — целевое состояние или хвост?** Pipeline фактически однопутевой (Bus B отключён :109,114,689; switchBackend/assignStem мёртвые стабы; контракт двухшиности живёт только в IPipelineController/StemChain + тесты VocalTap ссылаются на «Bus B не подключён»). План Studio с этого начинается: точечный full-cleanup (снести B-обвязку + stubs) ИЛИ возврат двухшиности (varispeed/fallback)? Это меняет объём работ в разы.
2. **V-Mix: оставляем в ControlDeck/Split (B04) или переносим/дублируем контроль в MixerPanel?** Сейчас в панели Studio V-Mix отсутствует как контрол, тапы подключаются автоматически (pipeline:235-239/:305-309). Если Studio = «микшер-этаж», ожидаемо ли там место для V-Mix-кнопки/индикации (например, VMix-индикатор рядом с метрами)?
3. **Deprecated-геттеры stem.store (instrumentalVolume/vocalsVolume/hasVocals :328-338):** потребителей НЕ НАЙДЕНО (grep по src/, только audio.store.hasVocals живой — это другой стор). Сносить накопительным батчем (301-стиль) или оставить как музей-контракт backward compat?
4. **bus-события в event-bus:** шины живут на уровне store/pipeline (busVolumes), событий с 'bus' в event-bus нет. Нужны ли события (bus-faded, stems-mode-switched) горизонтальным потребителям (SyncEditorPanel, takes, exercises) — или прямой subscribe-канал stem-engine-sync — канон навсегда?
5. **Судьба Visual-режима (InstrumentStrip, TC-VIS-09):** рендерится MixerPanel:330-331 при stemsEnabled; V3-mode AudioEngine-вызовы в нём бесполезны (гасятся H4.1-гардом); REACTIVITY_PROFILES/STEM_SENSITIVITY (stemTypes:73-131) — профили пульсации «для Visual Mixer» просто лежат. Развивать визуальный режим в плане Studio или зафиксировать DAW-режим как единственный до стабилизации?

---

## 8. ЧЕСТНОЕ «НЕ ЗНАЮ» / НЕ ПРОВЕРЕНО

- **План развития Studio** — знает Никита; формулой мне запрещено выдумывать (жду после доклада).
- **«067-D full cleanup»** — откуда номер/когда планировался (комменты в коде :105-114/689 не дают даты); не проверял docs/PLAN на этот ID.
- **Глубина планов песочницы 007_2** по визуальному фронту (может пересекаться с Visual-режимом InstrumentStrip) — не моя зона.
- **Потребители audiostore.hasVocals вне зоны** — вижу 5 файлов (ControlDeck, MonitorMixPanel, TrackInfo, VolumeControls, exercises) — но это B04/B01-HUB-стыки, детально НЕ проверял.
- **Остальные файлы pipeline (StretchInstance/StretchInstancePool/HybridLoopStrategy)** — читал фактурно из pipeline (видел вызовы ensureSlot/chunkedLoad/scheduleRateAll/scheduleLoopAll), но детального глубокого чтения не делал (не нужно для шага-погружения).
- vitest-прогон зоны — НЕ ПРОВЕРЕНО живьём (канон 812/68 Δ0 по 007).

---

— agent-studio · волна-1 · погружение сдано, src/ не тронут (только чтение) · **СТОП: жду план развития Studio от Никиты**