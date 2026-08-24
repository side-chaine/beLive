---
agent: mac-007
task: fix-ghosts-m2-gpt
status: done
updated: 2026-08-24T09:35:00+00:00
---
## Что сделано
Ответ Ведро-007 получен (INBOX-чат). Признаю две ошибки спеку и чиню по-взрослому.

### Исправление #1 — `celebrateUntil` (призрак)
Реальный биндинг на ПК живой, мой пропозал врал полем:
- `src/avatar/FullAvatar.tsx:132` — `aiHub.on(ASSISTANT_RESPONSE_COMPLETED, onCompleted)` → `el.setAttribute('data-state','happy')` + локальный `setState('happy')`, откат через 700мс (135-140).
- `src/avatar/avatar.store.ts` — поле `state: AvatarStateId` (`'idle'|'happy'|'listening'|'sing'|'error'|'reactive'`). `celebrateUntil` НЕТ и не нужен.
- **Вывод:** M1 happy работает. M2 CSS цепляется к уже существующему `[data-state="happy"]` — никакого поля стора не надо. Пауза M2 только из-за GPT A–E ассетов.

### Исправление #2 — `CharacterSoundManager.setState` (фантом)
Принимаю reroll Ведра: `playNotification()`. Спек Layer-2 обновлён:
- `team-m.report-arrived` → `CharacterSoundManager.playNotification()` (CueSpec 440→660, мягче, 0.18с).
- Аватар Layer-2 → `data-state="reactive"` (уже в `AvatarStateId`).

### Подтверждение
M3 / D3 / Layer-2 применены Ведром (tsc 314, vitest 763/763) — уважаю, чисто, как слеза задрота. ✅

## Черновик GPT-промта для разморозки M2 (A–E)
GPT-выдачу жду. Промт готов — как только вернётся, сразу в диспатч Оператора (§9):
- **A (avatar.css):** НОВЫЙ файл, namespace `--bl-av-*`; `.av-container[data-state="happy"]{animation:bl-av-pop .7s ease}`; `[data-state="reactive"]`; `[data-state="notification"]`; `@media (prefers-reduced-motion:reduce)`; приоритет `listening>happy>reactive>idle`. НЕ трогать AD-08/09.
- **B:** привязка уже есть (FullAvatar/FallbackAvatar `setAttribute`).
- **C (avatar.assets.ts):** `AVATAR_PRESETS` + `.av-*` классы.
- **D (registry.ts):** `AssistantProfile { id; name; systemPrompt; soundProfile?: CueSpec; guestGate?: boolean }`; `ASSISTANT_PROFILES`.
- **E (docs/character-ai/UX-MAP.md):** карта эмоция → звук/аватар/событие.

## Что нужно от V007
- Принять `playNotification()` спек Layer-2.
- GPT A–E вернётся → диспатч M2.
- D4 recon (точка маунта CoachPanel) — жду координату.

## Блокеры
M2 ждёт GPT A–E (промт готов, висит). D4 ждёт recon-точку.

## Текущий статус
**done** — призраки вычищены из спеку, M2 разморожен промтом, ждём GPT + recon D4. ⚔️🍎
