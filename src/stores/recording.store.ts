import { create } from 'zustand';
import { usePerformanceStore } from '../performance/performance.store';
import { getRecordingCaptureProfile } from '../performance/performance.recording';

interface RecordingState {
  isRecording: boolean;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timerInterval: ReturnType<typeof setInterval> | null = null;
let displayStream: MediaStream | null = null;
let micListener: (() => void) | null = null;

export const useRecordingStore = create<RecordingState>((set, get) => ({
  isRecording: false,
  duration: 0,
  error: null,

  startRecording: async () => {
    try {
      set({ error: null });

      // Recording capture profile follows current effective performance tier
      const tier = usePerformanceStore.getState().getEffectiveTier();
      const profile = getRecordingCaptureProfile(tier);

      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: profile.frameRate },
        audio: false,
      });

      const ae = (window as any).audioEngine;
      if (ae?.audioContext?.state === 'suspended') {
        await ae.audioContext.resume();
      }
      const audioStream: MediaStream | null = ae?.captureStream?.() ?? null;

      if (ae?.microphoneGain && ae?.streamDestination) {
        try {
          ae.microphoneGain.connect(ae.streamDestination);
        } catch (e) {
          // already connected, ignore
        }
      }

      micListener = () => {
        if (!get().isRecording || !ae?.streamDestination || !ae?.microphoneGain) return;
        try {
          ae.microphoneGain.connect(ae.streamDestination);
        } catch (e) { /* already connected */ }
      };
      document.addEventListener('microphone-state-changed', micListener);

      const tracks: MediaStreamTrack[] = [
        ...displayStream.getVideoTracks(),
      ];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }

      const combined = new MediaStream(tracks);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      mediaRecorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: profile.videoBitsPerSecond,
        audioBitsPerSecond: profile.audioBitsPerSecond,
      });

      chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const d = new Date();
        const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
        a.download = `beLive-recording-${ts}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        chunks = [];
      };

      mediaRecorder.onerror = () => {
        set({ error: 'Recording error', isRecording: false });
        get().stopRecording();
      };

      displayStream.getVideoTracks()[0].onended = () => {
        if (get().isRecording) get().stopRecording();
      };

      mediaRecorder.start();
      set({ isRecording: true, duration: 0 });

      timerInterval = setInterval(() => {
        set(s => ({ duration: s.duration + 1 }));
      }, 1000);

    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to start recording', isRecording: false });
    }
  },

  stopRecording: () => {
    if (micListener) {
      document.removeEventListener('microphone-state-changed', micListener);
      micListener = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (displayStream) {
      displayStream.getTracks().forEach(t => t.stop());
      displayStream = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    mediaRecorder = null;
    set({ isRecording: false });
  },
}));
