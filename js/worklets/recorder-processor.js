const DEFAULT_CHUNK_FRAMES = 16384;

class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.channels = options?.processorOptions?.channels || 2;
    this.chunkFrames = options?.processorOptions?.chunkFrames || DEFAULT_CHUNK_FRAMES;
    this._acc = Array.from({ length: this.channels }, () => []);
    this._accFrames = 0;
    this._running = true; // Добавлено: флаг состояния worklet-а

    this.port.onmessage = (e) => {
      const msg = e.data || {}; // Добавлено для удобства
      if (msg.type === 'flush') {
        console.log('RecorderProcessor: Получено сообщение FLUSH. Текущие accFrames:', this._accFrames);
        this._flush();
      }
      if (msg.type === 'stop') { // Добавлено: обработка сообщения stop
        console.log('RecorderProcessor: Получено сообщение STOP. Отправка остатков и завершение.');
        this._flush();       // отправим остатки
        this._running = false; // попросим движок уничтожить процессор
      }
    };
  }

  _flush() {
    console.log('RecorderProcessor: _flush вызван. accFrames:', this._accFrames);
    if (this._accFrames === 0) return;
    const out = [];
    for (let ch = 0; ch < this.channels; ch++) {
      const pieces = this._acc[ch];
      let total = 0; for (const p of pieces) total += p.length;
      const merged = new Float32Array(total);
      let off = 0; for (const p of pieces) { merged.set(p, off); off += p.length; }
      out.push(merged);
      this._acc[ch] = [];
    }
    this._accFrames = 0;
    this.port.postMessage({ type: 'chunk', buffers: out }, out.map(b => b.buffer));
    console.log('RecorderProcessor: Отправлен чанк. frames:', out[0].length, 'Аккумулировано кадров:', this._accFrames);
  }

  process(inputs) {
    if (!this._running) {
      console.log('RecorderProcessor: process остановлен, Worklet завершает работу.');
      return false; // корректное завершение Worklet-а
    }
    console.log('RecorderProcessor: process вызван. inputs:', inputs, 'Аккумулировано кадров:', this._accFrames);
    const input = inputs[0];
    if (!input || input.length === 0) {
      console.warn('RecorderProcessor: process - Нет входных данных или пустые данные. input.length:', input ? input.length : 0);
      return true;
    }

    const frames = input[0]?.length || 0;
    if (frames === 0) return true; // Добавлено: если кадров 0, пропускаем

    // Если моно — дублируем в стерео
    const chanCount = Math.min(this.channels, input.length);
    for (let ch = 0; ch < this.channels; ch++) {
      const src = input[ch < chanCount ? ch : 0] || new Float32Array(frames);
      this._acc[ch].push(new Float32Array(src)); // копия блока
    }
    this._accFrames += frames;

    if (this._accFrames >= this.chunkFrames) {
      this._flush();
      console.log('RecorderProcessor: Достигнут chunkFrames. Вызов _flush.');
    }
    return this._running; // Возвращаем this._running, чтобы AudioWorkletProcessor завершился при false
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
