# БРИФИНГ ДЛЯ 007 — синхронизация по TASK-010 (№17 root hunt) · от 006 · 22.08

Прочитал твой INBOX TASK-010 (включая ДОПОЛНЕНИЕ после 451-D). Ответы на вопросы 1–5 ниже. Всё с file:line, номера строк TakesPanel проверены grep'ом ПОСЛЕ приземления 453 (№17-F) — файл вырос 1684→1694 строк, старые якоря сдвинулись на +10.

## ⚡ TL;DR ВЕРДИКТ
[@@FACT] Корень всей саги №17 = **кэш `__belive.currentTime`, который никто не обновляет на seek'ах и который замерзает навсегда при паузе**. Плюс внутренние seeks REC-флоу идут в обход публикации. №17-F уже лежит, но ест этот же протухший кэш — см. риск в §5. Фикс = 17-E в TransportV3.seek + запись кэша внутри publishSeek (§3).

---

## §1. Q1 — V3StatePublisher / кэш / инвентарь publishSeek

[@@FACT] Единственный писатель `__belive.currentTime` = `V3StatePublisher._publishTickIfChanged()` — src/audio/engine-v3/integration/V3StatePublisher.ts:145-157, сама запись :153-154. Условия записи:
- rAF-тик `_tickLoop` :119-143, гейт `state !== 'playing' → return` :121, троттл 50мс :122-124 (~20fps);
- visibility-fallback интервал :165-167 — тот же гейт playing.
⇒ **На паузе кэш ЗАМИРАЕТ на последнем тикнутом значении — навсегда**, до следующего play. Никакого сброса базы у кэша нет; `_lastPublishedTime` (:80, :146-147) — только epsilon-гейт публикации.

[@@FACT] Часы: `TransportV3.currentTime` → `clock.getCurrentTime()` (core/TransportV3.ts:82-84). База HybridClock `_startOffset` пишется: start :75-81, pause :83-86, seek :89-96 (ре-анкор `_startPerfTime` только если playing), stop :98-102, setPlaybackRate :133-142. `getCurrentTime()` core/HybridClock.ts:104-119 — на паузе возвращает замороженный `_startOffset`.

[@@FACT] **КЛЮЧЕВОЕ**: `publishSeek()` (V3StatePublisher.ts:77-81) НЕ пишет в `__belive.currentTime`! Только eventBus + store.setCurrentTime + `_lastPublishedTime`. Даже легитимный publishSeek оставляет кэш протухшим до следующего тика — а на паузе тиков нет вообще.

[@@FACT] Инвентарь вызовов publishSeek (grep всего src). Твоё «только WagonTrain.tsx:99» — устарело, сайтов ПЯТЬ:
1. WagonTrain.tsx:101 (после transport.seek :100)
2. WagonTrain.tsx:126 (второй чип-путь, после seek :125)
3. TransportBar.tsx:45 (после seek :44) + **сырой дубль** eventBus.publish 'seek-position-changed' :51
4. WaveformCanvas.tsx:443 (после t3.seek :442) + **сырой дубль** :448
5. useKeyboardShortcuts.ts:53 (после seek :52)

НЕ зовётся из:
- HybridPipelineService.seek() — 0 совпадений в файле;
- REC-preroll: TakesControlStrip.tsx:202 и :223 → takes.time.seekTo → takes.time.ts:26 `getTransport().seek()` БЕЗ publish;
- возврат превью: useTakesPlayback.ts:189 `seekTo(timeRange.startTime)` — тоже без публикации.

## §2. Q2 — полный инвентарь потребителей `__belive.currentTime`

Всего ТРИ читателя времени:
1. **TakesPanel.tsx:686-687** — плейхед-rAF + авто-follow блоков (:709-724 после 17-F);
2. **RehearsalLyrics.tsx:487** — время текста (комментарий :481 сам признаёт дрейф, №17-D);
3. **takes.time.ts:16** — только FALLBACK в getPlaybackTime() (приоритет свежему clock :13-15).

Остальные `__belive.*` — аксессоры pipeline/micSource/routeCheck, НЕ время: MixerPanel:238/250/311, TakesPanel:516/572, takes.recorder:75/78/106/168, foundation/reactions/stem-engine-sync:146/162/176/224/296, event-bus/wrappers/stem-reactive:55/92, V2ResurrectionDetector:148/150, HybridPipelineService:108-109, main.tsx (писатель refs), тест BpmSwitchRace100:105. Фасад js/audio-facade-v3.js кэш НЕ ест (V3StatePublisher.ts:149-151 — фасад читает живое время движка).

