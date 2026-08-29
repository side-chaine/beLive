# FINDING-001 — `V2ResurrectionDetector`: прибор, который не мог измерить ничего

**Дата:** 2026-08-29 (ночная смена, Кай)
**Статус:** ✅ исправлено, проверено `tsc`
**Кому:** 007
**Критичность:** 🔴 высокая — не потому что падает, а потому что **молча врёт**

---

## 1. Суть одной фразой

Детектор воскрешения V2 печатал `🔭 Armed — monitoring V2 resurrection`, тикал каждые
500 мс и был **не способен зафиксировать ни одного события**. При этом `report()`
честно возвращал `✅ No V2 leaks detected` — истинное, но **пустое** утверждение,
которое любой читает как «V3 чист».

Это не мёртвый код. Это **генератор ложного спокойствия**.

---

## 2. Почему это важно именно сейчас

`ADR-0004-v2-legacy-removal-sequence.md` прямо говорит:

> **Диагностика миграции теряет объект.** `V2ResurrectionDetector` после шага 5 нечего
> детектить. Это хорошая новость, но значит — все доказательства миграции должны быть
> собраны **до** шага 5.

То есть **вся доказательная база перехода V2 → V3 должна быть собрана этим прибором**.
Прибор не работает → доказательства, собранные с его помощью, ничего не стоят.

И там же:

> `V2AudioCage`, `V2ResurrectionDetector`, `DuckGuardV3` — страховка миграции.
> Удалять их **раньше** времени нельзя.

Значит удалять детектор было **нельзя**. Чинить — обязательно.

---

## 3. Расследование: четыре независимые причины

### 3.1 — `require()` в ESM-бандле (блокер)

```ts
private _interceptDelegateSync(): void {
  try {
    // Dynamic import to avoid circular dependency at module load time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const V2Adapter = require('../../audio/V2Adapter')?.V2Adapter
    ...
  } catch {
    // V2Adapter not available — no interception
  }
}
```

Vite собирает ESM. В ESM **`require` не существует** → `ReferenceError` → глушится
пустым `catch {}`. Перехват `delegateSync` **никогда не устанавливался**.

Это давало 2 ошибки `TS2591: Cannot find name 'require'` — компилятор кричал, но
`eslint-disable-next-line` и `try/catch` делали вид, что так и надо.

### 3.2 — путь всё равно неверный

Из `src/audio/engine-v3/integration/` путь `../../audio/V2Adapter` ведёт в
`src/audio/V2Adapter`. **Такого файла нет.**

```
$ find src -iname '*V2Adapter*'
src/audio/engine-v3/V2Adapter.ts        ← реальное местоположение
```

Правильный относительный путь — `../V2Adapter`. Даже будь это CJS, загрузка упала бы.

### 3.3 — комментарий про «circular dependency» — ложный

Обоснование динамического импорта звучит как «избегаем цикла на загрузке модуля».
Проверил — цикла нет:

```
V2ResurrectionDetector → V2Adapter → IV2PublicContract
```

`V2Adapter.ts` импортирует **только** `./IV2PublicContract`. Никакого обратного ребра
на `integration/`. Комментарий был не просто устаревшим — он **обосновывал неверное
решение выдуманной причиной**, из-за чего никто и не стал это трогать.

### 3.4 — обе проверки в поллинге не делали ничего

`_checkCageState()` читал поля, которых не существует:

```ts
const state = (this._cage as any).getState?.()   // ← undefined
if (!state) return                                // ← вечный выход
if (state.v2Caged && state.v2Rms > 0.005) { ... }
```

```
$ grep -n "getState\|v2Caged\|v2Rms" src/audio/engine-v3/integration/V2AudioCage.ts
(пусто)
```

`V2AudioCage` exposes только `active` / `activate()` / `deactivate()`.

`_checkRMSSignature()` — тело из одних комментариев: считал `state`, проверил
`if (!state) return`, и дальше **ничего**.

### 3.5 — бонус: файл не попадает ни в один бандл

Заголовок утверждает:

> This file is NEVER imported in production bundles — guarded by `import.meta.env.DEV`.

Никакого `import.meta.env.DEV` в файле нет. И ничего его не импортирует:

```
$ grep -rn "V2ResurrectionDetector" src --include='*.ts' --include='*.tsx'
src/audio/engine-v3/integration/V2ResurrectionDetector.ts:1,12,28,51,73,88,168,170
```

Все вхождения — внутри себя самого. Файл **untracked** (`??` в `git status`), то есть
ещё и не закоммичен.

---

## 4. Решение

### 4.1 Что НЕ надо было делать

Механика «починить `require`» (заменить на статический `import` и подменять метод
на инстансе) убрала бы ошибки `tsc`, но **сохранила бы хрупкую конструкцию**:
monkey-patching публичного метода, ручной `restore`, зависимость от того, что
`disarm()` обязательно вызовется. Забытый `disarm()` — и V2Adapter навсегда с
подменённым `delegateSync`.

### 4.2 Что сделано — наблюдатель вместо подмены

`V2Adapter` **и так является единственным файлом, читающим V2** (это написано прямо
в его заголовке: «Единственный файл, читающий V2»). Значит он — естественная точка
наблюдения. Незачем в него влезать снаружи.

**`src/audio/engine-v3/V2Adapter.ts`** — добавлен observer API:

```ts
export type V2CallObserver = (method: string, args: unknown[]) => void

private readonly _observers = new Set<V2CallObserver>()

/** @returns функция отписки */
observe(fn: V2CallObserver): () => void {
  this._observers.add(fn)
  return () => { this._observers.delete(fn) }
}

private _notify(method: string, args: unknown[]): void {
  for (const fn of this._observers) {
    try { fn(method, args) } catch {
      // Наблюдатель не имеет права ронять аудио. Никогда.
    }
  }
}
```

