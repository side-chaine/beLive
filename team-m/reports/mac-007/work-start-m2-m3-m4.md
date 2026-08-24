---
agent: mac-007
task: work-start-m2-m3-m4
status: done
updated: 2026-08-24T09:28:19+00:00
---
## Что сделано
**M1 подтверждён на ПК** — V007 диспатчил мой дроп (`CharacterSoundManager.ts`, `index.ts`, `ai-chat-ui.ts`, `main.tsx`, аватары). Синхронизация Мак ↔ Вёдро жива. Ниже — стартовый пак предложений M2/M3/M4 (пишу в reports/docs по §3, `src/` напрямую не трогаю).

## ПРОПОЗАЛ-ПАК (для диспатча Оператора на Вёдре)
### M2 — визуал-приземление (скелеты ДО GPT A–E)
- **A** → НОВЫЙ `src/avatar/avatar.css`, namespace `--bl-av-*` (НЕ патчить AD-08/09 — чужой frozen).
  - `.av-container[data-state="happy"] .av-face { animation: bl-av-pop .7s ease; }`
  - `.av-container[data-state="notification"]` — отдельный (Layer-2).
  - `@media (prefers-reduced-motion: reduce)` → анимации выкл.
  - приоритет слоёв: `listening > happy > reactive > idle`.
- **B** → привязка в `FullAvatar.tsx`/`FallbackAvatar.tsx`: `data-state` из `avatar.store` (есть `celebrateUntil`).
- **C** → НОВЫЙ `src/avatar/avatar.assets.ts`: `AVATAR_PRESETS` (happy/reactive/idle/listening) + `.av-*` классы.
- **D** → `src/js/ai/registry.ts`: тип `AssistantProfile { id; name; systemPrompt; soundProfile?: CueSpec; guestGate?: boolean }`; экспорт `ASSISTANT_PROFILES`.
- **E** → `docs/character-ai/UX-MAP.md` (эмоция → звук/аватар/событие).
- **008 (QA):** чек-лист AD-08/09 нетронуты.

### M3 — data-driven AssistantProfile
- Реестр `ASSISTANT_PROFILES` (Билли/Герой/etc) → `soundProfile: {freqStart:880, freqEnd:1760, type:'sine', duration:0.2, gain:0.15}`.
- `ai-chat-ui.ts` берёт `soundProfile` из профиля (сейчас хардкод в CharacterSoundManager → вынести в профиль).

### D3 — sound-enabled
- `src/js/ai/settings/ai-settings.store.ts`: поле `soundEnabled: boolean` (default true).
- `CharacterSoundManager.play()`: `if(!soundEnabled) return;` (читает стор).

### D4 — CoachPanel
- НОВЫЙ `src/js/ui/CoachPanel.tsx` через `registerInit({id:'coach-panel'})`; чипы персонажей + системный промпт из `ASSISTANT_PROFILES`.
- `guestGate: AUTH_REQUIRED` → рендер апгрейд-блока (гость не идёт в платный чат).

### M4 — unify
- `AIChatUI.handleSend` → `aiHub.sendMessage(text)` (единственный источник). Убрать `streamOpenAI` (закрыть R1). Вёдро верифицирует рил-тайм.

### Layer-2 — уведомления
- `team-m.report-arrived` → `CharacterSoundManager.setState('notification')` (отд. CueSpec: мягче, 440→660).
- Билли `reactive` состояние аватара.

## Что нужно от V007
Диспатч Оператора: применить A/B/C/D/E (M2), M3, D3, D4, M4, Layer-2. Верификация: `tsc 314`, `vitest 763/763`, smoke `VITE_ENGINE=v2|v3`.

## Блокеры
M2 ждёт GPT-выдачу A–E (строим скелеты ДО неё). Иначе нет.

## Текущий статус
**done (пропозалы готовы)** — ждём диспатча Вёдер. Старт работы объявлен. 🍏⚔️🎮
