# FULL REPORT → Ц3 (от 007) · V3 takes-playback + B/F-2 программа
_(полная версия: §4/§5 восстановлены после truncated-write; решения — релей 443: №17=Вар.B DECIDED, GO на B-slice)_

## 0. Статус майлстоуна
Цель ветки `V3-finish_2`: починить звук воспроизведения тейков в V3 + исполнить рулинги Ц3 (B-first-slice, F-2 v-Mix).
Текущий статус: диагностика N1 завершена; N2 и подсветка (TASK-009) **ПОЧИНЕНЫ с proof-of-change**; N3(β auto-advance на остановке записи) = продуктовый выбор **№17 на подпись**. Ожидаю решений Ц3 по №17 (A/B) и уточнения по №18.

## 1. Что сделано (с доказательствами)
### 1.1 C29–C33 (фаза «починить звук»)
- MicSourceV3, волна/декод, commit-on-interrupt, ctx из getAudioContext, no-op C33-гард.
- Коммиты: `3fe2620 fae1d65 28ae59e 97a99ed 888374f`. tsc 314 / vitest 749/749.

### 1.2 N1 — диагноз (439-REPORT-N1-RETEST)
- Звук НЕ пропадал из-за кода. Root = связка **N2** (stale `isReady`) + **N3** (auto-advance мешал прослушать тейк). Audio-path + lifecycle **HEALTHY** (юзер слышит голос: `[GEN-SRC-START] REACHED gain=1`).
- C33 HEALTHY — оставлена. TASK-002 (убрать stopPreview) **ОТКЛОНЁН** (нарушает B-инвариант «interrupt не гасит плейбек, который сам запустил»).

### 1.3 N2 (440-MICRO-PACK) — ПРИМЕНЁН + ВЕРИФ
- Root: `TakesControlStrip.tsx:38` подписан на функцию `getBlockTakes` → stale `isReady`. Фикс: сабскрипшн `blockTakesMap` (`:38`) + fallback (`:78`).
- Применён Оператором, tsc 314 / vitest 749/749. Юзер-ретест: голос есть. **RESOLVED-BY-440** (не C32; C32 = audioContext).
- COMMITS-REGISTRY: строка коммита обязана ссылаться на авторизацию Ц3 (релей 439: «N2 применяем немедленно»).

### 1.4 TASK-009 (441-MICRO-PACK) — ПРИМЕНЁН + PROOF CONFIRMED
- Root N9: `finishRecording` (`takes.store.ts:77-91`) НЕ выставляет `selectedSlot` → `isBest` ложно → тейк оранжевый после записи.
- Фикс: в `:88` добавлен `selectedSlot: meta.slot`. 1 строка. tsc 314 / vitest 749/749. FROZEN-вериф: затронут only `takes.store.ts` (не в §2.1 frozen: AudioEngineV2, patchV1, bridges/*, track.orchestrator, private _); `lyrics.bridge.ts`/`patchV1.ts` — только чтение (эталон-чек).
- **БРАУЗЕР-РЕТЕСТ юзера: зелёный best горит СРАЗУ при записи, без Play.** ✅ TASK-009 ЗАКРЫТ с proof-of-change.

### 1.5 (β) N3 эталон-чек V2 (frozen-read)
- V2-мосты (`src/bridges/lyrics.bridge.ts`, `src/audio/compat/patchV1.ts`) НЕ содержат авто-перехода после записи. Чтение только этих файлов; не правились.
- V3 auto-advance = `exercise.store.advanceToNextStep()` (V3-движок квестов) из `TakesControlStrip.tsx:365` (`handleIntermediateWindowEnd`), гейтнут `if (!exercise) return`.
- ВЫВОД: V2 оставался на блоке → «переход на след. блок» — **V3-introduced, НЕ регрессия** → №17 (продуктовый выбор на подпись).

## 2. Открытые решения Ц3
### 2.1 №17 (auto-advance на остановке записи)
- Юзер подписал desired: при **остановке записи** остаться на блоке, подсветить тейк (TASK-009 даёт зелёный best), дать проиграть. **БЕЗ прыжка на след. блок.**
- 442-MICRO-PACK (DRAFT) — 2 варианта:
  - **Вар.A**: убрать `advanceToNextStep()` в `handleIntermediateWindowEnd` (:365). Риск: упражнения/квест не пойдут по шагам после записи тейка.
  - **Вар.B** (рекомендую): загардить по режиму — не переходить после записи в практике, сохранить explicit exercise-step progression.
- **НУЖЕН выбор Ц3: A или B.**

### 2.2 №18 «уровень минуса»
- Ц3 переспросил: запрос про опускание уровня — (а) плейбек тейка поверх программы (`attachProgramSource`-заглушка) ИЛИ (б) уровень музыки/инструментала в практике? Юзер ещё не дал строку. Жду для точного статуса.

## 3. Предложенная очередь (после решений Ц3)
`B-first-slice` (4 члена фасада `audioContext`/`isPlaying`/`setVocalsVolume`/`setInstrumentalVolume` + **ПРОДЛЕНИЕ** гарда `main.tsx:132-142` на volume-методы, НЕ дублирование в V2Adapter) → `F-2` (мик-маршрут `setMicEnabled` + v-Mix стерео-разводка ПО ЭТАЛОНУ V2 + реестр-дельта F5) → `MIC-УШИ-СЕССИЯ` (v-Mix L/R, самомонитор, solo-превью, vocal-fade, автопауза, N2/N3/TASK-009-ретесты, RTL-голос, П-8 №2, TRIM-BASIS full) → `425` (+G4) → `M3-GO`.

## 4. Комплаенс / админ
- **FROZEN не тронут** (только чтение bridges/patchV1). Правились: `takes.store.ts`, `TakesControlStrip.tsx` (N2) — не frozen.
- Тесты: канон tsc 314, vitest 749/749. (2 legacy-файла падают на загрузке из-за предсущ. `TS2307` — в каноне, не наш скоуп; атрибуция в след. релее.)
- **Push/деплой 🔒** — только по команде. Local commit `022e53e` (C⁺ trace + agent-registry). Незакоммиченные правки: N2 (440) + TASK-009 (441) + pack-файлы 439/440/441/442.
- _(push-канал: готовность не отражается в отчёте per норму §4б; push 🔒 вне плана)_.
- CORS `belive-feed-bot.nikitosss007.workers.dev` — известный backlog (CatalogContent.tsx:117), не в скоупе раунда.

## 5. Что нужно от Ц3
1. **Выбор №17: Вар.A или Вар.B.**
2. **Статус №18** (после строки юзера).
3. **Go на следующий слайс (B-first-slice)** после закрытия №17.
