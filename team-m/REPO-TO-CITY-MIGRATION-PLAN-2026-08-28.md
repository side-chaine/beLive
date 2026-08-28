# REPO-TO-CITY MIGRATION PLAN · beLiveBase · 2026-08-28 · DRAFT v1

**Статус:** DRAFT — Track C, собран Мак по итогам скаутов S1-S4 (инвентарь src, покрытие доками, археология пайплайна, аудит секретов).
**Цель:** переезд репо beLive в «город будущего» beLiveBase без потери доктрины, контрактов и секретной гигиены.
**Связка:** PC ведёт финиш v2→v3 (W4/W5) — миграция в город стартует ПОСЛЕ M3, подготовка идёт параллельно и не трогает `src/`.

---

## 1. Фазы

**Принцип (Босс 28.08):** фазы НЕ должны перегружать финиш v2→v3. Всё, что может повредить миграции v2→v3 — не делаем; всё, что не мешает — делаем. Продуктовый приоритет: сначала Репетиция (главный режим) к проду, потом остальные режимы включая Live.

| Фаза | Что | Когда |
|------|-----|-------|
| **Phase 0 (сейчас)** | read-only подготовка: аудит, доки, houses.yaml draft, план. Без коммитов городских файлов, без нагрузки на PC | до M3 |
| **Phase 1** | M3-победа: W4/W5 снос мусора (PC), канон GREEN. Секреты НЕ блокируют (ротация — после настройки, решение Босса) | M3 |
| **Phase 2** | MVP-1 города: `houses.yaml` (final) + `city-gen.mjs` + `bLb-SNAPSHOT.html`; Репетиция к проду | post-M3 |
| **Phase 3** | Физический переезд: fs-копия/клон → город; внешние ресурсы остаются внешними; режимы Karaoke/Concert/Live достраиваются как здания города | post-MVP-1 |

## 2. Что едет в город

**Живые здания (35 доменов src/, инвентарь S1):** audio, billy, catalog, exercises, practice, takes, sync, stem, theme, performance, slot-matrix, deck, components, services, avatar, backgrounds, feed, foundation, stores, hooks, triggers, character, playback, runtime, data, styles, transitions, structure, config, types, utils, js(частично), blocks(до сноса W5), Rehearsal, test-infra.

**Frozen — едет как есть, не трогать:** `AudioEngineV2.ts`, `patchV1.ts`, `src/bridges/*` (16 мостов), `track.orchestrator.ts`, `wordSync.store.ts`, `markers.store.ts`, slot-контракт.

**Доктрина (уже готова):** `docs/architecture/architecture-doctrine.md` (a7aab6a) — version-independent, переживёт переезд.

**Артефакты пайплайна (S3):** `research/artifacts/*.json` (14 файлов) + frozen artifact contract (§14 map 2.1) — главное, что пережило пайплайн. Потребитель: `src/sync/word-sync/providers/gateway-align.provider.ts`.

## 3. Что сносится ДО переезда (PC, волны W4/W5)

По A1-инвентарю + доп. находки S1 (переданы ПК в SYNC-MAC-TO-HUB-2026-08-28-city-prep-findings):
- `src/legacy/engine-v3/` (7 орфан-модулей V3 — живой LoopEngineV3 уже в `audio/engine-v3/integration/`)
- `src/audio/engine-v3/V2Adapter.ts` + `IV2PublicContract.ts` + `SignalsmithAdapterService.bak.ts`
- `src/services/live-mode.stub.ts`, `waveform-editor.stub.ts` (BAC-107)
- `js/audio-facade-v3.js` def `__restoreV2Engine`, `src/blocks/bridge/blockEditor.service.ts` patchWaveformEditor, FIXME facade.ts:51, placeholder V3StatePublisher:129 (W5)
- доп.: `RehearsalLyrics.module.css.bak`, `src/stores/app.store.ts` (@deprecated), `src/components/landing/` (пусто)
- кандидат W6: `src/js/` legacy-слой (main.js PitchDetectionEngine, законсервированный ai/)
- пустышки: 7 `.gitkeep`-зон (assets/backend/css/gateway/img/Json/resources) — решение при переезде; `Karaoke/`/`Concert/` — **ПЛАНИРУЕМЫЕ здания города** (Босс 28.08), не delete: сначала Репетиция к проду, потом остальные режимы включая Live

## 4. Что остаётся ВНЕ города (внешние ресурсы)

