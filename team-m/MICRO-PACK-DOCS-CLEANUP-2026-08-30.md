# MICRO-PACK · ПАКЕТ D: ЧИСТКА ДОКУМЕНТАЦИИ (docs-audit) · 2026-08-30
**Автор:** 707 (кадастр+прогоны) · Стресс: 002 (прогон #2) · Фураж: DOCS-AUDIT-MANIFEST-301
**Статус:** ЧЕРНОВИК-ГОТОВ · ЖДЁТ 🔴 Никиты (пакет в списке STEPS) · Исполняет 007 (rm по sshfs ломается — сносить на ПК)
**HEAD-SSOT на момент сборки:** `9b6bf83` · канон: tsc=293 🔴 · vitest=801 🟢 · PARITY PASS 🟢

## Двойная верификация (707 SSH + 002 стресс)
| Пункт | Манифест 301 | Прогон 707+002 | Вердикт |
|---|---|---|---|
| Дубли modernization | «21 пара, 266 КБ» | **22 файла IDENT** (sha256, 21/21 + REGISTRY-развилка) | ✅ снос целиком, включая REGISTRY-снимок мёртвого бранча |
| masks 17 PNG | «0 ссылок» | 17/17 пустых; 0 ссылок из src; НО css-скелёт `.masks-*` styles.css:4929-5108 + eslint:13 — сироты | ✅ SHIP (css-скелёт отдельным кандидатом, не блокер) |
| Мёртвые SHA | «6/6 мёртвых» | **2/6 мёртвых** (d5c66bd, b82468ae); 4 живые blobs | ⚠️ NOT tombstone вместо правок; 4 живых НЕ трогать |
| SONNET-дубль | «пара, 9.2 КБ» | IDENTICAL (cmp); внешняя ссылка только на BRIEFING- (GO-STATUS:6) | ✅ выживший = BRIEFING- |
| 02-ROADMAP «НЕ ИСПОЛНЯТЬ» | «в архив» | живые ссылки: REGISTRY.md:216, 04-bLb:366, 05-Ledger:92/171 | ✅ переезд + repoint 3 ссылок ОДНИМ коммитом |

## Порядок исполнения (007, после 🔴)
1. `git rm -r docs/modernization/handoff/docs/` (22 файла, включая REGISTRY-снимок; снимок мёртвого `067-e-regime-0` сохранён в истории + mission-zero.bundle)
2. Tombstone в `docs/modernization/handoff/00-README-007.md` §1.1 (1 строка: «копия снесена 30.08, актуальные файлы — в docs/modernization/»); tombstone про d5c66bd в шапке («HEAD не существует, дерево Hy4 — в mission-zero.bundle»)
3. `git rm public/img/masks/*.png` (17 нулевых) → смоук SW (precache-манифест меняется)
4. `git rm team-m/REPORT-TO-SONNET-VINDA-2026-08-26.md` (выживший — BRIEFING-)
5. `git mv docs/modernization/02-PROGRAM-ROADMAP.md docs/archive/superseded/` + repoint: REGISTRY.md:216 → 00-ROADMAP.md («полная карта» = живой 00-ROADMAP), 04-bLb-BRIEFING.md:366, 05-INITIATIVES-LEDGER.md:92/171 → архивный путь с пометкой
6. Гейты: tsc=293 (0 дельты) · vitest=801 · frozen-guard GREEN · сборка OK

## Опционально (в тот же 🔴, отдельным пунктом)
- Снос css-скелёта masks (styles.css:4929–5108, ~180 строк) + eslint.config.mjs:13 — «фича-призрак» до-чищается
- Снос 3 пустых research-файлов (venv-freeze×2 + probe-stdout)

## НЕЛЬЗЯ (002, зафиксировано)
- НЕ править строки 211/243–246 README-007 (живые SHA, истор. верификация) — только tombstone
- НЕ трогать GO-STATUS-2026-08-26.md (истор. письмо) — выживший дубль фиксируется в этом пакете
- НЕ сносить по списку «21» — только целиком handoff/docs/ (22)
