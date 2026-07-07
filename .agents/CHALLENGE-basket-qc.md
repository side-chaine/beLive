# 🏆 CHALLENGE: Basket Quality Control (Pass 2.5)

## Соревнование архитектурных решений

| Участники | Центр_32 vs Центр_33 |
|-----------|---------------------|
| **Судейство** | Sonnet (главный архитектор) + 007 (верификация) |
| **Формат** | Каждый Центр предлагает АЛГОРИТМ для слоя контроля качества |
| **Победитель** | Чьё решение войдёт в финальный MERGE (или комбинация идей) |
| **Дедлайн** | До появления Sonnet (≈ 1 час) |

---

## Часть 0: Проблема за 30 секунд (для тех, кто не читал REGISTRY)

**Симптом:** Трек Linkin Park — Runaway. Последняя строка Chorus 3 ("And open up my mind", LRC[54]) уходит в блок Outro. Текст не теряется, но строка отображается под неверной вкладкой блока.

**Почему это произошло:** Система ищет начало Outro среди LRC-строк. LRC[54] и LRC[55] получают одинаковый Jaccard (1.0) из-за `WORDS_WINDOW=3` (LRC[54] "подсматривает" две следующие Outro-строки в своём окне). А по gap penalty LRC[54] выгоднее — она ближе к Chorus 3. DP выбирает её.

**Корень:** Нет верификации границ. После того как DP разложил строки по блокам, никто не проверяет: "А первая строка блока действительно соответствует первой строке из Genius?"

---

## Часть 1: Что нужно построить

### Концепция: Basket Quality Control

> **Метафора (утверждена пользователем):**
>
> Genius-блоки = **корзинки** с наклейками.
> На каждой корзинке написан точный список продуктов (строки из Genius).
>
> LRC-строки = **продукты** на складе.
>
> Текущий алгоритм (DP) = **робот-упаковщик**, который НЕ ЧИТАЕТ наклейки.
> Он нюхает продукты и кладёт их в ту корзинку, где запах похож.
>
> **Что нужно = Контролёр качества (Pass 2.5)**
> После упаковки контролёр проверяет каждую корзинку:
> - Первая строка в корзинке совпадает с первой строкой на наклейке?
> - Последняя строка не является первой строкой следующей корзинки?
> - Все продукты в корзинке действительно относятся к этому блоку?

### Где внедряется

Новый слой **между** Backward Trace (строки 503-532) и Section 4 (range assignment, строки 544-604).

То есть:
```
Pass 2 (DP) → [← [НОВЫЙ: Quality Control Pass 2.5] → [Pass 3 (orphans)
```

**Не трогать (frozen):**
- Сам DP (TC-122, строки 449-501) — без OVERRIDE от Центра
- Pass 3 (orphans, строки 756-914)
- Калибровочные константы (SIGMA, MIN_CANDIDATE_SCORE, K, UNIQUENESS_POWER)
- WORDS_WINDOW=3 (пока не доказано обратное)

---

## Часть 2: Полный код, который нужно понять

### 2.1 Структура данных кандидата

```typescript
interface Candidate {
  lrcIdx: number;        // исходный индекс в displayLines
  validRank: number;     // ранг среди валидных строк
  rawScore: number;      // Jaccard bag-of-words score
  uniqueness: number;    // ECC uniqueness блока
  spatialPenalty: number; // Gaussian position penalty
  upc: number;           // финальный вес для DP (= rawScore * uniqueness * spatial)
}
```

### 2.2 Scoring функции (строки 300-378)