- **Bank_beLive/** — внешний локальный банк треков (`Bank_beLive/{Artist}/{Track}/`), в репо никогда не коммитился. Решение Босса: переезжает ли в город и в каком виде.
- **Kaggle MMS notebook** — облачный шаг alignment; локальный преемник `research/mms-workbench-01/run.py`.
- **`prepare_batch.sh` / `fix_artifacts.js`** — физически отсутствуют в репо; функции частично в `research/scripts/*.py` (4 скрипта). Перед миграцией: один точечный `git log -- scripts/prepare_batch.sh scripts/fix_artifacts.js` — установить, удалены из истории или никогда не коммитились.
- **CF workers** (belive-auth/ai/gateway/mvsep/feed-bot/api) — живут в Cloudflare, в репо только wrangler-конфиги.

## 5. Гейты ПЕРЕД fs-переездом (обязательные)

**Gate S (secrets, по S4) — ОТЛОЖЕН (Босс 28.08: не приоритет, разберёмся когда всё настроим).** Список для исполнения зафиксирован, не блокирует фазы:
1. Ротировать MVSEP API-key (`belive-mvsep/DEPLOY.md:21`, tracked) + замазать в файле
2. Ротировать TokenRouter key; `opencode.json` — `git rm --cached` (tracked вопреки .gitignore)
3. Замазать цитату Last.fm key в `docs/sync/reports/SYNC-REPORTS/SYNC-CANON-01.md:74`
4. `deploy.yml:40` — hardcoded `VITE_REHEARSAL_SIGNALING_URL` → secrets/vars
5. Деплейсхолдеризация URL воркеров в map 2.1 §37.1 (1806-1807), `auth-system.md:291`
6. Помнить: `.gitignore` НЕ защищает при fs-копировании — `.env*`, `docs/sync/`, `opencode.json` едут с fs → исполнить ДО Phase 3

**Gate O (ownership, по S1) — ЗАКРЫТ (Босс 28.08: Мак решает сам):** все дыры закрыты дефолтом `center/007` в `team-m/bLb/houses.yaml` v0.1. Остаток: перенести домен `catalog` (+ при желании `avatar`, `feed`, `arenas`, `live`) в `docs/governance/DOMAIN-OWNERSHIP.yaml` — делает Мак в Track B, низкий риск.

**Gate D (docs, по S2/S3) — доки не должны врать на въезде:**
- SUPERSEDED-баннеры на `architecture-map-2.1.md` + `interaction-schema-2.1.md`
- Фикс дрейфов D1/D9/D12/D13 + битые ссылки map 2.1:1338, :1363 (несуществующие prepare_batch/fix_artifacts)
- §14 map 2.1: «✅ Working» у трёх отсутствующих скриптов → реальные преемники (`research/scripts/*.py`, `mms-workbench-01/run.py`)
- `character/` — живой домен с НУЛЁМ доков: написать паспорт здания до переезда
- slot-matrix-док официально невалиден (MISMATCH, «Do NOT use») — rewrite
- census: «17 кварталов» vs 18 строк — уточнить счёт

## 6. Риски переезда

| Риск | Источник | Митигция |
|------|----------|----------|
| Rehearsal: 36 жёстких обращений к V2 `window.audioEngine` | S2/SCOUT-REPORT DRIFT | ПК проверяет до W5; в городе не ломать identity boundary |
| drift `legacy/engine-v3` vs `audio/engine-v3` в v3-доках | S1/S2 | снос legacy-копий в W4 + фикс ссылок |
| L1 exact hash dormant (`lyricsHash: ""`, map:934) — TODO Wave 5 | S3 | не потерять при переезде, зафиксировать в houses.yaml как open seam |
| BAC-108: прод бьёт localhost:8787 | REGISTRY:22 / S3 | `VITE_GATEWAY_URL` уже применён (8d7b5c9), проверить в городе |
| fs-копия тащит секреты | S4 | Gate S до Phase 3 |

## 7. Следующие шаги

1. Мак: Track B — фикс дрейфов D1/D9/D12/D13 + SUPERSEDED-баннеры на map/schema 2.1 + паспорт `character/` + домен `catalog` в DOMAIN-OWNERSHIP.yaml (docs only, без src/)
2. PC: W4/W5 в своём темпе + точечный `git log -- scripts/prepare_batch.sh scripts/fix_artifacts.js`
3. Команда (PC, есть node): `verify-event-map.ts` + `verify-bridge-parity.ts` + канон-гейты после Track B
4. Post-M3: houses.yaml final + city-gen.mjs + bLb-SNAPSHOT.html (MVP-1), Репетиция к проду
5. Отложено: Gate S (ротация ключей) — после настройки всего

_Мак, 2026-08-28. Источники: S1 (инвентарь src), S2 (покрытие доками), S3 (археология пайплайна), S4 (аудит секретов), census 2026-08-28, PLAN-v3.3-CANONICAL._
