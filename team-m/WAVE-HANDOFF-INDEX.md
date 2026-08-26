# 🌊 WAVE-HANDOFF INDEX · 5 волн срезки Легаси (design, pre-GO)
> Far: 007_Мак. Hub: 007_Винда применяет post-M3-GO. Источник: FINAL-ROADMAP-draft.md §2 (001, вериф. 002/009).
> Принцип leaves-first: разрыв = править SAFE-файлы (перестать звать frozen), сами frozen-файлы НЕТРОНУТЫ. R6: исполнение ТОЛЬКО post-M3-GO по санкции Босса.

| Волна | Пак | Что режем (SAFE) | Frozen-блок |
|---|---|---|---|
| 1 | `MICRO-PACK-WAVE1.md` | activation chain App.tsx:93–101 → featureFlag → patchV1 (CUT BRANCH) | patchV1/AudioEngineV2 read-only |
| 2 | `MICRO-PACK-WAVE2.md` | delegateSync re-point ×13 caller; V2Interceptor-wrap до последнего caller | track.orchestrator режется в В4 |
| 3 | `MICRO-PACK-WAVE3.md` | __switchToV3/wrap/V2AudioCage/ResurrectionDetector/restore-ветка; ae-guard; BusFader18 §9 аннотация | — |
| 4 | `MICRO-PACK-WAVE4.md` | 6 потребителей track.actions; dyn-imports MixerPanel/QuickActions; bridges/*; legacy/* + V2Adapter (умер здесь) | track.orchestrator/patchV1/AudioEngineV2/bridges read-only |
| 5 | `MICRO-PACK-WAVE5.md` | 12 ридеров V2-глобалов; __restoreV2Engine удалить; фасад ОСТАЁТСЯ; доки | комментарии-V2 = retain-класс |

## Общий гейт каждой волны
канон 306/770 + PARITY PASS + boot-smoke CDP V1/V5 + SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен + ⛔-отчёт Ц3 + Frozen-guard GREEN (0 новых safe→frozen).

## Связь с Frozen-guard
`team-m/bLb/frozen-guard.mjs` (Босс GO) ловит НОВЫЕ safe→frozen импорты. Волны 4–5 уводят легитимные BAC-101..102 из allowlist — после них allowlist скрипта сузить (файлы больше не зовут frozen).

## Gate 3B
Не закрывается удалением V2 (продолжается на чистом репо Этапа 4, см. WAVE5 + GTRACK-SPEC-2026-08-25.md). Флип НЕ блокирует.

## Статус
5 паков оформлены как handoff (design). Ждут GO Босса на флип → Hub применяет цепью через 001/002/009.
