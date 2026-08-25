# FINAL-M3-GO-CHECKLIST · draft · 2026-08-25
**Автор:** 001 Со-Архитектор (Far Light) · read-only рекон, код не правлен, НЕ коммичено.
**Источники:** `docs/PLAN-v3.3-CANONICAL.md` §3 (стр.50–66, «18 строк») · `team-m/M3-GO-VERIFY-PLAN-2026-08-25.md` · `team-m/MIC-SESSION-METHODOLOGY-2026-08-25.md` · `team-m/REGISTRY.md` §5 (записи 129/133/140) · прямой рекон `src/` (все якоря сняты с диска 25.08).
**Frozen-зона:** только чтение (`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-поля — REGISTRY.md:28).

---

## §1. M3-GO ЧЕК-ЛИСТ

### Блок A. Расшифровка 18 строк канона (PLAN-v3.3-CANONICAL.md:51–66)

**A1. Бандл-сессия ✅**
Что: все пункты бандла закрыты и подтверждены, ни один не «повис в написано».
Где/как: сверка статусов против `REGISTRY.md:129` (Operator-поезд 7 паков) + `:140` (финальный поезд FALLBACK/TAKES-AUDIO/MARKER-SYNC/program-capture/mic-race); каждый ✅ имеет тег уровня (написано/подключено/уши) — PLAN §2:37. Артефакт = PARITY-LEDGER без пустых строк-обязательств.

**A2. Solo/mute-инвариант ✅ уши (C27)**
Что: solo глушит не-solo стемы, mute/solo переживает stop→restore, single-writer гейна.
Где: единственный writer эффективного гейна `HybridPipelineService._applyEffectiveGain` — `src/audio/engine-v3/pipeline/HybridPipelineService.ts:644` (вызовы :265/:527/:534/:542/:567); `StemChain.setStemVolume/muteStem` = rejecting stubs — `src/audio/engine-v3/pipeline/StemChain.ts:73–82`; solo = только маска — `StemChain.ts:84–96`. Тест-нетто: pin-semantics ×6 (`src/takes/pin-semantics.test.ts`) + BusFader18 (`src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts`). Уши: соло-превью в mic-сессии (см. B4).

**A3. Индикация обоих режимов ✅ уши (C28)**
Что: индикатор engine-mode отражает реальный resolved режим в v3 И в fallback.
Где: чтение `VITE_ENGINE` для display — `src/components/ControlDeck.tsx:362`; предикат published-flag — writer `main.tsx:155–158` (`__setV3Active`), ридеры через `window.__v3Active`. CDP V10 (M3-GO-VERIFY §2).

**A4. Mic-уши ✅ (PLAN §5:81–86)**
Что: полный остаток ушной сессии: solo-превью · vocal-fade · автопауза · RTL-голос · П-8 №2 под нагрузкой · TRIM-BASIS полным объектом · B-slice ×3 · F-2-дубль ×2.
Гейт: назначается ТОЛЬКО после B-slice + F-2-дубль (обе ✅ — REGISTRY:133/140). Процедура: `team-m/MIC-SESSION-METHODOLOGY-2026-08-25.md` §0–§8. ⚠️ См. R3: методология §7 ждёт фасад-аксессоры, которых нет в применённом дизайне — сверить ожидания до старта.

**A5. E1-канонизация ✅ (один writer предиката)**
Что: ровно один писатель `__v3Active`.
Где: `src/main.tsx:155–158` — единственная точка записи (через `window.__setV3Active`; вызывается из `V3DataInterceptor.ts:158/:180`). Канонизация verify-only подтверждена (REGISTRY:129: «E1 подтверждён: single writer main.tsx:148 = __setV3Active, 28 sites»; текущая строка после сдвигов — :155). Проверка: `grep -rn "__v3Active" src/ | grep "=" ` — присвоения только в main.tsx:135/:157 (+ сбросы через `__setV3Active(false)`).

**A6. E2 ✅ — эмиссия событий покрывает ОБА режима (v3-конфиг CDP)**
Что: playback-state-changed / loop-* / track-loaded эмитятся и в v3, и в fallback; dedup; fallback-string present.
Где v3: `loopcompleted` при wrap — `src/audio/engine-v3/integration/V3StatePublisher.ts:156–169` (CustomEvent detail {previousTime,newTime,loopStart,loopEnd} — parity с AudioEngineV2.ts:1509); plumbing шины — `src/foundation/event-bus/channels/sync.ts:11`, `types.ts:48`, `facade.ts:45`; track-loaded + markers — `V3DataInterceptor.ts:201–219`; добор B1 (track-stem-ready/track-fully-loaded/vocalmix-state-changed) — коммит `292b5a2` (V3DataInterceptor +7, MonitorRouter +2). CDP V3+V4 (M3-GO-VERIFY §2).

**A7. E3 ✅ — бут-смоук фасада + rehearsal**
Что: `[AETHER] ✅ HybridPipelineService Phase F — ACTIVE` на свежем буте, метры живые, rehearsal-сессия записана.
Где: лог — `main.tsx:219`; diagnostics API — `main.tsx:211–217` (`__belive.pipeline/micSource/monitorRouter/stemOrchestrator`); retry/re-entry boot-init — `main.tsx:161–177` (MAX=3, backoff 1000/2000/4000); фасад — `js/audio-facade-v3.js` (подключён `index.html:397`). CDP V1+V5.

**A8. Practice-gate ✅ (мок-дрифт закрыт)**
Что: vitest full run зелёный, исключений нет кроме известных 2 legacy missing-import.
Где: канон последнего замера — **tsc 306 / vitest 770 passed, verify:ci PARITY PASS** (REGISTRY:140; улучшение против базовых 313/769 PLAN §2:31 — легитимно, см. R1). Команда: `npm run typecheck` + `npx vitest run` + `npm run verify:ci` (= verify-events + verify-parity, `package.json:24`); ledger известных ошибок — `scripts/known-ts-errors.txt` (144 строки, критерий count ∧ set-diff=∅, M3-GO-VERIFY §0-D3).

**A9. Cut-list из E4-A**
Что: атомарный greppable список удаляемого ПОСЛЕ M3-GO, ноль wildcard.
Где: настоящий документ §2 (готов заранее); метод pre/post-hash — M3-GO-VERIFY шаг 9 (SHA256 frozen-зон до/после = identical на этапе M3; сами удаления — отдельные волны после GO, каждая со ⛔-отчётом).

**A10. M3-VERIFY dist-grep (шаг 0 = инвентарь dist-дерева)**
Что: positive-контроли ПЕРВЫМИ, потом negative.
Команды: `rg -l getStemMeterLevel dist/` ≥1 (провenance: `HybridPipelineService.ts:571` + контракт `src/audio/engine-v3/IV2PublicContract.ts` PUBLIC_METHODS :85–110); `rg -l "'loopcompleted'" dist/` ≥1 (эмиттер V3StatePublisher.ts:160); `rg -l audioglitch dist/` ≥1 (health — `src/audio/engine-v3/integration/useAudioContextHealth.ts`, transport-сторона `TransportV3.ts`); negative: esbuild-артефактов=0, mangle-props=0. Шаг 0: классификация dist/** {чанк / статик-M3 / known-retained-M5}; фоллбек-лестница sourcemap → модуль-граф → дельта размера (M3-GO-VERIFY табл.1:34).

**A11. FALLBACK-VERIFY — CDP V1–V10 + уши-строки**
Что: оркестратор играет, vocalHall по fallback-карте, метры=0 ожидаемы, предикаты консистентны.
Процедура: M3-GO-VERIFY §2 (V1 boot `!!window.__belive.pipeline` → V10 indicator/solo). Уши-строки в PARITY-LEDGER. Важно: это проверка V3-fallback (переживёт M3+M5), НЕ V2-recovery (термины — A18).

**A12. Ретир V2-recovery-веток MICRO-PACK'ом, поимённо**
Что: все ветки класса «V2-recovery» названы и помечены к смерти на M3; ноль wildcard; двойная сверка терминов.
Инвентарь recovery-точек (рекон 25.08): (1) `tryActivateV2` — `src/audio/featureFlag.ts` (вызов только из ветки non-v3 `App.tsx:95–99`); (2) restore-путь `__restoreV2Engine` — `main.tsx:186` + `js/audio-facade-v3.js:8–10`; (3) V2-birth счётчик — `App.tsx:100`; (4) autoplay-timer оркестратора — `track.orchestrator.ts:474–478` (frozen, читаем). Форма: поимённый список в ⛔-отчёте, `rg -i "v2recovery|v2_recovery"` = 0 misuse.

**A13. Флип VITE_ENGINE ×3 одним коммитом**
Сайты SET-значения: `.env:5` (уже `'v3'`), `.env.example:23` (сейчас `v2` — реконсилировать ДО флипа, D2), дефолт в точке выбора — `src/App.tsx:93` (`?? 'v2'`).
⚠️ Прецизионное уточнение (002-устойчиво): кроме App.tsx:93 есть ещё **12 сайтов-ридеров с фоллбеком `?? 'v2'` в 8 файлах**: `src/App.tsx`, `src/components/ControlDeck.tsx:362`, `src/components/MixerPanel.tsx:139,:309`, `src/takes/components/TakesPanel.tsx:499,:555`, `src/takes/components/TakesControlStrip.tsx:174,:571`, `src/takes/takes.recorder.ts:70`, `src/components/VolumeControls.tsx:91,:105`, `src/stores/recording.store.ts:48`. Решение по скоупу фиксируется ДО коммита: либо (а) строго 3 сайта set-значений, ридеры наследуют env (env всегда задан → фоллбек мёртвый), либо (б) расширить коммит до смены дефолта на 'v3' во всех 12 — но тогда это НЕ «×3», нужен отдельный ⛔-критерий. Пост-флип: CDP V1 зелёный (M3-GO-VERIFY G-D).

**A14. Dual-tag: pre-M3 = П-12 полный, pre-M5 = repo-rollback**
Что: worktree→build→boot→discard перед тегом pre-M3; dry-run rollback-поинтера для pre-M5. Boot-критерий = CDP V1+V5 в throwaway-worktree (доказательство: frozen компилируется немодифицированной, bundle-hash frozen-origin чанков равен). Push/деплой 🔒 — не трогаем (G-H).

**A15. П-8 зафиксирован (latency-профиль)**
Что: запись в LATENCY-REGISTRY с delta-строкой (правило F5: аудио-правка без delta-строки не принимается — PLAN §2:46).
Где замеров: non-frozen хуки — publisher tick 50ms (`V3StatePublisher.ts:151`), bus-wrappers, RTL §E методологии (3 ступени, impulse-harness `runImpulseTest()`, порог peak>0.5 ∧ |shift|≤5).

**A16. 0 новых tsc**
Критерий: total = текущему HEAD-замеру ∧ set-diff vs known-ts-errors.txt = ∅. Координатный сдвиг известной frozen-ошибки = silent frozen edit → СТОП (M3-GO-VERIFY табл.1:40). См. R1 про базовое число.

**A17. TSC-ledger запись**
Форма A4: «tsc N / vitest passed M, files X/Y, Z legacy load-error» (PLAN §2:32). Путь ledger запинен: записи ведутся в REGISTRY §5 (коммит-хвосты), снапшот координат known-ошибок прикладывается к ⛔-отчёту M3-GO (закрывает D5 M3-GO-VERIFY).

**A18. Канон терминов**
«V2-recovery» (умирает на M3): tryActivateV2, patchV1WithV2, __restoreV2Engine, V2-birth. «V3-fallback/varispeed» (переживает M3+M5): retry/re-entry boot (`main.tsx:161–177`), varispeed-fallback wiring (`main.tsx:222`), watchdog N/A by design (PLAN §6:99–100). Проверка: `rg -in fallback team-m/ docs/PLAN*` по шагам A9/A12 — 0 подмен терминов.

### Блок B. Матрица покрытия Босса (обязательные зоны)

| # | Зона | Чем закрывается | Якоря / тест |
|---|---|---|---|
| B1 | Канон tsc/vitest GREEN | A8/A16/A17 | `npm run typecheck`, `npx vitest run`, `verify:ci`; known-ts-errors.txt set-diff |
| B2 | Playback | A7 + CDP V1/V5 + пилот F-1 (play@0s, seek+Space — REGISTRY:133) | браузер: play@0, currentTime идёт |
| B3 | Solo/vocal-fade | A2 + mic-сессия П1/П2 (`useTakesPlayback.ts:49–62` applySoloMute→duckProgram; `ControlDeck.tsx:279,:291`; `VolumeControls.tsx:76,:82`) | уши ✅ + CDP 🟢 монотонность 0→1→0 |
| B4 | Автопауза | mic-сессия П3: `useTakesPlayback.ts:64–105` stopPreview({pauseEngine:true}) → `getTransport()?.pause()` (:99); вызов из потока записи :226 | CDP 🟢 + уши ✅ |
| B5 | Recording НЕ теряет аудио (program-capture) | цепочка: `MonitorRouter.captureStream` (`MonitorRouter.ts:36,:96,:128`) → фасад `getProgramCaptureStream` (`js/audio-facade-v3.js:75–80`, коммит b0b9b8e) → потребитель `recording.store.ts:42`; mic-race fix `82e1c76` (MicSourceV3 memoize acquire) | браузер-тест: тейк ≥30с (mic-сессия §5 П-8 №2), волна НЕ пустая, звук в take совпадает с программой |
| B6 | Markers-sync | pack ea13b6b: stale-marker clear + awaitStemReady resync — `src/foundation/event-bus/wrappers/markers-events.ts` (+33/−10); resync-поллинг — фасад `awaitStemReady` (`audio-facade-v3.js:48–68`); GUARD-паритет: `lyrics-events.ts:71,:75` ↔ FROZEN `bridges/lyrics.bridge.ts:121,:126` | браузер: перезагрузка трека → маркеры не отстают ≥500ms, не сброшены в 0 (маркер-детали в detail.track-loaded — `V3DataInterceptor.ts:204–213`) |
| B7 | Monitor-comp G14 не затирается | `MonitorRouter.setCompensateTarget` — `MonitorRouter.ts:254–261`: `_micDelay.delayTime.value = this._micCompensationMs/1000` в ОБЕИХ ветках (фикс b52e967) + F-2-дубль ×2 (методология §8: `_monitorGain` ramp, `_vmixMicGate` 1.0/0.0, `_micDelay.delayTime===0`) | CDP-метрики двух прогонов идентичны |
| B8 | Zombie-window нет (R1) | generation-guard: после loadStem-петли `V3DataInterceptor.ts:145–149`; stale-rollback guard в catch `:172–177` (pack 5fdda59); safety-net 5000ms `:164–171`; ghost-sound kill + crash-event `:178–188` | браузер: смена трека A→B ВНУТРИ 5с тайм-аута автоплея (целенаправленно!) → нет двойного звука, нет zombie, флаг не гасится новым треком. В пилоте явно НЕ воспроизводился (REGISTRY:133) — прогнать специально |
| B9 | CORS-внешний — НЕ миграция | catalog-feed = внешний worker allowlist (вердикт пилота, REGISTRY:133) | строка-фиксация в ⛔-отчёте M3-GO; в чек-лист миграции не входит |
| B10 | Mic-уши пройдены | Гейт A4: методология §0–§8 полным составом; предусловия B-slice+F-2 закрыты (REGISTRY:133 «F-2-дубль ПОДТВЕРЖДЁН», B-slice в HEAD `287cf5d`) | PARITY-LEDGER записи каждого ушного вердикта + LATENCY §H |

---

## §2. LEGACY-CUT ПЛАН (после M3-GO)

### 2.0. Ключевой факт графа зависимостей (гарантия #1)
Рекон runtime-импортов 25.08: **ни один файл движка V3 не импортирует frozen-V2 в рантайме.**
- `AudioEngineV2.ts` (2178 строк) — единственный runtime-importer: `patchV1.ts:6`.
- `patchV1.ts` (162) — единственный importer: `featureFlag.ts:6` (вызов `tryActivateV2` — только ветка non-v3 `App.tsx:95–99`).
- Все остальные упоминания «AudioEngineV2» в src/ — КОММЕНТАРИИ parity (TransportV3.ts:262/:279, V3StatePublisher.ts:157, V3DataInterceptor.ts:198/:204, stemTypes.ts:520, stem-reactive.bridge.ts:42, position-sync.ts:39, CharacterSoundManager.ts:2) — код не ломают.
- `V2Adapter` читает `window.audioEngine` (`V2Adapter.ts:26–28`), который в v3 = фасад (`index.html:397`, `audio-facade-v3.js:85`) — то есть после cut V2Adapter технически становится reader'ом ФАСАДА, не V2.

Следствие: удаление frozen-файлов не может задеть аудио-граф V3. Ломать могут только UI-пути действий — они перечислены ниже и режутся волнами с канон-гейтом.

### 2.1. Волна 1 — «No-Birth становится структурой» (activation-пути)
Удаляемое:
1. Ветка non-v3 в `App.tsx:93–101` (вызов `tryActivateV2` + `__v2BirthCount`).
2. `src/audio/featureFlag.ts` — целиком (единственный потребитель — App.tsx).
3. `src/audio/compat/patchV1.ts` — целиком (единственный importer — featureFlag).
4. `src/audio/core/AudioEngineV2.ts` — целиком (после п.3 — ноль импортеров).
Порядок строгий: 1→2→3→4, канон-гейт после каждого (tsc set-diff=∅, vitest green, boot-smoke CDP V1+V5).
Гарантия: leaves-first по доказанному графу (2.0); dist-inventory: чанк AudioEngineV2 исчезает из expected-класса.

### 2.2. Волна 2 — re-point вызывателей delegateSync (~20 файлов)
Инвентарь (grep 25.08, без тестов): `foundation/event-bus/wrappers/loop-events.ts`, `wrappers/rehearsal-trigger-writer.ts`, `foundation/reactions/stem-engine-sync.ts`, `sync/components/WaveformCanvas.tsx`, `audio/engine-v3/DuckGuardV3.ts`, `takes/takes.time.ts`, `components/TrackInfoBoard/StructureDiagram.tsx`, `TrackInfoBoard/ai-tools.ts`, `components/WagonTrain.tsx`, `components/TransportBar.tsx`, `components/MonitorMixPanel.tsx`, `hooks/useKeyboardShortcuts.ts` (:88–92 V2-fallback Space), `main.tsx` (сам: offset-чтение :257, каскад-нуление :263–271, `__switchToV3` :247–295).
Правило конверсии: каждый вызов → V3-native аналог (transport/pipeline/window.__belive) одним MICRO-PACK на группу файлов + parity-тест (паттерн BusFader18). Пока хоть один вызов жив — V2Interceptor-wrap (`main.tsx:134–152`) НЕ сносить.
Гарантия: обёртка `delegateSync` продолжает блокировать всё, что забыли; поведение «тише, чем надо» безопаснее обратного.

### 2.3. Волна 3 — демонтаж V2-защитной строительной площадки
Удаляемое (существует ТОЛЬКО потому, что существовал V2):
1. `__switchToV3` (`main.tsx:247–295`) — бессмыслен без V2 (читает V2-время, каскадно глушит V2).
2. V2Interceptor-wrap `main.tsx:134–152` (после Волны 2 вызовов нет).
3. `V2AudioCage.ts` + attachCage + `window.__v2Cage` (`main.tsx:124–126`; interceptor `:155`; cage-deactivate ветка FALLBACK).
4. `src/audio/engine-v3/integration/V2ResurrectionDetector.ts`.
5. Restore-ветку `handleV3BootFailure` → вместо `__restoreV2Engine` (`main.tsx:186`, фасад `:8–10`) — crash-modal/reload (терминал: V2-recovery умирает на M3 — A18). Это ЕДИНСТВЕННОЕ поведенческое изменение волны: деградация «тихий dead-zone» уже закрыта FALLBACK-pack'ом (b13de92), restore был страховкой.
6. H4.1 ae-guard `main.tsx:302–324` (сторожил от cage-watchdog; cage удалён).
Гарантия: после каждой позиции — boot-smoke + CDP V1–V5; регресс-нетто pin-semantics/BusFader18 не трогаем.

### 2.4. Волна 4 — оркестратор, мосты, мёртвые директории
1. `track.actions.ts:7` (static import orchestrateLoadTrack) — re-point 6 потребителей (`UploadPanel.tsx`, `catalog/components/CatalogLayout.tsx`, `catalog/store/catalog.store.ts`, `services/upload.service.ts`, `services/waveform-editor.stub.ts`, `App.tsx`) на V3-лоадер (before-track-change → `interceptor.loadTrack`, `main.tsx:327–402`).
2. Динамические импорты оркестратора: `MixerPanel.tsx:179`, `QuickActions.tsx:214` (`loadStemsOnDemand`) — удалить/заменить (V3 грузит стемы сам через interceptor).
3. `src/services/track.orchestrator.ts` — целиком (frozen; к этому моменту ноль импортеров).
4. `src/bridges/*`: аудио-мосты ретированы в пользу event-bus wrappers (комментарии `main.tsx:5/:7/:11`); внешний importer у мостов один — `live-guard` (`main.tsx:6`), и он НЕ про V2 (камера-permission для liveMode) → перенести в `src/services/` или оставить осознанно; остальные файлы bridges/ — delete.
5. `src/legacy/engine-v3/*` (CaptureBusV3/CrossfadeV3/LoopEngineV3/MicrophoneV3/RateParamV3/StemPlayerV3/VocalMixV3 + __tests__) — ноль внешних импортеров (grep 25.08), 2 теста с битым `./V2Adapter` import (те самые «2 legacy вне счёта» канона) → delete целиком; канон очищается до «vitest passed M, 0 excluded».
6. `js/audio-engine.js` (v1-stub) — в index.html НЕ подключён (`index.html:397–402` подключают только facade/lyrics-display/track-catalog/marker-manager/monitor-mix) → delete.
7. Аудит классического слоя (НЕ удалять вслепую): `js/monitor-mix.js`, `js/marker-manager.js`, `js/lyrics-display.js`, `js/track-catalog.js` живут на window-глобалах фасада; решается индивидуально (retained-M5 класс в инвентаре A10).

### 2.5. Волна 5 — финализация предиката и окружения
1. E1-предикат: `__v3Active/__setV3Active` (61 упоминание) — после Волны 3 пишется только константа true; либо механическая зачистка ридеров (takes.duck.ts:22/:45/:60 ветвление схлопывается в v3-ветку), либо осознанный retain как internal flag. Отдельный MICRO-PACK, последний.
2. Env: реконсилиация `.env.example:23` → `v3`; решение по 12 сайтам `?? 'v2'` (список в A13) — смена дефолта или выпиливание engineMode-ветвлений.
3. Фасад `js/audio-facade-v3.js`: удалить `__restoreV2Engine` save (:8–10); мёртвые stub-члены зачищаются по факту re-point Волны 2. Фасад ОСТАЁТСЯ (compat-шим для classic-скриптов) — переименование понятия: это не legacy, это пограничный слой.
4. Доки/термины: sweep упоминаний V2-recovery (A18), REGISTRY/PARITY-LEDGER финальные строки.

### 2.6. Governance-ограничители
- Frozen-файлы формально «только чтение» (REGISTRY:28) — УДАЛЕНИЕ после M3-GO санкционировано директивой Босса/Цели §0 PLAN («Legacy полностью удалён»), но каждая волна = ⛔-отчёт Ц3 + SHA256-инвентарь до/после (метод A9/A14). Никаких «полу-удалений» (комментарим нельзя — мёртвый код должен выйти из графа).
- Push 🔒 до явной команды; dual-tag pre-M5 (repo-rollback) ставится ДО Волны 1.
- Каждая волна заканчивается A4-строкой канона в TSC-ledger.

---

## §3. ДОРОЖНАЯ КАРТА: СЕЙЧАС → чистый v3-only

**Этап 0 (СЕЙЧАС, ~1 сессия): докатить применение + сверка базы.**
- Верифицировать применённое состояние HEAD против писем Мака (ae/af/ag): fallback/marker-sync уже в истории (`b13de92`, `ea13b6b`), mic-race `82e1c76`, M2/G3 `62bed86`, CharacterAI `6b01994` — ждут только GO-ретестов Босса.
- Замер канона на HEAD (tsc/vitest/verify:ci) → зафиксировать РАБОЧЕЕ базовое число для A16 (устраняет дрейф 313/769 vs 306/770 — R1).
- Реконсилиация D2 (.env vs .env.example) и скоупа флипа (A13) — ДО пилота финала.
- Док-чек: MIC-SESSION §7 vs фактический дизайн B-slice (R3).

**Этап 1: mic-уши-сессия (Босс крутит микрофон).**
Состав — A4/B3/B4/B5/B7/B8/B10; методика готова (MICRO-PACK'ов не требует, только браузер + PARITY-LEDGER записи). Параллельно: спецы 425+G4 Центра (блокер M3-GO отмечен REGISTRY:140 — архитектура Центра/006, вне зоны 007).

**Этап 2: M3-GO исполнение (18 строк = Блок A).**
Бандл → ears-подтверждения → evidence E1/E2/E3 → dist-grep (positive-first) → FALLBACK-VERIFY V1–V10 → V2-recovery-ретир поимённо → флип ×3 (один коммит) → dual-tag pre-M3 → П-8 → канон → ledger → термины. Выход: подписанный GO, тег pre-M3.

**Этап 3: срез Legacy — Волны 1→5 (§2), 5 канон-гейтов.**
Ориентир объёма: Волна 1 ≈ −2400 строк одним направлением (2178+162+~40); Волна 2 — самая трудоёмкая (~20 файлов, но механическая); Волны 3–5 — demolition. Каждый гейт = tsc set-diff=∅ + vitest green + boot-smoke CDP V1/V5 + ⛔-отчёт. После Волны 4 канон формулируется без «legacy excluded» сноски.

**Этап 4: чистый v3-only репо.**
- Финальный grep-аудит: `rg -i "AudioEngineV2|patchV1|track.orchestrator|V2Adapter"` по src/ → 0 (кроме docs/history);
- dist-inventory: класс known-retained-M5 закрыт или осознан;
- Тег `v3-only` + dual-tag pre-M5;
- ЗАМЕТАНИЕ: Gate 3B НЕ закрывается удалением V2 (PLAN §0:10–11) — кампания 425/G4 продолжается на чистом репо; push/деплой — отдельное решение Босса.

---

## §4. РИСКИ (что может пойти не так)

**R1. Дрейф канонного числа.** PLAN §2:31 фиксирует 313/769; последний факт REGISTRY:140 — **306/770** (Operator улучшил). Если гейт A16 мерить против устаревшей цифры — ложный FAIL (306<313 «подозрителен») или ложный PASS. Митигация: Этап 0 переприсваивает базовое число замером на HEAD; число меняется только вниз с TSC-ledger записью.

**R2. Флип «×3» против 12 ридеров.** В дереве 12 сайтов `?? 'v2'` в 8 файлах (A13). Слепой коммит «только 3 сайта» оставит мёртвые v2-дефолты; расширение скоупа ломает критерий «ровно 3 сайта». Митигация: решение скоупа задокументировать ДО коммита (вариант а или б), иначе 002 справедливо завернёт.

**R3. Методология mic-сессии опережает применённый дизайн.** MIC-SESSION §0-P3/§7 ждёт «фасад оживлён: audioContext/isPlaying/setVocalsVolume/setInstrumentalVolume живые» и identity-тест `window.audioEngine.audioContext === pipeline.ctx`. Факт HEAD: фасад этих аксессоров НЕ имеет (`audio-facade-v3.js:34–39` — stub-ы; B-SLICE-FINAL `287cf5d` сознательно выбрал блок-канал delegateSync `main.tsx:147–150` + StemChain-stubs вместо revival). Проверки П1/П2/П3 при этом полноценно идут через takes.duck/pipeline (`takes.duck.ts:14–79`). Митигация: правка ожиданий §7 методологии (или добавление аксессоров отдельным паком — НЕ рекомендую, лишняя поверхность) до старта сессии, иначе P3-предусловие «невыполнимо на бумаге».

**R4. Zombie-window R1 не воспроизводился в пилоте.** Регрессия может вылезти именно в mic-сессии (частые старты/стопы). Митигация: B8 включает целенаправленный тест «смена трека внутри 5с окна» — generation-guards стоят (`V3DataInterceptor.ts:146/:174`), но доказательства поведения пока static-only.

**R5. Program-capture без e2e-доказательства.** Пилот был playback-only (REGISTRY:133); chain смонтирован (B5), но «запись не теряет аудио» обязана получить ушной+waveform артефакт (тейк ≥30с, волна непустая) — иначе M3-GO подписывается с открытым хвостом.

**R6. Frozen-удаление без санкции = триггер СТОП.** Формально REGISTRY:28 запрещает писать в frozen; удаление — только пост-M3-GO директивой. Любая волна, начатая до подписанного GO, = нарушение протокола. SHA256-инвентарь до/после обязателен (защита от «тихой правки под видом удаления»).

**R7. Скрытые string/динамические ссылки.** Classic-слой держит кэш-рефы (`app.audioEngine`, `BLC.audioEngine` — заголовок featureFlag.ts; `window.liveMode`-патчи live-guard). После каждой волны — boot-smoke + dist-grep; js/*.js не бандлятся tsc и молчат до рантайма.

**R8. sshfs-хрупкость Мака.** Канон-прогоны выполнять на PC (прямой диск); Mac-верификации толерантны к drop (2 случая задокументированы, REGISTRY:104).

**R9. Смешивание треков E×G.** Legacy-cut не должен съедать ресурсы G-кампании (425/G4) — треки не смешиваются (PLAN §0:10); после Этапа 4 кампания идёт на v3-only базе, fingerprint'ы пересобираются (GTRACK-SPEC).

**R10. «Тихое» сохранение мёртвой ветки fallback-restore.** Если Волна 3 п.5 забыть, останется путь `__restoreV2Engine` на несуществующий движок — тихий no-op маскирующий crash. Проверка волны: `rg "__restoreV2Engine" src js` → 0.

---
*Draft для ревью 002/Центра. Не коммичено. Все file:line сняты с рабочего дерева 25.08 (HEAD-зона Operator-поезда + mac-паки ae/ag); при рассинхроне PC↔Mac приоритет PC (REGISTRY §0.4).*
