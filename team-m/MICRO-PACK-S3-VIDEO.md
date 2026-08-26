# 🎓 MICRO-PACK-S3-VIDEO · Student-Педагог видео-сессия · design (001→002→009)
> Far: 007_Мак. Применяет: Hub(007) post-M3 (не-frozen зона). Frozen: НЕ трогать. Вердикт 009: РЕШЕНО (с патчами), stage-1 GO.

## КОНТЕКСТ (рекон)
`Rehearsal`-каркас УЖЕ есть (WebRTC + CF Worker `gateway/rehearsal` релей SDP/ICE + `clock-scheduler.worker.ts`). Видео НЕ замкнуто: `attachLocalTracks` не вызывается, `onRemoteStream` не подписан. Greenfield = ТОЛЬКО видео+коллаб-слой поверх готового.

## MVP-1 (GO) · teacher→student one-way video, video-only, single-initiator
Устраняет glare не rollback-патчем, а **детерминированной односторонней negotiation** (var 009): видео-трек добавляет ровно одна сторона (teacher), ровно раз, после onPeerJoined. Glare математически невозможен.

### Файлы (все НЕ-frozen)
- `src/Rehearsal/services/deep-link.service.ts` (`connectRehearsalSession`, :74) — после `sc.onPeerJoined` для teacher: однократно `await useCameraStore.getState().startCamera()` + `pc.attachLocalTracks(useCameraStore.getState().stream)`. Student-сторона трек НЕ добавляет.
- `src/components/CameraPreview.tsx` (:22-26) — **ГВАРД**: не гасить камеру в `mode==='rehearsal'` (`if (mode!=='live' && mode!=='rehearsal') stopCamera()`). Иначе гасит видео Пака A.
- `src/App.tsx` (:187-194 useEffect) — **teardown**: `return () => disposeRehearsalSession()` → `bridge.dispose()` + `pc.close()` + `sc.leaveRoom()` + `useCameraStore.stopCamera()`.
- Новый `src/components/RehearsalVideoPanel.tsx` — 2 `<video>`: local (`useCameraStore.stream`, `muted`), remote (`useRehearsalSessionStore.remoteStream`); `srcObject` через useEffect. Монтаж в `App.tsx:235-242` (блок `mode==='rehearsal'`).
- `pc.onRemoteStream` (`peer-connection.ts:34`) → `useRehearsalSessionStore.setRemoteStream(stream)`.

### ЯКОРЯ (9, обязательны)
1. Frozen-стоп: `src/bridges/*` не трогать; `src/Rehearsal/bridge`, `camera.store.ts` — НЕ frozen, правим.
2. Канон: tsc ≤306, vitest=772, `verify:ci` PARITY PASS (без прогона — не «готово»).
3. single-mic-owner (MicSourceV3): НЕ трогаем; video-only ⇒ мик НЕ аттачим.
4. reuse `useCameraStore` (video-only) — не плодим второй стрим.
5. `peer-connection.ts` — single-initiator (teacher-only add), rollback НЕ нужен. Решение зафиксировано.
6. Единая точка `connectRehearsalSession` — весь lifecycle отсюда.
7. teardown обязателен (bridge.dispose + pc.close + sc.leaveRoom + stopCamera).
8. whiteboard (stage-2) = `TriggerPayload.annotation` (`protocol.types.ts:24-26`), 0 новых типов, trigger-канал НЕ clock-scheduler.
9. YT (stage-2) = +2 типа в `ControlPayload`; clock-scheduler.worker НЕ для доски.

### РИСКИ (закрыты патчами 002/009)
- Glare → single-initiator (var 009). ✅
- CameraPreview гасит камеру → гвард. ✅
- Эхо → video-only (мик не аттачим). ✅
- Утечка → teardown. ✅
- Несущ. типы protocol → только реальные (`annotation` есть, YT +2). ✅
- clock misuse для доски → доска по trigger-каналу. ✅

## STAGE-2 (ОТЛОЖЕНО, defer)
- **Whiteboard:** `TriggerPayload.annotation` (points, draw|clear; +color/width) по trigger-каналу → `RehearsalWhiteboard.tsx`. 0 новых типов.
- **YouTube:** +`yt-load`/`yt-control` (play/pause/seek+mediaTime) в `ControlPayload`; `RehearsalYouTube.tsx`; teacher-hijack = явный send/apply (НЕ monkeypatch window.audioEngine).

## ВАРИАНТ (никто не предложил, 009)
Glare решается не rollback-патчем в perfect-negotiation, а **удалением glare из модели**: один инициатор, одно добавление трека → `negotiationneeded` один раз детерминированно. Самый тяжёлый блокер 002 снимается одной строкой-гвардом.

## СТАТУС
Дизайн готов (001→002→009). Применение — post-M3, Hub через цепь. stage-1 GO при (a) single-initiator (b) CameraPreview-гвард (c) teardown + зелёный канон.
