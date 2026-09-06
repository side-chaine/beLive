# MICRO-PACK · D-4 · ФЛИП REACH В FAIL · hold-носитель + v0.4 + PULSE-хвост

**Прогон: 007-цепь 001→002→Оператор · Спека: 001 · Стресс: 002 (8 патчей внесены) · Дата: 2026-09-06 · Статус: к применению**
**Заказ:** CEO_1 GO 10:44 (D-4-флип) · Triage: TRIAGE-51-007 (51 = 18 H-2 + 6 H-3 + 4 H-4 + 3 H-5 + 12 H-6 + 8 H-1c, 0 живых)
**Канон:** tsc=190 · vitest 812/68 · reach=121 (70 H-1 + 51) · junction=3 локально/CI-grace=3 · HEAD 9a16d59

## 1. РЕШЕНИЕ (четыре дизайн-выбора 001 + патчи 002)

1. **Носитель = `scripts/reach-holdlist.json`** (по образцу inert-allowlist.json): 51 запись, поля member/class/reason/owner/until. Гейт: hold = reduced ∩ members · violations = reduced \ members · stale = members \ reduced (только warn). violations>0 → exit 1. Teeth: новый труп не в листе = красный деплой.
2. **H-1c-транзиты (8) — в hold-листе** с until=«решение по H-1c» (не расширение regex — вторая BFS отвергнута).
3. **Флип жёсткий в коде (v0.4)**, без env-флага: violations=0 на текущем дереве — grace не нужен. REACH_FAIL-дверь отвергнута.
4. **PULSE-строка = хвост verify-reach.mjs** (N-12, ed3ab7f): `PULSE · 6 gates = repo heartbeat` — латиницей [002-патч 4.1], всегда последняя строка, и при 0 и при exit 1. «6» = длина verify:ci-цепочки на момент флипа.

**Патчи 002 (обязательные, внесены):** ① нормализация путей: гейт печатает и сравнивает member в posix (`relative().split(sep).join('/')`) — win32-совместимость [удар 1.1] ② «violations>0 до пуша → СТОП + построчная сверка violation-путей с member» (замена эвристики ≈51) [удар 1.2] ③ разбивка hold-печати = агрегация class из листа, НЕ хардкод [удар 2] ④ канон-приёмка «на момент флипа» [удар 3] ⑤ load holdlist в try/catch → «holdlist: format break: <строка>» + exit 1 [удар 4.2] ⑥ печать списков: violations и hold — `  <posix-path>` (совместимость с probe-bundle.mjs:22, регекс `^\s{2}(\S+\.tsx?)$`); **stale — только счётчик в сводке, без голых путей** [удар 7: разрыв probe-bundle = молчаливая ложь] ⑦ git status чист перед push [удар 5, страховка].

## 2. НОСИТЕЛЬ: scripts/reach-holdlist.json (новый, 51 запись)

Формат: `{"version": 1, "note": "...", "members": [{"member": "src/…", "class": "H-2", "reason": "...", "owner": "...", "until": "..."}]}`. member = posix-путь, ровно как печатает гейт (нормализация — в гейте).

| class | N | owner | until | reason (кратко) |
|---|---|---|---|---|
| H-2 | 18 | 007 | снос-батч diagnostics по GO | ручные прогоны v6.32.x/207-305; консольная эпоха 006 |
| H-3 | 6 | Никита | выпуск с ИИ | Билли за isTrusted-гейтом |
| H-4 | 4 | Никита | обратная подмотка или явное решение | режим владельца 8bad1711 (TC-DOCK, 19.05) |
| H-5 | 3 | Никита | развилка: подключить/снести/держать | живой CF-воркер ↔ мёртвый фронт ленты |
| H-6 | 12 | 007 | снос-батч Д-2 по GO | 0 импортёров, чистые трупы |
| H-1c | 8 | 007 | решение по H-1c | достижимы только из тестов (слепота транзитивная) |

Правила: новая hold-запись = строка JSON (A-4); снос/лечение = та же правка удаляет запись (иначе stale-warn); дедуп Set при загрузке.

## 3. ИНТЕРПРЕТАТОР: verify-reach.mjs → v0.4 (один блок после строки reduced)

Блоки 1-4 + H-1-фильтр A-12 — не трогать. Добавить блок 5:
- **5a Load:** readFileSync(scripts/reach-holdlist.json) в try/catch: parse-ошибка → «holdlist: format break: <строка>» + exit 1. Дедуп member-ов (Set).
- **5b Split:** hold = reduced ∩ members · violations = reduced \ members · stale = members \ reduced.
- **5c Печать (probe-bundle-совместимо):** violations и hold — строки `  <posix-path>`; сводка: `verify-reach: <V> violations · hold: <N> (агрегация class из листа) · excluded (H-1 tests): 70 · stale: <S>`; stale — только счётчик, БЕЗ голых путей.
- **5d PULSE-хвост:** `PULSE · 6 gates = repo heartbeat` — всегда последняя строка.
- **5e Exit:** violations>0 → exit 1; stale — печать, не fail. Шапка файла: `Mode: fail (D-4), exit 1 on violations; hold-list = scripts/reach-holdlist.json`.
- **Нормализация:** relative(root, f) → posix при печати И при сравнении с member.

## 4. КНОПКИ / CI — БЕЗ ИЗМЕНЕНИЙ

verify:reach уже в verify:ci. package.json/deploy.yml не трогать.

## 5. ШАГИ ОПЕРАТОРА

1. Создать scripts/reach-holdlist.json — 51 запись (51 путь из текущего reduced-вывода гейта, классы/owner/until из §2).
2. verify-reach.mjs → v0.4 (блок 5 §3).
3. Приёмки ① → ② → ③(локальная) → ④; git status чист; НЕ КОММИТЬ (007 закоммитит).

## 6. ПРИЁМКИ (по порядку)

① **Флип-зелёность:** `node scripts/verify-reach.mjs; echo $?` → violations=0, exit 0, печать hold: 51 (18 H-2 · 6 H-3 · 4 H-4 · 3 H-5 · 12 H-6 · 8 H-1c) · excluded (H-1 tests): 70 · stale: 0 + PULSE-строка. **Если violations>0 до пуша → СТОП + построчная сверка violation-путей с member (гейт печатает каждый).**
② **Труп-ловушка:** создать `src/tomb-tmp.ts` (export const x = 1) → violations=1, exit 1 → удалить → violations=0. (`.txt` невидим — RE_EXT, ловушка ㊲.)
③ **Локальный CI-реп:** `JUNCTION_GRACE='wrangler-env-d1,vite-url-ai-worker,vite-url-worker-src' npm run verify:ci` → exit 0 (все 6 гейтов, junction под grace).
④ **Канон Δ0 (на момент флипа):** tsc=190 · vitest 812/68 · reach=121 (= 70 excluded + 51 hold + 0 violations) · junction=3/grace-3. Легитимный снос/лечение обновляет канон; триггер чистки листа — stale>0.

## 7. ЛОВУШКИ

㊳ win32-слэши — нормализация posix в гейте. ㊴ снос без чистки листа → stale-warn. ㊵ дубли → дедуп Set. ㊲ .txt-труп невидим. probe-bundle.mjs:22-совместимость: hold/violations с 2-пробельным отступом, stale без путей [002-удар 7]. PULSE латиницей [N-12 ed3ab7f]. Разбивка class = агрегация, не хардкод.

— 001+002 · 06.09 · D-4: носитель, флип, PULSE-хвост
