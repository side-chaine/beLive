(function(global){
  const log = global.AppLogger || console;
  const C = global.AppConstants || { MAX_PARALLEL_AUDIO_DECODE: 2 };

  let activeDecodes = 0;
  const decodeQueue = [];

  async function readAsDataURL(blob){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function readAsArrayBuffer(blob){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  function detectMimeFromName(name){
    if (!name) {return 'application/octet-stream';}
    const lower = name.toLowerCase();
    if (lower.endsWith('.mp3')) {return 'audio/mpeg';}
    if (lower.endsWith('.wav')) {return 'audio/wav';}
    if (lower.endsWith('.ogg')) {return 'audio/ogg';}
    if (lower.endsWith('.m4a') || lower.endsWith('.aac')) {return 'audio/aac';}
    return 'audio/*';
  }

  async function normalize(input){
    try {
      if (!input) {throw new Error('AudioSourceAdapter.normalize: empty input');}

      // Blob/File → data URL
      if (input instanceof Blob) {
        const mime = input.type || detectMimeFromName(input.name);
        const dataUrl = await readAsDataURL(input);
        const arrayBufferPromise = readAsArrayBuffer(input);
        log.debug('AudioAdapter', 'Normalized Blob to data URL', { mime, size: input.size });
        return { kind: 'blob', safeUrl: dataUrl, arrayBufferPromise, mime, size: input.size };
      }

      // String URL/data URL
      if (typeof input === 'string') {
        if (input.startsWith('data:')) {
          log.debug('AudioAdapter', 'Input is already data URL');
          return { kind: 'data-url', safeUrl: input, arrayBufferPromise: null, mime: 'auto' };
        }
        if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('file://')) {
          log.debug('AudioAdapter', 'Input is http/file URL');
          return { kind: 'url', safeUrl: input, arrayBufferPromise: null, mime: 'remote' };
        }
      }

      // Fallback: вернуть как есть
      log.warn('AudioAdapter', 'Unknown input type, passing through');
      return { kind: 'unknown', safeUrl: input, arrayBufferPromise: null, mime: 'auto' };
    } catch (error) {
      log.error('AudioAdapter', 'Normalize failed', { error: String(error) });
      throw error;
    }
  }

  async function decodeAudio(context, arrayBuffer){
    const run = () => new Promise((resolve, reject) => {
      context.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
    });

    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          activeDecodes++;
          const result = await run();
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          activeDecodes--;
          const next = decodeQueue.shift();
          if (next) {next();}
        }
      };

      if (activeDecodes < C.MAX_PARALLEL_AUDIO_DECODE) {
        task();
      } else {
        decodeQueue.push(task);
      }
    });
  }

  global.AudioSourceAdapter = { normalize, decodeAudio };
})(window); 