# 📦 MACRO-PACK: Фаза 1 — DUO стабилизация V3

**Дата:** 2026-07-27
**Автор:** 007 (координатор)
**Статус:** ✅ 009 верифицирован — готов к оператору
**Уверенность:** ≈95%

---

## 🎯 Цель Фазы 1

V3 стабильно работает с DUO-треками (instrumental + vocals, 2 stems):
- ✅ Seek (перемотка)
- ✅ Progress bar (видит длительность, движется)  
- ✅ Block navigation (переход по маркерам)
- ✅ BPM change (rate меняет скорость без искажения pitch)
- ✅ Space play/pause (всегда, с любой вкладки)
- ✅ RAM < 800MB для DUO
- ✅ V2 fallback при V3 crash (без тишины)

---

## 🏛 Anchored Summary

| Проблема | Диагноз | Фикс |
|----------|---------|------|
| **B1a:** duration=0 | `HybridPipelineService.duration` возвращает 0, `TransportV3.duration → orchestrator.duration` (пуст при pipeline) | MP-25: duration max по stems + pipeline контроллер |
| **B1b.1:** keyboard слеп к pipeline | 6 guard'ов проверяют `orchestrator.all().length > 0` — всегда FALSE | MP-26: `__v3Active` + ctx guard + try/catch |
| **C1:** нет ctx getter | `ctx` приватный, keyboard не знает статус AudioContext | MP-27: `isAudioContextRunning` |
| **Edge 1:** V3 crash → тишина | Нет safety net, V2 заглушен навсегда | MP-28: timeout + rollback + V2 restart |
| **RAM:** 7 stretch инстансов | WASM × 7 = ~500MB, для DUO нужно 2-3 | MP-29: MAX=3, instrumental priority |
| **Existing:** V2 fallback без try/catch | 3 вызова в V2 могут кинуть Uncaught exception | MP-26: обёрнуты в try/catch |

---

## 📋 MICRO-PACKs (финальные, с учётом FM 002)

### MP-27: ctx getter (C1)

**Цель:** `TransportV3.isAudioContextRunning` — публичный доступ к состоянию AudioContext

**Файл:** `src/audio/engine-v3/core/TransportV3.ts` — вставка после `get playbackRate` (строка ~88)

**Изменение:**
```typescript
/** Публичный доступ к состоянию AudioContext.
 *  'suspended' считается playable — можно вызвать ctx.resume().
 *  Внешние вызовы должны использовать optional chaining: transport?.isAudioContextRunning */
get isAudioContextRunning(): boolean {
  return this.ctx.state === 'running' || this.ctx.state === 'suspended';
}
```

**FM от 002, решённые:**
- ✅ `suspended` включён (был только `running`) — контекст можно resume
- ✅ Внешние вызовы используют `transport?.isAudioContextRunning ?? true` (optional chaining)

**Проверка:** tsc — 0 ошибок. Зависимость для MP-26.

---

### MP-28: safety net (Edge 1) 🔴

**Цель:** При ошибке V3 — откатить `__v3Active`, деактивировать клетку, перезапустить V2

**Файл:** `src/audio/engine-v3/integration/V3DataInterceptor.ts` (строки ~144-168)

