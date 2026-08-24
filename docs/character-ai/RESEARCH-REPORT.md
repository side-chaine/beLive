# Character AI / Voice / Coaching / YouTube — FINAL Research Report (beLive)

> **Для:** M007 (Mac-side 007) — исполнитель задачи
> **От:** 007-координатор (усиление GPT-промпта + разведка кода)
> **Дата:** 2026-08-23
> **Статус:** 🔬 RESEARCH ONLY — код не писался. Первый результат = отчёт.
> **Версия:** **FINAL** — все усиления 007 (E1–E8) включены в §0 и интегрированы в разделы A–E.

---

## 0. Мои усиления к GPT-промпту (senior-architect additions)

GPT-промпт был хорош, но написан «в вакууме». После реального чтения кода внесены
обязательные коррективы. Если не учесть их — milestone-1 не сработает или сломает чат.

- **E1 — Реальная точка «response completed» НЕ `onDone` провайдера.**
  Живой чат (`src/js/ui/ai-chat-ui.ts`) **не вызывает** `aiHub.sendMessage` и не использует
  `StreamEvent`/`onDone`. Он делает прямой `fetch('/api/gateway/chat')` + ручной цикл
  `for await (const chunk of streamOpenAI(response.body))` (строки 106–114). Завершение —
  после этого цикла, когда `fullText` собран. Цепляемся сюда, а не к `onDone` провайдера.
- **E2 — Не создавать новую event-систему.** Уже есть `AIHub extends EventTarget`
  (`src/js/ai/registry.ts`), на нём висят `CustomEvent('modelChanged')`, и он уже используется
  (`model-dropdown-ui.ts`, `ai-chat-ui.ts` через `aiHub.on(...)`). Триггер = `aiHub.dispatchEvent(
  new CustomEvent('assistant.response.completed', { detail }))`. Ноль новых зависимостей.
- **E3 — R2-D2 ассета НЕТ в репозитории.** (Только `signalsmith-spike/test-track.mp3`.)
  Значит milestone-1 **синтезирует** короткий cue через Web Audio API — без ассета, без трогания
  frozen `AudioEngineV2`. Позже подменяем на оригинальную библиотеку персонажей.
- **E4 — CharacterSoundManager держим провайдер- и аватар-агностиком.** Он подписан ТОЛЬКО на
  `aiHub`-события, не импортирует провайдеры и не знает про конкретный чат-компонент. Это и есть
  доказательство «звук не привязан к AI provider».
- **E5 — Data-driven registry с первого дня.** Даже для milestone-1 заводим интерфейс
  `AssistantProfile` + крошечный `characterRegistry` (Billy = первый профиль). Чтобы не скатиться
  в `if/else` по персонажам, о чём предупреждал бриф.
- **E6 — Флаг рассинхрона аватара.** `FallbackAvatar`/`FullAvatar` слушают `useAiStore.isStreaming`
  (`src/avatar/*.tsx`), но живой чат `AIChatUI` НЕ обновляет `useAiStore` (у него свой
  `this.isStreaming`). `isStreaming` крутит только МОК `AIChatPanel.tsx`. Итог: аватар сейчас
  реагирует на мок-чат, а не на реальный. `CharacterController` должен вести аватар через `aiHub`-
  события, а не через `useAiStore.isStreaming` напрямую.
- **E7 — Риск расхождения форматов SSE.** `streamOpenAI` парсит **OpenAI-формат**
  (`choices[0].delta.content`, `[DONE]`), а `gateway-provider.ts` ждёт beLive `StreamEvent`
  (`{type:'token'}`). Две ветки парсинга. Milestone-1 цепляем к живой ветке (`AIChatUI` +
  `streamOpenAI`), чтобы не зависеть от провайдеров. Долгосрочно — унифицировать на `aiHub.sendMessage`.
- **E8 — Двойной чат.** Реальный `AIChatUI` и мок `AIChatPanel` существуют параллельно. Звук в
  milestone-1 добавляем в реальный; мок оставляем молчать до унификации (риск путаницы — см. Risks R1).

---

## A. Current Architecture (что уже есть)

### A1. AI-стек (`src/js/ai/`)
- `types.ts` — `Message`, `ChatRequest` (`model, messages, temperature?, maxTokens?, stream?, user?, injectOperator?`),
  `StreamEvent = {type:'start'|'token'|'done'|'error'}`, `StreamCallbacks {onStart,onToken,onDone,onError}`,
  `AIProvider`, `ModelInfo`.
- `registry.ts` — **`AIHub extends EventTarget`**, singleton `aiHub`. Методы: `register`, `setActiveModel`,
  `getActiveModel/Provider`, `sendMessage(req, callbacks)`, `on/off(eventName, listener)`,
  `dispatchEvent(new CustomEvent('modelChanged', {detail}))`. **Это готовая шина событий.**
- `providers/` — `gateway-provider.ts` (Cloudflare Worker `localhost:8787`, SSE→`StreamEvent`,
  `onDone` на строке 200 + fallback 214), `belive.provider.ts`, `openrouter-direct.provider.ts`.
  Все реализуют `AIProvider`.

