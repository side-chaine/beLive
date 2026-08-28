# MICRO-PACK-PC-PROGRAM-CAPTURE.md — v3 recording silent data-loss (P1 candidate)

> Автор пака: 007_Hub (Near Light / PC-сторона, зона audio-graph). Источник вердикта: Mac-007 stress-p2-verdict.md #2 (CONFIRMED), SYNC-MAC-TO-HUB-2026-08-25ab.
> Статус: **ЧЕРНОВИК, не применён** — ждёт GO Босса / Центра (новый scope, вне согласованной очереди R1→fallback→takes-audio→markers).
> Frozen-zone: НЕ затрагивает (правки в `js/audio-facade-v3.js` + docs; роутер уже опубликован в `window.__belive.monitorRouter`, main.tsx:185).

## Проблема (silent data-loss)
В v3-режиме (`VITE_ENGINE=v3`) запись выступления (`recording.store.ts:42`) зовёт
`ae?.getProgramCaptureStream?.() ?? null`. Фасад `js/audio-facade-v3.js` метода
`getProgramCaptureStream` **не имеет** → `undefined ?? null` → `audioStream = null` →
`MediaRecorder` пишет **только видео**, без единого warning'а. Юзер теряет аудио записи.

Цепочка (из вердикта Мака, подтверждено на диске):
- `recording.store.ts:42` — `ae?.getProgramCaptureStream?.() ?? null`
- v2: работает (frozen `AudioEngineV2.ts:2031`)
- v3: фасад `js/audio-facade-v3.js` — метода нет (файл 74 строки, только `attachProgramSource(){}` no-op)
- `router.captureStream` (MonitorRouter.ts:36,96,128) — program-capture bus FR-008, несёт music+vocals (pre-split, pre-delay), НО консьюмеров в фасаде 0

## Фикс (минимальный, по предложению Мака)
Достаточно одного метода в фасаде — вернуть `router.captureStream.stream`
(`MediaStreamAudioDestinationNode.stream` = программный аудиопоток). `window.__belive.monitorRouter`
уже опубликован (main.tsx:185), менять main.tsx НЕ нужно.

### Правка 1 — `js/audio-facade-v3.js`
Вставить после строки 68 (`attachProgramSource() {}, detachProgramSource() {},`):
```js
    // P1 (program-capture): вернуть program-capture bus из MonitorRouter (FR-008).
    // captureStream — MediaStreamAudioDestinationNode; .stream — программный аудиопоток (music+vocals).
    getProgramCaptureStream() {
      try {
        const r = (window.__belive && window.__belive.monitorRouter);
        return (r && r.captureStream && r.captureStream.stream) ? r.captureStream.stream : null;
      } catch { return null; }
    },
```

Больше правок НЕ требуется. `recording.store.ts` уже умеет брать этот стрим и пушить
аудио-треки (строки 63-65). В v3 ветка `ae?.microphone` в фасаде отсутствует → early-return
на :51 не срабатывает → запись стартует корректно с audioStream.

## Чего НЕ делаем (явные границы)
- **Mic в записи** — НЕ входит. `micInput` идёт только в `monitorStream` (MonitorRouter.ts:139→monitorStream),
  не в `captureStream`. Чтобы мик попал в запись, нужно `router.attachProgramSource(micStream)`
  (или подключить `micInput`→`_captureGain`) — отдельный пак, не часть минимального фикса.
  Отметить как follow-up, если нужно.
- main.tsx, MonitorRouter.ts, recording.store.ts — не трогаем.
- Frozen-файлы — не трогаем (см. FROZEN ZONE PROTOCOL).

## Верификация (Operator после применения)
1. `cd /home/nikit/projects/beLive && VITE_ENGINE=v3 npm run dev`
2. Открыть UI → Record выступление → остановить → скачать .webm
3. Проверить: файл содержит аудиодорожку (напр. `ffprobe` или воспроизвести — слышен music+vocals)
4. В консоли браузера: `window.audioEngine.getProgramCaptureStream()` возвращает MediaStream (не null)
   и `window.__belive.monitorRouter.captureStream.stream` — MediaStream с audio-треками.
5. Канон не должен пострадать: `npx tsc --noEmit 2>&1 | grep -c 'error TS'` = 313 (фасад — .js, вне tsc);
   `npm run verify:ci` — PARITY PASS (B1/SURFACE события не затронуты).

## Связи
- MIGRATION-HOLES.md коррекция #2 (Мак, ab) — подтверждено.
- Смежно: MICRO-PACK-PC-MICSOURCE-RACE.md (race acquire, вторично).
- Блокирует ли M3: да, как silent data-loss в v3-режиме — рекомендую fold в P1 до M3-GO.
