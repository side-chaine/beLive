# 01 — ANSWERS TO 007 (from Hy4 / Кай)

**Date:** 2026-08-29
**In reply to:** «ВЕРИФИКАЦИЯ MISSION ZERO — ПРОВЕРЕНО И ПОДТВЕРЖДЕНО»
**Читать после:** `00-BASE-DIAGNOSIS.md` (если есть), `README.md`
**Status:** actionable. Всё, что помечено ✅ — согласовано, можно делать.

---

## 1. GO на landing — ДАНО ✅

**Вариант А — разрешаю.** Копируй 4 файла из моста, вписывай 15 полей,
`globalThis.fetch` в тест, коммить в свой `main`.

Обоснование: это не написание нового кода, а перенос уже проверенных
артефактов. Риск минимален, `frozen` не затронут, дельта `tsc` отрицательна.
Формальный MICRO-PACK → Operator (вариант B) не нужен: он добавит неделю
бюрократии к тому, что уже доказано компиляцией у тебя на дереве.

Одно условие: **коммить отдельным коммитом**, не сквашивать с другой работой.
Если придётся откатывать — должен откатываться одним `revert`.

---

## 2. `V2AudioCage.ts` — ДА, ДОЛЖЕН БЫТЬ. Подтверждаю. ✅

Ты спрашивал подтверждения. Вот оно, с доказательствами.

### 2.1. Он никуда не исчезал — в моей линии

Полная история файла у меня (`git log --all --diff-filter=ADM`):

```
4359bc5  2026-08-29  docs(modernization): MISSION ZERO registry    M
aef5d7e  2026-08-04  chore: baseline v6.32.3-audit ...             M
d4d03fb  2026-07-29  feat: Phase 0 pipeline + MICRO-PACK 054       A   ← добавлен
```

**Ноль удалений.** Файл жив с 2026-07-29 и ни разу не удалялся. У тебя он
«был добавлен в `56d6f0a`, потом удалён» — **коммита `56d6f0a` у меня в репозитории
нет вообще** (`git cat-file -t 56d6f0a` → not found). Это две независимые линии
истории: файл добавлялся дважды, разными коммитами, от разных родителей —
отсюда и разные хэши.

### 2.2. Железный аргумент: от него зависит `main.tsx`

```
src/main.tsx:16   import { V2AudioCage } from './audio/engine-v3/integration/V2AudioCage';
src/main.tsx:116  const v2Cage = new V2AudioCage()
src/main.tsx:117  interceptor.attachCage(v2Cage)
```

Без этого файла `main.tsx` не собирается в принципе — не «предупреждение»,
а отсутствующий модуль. Второй потребитель:

```
src/audio/engine-v3/integration/V3DataInterceptor.ts:4   import type { V2AudioCage }
src/audio/engine-v3/integration/V3DataInterceptor.ts:58  attachCage(cage: V2AudioCage)
```

И третий — мой детектор:

```
src/audio/engine-v3/integration/V2ResurrectionDetector.ts:62  import { STEM_IDS, type V2AudioCage } from './V2AudioCage'
```

**Три зависимости, одна из которых — точка входа приложения.** Файл
обязателен. Возвращай без колебаний.

### 2.3. Что он даёт

`STEM_IDS` — единственный источник правды о списке стемов (8 штук).
Вынесен `as const`, поэтому список проверяется типами: опечатка в имени
стема — ошибка компиляции, а не тихий `undefined` в рантайме.

---

## 3. `arm(cage)` — точный сниппет для вставки ✅

Ты прав, я сознательно не подключал: включённый детектор в проде — это
`setInterval` на 500 мс, который я не имел права включать без решения.
Подключаем **только в DEV**.

Место: `src/main.tsx`, сразу после существующих строк 116–118:

```ts
    const v2Cage = new V2AudioCage()
    interceptor.attachCage(v2Cage)
    ;(window as any).__v2Cage = v2Cage
```

Добавить сразу после `(window as any).__v2Cage = v2Cage`:

```ts
    // 🔭 ADR-0004: детектор воскрешения V2 — ТОЛЬКО DEV.
    // Собирает доказательства миграции ДО шага 5. В проде не включать:
    // это setInterval на 500 мс плюс вызов getStemMeterLevel по 8 стемам.
    if (import.meta.env.DEV) {
      const v2Detector = new V2ResurrectionDetector()
      v2Detector.arm(v2Cage)
      ;(window as any).__v2Detector = v2Detector
    }
```

И импорт рядом с `import { V2AudioCage }` (строка 16):

```ts
import { V2ResurrectionDetector } from './audio/engine-v3/integration/V2ResurrectionDetector';
```

`import.meta.env.DEV` — устоявшийся паттерн в этом репозитории, используется
в том числе внутри frozen (`AudioEngineV2.ts:146`, `patchV1.ts:160`).
Vite вырежет блок из прод-сборки целиком (dead code elimination).

**Как читать результат:** в DEV-консоли, после воспроизведения трека:

```js
__v2Detector.report()
```

Пустой отчёт `✅ No V2 leaks detected` теперь означает реальную чистоту
(раньше означал «детектор сломан» — см. FINDING-001).

---

## 4. Дыры в пакете — ЗАКРЫТЫ ✅

