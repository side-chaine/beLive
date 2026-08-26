# 🌊 MICRO-PACK-WAVE5 · finalization · handoff (design)
> Источник: FINAL-ROADMAP-draft.md §2 Этап 3 Волна 5 (001, вериф. 002/009). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/770; фасад ОСТАЁТСЯ (пограничный слой); __restoreV2Engine удаляется (контроль grep 0); комментарии-V2 = осознанный retain-класс (не блокер, Д-3).

## ЦЕЛЬ
Финализация v3-only: E1-предикат/env-зачистка 12 ридеров V2-глобалов; фасад остаётся; stub `__restoreV2Engine` удалить; доки/термины. Итог Этапа 4 = чистый v3-only репо.

## ПРАВИТЬ (SAFE-файлы)
- 12 ридеров V2-глобалов (`window.audioEngine/.app/.trackCatalog/.liveMode/.lyricsDisplay/.markerManager/.waveformEditor` — mode-switch.service, block-scene.service, track.actions, FullAvatar, useStemWaveform, useBackgroundManagers, trigger-visual, MonitorMixPanel, upload.service, …): заменить на V3-state (E1-предикат/env) или удалить.
- `src/main.tsx` stub `__restoreV2Engine` → удалить. `grep -rn "__restoreV2Engine" src js` → 0.
- Фасад (`audio-facade-v3.js`) ОСТАВИТЬ как пограничный слой (не удалять).
- Доки/термины: обновить (BAC-111 doc-debt: `avatar-visual-engine.md` STALE, `team-m-sync-proposal.md` untracked).

## НЕ ТРОГАТЬ (Frozen)
Все frozen; комментарии-V2 в ≥13 файлах (`IV2PublicContract.ts:3/:11`, `MixerPanel.tsx:6`, …) = осознанный retain-класс, НЕ блокер (Этап 4 критерий = 0 runtime-imports, комментарии retain).

## ГЕЙТ ВОЛНЫ + ЭТАП 4
1. канон-гейт 306/770 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен.
4. ⛔-отчёт Ц3.
5. `grep -rlE "(import|from).*(AudioEngineV2|patchV1|track\.orchestrator|V2Adapter)" src --include='*.ts*'` → **0 runtime-imports**.
6. `grep -rn "__restoreV2Engine" src js` → 0.
7. dist-inventory: класс known-retained-M5 закрыт или осознан; аудит classic js/* индивидуален.
8. Тег `v3-only` + dual-tag pre-M5.

## Gate 3B (связь)
Gate 3B НЕ закрывается удалением V2 (PLAN §0:10–11). Кампания 425/G4 (GTRACK-SPEC-2026-08-25.md) **продолжается на чистом репо** Этапа 4: dist-grep negative (V2 вне бандла) + E4-A cut-list + V2-recovery retired поимённо (0 wildcard). Push/деплой 🔒 — отдельное решение Босса.

## ТЕСТЫ
- 12 ридеров не зовут V2-глобалы (grep 0 среди SAFE).
- v3-only сборка собирается без V2 в бандле.
- Frozen-guard: 0 нарушений; allowlist пуст (все BAC ушли).

## СТАТУС
Дизайн готов. Применение — post-M3-GO (R6). До GO — подготовка. Gate 3B флип НЕ блокирует (продолжается post-M3).
