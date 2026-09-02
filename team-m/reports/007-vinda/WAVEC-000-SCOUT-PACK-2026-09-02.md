# WAVEC-000 · СКАУТ-ПАКЕТ ВОЛНЫ C (15 graveyard-мостов) · 2026-09-02 · 007

**Собран:** 007 лично (grep/read/sed по живому дереву, все клеймы file:line верифицированы на HEAD `0053e54`) · Метод: гейт 301 «канал-сирота» по каждому мосту + свка матрицы 003_2 (NIGHT-DOSSIER-PRESURVEY-CD) с досье пары.
**Для:** цепи 001→002→001→009 (спека Волны C) · применяет Оператор по диспатчу 007 после вердикта 009 и GO.

---

## 1. КАНОН-СНАПШОТ (база спеки, Δ-инварианты)

- **HEAD `0053e54`** · tsc=**290** 🔴 (доковые/легаси; см. §5: **8 из 290 живут в мостах** — снос C меняет абсолют!) · vitest=**808+0int+0load / 69 файлов** 🟢 (**5 тестов / 2 файла живут в bridges/__tests__**) · PARITY PASS · frozen **17/17 МАШИНА** (`npm run verify:frozen`, check-frozen.mjs — снос без атомарного удаления graveyard-SHA-строк = ERROR замка).
- **Гейты волны не «Δ0»:** финальный канон после C = tsc **290−8=282** · vitest **808−5=803 / 69−2=67**. Спека обязана фиксировать Δ ПО КАЖДОМУ мосту (см. §5), иначе Оператор STOPнется на «290 ≠ канон».

## 2. БУТ-ФАКТЫ (runtime-инвариант C)

- **Ни один graveyard-мост не в буте:** App.tsx:92-103 — все init закомментированы «retired»; единственный живой импорт из bridges/ = **live-guard** (main.tsx:6 → install:317; guard-зона, НЕ сносится).
- **Обёртки УЖЕ в dual-fire:** main.tsx:61-75 registerInit ×15 wrapper-строк (track/cover/plate/blocks/markers/lyrics/monitor/audio-reactive/stem-reactive/takes/text-style/mode/position-sync/audio-events/loop-events) — комментарий «10 GREEN» на :62 УСТАРЕЛ (факт 14 graveyard-мостов имеют живые обёртки в буте; **mode-switch-events — НЕТ, сирота**, не в registerInit).
- **rehearsal-trigger.bridge — ЖИВОЙ, НЕ graveyard, ВНЕ Волны C:** `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts`, инстанс в main.tsx:38/:803 + deep-link.service.ts:91; его обёртка rehearsal-trigger-writer.ts имеет 0 импортов (ребрус 301/ГОЛОВЫ, отдельное решение — в спеку C НЕ входит).
- **Внешние импортёры bridges/ = 0** (rg по src/ вне src/bridges/: только main.tsx — live-guard + закомментированные retired-импорты :9-16).

## 3. ГЕЙТ 301 «КАНАЛ-СИРОТА» — ПО КАЖДОМУ МОСТУ (проверено 007)

- **① window-присваивания:** 0 во всех 15 мостах (grep `window\.\w+ *=` вне audioEngine/__belive — пусто) → снос не роняет глобалы.
- **② Канальный тест (живые читатели DOM-событий вне bridges/):** слушатели есть (useBackgroundManagers:184/:262, CatalogContent:231, block-scene.service:355), но их кормят ЖИВЫЕ писатели вне мостов: V3DataInterceptor (track-loaded/track-fully-loaded), MonitorEngine (monitor-state/route-changed), track.actions/upload.service (tracks-changed/track-saved), lyrics.service (lyrics-rendered). **Мосты событиями ВЛАДЕЮТ только внутри bridges/ — внешний живой слой не зависит от мостовых писателей.**
- **audio.bridge — ПЕРВЫЙ (301, В-3-консалт: снос безопасен):** 0 tsc-ошибок, слушает track-stem-ready/track-fully-loaded (писатель V3DataInterceptor жив).

## 4. ПОФАЙЛОВАЯ МАТРИЦА 15 МОСТОВ (ядро спеки)

