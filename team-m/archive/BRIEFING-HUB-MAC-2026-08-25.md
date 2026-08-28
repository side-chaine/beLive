# BRIEFING · Hub ↔ Mac · 2026-08-25 · статус после Operator-поезда
**Кому:** Mac-007 (Far Light) + Босс (на возвращении). **От:** 007_Hub (Near Light).
**Канон:** tsc 313 · vitest 770 passed (baseline 769; 2 legacy-теста `src/legacy/engine-v3/` с битым импортом — доканонные, вне счёта).

## 1. Frozen-стоп — СНЯТ (ложное срабатывание, вердикт Ц3)
Правило «_-поля» = приватные поля ВНУТРИ frozen-файлов (V2-мир). V3-собственные файлы пишут свои приватники легально. `(router as any)` — code smell, чинится геттером (сделано в PC-MonitorRouter-паке). Канон уточнён в `PLAN-v3.3-CANONICAL §2`.

## 2. Что применено (Near Light, 6 код-коммитов + E1 verify)
| Пак | Результат |
|---|---|
| PC-MonitorRouter | ✅ фикс `:254-262` (R8 восстановлен), дебаг-хвосты удалены, геттер `monitorLevel` + ControlDeck:413 |
| E1 | ✅ verify-only: single writer `main.tsx:148`=`__setV3Active`, 28 sites, без правок |
| B-slice + VOC | ✅ E5 cascade block, E6 guard removal, E8 StemChain stubs + `_applySolo`, VOC `awaitStemReady`+`getStemAudioBuffer` |
| A1/A2 | ✅ удалены фантом `setStemPan`/`setStemsMode` из IV2PublicContract |
| B1 | ✅ `track-stem-ready`, `track-fully-loaded` (V3DataInterceptor) + `vocalmix-state-changed` (MonitorRouter.setVMix, payload 1:1 с V2) |
| SURFACE | ✅ fail-loud V2Adapter, `setBusVolume` в контракт, `microphone-state-changed`/`playback-rate-changed` эмиттеры, удалены прямые store-записи ControlDeck |
| R1 | ✅ generation-check после loadStem + stale-guard в catch (cage.deactivate отложен в fallback-пак) |

## 3. Чистота базы
- WIP Мака (MonitorRouter/HybridPipelineService/main.tsx) принят PC: коммит `fc98e3f`, затем поверх — PC-MonitorRouter-фикс.
- **G5 (MonitorRouter/HPS) закоммичен → F-1/F-2 пилот разблокирован** (ждёт браузер-тест Босса).
- Остальной WIP Мака (avatar, js, agent-registry, docs) ещё в дереве — по инструкции `SYNC-HUB-TO-MAC-2026-08-25z` ждёт твой патч-транспорт в `team-m/patches/` (или коммит группами G0..G3 как раньше), PC верифицирует канон и примет.

## 4. Что осталось (Far Light → Mac)
По Ц3-порядку P1:
1. **TAKES-AUDIO** (solo-not-solo + vocal-fade dead + natural-end pause + seek-from-idle) — финализируй пак, пришли, PC применит.
2. **fallback-пак** — R1 `cage.deactivate()` + retry-политика + флаг, единым дизайном с R1 (Ц3: deactivate из fail-init пути V3DataInterceptor, НЕ bootAether; только в составе fallback-пака).
3. **marker-sync** — дизайн 006: событийная инвалидация (cache clear на `before-track-change`, resolve по готовности данных), таймеры — страховка.

## 5. Железные правила dual-machine (Ц3)
- Любой код в V3-finish_2 — только после PC-прогона канона 313/769.
- ⛔-гейты Ц3 на коммитах живы; FULL GO ≠ само-мердж в main.
- **REGISTRY = SSOT**: нет строки в `team-m/REGISTRY.md` = фронта не существует.

## 6. Открытые вопросы
- **Соннет** пока думает (его ответы по вопросам №2/№3/№4 могут скорректировать порядок P1 — пока едем по вердикту Ц3).
- F-1/F-2 пилот: ждёт браузер-тест Босса.
- mic-уши-сессия → M3-GO (18 строк) после закрытия B-slice + F-2-дубль.

**Файлы:** `MICRO-PACK-B-SLICE-FINAL.md`, `MICRO-PACK-B-SLICE-VOC.md`, `MICRO-PACK-A1A2-CONTRACT.md`, `MICRO-PACK-B1-EVENTS.md`, `MICRO-PACK-SURFACE-draft` (→ `reports/mac-007/`), `MICRO-PACK-R1.md`, `MICRO-PACK-PC-MONITOR-ROUTER.md`, `REGISTRY.md`, `PLAN-v3.3-CANONICAL.md §2`.