### A2. UI-чат (ДВА параллельных!)
- `src/js/ui/ai-chat-ui.ts` — **реальный** vanilla-TS класс `AIChatUI`. `handleSend` →
  `fetch('/api/gateway/chat')` → `for await (streamOpenAI(...))` → копит `fullText` →
  `checkForToolCalls(fullText)`. **НЕ трогает `aiHub` и `useAiStore`.** Имеет свой `this.isStreaming`.
- `src/components/AIChatPanel.tsx` — **МОК** (React). `useAiStore`, фейк-ответы через `setTimeout`,
  крутит `isStreaming`. Демо/плейсхолдер.

### A3. AI store (`src/stores/ai.store.ts`)
- `useAiStore` (zustand): `messages, isStreaming, displayTarget` + actions
  (`addUserMessage, startAssistantMessage, appendToken, setAssistantError, setStreaming, ...`).
  Используется только моком + тестами.

### A4. Avatar (`src/avatar/`)
- `avatar.store.ts` — `AvatarStateId = idle|happy|listening|sing|error|reactive`.
- `FallbackAvatar.tsx` / `FullAvatar.tsx` — подписаны на `useAiStore.isStreaming` →
  `el.setAttribute('data-state', isStreaming?'listening':'idle')`. Управление чисто через CSS-атрибут.
- (См. E6: реальный чат не дёргает этот стор → аватар «слушает» мок, а не живой чат.)

### A5. Billy — существующий «персонаж» (`src/billy/`)
- `types.ts` — `BillySkill { zone, systemPrompt, contextBuilder, temperature, maxTokens }`, `BillyContext`.
  **Это зародыш `AssistantProfile`.** Есть `skill-registry.ts`, `context-builder.ts`, `billy.service.ts`,
  `billy-controller.ts`, `billy-runtime.store.ts`, `billy.constants.ts`.
- Billy-константы: FSM-моды `patrol|groove|think|sleep` + transient `jump|retreat`; `think` = `isAiStreaming`.
  Billy — это companion/практика-ассистент; отличная база для первого `AssistantProfile`.

### A6. Audio infra
- `src/audio/core/AudioEngineV2.ts` — **❄️ FROZEN** (нельзя трогать).
- `src/audio/core/StemPlayer.ts` — использует `new Audio()` (легально для нового модуля).
- **НЕТ** UI `SoundManager`/`playCue`. CharacterSoundManager делаем как НОВЫЙ независимый модуль.

### A7. YouTube
- `src/catalog/types.ts` — `sourceType?: 'local'|'youtube'|'telegram'|'external'`, `sourceUrl?`.
- `src/catalog/store/catalog.store.ts` — мок-упражнения с `sourceType:'youtube'`.
- **НЕТ** плеера/embed-компонента в `src`. YouTube direction = greenfield на слое воспроизведения.

### A8. Существующие event-паттерны
- `aiHub` (EventTarget + CustomEvent) — основной кандидат на шину.
- `document.dispatchEvent(new CustomEvent('taxonomy-seek-mismatch', ...))` (в `ai-tools.ts`) —
  DOM-ивенты уже используются для кросс-компонентной связи.

---

## B. Integration Points (где встраивать)

| Слой | Точка входа | Почему здесь |
|---|---|---|
| **Trigger (response completed)** | `AIChatUI.handleSend`, после `for await` (строка 114) | Единственная надёжная точка завершения живого стрима |
| **Event bus** | `aiHub.dispatchEvent(new CustomEvent('assistant.response.completed'))` | Существующий EventTarget, без новой системы (E2) |
| **Sound** | `src/character/sound/CharacterSoundManager.ts` (NEW) | Подписан на `aiHub`, агностик к провайдеру/чату (E4) |
| **Avatar** | `CharacterController` → `useAvatarStore.setState(...)` / `data-state` | Не через `useAiStore.isStreaming` напрямую (E6) |
| **Character/Role** | `src/character/registry.ts` + `AssistantProfile` (NEW) | Data-driven, Billy = первый профиль (E5) |
| **Voice/TTS** | `VoiceProfile` → TTS-provider abstraction (NEW, будущее) | Как `AIHub` для моделей — плаггable провайдер |
| **YouTube** | `YouTubePlayer` consumer каталога `sourceUrl` (NEW, будущее) | Расширяет существующее `sourceType:'youtube'` |

---

## C. Risks

- **R1 (высокий):** два чата (real/mock). Звук в milestone-1 только в реальном → мок молчит,
  пользователь может запутаться. Митигация: целимся в реальный; унификация — отдельный шаг.
- **R2 (средний):** расхождение SSE-форматов (`streamOpenAI` vs `gateway-provider`). Milestone-1
  цепляется к живой ветке → сейчас стабильно; долгосрочно — унификация на `aiHub.sendMessage`.
- **R3 (критичный, frozen):** `CharacterSoundManager` **НЕЛЬЗЯ** импортировать/наследовать
  `AudioEngineV2`. Только standalone Web Audio / `new Audio()`.
