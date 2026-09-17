# SCOUT-PACK · RUN-2 «ХОЛЛ» · стык Холл↔Сессия + прогресс
**2026-09-18 · скаут (explore) по диспатчу 007 · всё file:line, код не тронут**

## §1 СЕМЬЯ src/Rehearsal/ — 9 файлов, 1072 LOC, ЖИВА на main (мертва на SB)

| файл | LOC | экспорт | живые вызовы |
|------|-----|---------|--------------|
| rehearsal-session.store.ts | 44 | `useRehearsalSessionStore`, `SessionConnectionState` | main.tsx:38,787,790,799 · App.tsx:180 · deep-link.service.ts:76,89,91 |
| signaling-client.ts | 55 | `SignalingClient` | main.tsx:35,783 · deep-link.service.ts:3,77 |
| peer-connection.ts | 238 | `PeerConnectionManager`, `Role` | main.tsx:36,784 · deep-link.service.ts:4,78 · `attachLocalTracks`:229 объявлен, 0 вызовов |
| deep-link.service.ts | 100 | `signClientTicket`, `handleRehearsalDeepLink`, `connectRehearsalSession`, `clearRehearsalDeepLink`, `RehearsalLinkParams` | App.tsx:70,178-180 · main.tsx:824 (dynamic) |
| rehearsal-trigger.bridge.ts | 424 | `RehearsalTriggerBridge` | main.tsx:37,801 · deep-link.service.ts:5,91 |
| sync-primitives.ts | 129 | `PlaybackWatchdog`, `DriftCorrector`, `VirtualClock`, `CommandCoalescer` | только bridge:9 (вне семьи 0) |
| protocol.types.ts | 62 | `PROTOCOL_VERSION`, `MAX_MESSAGE_BYTES`, `STALE_AFTER_MS`, `Envelope`, `ControlPayload`, `TriggerPayload`, `ReplayGuard`, `safeParseEnvelope`, `isStale` | только bridge:2-4 |
| clock-scheduler.worker.ts | 20 | нет (self.onmessage) | создан как Worker URL в bridge:99 |
| .gitkeep | 0 | — | — |

**Ни один .stories.* файл Rehearsal не упоминает.**

## §2 EVENT-BUS — КАНАЛА СЕССИИ НЕТ
- Каналы (types.ts:6-13): **Audio, Track, Catalog, Sync, UI, Practice**. Rehearsal/session/peer — НЕТ.
- `Practice → 'practice:state-changed'` (types.ts:58-63) — ЖИВ, wrapper channels/practice.ts:5, facade.ts:57.
- «События rehearsal» идут не через канал, а через `options.signal` (facade.ts:205-212) — это не шина, обход.

## §3 DEEP-LINK ?room= — ЖИВ, ведёт НЕ в Холл
- App.tsx:177-183 → `handleRehearsalDeepLink()` на маунте (useEffect [], жив)
- deep-link.service.ts:43-71: парсит `?room=&role=&ticket=` (:17-26); ticket без `.` → клиентский HMAC `signClientTicket` (:31-41, **secret «test-rehearsal-secret-2026» в плейнтексте, main.tsx:822**); пишет sessionStorage `bl-rehearsal-pending`; `history.replaceState` (:52); `setSurface('app')`/skipAuth (:62-67); `beLiveSwitchMode('rehearsal')` (:69)
- `connectRehearsalSession` (:74-96): role/roomId в стор (:76) → SignalingClient+PeerConnectionManager+RehearsalTriggerBridge (:77-91) → `sc.connect()` (:92) → глобалы `window.__pc/__sc/__bridge` (:93-95)
- Тест-хук: main.tsx:817-830 (`?phone=1&room=`), помечен «Phase 3 удалить»

## §4 GATEWAY/REHEARSAL — ЖИВ
- index.ts:22-50: `GET /ws?room=` → DO upgrade (:30-35) · `POST /rooms` → JWT (HMAC-SHA256 :52-70) → `{roomId, teacherTicket, studentTicket, expiresAt}` (:37-46) · OPTIONS CORS · остальное 404
- do/rehearsal-room.do.ts:9-62 `RehearsalRoomDO`: verifyTicket (:24), close 4001 «replaced» (:30), 429 «Room full» (:33), релей между 2 пирами (:56-61)
- tickets.ts:13-19 sign / :21-34 verify. wrangler.toml: DO binding `REHEARSAL_ROOM`, SQLite, compat 2026-07-01

## §5 ГЛАВНЫЙ ВЫВОД: ХОЛЛ↔СЕССИЯ ПРОВОДА НЕТ
UserRoom.tsx (292) **не импортирует и не читает Rehearsal/сессию**. «Статистика» = заглушка «скоро...» (UserRoom.tsx:273-278). Единственное соединение — URL-уровень (App.tsx:177-183, deep-link, не из UI Холла). **0 компонентов с session-стейтом в .tsx**, кроме App.tsx:70.

→ Ось «СВЯЗЬ» RUN-2 = строить провод с нуля. Грунт готов: deep-link + билеты + DO + стор есть.
→ **SECURITY-ФАКТ:** secret `test-rehearsal-secret-2026` в плейнтексте (main.tsx:822) — кандидат на токенизацию (не блокер RUN-2, пометка в реестр).
