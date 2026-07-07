# 📦 MICRO-PACK: CGP Dry-Run (TC-155 Pre-Flight)

**ЦЕЛЬ:** Реализовать изолированную CGP (Containment Guard Point) dry-run функцию, которая логирует потенциальные коррекции `_lrcStartIdx` но не применяет их. Запустить на Runaway (9 blocks) + MJ для pre-flight проверки перед внедрением в основной pipeline.

**ФАЙЛ:** `src/services/auto-lyrics.service.ts`
**ЗОНА ВСТАВКИ:** Между строкой 532 (конец backward trace) и строкой 534 (применение `_lrcStartIdx` к blocks[]). Точка: после `}` закрывающего backward trace (строка 532) и ПЕРЕД `// ── Применяем _lrcStartIdx / _matchScore к blocks[] ──` (строка 534).

**ФАЙЛ ТЕСТОВ:** `src/services/__tests__/auto-lyrics.match.test.ts`
**ЗОНА ТЕСТА:** После последнего теста Runaway (строка 1821) или перед закрывающим `});`

---

## ДЕЙСТВИЕ 1: Добавить CGP dry-run функцию в `auto-lyrics.service.ts`

Вставить следующий блок кода **между строкой 532 и строкой 534**:

```typescript
  // ═══ CGP (Containment Guard Point) — Pass 2.5 Quality Control ═══
  // Проверяет границы блоков после DP, ДО Section 4 и Pass 3.
  // DRY-RUN MODE: только логирует, НЕ применяет коррекции.
  if (import.meta.env.DEV) {
    const GENIUS_FIRST_LINES: string[] = [];
    for (let bi = 0; bi < N; bi++) {
      const gl = (tagResult.blocks[bi]?.contentLines ?? []).filter((l: string) => l.trim());
      GENIUS_FIRST_LINES.push(gl.length > 0 ? gl[0] : '');
    }

    function containmentScore(geniusLine: string, lrcLine: string): number {
      const gNorm = _normalizeText(geniusLine);
      const lNorm = _normalizeText(lrcLine);
      const gWords = gNorm.split(/\s+/).filter(w => w.length > 2);
      const lWords = new Set(lNorm.split(/\s+/).filter(w => w.length > 2));
      if (gWords.length === 0) return 1; // empty → skip
      let match = 0;
      for (const w of gWords) if (lWords.has(w)) match++;
      return match / gWords.length;
    }

    console.log('╔═══ CGP DRY-RUN ═══');
    for (let bi = 0; bi < N; bi++) {
      const currentIdx = _lrcStartIdx[bi];
      const currentScore = _chosenMatchScore[bi];
      if (currentIdx == null || currentIdx < 0) {
        console.log(`  Block ${bi} [${tagResult.blocks[bi]?.type ?? '?'}]: NOT MAPPED (skip)`);
        continue;
      }

      const geniusFirst = GENIUS_FIRST_LINES[bi];
      if (!geniusFirst) {
        console.log(`  Block ${bi} [${tagResult.blocks[bi]?.type ?? '?'}]: empty Genius (skip)`);
        continue;
      }

      const currentLrcLine = displayLines[currentIdx];
      const contain = containmentScore(geniusFirst, currentLrcLine);
      const isLowScore = currentScore != null && currentScore < 0.6;

      // Search forward for a better candidate
      let bestForwardIdx = -1;
      let bestForwardContain = 0;
      let bestForwardRawScore = 0;
      // Use allCandidates forward search
      const candidates = allCandidates[bi] ?? [];
      for (const cand of candidates) {
        if (cand.lrcIdx <= currentIdx) continue; // must be strictly forward
        if (cand.rawScore < 0.9) continue; // only exact/near-exact matches
        const candLrcLine = displayLines[cand.lrcIdx];
        const candContain = containmentScore(geniusFirst, candLrcLine);
        if (candContain > bestForwardContain) {
          bestForwardContain = candContain;
          bestForwardIdx = cand.lrcIdx;
          bestForwardRawScore = cand.rawScore;
        }
      }

      const wouldCorrect = isLowScore && contain < 0.6 && bestForwardIdx >= 0 && bestForwardContain >= 0.6;

      console.log(
        `  Block ${bi} [${tagResult.blocks[bi]?.type ?? '?'}] "${tagResult.blocks[bi]?.label ?? ''}":\n` +
        `    Genius first line: "${geniusFirst.substring(0, 60)}"\n` +
        `    Current LRC[${currentIdx}]="${currentLrcLine.substring(0, 60)}"\n` +
        `    currentScore=${currentScore != null ? currentScore.toFixed(3) : 'N/A'}  containment=${contain.toFixed(3)}\n` +
        `    forward search: ${bestForwardIdx >= 0 ? `LRC[${bestForwardIdx}]="${displayLines[bestForwardIdx].substring(0, 60)}" contain=${bestForwardContain.toFixed(3)} rawScore=${bestForwardRawScore.toFixed(3)}` : 'no candidate'}\n` +
        `    → ${wouldCorrect ? '🟡 WOULD CORRECT' : '✅ no-op'}`
      );
    }
    console.log('╚═══ END CGP DRY-RUN ═══');
  }
```

