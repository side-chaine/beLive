# MICRO-PACK-FALLBACK · DRAFT (design-only) · 2026-08-25 · агент: Ф001 Со-Архитектор

**Основание:** team-m/MIGRATION-HOLES.md `main.tsx:154-193,364-366` (P1, стресс-коррекция #1 подтвердила CONFIRMED P1: «retry 0, путь восстановления отсутствует целиком») · docs/PLAN-v3.3-CANONICAL.md §4 (B-slice) / §7 (№16 fallback-деградация: «принять + индикатор backlog»). Соседний пак MICRO-PACK-TAKES-AUDIO-draft.md НЕ затрагивает этот dead-zone — конфликтов нет.
**Скоуп:** dead-zone fallback при boot-init V3 (HybridPipelineService.init()). Ноль правок кода — только дизайн.
**Ключевая находка (механика немоты):** `index.html:397` грузит `js/audio-facade-v3.js` БЕЗУСЛОВНО — он перезаписывает `window.audioEngine` no-op фасадом. Реальный V2-движок теряется. Звук в v3-режиме даёт ТОЛЬКО pipeline (через getCurrentTime-фасад и transport). Если `HybridPipelineService.init()` в `main.tsx:162` падает, boot-IIFE ловит и **молча** возвращает (`main.tsx:194-196`) — `__v3Active` не выставляется, pipeline=null. Далее `V3DataInterceptor.loadTrack` (gate `if (this._pipeline && loadedStemIds.length>0)` @ :152) НИКОГДА не вызывает `__setV3Active(true)` и не активирует клетку → `track-loaded` публикуется (V3DataInterceptor:217/223), но `window.audioEngine` = no-op фасад → приложение НЕМОЕ до reload, retry=0.

**Решение (два слоя, оба обязательны):** (а) retry/re-entry boot-init с экспоненциальным backoff; (б) при исчерпании — НЕ молча: восстановить реальный V2-движок через фасад + fail-state в store (Operator, единый writer) + toast юзеру.

---

## §1 Решения (file:line было → будет)

### 1.1 Молчаливый fail boot-init (`main.tsx:158-197`, особенно catch :194-196)

**Было:** `(async () => { try { ... await pipeline.init() ... } catch (e) { console.warn('[AETHER] ❌ HybridPipelineService init deferred — varispeed fallback:', e) } })()` — при fail НЕТ retry, НЕТ восстановления V2, НЕТ уведомления. `__setV3Active` (writer @ `main.tsx:152-155`) не зовётся с false даже явно.

**Будет:** вынести init в `initV3Pipeline(attempt)` с backoff (3 попытки: 1s/2s/4s). При исчерпании — `handleV3BootFailure()`:
- `useAudioStore.getState().setV3BootStatus({ status:'failed', attempts:3, at:Date.now() })` — **Operator**: единый writer (как `__setV3Active` для `__v3Active`), не шпарим `window.__v3BootFailed` напрямую;
- `useNotifyStore.getState().pushToast({ level:'error', title:'V3 engine unavailable', message:'Degraded audio — reload to restore V3.' })` — юзер НЕ молча;
- `(window as any).__restoreV2Engine?.()` — фасад отдаёт сохранённый реальный V2-движок обратно в `window.audioEngine` (см. §1.3);
- `(window as any).__setV3Active?.(false)` — гарантируем флаг в false (H4.1-гард V2 не блокирует).

После успешного retry wiring (`router.connect`, `transport.attachPipeline`, `interceptor.attachPipeline`, экспозиция `__belive`) остаётся дословно как сейчас `:166-193`. Вложенный catch wiring сохраняется (deferred, не fatal).

### 1.2 Флаг/состояние boot — `src/stores/audio.store.ts:29-55`

**Было:** `audio.store.ts` не содержит статуса V3-boot. Нет сигнала для UI/метрик.

**Будет:** добавить поле `v3BootStatus: { status:'ok'|'failed'; attempts:number; at:number }` + action `setV3BootStatus` (Operator-action, единственный writer). Читается `metrics`/crash-UI для индикатора (план §7 №16 «индикатор backlog»).

### 1.3 Восстановление V2-движка — `js/audio-facade-v3.js:7-17` (actionable-поверхность, НЕ frozen)

**Было:** `(function () { const facade = {...}; ... window.audioEngine = facade })()` — оригинальный `window.audioEngine` (V2) теряется безвозвратно.

**Будет (аддитивно, НЕ меняет no-op-поведение методов):** до создания `facade` захватить `const _v2Engine = window.audioEngine` и экспонировать `window.__restoreV2Engine = () => { window.audioEngine = _v2Engine }`. Это даёт `handleV3BootFailure` путь к РЕАЛЬНОМУ звуку (V2) вместо no-op. БЕЗ этого пункта fallback невозможен (фасад необратим).

### 1.4 Уведомление юзеру — `src/stores/notify.store.ts:3-16`

**Было:** `notify.store.ts` только hash arrival/seen — нет toast.

**Будет:** расширить `NotifyState` полем `pushToast(t: { level:'info'|'warn'|'error'; title:string; message:string })` + action. Честный, НЕ молчаливый fail (план §7 №16).

**Оператор-дисциплина («Вёдра применяют через Operator»):** любое состояние деградации коммитится ТОЛЬКО через store-action (Operator) — `setV3BootStatus` (audio.store) и `pushToast` (notify.store). Прямые `window.__*`-флаги НЕ используются как источник правды, только `__setV3Active`/`__restoreV2Engine` как управляющие хуки (единственный writer каждого, как сейчас). Это исключает рассинхрон сторов и двойные writers.

---

## §2 Diff-набросок

### §2.1 `js/audio-facade-v3.js` (вставить после `(function () {`, до `const facade = {`)
```js
(function () {
  // MICRO-PACK-FALLBACK: сохранить реальный V2-движок ДО перезаписи no-op фасадом
  const _v2Engine = (window as any).audioEngine
  ;(window as any).__restoreV2Engine = function () { (window as any).audioEngine = _v2Engine }
  const facade = {
    // ... без изменений ...
```

### §2.2 `src/main.tsx` (замена IIFE :157-197)
```ts
// 🟢 Phase F: HybridPipelineService — retry/re-entry + explicit fail-state
const initV3Pipeline = async (attempt = 0): Promise<HybridPipelineService | null> => {
  const MAX = 3
  const BACKOFF = [1000, 2000, 4000]
  try {
    const { HybridPipelineService } = await import('./audio/engine-v3/pipeline/HybridPipelineService')
    const pipeline = new HybridPipelineService(ctx)
    await pipeline.init()
    return pipeline
  } catch (e) {
    if (attempt < MAX) {
      console.warn(`[AETHER] ❌ HybridPipelineService init failed (${attempt + 1}/${MAX}) — retry in ${BACKOFF[attempt]}ms:`, e)
      await new Promise(r => setTimeout(r, BACKOFF[attempt]))
      return initV3Pipeline(attempt + 1)
    }
    return null
  }
}

const handleV3BootFailure = () => {
  // Operator: единый writer состояния (как __setV3Active для __v3Active)
  useAudioStore.getState().setV3BootStatus({ status: 'failed', attempts: 3, at: Date.now() })
  useNotifyStore.getState().pushToast({
    level: 'error',
    title: 'V3 engine unavailable',
    message: 'Audio running in degraded mode — reload to restore V3.',
  })
  // восстанавливаем реальный V2-движок (фасад был no-op → иначе немота)
  ;(window as any).__restoreV2Engine?.()
  ;(window as any).__setV3Active?.(false)
  console.error('[AETHER] ❌ V3 boot failed after retries — V2 restored, user notified')
}

;(async () => {
  const pipeline = await initV3Pipeline()
  if (!pipeline) { handleV3BootFailure(); return }
  try {
    // существующий wiring :166-193 дословно
    if (router) {
      pipeline.outputNode.connect(router.programInput)
      pipeline.setVocalHallTarget(router.vocalHallInput)
      pipeline.setVMixCenterTarget(router.vmixCenterIn)
      pipeline.setVMixVocalTarget(router.vmixVocalIn)
    }
    transport.attachPipeline(pipeline)
    interceptor.attachPipeline(pipeline)
    ;(window as any).__belive = (window as any).__belive || {}
    ;(window as any).__belive.pipeline = pipeline
    ;(window as any).__belive.micSource = (window as any).__belive.micSource ?? new MicSourceV3()
    ;(window as any).__belive.monitorRouter = router
    ;(window as any).__belive.stemOrchestrator = transport.orchestrator
    ;(window as any).__belive.stemOrchestrator?.setVMixCenterTap?.(router?.vmixCenterIn)
    if (deviceManager) { ;(window as any).__belive.deviceManager = deviceManager }
    console.log('[AETHER] ✅ HybridPipelineService Phase F — ACTIVE')
  } catch (e) {
    console.warn('[AETHER] ❌ HybridPipelineService wiring deferred — varispeed fallback:', e)
  }
})()
```

*Импорты:* `useAudioStore` и `useNotifyStore` добавить в существующий блок импортов main.tsx (рядом с другими stores).

### §2.3 `src/stores/audio.store.ts` (после `setMicEnabled`, до закрытия)
```ts
  v3BootStatus: { status: 'ok' | 'failed'; attempts: number; at: number },
  setV3BootStatus: (s: { status: 'ok' | 'failed'; attempts: number; at: number }) => set({ v3BootStatus: s }),
```

### §2.4 `src/stores/notify.store.ts` (расширить интерфейс + state)
```ts
interface ToastItem { level: 'info' | 'warn' | 'error'; title: string; message: string }
interface NotifyState {
  lastHash: string; arrivedAt: number; seenAt: number;
  setArrival: (hash: string) => void;
  markSeen: () => void;
  pushToast: (t: ToastItem) => void;   // MICRO-PACK-FALLBACK
}
// в create: pushToast: (t) => set({ /* примонтировать к UI-toast через существующий Renderer */ })
```

---

## §3 Тесты

Новый `src/__tests__/micro-pack-fallback.test.ts` (unit, моки `HybridPipelineService`, `window.audioEngine`, stores):
1. `initV3Pipeline: 1-я попытка падает → 2-я успешна → возвращает pipeline (retry сработал, backoff вызван)`.
2. `initV3Pipeline: все 3 падают → возвращает null; handleV3BootFailure → setV3BootStatus({status:'failed'}) вызван ровно 1 раз`.
3. `handleV3BootFailure: pushToast уровня 'error' вызван; __restoreV2Engine вызван → window.audioEngine === сохранённый _v2Engine (реальный V2, НЕ фасад)`.
4. `handleV3BootFailure: __setV3Active(false) вызван (H4.1 не блокирует V2)`.
5. `счастливый путь: initV3Pipeline успех → handleV3BootFailure НЕ зовётся, setV3BootStatus НЕ 'failed'`.

Регресс-тест существующего: `bootAether` продолжает публиковать trackUrls (main.tsx:350-365) при успехе — без изменений.

---

## §4 Risks + Frozen-check

| # | Риск | P | I | Митигация |
|---|---|---|---|---|
| R1 | Boot-retry оттягивает первый звук на до 7с (1+2+4s) при гарантированном фейле | MED | LOW | Backoff ограничен 3 попытками; toast сразу после исчерпания; V2 restored → звук есть. Не блокируем UI (async, НЕ await на старте) |
| R2 | `__restoreV2Engine` отдаёт V2, но клетка/V2Interceptor могут быть в несогласованном состоянии | LOW | LOW | При boot-fail клетка НЕ активировалась (V3DataInterceptor:155 не вызван) → V2 чист. `__setV3Active(false)` снимает H4.1-блок |
| R3 | Фасад уже частично использован другими модулями до fail (getCurrentTime) | LOW | LOW | Восстановление возвращает оригинал ДО любой реальной игры (boot ещё не завершён) |
| R4 | Двойной writer статуса (кто-то ещё пишет window.__v3BootFailed) | LOW | LOW | Operator-дисциплина §1.4: единственный writer — `setV3BootStatus`; прямых `window.__*`-флагов нет |
| R5 | `pushToast` нет UI-Renderer → toast не виден | MED | LOW | Использовать существующий toast-pipe (проверить в §5); fallback — console.error уже есть |

**Frozen-Zone — подтверждение: паком НЕ задевается.**
- `AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts` — правок нет.
- `V3DataInterceptor.ts` — правок нет (восстановление целиком на boot-слое main.tsx + фасад-restore-хук).
- `_-поля` извне не читаются; `_v2Engine` живёт только внутри IIFE фасада.
- Все правки: `main.tsx` (refactor boot-IIFE), `js/audio-facade-v3.js` (аддитивный restore-хук), `audio.store.ts` + `notify.store.ts` (по одному полю/action). Frozen-нарушений: 0.

---

## §5 Verify-чеклист (Near Light)

Автотест:
1. Канон: `tsc 313 / vitest passed 769+N, 0 новых ошибок, 0 новых skip` (формулировка А4).
2. `micro-pack-fallback.test.ts` зелёный (§3, кейсы 1-5).

Консоль/состояние (VITE_ENGINE=v3, искусственно бросить ошибку в `HybridPipelineService.init`):
3. Retry-логи: `[AETHER] ❌ ... init failed (1/3) — retry in 1000ms` → (2/3) → (3/3).
4. После исчерпания: `useAudioStore.getState().v3BootStatus.status === 'failed'`; toast `V3 engine unavailable` виден; `window.audioEngine !== facade` (реальный V2 восстановлен).
5. **НЕМОТА устранена:** приложение ИГРАЕТ через V2 (загрузи трек → слышен звук), НЕ требует reload.
6. Happy-path (без искусственной ошибки): retry НЕ зовётся, звук V3 как сейчас, `v3BootStatus.status === 'ok'`, варнов retry НЕТ.

Ретест ушами (план §5 mic-сессия не затрагивается этим паком, но проверить регрессию):
7. Обычный V3-boot: solo-превью / vocal-fade / автопауза (ретесты TAKES-AUDIO) — без изменений (ПАК 1 не меняет успешный путь).

---

*Статус: DRAFT, design-only, код не менялся, коммит не выполнялся.*
