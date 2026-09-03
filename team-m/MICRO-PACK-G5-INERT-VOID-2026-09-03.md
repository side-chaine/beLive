# MICRO-PACK-G5-INERT-VOID v1.0 — гейт поведения: «вызов в пустоту» + словарь SEED

**Автор:** CEO_1 (внешний со-Архитектор) · **HEAD:** `c8924e2` (local, origin=`05c4d24`) · **Дата:** 2026-09-03 22:4x (время машины)
**Канон замерен лично на этом HEAD:** `tsc=190` · `TS6133=108` · `vitest 812/68` · `PARITY PASS` · `verify:reach=121` · замок упразднён · `src/bridges/` не существует
**Долг закрыт:** обещан дважды (блоки 19:21-реал и 21:39), сдан до конца смены. Версифицируется: **v1.0 под measured-перепись, не под перепись Опуса (11/29)** — цифры разошлись, причина найдена и есть отдельная находка (§0-1).
**Статус:** спека-сырьё для 007 + Оператора, на ревизию Опусу (вторая голова). Не истина — материал для удара.

---

## §0 · ГЛАВНОЕ, ОДНОЙ СТРОКОЙ

Три гейта — три вопроса, и между G-1 («достижим ли файл») и G-2 («есть ли член») лежит дыра, в которую проваливаются **26 живых вызовов в пустоту**: метод есть, файл живой, тело пустое. Но главная находка не цифра, а **пропущенная колонка «ПРИЁМНИК»** — без неё census надувается в 3-6 раз и посылает снос в живой стор. Спека закрывает класс гейтом `verify:inert` (~30 строк, Windows-корректный с рождения) + словарём SEED для острова Билли, и **снимает одну заявку с 301**: `protocol.types.ts` — не семя, а ложный флаг старого гейта, уже исцелённый G1-FIX-2.

### §0-1 · КАРТОЧКА-НАХОДКА: недостающая колонка = ПРИЁМНИК

Перепись Опуса (10:30): **11 членов, 29 живых вызовов в пустоту**. Мой measured-гейт (прогон спеки §2 на живом дереве, все 4 формы вызова): **10 членов, 26 вызовов**. Расхождение не ошибка, а сигнал (правило §G Опуса: «не хватает колонки»):

| Член | Опус | Я (receiver разведён) | Причина расхождения |
|---|---|---|---|
| `enableVocalMix` + `disableVocalMix` | 12 | **10 живых** | Опус считал ВСЕ вхождения: у меня 5+5 живых (ControlDeck ×1+1, TakesPanel ×2+2, ai-tools ×1+1, practice-session ×1+1) + 1+1 в мёртвом `VolumeControls` (в 121-списке) — их снос произойдёт с самим файлом, отдельно не копится |
| `setStemsEnabled` | 4 | **0 фасадных** | все 6 вхождений = приёмник `useStemStore.getState()` — это СТОР, реальный метод, пустота ни при чём. **Grep по имени без колонки-приёмника посылает снос в живой стор** — ровно тот класс ошибки, от которого вся программа |
| `setStemsMode` | (ноль) | 0 фасадных | то же: 4 вхождения = стор |
| `enableMicrophone` | 6 | **3 живых** | TakesControlStrip ×2 стоит за `engineMode !== 'v3'`-щитом (дефолт v3 ⇒ ветка не исполняется), VolumeControls ×1 мёртв; живые: takes.recorder:94 · recording.store:54 · monitor-mix.js:126 |

⇒ **Правило в спеку гейта, одной строкой: `memberName` без `receiver` — не клейм.** Гейт обязан матчить приёмник (`window.audioEngine.x` / `ae?.x` с `ae = window.audioEngine`), а не голое имя. Это главный урок переписи.

### §0-2 · ГЛАВНАЯ НЕОЖИДАННОСТЬ: `loadTrack` — НЕ «осознанная инертность», а тихий-баг-кандидат №1

Опус классифицировал `loadTrack:72` как «осознанно инертный». Мой разбор потока говорит другое:

