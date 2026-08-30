# 446-REPORT · №17-B2 ПРИМЕНЁН + А1/А2/А4 ОТВЕТЫ → Ц3

## №17-B2 — ПРИМЕНЁН (Оператор, 445-MICRO-PACK)
- `src/foundation/event-bus/wrappers/exercise-events.ts:37-40` удалён (блок `recording → completed step`). Сохранено нетронутым: `:18-24` (Track before-change `onStepCompleted`), `:32-35` (`pre-recording → recording` setPhase), `:42` (`prevIsRecording = isRecording`).
- `tsc --noEmit` = **314** (diff IDENTICAL) · `vitest` **files 61/63** (2 legacy load-error), **tests 749/749**.
- **Урок 442 (петка-норма #3, поведенческая) применён:** перед вырезом `grep onStepCompleted/advanceToNextStep` перечислил ВСЕ живые коллеры — `:23` (Track before-change, НЕ трогать, отдельный скоуп), `:39` (recording-stop = цель B2), `TakesControlStrip.tsx:365` уже удалён 442. Вырезан только `:39`.
- **Proof-of-change (гейт Ц3, ОБЕ половины) — ЗА ЮЗЕРОМ:** (1) запись → стоп → UI остаётся на блоке, зелёный best горит, тейк играется кликом; (2) пошаговая прогрессия квеста БЕЗ записи работает (ExerciseStrip:107 / skipStep). Коммит НЕ делался — ждём browser-proof.

## А1 (busVol) — ОТВЕТ, ЧТЕНИЕ V2 (frozen-read ✅)
- V2 `AudioEngineV2.ts:1154`: `effectiveGain = effectiveMute ? 0 : stemVolume * busVolume`. **bus-множитель ЕСТЬ.**
- `_busVolumes: Partial<Record<RoutingTarget, number>>` (:118). `setBusVolume(busId, vol)` (:1059) пишет `_busVolumes[busId]` + пересчёт всех стемов шины через `_applyEffectiveGain`.
- busId из роли: `busId = role ? ROLE_ROUTING[role] : 'music-bus'` (:1152); `isMusicStem = stemId !== 'instrumental' && stemId !== 'vocals'` (:890). ⇒ все music-стемы (bass/drums/guitar/keys/other) висят на шине → их громкость = `stemVolume × busVolume`.
- Инструментал в V2 = master-clock, гейн через `masterVolumeGain` (не gainNode, invariant A2.25, :1156-1158); music-стемы идут через шину с bus-множителем.
- **V3 ПОТЕРЯЛ bus-множитель:** `HybridPipelineService._applyEffectiveGain:560` → `_effectiveGainOf:552` = `muted || !audible ? 0 : raw`. **НЕТ × busVolume.** Подтверждает гипотезу Ц3: V3 при переносе утратил шину → красный фейдер (`setInstrumentalVolume`, no-op фасада при стемах, MX-01/TASK-008) бьёт по «мёртвому» слою.
- **ВЫВОД А1:** №18 = **восстановление паритета V2**, НЕ новая фича. Красный фейдер (предложение юзера) = шина music-стемов, аналог V2 `music-bus` busVolume. Спека №18-BUS (Ц3 §2) корректна: нода `instrumentalBusGain` после `stretchGain` + тап метров, до `mergeGain`, только music-стемы, вокал exempt. 006 (frozen-read) при F-2 уточнит точное V2-маппирование фейдер→шина, но принцип (bus-множитель существовал, V3 потеряла) доказан.

## А2 (chainA double-application после C27)
- Подтверждено (C28/C32): `chainA.soloStem` → легаси `_applySolo` стомпит volume всем, следом пересчёт тем же тиком (benign-same-tick). Предложение 3-строчного cleanup (C32 line 60) — **входит в B-first-slice** (`_applySolo-cleanup`, очередь Ц3). Закрывается в B-slice, не блокирует.

## А4 (канон vitest-формулировки)
- Зафиксирован навсегда: **«tests 749/749, files 61/63 (2 legacy load-error)»**. Применён в 444 и 445. Далее — только эта форма в дифф-чеках.

## Очередь (от 007)
1. №17-B2: ждём browser-proof обеих половин → затем коммит (local, push 🔒).
2. B-first-slice (4 члена фасада + продление гарда main.tsx:132-142 на volume + аудит вызовов + _applySolo-cleanup [=А2] + А1/А4 учтены).
3. F-2: мик-маршрут (G14: 0мс) + v-Mix стерео-разводка по эталону + **№18-BUS по эталону V2 (А1 подтверждён: restore bus multiplier)** + персистентность (F-1) + реестр-дельта.
4. MIC-УШИ-СЕССИЯ: живая проверка №18 (красный фейдер реально опускает music-стемы) + v-Mix + №17-ретест.

## Комплаенс
№17-B2 / F-2 — не frozen; эталон-чёки — frozen-чтение ✅. push/деплой 🔒. 008-vision — observations + user quotes only (governance Ц3 соблюдён).
