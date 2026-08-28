# БРИФИНГ · ДОРОЖНАЯ КАРТА МИГРАЦИИ v2→v3 (2 раунда, консолидация)

> Ведущий: 007_Винда (Hub, PC). Far: Мак-007 (Mac). Владелец-арбитр: Босс.
> Формат: Раунд 1 (PC↔Mac заявляют позиции) → Раунд 2 (реконсиляция) → ФИНАЛЬНАЯ КАРТА.
> Исполнение: через **Operator** (blind-apply) + **браузерные тесты Босса** (П-12 / CDP V1–V10) на гейтах.
> Канон-якорь: tsc=306 / vitest=767+5int+2load / PARITY PASS / frozen-guard 🟢 GREEN.

---

## РАУНД 1 — ПОЗИЦИИ

### PC / Hub (007_Винда) — что ведёт ПК
- **УЖЕ ЗАКРЫТО (вне волн):** M3-GO flip `2395c1e7`; W1 `521cb82f`; W2a/b `ba184c5`+`d0e31af`; MonitorRouter R8 (`b52e967`); BAC-108 (`8d7b5c9`, grep localhost:8787=0, frozen GREEN); BAC-110 grep-safe; sshfs-watchdog.sh готов (для Мака).
- **ВЕДЁТ СЕЙЧАС:** применение волн W3→W4→W5 через Operator по цепи (паки уже РЕШЕНО chain 001→002→001→009). Гейт W3 прогнан (0 FROZEN-импортов).
- **БЛОКЕР:** жду от Мака closure-таблицу 18 строк (Ц3 4.2.2) — без неё W3 не стартую (применяю ПРОТИВ таблицы, не по памяти).
- **ДОП. ЗОНА PC:** Character-AI логика/звук (registry/aiHub/CharacterSoundManager) — ждёт post-m3; DOC-CHECK 5 устаревших доков (нашёл 009).

### Mac (Far Light) — что ведёт Мак
- **ФОКУС (per Босс 26.08):** ПОЛНОЕ УДАЛЕНИЕ LEGACY (5 волн + M3-GO flip). `INITIATIVE-FOCUS-MAIN-TASK.md` создан.
- **ВОЛНЫ:** W1–5 переписаны (`f47568d`), вердикт 009 = РЕШЕНО; file-листы освежены (delegateSync 23, V2Adapter 27, globals 9, track.orchestrator 7); Frozen-guard APPROVED + baseline GREEN. **Ждёт ОДИН GO Босса → chain 001→002→009.**
- **НАХОДКА СКАУТАМИ:** 009 нашёл 4 реальные дыры в WAVE1..5 (V2Adapter жив 26 importers; BAC-105→W1 перенесён; legacy-путь 9 файлов; live-guard НЕ moved) — ВСЕ исправлены в паках.
- **ДОЛЖЕН ДОСТАВИТЬ:** closure-таблицу 18 строк (М3-GO retro) + G0-draft спеку 425 (G-трек).
- **POST-M3 (отложено):** S3-видео, bLb, pitch-connect, Character-AI аватар/CSS, G3/Layer-2.

---

## РАУНД 2 — РЕКОНСИЛЯЦИЯ (PC↔Mac)

| Вопрос | Решение |
|---|---|
| Кто стартует W3? | Мак шлёт closure-таблицу 18 строк → Hub стартует W3 через Operator. Без таблицы — СТОП (Ц3 4.2.2). |
| Параллелизм цепи? | Волны СТРОГО последовательно (W3→W4→W5). Внутри каждой: Operator apply → verify (tsc/vitest/frozen-guard/M3-VERIFY). Скауты — параллельно ДО и ПО ХОДУ (§8/§10). |
| Где уши Босса? | **МЕЖДУ W3 и W4** (mic-уши-сессия): solo/vocal-fade/auto-pause/RTL/П-8№2/TRIM-BASIS-full. Только Босс ear-test; код правим только если баг. |
| Character-AI / G-трек? | ВНЕ крит-пути миграции (post-m3 per фокус Мака). G0-draft спека нужна для PRE-GO #4, но не блокирует W3 (G-трек не в волнах). |
| DOC-CHECK 5 доков? | Входит в W5 (BAC-111) — Hub закрывает 009-вердиктом. |
| Синк-артефакт (27 SYNC-* + 2 AUDIT удалений в дереве)? | НЕ трогать до финиша волн; решение Босса (коммит-чистка / возврат / оставить). Не мешает исполнению волн. |
| Push/deploy? | 🔒 ТОЛЬКО по GO Босса после ФИНАЛЬНОГО M3-GO VERIFY. |

---

## ФИНАЛЬНАЯ ДОРОЖНАЯ КАРТА (consolidated · исполняем через Operator + браузер Босса)

### PHASE 0 — Разблок W3 (Mac)
- **Owner:** Мак. Доставить `closure-таблица 18 строк` (retro M3-GO) + `G0-draft` спеку 425.
- **Gate:** Hub получает таблицу → W3 разблокирован.
- **Boss:** только приём (устно/чат).

### PHASE 1 — W3 (Hub + Operator)
- **Action:** apply `MICRO-PACK-WAVE3` (cut V2-глобалов/delegateSync; V2AudioCage/V2ResurrectionDetector/restore→crash-modal; DELETE DuckGuardV3+test; BusFader18 §9 retain).
- **Verify:** tsc=306 (0 NEW), vitest 767+5+2, frozen-guard 🟢, M3-VERIFY partial (dist-grep prep).
- **Boss-гейт:** браузерный smoke (П-12 lite / CDP V1–V5) — звук идёт, V2 глухо.