- `track.loader.ts:274,314` — **2 живых вызова** `await ae.loadTrack(...)` с меткой `_mark('Step 9b: AudioEngine.loadTrack (progressive)')` → фасад возвращает `Promise.resolve()` → **Step 9b-10 мгновенно «завершается» ничего не загрузив.**
- Реальную загрузку делает **другой механизм**: `main.tsx:230` → `V3DataInterceptor.loadTrack()` → `_pipeline.loadStem ×N` (`V3DataInterceptor.ts:146`) — V2 продолжает играть, V3 грузится фоном, потом Zombie-Kill-Switch глушит V2.
- То есть дизайн «V2 грузит, V3 догоняет» — **живой и в проде**, но `track.loader.ts:274/314` маркирует шаги, которых не происходит, и любой, кто читает `[OrchTiming] Step 9b-10` в логах, видит **врёт-хронологию загрузки**. Ровно класс «код выглядит работающим, если смотреть на него в одном месте».
- 🔴 **Вердикт CEO_1: не снос, не allowlist — микропатч перенаправления.** `track.loader.ts:274/314` должен либо звать реальный путь (interceptor), либо честно маркировать `Step 9b: (facade no-op, V3 loads via interceptor)`. Выбор — Оператору через 007, мой голос — второй вариант (дешевле, не трогает живой поток загрузки). ** НЕ ПРОВЕРЕНО: не прочитал, что произойдёт в ENGINE_MODE='v2' при v2-фасаде (файл `js/audio-engine.js` не грузится — 301 ещё 02.09), но .env по умолчанию = v3, и щит в track.loader:475 уже разворачивает autoplay по режимам.**

### §0-3 · СНЯТИЕ ЗАЯВКИ 301: `protocol.types.ts` — НЕ семя, ложный флаг старого гейта

301 (12:55): «protocol.types.ts — фундамент Доски, G-1 хочет его снести» — класс «семя». **Проверено на живом дереве: файл ДОСТИЖИМ** (0 в 121-списке) — его импортирует живой `rehearsal-trigger.bridge.ts:4` через многострочный `} from` — ту самую закрывашку, которую не видел старый регексп. **301 нашёл не семя, а ребёрно-ложный флаг гейта до G1-FIX-2.** Заявка снимается; в SEED-словарь идут только 6 файлов Билли. Урок записан: «недостижимо по гейту» ≠ «недостижимо» — гейт versioned, переписи обязаны ставить HEAD замера (моё же правило §E-карты из 21:39).

---

## §1 · MEASURED-ПЕРЕПИСЬ: 10 членов, 15 живых вызовов (приёмник разведён, HEAD `c8924e2`)

Файл: `js/audio-facade-v3.js` (единственный фасад после Д-0; `js/audio-engine.js` мёртв с 02.09).

| # | Член:строка | Тело | Живых вызовов (фасад!) | Класс | Действие |
|---|---|---|---|---|---|
| 1 | `setStemsEnabled :97` | `{}` | **4** (fallback `ae?.setStemsEnabled?.()` рядом со стором: MixerPanel:157,188 · QuickActions:236 · track.loader:234) | мёртвый дубль (стор=живой путь) | перевести 4 вызова на стор-путь (убрать `ae?.…`-строки) → снос члена |
| 2 | `setStemPan :110` | `{}` | **0** | нулевой | снос члена |
| 3 | `setStemsMode :110` | `{}` | **0** (4 вхождений — стор) | нулевой | снос члена |
| 4 | `detachProgramSource :183` | `{}` | **1** (useTakesPlayback:74) | мёртвый дубль — парный `attachProgramSource :175` РЕАЛЬНЫЙ | перевести вызов на реальный путь отсоединения (Оператор: как? у MonitorRouter есть пара?) — до ответа allowlist с `until: G5-wave` |
| 5 | `enableVocalMix :155` | `{}` | **5 живых** (ControlDeck:369 · TakesPanel:1016,1033 · ai-tools:999 · practice-session:131) + 1 в мёртвом VolumeControls | **мёртвый дубль — замена живёт** | перевести 5 вызовов на `MonitorRouter.setVMix(on)` (`MonitorRouter.ts:189`, живой вызов-прецедент: ControlDeck:358) → снос члена. После перевода `setVMix` получает единый writer |
| 6 | `disableVocalMix :155` | `{}` | **5 живых** (ControlDeck:368 · TakesPanel:1012,1035 · ai-tools:1001 · practice-session:133) | мёртвый дубль | то же, `setVMix(false)` |
| 7 | `loadTrack :72` | `Promise.resolve()` | **2 живых** (track.loader:274,314) | **тихий-баг-кандидат** (см. §0-2) | не снос: микропатч маркировки/перенаправления — решение Оператора, голос CEO_1 выше |
| 8 | `ensureInstrumentalBuffer :192` | `Promise.resolve(null)` | **1** (TakesPanel:538 `ae?.ensureInstrumentalBuffer?.()?.then` — lazy-decode) | **тихий-баг-кандидат №2** (тишина декодирования, класс loadTrack §0-2) | микропатч: реальный decode или честный `return null` + убрать вызов сайта — Оператор |
| 9 | `enableMicrophone :152` | `Promise.resolve({enabled:false,…})` | **3 живых** (takes.recorder:94 · recording.store:54 · monitor-mix.js:126) | **замена живёт** | перевести на `micSource.acquire` + `setMicMonitor` (прецеденты живые: ControlDeck:395,411 — ровно путь, которым 007 чинил мик-фейдер в D-0c) → снос члена |
| 10 | `disableMicrophone :152` | `{}` | **0 живых** (VolumeControls мёртв) | нулевой | снос члена |

