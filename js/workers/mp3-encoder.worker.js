console.log('Worker: mp3-encoder.worker.js started.');
/* global lamejs */

self.onerror = (e) => {
  console.error('Worker: Uncaught error:', e.message, e.filename, e.lineno, e.colno);
  self.postMessage({ type: 'error', message: `Worker: Uncaught error - ${e.message} at ${e.filename}:${e.lineno}:${e.colno}` });
};

try {
  // Using absolute path for robust loading
  self.importScripts(`${location.origin}/js/vendor/lame.min.js`);
  console.log('Worker: lame.min.js loaded successfully.');
} catch (e) {
  self.postMessage({ type: 'error', message: `Worker: Failed to load lame.min.js: ${e.message}` });
  console.error('Worker: Failed to load lame.min.js:', e);
  // Re-throw or exit if essential script fails to load
  throw e;
}

console.log('Worker: self.onmessage assignment incoming.');
console.log('Worker: Проверка наличия lamejs при старте: ', typeof self.lamejs, typeof self.lamejs.Mp3Encoder);

// Глобальные переменные для сохранения состояния между сообщениями
// let mp3enc; // Уже не используется напрямую, теперь через self._mp3enc
// let mp3Data = []; // Уже не используется, данные передаются через postMessage сразу

// Добавлен универсальный хэндлер
self.onmessage = (e) => {
  const msg = e.data || {};
  console.log('Worker: Получено сообщение:', msg); // Добавлен лог содержимого сообщения
  const t = msg.type || msg.command; // поддерживаем оба

  switch (t) {
    case 'init': {
      const { numChannels = 2, sampleRate, bitrate = 320 } = msg;
      try {
        if (!self.lamejs || !self.lamejs.Mp3Encoder) {
          console.error('Worker: lamejs или lamejs.Mp3Encoder не определены после importScripts.');
          self.postMessage({ type: 'error', message: 'lamejs not loaded' });
          return;
        }
        self._mp3enc = new self.lamejs.Mp3Encoder(numChannels, sampleRate, bitrate); // Сохраняем в self
        console.log('Worker: lamejs.Mp3Encoder успешно инициализирован.');
        self.postMessage({ type: 'inited' }); // Сообщение об успешной инициализации
      } catch (e) {
        console.error('Worker: Ошибка инициализации Mp3Encoder:', e.message, e.stack);
        self.postMessage({ type: 'error', message: `Failed to initialize Mp3Encoder: ${e.message}` });
      }
      break;
    }
    case 'encode': {
      const L = msg.left;  // Int16Array, уже должен быть новым буфером
      const R = msg.right; // Int16Array, уже должен быть новым буфером
      if (!self._mp3enc) { self.postMessage({ type: 'error', message: 'MP3 encoder not initialized.' }); return; }
      try {
        const buf = self._mp3enc.encodeBuffer(L, R);
        if (buf && buf.length) {
          const u8 = new Uint8Array(buf);
          self.postMessage({ type: 'data', buffer: u8.buffer }, [u8.buffer]);
        } else {
          console.warn('Worker: encodeBuffer вернул пустой буфер.');
        }
      } catch (e) {
        console.error('Worker: Ошибка при кодировании чанка:', e.message, e.stack);
        self.postMessage({ type: 'error', message: `MP3 encoding failed for chunk: ${e.message}` });
      }
      break;
    }
    case 'flush': {
      if (!self._mp3enc) { self.postMessage({ type: 'error', message: 'MP3 encoder not initialized.' }); return; }
      try {
        const end = self._mp3enc.flush() || [];
        const u8 = new Uint8Array(end);
        self.postMessage({ type: 'done', buffer: u8.buffer }, [u8.buffer]);
        self._mp3enc = null; // Сбрасываем кодер после завершения
      } catch (e) {
        console.error('Worker: Ошибка при завершении кодирования (flush):', e.message, e.stack);
        self.postMessage({ type: 'error', message: `MP3 flush failed: ${e.message}` });
      }
      break;
    }
    default:
      console.log('Worker: Получена неизвестная команда:', t);
      self.postMessage({ type: 'error', message: 'Unknown command: ' + t });
  }
};
