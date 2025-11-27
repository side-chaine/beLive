class AudioExporter {
  // 🎯 НОВОЕ: Переносим флаг отладки в начало класса, чтобы он был доступен везде
  DEBUG = true;           
  CLEANUP_DETACH = false;  

  constructor({ engine, markerManager, lyricsDisplay, blockLoopControl }) {
    this.DEBUG && console.log('[AudioExporter Constructor] Received engine:', engine, 'engine.audioContext:', engine?.audioContext);
    this.engine = engine; // Используем 'engine'
    this.DEBUG && console.log('[AudioExporter Constructor] this.engine after assignment:', this.engine, 'this.engine.audioContext:', this.engine?.audioContext);
    this.markerManager = markerManager || engine?.markerManager || null; // Безопасный fallback
    this.lyricsDisplay = lyricsDisplay || engine?.lyricsDisplay || null; // Безопасный fallback
    this.blockLoopControl = blockLoopControl;
    this.DEBUG = true; // на время отладки, как рекомендовано

    // 🎯 ИЗМЕНЕНО: Откладываем инициализацию this.ac. Она будет происходить в первом методе, который ее использует.
    this.ac = null; // Инициализируем как null

    this.sampleRate = 44100; // целимся в 44.1kHz для MP3
    this.maxDurationSec = 10 * 60; // лимит 10 минут
    this.smartMicroFade = false; // по умолчанию off
    this.defaultBitrate = 320; // MP3 320 kbps
    this.fadeMs = 2; // очень короткий де-клик фейд на стыках (не слышно, но спасает от щелчков)

    // console.log('AudioExporter: Инициализирован.'); // Закомментировано
  }

  // Главный вход: blockIds — массив выбранных блоков в порядке проигрывания
  async exportBlocks({ blockIds, onProgress }) {
    // console.log('AudioExporter: exportBlocks вызван с блоками:', blockIds); // Закомментировано
    if (!Array.isArray(blockIds) || blockIds.length === 0) {
      console.error('AudioExporter: Нет выбранных блоков для экспорта.');
      throw new Error('Нет выбранных блоков для экспорта');
    }

    // 1) Получаем стемы (AudioBuffer)
    // console.log('AudioExporter: Получение stem-буферов...'); // Закомментировано
    const { instBuf, vocBuf, sampleRate } = await this._getStemBuffers();
    // console.log('AudioExporter: Stem-буферы получены. Sample Rate:', sampleRate, 'Inst Buffer:', instBuf, 'Voc Buffer:', vocBuf); // Закомментировано

    // 2) Сегменты из блоков по маркерам
    // console.log('AudioExporter: Построение сегментов из блоков...'); // Закомментировано
    const segments = this._buildSegmentsFromBlocks(blockIds);
    // console.log('AudioExporter: Сегменты построены:', segments); // Закомментировано
    if (segments.length === 0) {
      console.error('AudioExporter: Не удалось вычислить сегменты по выбранным блокам.');
      throw new Error('Не удалось вычислить сегменты по выбранным блокам');
    }

    // 3) Параметры текущего микса
    const rate = this.engine.getPlaybackRate ? this.engine.getPlaybackRate() : 1.0; // BPM coef (0.5..2.0)
    const gI = this.engine.instrumentalGain?.gain?.value ?? 1.0; // Используем прямое свойство
    const gV = this.engine.vocalsGain?.gain?.value ?? 1.0; // Используем прямое свойство
    // console.log('AudioExporter: Параметры микса: Rate:', rate, 'Instrumental Gain:', gI, 'Vocals Gain:', gV); // Закомментировано

    // 4) Оценка итоговой длительности
    const totalSrcSec = segments.reduce((acc, s) => acc + (s.end - s.start), 0);
    const totalOutSec = totalSrcSec / Math.max(0.001, rate);
    // console.log('AudioExporter: Исходная длительность:', totalSrcSec, 'Итоговая длительность (с учетом BPM):', totalOutSec); // Закомментировано
    if (totalOutSec > this.maxDurationSec) {
      console.error(`AudioExporter: Итоговая длительность ${totalOutSec.toFixed(1)}с превышает лимит ${this.maxDurationSec}с`);
      throw new Error(`Итоговая длительность ${totalOutSec.toFixed(1)}с превышает лимит ${this.maxDurationSec}с`);
    }

    // 5) OfflineAudioContext под итоговую длительность
    const channels = 2;
    const length = Math.ceil(this.sampleRate * totalOutSec);
    // console.log('AudioExporter: Создание OfflineAudioContext. Каналы:', channels, 'Длина (семплов):', length, 'Sample Rate:', this.sampleRate); // Закомментировано
    const off = new OfflineAudioContext(channels, length, this.sampleRate);

    // мастер-гейны (как в живом миксе)
    const instMaster = off.createGain();
    instMaster.gain.value = gI;
    const vocMaster = off.createGain();
    vocMaster.gain.value = gV;
    instMaster.connect(off.destination);
    vocMaster.connect(off.destination);
    // console.log('AudioExporter: Master GainNodes созданы и подключены.'); // Закомментировано

    // 6) Расписание сегментов «встык»
    let timeline = 0;
    const fade = this.fadeMs / 1000;
    // console.log('AudioExporter: Планирование сегментов...'); // Закомментировано
    for (const seg of segments) {
      // console.log('AudioExporter: Обработка сегмента:', seg); // Закомментировано
      const srcDur = Math.max(0, seg.end - seg.start); // секунды исходника
      if (srcDur <= 0) continue;
      const outDur = srcDur / Math.max(0.001, rate);
      // console.log(`AudioExporter: Сегмент ${seg.id} - Source Duration: ${srcDur.toFixed(2)}s, Output Duration: ${outDur.toFixed(2)}s`); // Закомментировано

      // Инструментал
      if (instBuf) {
        const src = off.createBufferSource();
        src.buffer = instBuf;
        src.playbackRate.value = rate;
        const gain = off.createGain();
        gain.gain.setValueAtTime(0, timeline);
        gain.gain.linearRampToValueAtTime(1, timeline + fade);
        gain.gain.setValueAtTime(1, timeline + Math.max(0, outDur - fade));
        gain.gain.linearRampToValueAtTime(0, timeline + outDur);
        src.connect(gain).connect(instMaster);
        src.start(timeline, seg.start, srcDur);
        // console.log(`AudioExporter: Инструментальный Source для сегмента ${seg.id} запланирован на ${timeline.toFixed(2)}s.`); // Закомментировано
      }

      // Вокал
      if (vocBuf) {
        const src = off.createBufferSource();
        src.buffer = vocBuf;
        src.playbackRate.value = rate;
        const gain = off.createGain();
        gain.gain.setValueAtTime(0, timeline);
        gain.gain.linearRampToValueAtTime(1, timeline + fade);
        gain.gain.setValueAtTime(1, timeline + Math.max(0, outDur - fade));
        gain.gain.linearRampToValueAtTime(0, timeline + outDur);
        src.connect(gain).connect(vocMaster);
        src.start(timeline, seg.start, srcDur);
        // console.log(`AudioExporter: Вокальный Source для сегмента ${seg.id} запланирован на ${timeline.toFixed(2)}s.`); // Закомментировано
      }
      timeline += outDur;
    }
    // console.log('AudioExporter: Все сегменты запланированы. Общая длительность таймлайна:', timeline.toFixed(2), 's'); // Закомментировано

    // 7) Рендер
    // console.log('AudioExporter: Запуск рендеринга...'); // Закомментировано
    const rendered = await off.startRendering();
    // console.log('AudioExporter: Рендеринг завершен. Получен AudioBuffer:', rendered); // Закомментировано

    // 8) Кодирование MP3 320
    // console.log('AudioExporter: Запуск кодирования MP3. Bitrate:', this.defaultBitrate); // Закомментировано
    const mp3Blob = await this._encodeToMp3(rendered, { bitrate: this.defaultBitrate, onProgress });
    // console.log('AudioExporter: MP3 кодирование завершено. Получен Blob:', mp3Blob); // Закомментировано

    // 9) Имя файла
    const filename = this._makeFileName();
    // console.log('AudioExporter: Имя файла:', filename); // Закомментировано
    return { blob: mp3Blob, filename };
  }

  // Сегменты по маркерам (точно как в BlockLoopControl._getBlockTimeRange)
  _buildSegmentsFromBlocks(blockIds) {
    // console.log('AudioExporter: _buildSegmentsFromBlocks - Вход. blockIds:', blockIds); // Закомментировано
    const blocks = (this.lyricsDisplay && Array.isArray(this.lyricsDisplay.textBlocks)) ? this.lyricsDisplay.textBlocks : [];
    // console.log('AudioExporter: _buildSegmentsFromBlocks - Доступные textBlocks:', blocks); // Закомментировано
    const idSet = new Set(blockIds.map(String));
    const ordered = blocks.filter(b => idSet.has(String(b.id)));
    // console.log('AudioExporter: _buildSegmentsFromBlocks - Отфильтрованные блоки по id:', ordered); // Закомментировано
    const out = [];
    for (const b of ordered) {
      const r = this._getTimeRangeForBlock(b);
      if (r && typeof r.startTime === 'number' && typeof r.endTime === 'number' && r.endTime > r.startTime) {
        out.push({ start: r.startTime, end: r.endTime, id: b.id, name: b.name });
        // console.log(`AudioExporter: _buildSegmentsFromBlocks - Добавлен сегмент для блока ${b.id}: ${r.startTime.toFixed(2)} - ${r.endTime.toFixed(2)}`); // Закомментировано
      } else {
        console.warn(`AudioExporter: _buildSegmentsFromBlocks - Не удалось получить корректный диапазон времени для блока ${b.id}. Пропускаем.`);
      }
    }
    // console.log('AudioExporter: _buildSegmentsFromBlocks - Выход. Результат:', out); // Закомментировано
    return out;
  }

  // Fallback для получения временных диапазонов, если blockLoopControl._getBlockTimeRange недоступен
  _getTimeRangeForBlock(block) {
    // console.log('AudioExporter: _getTimeRangeForBlock - Вход. Блок:', block); // Закомментировано
    if (!this.markerManager) {
      console.error('AudioExporter: _getTimeRangeForBlock - markerManager не инициализирован.');
      return null;
    }
    const markers = this.markerManager.getMarkers();
    if (!Array.isArray(markers) || markers.length === 0) {
      console.warn('AudioExporter: _getTimeRangeForBlock - Маркеры не найдены или пусты.');
      return null;
    }
    // console.log('AudioExporter: _getTimeRangeForBlock - Доступные маркеры:', markers.length); // Закомментировано

    const firstLine = Math.min(...(block.lineIndices || []));
    const lastLine = Math.max(...(block.lineIndices || []));
    // console.log(`AudioExporter: _getTimeRangeForBlock - block.lineIndices: ${block.lineIndices}, firstLine: ${firstLine}, lastLine: ${lastLine}`); // Закомментировано

    let startM = markers.find(m => m.lineIndex === firstLine);
    if (!startM) {
      startM = markers.find(m => m.lineIndex >= firstLine);
      if (startM) console.warn(`AudioExporter: _getTimeRangeForBlock - Точный стартовый маркер для линии ${firstLine} не найден, используем ближайший: ${startM.lineIndex} в ${startM.time.toFixed(2)}с.`);
    }

    let endM = markers.find(m => m.lineIndex > lastLine);
    if (!endM) {
      const dur = this.engine.getDuration ? this.engine.getDuration() : (this.engine.duration || 0);
      if (dur > 0) {
        endM = { time: dur };
        console.warn(`AudioExporter: _getTimeRangeForBlock - Конечный маркер для линии ${lastLine} не найден, используем общую длительность трека: ${dur.toFixed(2)}с.`);
      }
    }

    if (!startM || !endM) {
      console.error('AudioExporter: _getTimeRangeForBlock - Не удалось найти стартовый или конечный маркер.');
      return null;
    }
    
    // console.log(`AudioExporter: _getTimeRangeForBlock - Найдены маркеры: Start ${startM.time.toFixed(2)}s (line ${startM.lineIndex || 'N/A'}), End ${endM.time.toFixed(2)}s (line ${endM.lineIndex || 'N/A'}).`); // Закомментировано
    return { startTime: startM.time, endTime: endM.time };
  }


  // Получаем AudioBuffer для стемов: IndexedDB → fallback на гибридные URL
  async _getStemBuffers() {
    // console.log('AudioExporter: _getStemBuffers - Вход.'); // Закомментировано
    const srcInst = this.engine?.hybridEngine?.originalInstrumentalUrl || this.engine?.hybridEngine?.instrumentalUrl;
    const srcVoc = this.engine?.hybridEngine?.originalVocalsUrl || this.engine?.hybridEngine?.vocalsUrl;
    // console.log('AudioExporter: _getStemBuffers - Instrumental URL:', srcInst, 'Vocals URL:', srcVoc); // Закомментировано

    const [instBuf, vocBuf] = await Promise.all([
      srcInst ? this._fetchDecodeToBuffer(srcInst, 'Instrumental') : Promise.resolve(null),
      srcVoc ? this._fetchDecodeToBuffer(srcVoc, 'Vocals') : Promise.resolve(null),
    ]);
    // console.log('AudioExporter: _getStemBuffers - Декодированные буферы: Instrumental:', instBuf ? 'есть' : 'нет', 'Vocals:', vocBuf ? 'есть' : 'нет'); // Закомментировано

    const sr = (instBuf && instBuf.sampleRate) || (vocBuf && vocBuf.sampleRate) || this.sampleRate;
    // console.log('AudioExporter: _getStemBuffers - Итоговый sampleRate:', sr); // Закомментировано
    return { instBuf, vocBuf, sampleRate: sr };
  }

  async _fetchDecodeToBuffer(url, type = 'Unknown') {
    // console.log(`AudioExporter: _fetchDecodeToBuffer - Запрос и декодирование ${type} из URL:`, url); // Закомментировано
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Fetch failed ${res.status} ${res.statusText}`);
      }
      const arr = await res.arrayBuffer();
      // console.log(`AudioExporter: _fetchDecodeToBuffer - ${type} ArrayBuffer получен, размер: ${arr.byteLength} байт.`); // Закомментировано
      // маленький offline-контекст для decode
      const tmp = new OfflineAudioContext(2, 2, 44100);
      const buf = await tmp.decodeAudioData(arr);
      // console.log(`AudioExporter: _fetchDecodeToBuffer - ${type} AudioBuffer декодирован. Каналы: ${buf.numberOfChannels}, SampleRate: ${buf.sampleRate}, Длительность: ${buf.duration.toFixed(2)}s.`); // Закомментировано
      return buf;
    } catch (e) {
      console.error(`AudioExporter: _fetchDecodeToBuffer - Ошибка при получении/декодировании ${type} из ${url}:`, e);
      throw e;
    }
  }

  _makeFileName() {
    // console.log('AudioExporter: _makeFileName - Генерация имени файла...'); // Закомментировано
    const title = (window.trackCatalog?.tracks?.[window.trackCatalog.currentTrackIndex]?.title) || 'belive_export';
    // Лаконично, как просил: только название и BPM, если не 100
    const rate = this.engine.getPlaybackRate ? this.engine.getPlaybackRate() : 1.0;
    const bpmSuffix = Math.abs(rate - 1.0) < 0.001 ? '' : `__BPM${Math.round(rate * 100)}`;
    const filename = `${title}${bpmSuffix}.mp3`;
    // console.log('AudioExporter: _makeFileName - Имя файла:', filename); // Закомментировано
    return filename;
  }

  // 🎯 НОВОЕ: Метод для кодирования AudioBuffer в WAV Blob (для тестовых целей)
  _encodeWav(left, right, sampleRate) {
    const numChannels = (left && right) ? 2 : 1; // Определяем количество каналов
    const numSamples = left.length;
    const dataLength = numSamples * numChannels * 2; // 2 байта на сэмпл (Int16)
    const buffer = new ArrayBuffer(44 + dataLength); // WAV-хедер 44 байта
    const view = new DataView(buffer);

    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    let offset = 0;
    /* Chunk ID */ writeString(view, offset, 'RIFF'); offset += 4;
    /* Chunk Size */ view.setUint32(offset, 36 + dataLength, true); offset += 4;
    /* Format */ writeString(view, offset, 'WAVE'); offset += 4;
    /* Subchunk1 ID */ writeString(view, offset, 'fmt '); offset += 4;
    /* Subchunk1 Size */ view.setUint32(offset, 16, true); offset += 4;
    /* Audio Format */ view.setUint16(offset, 1, true); offset += 2;
    /* Num Channels */ view.setUint16(offset, numChannels, true); offset += 2;
    /* Sample Rate */ view.setUint32(offset, sampleRate, true); offset += 4;
    /* Byte Rate */ view.setUint32(offset, sampleRate * numChannels * 2, true); offset += 4;
    /* Block Align */ view.setUint16(offset, numChannels * 2, true); offset += 2;
    /* Bits Per Sample */ view.setUint16(offset, 16, true); offset += 2;
    /* Subchunk2 ID */ writeString(view, offset, 'data'); offset += 4;
    /* Subchunk2 Size */ view.setUint32(offset, dataLength, true); offset += 4;

    // Запись данных (Float32Array в Int16Array)
    function floatTo16BitPCM(output, offset, input) {
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    }

    floatTo16BitPCM(view, offset, left);
    if (numChannels === 2) {
      // Если стерео, чередуем сэмплы
      let lOffset = 0;
      let rOffset = 0;
      for (let i = 0; i < numSamples; i++) {
        let sL = Math.max(-1, Math.min(1, left[i]));
        let sR = Math.max(-1, Math.min(1, right[i]));
        view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true); offset += 2;
        view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true); offset += 2;
      }
    } else {
      // Если моно, просто записываем левый канал
      for (let i = 0; i < numSamples; i++) {
        let sL = Math.max(-1, Math.min(1, left[i]));
        view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true); offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  async _encodeToMp3(audioBuffer, { bitrate = 320, onProgress }) {
    // console.log('AudioExporter: _encodeToMp3 - Вход. AudioBuffer:', audioBuffer, 'Bitrate:', bitrate); // Закомментировано
    return new Promise((resolve, reject) => {
      // console.log('AudioExporter: _encodeToMp3 - Создание нового Web Worker для каждого кодирования.'); // Закомментировано
      try {
        const worker = new Worker('js/workers/mp3-encoder.worker.js');
        const CHUNK = 1152; // Стандартный блок lamejs
        const l = audioBuffer.getChannelData(0);
        const r = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : audioBuffer.getChannelData(0); // Моно -> стерео
        let pos = 0;
        const parts = [];

        const floatTo16 = (f32) => {
          const i16 = new Int16Array(f32.length);
          for (let i = 0; i < f32.length; i++) {
            let s = Math.max(-1, Math.min(1, f32[i]));
            i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          return i16;
        };

        worker.onmessage = (e) => {
          const msg = e.data || {};
          if (msg.type === 'data' && msg.buffer) {
            parts.push(new Uint8Array(msg.buffer));
          } else if (msg.type === 'done' && msg.buffer) {
            parts.push(new Uint8Array(msg.buffer));
            const out = new ArrayBuffer(parts.reduce((acc, p) => acc + p.length, 0));
            let offset = 0;
            for (const p of parts) { new Uint8Array(out, offset, p.length).set(p); offset += p.length; }
            worker.terminate();
            resolve(out);
          } else if (msg.type === 'error') {
            worker.terminate();
            reject(new Error(msg.message || 'MP3 worker error'));
          } else if (msg.type === 'progress' && onProgress) {
            onProgress(msg.progress);
          }
        };

        worker.postMessage({ type: 'init', numChannels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate, bitrate });

        const pump = () => {
          if (pos >= l.length) {
            worker.postMessage({ type: 'flush' });
            return;
          }
          const end = Math.min(l.length, pos + CHUNK);
          const l16 = floatTo16(l.subarray(pos, end));
          const r16 = floatTo16(r.subarray(pos, end));
          pos = end;
          worker.postMessage({ type: 'encode', left: l16, right: r16 }, [l16.buffer, r16.buffer]);
          // Чуть разгрузим главный поток
          setTimeout(pump, 0);
        };
        pump();

      } catch (e) {
        console.error('AudioExporter: _encodeToMp3 - Ошибка при создании или запуске Worker\'а:', e);
        reject(new Error(`Failed to create or start MP3 worker: ${e.message}`));
      }
    });
  }

  // Добавь в класс простой адаптер к вашему mp3 worker'у
  async _encodeMp3WithWorker({ left, right, sampleRate, bitrate = 320 }) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('js/workers/mp3-encoder.worker.js');
      const CHUNK = 1152 * 20; // пачками по ~20 фреймов
      const l = left;
      const r = right.length === left.length ? right : new Float32Array(left.length); // страховка на моно: если right не совпадает, создаем пустой буфер
      let pos = 0;
      const parts = [];
      let ready = false; // Флаг для рукопожатия с worker-ом

      worker.onmessage = (e) => {
        const msg = e.data || {};
        const t = msg.type || msg.command; // Поддерживаем оба
        if (t === 'inited') {
          ready = true; // Worklet готов, можно начинать pump
          pump();
        } else if (t === 'data' && msg.buffer) {
          parts.push(new Uint8Array(msg.buffer));
        } else if (t === 'done' && msg.buffer) {
          parts.push(new Uint8Array(msg.buffer));
          const out = new Blob(parts, { type: 'audio/mpeg' });
          worker.terminate();
          resolve(out);
        } else if (t === 'error') {
          worker.terminate();
          reject(new Error(msg.message || 'MP3 worker error'));
        }
      };

      // Отправляем INIT, ожидаем inited для рукопожатия
      worker.postMessage({ command: 'init', numChannels: 2, sampleRate, bitrate });

      // Используем существующий метод _floatTo16 из класса AudioExporter
      const floatTo16 = (f32) => {
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          let s = Math.max(-1, Math.min(1, f32[i]));
          i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return i16;
      };

      const pump = () => {
        if (!ready) return; // Ждем сигнала ready от worker-а
        if (pos >= l.length) {
          worker.postMessage({ command: 'flush' });
          return;
        }
        const end = Math.min(l.length, pos + CHUNK);
        const subL = l.subarray(pos, end); // Получаем подмассив
        const subR = r.subarray(pos, end); // Получаем подмассив

        if (subL.length === 0) {
          pos = end; // Передвигаем pos, чтобы избежать бесконечного цикла
          setTimeout(pump, 0); // Продолжаем pump
          return;
        }

        const l16 = floatTo16(subL);
        const r16 = floatTo16(subR);
        pos = end;
        // Теперь безопасно transfer'им, т.к. это новые буферы
        worker.postMessage({ command: 'encode', left: l16, right: r16 }, [l16.buffer, r16.buffer]);
        // Чуть разгрузим главный поток
        setTimeout(pump, 0);
      };
      // pump() вызывается после получения 'inited' от worker-а
    });
  }

  // --- MP3 Worker Управление (для exportBlocksRealtime) ---
  async _initMp3Worker(sampleRate, bitrate) {
    if (this.mp3Worker) {
      this.mp3Worker.terminate();
    }
    this.mp3Worker = new Worker('js/workers/mp3-encoder.worker.js');
    this.mp3WorkerPromise = new Promise((resolve, reject) => {
      this.mp3Worker.onmessage = (e) => {
        if (e.data.type === 'inited') {
          resolve();
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.message || 'MP3 worker init error'));
        }
      };
      this.mp3Worker.onerror = (e) => reject(new Error(e.message || 'MP3 worker error'));
      this.mp3Worker.postMessage({ type: 'init', numChannels: 2, sampleRate, bitrate });
    });
    return this.mp3WorkerPromise;
  }

  async _flushMp3Worker() {
    return new Promise((resolve, reject) => {
      if (!this.mp3Worker) return reject(new Error('MP3 worker not active.'));

      const mp3Data = [];
      this.mp3Worker.onmessage = (e) => {
        if (e.data.type === 'data' && e.data.buffer) {
          mp3Data.push(new Uint8Array(e.data.buffer));
        } else if (e.data.type === 'done' && e.data.buffer) {
          mp3Data.push(new Uint8Array(e.data.buffer));
          this.mp3Worker.terminate();
          this.mp3Worker = null;
          resolve(mp3Data);
        } else if (e.data.type === 'error') {
          this.mp3Worker.terminate();
          this.mp3Worker = null;
          reject(new Error(e.data.message || 'MP3 worker flush error'));
        }
      };
      this.mp3Worker.onerror = (e) => {
        this.mp3Worker.terminate();
        this.mp3Worker = null;
        reject(new Error(e.message || 'MP3 worker error during flush'));
      };
      this.mp3Worker.postMessage({ type: 'flush' });
    });
  }
  // --- Конец MP3 Worker Управления ---

  async _probeWorkletAndGraph(ac) {
    if (!ac) {
      ac = this.ac || this.engine.audioContext; // Используем this.ac или this.engine.audioContext
    }
    // 1) Контекст
    if (!ac) throw new Error('AudioContext not found');
    if (ac.state !== 'running') {
      try { await ac.resume(); } catch (e) {
        console.error('[Probe] resume failed', e); throw e;
      }
    }
    // 2) Модуль ворклета
    try {
      await ac.audioWorklet.addModule('js/worklets/recorder-processor.js');
    } catch (e) {
      if (!String(e.message||'').includes('already')) throw e;
    }
    // 3) Локальные, НЕ конфликтующие имена
    const probeExportSum = ac.createGain(); probeExportSum.gain.value = 1;
    const probeRecNode = new AudioWorkletNode(ac, 'recorder-processor', {
      processorOptions: { channels: 2, chunkFrames: 16384 }
    });
    this.DEBUG && console.log('[Probe] Checkpoint 3.1: probeExportSum and probeRecNode created');

    probeExportSum.connect(probeRecNode);
    this.DEBUG && console.log('[Probe] Checkpoint 3.2: probeExportSum connected to probeRecNode');

    const probeSink = ac.createGain(); probeSink.gain.value = 0;
    probeRecNode.connect(probeSink).connect(ac.destination);
    this.DEBUG && console.log('[Probe] Checkpoint 3.3: probeRecNode connected to probeSink and ac.destination');

    // Счётчики чанков
    let probeChunks = 0; let probeFrames = 0;
    const onMsg = (e) => {
      const m = e.data || {};
      if (m.type === 'chunk' && m.buffers) {
        probeChunks++;
        // длина в сэмплах: byteLength/4 для Float32Array
        probeFrames += (m.buffers[0]?.byteLength || 0) / 4;
      }
    };
    probeRecNode.port.addEventListener('message', onMsg);
    probeRecNode.port.start?.();
    // 4) Генерим короткий тон (0.3с)
    const probeOsc = ac.createOscillator();
    const probeG = ac.createGain(); probeG.gain.value = 0.12;
    probeOsc.connect(probeG).connect(probeExportSum);
    probeOsc.start();
    probeOsc.stop(ac.currentTime + 0.3);
    // ждём полсекунды
    await new Promise(r => setTimeout(r, 500));
    // 5) Очистка
    try { probeOsc.disconnect(); probeG.disconnect(); } catch(_){}
    // даём ворклету выслать хвост
    await new Promise(r => setTimeout(r, 40));
    try { probeRecNode.port.removeEventListener('message', onMsg); } catch(_){}
    try {
      probeRecNode.port.postMessage({ type:'flush' });
      await new Promise(r => setTimeout(r, 40));
      probeRecNode.port.postMessage({ type:'stop' });
      await new Promise(r => setTimeout(r, 40));
    } catch(_){}
    try { probeExportSum.disconnect(); } catch(_){}
    try { probeRecNode.disconnect(); } catch(_){}
    try { probeSink.disconnect(); } catch(_){}
    return { probeChunks, probeFrames };
  }

  /**
   * Экспортирует выбранные блоки аудио в MP3/WAV в реальном времени с бесшовными переходами.
   * Использует A/B кроссфейдинг для плавного переключения между блоками.
   * @param {object} options - Опции экспорта.
   * @param {string[]} options.blockIds - Массив ID блоков для экспорта.
   * @param {function(number):void} options.onProgress - Колбэк для обновления прогресса (0-1).
   * @param {'wav'|'mp3'} [options.format='wav'] - Формат экспортируемого файла.
   * @param {number} [options.bitrate=320] - Битрейт для MP3.
   * @param {boolean} [options.muteDuringExport=false] - Глушить ли основной плеер во время экспорта.
   * @returns {Promise<{blob: Blob, durationSec: number, sampleRate: number, channels: number, format: string, filename: string}>} - Промис с Blob файла.
   */
  async exportBlocksRealtime({ blockIds, onProgress, format = 'wav', bitrate = 320, muteDuringExport = false }) {
    // 0) Базовые ссылки, сразу наверх (чтобы не было TDZ)
    const engine = this.engine;
    if (!engine) throw new Error('[Exporter] engine not found');

    this._exportAbortController = new AbortController();
    const { signal } = this._exportAbortController;

    this.DEBUG && console.log('[Exporter] Checkpoint 0.5: this.engine at start of exportBlocksRealtime:', this.engine, 'this.engine.audioContext:', this.engine?.audioContext);

    // 🎯 НОВОЕ: Инициализируем this.ac здесь, если он еще не был инициализирован
    if (!this.ac) {
      this.ac = this.engine.audioContext;
    }
    const ac = this.ac; // Используем локальную переменную для удобства
    if (!ac) throw new Error('[Exporter] AudioContext not found');

    if (this.isExporting) {
      console.warn('AudioExporter: Экспорт уже запущен.');
      return;
    }
    this.isExporting = true;

    this.DEBUG && console.log('[Exporter] Checkpoint 1: exportBlocksRealtime called');

    // Проверка состояния AudioContext
    if (ac.state !== 'running') {
      try {
        await ac.resume();
        this.DEBUG && console.log('[Exporter] AudioContext resumed:', ac.state);
      } catch (e) {
        console.error('[Exporter] ac.resume() failed', e);
        throw e;
      }
    }

    // Запускаем probe только в DEBUG
    if (this.DEBUG) {
      try {
        this.DEBUG && console.log('[Exporter] Checkpoint 1.3: Calling _probeWorkletAndGraph');
        const { probeChunks, probeFrames } = await this._probeWorkletAndGraph(ac);
        console.log(`[Probe] chunks=${probeChunks} frames=${probeFrames}`);
        if (probeChunks === 0) console.warn('Probe returned 0 chunks — check worklet path/name later');
      } catch (e) {
        console.error('[Exporter] Checkpoint 1.4: probe error (non-fatal):', e);
        // не выбрасываем дальше — чтобы не ломать UI
      }
    }

    // 🎯 НОВОЕ: Временный возврат тестового WAV для проверки UI скачивания
    if (this.DEBUG && format === 'wav' && blockIds?.length) {
      const sr = ac.sampleRate;
      const N = Math.floor(sr * 0.5);
      const L = new Float32Array(N), R = new Float32Array(N);
      for (let i = 0; i < N; i++) { const t = i / sr; const s = Math.sin(2 * Math.PI * 440 * t) * 0.2; L[i] = s; R[i] = s; }
      // Используем приватный метод для кодирования WAV, который будет добавлен позже
      const testBlob = this._encodeWav(L, R, sr);
      console.log('[Exporter] TEST WAV created, size:', testBlob.size);
      return { blob: testBlob, durationSec: 0.5, sampleRate: sr, channels: 2, format: 'wav', filename: 'test-beep.wav' };
    }

    // Load worklet once
    try {
      await ac.audioWorklet.addModule('js/worklets/recorder-processor.js');
    } catch (e) {
      if (!String(e.message || '').includes('already')) throw e;
      this.DEBUG && console.log('[Exporter] Recorder processor already loaded');
    }

    // Сбор источников из гибридного движка и HTMLAudioElement
    const he = engine?.hybridEngine || {};
    this.DEBUG && console.log('[Exporter] Checkpoint 2.0: Hybrid Engine properties:', {
      originalInstrumentalUrl: he.originalInstrumentalUrl,
      instrumentalUrl: he.instrumentalUrl,
      engineInstrumentalAudioSrc: engine?.instrumentalAudio?.src // Используем 'engine'
    });
    const pickFirst = (...cands) => {
      for (const v of cands) if (v && typeof v === 'string' && v.trim()) return v;
      return null;
    };

    let instrumentalSrcUrl = pickFirst(
      he.originalInstrumentalUrl,
      he.instrumentalUrl,
      engine?.instrumentalAudio?.src // Используем 'engine'
    );
    let vocalsSrcUrl = pickFirst(
      he.originalVocalsUrl,
      he.vocalsUrl,
      engine?.vocalsAudio?.src // Используем 'engine'
    );

    this.DEBUG && console.log('[Exporter] Checkpoint 2.1: Initial instrumentalSrcUrl:', instrumentalSrcUrl);
    this.DEBUG && console.log('[Exporter] Checkpoint 2.2: Initial vocalsSrcUrl:', vocalsSrcUrl);

    // Важно: не кидаем сразу throw, а пытаемся подождать готовности, если есть элемент
    if (!instrumentalSrcUrl) {
      const instEl = engine?.instrumentalAudio; // Используем 'engine'
      if (instEl) {
        await new Promise(res => {
          if (instEl.readyState >= 2 && instEl.src) return res();
          const onMeta = () => { instEl.removeEventListener('loadedmetadata', onMeta); res(); };
          instEl.addEventListener('loadedmetadata', onMeta);
          // запасной таймаут на случай, если событие не придет
          setTimeout(res, 500);
        });
        // Перепроверка после ожидания
        instrumentalSrcUrl = pickFirst(
          he.originalInstrumentalUrl,
          he.instrumentalUrl,
          engine?.instrumentalAudio?.src // Используем 'engine'
        );
      }
    }

    if (!instrumentalSrcUrl) {
      console.error('[Exporter] Нет URL инструментала (hybridEngine/element).');
      this.isExporting = false;
      this._exportAbortController = null;
      throw new Error('Нет URL инструментала: источник ещё не готов. Попробуйте через 1–2 секунды.');
    }

    // Если вокала нет — просто работаем без вокала, не падаем.
    // vocalsSrcUrl уже определен или null, если не найден.

    // Создаём общий сумматор и recNode
    const exportSum = ac.createGain(); exportSum.gain.value = 1;
    const recNode = new AudioWorkletNode(ac, 'recorder-processor', {
      processorOptions: { channels: 2, chunkFrames: 16384 }
    });
    exportSum.connect(recNode);
    const sink = ac.createGain(); sink.gain.value = 0;
    recNode.connect(sink).connect(ac.destination);

    // Коллектор чанков (WAV путь)
    const chunksL = [], chunksR = [];
    recNode.port.onmessage = (e) => {
      const m = e.data||{};
      if (m.type==='chunk' && m.buffers) {
        chunksL.push(new Float32Array(m.buffers[0]));
        chunksR.push(new Float32Array(m.buffers[1]));
      }
    };

    // Подготовка MP3 Worker (перенесено из-под try/catch)
    if (format === 'mp3') {
      await this._initMp3Worker(ac.sampleRate, bitrate);
    }

    const blocks = (this.lyricsDisplay && Array.isArray(this.lyricsDisplay.textBlocks))
      ? this.lyricsDisplay.textBlocks
      : [];

    const allTextBlocks = blocks; // Используем безопасный доступ к blocks
    const blocksToExport = blockIds.map(id => allTextBlocks.find(b => String(b.id) === id)).filter(Boolean);
    if (blocksToExport.length === 0) {
      throw new Error('Нет блоков для экспорта или они не найдены.');
    }

    let totalOutSec = 0;
    let playedOutSec = 0;
    let tCursor = ac.currentTime + 0.12; // с (Safari любит 0.12) // Используем 'engine'
    const finalFadeInCurve = scaleCurve(makeSinCurve(256), 0.7);
    const finalFadeOutCurve = scaleCurve(makeCosCurve(256), 0.7);

    // Глушим основной плеер во время экспорта, если запрошено
    if (muteDuringExport) {
      if (engine.instrumentalAudio) engine.instrumentalAudio.muted = true; // Используем 'engine'
      if (engine.vocalsAudio) engine.vocalsAudio.muted = true; // Используем 'engine'
      if (this.DEBUG) console.log('AudioExporter: Основной плеер временно заглушен.');
    }

    // Пары для текущего и следующего сегментов (чередуются A/B)
    // Эти переменные теперь будут использоваться в цикле рендеринга, который будет добавлен позднее

    // 🎯 НОВОЕ: Создаём и подключаем A‑слот (упрощённо для диагностики)
    const instUrl = instrumentalSrcUrl; // Уже проверен и гарантированно не null

    // Helper function moved to global scope (createEl)
    const elA = createEl(instUrl, rate); // rate приходит из options.rate ?? 1
    await new Promise(res => { if (elA.readyState >= 2) return res(); elA.addEventListener('loadedmetadata', res, {once:true}); });
    const srcA = ac.createMediaElementSource(elA);
    const gA = ac.createGain(); gA.gain.value = (options.instrumentalGain ?? 1) * 0.8; // чуть тише
    srcA.connect(gA).connect(exportSum);

    // проиграем 1.2 секунды для пробы WAV
    try { if (elA.paused) await elA.play(); } catch(e) { console.error('elA.play failed', e); }
    await new Promise(r => setTimeout(r, 1200));

    // останавливаем, флушим ворклет
    try { elA.pause(); } catch(_){}
    recNode.port.postMessage({ type:'flush' }); await new Promise(r => setTimeout(r, 80));
    recNode.port.postMessage({ type:'stop'  }); await new Promise(r => setTimeout(r, 80));

    // конкат
    const concatF32 = (arrs)=>{ let total=0; for(const a of arrs) total+=a.length; const out=new Float32Array(total); let off=0; for(const a of arrs){ out.set(a,off); off+=a.length; } return out; };
    const L = concatF32(chunksL), R = concatF32(chunksR);

    // кодируем WAV для теста
    const wav = this._encodeWav(L, R, ac.sampleRate);
    console.log('[Exporter] WAV built from A-slot, size:', wav.size);

    // отдаём
    return { blob: wav, durationSec: L.length / ac.sampleRate, sampleRate: ac.sampleRate, channels: 2, format: 'wav', filename: 'a-slot.wav' };

    // УДАЛЕНО временно: A/B пары для текущего и следующего сегментов (чередуются A/B)
    // let currentInstPair = { el: createEl(instrumentalSrcUrl, rate), gain: ac.createGain() };
    // let nextInstPair = { el: createEl(instrumentalSrcUrl, rate), gain: ac.createGain() };
    // let currentVocPair = null;
    // let nextVocPair = null;

    // if (vocalsSrcUrl) {
    //   currentVocPair = { el: createEl(vocalsSrcUrl, rate), gain: ac.createGain() };
    //   nextVocPair = { el: createEl(vocalsSrcUrl, rate), gain: ac.createGain() };
    // }

    // const allPairs = [
    //   { el: currentInstPair.el, src: null, gain: currentInstPair.gain },
    //   { el: nextInstPair.el, src: null, gain: nextInstPair.gain },
    // ];
    // if (currentVocPair) allPairs.push({ el: currentVocPair.el, src: null, gain: currentVocPair.gain });
    // if (nextVocPair) allPairs.push({ el: nextVocPair.el, src: null, gain: nextVocPair.gain });

    // Инициализируем MediaElementSource для всех пар
    // for (const pair of allPairs) {
    //   await new Promise(res => {
    //     if (pair.el.readyState >= 2 && pair.el.src) return res();
    //     const onMeta = () => { pair.el.removeEventListener('loadedmetadata', onMeta); res(); };
    //     pair.el.addEventListener('loadedmetadata', onMeta);
    //     setTimeout(res, 500); // Запасной таймаут
    //   });
    //   pair.src = ac.createMediaElementSource(pair.el);
    //   pair.src.connect(pair.gain).connect(exportSum);
    //   pair.gain.gain.value = 0; // Изначально громкость на 0
    // }

    // Установка громкости для Gain Node
    // const originalInstGain = engine.instrumentalGainNode?.gain.value || 1;
    // const originalVocGain = engine.vocalsGainNode?.gain.value || 1;

    // try {
    //   // AudioWorklet для записи PCM
    //   // await ac.audioWorklet.addModule('js/worklets/recorder-processor.js');
    //   // if (this.DEBUG) console.log('AudioExporter: AudioWorklet module added.');

    //   // Общая шина для всех источников, идущих на запись
    //   // let exportSum = ac.createGain();
    //   // exportSum.channelCount = 2;
    //   // exportSum.channelCountMode = 'explicit';
    //   // exportSum.channelInterpretation = 'speakers';

    //   // Подключаем A/B пары к exportSum
    //   // instPair.srcA.connect(instPair.gA).connect(exportSum);
    //   // instPair.srcB.connect(instPair.gB).connect(exportSum);
    //   // if (vocPair) {
    //   //   vocPair.srcA.connect(vocPair.gA).connect(exportSum);
    //   //   vocPair.srcB.connect(vocPair.gB).connect(exportSum);
    //   // }

    //   // RecorderProcessor
    //   // let recNode = new AudioWorkletNode(ac, 'recorder-processor', {
    //   //   numberOfInputs: 1,
    //   //   numberOfOutputs: 1,
    //   //   channelCount: 2,
    //   //   channelCountMode: 'explicit',
    //   //   channelInterpretation: 'speakers',
    //   //   processorOptions: {
    //   //     channels: 2,
    //   //     chunkFrames: 16384
    //   //   }
    //   // });

    //   // Sink для скрытного прослушивания Worklet. Если не подключить, Chrome может не отдавать данные.
    //   // Важно: не подключать к ac.destination, чтобы не было слышно.
    //   // let sink = ac.createGain();
    //   // sink.gain.value = 0;
    //   // exportSum.connect(recNode).connect(sink).connect(ac.destination); // Подключаем к destination с нулевой громкостью
    //   // if (this.DEBUG) console.log('AudioExporter: RecorderProcessor и Sink подключены.');

    //   // Подготовка MP3 Worker
    //   // if (format === 'mp3') {
    //   //   await this._initMp3Worker(ac.sampleRate, bitrate);
    //   // }

    //   const allTextBlocks = engine.lyricsDisplay.textBlocks; // Используем 'engine'
    //   const blocksToExport = blockIds.map(id => allTextBlocks.find(b => String(b.id) === id)).filter(Boolean);
    //   if (blocksToExport.length === 0) {
    //     throw new Error('Нет блоков для экспорта или они не найдены.');
    //   }

    //   let totalOutSec = 0;
    //   let playedOutSec = 0;
    //   let tCursor = ac.currentTime + 0.12; // с (Safari любит 0.12) // Используем 'engine'
    //   const finalFadeInCurve = scaleCurve(makeSinCurve(256), 0.7);
    //   const finalFadeOutCurve = scaleCurve(makeCosCurve(256), 0.7);

    //   // Глушим основной плеер во время экспорта, если запрошено
    //   if (muteDuringExport) {
    //     if (engine.instrumentalAudio) engine.instrumentalAudio.muted = true; // Используем 'engine'
    //     if (engine.vocalsAudio) engine.vocalsAudio.muted = true; // Используем 'engine'
    //     if (this.DEBUG) console.log('AudioExporter: Основной плеер временно заглушен.');
    //   }

    //   // Пары для текущего и следующего сегментов (чередуются A/B)
    //   let currentInstPair = { el: createEl(instrumentalSrcUrl, rate), gain: ac.createGain() };
    //   let nextInstPair = { el: createEl(instrumentalSrcUrl, rate), gain: ac.createGain() };
    //   let currentVocPair = null;
    //   let nextVocPair = null;

    //   if (vocalsSrcUrl) {
    //     currentVocPair = { el: createEl(vocalsSrcUrl, rate), gain: ac.createGain() };
    //     nextVocPair = { el: createEl(vocalsSrcUrl, rate), gain: ac.createGain() };
    //   }

    //   const allPairs = [
    //     { el: currentInstPair.el, src: null, gain: currentInstPair.gain },
    //     { el: nextInstPair.el, src: null, gain: nextInstPair.gain },
    //   ];
    //   if (currentVocPair) allPairs.push({ el: currentVocPair.el, src: null, gain: currentVocPair.gain });
    //   if (nextVocPair) allPairs.push({ el: nextVocPair.el, src: null, gain: nextVocPair.gain });

    //   // Инициализируем MediaElementSource для всех пар
    //   for (const pair of allPairs) {
    //     await new Promise(res => {
    //       if (pair.el.readyState >= 2 && pair.el.src) return res();
    //       const onMeta = () => { pair.el.removeEventListener('loadedmetadata', onMeta); res(); };
    //       pair.el.addEventListener('loadedmetadata', onMeta);
    //       setTimeout(res, 500); // Запасной таймаут
    //     });
    //     pair.src = ac.createMediaElementSource(pair.el);
    //     pair.src.connect(pair.gain).connect(exportSum);
    //     pair.gain.gain.value = 0; // Изначально громкость на 0
    //   }

    //   // Цикл по блокам
    //   for (let i = 0; i < blocksToExport.length; i++) {
    //     if (signal.aborted) throw new Error('Экспорт отменен.');
    //     const block = blocksToExport[i];
    //     const nextBlock = blocksToExport[i + 1];
    //     const segStart = (this.markerManager._getTimeForLine(block.lineIndices[0]) || 0) / rate; // Используем _getTimeForLine
    //     const segEnd = (this.markerManager._getTimeForLine(block.lineIndices[block.lineIndices.length - 1] + 1) || (block.start_time_sec + 5) || 0) / rate; // Используем _getTimeForLine для конца блока
    //     const outDur = segEnd - segStart;
    //     if (outDur <= 0) {
    //       if (this.DEBUG) console.warn(`AudioExporter: Пропущен пустой или некорректный сегмент для блока ${block.id}`);
    //       continue;
    //     }

    //     const currentSegmentStartTime = tCursor;
    //     const currentSegmentEndTime = tCursor + outDur;

    //     // Определяем кроссфейд
    //     const actualCrossfadeSec = Math.min(30 / 1000, outDur * 0.5); // Не более половины длительности сегмента
    //     const xfadeStart = currentSegmentEndTime - actualCrossfadeSec;
    //     if (this.DEBUG) console.log(`Block ${block.id}: Seg: [${segStart.toFixed(3)}, ${segEnd.toFixed(3)}] -> Out: [${currentSegmentStartTime.toFixed(3)}, ${currentSegmentEndTime.toFixed(3)}], xfadeStart: ${xfadeStart.toFixed(3)}`);

    //     // Seek и play для текущего элемента
    //     await seekTo(currentInstPair.el, segStart);
    //     await currentInstPair.el.play();
    //     if (currentVocPair) {
    //       await seekTo(currentVocPair.el, segStart);
    //       await currentVocPair.el.play();
    //     }

    //     // Автоматизация усиления для текущего элемента (fadeOut)
    //     currentInstPair.gain.gain.setValueAtTime(0.7 * originalInstGain, currentSegmentStartTime);
    //     applyConstPower(currentInstPair.gain.gain, xfadeStart, currentSegmentEndTime, finalFadeOutCurve, ac);
    //     if (currentVocPair) {
    //       currentVocPair.gain.gain.setValueAtTime(0.7 * originalVocGain, currentSegmentStartTime);
    //       applyConstPower(currentVocPair.gain.gain, xfadeStart, currentSegmentEndTime, finalFadeOutCurve, ac);
    //     }

    //     // Подготовка следующего элемента, если он есть
    //     if (nextBlock) {
    //       const nextSegStart = (this.markerManager._getTimeForLine(nextBlock.lineIndices[0]) || 0) / rate; // Pre-seek следующего элемента
    //       await seekTo(nextInstPair.el, nextSegStart);
    //       if (nextVocPair) {
    //         await seekTo(nextVocPair.el, nextSegStart);
    //       }

    //       // Запланированный play() для следующего элемента (в pre-roll)
    //       const nextPlayTime = Math.max(ac.currentTime + 0.005, xfadeStart - (260 / 1000)); // Важно: play() может быть асинхронным, но мы не ждем его здесь, т.к. тайминг управляется setValueAtTime
    //       nextInstPair.el.play().catch(e => console.warn('Error playing next instrumental:', e));
    //       if (nextVocPair) {
    //         nextVocPair.el.play().catch(e => console.warn('Error playing next vocals:', e));
    //       }

    //       // Удержание gain=0 до начала кроссфейда для следующего элемента
    //       const holdUntilTime = Math.max(ac.currentTime + 0.005, xfadeStart - 0.002);
    //       nextInstPair.gain.gain.setValueAtTime(0, ac.currentTime);
    //       nextInstPair.gain.gain.setValueAtTime(0, holdUntilTime);
    //       if (nextVocPair) {
    //         nextVocPair.gain.gain.setValueAtTime(0, ac.currentTime);
    //         nextVocPair.gain.gain.setValueAtTime(0, holdUntilTime);
    //       }

    //       // Автоматизация усиления для следующего элемента (fadeIn)
    //       applyConstPower(nextInstPair.gain.gain, xfadeStart, currentSegmentEndTime, finalFadeInCurve, ac);
    //       if (nextVocPair) {
    //         applyConstPower(nextVocPair.gain.gain, xfadeStart, currentSegmentEndTime, finalFadeInCurve, ac);
    //       }
    //     }

    //     // Ждем завершения текущего сегмента + кроссфейда
    //     const segmentWaitTime = (currentSegmentEndTime - ac.currentTime) * 1000;
    //     if (segmentWaitTime > 0) {
    //       await wait(segmentWaitTime);
    //     }

    //     // Обновление общего времени и прогресса
    //     totalOutSec += outDur;
    //     playedOutSec += outDur;
    //     onProgress(playedOutSec / totalOutSec);

    //     // Переключение A/B пар для следующей итерации
    //     if (vocalsSrcUrl) {
    //       [currentInstPair, nextInstPair] = [nextInstPair, currentInstPair];
    //       [currentVocPair, nextVocPair] = [nextVocPair, currentVocPair];
    //     } else {
    //       // Если вокала нет, переключаем только инструментал
    //       [currentInstPair, nextInstPair] = [nextInstPair, currentInstPair];
    //     }

    //     // Обновляем tCursor для следующего сегмента
    //     tCursor = currentSegmentEndTime; // Следующий сегмент начинается сразу после предыдущего
    //     if (this.DEBUG) console.log(`AudioExporter: Завершен блок ${block.id}. Прогресс: ${(onProgress / totalOutSec * 100).toFixed(2)}%`);
    //   }

    //   // После цикла, убедимся, что последний сегмент доиграл свой fadeOut
    //   await wait(Math.max(0, (tCursor - ac.currentTime) * 1000));

    //   // Финализация worklet/encoder
    //   recNode.port.postMessage({ type: 'flush' });
    //   await wait(80);
    //   recNode.port.postMessage({ type: 'stop' });
    //   await wait(80);
    //   try { recNode.port.onmessage = null; } catch (_) {}
    //   try { exportSum.disconnect(); } catch (_) {}
    //   try { recNode.disconnect(); } catch (_) {}
    //   try { sink.disconnect(); } catch (_) {}

    //   // Очистка A/B элементов
    //   cleanupExportElements(allPairs);

    //   // Разглушаем основной плеер
    //   if (muteDuringExport) {
    //     if (engine.instrumentalAudio) engine.instrumentalAudio.muted = false;
    //     if (engine.vocalsAudio) engine.vocalsAudio.muted = false;
    //     if (this.DEBUG) console.log('AudioExporter: Основной плеер разглушен.');
    //   }

    //   // Сборка Blob
    //   let blob;
    //   if (format === 'mp3') {
    //     const mp3Data = await this._flushMp3Worker();
    //     blob = new Blob(mp3Data, { type: 'audio/mp3' });
    //   } else {
    //     // ... (логика WAV, если требуется, но сейчас фокусируемся на MP3)
    //     // Для простоты, если формат не mp3, возвращаем пустой blob или ошибку
    //     throw new Error('Поддерживается только MP3 формат экспорта.');
    //   }

    //   // Получаем название трека для имени файла
    //   const currentTrack = window.trackCatalog?.tracks?.[window.trackCatalog.currentTrackIndex];
    //   const title = currentTrack?.title || 'exported_track';
    //   const filename = this._makeFileName(title, format);

    //   this.isExporting = false;
    //   this._exportAbortController = null;
    //   if (this.DEBUG) console.log(`AudioExporter: Экспорт завершен. Файл: ${filename}, Размер: ${blob.size}`);
    //   return { blob, durationSec: totalOutSec, sampleRate: ac.sampleRate, channels: 2, format, filename };

    // } catch (e) {
    //   console.error('AudioExporter: Ошибка во время экспорта:', e);
    //   if (this.mp3Worker) {
    //     this.mp3Worker.postMessage({ type: 'flush' }); // Попытка сбросить воркер
    //     this.mp3Worker.postMessage({ type: 'close' }); // Закрыть воркер
    //     this.mp3Worker = null;
    //   }
    //   // Очистка ресурсов в случае ошибки
    //   try { if (recNode) recNode.port.postMessage({ type: 'stop' }); } catch (_) {}
    //   try { if (exportSum) exportSum.disconnect(); } catch (_) {}
    //   try { if (recNode) recNode.disconnect(); } catch (_) {}
    //   try { if (sink) sink.disconnect(); } catch (_) {}
    //   cleanupExportElements(allPairs);
    //   // Разглушаем основной плеер в случае ошибки
    //   if (muteDuringExport) {
    //     if (engine.instrumentalAudio) engine.instrumentalAudio.muted = false;
    //     if (engine.vocalsAudio) engine.vocalsAudio.muted = false;
    //   }
    //   this.isExporting = false;
    //   this._exportAbortController = null;
    //   throw e; // Пробрасываем ошибку дальше
    // } finally {
    //   // Гарантируем, что isExporting всегда сбрасывается
    //   this.isExporting = false;
    //   this._exportAbortController = null;
    // }
  }

  // Вспомогательная функция для конвертации Float32Array в Int16Array (уже существует)
  _floatTo16(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? (s * 0x8000) : (s * 0x7FFF);
    }
    return out;
  }

  // Вспомогательная функция для кодирования WAV (обновленная)
  _encodeWav(left, right, sampleRate) {
    const interleaved = new Float32Array(left.length + right.length);
    for (let i=0, j=0; i<left.length; i++, j+=2) {
      interleaved[j] = left[i];
      interleaved[j+1] = right[i] ?? 0; // Для моно-источника правый канал будет нулем
    }

    const pcm16 = this._floatTo16(interleaved); // Используем существующий метод класса

    const blockAlign = 2 * 2; // 16-bit * 2ch
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm16.byteLength;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // Вспомогательная функция для записи строки в DataView (локальная для _encodeWav)
    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF header
    writeString(view, 0, 'RIFF'); // ChunkID
    view.setUint32(4, 36 + dataSize, true); // ChunkSize
    writeString(view, 8, 'WAVE'); // Format

    // Subchunk1: Format header
    writeString(view, 12, 'fmt '); // Subchunk1ID
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat
    view.setUint16(22, 2, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // Subchunk2: Data header
    writeString(view, 36, 'data'); // Subchunk2ID
    view.setUint32(40, dataSize, true); // Subchunk2Size

    // Write the PCM data to the buffer
    new Int16Array(buffer, 44).set(pcm16);

    return new Blob([view], { type: 'audio/wav' });
  }
}

// --- Вспомогательные функции для работы с Web Audio API и кроссфейдингом ---

// 🎯 НОВОЕ: Вспомогательная функция для создания HTMLAudioElement
function createEl(srcUrl, rate = 1) {
  const el = new Audio();
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  el.playsInline = true;
  el.playbackRate = rate;
  try {
    if ('preservesPitch' in el) el.preservesPitch = true;
    if ('mozPreservesPitch' in el) el.mozPreservesPitch = true;
    if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = true;
  } catch (_) {}
  el.src = srcUrl;
  return el;
}

// Генерирует синусоидальную кривую для плавного нарастания громкости (fade-in)
function makeSinCurve(n = 256) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = Math.sin((i / (n - 1)) * Math.PI / 2); // От 0 до 1
  }
  return a;
}

// Генерирует косинусоидальную кривую для плавного затухания громкости (fade-out)
function makeCosCurve(n = 256) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = Math.cos((i / (n - 1)) * Math.PI / 2); // От 1 до 0
  }
  return a;
}

// Масштабирует кривую усиления до нужного значения
function scaleCurve(curve, gain) {
  const out = new Float32Array(curve.length);
  for (let i = 0; i < curve.length; i++) out[i] = curve[i] * gain;
  return out;
}

// Применяет кривую усиления к AudioParam, используя constant-power (sin/cos)
function applyConstPower(param, t0, t1, curve, ac) {
  const now = ac.currentTime;
  const start = Math.max(t0, now + 0.015); // Минимальная задержка 15 мс от текущего времени
  const dur = Math.max(0.015, t1 - start);

  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(start);
  } else {
    const v = param.value;
    param.cancelScheduledValues(start);
    param.setValueAtTime(v, start);
  }
  param.setValueCurveAtTime(curve, start, dur);
}

// Надежная функция seekTo для HTMLMediaElement
function seekTo(el, t) {
  return new Promise((res) => {
    if (!el) return res();
    if (Math.abs((el.currentTime || 0) - t) < 0.008) return res(); // Если уже на месте

    let done = false;
    const finish = () => { if (!done) { done = true; cleanup(); res(); } };
    const onSeeked = () => finish();
    const onTU = () => { if (Math.abs(el.currentTime - t) < 0.01) finish(); };
    const cleanup = () => {
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('timeupdate', onTU);
    };

    el.addEventListener('seeked', onSeeked, { once: true });
    el.addEventListener('timeupdate', onTU);
    el.currentTime = Math.max(0, Math.min(el.duration || t, t));
    setTimeout(finish, 300); // Страховка на случай зависания
  });
}

// Создает пару HTMLAudioElement и соответствующих узлов Web Audio API для кроссфейдинга
function createAudioPair(ac, srcUrl, rate) {
  const elA = new Audio(),
    elB = new Audio();
  [elA, elB].forEach(el => {
    el.crossOrigin = 'anonymous'; // ОЧЕНЬ ВАЖНО для CORS и Web Audio API
    el.preload = 'auto';
    el.playsInline = true;
    el.playbackRate = rate;
    try {
      if ('preservesPitch' in el) el.preservesPitch = true;
      if ('mozPreservesPitch' in el) el.mozPreservesPitch = true;
      if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = true;
    } catch (_) {}
    el.src = srcUrl;
  });

  const srcA = ac.createMediaElementSource(elA);
  const srcB = ac.createMediaElementSource(elB);
  const gA = ac.createGain();
  gA.gain.value = 0; // Изначально громкость на 0
  const gB = ac.createGain();
  gB.gain.value = 0; // Изначально громкость на 0

  return { elA, elB, srcA, srcB, gA, gB };
}

// Очистка ресурсов после экспорта
function cleanupExportElements(pairList) {
  for (const p of pairList) {
    try {
      p.srcA.disconnect();
      p.srcB.disconnect();
    } catch (_) {}
    try {
      p.gA.disconnect();
      p.gB.disconnect();
    } catch (_) {}
    [p.elA, p.elB].forEach(el => {
      try {
        el.pause();
        // Если это blob: URL, нужно revokeObjectURL (не реализовано здесь, но важно для общего случая)
        el.src = '';
        el.removeAttribute('src');
        // el.load(); // Включать только при необходимости (если CLEANUP_DETACH включен)
      } catch (_) {}
    });
  }
}

// Простая функция задержки
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Глобальный экспортёр
window.audioExporter = new AudioExporter({
  engine: window.audioEngine, // 🎯 ИСПРАВЛЕНО: Передаем как 'engine'
  markerManager: window.markerManager,
  lyricsDisplay: window.lyricsDisplay,
  blockLoopControl: window.blockLoopControl
});
