# OLD-MECHANICS-MAP · K4/K5 брифинга «Реформа Репетиции» · Q6 (механика старого) + Q3 (судьба старого)

**Собрал:** agent-rehearsal [B01-HUB] · **Дата:** 2026-09-07, ночь · **HEAD:** d58f7e0 · **Входы:** explore-скаут (полная фактура с якорями) + 002-стресс 14 ударов (ses_f82767744, все приняты) · **009-условия:** 1-6 выполнены, второй проход назначен.
**Канон-входы:** UI-CHANGE-SPEC §§7-13 · REF-2 v2 Δ№5/№6 (при конфликте побеждает v2) · А1-доктрина (CHANNEL-b01-hub 20:11: док = функция ЭКРАНА) · уже-решённое: VMix/🎤 → AudioActionsPopover ⋯ (Z1 песочницы байт-в-байт).
**Формат ячейки:** пустая ячейка = «дыра/нет гейта» помечена явно. Frozen-зона: упоминания — точки интеграции, правки не предлагаются.

---

## §1 · КАРТА МЕХАНИКИ (объект → механика → события → гейты)

### 1. ControlDeck.tsx (581) + module.css — нижний ДОК [Q3: ЗАМЕНИТЬ С ОГОВОРКАМИ — см. §2]
- **Рендер:** нижний фиксированный док z-999995; 7 модулей-табов (src/deck/modules.ts: mixer/takes/show/monitor/styles/pitch/billy) + always-on полоса (Inst/Voc фейдеры, BpmButtons, VMix, Mic, Sync/DNA/Expand, CoverArt).
- **События:** таб-клики (:150) · фейдеры клик/драг (:180-236 Inst, :263-328 Voc) · BPM (:334) · VMix (:351-384) · Mic (:387-439) · Sync (:514) · DNA (:530) · Expand (:552).
- **Гейты:** interruptPracticeSession на табах/BPM/Sync/DNA/Expand (:150,334,514,530,552) · VMix v3-гвард no-op (:362-369) · Mic — полный lifecycle micSource/__micMonitorNode/setMicMonitor (:387-425), контракты surface-событий E17/E18/E19 · двойной гейт фейдеров: disabled={isPracticeActive} (:332) + interrupt-обёртка (:334).
- **Сторы:** deck.store (персист `bl-deck`, partialize activeTabId+expanded, deck.store.ts:29-34) · stem.store · audio.store · monitor.store · practice-session.store · exercise.store · recording.store · trackInfo.store · sync.store · mode.store · track.store.
- **CSS-вар:** публикует **--bl-deck-height** (:82,98; ResizeObserver; интенциональный не-клинап при unmount :86-91 «НЕ удаляем, BillyDock зависит»).
- **Особое:** rec-ветка без модуля (:137,147,152 — t.id==='rec', 🔴 Show-зоны: чистить/регистрировать) · закомментированные mix/tools/ai (modules.ts:4-25,49-59; mix держит мёртвые VolumeControls+BpmControl).
- **Внешние setTab:** BillyDock.tsx:157,161 · featureRegistry.ts:33 (restore персиста),:70 (setTab('mixer')),:78 (clearTab) · monitor.store.ts:262 (setTab('monitor')). Stale-tab guard :103-108.

### 2. TransportBar.tsx (134) — прогресс-трек [Q3: ПЕРЕНЕСТИ (вид) + ПОЧИНИТЬ (таймер)]
- **Рендер:** seek-полоса + филл + playhead + тайм-код fmt(currentTime)/fmt(duration) (:120-131). **⚠️ Удар-002:1: LOOP/PREV/PLAY/PAUSE/NEXT/PITCH в нём НЕТ** (SPEC §6 описывает ЦЕЛЬ; PLAY живёт в клавиатуре useKeyboardShortcuts.ts:67-87). Карта фиксирует реальность.
- **События:** прогресс-клик → seek (:32-59): interruptPracticeSession (:35) → transport.seek (V3) / V2-fallback eventBus 'seek-position-changed' (:48-54, frozen-интеграция).
- **Гейты:** скрытие при duration===0 (:61).
- **Сторы:** audio.store (isPlaying/currentTime/duration).
- **Сирота:** импортируется ТОЛЬКО ControlDeck.tsx:8 → похорона дока без переезда TransportBar = висящий импорт.