- **R4 (средний):** Autoplay policy браузеров блокирует `AudioContext` до user-gesture. Send — это
  жест, но completion прилетает чуть позже. Нужно `audioCtx.resume()` на клике отправки, либо
  создавать контекст внутри обработчика отправки.
- **R5 (средний):** аватар сейчас «слушает» мок-стор (E6) → реакции персонажа не видны в реальном
  чате до унификации.
- **R6 (низкий):** перформанс — cue должен уложиться в бюджет кадра; короткий синтез ~<5ms — ок.
- **R7 (низкий/будущее):** YouTube embed требует сети/согласий; выносим в отдельный milestone.

---

## D. Minimal Implementation (milestone-1 патч)

**Цель:** AI response completed → event → SoundManager → play test sound. Звук не привязан к провайдеру.

**Файлы:**
1. **NEW** `src/character/sound/CharacterSoundManager.ts`
   - Импорт только `aiHub` из `../ai/registry`.
   - В конструкторе: `aiHub.on('assistant.response.completed', () => this.play('response'))`.
   - `play(state: 'thinking'|'processing'|'response'|'success'|'warning'|'error'|'notification'|'idle')`:
     синтез короткого cue через Web Audio (`AudioContext`, ленивый init + `resume()` на жесте).
     Для `'response'` — короткий blip (напр. triangle 180Hz, 120ms). Никаких ассетов (E3).
   - Singleton `export const characterSoundManager = new CharacterSoundManager()`.
2. **PATCH** `src/js/ui/ai-chat-ui.ts` (1 место, после строки 114):
   ```ts
   // после for-await цикла, fullText собран:
   aiHub.dispatchEvent(new CustomEvent('assistant.response.completed', { detail: { fullText } }));
   ```
3. **PATCH** bootstrap (минимально): инстанцировать `characterSoundManager` один раз при старте
   приложения (импорт в `main`/точку входа, либо лениво внутри чата). И `resume()` AudioContext на
   `handleSend` (R4).

**Не трогаем:** провайдеры, `onDone`, frozen `AudioEngineV2`, `bridges/*`, `track.orchestrator.ts`,
приватные поля. Изменение поверхностное и обратимое.

**Ожидаемый результат:** после завершения ответа AI проигрывается короткий звук; звук не зависит
от выбранной модели/провайдера.

**Проверка:**
- `npm run dev` → открыть чат → отправить сообщение → после ответа слышен cue (+ временный
  `console.log('[CharacterSound] completed → play')` для подтверждения триггера).
- `npx tsc --noEmit` чисто.
- Убедиться, что frozen-файлы не изменены (`git diff --stat` показывает только 2 файла).

---

## E. Future Expansion (из milestone-1 → полная система)

```
User
 → Assistant/Character      (AssistantProfile: id,name,role,avatar,personality,systemPrompt,voiceProfile,soundProfile,capabilities)
   → Role                   (vocal/breathing/distortion/rap/... ≠ Model ≠ Character)
     → AI Provider/Model    (aiHub — уже абстрагирован)
       → Tools/Actions      (Billy skill-registry / context-builder — расширить)
         → UI / Audio / Visual
```

1. **CharacterController** — переводит `aiHub`-события (`response.started|streaming|completed|error`,
   будущие `action.started|completed`) в: SoundManager + AvatarController + (позже) VoiceManager/TTS.
2. **AssistantProfile registry** — Billy как первый профиль; coaches добавляются конфигом, не кодом.
3. **Унификация чатов** — обе ветки (`AIChatUI`, `AIChatPanel`) вести через `aiHub.sendMessage`,
   чтобы `StreamEvent` стал единственным источником правды; убрать дублирующий `streamOpenAI`-путь.
4. **CharacterSoundManager** расширить state-машиной (`thinking/processing/response/success/warning/
   error/notification/idle`) + загрузка персонажных cue-сетов (оригинальная библиотека вместо R2-D2).
5. **VoiceManager** — `VoiceProfile` → TTS-provider abstraction (плаггable, как `AIHub`).
6. **AvatarController** — единый визуал персонажа через `data-state` + `useAvatarStore`, управляемый
   `CharacterController`, а не `useAiStore.isStreaming` (E6).
7. **YouTube** — `YouTubePlayer`, потребляющий `sourceUrl` каталога; встраивается в practice-workflow:
   video → AI coach → practice task → notes → repetition → TrackMap.
8. **User-selectable Assistant** — UI выбора профиля (Билли / Vocal Coach / …), data-driven.

---

## Итог для M007
Точка подключения найдена и проверена: **`AIChatUI.handleSend`, после `for await` (строка 114)**.
Механизм триггера: **существующий `aiHub` (EventTarget)** — новую шину не заводим.
Минимальный патч = 1 новый модуль (`CharacterSoundManager`, синтез cue, без ассета и без frozen-ядра)
+ 1 строка dispatch в чате + bootstrap-init. Frozen Zone соблюдён. Код писать только после
аппрува этого отчёта Никитой/Центром.