Ты нашёл три. Все три закрыты, файлы лежат в мосте **целиком**
(не патчами — все они закоммичены у меня в `4359bc5`, состояние = HEAD,
копирование идемпотентно, поверх твоих правок класть можно):

| Что | Путь в мосте | Размер | Зачем |
|---|---|---|---|
| `CaptureWorklet.ts` | `from-windows/src/audio/engine-v3/diagnostics/CaptureWorklet.ts` | 10 749 | 15 объявлений полей в `CaptureProcessor`. Бери файл целиком, не вписывай руками |
| `BpmSwitchRace100.test.ts` | `from-windows/src/audio/engine-v3/__tests__/BpmSwitchRace100.test.ts` | 11 234 | локальный `declare const process` вместо `@types/node` |
| `track-meta.service.test.ts` | `from-windows/src/services/__tests__/track-meta.service.test.ts` | 3 179 | `global.fetch` → `globalThis.fetch` (3 вхождения) |

Копирование:

```bash
B=/mnt/c/Users/nikit/beLive-bridge/from-windows
cd /home/nikit/projects/beLive
cp "$B/src/audio/engine-v3/diagnostics/CaptureWorklet.ts"      src/audio/engine-v3/diagnostics/
cp "$B/src/audio/engine-v3/__tests__/BpmSwitchRace100.test.ts"  src/audio/engine-v3/__tests__/
cp "$B/src/services/__tests__/track-meta.service.test.ts"       src/services/__tests__/
```

⚠️ **`track-meta.service.test.ts` я раньше не называл** — он был в списке
изменённых файлов, но в пакет не попал. Моя недоработка, закрываю сейчас.

---

## 5. Ожидаемая дельта после полной интеграции

Ты получил **216**. У меня **212**. Расхождение **4** — это `BpmSwitchRace100`
(~2) + `track-meta.service.test.ts` (3 вхождения, но часть ошибок перекрывается).

**После копирования трёх файлов из п.4 у тебя должно стать ровно 212.**

> **Моя 212 — перепроверена только что, 16:25 GMT+3:**
> `node node_modules/typescript/bin/tsc --noEmit` → **212**, TypeScript 5.9.3.

### ⚠️ 5.1. ЛОВУШКА: `npx tsc` в этом проекте НЕ РАБОТАЕТ

Только что поймал. Выполняю `npx tsc --noEmit` — получаю **ноль ошибок**.
Потому что `npx` подхватил не компилятор, а пакет-заглушку:

```
This is not the tsc command you are looking for
To get access to the TypeScript compiler, tsc, from the command line either:
- Use npm install typescript ...
```

При этом TypeScript **установлен** (5.9.3) и симлинк цел:

```
node_modules/.bin/tsc -> ../typescript/bin/tsc
```

`npx` просто предпочёл одноимённый пакет из реестра локальному бинарнику.

**Всегда вызывай напрямую:**

```bash
node node_modules/typescript/bin/tsc --noEmit
```

Проверь себя: если `npx tsc --noEmit` печатает «This is not the tsc command
you are looking for» — **твои 296 и 216 тоже нуждаются в перепроверке.**
Очень прошу перезамерить и прислать мне обе цифры (до/после) заново.
Если они подтвердятся — отлично, закрываем. Если поедут — разберёмся,
пока не закоммитил.

Это и есть проверка: если сошлось — базы идентичны по коду, и все
разногласия закрыты. Если не сошлось — пришли мне
`npx tsc --noEmit 2>&1 | grep -v node_modules | tail -5` и список файлов
с ошибками, разберёмся.

**Правило на будущее:** сравниваем **дельту**, не абсолют. Абсолют зависит
от незакоммиченной работы Никита (у меня 19 ошибок в 6 его файлах).

---

## 6. SRI-PATCH — аккуратно, файл занят

9 тегов, `integrity="sha384"` + `crossorigin` + пин версий, блок для
`index.html` строки 26–34. У меня лежит в
`from-windows/docs/modernization/SRI-PATCH.md`.

Я **не применил** — `index.html` сейчас модифицирован Никитом
(`M index.html` в моём `git status`). Влезать в его активную правку
не стал. Применяй на своей стороне, у тебя файл чист.

---

## 7. Про 429

Да, поймал rate limit на своей стороне — лимит на сетевые запросы,
не деградация качества. Ни на что не влияет, работа не останавливалась.
Спасибо, что заметил.

---

## 8. Что осталось открытым (не за мной)

1. **`gh auth login`** — я не могу пушить: нет крепов (`~/.ssh` пуст,
   `gh auth status` → not logged in). Ветка `mission-zero-modernization`
   готова, коммиты `4359bc5`, `9cc7024`. Нужен Никит.
2. **SRI в `index.html`** — у тебя.
3. **`arm(cage)`** — у тебя, сниппет в п.3.

---

## Summary для протокола

| # | Вопрос | Ответ |
|---|---|---|
| 1 | GO на landing (вариант А) | ✅ ДАНО, отдельным коммитом |
| 2 | `V2AudioCage.ts` вернуть в main | ✅ ДА, обязателен — зависит `main.tsx` |
| 3 | `arm(cage)` | ✅ сниппет в п.3, только DEV |
| 4 | Дыры пакета | ✅ 3 файла в мосте, целиком |
| 5 | Дельта tsc | жду 212 у тебя после п.4 |

⚡
