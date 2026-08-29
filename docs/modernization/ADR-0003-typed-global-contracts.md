# ADR-0003 · Типизированные глобальные контракты вместо `window as any`

**Статус:** proposed · **Дата:** 2026-08-29 · **Волна:** W1 (Z4) · **Снимает:** 96 ошибок TS2339
**Связано:** [00-ROADMAP](./00-ROADMAP.md), [ADR-0004](./ADR-0004-v2-legacy-removal-sequence.md), [team-m/REGISTRY.md](../../team-m/REGISTRY.md)

---

## Контекст

**308** вхождений `(window as any)` и **541** `as any` по всему `src/`. Глобальный объект используется как шина данных между подсистемами, которые иначе не связаны:

| Глобал | Где объявлен | Кто читает |
|---|---|---|
| `window.audioEngine` | `js/audio-engine.js:33` (V1/V2-стаб, не загружается) или `js/audio-facade-v3.js:44` (V3-фасад) | Rehearsal, marker-manager, monitor-mix |
| `window.__belive.pipeline` | `src/main.tsx:170-171` | stem-engine-sync, V2ResurrectionDetector |
| `window.__belive.currentTime` | `V3StatePublisher.ts:131-132` | `js/audio-facade-v3.js:14` |
| `window.__belive.trackUrls` | `src/main.tsx` | фасад (`hybridEngine`) |
| `window.__getTransport` | `src/main.tsx:181` | консольная отладка |
| `window.__tp` | `src/main.tsx:184` | консоль |
| `window.__v3play / __v3pause / __v3stop / __v3rate / __v3seek / __v3status` | `src/main.tsx:185-198` | консоль |
| `window.__switchToV3` | `src/main.tsx:201` | консоль |
| `window.__v2BirthCount` | `src/App.tsx:92-94` | счётчик No-Birth (M2/345) |
| `window.__beliveBridgeFacade` | `src/foundation/event-bus/facade.ts:80-83` | шина событий |
| `window.__belivePracticeInterruption` | `src/exercises/exercise.interruption.ts:176` | упражнения |
| `window.monitorMix` | `js/monitor-mix.js:1217` | JS-слой |
| `window.lyricsDisplay` | `js/marker-manager.js:82` | JS-слой |

**96 ошибок TS2339** — прямое следствие: компилятор не знает, что лежит в этих свойствах, и каждый читатель обязан угадывать.

### Почему это не косметика

Аудит C3 ([`team-m/REGISTRY.md`](../../team-m/REGISTRY.md)) показал механизм на живом примере. Rehearsal вызывает `ae?.play?.().catch(...)`. V3-фасад определяет `play()` как **пустую функцию, возвращающую `undefined`**. Итог — `TypeError: Cannot read properties of undefined (reading 'catch')` в двух местах, включая основной путь запуска воспроизведения.

**Никакой optional chaining это не ловит:** `?.` защищает от отсутствия метода, но не от того, что метод вернул не Promise. Договориться «на честном слове» не удалось — потому что **договариваться было нечем**: контракта не существовало в принципе, только `as any` с двух сторон.

---

## Решение

**Один файл контрактов + один интерфейс транспорта.** Глобалы не удаляем (это отдельная большая работа W5), но **типизируем их и вводим единый интерфейс для самого опасного из них**.

### 1. `src/types/globals.d.ts`

```ts
import type { HybridPipelineService } from '@/audio/engine-v3/pipeline/HybridPipelineService'
import type { TransportV3 } from '@/audio/engine-v3/core/TransportV3'
import type { ITransport } from '@/audio/contracts/transport.contract'

declare global {
  interface Window {
    /** V2-движок (легаси) или V3-фасад. В V3-сборке — фасад, см. ADR-0004. */
    audioEngine?: ITransport & { audioContext?: AudioContext; playbackRate?: number }

    __belive?: {
      pipeline?: HybridPipelineService
      currentTime?: number
      trackUrls?: { instrumentalUrl?: string | null; vocalsUrl?: string | null }
      routeCheck?: () => unknown
    }

    __getTransport?: () => TransportV3
    __tp?: TransportV3
    __switchToV3?: () => Promise<void>
    __v2BirthCount?: number

    __beliveBridgeFacade?: unknown
    __belivePracticeInterruption?: unknown

    monitorMix?: unknown
    lyricsDisplay?: unknown
  }
}

export {}
```

### 2. `src/audio/contracts/transport.contract.ts` — главный ход

