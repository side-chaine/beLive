# SYNC-HUB-TO-MAC — 2026-08-26o · ОПЕРАТИВНЫЙ БРИФИНГ (все процессы)
> От: 007_Винда (Hub). Копия: Боссу + Маку (Far Light).
> Назначение: вытащить полную картину всех процессов = консолидированный брифинг Hub↔Mac. Ждём подтверждения/дополнения от Мака (особенно п. D «сеть»).

## A. WIN-миграция v2→v3 (главный процесс · near-light = Hub)
Канон: **tsc 306 / vitest 772** (факт: 767 passed + 5 legacy-fail) / PARITY PASS / frozen-guard 🟢 GREEN / SHA256 frozen идентичен (baseline `/tmp/frozen-post-w2b.sha`, 21 файл).
- M3-GO flip ✅ `2395c1e` (engine-mode.ts:5 + .env.example:23)
- W1 ✅ `521cb82` (cut V2 activation BAC-105; featureFlag: убран `tryActivateV2` + import `patchV1`)
- W2a ✅ `ba184c5` (seekTo→getTransport, 7 app-файлов)
- W2b ✅ `d0e31af` (pause/play/stop/setStemVolume/setBusVolume/setStemsEnabled → V3 transport+stores, 6 файлов)
- Гейты после W2b: 🟢 все зелёные. vitest 5 failures = legacy `stem-engine-sync.test.ts` (V2-fallback удалён намеренно, не регрессия 6 файлов); ещё 2 test-файла — pre-existing LOAD-fейл (W4 удалит `src/legacy/engine-v3/*`).
- **ОСТАЛОСЬ** (far-light = Мак пре-работает, Hub исполнит по готовности):
  - compat-layer re-point (`src/audio/engine-v3/integration/*`, `src/legacy/engine-v3/*`) — W3/W4
  - W3 demolition: V2AudioCage / V2ResurrectionDetector / DuckGuardV3 + `__switchToV3` / `__restoreV2Engine` (bridge-agnostic, НЕ в `src/bridges`)
  - W4: track.orchestrator re-point + delete `src/legacy/engine-v3/*` (9 файлов) + delete V2Adapter при `grep V2Adapter src`→0
  - W5: BAC-107 (live-mode/waveformEditor stub + facade.ts:51 FIXME); `__restoreV2Engine` delete; docs
- OPEN: «сеть» (см. D).

## B. «Центры» / Character-AI (отдельный домен · post-m3)
- Закрыт между Маком и Center-Sonnet (`SYNC-MAC-TO-CENTER-26a` + ответ). Не блокер миграции.
- Секвенинг: дизайн параллелится; АППЛАЙ коммитов Центров — ТОЛЬКО ПОСЛЕ M3-GO флипа + 5 волн.
- 2 усиления Center приняты (Billy=asset; S3-gate проверить обход aiHub). Всё НЕ frozen, post-m3.
- Hub сейчас этот домен не трогает.

## C. Агентная система (обновленная · в работе)
- **007_Винда (Hub) = near-light:** исполняет волны, подключает Operator, верифицирует (tsc/vitest/frozen-guard/SHA256) + браузерные тесты Босса (если надо) + логи.
- **007_Мак (Far Light) = far-light:** собирает и прорабатывает всё что вперёди (recon, MICRO-PACK, спеки, будущие волны).
- **Сабагенты (chain 001-002-001-009):** 001 CEO Co-Architect (аудит/Governance/выбор сабагента) → 002 Stress-Test (атакует решения) → 001 повторная сверка → 009 Independent Verification (runtime-аудит, DOC-CHECK, Registry, read-only). Плюс 005 Booster (context7), Operator (blind-apply), scouts (arch/gateway/sync).
- Каждый — своя проработанная роль; цепочка в операции.

## D. OPEN — «сеть» (от Босса: «Мак говорит что-то с сетью, нужно восстановить»)
Письменного письма Мака про «сеть» нет (`26m` — про wave-playbook; `TO-CENTER-26a` — про Центры). Босс передал устно. Нужна расшифровка от Мака/Босса:
- **(A)** Live transport-sync network (`src/bridges/*/live-guard.ts`) — **FROZEN** → СТОП, нужен OVERRIDE Босса.
- **(B)** Связность приложения (auth/AI gateway/streaming) — вне миграции.
- **(C)** Координационная сеть Hub↔Mac↔Босс — жива (этот брифинг).
Пока без уточнения Hub НЕ трогает bridges. **Мак, подтверди (A/B/C).**

## E. Frozen-governance (вердикт для Sonnet)
`MonitorRouter`/`HybridPipelineService` + приватные поля = в `src/bridges/*` = FROZEN. Вердикт: **остаются frozen, не трогаем; миграция ре-поинтит app-callers на `getTransport()`/`useStemStore`, что идёт ВОКРУГ bridges**. frozen-guard 🟢 GREEN, SHA256 идентичен. OVERRIDE не требуется; WIP идёт без касания bridges.

## F. Decisions log
- Flip = изолированный 2-файл коммит; WIP оставлен грязным.
- Волны = ONE GO, цепь 001→002→009, авто-гейты.
- Pitch OPT-IN A / Quest-автоматизация / Центры = defer post-m3.
- Push CLOSED.

---
Мак: подтверди/дополни, особенно п. D («сеть»).
