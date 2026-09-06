# MICRO-PACK · G-7-IMPL · ГЕЙТ «СТЫК»: ПРИМЕНЕНИЕ

**Прогон: 007-цепь 001→002→001→009 · Автор спеки применения: 001 · Дата: 2026-09-05 · Статус: ЦЕПЬ ЗАВЕРШЕНА — 002: ПРИНЯТЬ С УСЛОВИЯМИ (13 правок внесены) → 001-ревизия: ПРИНЯТЬ С ФИНАЛЬНЫМИ ПРАВКАМИ (3 внесены) → 009: ГОТОВ К ПРИМЕНЕНИЮ ОПЕРАТОРОМ (оговорки внесены). К применению.**
**Вход:** спека `team-m/MICRO-PACK-G7-JUNCTION-2026-09-05.md` (201 + CEO_1, поправки 14:00: А = TOML-резолв по таблице, Б = env-single-source) · живые факты сверены 001 на дереве 05.09.
**Канон:** tsc=190 · vitest 812/68/0int · reach=121 (warn) · inert=1⚪ · G-3b 0/0 · PARITY PASS · HEAD 704c649 · src/ чист.

## 0. СВЕРКА ФАКТОВ (все file:line проверены на живом дереве)

- `gateway/wrangler.toml`: 2×`[[d1_databases]]` — FEED_DB binding :34, database_id :36 **непустой**; METRICS_DB binding :40, database_id :42 = **""**. 5×`[[kv_namespaces]]`, EPHEMERAL_KV :24, id :25 = `bd9b1fdb…`.
- `gateway/src/index.ts`: FEED_DB :22, METRICS_DB :27 (Env-интерфейс — код читает).
- `belive-feed-bot/wrangler.toml`: EPHEMERAL_KV :19, id :20 = `bd9b1fdb…` → пара 5 сегодня зелёная.
- `.env.example` (27 строк): **8 VITE_-строк** (:4, :7, :8, :12, :15, :20, :23, :27). VITE_REHEARSAL_SIGNALING_URL **нет**.
- `.env:4` = VITE_REHEARSAL_SIGNALING_URL; `.env.production:5` = VITE_AUTH_WORKER_URL (https://belive-auth…).
- `deploy.yml`: verify:ci :32-33; VITE_REHEARSAL_SIGNALING_URL :40 (Build env).
- `src/Rehearsal/services/signaling-client.ts`: :21 читает env, :22 throw, :23 URL. **DRIFT-уточнение:** путь = `src/Rehearsal/services/` (спека писала короче); deep-link.service.ts:77 = `new SignalingClient` (A-сторона бутового пути); signClientTicket-HMAC — :31 (002-стресс: уточнено).
- `src/main.tsx`: :695 читает VITE_AI_WORKER_URL (также src/js/ai/providers/belive.provider.ts:9); :783 SignalingClient.
- Воркеры в репо (4 wrangler.toml): gateway, gateway/rehearsal, belive-feed-bot, belive-mvsep. **Нет: belive-ai, belive-auth.**
- `package.json:24`: verify:ci = events && parity (сегодня 2 гейта — A-13 расширяет до 6).
- Прецеденты: verify-reach.mjs:7 «warn, exit 0»; verify-inert.mjs:69-70 exit(0); gen-doc-index.mjs:11 — строковый yaml-парс.
- **002-стресс (верифицировано 002 на живом дереве): 17/18 клеймов §0 бьются точно; TOML-парсер блока 2 обязан skip-ать `#`-комментарии, css/styles.css содержит 16 живых keyframes-дублей и 38 мультиселекторов — учтено в §3/§4 правками.**

## 1. ПРИНЦИП

Гейт = ассерт на ПАРУ мест. Истина (пары) — в YAML; интерпретатор тонок и не знает конкретных жертв. Резолв стороны-B — только по связке «секция→binding» (поправка-А), никогда по файлу. Гейт рождается красным на живой добыче локально; CI не блокирует деплой до CF-батча Никиты.

## 2. РЕШЕНИЯ ДИСПАТЧА

**2.1 Носитель/парсер:** `junction-registry.yaml` (A-4 сохранён) + самописный микро-парсер замороженного формата (~30 строк). Почему не JSON: нет комментариев, а жертва-пример = часть истины пары. Почему не js-yaml (есть в devDeps): все 5 гейтов node:-only; зависимость гейта от devDeps = скрытая точка отказа. Формат: поля id/kind/a/b/rule/level; a/b — flow-JSON в кавычках (JSON.parse); комментарии `#`.
ОТКЛОНЕНИЕ-1: ключи внутри `{}` в кавычках (цена ноль, парсер проще). ОТКЛОНЕНИЕ-2: в `b` добавлено поле `section` — носитель поправки-А.

**2.2 Ключевое решение (CI vs живая жертва):** junction входит в verify:ci СРАЗУ, уровни честные (fail), CI передаёт `JUNCTION_GRACE=wrangler-env-d1,vite-url-ai-worker,vite-url-worker-src` — перечисленные в CI печатаются 🟡 GRACE и не флипают exit; локально полный красный, violations≥1. Почему не (а) warn в реестре: ломает приёмку A-14 (violations≥1 по wrangler-env-d1 невозможен при warn — первый прогон «зелёный» = стоп). Почему не (б) отдельная кнопка: гейт вне CI = невидимки ловятся руками; A-13 требует verify:ci. Grace в deploy.yml, не в реестре: реестр = истина, подавление = временные ops.

**2.3 CI-шаг (A-1):** deploy.yml, шаг Verify — команда та же (`npm run verify:ci`), добавляется `env: JUNCTION_GRACE` + честное имя шага. Деплой не рвётся.

**2.4 Кнопки:** `verify:junction` = `node scripts/verify-junction.mjs`; `verify:ci` = **6 гейтов** (events+parity+reach+inert+docvis+junction). A-13 — расширение, не замена: events+parity СОХРАНЕНЫ (снятие существующей защиты деплоя не заказывали).

## 3. ФАЙЛ 1: `scripts/junction-registry.yaml` (НОВЫЙ)

```yaml
# junction-registry · v0.1 · 2026-09-05 · G-7 «Стык»
# Спека: team-m/MICRO-PACK-G7-JUNCTION-2026-09-05.md (§2 формат, §4 пары, §6 правила, поправки А/Б 14:00)
# ФОРМАТ ЗАМОРОЖЕН: список пар; поля id/kind/a/b/rule/level; a/b — flow-JSON
# (ключи и значения в кавычках — парсится JSON.parse); комментарии # после значения или на своей строке.
# Правила §6: новая пара = запись здесь, интерпретатор не меняется; резолв TOML по таблице; cf-token = unverifiable.

- id: wrangler-env-d1            # пара 1 · жертва живая (CF-батч 🔴 Никита)
  kind: env-to-toml
  a: { "file": "gateway/src/index.ts", "env": "METRICS_DB" }
  b: { "file": "gateway/wrangler.toml", "section": "d1_databases", "binding": "METRICS_DB", "attr": "database_id", "nonEmpty": true }
  rule: implies
  level: fail
  # index.ts:27 читает METRICS_DB; wrangler.toml:40 binding, :42 database_id="".
  # Ловушка ㊱: FEED_DB (:34/:36 id непустой) — резолв ТОЛЬКО по таблице binding=METRICS_DB, не по файлу.

- id: vite-url-ai-worker         # пара 2 · фантом ㉞
  kind: code-to-worker
  a: { "file": "src/main.tsx", "env": "VITE_AI_WORKER_URL" }
  b: { "worker": "belive-ai" }
  rule: implies
  level: fail
  # main.tsx:695 читает (также src/js/ai/providers/belive.provider.ts:9); в репо 4 wrangler.toml
  # (gateway, gateway/rehearsal, belive-feed-bot, belive-mvsep) — belive-ai нет. Судьба = CF-батч 🔴.
  # A сужена до main.tsx: .env*-сторона покрыта парой 3 (дедуп). [002-стресс]

- id: vite-url-worker-src        # пара 3 · обобщение пары 2
  kind: env-to-worker
  a: { "files": ".env*", "pattern": "VITE_*_URL" }
  b: { "from": "hostname" }
  rule: implies
  level: fail
  # Только непустые значения; hostname *.workers.dev → имя воркера (первый label) → wrangler.toml name;
  # localhost/пустые — skip с пометкой, НЕ violation. Сегодня: REHEARSAL→belive-rehearsal ✓;
  # AUTH (.env.production:5) → belive-auth НЕТ в репо → violation.
  # hostname не *.workers.dev и не localhost/IP → skip с пометкой 🟡 external-host (вне досягаемости
  # репо-резолва), НЕ violation. [002-стресс]

- id: css-dup-warn               # пара 4 · warn-генератор (каскад статикой не вычислить — вердикт 201)
  kind: css-dup
  a: { "files": "src/**/*.css, css/*.css" }
  rule: warn-only
  level: warn
  # Ключ (нормализованный селектор, свойство) в ≥2 файлах; расхождение значений — пометка.
  # Вывод: первые 10 + счётчик (шум-кап).
  # skip контекстов @media/@keyframes (стек по `{`); skip селекторов без [a-zA-Z] (keyframe-проценты);
  # нормализация = trim + схлопывание пробелов; мультиселектор = ключ как есть (порядок значим).
  # Причина: css/styles.css — 16 живых keyframes-дублей и 38 мультиселекторов; наивный резолв
  # забивает warn-канал бессмыслицей. [002-стресс]

- id: ephe-env-kv-scope          # пара 5 · сегодня зелёная
  kind: kv-cross-worker
  a: { "file": "gateway/src/index.ts", "env": "EPHEMERAL_KV" }
  b: { "files": ["gateway/wrangler.toml", "belive-feed-bot/wrangler.toml"], "section": "kv_namespaces", "binding": "EPHEMERAL_KV", "attr": "id", "sameIn": true }
  rule: implies
  level: fail
  # index.ts:16 читает EPHEMERAL_KV; id bd9b1fdb… в gateway:25 и feed-bot:20 — пара сегодня ЗЕЛЁНАЯ
  # (контрольная: гейт обязан уметь печатать и ✅, не только красное). sameIn: attr совпадает во ВСЕХ files.

- id: secrets-cf-token          # пара 6 · честно unverifiable (§3.4, §6)
  kind: secret-external
  a: { "file": "belive-feed-bot/wrangler.toml", "marker": "BOT_TOKEN" }
  b: { "external": "cloudflare-dashboard" }
  rule: implies
  level: fail
  requires: cf-token
  # feed-bot/wrangler.toml:13 упоминает BOT_TOKEN (секрет wrangler secret put).
  # Из репо тип Secret в CF-дашборде НЕ проверяется ⇒ вердикт всегда ⚪ UNVERIFIABLE, никогда ✅ (§6).

- id: env-single-source          # пара 7 · поправка-Б 201 (14:00) · v0.2 поднята в старт
  kind: env-to-example
  a: { "file": "src/Rehearsal/services/signaling-client.ts", "env": "VITE_REHEARSAL_SIGNALING_URL" }
  b: { "file": ".env.example", "key": "VITE_REHEARSAL_SIGNALING_URL" }
  rule: implies
  level: warn
  # Читается signaling-client.ts:21, throw :22 (DRIFT: путь = src/Rehearsal/services/;
  # deep-link.service.ts:77 = new SignalingClient (бутовый путь); signClientTicket-HMAC — :31.
  # Есть в .env:4 и deploy.yml:40, НЕТ в .env.example (там 8 VITE_-строк). CI инжектит ⇒ warn, НЕ fail.
  # Фикс-строка = 🔴 Никита, НЕ в этом паке.
```

## 4. ФАЙЛ 2: `scripts/verify-junction.mjs` (НОВЫЙ, ~150 строк, контракт по блокам)

Заголовок: `node:fs` / `node:path` / `node:url`; `root = fileURLToPath(new URL('.', import.meta.url)) + '/..'` (прецедент verify-inert.mjs:8-9). Ноль внешних зависимостей.

**Блок 1 — yaml-микропарсер (~30 строк):** построчный; skip пустых и `#`-строк; `- id: X` = начало пары; далее `key: value`; `a:`/`b:` — значение `{…}` → `JSON.parse`; `rule/level/requires` — скаляры; **`b` опционален (пара 4 — warn-only без b): отсутствие ключа ≠ «строка вне формата»** [009-оговорка]; следующий `- id` или EOF = flush. Любая строка вне формата → `console.error('registry: format break: N: <текст строки>')` + exit 1.

**Блок 2 — TOML-резолв ПО ТАБЛИЦЕ (поправка-А, сердце):** `parseTomlTables(file)` → массив `{section, kv}`: `[[section]]` открывает таблицу; `key = "value"` наполняет kv последней открытой; **строки после trim, начинающиеся с `#`, — skip** [002-стресс: закомментированный `database_id` иначе выигрывает последним и даёт ложный вердикт ровно на жертве]. Резолв B = таблицы, где `section === b.section && kv.binding === b.binding`; **резолв вернул >1 таблицы = violation "ambiguous binding" (дубль binding в section — разрыв сам по себе, независимо от attr)** [002-стресс: копипаста базы = дубль, wrangler упадёт на deploy — гейт обязан поймать раньше]; **резолв per-file: для b.files — в каждом файле отдельно; кросс-файловый дубль binding = sameIn-пара 5, НЕ ambiguous** [001-ревизия]. Таблицы нет → B отсутствует; `attr` = `""` → B пусто (`nonEmpty` ловит). Гейт проверяет корневые таблицы wrangler.toml; `[env.*]`-наследования не поддержаны v0.1. **Запрещён `file.includes(...)`** — наивный резолв найдёт FEED_DB и выдаст зелёное ровно на жертве METRICS_DB.

**Блок 3 — читатели A-сторон по kind:**
- `env-in-code` (пары 1, 2, 5): файл существует + regex `\b<ENV>\b` → строка. **B-ридер для `code-to-worker` (пара 2, `b.worker`): тот же механизм, что hostname→worker — поиск `name = "…"` по glob `**/wrangler.toml` depth ≤2** [009-оговорка].
- `env-files` (пара 3): readdirSync(root) filter `.env*`; строки `KEY=value`; skip `#` и пустых значений; `new URL(v).hostname`.
- `hostname→worker` (пара 3): `*.workers.dev` → первый label = имя воркера; localhost/IP → skip с пометкой; **workerIndex (общий для пар 2+3, один вызов на прогон) = вывод `execSync("git ls-files '*wrangler.toml'")` — tracked-истина, прецедент verify-doc-visibility.mjs:37; git-вызов = окружение VCS, НЕ npm-зависимость (канон «node:-only» = про devDeps, docvis уже так работает). Имя ищется в `name = "…"` ТОЛЬКО файлов из workerIndex [001-решение по belive-api-дыре]. Fallback: execSync throw / exit≠0 (git нет / не репо) → печать ⚠ «tracked-истина недоступна, физический срез» + физический глоб depth≤2 без node_modules (деградация, вердикт может отличаться от CI). Пустой успешный вывод = истина (0 воркеров), НЕ fallback. При живом git физический глоб ЗАПРЕЩЁН: gitignored-каталог (belive-api/, .gitignore:78) не есть репо — CI его не чекаутит; судьба = 🔴 Никита, гейт докладывает, не лечит**
- `css-scan` (пара 4): glob `src/**/*.css` + `css/*.css`; **перед нормализацией вырезать `/* … */`-комментарии (regex `/\/\*[\s\S]*?\*\//g`) — комментарии не часть селектора** [001-решение по css-минору]; ключ (селектор до `{` + свойство) в ≥2 файлах → warn; вывод первые 10 + счётчик.
- `env-to-example` (пара 7): `.env.example` содержит `KEY=` (не `#`).

**Блок 4 — движок правил:** `implies` → A присутствует ∧ (B отсутствует ∨ B пуст при `nonEmpty` ∨ `sameIn`-несовпадение) ⇒ violation; `sameIn`: таблица не найдена хотя бы в одном из b.files = violation (missing-in-file) [002-стресс]; `warn-only` → находки = warn; `requires: cf-token` → всегда ⚪ UNVERIFIABLE.

**Блок 5 — GRACE:** `process.env.JUNCTION_GRACE` = csv id; violation с id из списка → печать `🟡 GRACE (id) — жертва живая, CF-батч 🔴`, НЕ считается violation; **для каждого id из grace без violation → печать `🟡 GRACE-STALE (id) — пора снять из deploy.yml` (exit не флипает, но забытый grace виден в каждом логе)** [002-стресс]. Warn/unverifiable grace не трогает.

**Блок 6 — печать + exit:** при непустом JUNCTION_GRACE первая строка вывода: `⚠ JUNCTION_GRACE active: N id(s)` [002-стресс: отравленное окружение видно сразу]; по каждой паре: `✅ ok | 🔴 violation | 🟡 warn | ⚪ UNVERIFIABLE | 🟡 GRACE` + `file:line` обеих сторон; итог: `pairs / violations / warns / unverified / grace`; violations>0 → `G-7: СТЫК РАЗОРВАН` + **exit 1**; иначе `G-7: стыки целы` + exit 0 (warns не флипают).

## 5. package.json (2 строки)

- после verify:inert добавить: `"verify:junction": "node scripts/verify-junction.mjs",`
- заменить строку verify:ci: `"verify:ci": "npm run verify:events && npm run verify:parity && npm run verify:reach && npm run verify:inert && npm run verify:docvis && npm run verify:junction"` — 6 гейтов, events+parity СОХРАНЕНЫ.

## 6. deploy.yml (шаг Verify)

```yaml
      - name: Verify Gates (events+parity+reach+inert+docvis+junction; G-7 victims in grace until CF-batch)
        run: npm run verify:ci
        env:
          JUNCTION_GRACE: 'wrangler-env-d1,vite-url-ai-worker,vite-url-worker-src'
```
Снятие grace = удаление env-строки в CF-батче Никиты (реестр не трогается).

## 7. ШАГИ ОПЕРАТОРА

1. Создать `scripts/junction-registry.yaml` (§3 дословно).
2. Создать `scripts/verify-junction.mjs` (§4 контракт).
3. `package.json` — кнопка + verify:ci (§5).
4. `.github/workflows/deploy.yml` — env + имя шага (§6).
5. Прогоны по приёмкам (порядок обязателен: A1 до push).

## 8. ПРИЁМКИ (команда → ожидание)

- **A0 проверка окружения (перед A1):** `echo $JUNCTION_GRACE` → **пусто**; непусто → `unset JUNCTION_GRACE` и перегнать [002-стресс: протечка grace = ложный «зелёный первый прогон» = ложный стоп].
- **A1 первый локальный прогон:** `node scripts/verify-junction.mjs` → exit 1; **violations = 3, ids = {wrangler-env-d1, vite-url-ai-worker, vite-url-worker-src}; любой другой счёт или множество = СТОП** [002-стресс: «≥1» пропускал частично-слепой гейт]: `wrangler-env-d1` (index.ts:27 / wrangler.toml:42 `""`), `vite-url-ai-worker` (main.tsx:695, воркера нет), `vite-url-worker-src` (belive-auth нет в tracked workerIndex — belive-api/ gitignored `.gitignore:78`, фантом ㉞, судьба 🔴 Никита; вывод пары 3: ok `.env:4 → belive-rehearsal ✓` + skip localhost + skip пустых + 🔴 `.env.production:5 → belive-auth — нет в tracked`); warns: `env-single-source` + `css-dup-warn`; ⚪ `secrets-cf-token`; ✅ `ephe-env-kv-scope`. **Если violations=0 по паре 1:** B-строка в выводе = wrangler.toml:42 с непустым id → жертва вылечена (CF-батч раньше применения), пара 1 считается ✅, тест ловушки ㊱ переносится на пару 2; и убрать wrangler-env-d1 из §6 grace и A4 (ожидание A4 тогда: 2×🟡 GRACE + 1×🟡 GRACE-STALE, violations=0, exit 0) [001-ревизия]; B-строка указывает на :36 (FEED_DB) или id пуст → резолв по файлу → **СТОП применения**.
- **A2 кнопка:** `npm run verify:junction` → вывод A1, exit 1.
- **A3 verify:ci локально:** `npm run verify:ci` → events+parity+reach+inert+docvis PASS, junction красный, exit 1 — **фича** (живые жертвы видны). **Exit 1 упал раньше junction-блока в выводе = A3 не засчитана, чинить упавший гейт** [002-стресс: npm-&& цепочка маскирует, кто именно красный].
- **A4 CI-репетиция:** `JUNCTION_GRACE=wrangler-env-d1,vite-url-ai-worker,vite-url-worker-src node scripts/verify-junction.mjs` → заголовок `⚠ JUNCTION_GRACE active: 3`, 3×🟡 GRACE, violations=0, exit 0.
- **A5 CI:** push в main → шаг Verify зелёный, деплой прошёл.
- **A6 канон-замыкание:** `npx tsc --noEmit` → 190 (Δ0) · `npm test -- --run` → 812/68/0int (Δ0). src/ не тронут.

## 9. ЛОВУШКИ ПАКА

1. Резолв по файлу (`includes('database_id')`) = гейт зелёный на своей жертве (㊱) — ловится A1.
2. `.env*` в CI: `.gitignore:58-59` вырезает `.env` и `.env.production.local` — в CI пара 3 видит только `.env.example`+`.env.production`; belive-auth-violation в CI уже под grace. Локально набор полный — не «чинить» расхождение.
3. Комментарии в .env: `.env.example:11` упоминает belive-auth в `#` — парсер пары 3 обязан skip `#`, иначе ложный violation.
4. Grace живёт в deploy.yml, не в реестре: поле `until` в yaml сломало бы exit-семантику и спрятало временное в вечном.
5. verify:ci — замена строки, не добавление рядом: потеря verify:parity = снятие существующей защиты деплоя.
6. Пара 6: `level: fail` + `requires: cf-token` → всегда ⚪, никогда ✅ — «не числится зелёной без проверки».
7. **TOML-комментарии (002):** закомментированный `database_id` при наивном парсинге «выигрывает последним» → ложный вердикт ровно на жертве; блок 2 skip-ает `#` после trim.
8. **Забытый grace (002):** после CF-батча и снятия жертв grace-строка в deploy.yml становится невидимой (молчит, если violations нет) → GRACE-STALE печатает «пора снять» в каждом логе, пока строку не удалят.
9. **Отравленное окружение (002):** JUNCTION_GRACE в .bashrc = вечный ложный зелёный локально → заголовок `⚠ JUNCTION_GRACE active` при непустом env + A0-проверка перед A1.
10. **Конвенция реестров (002):** реестры гейтов — в scripts/ рядом с интерпретатором; inert-allowlist.json в корне — историческое исключение (третья истина не плодится).

**Судьбы вне пака:** METRICS_DB, belive-ai, belive-auth, строка `.env.example` — всё 🔴 Никита (CF-батч + DECISIONS). Пак строит гейт; жертвы он честно краснит.