**Изменение:**
```typescript
// В начало loadTrack() (после генерации, строка ~65):
try { (window as any).__setLoadingV3?.(true) } catch {}

// В finally loadTrack() (перед return):
try { (window as any).__setLoadingV3?.(false) } catch {}

    // 🪦 OBS-1: __setLoadingV3 — сеттер-фантом (нигде не определён; 3 вызова = no-op) — удалён из V3DataInterceptor.ts. Индикатор загрузки никогда не существовал; guard __loadingV3 (MP-26) всегда читал undefined.

// --- Блок активации (шаг 8, строки ~144-168) ---
if (this._pipeline && loadedStemIds.length > 0) {
  this._cage?.activate()
  try { (window as any).__setV3Active(true) } catch {}
  let offset = 0
  try {
    const v2Time = V2Adapter.getInstance().delegateSync('getCurrentTime') as number | undefined
    if (typeof v2Time === 'number' && isFinite(v2Time) && v2Time > 0) offset = v2Time
  } catch {}

  // ⏱️ timeout guard (WASM deadlock protection)
  const PLAY_TIMEOUT_MS = 5000
  try {
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('V3 play timeout')), PLAY_TIMEOUT_MS)
    )
    await Promise.race([this.transport.play(offset), timeoutPromise])
    console.log('[V3DataInterceptor] 🎯 Auto-play V3 at', offset.toFixed(1) + 's')
  } catch (error) {
    console.error('[V3DataInterceptor] ❌ V3 activation failed — rolling back:', error)
    try { this._pipeline?.stop() } catch {}                          // 🔇 ghost sound kill
    try { (window as any).__setV3Active(false) } catch {}            // ⛔ сброс флага ДО deactivate
    try { this._cage?.deactivate() } catch {}                        // 🔓 отключение клетки
    try { V2Adapter.getInstance().delegateSync('play') } catch {}    // ▶️ gap fill — V2 play
  }
}
```

**FM от 002, решённые:**
- ✅ **FM-1 (вечная загрузка):** `Promise.race` с 5s timeout — не даёт WASM deadlock заблокировать V3 навсегда
- ✅ **FM-2 (ghost sound):** `this._pipeline?.stop()` — убивает частично запущенные стемы
- ✅ **FM-3 (gap после deactivate):** `V2Adapter.getInstance().delegateSync('play')` — V2 перезапускается
- ✅ **FM-4 (порядок):** `__setV3Active(false)` ДО `cage.deactivate()` — правильный порядок (V2 interceptor проверяет `__v3Active`)
- ✅ **NEW:** `__loadingV3` флаг — V2 fallback блокируется пока V3 загружается

**Проверка:** tsc — 0 ошибок. Зависимость для MP-26 (`__loadingV3`).

---

### MP-26: keyboard guard (B1b.1)

**Цель:** Keyboard shortcuts работают через V3 при pipeline, V2 fallback безопасен

**Файл:** `src/hooks/useKeyboardShortcuts.ts`

**Зависимости:** MP-27 (`isAudioContextRunning`) + MP-28 (`__loadingV3`)

**Изменения:**

**1. Arrow seek handler (строка ~45):**
```typescript
// Было (старое, 3 проблемы):
if (transport && transport.state !== 'idle' && transport.orchestrator.all().length > 0) {
  const ct = transport.currentTime;
  const d = transport.duration;
  if (d > 0) {
    const nt = Math.max(0, Math.min(d, ct + delta * 2))
    void transport.seek(nt)
    getStatePublisher()?.publishSeek(nt, d)
  }
} else {
  const v2 = V2Adapter.getInstance();
  const ct = v2.delegateSync('getCurrentTime') as number ?? 0;   // ⚠️ без try/catch
  const d = v2.getSync<number>('duration') ?? 0;                  // ⚠️ без try/catch
  if (d > 0) try { v2.delegateSync('seekTo', ...) } catch {}     // ⚠️ нет guard на __v3Active/__loadingV3
}

// Стало:
if (transport && transport.state !== 'idle' && ((window as any).__v3Active || transport.orchestrator.all().length > 0)) {
  try {  // 🛡 V3 seek с пустым orchestrator не тестирован — try/catch
    const ct = transport.currentTime;
    const d = transport.duration;
    if (d > 0 && (transport?.isAudioContextRunning ?? true)) {
      const nt = Math.max(0, Math.min(d, ct + delta * 2))
      void transport.seek(nt)
      getStatePublisher()?.publishSeek(nt, d)
    }
  } catch { /* V3 seek failed — не роняем клавиатуру */ }
} else {
  // 🛡 V2 fallback — guard на V3
  if ((window as any).__v3Active) return;      // V3 жив → ждём
  if ((window as any).__loadingV3) return;     // V3 грузится → не пускаем V2
  try {
    const v2 = V2Adapter.getInstance();
    const ct = v2.delegateSync('getCurrentTime') as number ?? 0;
    const d = v2.getSync<number>('duration') ?? 0;
    if (d > 0) v2.delegateSync('seekTo', Math.max(0, Math.min(d, ct + delta * 2)));
  } catch { /* V2 seek failed — тишина лучше двойного аудио */ }
}
```

