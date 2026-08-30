# 437-REPORT — N1 (звук тейка) НЕ закрыт ушами: C33 оказался сломанным no-op, гонка жива

**Дата:** 21.08.2026 · **Автор:** 007 · **Ветка:** V3-finish_2 · **Канон А4:** tsc 314 / vitest 749-749 (2 legacy file-load) — НЕ нарушен
**Статус N1:** 🔴 OPEN (юзер после C33: «нет звука у записи! только волна!»)

---

## TL;DR для Ц3
1. **C33 не починил баг.** Его «re-acquire gen после await» — синтаксический no-op (`const settleGen = previewGenRef.current; if (settleGen !== previewGenRef.current) return;`). Гонка, убившая `source.start`, жива. Доказано через `git show 888374f`.
2. **Запись здорова** — рекордер v3 пишет тот же `MicSourceV3`-стрим, что даёт живую волну. Блоб гарантированно с голосом; волна слота = реальные декодированные пики. Тишина — исключительно в плебэк-пути `useTakesPlayback.ts`.
3. **Корень тишины — архитектурный, не «одна строка»:** клик по тейку в квесте идёт через `interruptPracticeSession` → зарегистрированный хендлер (`usePracticeInterrupt`) → `stopPreview()`, который **бампит `previewGenRef` И дёргает `previewSourceRef.current?.stop()`**. Это конфликтует с собственным жизненным циклом плебэка тейка.
4. `V2Cage re-zero` из свежего лога юзера — **НЕ причина** тишины тейка (v3-фасад-заглушки no-op'ают `setInstrumentalVolume/setVocalsVolume`, тейк не маршрутизируется через них), но станет риском в B-first-slice.
5. **Ц3 должен решить:** докрутить C33 (дёшево, но может не до конца) ИЛИ правильно развязать lifecycle тейка и interrupt/commit ИЛИ санкционировать 5-мин ре-трейс для точного подтверждения точки гибели `source.start`.

---

## 1. Полная сага C29–C33 (аудит завершённых коммитов)
| # | Коммит | Что сделано | Статус канона |
|---|--------|-------------|---------------|
| C29 | `3fe2620` | F-1: acquisition-слой `MicSourceV3` (R9, parity C11 deviceId, refcount+dispose-tracks), takes-ветка v3, error-UX бейдж, mic-select разблокирован | ✅ 314 / 749 |
| C30 | `fae1d65` | F-1.5: волна трека в Quest из v3-стемов + декод тейков на `getAudioContext()` (3 сайта) | ✅ |
| C31 | `28ae59e` | F-1.6: commit-on-interrupt — прерванная запись коммитится через `handleStop`, не `cancel` (тейк терялся на границе блока) | ✅ |
| C32 | `97a99ed` | F-1.7: ctx плебэка из `getAudioContext()` вместо отсутствующих `ae.audioContext/_audioContext` v3-фасада (тихий return → тишина) | ✅ |
| C33 | `888374f` | F-1.8: «re-acquire previewGenRef после await» + кламп startOffset | ⚠️ **СЛОМАН** (см. §2) |

Подтверждено юзером: запись работает, волны (трек+живые) видны, тейк сохраняется после автоперехода (C31).

## 2. ДОКАЗАТЕЛЬСТВО дефекта C33 (цитата `git show 888374f`)
```diff
-      if (gen !== previewGenRef.current) return;          // ← РЕАЛЬНЫЙ гард (старый gen)
+      // F-1.8: re-acquire gen AFTER the interrupt-commit settle...
+      const settleGen = previewGenRef.current;
+      if (settleGen !== previewGenRef.current) return;     // ← NO-OP: settleGen ВСЕГДА === previewGenRef.current
```
**Следствие:** строка 202–203 в `useTakesPlayback.ts` никогда не возвращает. Ген, использованный для финального `source.start` (`:212`) и `onended` (`:215`), — всё тот же СТАРЫЙ `gen` из `:109`. Рабочий гард на `:133` (`if (gen !== previewGenRef.current) return;`) по-прежнему бьёт `return` при бампе gen'а во время декода. **Гонка не устранена.**

## 3. Корень тишины — lifecycle-гонка (а не отсутствие ctx/connect)
Цепочка при клике по тейку в активном квесте:
```
TakeSlot.handleClick → exercisePlaybackLocked → onPlay(=interruptPracticeSession(() => handlePlayTake))
  → interruptPracticeSession (exercise.interruption.ts:84-91): дёргает ВСЕ зарегистрир. хендлеры
      └─ usePracticeInterrupt (usePracticeInterrupt.ts:102/115) → stopPreview()
            ├─ previewGenRef.current++            (БАМП)
            └─ previewSourceRef.current?.stop()    (остановит источник, если уже создан)
  → action = handlePlayTake: stopPreview() (ещё бамп) → ++gen → decode await → :133 guard бьёт return при бампе
```
- Трейс **435b** (до C33) зафиксировал именно это: `TakeSlot.click{isReady:true}` → `transport.play()` → **НЕТ `source.start`** → return на старом gen-гарде.
- C33 должен был «перехватить gen ПОСЛЕ оседания interrupt-commit», но реализовал no-op (§2). Источник так и не стартует (холодный плебэк) либо стартует и тут же гасится `stopPreview` из хендлера (если бамп приходит после создания source).

**Вывод:** плебэк-путь технически корректен (gain=1.0 по умолчанию, `source.connect(gain)→ctx.destination`, offset клампнут в `[0,bufferDur)`). Единственное, что мешает звуку — гонка gen'а/остановки с машиной interrupt/commit.

## 4. Запись — ВНЕ подозрений (доказано чтением `takes.recorder.ts`)
- v3-ветка (`:73-88`): стрим из `(window.__belive.micSource).acquire()` = тот же `MicSourceV3`, на котором висит `AnalyserNode` живой волны (юзер видит движение при пении ⇒ стрим НЕ пустой).
- `MediaRecorder(stream)` (`:119`) пишет **тот же** стрим ⇒ блоб с голосом.
- C30 декодит блоб на синглтоне `getAudioContext()` ⇒ волна слота = реальные пики (не flat).
- ⇒ Тишина НЕ от «запись тишины» и НЕ от «блоб пустой».

## 5. V2Cage re-zero — НЕ причина, но B-slice риск
Свежий лог юзера: `[V2Cage] Re-activating — re-zero V2 gains`. В v3 `V2AudioCage._zeroAllVolumes` идёт через `V2Adapter.delegateSync` → `window.audioEngine` = v3-фасад, где `setInstrumentalVolume/setVocalsVolume` — **заглушки (no-op)** (B-first-slice ещё не применён). Тейк-плебэк не вызывает эти сеттеры. ⇒ на текущий симптом не влияет.
**Риск:** когда B-first-slice оживит фасад, `_zeroAllVolumes` реально замьютит стемы v3 → нужен гард `delegateSync` по `__v3Active` (уже в scope B-slice).

## 6. Сопутствующие (статус неизменен)
- **N2** (тейк не виден до пробела): слот перерисовывается по play-state, не по данным. Микро-фикс, локация слота не найдена. Ждёт Ц3.
- **N3** (v-Mix): атрибуция — `ControlDeck:327/334` `enableVocalMix()/disableVocalMix()` + early-return `:329-333`, НЕ `setVocalsVolume`. В scope B-first-slice.
- **B-first-slice**: аудит готов — 5 членов фасада + ControlDeck early-return + `__belive.transport` + гард `delegateSync __v3Active`. ЖДЁТ закрытия N1.
- **F-2** (мик-ухо): разведка ЗЕЛЁНАЯ — применять ПОСЛЕ B-slice.

## 7. РЕШЕНИЯ для Ц3
**Опция A — докрутить C33 (минимальный микро-фикс, НЕ мной).** Заменить no-op на корректный re-acquire:
```ts
const settleGen = previewGenRef.current;   //捕获 ПОСЛЕ оседания interrupt
if (settleGen !== gen) return;             // легитимный stale-bump от commit → не играем
// далее использовать settleGen для source.start и onended
```
Риск: не устраняет случай, когда `stopPreview` хендлера останавливает уже созданный source (нужна правка `usePracticeInterrupt`, чтобы не гасить активный плебэк тейка).

**Опция B — развязать lifecycle (архитектурно верно).** `usePracticeInterrupt` не должен звать `stopPreview()` плебэка, если играет именно тейк; либо `interruptPracticeSession` не должен коммитить/гасить плебэк при клике на тейк. Требует решения Ц3 о границе ответственности.

**Опция C — ре-трейс (5 мин, Оператор).** Вернуть 3 целевых лога в `handlePlayTake`: `source.start reached?`, `startOffset=`, `gain=`, плюс маркер клика в `TakeSlot.handleClick`. Подтвердит, доходит ли до `:212` после C33 и на чём именно гибнет. Рекомендую ДО любого фикса, т.к. слепые итерации уже сожгли C29–C33.

## 8. Рекомендация 007
Эскалирую к Ц3 без самодеятельности (007 код не пишет). Прошу Ц3 выбрать **A/B/C**. Личная рекомендация: **C → (A или B)** — сначала 5-мин ре-трейс, чтобы перестать гадать, затем целевой фикс. B-first-slice и F-2 держим в буфере до закрытия N1.

---
*Пак: 007_08.08/437-REPORT-C33-BROKEN-FIX-TAKE-SILENCE.md · TSC-LEDGER обновлён (C29–C33 + дефект C33).*
