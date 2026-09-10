# IMMERSION-REPORT · MO-loop «Луп-Хранитель» · 2026-09-10 08:5x · main f19ecd6 + SB feature/yt-prep (002eade, primary) · DRAFT

**FINGERPRINT:** `ИМПУЛЬС MO-loop · mechanism:loop.store · class:immersion-map`

Задача №1 HANDOFF (погружение + живой обход + прогон ①-④). Код не тронут: probes гонялись из `/tmp/opencode/mo-loop/` (вне репо), `git status` чист для src/. Канон-снапшот живого дерева 08:4x: **tsc НЕ ПРОВЕРЕНО (не гонял — не требовалось задачей) · vitest loop.store.test = 5/5 PASS (08:44) · verify:ci = G-7 junction-красный (3 известных env-нарушения, вне моей семьи, см. §E) · PARITY PASS**.

## A. КАРТА СЕМЬИ loop (7 строк, оба трека, всё file:line)

1. **Ядро** `src/stores/loop.store.ts` — 267 строк (не 268: wc=267, HANDOFF «267 строк» — сходится), zustand БЕЗ persist; 8 мутаторов: toggleSubBlock :121, toggleBlock :144, rebindToBlock :178, replaceLoop :196, setBoundaryLines :215, clearLoop :248, setRawLoop :261; инвариант isLooping⇔loopSubBlockKeys≠∅ держит `recalculateFromSubBlockKeys` :39-81 (+ clearLoop :248-259). **Байт-идентичен main↔SB** (git diff = пусто, проверено 08:3x — подтверждает таблицу HANDOFF).
2. **Синапсы** `loop-set`/`loop-cleared`/`loopcompleted` — types.ts:46-48, Sync-канал. **Байт-идентичны обоим трекам** (diff пусто).
3. **Издатели — ДВОЙНОЙ МИР:** единственные живые издатели = V3: TransportV3.ts:264 (loop-set) / :281 (loop-cleared) и V3StatePublisher.ts:158 (loopcompleted при wrap) — все через `document.dispatchEvent(CustomEvent)`; facade.ts:143-158 (monkey-patch dispatchEvent) репаблишит их в eventBus по LEGACY_EVENT_MAP :43-45. **Прямых eventBus-издателей НЕТ** (channels/sync.ts:9-11 loopSet/loopCleared/loopcompleted — методы-фасады с 0 вызовов; grep `\.loopSet(`/`loopCleared(` вне их определения = пусто).
4. **Подписчики loop-events.ts (104 строки):** store-subscribe :78 (→syncLoopToEngine — единственный мост store→engine), Sync/loop-cleared :81 (engine→store: clearLoop если isLooping), Track/before-change :88 (loop не переживает смену трека: clearLoop + t3.clearLoop), UI/mode-changed :95 (resync engine при активном лупе). Регистрация: initRegistry main.tsx:77 — живая (module-eval), retired-предшественник `loop.bridge` помечен в main.tsx:6/:316.
5. **Потребители store (12 файлов / 34 использований, grep 08:3x):** WagonTrain.tsx ×10 (toggle/replace/rebind/клики вагонов :22-26, :101-233) · RehearsalLyrics.tsx ×7 (границы лупа :39-43, :696-709) · WaveformCanvas.tsx ×6 (все 3 вызова setRawLoop в коде проекта: :256/:259/:266/:416 — canvas-луп; + clearLoop :509 через `window.__syncClearLoop`) · rehearsal-trigger.bridge.ts ×6 (clearLoop ×2 + **прямые setState :191-204, :346-356** — см. факт-2) · practice-session.store ×6 (hadLoop-snapshot :82-96, restore-clear-if-new :138-139, autoPassListener :170-190, nextPass-loop-guard :397) · ai-tools ×3 (AI-команды loop_section :592-643: clearLoop/replaceLoop/toggleBlock) · slot-matrix ×4 (isLooping/Start/EndLine — матрица слотов) · trigger-visual.service ×2 (loop-wrap коррекция визуала :58-62) · useBillyState/Locomotion ×2+2 (Билли знает isLooping) · AiExpertPanel/PracticeSessionCard ×2+2 (показ hadLoop/nextPass).
6. **loopcompleted-слушатели (K-B-хвост):** practice-session.store:184 (autoPassListener → nextPass = авто-пасс +5%) + ai-tools.ts:870 (лог-рука). Оба слушают document-CustomEvent, НЕ eventBus (см. класс ①).
7. **V3-внутренности** (наблюдаю, не владею): HybridClock.setLoop/clearLoop :120-128 (wrap-логика плейхеда), TransportV3.setLoop :255-269 / clearLoop :270-289 (stems+pipeline+clock, с Sonnet-fix «resync ДО отключения wrap»), LoopEngineV3.computeCanonicalLoop (zero-crossing, экспорт engine-v3/index:25-26), V3StatePublisher._tickLoop :148-167 (детекция wrap: `t < _lastTickTimeForLoop - 0.25`).

## B. ТРИ ФАКТА-СЮРПРИЗА (file:line)

