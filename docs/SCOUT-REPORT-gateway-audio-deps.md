# SCOUT-REPORT: Gateway/Worker/Rehearsal — Audio-зависимости для EngineV3 Phase B/C

**ДАТА:** 2026-07-18
**СКАУТ:** gateway-scout
**ДОКУМЕНТ:** RECON-PHASE-BC.md
**СТАТУС:** ⚠️ **DRIFT** (Rehearsal bridge критически зависит от V2)
**ПОКРЫТИЕ:** 95%

---

## 1. `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts` — 🔴 КРИТИЧЕСКАЯ ЗАВИСИМОСТЬ

### Характер связи: ПОЛНАЯ — каждый транспортный вызов через `window.audioEngine` (V2)

**36 обращений** к `window.audioEngine` в одном файле. Все — жёсткая связка с V2 API.

| Функция | Строки | V2 Методы | Что сломается в V3 |
|:--------|:------:|:----------|:-------------------|
| `hijackAudioTransport()` | 122-154 | `.play()`, `.pause()`, `.seekTo()`, `.setCurrentTime()` | V3 должен экспонировать те же имена методов, иначе bridge не патчит |
| `applyPlayPauseSeek()` | 215-226 | `ae?.seekTo?.()`, `ae?.pause?.()`, `ae?.playbackRate` | Student не получит play/pause/seek |
| `startDriftMonitoring()` | 260-303 | `ae?.getCurrentTime?.()`, `ae.audioContext`, `ae?.playbackRate` | Drift будет ≈0 (V3 не дрифтует) — не сломается, но бесполезно |
| `applySnapshot()` | 339-367 | `ae?.seekTo?.()`, `ae?.setPlaybackRate?.()`, `ae?.pause?.()`, `ae?.play()` | Snapshot не применится |
| `sendSnapshot()` | 371-384 | `ae?.getCurrentTime?.()`, `ae?.playbackRate` | Teacher отправит неверные/нулевые данные |
| `playWithWatchdog()` | 318-337 | `ae.play()`, `ae?.getCurrentTime?.()` | Play не сработает → watchdog вызовет retry → fallback |
| `updateStatusOverlay()` | 72-88 | `ae?.getCurrentTime?.()` | UI покажет 0 |
| `onVisibilityChange` | 32-45 | `ae?.getCurrentTime?.()`, `ae?.playbackRate` | Re-anchor сломается |

### Проблема в hijackAudioTransport (критично для Phase C)

```typescript
private hijackAudioTransport() {
  const ae = (window as any).audioEngine;   // ← V2 или V2Adapter
  const origPlay = ae.play.bind(ae);        // ← V2 метод
  ae.play = (...args) => {                  // ← monkey-patch
    const result = origPlay(...args);       // ← выполняет V2
    this.broadcastTransport({ type: 'play', ... });  // ← шлёт студенту
    return result;
  };
}
```

**Phase C проблема:** если V3Transport.play() реализован через AudioBufferSourceNode, hijackAudioTransport перехватит вызов, вызовет `origPlay` (который уже может указывать на V3Transport → OK, но если origPlay остался от V2 → V2 и V3 пойдут параллельно).

### Дрифт-мониторинг — жив, но бесполезен для V3

Код дрифт-чека (строки 260-303) сверяет `ae.getCurrentTime()` с `VirtualClock.getPosition()`. При V3:
- AudioBufferSourceNode идеально точен → driftMs ≈ 0
- `DriftCorrector.maybeCorrect()` ничего не делает при |drift| ≤ 40ms
- Никакого вреда, но код остаётся мёртвым грузом

---

## 2. `src/Rehearsal/services/signaling-client.ts` — 🟢 НУЛЕВАЯ ЗАВИСИМОСТЬ

**Вердикт: полностью безопасен.**

- Чистый WebSocket менеджер (55 строк)
- Ни одного аудио-метода, AudioContext, ArrayBuffer
- Использует только `VITE_REHEARSAL_SIGNALING_URL` из env
- Message типы: `sdp`, `ice`, `peer-joined`, `peer-left` — нейтральные

---

## 3. `src/Rehearsal/services/peer-connection.ts` — 🟢 НУЛЕВАЯ ЗАВИСИМОСТЬ

**Вердикт: полностью безопасен.**

- WebRTC PeerConnection менеджер (238 строк)
- Clock sync через `triggerChannel` (ping/pong) — сетевая синхронизация, не аудио
- `attachLocalTracks(MediaStream)` — микрофон/камера, не AudioEngine
- `onRemoteStream` — MediaStream колбэк, не V2
- Нет ни одного обращения к `window.audioEngine` или AudioContext

