import { useState, useEffect } from 'react';

export interface WaveformData {
  instrumentalData: Float32Array | null;
  vocalData: Float32Array | null;
  sampleRate: number;
  duration: number;
  loading: boolean;
  error: string | null;
}

async function fetchAndDecode(
  url: string,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export function useWaveformData(): WaveformData {
  const [state, setState] = useState<WaveformData>({
    instrumentalData: null,
    vocalData: null,
    sampleRate: 44100,
    duration: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ae = (window as any).audioEngine;
        if (!ae?.hybridEngine) {
          setState((s) => ({
            ...s,
            loading: false,
            error: 'No audio engine or hybrid engine',
          }));
          return;
        }

        const iUrl: string | undefined =
          ae.hybridEngine.instrumentalUrl;
        const vUrl: string | undefined =
          ae.hybridEngine.vocalsUrl;

        if (!iUrl && !vUrl) {
          setState((s) => ({
            ...s,
            loading: false,
            error: 'No audio URLs available',
          }));
          return;
        }

        // Use shared AudioContext for decoding
        const ctx: AudioContext =
          ae.audioContext || new AudioContext();

        const [iBuf, vBuf] = await Promise.all([
          iUrl ? fetchAndDecode(iUrl, ctx) : null,
          vUrl ? fetchAndDecode(vUrl, ctx) : null,
        ]);

        if (cancelled) return;

        const refBuffer = iBuf || vBuf;

        setState({
          instrumentalData: iBuf ? iBuf.getChannelData(0) : null,
          vocalData: vBuf ? vBuf.getChannelData(0) : null,
          sampleRate: refBuffer?.sampleRate || 44100,
          duration: refBuffer?.duration || 0,
          loading: false,
          error: null,
        });

        if (import.meta.env.DEV) console.log(
          '[SyncWaveform] loaded:',
          'I=' + (iBuf ? `${iBuf.duration.toFixed(1)}s` : 'none'),
          'V=' + (vBuf ? `${vBuf.duration.toFixed(1)}s` : 'none')
        );
      } catch (e) {
        if (!cancelled) {
          console.error('[SyncWaveform] load error:', e);
          setState((s) => ({
            ...s,
            loading: false,
            error: String(e),
          }));
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
