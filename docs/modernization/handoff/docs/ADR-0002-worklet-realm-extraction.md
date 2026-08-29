# ADR-0002 · Вынос AudioWorklet-кода из строк в настоящие модули

**Статус:** proposed · **Дата:** 2026-08-29 · **Волна:** W1 (Z2) · **Снимает:** 80 ошибок tsc (26% всех)
**Связано:** [00-ROADMAP](./00-ROADMAP.md), [ADR-0008](./ADR-0008-csp-and-security-baseline.md)

---

## Контекст

`src/audio/engine-v3/diagnostics/CaptureWorklet.ts` (264 строки) даёт **80 ошибок TypeScript — 26% всего долга репозитория**. Все одного вида:

```
TS2339: Property 'port' does not exist on type 'CaptureProcessor'
TS2339: Property '_writeIndex' does not exist on type 'CaptureProcessor'
TS2339: Property '_bufferSize' does not exist on type 'CaptureProcessor'
... и так 80 раз
```

**Механизм** (строки 197–204):

```ts
const code = `(${captureWorkletCode.toString()})();`   // :197
const blob = new Blob([code], { type: 'text/javascript' })  // :198
const blobUrl = URL.createObjectURL(blob)                    // :199
await ctx.audioWorklet.addModule(blobUrl)                    // :201
URL.revokeObjectURL(blobUrl)                                 // :203
```

Функция `captureWorkletCode()` объявлена с пометкой в собственном комментарии файла: *«Pure JS — никакого TypeScript-синтаксиса, потому что функция сериализуется через toString() и исполняется в AudioWorklet»*.

**Почему это нельзя «просто затипизировать» — три причины:**

1. **Физическая.** Тело функции уезжает в строку. Любой TS-синтаксис (`: number`, `private`, `implements`) станет частью строки и сломает рантайм в ворклет-реалме, где нет компилятора.
2. **Семантическая.** В `tsconfig.json` включён `useDefineForClassFields: true`. Если объявить поля класса (`private _buffer!: Float32Array`), TypeScript сгенерирует `[[Define]]`-семантику вместо `[[Set]]`. В строке, которая исполняется как есть, семантика **другая**. Типы починятся — **поведение сломается** неявно и тихо.
3. **Платформенная.** `AudioWorkletProcessor` и `AudioWorkletGlobalScope` отсутствуют в `lib: ["DOM"]` — они живут в отдельном реалме со своими глобальными типами. Объявить их «в лоб» в DOM-контексте — значит соврать компилятору о доступности.

### Два факта, которые всё меняют

**Факт 1. Правильный паттерн в репозитории уже есть.** `src/audio/pitch/pitch-engine.ts:89-93`:

```ts
const url = new URL('./yin-processor.js', import.meta.url)
await ctx.audioWorklet.addModule(url)
```

и рядом лежит настоящий файл `src/audio/pitch/yin-processor.js` (6 438 байт). То есть **мы ничего не изобретаем** — тиражируем то, что у нас уже работает. `CaptureWorklet.ts` — не норма, а выброс.

**Факт 2. Радиус поражения — ноль в продакшене.** Единственный потребитель: `src/audio/engine-v3/diagnostics/impulse-test-harness.ts` (импортирует `createCaptureNode`, `readCapturedSamples`, `clearCapturedSamples`). За пределами `diagnostics/` — **ни одного упоминания**.

> Следствие для оценки риска: в [00-ROADMAP](./00-ROADMAP.md) Z2 помечена красным. **Это завышение.** Реальный риск — 🟢 низкий: меняется инструмент диагностики, аудио-путь прода не затронут.

### Побочные выгоды (не менее важные, чем типы)

| | Сейчас (`toString()` + Blob) | После (файл + `addModule`) |
|---|---|---|
| CSP | требует `blob:` и `unsafe-eval` | обычный статический файл, **`unsafe-eval` не нужен** |
| Кеш | Blob создаётся и умирает каждый раз | HTTP-кеш, загружается один раз |
| Дебаг | стек-трейсы внутри `eval`'d кода | нормальные исходники, брейкпоинты работают |
| Бандлинг | не бандлится, не минифицируется | участвует в сборке |
| Размер | 264 строки TS, из которых полезных ~100 | честный `.js` в своём реалме |

---

## Решение

Вынести код процессора в отдельный файл и загружать через `new URL(...)`, **по образцу `pitch-engine.ts`**.

**1. Создать `src/audio/engine-v3/diagnostics/capture-processor.js`** — перенести тело `captureWorkletCode()` как есть, без TS-синтаксиса, с JSDoc-аннотациями для подсказок:

