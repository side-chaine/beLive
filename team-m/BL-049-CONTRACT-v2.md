# BL-049 v2 — §12.6 governance (reconciled)

**База:** HEAD `4579868` @ ветка `806/bl-048-050`
**Статус:** финальный контракт (read-only спроектирован 001 v1 → атакован 002 A–F → сведён 001 v2)
**Инварианты:** нет хардкод-имён треков · CONF не меняется · frozen-зона не трогается · пороги = `CONF.anaphora`(0.55) / `CONF.rondo`(0.65) как константы.

## Область
Гovernance-контур поверх `SquareFullResult` от `splitSquareFull` (BL-050-full, `src/blocks/c36/square-full.ts`).
Вход роутера: `{ mode, units, roman, conf, tRatio, groupSize, copies, guard }`.
Роутинг только по `mode` + `conf`-тирам. Идентичность трека НЕ используется.

## §2 — ТАБЛИЦА РОУТИНГА (сверху вниз, первая match wins)
| № | Условие | Решение |
|---|---|---|
| 1 | learned-hit + гварды OK + повторно подтверждён | **AUTO** |
| 2 | learned-hit + первое обучение | **HUMAN** |
| 3 | `mode==='fallback'` ‖ `effConf < 0.55` | **HUMAN** |
| 4 | `0.55 ≤ effConf < 0.65` (anaphora) | **AI → dual-oracle** |
| 5 | `effConf ≥ 0.65` (near/pair/rondo) | **AUTO** |
| 6 | dual-oracle: оба сошлись + валидно | **AUTO** |
| 7 | dual-oracle: разногласие ‖ невалидно | **HUMAN** |

## §3 — effConf
- `effConf = result.conf` **КАК ЕСТЬ**. isochrony-бамп УЖЕ внутри `result.conf` (`square-full.ts:359`, `Math.min(1, bumped)`). Роутер бамп НЕ навешивает повторно (патч B — убирает двойной бамп).
- anaphora: `effConf = CONF.anaphora` (0.55), **БЕЗ бампа** — `result.tRatio` для anaphora всегда `null` (`square-full.ts:398`), так что бамп к ней не применяется; форсируем константой для defence-in-depth (anaphora никогда не уходит в auto).

## §4 — dual-oracle (патч C)
- **ТРЕТИЙ ИИ НЕ ЗАВОДИТСЯ** (минимизация движущихся частей).
- Согласие = точное совпадение вектора `units` ИЛИ попадание в одну «семью архетипов».
- Явный предикат валидности вместо магического `0.6`.
- Арбитр при разногласии/невалидности = существующий `checkGuards` + `isValidLrcProjection`.
- `sendWithProvider(provider, ...)`: НЕстриминговый structured-вызов, **ОБЯЗАН обходить single-flight** (`generation++`), возвращает парсуемые `units`. `send()` нетронут.

## §5 — learned-splits (патч E)
- Хранилище: **runtime-артефакт, `.gitignore`, НЕ коммит**.
- shape: `patternKey, units, mode, conf, tRatio, guard, sourceHash` — **БЕЗ raw text**.
- `keep-last-N` + ротация; dedup по `patternKey` с инкрементом счётчика.
- `learningDisabled` (forced off в тестах).
- TTL/version + kill-switch.
- После подстановки learned-units ОБЯЗАТЕЛЬНО `checkGuards` + `isValidLrcProjection` → нарушение ⇒ обычный train.
- Первое обучение = human, повторное подтверждение = auto (`min-observations`); не выше AI-тира на первом learn.

## §6 — LineLink + isValidLrcProjection (патч F)
- `isValidLrcProjection(logicalToLrc, n)`: `bounds[0]===0 && строго возрастает && last===n`.
- Используется И движком (`mapUnitsToLrc`, `square-full.ts:244`), И `LineLink`. ОДИН предикат — без дублирования.
- При невалидности `LineLink` помечает линк `INVALID` и НЕ эмитит `bounds` (консистентно с двигателем).

## Патч A — S19 REJECT
`'S19'` НЕ существует как square-mode (только `scripts/check-frozen-guard.sh:354` — frozen-guard label, не §12.6). Путь «проекция logical→LRC провалилась» уже материализуется как `mode:'fallback', guard:'guard-rejected'` и ловится веткой 3. Отдельный гвард проекции НЕ заводить (движок не менять ради этого).

## Файл-лист (NEW / EDIT)
- `src/blocks/c36/square-full.ts` — **EDIT** (extract `isValidLrcProjection`; S19 нет → no-op)
- `src/blocks/c36/bl049-router.ts` — **NEW** (§2 роутинг + §3 effConf)
- `src/blocks/c36/learned-splits.ts` — **NEW** (§5 runtime-артефакт)
- `src/features/ai-coach/ai-coach.service.ts` — **EDIT** (`sendWithProvider`, обходит single-flight; `send()` нетронут)
- `src/sync/word-sync/line-link.ts` — **NEW** (§6 потребитель `isValidLrcProjection`)
- `src/blocks/c36/__tests__/bl049.test.ts` — **NEW** (ячейки ниже)
- runtime-артефакты (learned-splits + research-backlog) — **NEW, .gitignore, НЕ коммит**

## §6-тест — план (bl049.test.ts, ≥8 ячеек)
1. anaphora→AI (conf 0.55, tRatio>1.4 → решение `'ai'`, не auto/human)
2. isochrony-fail (near tRatio=2.1 → нет +0.1; anaphora tRatio=2.1 → `'ai'` не `'auto'`)
3. dual-oracle-disagree (два провайдера расходятся → `'human'`)
4. dual-oracle-both-wrong (оба сошлись на невалидном/не в радиусе архетипа → `'human'`, НЕ `'auto'`) — **доп. от 002**
5. learned-cell (seeded cell → correctUnits; no-learn guard → wrongUnits/fallback) — негативный
6. learned-lockin-override (запертый неверный learned-splits → human-override его освобождает) — **доп. от 002**
7. S19-removed (guard `'S19'` никогда не эмитится; только fallback/guard-rejected → human)
8. isValidLrcProjection-shared (предикат консистентен между движком и LineLink)
- `learningDisabled = true` в тестах (без обучения поведение детерминировано).
- Только классы/паттерны, 0 хардкода имён треков.

## Референсы
- `SquareFullResult` тип: `src/blocks/c36/square-full.ts:86` (интерфейс), контур §12.6 комментарий `:7`.
- `CONF`: `src/blocks/c36/square-full.ts:51-58`.
- `checkGuards`: `src/blocks/c36/square-full.ts:290` (roman-cap/tail-giant/font-guard/font-jump/ggg-collapse/null).
- `mapUnitsToLrc`: `src/blocks/c36/square-full.ts:244`.
- `AiCoachService`: `src/features/ai-coach/ai-coach.service.ts:47` (single-flight `generation`).
- `LineMapEntry`: `src/sync/word-sync/line-map.types.ts:3`.