1. **Мёртвый фасад синапсов.** `channels/sync.ts:9-11` — loopSet/loopCleared/loopcompleted объявлены как publisher-методы, но **0 вызовов во всём src** (grep 08:3x). Живые синапсы ходят другим путём: document-CustomEvent из engine-v3 → facade-monkey-patch (facade.ts:143-158) → eventBus. Значит «synapses: [sync.loop-set, …]» в MAP-строке (PULSE-NERVOUS-v2 §2 шаблон) будет **записывать маршрут, которым никто не пользуется** — реальная трасса = window-events + репаблиш. Класс: near-miss семантики MAP-строки, не кода.
2. **Два внешних raw-писателя моста в сторе.** rehearsal-trigger.bridge.ts:191-204 (case 'set-loop' — `useLoopStore.setState({isLooping:true, …, loopSubBlockKeys: [], loopStartLine: null,…})`) и :346-356 (applySnapshot) пишут стор напрямую, минуя все мутаторы. Это делает инвариант isLooping⇔loopSubBlockKeys≠∅ **условным**: он истинен только для 5 из 8 мутаторов (recalculate-семья + clearLoop), а raw-пути (setRawLoop :261-267 — комментарий «NOT touching» :266, bridge-setState) осознанно его игнорируют. **Инвариант в спеке §5② описан как безусловный — это расхождение спеки с деревом.** Класс ②, НАБЛЮДЕНИЕ.
3. **DeckBar-неоны НЕ потребляют loop.store.** git show feature/yt-prep:src/components/DeckBar.tsx | grep loop = **0 вхождений** (TransportPanel тоже 0). «Стыки: DeckBar-неоны» из HANDOFF §СЕМЬЯ — фактическая ошибка паспорта: неоны = стемы (deck-семья MO-dock, находка practice-гейта ATOM-DOSSIER §B), луп живёт в WagonTrain/RehearsalLyrics/WaveformCanvas. Пересечение с MO-dock по fingerprint-дедупу НЕ возникает. Ещё сюрприз-подтверждение: **churn ядра = 1 коммит за 30+ дней** (56d6f0a post-migration snapshot) — ядро заморожено исторически, не только политикой.

## C. ПРОГОН 4 ПИЛОТНЫХ КЛАССОВ ①-④ (первый импульс)

### ① Дрейф подписчика — **НАБЛЮДЕНИЕ (2 находки)**
Метод: diff живых подписчиков против MAP-спеки (cold-start synapses=[] vs HANDOFF-семантика loop-set/loop-cleared/loopcompleted).
- **Дрейф-1:** `loop-set` в eventBus-мире **не имеет ни одного подписчика** (grep `EventBusChannel.Sync, 'loop-set'` = только определение канала). Издатель есть (TransportV3:264→facade-репаблиш), слушателя нет — событие публикуется «в пустоту» шины; его реальные потребители слушают document-CustomEvent напрямую (transport-гейт в loop-events? НЕТ — loop-events слушает только loop-cleared). loop-set фактически никем не потребляется: store→engine идёт через store-subscribe :78, а не через событие. **Событие-сирота в шине** (класс synapse-warn, гейт 4 волны-2 поймает).
- **Дрейф-2:** `loopcompleted` в eventBus-мире тоже **0 подписчиков** — авто-пасс (practice-session.store:184) слушает document-CustomEvent. Оба реальных консумента — вне шины. Спека-семантика «3 события Sync» верна по типам, но транспорт реально другой (см. факт-1).

### ② Near-miss инварианта — **НАБЛЮДЕНИЕ**
Метод: перечисление мутаторов + экспериментальный probe (vitest, /tmp — вне репо).
- Инвариант безусловно держат: toggleSubBlock/toggleBlock (recalculate-путь), clearLoop. Условно: rebindToBlock/replaceLoop (keys≠∅ по построению).
- **Near-miss сценарий пойман probe-ом:** setRawLoop поверх блочного лупа даёт смешанное состояние `isLooping:true + loopSubBlockKeys:[] + loopStartLine/EndLine=null` (loopOrigin='canvas' :265). WagonTrain в этот момент рисует «нет выделенных вагонов», а WaveformCanvas — активный луп 30-40: **два UI-потребителя видят разные лупы одного стора**. Сценарий достижим из UI: блочный луп (WagonTrain) + Shift+drag на waveform (WaveformCanvas:413-416). Аналогично bridge 'set-loop' (:191-204) при пустом payload — но у bridge payload-guard есть (проверки :192-195 нет! setState безусловно — если учитель пришлёт start/end, луп у ученика СТЕРИТ line-поля в null — норм для raw-мира, ненормально для блочного, если был активен блочный → стёрт в null при isLooping:true).
- Статус: НАБЛЮДЕНИЕ (не эскалация — вероятностный UI-хвост, рецепт через цепь при плане Никиты: кандидат — origin-aware guard в setRawLoop или нормализация в bridge-setState).

### ③ Синтетика — **PASS (пилот ловит)**
Метод: synthetic-probe.test.ts (3 теста, /tmp): (а) baseline clearLoop-инвариант — держится; (б) raw setState `isLooping:true + keys=[]` — аномалия воспроизводится, **стор не защищает инвариант на прямом setState** (zustand открыт); (в) `isLooping:false + keys=['a:0']` — тоже принимается. Вывод: пилот-набор ВИДИТ синтетические аномалии обоих направлений — детекция работает. 3/3 PASS за 239мс. Фикстура-путь легально доступен всегда (как обещано спекой §5③).

