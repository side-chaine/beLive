# Auto-Lyrics: Master Architecture

> **Genius ↔ LRC Matching Pipeline** — полный обзор системы.
> Документ-карта: меняется редко, отражает текущее состояние.
> Живой журнал тестирования — в `CONTINUOUS-TESTING-REGISTRY.md`.

**Сессия:** GSS-DP + TC-130..155 + CGP + Gate A/B/C + Variant B + §7 calibration
**Период разработки:** 28 Jun — 5 Jul 2026
**Статус:** ✅ Production-ready. Протестировано на MJ (16 блоков, 79 LRC), Runaway (9 блоков, 59 LRC), Arena A1/A2/A6 (синтетические паттерны). Подтверждено живыми прогонами в браузере и 665+ тестами.

---

## 1. Пайплайн целиком

```
Genius text            LRC text (lrclib.net)
      │                       │
      ▼                       ▼
parseTaggedLyrics     _parseLrc / _fetchLrclib
      │                       │
      ▼                       ▼
 DetectedBlock[]        LrcResult (lines + markers)
      │                       │
      └───────────┬───────────┘
                  ▼
    ┌─────────────────────────┐
    │  blockFirstLineSync()   │
    │  (ядерная функция)      │
    └─────────────────────────┘
         │           │
         ▼           ▼
   Pass 1:      displayLines[]
   Candidate    markers[]
   Collection
   (TC-120/121)    │
         │         ▼
         ▼    ┌──────────┐
   Pass 2:    │  Pass 2  │
   Global DP  │  .5 CGP  │
   (TC-122)   │ (TC-155) │
         │    └──────────┘
         ▼         │
   Section 4:      │
   Range Assign    │
   (TC-130/141)    │
         │         │
         ▼         ▼
   Pass 2 (fallback):
   Positional gap fill
   for NOT MAPPED blocks
         │
         ▼
   Pass 3:
   Orphan Absorption
   (TC-142/150/152/153)
         │
         ▼
   ┌─────────────┐
   │   MatchResult │
   │ blocks[]     │
   │ markers[]    │
   │ confidence   │
   └──────┬──────┘
          │
          ▼
   ┌──────────────┐
   │  Gates A/B/C │ ← Persistence
   │  Variant B   │ ← LRC re-selection
   └──────────────┘
```

---

## 2. Входные данные

### 2.1 Genius text

Текстовый формат с тегами секций:

```
[Verse 1]
Line one
Line two

[Chorus]
Chorus line one
Chorus line two
```

### 2.2 LRC text (from lrclib.net)

```
[00:12.34]Line one
[00:15.67]Line two
```

### 2.3 Парсинг

| Функция | Вход | Выход | Примечание |
|---|---|---|---|
| `parseTaggedLyrics(geniusText)` | Genius text | `DetectedBlock[]` | Типы: verse, chorus, bridge, prechorus, postchorus, outro, intro, solo, instrumental. `contentLines` = строки без тегов. |
| `_parseLrc(rawLrc)` | raw .lrc строка | `LrcLine[]` | `{ time: number, text: string }`. Пустые строки сохраняются. |
| `_fetchLrclib(artist, track, duration?)` | запрос | кеширует в `_cache` | Fire-and-forget. С duration — точный lrclib match. |
| `fetchLrcVersions(artist, track)` | запрос | `LrcVersion[]` | TC-096: версионный поиск для Variant B. |

---

## 3. Pass 1 — Candidate Collection (TC-120/121)

**Мотивация:** Без кандидатов DP не с чем работать. Pass 1 собирает топ-K кандидатов для каждого Genius-блока.

### 3.1 LRC Sanitization (TC-120)

Филлер-строки (`♪`, `...`, `~`) исключаются из валидного индекс-пространства (`validIndices[]`):
- `M = validIndices.length` — размер задачи для DP
- `origIdxToValidRank` — отображение исходного индекса в ранг

### 3.2 Candidate scoring (TC-121)

