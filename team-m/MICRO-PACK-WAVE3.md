# 🌊 MICRO-PACK-WAVE3 · demolition · handoff (design)
> Источник: FINAL-ROADMAP-draft.md §2 Этап 3 Волна 3 (001, вериф. 002/009). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/770; restore-ветка НЕ добавляет поведения (страховка уже закрыта FALLBACK-pack b13de92); п.6 = аннотация, НЕ удаление (Д-4).

## ЦЕЛЬ
Снести V2-демо-классы/обёртки (leaves-first): `__switchToV3`, `wrap`, `V2AudioCage`, `ResurrectionDetector`, restore-ветку. Единственное поведенческое изменение — restore-ветка (`handleV3BootFailure` → crash-modal/reload вместо `__restoreV2Engine`), НЕ добавляет логики (страховка мертва на M3, закрыта FALLBACK-pack). `ae-guard` — перенести/заменить на V3-эквивалент.

## ПРАВИТЬ (SAFE-файлы)
- `__switchToV3`, `wrap`, `V2AudioCage`, `ResurrectionDetector` — удалить (мертвый V2-код).
- restore-ветка: `main.tsx:186` (фасад :8–10) → crash-modal/reload (A18). Только эта ветка меняет поведение деградации.
- `ae-guard` — переориентировать на V3 (или удалить, если дублирует V3-guard).
- **п.6 (Д-4):** аннотация «музейного» describe `BusFader18 §9` тем же паком — НЕ удаление (регресс-нетто pin-semantics остаётся живым). Тест после Волны 3 проверяет контракт-зеркало (полезный регресс).

## НЕ ТРОГАТЬ (Frozen)
Все frozen-файлы.

## ГЕЙТ ВОЛНЫ
1. канон-гейт 306/770 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен.
4. ⛔-отчёт Ц3.
5. `grep -rnE "(__switchToV3|V2AudioCage|ResurrectionDetector)" src` → 0.
6. BusFader18 §9 annotated (не удалён), контракт-зеркало-тест проходит.

## ТЕСТЫ
- V3-boot failure → crash-modal (не тихий dead-zone, не restore V2).
- Регресс-нетто BusFader18 сохранён (annotated test green).
- Frozen-guard: 0 новых.

## СТАТУС
Дизайн готов. Применение — post-M3-GO (R6). До GO — подготовка.
