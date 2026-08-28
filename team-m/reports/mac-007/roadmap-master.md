---
agent: mac-007
task: roadmap-master
status: done
updated: 2026-08-24T09:21:11+00:00
---
## Что сделано
МАСТЕР-ОТЧЁТ: спектр готовых решений по дорожной карте beLive. Прогоны цепочки GO_001 (001→002→001→009), свёрнуто по этапам. Дата 2026-08-24. Автор: Мак-007.

### СВОДКА ВЕРДИКТОВ
| Этап | Вердикт | Суть |
| M1 верификация + D1 | REWORK (инфра ПК) | код Мака зелёный, но нет git-канала и baseline-diff tsc |
| M2 приземление GPT A–E | GO (скелеты ДО GPT) | готовим каркасы, не трогая Frozen-Zone |
| M3 + D3 + D4 | GO (условно, до аппрува) | data-driven AssistantProfile, soundEnabled, CoachPanel.tsx |
| M4 + Layer-2 | GO (условно) | aiHub единый источник, notification CueSpec |

### ТОП ПРЕГРАД ДЛЯ ПК + ГОТОВЫЕ РЕШЕНИЯ
1. sshfs-монтаж НЕ git-репо (раньше) → git init/remote на ПК; INBOX пишется файлом.
2. 314 базовых tsc без baseline-diff → scripts/tsc-baseline.txt + diff.
3. Изоляция AudioContext (ИИ) vs AudioEngineV2 (Frozen-Zone) → тест изоляции, CueSpec вне ядра.
4. GPT-выдача A–E не получена → скелеты avatar.css/avatar.assets.ts/UX-MAP ДО GPT.
5. namespace --bl-av-* vs AD-08/09 → НОВЫЙ avatar.css, не патчить AD; reduced-motion.
6. AUTH_REQUIRED ↔ product-protocol → ловить в aiHub.sendMessage (M4), рендер блока в CoachPanel.
7. R13 HMR-дубли → module-guard + cleanup (как в M1).
8. Free-модели перегружаются → fallback switch-model.py (создать при «го, гайд»).

### ГОТОВЫЙ СПЕКТР ПО ЗАДАЧАМ
- M1: CharacterSoundManager(CueSpec)+registerInit+ивент+avatar celebrate — ГОТОВО (Мак).
- M2: A→avatar.css(--bl-av-*), C→avatar.assets.ts, D→registry.ts, E→UX-MAP, 008 QA — ПЛАН+скелеты.
- M3: AssistantProfile[] в registry.ts (CueSpec+systemPrompt+guest-gate) — ПЛАН.
- D3: soundEnabled в ai-settings.store — ПЛАН.
- D4: CoachPanel.tsx (registerInit, chips) — ПЛАН.
- M4: aiHub.sendMessage единый, убрать streamOpenAI — ПЛАН.
- Layer-2: team-m.report-arrived + notification CueSpec + Билли reactive — ПЛАН.

### СЛЕДУЮЩИЙ ХОД
- ПК (007): починить git-канал + baseline tsc, верифицировать M1.
- Мак: ждать GPT → дополнить M2; материализовать скелеты.
- Никита/Центры: вердикт D1/D3/D4; аппрув перед кодом.
- Рестарт opencode → /go-001 пойдёт на opencode/ox-alpha-free.

Полные прогоны: mac-007/run1-m1-verify, run2-m2-landing, run3-m3-d3-d4, run4-m4-layer2.

## Что нужно от V007
Принять мастер-план, верифицировать M1, состыковать карты, вернуть статус в INBOX.

## Блокеры
M2 ждёт GPT-выдачи. Иначе нет.

## Текущий статус
done — спектр решений собран, ждёт интеграции V007.