---

## 4. `gateway/` — 🟢 НУЛЕВАЯ АУДИО-ЗАВИСИМОСТЬ

### `gateway/src/index.ts` (main gateway)
- `/v1/align` — **MOCK-endpoint** (строки 329-391). Принимает `audioHash`, `audioSource`, но игнорирует их. Возвращает фейковые таймстемпы (`start: index*2, end: index*2+2`).
- **Будущее:** при переходе к реальному align потребуется загрузка аудио на сервер. Сейчас — нулевая зависимость.
- **Ephemeral tokens, rate limiting, OpenRouter proxy** — не связаны с аудио.

### `gateway/rehearsal/src/` (rehearsal gateway)
- `index.ts` (71 строка) — REST + WebSocket signaling handler
- `rehearsal-room.do.ts` (62 строки) — DurableObject, relay сообщений
- `tickets.ts` (34 строки) — HMAC ticket sign/verify
- **Абсолютно никаких аудио-зависимостей. Чистый signaling relay.**

---

## 5. `src/services/upload.service.ts` — 🟢 ТОЧКА ПЕРЕХВАТА ГОТОВА

### Чтение ArrayBuffer
```typescript
export async function readFileAsArrayBuffer(
  file: File, onProgress?: (pct: number) => void
): Promise<ArrayBuffer> {
  // FileReader.readAsArrayBuffer — стандартный Web API
  // Возвращает сырые байты, не декодирует аудио
}
```

### Схема потока данных:
```
File → readFileAsArrayBuffer() → ArrayBuffer → IDB (instrumentalData/vocalsData/stemsData)
                                                         ↓
                                              V3 читает из IDB напрямую
                                              (idb.service.ts — не frozen)
```

### Точки сохранения ArrayBuffer в IDB:
| Данные | Строки | Источник |
|:-------|:-------|:---------|
| `instrumentalData` | 399, 431 | `readFileAsArrayBuffer(session.instrumental!)` |
| `vocalsData` | 401-402, 433-434 | `readFileAsArrayBuffer(session.vocal)` |
| `stemsData` | 534-541 | `readFileAsArrayBuffer(file)` (из additionalStems) |
| MVSEP instrumental | 1101 | `instrumentalBlob.arrayBuffer()` |
| MVSEP vocals | 1103 | `vocalsBlob.arrayBuffer()` |
| MVSEP stems | 1112-1113 | `stemsMap.get(stemId).arrayBuffer()` |

### ✅ Возможность перехвата V3 Phase B

```typescript
// RECON описывает: V3DataInterceptor читает TrackRecord из IDB напрямую
// Это РАБОТАЕТ, потому что:
// 1. upload.service.ts сохраняет сырые ArrayBuffer → IDB (trackData.instrumentalData)
// 2. idb.service.ts не frozen → можно читать getTrack(id)
// 3. V3 может декодировать ArrayBuffer через ctx.decodeAudioData()
```

---

## 6. `sync-primitives.ts` — 🟢 БЕЗОПАСЕН (НО НЕ НУЖЕН)

| Класс | Роль | V3 Совместимость |
|:------|:-----|:-----------------|
| `VirtualClock` | Проекция позиции на `performance.now()` | ✅ Полностью нейтрален. Работает с любым `currentTime` |
| `DriftCorrector` | Exponential backoff seek при дрифте | 🟡 Не сломается (дрифт=0 → ничего не делает), но бесполезен |
| `PlaybackWatchdog` | Проверка монотонности после play() | 🟡 Не сломается (V3 currentTime монотонный), но бесполезен |
| `CommandCoalescer` | Debounce burst команд | ✅ Полностью нейтрален |

---

## 7. `rehearsal-session.store.ts` — 🟢 БЕЗОПАСЕН

Zustand store (44 строки). Поля: `role`, `roomId`, `connectionState`, `remoteStream`, `clockOffset`, `rtt`, `isResyncing`. Никаких аудио-ссылок.

---

## 8. `protocol.types.ts` — 🟢 БЕЗОПАСЕН

ControlPayload типы нейтральны:
```typescript
| { type: 'play'; mediaTime: number; wallClockTime: number }
| { type: 'pause'; mediaTime: number; wallClockTime: number }
| { type: 'seek'; mediaTime: number; wallClockTime: number }
```
Никаких ссылок на V2, AudioContext, AudioBuffer.

---

## 9. `.env.example` — ⚠️ ПРОБЕЛ

В `.env.example` отсутствует `VITE_REHEARSAL_SIGNALING_URL` (есть только в ручном `.env`). Пробел документации — новый разработчик не узнает, что нужно для rehearsal.

