export function installLiveGuard(): void {
  const win = window as any;

  // Wait for liveMode to exist
  const patch = () => {
    if (!win.liveMode) return;

    const original = win.liveMode.activate.bind(win.liveMode);
    win.liveMode.activate = (...args: any[]) => {
      const cameraAllowed = localStorage.getItem('bl-live-camera') === '1';
      if (!cameraAllowed) {
        return Promise.resolve();
      }
      return original(...args);
    };
  };

  // Retry — liveMode may not exist yet at boot
  if (win.liveMode) patch();
  else setTimeout(patch, 2000);
}
