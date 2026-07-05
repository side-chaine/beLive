# Auto-Lyrics: Onboarding Path

> **Сессия GSS-DP + TC-130..155 + CGP + Gates A/B/C + Variant B + §7 (28 Jun — 5 Jul 2026)**
>
> **Было:** "то Intro ворует строки, то Chorus теряется, то трек ломается непонятно почему"
> без единой архитектуры — только разрозненные фиксы (Fix A/B/C/E/F).
>
> **Стало:** движок с понятной архитектурой — GSS-DP (глобальный spatial-sequence поиск),
> границы (occupied guard, CGP), тай-брейки (content-aware orphan routing),
> контролёр качества (Gate A/B/C, Variant B). Два живых трека проверены до дыр
> (MJ 16 блоков, Runaway 9 блоков), 108 комбинаций констант откалиброваны
> не на глаз (UP=3 — дискриминант, MCS=0.40 — минимум).
>
> **Документация:** раньше — 70+ файлов без порядка в `~/Desktop/beLive_Context/`.
> Теперь — 5 файлов в `docs/auto-lyrics/` с чётким разделением (карта / журнал / методология / бэклог / онбординг).
> Все старые файлы помечены депрекейшн-хедерами — не удалены, но не запутают нового архитектора.

> **Порядок чтения для нового архитектора (человек или ИИ),**
> который входит в проект без контекста этой сессии.
>
> Время чтения: ~45 минут (если читать всё подряд).
> Минимум для понимания: ~20 минут (этапы 1-3).

---

## Этап 0: Контекст проекта (опционально, 10 мин)

Если ты вообще не знаком с beLive — начни отсюда:

1. **`docs/INDEX.md`** — оглавление всей документации проекта
2. **`docs/ARCH-BASE.md`** — как устроена работа архитекторов в beLive
   (⚠️ сам файл superseded, но процесс описан верно)
3. **`docs/architecture/architecture-map-2.1.md`** — маaster-архитектура всего проекта

**Пропусти этот этап,** если ты уже работал в beLive и знаешь общую структуру.

---

## Этап 1: Фундамент (15 мин)

📄 **`~/Desktop/beLive_Context/000-FULL-BASE.md`** (154K)

Этот файл — полный контекст архитектора beLive, написанный ДО этой сессии
(25 June 2026). Он содержит:

- Глобальную архитектуру проекта (фронт, бэк, AI flows, Telegram, storage)
- Систему синхронизации (word-sync, markers)
- Структуру кода: где что лежит, какие сервисы за что отвечают
- Процессы эскалации и governance

**Что важно:** 000-FULL-BASE НЕ содержит GSS-DP, CGP, Pass 2b, Gates,
Variant B и §7 calibration — всё это было построено ПОСЛЕ него.
Но без него ты не поймёшь, как auto-lyrics вписывается в проект.

**Что НЕ читать:** не пытайся запомнить все детали — читай для контекста.
Детали синхронизации (word-sync) и Telegram-пайплайна можно пролистать.

---

## Этап 2: Карта пайплайна (15 мин)

📄 **`docs/auto-lyrics/MASTER-ARCHITECTURE.md`** (409 строк, 14 секций)

Это главный документ auto-lyrics. После него ты будешь знать всю архитектуру:

1. **Пайплайн целиком** (секция 1) — диаграмма потока: Genius → Pass 1/2/2.5/2b/3 → Gates → Variant B
2. **Входные данные** (секция 2) — как парсятся Genius и LRC
3. **Pass 1: Candidate Collection** (секция 3) — Jaccard + ECC uniqueness + spatial penalty
4. **Pass 2: Global DP** (секция 4) — forward + backward trace, gap-штраф
5. **Pass 2.5: CGP** (секция 5) — Containment Guard Point для Outro-границ
6. **Section 4: Range Assignment** (секция 6) — occupied guard, cappedEnd
7. **Pass 2b: Positional Gap Fill** (секция 7) — Solo/Instrumental gap-assign
8. **Pass 3: Orphan Absorption** (секция 8) — content-aware routing
9. **Gates A/B/C** (секция 9) — persistence слои
10. **Variant B** (секция 10) — LRC re-selection
11. **§7 Constants** (секция 11) — калиброванные параметры
12. **Ограничения** (секция 12) — A3, A8, известные лимиты
13. **Ключевые файлы** (секция 13) — где что в коде
14. **История изменений** (секция 14) — ключевые коммиты

**Совет:** Открой `src/services/auto-lyrics.service.ts` рядом с документом
и сопоставляй секции с кодом. Функция `blockFirstLineSync()` — точка входа.

---

## Этап 3: Что уже проверено (10 мин)

📄 **`docs/auto-lyrics/CONTINUOUS-TESTING-REGISTRY.md`** (100 строк, 52 записи)

После того, как ты понял архитектуру — посмотри, что уже протестировано:

