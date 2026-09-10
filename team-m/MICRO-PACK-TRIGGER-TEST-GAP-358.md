# MICRO-PACK-TRIGGER-TEST-GAP-358 v1.0 — тест-контракт stateful-ядра триггеров (detector 127 + service 231)

**Автор:** 003 (стратег пары, главный по достоверности ПУЛЬСа) · **HEAD:** `bf0203a` · **Дата:** 2026-09-10 21:2x
**Канон замерен ЛИЧНО на этом HEAD:** `tsc = 181` · `vitest 812/68 (68 файлов, 0 failed)` · `verify:events 32/32` — живой прогон 21:0x, не шапка §0.
**Статус:** спека-сырьё для цепи (001→002→009→Оператор). Не истина — материал для удара. **Тесты пишет Оператор, не 003.**
**Происхождение:** PA-8 атлас (10:5x) → консенсус пары 003/003_2 15:04 (предложение ① «общий приоритет») → финиш-карта ① 19:2x → GO Босса.

---

## §0 · ГЛАВНОЕ, ОДНОЙ СТРОКОЙ

**358 строк stateful-ядра триггеров (word-line.detector 127 + trigger-visual.service 231) работают на 60Hz с 0 юнит-тестов** — единственный непокрытый кусок trigger-семьи (805 строк): engine 45/bus 30/store 30/types 79 уже под тестами (`trigger.engine.test.ts` 77 строк покрывает engine; detector+service — нет). Это не «дописать тесты»: у ядра **4 контракта без формы** (discontinuity-reset, loop-wrap math, single-writer CSS-vars, fill-truth vs cue-truth) — тесты их зафиксируют ДО рефакторинга, не после.

## §1 · КАРТОЧКИ КЛЕЙМОВ

| # | Утверждение | Доказательство (команда + вывод) | Скоуп |
|---|---|---|---|
| **T-1** | Дыра = 358 строк | `wc -l src/triggers/detectors/word-line.detector.ts src/triggers/trigger-visual.service.ts` → 127 + 231 = 358 | HEAD `bf0203a` |
| **T-2** | Detector+service — ЕДИНСТВЕННЫЕ нетестируемые файлы семьи | `find src/triggers -name "*.test.*"` → только `__tests__/trigger.engine.test.ts` (77 строк, покрывает `trigger.engine.ts` 45 строк). Bus/store/types — файлы без тестов, но это тонкие обёртки (< 80 строк суммарно: bus 30 + store 30) | то же |
| **T-3** | Detector — stateful: 4 приватных поля + discontinuity-гвард | `word-line.detector.ts:8-12`: `_prevWordId/_prevLineIndex/_lastTime/DISCONTINUITY=0.5`; `:17-19` — `Math.abs(time - _lastTime) > 0.5` → `reset()` | чтение кода |
| **T-4** | Contract-1: DISCONTINUITY — seek/track-switch детектор | `:17-19`: прыжок времени > 0.5с сбрасывает стейт (иначе ложные word-end/line-end после seek) | чтение |
| **T-5** | Contract-2: fill-truth vs cue-truth — не комментарий, а выбор источника | `:60-63`: `ws.getFillWordForLine(lineIndex, time)` — слово по ЗАЛИВКЕ (не по cue); комментарий кода: «Trigger word FX should follow fill-truth, not cue-truth, otherwise progress and activation diverge» | чтение |
| **T-6** | Contract-3: событие word-end эмитится на КАЖДОЙ смене строки с живым словом | `:42-48` (line-переход сбрасывает `_prevWordId` с word-end) + `:68-84` (смена слова) + `:108-115` (слово исчезло) — три ветки, все обязаны эмитить word-end ровно один раз | чтение |
| **T-7** | Contract-4: TC-AUDIO-P3 — двойной clear (обе строки −1) = пропуск тика | `:26`: `if (lineIndex < 0 && this._prevLineIndex < 0) return` — guard от track-switch дублей | чтение |
| **T-8** | Service — lifecycle-owner планировщика + loop-wrap math | `trigger-visual.service.ts:25-35` (владелец PlaybackVisualScheduler), `:58-66`: `t = loopStart + ((t - loopStart) % range)` — math цикла, ошибки = дрейф слова на повторах | чтение |
| **T-9** | Contract-5: single-writer CSS-vars (3 шт.) + батч | `:19-23` (`--bl-word-active/-progress/-line-active`), `:107-109` через `queueCssVar` (батч), `:161-166`+`:186-191` — очистка по stop/track-change, `:226-228` — dispose снимает свойства | чтение |
| **T-10** | Contract-6: word-end НЕ чистит store (зазор-инвариант) | `:122-124`: «do NOT clear store — keep last word highlighted through gaps; word-start will overwrite; line-end/track-change will clear» | чтение |
| **T-11** | Contract-7: PROGRESS_STEP=0.03 — троттлинг прогресса | `:23,:126-129` — прогресс в store не пишется вообще (CSS-var only), троттлинг для внутреннего сравнения | чтение |
| **T-12** | Store-контракт: 4 поля пишутся, 1 сбрасывается пакетом | `:115-121` (word-start: id/text/confidence) · `:130-139` (line-start/line-end: triggerLineIndex) · `:192-198` (track-change: полный сброс 5 полей) | чтение |
| **T-13** | Хуки-входы для тестов БЕЗ реального аудио | `:208-210`: `playback-state-changed` (window) · `before-track-change` (document) · Ctrl+Shift+T — все три мокаются в jsdom | чтение |
| **T-14** | Ноль тестов подтверждён машиной | `find src/triggers -name "*.test.*"` → 1 файл (engine). `rg -l "word-line.detector\|trigger-visual" src --glob "*.test.*"` → пусто | HEAD `bf0203a` |

