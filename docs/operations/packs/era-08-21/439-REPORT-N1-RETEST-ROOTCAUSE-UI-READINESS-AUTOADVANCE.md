# 439-REPORT — N1 RETEST: take-silence root cause

**Дата:** 2026-08-21 · **Агент:** 007 (координатор) · **Статус:** REPORT FOR Ц3 (без правок)
**Ветка:** `V3-finish_2` · **Коммит трейса:** `022e53e` (C⁺ trace, 438-MICRO-PACK-C-PLUS-TRACE)
**Режим:** `VITE_ENGINE=v3`, браузерный ретест юзером (юзер — единственный браузерный тестер)

---

## ⚡ VERDICT FOR Ц3 (кратко)

| Гипотеза | Статус по ретесту |
|---|---|
| **N1 = lifecycle race** (437: interrupt гасит превью) | ❌ **ОТВЕРГНУТА** — `GEN-GUARD:133 PASS`, `GEN-SRC-START REACHED`, source.start реально вызван |
| **N1 = audio-path** (006 TASK-002: offset/ctx/buffer) | ❌ **ОТВЕРГНУТА** — gain=1, startOffset≈3.0s валиден, звук СЛЫШЕН юзером |
| **N1 = UI-readiness** (N2: слот `isReady=false` до ре-рендера) | ✅ **ПОДТВЕРЖДЕНА браузерно** — клик до `isReady=true` = тихой no-op |
| **N3 = auto-advance после записи** (новый баг) | ✅ **ВПЕРВЫЕ ЗАФИКСИРОВАН** — после блока UI уходит на след. блок, тейк не показан |

**Итог:** N1 («клик по тейку — тишина») = НЕ audio и НЕ lifecycle. Это **симптом связки N2 (stale `isReady`) + N3 (auto-advance прячет тейк)**.
Audio-path и lifecycle-гард **здоровы** — когда слот `isReady=true`, клик играет звук (юзер подтвердил).

---

## 1. Что ПОДТВЕРЖДЕНО РАБОТАЮЩИМ (позитив)

- **Запись тейка работает:** волна рисуется, буфер захвачен.
  `TakesPanel.tsx:648 [TakesCanvas] Instrumental buffer ready: {duration: 175.53, sampleRate: 48000, length: 8425600}`
  Юзер: «всё пишется, всё отлично, волна рисуется».
- **Воспроизведение тейка работает (когда слот готов):** юзер слышит запись после Space+клик.
  Трейс:
  ```
  TakeSlot.tsx:39 [TAKE-CLICK] slot=0 isReady=true isThisRec=false exercisePlaybackLocked=false
  useTakesPlayback.ts:12 [GEN-BUMP] tag=handlePlayTake-start val=6   (TakesControlStrip.tsx:776 → exercise.interruption.ts:18)
  useTakesPlayback.ts:118 [PLAY-TAKE] enter takeId=take-auto-block-0-0 gen=6
  useTakesPlayback.ts:146 [GEN-GUARD:133] PASS gen=6
  useTakesPlayback.ts:217 [GEN-SETTLE] gen=6 cur=8 (C33 no-op guard, kept benign)
  useTakesPlayback.ts:226 [GEN-SRC-START] REACHED startOffset=3.006 gain=1 gen=6 cur=8
  ```
  → `source.start()` ВЫЗВАН, gain=1, offset валиден. Звук пошёл.

## 2. Арбитраж N1 (lifecycle vs audio-path) — ОБЕ ОТВЕРГНУТЫ

Критерий из 438: `[GEN-SRC-START]` ЕСТЬ → audio-path гипотеза; guard PASS → lifecycle гипотеза отвергнута.
Трейс показывает **ОБА** маркера успеха при `isReady=true`. Значит:
- Lifecycle-гард `GEN-GUARD:133` **PASS** (interrupt НЕ мешает проигрыванию — `handlePlayTake` захватывает `gen`, и даже последующие `stopPreview`-бампы до cur=8 не мешают, т.к. guard `gen <= cur`).
- Audio-path **здоров**: `gain=1`, `startOffset≈3.0s`, буфер 175.5s, юзер СЛЫШИТ.
- Следовательно рекомендация 006 TASK-002 («не звать stopPreview в usePracticeInterrupt:101») **НЕ НУЖНА и вредна** (нарушила бы B-инвариант: interrupt не должен пускать превью во время записи). 006 ошибся в root-cause для N1.

## 3. РЕАЛЬНЫЙ root — N2 (stale `isReady`), ПОДТВЕРЖДЕНО браузерно