Для каждого блока `bi`:
1. **Bag-of-words** (Jaccard): сравниваем Genius-слова блока (`buildWordSet(contentLines, WORDS_WINDOW)`) с окном LRC-строк (`getValidWindowLines(p, WORDS_WINDOW)`)
2. **Порог:** `rawScore ≥ MIN_CANDIDATE_SCORE` (0.40)
3. **ECC uniqueness:** `matchMass = Σ(rawScore_normalized)^UNIQUENESS_POWER` → `uniqueness = max(0.2, min(1.0, 1.0/matchMass))`
4. **Spatial penalty:** Гауссово взвешивание: `exp(-(gRatio - lRatio)² / 2σ²)`, clamped `[MIN_SPATIAL_FLOOR, 1.0]`
5. **UPC** (Unified Positional-Content): `rawScore × uniqueness × spatialPenalty`
6. **Top-K:** `allCandidates[bi] = sorted(upc).slice(0, K)`

**G_ratio:** гибрид текстовой доли (cumulative contentLines) и позиционного ранга блока: `0.6 × textRatio + 0.4 × rankRatio`.

---

## 4. Pass 2 — Global DP (TC-122, Centers 32-33)

**Мотивация:** Последовательный жадный поиск цепочек (первый блок → второй → ...) ломается на:
- Интро со слабым совпадением блокирует всю цепочку
- Chorus/PostChorus с идентичным текстом (MJ "All I wanna say")

### 4.1 Forward pass

DP индексируется по `(blockIdx, candidateK)`. Для каждой ячейки `(bi, k)`:
- **GLOBAL lookback** по ВСЕМ `prevBi < bi` (не только ближайший). Это ключевое отличие от классического DP с lookback=1.
- **Строгая монотонность:** `prevCand.lrcIdx < cand.lrcIdx`
- **Gap-штраф:** `((actualGap - expectedScaled) / (expectedScaled + 0.5))²`
  - `actualGap = cand.validRank - prevCand.validRank`
  - `expectedScaled = (cumExpectedLines[bi] - cumExpectedLines[prevBi]) × S`
  - `S = M / totalExpectedLines` — глобальный коэффициент сжатия
- **Счёт ячейки:** `dp[prevBi][pk].totalScore + cand.upc - penalty`
- **Старт цепи:** Если нет валидного предка, блок стартует сам: `totalScore = cand.upc` (только если `upc > 0`)

### 4.2 Backward trace

Глобальный максимум среди ВСЕХ resolved ячеек:
```
globalBest = max(dp[bi][k].totalScore) over all bi, k
trace: globalBest → prevBlock → prevBlock ... → start
```

Даже если стартовый блок не основной части песни — DP не может найти цепочку → `_lrcStartIdx[bi] = null` для всех блоков → Section 4 fallback.

### 4.3 Output

`_lrcStartIdx[bi]: number | null` — индекс первой строки каждого блока в displayLines.
`_chosenMatchScore[bi]: number | null` — rawScore выбранного кандидата.

---

## 5. Pass 2.5 — CGP (Containment Guard Point) — TC-155

**Мотивация:** Outro на Runaway (Linkin Park) привязывался к LRC["And open up my mind"] вместо LRC["I wanna run away and open up my mind"] — containment 0.5 vs 1.0. DP не видит разницы (rawScore ≈ 1.0 для обоих), но визуально это баг.

### 5.1 Алгоритм

Для каждого блока с `rawScore ≥ 0.9`:
1. Вычислить `containmentScore(geniusFirstLine, currentLrcLine)`
2. Если `containment < 0.6` И есть forward-кандидат с `containment ≥ 0.6`:
   - **Поиск вперёд:** до следующего MAPPED блока (чтобы не украсть его первую строку)
   - **Break на первом** `containment ≥ 0.8` (FLCG spec)
3. Если correction нужен: `_lrcStartIdx[bi] = bestForwardIdx`

### 5.2 Почему не Pass 2

