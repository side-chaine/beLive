# 🌊 MICRO-PACK-WAVE3 · demolition · handoff (design, FIXED per 009)
> Источник: FINAL-ROADMAP-draft.md §2 + вериф. 009 (26h). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/772; restore-ветка НЕ добавляет поведения (FALLBACK-pack b13de92 закрыл страховку); п.6 = аннотация, НЕ удаление (Д-4); ae-guard локацию подтвердить до правки.

## ЦЕЛЬ
Снести V2-демо-классы/обёртки (leaves-first): `__switchToV3`, `wrap`, `V2AudioCage`, `ResurrectionDetector`, restore-ветку. `ae-guard` — переориентировать/удалить (НЕ внутри `bridges/*` — проверить локацию до правки!).

## ПРАВИТЬ (SAFE)
- `__switchToV3`, `wrap`, `V2AudioCage`, `ResurrectionDetector` — удалить.
- restore-ветка: `main.tsx:186` (фасад :8–10) → crash-modal/reload (А18). Зависит от FALLBACK-pack `b13de92` в baseline — подтвердить его наличие до W3.
- `ae-guard` — найти литерал (grep), подтвердить НЕ в `bridges/*` (frozen); переориентировать на V3 или удалить.
- **п.6 (Д-4):** аннотация «музейного» describe `BusFader18 §9` — НЕ удаление (регресс-нетто pin-semantics живой). Контракт-зеркало-тест после W3.

## НЕ ТРОГАТЬ (Frozen)
Все frozen.

## ГЕЙТ
1. канон 306/772 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256 frozen ДО/ПОСЛЕ идентичен.
4. ⛔-отчёт Ц3.
5. `grep -rnE "(__switchToV3|V2AudioCage|ResurrectionDetector)" src` → 0.
6. BusFader18 §9 annotated; контракт-зеркало-тест green.

## ТЕСТЫ
- V3-boot failure → crash-modal (не тихий dead-zone, не restore V2).
- Регресс-нетто BusFader18 сохранён.
- Frozen-guard: 0 новых.

## СТАТУС
Дизайн (FIXED). Применение — post-M3-GO (R6).
