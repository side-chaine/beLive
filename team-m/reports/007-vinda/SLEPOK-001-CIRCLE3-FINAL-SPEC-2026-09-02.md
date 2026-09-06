# SLEPOK-001 · КРУГ-3 · ФИНАЛЬНАЯ СПЕКА «SLEPOK-FINAL» v1.0 — РАСЩЁП-СЛЕПОК (индивидуальная модель голоса через игру-калибровку)

**001 = CEO-Архитектор · 2026-09-02 · Канон-снапшот: tsc=290 · vitest=808+0int+0load (69 файлов) · PARITY PASS · frozen 17/17 · HEAD c183abf.**
**База:** круг-1 (SLEPOK-001-CIRCLE1) + стресс круг-2 (SLEPOK-002-CIRCLE2) — все 9 ударов внесены патчами, каждый помечен `[002-У-N]`. Строки сверены с живым деревом HEAD (дрейф после круга-1 учтён: в `yin-detect.ts`/`pitch-engine.ts` появились RASP-SNAPSHOT-маркеры, строки обновлены). Frozen (AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts) — не тронуты ни одним пунктом.

---

## 0. РЕШЕНИЕ (суть)

Индивидуальный снапшот голоса = **пассивный слушатель питч-канала в режиме Б (initFromNode, main-thread YIN — где живёт вся distortion-телеметрия)** + **один WaveShaper-фейдер на мик-стриме** + **молчаливая запись кадров в localStorage**. Ноль нового DSP-анализа: YIN-метрики, SFM, MicSourceV3, R9 — живы. Новый код = 4 файла + 2 тест-файла; правки живых = 4 не-frozen файла, суммарно ~10 строк. Наука (Kalbag&Lerch: 45% скримов не разделяются) → никаких классификаторов: снапшот = точка отсчёта конкретного пользователя.

---

## 1. СПЕКА ПО ПОД-ЗАДАЧАМ (круг-1 + патчи 002)

### ① Сервис VoiceProfileV3 — модель, метрики, персист

**Новый файл `src/audio/voice/voice-profile.service.ts`** (данные+модель, не UI-состояние). Ветка `src/audio/voice/` рядом с `audio/pitch/` — слой «анализ поверх потока» (философия Никиты 02.09 00:25, MONITORING-FIRST).

**Модель снапшота — 8 метрик С1-С8 (агрегаты, НЕ raw-кадры):**

| # | Метрика | Источник (file:line, живое дерево) | Агрегат |
|---|---|---|---|
| С1 | f0-медиана, Hz | `yin-detect.ts:155` (frequency) → msg.frequency | медиана фазы-1 |
| С2 | f0-стабильность, центы | msg.frequency → midi-разброс | MAD × 100 |
| С3 | subScore-медиана | `yin-detect.ts:126-135` (subharmonicRatio) → msg.subScore (`pitch-engine.ts:219`) | медиана |
| С4 | noiseScore-медиана (SFM) | `pitch-engine.ts:184-200` (_computeSFM) → msg.noiseScore (`:220`) | медиана |
| С5 | CMND-aperiodicity-медиана | **[002-У-1]** новое поле `aperiodicity` в YinResult (патч ①-б ниже) → msg.aperiodicity | медиана |
| С6 | RMS-медиана | msg.rms | медиана |
| С7 | faderAtSplit — фейдер первого устойчивого расщепа | UI-фаза-2 (④) | медиана по «расщепным» кадрам |
| С8 | splitMargin — расстояние sub/noise при расщепе | С3/С4 фазы-2 | медиана |

**[002-У-4] Порог «расщепного кадра» для С7/С8 — константа спеки:** `SPLIT_THRESHOLD = 0.2` (subScore > 0.2). Прецедент — порог осмысленности сабгармоники в живом коде (зафиксирован 002 по yin-detect; в текущем HEAD строка сместилась, значение каноническое). Одна константа в `voice-profile.service.ts`, экспортируется для тестов. Без неё снапшоты несравнимы между сессиями.

**Перекрёстная валидация кадра (ГРАНИЦА-301):** SFM (С4) и CMND-aperiodicity (С5) — два независимых шумовых признака. Расхождение >δ → кадр в снапшот не идёт. Работает только после [002-У-1] (поле реально течёт) — до патча сравнивать было нечего.

**Персист:** `localStorage 'belive:voice-profile'` (паттерн `user-profile.store.ts:187-201`: name/version/migrate/partialize). v1 + migrate-хук. Ключи `belive:` — канон (`main.tsx:812`, `metrics.store.ts:101`). Raw-кадры НЕ персистим — только С1-С8 + deviceId + createdAt + quality-флаг.