CGP — это quality gate, не часть DP. DP видит "score = 1.0, всё хорошо". CGP добавляет проверку: "score 1.0 — это в багаж, не в хвост самолёта". Стоит после DP, перед Section 4.

### 5.3 Статус характеристики

- `containmentThreshold = 0.6` — не калиброван (ℹ️ может потребовать настройки на новых треках)
- `forwardContainment ≥ 0.8` — останавливает поиск (break)
- Калибровка порога CGP (сейчас 0.9 для confidence skip) — **отложена** (см. OPEN-ITEMS.md)

---

## 6. Section 4 — Range Assignment (TC-130/141)

**Мотивация:** После того, как DP + CGP определили `_lrcStartIdx`, нужно:
1. Раздать LRC-строки каждому блоку
2. Не допустить коллизий (два блока не могут владеть одной LRC-строкой)

### 6.1 Алгоритм (Occupied-Line Guard)

```
occupied = Set<number>()
for each block i (in order):
  startIdx = _lrcStartIdx[i]
  endIdx = next block's startIdx (with chrono-violation skip: Fix C)
  expectedLines = block's contentLines count
  elasticity = (expectedLines <= 1) ? 1 : 0   // TC-141
  cappedEnd = min(endIdx, startIdx + expectedLines + elasticity)
  for k from startIdx to cappedEnd:
    if k not in occupied:
      block.lineIndices.push(k)
      occupied.add(k)
```

### 6.2 TC-141: Tight cap

Блок с 8 ожидаемыми строками НЕ может съесть индекс 9 (чужая секция). Эластичность +1 только для 1-строчных блоков (ad-libs).

### 6.3 Chrono violation (Fix C)

Если следующий блок замаплен на более ранний индекс, чем текущий (`nextStart < startIdx`), этот скачок пропускается — чтобы блоки не получили нулевой диапазон.

---

## 7. Pass 2b — Positional Gap Fill (TC-BUG-03-B)

**Мотивация:** Solo, Instrumental и другие NOT MAPPED блоки не получают `_lrcStartIdx` от DP.

### 7.1 Алгоритм

Для блоков без `_lrcStartIdx`:
1. Найти `prevEnd` (последний индекс предыдущего MAPPED блока)
2. Найти `nextStart` (первый индекс следующего MAPPED блока)
3. `availableGap = nextStart - (prevEnd + 1)`
4. Взять до `neededLines` из gap (для Solo/Instrumental — всю доступную gap)
5. Если не хватает → отнять у следующего блока (кап 50%, только если `score < 0.5`)

---

## 8. Pass 3 — Orphan Absorption (TC-142/150/152/153)

**Мотивация:** После Section 4 остаются LRC-строки, не назначенные ни одному блоку. Их нужно привязать к текстово-близкому блоку, а не просто "к предыдущему" (как было до TC-142).

### 8.1 Алгоритм (Content-Aware Orphan Routing)

```
indexToBlockMap: каждый LRC-индекс → номер блока

for each block gap:
  orphanIndices = LRC-строки между blocks[i-1].maxIdx и blocks[i].minIdx
  для каждого orphan:
    1. contentMatch: какой MAPPED блок имеет максимальное текстовое
       совпадение с orphan'ом? (Jaccard word overlap в рамках structural window)
    2. fallback: если overlap 0, привязать к блоку с большим overlap
       соседних неорфанов
    3. tie-break: при равенстве — к блоку, к которому orphan ближе
       по типу (chorus-текст → chorus, даже если verse ближе по индексу)
```

### 8.2 TC-150: Structural Window Guard

Снапшот границ блоков ДО начала Pass 3 — статичный, не дрейфует от собственных присвоений. Content-окно: `[prevBi+1 .. nextBi-1]` в блоковом пространстве.

### 8.3 TC-152: ContentLines overwrite guard

`contentLines` НЕ перезаписываются при пустом `lineIndices` — предотвращает потерю Genius-структуры.

