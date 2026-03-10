import { useLoopStore } from '../stores/loop.store';

export function initLoopBridge() {
  let rafId: number | null = null;
  let lastJumpTime = 0;
  let lastApplied: { active: boolean; start: number | null; end: number | null } = {
    active: false,
    start: null,
    end: null,
  };

  function stopFallbackLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function check() {
    const { isLooping, loopStartTime, loopEndTime } = useLoopStore.getState();
    const ae = (window as any).audioEngine;

    if (!isLooping || loopStartTime == null || loopEndTime == null || !ae) {
      stopFallbackLoop();
      return;
    }

    // Engine-backed loop is the primary path.
    // Fallback manual jumping is allowed only when engine loop API is unavailable.
    if (typeof ae.setLoop === 'function' && typeof ae.clearLoop === 'function') {
      stopFallbackLoop();
      return;
    }

    const t = ae.getCurrentTime?.() ?? 0;
    if (t >= loopEndTime - 0.05 && Date.now() - lastJumpTime > 1200) {
      ae.setCurrentTime(loopStartTime + 0.01);
      lastJumpTime = Date.now();
    }

    rafId = requestAnimationFrame(check);
  }

  useLoopStore.subscribe((state) => {
    const ae = (window as any).audioEngine;
    const hasValidRange =
      state.isLooping &&
      state.loopStartTime != null &&
      state.loopEndTime != null;

    const changed =
      lastApplied.active !== state.isLooping ||
      lastApplied.start !== state.loopStartTime ||
      lastApplied.end !== state.loopEndTime;

    if (!changed) return;

    lastApplied = {
      active: state.isLooping,
      start: state.loopStartTime,
      end: state.loopEndTime,
    };

    if (!hasValidRange) {
      stopFallbackLoop();
      try { ae?.clearLoop?.(); } catch (_) {}
      return;
    }

    const applied = typeof ae?.setLoop === 'function'
      ? ae.setLoop(state.loopStartTime, state.loopEndTime)
      : false;

    if (applied) {
      stopFallbackLoop();
      return;
    }

    if (rafId === null) {
      lastJumpTime = 0;
      rafId = requestAnimationFrame(check);
    }
  });

  const clearAllLoops = () => {
    const ae = (window as any).audioEngine;
    stopFallbackLoop();
    lastApplied = { active: false, start: null, end: null };
    try { ae?.clearLoop?.(); } catch (_) {}
    useLoopStore.getState().clearLoop();
  };

  document.addEventListener('before-track-change', clearAllLoops);
  document.addEventListener('mode-changed', clearAllLoops);
}