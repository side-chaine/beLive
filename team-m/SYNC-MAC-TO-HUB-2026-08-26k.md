# SYNC-MAC-TO-HUB-2026-08-26k · S3 Student-Педагог — РЕАЛИЗАЦИЯ (patch)

**От:** 007_Мак (Far Light) → **Кому:** 007_Винда (Hub)
**Повод:** GO Босса на зоны Мака (проверка реестра → исполнение). S3 MVP-1 спроектирован (26j) и теперь РЕАЛИЗОВАН как patch.

## Что сделано
Реализован MVP-1 Student-Педагог видео-сеанса (teacher→student ОДНОСТОРОННЕЕ видео), закрывающий оба блокера 002:
- **glare** → single-initiator: только teacher аттачит video-трек + создаёт data-каналы (deep-link `onPeerJoined`); student никогда не инициирует оффер.
- **CameraPreview kills camera** → teacher-камера НЕЗАВИСИМА от `camera.store` (owner = сессия, свой `getUserMedia`); `CameraPreview` (global, глушит camera по `mode!=='live'`) её не трогает. Student камеру не открывает (recvonly) → self-kill исключён.

## Файлы (patch `MICRO-PACK-S3-VIDEO-IMPL.patch`, `git apply`)
1. `src/components/S3VideoPanel.tsx` — NEW. Рендер: teacher = локальный поток (store.localStream), student = remote (store.remoteStream). Монтируется в `App.tsx` в блоке `mode==='rehearsal'`.
2. `src/Rehearsal/services/deep-link.service.ts` — `pc.onRemoteStream`→`store.setRemoteStream`; `sc.onPeerJoined`(teacher) = `createDataChannels()` + `startTeacherCamera()`; `sc.onClose` останавливает локальные треки; добавлены `activePc`/`activeLocalStream` + `attachRehearsalLocalVideo`.
3. `src/Rehearsal/store/rehearsal-session.store.ts` — `+localStream` / `+setLocalStream`.
4. `src/App.tsx` — import + `<S3VideoPanel />` в rehearsal-блоке.

## Почему patch, а не коммит src
Mac node нет → канон 306/772 Mac не проверит. По dual-machine правилу код в V3-finish_2 — только после PC-прогона канона. Hub применяет `git apply team-m/MICRO-PACK-S3-VIDEO-IMPL.patch`, прогоняет `tsc`/`vitest`/`verify:ci`, и коммитит (не пушит). Frozen-файлы НЕ тронуты (только safe src).

## Верификация (чек-лист Hub)
- [ ] `git apply team-m/MICRO-PACK-S3-VIDEO-IMPL.patch` — чисто.
- [ ] канон 306/772 + PARITY PASS.
- [ ] manual: teacher открывает `?room=...&role=teacher`, student — `&role=student`; student видит video teacher; teacher не видит свою камеру убитой при входе/выходе.
- [ ] stage-2 (whiteboard-annotation / YouTube +2 типа) — отложено по вердикту 009.

**Коммит Мака:** только patch + этот лист + правка REGISTRY Mac-side. Src-правки — в патче (исполняет Hub).