## §2 · ЧТО ТЕСТИРОВАТЬ (S1..S4, формат пары)

- **S1 · Discontinuity-контракт:** tick(t=10) со словом → tick(t=20) (прыжок >0.5с) → НЕТ ложного word-end/line-end (стейт сброшен до этого) · затем tick(20.01) — события идут с чистого листа.
- **S2 · Track-switch (TC-AUDIO-P3):** activeLineIndex=−1 дважды подряд → тик = пустой массив (guard `:26`); перед этим ровно ОДИН word-end/line-end на первом −1.
- **S3 · Event-order:** последовательность ticks {line-start → word-start → word-active → word-progress×N → word-end → line-end} — дискретные ровно 1 раз, гейты/continuous каждый тик; смена строки: word-end ПРЕЖДЕ line-end того же слова.
- **S4 · Loop-wrap (service):** reader при `loopEndTime < currentTime` → `ctx.currentTime = loopStart + ((t − loopStart) % range)` — слово НЕ дрейфует на повторе (детектор видит монотонное время внутри петли).
- **S5 (service, добавка от 358):** store-патчи по порогам (word-start пишет 3 поля; progress — НИКОГДА в store; track-change — полный сброс) + CSS-vars батч (3 значения writer'ом).

## §3 · КАК ТЕСТИРОВАТЬ (окружение, без браузера)

1. **Detector — чистый юнит:** `vi.mock('../../stores/wordSync.store')` + `lyrics.store` (`getState` → стабы), прямой `new WordLineDetector()`, цепочка `tick(t)` с ручным временем. Ничего DOM.
2. **Service — jsdom-хуки:** мок `PlaybackVisualScheduler` (register/unregister), `queueCssVar/clearQueuedCssVars` (спай на батч), `getTransport` (стаб currentTime/state), `acquire/release` (playback-orchestrator), `useTriggerStore` — реальный zustand store. `window.dispatchEvent(new CustomEvent('playback-state-changed', …))` — входы `:208-210` без аудио.
3. **70% → правило зоны:** глобальные моки (`audioContext`-класс) — только в `src/test/setup.ts` (уже есть); в файлах тестов — только модульные моки. По образцу `exercise.runtime.*.test.ts` (уже в репо, 10 файлов).

## §4 · ПРИЁМКА (гейты, воспроизводимы)

```bash
npx vitest run src/triggers          # Test Files ≥2, Tests = N passed (сейчас 1/77)
rg -c "DISCONTINUITY" src/triggers/detectors/word-line.detector.ts  # 2 (:12 объявление + :17 гард)
git diff --stat                       # только новые *.test.ts, 0 правок живого кода
```

**Критерий готовности:** S1-S5 зелёные, код ядра (358 строк) НЕ тронут (тесты поверх существующих контрактов), канон после — `tsc=181, vitest ≥ 812+новые`.

## §5 · ОГОВОРКИ (честный список)

- **Файлы ядра НЕ менять** — конверт только на тесты. Если S-сценарий вскроет БАГ ядра (например, word-end дублируется) — это ОТДЕЛЬНЫЙ MICRO-PACK (баг-репорт в цепь), не молчаливый фикс в этом же.
- `:74` V2-fallback (`window.audioEngine.getCurrentTime`) — тестировать как мок-ветку, не как контракт (V2-эра, носитель замещается).
- Detectors-папка может пополниться (drum-detection и пр.) — конверт скоупится на word-line (единственный живой детектор сейчас).

— 003 · конверт тест-дыры 358 · формат 005_2 по консенсусу пары · жду удара 002/009 и рук Оператора 🎼🫀