### 3. BpmButtons.tsx — капсула темпа [Q3: ЗАМЕНИТЬ на BPM-степпер с УМНОЖЕНИЕМ ШКАЛ]
- **Механика (⚠️ удар-002:2, три шкалы):** STEP=0.05 — **±5% playbackRate** (не BPM!), MIN 0.25/MAX 4.0 (:23-25); B=−5%, P=%-дисплей, M=+5%.
- **События:** onChange → ae.setPlaybackRate + audio.store.setState({playbackRate}) (ControlDeck:335-339).
- **REF-2/conflict:** Z5-степпер = число BPM (105/+/-); v1 ZONE 5-② = «±5%, −20…+20%»; SPEC §4 = «±5 BPM». **Три шкалы ждут вердикта Круга-2** (сводная таблица — §2.1 ниже).
- **Сирота:** импорт только ControlDeck.tsx:21 (BpmControl.tsx — мёртв, модуль mix закомментирован).

### 4. VolumeControls.tsx + BpmControl.tsx — МЁРТВЫЙ КОД [Q3: ПОХОРОНИТЬ в deadcode-батче]
- Модуль `mix` закомментирован (modules.ts:4-13), живых импортёров нет. PHYS-цель реформы = always-on фейдеры ControlDeck:172-328, НЕ этот файл.

### 5. ModeButtons.tsx + mode-switch.service — пилюли режимов [Q3: ЗАМЕНИТЬ на dropdown «Rehearsal ▾» (Z3), МЕХАНИКУ СОХРАНИТЬ]
- **Механика:** 4 пилюли → switchMode (mode-switch.service): стем-политики, mode-changed event, save/restore громкостей localStorage `bl-rehearsal-volumes` (:51-59). **⚠️ удар-002:9: БЕЗ interruptPracticeSession** — единственный транспортно-статусный экшен без гейта (осознанное исключение или баг — вердикт Круга-2).
- **REF-2 Δ№1:** один dropdown «Rehearsal ▾», остальные режимы внутрь списка; активный = подпись кнопки; MODE_COLORS-цвет актива сохраняем (моё решение 23:2x, подтверждено песочницей).

### 6. Header.tsx + CurrentTrackBadge + QuickActions — шапка [Q3: МОДИФИКАЦИЯ (Z3)]
- **Механика:** лого+слоган (мой пост REF-2 Z1) · chip трека (CoverArt 40 + артист) · ModeButtons по центру · QuickActions справа: меню профиля (:435-450 круг 🎤), **Catalog-кнопка в меню QuickActions:414 (openCatalog :323-325) — НЕ в хедере!** (⚠️ удар-002:12: REF-2 Δ№2 «кнопка исчезает из хедера» хоронит призрак — кнопки в хедере давно нет; реформа = фильтр инлайн в поиске, кнопка меню остаётся переходно).
- **CSS-вар:** публикует --react-header-height (:25).
- **Гейты:** auto-catalog новичкам (App.tsx:166-174).

### 7. WagonTrain.tsx (260) — полоса секций [Q3: МОДИФИКАЦИЯ (Z3-стили)]
- **Механика:** чипы блоков, data-block-type/data-active/data-in-loop, авто-скролл (:80-88), клик → interruptPracticeSession (:96,122) + setActiveBlock при takes-пине, loop-тогглы ∞/+/− (:197-254, :205,227 interrupt).
- **Сторы:** blocks/markers/lyrics/loop/takes/deck.

