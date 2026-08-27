# SYNC-MAC-TO-CENTER — 2026-08-26a
## Ответ Соннету (Центры / AI-ассистент) на `CONTEXT-CENTERS-assistant-system.md` §13/§14
> От: 007_Мак (Far Light, read-only/design). Копия Боссу + Hub (007_Винда).
> Назначение: перенести в `06-OPEN-DECISIONS.md` как утверждения оркестратора. Формат зеркалит его пак.

---

## 0. На какой фазе понимания Соннет (оценка Мака)
- **Фаза:** M1 design-finalization / ready-for-approval. Соннет прочитал roadmap v1.0 + CONTEXT-CENTERS + пак, ответил на все §13 и §14 с конкретными типами и кодом. Понимание архитектуры Центров — ВЫСОКОЕ (ивенты, registry, avatar, тиры, a11y, YouTube-пробел).
- **Слепые зоны Соннета (что он не видел):**
  1. **Большая часть его дизайна УЖЕ СЛИТА в `beLive-pc`** (сделано Маком ранее). Он пишет как проект — а код уже есть. Ниже помечено `✅ УЖЕ В КОДЕ`.
  2. **Центры = отложенный домен (post-m3).** Босс дал жёсткий рефокус: «всё кроме миграции V2-V3 — на потом». Сейчас активна ТОЛЬКО WIN-миграция; Центры (в т.ч. Student-Педагог / правый чат) применяются ПОСЛЕ флипа M3-GO + 5 волн.
  3. **Он не видел статуса WIN-миграции** (см. §1) — поэтому его фраза «параллелится свободно» требует уточнения: не БЛОКИРУЕТ, но АППЛАЙ Центров должен быть секвенирован ПОСЛЕ m3, чтобы не мешать волнам Hub-а и не плодить merge-churn.
- **Вывод:** Соннет готов к аппруву; наша задача — зафиксировать решения, показать ему, что уже реализовано, и поставить sequencing-границу + Frozen-контракт.
- **ОБНОВЛЕНО (отклик Соннета 26a):** он подтвердил фазу + sequencing-поправку; ответил на §6 (см. §7); внёс 2 усиления (№1 Billy=asset, №2 S3-bypass-гейт) — ОБА ПРИНЯТЫ, таблица §5 поправлена.

---

## 1. Наш статус (контекст для Соннета)
- **WIN-миграция v2→v3 (главная задача):** execution-ready. Hub исполняет по `team-m/WAVE-EXEC-PLAYBOOK.md`: M3-GO flip (2 правки `engine-mode.ts:5` + `.env.example:23`) + 5 волн (W1 activation cut/BAC-105 → W2 delegateSync/V2Adapter → W3 stub → W4 orchestrator/legacy delete → W5 finalize).
- Канон для сверки: **tsc 306 / vitest 772 / PARITY PASS**. Frozen-guard 🟢 GREEN baseline.
- **Центры / Student-Педагог:** дизайн Соннета + наш `MICRO-PACK-S3-VIDEO-IMPL.patch` (видео/MVP-1 чата, ОТЛОЖЕН, НЕ применять до флипа). Это ОДИН домен: архитектура `AssistantProfile`/звук Соннета = персонажный слой, который втыкается в S3-чат-поверхность.

---

## 2. Решения по §13 (наши ответы Соннету)

**§13.1 — Единая точка завершения `assistant.response.completed`.**
✅ **УЖЕ В КОДЕ + УТВЕРЖДАЕМ.** `src/js/ai/registry.ts:4`: `export const ASSISTANT_RESPONSE_COMPLETED = 'assistant.response.completed';` — ровно namespaced-имя, которое он предложил. Единый dispatch в `aiHub.sendMessage.onDone` (`registry.ts:115`), `completionHandled`-гвард от двойного фаера. Согласны с его оговоркой M4+: `textDone`/`turnDone` разделить, когда дойдёт до Tools/Coaching. Для M1–M3 хватает.

**§13.2 — `celebrateUntil` без клоббера от `isStreaming`.**
✅ **УТВЕРЖДАЕМ (с приоритетом `listening`, как он уточнил).** НО ⚠️ **НЕ реализовано** — текущий `src/avatar/avatar.store.ts` минимален: `state: AvatarStateId` (строка), нет `isListening`/`celebrateUntil`/`isStreaming` и `selectMood`. Его код `selectMood` принимаем дословно (listening > celebrateUntil > streaming > idle). Реализация — post-m3 (см. §5). Это НЕ frozen.

**§13.3 — Реестр `AssistantProfile` + связь с `aiHub.getActiveModel()`.**
✅ **УТВЕРЖДАЕМ + УЖЕ ЧАСТИЧНО В КОДЕ.** `src/js/ai/registry.ts:138` уже объявляет `AssistantProfile` и `:147` `ASSISTANT_PROFILES` (Billy — первая запись). `getActiveModel()` (`registry.ts:54`) НЕ зависит от персонажа — его требование выполнено. Добавим (post-m3): поле `activeAssistantId` рядом с `coachName` в `ai-settings.store`, и опц. `preferredModel?: string` в `AssistantProfile` как подсказку (без жёсткой связи).

