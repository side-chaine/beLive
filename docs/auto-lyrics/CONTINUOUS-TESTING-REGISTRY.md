# Auto-Lyrics: Continuous Testing Registry

> **Живой журнал тестирования** — сюда записываются все проверенные треки,
> обнаруженные паттерны, статус и дата последней верификации.
>
> Новый трек → новая строка. Не редактировать старые записи без перепроверки.
> Дата в колонке "Last verified" должна обновляться при каждом подтверждении.

**Формат добавления:**
```
| YYYY-MM-DD | Трек/фикстура | Паттерн | ✅ / ❌ / 🟡 / 📋 | Кто подтвердил | YYYY-MM-DD | Примечание |
```

---

## Registry

| # | Дата доб. | Трек / Фикстура | Блоков | LRC | Паттерн(ы) обнаружены | Статус | Подтверждено | Last verified | Примечание |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-06-29 | MJ synthetic (match tests) | 16 | 79 | **TC-6A**: все 16 блоков маппятся (0 NOT MAPPED при тестовых данных) | ✅ Fixed | `b3a87b3` (позднее подтверждение на реальном MJ) | 2026-07-05 | TC-141/142/150 финально доказаны на реальном MJ |
| 2 | 2026-06-29 | MJ synthetic | 16 | 79 | **TC-6A**: повторяющиеся Verse 4/5 с "Skinhead" — occurrence-aware fallback | ✅ Fixed | 88c0be0 | 2026-07-05 | |
| 3 | 2026-06-29 | MJ synthetic | 16 | 79 | **TC-6A**: нет пересечения lineIndices (usedLrcIndices guard) | ✅ Fixed | 88c0be0 | 2026-07-05 | |
| 4 | 2026-06-29 | MJ synthetic | 16 | 79 | **TC-6D**: Post-Chorus маппится несмотря на shared vocabulary с Chorus | ✅ Fixed | 88c0be0 | 2026-07-05 | Stop-word filtered fingerprints |
| 5 | 2026-06-29 | MJ synthetic | 16 | 79 | **TC-6D**: Bridge маппится несмотря на rephrased LRC | ✅ Fixed | 88c0be0 | 2026-07-05 | |
| 6 | 2026-06-29 | MJ synthetic | 16 | 79 | **TC-6C**: Solo получает gap-assigned строки (не пустой) | ✅ Не баг | 88c0be0 | 2026-07-05 | Gap-fill, не content-match |
| 7 | 2026-06-29 | MJ synthetic | 16 | 79 | **TC-6B**: ни один блок не имеет oversized range (>3× contentLines) | ✅ Fixed | 88c0be0 | 2026-07-05 | `_oversized` diagnostic |
| 8 | 2026-06-29 | MJ synthetic | 16 | 79 | **TC-6C**: пустой Solo (gap между mapped блоками) — gap-assigned | ✅ Не баг | 88c0be0 | 2026-07-05 | |
| 9 | 2026-06-29 | MJ synthetic | 4 | — | **Fix B**: Post-Chorus выбирает max idx (4) а не min idx (2) при равных scores | ✅ Fixed | 88c0be0 | 2026-07-05 | Backward tiebreaker |
| 10 | 2026-06-29 | MJ synthetic | — | — | **Fix C**: chrono-violated nextStart пропускается в Section 4 | ✅ Fixed | 88c0be0 | 2026-07-05 | Chronological guard |
| 11 | 2026-06-29 | MJ synthetic | — | — | **Fix E**: capped range (эластичность +1 только для 1-line blocks) | ✅ Fixed | 88c0be0 | 2026-07-05 | |
| 12 | 2026-06-29 | MJ synthetic | — | — | **Fix F**: chrono penalty bailout при score ≥ 0.8 | ✅ Fixed | 88c0be0 | 2026-07-05 | |
| 13 | 2026-06-29 | MJ synthetic | 3 | — | **Fix A**: "deadhead" vs "dead head" — compound word match | ✅ Fixed | 88c0be0 | 2026-07-05 | |
| 14 | 2026-06-30 | MJ synthetic | 4 | — | **TC-122 GSS-DP**: Skip Chain — Chorus получает orphan через TC-142 content-aware routing | ✅ Fixed | fd934bf | 2026-07-05 | GSS-DP global lookback |
| 15 | 2026-06-30 | MJ synthetic | — | — | **TC-122**: нет пересечения lineIndices в GSS-DP chain | ✅ Fixed | fd934bf | 2026-07-05 | |
| 16 | 2026-06-30 | MJ synthetic | — | — | **B4 Weighted Interpolation**: все блоки ≥ 1 строки при неравномерной структуре | ✅ Fixed | fd934bf | 2026-07-05 | |
| 17 | 2026-06-30 | MJ synthetic | 3 | — | **Stress 1**: Timestamp Drift — 3 блока, корректный chronological order | ✅ Fixed | fd934bf | 2026-07-05 | |
| 18 | 2026-06-30 | MJ synthetic | 3 | — | **Stress 3**: Unique Hook Paradox — 3 identical blocks, 3 identical LRC lines, без overlap | ✅ Fixed | fd934bf | 2026-07-05 | ECC uniqueness доказана |
| 19 | 2026-07-01 | MJ synthetic | — | — | **TC-123**: Determinism — идентичные входы → идентичный output (ref equality) | ✅ Fixed | fd934bf | 2026-07-05 | |
| 20 | 2026-07-01 | MJ synthetic | — | — | **TC-130**: Anti-Overlap Guard — occupied guard активен, нет пересечений | ✅ Fixed | fd934bf | 2026-07-05 | |
| 21 | 2026-07-01 | MJ synthetic | — | — | **TC-130**: все assigned lineIndices внутри LRC bounds | ✅ Fixed | fd934bf | 2026-07-05 | |
| 22 | 2026-06-30 | MJ synthetic | — | — | **TC-141**: Tight cap — блок с 8 строками не съедает чужие индексы | ✅ Fixed | fd934bf | 2026-07-05 | Эластичность +1 только для 1-line |
| 23 | 2026-06-30 | MJ synthetic | — | — | **TC-142**: Content-aware orphan routing — orphan привязывается по text match, не позиции | ✅ Fixed | fd934bf | 2026-07-05 | |
| 24 | 2026-07-01 | MJ synthetic | — | — | **TC-150**: Structural Window Guard — orphan ДО первого mapped → full-range; ПОСЛЕ всех mapped → BLOCKED | ✅ Fixed | fd934bf | 2026-07-05 | |
| 25 | 2026-07-01 | MJ synthetic | — | — | **TC-150**: MJ-like long track — structural window блокирует content routing поздних orphans к ранним блокам | ✅ Fixed | fd934bf | 2026-07-05 | |
| 26 | 2026-07-01 | MJ synthetic | — | — | **CGP dryrun**: Solo gap-assignment после CGP работает | ✅ Fixed | 1d2d47e | 2026-07-05 | |
| — | — | — | — | — | — | — | — | — | — |
| 27 | 2026-07-04 | **MJ Real** (They Don't Care About Us) | 16 | 79 | "wanna"/"want to" LRC-версийная неоднозначность — lrclib имеет 2+ версии текста | ✅ Fixed (Variant B) | fc7bf3d | 2026-07-05 | TC-096: Variant B заново выбирает LRC версию при low coverage |
| 28 | 2026-07-04 | MJ Real | 16 | 79 | **Intro NOT MAPPED** при неверном выборе LRC → триггер Variant B retry | ✅ Fixed | fc7bf3d | 2026-07-05 | |
| 29 | 2026-07-04 | MJ Real | 16 | 79 | "All I wanna say" — repeated identical Chorus (не баг, структурная особенность песни) | ✅ Не баг | fc7bf3d | 2026-07-05 | ECC uniqueness не отсекает — содержит разные слова |
| 30 | 2026-07-04 | MJ Real | 16 | 79 | **Solo NOT MAPPED** — пустой контент, gap-assigned | ✅ Не баг | 1d2d47e | 2026-07-05 | |
| 31 | 2026-07-04 | MJ Real | 16 | 79 | **Bridge 2** ("Skinhead dead head") — 1 строка, NOT MAPPED | ✅ Не баг | 1d2d47e | 2026-07-05 | Слишком короткий для DP |
| 32 | 2026-07-04 | MJ Real | 16 | 79 | **Pass 2b**: Positional gap fill (Solo между Verse 3 и Bridge) — работает | ✅ Fixed | fd934bf | 2026-07-05 | TC-BUG-03-B |
| 33 | 2026-07-04 | MJ Real | 16 | 79 | **CGP Real MJ**: Outro 54→55 fix — containment guard выбирает "I wanna run away and open up my mind" вместо "I wanna shut the door / And open up my mind" | ✅ Fixed | 1d2d47e | 2026-07-05 | |
| — | — | — | — | — | — | — | — | — | — |
| 34 | 2026-07-04 | **Runaway** (Linkin Park) | 9 | 59 | **contentLines overwrite** (TC-152) — contentLines перезаписывались при пустом lineIndices | ✅ Fixed | fd934bf | 2026-07-05 | |
| 35 | 2026-07-04 | Runaway | 9 | 59 | **position-blind tie-break** (TC-153) — при равном overlap победителем был ближайший по индексу блок, а не semantically близкий | ✅ Fixed | fd934bf | 2026-07-05 | MJ Verse 3 "Tell me" крал строку у Post-Chorus 2 |
| 36 | 2026-07-04 | Runaway | 9 | 59 | **Outro/Chorus3 граница** (CGP/TC-155) — Outro привязывался к "And open up my mind" вместо "I wanna run away and open up my mind" | ✅ Fixed | 1d2d47e | 2026-07-05 | containment 0.5 vs 1.0 |
| 37 | 2026-07-04 | Runaway | 9 | 59 | **Chorus 1 start** LRC[10..13] — DP picks LRC[13] "Instead of wondering why", первые 3 строки становятся orphans, TC-142 routes их обратно | ✅ Fixed | 1d2d47e | 2026-07-05 | |
| 38 | 2026-07-04 | Runaway | 9 | 59 | **Bridge** 11 LRC lines (самый длинный блок) — все строки назначены корректно | ✅ Fixed | 1d2d47e | 2026-07-05 | |
| 39 | 2026-07-04 | Runaway | 9 | 59 | **Chorus 1 ≥ 5 строк** — захватывает split chorus lines | ✅ Fixed | 1d2d47e | 2026-07-05 | LRC split: Genius 4 → LRC 8 |
| 40 | 2026-07-04 | Runaway | 9 | 59 | **Chorus 3 → Outro boundary**: UP=1.5 → Chorus 3 start сдвигается 48→50, LRC[48] уходит в Bridge | ✅ Fixed (§7 calibration) | b3a87b3 | 2026-07-05 | UP=3 доказывается grid search, Runaway — discriminator |
| — | — | — | — | — | — | — | — | — | — |
| 41 | 2026-07-04 | **A1 — Repeated Hook** | 3 | — | Identical Chorus text в Verse 1 и Verse 2 — ECC uniqueness НЕ отсекает | ✅ Pass | fd934bf | 2026-07-05 | UNIQUENESS_POWER=3 не threshold |
| 42 | 2026-07-04 | **A2 — Filler Instrumental** | 3 | — | MIN_CANDIDATE_SCORE=0.40 фиксит Verse 2 border case (J=0.444 ≥ 0.40) | ✅ Pass | fd934bf | 2026-07-05 | При 0.45 был бы NOT MAPPED |
| 43 | 2026-07-04 | **A6 — Micro-Track** | 3 | 3 | SIGMA cap at 0.25 улучшает spatial discrimination при N=3 | ✅ Pass | fd934bf | 2026-07-05 | |
| — | — | — | — | — | — | — | — | — | — |
| 44 | 2026-07-05 | **A3 — Repeated Hook Ambiguity** | — | — | G/L ratio index-based, не time-based — не может различить идентичные строки Chorus и Verse | 🟡 Архитектурно нерешаемо | — | — | Требует time-based ratio — фундаментальное ограничение текущего движка |
| 45 | 2026-07-05 | **A8 — Long Gap Drift** | — | — | line-level candidate retrieval при 40+ строках gap теряет фокус | 🟡 Архитектурно нерешаемо | — | — | Требует block-level retrieval — не реализовано |
| 46 | 2026-07-05 | **A4/A5/A7** | — | — | Никогда не существовали в коде | — | — | — | Визуализированы как гипотетические, не реализованы |
| — | — | — | — | — | — | — | — | — | — |
| 47 | 2026-07-05 | **§7 Calibration Grid Search** | 108 combos | 5 fixtures | **MIN_CANDIDATE_SCORE=0.40** — все 4 значения проходят с UP=3 | ✅ Откалибровано | b3a87b3 | 2026-07-05 | 4×3×3×3=108 комбинаций |
| 48 | 2026-07-05 | §7 Calibration | 108 | 5 | **K=10** — 8/10/12 все проходят | ✅ Откалибровано | b3a87b3 | 2026-07-05 | Стабильна |
| 49 | 2026-07-05 | §7 Calibration | 108 | 5 | **UNIQUENESS_POWER=3** — UP=1.5 0/36, UP=2 18/36, UP=3 36/36 | ✅ Откалибровано | b3a87b3 | 2026-07-05 | **Дискриминант.** Runaway — фильтр |
| 50 | 2026-07-05 | §7 Calibration | 108 | 5 | **SIGMA_CAP=0.25** — 0.20/0.25/0.30 все проходят | ✅ Откалибровано | b3a87b3 | 2026-07-05 | Нечувствительна |
| — | — | — | — | — | — | — | — | — | — |
| 51 | 2026-07-05 | Качество кода | — | — | **Byte identity**: `blockFirstLineSync()` без tuning === с явным `DEFAULT_TUNING` | ✅ Доказано | b3a87b3 | 2026-07-05 | Те же lineIndices, orphan routing, CGP correction |
| 52 | 2026-07-05 | Тестовый прогон | 50 файлов | 666 | **666/666 тестов pass** (50 файлов, все тесты зелёные). Grid search 108×5 combos — штатно 8.9s | ✅ Pass | vitest run 2026-07-05 | 2026-07-05 | 69 match + 3 CGP + 1 grid search + остальные 593 теста проекта |

---

## Как добавить новый трек

1. Скопируй строку таблицы (формат выше)
2. Заполни: дата, трек, кол-во блоков/LRC строк, обнаруженный паттерн
3. Статус: `✅ Pass / ✅ Fixed / ✅ Не баг / 🟡 Архитектурно нерешаемо / 📋 Отложено / ❌ Баг / 🔄 Тестируется`
4. Укажи, чем подтверждено (коммит / live-run / тест)
5. Поставь today как `Last verified`

**Правила:**
- Один паттерн = одна строка (даже если обнаружен в одном тесте)
- Если паттерн исправлен к позднейшей дате — обнови `Last verified`, но сохрани `Дата доб.` (история)
- Если трек больше не проходит (регрессия) — смени статус на `❌ Баг` и укажи дату
- `🟡 Архитектурно нерешаемо` — только после подтверждения, что fix невозможен на текущем движке без фундаментальных изменений
- Живой прогон в браузере (`live-run`) отмечать отдельно: `✅ Live-run`

---

*Этот документ — рабочий журнал, не архив. Добавляй строки при тестировании новых треков.*
*Для архитектурной карты — `MASTER-ARCHITECTURE.md`.*
*Для отложенных решений — `OPEN-ITEMS.md`.*
