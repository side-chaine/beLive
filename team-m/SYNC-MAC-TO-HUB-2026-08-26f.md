# 📨 SYNC-MAC-TO-HUB · 2026-08-26f · WAVE-HANDOFF 1–5 готовы (design)
> От: 007_Мак (Far Light) · Кому: 007_Винда (Hub/Near Light) · СС: Босс

## ТЕМА: формальный handoff 5 волн срезки Легаси (вопрос A закрыт)
Босс дал полный свет («делай всё полезное»). Оформил 5 handoff-паков из `FINAL-ROADMAP-draft.md §2` (001, вериф. 002/009):

- `MICRO-PACK-WAVE1.md` — activation chain CUT (App.tsx:93–101 → featureFlag → patchV1; frozen read-only)
- `MICRO-PACK-WAVE2.md` — delegateSync re-point ×13 caller (V2Interceptor-wrap до последнего caller)
- `MICRO-PACK-WAVE3.md` — demolition (__switchToV3/wrap/V2AudioCage/ResurrectionDetector/restore-ветка; BusFader18 §9 аннотация, не удаление)
- `MICRO-PACK-WAVE4.md` — orchestrator/bridges/legacy (6 потребителей track.actions; V2Adapter умирает здесь; frozen read-only)
- `MICRO-PACK-WAVE5.md` — finalization (12 ридеров V2-глобалов; __restoreV2Engine удалить; фасад ОСТАЁТСЯ; Gate 3B продолжается)
- `WAVE-HANDOFF-INDEX.md` — сводная таблица + общий гейт + связь с Frozen-guard.

## ОБЩИЙ ГЕЙТ (каждой волны)
канон 306/770 + PARITY PASS + boot-smoke CDP V1/V5 + SHA256 frozen ДО/ПОСЛЕ идентичен + ⛔-отчёт Ц3 + Frozen-guard GREEN.

## КОНВЕЙЕР (твой)
Можешь заводить per-wave исполнение через цепь 001/002/009 ПОСЛЕ GO Босса на флип (R6). Сейчас — только дизайн/подготовка/ревью. Frozen-guard (`team-m/bLb/frozen-guard.mjs`) — гоняй ДО флипа как pre-flip gate.

## ДОП. ПОЛЕЗНОЕ (сделано в этом же заходе)
- Frozen-boundary guard v1 — отдан (26e), интегрируй как pre-flip gate.
- bLb концепт (GO_005) — РЕШЕНО post-m3 read-only; houses.yaml + city-gen.mjs ждут post-M3.

— 007_Мак 🍎 · «5 волн в кармане, жду GO на флип»
