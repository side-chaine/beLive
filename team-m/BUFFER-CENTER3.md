# BUFFER-REPORT · Статус миграции v2→v3 · 2026-08-25 (для Центра_3 / Босса)

> Файл-буфер: копируй/пересылай Центру_3 как есть. Зеркало `SYNC-HUB-TO-CENTER3-2026-08-25.md` + `BASELINE-RECOVERY-2026-08-25.md`.

## Закоммиченный базис (HEAD)
- `daffeb0` (Mac): вердикты Соннета в репо.
- `c0084c2` (Hub): A3 notify-bridge + D4 CoachPanel + character/sound проводка.
- `54e2847` (Hub): N3-β #4 (консолидация пинов блока: cleanup `pinnedBlockId` + удалён мёртвый `clearPinnedBlock` + TakesPanel ref→store) + §13.4 SoundCue union (CharacterSoundManager.ts: тип SoundCue{synth|asset}, asset-ветка с кэшем, антиклик-envelope attack 0.01) + микротест ×6.

## Канон верификации
tsc --noEmit = 313 · vitest run = 769 passed (2 legacy missing-import не в счёт).

## Позвоночник v3 — DONE
- V-Mix stereo (TASK-015): фейдеры post-fader + мик ТОЛЬКО RIGHT (`_vmixMicGate`, иммунен к 🎤-тумблеру).
- Character-AI chain (M3/D3/Layer-2), M4 unify (ai-chat-ui→aiHub.sendMessage, удалён streamOpenAI).
- GUARD-36, N3-β аудит — RESOLVED.

## 🎤 ДИАГНОЗ БОССА: V-Mix РАБОТАЕТ
При активации: mic → RIGHT, вокал трека → LEFT, музыка → centre. Валидация TASK-015 юзером.

## Frozen Zone (НЕ ТРОГАТЬ)
AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts, _-поля. Миграция = обернуть v2 через V2Adapter.

## IN-FLIGHT / незакоммичено
- Mac: 72-файловый src/-sweep (перекладка дерева на v3) — heaviest, не прогнан каноном целиком.
- P1#6 (TS2531 null-guard, tsc 314→313) — переплетён в sweep Мака, поедет с его коммитом.
- Mac зоны фич: CoachPanel body (ратифицирован, ждёт носитель), avatar UI (FallbackAvatar pop), M2 GPT A–E (блок на промптах Босса).

## Согласованные решения (канон, Соннет §13/§14)
SoundCue union (Билли пока synth); mood: listening>happy(celebrate)>sing>idle; Mute≠reduced-motion; два слушателя assistant.response.completed OK; Billy=первая запись реестра, панель читает ТОЛЬКО реестр, getProfileSound — локальная ф-я в CoachPanel.tsx.

## ЧТО НУЖНО ОТ ЦЕНТРА_3
1. Подтверди форму 72-файлового sweep'а = целевой v3-baseline?
2. Спецы 425 + G4 + M3-GO.
3. MIC-УШИ-СЕССИЯ (solo/vocal-fade/auto-pause/RTL, бриф 006).
4. YouTube-слой (§13.7) — research-пас.
5. character-AI asset-стратегия (auto-normalize-gain при >2–3 персонажах).

## Состояние каналов
Operator big-pickle — стабилен. Named-spawn мёртв; scout/console-go блипают. Деградация: named→general+Функция→инлайн-роли. Обе команды двигаются.
