# 📨 SYNC-MAC-TO-HUB · BRIEFING round 2 (итоги прогонов) · 2026-08-26b
> От: 007_Mac (Far Light) · Кому: 007_Винда (Hub/Near) · СС: Босс
> Результаты команды на Hy3 Free (модель-свитч закреплён в `MODEL-SWITCH-GUIDE.md`).

## 1. ПИТЧ (GO_001 завершён) → verdict в `reports/mac-007/pitch-scope-chain.md`
- 009: **ПОДКЛЮЧЕНИЕ = РЕШЕНО** (GUARDED/OPT-IN, обратимо, frozen цел, 9/9 якорей). **КАЧЕСТВО (автотюн) = ОТЛОЖЕНО** (post-m3).
- 🔑 Инсайт 009 «вариант никто не предложил»: `pitch-engine` УЖЕ transport-agnostic → полный `PitchBus` (~400 строк, 8 файлов) ИЗБЫТОЧЕН. Минимальный путь = safe-shim `get()/init()` + retarget на `MicSourceV3`/`VocalNode` (**~60–80 строк, 2 файла**). Рекомендую его.
- Перед флипом M3-GO: измерить Notes на живом V3 + починить dead `PitchEngine.get()/init()` (падает TypeError).
- Действие Hub: спроектировать/применить минимальный MICRO-PACK (canon 306/772), если Босс аппрувит OPT-IN.

## 2. FOUC + Other-фейдер (P1 #1/#2) → recon в `reports/mac-007/fouc-stem-recon.md`
- Корень #1 = нет ready-гейта лирики (ранний рендер при `lines.length>0`); #2 = `V3DataInterceptor` декод без retry → `other` в `failedStemIds` навсегда + `slice(0,6)` режет + форма `track-stem-ready` не совпадает с frozen `audio.bridge.ts:154`.
- Связь: оба = симптомы V3-boot после флипа. #2 СМЕЖЕН с №18-BUS (без #2 bus-фейдер на `other` не действует).
- Микро-пак GROUP A (lyrics.store + RehearsalLyrics, safe-side) + GROUP B (V3DataInterceptor retry/форму/срез). Hand to Hub (Near) на применение.

## 3. Student-Педагог «воркер» → hunt в `reports/mac-007/student-pedagog-worker-hunt.md`
- Босс прав: `gateway/rehearsal` (CF Worker) релеит SDP/ICE + `clock-scheduler.worker.ts` в сессии есть. Модуль `Rehearsal` (роли teacher/student, WebRTC, trigger-bridge) УЖЕ в коде.
- ❗ НЕ greenfield-каркас, а greenfield-ВИДЕО: `attachLocalTracks` не вызывается, `onRemoteStream` не подписан → видео НЕ замкнуто end-to-end. Плюс доска/YouTube-слой.
- Следствие для S3: стартуем с видео-пиринга поверх готового каркаса, сигналинг НЕ строим. Снимает мой вопрос «где воркер» — он есть.

## 4. МОДЕЛЬ-ГАЙД
- `MODEL-SWITCH-GUIDE.md` создан (процедура свитча + CHAIN-SMOKE). Зафиксировано, т.к. «модели не могут менять настройки в опенкод».

## 5. СТАТУС
- Far выполнил прогоны по синхронизированным направлениям. Жду от Hub: (а) аппрув OPT-IN питч-минимума; (б) применение FOUC/Other микро-паков; (в) GO Босса на 008 HTML-проекцию.

— 007_Mac 🍎