```js
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options)
    /** @type {Float32Array} */ this._buffer = new Float32Array(size)
    /** @type {number} */ this._writeIndex = 0
    ...
  }
}
registerProcessor('belive-capture-processor', CaptureProcessor)
```

**2. Загрузка — как в `pitch-engine.ts`:**

```ts
const url = new URL('./capture-processor.js', import.meta.url)
await ctx.audioWorklet.addModule(url)
```

**3. Удалить** `captureWorkletCode()`, `new Blob`, `createObjectURL`, `revokeObjectURL` (строки 13–204 в части сериализации). Оставить публичные функции `createCaptureNode`, `readCapturedSamples`, `clearCapturedSamples` — их сигнатуры не меняются.

**4. Типизация стыка.** Процессор общается с основным потоком через `port.postMessage`. Описать сообщения одним типом в `diagnostics/capture-protocol.ts` и использовать с двух сторон. JSDoc в `.js` даст подсказки внутри процессора, TS-тип — снаружи.

**5. `js/worklets/recorder-processor.js`** — уже файл, уже правильно. Оставить как образец.

**6. Остальные 21 `new Blob`.** Пройти тем же приёмом, но **каждый отдельным PR** и только после того, как первый (capture) докажет паттерн. Часть из них — не реалмы, а честные экспорты файлов (`UploadPanel`, `show.html.service`); их не трогать.

---

## Последствия

**Плюсы**
- **−80 ошибок** (26% долга) одним ходом.
- Снимает блокер для strict CSP (ADR-0008) — без этого CSP на проде невозможен.
- Код ворклета становится отлаживаемым и кешируемым.
- Убирает класс «типы починили — поведение сломалось» (`useDefineForClassFields`).
- Единообразие: два паттерна загрузки в репо → один.

**Минусы / чем платим**
- **Путь к файлу становится частью бандла.** `new URL(..., import.meta.url)` корректно обрабатывается Vite (файл копируется в `dist` с хешем). Но при апгрейде Vite 5 → 8 (ADR-0005) это место надо **перепроверить первым** — обработка asset URL менялась между мажорами.
- **Дублирование типов.** Протокол общения описывается дважды (JSDoc в `.js`, TS-интерфейс снаружи). Компенсация: держать их рядом, один файл `.d.ts` на процессор.
- **Асинхронность уже была** (`addModule` и так `await`), так что новых race-condition не появится.

---

## Альтернативы

| Вариант | Почему нет |
|---|---|
| `// @ts-nocheck` на файле | Снимает 80 ошибок, но и **все** проверки с живого диагностического кода. Маскировка, а не лечение |
| `declare class CaptureProcessor` с полями в том же файле | Типы починятся, но `useDefineForClassFields: true` изменит семантику инициализации полей в строке — **тихая поломка рантайма**. Худший из вариантов, потому что выглядит как победа |
| Добавить `lib: ["WebWorker"]` в `tsconfig.json` | WebWorker и AudioWorklet — **разные** реалмы; подмешивание типов работника в DOM-контекст создаст ложные доступности |
| Оставить Blob, но вынести строку в `?raw`-импорт | Снимает дурацкий `toString()`, но сохраняет `unsafe-eval` и отсутствие типов |
| Удалить диагностику целиком | Соблазнительно (80 ошибок в моменте), но это измерительный инструмент миграции V2→V3; без него W2 (ADR-0004) станет неуправляемой |

---

## План внедрения

| Шаг | Действие | Проверка |
|---|---|---|
| 1 | Создать `capture-processor.js`, перенести тело без TS-синтаксиса | файл парсится, `registerProcessor` на месте |
| 2 | Заменить загрузку на `new URL(..., import.meta.url)` | `tsc` по файлу: **0 ошибок** |
| 3 | Описать протокол `port.postMessage` в `capture-protocol.ts` | типы сходятся с обеих сторон |
| 4 | Удалить `captureWorkletCode` + Blob-обвязку | `tsc --noEmit` −80 |
| 5 | **Прогнать impulse-test** до и после: снепшот захваченных сэмплов |波形 идентичны (байт-в-байт) |
| 6 | Проверить, что в `dist` файлprocessора появился с хешем | `dist/` содержит `capture-processor-*.js` |
| 7 | Зафиксировать новый baseline | **300 − 80 = 220** (после Z1) |

**Откат:** вернуть файл из git,Blob-загрузку — из истории. Бластящий радиус ограничен `diagnostics/`, прод не задет, поэтому откат безопасен в любой момент.

**Критерий успеха:** `tsc --noEmit` теряет ровно 80 ошибок, `grep -c "new Blob" src` уменьшается, impulse-test даёт идентичный результат, `git diff` не задевает ничего вне `src/audio/engine-v3/diagnostics/`.
