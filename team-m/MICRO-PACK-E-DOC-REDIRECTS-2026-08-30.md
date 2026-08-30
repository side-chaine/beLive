# MICRO-PACK · ПАКЕТ E: ДОК-РЕДИРЕКТЫ (doc-redirects) · 2026-08-30

**Автор:** 003 (Док_Аудит, по карте DOC-SYNC-MAP-2026-08-30) · **Стресс:** 002 (прогон следом) · **Фураж:** DOC-SYNC-MAP (6/6 батчей, 548 единиц, 17 скаутов)
**Статус:** ЧЕРНОВИК-СПЕКА (спека для 007 — НЕ ПРИМЕНЯТЬ до 🔴 Никиты / GO 200; 003 ничего не правит по bootstrap §5)
**HEAD-SSOT на момент сборки:** `943356e` · канон: tsc=293 🔴 · vitest=808+0int+0load 🟢 (69 файлов) · PARITY PASS 🟢 · frozen 21×SHA
**Самокоррекция 003:** черновик-1 содержал мусорные строки (опечатки в терминах, дубль-нумерация) — вычищен до диспатча 002; приманки-«тесты внимательности» из спеки УДАЛЕНЫ (Оператор применяет буквально, спека должна быть чистой).

**Принцип пака:** трупы НЕ сносим — каждому кладём _redirect-заголовок (3 строки HISTORICAL) и repoint живых входящих. Снос файлов = отдельные 🔴 (пакет D у 707 + STORAGE-POLICY). E ≠ D: D сносит дубли/masks/02-ROADMAP; E — перенаправляет трафик документации. Пересечений с D нет (VINDA-дубль и handoff/docs — в D).

---

## E-1. Трупы → _redirect-заголовки (7 файлов) + slot-matrix (2 правки индексов)

Формат заголовка (после H1, перед телом):
```
> 🗄️ **HISTORICAL (redirect 30.08):** этот док закрыт. Живая правда — `team-m/SHARED-REGISTRY.md` §0 (+ куда: см. ниже). Карта вердиктов — `team-m/DOC-SYNC-MAP-2026-08-30.md`.
```

**Исполнительный список (8 пунктов):**

