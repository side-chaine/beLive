# 🔎 RECON · «воркер» Студент-Педагог сессии (БРО «даже воркер есть»)
> Агент: explore (read-only). Дата: 2026-08-26. Вывод: НЕ чистый greenfield на уровне сигналинга/транспорта.

## НАЙДЕННЫЕ ФАЙЛЫ
**Браузерные Web Workers (src/):**
- `src/Rehearsal/workers/clock-scheduler.worker.ts` — планировщик таймеров по wall-clock для сессии Rehearsal (НЕ сигналинг).
- `src/utils/mp3-transcoder.worker.ts` — MP3-экспорт (НЕ сессия).

**WebRTC-стек сессии (src/Rehearsal/):**
- `services/signaling-client.ts` — WebSocket-клиент (`VITE_REHEARSAL_SIGNALING_URL`), роли `teacher`/`student`.
- `services/peer-connection.ts` — `RTCPeerConnection` (perfect negotiation, ICE, data-каналы control/trigger/clock-sync); `attachLocalTracks()` определён (:229) НО нигде не вызывается.
- `services/deep-link.service.ts` — `connectRehearsalSession()` WebRTC-bridge.
- `bridge/rehearsal-trigger.bridge.ts` — мост транспорта (teacher «захватывает» play/pause/seek → student), юзает `clockWorker`.
- Подключено: `src/App.tsx:187-191` (`?room=` deep-link), `src/main.tsx:40-41`.

**Backend Cloudflare Worker (сигналинг-релей):**
- `gateway/rehearsal/src/index.ts` — `/ws` (upgrade→Durable Object), `/rooms` (тикеты teacher/student).
- `gateway/rehearsal/src/do/rehearsal-room.do.ts` — `RehearsalRoomDO` релеит SDP/ICE между teacher/student.
- `gateway/rehearsal/src/tickets.ts` — HMAC-тикеты.

**Другой воркер (НЕ сессия):** `belive-feed-bot/` — catalog-feed CF Worker (внешний, REGISTRY: «НЕ миграция»).

## ВЕРДИКТ
- «Воркер сессии» в строгом смысле (браузерный сигналинг-воркер) — **НЕТ**; сигналинг = WebSocket-клиент. Но **backend CF Worker `gateway/rehearsal` реально релеит SDP/ICE** = тот самый «сигналинг-воркер» на сервере. Плюс браузерный `clock-scheduler.worker.ts` в сессии есть. Босс прав в двойном смысле, но смешивает понятия.
- **Модуль `Rehearsal` (Студент-Педагог) УЖЕ ЕСТЬ** в коде (сигналинг + транспорт + роли) — претензия «педагог-сессии НЕТ» опровергнута на уровне каркаса.

## GREENFIELD = что именно достраивать (рефы Мака 06–10)
- боковые видео-панели Педагог+Студент: `attachLocalTracks` НЕ вызывается, `onRemoteStream` нигде не подписан, `CameraPreview.tsx` рендерит локальную камеру но не делает `pc.attachLocalTracks`. **Видео-пиринг НЕ замкнут end-to-end.**
- доска (whiteboard), YouTube-слой (§13.7) — отдельные фичи поверх каркаса.

**Итог:** Босс «воркер есть» = технически верно (CF Worker-релей + clock-worker). Педагог-сессия НЕ greenfield-каркас, а greenfield-ВИДЕО+коллаб-слои (панели/доска/YouTube) поверх готового WebRTC/сигналинг-каркаса. Достаточно для старта S3 без build-from-scratch сигналинга.