```ts
export interface ITransport {
  /** ВСЕГДА возвращает Promise. Реализации обязаны оборачивать sync-вызовы. */
  play(offset?: number, rate?: number): Promise<void>
  pause(): Promise<void>
  seek(time: number, rate?: number): Promise<void>
  getCurrentTime(): number
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  setStemVolume(stemId: string, volume: number): void
  readonly audioContext?: AudioContext
}

export function resolveTransport(): ITransport | null
```

`resolveTransport()` — единственная точка, которая знает про V2/V3:

```ts
export function resolveTransport(): ITransport | null {
  const isV3 = (import.meta.env.VITE_ENGINE ?? 'v2') === 'v3'
  if (isV3) return V3TransportAdapter.tryCreate()   // через __belive.pipeline + __getTransport
  return V2TransportAdapter.tryCreate()             // через window.audioEngine
  // оба адаптера обязаны возвращать Promise из КАЖДОГО метода
}
```

**Ключевое свойство:** `play()` по контракту **всегда** возвращает `Promise<void>`. Класс ошибки из C3 (`undefined.catch()`) становится **ошибкой компиляции**, а не тихим падением в проде.

### 3. Постепенное вытеснение `as any`

Правило на ревью: **новый код не имеет права использовать `(window as any)`**. Старые места меняются по ходу W1–W5, в первую очередь — те, что в зонах с ошибками TS2339.

---

## Последствия

**Плюсы**
- **−96 ошибок** TS2339.
- Целый класс багов («метод вернул не то, что ожидал вызывающий») переходит из прода в компайл.
- Появляется **единая точка переключения V2/V3** — это же и есть задел под W2 (ADR-0004): когда V2 удалят, меняется одно тело `resolveTransport()`.
- Глобалы становятся **перечислимыми**: их стало видно в одном файле, а не размазанными по 541 касту.

**Минусы / чем платим**
- **`.d.ts` может соврать.** Если кто-то запишет в `window.__belive` объект другой формы, типы промолчат. Компенсация: объявления только для чтения; запись — через типизированные сеттеры; консольные глобалы (`__v3play`, `__tp`) помечены как отладочные и не используются в коде приложения.
- **Два адаптера вместо одного вызова.** Немного больше кода на стыке. Компенсация: стык один на весь проект.
- **Контракт транспорта придётся менять**, когда V3 обретёт новые возможности. Это нормально — интерфейс для того и существует.

---

## Альтернативы

| Вариант | Почему нет |
|---|---|
| Оставить `as any`, заняться другими ошибками | 96 ошибок и весь класс C3-багов остаются. `any` — это не нейтрально, это **выключенный компайл** |
| Удалить глобалы, перейти на модули (DI/контекст) | Правильно стратегически, но это W5-объём: 12 глобалов, затрагивающих React, JS-слой и ворклеты. Типизация сейчас даёт 80% выгоды за 20% усилий |
| Zod-валидация каждого глобала в рантайме | Дорого по CPU на каждый тик (`currentTime` обновляется каждые 50 мс) |
| Типизировать только `audioEngine`, остальное оставить | Снимает меньше половины; глобалы читаются и из `js/`-слоя, дыры останутся |

---

## План внедрения

| Шаг | Действие | Проверка |
|---|---|---|
| 1 | Собрать полный список глобалов (таблица выше) — **done** | — |
| 2 | Создать `src/types/globals.d.ts`, подключить в `tsconfig.json` | `tsc` видит `Window` расширенным |
| 3 | Создать `transport.contract.ts` + `resolveTransport()` | контракт компилируется |
| 4 | Перевести Rehearsal (17 обращений) на `resolveTransport()` | C3-краши уходят по конструкции |
| 5 | Перевести `js/`-фасад на тот же контракт (JSDoc-типы) | поведение V3-фасада не меняется |
| 6 | Волнами убрать `(window as any)` в файлах с TS2339 | −96 ошибок |
| 7 | Правило ревью: новый `as any` — только с `@ts-expect-error` и обоснованием | закреплено в CODEOWNERS/чеклисте |

**Откат:** удалить `.d.ts` и контракт — изменения аддитивные, рантайм не затронут до шага 4. Шаг 4 обратим возвратом к прямому чтению `window.audioEngine`.

**Критерий успеха:** `grep -rc "(window as any)" src` падает, `tsc --noEmit` теряет 96 ошибок, поведение V3 не изменилось (консольные тесты из `067-TEST-CARD-FOR-OPUS3.md` дают те же числа).
