# 431-MICRO-PACK-F1 — MIC-SOURCE-V3: acquisition-слой + takes-ветка + error-UX

**Мандат:** Ц3, приёмка 430 (главное решение §3): F-1 СЕЙЧАС, впереди E4-A/E2. Комплаенс: авторизованный M4-скоуп (mic-уши — предикат M3-GO), hotfix по живой боли. Frozen не затрагивается.

## АРХИТЕКТУРНЫЕ РЕШЕНИЯ (от 007, для протокола)

- **D1 — acquisition-слой, НЕ pipeline** (поправка Ц3 принята): мик-стрим живёт ВЫШЕ плейбек-DSP. Новый класс `MicSourceV3` в `engine-v3/services/`. Владеет стримом, refcounted acquire/release.
- **D2 — зона №2 НЕ трогаем:** `core/MicrophoneManager` НЕ импортируется и НЕ изменяется (два касания C11+№15; третье — только с флагом Ц3). Parity по ключу `mic:deviceId` — чтение/запись localStorage напрямую.
- **D3 — владение при dispose:** потребители (takes.recorder) вызывают `release()` в cleanupNodes → при refCount=0 треки останавливаются (dispose-tracks, скоуп Ц3).
- **D4 — таксономия ошибок:** `permission-denied` | `no-device` | `stream-fail` (+`mic-source-unavailable` внутренний). Видимый UX = бейдж у REC-кластера (обещанный «тост» из кода становится правдой — как error-path настоящей фичи).

---

## EDIT 1 — НОВЫЙ ФАЙЛ `src/audio/engine-v3/services/MicSourceV3.ts`

Создать файл целиком:

```ts
// src/audio/engine-v3/services/MicSourceV3.ts
// F-1 (431): Acquisition-слой микрофона для V3.
// Мик-стрим живёт ВЫШЕ плейбек-pipeline (pipeline = playback-DSP).
// Владелец стрима — MicSourceV3; потребители берут stream через acquire()/release().
// Parity с C11: ключ localStorage 'mic:deviceId', exact-constraint + auto-fallback.
// R9: {echoCancellation:false, noiseSuppression:false, autoGainControl:false}.
// F-2 (будущее): монитор-маршрут stream → router.micInput; гейт G14 — БЕЗ дефолтного _micDelay.

export type MicErrorKind = 'permission-denied' | 'no-device' | 'stream-fail';

export class MicAcquireError extends Error {
  constructor(public readonly kind: MicErrorKind, public readonly original?: unknown) {
    super(`[MicSourceV3] acquire failed: ${kind}`);
  }
}

const MIC_DEVICE_KEY = 'mic:deviceId'; // parity C11 (MicrophoneManager — файл не импортируем, зона №2)

export class MicSourceV3 {
  private _stream: MediaStream | null = null;
  private _refCount = 0;
  private _deviceId = '';

  constructor() {
    try { this._deviceId = localStorage.getItem(MIC_DEVICE_KEY) ?? ''; } catch { /* private mode */ }
  }

  get deviceId(): string { return this._deviceId; }
  get isActive(): boolean { return this._stream !== null; }

  /** Взять стрим (refcounted). Повторный вызов возвращает тот же живой стрим. */
  async acquire(): Promise<MediaStream> {
    this._refCount++;
    if (this._stream) return this._stream;
    try {
      this._stream = await this._open();
      return this._stream;
    } catch (e) {
      this._refCount--;
      throw e;
    }
  }

  /** Отдать стрим. При refCount=0 — dispose-tracks. */
  release(): void {
    this._refCount = Math.max(0, this._refCount - 1);
    if (this._refCount === 0) this._stop();
  }

  /** Выбор устройства (parity C11). Персистит; при живом стриме переоткрывает на новом. */
  async setDevice(id: string): Promise<void> {
    if (this._deviceId === id) return;
    this._deviceId = id;
    try { localStorage.setItem(MIC_DEVICE_KEY, id); } catch { /* private mode */ }
    if (!this._stream) return;
    // Живой стрим: перезапуск на новом устройстве (refCount сохраняем).
    // Если переоткрытие упало — стрим остаётся закрыт до следующего acquire (degraded, честный отказ).
    this._stop();
    this._stream = await this._open();
  }

  private _stop(): void {
    this._stream?.getTracks().forEach(t => t.stop()); // dispose-tracks
    this._stream = null;
  }

  private async _open(): Promise<MediaStream> {
    const base: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }; // R9
    const constraints: MediaTrackConstraints = { ...base };
    if (this._deviceId) constraints.deviceId = { exact: this._deviceId }; // C11 parity: exact-constraint
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: constraints });
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw new MicAcquireError('permission-denied', e);
      // C11 parity: auto-fallback на дефолтное устройство при битом exact-constraint
      if (this._deviceId && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: { ...base } });
        } catch (e2: any) { throw this._classify(e2); }
      }
      throw this._classify(e);
    }
  }

  private _classify(e: any): MicAcquireError {
    if (e instanceof MicAcquireError) return e;
    if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') return new MicAcquireError('no-device', e);
    return new MicAcquireError('stream-fail', e);
  }
}
```