### 8.4 TC-153: Position-blind tie-break

При равном overlap победитель — блок, тип которого ближе к семантике orphan'а, НЕ блок, который ближе по индексу (как было до фикса — MJ Verse 3 "Tell me" крал строку у Post-Chorus 2).

### 8.5 Известные ограничения

- **A3 — Chorus-Orphan Ambiguity:** Когда припев и куплет имеют идентичные строки, contentMatch не может различить. Требует time-based ratio вместо index-based (архитектурно нереализовано).
- **A8 — Long block boundary gap:** При большом разрыве между блоками (40+ строк) contentMatch теряет фокус. Ограничение line-level candidate retrieval.

---

## 9. Gates A/B/C — Persistence

### 9.1 Gate A — Taxonomy

Сохранение `DetectedBlock[]` в persistence-формат:
- `detectedBlocksToPersistedBlocks()` — конвертер
- `TAXONOMY_VERSION` — версия схемы (вшита в каждый блок)
- `originalTag` — Genius-тег (предполагается визуальное отличие от inferred-тега — см. OPEN-ITEMS.md)

### 9.2 Gate B — IDB Migration

Экспорт/импорт через IndexedDB. Поле `_originalTagInferred` — true/false — для UI подсветки восстановленных тегов.

### 9.3 Gate C — UX

Детали UX — в `091-View-Modes`. Кратко:
- Блоки отображаются в Wagontrain UI
- Перетаскивание границ
- Редактор блоков

---

## 10. Variant B — LRC Re-Selection (TC-096)

**Мотивация:** MJ ("They Don't Care About Us") имеет две LRC-версии на lrclib.net: одна с "wanna", другая с "want to". Неверная версия даёт low coverage.

### 10.1 Алгоритм

```typescript
function selectVariant(versions: LrcVersion[], trackDuration: number): LrcVersion {
  // 1. Отсев по duration (|version.duration - trackDuration|)
  // 2. Скоринг: proximity + lineCount + text match (coverage)
  // 3. Выбор лучшей версии
  // 4. Если coverage < 75% → retry со следующей версией
}
```

### 10.2 Coverage check (TC-096-04)

После первого матчинга через `blockFirstLineSync()`:
- `computeCoverage(blocks)` = доля первых `CHECK_BLOCKS` блоков с непустыми `lineIndices`
- Если `coverage < 0.75` → retry со следующей версией LRC
- Max 3 попытки

### 10.3 FIX: versionDuration

Длительность из lrclib API (`versionDuration`) всегда известна при наличии `sourceId`. Используется для точного сравнения "та же версия?" при рефетче.

---

## 11. §7 — Run-time Constants

**Статус:** Откалиброваны grid search по 108 комбинациям (4×3×3×3) на 5 фикстурах (MJ, Runaway, Arena A1/A2/A6). Подтверждены как лучшие из проверенных.

| Константа | Значение | Смысл | Чувствительность |
|---|---|---|---|
| `MIN_CANDIDATE_SCORE` | 0.40 | Минимальный Jaccard-порог для кандидатов | Все 4 значения (0.30-0.45) проходят с UP=3. При UP=2 работает только ≥0.40 |
| `K` | 10 | Top-K кандидатов на блок в DP | 8/10/12 — все проходят. Стабильна. |
| `UNIQUENESS_POWER` | 3 | Степень ECC uniqueness | **Критична.** UP=1.5 — 0/36 комбинаций проходят. UP=2 — 18/36. UP=3 — 36/36. Runaway дискриминант. |
| `SIGMA_CAP` | 0.25 | Max σ в spatial Gaussian | 0.20/0.25/0.30 — все проходят. Нечувствительна. |
| `MIN_SPATIAL_FLOOR` | 0.15 | Нижняя граница spatial penalty | Не варьировалась в grid search (фиксирована) |
| `WORDS_WINDOW` | 3 | Размер sliding window для bag-of-words | Не варьировалась в grid search |

