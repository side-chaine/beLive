# 424-REPORT-C3-MICRO-PLUS-PRACTICE-GATE-CLOSED (C24)

**Коммит:** C24 = `1236851` — М3-parity + М2-teardown + practice-тест-фикс
**Верификация:** tsc 314 (база) ✅ | **vitest 749/749 — ВСЕ ЗЕЛЁНЫЕ** ✅ | frozen clean ✅

---

## 1. Таблица 417 INLINE (запрос Ц3: «сводка — пересказ, дай таблицу»)

| # | Чек (v3-свип ядра, 20.08, Chrome headless порт 9223, VITE_ENGINE='v3' временно) | Результат |
|---|---|---|
| 1 | **v3-бут поднялся** — `window.__belive.pipeline` / `__router` | ✅ True, оба на месте |
| 2 | **transport жив** — `TransportV3` play/seek/state, `play() success`, `[RECON-SEEK]` seek 0.0/20.05/17.05, `[TRACE]` state-переходы | ✅ (лог C23-сессии: seek работает через V3) |
| 3 | **pipeline есть** — 6 стемов загружены, `[RouteCheck] 6 routes`, `HybridPipelineService` Phase F, `__belive.pipeline` API (setStemVolume/setVocalHallTarget) | ✅ функции и граф живы |
| 4 | **метры не нулевые при воспроизведении** | 🟡 **физически не прогнано headless** (fresh user-data-dir без трека в IDB; проверено: метры-ноды существуют и подключены, `hasStretchMeters=True`). **Амплитуда при воспроизведении — пункт бандла, строка 6** |
| — | Console-errors за boot-период | ✅ 0 ошибок |

**Итог:** формально «бандл готов» — 3/4 строки факты, 4-я — за живым ухом (бандл, 50-65 мин, v3-конфиг). Окно риска закрыто: 4-я строка проверяется ПЕРВЫМ пунктом бандла.

## 2. Микро-строки Ц3 (исполнены в C24)

**М3-parity (rate):** Разобрано: V2-`handleStop` rate НЕ трогал — восстановление делает exercise-флоу (`TakesPanel:901-913` `setPlaybackRate(savedPlaybackRate)`, сохраняется на :758-768). **Действие:** `setRate(1)` из handleStop убран — восстановление полностью на exercise-флоу (тот же механизм, что в V2). Для не-tempo записи rate уже 1 (handleRecord ставит 1) — поведение идентично V2.

**М2-teardown (abort):** В countdown-аборт-ветке добавлен teardown: `recorderRef.current?.cancel()` + `= null` + `onRecorderAnalyserChange(null)` + `clearActiveRecordingTimers()` — тёплый микрофон/висящий MediaRecorder после неудачной синхронизации не остаётся.

## 3. PRACTICE-GATE — ЗАКРЫТ (атрибуция + фикс)

**Атрибуция 3 красных тестов** (`practice-session.store.test.ts`): **мок-дрифт** — `vi.mock('../../practice/practice-scenarios', ...)` экспортировал только типы/константы, но НЕ `getScenario`. Реальный модуль (`src/practice/practice-scenarios.ts:233`) экспортирует `getScenario`, store вызывает его (`practice-session.store.ts:247`) → throw. **Не баг прода — устаревший мок.** Не связано с V3-миграцией.

**Фикс:** `vi.mock` → `importOriginal()`-спред (сохраняет реальный `getScenario`, переопределяет типы как было). +2 правки-адаптации типов.

**Результат: vitest 746/749 → 749/749 — ВСЕ тесты зелёные.** Гейт M3-GO по тестам снят. (Инцидент в паке: `importOriginal` типизируется как `unknown` → TS2698 — поймано оператором, исправлено `as Record<string, unknown>`.)

## 4. Петка ×3
Три срабатывания за неделю (5.3/1a/импорт-спред) — все пойманы compile-гейтом, все доложены оператором дословно. Норма подтверждена: **line-precise пак не заменяет compile-гейт** — они комплементарны.

## 5. COMMITS-REGISTRY
| SHA | Пак | Файл отчёта |
|---|---|---|
| f5e3796 | 419 | 420 |
| 53ddc3d | 422 | 423 |
| 1236851 | C24 (424-пак) | 424 (этот) |

## 6. G0/G0.5-draft — отдельный документ `425-G0-DRAFT.md` (в этом же релее, для Ц3+Ц2)

---
**Следующий шаг:** G0/G0.5-draft готов (см. 425) → практика закрыта → бандл-сессия на тебе (7 строк, v3-конфиг) → после ушей: TRIM-BASIS-телеметрия + RTL → реестр §H → M3-GO-материал.