---

## EDIT 2 — `src/audio/engine-v3/pipeline/HybridPipelineService.ts`: публичный ctx

После строки 122 (`get inputNode(): AudioNode { return this._chainA.mergeGain }`) добавить:

```ts
  /** F-1 (431): публичный AudioContext пайплайна (analyser-тапы мик-стрима; F-2 монитор-маршрут) */
  get ctx(): AudioContext { return this._ctx; }
```

---

## EDIT 3 — `src/main.tsx`: регистрация micSource

3а. К существующим импортам вверху файла добавить:

```ts
import { MicSourceV3 } from './audio/engine-v3/services/MicSourceV3';
```

3б. После строки `;(window as any).__belive.pipeline = pipeline` (~:173) добавить:

```ts
        ;(window as any).__belive.micSource = (window as any).__belive.micSource ?? new MicSourceV3()
```

---

## EDIT 4 — `src/takes/takes.recorder.ts`: v3-ветка acquisition + lastError

4а. В поля класса (после `private _mimeType: string = '';`, ~:39) добавить:

```ts
  private _lastError: string | null = null;
  private _v3Owned = false;
```

4б. Рядом с геттером `analyser` (~:42) добавить:

```ts
  /** F-1 (431): причина последнего неудачного start() ('permission-denied'|'no-device'|'stream-fail'|'mic-source-unavailable') */
  get lastError(): string | null {
    return this._lastError;
  }
```

4в. Голову `start()` (строки 60–78: от `const ae = ...` до `if (!stream) throw ...`) заменить целиком:

```ts
  async start(): Promise<void> {
    const ae = (window as any).audioEngine;
    if (!ae) throw new Error('AudioEngine not available');
    const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
    let stream: MediaStream | null = null;

    if (engineMode === 'v3') {
      // F-1 (431): acquisition через MicSourceV3 (мик ВЫШЕ плейбек-pipeline)
      const src = (window as any).__belive?.micSource;
      if (!src) {
        this._lastError = 'mic-source-unavailable';
        console.error('[TakesRecorder] __belive.micSource недоступен');
        return;
      }
      try {
        stream = await src.acquire();
        this._v3Owned = true;
      } catch (e: any) {
        this._lastError = e?.kind ?? 'stream-fail';
        console.error(`[TakesRecorder] mic acquire failed: ${this._lastError}`);
        return;
      }
    } else {
      // Ensure mic is enabled (this also routes to output — headphones required)
      if (!ae.microphone?.enabled) {
        await ae.enableMicrophone();
      }
      // Get raw mic stream (unaffected by volume slider)
      stream = ae.getMicrophoneStream?.('raw') ?? ae.microphone?.getStream?.('raw');
    }

    if (!stream) throw new Error('Raw mic stream not available');
    this._lastError = null;
```

(Далее по телу start() без изменений до конца метода.)

4г. В `start()` строку контекста анализатора:

```ts
    const ctx: AudioContext = ae.audioContext ?? ae._audioContext;
```
заменить на:

```ts
    const ctx: AudioContext = engineMode === 'v3'
      ? ((window as any).__belive?.pipeline?.ctx ?? ae.audioContext ?? ae._audioContext)
      : (ae.audioContext ?? ae._audioContext);
```

4д. В `cleanupNodes()` (перед `this._sourceNode = null;`) добавить:

```ts
    if (this._v3Owned) {
      try { (window as any).__belive?.micSource?.release(); } catch (_) {}
      this._v3Owned = false;
    }
```

---

## EDIT 5 — `src/takes/components/TakesControlStrip.tsx`: гейты → error-path

5а. После строки 64 (`const recorderRef = React.useRef<TakesRecorder | null>(null);`) добавить:

```ts
  const [micError, setMicError] = React.useState<string | null>(null);
```

5б. САЙТ 1 (видимый REC, ~:167-172). Блок:

```ts
      if (ae.microphone && !ae.microphone.enabled) {
        const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
        if (engineMode === 'v3') {
          // UI: явное «недоступно в V3-режиме» (тост/бейдж), НЕ бросать, НЕ вызывать
          return;
        }
        await ae.enableMicrophone();
      }
```
заменить на:

```ts
      if (ae.microphone && !ae.microphone.enabled) {
        const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
        if (engineMode !== 'v3') await ae.enableMicrophone(); // v3: acquisition внутри TakesRecorder.start() (F-1 431)
      }
```

5в. САЙТ 1, после `await recorder.start();` (~:186, перед `const recorderInitMs = ...`) вставить:

```ts
      if (recorder.lastError) {
        setMicError(recorder.lastError);
        recorderRef.current = null;
        console.error(`[Takes] запись не начата: микрофон (${recorder.lastError})`);
        return; // abort: pre-roll/playback не начинаем
      }
      setMicError(null);
```

5г. САЙТ 2 (сценарный FIRST WINDOW BRANCH, ~:548-553). Блок:

```ts
      if (ae.microphone && !ae.microphone.enabled) {
        const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
        if (engineMode === 'v3') {
          // UI: явное «недоступно в V3-режиме» (тост/бейдж), НЕ бросать, НЕ вызывать
          return;
        }
        await ae.enableMicrophone();
      }
```
заменить на:

```ts
      if (ae.microphone && !ae.microphone.enabled) {
        const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
        if (engineMode !== 'v3') await ae.enableMicrophone(); // v3: acquisition внутри TakesRecorder.start() (F-1 431)
      }
```

5д. САЙТ 2, после `await recorder.start();` (~:556, перед комментарием `// DO NOT expose analyser yet`) вставить:

```ts
      if (recorder.lastError) {
        setMicError(recorder.lastError);
        recorderRef.current = null;
        console.error(`[Takes] сценарная запись не начата: микрофон (${recorder.lastError})`);
        return;
      }
```

5е. БЕЙДЖ. В JSX после открывающего `<div style={{ position: 'absolute', left: '50%', ... }}>` hero-кластера (~:858-865, перед комментарием `{/* Neutral layout */}`) вставить:

```tsx
        {micError && (
          <div style={{
            position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)',
            padding: '3px 12px', borderRadius: '10px',
            background: 'rgba(220,60,60,0.92)', color: '#fff',
            fontSize: '12px', whiteSpace: 'nowrap', zIndex: 10,
          }}>
            🎤 {micError === 'permission-denied' ? 'Доступ к микрофону запрещён'
              : micError === 'no-device' ? 'Микрофон не найден'
              : micError === 'mic-source-unavailable' ? 'Аудио-движок ещё инициализируется'
              : 'Микрофон недоступен'}
          </div>
        )}
```

---

## EDIT 6 — `src/components/MixerPanel.tsx`: разблокировка select в v3

6а. Строку `disabled={engineMode === 'v3'}` (~:307) УДАЛИТЬ.

6б. `value={micDeviceId}` (~:306) заменить на:

```tsx
            value={engineMode === 'v3' ? (() => { try { return localStorage.getItem('mic:deviceId') ?? '' } catch { return '' } })() : micDeviceId}
```

6в. onChange (~:309-315) заменить целиком:

```tsx
            onChange={async (e) => {
              const em = import.meta.env.VITE_ENGINE ?? 'v2';
              if (em === 'v3') {
                try { await (window as any).__belive?.micSource?.setDevice(e.target.value); }
                catch (err) { console.warn('[MicSelect] v3 setDevice failed:', err); }
                return;
              }
              const ae = (window as any).audioEngine;
              if (!ae?.microphone?.setDeviceId) return;
              try { await ae.microphone.setDeviceId(e.target.value); }
              catch (err) { console.warn('[MicSelect] failed:', err); }
            }}
```

---

## ВЕРИФИКАЦИЯ (формула А4, неизменна)
1. `npx tsc --noEmit` → 314; diff error sets vs HEAD — IDENTICAL (0 новых).
2. `npx vitest run` → 749 passed / 2 failed / 751 total (failed — предсуществующие legacy, см. леджер).
3. Отчёт Оператора: точные числа + список затронутых файлов.

## ВНЕ СКОУПА F-1 (следующие шаги по карте Ц3)
- F-2: монитор-маршрут stream→router.micInput, первый setMicEnabled, самомониторинг; **гейт G14**: проводной режим — БЕЗ дефолтного `_micDelay` 120мс; реестр-дельта обязательна (F5).
- Canvas-заглушка волны (косметика; бейдж уже даёт видимый UX) — решение Ц3.
- Сценарии сами по себе — подтвердятся live-тестом после F-1 (они завязаны на запись через сайт 2).
- `core/MicrophoneManager` — зона №2, не тронут (D2).