| # | Файл | Почему труп (доказательство из карты) | Редирект-куда + repoint живых входящих |
|---|---|---|---|
| E1-1 | `docs/MAC-PC-BRIDGE-SPEC.md` | «активно с 08-23», но топология/роли/протоколы полностью перекрыты SHARED-REGISTRY §0 (30.08, GO Никиты) — дупликат канала | → SHARED-REGISTRY §0; repoint: team-m/OPERATING-RULES.md, team-m/WEB-CHAIN-PACK.md, docs/modernization/11-REGISTRY-REPLY.md |
| E1-2 | `docs/SYSTEM-REPORT-V007.md` | одноразовый отчёт «СИСТЕМА ЕДИНА» от 08-23 | → SHARED-REGISTRY §0; repoint: team-m/OPERATING-RULES.md, team-m/BRIEFING-V007-TO-M007.md |
| E1-3 | `agent-registry/006-007-registry.md` | внутренний реестр закрытого канала 006↔007 (эра 22-24.08, M3-GO 28.08) | → team-m/REGISTRY.md (SSOT 007); repoint: agent-registry/MIGRATION-WAR-ROOM.md:98, agent-registry/006-BRIEFING.md:6, team-m/WEB-CHAIN-PACK.md:60, team-m/reports/mac-007/answers-l-m-sweep-groups.md:15 |
| E1-4 | `docs/TC-094-095-BATCH-REPORT.md` | 0 входящих; 4 мёртвых пути (док:285-290); одноразовый TC-отчёт 06-30 | → SHARED-REGISTRY (repoint не нужен: 0 входящих) |
| E1-5 | `docs/architecture/slot-matrix-system-v2.2.md` — ⚠️ ОСОБЫЙ: _redirect-заголовок НЕ добавлять (H1 уже «Do NOT use», L1/L9) | сам запрещает себя, но README.md:181 + docs/INDEX.md:29 на него ссылаются | **2 правки индексов:** удалить строку из README.md:181 и docs/INDEX.md:29; rewrite-фронт 007 (после Этапа-1 города) |
| E1-6 | `docs/team-m-sync-proposal.md` | предложение Cross-Team Sync 08-23 — принято и превзойдено SHARED-REGISTRY (OWNER-таблица, beLive-bridge SSOT) | → SHARED-REGISTRY §0; 10 входящих исторические — repoint факультативно по решению 200 |
| E1-7 | `docs/team-m-setup-prompt.md` | setup-промт эры настройки моста; инбокс-синк поглощён SHARED-REGISTRY | → SHARED-REGISTRY §0; входящие (5) — исторические аудиты/брифинги |
| E1-8 | `docs/product-protocol-v2.1.md` | протокол v2.1 (06-07); error-коды AUTH_CONFIG_ERROR/AUTH_TOKEN_EXPIRED в коде НЕ найдены (rg пуст); шапка линкует архивные 2.2-доки | _redirect + 🔴-решение: git mv в docs/archive/superseded/ (по паттерну #15, рядом с 02-ROADMAP из пака D) |

**Спец-пометка (в защиту от ложного применения):** `docs/auth-system-freeze.md` — НЕ труп и НЕ в этом паке (осознанный FROZEN-снапшот; клейм user.types.ts:6 подтверждён точно). `docs/ARCH-BASE.md`-класс и живые канон-доки — не трогать.

---

## E-2. Минор-пакет точечных правок путей (12)

| # | Файл:строка | Было → Стало | Доказательство |
|---|---|---|---|
| E2-1 | docs/architecture/character-layer.md:30-48 (×6) | `js/ai/settings/ai-settings.store`, `js/ai/registry`, `character/sound`, `__tests__/layer2-report-emitter` → добавить префикс `src/` | скаут-A: 6 мёртвых путей (префикс опущен) |
| E2-2 | docs/architecture/auth-system.md:585-599 | `src/handlers/auth.ts` → `gateway/src/handlers/auth.ts`; `src/index.ts` → `src/main.tsx`; строку про `src/auth/jwt.ts` пометить «backend-концепт, вне репо» | факт-чек 003: handlers живут в gateway/ |
| E2-3 | docs/architecture/metrics-system.md:207-211 | `metrics.bridge.ts` → `metrics-sync.service.ts` (+ stores/metrics.store.ts); `src/handlers/metrics.ts` → `gateway/src/handlers/metrics.ts` | скаут-A + факт-чек 003 |
| E2-4 | docs/architecture/eventbus-v2.md:42 | «1 активен wrapper» → «~19 wrappers в активном использовании» | скаут-B |
| E2-5 | docs/architecture/transport-v3.md:53-55 | `engine-v3/TransportV3.ts` → `engine-v3/core/TransportV3.ts`; `engine-v3/types.ts` → `engine-v3/core/types.ts` | скаут-A |
| E2-6 | docs/architecture/audio-engine.md:868, 1045-1059 | `src/audio/store/audioStore.ts` → `src/stores/audio.store.ts`; `src/legacy/engine-v3/` → `src/audio/engine-v3/` | скаут-A |
| E2-7 | docs/architecture/takes-system.md:227 + show-architecture.md:475 | `takes.bridge.ts` → `takes.store.ts` + `takes.duck.ts`; `trigger.bridge.ts` → `trigger.bus.ts` / `trigger.store.ts` | скаут-A |
| E2-8 | docs/architecture/exercises-system.md:52, 1252 | `src/takes/exercise/` → `src/exercises/`; битая ссылка на sync-monitor-pitch-integration.md (не существует) → удалить | скаут-A |
| E2-9 | docs/domain/feed.md | «src/feed/» → «src/catalog/feed/» (3 stores живут там) | факт-чек 003 |
| E2-10 | docs/architecture/zip-pipeline.md:503 + init-registry.md:39 + central-bridge.md:42 | `src/index.ts` → `src/main.tsx`; тест-путь `__tests__/stem-engine-sync.test.ts` → `src/foundation/reactions/__tests__/stem-engine-sync.test.ts` | скаут-A |
| E2-11 | docs/architecture/billi-ai-expert-system.md:154 | `js/ai/providers/` → `src/js/ai/providers/` | скаут-A |
| E2-12 | docs/architecture/block-first-lyrics-sync.md:515 | битая ссылка на sync-accuracy-roadmap.md (не существует) → удалить или пометить PLANNED | скаут-A |

**Дополнительная заметка 007 (НЕ правка этого пака):** transport-v3.md и audio-engine.md содержат устаревшие ПЕРЕЧНИ модулей engine-v3 (5 фантомных модулей, «7» ≠ ~30+) — это РАСХОДИТСЯ-топ-6 из очереди правок, переписывать составы после Этапа-1 города (Э-пак правит только пути, не содержание).

---

## E-3. INDEX.md — дополнение 4 новыми доками + дата

В `docs/INDEX.md` добавить строки (по образцу существующих, рядом с architecture-секцией):
```
| [eventbus-v2](architecture/eventbus-v2.md) | EventBus v2 — типиз. шина, 6 каналов |
| [frozen-zones-v2](architecture/frozen-zones-v2.md) | Frozen Zones v2 — карта неприкасаемых |
| [feed-social-v2](architecture/feed-social-v2.md) | Social Layer v2 — Wave 2 |
| [transport-v3](architecture/transport-v3.md) | Transport V3 — синглтон, 5 состояний |
```
+ Обновить «Last updated: 2026-06-10» → фактическая дата применения E.
+ Пункт из карты: строка INDEX.md:74 ведёт на team-m/SYNC-HUB-TO-MAC-2026-08-25.md (файл переехал в team-m/archive/) → поправить путь на архивный.

---

## E-4. GTRACK-SPEC — живая спека в архиве (вариант Б: правка ссылок)

`team-m/archive/GTRACK-SPEC-2026-08-25.md` — живая спека (design-refs/CONTEXT.md:29,66 цитирует её поля как действующие для Этапа-1 «Каталог DNA»), но CONTEXT даёт битый корневой путь.
**Правка (рекомендация 003 — вариант Б, не переносить файл):** в `team-m/design-refs/CONTEXT.md:29` и `:66` путь → `team-m/archive/GTRACK-SPEC-2026-08-25.md` + пометка «спека жива, хранится в архиве».
Альтернатива (вариант А, отклонена): git mv в корень team-m/ — плодит корень, архив — законное место при честной ссылке.

---

## E-5. Стата для города (фураж 707 → v0.3.2)

| Метрика | Значение |
|---|---|
| Проверено единиц | 548 (+2 опер-реестра; 571 зоны минус 23 опер-актива команды) |
| КАНОН/живые | 101 → этажи «канона» |
| АРХИВ/эры | ~382 → этажи «архива» (7 эр packs/ + ghost-floors) |
| Труп/кандидаты | 22 (7 — redirect в этом паке E1; slot-matrix — 2 правки индексов; 14 — 🔴 STORAGE-POLICY: untracked-зоны, драфты, GO-задачи) |
| РАСХОДИТСЯ | 18 (топ-10 сдан 21:04 — очередь правок) |
| Ghost-floors | 71 untracked .md (docs/sync 47 + docs/agents 7 + docs/agents-hub 17) — 🔴 STORAGE-POLICY, вне этого пака |

---

## Гейты применения (для 007, после 🔴/GO)

1. `tsc=293` (0 дельты — правки только .md)
2. `vitest=808+0int+0load` (69 файлов — тесты не затронуты)
3. `git grep -n "MAC-PC-BRIDGE-SPEC\|SYSTEM-REPORT-V007\|006-007-registry"` — все ОСТАВШИЕСЯ ссылки либо на _redirect-файлы, либо repoint-нуты
4. Смоук: docs/INDEX.md открывается; 4 новые строки на месте; «Last updated» обновлён; строка slot-matrix УДАЛЕНА из README.md и INDEX.md
5. frozen-guard GREEN (правки только .md — зона не тронута)
6. Дымовой grep после E2: `rg -n "src/handlers/|audio/store/audioStore|src/legacy/engine-v3" docs/architecture/` → пусто

## НЕЛЬЗЯ (зафиксировано 003)

- НЕ сносить файлы (снос — пак D + STORAGE-POLICY; E только перенаправляет)
- НЕ трогать team-m/REGISTRY.md, SHARED-REGISTRY.md, INBOX.md, FRONTS.md (опер-активы команды)
- НЕ переносить файлы из team-m/archive/ (E-4 = правка 2 строк CONTEXT.md, НЕ git mv)
- НЕ трогать FROZEN-зону и код (пак — только .md)
- repoint — только живых входящих из списков E1; исторические цитаты в team-m/archive/ и docs/operations/archive/ не трогаем
- slot-matrix: НЕ добавлять _redirect-заголовок (H1 уже «Do NOT use») — только 2 правки индексов
- auth-system-freeze.md НЕ трогать (живой FROZEN-снапшот)

## Маршрут пака

Сборка: 003 (спека, не применяет) → **стресс 002** (прогон, вердикты по пунктам) → приём **200** (включение в очередь) → **007** (исполнение по канону) → 🔴 Никита (финальный GO на применение).

— 003 · Док_Аудит · 2026-08-30