### ④ Статический контракт-чек — **ЧИСТО + 2 наблюдения**
Метод: grep владения loop×repeat×autoplay (спека §5④).
- `repeat` в `src/stores/audio.store.ts` = **0 вхождений** — K-B-якорь HANDOFF подтверждён живым grep 08:4x. «Repeat» живёт в: exercises-семья (exercise.store:191, runtime:76/:113, types, 7 генераторов — K-A двойная система повторов, волна-2 сосед MO-practice), practice-session (repeatPass :419), useKeyboardShortcuts, tagged-lyrics.parser, TakesPanel, line-map.builder, RehearsalBackground, LoopEngineV3 (zero-crossing — V3-внутренность).
- `autoplay` в loop-периметре: track.actions.ts:11/:39 (loadTrack), catalog.store.ts:280 (loadPlaylist) — авто-ЗАПУСК трека, не авто-пасс; TransportV3:197 — комментарии о запрете autoplay-on-scrub. **Угон авто-пасса repeat'ом в audio-семье НЕ подтверждён** — K-B остаётся превенцией (как и заявлено: «находка Z2-цепи, превенция, не живое событие»).
- Наблюдение-4а: loopOrigin ('ui'|'canvas'|null :17) — поле маршрута, не потребляемое ни одним компонентом (grep loopOrigin вне store = 0) — информационный атом «для будующего» или забытый флаг.
- Наблюдение-4б: `window.__syncClearLoop` (WaveformCanvas:506-512) — глобальный экспозиторий clearLoop для тулбара — живой, но выход за=eventBus-мир (window-инъекция).

## D. ВЕРДИКТ ПРИЁМКИ ЗАДАЧИ №1 (HANDOFF §ПЕРВЫЕ 3 ЗАДАЧИ)
Приёмка пилота (2 недели, PULSE-NERVOUS-v2 §5): «1 агрегированное ЧИСТО + ≥1 НАБЛЮДЕНИЕ на классах ①②③ + отчёт ④». За первый вход: классы ①②③④ все задокументированы (эта строка = фиксация), НАБЛЮДЕНИЯ на ① (2) и ② (2), ③=PASS-ловим, ④=ЧИСТО по K-B + 2 микро-наблюдения. Агрегированное ЧИСТО по классу ④ (контракт loop×repeat×autoplay чист) — записываю как первый ЧИСТО-агрегат в отчёте. **Счёт первого входа: 1 ЧИСТО-агрегат + 4 НАБЛЮДЕНИЯ.** Живая аномалия — не поймана (бонус не заработан).

## E. ОКРУЖЕНИЕ (не моя семья, зафиксировано для полноты)
- verify:ci на живом дереве main: **PARITY PASS · reach 0 violations (hold 21) · events ok · inert ok · docvis ok · junction КРАСНЫЙ: G-7 violations=3 (wrangler-env-d1, vite-url-ai-worker, vite-url-worker-src — все .env.production/worker-стыки, известных с 1ad9bb9, вне loop-семьи)**. Не эскалирую: не мой механизм, зафиксировано в отчёте + LOG.
- vitest loop.store.test.ts: 5/5 PASS (08:44) — live-прогон.
- Опечатка в HANDOFF §ЧИТАТЬ-ПОРЯДОК п.10: `PULSE-NERVOUS-2029-09-09-final.md` — реальный файл `PULSE-NERVOUS-2026-09-09-final.md`. Тест внимательности пройден, доклад в TRIGGERS/004.md (мост).
- Расхождение спеки (HANDOFF §СЕМЬЯ «DeckBar-неоны»): см. факт-3 — DeckBar/TransportPanel содержат 0 упоминаний loop; правка паспорта = 004 (фабрикант), я только докладываю.

## F. ОТКРЫТЫЕ ВОПРОСЫ ДЛЯ ПЛАНА НИКИТЫ (не решения — плоскости)
1. loop-set/loopcompleted в eventBus = события-сироты (издатели через facade-репаблиш есть, подписчиков в шине 0): фиксировать ли в MAP-строке synapses как «legacy-window-репаблиш» (маршрут-правда) или чинить консьюмеров на eventBus (волна-2 synapse-warn их увидит)?
2. Инвариант §5②: считать ли raw-пути (setRawLoop/bridge-setState) легальным исключением (осознанный комментарий :266) — или кандидатом на origin-aware нормализацию? Решение = 🔴 плоскость (инвариант канона).
3. loopOrigin-поле (0 потребителей) и window.__syncClearLoop (window-инъекция): резерв или мусор? Тривиум для плана.
4. MAP-строка loop.store: synapses холодного старта [] — после разметки 004 какой маршрут писать: sync.* (шина) или window-трассу (реальность)? Зависит от решения-1.

— 🛡 MO-loop «Луп-Хранитель» · первый вход · 00-режим · fingerprint в каждом разделе 🫀
