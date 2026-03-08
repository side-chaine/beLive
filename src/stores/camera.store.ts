import { create } from 'zustand';

interface CameraState {
  cameraOn: boolean;
  facingMode: 'user' | 'environment';
  stream: MediaStream | null;
  error: string | null;

  startCamera: () => Promise<void>;
  stopCamera: () => void;
  flipCamera: () => Promise<void>;
}

export const useCameraStore = create<CameraState>((set, get) => ({
  cameraOn: false,
  facingMode: 'user',
  stream: null,
  error: null,

  startCamera: async () => {
    const { stream: oldStream, facingMode } = get();
    // Cleanup previous
    if (oldStream) {
      oldStream.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      set({ stream, cameraOn: true, error: null });
    } catch (e: any) {
      const msg =
        e.name === 'NotAllowedError'
          ? 'denied'
          : e.name === 'NotFoundError'
          ? 'no-camera'
          : 'error';
      set({ stream: null, cameraOn: false, error: msg });
      console.warn('[CameraStore] failed:', e.name);
    }
  },

  stopCamera: () => {
    const { stream } = get();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    set({ stream: null, cameraOn: false, error: null });
  },

  flipCamera: async () => {
    const { facingMode, cameraOn } = get();
    const next = facingMode === 'user' ? 'environment' : 'user';
    set({ facingMode: next });
    if (cameraOn) {
      await get().startCamera();
    }
  },
}));

