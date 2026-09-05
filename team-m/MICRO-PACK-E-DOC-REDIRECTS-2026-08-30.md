# MICRO-PACK · ПАКЕТ E v2.0: ДОК-РЕДИРЕКТЫ (doc-redirects) · 2026-08-30

**Автор:** 003 (Док_Аудит, по карте DOC-SYNC-MAP-2026-08-30) · **Стресс:** 002 — вердикт «ТРЕБУЕТ ПАТЧА» (12 условий) → **все 12 внесены в v2.0** · **Фураж:** DOC-SYNC-MAP (6/6 батчей, 548 единиц, 17 скаутов)
**Статус:** ЧЕРНОВИК-СПЕКА (спека для 007 — НЕ ПРИМЕНЯТЬ до 🔴 Никиты / GO 200; 003 ничего не правит по bootstrap §5)
**HEAD-SSOT на момент сборки:** `943356e` · канон: tsc=293 🔴 · vitest=808+0int+0load 🟢 (69 файлов) · PARITY PASS 🟢 · frozen 21×SHA

**v2.0-чейнджлог (по 12 условиям стресс-прогона 002, факт-чек 003 подтвердил все споры):**
1. E2-2 переписан: правка шапки :8-10 (реальный дрейф), :585-599 НЕ трогать (живое дерево уже чинено)
2. E2-9 вычеркнут (фантом: «Было» в feed.md не существует — путь валиден как указан)
3. E2-10 расщеплён: central-bridge:42 — оставить; zip:503 — ВЫЧЕРКНУТ (живой путь belive-feed-bot); init-registry:39 — переформулирован под реальный битый путь (initRegistry.test.ts не существует)
4. E2-6 ограничен :868; :1045-1059 — перенесён в отложенный rewrite (путь-своп под мёртвым перечнем = новый дрейф)
5. E2-8 сокращён до :1252; :52 не трогать (исторический контраст)
6. E1-5 дополнен DOMAIN-OWNERSHIP.yaml:82 (третий входящий, живая матрица владения)
7. E1-3 repoint-список очищен от цитат-провенанса (WAR-ROOM:98, answers-l-m:15 вычеркнуты)
8. E1-8 redirect-цель → docs/architecture/auth-system.md; пометка про REGISTRY:61 «Canonical protocol»
9. Явный список «остающихся по НЕЛЬЗЯ» ссылок (SSOT-хвосты) добавлен
10. Gate-3 → whitelist-гейт (ожидаемые хиты перечислены)
11. E5-дельта-25 расшифрована (handoff-дубли + vindа-смешанные)
12. E2-7 дополнен takes-system:193; frozen-zones-v2:59 — помечен; gate-6 расширен

**Принцип пака:** трупы НЕ сносим — каждому кладём _redirect-заголовок (3 строки HISTORICAL) и repoint живых входящих. Снос файлов = отдельные 🔴 (пакет D у 707 + STORAGE-POLICY). E ≠ D: D сносит дубли/masks/02-ROADMAP; E — перенаправляет трафик документации. Пересечений с D нет.

**Урок 003 (в реестр, честно):** v1.0 содержала 5 фантомных «Было» из 12 — клеймы скаутов были положены в спеку без повторного факт-чека строк. Правило усилено: **всякий file:line в спеку — только после sed/rg-верификации 003, скаут-клейм ≠ строка-факт.**

---

## E-1. Трупы → _redirect-заголовки (7 файлов) + slot-matrix (3 правки)

Формат заголовка (после H1, перед телом):
```
> 🗄️ **HISTORICAL (redirect 30.08):** этот док закрыт. Живая правда — `team-m/SHARED-REGISTRY.md` §0 (+ куда: см. ниже). Карта вердиктов — `team-m/DOC-SYNC-MAP-2026-08-30.md`.
```

**Исполнительный список:**