---

## РАСХОЖДЕНИЯ С RECON-PHASE-BC.md

### 1. RECON не упоминает rehearsal-trigger.bridge.ts (🔴 КРИТИЧНО)

**RECON Phase C (строка 414):** "TransportV3 перестаёт делегировать в V2"

**Проблема:** `rehearsal-trigger.bridge.ts` патчит `window.audioEngine.play/pause/seekTo/setCurrentTime` напрямую. Если TransportV3 перестаёт делегировать в V2, но не экспонирует те же имена методов на `window.audioEngine` — rehearsal-trigger:
- Не сможет перехватить play/pause/seek
- Не сможет broadcastTransport студенту
- Teacher и Student рассинхронизируются

**Что нужно добавить в RECON (Phase C):**
```
├── rehearsal-trigger.bridge.ts — monkey-patch V2 API
│   └── Требование: TransportV3 (или V2Adapter) сохраняет API:
│       window.audioEngine.play / pause / seekTo / setCurrentTime
│       window.audioEngine.getCurrentTime / playbackRate / audioContext
│       window.audioEngine.setPlaybackRate / setStemVolume
│       ← иначе rehearsal НЕ РАБОТАЕТ
```

### 2. RECON Phase D (Safety Net) не учитывает rehearsal

**RECON Phase D (строки 418-421):**
```
Если V3 падает — V2Adapter.gain размьютится
HTMLAudioElement currentTime синхронизируется с V3 time
```

**Проблема:** rehearsal-trigger перехватил `window.audioEngine.play` и шлёт broadcastTransport. При V3→V2 fallback:
- hijackAudioTransport снова укажет на V2 прогруженные методы
- Но monkey-patch может остаться от V3 → надо переустановить

**Что нужно добавить в RECON Phase D:**
```
└── При fallback V3→V2: 
    rehearse-trigger.hijackAudioTransport() должен перезапуститься,
    чтобы заново завернуть V2 методы в broadcastTransport
```

---

## ЧТО ДЕЛАТЬ

### 🔴 Критично (до Phase C)
- [ ] **Добавить в RECON** требование к TransportV3 экспонировать `play/pause/seekTo/getCurrentTime/setCurrentTime/playbackRate/setPlaybackRate` на `window.audioEngine`
- [ ] **Аудит** — нужно ли rehearsal для V3 вообще? Если rehearsal (репетиция) не требует V3, то bridge может продолжать использовать V2 параллельно

### 🟡 Важно
- [ ] В `.env.example` добавить `# VITE_REHEARSAL_SIGNALING_URL=ws://localhost:8787/ws` с комментарием

### 🟢 Мониторинг
- [ ] При Phase C тестировании: проверить rehearsal-trigger в связке V3 teacher → V3 student (полный цикл)
- [ ] `DriftCorrector` и `PlaybackWatchdog` можно отключить при V3 (performance micro-оптимизация, не срочно)

---

## ИТОГОВАЯ ТАБЛИЦА

| Компонент | V2 Зависимость | V3 Готовность | Риск |
|:----------|:--------------:|:-------------:|:----:|
| `rehearsal-trigger.bridge.ts` | 🔴 36 обращений к `window.audioEngine` | ❌ Полная перезапись требуется | **ВЫСОКИЙ** |
| `sync-primitives.ts` | 🟡 Бесполезен при V3 | ✅ Не сломается | НИЗКИЙ |
| `signaling-client.ts` | 🟢 Нет | ✅ Чист | НУЛЕВОЙ |
| `peer-connection.ts` | 🟢 Нет | ✅ Чист | НУЛЕВОЙ |
| `protocol.types.ts` | 🟢 Нет | ✅ Чист | НУЛЕВОЙ |
| `rehearsal-session.store.ts` | 🟢 Нет | ✅ Чист | НУЛЕВОЙ |
| `gateway/src/index.ts` | 🟢 Нет | ✅ Чист (align — mock) | НУЛЕВОЙ |
| `gateway/rehearsal/src/` | 🟢 Нет | ✅ Чист | НУЛЕВОЙ |
| `upload.service.ts` | 🟢 ArrayBuffer только | ✅ Точка перехвата готова | НУЛЕВОЙ |
| `clock-scheduler.worker.ts` | 🟢 Нет | ✅ Чист | НУЛЕВОЙ |

**ИТОГОВАЯ ОЦЕНКА:** Rehearsal bridge — единственный критический блокер. Остальной gateway/worker/upload стэк полностью безопасен для V3 Phase B/C.

---

## ТОКЕНОВ ПОТРАЧЕНО: ~28K (анализ 10 файлов, 2060+ строк кода)