Клик ДО готовности слота = тихой no-op (handlePlayTake не входит):
```
TakeSlot.tsx:39 [TAKE-CLICK] slot=0 isReady=false isThisRec=false exercisePlaybackLocked=false
   ... (нет [PLAY-TAKE] enter) ...
TransportV3.ts:136 [TRACE] play() return: state not ready/paused {state: 'playing'}   ← no-op
```
Только ПОСЛЕ Space (форсированный ре-рендер) слот становится `isReady=true` и PLAY-TAKE срабатывает.
Это **точно совпадает** с 006 TASK-004: `TakesControlStrip.tsx:38` сабскрайбит **ФУНКЦИЮ** `getBlockTakes` (стабильная ссылка) → компонент не ре-рендерится при коммите тейка → `isReady` stale до внешнего пуша (Space/keyboard).
**Готовый микро-фикс (от 006, ждёт Ц3):** сабскрайб `blockTakesMap[activeBlockId]` вместо `getBlockTakes`.

## 4. НОВЫЙ баг N3 — auto-advance после записи (фиксируется ВПЕРВЫЕ)

Поведение юзера: после записи блока UI **автоматически переходит на следующий блок** («3,2,1, начиная писать» следующий), тейк записанного блока **не показан сразу**; чтобы услышать, надо вернуться на блок, нажать Space (N2-триггер ре-рендера), затем кликнуть.
Ожидаемое (юзер): после записи — **остаться на блоке, сразу показать записанный тейк**, не переключаться.
Трейс указывает на авто-переход через practice-session interrupt / block-transition:
```
RehearsalLyrics.tsx:498 [PS Travel] Trigger fired {nextBlockId: 'auto-block-1', ...}
WagonTrain.tsx:98 / :86 / :147  (в стеке exercise.interruption.ts:79)
TakesControlStrip.tsx:325 [Takes] Recorder armed early, visible REC started at engine time: ...
```
Подозреваемые: `exercise.interruption.ts` (block-advance после записи), `WagonTrain.tsx` (auto-advance), `RehearsalLyrics.tsx` ([PS Travel] transition). **Требует решения Ц3** (приоритет N3 vs N2, и где резать auto-advance).

## 5. Статус C33 (no-op guard)

`GEN-SETTLE gen=6 cur=8 (C33 no-op guard, kept benign)` + `GEN-ONENDED BAIL gen=6 cur=10` — гард ведёт себя корректно (bail, когда более новый gen перекрыл). **Оставить как есть** (Ц3 ранее отклонил C33 как вакуум, но трейс подтверждает: он benign, не мешает). Пересмотр решения Ц3 не нужен, но зафиксировано как HEALTHY.

## 6. Побочные наблюдения (вне scope N1)

- `CatalogContent.tsx:117 GET https://belive-feed-bot.../tracks` → **CORS error** (`Access-Control-Allow-Origin: https://app.mybelive.com` ≠ `localhost:3000`). Каталог треков не грузится локально. Отдельный баг, НЕ влияет на N1/takes. Отметить Ц3 для backlog.

## 7. Рекомендация Ц3 (disposition)

1. **Переименовать N1** в «take not immediately playable after record» = связка **N2 (UI-readiness) + N3 (auto-advance)**. Audio/lifecycle закрыть как HEALTHY.
2. **N2** — микро-фикс готов (006 TASK-004), proof-of-change: после фикса `[TAKE-CLICK] isReady=true` появляется СРАЗУ после коммита записи (без Space), PLAY-TAKE на первом клике. Ждёт слота в B-first-slice или отдельный micro-pack.
3. **N3** — нужно архитектурное решение Ц3: где останавливать auto-advance после записи и сразу рендерить тейк. НЕ микро-фикс (поведение квеста).
4. **C33** — оставить (benign). 006 TASK-002 микро-фикс (убрать stopPreview) — **отклонить** (нарушает B-инвариант, и не нужен по трейсу).

## 8. Acceptance / proof-of-change (для будущей правки)

- ДО фикса: клик по свежезаписанному тейку → `[TAKE-CLICK] isReady=false` → тишина; нужен Space+возврат.
- ПОСЛЕ фикса N2: клик сразу после записи → `[TAKE-CLICK] isReady=true` → `[PLAY-TAKE]` → `[GEN-SRC-START] REACHED gain=1` → звук. Без Space, без возврата на блок.
- ПОСЛЕ фикса N3: после записи блока UI остаётся на нём, тейк виден и кликабелен.

## 9. Appendix — ключевые теги трейса (полный дамп у юзера)

```
[TAKE-CLICK] slot=0 isReady=false  → нет PLAY-TAKE (N2: stale)
[TAKE-CLICK] slot=0 isReady=true   → [PLAY-TAKE] enter gen=6 → [GEN-GUARD:133] PASS → [GEN-SRC-START] REACHED gain=1  ✅ звук
[GEN-SETTLE] gen=6 cur=8 (C33 benign)
[GEN-ONENDED] BAIL gen=6 cur=10 (корректный supersede)
[PS Travel] Trigger fired nextBlockId:'auto-block-1'  → N3 auto-advance
```

**FROZEN-чек:** в отчёте НЕТ ссылок на frozen-файлы (AudioEngineV2/patchV1/bridges/track.orchestrator/_). Затронуты: TakesControlStrip.tsx, exercise.interruption.ts, WagonTrain.tsx, RehearsalLyrics.tsx, useTakesPlayback.ts — все НЕ frozen.
