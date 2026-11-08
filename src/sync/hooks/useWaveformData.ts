import { useState, useEffect } from 'react';

export interface WaveformData {
  instrumentalData: Float32Array | null;
  vocalData: Float32Array | null;
  sampleRate: number;
  duration: number;
  loading: boolean;
  error: string | null;
}

/** D4: stems land ~2s after Sync opens — poll instead of failing on mount. */
const URL_POLL_INTERVAL_MS = 200;
const URL_POLL_TIMEOUT_MS = 6000;
/**
 * 702-F0'': сколько ждём пайплайн, прежде чем добирать недостающий стем из URL.
 * Пайплайн грузит все стемы одним заходом, поэтому «instrumental уже есть,
 * вокал через 100 мс» — типичное окно. Декодировать вокал из URL в этом окне
 * значит заплатить полный PCM (≈70 МиБ на 3:29) за данные, которые вот-вот
 * придут бесплатно. Грейс короткий и ограниченный: висяков не создаёт.
 */
const PIPELINE_GRACE_MS = 1200;

/**
 * 702-F0'': волна берёт УЖЕ декодированный AudioBuffer из V3-пайплайна.
 *
 * Было: fetch(blobURL) + decodeAudioData → вторая полная распаковка instrumental
 * и vocals. На треке 3:29 это +140 МиБ PCM (2 × 70 МиБ) поверх того, что уже
 * лежит в пайплайне — и всё это на телефоне, который и без того упирается в лимит
 * кучи. Плюс гонка: blob-URL отзывается при смене трека (см. aetherBoot 702-F0'),
 * и запоздавший fetch падал бы.
 *
 * Теперь: читаем тот же AudioBuffer, что уже играет (ноль копий PCM), а старый
 * путь через URL остаётся фолбэком — если пайплайна нет (деградированный режим,
 * V3 не поднялся, трек без стемов в V3).
 */
function pipelineBuffer(ae: any, stemId: string): AudioBuffer | null {
  try {
    const buf = ae?.getStemAudioBuffer?.(stemId);
    if (!buf || typeof buf.duration !== 'number' || !(buf.duration > 0)) return null;
    return buf as AudioBuffer;
  } catch {
    return null;
  }
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
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let pipelineSeenAt = 0;
    const deadline = Date.now() + URL_POLL_TIMEOUT_MS;

    /** Публикация волны: один writer состояния + один DEV-лог. */
    function publish(iBuf: AudioBuffer | null, vBuf: AudioBuffer | null) {
      const refBuffer = iBuf || vBuf;
      setState({
        instrumentalData: iBuf ? iBuf.getChannelData(0) : null,
        vocalData: vBuf ? vBuf.getChannelData(0) : null,
        sampleRate: refBuffer?.sampleRate || 44100,
        duration: refBuffer?.duration || 0,
        loading: false,
        error: null,
      });

      if (import.meta.env.DEV) {console.log(
        '[SyncWaveform] loaded:',
        'I=' + (iBuf ? `${iBuf.duration.toFixed(1)}s` : 'none'),
        'V=' + (vBuf ? `${vBuf.duration.toFixed(1)}s` : 'none')
      );}
    }

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

        // 702-F0'': что уже декодировано пайплайном — берём как есть (ноль копий PCM),
        // что не декодировано — только то и добираем старым путём через blob-URL.
        // Инвариант: ни один источник не декодируется дважды, если его отдаёт пайплайн.
        const iReady = pipelineBuffer(ae, 'instrumental');
        const vReady = pipelineBuffer(ae, 'vocals');
        const iUrl: string | undefined = ae.hybridEngine.instrumentalUrl;
        const vUrl: string | undefined = ae.hybridEngine.vocalsUrl;
        const pipelineAlive = !!(iReady || vReady);

        // D4: V3 publishes stems/URLs ~2s after loadTrack — keep waiting
        // (loading stays true, no error) until something shows up.
        if (!pipelineAlive && !iUrl && !vUrl) {
          if (Date.now() < deadline) {
            pollTimer = setTimeout(load, URL_POLL_INTERVAL_MS);
            return;
          }
          setState((s) => ({
            ...s,
            loading: false,
            error: 'No audio URLs available',
          }));
          return;
        }

        // Пайплайн жив, но отдал не всё → короткий грейс вместо немедленного декода.
        const covered = (!iUrl || iReady) && (!vUrl || vReady);
        if (pipelineAlive && !covered) {
          if (!pipelineSeenAt) pipelineSeenAt = Date.now();
          if (Date.now() - pipelineSeenAt < PIPELINE_GRACE_MS) {
            pollTimer = setTimeout(load, URL_POLL_INTERVAL_MS);
            return;
          }
        }

        // Use shared AudioContext for decoding
        const ctx: AudioContext = ae.audioContext || new AudioContext();

        const [iBuf, vBuf] = await Promise.all([
          iReady ?? (iUrl ? fetchAndDecode(iUrl, ctx) : null),
          vReady ?? (vUrl ? fetchAndDecode(vUrl, ctx) : null),
        ]);

        if (cancelled) {return;}
        publish(iBuf, vBuf);
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
      if (pollTimer !== undefined) {clearTimeout(pollTimer);}
    };
  }, []);

  return state;
}
