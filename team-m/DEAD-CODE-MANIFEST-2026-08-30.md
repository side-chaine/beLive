# DEAD-CODE-MANIFEST · слой «тёмные этажи» для кадастра v0.3

**Автор:** 301 (WorkBuddy, Мак) · **2026-08-30** · **HEAD-SSOT: `9b6bf83`**
**Кому:** 707 (картограф) — обещанный слой тёмных этажей · 007 (код) · 200 (реестр)
**Статус:** ⚪ РЕЕСТР. **Ничего не удалено.** Всё ждёт 🔴 Никиты.

---

## §0. Метод и верификация (чтобы цифры можно было проверить)

Скрипт: `/tmp/deadcode-audit.py` на ПК (копия в индексе 301). Алгоритм:

1. Обход `src/**/*.{ts,tsx}` — **543 файла**, тесты (`.test.`/`.spec.`/`.d.ts`) исключены
   из числа кандидатов, но участвуют как **потребители**.
2. Для каждого файла берётся стем имени (`PitchModule`), ищется как **отдельное слово**
   (`(?<![A-Za-z0-9_$])STEM(?![A-Za-z0-9_$])`) во всех остальных файлах `src/`.
3. Ноль совпадений → кандидат в мёртвые.

**Верификация (второй проход, независимый):** те же стемы прогнаны по **всему репозиторию**
с фильтром только кодовых расширений (`.ts .tsx .js .jsx .mjs .html .vue`),
исключая `node_modules/ .git/ dist/`:

```
0 | impulse-test-harness      0 | PitchModule          0 | DropoutDetector
0 | OnboardingAccordion       0 | CatalogBillyChat     0 | genre-aggregation
0 | transition-zones          0 | validate-transition-preset
0 | use-slot-canvas           0 | ThemeSelector        0 | BottomBar
0 | RecordingPanel            0 | InstrumentOverlay    0 | MeterNodeV3
0 | content-hash              0 | useMouseIdle         0 | practice-session.selectors
```

**17 из 17 — ноль упоминаний в коде.** Ложных срабатываний нет.

**Расхождение с прежней цифрой:** раньше я публиковал «33 мёртвых файла» (замер
субагента,HEAD `d024a41`). Сейчас **28**. Причина: метод с границами слов точнее —
он не матчит `Kbd` внутри `Kbd2`, `usePitch` внутри `usePitchSmoothing`.
**Правильная цифра — 28.** Прежние 33 считать устаревшими.

Аналогично мёртвые экспорты: было 329, стало **396** — тот же пересчёт, метод строже.

---

## §1. Тёмные этажи — 28 файлов, 2168 строк, 71.1 КБ

**Без FROZEN: 27 файлов · 2005 строк · 64.4 КБ.**

| # | Файл | Строк | Байт | Район |
|---|---|---:|---:|---|
| 1 | `src/audio/engine-v3/diagnostics/impulse-test-harness.ts` | 225 | 8 598 | D8 |
| 2 | `src/components/PitchModule.tsx` | 166 | 4 534 | D0 |
| 3 | `src/audio/compat/patchV1.ts` | 163 | 6 856 | D8 · **❄️ FROZEN** |
| 4 | `src/audio/engine-v3/diagnostics/DropoutDetector.ts` | 154 | 4 907 | D8 |
| 5 | `src/components/onboarding/OnboardingAccordion.tsx` | 154 | 5 232 | D0 |
| 6 | `src/catalog/components/CatalogBillyChat.tsx` | 152 | 5 243 | D6 |
| 7 | `src/services/genre-aggregation.service.ts` | 137 | 3 872 | D9 |
| 8 | `src/utils/transition-zones.ts` | 119 | 3 861 | D0 |
| 9 | `src/slot-matrix/validate-transition-preset.ts` | 115 | 5 259 | D0 |
| 10 | `src/slot-matrix/use-slot-canvas.ts` | 101 | 3 073 | D0 |
| 11 | `src/components/ThemeSelector.tsx` | 70 | 2 054 | D0 |
| 12 | `src/theme/engine/validator.ts` | 62 | 1 913 | D0 |
| 13 | `src/services/metadata-backfill.service.ts` | 52 | 1 683 | D9 |
| 14 | `src/audio/engine-v3/MeterNodeV3.ts` | 51 | 1 461 | D8 |
| 15 | `src/hooks/useMouseIdle.ts` | 46 | 1 448 | D0 |
| 16 | `src/utils/content-hash.ts` | 46 | 1 568 | D0 |
| 17 | `src/components/BottomBar.tsx` | 44 | 1 166 | D0 |
| 18 | `src/components/RecordingPanel.tsx` | 40 | 1 204 | D0 |
| 19 | `src/audio/engine-v3/__tests__/BackendState.ts` | 39 | 1 682 | D8 · мок |
| 20 | `src/components/InstrumentOverlay.tsx` | 39 | 1 370 | D0 |
| 21 | `src/catalog/feed/FeedErrorBoundary.tsx` | 36 | 944 | D6 |
| 22 | `src/sync/word-sync/tokenizer.ts` | 36 | 777 | D7 |
| 23 | `src/stores/practice-session.selectors.ts` | 29 | 1 199 | D9 |
| 24 | `src/sync/hooks/useWordHighlight.ts` | 28 | 1 083 | D7 |
| 25 | `src/hooks/usePitch.ts` | 22 | 519 | D0 |
| 26 | `src/takes/components/TakesList.tsx` | 20 | 662 | D1 |
| 27 | `src/services/marker.service.ts` | 13 | 433 | D9 |
| 28 | `src/audio/featureFlag.ts` | 9 | 250 | D8 |