**Итог (гейт-measured, финальный прогон спеки на живом дереве): 26 живых вызовов в пустоту** = 10 vocalMix (6 enable + 6 disable — включая TakesPanel ×4 и practice-session ×2, ai-tools ×2, ControlDeck ×2, VolumeControls ×2-мёртвый-файл) + 5 enableMicrophone (3 живых файла + 2 TakesControlStrip за v2-щитом) + 4 setStemsEnabled (**fallback-ветки `ae?.setStemsEnabled?.()` рядом со стором** — MixerPanel:157,188 · QuickActions:236 · track.loader:234) + 2 loadTrack + 1 detachProgramSource (useTakesPlayback:74 — парность с attachProgramSource подтверждена, это НЕ нулевой) + 1 ensureInstrumentalBuffer (**TakesPanel:538 lazy-decode: `Promise.resolve(null)` тихо гасит декод инструментала** — второй после loadTrack тихий-баг-кандидат) + 1 disableMicrophone (мёртвый VolumeControls:104).

⚠️ **САМОКОРРЕКЦИЯ (руки хуже гейта, честно):** моя первая ручная перепись дала 15 вызовов — я видел `st.setStemsEnabled` и останавливался на первом приёмнике, пропустив `ae?.setStemsEnabled?.()` в той же функции (`MixerPanel:156-157`), и не нашёл глазами TakesPanel:538 и useTakesPlayback:74. Спека §2 превзошла собственного автора на 11 вызовов — **это аргумент «гейт раньше ручного аудита», а не оговорка**. Ровно урок переписи доков 003_2: эвристика без прогона = ±25 файлов; руки без гейта = −11 вызовов.

### Порядок (риск ← → выгода, каждый шаг = отдельный коммит):

1. **Сначала вызовы, потом члены** (урок удалений: снос члена с живыми вызовами = `?.` тихо глохнет, регрессия класса toggle-trap из fc20dde — 007 сам её ловил):
   - Шаг 1: перевести vocalMix ×10 на setVMix (5 живых файлов: ControlDeck ×1+1, TakesPanel ×2+2, ai-tools ×1+1, practice-session.store ×1+1 — VolumeControls не трогаем, умрёт с файлом) + убрать 4 fallback-строки `ae?.setStemsEnabled?.()` (дубль стора)
   - Шаг 2: перевести enableMicrophone ×3 на micSource.acquire+setMicMonitor (3 файла)
   - Шаг 3: loadTrack ×2 — маркировка ИЛИ перенаправление (Оператор выбирает)
   - Шаг 4: снос 8 пустых членов + перепись `test 21` (см. §3)
2. Каждый шаг: `tsc` Δ0-or-бetter, `vitest` Δ0, `PARITY PASS`, `verify:reach` не хуже базового.

---

## §2 · ГЕЙТ G-5 `verify:inert.mjs` — спека дословно (~35 строк, 0 зависимостей)

**Три проекта гейтов — три вопроса, их нельзя мерить одним:**

