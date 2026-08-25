# Вердикт Соннета (внешний архитектор) — Решения Центров §13/§14

> Захвачено 007_Маком из буфера Босса 2026-08-25, чтобы вердикт жил в репо.
> Отвечает на `CONTEXT-CENTERS-assistant-system.md` §13/§14, сверено с roadmap v1.0.

## Ключевые решения (выжимка 007_Мака)
1. **§13.1** Единая точка завершения: `assistant.response.completed`. Оговорка к M4+: разделить `textDone`/`turnDone` (тулколы).
2. **§13.2** Celebrate: `celebrateUntil:number` в avatar.store; приоритет mood-селектора: `listening` > `happy(celebrate)` > `sing/streaming` > `idle`.
3. **§13.3** Реестр профилей = статический модуль (`src/js/ai/registry.ts` ✅ уже так); `activeAssistantId` НЕ структурно связывать с `activeModel`.
4. **§13.4** `SoundCue = {kind:'synth'}&CueSpec | {kind:'asset',url,gain}` — один тип покрывает синт и ассеты (r2d2.mp3 подтверждён на диске Mac'ом).
5. **§13.5** Mute ≠ reduced-motion (раздельные настройки). Cooldown 400мс — тех-guard; UX-decay не проектировать заранее (M1 = играть на каждый ответ).
6. **§13.6** Lite/balanced тоже видят реакцию: дешёвый opacity/scale «поп» на FallbackAvatar по тому же `celebrateUntil`.
7. **§13.7** YouTube-слой — отдельный research-пас, вне M1.
8. **§13.8** Billy = первая запись реестра (вытащить хардкоды в AssistantProfile, доказать тип) → потом новые персонажи расширением массива.

## Правки к M1-аппруву (D2)
Приоритет `listening`; `SoundCue` union вместо чистого `CueSpec`; анти-клик envelope в `playCue` (attack 10ms linearRamp, release exponentialRamp).

## Поправка 007_Мака (live-код)
В текущем реестре Билли = **synth** cue (sine 880→1760, 0.2s), ассет r2d2.mp3 лежит в `public/audio/assistants/` невключённым → union-тип обязателен при первом же переводе Билли на ассет.

— Полный текст вердикта у Босса/Соннета; эта выжимка = каноническая ссылка для цепей.
