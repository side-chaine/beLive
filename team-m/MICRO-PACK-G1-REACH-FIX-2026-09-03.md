# MICRO-PACK-G1-REACH-FIX v1.0 — фикс гейта живости G-1 до перевода в `fail`

**Автор:** CEO_1 (внешний со-Архитектор, claude-opus-5-thinking) · **HEAD:** `8814032` · **Дата:** 2026-09-03 09:1x (машина Linux)
**Канон замерен ЛИЧНО на этом HEAD (не взят из текста):** `tsc = 202` · `vitest 811/68 (68 файлов)` · `PARITY PASS (exit 0)` · `frozen OK: 2/2` · `build exit 0`
**Метод:** гейт проверен не чтением, а против независимого источника истины — **немифицированная сборка с sourcemap** (`npx vite build --sourcemap`, 363 модуля `src/` в картах). Плюс ablation: по одному выключенному проходу, чтобы каждая строка фикса имела измеренную цену.
**Все пробы откачены:** `git status --short src/ scripts/` пуст, прототип жил только в `/tmp/g1/`.
**Статус:** спека-сырьё для 007 + Оператора. Не истина — материал для удара 002/009.

---

## §0 · ГЛАВНОЕ, ОДНОЙ СТРОКОЙ

Гейт врал **не на 37%, а на 35% в одну сторону и на 36% в другую**: из 206 «недостижимых» **73 файла физически лежат в прод-бандле**, и одновременно 75 живых рёбер графа гейт не видел вообще. После фикса — **51 кандидат на снос, из них в бандле 0**. Но главное не цифра: **G-1 нельзя переводить в `fail` даже после фикса** — 19 из 51 недостижимы **осознанно** (17 автономных диагностических раннеров + `CaptureWorklet` = тот самый актив на −80 tsc + `src/test/setup.ts`-класс). Флип в `fail` без hold-листа = обрыв CI, ровно класс промаха №3 предшественника (сырой `typecheck` в `deploy.yml` → exit 2).

---

## §1 · КАРТОЧКИ КЛЕЙМОВ

