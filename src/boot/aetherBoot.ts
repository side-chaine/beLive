import { V3StatePublisher, V3DataInterceptor, getTransport, setStatePublisher, MonitorRouter } from '../audio/engine-v3';
import type { HybridPipelineService as HybridPipelineServiceType } from '../audio/engine-v3/pipeline/HybridPipelineService';
import { MonitorEngine } from '../audio/engine-v3/monitor/MonitorEngine';
import { DeviceManager } from '../audio/engine-v3/monitor/DeviceManager';
import { getAudioContext } from '../audio/core/audioContext';
import { useAudioStore } from '../stores/audio.store';
import { useNotifyStore } from '../stores/notify.store';
import { MicSourceV3 } from '../audio/engine-v3/services/MicSourceV3';

/**
 * Aether v3 audio engine boot. Ordering is a contract, not an accident:
 * MonitorRouter -> MonitorEngine -> V3DataInterceptor -> before-track-change.
 * Do NOT move this behind an idle callback.
 */
// ═══ AETHER v3.0 Boot ═══
// TransportV3 singleton через getTransport()

let _aetherPublisher: V3StatePublisher | undefined

export function bootAether(): void {
  try {
    // 009-W2b-restore: единственный writer флага V3 (удалён в W2b, d0e31af)
    ;(window as any).__v3Active = false
    ;(window as any).__setV3Active = (active: boolean) => { (window as any).__v3Active = active === true }
    const transport = getTransport()
    ;(window as any).__belive = (window as any).__belive || {}
    ;(window as any).__belive.transport = transport
    if (!transport) return // V2 not available

    // 1. Publisher — публикация времени в UI
    _aetherPublisher = new V3StatePublisher(transport)
    setStatePublisher(_aetherPublisher) // для UI компонентов (publishSeek)
    _aetherPublisher.start()

    // 1b. MonitorRouter + MonitorEngine — Static Output Bus (TC-2C).
    //     Eager: стемы с рождения в Router. Permanent Facade — один раз навсегда.
    const ctx = getAudioContext()
    let router: MonitorRouter | null = null
    let monitorEngine: MonitorEngine | null = null
    let deviceManager: InstanceType<typeof DeviceManager> | null = null
    try {
      router = new MonitorRouter(ctx)
      transport.orchestrator.setOutputRouting(router.programInput, router.vocalHallInput)
      monitorEngine = new MonitorEngine()
      deviceManager = new DeviceManager(router.monitorStream, router.mainStream)
      monitorEngine.setBackend(router, ctx, deviceManager)
      // 🔬 RECON-3: временный глобальный доступ для диагностики
      ;(window as any).__router = router
      console.log('[AETHER] ✅ MonitorRouter + MonitorEngine active — Static Output Bus')
    } catch (e) { console.warn('[AETHER] MonitorRouter failed — stems → ctx.destination', e) }

    // 2. Interceptor — получение треков из IDB параллельно V2 (СТРОГО ПОСЛЕ Router)
    const interceptor = new V3DataInterceptor(ctx, transport.orchestrator, transport)

    // 🟢 Phase F: HybridPipelineService — retry/re-entry + explicit fail-state
    const initV3Pipeline = async (attempt = 0): Promise<HybridPipelineServiceType | null> => {
      const MAX = 3
      const BACKOFF = [1000, 2000, 4000]
      try {
        const { HybridPipelineService } = await import('../audio/engine-v3/pipeline/HybridPipelineService')
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
      useAudioStore.getState().setV3BootStatus({ status: 'failed', attempts: 3, at: Date.now() })
      useNotifyStore.getState().pushToast({
        level: 'error',
        title: 'V3 engine unavailable',
        message: 'Audio running in degraded mode — reload to restore V3.',
      })
      ;(window as any).__setV3Active?.(false)
      console.error('[AETHER] ❌ V3 boot failed after retries — V2 restored, user notified')
    }

    ;(async () => {
      const pipeline = await initV3Pipeline()
      if (!pipeline) { handleV3BootFailure(); return }
      try {
        // Подключаем pipeline к MonitorRouter
        // Topology: pipeline.outputNode → router.programInput → _defaultBranch → destination
        if (router) {
          pipeline.outputNode.connect(router.programInput)
          pipeline.setVocalHallTarget(router.vocalHallInput)
          pipeline.setVMixCenterTarget(router.vmixCenterIn)
          pipeline.setVMixVocalTarget(router.vmixVocalIn)
        }

        // Подключаем pipeline к TransportV3 (через IPipelineController)
        transport.attachPipeline(pipeline)

        // Attach pipeline к Interceptor для загрузки стемов в WASM
        interceptor.attachPipeline(pipeline)

        // Выставляем в window для дебага
        ;(window as any).__belive = (window as any).__belive || {}
        ;(window as any).__belive.pipeline = pipeline
        ;(window as any).__belive.micSource = (window as any).__belive.micSource ?? new MicSourceV3()
        ;(window as any).__belive.monitorRouter = router
        ;(window as any).__belive.stemOrchestrator = transport.orchestrator
        ;(window as any).__belive.stemOrchestrator?.setVMixCenterTap?.((window as any).__belive.monitorRouter?.vmixCenterIn)
        if (deviceManager) { ;(window as any).__belive.deviceManager = deviceManager }

        console.log('[AETHER] ✅ HybridPipelineService Phase F — ACTIVE')
        console.log('[AETHER] ⚡ __belive.pipeline — diagnostics API')
      } catch (e) {
        console.warn('[AETHER] ❌ HybridPipelineService wiring deferred — varispeed fallback:', e)
      }
    })()

    // 🧪 Expose для консоли: __getTransport().setPlaybackRate(0.85)
    ;(window as any).__getTransport = getTransport

    // 🎮 Консольные команды для управления V3 (Phase F)
    ;(window as any).__tp = transport  // быстрая ссылка
    ;(window as any).__v3play = async (offset?: number) => {
      try { getTransport()?.stop() } catch {}
      transport.play(offset);
      console.log('[🎮] play', offset ?? 0, '🔇 V3')
    }
    ;(window as any).__v3pause = () => { transport.pause(); console.log('[🎮] pause') }
    ;(window as any).__v3stop = () => { transport.stop(); console.log('[🎮] stop') }
    ;(window as any).__v3rate = (r: number) => { transport.setPlaybackRate(r); console.log('[🎮] rate →', r) }
    ;(window as any).__v3seek = (t: number) => { transport.seek(t); console.log('[🎮] seek →', t.toFixed(1) + 's') }
    ;(window as any).__v3status = () => {
      const stems = transport.orchestrator.all()
      const p = (window as any).__belive?.pipeline
      console.log(`[🎮] state:${transport.state} rate:${transport.playbackRate.toFixed(2)} stems:${stems.length} pipeline:${p ? '✅' : '❌'}`)
    }

    // Подписка на before-track-change (V3 pipeline — единственный путь)
    document.addEventListener('before-track-change', async (event) => {
      console.log('[TRACE] 🎯 before-track-change HANDLER FIRED', (event as CustomEvent).detail)
      const payload = (event as CustomEvent).detail
      const trackId = payload?.toTrackId
      if (!trackId) return

      // M2 (P1-a): глушим звук СРАЗУ — не ждём IDB-фетч, старый трек не должен звучать
      try { getTransport()?.stop?.() } catch {}
      try { (window as any).__belive?.pipeline?.stop?.() } catch {}
      
      try {
        const idbModule = await import('../services/idb.service')
        const getTrack = idbModule.getTrack
        const numericId = Number(trackId)
        const record = await getTrack(numericId)
        
        if (record) {
          // 🔧 FIX: Не блокируем V2 — грузим V3 в фоне.
          // V3DataInterceptor.loadTrack() медленный (addBuffers → AudioWorklet postMessage может зависнуть).
          // V2 продолжает играть, пока V3 грузится в фоне.
          // Когда V3 загрузится → авто-старт (в loadTrack есть transport.play()) + глушим V2.
          console.log('[TRACE] ⏳ V3 loading in background — V2 continues...')
          // M2 (345): latency instrumentation — load-to-first-audio
          const __tLoadStart = performance.now();
          interceptor.loadTrack(record as any).then(() => {
            // M2 (345): P50/P95 sampling
            try {
              const __lat = performance.now() - __tLoadStart;
              const __samples = ((window as any).__latencySamples = (window as any).__latencySamples || []);
              __samples.push(__lat);
              console.log(`[M2-latency] load-to-first-audio: ${__lat.toFixed(0)}ms (samples=${__samples.length})`)
            } catch {}
            console.log('[TRACE] ✅ V3 loadTrack completed', { 
              stems: transport.orchestrator.all().length, 
              state: transport.state 
            })
            
            // №18-BUS H2.3: блок «gains restored to 1.0» УДАЛЁН — четвёртый отравитель raw-слота.
            // pipeline сам восстанавливает effective gains из RAW (_stemRawVolumes переживают reset).
            if (monitorEngine) monitorEngine.setBackendMode('v3')
            console.log('[AETHER] ✅ V3 loaded for track', trackId)

            // M1-2 (342, расширение): публикуем trackUrls для V3-фасада.
            // UI-потребители (useWaveformData/SyncEditor) ждут ae.hybridEngine.instrumentalUrl —
            // фасад читает window.__belive.trackUrls (см. js/audio-facade-v3.js).
            try {
              const belive = (window as any).__belive || ((window as any).__belive = {})
              const r = record as any
              if (r?.instrumentalData) {
                const blob = new Blob([r.instrumentalData], { type: r.instrumentalType ?? 'audio/mpeg' })
                belive.trackUrls = belive.trackUrls || {}
                belive.trackUrls.instrumentalUrl = URL.createObjectURL(blob)
              }
              if (r?.vocalsData) {
                const blob = new Blob([r.vocalsData], { type: r.vocalsType ?? 'audio/mpeg' })
                belive.trackUrls = belive.trackUrls || {}
                belive.trackUrls.vocalsUrl = URL.createObjectURL(blob)
              }
            } catch (e) {
              console.warn('[AETHER] trackUrls publish failed:', e)
            }
          }).catch((e: unknown) => {
            console.warn('[AETHER] V3 loadTrack failed — V2 continues playing:', e)
          })
        } else {
          console.log('[TRACE] ❌ getTrack returned null for trackId:', numericId)
        }
      } catch (e) {
        console.warn('[AETHER] Interceptor failed:', e)
      }
    })

  } catch (e) {
    console.warn('[AETHER] Boot failed — V2 continues', e)
  }
}

/** HMR cleanup for the state publisher created by bootAether(). */
export function disposeAether(): void {
  _aetherPublisher?.dispose();
}
