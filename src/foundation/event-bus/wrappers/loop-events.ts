import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useLoopStore } from '../../../stores/loop.store'
import { getTransport } from '../../../audio/engine-v3'

export function initLoopEvents(): () => void {
  const subs: Subscription[] = []
  let rafId: number | null = null
  let lastJumpTime = 0
  let lastApplied: { active: boolean; start: number | null; end: number | null } = {
    active: false, start: null, end: null,
  }

  function stopFallback() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  }

  // Fallback: rAF polling (когда engine не поддерживает setLoop)
  function check() {
    const { isLooping, loopStartTime, loopEndTime } = useLoopStore.getState()
    const ae = (window as any).audioEngine
    if (!isLooping || loopStartTime == null || loopEndTime == null || !ae) {
      stopFallback(); return
    }
    // V3 native loop — fallback не нужен
    const t3 = getTransport()
    if (t3 && ((window as any).__v3Active || (t3.state !== 'idle' && t3.orchestrator.all().length > 0))) {
      stopFallback(); return
    }
    if (typeof ae.setLoop === 'function' && typeof ae.clearLoop === 'function') {
      stopFallback(); return  // engine-backed — fallback не нужен
    }
    const t = ae.getCurrentTime?.() ?? 0
    if (t >= loopEndTime - 0.05 && Date.now() - lastJumpTime > 1200) {
      getTransport()?.seek(loopStartTime + 0.01)
      lastJumpTime = Date.now()
    }
    rafId = requestAnimationFrame(check)
  }

  /** Обновить engine при изменении store */
  function syncLoopToEngine() {
    const { isLooping, loopStartTime, loopEndTime } = useLoopStore.getState()
    const ae = (window as any).audioEngine
    const changed = lastApplied.active !== isLooping
      || lastApplied.start !== loopStartTime || lastApplied.end !== loopEndTime
    if (!changed) return
    lastApplied = { active: isLooping, start: loopStartTime, end: loopEndTime }

    // V3 path: native source.loop (sample-accurate, 0 CPU)
    const t3 = getTransport()
    const v3Active = !!(t3 && ((window as any).__v3Active || (t3.state !== 'idle' && t3.orchestrator.all().length > 0)))

    if (isLooping && loopStartTime != null && loopEndTime != null) {
      if (v3Active) {
        void t3!.setLoop(loopStartTime, loopEndTime)
        stopFallback()
        return
      }
      // V2 path: ae.setLoop
      const applied = typeof ae?.setLoop === 'function'
        ? ae.setLoop(loopStartTime, loopEndTime)
        : false
      if (applied) { stopFallback(); return }
      // Fallback: rAF polling
      if (rafId === null) { lastJumpTime = 0; rafId = requestAnimationFrame(check) }
    } else {
      stopFallback()
      if (v3Active) {
        t3!.clearLoop()
      } else {
        try { ae?.clearLoop?.() } catch {}
      }
    }
  }

  // Подписка на store (как в оригинальном loop.bridge.ts)
  const unsubStore = useLoopStore.subscribe(() => { syncLoopToEngine() })

  // loop-cleared: синхронизация engine→store
  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'loop-cleared', () => {
    const state = useLoopStore.getState()
    if (!state.isLooping) return
    useLoopStore.getState().clearLoop()
  }))

  // Before-change + mode-changed: сброс loop (parity V2: loop не переживает смену трека)
  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    lastApplied = { active: false, start: null, end: null }
    useLoopStore.getState().clearLoop()
    const t3 = getTransport()
    const v3Active = !!(t3 && ((window as any).__v3Active || (t3.state !== 'idle' && t3.orchestrator.all().length > 0)))
    if (v3Active) t3!.clearLoop()
  }))
  subs.push(eventBus.subscribe(EventBusChannel.UI, 'mode-changed', () => {
    if (lastApplied.active) syncLoopToEngine()
  }))

  return () => {
    unsubStore()
    stopFallback()
    subs.forEach(s => s.unsubscribe())
  }
}
