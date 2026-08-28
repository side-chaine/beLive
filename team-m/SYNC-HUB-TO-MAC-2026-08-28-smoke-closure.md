# SYNC Hub → Mac · 2026-08-28 · W3-SMOKE пройден + closure v2 ратифицирована

## Статус WIN-миграции (канон: tsc 302 / vitest 761+5int+2load / PARITY PASS / frozen-guard 🟢 GREEN)

1. **W3-SMOKE ПРОЙДЕН (уши Босса, 28.08):** простой `npm run dev` = V3; `__v3Active` false→true по дизайну; красный фейдер рулит music-bus; пер-стем фейдеры; `other` грузится где есть в данных (Breaking the Habit: 6 стемов). «From the Inside» не имеет `other` в stemsData — импорт до BAC-002-фикса, не баг (переимпорт решит).
2. **Регрессия W2b закрыта `3623882`:** мёртвый writer `__v3Active` (удалён в d0e31af) восстановлен цепью 001→002→009→001 (MICRO-PACK-V3ACTIVE-RESTORE): writer main.tsx:92-93 (bootstrap false + сеттер `active===true`) + P1-throw на тихий return play() в V3DataInterceptor. Гейты GREEN, frozen byte-identical. Очередь: P2 (coldSync re-arm), P3 (takes.duck MP-23) — отдельные микро-паки.
3. **Closure-таблица DRAFT v1 РАТИФИЦИРОВАНА (009, 28.08) → v2:** 11 из 18 закрыто (строки 9/12/18 закрыл W3-коммит `02e3ac9`; канон 302; якорь writer'а :92-93; цитаты C27/C28 перенесены в PARITY-LEDGER — записи созданы). Открыто до W4: строка 10 (W4 gate), 15 (mic-сессия остаток), CDP-строки 6/7/11. Файл обновлён: `team-m/CLOSURE-TABLE-M3-GO-2026-08-28.md` (v2).
4. **W4 разблокирован по чеклисту Ц3 4.5** (closure получена+ратифицирована; mic-уши-ядро ✅). Ждём GO Босса на старт W4 (остаток mic-сессии — на его усмотрение).

## К Маку
- Твой bLb/город-трек (architecture-doctrine `a7aab6a`, TRIGGER-PROTOCOL §11 `69970dc`) принят к сведению — не вмешиваемся, Босс в курсе.
- `src/` НЕ коммить: хвосты `src/js/ai/*` всё ещё незакоммичены на PC.
- Push CLOSED 🔒.

## Дальше (Hub)
1. GO Босса → W4 цепь (track.loader.ts NEW + DELETE legacy/engine-v3 ×9 + V2Adapter DEFER + M3-VERIFY gate).
2. Микро-паки P2/P3 в очереди.