### 8. RehearsalLyrics.tsx (1098) — центральная лирика [Q3: МОДИФИКАЦИЯ (Z2-стили)]
- **Механика:** слот-матрица grid (:822-941, USE_SLOT_GRID=true :174) / flex-путь (:942-996), loop-границы с drag (:896-940), ПС-overlay travel (:1000-1037), честное время getTransport().currentTime (:495-498, кэш __belive.currentTime дрейфует).
- **Гейты:** FOUC-гейт !lyricsReady (:765) + structurePending (:768).
- **CSS-вар:** читает --bl-deck-height (module.css:6).
- **Z2-дельты:** активная fw700 + сине-белый glow, соседи slate (−1 #94a3b8/.6, +1 #94a3b8/1, +2 #64748b/.8), кегль clamp(28px,2.5vw,44px), строка −1 добавляется.

### 9. KaraokeLyricsBoard.tsx (121) — караоке-режим [Q3: МОДИФИКАЦИЯ (Z2) + ЖЁСТКИЙ bottom ПОЧИНИТЬ]
- **Механика:** активная+N строк, WordHighlightLine, кнопка 2↔4, data-state active|upcoming (:94).
- **⚠️ удар-002 (скout): bottom ЖЁСТКО 80px (module.css:10) — НЕ читает --bl-deck-height** (в отличие от RehearsalLyrics) — при смене высоты дока поедет. Z2 обязан unify.
- **Сторы:** lyrics/ui/mode/textStyle.

### 10. BillyDock + CoachPanel [Q3: Билли = ЗА ФЛАГОМ (уже в Z1 песочницы bl-mascot); CoachPanel = МОДИФИКАЦИЯ → Z8 AI-Coach]
- **BillyDock:** клик → deck.setTab('billy') + expand (:157-168), аудио-реактив, зона-кэш (читает --bl-deck-height + --wagon-train-height, useBillyZoneCache.ts:25), 8 анимаций. **Уже спрятан флагом в [SB] (v2 Δ-маскот 🟡-решение 23:2x).**
- **CoachPanel (App.tsx:247, js/ui/CoachPanel.tsx):** ⚠️ удар-002:11 — УЖЕ СУЩЕСТВУЕТ (флаг-управляемый, styleless-шелл без CSS-файла, открывалки setOpen(true) не найдено). Z8 AI-Coach = МОДИФИКАЦИЯ существующего, не новая панель; чипы/футер — Δ№6 «не рисовать» первой итерацией.
- **Сироты дока:** BillyChatModule (modules.ts:111) — жив только lazy-модулем дока; BillyDock-клик открывает именно его.

### 11. CatalogPanel.tsx — панель каталога [Q3: ЧУЖАЯ ЗОНА B09 — только стык]
- **Механика:** fixed над док-высотой (:58-63, читает --bl-deck-height), поиск useCatalogStore.searchQuery (:27-28, инпут :98-105).
- **Z1-дельта Δ№2:** фильтр каталога инлайн в поиске хедера — стык B09 (зона не визуал — запрет PULSE-ZONES).

### 12. MonitorRouter.ts — интеграционные точки [FROZEN-смежное: читать, не править]
- vmixMicIn (:276 tap) · _monitorGain · micInput · setMicMonitor/setVMix + CustomEvent'ы · programInput/vocalHallInput. Inst-фейдер dual-mode: __v3Active&&hasMusicStems → setBusVolume('music-bus'), иначе legacy setInstrumentalVolume+зеркало (:195-237) + exercise-override (:207,228). **⚠️ удар-002:3: двойной маршрут — обязателен в вердикте красного неона Z7.**

---

## §2 · КАРТЫ-СПЕЦСЛУЖБЫ

### 2.1 · Три шкалы темпа (сводка удара-002:2) — вердикт Круга-2
| Шкала | Носитель | Значение |
|---|---|---|
| playbackRate % | BpmButtons B−5/P/M (STEP 0.05, 0.25-4.0) | старый мир |
| BPM-число | REF-2 Z5-степпер (105/+/-) | цель; трек-метаданные (track-meta.service) |
| ±5 BPM | SPEC §4 | контракт текста; «105→110» = rate=BPM_target/BPM_track |

### 2.2 · --bl-deck-height: 3 издателя / 5 потребителей / 2 fallback (удар-002:5)
Издатели: ControlDeck.tsx:82,98 · SyncEditorPanel.tsx:95 · ShowEditor.tsx:25.
Потребители: useBillyZoneCache.ts:25 · RehearsalLyrics.module.css:6 (fallback 76px) · InstrumentOverlay.module.css:5 · CatalogPanel.tsx:62 · SyncLyrics.tsx:85 (**fallback 240px!**).
Интенция: не-клинап при unmount (ControlDeck:86-91). **Вердикт-правило: любая замена дока обязана назвать нового издателя var.**

### 2.3 · deck.setTab внешние потребители (удар-002:6)
BillyDock.tsx:157,161 · featureRegistry.ts:33,70,78 (restore персиста!) · monitor.store.ts:262. Персист deck.store (bl-deck, activeTabId+expanded) + stale-tab guard (:103-108). **Вердикт-правило: замена дока = миграционный план для setTab-API, иначе Show/Split ломаются молча.**

### 2.4 · interruptPracticeSession — 42 точки (удары-002:8)
Обёрнуты: стрелки (:34,43) · TransportBar seek (:35) · WagonTrain ×4 (:96,122,205,227) · ControlDeck ×5 (:150,334,514,530,552) · TakesPanel (:1418,1595) · TakesControlStrip (:941-972) · ExerciseStrip (:19,130).
**НЕ обёрнут:** Space (useKeyboardShortcuts.ts:67-87) + switchMode (ModeButtons:19-22). **Дыра-вопрос Круга-2: Space-гейт — hold-исключение или баг?**

### 2.5 · ДЕТИ СНОСИМОГО (сироты дока — удар-002:10)
| Сирота | Импортёр | Судьба K5 |
|---|---|---|
| TransportBar.tsx | ControlDeck:8 | ПЕРЕНЕСТИ в новый DockBar (Z1-спека) |
| BpmButtons.tsx | ControlDeck:21 | ЗАМЕНИТЬ BPM-степпером; файл в deadcode после миграции |
| BillyChatModule | modules.ts:111 (lazy) | ПЕРЕНЕСТИ в ⋯-меню/AI-контекст |
| MixerPanel/MonitorMixPanel/StylesDeck/PitchTab/TakesPanel/ShowEntry (lazy) | deck-registry | СОХРАНИТЬ (реестр жив, точка входа = плитки/табы) |
| useBillyZoneCache | BillyDock | СОХРАНИТЬ (читает deck.store+height) |
| VolumeControls/BpmControl | — | ПОХОРОНИТЬ (deadcode-батч) |
| Тесты wagon-guard/lock | exercises | ПОЧИНИТЬ при迁移 (vitest Δ0-гейт) |

---

## §3 · K5-ВЕРДИКТ-ТАБЛИЦА СУДЬБЫ (Q3) — по каждой ветке А1-доктрине

> **Каноны-уточнения 00:3x (Соннет, 8a4536f; дифф — DOUBLE-MAP-DIFF-2026-09-07.md):** ① EXTRACTION-FALLBACK — «ЗАМЕНИТЬ» = extract actions → новый UI на те же actions → старый fallback → 006 → 009 → freeze → **снос последним** ② EXTRACTION-СИГНАТУРА — actions сразу под slider-семантику `(value, opts={intermediate})`, старый зовёт через адаптер ③ SURFACE-SMOKE-ТЕСТ — verify:surfaces кандидатом ПУЛЬС v0.2 ④ a11y-требование в спеку DockBar (GPT-находка, проверено Соннетом: div+mousemove, 0 slider-семантики).

| Объект | Судьба | Основание (канон) |
|---|---|---|
| ControlDeck (как контейнер) | ЗАМЕНИТЬ: DockBar (Z1-спека 007-YT) + surface-registry (А2) | REF-2 Z7 + А1 |
| ControlDeck always-on полоса | ПЕРЕНЕСТИ: транспорт → video-zone Z2-панель V1B; неоны Inst/Voc → неоны 64px; Studio-квадрат; плитки ×4; ⋯-меню (Mic/VMix → AudioActionsPopover) | REF-2 Δ№5 + Z1-песочница |
| ControlDeck expanded-панель (240) | ПЕРЕНЕСТИ в surface-registry (модули = поверхности по А2) | А2-предложение |
| TransportBar | ПЕРЕНЕСТИ в DockBar/видео (Z2) + ПОЧИНИТЬ таймер (HybridClock, куратор 200) | REF-2 Z2 + PIXEL-DELTA риск-④ |
| BpmButtons | ЗАМЕНИТЬ BPM-степпером (шкалу выбирает Круг-2 из §2.1) | REF-2 Z5 + SPEC §4 |
| VMix/🎤 | ПЕРЕНЕСТИ в ⋯ (AudioActionsPopover) — УЖЕ РЕШЕНО Z1 | v2 Δ№5 |
| ModeButtons | ЗАМЕНИТЬ dropdown «Rehearsal ▾» (механика switchMode сохранить) | REF-2 Δ№1 |
| Catalog-кнопка хедера | НЕ ХОРОНИТЬ — её нет в хедере; фильтр в поиске = дополнение | факт :414 |
| WagonTrain | МОДИФИКАЦИЯ (тинты/контур/высота 38-40px) | REF-2 Z2 |
| RehearsalLyrics | МОДИФИКАЦИЯ (Z2-дельты) | REF-2 Z4 |
| KaraokeLyricsBoard | МОДИФИКАЦИЯ + unify bottom | Z2 |
| BillyDock | ЗА ФЛАГОМ (уже в [SB]) | v2 Δ-маскот 🟡 |
| CoachPanel | МОДИФИКАЦИЯ → Z8 AI-Coach (без чипов/футера) | v2 Δ№6 + факт :247 |
| VolumeControls/BpmControl | ПОХОРОНИТЬ (мёртвые) | modules.ts:4-13 |
| rec-ветка ControlDeck | 🔴 НИКИТА (Show-зоны) | HANDOFF-B03:35 |
| --bl-deck-height издательство | ПЕРЕДАТЬ новому DockBar (+unify fallback 76/240) | удар-002:5 |

---

## §4 · ОТКРЫТЫЕ ДЫРЫ ДЛЯ КРУГА-2 (MUST-решения, из ударов 002)

1. Шкала темпа (§2.1): rate% / BPM / ±5BPM — одна таблица, один вердикт.
2. Space-гейт + switchMode-гейт: hold-исключения или баги нового дизайна?
3. Новый издатель --bl-deck-height + unify fallback (76 vs 240).
4. deck.setTab-миграционный план (персист + featureRegistry-restore + monitor.store).
5. rec-ветка: чистить/регистрировать (двойной 🔴 с Show).
6. Inst-фейдер dual-route (music-bus vs legacy+override) — что наследует красный неон Z7.
7. Тесты exercises (wagon-guard/lock) — миграция под новый док (vitest Δ0).

— agent-rehearsal [B01-HUB] · со-архитектор · K4+K5 сданы по 009-условиям 1-6 · второй проход 009 назначен 🏗⚖️