- **MJ synthetic** (#1-26) — 26 паттернов на синтетическом MJ: все TC-6,
  Fix B/C/E/F, GSS-DP, TC-122/130/141/142/150, Stress 1-5
- **MJ Real** (#27-33) — 7 паттернов на реальном MJ (They Don't Care About Us):
  LRC-версийная неоднозначность, CGP, Pass 2b
- **Runaway** (#34-40) — 7 паттернов на реальном Runaway (Linkin Park):
  TC-152/153/155, Chorus границы, UP discriminant
- **Arena** (#41-46) — A1/A2/A6 pass, A3/A8 нерешаемо, A4/A5/A7 не существовали
- **§7 Calibration** (#47-50) — 108 комбинаций, 4 константы
- **Quality** (#51-52) — byte identity, 666 тестов, 50 файлов

**Что важно:** Обрати внимание на колонку "Last verified" — если дата
старая, паттерн мог «протухнуть» после изменений.

---

## Этап 4: Как мы работаем (5 мин)

📄 **`docs/auto-lyrics/METHODOLOGY.md`**

8 правил с конкретными провалами. Прочитать целиком — обязательно.
Особенно:

- **Правило 0: Не выдумывай факты** — самое важное. Если нет данных —
  нет утверждения.
- **Правило 3: Live-run = финиш** — тесты зелёные ≠ работает.
- **Правило 5: Сырые данные > отчёты** — три конкретных провала,
  когда красивый отчёт врал.

**Совет:** Если ты ИИ-агент — эти правила should be injected в system prompt
перед любой работой с auto-lyrics кодом.

---

## Этап 5: Что отложено (5 мин)

📄 **`docs/auto-lyrics/OPEN-ITEMS.md`**

8 сознательно отложенных решений. Прочитать, чтобы:
- Не потратить день на реализацию CANON-3 без реального кейса
- Не пытаться "исправить" A3/A8 — они архитектурно нерешаемы
- Знать про `_originalTagInferred`, если будешь делать UI-доработки
- Понимать, какие константы НЕ калиброваны (MIN_SPATIAL_FLOOR, WORDS_WINDOW,
  CGP threshold, Pass 2b borrow cap)

---

## Что НЕ читать (старые файлы)

В `~/Desktop/beLive_Context/` лежит ~70 файлов из этой сессии.
Они все помечены депрекейшн-хедерами:

```markdown
> **Устарел** — 2026-07-05
> **Причина:** [конкретная причина]
> **Заменён:** `docs/auto-lyrics/MASTER-ARCHITECTURE.md`
```

**Можешь открыть любой — увидишь хедер и поймёшь, что он неактуален.**
Читать их не нужно, если ты уже прошёл этапы 1-3.

Исключение: **`091-View-Modes/`** — отдельный домен (UI), не deprecated.

---

## Карта: кто за что отвечает в коде

После чтения документации — карта для навигации по коду:

```
src/services/auto-lyrics.service.ts (2142 строки)
├── blockFirstLineSync()         → главная функция (точка входа)
├── DEFAULT_TUNING               → §7 константы (строка ~35)
├── [Pass 1] _collectCandidates  → Candidate Collection
├── [Pass 2] DP forward/backward → Global DP
├── [Pass 2.5] CGP               → Containment Guard Point
├── [Section 4] Range Assignment → occupied guard
├── [Pass 2b] Positional Gap Fill → NOT MAPPED blocks
├── [Pass 3] Orphan Absorption   → content-aware routing
├── selectVariant()              → Variant B LRC re-selection
└── computeCoverage()            → coverage check

src/blocks/parser/tagged-lyrics.parser.ts → Genius text → DetectedBlock[]
src/blocks/parser/block-taxonomy.ts       → TAXONOMY_VERSION, типы блоков
src/utils/block-migration.ts              → _originalTagInferred migration
src/utils/block-utils.ts                  → computeLocalStopWords, buildWordSet

src/services/__tests__/
├── auto-lyrics.match.test.ts     → 69 тестов (все TC-6, GSS-DP, Arena)
├── auto-lyrics.grid-search.test.ts → §7 calibration (108 combos)
├── mj-cgp-dryrun.test.ts         → 3 теста CGP на реальном MJ
```

---

## Быстрый старт: проверить, что система работает

```bash
# 1. Все тесты (2 мин)
npx vitest run src/services/__tests__/auto-lyrics.match.test.ts

# 2. CGP на реальном MJ
npx vitest run src/services/__tests__/mj-cgp-dryrun.test.ts

# 3. §7 Grid search (10 сек)
npx vitest run src/services/__tests__/auto-lyrics.grid-search.test.ts --reporter=verbose
```

Ожидаемый результат: все тесты зелёные.

---

*Если после прочтения всех 5 документов у тебя остались вопросы —*
*значит, документация неполная. Дополни её.*

*Для добавления новой информации: пиши факты, не пересказ.*
*Для нового трека: строка в `CONTINUOUS-TESTING-REGISTRY.md`.*
