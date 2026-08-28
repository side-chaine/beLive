---
agent: mac-007
task: glm-qwen-007-prompt
status: done
updated: 2026-08-24T09:21:05+00:00
---
## Что сделано
Финальный промт к `007_Винда` (конвергенция GLM+Qwen), свёрстан Мак-007. Ниже — полный контракт.

```markdown
# ПРОМТ К 007_Винда — стыковка beLive (Мак ↔ ПК) поверх V3-final
> From: GLM + Qwen (со-архитекторы) @ Mac (Team M)
> To: 007_Винда @ PC/WSL2 (Team V, canonical host)
> Date: 2026-08-24
> Status: CRITICAL SYNC. Mac-side M1 wired, awaiting PC verification & V3-final merge.

Ты — 007, канонический хост beLive на ПК/WSL2 (192.168.0.14, user nikit).
Мак-сторона передаёт архитектуру поверх V3-final. Твоя задача — состыковать проекты и дорожные карты, ведя канон.

## 0. ЖЁСТКИЕ КОНТРАКТЫ (НЕ ОБСУЖДАЮТСЯ)
- Событие: assistant.response.completed на aiHub (EventTarget, CustomEvent).
- Звук M1: WebAudio 880→1760 Hz, sine, 0.2с, gain 0.15 (CueSpec).
- Аватар: data-state="happy" на .av-container, 0.7с.
- Frozen-Zone: AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts, приватные _ (НЕ ТРОГАТЬ).
- Базовая ветка: backup/win-V3-finish_2-2026-08-23. D1 (feat/character-m1) — вердикт Никиты.

## 1. ЧТО УЖЕ СДЕЛАНО НА МАКЕ
- M1: CharacterSoundManager (CueSpec, cooldown 400мс, unlock() на жесте, подписка только на aiHub); registry.ts onDone→dispatch; ai-chat-ui.ts:116 dispatch+unlock; avatar.store celebrateUntil; FullAvatar/FallbackAvatar cleanup (R13); main.tsx import './character' + registerInit (R9).
- Cross-Team Sync: team-m/scripts/*, drop-zone, INBOX/REPO-STATE.
- Агентная команда: 001/002/005/009 на opencode/ox-alpha-free; GO_001/GO_005; agent-registry/.

## 2. ТВОИ ШАГИ
1. Верификация M1: npm run typecheck (314, diff IDENTICAL), npm test (763/763), npm run verify:ci, npx vitest run --related src/character/. Smoke VITE_ENGINE=v2|v3 → cue 880→1760, аватар 0.7с happy. Блокер → INBOX.
2. D1: подтвердить backup-ветку ИЛИ feat/character-m1 от sync-head; зафиксировать в REPO-STATE.
3. Governance (если есть): DOMAIN-OWNERSHIP.yaml domain character-layer; MASTER-SYNC-REGISTRY.yaml.
4. M2 (GPT A–E): A/B→avatar.css (--bl-av-*, AD-08/09 нетронуты, priority listening>happy>reactive>idle, reduced-motion); C→avatar.assets.ts (AVATAR_PRESETS, .av-* классы); D→registry.ts (AssistantProfile.soundProfile:CueSpec); E→docs/character-ai/UX-MAP.md.
5. D3: soundEnabled в ai-settings.store; CharacterSoundManager читает перед play().
6. D4: CoachPanel.tsx (registerInit) через SYSTEM_PROMPTS; guest-gate AUTH_REQUIRED→апгрейд-блок.
7. M4: AIChatUI.handleSend→aiHub.sendMessage, убрать streamOpenAI (закрыть R1).
8. Layer-2: team-m.report-arrived → CharacterSoundManager state='notification' (отд. CueSpec) + Билли reactive.

## 3. ДОРОЖНЫЕ КАРТЫ (СТЫК)
| Мак (GLM+Qwen) | ПК (007) |
| M1 wiring (сделан) | M1 верификация |
| M2 GPT A–E | M2 приземление |
| M3 AssistantProfile | M3 registry |
| M4 unify | M4 код |
| Layer-2 | Layer-2 код |

## 4. ПРОТОКОЛ
Код — только после аппрува Центра/Никиты. Пуш — только по команде Никиты. Free-модели перегружаются → fallback switch-model.py.

## 5. РИСКИ
R1 два чата→M4; R4 autoplay→unlock(); R9 boot→registerInit; R10 CSS→--bl-av-*; R11 avatar.css→расширение+008; R12 guest→AUTH_REQUIRED; R13 HMR→module-guard+cleanup; R14 sound→CueSpec.

## 6. ПЕРВЫЙ ОТЧЁТ (INBOX)
tsc/vitest/verify:ci/smoke v2|v3, D1 решение, blockers.
```

## Что нужно от V007
Применить/верифицировать по шагам выше; состыковать дорожные карты; вернуть вердикт в INBOX.

## Блокеры
Нет (промт готов). M2 ждёт GPT-выдачи.

## Текущий статус
done — контракт передан, ждёт интеграции V007.
