# 🌊 WAVE-HANDOFF INDEX · 5 волн срезки Легаси (design, pre-GO)
> Far: 007_Мак. Hub: 007_Винда применяет post-M3-GO. Источник: FINAL-ROADMAP-draft.md §2 (001, вериф. 002/009). **FIXED per 009 re-verify (26h):** V2Adapter жив (26 importers (факт grep -rln=26)) → re-point W2 + delete W4 по grep→0; BAC-105 → W1; legacy `src/legacy/engine-v3/*`; BAC-107 → W5; live-guard НЕ moved.
> Принцип leaves-first: разрыв = править SAFE-файлы (перестать звать frozen), сами frozen-файлы НЕТРОНУТЫ. R6: исполнение ТОЛЬКО post-M3-GO по санкции Босса.

| Волна | Пак | Что режем (SAFE) | Frozen-блок |
|---|---|---|---|
| 1 | `MICRO-PACK-WAVE1.md` | activation cut (CUT BRANCH) + **BAC-105** 12 ридеров V2-глобалов re-point (перенесён сюда по REGISTRY §7:29) | patchV1/AudioEngineV2 read-only |
| 2 | `MICRO-PACK-WAVE2.md` | delegateSync re-point ×**21** caller + **V2Adapter** ×**26** импортёров re-point; V2Interceptor-wrap/V2Adapter до последнего caller | track.orchestrator режется в В4 |
| 3 | `MICRO-PACK-WAVE3.md` | __switchToV3/wrap/V2AudioCage/ResurrectionDetector/restore-ветка; ae-guard (НЕ в bridges!); BusFader18 §9 аннотация | — |
| 4 | `MICRO-PACK-WAVE4.md` | 6 потребителей track.actions; dyn-imports MixerPanel/QuickActions; **legacy ИСПРАВЛЕН: `src/legacy/engine-v3/*` (9 файлов (вкл. 2 test))**; V2Adapter удалить ТОЛЬКО если grep→0; **live-guard НЕ moved** | track.orchestrator/patchV1/AudioEngineV2/bridges read-only |
| 5 | `MICRO-PACK-WAVE5.md` | **BAC-107** (live-mode/waveformEditor stub + facade.ts:51 FIXME); __restoreV2Engine удалить; фасад ОСТАЁТСЯ; доки (BAC-105 уже в W1) | комментарии-V2 = retain-класс |

## Общий гейт каждой волны
канон 306/772 + PARITY PASS + boot-smoke CDP V1/V5 + SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен + ⛔-отчёт Ц3 + Frozen-guard GREEN (0 новых safe→frozen).

## Связь с Frozen-guard
`team-m/bLb/frozen-guard.mjs` (Босс GO) ловит НОВЫЕ safe→frozen импорты. Волны 4–5 уводят легитимные BAC-101..102 из allowlist — после них allowlist скрипта сузить (файлы больше не зовут frozen).

## Gate 3B
Не закрывается удалением V2 (продолжается на чистом репо Этапа 4, см. WAVE5 + GTRACK-SPEC-2026-08-25.md). Флип НЕ блокирует.

## Статус
5 паков оформлены как handoff (design). Ждут GO Босса на флип → Hub применяет цепью через 001/002/009.
