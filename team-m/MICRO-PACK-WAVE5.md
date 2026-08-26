# 🌊 MICRO-PACK-WAVE5 · finalization (+ BAC-107) · handoff (design, FIXED per 009)
> Источник: FINAL-ROADMAP-draft.md §2 + вериф. 009 (26h). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/772; фасад ОСТАЁТСЯ; __restoreV2Engine удаляется; BAC-105 ПЕРЕНЕСЁН в W1; BAC-107 ЗАКРЫТ здесь.

## ЦЕЛЬ
Финализация v3-only + закрыть BAC-107 (висел). BAC-105 (12 ридеров) уже закрыт в W1.

## ПРАВИТЬ (SAFE)
- **BAC-107 (НОВОЕ):** удалить `live-mode.stub`/`waveformEditor.stub` (`src/main.tsx:9–10`); закрыть `facade.ts:51` FIXME STUB-MIGRATION (либо явно отложить с обоснованием, но НЕ оставлять висящим).
- `src/main.tsx` stub `__restoreV2Engine` → удалить. `grep -rn "__restoreV2Engine" src js` → 0.
- Фасад `audio-facade-v3.js` ОСТАВИТЬ (пограничный слой).
- Доки (BAC-111): `avatar-visual-engine.md` STALE, `team-m-sync-proposal.md` untracked.
- (BAC-105 уже в W1 — здесь НЕ дублировать.)

## НЕ ТРОГАТЬ (Frozen)
Все frozen; комментарии-V2 в ≥13 файлах (`IV2PublicContract.ts:3/:11`, `MixerPanel.tsx:6`, …) = осознанный retain-класс, не блокер (критерий Этапа 4 = 0 runtime-imports).

## ГЕЙТ (Этап 4)
1. канон 306/772 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256 frozen ДО/ПОСЛЕ идентичен.
4. ⛔-отчёт Ц3.
5. `grep -rlE "(import|from).*(AudioEngineV2|patchV1|track\.orchestrator|V2Adapter)" src --include='*.ts*'` → 0 runtime-imports.
6. `grep -rn "__restoreV2Engine" src js` → 0; `live-mode.stub`/`waveformEditor.stub` удалены (BAC-107).
7. dist-inventory: known-retained-M5 закрыт/осознан; аудит classic js/* индивидуален.
8. Тег `v3-only` + dual-tag pre-M5.

## Gate 3B
НЕ закрывается удалением V2 (PLAN §0:10–11). Кампания 425/G4 продолжается на чистом репо (dist-grep negative + E4-A + V2-recovery retired поимённо, 0 wildcard). Push/деплой 🔒 — отдельное решение Босса.

## ТЕСТЫ
- v3-only сборка без V2 в бандле.
- Frozen-guard: 0 нарушений; allowlist пуст (все BAC ушли).

## СТАТУС
Дизайн (FIXED). Применение — post-M3-GO (R6).