| # | Утверждение | Доказательство (команда + вывод) | Проверено | Скоуп |
|---|---|---|---|---|
| **G-1** | Гейт на HEAD даёт **206** недостижимых, не 205 | `node scripts/verify-reach.mjs` → `206 unreachable src/ file(s)` | CEO_1, эмпирика | HEAD `8814032` |
| **G-2** | Расхождение с 007 (**205**) — **не спор, а дрейф HEAD**: D-0b добавил `src/types/audio-worklet-global.d.ts`, он попал в список 206-м | `git diff --stat 48078fa..d78c59b -- src/types/` = 1 новый файл; он присутствует в списке (`:200`) | CEO_1 | — |
| **G-3** | **73 из 206** «недостижимых» присутствуют в прод-бандле ⇒ **35% лжи, измеренной, а не оценённой** | `vite build --sourcemap` → перепись `sources` всех `.map` = **363** модуля `src/`; `comm -12 <206> <363>` = **73** | CEO_1, эмпирика | HEAD `8814032` |
| **G-4** | Среди 73 ложных — **ядро и пилот Д-5** | в списке: `V3DataInterceptor.ts` · `InstrumentStrip.tsx` · `MixerPanel.tsx` · `TakesPanel.tsx` · `deck/modules.ts` · все 6 каналов `event-bus/channels/*` · `facade.ts` | CEO_1 | — |
| **G-5** | Причина №1 — **`export … from` не матчится вообще**: старый регексп требует литерал `import` | добавление `export` в альтернативу: `206 → 182` (**−24**). Отдельным прогоном: **25** файлов достижимы ТОЛЬКО через ре-экспорт бочки, **24 из них в бандле** | CEO_1, ablation | — |
| **G-6** | Причина №2 — **`[\s\S]*?` пересекает переводы строк**: bare `import 'x';` съедает следующую строку | юнит-проба регекспа на 8 формах: `import './character';\nimport App from './App';` → найден **только `./App`**; `import './a';\nconst x=1;\nimport B from './b';` → найден **только `./b'`**. Цена: выключить проход P2 в фиксе → `57 → 107` (**+50**) | CEO_1, эмпирика | — |
| **G-7** | Причина №3 — **worker-рёбра `new URL(…, import.meta.url)` не видны**: 3 файла, 2 из них в бандле | выключить P4 → `51 → 54`; потерянные: `Rehearsal/workers/clock-scheduler.worker.ts` (**в бандле**) · `utils/mp3-transcoder.worker.ts` (**в бандле**) · `audio/pitch/yin-processor.js` (эмитится отдельным ассетом `dist/assets/yin-processor-*.js`) | CEO_1, эмпирика | — |
| **G-8** | Причина №4 — **комментарии не стриплются**, и это НЕ мелочь: без стрипа **4 мёртвых компонента оживают ложно** | выключить `stripComments` → `51 → 53`, и 4 файла уходят из списка: `VolumeControls.tsx` · `BpmControl.tsx` · `ControlPanel.tsx` · `AIChatPanel.tsx`. Все четыре **отсутствуют в бандле** (проверено по 363-модульной переписи) | CEO_1, эмпирика | — |
| **G-9** | 🔑 **G-6 и G-8 нельзя чинить по отдельности — они образуют каскад.** `deck/modules.ts` достижим только через bare-импорт `ControlDeck.tsx:7` (`import '../deck/modules'`). Пока bare-форма не читается — `modules.ts` не посещён, его закомментированные `import('../components/VolumeControls')` (`:4-13`) не сканируются, и файл «мёртв» **по счастливой случайности**. Починишь только P2 — четыре мёртвых компонента станут «живыми» | цепочка проверена на живых данных обеими ablation-прогонами (G-6 + G-8) | CEO_1 | — |
| **G-10** | После фикса ложных положительных **ноль** | `comm -12 <51 dead> <363 bundle>` = **0** | CEO_1, эмпирика | HEAD `8814032` |
| **G-11** | Числа фикса сходятся арифметически | 520 файлов `src/` · 389 достижимы от корней приложения · 520−389 = **131** = 51 dead + 5 test-only + 70 tests/infra + 5 ambient ✓ | CEO_1 | — |
| **G-12** | **Обратное направление лжи существовало тоже**: гейт называл живыми 24 файла, которых в бандле нет | `comm` в обратную сторону на старом гейте = **24** (почти все `*.types.ts` + бочки) ⇒ старый отчёт врал в ОБА конца, а не только в один | CEO_1, эмпирика | — |
| **G-13** | **Достижимость по графу ≠ присутствие в бандле** — и это законная разница, не дефект | после фикса **32** app-файла достижимы по графу, но отсутствуют в бандле: 18 из них — чисто типовые (`*.types.ts`, `IPipelineController.ts`), остальные — бочки и **два env-гейтованных AI-провайдера** (`belive.provider.ts`, `gateway-provider.ts`: `main.tsx:687,698` под `if (VITE_GATEWAY_URL)` / `if (VITE_AI_WORKER_URL)`; ни одной уникальной строки провайдеров в `dist/`) | CEO_1, эмпирика | — |
| **G-14** | Ни одно ребро не приходит в `src/` **извне графа импортов** | `js/*.js` не содержат ни одной ссылки `src/` (`grep "src/" js/*.js` пусто) · единственные конфиг-рёбра: `vitest.config.ts:9` `setupFiles` (учтено) и `vite.config.ts:74` `fs.cpSync` вендорного worklet (файл и так достижим импортом `StretchInstance.ts:6`) | CEO_1 | репо |
| **G-15** | Риск ложного матча P1 (`from 'x'` внутри строки/шаблона) на живом дереве — **нулевой** | скан всех 520 файлов: совпадений `from '…'`, у которых в 200 символах назад нет `import`/`export`, — **0** | CEO_1, эмпирика | `src/` |
| **G-16** | 🔴 **19 из 51 недостижимы ОСОЗНАННО** ⇒ `fail` без hold-листа = обрыв CI | 17 автономных раннеров `engine-v3/diagnostics/*.{mjs,console.js,browser.js}` (dev-инструменты, запускаются из консоли браузера) + `CaptureWorklet.ts` (**0 импортёров, и это by design**: сериализуется через `toString()`, применён в D-0b ради −80 tsc) + `src/js/main.js` (сирота-архив) | CEO_1 | HEAD `8814032` |