```typescript
// Сбор слов для Jaccard: берёт maxLines строк, собирает слова длиной > 2, 
// исключая global stop words (слова в >40% LRC-строк)
function buildWordSet(lines: string[], maxLines: number, stopWords: Set<string>): Set<string> {...}

// Jaccard overlap
function jaccardOverlap(a: Set<string>, b: Set<string>): number {...}

// Окно LRC-строк: берёт count строк начиная с startPos
function getValidWindowLines(startPos: number, count: number): string[] {...}

// Spatial penalty: Gaussian по gRatio vs lRatio
// gRatio = 0.6 * textRatio + 0.4 * rankRatio (позиция блока)
// lRatio = validRank / M (позиция кандидата)
function calcSpatialPenalty(gR: number, validRank: number): number {
  const lR = validRank / M;
  const raw = Math.exp(-Math.pow(gR - lR, 2) / (2 * SIGMA * SIGMA));
  return Math.max(raw, MIN_SPATIAL_FLOOR);  // floor = 0.15
}
```

### 2.3 Candidate collection (строки 381-425)

```typescript
// Для каждого блока:
for (let bi = 0; bi < N; bi++) {
  // 1. Строим word set из первых WORDS_WINDOW (3) строк Genius блока
  const wordsG = buildWordSet(contentLines, WORDS_WINDOW, _globalStopWords);
  
  // 2. Полный проход по ВСЕМ LRC-строкам
  const rawPool: { validRank: number; lrcIdx: number; rawScore: number }[] = [];
  for (let p = 0; p < M; p++) {
    const wordsL = buildWordSet(getValidWindowLines(p, WORDS_WINDOW), WORDS_WINDOW, _globalStopWords);
    const rawScore = jaccardOverlap(wordsG, wordsL);
    if (rawScore >= MIN_CANDIDATE_SCORE) rawPool.push({ validRank: p, lrcIdx: validIndices[p], rawScore });
  }
  
  // 3. ECC uniqueness — один раз на блок
  let matchMass = 0;
  for (const c of rawPool) {
    const normalized = (c.rawScore - MIN_CANDIDATE_SCORE) / (1 - MIN_CANDIDATE_SCORE);
    matchMass += Math.pow(Math.max(0, normalized), UNIQUENESS_POWER);
  }
  const uniqueness = Math.max(0.2, Math.min(1.0, 1.0 / Math.max(1, matchMass)));
  
  // 4. UPC на каждого кандидата + top-K сортировка
  const scored: Candidate[] = rawPool.map(c => ({
    lrcIdx: c.lrcIdx,
    validRank: c.validRank,
    rawScore: c.rawScore,
    uniqueness,
    spatialPenalty: calcSpatialPenalty(gRatio[bi], c.validRank),
    upc: c.rawScore * uniqueness * spatial,
  }));
  scored.sort((a, b) => b.upc - a.upc || a.lrcIdx - b.lrcIdx);
  allCandidates.push(scored.slice(0, K));  // K = 10
}
```

### 2.4 DP Forward Pass (строки 449-501)

```typescript
for (let bi = 0; bi < N; bi++) {
  for (let k = 0; k < allCandidates[bi].length; k++) {
    const cand = allCandidates[bi][k];
    let bestTotal = -Infinity;
    
    // GLOBAL lookback — все предыдущие блоки
    for (let prevBi = 0; prevBi < bi; prevBi++) {
      for (let pk = 0; pk < allCandidates[prevBi].length; pk++) {
        const prevCand = allCandidates[prevBi][pk];
        if (!dp[prevBi][pk].resolved) continue;
        if (prevCand.lrcIdx >= cand.lrcIdx) continue;  // монотонность
        
        // Gap penalty
        const actualGap = cand.validRank - prevCand.validRank;
        const expectedLinesSum = cumExpectedLines[bi] - cumExpectedLines[prevBi];
        const expectedScaled = expectedLinesSum * S;  // S = M / totalExpectedLines
        const penalty = Math.pow(
          (actualGap - expectedScaled) / (expectedScaled + 0.5), 2
        );
        
        const total = dp[prevBi][pk].totalScore + cand.upc - penalty;
        if (total > bestTotal) { bestTotal = total; bestPrevBi = prevBi; bestPrevK = pk; }
      }
    }
    
    if (bestPrevBi >= 0) {
      dp[bi][k] = { totalScore: bestTotal, prevBlockIdx: bestPrevBi, prevK: bestPrevK, resolved: true };
    } else if (cand.upc > 0) {
      dp[bi][k] = { totalScore: cand.upc, prevBlockIdx: -1, prevK: -1, resolved: true };
    }
  }
}
```

