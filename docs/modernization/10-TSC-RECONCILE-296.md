# 10 · tsc-RECONCILE: 296 — не «красный фронт», а три строчки конфига
**От:** Кай (Hy4/Лив, Windows) · **Дата:** 2026-08-30 00:10 · **HEAD:** `a691c2f`
**Кому:** 007 · 007_2 · Босс · **Статус:** вопрос с GO-списка СНЯТ

---

## 0. Вердикт

**Противоречия нет. Обе стороны правы, и обе меряли разное.**

| | Что меряли | Результат |
|---|---|---|
| Канон 007 | **число** ошибок tsc | `tsc = 296` — базовый счётчик |
| Operator 007_2 | **цвет** (exit code) | красный, `TS6133/2345/2339/2591` |
| Я (Windows, независимо) | оба | **`296 ошибок, exit 2` — ровно канон, и он красный по определению** |

**296 — это не расхождение, это одно и то же число, записанное дважды.**
А CI его не видит вовсе — потому что **CI не запускает tsc**.

---

## 1. Воспроизводимость (повторите сами)

Я не проверяла по своему диску (он стейлый). Сделала чистый снимок коммита:

```bash
mkdir -p front-a691c2f
git archive a691c2fa017ecac57f23e917160085c36ce7a8c1 | tar -x -C front-a691c2f
# junction на node_modules (Windows; в Linux — symlink)
New-Item -ItemType Junction -Path front-a691c2f\node_modules -Target <repo>\node_modules
cd front-a691c2f
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

- TypeScript **5.9.3** (совпадает с `"typescript": "^5.9.3"` в package.json)
- Node **v22.22.2**
- 29 секунд, **exit 2**, **296 ошибок**
- Снимок лежит: `beLive-bridge/tmp/front-a691c2f/` (1377 файлов, можно перепроверить)

⚠️ Не `npx tsc` — он тянет заглушку из реестра и печатает 0 ошибок.

---

## 2. 🚩 Главное: CI НЕ запускает tsc

На `a691c2f` в `.github/workflows/` **всего три** файла:
`deploy.yml`, `deploy-rehearsal.yml`, `doc-sync-check.yml`.
**`quality-gates.yml` не существует в этом коммите.**

Что реально гоняет `deploy.yml`:

```yaml
- run: npm ci
- run: npm test -- --run          # vitest
- run: npm run verify:ci          # verify:events + verify:parity
- run: npm run build              # vite build && cp -r js dist/js
```

**`tsc` в этом списке нет.** Скрипт `"typecheck": "tsc --noEmit"` в package.json
есть, но **ни один workflow его не вызывает**.

И `vite build` не спасает: esbuild **стирает типы, не проверяя их**.
→ **«CI зелёный» и «tsc красный» сосуществуют законно. Это не баг сверки,
это дырка гейта.**

---

## 3. Триаж: 296 → три строчки конфига + один реальный баг

| Группа | Шт | % | Корень | Лечение |
|---|---|---|---|---|
| **TS6133** неиспользуемое | **122** | 41% | `noUnusedLocals` / `noUnusedParameters` = `true` | **политика**, а не баг: либо выключить, либо убрать мусор |
| **CaptureWorklet-каскад** | **80** | 27% | `TS2304: Cannot find name 'AudioWorkletProcessor'` → 75 каскадных `TS2339` | `declare global` в d.ts, **~5 строк** |
| **TS2591** `Cannot find name 'process'` | 8 | 3% | `"types": ["vite/client"]` — **`@types/node` не подключён** | добавить `"node"` в `types` |
| **VIS-19** | **3** | 1% | `PitchEngine.get()` не существует | **реальный баг — чинить код** |
| Остальное | ~83 | 28% | DOM-свойства (`HTMLAudioElement.playsInline`), `Float32Array<ArrayBufferLike>` (TS 5.7+), тесты на несуществующие поля стора | поштучно |

**Итого: 210 из 296 (71%) закрываются тремя правками конфига, а не кодом.**

### 3.1 Корень 80 ошибок — одна строка

```
src/audio/engine-v3/diagnostics/CaptureWorklet.ts(16,34):
  error TS2304: Cannot find name 'AudioWorkletProcessor'.
src/audio/engine-v3/diagnostics/CaptureWorklet.ts(20,12):
  error TS2339: Property '_bufferSize' does not exist on type 'CaptureProcessor'.
  ... ×75
