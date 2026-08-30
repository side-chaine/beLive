# 434-MICRO-PACK-F17 — ЗВУК ТЕЙКА: ctx из v3-синглтона (E1-семейство, экземпляр №4)

**Симптом (пользователь):** тейк сохранён (C31 ✅), волна видна, но при клике — тишина, ноль ошибок в консоли.

**Корень:** `useTakesPlayback.ts` резолвит контекст через V2-фасад:
`:134 const ctx = ae.audioContext ?? ae._audioContext;`
В v3 фасад (`js/audio-facade-v3.js`) НЕ имеет ни `audioContext`, ни `_audioContext` (комментарий :5 обещает «audioContext → общий», но свойство не реализовано) → `ctx === undefined` → тихий `return` на :135. Волна есть, потому что пики закешированы при коммите (декод C30 на `getAudioContext()`), а до `createBufferSource()` дело не доходит.

**Фикс:** тот же паттерн, что C30 — синглтон `getAudioContext()`. Вывод подтверждён: `_defaultBranch → ctx.destination` постоянен (MonitorRouter :90-91), прямой коннект превью будет слышен.

---

## EDIT 1 — `src/takes/hooks/usePlayBack` НЕТ: файл `src/takes/hooks/useTakesPlayback.ts`, импорт

После строки:

```ts
import { getTransport } from '../../audio/engine-v3';
```

добавить новой строкой:

```ts
import { getAudioContext } from '../../audio/core/audioContext';
```

## EDIT 2 — сайт декода (:116, отступ 8 пробелов)

```ts
        const ctx: AudioContext = ae.audioContext ?? ae._audioContext;
```
заменить на:
```ts
        const ctx: AudioContext = getAudioContext();
```

## EDIT 3 — сайт запуска (:134, отступ 6 пробелов)

```ts
      const ctx: AudioContext = ae.audioContext ?? ae._audioContext;
```
заменить на:
```ts
      const ctx: AudioContext = getAudioContext();
```

Строку следом `if (!ctx) return;` НЕ трогать (безвредный guard). Больше в файле ничего не менять.

---

## ВЕРИФИКАЦИЯ (формула А4)
1. `npx tsc --noEmit` → 314; diff error sets vs HEAD — IDENTICAL.
2. `npx vitest run` → files 61/63 (2 legacy load-error), tests 749/749.
3. Отчёт: файлы, числа, отклонения (анкор не нашёлся — СТОП).

## ОЖИДАЕМЫЙ ЭФФЕКТ (проверит пользователь)
1. Квест: записал блок → автопереход → вернулся → Take кликабелен → **слышно запись** + музыка контекста играет.
2. Волна как была, так и есть.

## ИЗВЕСТНЫЕ ПАРИТИ-ГЭПЫ (НЕ в этом паке, для отчёта Ц3)
- «Solo»-режим превью: `ae.setInstrumentalVolume?.(0)` — no-op заглушка фасада → стемы НЕ глушатся при solo-прослушивании.
- Автопауза движка после конца тейка: `if (ae?.isPlaying)` — у фасада нет isPlaying → движок не ставится на паузу.
- Tempo-training тейки: `ae.setPlaybackRate` — no-op → rate не применяется.