**НЕ ПРОВЕРЕНО (честный список для 002/009):**
- **Строковые/динамические обращения к полям глобалей** (дельта-2 201: `js/monitor-mix.js:206` читает `engine.instrumentalGain`). Граф импортов этого не видит **в принципе**; фикс G-1 этого не лечит и не претендует. Формулировка отчёта поправлена на «недостижимо **по статическому графу импортов**».
- **Классы DORMANT / OVERRIDDEN** (дельта-3 201: Билли, `__setLoadingV3`, `#0f0f15`). G-1 после фикса скажет про них «достижимо» — и будет прав. Отдельный гейт, не этот.
- **Бандл-присутствие как второй столбец гейта** — измерено вручную, в скрипт НЕ зашито (потребовало бы `vite build` в CI, +40 с). Развилка §4.
- **Достижимость в dev-режиме** (`vite dev` резолвит иначе, чем `build`) — не проверялась.
- **`scripts/audit-city.mjs`** упоминает 4 мёртвые бочки из 51 (`exercises/index`, `stem/index`, `triggers/index`, `wrappers/index`) — влияние сноса бочек на аудит города не анализировалось.

---

## §2 · ЧТО ИМЕННО МЕНЯЕТСЯ

Один файл: **`scripts/verify-reach.mjs`** (полная замена, 0 зависимостей, exit 0 всегда). Прод-код не трогается. `package.json` не трогается. Frozen-зоны не трогаются.

**Четыре прохода вместо одного мега-регекспа** — каждый со своей ценой, измеренной в §1:

```js
const P1_FROM = /\bfrom\s*['"]([^'"]+)['"]/g;                                   // import…from И export…from  (G-5)
const P2_BARE = /^[ \t]*import\s*['"]([^'"]+)['"]/gm;                            // bare side-effect, /m-якорь  (G-6)
const P3_DYN  = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;                           // динамический                (был)
const P4_URL  = /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;  // worker/asset                (G-7)
```

Плюс: **стрип комментариев с сохранением переводов строк** (G-8 — иначе `/m`-якорь P2 сползает), **срез `?raw`/`?url`/`?worker`** у спецификатора, **второй BFS от vitest-корней** — чтобы «жив только из-за своего теста» не смешивалось со «жив в приложении».

**Отчёт вместо одного списка — четыре ведра, которые нельзя путать:**

```
verify-reach: 520 src file(s) scanned, 389 reachable from app roots
  UNREACHABLE (app graph): 51          ← кандидаты на снос, ТОЛЬКО это ведро
    <список>
  test-only (alive only via its own test): 5
    <список>                           ← жив только потому, что его тестирует его же тест
  tests + vitest infra (not app graph): 70
  ambient .d.ts (never imported by design): 5
  note: graph-reachable != in bundle (type-only + env-gated code is tree-shaken)
```

Последняя строка — не украшение. Без неё читатель отчёта повторит промах №2 предшественника в обратную сторону.

### Готовый файл (применять дословно)