**ВАЖНО:** Код НЕ меняет `_lrcStartIdx`, `_chosenMatchScore` или любые другие переменные. Он только логирует в `console.log`.

---

## ДЕЙСТВИЕ 2: Добавить CGP dry-run тест в `auto-lyrics.match.test.ts`

Вставить в конец файла (перед последним `});`):

```typescript
describe('CGP Dry-Run — Runaway pre-flight (TC-155)', () => {
  it('CGP: dry-run logs on Runaway — inspect console output for containment scores', () => {
    const lrc = buildLrc(RUNAWAY_LRC);
    const result = blockFirstLineSync(RUNAWAY_GENIUS, lrc);

    // Verify the function still produces correct output (CGP does not mutate)
    const notMapped = result.blocks.filter(b => b.lineIndices.length === 0);
    expect(notMapped.length).toBe(0);
    expect(hasOverlappingIndices(result.blocks)).toBe(false);

    // Verify Outro starts at LRC[54] (the known bug) — CGP does NOT fix it in dry-run
    const outro = result.blocks.find(b => b.type === 'outro');
    expect(outro).toBeDefined();
    const outroMin = Math.min(...outro!.lineIndices);
    console.log(`[CGP-TEST] Outro startIdx=${outroMin} (expected 54 — CGP dry-run does not fix)`);
    // Dry-run does not fix, so Outro still starts at 54
    // This assertion will need updating once CGP is wired in
  });
});
```

---

## ДЕЙСТВИЕ 3: Запустить верификацию

```bash
npx tsc --noEmit
npx vitest run src/services/__tests__/auto-lyrics.match.test.ts
```

**Ожидаемый результат:**
- `tsc --noEmit`: 0 новых ошибок (только pre-existing)
- `vitest`: все тесты PASS (включая новый CGP test)

---

## ДЕЙСТВИЕ 4: Запустить dry-run и собрать логи

После успешной компиляции и тестов, запустить тест с флагом `--reporter=verbose` и захватить CGP dry-run логи:

```bash
npx vitest run src/services/__tests__/auto-lyrics.match.test.ts --reporter=verbose 2>&1 | grep -A20 "CGP DRY-RUN"
```

Вывод должен показать для **всех 9 блоков Runaway**:
- Текущий `startIdx` и `currentScore`
- `containment` первой LRC строки против первой Genius строки
- Результат forward search (есть ли кандидат лучше)
- Вердикт: `🟡 WOULD CORRECT` или `✅ no-op`

**Критические проверки:**
1. Outro (bi=8): containment должен быть < 0.6, forward search должен найти LRC[55] → `🟡 WOULD CORRECT`
2. Chorus 3 (bi=7): containment может быть < 0.6 (LRC[48]="Never say goodbye" vs Genius "I wanna run away..."), но forward search НЕ должен найти ничего — LRC[47] позади, так что `✅ no-op`
3. Все остальные блоки: containment ≥ 0.6 → `✅ no-op`

---

## КОНТЕКСТ (3 строки до и после точки вставки)

```
Строка 529:      }
Строка 530:    } else {
Строка 531:      console.warn('[TC-122] GSS-DP: no resolved chain found — all blocks fall back to Pass 2');
Строка 532:    }
           ← ВСТАВИТЬ CGP DRY-RUN ЗДЕСЬ
Строка 534:    // ── Применяем _lrcStartIdx / _matchScore к blocks[] ──
Строка 535:    for (let bi = 0; bi < N; bi++) {
Строка 536:      if (_lrcStartIdx[bi] !== null) {
Строка 537:        (blocks[bi] as any)._lrcStartIdx = _lrcStartIdx[bi];
Строка 538:        (blocks[bi] as any)._matchScore = _chosenMatchScore[bi];
```

---

## ЗАПРЕЩЕНО

- ❌ НЕ менять `_lrcStartIdx`, `_chosenMatchScore` или любые переменные состояния
- ❌ НЕ трогать DP (Pass 2, строки 449-501) — frozen
- ❌ НЕ трогать Section 4 (строки 542-604)
- ❌ НЕ трогать Pass 3 (строки 756-914)
- ❌ НЕ трогать калибровочные константы (SIGMA, MIN_CANDIDATE_SCORE, K, WORDS_WINDOW, UNIQUENESS_POWER, MIN_SPATIAL_FLOOR)
- ❌ НЕ трогать `blockWordSets` или TC-152 код