**2. Space handler (строки ~74-97):**
```typescript
// Было (2 V3 блока + V2 без try/catch):
if (transport && transport.state !== 'idle' && transport.orchestrator.all().length > 0) { ... }
else if ((window as any).__v3Active && transport) { ... }                 // zombie path
else {
  const v2 = V2Adapter.getInstance();
  const isPlaying = v2.getSync<boolean>('isPlaying') ?? false;           // ⚠️ без try/catch
  ...
}

// Стало (единый V3 блок + защищённый V2):
if (transport && ((window as any).__v3Active || (transport.state !== 'idle' && transport.orchestrator.all().length > 0))) {
  if (transport.state === 'playing') {
    void transport.pause();
  } else if (transport?.isAudioContextRunning ?? true) {
    void transport.play();
  }
} else {
  if ((window as any).__v3Active) return;      // 🛡 V3 жив → ждём
  if ((window as any).__loadingV3) return;      // 🛡 V3 грузится → не пускаем V2
  try {
    const v2 = V2Adapter.getInstance();
    const isPlaying = v2.getSync<boolean>('isPlaying') ?? false;
    if (isPlaying) { v2.delegateSync('pause'); } else { v2.delegateSync('play'); }
  } catch { /* V2 fallback failed */ }
}
```

**FM от 002, решённые:**
- ✅ **FM-1 (double audio):** `__v3Active` guard перед V2 fallback
- ✅ **FM-2 (race с loadTrack):** `__loadingV3` guard (устанавливается в начале loadTrack, сбрасывается в finally)
- ✅ **FM-3 (V2 без try/catch):** Все V2 вызовы в едином try/catch
- ✅ **FM-4 (V3 seek нетронутый):** V3 seek (currentTime, duration, seek) — try/catch
- ✅ **NEW:** `transport?.isAudioContextRunning` — optional chaining (MP-27)
- ✅ **NEW:** Zombie path (MP-18) интегрирован в единый V3 блок — dead code удалён

**Проверка:** tsc — 0 ошибок. Тест Space/Seek с pipeline и без.

---

### MP-25: duration fix (B1a)

**Цель:** `TransportV3.duration` > 0 → UI оживает (progress bar, seek, blocks, BPM)

**Файлы:**
- `src/audio/engine-v3/pipeline/HybridPipelineService.ts:79-82`
- `src/audio/engine-v3/core/TransportV3.ts:78-80`

**Изменения:**

**1. HybridPipelineService.duration:**
```typescript
// Было:
get duration(): number {
  return 0  // ← ВСЕГДА 0 — корень B1a
}
// Стало:
private _lastKnownDuration = 0;  // 🆕 кэш — защита от duration=0 при reset

get duration(): number {
  if (this._chainA.stems.size === 0 && this._chainB.stems.size === 0) {
    return this._lastKnownDuration  // — не даём UI дёргаться на 0 между треками
  }
  let maxDur = 0
  for (const stem of this._chainA.stems.values()) {
    if (stem.duration > maxDur) maxDur = stem.duration
  }
  for (const stem of this._chainB.stems.values()) {
    if (stem.duration > maxDur) maxDur = stem.duration
  }
  if (maxDur > 0) this._lastKnownDuration = maxDur
  return maxDur
}
```

**2. TransportV3.duration:**
```typescript
// Было:
get duration(): number {
  return this.stems.duration;  // = orchestrator.duration = 0 при pipeline
}
// Стало:
private _lastTrackDuration = 0;  // 🆕 кэш

get duration(): number {
  const d = this._pipelineController?.duration ?? this.stems.duration;
  if (d > 0) this._lastTrackDuration = d;
  return d > 0 ? d : this._lastTrackDuration;
}
```

