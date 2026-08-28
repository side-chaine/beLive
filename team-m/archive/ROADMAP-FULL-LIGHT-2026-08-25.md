# ROADMAP · FULL LIGHT (Ближний + Дальний Свет) · 2026-08-25

**Концепт (Босс):** две орбиты света вокруг одной миграции. Обе под контролем 007_Винда (Hub), связь с Маком постоянна (team-m/ письма), frozen/канон соблюдены.

- **Ближний Свет (Near Light)** = Hub (007_Винда) + Босс + Operator. Применяем СОГЛАСОВАННЫЕ, проработанные шаги: точечные коммиты, тесты, верификация канона 313/769. Правки делаем тут же.
- **Дальний Свет (Far Light)** = команда Мака. Прорабатывает СЛЕДУЮЩИЕ шаги (вперёд): тяжёлый анализ, спеки, дизайн, готовые MICRO-PACK'и. Read-only, код не коммитит.
- **Handshake:** Far Light выдаёт повёрстанный пак → Near Light применяет (MICRO-PACK → Operator → tsc313/vitest769 → ⛔-отчёт).

---

## БЛИЖНИЙ СВЕТ — что делаем СЕЙЧАС (Near Light, Hub+Boss+Operator)

| ID | Действие | Gate | Статус |
|----|----------|------|--------|
| N0 | `PLAN-v3.3-CANONICAL.md` в репо | — | ✅ `c9f5d44` |
| N1 | Коммит коорд/анализ-артефактов (Far Light выдачи) | tsc313/vitest769 | ⏳ этот заход |
| N2 | P1#6 handleStop — отдельный коммит (PC-зона `TakesControlStrip.tsx`) | ⛔ + canon | ⏳ ждёт подтверждения Мака (файл в его живом дереве?) |
| N3 | Верификация групп sweep'а Мака (каждая = коммит + canon 313/769 + ⛔-отчёт; аудио-ядро последним + CDP lvl2) | canon + CDP | ⏳ Мак ведёт коммиты, я верифицирую |
| N4 | Применение B-slice (`js/audio-facade-v3.js`): гард delegateSync + reconciliation H4.1 + правка `BusFader18.test.ts` | ⛔ + ears | ⏳ после sweep (п.5 карты); дизайн — Far Light |
| N5 | Mic-уши-сессия (после B-slice + F-2-дубль) | ears | ⏳ методология — Far Light |
| N6 | M3-GO по 18 строкам (§3) | canon + CDP + ears | ⏳ план верификации ГОТОВ (`M3-GO-VERIFY-PLAN`) |

**Констрейнт Near Light:** дерево Мака не трогаем (sshfs live-session); frozen абсолют; коммитим только согласованное + canon + ⛔-отчёт.

---

## ДАЛЬНИЙ СВЕТ — проработка вперёд (Far Light, команда Мака, read-only)

| Тема | Что прорабатывает | Статус | Выход → Near Light |
|------|-------------------|--------|--------------------|
| B-slice аудит | 4 члена фасада, V2Cage HIGH-риск глушения V3-стем, H4.1 premise break | ✅ готов (`B-SLICE-AUDIT-2026-08-25.md`) | дизайн гарда + правка BusFader18 тестов |
| E1 predicate canon | инвентарь: 1 writer (`main.tsx:150`), 0 конфликтов, алиасы read-only | ✅ готов (`E1-PREDICATE-INVENTORY-2026-08-25.md`) | дизайн single-writer рефактора |
| M3-GO verify plan | 18-шаг матрица + CDP V1–V10 + ⛔-гейты; дельты D1–D5 | ✅ готов (`M3-GO-VERIFY-PLAN-2026-08-25.md`) | готовый чек-лист под каждый ⛔ |
| G-track 425 + G4 | fingerprint schema, envelope-doc, discriminator, warmup ≥1.5с, runner unattended, budget 112/120/≤8, 5-й исход | ⏳ запущен | спека под кампанию измерений |
| Mic methodology (LATENCY §E) | RTL-golos, П-8 №2 под нагрузкой, TRIM-BASIS полный объект, B-slice ×3, F-2-дубль | ⏳ запущен | тест-план сессии |
| Forward horizon M5/E7/GO/Gate3B | что после M3 (dist-retention, dual-tag rollback, GO-условия, Gate 3B) | ⏳ запущен | дорожная карта финиша |
| YouTube layer §13.7 / asset character-AI | открытые вопросы Центра_3 | ⏳ очередь | спеки |

---

## ПРАВИЛА ОБОИХ СВЕТОВ
- **Frozen абсолют:** `AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-поля, vendor WASM. Любое упоминание «поправить frozen» = СТОП, вопрос юзеру.
- **Канон:** tsc = 313, vitest = 769 (2 legacy missing-import вне счёта). Новая ошибка вне `known-ts-errors` = регрессия.
- **Near Light** коммитит только согласованное + canon + ⛔-отчёт. Дерево Мака не трогаем.
- **Far Light:** только read-only анализ/спеки; коммиты кода — через Near Light (или sweep-группы Мака).
- **Связь:** 007_Винда ↔ Mac через `team-m/SYNC-HUB-TO-MAC-*`; всё под контролем.

— 007_Винда · Hub · Ближний Свет