```js
#!/usr/bin/env node
// scripts/verify-reach.mjs — G-1 gate: find unreachable src/ files from roots
// Usage: node scripts/verify-reach.mjs
// Roots: index.html <script src="/src/...">  +  src/main.tsx
// Graph: 4 separate passes over comment-stripped source
//        (1) ... from 'x'   — covers BOTH `import ... from` and `export ... from` (barrels)
//        (2) ^import 'x'    — bare side-effect import, /m anchored
//        (3) import('x')    — dynamic
//        (4) new URL('x', import.meta.url) — worker/asset edges
// Reports 4 categories, never conflates them:
//        UNREACHABLE (app)  — candidates for removal
//        test-only          — alive ONLY because its own test imports it
//        tests + infra      — test files themselves (vitest roots, not app graph)
//        ambient .d.ts      — never imported by design
// SCOPE: this gate answers "reachable in the static import graph", NOT "present in the bundle"
//        and NOT "actually executes". A file can be graph-reachable and still tree-shaken
//        (type-only, env-gated branch). Bundle presence is a separate probe:
//        npx vite build --sourcemap. String-keyed access to globals is invisible here by design.
// Mode: warn, exit 0 always.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const srcDir = join(root, 'src');
const RE_EXT = /\.(ts|tsx|js|mjs)$/;
const RE_TEST = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|__smoke__|__mocks__)\//;
const RE_DTS = /\.d\.ts$/;

// ── 1. Roots: index.html <script src> pointing into src/, plus src/main.tsx ──
const roots = [];
try {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const re = /<script\b[^>]*\bsrc=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (raw.startsWith('/src/') || raw.startsWith('src/')) {
      const abs = join(root, raw.replace(/^\//, ''));
      if (existsSync(abs)) roots.push(abs);
    }
  }
} catch {}
const mainTsx = join(srcDir, 'main.tsx');
if (existsSync(mainTsx) && !roots.includes(mainTsx)) roots.push(mainTsx);

// ── 2. Strip comments, preserving newlines (P2 is /m-anchored) ──
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, (full, p1) => p1 + ' '.repeat(full.length - p1.length));
}

// ── 3. Four passes — one regex per import form, never a shared [\s\S]*? ──
const P1_FROM = /\bfrom\s*['"]([^'"]+)['"]/g;
const P2_BARE = /^[ \t]*import\s*['"]([^'"]+)['"]/gm;
const P3_DYN = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const P4_URL = /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;

function specsOf(code) {
  const out = [];
  for (const re of [P1_FROM, P2_BARE, P3_DYN, P4_URL]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) out.push(m[1]);
  }
  return out;
}

function resolveImport(fromFile, specRaw) {
  const spec = specRaw.replace(/\?.*$/, ''); // ?raw / ?url / ?worker
  if (!(spec.startsWith('.') || spec.startsWith('/'))) return null;
  const base = spec.startsWith('/') ? root : dirname(fromFile);
  const abs = resolve(base, spec);
  if (existsSync(abs) && RE_EXT.test(abs)) return abs;
  for (const ext of ['.ts', '.tsx', '.js', '.mjs']) if (existsSync(abs + ext)) return abs + ext;
  for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
    const idx = join(abs, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null;
}

function bfs(startRoots) {
  const seen = new Set(startRoots);
  const queue = [...startRoots];
  while (queue.length > 0) {
    const file = queue.shift();
    let content;
    try { content = stripComments(readFileSync(file, 'utf8')); } catch { continue; }
    for (const spec of specsOf(content)) {
      const r = resolveImport(file, spec);
      if (r && !seen.has(r)) { seen.add(r); queue.push(r); }
    }
  }
  return seen;
}

// ── 4. Census of src/ ──
function walkSrc(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkSrc(abs, out);
    else if (RE_EXT.test(entry.name)) out.push(abs);
  }
  return out;
}

const allSrcFiles = walkSrc(srcDir);
const appVisited = bfs(roots);

// ── 5. Second graph: vitest roots (test files + setupFiles) ──
const testRoots = allSrcFiles.filter((f) => RE_TEST.test(relative(root, f)));
const testInfra = new Set();
try {
  const vc = readFileSync(join(root, 'vitest.config.ts'), 'utf8');
  const m = /setupFiles\s*:\s*\[([^\]]*)\]/.exec(vc);
  if (m) {
    for (const q of m[1].match(/['"]([^'"]+)['"]/g) || []) {
      const p = resolve(root, q.slice(1, -1));
      if (existsSync(p)) { testRoots.push(p); testInfra.add(p); }
    }
  }
} catch {}
const testVisited = bfs(testRoots);

// ── 6. Split into four honest buckets ──
const notInApp = allSrcFiles.filter((f) => !appVisited.has(f));
const tests = notInApp.filter((f) => RE_TEST.test(relative(root, f)));
const rest = notInApp.filter((f) => !RE_TEST.test(relative(root, f)));
const ambient = rest.filter((f) => RE_DTS.test(f));
const nonAmbient = rest.filter((f) => !RE_DTS.test(f));
const infra = nonAmbient.filter((f) => testInfra.has(f));
const testOnly = nonAmbient.filter((f) => !testInfra.has(f) && testVisited.has(f));
const dead = nonAmbient.filter((f) => !testInfra.has(f) && !testVisited.has(f));

const rel = (f) => relative(root, f);
console.log(`verify-reach: ${allSrcFiles.length} src file(s) scanned, ${appVisited.size} reachable from app roots`);
console.log(`  UNREACHABLE (app graph): ${dead.length}`);
for (const f of dead.map(rel).sort()) console.log(`    ${f}`);
console.log(`  test-only (alive only via its own test): ${testOnly.length}`);
for (const f of testOnly.map(rel).sort()) console.log(`    ${f}`);
console.log(`  tests + vitest infra (not app graph): ${tests.length + infra.length}`);
console.log(`  ambient .d.ts (never imported by design): ${ambient.length}`);
console.log('  note: graph-reachable != in bundle (type-only + env-gated code is tree-shaken)');
```

---