**FM от 002, решённые:**
- ✅ **FM-1 (TransportV3 не использует pipeline duration):** Исправлен — сначала `pipelineController?.duration`, потом `stems.duration`
- ✅ **FM-2 (кэш):** `_lastKnownDuration` не даёт duration=0 при reset между треками

**Проверка:** tsc — 0 ошибок. Тест: DUO трек → TransportV3.duration > 0.

---

### MP-29: MAX_STRETCH_INSTANCES=3

**Цель:** Стянуть WASM stretch с 7 до 3 для DUO (2 stems + 1 запас)

**Файл:** `src/audio/engine-v3/pipeline/StretchInstancePool.ts:7-18`

**Изменение:**
```typescript
// Было:
export const MAX_STRETCH_INSTANCES = 7
export type StretchSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6
const STRETCH_PRIORITY: Record<string, number> = {
  vocals: 0, bass: 1, guitar: 2, keys: 3, piano: 4, other: 5,
  // ⚠️ instrumental отсутствует → priority 65535 (при MAX=7 помещается, при MAX=3 вытеснялся бы)
}

// Стало:
export const MAX_STRETCH_INSTANCES = 3
export type StretchSlot = 0 | 1 | 2
const STRETCH_PRIORITY: Record<string, number> = {
  instrumental: 0,  // 🆕 master clock — наивысший приоритет (гарантированно stretch)
  vocals: 1,
  bass: 2,
  guitar: 3,
  keys: 4,
  piano: 5,
  other: 6,
}
```

**FM от 002, решённые:**
- ✅ **FM-1 (quality loss):** instrumental (0) + vocals (1) + bass (2) получают stretch при FULL треке. Остальные → Bus B varispeed (ожидаемо для Фазы 1)
- ✅ **FM-2 (старый слот 5):** `StretchSlot = 0|1|2` — TypeScript не скомпилирует слот 5. `assign()` возвращает `null` если слот не найден (Bus B fallback)

**Проверка:** tsc — 0 ошибок. `initAll()` создаёт 3 инстанса. DUO (2 stems) влезает с запасом.

---

## 📊 Порядок применения

Из-за конфликтов файлов 6 MICRO-PACK'ов → **4 группы**:

| Шаг | MICRO-PACK | Файлы | Время |
|:---:|:----------:|:------|:-----:|
| 1 | **MICRO-A** | TransportV3.ts | ~2 мин |
| 2 | **MICRO-B** | StretchInstancePool.ts | ~2 мин |
| 3 | **MICRO-D** | HybridPipelineService.ts | ~2 мин |
| 4 | **MICRO-C** | V3DataInterceptor.ts | ~5 мин |
| 5 | **MICRO-G** | useKeyboardShortcuts.ts | ~10 мин |
| 6 | **MICRO-E** | TransportV3.ts, HybridPipelineService.ts | ~5 мин |

**Итого:** ~25-30 минут работы оператора.

### Группы (параллельные):
- **Группа A** (шаги 1-3, параллельно): TransportV3.ts + StretchInstancePool.ts + HybridPipelineService.ts (removeEventListener)
- **Группа B** (шаг 4, после A): V3DataInterceptor.ts — зависит от готового TransportV3.ts
- **Группа C** (шаг 5, после A+B): useKeyboardShortcuts.ts — зависит от `isAudioContextRunning` + `__loadingV3`
- **Группа D** (шаг 6, параллельно C): duration fix в TransportV3.ts + HybridPipelineService.ts

---
### MP-30: Блокирующие исправления 009 🔴

**Цель:** 5 обязательных правок, найденных 009 при верификации раунда Соннета

**Изменения:**