**Интерфейс:** `recordFrame(frame: CalibrationFrame): void` — кадр {f0, conf, sub, noiseSFM, noiseCMND, rms, fader, ts, deviceId}; `finalize(): VoiceProfileV3 | null` (null при <N валидных кадров — честный отказ); `load()/clear()`; `frameQuality(frame): 'green'|'yellow'|'red'`.

### ①-б Патч телеметрии — 2 правки живых не-frozen файлов

**[002-У-1] `yin-detect.ts` (не frozen) — +3 строки:** поле `aperiodicity: number` в интерфейс `YinResult` (`:10-19`) + вычисление и возврат в return-объект (`:154-160`). Формула — из живого RASP-SNAPSHOT-комментария (`yin-detect.ts:120`): `aperiodicity = clamp((cmnd[te] - 0.18) / 0.42, 0, 1)` — noiseProxy-восстановление уже канонизировано в дереве, спека лишь поднимает значение из локального вычисления в результат. Без этого С5 = NaN и перекрёстная валидация мертва (002: «правка пустого места»).

**`pitch-engine.ts:210-221` (не frozen) — +1 строка:** `aperiodicity: result.aperiodicity` в pitch-msg `_passiveTick` (строка `subScore` уже там — `:219`). **`types.ts:10-14` — +1 строка:** `aperiodicity?: number` в WorkletMessage (optional — потребители не ломаются).

### ② Снос UI-детектора (PitchTab.tsx) — не frozen

| Что | Строки (живое дерево) | Действие |
|---|---|---|
| `useStableVocalData` EMA-хук | `:80-164` | СНОС → vocal-движок на `useStableNote`-вариант |
| **[002-У-8] hold-500ms** | паттерн `:127-135` | **ПЕРЕНОС в `useStableNote`** (`:166-198`): lastNoteRef/lastNoteTimeRef + hold-логика, ~5 строк. Иначе снос = UX-регрессия: тикер 21.5 Гц шлёт silence между фразами → vocal-нота мигает, PianoKeyboard дёргается |
| Крылья-визуал (wingLeft/wingRight) + textShadow | JSX крыльев + стили | СНОС → чистый `<span>` note-дисплей; вердикт-визуал переезжает в VoiceCalibration |
| Mic-кнопка / vocal+mic note / match ✓ / PianoKeyboard | — | ОСТАЁТСЯ без изменений |

Сырьё НЕ трогаем: `yin-detect.ts:126-135` — живой вычислитель; `pitch-engine.ts:202-233` — живой публикатор.

### ③ Фейдер-цепь WaveShaper (мик-граф)

**Новый файл `src/audio/voice/split-fader.ts`** — класс `SplitFaderChain`.

**Граф (ctx из `__belive.pipeline.ctx`):**
```
MicSourceV3.acquire() → createMediaStreamSource → highpass(80Hz) → lowpass(2000Hz)
  → [dryGain ─────────────┐]
  → [WaveShaper → wetGain ─]→ outGain → (destination — лениво, см. У-7)
```
- **Кривые:** `clean` = identity, `distorted` = жёсткий tanh-сатуратор. `setMix(x: 0..1)`: `curve[i] = lerp(clean, distorted, x)`, `dryGain = cos(x·π/2)`, `wetGain = sin(x·π/2)` (equal-power). Интерполяция — на input-событие фейдера, не на кадр.
- **[002-У-6] Анти-observer-effect:** `wetGain = sin(x·π/2) × 0.5` (−6 дБ компенсация сатурации) — одна константа. Без неё громкий вокал + фейдер→1 → юзер инстинктивно поёт тише → С7 систематически смещён. Плюс светофор: дрейф медианы-rms фазы-2 vs фазы-1 > ×0.5 → жёлтый.
- **[002-У-7] Ленивый connect:** `outGain → destination` НЕ в конструкторе, а парой connect/disconnect в момент 🎧-включения. Убивает зомби-маршрут в обход MonitorRouter by design; monitor-guard (outGain=0 дефолт) остаётся второй линией обороны.
- **R9-совместимость:** стрим уже `{echoCancellation:false, noiseSuppression:false, autoGainControl:false}` (`MicSourceV3.ts:73`); refcount `acquire():33-47`/`release():50-53`; два createMediaStreamSource на одном MediaStream легальны (инвариант 82e1c76).
- **Dispose:** `release()` + disconnect всех узлов (паттерн `pitch-engine.ts:237-282`).

