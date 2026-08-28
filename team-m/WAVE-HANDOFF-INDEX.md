# 🌊 WAVE-HANDOFF INDEX · 5 волн срезки Легаси (design, pre-GO)
> Far: 007_Мак. Hub: 007_Винда применяет post-M3-GO. Источник: FINAL-ROADMAP-draft.md §2 (001, вериф. 002/009). **FIXED per 009 re-verify (26h):** V2Adapter жив (27 importers (WAVE-PREFLIP-BASELINE.md; Mac grep 26)) → re-point W2 + delete W4 по grep→0; BAC-105 → W1; legacy `src/legacy/engine-v3/*`; BAC-107 → W5; live-guard НЕ moved.
> Принцип leaves-first: разрыв = править SAFE-файлы (перестать звать frozen), сами frozen-файлы НЕТРОНУТЫ. R6: исполнение ТОЛЬКО post-M3-GO по санкции Босса.

| Волна | Пак | Что режем (SAFE) | Frozen-блок |
|---|---|---|---|
| 1 | `MICRO-PACK-WAVE1.md` | activation cut (CUT BRANCH) + **BAC-105** 12 ридеров V2-глобалов re-point (9 safe-файлов, live) | patchV1/AudioEngineV2 read-only |
| 2 | `MICRO-PACK-WAVE2.md` | delegateSync re-point ×**23** caller + **V2Adapter** ×**27** импортёров re-point; V2Interceptor-wrap/V2Adapter до последнего caller | track.orchestrator режется в В4 |
| 3 | `MICRO-PACK-WAVE3.md` | __switchToV3/wrap(ae-guard, НЕ в bridges)/V2AudioCage/V2ResurrectionDetector/restore-ветка→crash-modal; **DuckGuardV3 + duck-guard.test.ts DELETE**; BusFader18 §9 аннотация (retain) | — |
| 4 | `MICRO-PACK-WAVE4.md` | `track.loader.ts` NEW (перенос loadTrack + ре-экспозиция globals) + re-point 3 importers (track.actions/MixerPanel/QuickActions) на track.loader; **DELETE legacy `src/legacy/engine-v3/*` (9)**; V2Adapter **DEFER** (grep≠0); **live-guard НЕ moved**; M3-VERIFY gate (dist-grep + positive-controls) | track.orchestrator/patchV1/AudioEngineV2/bridges read-only |
| 5 | `MICRO-PACK-WAVE5.md` | **BAC-107** (live-mode/waveformEditor stub + facade.ts:51 FIXME) + `blockEditor.service` patchWaveformEditor removal; __restoreV2Engine удалить; фасад ОСТАЁТСЯ; **BAC-109/110 W5** (hygiene/doc); доки (BAC-105 уже W1) | комментарии-V2 = retain-класс |

## Общий гейт каждой волны
канон 306/767+5int+2load + PARITY PASS + boot-smoke CDP V1/V5 + SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен + ⛔-отчёт Ц3 + Frozen-guard GREEN (0 новых safe→frozen).

## Связь с Frozen-guard
`team-m/bLb/frozen-guard.mjs` (Босс GO) ловит НОВЫЕ safe→frozen импорты. Волны 4–5 уводят легитимные BAC-101..102 из allowlist — после них allowlist скрипта сузить (файлы больше не зовут frozen).

## Gate 3B
Не закрывается удалением V2 (продолжается на чистом репо Этапа 4, см. WAVE5 + GTRACK-SPEC-2026-08-25.md). Флип НЕ блокирует.

## Статус
5 паков оформлены как handoff (design). Ждут GO Босса на флип → Hub применяет цепью через 001/002/009.