### 11.1 Почему UNIQUENESS_POWER=3 — минимум

**Доказано живым прогоном:** С UP=1.5 на Runaway:
- Chorus 3 DP window сдвигается с LRC[48] на LRC[50]
- LRC[48]="Never say goodbye" выпадает из DP-окна → orphan → fallback в Bridge (а не Chorus 3)
- LRC[55]="I wanna run away and open up my mind" крадется у Outro → Outro start=56 (не 55)

**Механизм:** UP влияет на uniqueness-scoring в Pass 1. При UP=1.5 все кандидаты получают почти одинаковый uniqueness → DP не может различить хорошие и плохие цепочки → startIdx плавает.

### 11.2 Интерфейс

```typescript
export interface SyncTuning {
  MIN_CANDIDATE_SCORE: number;  // 0.40
  K: number;                    // 10
  MIN_SPATIAL_FLOOR: number;    // 0.15
  UNIQUENESS_POWER: number;     // 3
  SIGMA_CAP: number;            // 0.25
  WORDS_WINDOW: number;         // 3
}

export const DEFAULT_TUNING: SyncTuning = { /* значения выше */ };

// Опциональный override для grid search:
function blockFirstLineSync(genius, lrc, tuning?: Partial<SyncTuning>): MatchResult
```

---

## 12. Известные архитектурные ограничения

| Арена | Проблема | Статус |
|---|---|---|
| **A3** — Repeated Hook Ambiguity | Припев и куплет с идентичными строками. index-based G/L ratio не различает — нужно time-based. | 🟡 Архитектурно нереализуемо на текущем движке (TC-A3) |
| **A8** — Long Gap Drift | Большой разрыв между блоками (40+ строк) — contentMatch теряет фокус. Ограничение line-level candidate retrieval. | 🟡 Архитектурно нереализуемо на текущем движке (TC-A8) |
| **A4/A5/A7** | Никогда не существовали в коде | — |
| MJ Solo NOT MAPPED | Solo (без текста) — пустой контент, ожидаемо | ✅ Не баг |
| MJ Bridge 2 | "Skinhead dead head everybody gone bad" — одна строка, всегда NOT MAPPED | ✅ Не баг |
| CGP порог 0.9 | Confidence-порог для CGP — не калиброван, но работает | 📋 Отложено (см. OPEN-ITEMS) |

---

## 13. Ключевые файлы

| Файл | Роль |
|---|---|
| `src/services/auto-lyrics.service.ts` | **Ядро:** blockFirstLineSync (2142 строки), Variant B, 4-pass pipeline, §7 константы |
| `src/services/__tests__/auto-lyrics.match.test.ts` | 69 тестов: MJ регрессия (TC-141/142), Runaway (TC-150/152/153/155/156), Arena A1/A2/A6 |
| `src/services/__tests__/mj-cgp-dryrun.test.ts` | 3 теста: реальный MJ CGP + Solo gap-assignment |
| `src/services/__tests__/auto-lyrics.grid-search.test.ts` | Grid search (108 комбинаций) — инструмент калибровки, не committed |
| `src/blocks/parser/tagged-lyrics.parser.ts` | Парсинг Genius-текста в DetectedBlock[] |
| `src/blocks/parser/block-taxonomy.ts` | TAXONOMY_VERSION и система типов |
| `src/utils/block-utils.ts` | computeLocalStopWords и вспомогательные функции |

---

## 14. История ключевых изменений

| Коммит | Что |
|---|---|
| `24a32d0` | SyncTuning interface + DEFAULT_TUNING + grid search |
| `b3a87b3` | fix: commit message correction — "confirmed via grid search" |
| (см. `git log` для полной истории TC-096..TC-155) |

---

*Этот документ — карта системы, не журнал изменений.*
*Для проверки статуса конкретных паттернов — `CONTINUOUS-TESTING-REGISTRY.md`.*
*Для отложенных решений — `OPEN-ITEMS.md`.*