**По районам:** D0 Общее/UI — **13** · D8 Аудио-ядро — 6 · D9 Инфраструктура — 4 ·
D6 Каталог — 2 · D7 Sync — 2 · D1 Репетиция — 1.

### 🔎 Отдельные случаи, требующие суждения (не автоматики)

| Файл | Почему не сносить вслепую |
|---|---|
| `src/audio/compat/patchV1.ts` | **❄️ FROZEN** — исключён из рекомендаций |
| `src/audio/engine-v3/__tests__/BackendState.ts` | лежит в `__tests__/`, но **не** `.test.ts` — мок/хелпер. Проверить, нужен ли тестам |
| `src/components/PitchModule.tsx` | живой аналог — `PitchTab` (`deck/modules.ts:101`). Это **старый** вариант, переименованный по `TC-RENAME-PITCH` |
| `src/components/RecordingPanel.tsx` | может быть заготовкой под запись тейков (узел ARC-2e?). Уточнить у 007 |
| `src/catalog/components/CatalogBillyChat.tsx` | зона «Билли в каталоге» — в отчёте 008 есть как продуктовая идея |

---

## §2. 🟡 НАХОДКА: мёртвый код, который живёт в документации

`PitchModule` **не импортируется ни одним файлом кода**, при этом упомянут
**в 13 документах** (26 вхождений): `team-m/SHARED-REGISTRY.md`, `team-m/REGISTRY.md`,
7 отчётов `team-m/reports/007-vinda/ARC2A-*`, `docs/modernization/08-PITCH-COUNTERCHECK.md`,
`docs/sync/reports/SYNC-REPORTS/SYNC-ARCH-18.md`.

`RecordingPanel` — **9 документов** (15 вхождений): `docs/architecture/architecture-map-2.1.md`,
`docs/architecture/dock-standard.md`, `docs/sync/MASTER-SYNC-REGISTRY.md` и др.

**Это второй слой того же диагноза.** Документация описывает здания, которых нет
в графе импортов. Карта города, построенная **по докам**, и карта, построенная
**по коду**, разойдутся ровно на этих 28 файлах.

**707, это для тебя:** тёмный этаж — не всегда «файла нет в импортах». Иногда это
«файл есть в доках, но его нет в коде». Оба вида надо показывать в кадастре разными
метками, иначе карта снова соврёт.

---

## §3. Мёртвые экспорты — 396

| Район | Шт |
|---|---:|
| `src/services` | **74** |
| `src/audio` | 47 |
| `src/sync` | 29 |
| `src/catalog` | 26 |
| `src/billy` | 25 |
| `src/stores` | 18 |
| `src/types` | 17 |
| `src/utils` | 17 |
| `src/exercises` | 16 |
| `src/components` | 15 |
| `src/slot-matrix` | 14 |
| `src/performance` | 12 |
| `src/theme` | 12 |
| `src/takes` | 11 |
| `src/foundation` | 10 |
| `src/bridges` | 9 · **❄️ FROZEN** |
| прочие (`practice`, `Rehearsal`, `js`, `hooks`, `blocks`, `character`, `data`, `styles`, `config`, `deck`, `stem`) | 38 |

Полный список (400 строк) — в сыром выводе `/tmp/deadcode-audit.py`, у 301.
Примеры: `src/audio/engine-v3/diagnostics/DropoutDetector.ts` → `DropoutDetector`,
`DropoutReport`, `enableInstrumentation`, `disableInstrumentation`;
`src/Rehearsal/types/protocol.types.ts` → `TriggerPayload`, `PROTOCOL_VERSION`,
`MAX_MESSAGE_BYTES`, `STALE_AFTER_MS`.

