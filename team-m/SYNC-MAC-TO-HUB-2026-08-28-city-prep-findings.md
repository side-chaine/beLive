# SYNC MAC→HUB · 2026-08-28 · находки подготовки к городу — ПОЛЕЗНО ДЛЯ W4/W5

**Кому:** @007_Hub / Вёдра
**От:** Мак (подготовка репо→город beLiveBase, Track A/B/C)
**Контекст:** ПК ведёт финиш v2→v3 (W4/W5), Мак параллельно гоняет скаутов по полному аудиту репо. Работаем сообща — отдаю в реестр всё, что помогает команде ПК.

---

## 1. Риск финиша V3: Rehearsal держится за V2 (скаут S2, docs-coverage)

`src/Rehearsal/` — самый недокументированный живой домен. `docs/SCOUT-REPORT-gateway-audio-deps.md` (2026-07-18, помечен DRIFT) фиксирует **36 жёстких обращений к `window.audioEngine` (V2)** в rehearsal-trigger.bridge. Если у ПК «проблемки» в зоне rehearsal/микрофонов/триггеров — это главный подозреваемый. Рекомендую ПК прогнать точечный grep по `window.audioEngine` в `src/Rehearsal/` перед W5.

## 2. W4: `src/legacy/engine-v3/` подтверждён как безопасный снос (скаут S1, инвентарь src)

Живой `LoopEngineV3` уже пережил переезд в `src/audio/engine-v3/integration/`. Все 7 модулей в `src/legacy/engine-v3/` (StemPlayerV3, VocalMixV3, MicrophoneV3, LoopEngineV3, CrossfadeV3, CaptureBusV3, RateParamV3) + `__tests__` — орфан-дубли. Снос в W4 безопасен (внутренний импорт `./V2Adapter` у них сломан и так).

## 3. Доп. мусор для W4/W5, найденный скаутом (не было в A1-инвентаре)

- `src/audio/engine-v3/SignalsmithAdapterService.bak.ts` — лежит рядом с V2Adapter.ts, кандидат на снос вместе с ним
- `src/components/RehearsalLyrics.module.css.bak` — .bak-мусор
- `src/stores/app.store.ts` — @deprecated (мигрирован в user-profile), кандидат W5
- `src/components/landing/` — пустая папка

## 4. Гигиена перед переездом (скаут S4, аудит секретов) — нужно решение ПК/Босса

- **`opencode.json` TRACKED в git вопреки .gitignore** (содержит ключ tokenrouter). Рекомендую: `git rm --cached opencode.json` + ротация ключа. На Маке уже применён `assume-unchanged`, но в истории/индексе ПК файл остаётся tracked.
- **`belive-mvsep/DEPLOY.md:21` — MVSEP API-key plaintext, tracked** (H1). Ротировать в CF, в файле заменить на ссылку на ops-док. Ключ в git-истории — решение по filter-repo за Боссом.
- **`.github/workflows/deploy.yml:40` — `VITE_REHEARSAL_SIGNALING_URL` захардкожен** в tracked CI → вынести в `${{ secrets/vars }}`.
- **`.env.example`**: не хватает `VITE_REHEARSAL_SIGNALING_URL`; `VITE_MVSEP_API_KEY` в `.env.production.local` — дизайн-дыра (префикс `VITE_` тащит ключ в клиентский бандл; MVSEP уже ходит через worker-прокси с `X-Mvsep-User-Key`).
- URL воркеров `*.nikitosss007.workers.dev` plaintext в `architecture-map-2.1.md` §37.1 (стр. 1806-1807) и `auth-system.md:291` — деплейсхолдеризовать при обновлении доков (Мак заберёт в Track B).
- Важно для миграции: `.gitignore` не защищает при fs-переезде города — `.env*`, `docs/sync/` (с цитатой Last.fm-ключа в SYNC-CANON-01.md:74), `opencode.json` едут вместе с fs-копией. Если город = fs-копия, а не git clone — Блок A (ротация+зачистка) обязателен ДО переезда.

## 5. Мелочь для города

Census-отчёт (`team-m/reports/007-vinda/city-district-census-2026-08-28.md`): заголовок «17 кварталов», строк в таблице §1 фактически 18 (Арены Karaoke/Concert + Арена Live считаются внахлёст). Уточнить при финализации `houses.yaml`.

---

## Что Мак делает дальше (не мешая ПК)

- S3: археология batch-пайплайна (prepare_batch.sh/fix_artifacts.js — где живут)
- Track B: фикс подтверждённых doc-drift (D1/D9/D12/D13) + SUPERSEDED-баннеры на map/schema 2.1
- Track C: draft `houses.yaml` (S1-инвентарь готов) + REPO-TO-CITY MIGRATION PLAN
- `src/` Мак НЕ трогает — только team-m/docs.

_Мак, 2026-08-28. Источники: скауты S1 (инвентарь src), S2 (покрытие доками), S4 (аудит секретов)._
