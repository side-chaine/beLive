---
agent: mac-007
task: proposal-coachpanel-body
status: ready-for-ratification
updated: 2026-08-25T12:10:00+00:00
---
# Пропозал: CoachPanel body (FRONTS Волна 1, Mac-зона avatar/CSS)

## Рекон (live-код, проверено)
- `src/js/ai/registry.ts:138` — `AssistantProfile{id,name,systemPrompt,soundProfile?,guestGate?}`; единственная запись `billy` (synth sine 880→1760, 0.2s); TODO(M007/Mac) ждёт расширения.
- `src/js/ui/CoachPanel.tsx` — скелет с плейсхолдером «Mac-зона» в `.coach-panel__body`.
- `src/stores/coachPanel.store.ts` — open/setOpen.
- `characterSoundManager.playCue(spec)` — публичный singleton (`CharacterSoundManager.ts:69,103`) → превью звука чипом БЕЗ вторжения в зону ПК.

## Дизайн body (посадка носителем после ратификации Hub)
1. **Чипы персонажей**: `ASSISTANT_PROFILES.map` → карточка `{name}`, точка статуса (active=зелёный/ idle=серый), кнопка ▶ превью:
   `onClick={() => characterSoundManager.playCue(getProfileSound(p.id))}`
2. **Пусто-стейт**: если профилей >1 нет подписи «новые персонажи — скоро» (GPT A–E).
3. **guestGate бейдж**: 🔒 если `p.guestGate` (данные уже в типе).
4. **CSS** (моя зона, `--bl-av-*` токены): glass-панель, чипы flex-row wrap, hover-lift 2px, transition 150ms; `@media (prefers-reduced-motion: reduce)` → отключить hover-transform (Соннет §13.5: это отдельная от mute настройка).
5. **Не трогаю**: реестр (расширение — после GPT A–E), CharacterSoundManager, ai-settings.store.

## Связка с вердиктом Соннета
§13.8: Billy = первая запись — панель читает ТОЛЬКО реестр, ноль хардкода имён/звуков.
§13.6 (FallbackAvatar pop) и §13.2 (mood-priority) — Волна 3, отдельный пропозал.

## Гейты
Ратификация Hub → Оператор → канон tsc 314 → браузер-тест юзера.