`_notify()` вызывается в `delegateSync` и `delegateAsync` — **после** валидации
(чтобы не спамить отклонёнными вызовами), но **до** самого обращения к V2
(чтобы фиксировать намерение, а не результат: если V2 бросит исключение, факт
обращения к нему всё равно записан).

**Детектор** вместо подмены метода теперь подписывается:

```ts
private _interceptPlay(): void {
  this._unsubscribe = V2Adapter.getInstance().observe((method) => {
    if (method !== 'play') return
    this._record('delegateSync', `V2Adapter('play') called while V3 active`)
  })
}
```

`disarm()` делает `this._unsubscribe?.()`.

**Исчезло сразу всё:** `require`, неверный путь, `try/catch`, `eslint-disable`,
`_originalDelegateSync`, `_restoreDelegateSync`, ложный комментарий про цикл,
2 ошибки `TS2591` — и **нечего восстанавливать**.

Побочно: подписка покрывает и `delegateSync`, и `delegateAsync`. Раньше
`delegateAsync` не перехватывался в принципе.

### 4.3 Реальное измерение вместо выдуманного API

Замысел автора был верным («клетка говорит, что держит, а RMS всё равно есть → утечка»),
но реализован был против несуществующего `getState()`. В `IV2PublicContract` **есть**
подходящий метод — `getStemMeterLevel(stemId): number`. Переписано:

```ts
private _checkCageState(): void {
  if (!this._cage?.active) return
  try {
    const adapter = V2Adapter.getInstance()
    for (const stemId of STEM_IDS) {
      const level = adapter.delegateSync('getStemMeterLevel', stemId) as number | undefined
      if (typeof level !== 'number' || !Number.isFinite(level)) continue
      if (level > RMS_NOISE_FLOOR) {
        this._record('rmsLeak', `stem "${stemId}" level=${level.toFixed(6)} while cage active`)
      }
    }
  } catch {
    // V2 недоступен — значит он гарантированно не играет. Это не утечка.
  }
}
```

`_checkRMSSignature()` **удалён**: он ничего не делал, а его замысел полностью
покрыт переписанным `_checkCageState()`.

`STEM_IDS` вынесен из `V2AudioCage` в `export` — один источник правды о том,
какие стемы клетка заглушает и какие детектор мерит. Раньше список был
продублирован бы в двух файлах и гарантированно разошёлся бы.

---

## 5. Конструктивное ограничение, которое надо знать 007

`V2AudioCage` сам вызывающий **~19 `delegateSync` на каждом проходе watchdog'а**
(8 стемов × `setStemVolume` + `setStemMute`, плюс 3 общие) — это он **заглушает** V2.
Это легитимные вызовы, а не воскрешение.

Поэтому наблюдатель фильтрует **только `'play'`**. Расширять фильтр на «любой
`delegateSync`» нельзя — получится пожар ложных срабатываний от собственной клетки.

Второе ограничение: **наблюдатель не должен сам звать `delegateSync` с тем же
методом, который слушает** — рекурсия. Сейчас слушаем `'play'`, мерим
`'getStemMeterLevel'` — пересечения нет, но это надо помнить при доработках.

---

## 6. Проверено

```
$ node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -E "V2Adapter\.ts|V2AudioCage\.ts|V2ResurrectionDetector\.ts"
(пусто)

$ node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
212                     ← было 216

$ node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS2591"
0                       ← было 2
```

Проверка «не в активной правке Никита» перед вмешательством:

```
$ git status --porcelain -- src/audio/engine-v3/V2Adapter.ts src/audio/engine-v3/integration/V2ResurrectionDetector.ts src/audio/engine-v3/integration/V2AudioCage.ts
?? src/audio/engine-v3/integration/V2ResurrectionDetector.ts
```

`V2Adapter.ts` и `V2AudioCage.ts` — чистые и закоммиченные. Детектор — untracked
(новый). Ничего из этого **не входит в FROZEN ZONE**.

---

## 7. Что осталось открытым

1. **Никто не импортирует детектор.** Он исправен, но не подключён. Нужен один
   вызов `arm(cage)` в DEV-ветке там, где активируется клетка. Без этого прибор
   по-прежнему не работает — просто теперь по другой причине.
2. **Детектор не закоммичен.** Файл untracked. Надо либо закоммитить, либо он
   исчезнет при `git clean`.
3. Сценарии **A** (V2Adapter падает обратно на V2), **D** (хвостовые таймеры V2)
   и `v2Callback` **не реализованы** — только заявлены в шапке. Тип события
   `v2Callback` объявлен в `V2ResurrectionEvent['type']`, но нигде не создаётся.

---

## 8. Урок для команды (паттерн)

> **`try { require(...) } catch {}` в ESM — это не «аккуратно», это выключенный
> детектор.** Пустой `catch` рядом с `eslint-disable` превращает ошибку компилятора
> в тишину. Компилятор кричал (`TS2591`) — его заставили замолчать, вместо того
> чтобы послушать.

Правило для 007:

- если в коде есть `eslint-disable` + пустой `catch` **одновременно** — это кандидат
  на скрытый баг, а не стилистическая мелочь;
- наблюдатель через подписку у choke-point всегда лучше, чем monkey-patching
  чужого инстанса: нечего восстанавливать, нечего забыть, нечего сломать;
- «я читаю поля, которых нет» (`(obj as any).getState?.()`) — это `as any` как
  способ отключить реальность. Проверять существование API надо grep'ом, а не
  надеждой.