### ④ UX-контур — калибровка-игра

**Новые `src/components/VoiceCalibration.tsx` + `src/stores/voice-calibration.store.ts`** (zustand, НЕ персист — UI-фаза). Сценарий 3-5 мин, один экран, ноль текстовых полей.

1. **Фаза-1 «Чистая нота» (~20 сек):** **[002-У-2] движок = `initFromNode`, НЕ `initFromMic`.** Сервис сам строит `createMediaStreamSource(stream)` от `MicSourceV3.acquire()` и передаёт узел в `initFromNode` (`pitch-engine.ts:144-176`, режим Б, протестирован К-3). Причина: worklet-путь (`yin-processor.js:164-171`) шлёт ТОЛЬКО f0/conf/rms/midi — subScore/noiseScore/aperiodicity живут в main-thread `_passiveTick` (`pitch-engine.ts:202-233`). initFromMic = 4 из 8 метрик NaN. Режим Б — не новая механика, он уже жив.
2. **Фаза-2 «Добавь расщеп» (~60 сек):** SplitFaderChain включён, горизонтальный фейдер 0-100. Юзер слышит градус расщепа (ядро концепции Никиты) и подстраивает голос. Каждый кадр молча пишется: {f0, sub, noiseSFM, noiseCMND, rms, fader, ts}.
3. **Автоснапшот:** `finalize()` → С1-С8 → persist. Экран «Слепок снят ✓» + мини-паспорт (8 цифр, F3-визуал градусом).

**Светофор качества:**
- 🟢: rms < 0.95 (нет клиппинга), deviceId стабилен, SFM/CMND согласованы
- 🟡: шум-фон (SFM высокий при слабом sub); дрейф rms фазы-2 [002-У-6]
- 🔴: **[002-У-5] тишина = `msg.type === 'silence'`** (дискретный сигнал канала, не голое число — 0.003 в `pitch-engine.ts:227` это no_pitch/silence-граница, YIN-гейт = 0.01 `yin-detect.ts:23`); клиппинг (rms ≥ 0.95); **[002-У-3] смена мика: deviceId из `stream.getAudioTracks()[0].getSettings().deviceId` на каждом acquire** (сравнение с базовым первого кадра), НЕ из `MicSourceV3.deviceId:29` — тот слеп при '' (не читает getSettings после захвата, `_open():72-84`)

**Точка входа v0:** кнопка «🎤 Снять слепок» рядом с PitchTab-mic (см. 🔴-3).

### ⑤ ТЕСТЫ — 9 штук, 2 новых файла + 2 правки существующих

**`src/audio/voice/__tests__/voice-profile.test.ts` (5):**
1. «С1-С8: агрегация фейк-кадров → корректные медианы/MAD» — 20 кадров с известными значениями
2. «migrate: v0-мусор/чужой payload/version>текущей → null, не throw» (паттерн user-profile; условие 002 — покрытие будущей v2)
3. «persist round-trip: save → load → идентичный снапшот» (localStorage-мок)
4. «frameQuality: silence-тип/клиппинг/deviceId-смена (из getSettings-мока) → red; SFM/CMND-расхождение → кадр отсеян»
5. «finalize при <N валидных кадров → null (честный отказ)»

**`src/audio/voice/__tests__/split-fader.test.ts` (4):**
6. «setMix: кривая монотонно интерполируется clean→distorted; dry+wet = equal-power × 0.5-компенсация» [002-У-6]
7. «R9/refcount: acquire=1 → цепь жива; dispose на живом refcount → release=1, все узлы disconnect» (паттерн К-4)
8. «monitor-guard: outGain не подключён к destination до 🎧; после включения — connect, после выключения — disconnect» [002-У-7]
9. **[002-У-2] «initFromMic-кадры не содержат subScore/noiseScore/aperiodicity»** — машинная охрана режима-гварда: если реализация вернёт mic-путь, тест краснеет. Фиксирует главный риск спеки навсегда.

**[002-У-9] Мок-паттерн для 6-8 (фиксация в спеке):** fake-ctx по образцу К-3 (`pitch-engine-modes.test.ts:21-38` makeFakeCtx) + стабы `createWaveShaper/createGain` с записью curve/gain.value — assert на массив кривой и числа гейнов, без реального Web Audio (jsdom его не имеет).

**Правки существующих тестов (2):**
- `pitch-engine-modes.test.ts` К-7 static-grep (`:8`) — расширить: PitchTab не читает subScore/noiseScore (машинная верификация сноса ②)
- `pitch-engine`-тесты — +1 кейс: `_passiveTick` msg содержит `aperiodicity` (верификация ①-б)