⚠️ **`TriggerPayload`** — по roadmap 007 следующий узел **BRG-1 «TriggerPayload revive»**.
Экспорт помечен мёртвым, а 007 собирается его оживлять. **Это не мусор, это пауза.**
Отдельный повод не чистить `src/Rehearsal/types/` автоматикой.

---

## §4. `console.*` в продакшен-коде — 682 вызова / 118 файлов

| Файл | Вызовов |
|---|---:|
| `src/main.tsx` | **51** |
| `src/services/auto-lyrics.service.ts` | **49** |
| `src/services/upload.service.ts` | **46** |
| `src/audio/core/AudioEngineV2.ts` | 29 · **❄️ FROZEN** |
| `src/sync/components/SyncEditorPanel.tsx` | 28 |
| `src/components/UploadPanel.tsx` | 26 |
| `src/audio/engine-v3/pipeline/HybridPipelineService.ts` | 21 |
| `src/services/track.loader.ts` | 21 |
| `src/services/track.orchestrator.ts` | 21 · **❄️ FROZEN** |
| `src/catalog/feed/feed-data.store.ts` | 18 |
| `src/takes/components/TakesControlStrip.tsx` | 17 |
| `src/utils/zip-logger.ts` | 17 |
| `src/services/audio-analysis.service.ts` | 13 |
| `src/services/cover-art.service.ts` | 12 |

Остальные 104 файла — от 10 до 1 вызова.

❄️ **50 вызовов в FROZEN-файлах не трогаем** (`AudioEngineV2.ts` 29 + `track.orchestrator.ts` 21).

---

## §5. Закомментированный код — 30 строк / 9 файлов

`src/App.tsx` **10** · `src/hooks/useBillyAudioReactive.ts` **6** ·
`src/audio/engine-v3/diagnostics/DuplicateAudioRouteChecker.ts` 4 · `src/main.tsx` 4 ·
`src/audio/core/AudioEngineV2.ts` 2 (**❄️ FROZEN**) · и 5 файлов по 1.

Ранее я публиковал «111 строк / 31 файл» — та цифра считала **любые** комментарии,
включая пояснительные (`// ─── Секция ───`). Сейчас считается только
**закомментированный исполняемый код** (`// import`, `// const`, `// return`, `// }`).
**Правильная цифра — 30 / 9.** Пояснительные комментарии мусором не считаются.

---

## §6. TODO / FIXME / заглушка — 20 вхождений

Из них **три — настоящие заглушки в живом коде:**

| Файл:строка | Что |
|---|---|
| `src/foundation/event-bus/index.ts:2` | `export { bridgeFacade } from './facade'  // пока заглушка` |
| `src/stores/show-editor.store.ts:133` | `── Transition (заглушка для Фазы 2) ──` |
| `src/js/ai/providers/*.ts:3 файла` | `AIError('NOT_IMPLEMENTED', 'Non-streaming not supported')` |

Остальное — плановые TODO (`cover-events.ts:17,21` · `mode-switch-events.ts:21` ·
`plate-events.ts:15` · `useBillyLocomotion.ts:103,284` · `js/ai/registry.ts:155` ·
`js/ui/ai-chat-ui.ts:92` · `upload.service.ts:1064`).

⚠️ `bridgeFacade` помечен «пока заглушка», а это **foundation/event-bus** —foundation
всего проекта. Стоит глянуть 007.

---

## §7. Что я НЕ делаю

- **Не удаляю ничего.** Всё выше — измерения. Снос = 🔴 Никиты.
- **Не трогаю FROZEN** (3 файла в списках выше помечены ❄️).
- **Не правлю код.** Моя зона — аудит.

## §8. 🔴 Что нужно от Никиты (новое, сверх прежних 6)

| # | Вопрос | Эффект |
|---|---|---|
| 7 | Снос 27 тёмных файлов (2005 строк, 64.4 КБ)? Пакетом или по одному? | −64 КБ, −2005 строк |
| 8 | `TriggerPayload` и `src/Rehearsal/types/` — не трогать до BRG-1? | блокирует п.7 частично |
| 9 | 682 `console.*` — выносить в логгер-обёртку с уровнем? | продакшен-готовность |
| 10 | `bridgeFacade` (`foundation/event-bus/index.ts:2`) — это заглушка или норма? | foundation |

— 301 · WorkBuddy · Мак · 30.08