| # | Мост | tsc-err | Тесты | Обёртка | В буте | Класс 003_2 |
|---|---|---|---|---|---|---|
| 1 | audio.bridge.ts | 0 | 2 (audio.bridge.test) | audio-events.ts | ✅ | SAFE |
| 2 | audio-reactive.bridge.ts | 1 (TS2345) | 0 | audio-reactive.ts | ✅ | SAFE (⚠️ handoff: «дубль с расхождением» — wrapper-DIFF обязателен) |
| 3 | blocks.bridge.ts | 0 | 0 | blocks-events.ts | ✅ | SAFE |
| 4 | loop.bridge.ts | 0 | 0 | loop-events.ts | ✅ | SAFE |
| 5 | lyrics.bridge.ts | 1 (TS6133) | 0 | lyrics-events.ts | ✅ | SAFE |
| 6 | mode.bridge.ts | 0 | 0 | mode-events.ts | ✅ | SAFE |
| 7 | stem-reactive.bridge.ts | 1 (TS6133) | 0 | stem-reactive.ts (:135-136 — живой регистрант) | ✅ | SAFE (мост = труп: 0 импортёров) |
| 8 | time-sync.ts | 0 | 0 | position-sync.ts (V3-aware) | ✅ | SAFE |
| 9 | cover-theme.bridge.ts | 0 | 0 | cover-events.ts | ✅ | known-gap (TODO-стабы) |
| 10 | plate.bridge.ts | 0 | 0 | plate-events.ts | ✅ | known-gap (IDB-write TODO) |
| 11 | markers.bridge.ts | 0 | 0 | markers-events.ts | ✅ | known-gap (нет real-time markerManager.subscribe) |
| 12 | monitor.bridge.ts | 1 (TS6133) | 0 | monitor-events.ts | ✅ | known-gap (нет patch-in-place hydration/devicechange; monitorPersist = side-effect — осторожно, 200 раунд-2) |
| 13 | textStyle.bridge.ts | 0 | 0 | text-style-events.ts | ✅ | known-gap (нет legacy applyFont) |
| 14 | track.bridge.ts | 0 | 0 | track-events.ts | ✅ | known-gap (object-URL coverArt/theme-менеджмент) |
| 15 | mode-switch.bridge.ts | 4 (TS6133 ×3 + 1) | 3 (mode-switch.bridge.test) | mode-switch-events.ts — **СИРОТА** (не в буте) | ❌ | сирота (обёртка не подключена) |

**Счёт 003_2 «7 SAFE / 5 gaps» расходится с моей матрицей (8 SAFE / 6 gaps) — спека строит по ФАКТАМ этой таблицы, классификация 003_2 = ориентир.** Мостов с tsc-ошибками: 5 (audio-reactive 1, lyrics 1, monitor 1, stem-reactive 1, mode-switch 4) = 8 ошибок. Тест-файлы: 2 (audio 2 теста, mode-switch 3).

## 5. КЛЮЧЕВЫЕ ДИЗАЙН-РЕШЕНИЯ ДЛЯ 001 (входы, не решения)

1. **Тактика (Соннет-r2 + 200, верифицировано):** НЕ батч, а «один мост → один коммит», audio первым. Гейт перед каждым: рендер или side-effect? (markers = идемпотентный пересчёт — ок; monitor = monitorPersist-запись — смотреть хендлер целиком). Прецедент dual-fire в проде.
2. **bridge-manifest.json (Соннет В7 + 200 п.1 + 201 п.5③ — стык с ГОЛОВОЙ):** статусы not-started/dual-fire-since/retired-at/commit; заменяет устаревшие комментарии main.tsx:62 («10 GREEN» при факте 15 строк). Нужен ДО первого сноса — статус «где мы по C» = one file.
3. **Ловушка-11 (003_2, гейт-4 конвоя):** scripts/verify-bridge-parity.ts сканирует glob `src/bridges/**/*.bridge.ts` → после сноса = вакуумный PASS (гейт вырожден). Скрипт НЕ frozen (scripts/), но его правка = часть Волны C ДО первого сноса мостов: переключить на bridge-manifest/эталон. Существующая логика: LEGACY_EVENT_MAP (facade.ts) + bridges-glob + wrappers-subscribe; residue-allowlist sync-editor-closed + practice:*.
4. **mode-switch (сирота):** мост и обёртка ОБА вне буте → снос моста не меняет runtime. Решение 001: (а) снести мост + тест, обёртку подключить в registerInit (доставляет mode-changed → DOM classList, TODO localStorage в обёртке); ИЛИ (б) снести мост + тест, обёртку оставить сиротой (статус в манифесте). Факт: mode-changed сегодня живой (ModeButtons/catalog → mode-switch.service) — кто красит classList, проверить при ревизии.
5. **Манифест-замок:** каждый снос = АТОМАРНОЕ удаление graveyard-SHA-строки из frozen-manifest.json В ТОМ ЖЕ КОММИТЕ (check-frozen.mjs = самопринуждение; «после C: guard 2, graveyard 0»). Паттерн DWC-1a конвоя.
6. **Конвой DOC-WAVE-C v2.0→v2.1 (пара 003, готов):** доки ОДНИМ коммитом с ФИНАЛЬНЫМ код-коммитом волны (пост-урок B+); v2.1-уточнения пары: w11-дефолт, rehearsal-DWC-6-строка, мосты-тесты-DWC-4 (мой §5-факт уже закрывает ③).
7. **Порядок жёсткий (003_2 13:35):** B++ ✅ (`0053e54`) → C-код → конвой. rehearsal-trigger и Волна D — ВНЕ этой спеки.

## 6. ФРОЗЕН-СТАТУС ВОЛНЫ

Мосты = graveyard-frozen: снос каждого = только по OVERRIDE-протоколу (GO Никиты на волну + атомарный манифест). Спека готовит; применение — после вердикта 009 + явного GO. live-guard (guard-зона) и AudioEngineV2 (Волна D) — НЕ трогать.

— 007 · скаут-пакет · верифицировано HEAD 0053e54 · цепь: вперёд