---

## 2. СТРУКТУРА (все затронутые файлы)

**Новые (6):**
- `src/audio/voice/voice-profile.service.ts` — модель+агрегатор+персист+SPLIT_THRESHOLD
- `src/audio/voice/split-fader.ts` — WaveShaper-цепь (equal-power ×0.5, ленивый connect)
- `src/stores/voice-calibration.store.ts` — UI-фаза/светофор
- `src/components/VoiceCalibration.tsx` — экран-игра (initFromNode-движок)
- `src/audio/voice/__tests__/voice-profile.test.ts` (5 тестов)
- `src/audio/voice/__tests__/split-fader.test.ts` (4 теста)

**Правки живых (не frozen, 4 файла, ~10 строк):**
- `src/audio/pitch/yin-detect.ts` — [002-У-1] +3 строки: `aperiodicity` в YinResult-интерфейс (`:10-19`) + формула noiseProxy (`:120`-канон) + return (`:154-160`)
- `src/audio/pitch/pitch-engine.ts:210-221` — +1 строка: `aperiodicity` в pitch-msg
- `src/audio/pitch/types.ts:10-14` — +1 строка: `aperiodicity?: number`
- `src/components/PitchTab.tsx` — снос `:80-164` (EMA-хук) с переносом hold-500ms [002-У-8] в `useStableNote` (`:166-198`); снос крыльев+стилей; остальное без изменений

**Frozen — НЕ тронуты:** AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts — ни один не фигурирует как цель правки (проверено 002 и перепроверено мной по спеке выше).

---

## 3. ОТВЕТ НА СТРЕСС 002 (по каждому удару)

| Удар | Вердикт | Как внесён |
|---|---|---|
| У-1 aperiodicity нет в YinResult (убийца) | **ПРИНЯТ** | ①-б: +3 строки в yin-detect.ts (не frozen), формула из живого RASP-SNAPSHOT-комментария `:120` — канон уже в дереве, спека поднимает значение в результат. Дельта дерева: переменной `aperiodicity` в текущем HEAD нет вообще (grep пуст) — патч вносит её по канонизированной формуле |
| У-2 initFromMic не несёт телеметрию (убийца) | **ПРИНЯТ** | ④ фаза-1/2: движок = initFromNode (режим Б жив `pitch-engine.ts:144-176`, К-3). Сервис сам строит createMediaStreamSource от acquire(). Тест-9 — машинная охрана навсегда |
| У-3 deviceId-гвард слеп при '' | **ПРИНЯТ** | ④: deviceId из `track.getSettings().deviceId` на каждом acquire, сравнение с базовым первого кадра. MicSourceV3.deviceId не используется |
| У-4 порог «расщепного кадра» не определён | **ПРИНЯТ** | ①: константа SPLIT_THRESHOLD=0.2 в voice-profile.service.ts, экспорт для тестов |
| У-5 светофор путает 0.003/0.01 | **ПРИНЯТ** | ④: красный «тишина» = msg.type==='silence' (дискретен в канале); rms-проверка — только верхняя граница 0.95 |
| У-6 observer-effect сатуратора | **ПРИНЯТ** | ③: wetGain = sin(x·π/2) × 0.5 (−6 дБ) + светофор-дрейф rms фазы-2 vs фазы-1 > ×0.5 → жёлтый. Тест-6 покрывает |
| У-7 outGain-зомби в обход MonitorRouter | **ПРИНЯТ** | ③: ленивый connect/disconnect парой при 🎧-включении. Тест-8 покрывает |
| У-8 снос EMA теряет hold-500ms | **ПРИНЯТ** | ②: перенос hold-500ms (паттерн `:127-135`) в useStableNote, ~5 строк. Снос = замена без потери поведения |
| У-9 тесты падают на jsdom без Web Audio | **ПРИНЯТ** | ⑤: fake-ctx мок-паттерн К-3 (`pitch-engine-modes.test.ts:21-38`) зафиксирован в спеке; стабы createWaveShaper/createGain с записью curve/gain |
| Условие 002: migrate-тест покрывает version>текущей | **ПРИНЯТ** | Тест-2 расширен: v0-мусор + чужой payload + version>текущей |
| Условие 002: dispose-тест на живом refcount | **ПРИНЯТ** | Тест-7: acquire→dispose при refCount≠0, проверка release-баланса |
| Отклонено: прокинуть телеметрию в worklet-сообщения (альтернатива У-2 у 002) | **ОТКЛОНЕНО** | Правка audio-thread кода yin-processor.js дороже и не нужна: режим Б уже жив и протестирован, main-thread YIN при 21.5 Гц не грузит UI-поток (прецедент — vocal-трек уже так работает) |