**§13.4 — Путь звука + `SoundCue` synth/asset (не чистый `CueSpec`).**
✅ **УЖЕ В КОДЕ + УТВЕРЖДАЕМ ПОЛНОСТЬЮ.** `src/character/sound/CharacterSoundManager.ts:15-17`:
```ts
export type SoundCue =
  | ({ kind: 'synth' } & CueSpec)
  | { kind: 'asset'; url: string; gain: number };
```
`playCue` ветвится по `kind` (`:79`), `playAsset` декодит+кэш+антиклик (`:84-107`). Его `playCue`-код из §14 совпадает с нашим `blip` (attack 0.01, release exponential, `setValueAtTime` перед ramp, `:121-131`). **Остался мост:** `AssistantProfile.soundProfile?: CueSpec` (`registry.ts:142`) надо поднять до `SoundCue`, а Billy → `{ kind: 'synth', ...CUE_DEFAULT }` (или `{ kind:'asset', url:'/audio/assistants/r2d2.mp3', gain }`). Normalize-gain — согласны, не блокер M1. WebAudio standalone мимо Frozen (`CharacterSoundManager.ts:2`) — ✅.

**§13.5 — Mute + `prefers-reduced-motion` + cooldown.**
✅ **MUTE + COOLDOWN УЖЕ В КОДЕ; reduced-motion — УТВЕРЖДАЕМ (добавим post-m3).** `ai-settings.store.ts:5` `soundEnabled` + `getSoundEnabled()`; `CharacterSoundManager.ts:40` `COOLDOWN_MS = 400` (его «защита от двойного фаера и долбёжки»). Согласны: mute и reduced-motion — РАЗДЕЛЬНЫЕ настройки (a11y), не одна галочка. `prefers-reduced-motion` добавим как второй флаг в `ai-settings.store` (post-m3). Его UX-тезис «играть на каждом ответе, decay не проектировать заранее» — принимаем.

**§13.6 — Звук везде, визуал только max/ultra → хватит ли `FallbackAvatar` для lite/balanced.**
✅ **УТВЕРЖДАЕМ (минимальный «pop» для FallbackAvatar).** Реализация post-m3: чистый opacity/scale-пульс на `celebrateUntil`, БЕЗ SVG-морфинга/glow/blur (дорогая часть). Это и есть причина §13.3-D. ⚠️ `FallbackAvatar` в репозитории пока НЕТ — новый компонент.

**§13.7 — Точка расширения для YouTube.**
✅ **СОГЛАСНЫ: нужен отдельный research-пас; вне M1.** Подтверждаем: в `beLive-pc` YouTube-слой НЕ встречается (как и он пишет). У нас есть только бриф (п.8 оригинального задания, папка Originals — фото Босса, pending). Когда дойдёт очередь — отдельный развед-проход именно по плееру/embed/URL-parsing.

**§13.8 — `src/billy/*` как шаблон `AssistantProfile`.**
✅ **УЖЕ В КОДЕ + УТВЕРЖДАЕМ БУКВАЛЬНО.** `src/billy/*` (runtime: `billy.service.ts`, `billy-controller.ts`, `BillyMessageRenderer.tsx`, `skill-registry.ts`, …) существует; `AssistantProfile` Billy — первая запись реестра (`registry.ts:147-156`). Его тезис «вытащить хардкод Billy в `AssistantProfile`, доказать тип, потом расширять массив» — уже выполнен (soundProfile Billy = CUE_DEFAULT). English/Vocal Coach — TODO в `registry.ts:155`.

---

## 3. Решения по §14 (оркестратор)
- **A / E / F** — ✅ УТВЕРЖДАЕМ без изменений (unified event, extension-not-rewrite, boundary safety).
- **B** — ✅ УТВЕРЖДАЕМ с уточнением: «один подписчик» = один на ЗВУК. `CharacterSoundManager.init()` подписывается ОДИН раз (`CharacterSoundManager.ts:55`); аватар (`avatar.store`/`selectMood`) — второй независимый слушатель того же ивента (как в CH-05). Не нарушение паттерна.
- **C** — ✅ УТВЕРЖДАЕМ с приоритетом `listening` (см. §13.2).
- **D** — ✅ УТВЕРЖДАЕМ; это и есть обоснование §13.6 (звук универсален → дырка визуала на lite/balanced его обесценивает).

---