### PHASE 2 — MIC-УШИ-СЕССИЯ (Boss ear-test)
- **Owner:** Босс. solo / vocal-fade / auto-pause / RTL / П-8№2 / TRIM-BASIS-full.
- **Hub:** код правит ТОЛЬКО если баг вскрыт (микро-пак → Operator).

### PHASE 3 — W4 (Hub + Operator)
- **Action:** apply `MICRO-PACK-WAVE4` (NEW `track.loader.ts` перенос loadTrack + ре-экспозиция globals; re-point 3 importers; DELETE `src/legacy/engine-v3/*` (9); V2Adapter DEFER до grep→0).
- **Gate:** **M3-VERIFY** (dist-grep + positive-controls) per Ц3 4.1b — обязателен до применения.
- **Verify:** tsc=306, vitest (legacy/engine-v3 удалён → счётчик меняется, фиксируем), frozen-guard 🟢.
- **Boss-гейт:** браузерный тест (CDP V6–V10) — загрузка стемов, маркеры, playback.

### PHASE 4 — W5 (Hub + Operator)
- **Action:** apply `MICRO-PACK-WAVE5` (BAC-107: live-mode/waveformEditor stub + `facade.ts:51` FIXME; `blockEditor.service` patchWaveformEditor removal; `__restoreV2Engine` delete; BAC-109/110 hygiene/doc).
- **Verify:** tsc=306, vitest, frozen-guard 🟢, **DOC-CHECK 5 устаревших доков** (009-вердикт).
- **Boss-гейт:** ПОЛНЫЙ smoke (П-12 / CDP V1–V10) → PARITY PASS.

### PHASE 5 — ФИНАЛЬНЫЙ M3-GO VERIFY (Hub + Boss)
- **Action:** full boot-smoke CDP V1–V10; parity LEDGER; frozen SHA256 идентичен ДО/ПОСЛЕ; ⛔-report Ц3.
- **Boss:** финальный sign-off миграции.

### PHASE 6 — POST-M3 ФРОНТЫ (Mac, параллельно, не блокируют)
- Character-AI аватар/CSS, G3/Layer-2, S3-видео, bLb, pitch-connect — по фокусу Мака post-m3.
- Hub: DOC-CHECK 5 доков завершён в W5; Character-AI логика/звук (PC-зона) — отдельным паком post-m3.

### CLOSEOUT — PUSH 🔒
- Только по GO Босса после PHASE 5. Ветка `backup/win-V3-finish_2-2026-08-23`.

---

## МЕХАНИКА ИСПОЛНЕНИЯ (закреплённые правила)
1. **§10 Context-Refresh Scout Pass** перед КАЖДОЙ фазой (4 домена ≤250 слов) — ловим drift прикладное↔реестр.
2. Волны: **Operator** blind-apply → verify; скауты parallel ДО+ПО ХОДУ; 001/002/001/009 СТРОГО sequential (паки уже РЕШЕНО — исполнение не требует ре-цепи, только verify).
3. **FROZEN-СТОП:** AudioEngineV2/patchV1/bridges/track.orchestrator/`_`-поля — НЕ ТРОГАТЬ. Любое упоминание в отчёте агента = СТОП-вопрос Боссу.
4. **Канон не регрессирует:** tsc ≤306, vitest 767+5+2, PARITY PASS, frozen GREEN.
5. **Push 🔒** — только GO Босса.

> Открытый вопрос Боссу: синк-артефакт (27 `team-m/SYNC-*` + 2 `*AUDIT*` удалений в дереве) — коммитим как чистку / возвращаем / оставляем до финиша?

---

## ADDENDUM — ФИНАЛЬНАЯ ЛЕНТОЧКА (по Брифингу Мака 2-круга + директиве Босса «только React, ноль Легаси»)

После аудио-волн (W3/W4/W5 через Operator + браузер-тесты Босса) — финиш миграции и город будущего:

- **PHASE 7 — W6 JS→React purge:** стереть `src/js/*` классику → чистый React / современная архитектура (директива Босса: «JS не нужен, никакого Легасив, только React»). Критерий done = исправленные гейты GREEN. Scope (что purge vs оставить как React/TS) уточняет **Центр_3** (см. промт ниже).
- **PHASE 8 — bLb (beLiveBase):** город будущего, Starbase-подобная архитектура (кварталы/houses) — **post-m3**; Мак детализирует параллельно.

**Параллельные инициативы Мака (пока Босс тестирует волны):** ① W6 JS→React purge design (MICRO-PACK); ② bLb-детализация; ③ Agent-system §11 (авто-пост инициатив в реестр); ④ DOC-CHECK apply (патч баслайн-доков — частично сделан Хабом в этом коммите).

**4 точки сверки (must-fix до сертификации волн, из аудита Мака):**
1. REGISTRY/WAVE-PREFLIP-BASELINE: globals 9 → **62/~250** — ✅ ИСПРАВЛЕНО в этом коммите.
2. V2Adapter 26/27 → **18** — ✅ ИСПРАВЛЕНО.
3. Модель-канон → **opencode/hy3-free** — ✅ (3cd66c5).
4. Применить **исправленные гейты** (`REPORT-MIGRATION-AUDIT-2026-08-26.md`) как единственный критерий DONE — иначе False-Green.