### 2.5 Backward Trace + startIdx assignment (строки 503-540)

```typescript
// Глобальный максимум
let globalBestBi = -1, globalBestK = -1, globalBestTotal = -Infinity;
for (let bi = 0; bi < N; bi++) {
  for (let k = 0; k < dp[bi].length; k++) {
    if (dp[bi][k].resolved && dp[bi][k].totalScore > globalBestTotal) {
      globalBestTotal = dp[bi][k].totalScore;
      globalBestBi = bi;
      globalBestK = k;
    }
  }
}

// Back trace — строим _lrcStartIdx для каждого блока
if (globalBestBi >= 0) {
  let curBi = globalBestBi;
  let curK = globalBestK;
  while (curBi >= 0) {
    _lrcStartIdx[curBi] = allCandidates[curBi][curK].lrcIdx;
    _chosenMatchScore[curBi] = allCandidates[curBi][curK].rawScore;
    const cell = dp[curBi][curK];
    if (cell.prevBlockIdx < 0) break;
    curBi = cell.prevBlockIdx;
    curK = cell.prevK;
  }
}
```

### 2.6 Section 4 — Range Assignment (строки 544-604)

```typescript
const occupied = new Set<number>();
for (let i = 0; i < blocks.length; i++) {
  const startIdx = (blocks[i] as any)._lrcStartIdx;
  if (startIdx == null || startIdx < 0) continue;
  
  // Найти следующий блок с startIdx
  let endIdx = displayLines.length;
  for (let j = i + 1; j < blocks.length; j++) {
    const nextStart = (blocks[j] as any)._lrcStartIdx;
    if (nextStart != null && nextStart >= 0 && nextStart > startIdx) {
      endIdx = nextStart;
      break;
    }
  }
  
  // Capped range: startIdx до min(endIdx, startIdx + expectedLines + elasticity)
  const expectedLines = (blocks[i] as any)._expectedLines ?? 0;
  const elasticity = expectedLines <= 1 ? 1 : 0;
  const cappedEnd = expectedLines > 0
    ? Math.min(endIdx, startIdx + expectedLines + elasticity)
    : endIdx;
  
  blocks[i].lineIndices = [];
  for (let k = startIdx; k < cappedEnd; k++) {
    if (occupied.has(k)) continue;
    blocks[i].lineIndices.push(k);
    occupied.add(k);
  }
}
```

---

## Часть 3: Данные для тестирования

### 3.1 Runaway — Genius текст

```typescript
const RUNAWAY_GENIUS = [
  '[Verse 1]',
  'Graffiti decorations, under a sky of dust',
  'A constant wave of tension, on top of broken trust',
  'The lessons that you taught me, I learned were never true',
  '',
  '[Pre-Chorus]',
  'Now I find myself in question',
  'They point the finger at me again',
  'Guilty by association',
  'You point the finger at me again',
  '',
  '[Chorus]',
  'I wanna run away, never say goodbye',
  'I wanna know the truth, instead of wondering why',
  'I wanna know the answers, no more lies',
  'I wanna shut the door, and open up my mind',
  '',
  '[Verse 2]',
  'Paper bags and angry voices, under a sky of dust',
  'Another wave of tension, has more than filled me up',
  'All my talk of taking action, these words were never true',
  '',
  '[Pre-Chorus]',
  'Now I find myself in question',
  'They point the finger at me again',
  'Guilty by association',
  'You point the finger at me again',
  '',
  '[Chorus]',
  'I wanna run away, never say goodbye',
  'I wanna know the truth, instead of wondering why',
  'I wanna know the answers, no more lies',
  'I wanna shut the door, and open up my mind',
  '',
  '[Bridge]',
  'I\'m gonna run away, and never say goodbye',
  'Gonna run away, gonna run away',
  'Gonna run away, gonna run away',
  'I\'m gonna run away, and never wonder why',
  'Gonna run away, gonna run away',
  'Gonna run away, gonna run away',
  'I\'m gonna run away, and open up my mind',
  'Gonna run away, gonna run away',
  'Mind (Gonna run away, gonna run away)',
  'Mind (Gonna run away, gonna run away)',
  'Mind (Gonna run away, gonna run away)',
  '',
  '[Chorus]',
  'I wanna run away, never say goodbye',
  'I wanna know the truth, instead of wondering why',
  'I wanna know the answers, no more lies',
  'I wanna shut the door, and open up my mind',
  '',
  '[Outro]',
  'I wanna run away and open up my mind',   // ← строка 1
  'I wanna run away and open up my mind',   // ← строка 2
  'I wanna run away and open up my mind',   // ← строка 3
  'I wanna run away and open up my mind',   // ← строка 4
].join('\n');
```

