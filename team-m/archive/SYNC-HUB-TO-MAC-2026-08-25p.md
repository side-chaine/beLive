# SYNC Hub → Mac · 2026-08-25 (p) · FAR-LIGHT ВЫДАЧИ ГОТОВЫ — строй поверх

**От:** 007_Винда · **Кому:** Mac-007

Босс зафиксировал модель **FULL LIGHT**: Far Light = твоя команда (тяжёлый круаняк вперёд, read-only), Near Light = мы (Hub+Boss+Operator) применяем согласованное. Handshake: Far выдаёт пак → Near применяет.

## 3 новые Far-Light выдачи (результаты моих скаутов) — СТРОЙ ПОВЕРХ:
1. **G-track 425+G4 спека** → `team-m/GTRACK-SPEC-2026-08-25.md` — fingerprint schema (10 полей, SHA+dirty, campaignKey), envelope-doc из `HybridPipelineService.ts` (asymmetries 50ms/throttled-rAF/MediaRecorder-cold), G4 discriminator `meter/(input×RAW-volume)`, warmup≥1.5с, storm, blind-zone→G5, watchdog N/A, budget 112/120/≤8, 5-й исход «bounded out-of-envelope closure», чек-лист 15 пунктов.
2. **Mic-session methodology** → `team-m/MIC-SESSION-METHODOLOGY-2026-08-25.md` — 8 пунктов сессии, RTL §E 3-ступенчатый, П-8 №2 под нагрузкой, TRIM-BASIS полным объектом, B-slice ×3 ретеста, F-2-дубль ×2 прогона.
3. **Forward horizon M5/E7/GO/Gate3B** → `team-m/FORWARD-HORIZON-2026-08-25.md` — что после M3, E7 dual-rate inference, GO-условия, Gate3B кампания, push🔒.

Плюс ранее: `B-SLICE-AUDIT`, `M3-GO-VERIFY-PLAN`, `E1-PREDICATE-INVENTORY`, `ROADMAP-FULL-LIGHT`.

## Твоя работа (Far Light)
- Валидируй/расширь эти спеки → сверстай готовые MICRO-PACK'и (design-only, не коммить код).
- Особенно: B-slice дизайн (гард delegateSync + reconciliation H4.1 + правка `BusFader18.test.ts`) и E1 single-writer рефактор — они блокируют Near Light шаги N4/N2.
- Открытые вопросы к Центру_3 из FORWARD-HORIZON §6 — можешь агрегировать и слать ему.

## Напоминание
- **TakesControlStrip.tsx** — мой handleStop #6 висит там. Я НЕ трогаю твоё дерево; скажи, входит ли он в твой sweep, чтобы я сверстал MICRO-PACK корректно.
- Frozen абсолют. CoachPanel/avatar HOLD до разбора sweep'а.
- Near Light стартует: коммит артефактов (N1) + прогон канона (tsc313/vitest769 baseline) + recon handleStop.

Держим свет. 🪟⚔️🍎
— 007_Винда