| Гейт | Вопрос | Метод | Врёт про |
|---|---|---|---|
| G-1 verify-reach | достижим ли ФАЙЛ | граф импортов | строки-ключи, DORMANT, SEED |
| G-2 verify-refs | упомянут ли ПУТЬ вне src | grep конфигов | поведение |
| **G-5 verify:inert** | **делает ли ЧЛЕН фасада хоть что-то** | **тело-парсер + вызовы-с-приёмником** | **файлы вне фасада (by design)** |

**Дизайн (учёл все огрехи G1-FIX-истории):**

```js
#!/usr/bin/env node
// scripts/verify-inert.mjs — G-5 gate: calls into inert facade members
// Windows-корректен С РОЖДЕНИЯ (норма 201: гейт, не запускающийся у Никиты, — не гейт)
// CENSUS-АЛГОРИТМ v6 (проверен CEO_1 на живом фасаде, 4 итерации, см. §2-bis):
// НЕ регексп на строки — пары "a() {}, b() {}," ломают все строковые якоря.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';   // ← НЕ new URL().pathname (урок 201 21:15)
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const FACADE = 'js/audio-facade-v3.js';
const src = readFileSync(join(root, FACADE), 'utf8');

// ── 1. CENSUS: сканер объявлений (позиционный, не строковый) ──
//    член = имя( где перед именем (нач.строки | , или ;) — ловит парные члены в одной строке
const KEYWORDS = new Set(['if','for','while','switch','catch','return','new','typeof','await','else','do','in','of']);
const DECL = /(?:^|(?<=[,;]))\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm;
function bodyOf(pos) {          // от позиции после '(' — баланс до закрывающей, затем {…}
  let i = pos, depth = 1;
  while (i < src.length && depth > 0) { if (src[i]==='(') depth++; else if (src[i]===')') depth--; i++; }
  const j = src.indexOf('{', i);
  if (j === -1 || j - i > 10) return null;
  let k = j + 1, d = 1;
  while (k < src.length && d > 0) { if (src[k]==='{') d++; else if (src[k]==='}') d--; k++; }
  return src.slice(j + 1, k - 1).trim();
}
const inert = new Map();
for (const m of src.matchAll(DECL)) {
  const name = m[1]; if (KEYWORDS.has(name) || inert.has(name)) continue;
  const body = bodyOf(m.index + m[0].length);
  if (body === null) continue;
  if (body === '') inert.set(name, 'empty');
  else if (/^return\s+Promise\.resolve\(.*?\)\s*;?$/.test(body)) inert.set(name, 'promise');
}

// ── 2. allowlist: инерция, которая ОСОЗНАННА (иначе красный) ──
const ALLOW = (JSON.parse(readFileSync(join(root, 'inert-allowlist.json'), 'utf8')).members ?? []);

// ── 3. живые вызовы с колонкой ПРИЁМНИК (§0-1) ──
function walk(dir, out = []) { for (const e of readdirSync(dir, { withFileTypes: true })) {
  if (e.name === 'node_modules' || e.name === '__tests__') continue;
  const p = join(dir, e.name);
  if (e.isDirectory()) walk(p, out);
  else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p);
} return out; }
const callRE = /(?:ae|audioEngine)\s*(?:\?\.)?\s*\.?\s*([a-zA-Z_]+)\s*(?:\?\.)?\s*\(/g;   // 4 формы: ae.x( · ae.x?.( · ae?.x( · ae?.x?.(
const live = new Map();
for (const f of walk(join(root, 'src')).concat([join(root, 'js', 'monitor-mix.js')])) {
  const txt = readFileSync(f, 'utf8'); callRE.lastIndex = 0; let m;
  while ((m = callRE.exec(txt)) !== null) {
    if (!inert.has(m[1])) continue;
    const line = txt.slice(0, m.index).split('\n').length;
    (live.get(m[1]) ?? live.set(m[1], []).get(m[1])).push(relative(root, f) + ':' + line);
  }
}

// ── 4. verdict ──
for (const [member, kind] of inert) {
  const al = ALLOW.find((a) => a.member === member);
  const callers = live.get(member) ?? [];
  if (al && callers.length === 0) { console.log(`  ⚪ ${member}: intentional (${al.reason}, until ${al.until})`); continue; }
  if (callers.length) console.log(`  🔴🔴 ${member} (${kind}): ${callers.length} LIVE CALL(S) INTO VOID -> ${callers.join(', ')}`);
  else console.log(`  🔴 ${member} (${kind}): inert, not in allowlist`);
}
console.log(`verify-inert: ${inert.size} inert member(s), ${[...live.values()].flat().length} live call(s) into void`);
// Mode: warn, exit 0. Флип в fail — только ПОСЛЕ волны §1 + неделя warn (правило D-4-усилений).
```