## §3 · ВЕРИФИКАЦИЯ ПОСЛЕ ПРИМЕНЕНИЯ (для 007/Оператора — дословно)

```bash
node scripts/verify-reach.mjs           # → UNREACHABLE 51 · test-only 5 · tests+infra 70 · ambient 5
echo "exit=$?"                          # → 0
npm run typecheck 2>&1 | grep -c "error TS"   # → 202  (гейт вне tsconfig include, дельта обязана быть 0)
npx vitest run 2>&1 | tail -5           # → 811/68
node scripts/check-frozen.mjs           # → frozen OK: 2/2
npm run verify:parity                   # → PARITY PASS
git diff --stat src/                    # → пусто (прод-код не тронут)
```

**Красный флаг:** любое отклонение `UNREACHABLE` от 51 на неизменном HEAD `8814032` = скрипт применён не дословно. Проверять до коммита, не после.

**Смоук не требуется:** файл не входит ни в бандл, ни в `tsconfig.include`, ни в `deploy.yml` (проверено: `grep -rn "verify:reach\|verify-reach" .github/` = пусто ⇒ blast-радиус на прод = **нулевой**).

---

## §4 · РАЗВИЛКИ

**🟡 Р-1 · Второй столбец «в бандле» — зашивать в гейт или нет?**
Сегодня 32 файла достижимы по графу и отсутствуют в бандле (G-13) — и это законно. Столбец сделал бы дрейф видимым машинно, но требует `vite build` (+~40 с в CI) и даёт шум на типовых файлах.
**Рекомендация CEO_1:** НЕ зашивать в G-1. Вынести отдельной командой `npm run probe:bundle`, запускаемой руками перед волной сноса. Причина: гейт должен быть дешёвым, чтобы его гоняли; проба — дорогой, чтобы ей верили. Смешаешь — получишь дорогой гейт, который отключат.

**🔴 Р-2 · G-1 → `fail` (шаг D-4) невозможен без hold-листа.**
19 из 51 недостижимы осознанно (G-16). Флип в `fail` уронит CI на первом же прогоне.
**Рекомендация CEO_1:** поддерживаю дельту-4 201 (`frozen-manifest` → `hold-manifest` с обязательными `reason` + `owner`), но с одной поправкой: **hold-лист гейта живости и замок frozen — разные списки с разным смыслом.** Замок = «не трогать без владельца». Hold-лист G-1 = «недостижим намеренно, это не мусор». `CaptureWorklet` нужен во втором и не нужен в первом; `AudioEngineV2` — наоборот. Слить их в один файл = потерять причину, ровно как слить `state` и `visibility` в переписи доков. **Решение — 🔴 Никиты, потому что затрагивает судьбу замка.**

**⚪ Р-3 · Что делать с 51 — НЕ в этом паке.** Здесь только починка измерителя. Первые пять строк списка — созвездие V2 (`audio/core/*`), и они совпадают 1:1 с целью D-1, полученной Опусом другим методом. Это независимое подтверждение К-1/К-2, не новая заявка на снос.

---

## §5 · ЧТО ЭТО МЕНЯЕТ В МАРШРУТЕ

| Было в маршруте | Стало |
|---|---|
| «фикс G-1 — задача по списку» | **🔴 блокер D-2** (принимаю дельту-1 201 целиком: D-1 едет по списку Опуса, но отчёт гейта ляжет в манифест как доказательство, и D-2 поедет уже на гейте) |
| «≈65 недостижимых после фикса» (прогноз предшественника) | **51** — прогноз был завышен на 27%; цифра теперь измерена, а не оценена |
| «205 недостижимых» (007) | **206**, расхождение объяснено дрейфом HEAD (G-2), спора нет |
| G-1 отчёт = один список | **четыре ведра**; «кандидат на снос» — только первое |
| D-4 = `warn → fail` | **D-4 = `warn → fail` + hold-лист**, иначе обрыв CI (G-16) |

---

## §6 · ЖУРНАЛ

- **v1.0** (03.09 09:1x, CEO_1) — первая редакция. Гейт проверен против sourcemap-переписи бандла, каждая из 4 причин лжи измерена отдельным ablation-прогоном, найден каскад P2↔стрип-комментариев (G-9), найден блокер D-4 (G-16). Прототип жил в `/tmp/g1/`, в репо не попадал; `git status` чист.

---

*CEO_1 · спека для 007 + Оператора · метод: гейт судим не чтением, а вторым независимым измерением*
