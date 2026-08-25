# Решения Центров — ИИ-ассистенты beLive (полный вербатим Соннета)

> Передано 007_Маком из буфера Босса 2026-08-25 · отвечает на `CONTEXT-CENTERS-assistant-system.md` §13/§14 · сверено с roadmap v1.0
> Выжимка+поправка Мака: `CENTERS-SONNET-VERDICT.md` · этот файл = первоисточник дословно.

## §13 — Ответы на открытые вопросы

**1. Единая точка завершения (`responseCompleted` из `registry.sendMessage` + после `ai-chat-ui.ts:116`).**
Утверждаю. В roadmap v1.0 уже принято под именем `assistant.response.completed` — согласен, namespaced-имя лучше плоского. Оговорка на будущее, не блокер сейчас: ивент = «текст стрима закончился», не «весь ход ассистента с тулколами». Для M1–M3 этого достаточно. В M4+, когда дойдёт очередь до Tools/Coaching, понадобится разделить `textDone`/`turnDone` — озвучивать реплику до того, как тулкол мог её изменить, плохая идея. Фиксирую здесь, чтобы не потерялось к тому моменту.

**2. Celebrate-состояние аватара без клоббера от `isStreaming`.**
Утверждаю предложение C (`celebrateUntil: number` в `avatar.store`). Уточнение: не терять приоритет `listening` (AD-08):
```ts
function selectMood(state: AvatarState): Mood {
  if (state.isListening) return 'listening';             // высший приоритет
  if (Date.now() < state.celebrateUntil) return 'happy';  // затем celebrate
  return state.isStreaming ? 'sing' : 'idle';              // дальше — как уже есть
}
```
`celebrateUntil` — приоритет №2, не безусловный. Иначе пользователь заговорит в микрофон посреди 0.7-секундного celebrate — и аватар «не услышит».

**3. Где хранить реестр `AssistantProfile`; связь с `aiHub.getActiveModel()`.**
Статический модуль (`src/character/registry.ts`, как в roadmap) верен для M1–M3; бэкенд/CMS — только под marketplace, вне карты. Активный ассистент и активная модель — НЕ связывать структурно: `activeAssistantId` живёт отдельно от `activeModel` (рядом с `coachName` в `ai-settings.store`, как в CH-10). Профиль может нести `preferredModel` как подсказку, но `getActiveModel()` не должен зависеть от выбранного персонажа и наоборот — иначе смена провайдера тихо сбросит персонажа.

**4. Путь звука (`public/audio/assistants/*.mp3` + лёгкий WebAudio/`<audio>`, не `AudioEngineV2`); нужна ли normalize-gain утилита.**
Путь подтверждаю, но есть нестыковка, которую стоит закрыть до M1: `CueSpec` в roadmap (CH-01) — чистый синтез (`wave`/`points`/`gain`/`dur`), а у Billy уже есть реальный ассет `r2d2.mp3`. Один тип должен покрывать оба случая:
```ts
type SoundCue =
  | ({ kind: 'synth' } & CueSpec)
  | { kind: 'asset'; url: string; gain: number };
```
`playCue` ветвится по `kind`. Billy получает `{ kind: 'asset', url: '/audio/assistants/r2d2.mp3', gain }`, будущие синтетические профили (English/Vocal Coach) — `{ kind: 'synth', ...CUE_DEFAULT }`.
Normalize-gain — да в принципе, не блокер M1: пока ассетов 1–2, хватит вручную подобранного `gain` в реестре; авто-нормализация (peak/RMS-анализ при добавлении ассета) — когда персонажей станет больше 2–3.

**5. Mute-тоггл + `prefers-reduced-motion`; cooldown, чтобы не играло на каждый из многих ответов; где хранить настройку.**
Mute и reduced-motion — раздельные настройки, не одна галочка «весёлый режим»: кто-то хочет тишину без потери анимации, кто-то — наоборот (a11y). 400мс cooldown в `CharacterSoundManager` (CH-01) решает технический дубль-фаер, но это не то же самое, что «не утомлять наградой за 50 ответов подряд» — отдельный UX-вопрос, не инженерный guard. Предлагаю: на M1 играть на каждом ответе, не проектировать decay-логику заранее — смотреть на реальное поведение и решать по факту usability-сигналов. Настройка — `ai-settings.store` сейчас (см. D3), `UserProfile.preferences` — когда появится кросс-девайсный профиль.

**6. Тир-стратегия: звук везде, визуал только max/ultra — достаточно ли `FallbackAvatar` для lite/balanced?**
Раз звук уже универсален, оставлять lite/balanced совсем без визуального отклика — асимметрично: динь есть, смотреть не на что. Рекомендую минимальный «поп» и для `FallbackAvatar` — чистый opacity/scale-пульс на том же `celebrateUntil`, без SVG-морфинга/glow/blur (это и есть дорогая часть). Дёшево по перф-бюджету, закрывает разрыв между тирами.

**7. Точка расширения для YouTube.**
Не могу дать точный файл — в разведанном мной коде (пак + roadmap) YouTube-слой не встречался, а он явно есть отдельно (плеер, embed, URL-parsing — см. исходный бриф п.8). Нужен отдельный research-пас именно по этому слою, как и просил исходный бриф; в любом случае вне скоупа M1.

**8. `src/billy/*` как шаблон для `AssistantProfile`.**
Да — не просто референс, а буквально первая запись реестра. Перед English/Vocal Coach вытащить текущие хардкод-значения Billy (включая `r2d2.mp3`) в форму `AssistantProfile`, доказать, что тип держит реальный кейс, и только потом добавлять новых персонажей чистым расширением массива.

## §14 — Предложения оркестратора

**A/E/F** — утверждаю без изменений (unified event, extension-not-rewrite, boundary safety уже верно сформулированы).
**B** — утверждаю с уточнением: «один подписчик» — это один подписчик **на звук**. Аватар (`avatar.store`) — отдельный второй подписчик того же ивента (так и в CH-05), это не нарушение паттерна — у каждого concern свой слушатель.
**C** — утверждаю с приоритетом `listening` (см. §13.2).
**D** — утверждаю; это и есть причина решения §13.6 — раз звук универсальный канал удержания, дырка в визуале на lite/balanced его частично обесценивает.

## Итог по M1

Технически готово к аппруву (D2), с тремя правками: приоритет `listening` в селекторе мода (§13.2), `SoundCue` synth/asset вместо чистого `CueSpec` (§13.4), и анти-клик envelope в `playCue`:

```ts
function playCue(cue: SoundCue, ctx: AudioContext) {
  if (cue.kind === 'asset') { /* decode + play, gain = cue.gain */ return; }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = cue.wave;
  const t0 = ctx.currentTime;
  osc.frequency.setValueAtTime(cue.points[0][0], t0);            // явный старт перед ramp
  for (const [freq, at] of cue.points.slice(1)) {
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + at);
  }
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(cue.gain, t0 + 0.01);         // attack, антиклик
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + cue.dur);   // release, антиклик
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + cue.dur + 0.02);
}
```

Ничего из этого не задевает Frozen-Zone и не блокирует Win-миграцию — параллелится свободно.