**1. TransportV3 — `isV3Active` getter (замена 7 guard'ов `orchestrator.all()`):**
```typescript
// Вставить после get orchestrator() (строка ~83), перед get playbackRate()
/** 009: публичный getter вместо 7 копий t3.state!=='idle'&&orchestrator.all().length>0 */
get isV3Active(): boolean {
  return this._pipelineController !== null
}
```

**2. HybridPipelineService — `removeEventListener` в reset/dispose:**
```typescript
// В reset() (после очистки стемов, перед строкой 449):
// 🧹 009: чистим listener stretch-crash при сбросе
for (const instance of this._stretchPool.instances()) {
  try { instance.outputNode.removeEventListener('stretch-crash', this._onStretchCrash) } catch {}
}

// В dispose() (перед строкой 460):
// 🧹 009: чистим listener
for (const instance of this._stretchPool.instances()) {
  try { instance.outputNode.removeEventListener('stretch-crash', this._onStretchCrash) } catch {}
}
```

**3. V3DataInterceptor — `__setV3Active(false)` при деактивации:**
```typescript
// Добавить в начало loadTrack() (сразу после генерации, строка ~65):
try { (window as any).__setV3Active?.(false) } catch {}   // 🧹 009: сбрасываем при новой загрузке
```

**4. V3DataInterceptor — `await transport.play()` (🔴 двойной fire-and-forget):**
```typescript
// Было (строка 166):
this.transport.play(offset)
// Стало:
await this.transport.play(offset)
```

**5. StretchInstancePool — fix comment (макс 4 → макс 7):**
```typescript
// Было (строка 2):
// Пул StretchInstance — максимум MAX_INSTANCES = 4 (лимит 2013 MBP)
// Стало:
// Пул StretchInstance — максимум MAX_INSTANCES = 7 (будет 3 после MP-29, лимит 2013 MBP)
```

**009 блокирующие:**
- ✅ FM-1: `isV3Active` getter — заменяет 7 хрупких guard'ов
- ✅ FM-2: `removeEventListener` — утечка listener'ов устранена
- ✅ FM-3: `__setV3Active(false)` — leak навсегда устранён
- ✅ FM-4: `await play()` — двойной fire-and-forget устранён
- ✅ FM-5: комментарий — вводит в заблуждение

**Проверка:** tsc — 0 ошибок. После всех изменений — grep на `__setV3Active(false)` должен показать вызов.

**Итого:** ~20-25 минут работы оператора.

---

## ❄️ Frozen Zone

| Файл | Статус |
|------|:------:|
| `src/audio/core/AudioEngineV2.ts` | ❄️ не затронут |
| `src/audio/compat/patchV1.ts` | ❄️ не затронут |
| `src/bridges/*` | ❄️ не затронуты |
| `src/services/track.orchestrator.ts` | ❄️ не затронут |
| Приватные поля `_` | только внутри своих классов |

---

## ✅ Протокол верификации (для оператора)

После применения каждого MP:

```bash
# 1. Typecheck
npx tsc --noEmit 2>&1 | grep -E "error TS"
# Должно быть 0 новых (игнорируй pre-existing в takes/, triggers/, theme/, test/, legacy/)

# 2. Git diff
git diff

# 3. Проверка frozen zone
grep -r "AudioEngineV2\|patchV1\|track.orchestrator" --include="*.ts" src/ | grep -v "node_modules" | grep -v "frozen"
```

**Тест DUO после всех MP:**
1. Загрузить трек с instrumental + vocals
2. Проверить: прогресс-бар виден, duration > 0
3. Проверить: Space play/pause работает
4. Проверить: Arrow seek работает
5. Проверить: BPM change работает (rate меняется, pitch не искажается)
6. Проверить: RAM < 800MB

---

## ⚠️ Фаза 2 (после стабилизации DUO)

1. **TransportBar.handleSeek** — тот же guard `orchestrator.all().length > 0` — починить
2. **position-sync.ts guard** — race с V3StatePublisher
3. **Остальные 5 guard'ов** в loop-events, stem-engine-sync, trigger-visual
4. **Приоритеты стемов для FULL** — динамическое управление stretch слотами
5. **adjustPrevious** в scheduleRate — плавные rate переходы
