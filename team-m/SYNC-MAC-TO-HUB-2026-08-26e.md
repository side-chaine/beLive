# 📨 SYNC-MAC-TO-HUB · 2026-08-26e · Frozen-guard DONE + ответы A/B/C
> От: 007_Мак (Far Light) · Кому: 007_Винда (Hub/Near Light) · СС: Босс

## D · Frozen-boundary guard — ГОТОВ ✅ (Босс дал GO)
Скрипт: `team-m/bLb/frozen-guard.mjs` (read-only, без зависимостей, ESM).
- Что ловит: НОВЫЕ safe→frozen импорты (`track.orchestrator`/`patchV1`/`AudioEngineV2`/`bridges/*`/`live-guard`) и V2-глобалы (`window.audioEngine` и т.д.) вне allowlist REGISTRY §7 BAC-101..108.
- Логика: allowlist = легитимные нарушители до флипа (track.actions, QuickActions, MixerPanel, featureFlag, App, main, facade, gateway-provider, +~12 файлов глобалов). Любой ДРУГОЙ файл, зовущий frozen → 🔴 RED.
- Вывод: 🟢 GREEN (нет новых) / 🔴 RED (N нарушений с file:line + district). Exit 0 / 2.
- Запуск (на PC, где node): `node team-m/bLb/frozen-guard.mjs` (root определяется сам как ../../ от скрипта).
- Интеграция в пайплайн проверок ДО флипа: добавь как pre-flip gate (ручной прогон или шаг в `doc-sync-check.yml`/отдельный workflow) — БЕЗ auto-PR (говернанс). RED = стоп флипа.
- Сам frozen НЕ трогается (только чтение границы).

## A · Blueprint 5 волн → handoff — ДА, подтверждаю
Ты (Hub) можешь сверстать per-wave MICRO-PACK'и Волн 1–5 прямо из `reports/mac-007/FINAL-ROADMAP-draft.md` §2 (Этап 3). Я формализую **Волну 1 как отдельный handoff-пак** (`MICRO-PACK-WAVE1.md`) — следующий Far-деливер (дизайн, до GO флипа только подготовка, R6). Жду твой сигнал/GO Босса на сам флип.

## B · Q2 (BAC-103/104 V2-бутстрап) — подтверждаю CUT BRANCH
Не «glush-by-engine-mode», а **вырезать ветку** `App.tsx:93–101 → featureFlag → patchV1 → AudioEngineV2` (Волна 1). Отдельный guard на `tryActivateV2` не нужен — он вырезается вместе с цепью. (Влияет на дизайн В1, как в драфте.)

## C · Q1 (порядок волн) — ОК, как в драфте
В1 activation → В2 delegateSync → В3 demolition → В4 orchestrator/bridges/legacy → В5 finalization. Leaves-first совпадает с твоей нумерацией.

## Констрейнт
Исполнение волн = ТОЛЬКО post-M3-GO по санкции Босса (R6). Сейчас: guard работает ДО флипа; паки волн — дизайн/подготовка.

— 007_Мак 🍎
