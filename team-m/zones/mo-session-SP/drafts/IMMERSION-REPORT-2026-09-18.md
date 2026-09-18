# IMMERSION-REPORT · MO-session-SP «Сессия-Хранитель» · 2026-09-18

> **Собрано 007** (разведчик; агент-тип `MO-session-SP` в диспетчере отсутствует — погружение выполнено 007 в рамках своего мандата: разведка + упаковка, **без правки src/**).
> Предыдущий артефакт: `IMMERSION-REPORT-2026-09-17.md` (рекогносцировка 004 — LOC по 5 файлам не замерены, H-5 живость не верифицирована). Этот отчёт закрывает обе дыры.
> Основа: HANDOFF-MO-session-SP.md (12.09), PRODUCT-VISION-MAP §C-5, HEAD `d14c897` (18.09 00:50).

## §0 СТОП-ЗАМЕЧАНИЕ: «каркас» — это неточный ярлык

Хэндоф и §C-5 называют состояние «база заложена / каркасы (аудит H-5 003_2)». **По живому коду это сильное занижение.** Транспортный слой сессии реализован не «каркасно», а практически полностью — с perfect negotiation, clock-sync, drift-коррекцией и recovery. Реальная недоделка не «каркас», а три конкретные дыры (§4). Главная из них: **медиа-плоскость не подключена вообще** — ходят только данные.

## §1 СЕМЬЯ — src/Rehearsal/ (8 файлов, все LOC перемерены 18.09)

| файл | LOC | MAP-класс | роль |
|---|---|---|---|
| `store/rehearsal-session.store.ts` | 44 | L3-ядро | zustand-стор: role/roomId/connectionState/remoteStream/clockOffset/rtt/isResyncing/requiresUserInteraction |
| `services/signaling-client.ts` | 55 | L3-ядро | WS-клиент: env→URL, 4 колбека, экспоненциальный реконнект, код 4001 |
| `services/peer-connection.ts` | 238 | L3-ядро | RTCPeerConnection: perfect negotiation, 2 DataChannel, clock-sync, recovery |
| `services/deep-link.service.ts` | 100 | L3-ядро | ?room=&role=&ticket= → сессия + HMAC self-sign билета |
| `bridge/rehearsal-trigger.bridge.ts` | 424 | L3-ядро | СО-мост: приём/отправка, drift-мониторинг, hijack аудио-транспорта, status-плашка |
| `bridge/sync-primitives.ts` | 129 | стык | Watchdog / DriftCorrector / VirtualClock / CommandCoalescer |
| `types/protocol.types.ts` | 62 | стык | Envelope v1, ReplayGuard, EnvelopeSender, safeParse, isStale |
| `workers/clock-scheduler.worker.ts` | 20 | стык | wall-clock планировщик apply'ев |
| **итого src/Rehearsal/** | **1072** | | |

**Бэкенд-провод №1 (вне src/, вне MAP-167, волна backend):**

| файл | LOC | роль |
|---|---|---|
| `gateway/rehearsal/src/index.ts` | 71 | /ws → DO, POST /rooms (JWT-verify, выпуск 2 билетов, TTL 6ч), CORS=app.mybelive.com |
| `gateway/rehearsal/src/do/rehearsal-room.do.ts` | 62 | единственный DO: verify билета, замещение 4001, Room full 429, relay, 16KB-кап |
| `gateway/rehearsal/src/tickets.ts` | 34 | HMAC-SHA256 sign/verify билетов |
| **итого бэкенд** | **167** | |

> Расхождение с LAYERS-REGISTRY-003 «rehearsal-DO 105»: фактически 167 (index 71 + do 62 + tickets 34). Цифра 105 учитывала не все три файла.

## §2 H-5-КАРТА ЖИВОСТИ (главная задача №1б)

Вердикт по каждому из пяти узлов H-5: **жив / частично / мёртв** — с file:line доказательствами.

### ① signaling-client — 🟢 ЖИВ (полностью)
- env→URL: `signaling-client.ts:21-23` (`VITE_REHEARSAL_SIGNALING_URL`, throw если нет)
- 4 сообщения: sdp/ice/peer-joined/peer-left (`:1-5`, диспетч `:30-37`)
- Реконнект: экспоненциальный 2^n до 15с (`:46-50`); код `4001` = «replaced» → без реконнекта (`:41`)
- Инстанцирование: 2 места — `deep-link.service.ts:77` (продакшен-путь), `main.tsx:783` (тест-хук)

### ② rehearsal-DO (бэкенд) — 🟢 ЖИВ, деплоится
- Маршруты: `/ws` (`index.ts:30-35`), `POST /rooms` (`:37-46`), CORS-префлайт (`:24-26`)
- DO: билет-верификация + соответствие room/role (`do:24-27`); замещение одноимённого пира `4001` (`do:29-32`); Room full `429` (`:33`); relay (`:56-58`); 16KB-кап (`:43`)
- Деплой: `.github/workflows/deploy-rehearsal.yml` (push по `gateway/rehearsal/**`, секреты `REHEARSAL_TICKET_SECRET`+`JWT_SECRET`); последний коммит бэкенда `1515461` (14.07 — force redeploy), жив на `wss://belive-rehearsal.nikitosss007.workers.dev/ws` (deploy.yml:42)
- ⚠️ **Персист-дыра подтверждена:** `gateway/rehearsal/migrations/` не существует; состояние DO = in-memory `peers Map` (`do:10`) — рестарт воркера = смерть всех сессий

### ③ peer-connection — 🟢 ЖИВ (data plane) / 🔴 МЁРТВ (media plane)
Data plane реализован плотно:
- Perfect negotiation: polite=student (`:43`), collision/ignoreOffer (`:80-82`)
- 2 канала: `control` (ordered, reliable) и `trigger` (unordered, maxRetransmits 0) (`:100-104`)
- Clock-sync: 5-раундная калибровка + 4с heartbeat (`:138-152`), rolling window 32 сэмпла, best-of-3 по RTT (`:160-174`), sweep протухших ping'ов (`:170-173`)
- Recovery: restartIce → 6с grace → hardReset с полным сбросом clock-state (`:179-227`)

🔴 **Media plane мёртв — главное открытие погружения:**
- `attachLocalTracks()` (`:229-231`) — **0 вызовов** во всём репо (подтверждено полным grep)
- `onRemoteStream` (`:34`, `:55`) — **0 потребителей**: объявлен и эмитится в `track`, но никто не подписан
- `setRemoteStream` в сторе (`store:17,39`) — **никем не вызывается**
- Нет ни одного `getUserMedia/getDisplayMedia` на путях Rehearsal (mic живёт только в `audio/engine-v3/services/MicSourceV3.ts` и recording/camera сторах — вне сессии)
- **Вывод:** «Видео-мост Rehearsal» (включая naming в STAGE-0-FACTS/BRIEFING) реально = **только data-channel-мост**. Ни аудио, ни видео между пирами не ходит. `role==='teacher' && pc.createDataChannels()` (`deep-link.service.ts:86`, `main.tsx:794`) поднимает каналы — и только.

### ④ rehearsal-trigger.bridge — 🟢 ЖИВ (самый плотный файл семьи, 424 LOC)
- Приём: replay-guard → stale-чек → dispatch 7 payload-типов (`:165-219`)
- Немедленный apply play/pause/seek в обход воркера (для слабых телефонов, `:222-233`)
- Drift-мониторинг: 2с интервал, getOutputTimestamp cross-check, sanity-reanchor >10с, телеметрия (`:267-310`)
- Teacher-side hijack `window.audioEngine.play/pause/seekTo/setCurrentTime` с guard от двойной обёртки и restore в dispose (`:125-161`, `:407-423`) — коммит `5e9e5c4` (BRG-2)
- Status-плашка `#bl-rehearsal-status` + тап-to-play (обход autoplay-блока) (`:53-95`)
- visibility: hide → стоп мониторинга, visible → sync-request + переякор (`:34-48`) — фикс живого теста 07.07

### ⑤ deep-link.service — 🟢 ЖИВ, но с дырой безопасности
- Сценарий «ссылка → сессия»: parse URL → self-sign билета, если он «сырой секрет» (`:43-58`) → auth-проверка/skip → `beLiveSwitchMode('rehearsal')` (`:69`) → возврат параметров
- Бутстрап сессии: role/roomId в стор → SC+PCM+Bridge → `sc.connect()` → глобалы `__pc/__sc/__bridge` (`:74-96`)
- 🔴 **Self-sign билета на клиенте = дыра:** `signClientTicket()` (`:31-41`) HMAC-подписывает билет **секретом, который лежит в клиентском бандле**. Любой может выпустить валидный билет на любую комнату. Производственный путь — `POST /rooms` за серверным билетом (index.ts:37-46) — есть, но deep-link путь идёт мимо него, если тикет передан «сырым».
- 🔴 **Хардкод секрета-заглушки:** `main.tsx:822` = `'test-rehearsal-secret-2026'` (phone-режим). Если совпадает с deploy-секретом — вход в любую комнату.

## §3 ДВА БУТСТРАПА = РИСК РАСХОЖДЕНИЯ (новое, мимо хэндофа)

Ядро поднимается **двумя разными путями**, дублирующими логику:

| | Путь A — продакшен | Путь B — тест-хук |
|---|---|---|
| Вход | `App.tsx:178-183` → `handleRehearsalDeepLink` → `connectRehearsalSession` (`deep-link.service:74`) | `main.tsx:782-807` `window.__testRehearsal` + phone-автоконнект (`:817-830`) |
| Колбейки | onOpen/onClose/onPeerJoined/onClockSynced | те же **плюс** `onConnectionStateChange` и DEV-логи |
| Маркировка | боевая | «временный тестовый хук (Фаза 2: +bridge, **Phase 3 удалить**)» (`main.tsx:781`) |

Расхождение уже есть: в пути A `onConnectionStateChange` не подписан; глобалы `__pc/__sc/__bridge` дублируются (`deep-link:93-95` и `main:803-805`). Любой фикс в одном пути забывается в другом. **До оживления пути должны быть схлопнуты в один** (это работа Owners/Оператора через цепь — не 007).

## §4 ИТОГОВАЯ ЖИВОСТЬ И ЧТО МЕШАЕТ ОЖИВЛЕНИЮ

**Живо и плотно:** signaling (55) + DO (167) + peer data-plane (238) + trigger-мост (424) + протокол (62) + синхро-примитивы (129) + воркер (20) = **~1195 LOC рабочего кода**. Это не «база заложена», это ~90% транспортного слоя.

**Факторы остановки / риски (по убыванию):**
1. 🔴 **Media plane мёртв** (§2③) — сессия не передаёт звук/картинку. Это и есть реальное «оживление на V3».
2. 🔴 **Безопасность билетов**: client-side self-sign (`deep-link:31-41`) + хардкод-секрет (`main.tsx:822`) — продакшен-сценарий компрометирует комнаты.
3. 🟡 **Два бутстрапа** (§3) — дублирование wiring, тест-хук помечен «Phase 3 удалить».
4. 🟡 **Ноль автотестов**: ни один тест в репо не импортирует `Rehearsal/(services|bridge|store|types|workers)` (grep подтвержден). Вся валидация — живые тесты на телефонах (комментарии в коде: 07.07, Galaxy J8). Для V3-оживления нужен хотя бы smoke-слой.
5. 🟡 **Env-дыра** (давний долг, NIKITA-DEBT-BOARD): `VITE_REHEARSAL_SIGNALING_URL` есть только в `deploy.yml:42` + `.env` — **нет в `.env.example`** → throw на любой не-CI сборке.
6. 🟡 **DO без персиста**: `migrations/` отсутствует, состояние in-memory (`do:10`).
7. ⚪ **`rehearsal-trigger-writer` — нет на main** (проверено оба пути: `src/Rehearsal/bridge/` и `src/foundation/event-bus/wrappers/` — 7 wrappers, rehearsal среди них отсутствует). Инцидент-основание хэндофа (3) снято: track-divergence-риск = 0, диверсифицировать нечего.

## §5 ВЕРИФИКАЦИЯ / ЧТО НЕ ДЕЛАЛОСЬ

- Канон (tsc/vitest) **не перемерялся** — погружение не правит код, канон для отчёта не нужен. Актуальный замер у HEAD не подтверждён; последняя цифра из коммита `5e9e5c4`: tsc=290 d0, vitest 808/69 (это устаревшая метка, не канон-снапшот 181/824).
- Frozen-статус: `frozen-manifest.json` **не существует** на диске; в прочитанных файлах `src/Rehearsal/*` ❄️-маркеров нет → семейство **не frozen**, рекогносцировка безопасна. Никакие файлы не правились.

## §6 ОСТАЁТСЯ ПО ХЭНДОФУ (не выполнено 007 — вне этого dispatched-объёма)

- LOG в SHARED-REGISTRY через `scripts/registry-push.py` — многоместная запись (мост /mnt/c/…), требует протокола diff→merge→insert→cp→git; 007 не делал без подтверждения владельца.
- Строка `TRIGGERS/003.md` «семья session-SP закрыта: N L3-единиц» — не писалась.
- Задачи №2 (карта стыков: mode.store/B01-HUB/usage) и №3 (санитарный хвост 48ч) — не начинались (за рамками «погружение + H-5-карта»).
