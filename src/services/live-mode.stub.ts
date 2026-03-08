export class LiveMode {
  isActive = false;
  isRecording = false;

  async activate(): Promise<void> {
    this.isActive = true;
    try {
      window.dispatchEvent(
        new CustomEvent('camera-permission-resolved', {
          detail: { allowed: true },
        })
      );
    } catch (_) {}
  }

  deactivate(): void {
    this.isActive = false;
  }

  showNotification(_message?: string, _type?: string): void {
    // stub — React handles notifications
  }

  dispose(): void {
    this.isActive = false;
  }
}

export function registerLiveModeStub(): void {
  const w = window as any;
  w.LiveMode = LiveMode;
  if (!w.liveMode) {
    w.liveMode = new LiveMode();
  }
}