### 3.2 Runaway — LRC (критические строки 47-58)

```
LRC[47] = "I wanna run away"
LRC[48] = "Never say 'goodbye'"
LRC[49] = "I wanna know the truth"
LRC[50] = "Instead of wondering why"
LRC[51] = "I wanna know the answers"
LRC[52] = "No more lies"
LRC[53] = "I wanna shut the door"
LRC[54] = "And open up my mind"            ← последняя строка Chorus 3
LRC[55] = "I wanna run away and open up my mind"  ← первая строка Outro
LRC[56] = "I wanna run away and open up my mind"
LRC[57] = "I wanna run away and open up my mind"
LRC[58] = "I wanna run away and open up my mind"
```

### 3.3 Runtime-дамп (что выбрал DP сейчас)

```
[Pass2-DIAG] Block 2 [chorus] "Chorus": startIdx=13, lineIndices=[13,14,15,16]
[Pass2-DIAG] Block 5 [chorus] "Chorus": startIdx=29, lineIndices=[29,30,31,32]
[Pass2-DIAG] Block 6 [bridge] "Bridge": startIdx=36, lineIndices=[36..46]
[Pass2-DIAG] Block 7 [chorus] "Chorus 3": startIdx=48, lineIndices=[48,49,50,51]
[Pass2-DIAG] Block 8 [outro] "Outro": startIdx=54, lineIndices=[54,55,56,57]  ← BUG!
```

После Pass 3 (orphans) картина:
```
Chorus 3: [47, 48, 49, 50, 51, 52, 53]  — 7 строк (47 и 52-53 через orphan routing)
Outro:    [54, 55, 56, 57, 58]            — 5 строк (58 через orphan fallback)
```

**Проблема:** LRC[54]="And open up my mind" — в Outro, хотя должна быть в Chorus 3.

### 3.4 Числа (verified)

Параметры для Outro (bi=8, N=9):
- gRatio[8] = 0.6 × (37/41) + 0.4 × (8/8) = **0.9415**
- σ = max(0.08, min(0.25, 1.5/9)) = **0.167**
- S = 59/41 = **1.439**
- expectedLines[8] = **4** (нет расхождения)

| Кандидат | rawScore | lR | spatial | upc (при u=0.3) | gap от Chorus3(48) | penalty |
|----------|----------|-----|---------|-----------------|-------------------|---------|
| LRC[54] | **1.0** | 0.9153 | 0.9878 | 0.2963 | 6 | **0.0015** |
| LRC[55] | **1.0** | 0.9322 | 0.9985 | 0.2996 | 7 | **0.0396** |

DP total = prevTotal + upc - penalty:
- total[54] = prevTotal + 0.2963 - 0.0015 = **prevTotal + 0.2948**
- total[55] = prevTotal + 0.2996 - 0.0396 = **prevTotal + 0.2600**

→ LRC[54] выигрывает (gap-преимущество 0.0381 перевешивает spatial-потерю 0.0054).

---

## Часть 4: Задание для Центров

### 4.1 Что нужно спроектировать

Алгоритм **вставки между Backward Trace и Section 4**, который проверяет и
корректирует `_lrcStartIdx` для каждого блока на основе ПОЛНОГО текста
первой строки блока из Genius.

