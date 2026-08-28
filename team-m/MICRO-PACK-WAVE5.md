# 🌊 MICRO-PACK-WAVE5 · finalization (+ BAC-107/109/110) · handoff (FINAL per chain 001→002→001→009, 26h)
> Источник: FINAL-ROADMAP-draft §2 + chain-verify (001 recon → 002 ТРЕБУЕТ ПАТЧА → 001 re-check → 009 РЕШЕНО после doc-reconcile). Hub применяет post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/767+5int+2load; фасад ОСТАЁТСЯ; `__restoreV2Engine`→0; BAC-105 уже в W1; BAC-109/110 — W5 (hygiene/doc-долг per Ц3 4.5).

## ЦЕЛЬ
Финализация v3-only + закрыть BAC-107 (stub-миграция) + BAC-109 (console-гигиена) + BAC-110 (V3StatePublisher placeholder).

## ПРАВИТЬ (SAFE)
- `src/blocks/bridge/blockEditor.service.ts`: удалить `patchWaveformEditor` (103-150) + вызов (168). `initBlockEditorService` (163) оставить (живой `window.ModalBlockEditor = BlockEditorProxy`).
- `src/main.tsx`: удалить import L9 `registerLiveModeStub`, L10 `registerWaveformEditorStub`; вызовы L410,L411; L154 `;(window as any).__restoreV2Engine?.()`; СОХРАНИТЬ L155 `;(window as any).__setV3Active?.(false)`.
- `src/foundation/event-bus/facade.ts`: удалить FIXME коммент L51-52 (mapping L53 оставить).
- `js/audio-facade-v3.js`: удалить L8-10 (def `__restoreV2Engine`); фасад (L12+) оставить.
- DELETE `src/services/live-mode.stub.ts`, `src/services/waveform-editor.stub.ts`.
- **BAC-109 (console-гигиена):** обернуть `console.*` вне `import.meta.env.DEV` (соотв. файлы) — уточнить список при apply (`grep "console\." src` вне DEV).
- **BAC-110 (V3StatePublisher placeholder):** `V3StatePublisher.ts:129` заменить placeholder на реальный publisher (или задокументировать) — уточнить при apply.
- Доки BAC-111: `avatar-visual-engine.md` STALE → archive; `team-m-sync-proposal.md` untracked → gitignore/archive.

## НЕ ТРОГАТЬ (Frozen)
Все frozen; комментарии-V2 (≥13 файлов) = retain-класс (критерий Этапа 4 = 0 runtime-imports).

## ГЕЙТ (Этап 4)
1. канон 306/767+5int+2load + PARITY PASS.
2. boot-smoke CDP V1/V5 (live-mode/waveformEditor не регрессировали; bootstrap V3 жив).
3. SHA256 frozen ДО/ПОСЛЕ идентичен.
4. Frozen-guard 🟢 GREEN (0 новых safe→frozen).
5. `rg -i "v2recovery|__restoreV2Engine" src js` → 0.
6. `grep -rn "live-mode.stub|waveform-editor.stub" src` → 0 (BAC-107).
7. BAC-109: `grep -rn "console\." src` вне `import.meta.env.DEV` → 0. BAC-110: placeholder заменён/задокументирован.

## РИСК-НОТЫ
- `blockEditor.service.ts`: удалён патч no-op stub; реальный `BlockEditorProxy` (`window.ModalBlockEditor`) не затронут.
- `camera-permission-resolved`: legacy CustomEvent только из `live-mode.stub.ts:9`; после удаления путь мёртв, живой V3-путь = typed publisher `ui.ts:7`.
- `mode-switch.bridge.ts:354` / `track.orchestrator.ts:88` (FROZEN) читают `window.waveformEditor` — null-safe no-op; НЕ трогаем.
- W3∩W5: `main.tsx:154` removal idempotent (если W3 первым → no-op).

## СТАТУС
FINAL (РЕШЕНО после doc-reconcile). Применение — post-M3-GO.
