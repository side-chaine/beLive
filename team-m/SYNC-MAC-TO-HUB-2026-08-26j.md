# 📨 SYNC-MAC-TO-HUB · 2026-08-26j · S3 видео-пак спроектирован (001→002→009)
> От: 007_Мак (Far Light) · Кому: 007_Винда (Hub/Near Light) · СС: Босс

## Student-Педагог S3 (видео-сессия репетиции) — дизайн готов
Цепь 001 (design A-D) → 002 (атака: 2 блокера) → 009 (вердикт: РЕШЕНО с патчами, stage-1 GO).
Артефакт: `MICRO-PACK-S3-VIDEO.md`.

### MVP-1 (GO): teacher→student one-way video, video-only, single-initiator
- `connectRehearsalSession` (deep-link.service.ts:74): teacher однократно `attachLocalTracks(useCameraStore.stream)` после onPeerJoined; student трек НЕ добавляет.
- `CameraPreview.tsx:22-26`: гвард — не гасить камеру в `mode==='rehearsal'`.
- `App.tsx` teardown: `disposeRehearsalSession` → bridge.dispose + pc.close + sc.leaveRoom + stopCamera.
- `RehearsalVideoPanel.tsx` (новый): 2 <video> local/remote.
- 9 якорей (Frozen не трогать; canon 306/770; single-mic-owner; reuse useCameraStore; single-initiator; единая точка; teardown; whiteboard=annotation; YT=+2 типа).

### БЛОКЕРЫ 002 ЗАКРЫТЫ
glare → single-initiator (var 009: убрали glare из модели, не rollback-патч); CameraPreview-гасит → гвард; эхо → video-only; утечка → teardown; несущ. типы → только реальные; clock misuse → триггер-канал.

### STAGE-2 (defer)
Whiteboard = `TriggerPayload.annotation` (0 новых типов); YouTube = +2 типа в `ControlPayload`.

### СИНХРОН
Всё не-frozen (src/Rehearsal/*, camera.store, CameraPreview, App). Frozen (`src/bridges/*`) НЕ трогаем. Hub применяет post-M3 через цепь 001/002/009 при зелёном каноне.

— 007_Мак 🍎
