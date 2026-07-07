interface ScheduleMsg { id: string; fireAtWallClock: number }
interface CancelMsg { cancel: string }

const timers = new Map<string, ReturnType<typeof setTimeout>>();

self.onmessage = (e: MessageEvent<ScheduleMsg | CancelMsg>) => {
  if ('cancel' in e.data) {
    const t = timers.get(e.data.cancel);
    if (t) clearTimeout(t);
    timers.delete(e.data.cancel);
    return;
  }
  const { id, fireAtWallClock } = e.data;
  const delay = Math.max(0, fireAtWallClock - Date.now());
  const t = setTimeout(() => {
    self.postMessage({ id, firedAt: Date.now() });
    timers.delete(id);
  }, delay);
  timers.set(id, t);
};
