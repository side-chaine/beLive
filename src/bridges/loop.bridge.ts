import { useLoopStore } from '../stores/loop.store';

export function initLoopBridge() {
  let rafId: number | null = null;
  let lastJumpTime = 0;

  function check() {
    const { isLooping, loopStartTime, loopEndTime } = useLoopStore.getState();
    const ae = (window as any).audioEngine;

    if (!isLooping || loopStartTime == null || loopEndTime == null || !ae) {
      rafId = null;
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
    if (state.isLooping && rafId === null) {
      lastJumpTime = 0;
      rafId = requestAnimationFrame(check);
    }
  });

  document.addEventListener('before-track-change', () => {
    useLoopStore.getState().clearLoop();
  });
  document.addEventListener('mode-changed', () => {
    useLoopStore.getState().clearLoop();
  });
}