**Итог: 9/9 ударов принято, 0 отклонено** (отклонена только альтернативная реализация У-2, не сам удар). Суть концепции Никиты (фейдер-игра, молчаливая фиксация, снапшот-паспорт) не изменена ни одним патчем.

---

## 4. ПОЧЕМУ МИНИМАЛЬНО

1. **Ноль нового DSP-анализа:** все 8 метрик — агрегаты живущих каналов; патчи 002 лишь переключают режим движка (Б вместо А) и поднимают уже вычисляемое значение (aperiodicity) в результат. Слепок = подписчик + счётчик, не алгоритм.
2. **4 новых файла вместо платформы:** сервис/цепь/стор/экран — каждый тянет вес. Ни одного классификатора (наука: 45% не разделяются; снапшот = индивидуальная точка отсчёта).
3. **Все патчи 002 — в не-frozen файлах, суммарно ~10 строк:** У-1 (+3), У-2 (0 — выбор существующего режима), У-8 (~5), остальные — константы/условия внутри новых файлов. Frozen-граница чиста.

---

## 5. ЦЕНА / РИСК

- **Правка yin-detect.ts (У-1):** первое проникновение в живой детектор. Поле аддитивное (интерфейс + return), consumers YinResult не ломаются (optional-семантика через `??` не нужна — поле всегда число). 002 обязан прогнать полный vitest после патча.
- **initFromNode = main-thread YIN при 21.5 Гц:** тот же паттерн, что vocal-трек в проде — риск низкий, но калибровка добавляет второй интервал на страницу (существующий vocal-интервал + калибровочный). Слепок-экран монопольно владеет своим движком → destroy() при выходе обязателен (паттерн `:237-282`).
- **Feedback-петля:** monitor-guard (outGain=0 дефолт) + ленивый connect [У-7] + предупреждение «наушники» на экране. Юзер без наушников не слышит фейдер-фазу — честно.
- **Полка-декей:** спека против HEAD c183abf; дерево уже дрейфнуло (RASP-SNAPSHOT-маркеры) — перед прогоном перепроверить строки yin-detect/pitch-engine/PitchTab.
- **tsc-дельта:** новые файлы чистые; правки = +5 строк типов/кода в 3 живых файлах. Ожидаемо tsc ≤ 292 (гейт Δ≤0 — следить; при дрейфе дерева пересчитать базу).

---

## 6. ТРЕБУЕТ РЕШЕНИЯ CEO/БОССА (🔴)

1. **🔴 Мониторинг-маршрут v0:** локальный destination + ленивый connect + guard-гейн (рекомендую — не ждёт F-2/G14) ИЛИ router.micInput сразу (архитектурно правильнее, но тянет MonitorRouter-правки в скоуп).
2. **🔴 Поле aperiodicity в YinResult + pitch-msg:** подтвердить правку живого yin-detect.ts (+3 строки, У-1). Отказ = снапшот из 7 метрик без CMND-признака и без перекрёстной валидации (ядро ГРАНИЦА-301 умирает).
3. **🔴 Точка входа экрана:** кнопка «🎤 Снять слепок» рядом с PitchTab-mic (v0, рекомендую) ИЛИ вкладка в Rehearsal-доке ИЛИ онбординг-шаг (здание «Комната пользователя», кадастр 707).
4. **🔴 Снос PitchTab-крыльев:** одним паком со слепком (рекомендую — крылья мертвы морально, вердикт-визуал переезжает) ИЛИ после стабилизации слепка (правило 200 13:35 «снос после контура замены»). Решение Босса.

---

## 7. АЛЬТЕРНАТИВА-Y (одна строка)

**Отвергнута: «обучаемая pitch-модель на юзере (CREPE-tiny/transfer-learning в браузере)»** — тяжёлый ML-пайплайн до фундамента противоречит директиве Никиты 02.09 00:25; снапшот из живых метрик даёт точку отсчёта в v0, модель — Этап-3 поверх накопленных данных.

---

*001 · Круг-3 · ФИНАЛ v1.0 · самодостаточно для 009 (судья) и Оператора: каждое решение = file:line/новый файл; 9 тестов поимённо; tsc-дельта ≤ +2. Все удары 002 внесены и помечены [002-У-N].*
