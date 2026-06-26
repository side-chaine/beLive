/**
 * Web Worker: MP3 транскодинг.
 * Импортирует @breezystack/lamejs — не увеличивает main bundle.
 * Получает Float32 PCM данные → кодирует в MP3 → возвращает ArrayBuffer.
 */
// @ts-ignore — no TS types for worker scope
self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'abort') { (self as any).__aborted = true; return; }
  if (msg.type !== 'encode') return;

  // FM-6: reset sticky __aborted — belt + suspenders с terminateWorker в pipeline
  (self as any).__aborted = false;
  // TC-PERF-003: reset progress tracker
  (self as any).__lastProgress = -1;

  const { jobId, channels, sampleRate, pcmData, kbps, stemId } = msg;
  
  try {
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const encoder = new Mp3Encoder(channels, sampleRate, kbps);
    const mp3Chunks: Uint8Array[] = [];
    const frameSize = 1152;
    const totalSamples = pcmData[0].length;
    let aborted = false;

    // Chunked encoding по 1152 сэмпла
    // TC-PERF-003: reuse Int16Array буферы (не new на каждый чанк)
    const left = new Int16Array(frameSize);
    const right = channels === 2 ? new Int16Array(frameSize) : null;

    for (let offset = 0; offset < totalSamples; offset += frameSize) {
      // Проверка abort на каждом чанке
      if ((self as any).__aborted) {
        aborted = true;
        break;
      }

      const end = Math.min(offset + frameSize, totalSamples);
      const chunkSize = end - offset;

      // Обнуляем только использованные элементы (GC-friendly)
      left.fill(0, chunkSize);
      if (right) right.fill(0, chunkSize);

      // Float32 → Int16 конвертация с clamp
      for (let i = 0; i < chunkSize; i++) {
        const s = Math.max(-1, Math.min(1, pcmData[0][offset + i]));
        left[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        if (right) {
          const sr = Math.max(-1, Math.min(1, pcmData[1][offset + i]));
          right[i] = sr < 0 ? sr * 0x8000 : sr * 0x7FFF;
        }
      }

      const mp3Buf = channels === 2
        ? encoder.encodeBuffer(left, right!)
        : encoder.encodeBuffer(left);

      if (mp3Buf.length > 0) mp3Chunks.push(mp3Buf);

      // TC-PERF-003: Progress update только при смене процента (throttle)
      const currentProgress = Math.round((offset / totalSamples) * 100);
      if (currentProgress !== (self as any).__lastProgress) {
        (self as any).__lastProgress = currentProgress;
        (self as any).postMessage({ type: 'progress', jobId, stemId, progress: currentProgress });
      }
    }

    if (aborted) {
      (self as any).postMessage({ type: 'aborted', jobId, stemId });
      return;
    }

    // Flush остатка
    const flushBuf = encoder.flush();
    if (flushBuf.length > 0) mp3Chunks.push(flushBuf);

    // Конкатенация всех чанков
    const totalLen = mp3Chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of mp3Chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    (self as any).postMessage(
      { type: 'done', jobId, stemId, mp3Data: result.buffer },
      { transfer: [result.buffer] } // transferable — 0-copy
    );
  } catch (err: any) {
    (self as any).postMessage({ type: 'error', jobId, stemId, error: err.message });
  }
};