### 4.2 Обязательные требования

1. **Верификация первой строки:** Первая LRC-строка блока должна совпадать
   с первой строкой Genius этого блока (rawScore ≈ 1.0). Если нет —
   найти ближайшую LRC-строку с rawScore=1.0 и скорректировать `startIdx`.

2. **Защита от кражи:** Строка N не должна быть первой строкой
   следующего блока. Если LRC[N] совпадает с Genius строкой 1 блока B[i+1] —
   отрезать.

3. **Монотонность:** После корректировки startIdx блоков должны идти
   в хронологическом порядке (startIdx[i] < startIdx[i+1]).

4. **Не ломать существующие кейсы:**
   - Intro (иногда его текст появляется в LRC ПОСЛЕ Verse 1)
   - Solo/Instrumental (пустые блоки, gap assignment)
   - Post-Chorus (текст пересекается с Chorus)
   - Повторяющиеся блоки (Verse 1 ≡ Verse 2)
   - LRC split-lines (одна Genius строка разбита на 2+ LRC)

### 4.3 Формат ответа

Каждый Центр должен предоставить:

```
## [Центр_32 / Центр_33] — Название решения

### Алгоритм (псевдокод или JS)
<код или псевдокод>

### Как это решает TC-155
<объяснение на примере LRC[54] vs LRC[55]>

### Крайние случаи и как алгоритм их обрабатывает
- LRC split-lines:
- Intro после Verse в LRC:
- Пустой Solo:
- Дублирующиеся блоки:

### Оценка рисков
<что может сломаться>

### Название системы (предложить)
```

### 4.4 Критерии оценки (Sonnet + 007)

| Критерий | Вес |
|----------|-----|
| Решает TC-155 без сайд-эффектов | 40% |
| Читаемость и простота кода | 20% |
| Покрытие крайних случаев | 20% |
| Не создаёт каскадных багов | 20% |

---

## Часть 5: Контекст для понимания архитектуры

### Файлы, которые участвуют

| Файл | Роль |
|------|------|
| `src/services/auto-lyrics.service.ts` | Pass 2 (DP) + Pass 3 (orphans) — **основной** |
| `src/services/__tests__/auto-lyrics.match.test.ts` | Все тесты, включая Runaway |
| `src/utils/block-utils.ts` | computeLocalStopWords, эвристики |
| `src/blocks/parser/tagged-lyrics.parser.ts` | Парсинг Genius-текста в блоки |

### Ключевые константы (менять нельзя без OVERRIDE)

| Константа | Значение | Описание |
|-----------|----------|----------|
| WORDS_WINDOW | 3 | Сколько строк берётся для Jaccard |
| K | 10 | top-K кандидатов для DP |
| MIN_CANDIDATE_SCORE | 0.40 | Порог Jaccard для попадания в rawPool |
| MIN_SPATIAL_FLOOR | 0.15 | Минимальный spatial penalty |
| SIGMA | max(0.08, 0.25, 1.5/N) | Gaussian sigma для spatial |

### Уже проверенные патчи (не трогать)

- TC-142: Content-Aware Orphan Routing
- TC-150: Structural Window Guard
- TC-152: Genius WordSet (оригинальный текст для Pass 3)
- TC-153: Tie-break по lastValidBlockIdx при равном overlap
- TC-130: Occupied-Line Guard
- TC-141: Tight Cap

---

## Часть 6: Ответ — структура

Ответ каждого Центра должен быть **одним сообщением** в формате:

```
---START_CENTER_X---

[весь ответ Центра, как описано в 4.3]

---END_CENTER_X---
```

Это позволит 007 и Sonnet легко сравнивать решения.

---

## Напутствие

> "Мы не ищем заплатку для одной строки. Мы строим контролёра качества,
> который гарантирует: каждая корзинка содержит ТОЛЬКО свои продукты,
> границы блоков неприкосновенны, и ни одна строчка не залезет в чужой блок."