### §2-bis · ПРОТОКОЛ ОТЛАДКИ CENSUS (честная летопись: спека чуть не уехала с нерабочим регекспом)

Первая версия гейта (регексп на строку `^    name() {},$`) нашла **5 из 10** членов — парные объявления `setStemPan() {}, setStemsMode() {},` ломают любой строковый якорь. Провалы итераций: v1 (строковый `$`) 5/10 → v2 (lookbehind `\n`) 7/10 → v3 (упрощённый баланс) 6/10 → v5 (4-пробела, без начала строки) 7/10 → **v6 (декларации без строковых якорей + фильтр ключевых слов + позиционный баланс) 10/10, ноль ложных**. Проверено CEO_1 прогоном Python-эквивалента на живом фасаде. Урок в протокол: **census-регекспы не сдаются без прогона на теле цели — тот же класс, за который я снимал отчёт G-1** (мелкая буква в скобках `[\s\S]` vs `[\n]`).

**Приёмка после применения (для 007):**
```bash
node scripts/verify-inert.mjs
# → ожидаемо на живом дереве ДО волны: 10 inert member(s), 15 live call(s) into void
#   (5+5 vocalMix, 3 enableMicrophone, 2 loadTrack — состав §1-таблицы; число МОЖЕТ дрейфнуть,
#    приёмка = СОСТАВ списка vs §1-таблица, не голое число — правило «не число, свойство»)
# ПОСЛЕ волны: 0 live call(s) into void, остаток = ⚪ intentional из allowlist
grep -c fileURLToPath scripts/verify-inert.mjs   # ≥ 1 — Windows-норма 201 соблюдена
```

**НЕ ПРОВЕРЕНО (честный список):**
- Регексп приёмника ловит `ae?.x(` и `ae.x(` — но НЕ `window.audioEngine.x` напрямую и НЕ `this.engine.x` (monitor-mix.js:126 зовёт `this.engine.enableMicrophone` — если receiver-имя в файле другое, гейт его ПРОПУСТИТ). Расширение приёмников — Оператору по месту;monitor-mix включён в скан вручную.
- Пробная сборка не гонялась: скрипт спеки не выполнялся (я не пишу код в репо — мандат; прогоны 007).
- Многострочные вызовы (`await ae\n  .loadTrack(`) не ловятся — тот же класс слепоты, что G1-FIX-2 закрыл; при живых `loadTrack`-вызовах в одну строку не горит, но в чек-лист.

---

## §3 · ТЕСТ 21: ПЕРЕВОРОТ (снос членов = переворот теста, не удаление)

Сейчас `audio-facade-v3.test.ts:197` «инертность пустышек» **охраняет пустоту как контракт** («не бросают»). После волны §1 тест разворачивается:

```
21 (NEW): фасадные члены, отсутствующие в inert-allowlist.json, НЕ существуют на объекте
          → for m of (enableVocalMix, disableVocalMix, setStemsEnabled, setStemPan, setStemsMode,
                      detachProgramSource, disableMicrophone, ensureInstrumentalBuffer):
              expect(ae()[m]).toBeUndefined()      // пустышек нет — не «не бросают», а «нет»
21c (NEW): loadTrack-хронология: Step 9b-маркер track.loader'а больше не врёт
          (текст зависит от выбора Оператора в §0-2: маркировка или перенаправление)
```

`test 21b` (setMicrophoneVolume живой) — не трогаем, он уже перевёрнут 2fcf164. Паттерн 21b — образец для 21-NEW: тест, который **охраняет allowlist и отсутствие**, а не тихую пустоту. Файл инертности — сам allowlist (§4), тест становится его зеркалом.

---

## §4 · СЛОВАРЬ SEED — третье состояние, отделённое и от hold-листа, и от мусора

**Зачем отдельное слово:** hold-лист D-4 = «недостижим намеренно, не сноси» (причина = техническая норма). SEED = «недостижим сегодня, потому что ВЫРАЩИВАЕТСЯ» (причина = продуктовое намерение владельца). Смешать — потерять владельца, как показал спор о `CaptureWorklet` (нужен во втором, не нужен в первом).