```

`AudioWorkletProcessor` — глобаль AudioWorklet- области. В tsconfig
`lib: ["ESNext", "DOM", "DOM.Iterable"]` — **WebWorker нет**, базовый тип
не резолвится, и **75 обращений к `this._*` сыпятся каскадом**.
Одна недостающая декларация = 27% всего красного фронта.

### 3.2 🎯 tsc НЕЗАВИСИМО подтверждает VIS-19

```
src/audio/pitch/pitch-visual-bridge.ts(17,30): TS2339: Property 'get' does not exist on type 'typeof PitchEngine'.
src/stores/pitch.store.ts(45,32):              TS2339: Property 'get' does not exist on type 'typeof PitchEngine'.
src/stores/pitch.store.ts(85,17):              TS2339: Property 'get' does not exist on type 'typeof PitchEngine'.
```

**Компилятор подтвердил наш баг тремя точками.** Теперь VIS-19 — это не
«grep не нашёл», это **«TypeScript отказывается собирать»**.
Поправка к пакету 007_2: он указал `pitch-visual-bridge.ts:22` —
**на самом деле `:17`** (проверено по зеркалу и по tsc).

### 3.3 🚩 Побочная находка: фасад ВООБЩЕ не проверяется

`tsconfig.json`: `"include": ["src"]`.

`js/audio-facade-v3.js` — **корень всей инициативы `ARC-bridge-facade`
(BRG-2/3/4)** — лежит **вне `include`** и типизацией не covered никак.
→ Даже если мы зазеленим `src/`, фасад останется слепым пятном.
Предлагаю в ТЗ шага ② явно решить: переносить ли его в TS (`src/`) или
закрывать d.ts-контрактом.

### 3.4 Ещё тест-баг того же типа

```
src/stores/__tests__/medium-stores.test.ts(18,45): 'pitchEnabled' does not exist in type 'PitchState'
src/stores/__tests__/medium-stores.test.ts(20,37): Property 'pitchEnabled' does not exist on type 'PitchState'
```

Тест ссылается на несуществующее поле стора. VIS-19 в зеркальном виде.

---

## 4. Предложение (что делать)

```
① Три правки конфига            → −210 ошибок (71%). Не код, не риск.
     1) types: ["vite/client", "node"]
     2) declare global { class AudioWorkletProcessor {...} }  (новый d.ts)
     3) решение по noUnusedLocals/Parameters (политика Босса/007)
② VIS-19                        → −3. Реальный баг, первый фикс ARC (совпадает с приоритетом).
③ Остаток ~83                   → разбивка по файлам, в бэклог.
④ Добавить npm run typecheck в CI → только ПОСЛЕ ①–③, иначе гейт упадёт на 296.
```

**Порядок важен:** сначала триаж, потом гейт. Если включить tsc в CI сейчас —
завалим деплой на 296 ошибках, которых до этого никто не видел.

---

## 5. Поправки к синк-пакету 007_2

| Что в пакете | Уточнение |
|---|---|
| `pitch-visual-bridge.ts:22` | **`:17`** (проверено tsc и зеркалом) |
| «нужно сверить CI-конфиг vs локальный tsc» | **Сверила. CI не запускает tsc вообще.** Конфликта нет: 296 — это и есть канон, он красный |
| «Assign: 007» по tsc | Я сняла вопрос фактами. 007 остаётся **решение** по ① и ④, не расследование |
| VIS-19 «2 точки» | **3 точки** по tsc (+ `pitch-visual-bridge.ts:17`) |

---

## 6. 🆕 Поправка к моей же цифре: питч throttled до 10 Гц

Из зеркала `pitch.store.ts:29`:

```ts
const THROTTLE_MS = 100; /* 10Hz */
```

Я в документах писала «20 Гц → ~0.8 КБ/с». **Стор отдаёт 10 Гц.**
→ дельта питча по сети **~0.4 КБ/с** (вдвое меньше моей оценки), но:

**это архитектурный вопрос, а не только цифра.** Босс хочет
«визуально как next-generation computer game». **10 Гц = обновление раз в
100 мс** — это ниже порога плавности. Если мост будет брать данные из стора,
картинка будет дёргаться.

→ **В ТЗ шага ② зафиксировать:** либо смириться с 10 Гц, либо тапать движок
напрямую, минуя троттлинг стора. Моя рекомендация — **второй вариант**,
и это ещё один аргумент в пользу отдельного узла для пича (BLB-21): свой
AnalyserNode + свой цикл чтения, не завязанный на UI-троттлинг.

---

## 7. Один фразой

> **296 — это канон, и он красный; CI его просто не запускает, поэтому
> «зелёный CI» и «красный tsc» не противоречат друг другу. 71% красного
> закрывается тремя правками tsconfig, а не кодом. Компилятор независимо
> подтвердил VIS-19 тремя точками. Вопрос с GO-списка снят — осталось
> решение 007 по конфигу и по включению гейта.**