| # | Файл | Почему труп (доказательство из карты) | Редирект-куда + repoint живых входящих |
|---|---|---|
| E1-1 | `docs/MAC-PC-BRIDGE-SPEC.md` | «активно с 08-23», но топология/роли/протоколы полностью перекрыты SHARED-REGISTRY §0 (30.08, GO Никиты) — дупликат канала | → SHARED-REGISTRY §0; repoint: team-m/OPERATING-RULES.md, team-m/WEB-CHAIN-PACK.md, docs/modernization/11-REGISTRY-REPLY.md; BRIEFING-V007-TO-M007.md:49 — **кросс-строка E1-1/E1-2** (одна правка закрывает оба) |
| E1-2 | `docs/SYSTEM-REPORT-V007.md` | одноразовый отчёт «СИСТЕМА ЕДИНА» от 08-23 | → SHARED-REGISTRY §0; repoint: team-m/OPERATING-RULES.md, team-m/BRIEFING-V007-TO-M007.md (включая кросс-строку :49) |
| E1-3 | `agent-registry/006-007-registry.md` | внутренний реестр закрытого канала 006↔007 (эра 22-24.08, M3-GO 12.08, канал закрыт) | → team-m/REGISTRY.md (SSOT 007); repoint: agent-registry/006-BRIEFING.md:6 (навигационная строка); ⚠️ НЕ трогать цитаты-провенанс: MIGRATION-WAR-ROOM.md:98, answers-l-m-sweep-groups.md:15 (исторические находки 009/DONE-записи — фальсифицировать историю нельзя) |
| E1-3a | `docs/TC-094-095-BATCH-REPORT.md` | 0 входящих; 4 мёртвых пути (:285-290); одноразовый TC-отчёт 06-30 | → SHARED-REGISTRY (repoint не нужен: 0 входящих) |
| E1-5 | `docs/architecture/slot-matrix-system-v2.2.md` — ⚠️ ОСОБЫЙ: _redirect-заголовок НЕ добавлять (H1 уже «Do NOT use») | сам запрещает себя, но живые индексы на него ведут | **3 правки индексов:** ① README.md:181 удалить строку ② docs/INDEX.md:29 удалить строку ③ **docs/governance/DOMAIN-OWNERSHIP.yaml:82** — path-строку на живой док (или решение 200 о статусе матрицы); rewrite-фронт 007 (после Этапа-1 города) |
| E1-6 | `docs/team-m-sync-proposal.md` | предложение Cross-Team Sync 08-23 — принято и превзойдено SHARED-REGISTRY (OWNER-таблица, beLive-bridge SSOT) | → SHARED-REGISTRY §0; входящие (10) — исторические, repoint факультативно по решению 200 |
| E1-7 | `docs/team-m-setup-prompt.md` `docs/team-m-setup-prompt.md` | setup-промт эры настройки моста; инбокс-синк поглощён SHARED-REGISTRY | → SHARED-REGISTRY §0; входящие (5) — исторические аудиты/брифинги |
| E1-8 | `docs/product-protocol-v2.1.md` | протокол v2.1 (06-07); error-коды AUTH_CONFIG_ERROR/AUTH_TOKEN_EXPIRED в коде НЕ найдены (rg пуст); шапка линкует архивные 2.2-доки | _redirect + 🔴-решение: git mv в docs/archive/superseded/ (по паттерну #15, рядом с 02-ROADMAP из пака D); **redirect-цель: docs/architecture/auth-system.md** (живой носитель auth-контрактов; SHARED-REGISTRY §0 — только для процессов) |

**Спец-пометки (защита от ложного применения):**
- `docs/auth-system-freeze.md` — НЕ труп и НЕ в паке (осознанный FROZEN-снапшот; user.types.ts:6 подтверждён).
- **«Остающиеся по НЕЛЬЗЯ» (SSOT-хвосты — превращены из дыр в задокументированное поведение; ловятся _redirect-шапками, тут и живут):** team-m/REGISTRY.md:61 («Sync spec: SYNC-PROTOCOL + MAC-PC-BRIDGE-SPEC»), :119 (canonical protocol: product-protocol-v2.1), :123, :157 (GTRACK-битый путь — очередь 200), :219; team-m/BRIEFING-V007-TO-M007.md:49 (кросс-строка, обрабатывается в E1-1/E1-2).
- **карта-фураж (DOC-SYNC-MAP) корректируется 003 синхронно с этим паком:** строка product-protocol-v2.1 (батч-2: РАСХОДИТСЯ → труп+redirect+mv после стресса подтверждён 002 и факт-чеком 003) и строка feed.md (минор: «src/feed/» → аннотировано как валидное, E2-9 вычеркнут).

---

## E-2. Минор-пакет точечных правок путей (12 строк; 5 фантомов v1 вычищено стресс-прогоном 002)

| # | Файл:строка | Было → Стало | Доказательство |
|---|---|---|---|
| E2-1 | character-layer.md:23-48 | `js/ai/settings/ai-settings.store`, `js/ai/registry`, `character/sound`, `__tests__/layer2-report-emitter` → добавить префикс `src/` (список строк: 23, 30, 31, 35×2, 41) | скаут-A + 002: :23 вне диапазона v1 |
| E2-2 | auth-system.md:8-10 (шапка) | `protocol-v2.1.md` → «см. docs/archive/superseded/ (после mv из E1-8) или auth-system.md»; `interaction-schema-2.2.md`, `architecture-map-2.2.md` → пометить «архивные, см. docs/archive/superseded/» | 002: реальный остаточный дрейф в шапке; :585-599 — живое дерево уже чинено (gateway-пути корректны), НЕ трогать |
| E2-2b | eventbus-v2.md:42 | «1 активен wrapper» → «~19 wrappers в активном использовании» | скаут-B |
| E2-4 | transport-v3.md:53-55 | `engine-v3/TransportV3.ts` → `engine-v3/core/TransportV3.ts`; `engine-v3/types.ts` → `engine-v3/core/types.ts` | скаут-A |
| E2-5 | audio-engine.md:868 | `src/audio/store/audioStore.ts` → `src/stores/audio.store.ts` | скаут-A |
| E2-6 | takes-system.md:227 **и :193** + show-architecture.md:475 | `takes.bridge.ts` → `takes.store.ts` + `takes.duck.ts`; `trigger.bridge.ts` → `trigger.bus.ts` / `trigger.store.ts` | скаут-A + 002-находка: вторая ссылка :193 |
| E2-7 | exercises-system.md:1252 | битая ссылка на sync-monitor-pitch-integration.md (не существует) → **пометить PLANNED** (сохраняет смысл абзаца L3+ roadmap) | скаут-A + 002: выбор однозначен |
| E2-3 | metrics-system.md:207-211 | `metrics.bridge.ts` → `metrics-sync.service.ts` (+ stores/metrics.store.ts); `src/handlers/metrics.ts` → `gateway/src/handlers/metrics.ts` | скаут-A + факт-чек 003 |
| E2-11 | billi-ai-expert-system.md:154 | `js/ai/providers/` → `src/js/ai/providers/` | скаут-A |
| E2-12 | block-first-lyrics-sync.md:515 | битая ссылка на sync-accuracy-roadmap.md (не было) → **пометить PLANNED** | скаут-A + 002: выбор однозначен |
| E2-10a | central-bridge.md:42 | тест-путь `__tests__/stem-engine-sync.test.ts` → `src/foundation/reactions/__tests__/stem-engine-sync.test.ts` | скаут-A |
| E2-10b | init-registry.md:39 | `src/foundation/registry/__tests__/initRegistry.test.ts` (тест НЕ существует, glob пуст) → удалить строку теста | 002-верификация: реальный битый путь |

**Отложенный rewrite (НЕ этот пак; из очереди правок топ-6, после Этапа-1 города):** transport-v3.md + audio-engine.md — устаревшие ПЕРЕЧНИ модулей engine-v3 (5 фантомных модулей, «7» ≠ ~30+, пути :1045-1059 под мёртвым «Archived (7)») — переписывать составы после города.

---

## E-3. INDEX.md — дополнение 4 новыми доками + дата + битые строки

В `docs/INDEX.md`:
1. Добавить 4 строки (в architecture-секцию, по образцу существующих):
```
| [eventbus-v2](architecture/eventbus-v2.md) | EventBus v2 — типиз. шина, 6 каналов |
| [frozen-zones-v2](architecture/frozen-zones-v2.md) | Frozen Zones v2 — карта неприкасаемых |
| [feed-social-v2](architecture/feed-social-v2.md) | Social Layer v2 — Wave 2 |
| [transport-v3](architecture/transport-v3.md) | Transport V3 — синглтон, 5 состояний |
```
2. Обновить «Last updated: 2026-06-10» → фактическая дата применения E.
3. Строку :74 (team-m/SYNC-HUB-TO-MAC-2026-08-25.md → переехал в team-m/archive/) → поправить на архивный путь.
4. (002-дополнение списком, НЕ расширяя пак): INDEX не видит ещё 8 живых доков (avatar-visual-engine, character-layer, central-bridge, metrics-system, init-registry, lrc-parser-service, architecture-doctrine, LATENCY-REGISTRY); битые строки: :27 (scenario-stage → файл в superseded/), :56 (ARCH-BASE.md — отсутствует), :59 (protocol-v2.1.md — отсутствует до mv E1-8). **Эти 8+3 — кандидат в E-контент по GO 200, но в этом паке только 4 строки.**

---

## E-4. GTRACK-SPEC — вариант Б (правка 2 строк в CONTEXT.md)

`team-m/archive/GTRACK-SPEC-2026-08-25.md` — живая спека, design-refs/CONTEXT.md:29,66 цитирует её поля как действующие (Этап-1 «Каталог DNA»), но путь битый (корневой).
**Правка:** в `team-m/design-refs/CONTEXT.md:29` и `:66` — путь → `team-m/archive/GTRACK-SPEC-2026-08-25.md` + пометка «спека жива, хранится в архиве».
**Пометка для 200:** `team-m/REGISTRY.md:157` тоже даёт битый корневой путь того же файла — опер-актив (НЕЛЬЗЯ), в очередь 200 отдельной строкой.

---

## E-4b. FRONTS.md (декрет-хвост) — кандидат вне скоупа, на решение 200

FRONTS.md — эра M3-дуэта (rg «город|кадастр|bLb» = 0), декрет 21:00 не отражён. НО: FRONTS — опер-актив команды (НЕЛЬЗЯ без слова 200). **003 предлагает:** пометить шапку «HISTORICAL (M3-эра); актуальная карта фронтов — ROADMAP-REPO-TO-CITY + SHARED-REGISTRY». Решение — 200, исполнение — 007.

---

## E-5. Стата для города (фураж 707 → v0.3.2) — расшифрованная

| Метрика | Значение |
|---|---|
| Проверено единиц | 548 (+2 опер-реестра; 571 зоны минус 23 опер-актива) |
| Единиц с индивидуальным вердиктом | **523** (поштучно: КАНОН 101 + АРХИВ 382 + ТРУП 22 + РАСХОДИТСЯ 18) |
| Дельта-25 (агрегированные) | ~21 дубликат handoff/docs (батч-3, статус присвоен агрегатной строкой) + 11 city-recon 007-vinda «СМЕШАННО» (батч-5, счёт пересечений) — минус мета-доки (карта/пак/SHARED-лог) |
| КАНОН/живые | 101 → этажи «канона» |
| АРХИВ/эры | ~382 → этажи «архива» |
| Трубы/кандидаты | 22 (7 redirect в E1 + slot-matrix-кейс + 14 🔴 STORAGE-POLICY: untracked, draфты, GO-задачи) |
| РАСХОДИТСЯ | 18 (топ-10 сдан 21:04) |
| Ghost-floors | 71 untracked .md (docs/sync 47 + docs/agents 7 + agents-hub 17) — 🔴 STORAGE-POLICY, вне пака |
| Ещё данные v0.3.2 (из карты) | GTRACK-возврат (E-4) · REGISTRY-SSOT отстал (28.08) · houses.yaml v0.3.1-стэйт ждёт коммита · VINDA-дубль (пак D) |

---

## Гейты применения (для 007, после 🔴/GO)

1. `tsc=293` (0 дельты — правки только .md + 1 yaml)
2. `vitest=808+0int+0load` (69 файлов — тесты не затронуты)
3. **Whitelist-гейт (v2.0):** `git grep -n "MAC-PC-BRIDGE-SPEC\|SYSTEM-REPORT-V007\|006-007-registry"` → хиты разрешены ТОЛЬКО: ① в самих _redirect-файлах ② в team-m/archive/, docs/operations/archive/ (истор.) ③ в опер-активах из списка «остающиеся по НЕЛЬЗЯ» (REGISTRY:61/119/123/157/219 + BRIEFING:49) ④ в мета-доках (DOC-SYNC-MAP, MICRO-PACK-E сам, SHARED-LOG, NEW-SONNET-MEGA-PACK-указатель, AUDIT-mac, FORWARD-HORIZON, sweep-patch, answers-l-m, character-ai-status, BRIEFING-MAC-007:5). Любой хит вне whitelist = FAIL.
4. Смоук: docs/INDEX.md открывается; 4 новые строки на месте; «Last updated» обновлён; строка slot-matrix удалена из README + INDEX; **+ открыть 3-4 изменённых доков (E2-зона) — заголовки/пути на месте** (усиление 002)
5. frozen-guard GREEN (правки только .md/yaml)
6. Дымовой grep: `rg -n "src/handlers/|audio/store/audioStore|src/legacy/engine-v3" docs/architecture/` → пусто; **расширено (002):** `rg "takes.bridge|trigger.bridge|takes/exercise" docs/architecture/` → пусто, КРОМЕ frozen-zones-v2.md:59 (пометка E2-6, отдельная строка, решение 200) и архивных (interaction-schema-2.1, architecture-map-2.1 — фантомы честно архивны)

## НЕЛЬЗЯ (v2.0)

- НЕ сносить файлы (снос — пак D + STORAGE-POLICY; E только перенаправляет)
- НЕ трогать team-m/REGISTRY.md, SHARED-redirect-REGISTRY.md, INBOX.md, SHARED-REGISTRY.md, FRONTS.md (опер-активы; SSOT-хвосты — задокументированы, не правятся)
- НЕ переносить файлы из team-m/archive/ (E-4 = правка 2 строк CONTEXT.md, НЕ git mv)
- НЕ трогать FROZEN-зону и код (пак — только .md/yaml)
- repoint — только навигационные строки из списков E1; **исторические цитаты-провенанс в ЛЮБЫХ зонах не трогать** (WAR-ROOM:98, answers-l-m:15 — вычеркнуты из repoint)
- slot-matrix: НЕ добавлять _redirect-заголовок — только 3 правки индексов (README:181, INDEX:29, DOMAIN-OWNERSHIP:82)
- auth-system-freeze.md НЕ трогать (живой FROZEN-снапшот)
- auth-system.md:585-599 НЕ трогать (живое дерево уже чинено)
- E2-8/:52 — не трогать (исторический контраст)

## Маршрут пака

Сборка: 003 (спека, не применяет) → стресс 002 «ТРЕБУЕТ ПАТЧА» → **v2.0 с 12 условиями внесена** → приём 200 (включение в очередь) → 007 (исполнение по канону) → 🔴 Никита (финальный GO на применение).

**Текущий статус:** v2.0 готов к приёму 200.

— 003 · Док_Аудит · 2026-08-30
