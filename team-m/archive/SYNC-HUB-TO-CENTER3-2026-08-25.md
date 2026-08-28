# SYNC Hub → Center_3 · 2026-08-25 · Отчёт о статусе миграции v2→v3

**От:** 007_Винда (Hub, PC) · **Кому:** Центр_3 (ведущий миграции)

Ты вёл миграцию и знаешь каждый шаг — даю компактный срез «где мы», чтобы ты мог продолжить без перечитывания всей переписки. Источник правды: `team-m/REGISTRY.md`, `BASELINE-RECOVERY-2026-08-25.md`, `CENTERS-SONNET-FULL.md`.

## TL;DR
Архитектурный позвоночник v3 **на месте и закоммичен**. То, что висит незакоммиченным — **72-файловый tree-sweep Мака** (перекладка дерева src/ на v3). Это и есть настоящий «v3-baseline»-милстоун, пока сидит в рабочем дереве. Фичи зоны PC ложатся поверх чисто коммитами по 3-4 файла.

## Что закоммичено (последние 3)
- `c0084c2` — A3 notify-bridge + notify.store + проводка `character/sound/index.ts` + D4 CoachPanel (store+компонент+маунт `App.tsx:253`) + App.tsx. Канон tsc 314.
- `daffeb0` (Mac) — захват вердиктов Соннета в репо.
- `54e2847` (Hub) — N3-β #4 (консолидация пинов блока: cleanup чистит `pinnedBlockId` + удалён мёртвый `clearPinnedBlock` + `TakesPanel` ref→store) + **§13.4 SoundCue union** (`CharacterSoundManager.ts`: тип `SoundCue{synth|asset}`, asset-ветка с кэшем, антиклик-envelope attack 0.01) + микротест ×6. Канон **tsc 313 / vitest 769**.

## Позвоночник (DONE, проверено)
- V-Mix stereo (TASK-015): фейдеры post-fader + мик ТОЛЬКО RIGHT (граф-гейт `_vmixMicGate`, иммунен к 🎤-тумблеру). **Босс диагностировал: работает** — при активации mic→R, вокал трека→L, музыка в centre.
- Character-AI chain (M3/D3/Layer-2 + G1/G2/F-2 G14).
- M4 unify: `ai-chat-ui.ts`→`aiHub.sendMessage` (живой `/v1/chat/stream`), удалён `streamOpenAI`, once-guard.
- GUARD-36, N3-β аудит — RESOLVED.

## Frozen Zone (НЕ ТРОГАТЬ — обе стороны)
`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-приватные поля. Миграция = обернуть v2 через `V2Adapter`, не касаясь сердца.

## Канон верификации
`tsc --noEmit` = **313** ошибок; `vitest run` = **769 passed** (2 legacy-файла падают по missing-import — не в счёт). Все новые паки ориентируются на 313/769.

## Дизайн-решения, ставшие каноном (Соннет §13/§14, захвачены Маком)
- `SoundCue{synth|asset}` union; Билли пока synth-бип (поведение не меняли), тип готов под asset-свитч.
- mood-приоритет: `listening > happy(celebrate) > sing/streaming > idle` (`celebrateUntil:number` в avatar.store).
- Mute ≠ reduced-motion (раздельные настройки); cooldown 400мс — тех-guard.
- Два подписчика одного ивента (`assistant.response.completed`: звук=PC, аватар=Mac) — НЕ нарушение.
- Billy = первая запись реестра; панель Мака читает ТОЛЬКО реестр (ноль хардкода).

## IN-FLIGHT / UNCOMMITTED
- **Mac: 72-файловый src/-sweep** (его миграция: `avatar/*`, `registry.ts`, `ai-chat-ui.ts`, `FallbackAvatar`, `FullAvatar`, `MonitorRouter`, `HybridPipelineService`, `WagonTrain`, `TransportBar` и пр.). НЕ прогнан каноном целиком.
- **P1#6** (TS2531 null-guard + удалён мёртвый `ae`, дал tsc 314→313) — лёг внутрь одного из файлов sweep'а Мака, переплетён, поедет с его коммитом.
- **Mac зоны фич**: avatar UI (FallbackAvatar pop), CoachPanel body (ратифицирован Hub, ждёт его носитель), M2 GPT A–E (блок на твоих промптах).

## ЧТО НУЖНО ОТ ЦЕНТРА_3 (твои решения)
1. **Подтверди форму 72-файлового sweep'а** — это и есть целевой v3-baseline? Или часть ещё переписать?
2. **Архитектурные спецы (⛔ заблокированы)**: `425 + G4 + M3-GO`, `MIC-УШИ-СЕССИЯ` (solo/vocal-fade/auto-pause/RTL, бриф 006).
3. **YouTube-слой** (§13.7) — отдельный research-пас вне M1.
4. **character-AI asset-стратегия** — когда Билли/новые персонажи переходят на asset (`r2d2.mp3` уже на диске), auto-normalize-gain (пик/RMS) — при >2–3 персонажах.
5. Приоритизация оставшихся фронтов под «штурм обеими командами».

## Состояние каналов
- Operator `big-pickle` (49/49) — стабилен, применяет паки.
- Named-spawn мёртв (`ox-alpha-free` не существует); scout/console-go — мимолётно блипают. Деградация: named→general+Функция→инлайн-роли. Обе стороны двигаются.

— 007_Винда 🪟
