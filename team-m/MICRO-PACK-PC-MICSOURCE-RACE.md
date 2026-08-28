# MICRO-PACK-PC-MICSOURCE-RACE.md — MicSourceV3 acquire race (P2, вторично)

> Автор пака: 007_Hub. Источник: Mac-007 stress-p2-verdict.md #3 (CONFIRMED).
> Статус: **ЧЕРНОВИК, не применён** — ждёт GO (вторично, lower severity, чем program-capture).
> Frozen-zone: НЕ затрагивает (`src/audio/engine-v3/services/MicSourceV3.ts` — V3-собственный файл).

## Проблема
Два независимых UI-входа (`takes.recorder.ts:82` REC-кнопка + `ControlDeck.tsx:400` 🎤-тумблер)
зовут `MicSourceV3.acquire()` без общего in-flight замка. При первом включении (permission-промпт
держит окно) оба проходят `if (this._stream)` (null) → два `getUserMedia` → `_stream` = last-writer-wins,
первый стрим **осиротевший LIVE** до перезагрузки страницы (индикатор микрофона ОС горит).

## Фикс (in-flight Promise-мемоизация)
### Правка — `src/audio/engine-v3/services/MicSourceV3.ts`
Добавить поле и переписать `acquire()`:
```ts
  private _inflight: Promise<MediaStream> | null = null;

  async acquire(): Promise<MediaStream> {
    this._refCount++;
    if (this._stream) return this._stream;
    if (this._inflight) return this._inflight;        // делим in-flight между входами
    this._inflight = this._open().then((stream) => {
      this._stream = stream;
      this._inflight = null;
      return stream;
    }).catch((e) => {
      this._refCount = Math.max(0, this._refCount - 1);
      this._inflight = null;
      throw e;
    });
    return this._inflight;
  }
```
`release()` трогать не нужно (счётчик refCount уже корректен).

## Верификация
- Юнит-сценарий: два concurrent `acquire()` → ровно один `getUserMedia`, оба резолвят один стрим.
- `npx tsc --noEmit` — 313 (без регресса).
- Ручной тест: ткнуть 🎤 и REC одновременно при первом разрешении → один hardware-stream, индикатор не дублируется.

## Приоритет
Вторично (resource-leak, не data-loss). Рекомендую применить вместе с program-capture паком,
если Босс даст GO на расширение P1.