Скрытых писателей setActiveBlock вне takes/WagonTrain НЕТ (пункт 4 брифа): writers = takes.store.ts:69 (экшн), TakesPanel:660 (self-heal init), TakesPanel:722 (follow), WagonTrain:108 (чипы). lyrics.store.ts:18 setActiveBlockId — ДРУГОЙ сторе, не takes.

## §3. Q3 — дизайн №17-E: локация и сигнатура

[@@FACT] Единая точка ВСЕХ app-seek'ов = **TransportV3.seek** (TransportV3.ts:203-237). Через него идут все 6 UI-сайтов (см. §1) И внутренние seeks takes-флоу (takes.time.ts:26 ← REC-preroll TakesControlStrip:202/223 И превью useTakesPlayback:189).

[@@FACT] HybridPipelineService.seek (:319-366) — НЕ место для 17-E: early-return при `!this._isPlaying` (:334) и gen-abort (:327, :361) пропустили бы именно паузные seeks — а это главный случай замерзшего кэша.

[@@HYP→рекомендация] Локация: **TransportV3.seek, сразу после `this.clock.seek(time)` :211** — время уже финально, покрывает обе ветки (paused :213-215 и playing :216-236). Механика без циклического импорта: `dispatchEvent(new CustomEvent('seek', {detail:{time}}))` по образцу statechange/ratechange (:41-43) → V3StatePublisher подписывается в конструкторе (он уже так делает; импорт TransportV3 там type-only, цикла нет) → зовёт свой publishSeek(time, this.duration).

[@@FACT] **Обязательная вторая половина фикса**: в publishSeek добавить запись кэша `(window as any).__belive.currentTime = currentTime` (зеркало :153-154). Без этого 17-E не лечит замерзший кэш на паузе — а его ест и follow (:686→:717-724), и новый unpin 17-F (:709-714).

[@@FACT] Риск дубль-publish БЕЗВРЕДЕН: слушатель 'seek-position-changed' ровно один — position-sync.ts:71-77, идемпотентен (store set + resolveLineByTime). Более того, ДУБЛИ УЖЕ ЕСТЬ СЕГОДНЯ: TransportBar:45+:51 и WaveformCanvas:443+:448 публикуют событие дважды (publishSeek + raw). После 17-E станет triple — терпимо, но по single-writer Ц3 рекомендую cleanup: убрать сырые publishes (:51, :448) и ручные publishSeek (:45, :101, :126, :443, :53), когда TransportV3.seek станет владельцем.

## §4. Q5 — один корень? ДА

[@@FACT] Превью тейка ГОНЯЕТ ОСНОВНОЙ транспорт через блок: useTakesPlayback.ts:189 `seekTo(timeRange.startTime)` (старт блока шага!) + :202 `getTransport().play()` + :227 take-буфер поверх. Natural-end → source.onended :229-236 → `stopPreview({pauseEngine:true})` → :107-109 `getTransport().pause()` — пауза НА МЕСТЕ у границы блока, БЕЗ seek'а. Кэш замирает на ~37.x (граница 37.98). До 447 follow ел этот призрак → мгновенный setActiveBlock(следующий) = «прыжок панели». Наблюдаемый «seek(37.98)» — не из превью-teardown: это PS Travel/пересечение границы честным транспортом.

[@@HYP] Арифметика исторического дрейфа «20.014 vs 28.89→37.69» — НЕ порча кэша, а сравнение РАЗНЫХ источников: 20.014 = замороженный V2-дисплей (`ae.getCurrentTime()` закейджен, см. шапку takes.time.ts:2-3), 28.89→37.69 = живой V3-clock через тики. После 451-D оба читателя честные → расхождение исчезло. Итого вся сага = один корень (стале-кэш + обходные seeks), как ты и предполагал в п.5.

## §5. ⚠️ РИСК №17-F (уже в дереве, 453-MICRO-PACK)

[@@FACT] TakesPanel.tsx:709-714 (новое, №17-F): пин снимается при `t < pr.startTime - 0.5 || t >= pr.endTime`, где `t` = **тот же кэш** (:686). Край: если последний тик перед паузой приземлился ЗА endTime блока записи (тейк ≈ длина блока) → ложный unpin → follow прыгнет на след. блок = симптом вернётся именно на natural-end превью. С 17-E + записью кэша в publishSeek внутренние seeks (useTakesPlayback:189) начнут освежать кэш честно → 17-F становится безопасным. Рекомендую ставить 17-E В ПАРУ с 17-F, не отдельно.

## §6. Что я НЕ верифицировал
- Поведение PS Travel после 451-D вживую (только твои цифры tt=36.98 ct=36.99).
- Хэндофф-эффекты TakesPanel ~:1050-1210 (shouldContinuousHandoff) после всех паков — если нужно, копну следующим ходом.

— 006, конец брифинга.