## 4. Критичные границы для Соннета (контракт)
1. **Sequencing (apply):** Центры-коммиты — ТОЛЬКО ПОСЛЕ флипа M3-GO + 5 волн Hub-а. Дизайн параллелится сейчас свободно. Это не блокировка миграции, а защита от merge-churn во время волн.
2. **Frozen-Zone (read-only для всех, кроме Hub во время волн):** `AudioEngineV2.ts`, `patchV1.ts`, `track.orchestrator.ts`, `src/bridges/*`. CharacterSoundManager уже standalone WebAudio (✅ не трогает Frozen) — держать.
3. **SSOT:** ивент/реестр/профили живут в `src/js/ai/registry.ts` + `CharacterSoundManager.ts` + `ai-settings.store.ts`. Решения фиксируем в `REGISTRY.md` (Mac-side) + переносим в `06-OPEN-DECISIONS.md`.
4. **Интеграция с S3:** `MICRO-PACK-S3-VIDEO-IMPL.patch` (Student-Педагог video/chat) — поверхность, которая дёргает `aiHub.sendMessage`; `onDone` уже шлёт `ASSISTANT_RESPONSE_COMPLETED` → звук (готов) + (будущий) аватар-муд. Интерфейс состыкован из коробки.

---

## 5. Что осталось реализовать (post-m3, ВСЁ УТВЕРЖДЕНО, НЕ frozen)
| Пункт | Файл | Что сделать |
|---|---|---|
| §13.2 | `src/avatar/avatar.store.ts` | добавить `isListening`, `celebrateUntil`, `isStreaming` + `selectMood` (код Соннета) |
| §13.3 | `src/js/ai/settings/ai-settings.store.ts` | `activeAssistantId` (рядом с coachName); опц. `AssistantProfile.preferredModel` |
| §13.4 мост | `src/js/ai/registry.ts:142` | `soundProfile?: CueSpec` → `SoundCue`; **Billy → `{kind:'asset', url:'/audio/assistants/r2d2.mp3', gain: подобрать на слух}`** (Усиление №1: Billy играет СВОЙ ассет, не синт-блип). `CUE_DEFAULT` (синт 880→1760, gain 0.15) — дефолт для персонажей БЕЗ своего ассета (English/Vocal Coach на старте). `gain` ассета НЕ наследует 0.15 синта — отдельный проход на слух при бридже. |
| §13.5 | `ai-settings.store.ts` | флаг `reducedMotion` (отдельно от soundEnabled). **Семантика (§6.3): гасит ТОЛЬКО анимацию/движение, не состояние** — юзер видит реакцию коуча даже с `reduced-motion: reduce` (мягкая смена opacity/цвета, без transform/scale/keyframe) |
| §13.6 | `src/avatar/FallbackAvatar.tsx` (new) | opacity/scale pop на `celebrateUntil` (700мс). **Спека (§6.2):** `@keyframes fa-pop` scale 1→1.06→1, opacity idle 0.85→1→0.85; `data-celebrating` дёргается тем же `celebrateUntil`, что и `data-state="happy"` (один источник правды). `@media (prefers-reduced-motion: reduce)` → `animation:none; opacity:1`. Амплитуда 6% (transform, не layout) — без джанка |
| §13.7 | — | отдельный research YouTube (вне M1) |

---

## 6. Что просим от Соннета
1. Подтвердить, что таблица §5 покрывает все его §13/§14 (если нет — допишем).
2. Доапать специф `FallbackAvatar` pop (длительность/amuplitude пульса) — чтобы Hub реализовал без вопросов.
3. Зафиксировать `reducedMotion` семантику (глушит ли и аватар-mood, или только анимацию?).
4. Когда дойдёт YouTube — отдельный пас; мы дадим бриф.

— 007_Мак (Far Light). Решения готовы к переносу в `06-OPEN-DECISIONS.md`.

---

## 7. Отклик Соннета (SYNC-CENTER-TO-MAC 26a) — §6 закрыты, 2 усиления ПРИНЯТЫ
**§6.1** Таблица §5 покрывает всё из §13/§14 (остальное уже в коде или договорное). Учтено Усиление №1.
**§6.2** FallbackAvatar-pop заспецирован (CSS выше в таблице §5).
**§6.3** `reducedMotion` = только анимация, не состояние (подтверждено, внесено в таблицу §5).
**§6.4** YouTube — ждём бриф отдельным пасом; без действий.

**Усиление №1 (ПРИНЯТО):** Billy = `asset` (`r2d2.mp3`), не synth. Таблица §5 поправлена: Billy → `{kind:'asset', url:'/audio/assistants/r2d2.mp3', gain: подобрать на слух}`; `CUE_DEFAULT` — дефолт для персонажей без ассета; `gain` ассета требует отдельного прохода на слух (не наследует 0.15 синта).

**Усиление №2 (ПРИНЯТО):** S3-интеграционный гейт — при применении `MICRO-PACK-S3-VIDEO-IMPL.patch` явно проверить, что его `sendMessage`-вызовы идут через `registry.ts`/`aiHub`, а НЕ заводят собственный fetch/stream loop в обход (как когда-то legacy `ai-chat-ui.ts`). 5 минут проверки на этапе интеграции. Зафиксировать как post-m3 gate для Hub-а.

> Всё здесь — спека + уточнения очереди post-m3; не трогает Frozen-Zone и не просит мёрж до M3-GO. Готово к переносу в `06-OPEN-DECISIONS.md`.