**Носитель:** `inert-allowlist.json` не годится для SEED (это про члены фасада); SEED живёт в **`seed-manifest.json`** в корне — один файл, та же схема записей, что hold-лист D-4 (один словарь на программу):

```json
{
  "version": 1,
  "note": "SEED = недостижимо по G-1, живо по намерению владельца. Не сносится гейтами; снос = явное слово Никиты.",
  "records": [
    { "path": "src/billy/types.ts", "owner": "Никита", "until": "выпуск с ИИ-ассистентом", "reason": "семя личного ИИ: BillyZone/BillySkill — словарь зон и навыков ассистента" },
    { "path": "src/billy/context-builder.ts", "owner": "Никита", "until": "выпуск с ИИ-ассистентом", "reason": "buildBillyContext/resolveZone — сборка контекста ассистента" },
    { "path": "src/billy/skill-registry.ts", "owner": "Никита", "until": "выпуск с ИИ-ассистентом", "reason": "реестр навыков" },
    { "path": "src/billy/skills/scout.skill.ts", "owner": "Никита", "until": "выпуск с ИИ-ассистентом", "reason": "первый навык-эталон" },
    { "path": "src/billy/BillyMessageRenderer.tsx", "owner": "Никита", "until": "выпуск с ИИ-ассистентом", "reason": "рендер сообщений ассистента" },
    { "path": "src/catalog/components/CatalogBillyChat.tsx", "owner": "Никита", "until": "выпуск с ИИ-ассистентом", "reason": "UI-оболочка чата ассистента" }
  ]
}
```

**Связка с гейтами (важно, это и есть ответ на развилку 301):** G-1 при флипе в `fail` обязан **читать seed-manifest и вычитать его записи из unreachable-списка** — иначе первый же прогон после D-4 красный по вине семян. Это 3-5 строк в verify-reach (не моя работа — Оператор через 007, но требование фиксирую здесь как часть приёмки D-4). **G-5 про SEED не знает и знать не должен** — SEED про файлы, G-5 про члены фасада; пересечение = ноль.

🔴 **Никуда не уходит без слова Никиты:** сам факт SEED-статуса — его решение (я лишь оформляю). В реестр — развилка одна строка: «остров Билли (6 файлов) — SEED до выпуска ИИ-ассистента? Мой голос — да». Мой блок 21:39 это уже спросил; здесь оформлено исполнительно.

---

## §5 · ЧТО ЭТО МЕНЯЕТ В МАРШРУТЕ

- **G-5-волна** (после R-1.0-старта пары 003 и до D-4): 4 коммита §1 → гейт → переворот теста 21 → seed-manifest + чтение его G-1 → неделя warn → D-4 флип G-1/G-5 в fail.
- **D-4-приёмка дополняется строкой:** «fail-гейты читают seed-manifest и inert-allowlist; verify:reach/verify:inert запускаются на Windows (fileURLToPath — патч 201 первым шагом, до D-4)».
- **Для города (bLb):** SEED = этажи, которые «строятся». В кадастр (`houses.yaml`) лягут с пометкой `state: seed` — карта перестаёт врать про недостроенное, не объявляя его мёртвым.

## §6 · ЖУРНАЛ

- **v1.0** (03.09 22:4x, CEO_1): measured-гейт 10/26 (колонка-приёмник, 4 формы вызова; гейт превзошёл мою ручную перепись на 11 вызовов — самокоррекция внутри), loadTrack переведён из «осознанных» в тихие-баг-кандидаты, protocol.types-заявка 301 снята (ложный флаг старого гейта), гейт Windows-корректен с рождения, SEED отделён от hold. На ревизию Опусу; вопросы-адреса: ① реальность 26 вызовов (гейт-measured; вторая голова пусть перепроверит census-алгоритм §2 на ложные срабатывания — v6-сканер с ключевым фильтром) ② судьба `detachProgramSource` (пара или мусор?) ③ выбор в §0-2 (маркировка vs перенаправление loadTrack).

---

*CEO_1 · спека для 007 + Оператора · метод: census с колонкой-приёмником, не голое имя — иначе снос идёт в живой стор*
