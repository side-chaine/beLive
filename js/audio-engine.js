/**
 * Audio Engine for Text application
 * Handles audio playback using single streaming HTML5 Audio (Sprint Engine).
 * Phase 1: Reliable instrumental-only playback to eliminate sync issues.
 */

class AudioEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.instrumentalGain = this.audioContext.createGain();
        this.vocalsGain = this.audioContext.createGain();
        this.microphoneGain = this.audioContext.createGain();
        
        this.instrumentalGain.connect(this.audioContext.destination);
        this.vocalsGain.connect(this.audioContext.destination);
        this.microphoneGain.connect(this.audioContext.destination);
        
        this._isPlaying = false;
        this.duration = 0;
        this.pauseTime = 0;

        // Dual streaming audio elements (Hybrid Engine)
        this.instrumentalAudio = null;
        this.vocalsAudio = null;

        // Web Audio API sources from <audio> elements
        this.instrumentalSourceNode = null;
        this.vocalsSourceNode = null;
        
        this.activeBlobUrls = [];
        
        this._onTrackLoadedCallbacks = [];
        this._onPositionUpdateCallbacks = [];
        this._positionUpdateInterval = null;
        
        this.loopActive = false;
        this.loopStart = null;
        this.loopEnd = null;
        
        this.microphoneEnabled = false;
        this.microphoneVolume = 0.7;
        this.microphoneSource = null;
        this.microphoneStream = null;
        this.microphoneGain.gain.value = this.microphoneVolume;
        
        console.log("🚀 AudioEngine (Hybrid Engine) - Гибридная архитектура восстановлена");
        this._setupEventListeners();

        // Служебные структуры для синхронизации
        this._syncNudgeInterval = null;   // периодические мелкие коррекции времени
        this._seekInProgress = false;     // барьер seek
        this._lastSeekTime = 0;           // последний момент seek

        // Колбэки завершения обоих потоков
        this._onBothEndedCallbacks = [];
    }

    // ===== МИКРОФОН: управление разрешениями и состоянием =====
    async enableMicrophone() {
        try {
            if (this.microphoneEnabled) { return { enabled: true, volume: this.microphoneVolume }; }
            // Храним один stream во всём приложении, чтобы не было повторных запросов
            if (!this.microphoneStream) {
                this.microphoneStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });
            }
            if (!this.microphoneSource) {
                this.microphoneSource = this.audioContext.createMediaStreamSource(this.microphoneStream);
            }
            try { this.microphoneSource.disconnect(); } catch(_) {}
            this.microphoneSource.connect(this.microphoneGain);
            this.microphoneEnabled = true;
            this._emitMicState();
            return { enabled: true, volume: this.microphoneVolume };
        } catch (e) {
            console.warn('Microphone enable failed:', e);
            this.microphoneEnabled = false;
            this._emitMicState();
            throw e;
        }
    }

    disableMicrophone() {
        try {
            // Не останавливаем stream, чтобы Chrome не спрашивал разрешение заново
            try { this.microphoneSource && this.microphoneSource.disconnect(); } catch(_) {}
        } finally {
            this.microphoneEnabled = false;
            this._emitMicState();
        }
    }

    toggleMicrophone() {
        return this.microphoneEnabled ? (this.disableMicrophone(), { enabled: false, volume: this.microphoneVolume }) : this.enableMicrophone();
    }

    setMicrophoneVolume(volume) {
        this.microphoneVolume = Math.max(0, Math.min(1, volume));
        if (this.microphoneGain) { this.microphoneGain.gain.value = this.microphoneVolume; }
        this._emitMicState();
    }

    getMicrophoneState() {
        return { enabled: !!this.microphoneEnabled, volume: this.microphoneVolume };
    }

    _emitMicState() {
        const evt = new CustomEvent('microphone-state-changed', { detail: { enabled: !!this.microphoneEnabled, volume: this.microphoneVolume } });
        document.dispatchEvent(evt);
    }
    
    _setupEventListeners() {
        // This method sets up the space bar handler
        this.boundSpaceHandler = this._handleSpaceBar.bind(this);
        document.addEventListener('keydown', this.boundSpaceHandler);
        console.log("Space bar handler attached");
    }
    
    _handleSpaceBar(event) {
        // Only handle spacebar when we're not in an input field
        console.log("Key pressed:", event.code);
        
        if (event.code === 'Space' && 
            !event.shiftKey &&
            event.target.tagName !== 'INPUT' && 
            event.target.tagName !== 'TEXTAREA') {
            
            event.preventDefault();
            console.log("Space bar pressed, toggling playback");
            
            // Toggle play/pause
            if (this._isPlaying) {
                this.pause();
            } else if (this.instrumentalAudio) { // Check if a track is loaded
                this.play();
            }
        }
    }
    
    /**
     * Add event listener for track loaded event
     * @param {Function} callback - Function to call when track is loaded
     */
    onTrackLoaded(callback) {
        if (typeof callback === 'function') {
            this._onTrackLoadedCallbacks.push(callback);
        }
    }
    
    /**
     * Add event listener for position update events
     * @param {Function} callback - Function to call with the current position
     */
    onPositionUpdate(callback) {
        if (typeof callback === 'function') {
            this._onPositionUpdateCallbacks.push(callback);
            
            // Start position update interval if not already running
            this._startPositionUpdateInterval();
        }
    }
    
    /**
     * Remove event listener
     * @param {string} eventType - Event type ('trackLoaded' or 'positionUpdate')
     * @param {Function} callback - The callback to remove
     */
    removeEventListener(eventType, callback) {
        if (eventType === 'trackLoaded') {
            this._onTrackLoadedCallbacks = this._onTrackLoadedCallbacks.filter(cb => cb !== callback);
        } else if (eventType === 'positionUpdate') {
            this._onPositionUpdateCallbacks = this._onPositionUpdateCallbacks.filter(cb => cb !== callback);
            
            // Stop interval if no listeners remain
            if (this._onPositionUpdateCallbacks.length === 0) {
                this._stopPositionUpdateInterval();
            }
        }
    }
    
    /**
     * Start interval to update position
     * @private
     */
    _startPositionUpdateInterval() {
        if (this._positionUpdateInterval) {return;}
        
        this._positionUpdateInterval = setInterval(() => {
            const currentTime = this.getCurrentTime();
            
            this._onPositionUpdateCallbacks.forEach(callback => {
                try {
                    callback(currentTime);
                } catch (e) {
                    console.error('Error in position update callback:', e);
                }
            });
        }, 50); // Update every 50ms
    }
    
    /**
     * Stop position update interval
     * @private
     */
    _stopPositionUpdateInterval() {
        if (this._positionUpdateInterval) {
            clearInterval(this._positionUpdateInterval);
            this._positionUpdateInterval = null;
        }
    }
    
    /**
     * Notify track loaded callbacks
     * @private
     */
    _notifyTrackLoaded() {
        const detail = {
            duration: this.duration,
            hasVocals: false
        };
        
        const event = new CustomEvent('track-loaded', { detail });
        document.dispatchEvent(event);
        
        this._onTrackLoadedCallbacks.forEach(callback => {
            try {
                callback(detail);
            } catch (e) {
                console.error('Error in track loaded callback:', e);
            }
        });
    }

    /**
     * Подписка на завершение обоих потоков (инструментал + вокал)
     * @param {Function} callback
     */
    onBothEnded(callback) {
        if (typeof callback === 'function') {
            this._onBothEndedCallbacks.push(callback);
        }
        return () => {
            this._onBothEndedCallbacks = this._onBothEndedCallbacks.filter(cb => cb !== callback);
        };
    }

    _emitBothEndedOnce() {
        try {
            this._onBothEndedCallbacks.forEach(cb => {
                try { cb(); } catch (e) { console.warn('onBothEnded callback error', e); }
            });
        } catch(_) {}
    }
    
    /**
     * Load a track into the audio engine using hybrid streaming.
     * Instrumental loads first for quick start, vocals load in parallel.
     * @param {string} instrumentalUrl - URL to instrumental audio file
     * @param {string} vocalsUrl - URL to vocals audio file
     * @returns {Promise} - Resolves with track info when instrumental is loaded
     */
    async loadTrack(instrumentalUrl, vocalsUrl = null) {
        console.log('🚀 ГИБРИД: Загрузка двойного потока');
        console.time('⏱️ HYBRID_ENGINE_LOAD_TIME');

        this.stop(); // Stop any previous track

        // Create instrumental audio element (priority)
        this.instrumentalAudio = new Audio();
        this.instrumentalAudio.crossOrigin = "anonymous";

        // Track blob URLs for cleanup
        if (instrumentalUrl.startsWith('blob:')) {this.activeBlobUrls.push(instrumentalUrl);}

        // Create a promise that resolves when the instrumental is ready to play
        const instrumentalReadyPromise = new Promise((resolve, reject) => {
            this.instrumentalAudio.addEventListener('loadedmetadata', () => {
                this.duration = this.instrumentalAudio.duration;
                console.log(`✅ ИНСТРУМЕНТАЛ ГОТОВ! Длительность: ${this.duration.toFixed(2)}с`);
                resolve();
            });
            this.instrumentalAudio.addEventListener('error', (e) => {
                console.error("❌ Ошибка загрузки инструментала:", e);
                reject('Instrumental loading failed');
            });
        });

        // Set source to start loading instrumental
        this.instrumentalAudio.src = instrumentalUrl;

        // Создаем безопасные URL для WaveformEditor СРАЗУ
        const safeInstrumentalUrl = await this._createSafeUrlFromOriginal(instrumentalUrl);
        let safeVocalsUrl = null;
        
        if (vocalsUrl) {
            safeVocalsUrl = await this._createSafeUrlFromOriginal(vocalsUrl);
        }

        // Инициализируем hybridEngine с безопасными URL
        this.hybridEngine = {
            instrumentalUrl: safeInstrumentalUrl,  // Безопасный URL для WaveformEditor
            vocalsUrl: safeVocalsUrl,             // Безопасный URL для WaveformEditor
            originalInstrumentalUrl: instrumentalUrl,  // Исходный URL для воспроизведения
            originalVocalsUrl: vocalsUrl              // Исходный URL для воспроизведения
        };

        // Перед созданием новых источников — мягко отключим старый вокал (если был)
        try {
            if (this.vocalsSourceNode) {
                this.vocalsSourceNode.disconnect();
            }
        } catch(_) {}
        this.vocalsSourceNode = null;
        this.vocalsAudio = null;

        // Load vocals in parallel if provided
        let vocalsReadyPromise = Promise.resolve();
        
            if (vocalsUrl) {
            this.vocalsAudio = new Audio();
            this.vocalsAudio.crossOrigin = "anonymous";
            
            if (vocalsUrl.startsWith('blob:')) {this.activeBlobUrls.push(vocalsUrl);}

            vocalsReadyPromise = new Promise((resolve, reject) => {
                this.vocalsAudio.addEventListener('error', (e) => {
                    console.error("❌ Ошибка загрузки вокала:", e);
                    console.warn("🎯 Переходим в instrumental-only режим");
                    
                    // Очищаем неработающий вокальный элемент
                    this.vocalsAudio = null;
                    this.vocalsSourceNode = null;
                    
                    // Уведомляем систему о fallback режиме ТОЛЬКО при ошибке
                    if (window.app && window.app.showVocalError) {
                        window.app.showVocalError("Вокальная дорожка недоступна. Режим: только инструментал.");
                    }
                    
                    // Resolve для продолжения работы в instrumental-only
                    resolve({ mode: 'instrumental-only', hasVocals: false });
                });
                
                // 🔧 НОВОЕ: Обработчик успешной загрузки вокала
                this.vocalsAudio.addEventListener('loadedmetadata', () => {
                    console.log(`✅ ВОКАЛ ГОТОВ! Длительность: ${this.vocalsAudio.duration.toFixed(2)}с`);
                    
                    // Активируем вокальный слайдер при успешной загрузке
                    if (window.app && window.app.enableVocalControls) {
                        window.app.enableVocalControls();
                    }
                    
                    resolve({ mode: 'dual-track', hasVocals: true });
                });
            });

            // Воспроизведение: избегаем blob:null, используем безопасный URL как fallback
            let playbackVocalsUrl = vocalsUrl;
            if (playbackVocalsUrl.startsWith('blob:null') && safeVocalsUrl) {
                playbackVocalsUrl = safeVocalsUrl;
            }
            this.vocalsAudio.src = playbackVocalsUrl;

            // Таймаут на случай молчаливой неудачи: переключаемся на безопасный URL
            if (safeVocalsUrl && safeVocalsUrl !== playbackVocalsUrl) {
                setTimeout(() => {
                    try {
                        if (this.vocalsAudio && this.vocalsAudio.readyState < 1) {
                            console.warn('⏳ Вокал не загрузился вовремя, переключаемся на безопасный data URL');
                            this.vocalsAudio.src = safeVocalsUrl;
                        }
                    } catch(_) {}
                }, 1200);
            }
        }

        // Wait for instrumental to be ready (vocals can load in background)
        await instrumentalReadyPromise;

        // Connect to Web Audio API
        if (!this.instrumentalSourceNode) {
            this.instrumentalSourceNode = this.audioContext.createMediaElementSource(this.instrumentalAudio);
            this.instrumentalSourceNode.connect(this.instrumentalGain);
        }

        // Connect vocals when ready (non-blocking)
        if (vocalsUrl && this.vocalsAudio) {
            vocalsReadyPromise.then((result) => {
                // 🔧 ИСПРАВЛЕНО: Проверяем что вокал реально загрузился
                if (!this.vocalsSourceNode && this.vocalsAudio && this.vocalsAudio.src) {
                    try {
                        this.vocalsSourceNode = this.audioContext.createMediaElementSource(this.vocalsAudio);
                        this.vocalsSourceNode.connect(this.vocalsGain);
                        console.log('🎤 ВОКАЛ ПОДКЛЮЧЕН к аудио-контексту');
                    } catch (error) {
                        console.error('❌ Ошибка подключения вокала к Web Audio:', error);
                        this.vocalsAudio = null;
                        this.vocalsSourceNode = null;
                    }
                } else if (result && result.mode === 'instrumental-only') {
                    console.log('🎯 Режим instrumental-only активирован');
                }
            }).catch((error) => {
                console.error('❌ Критическая ошибка загрузки вокала:', error);
                this.vocalsAudio = null;
                this.vocalsSourceNode = null;
            });
        }

        console.timeEnd('⏱️ HYBRID_ENGINE_LOAD_TIME');
        console.log('🎯 ГИБРИД: Рассинхронизация устранена!');

            this._notifyTrackLoaded();
            
            // Навешиваем завершение: основной триггер — окончание инструментала
            if (this.instrumentalAudio) {
                this.instrumentalAudio.onended = () => {
                    const tryEmit = () => {
                        const vocalsDone = !this.vocalsAudio || this.vocalsAudio.ended || (this.vocalsAudio.readyState >= 2 && Math.abs((this.vocalsAudio.duration || 0) - (this.vocalsAudio.currentTime || 0)) < 0.25);
                        if (vocalsDone) {
                            this._emitBothEndedOnce();
                        } else if (this.vocalsAudio) {
                            const once = () => { this.vocalsAudio?.removeEventListener('ended', once); this._emitBothEndedOnce(); };
                            this.vocalsAudio.addEventListener('ended', once, { once: true });
                        } else {
                            this._emitBothEndedOnce();
                        }
                    };
                    tryEmit();
                };
            }
            
            return {
            duration: this.duration,
            hasVocals: !!vocalsUrl
        };
    }
    
    /**
     * Get audio data (not applicable for streaming version, returns null)
     */
    getAudioData(useVocals = true) {
        console.warn('getAudioData is not supported in streaming mode.');
        return null;
    }
    
    /**
     * Get audio buffer (not applicable for streaming version, returns null)
     */
    getAudioBuffer(useVocals = true) {
        console.warn('getAudioBuffer is not supported in streaming mode.');
        return null;
    }
    
    hasVocals() {
        // Phase 1: Always false since we only load instrumental
        return false;
    }
    
    /**
     * Возвращает длительность текущего трека (секунды)
     * Безопасный fallback: сперва internal duration, затем из audio элемента
     */
    getDuration() {
        if (typeof this.duration === 'number' && this.duration > 0) {
            return this.duration;
        }
        if (this.instrumentalAudio && typeof this.instrumentalAudio.duration === 'number') {
            return this.instrumentalAudio.duration || 0;
        }
        return 0;
    }

    /**
     * Set loop points for playback
     * @param {number} startTime - start time in seconds
     * @param {number} endTime - end time in seconds
     */
    setLoop(startTime, endTime) {
        try {
            // Проверяем валидность входных данных
            if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime <= startTime) {
                console.warn(`AudioEngine: Invalid loop points: ${startTime}s - ${endTime}s`);
            return false;
        }
        
            // Ограничиваем точки зацикливания длительностью трека
            const safeStartTime = Math.max(0, Math.min(startTime, this.duration));
            const safeEndTime = Math.min(endTime, this.duration);
            
            console.log(`AudioEngine: Loop points set to ${safeStartTime.toFixed(2)}s - ${safeEndTime.toFixed(2)}s`);
            
            // Устанавливаем точки зацикливания
            this.loopStart = safeStartTime;
            this.loopEnd = safeEndTime;
            
            // Сбрасываем счетчик ошибок
            this.loopErrors = 0;
            
            // Устанавливаем обработчик для проверки зацикливания
        this._setupLoopCheck();
        
            // Отправляем событие об установке зацикливания
            const event = new CustomEvent('loop-set', {
                detail: {
                    startTime: safeStartTime,
                    endTime: safeEndTime
                }
            });
            document.dispatchEvent(event);
        
        return true;
        } catch (error) {
            console.error('AudioEngine: Error setting loop:', error);
            return false;
        }
    }
    
    /**
     * Очищает точки зацикливания
     */
    clearLoop() {
        console.log('AudioEngine: Clearing loop');
        
        try {
            // Сбрасываем точки зацикливания
            this.loopStart = null;
            this.loopEnd = null;
            
            // Если есть активные источники, обновляем их состояние
            if (this.instrumentalSourceNode) {
                this.instrumentalSourceNode.disconnect();
            }
            
            // Сбрасываем счетчики ошибок
            this.loopErrors = 0;
            
            // Отправляем событие о сбросе зацикливания
            const event = new CustomEvent('loop-cleared', {
                detail: {
                    time: this.getCurrentTime()
                }
            });
            document.dispatchEvent(event);
            
            return true;
        } catch (error) {
            console.error('AudioEngine: Error clearing loop:', error);
            return false;
        }
    }
    
    /**
     * Sets up the loop check interval
     * @private
     */
    _setupLoopCheck() {
        if (this._loopCheckInterval) {
            clearInterval(this._loopCheckInterval);
            this._loopCheckInterval = null;
        }
        
        // Проверяем состояние цикла каждые 50 мс
        this._loopCheckInterval = setInterval(() => {
            if (!this._isPlaying) {
                return;
            }
            
            try {
                const currentTime = this.getCurrentTime();
                
                // Пропускаем проверку, если недавно был выполнен переход
                if (this._lastSeekTime && (Date.now() - this._lastSeekTime) < 300) {
                    return;
                }
                
                // Если вышли за пределы цикла, возвращаемся в начало
                if (currentTime >= this.loopEnd - 0.01) {
                    // Проверка на null перед вызовом toFixed
                    const currentTimeStr = currentTime ? currentTime.toFixed(2) : '0.00';
                    const loopStartStr = this.loopStart ? this.loopStart.toFixed(2) : '0.00';
                    
                    console.log(`Loop triggered at ${currentTimeStr}s, returning to ${loopStartStr}s`);
                    this._lastSeekTime = Date.now();
                    this.setCurrentTime(this.loopStart);
                    
                    // Отправляем событие о срабатывании цикла
                    this._dispatchLoopEvent(currentTime, this.loopStart);
                }
            } catch (error) {
                console.error('AudioEngine: Error in loop check:', error);
            }
        }, 50);
    }
    
    /**
     * Отправляет событие о срабатывании цикла
     * @param {number} fromTime - Время до зацикливания
     * @param {number} toTime - Время после зацикливания
     * @private
     */
    _dispatchLoopEvent(fromTime, toTime) {
        const event = new CustomEvent('loopcompleted', {
            detail: {
                previousTime: fromTime,
                newTime: toTime,
                loopStart: this.loopStart,
                loopEnd: this.loopEnd
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Play the current track (instrumental + vocals in sync)
     * @returns {Promise} - Resolves when playback starts
     */
    async play() {
        if (!this.instrumentalAudio) {
            console.warn('⚠️ Нет загруженного трека');
            return;
        }
        
        try {
            // Ensure audio context is resumed
        if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Play instrumental first (master timing)
            await this.instrumentalAudio.play();
            console.log('▶️ ИНСТРУМЕНТАЛ: Воспроизведение начато');

            // Попытаться безопасно стартовать вокал в синхрон
            await this._ensureVocalsPlayingSync();

            this.isPlaying = true;
            this._notifyPlaybackStateChanged();
            
            // Запускаем периодические мелкие коррекции синхрона
            this._startSyncNudger();
            
        } catch (error) {
            console.error('❌ Ошибка воспроизведения:', error);
            throw error;
        }
    }
    
    /**
     * Pause the current track (both streams)
     */
    pause() {
        if (this.instrumentalAudio) {
            this.instrumentalAudio.pause();
            console.log('⏸️ ИНСТРУМЕНТАЛ: Пауза');
        }
        
        if (this.vocalsAudio) {
            this.vocalsAudio.pause();
            console.log('⏸️ ВОКАЛ: Пауза');
        }

        this.isPlaying = false;
        this._notifyPlaybackStateChanged();
        if (this._syncNudgeInterval) { clearInterval(this._syncNudgeInterval); this._syncNudgeInterval = null; }
    }
    
    /**
     * Stop playback and reset position
     */
    stop() {
        if (this.instrumentalAudio) {
            this.instrumentalAudio.pause();
            this.instrumentalAudio.currentTime = 0;
        }
        
        if (this.vocalsAudio) {
            this.vocalsAudio.pause();
            this.vocalsAudio.currentTime = 0;
        }

        this.isPlaying = false;
        this._notifyPlaybackStateChanged();
        console.log('⏹️ ГИБРИД: Остановлен и сброшен');
        if (this._syncNudgeInterval) { clearInterval(this._syncNudgeInterval); this._syncNudgeInterval = null; }
    }
    
    /**
     * Get current playback position in seconds
     * @returns {number} Current time in seconds
     */
    getCurrentTime() {
        return this.instrumentalAudio ? this.instrumentalAudio.currentTime : 0;
    }
    
    /**
     * Set playback position
     * @param {number} time - Time in seconds
     */
    setCurrentTime(time) {
        if (this.instrumentalAudio) {
            this._seekInProgress = true;
            this._lastSeekTime = Date.now();
            this.instrumentalAudio.currentTime = time;
            // Sync vocals if available
            if (this.vocalsAudio) { this.vocalsAudio.currentTime = time; }
            // Финальная фиксация через короткую задержку
            setTimeout(() => {
                try {
                    if (this.instrumentalAudio) {
                        const t = this.instrumentalAudio.currentTime;
                        if (this.vocalsAudio && Math.abs((this.vocalsAudio.currentTime || 0) - t) > 0.05) {
                            this.vocalsAudio.currentTime = t;
                        }
                    }
                } finally {
                    this._seekInProgress = false;
                }
            }, 120);
            console.log(`⏰ СИНХРО: Позиция установлена ${time.toFixed(2)}с`);
        }
    }
    
    _dispatchPositionChangedEvent(previousTime, newTime) {
            const event = new CustomEvent('audio-position-changed', {
                detail: {
                    previousTime: previousTime,
                newTime: newTime
                }
            });
            document.dispatchEvent(event);
        
        // Добавляем стандартное событие timeupdate для лучшей совместимости
        const timeupdateEvent = new CustomEvent('timeupdate', {
            detail: {
                currentTime: newTime
        }
        });
        document.dispatchEvent(timeupdateEvent);
    }
    
    // Make isPlaying available as a property for compatibility
    get isPlaying() {
        return this._isPlaying === true;
    }
    
    set isPlaying(value) {
        this._isPlaying = value === true;
        console.log(`isPlaying property set to: ${this._isPlaying}`);
    }
    
    /**
     * Set vocals volume (0.0 to 1.0)
     * @param {number} volume - Volume level (0.0 = muted, 1.0 = full)
     */
    setVocalsVolume(volume) {
        if (this.vocalsGain) {
            this.vocalsGain.gain.value = Math.max(0, Math.min(1, volume));
            console.log(`🎤 ВОКАЛ: Громкость установлена ${(volume * 100).toFixed(0)}%`);
        }
    }
    
    /**
     * Set instrumental volume (0.0 to 1.0)
     * @param {number} volume - Volume level (0.0 = muted, 1.0 = full)
     */
    setInstrumentalVolume(volume) {
        if (this.instrumentalGain) {
            this.instrumentalGain.gain.value = Math.max(0, Math.min(1, volume));
            console.log(`🎵 ИНСТРУМЕНТАЛ: Громкость установлена ${(volume * 100).toFixed(0)}%`);
        }
    }
    
    /**
     * Update the play/pause button text based on current state
     */
    _updatePlayPauseButton() {
        const playPauseButton = document.getElementById('play-pause');
        if (playPauseButton) {
            playPauseButton.textContent = this._isPlaying ? 'Pause' : 'Play';
            if(this.instrumentalAudio){
                 playPauseButton.disabled = false;
                } else {
                 playPauseButton.disabled = true;
            }
        }
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        this.stop();
        this.removeEventListener('keydown', this.boundSpaceHandler);
        
        // Revoke old blob URLs
        this.activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
        this.activeBlobUrls = [];
        
        // Disconnect media element source
        if (this.instrumentalSourceNode) {
            this.instrumentalSourceNode.disconnect();
        }
        this.instrumentalAudio = null;
        this.instrumentalSourceNode = null;
        
        console.log('🧹 СПРИНТЕР: Ресурсы очищены');
    }

    /**
     * Seek to a specific time in the track
     * @param {number} time - The time to seek to in seconds
     */
    seekTo(time) {
        this.setCurrentTime(time);
    }

    /**
     * Resets the audio engine to its initial state
     */
    reset() {
        console.log('AudioEngine: Starting reset...');
        this.cleanup(); // Use cleanup to stop and disconnect
        
        this._isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.duration = 0;
        
        this.loopActive = false;
        this.loopStart = null;
        this.loopEnd = null;

        console.log('AudioEngine: Reset completed successfully');
    }

    /**
     * Caching logic is not used in streaming mode. These are stubs.
     */
    getCacheStats() {
        console.warn('Caching is not used in streaming mode.');
        return { hits: 0, misses: 0, size: 0 };
    }

    clearCache() {
        console.warn('Caching is not used in streaming mode.');
    }

    _notifyPlaybackStateChanged() {
        // Notify listeners about playback state changes
        const event = new CustomEvent('playback-state-changed', {
            detail: {
                isPlaying: this.isPlaying,
                currentTime: this.getCurrentTime(),
                duration: this.duration
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Set playback rate (speed) for both audio streams
     * @param {number} rate - Playback rate (0.5 = half speed, 1.0 = normal, 2.0 = double speed)
     */
    setPlaybackRate(rate) {
        // Validate rate (clamp between 0.25 and 4.0)
        const clampedRate = Math.max(0.25, Math.min(4.0, rate));
        
        if (this.instrumentalAudio) {
            this.instrumentalAudio.playbackRate = clampedRate;
            console.log(`🎵 ИНСТРУМЕНТАЛ: Скорость установлена ${(clampedRate * 100).toFixed(0)}%`);
        }
        
        if (this.vocalsAudio) {
            this.vocalsAudio.playbackRate = clampedRate;
            console.log(`🎤 ВОКАЛ: Скорость установлена ${(clampedRate * 100).toFixed(0)}%`);
        }
        
        // Notify about playback rate change
        const event = new CustomEvent('playback-rate-changed', {
            detail: { rate: clampedRate }
        });
        document.dispatchEvent(event);
        
        console.log(`⚡ BPM: Скорость воспроизведения ${(clampedRate * 100).toFixed(0)}%`);
    }
    
    /**
     * Get current playback rate
     * @returns {number} Current playback rate
     */
    getPlaybackRate() {
        if (this.instrumentalAudio) {
            return this.instrumentalAudio.playbackRate;
        }
        return 1.0;
    }

    /**
     * Захватывает аудиопоток из AudioContext.destination
     * @returns {MediaStream} - Захваченный аудиопоток.
     */
    captureStream() {
        if (!this.streamDestination) {
            this.streamDestination = this.audioContext.createMediaStreamDestination();
            
            // Подключаем все нужные узлы к этому назначению
            if (this.instrumentalGain) {this.instrumentalGain.connect(this.streamDestination);}
            if (this.vocalsGain) {this.vocalsGain.connect(this.streamDestination);}
            // Не подключаем микрофон, если не хотим его записывать
            // if (this.microphoneGain) this.microphoneGain.connect(this.streamDestination);
        }
        return this.streamDestination.stream;
    }
    
    /**
     * Создает безопасный URL из исходного blob URL для WaveformEditor
     * @param {string} originalUrl - исходный URL (может быть blob:null)
     * @returns {Promise<string>} - безопасный URL
     * @private
     */
    async _createSafeUrlFromOriginal(originalUrl) {
        try {
            if (!originalUrl) {return null;}
            
            // Если это не blob URL или это корректный blob URL, возвращаем как есть
            if (!originalUrl.startsWith('blob:') || !originalUrl.includes('blob:null/')) {
                return originalUrl;
            }
            
            console.log(`🔧 БЕЗОПАСНЫЙ URL: Конвертируем blob:null в data URL: ${originalUrl.substring(0, 50)}...`);
            
            // Загружаем данные из blob:null URL
            const response = await fetch(originalUrl);
            const blob = await response.blob();
            
            // Создаем data URL как fallback
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    console.log(`✅ БЕЗОПАСНЫЙ URL: Создан data URL размером ${blob.size} байт`);
                    resolve(reader.result);
                };
                reader.onerror = () => reject(new Error('Failed to create data URL from blob'));
                reader.readAsDataURL(blob);
            });
            
        } catch (error) {
            console.error('❌ БЕЗОПАСНЫЙ URL: Ошибка конвертации:', error);
            return originalUrl; // Возвращаем исходный URL в случае ошибки
        }
    }

    // ====== ВНУТРЕННИЙ СИНХРОНИЗАТОР ======
    async _ensureVocalsPlayingSync(retries = 3) {
        if (!this.vocalsAudio) { return false; }
        try {
            if (!this.vocalsSourceNode && this.vocalsAudio.readyState >= 2) {
                this.vocalsSourceNode = this.audioContext.createMediaElementSource(this.vocalsAudio);
                this.vocalsSourceNode.connect(this.vocalsGain);
                console.log('🎤 ВОКАЛ ПОДКЛЮЧЕН (ensure)');
            }
        } catch (e) {
            console.warn('⚠️ Не удалось подключить вокал к AudioContext:', e);
        }
        if (this.vocalsAudio.readyState < 2) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 200));
                return this._ensureVocalsPlayingSync(retries - 1);
            }
            return false;
        }
        try {
            this.vocalsAudio.currentTime = this.instrumentalAudio ? this.instrumentalAudio.currentTime : 0;
            await this.vocalsAudio.play();
            console.log('🎤 ВОКАЛ: Синхронизирован и воспроизводится');
            if (window.app && window.app.enableVocalControls) {
                window.app.enableVocalControls();
            }
            return true;
        } catch (err) {
            if (retries > 0) {
                console.warn('🔁 Повтор старта вокала...', err?.name || err);
                await new Promise(r => setTimeout(r, 300 * (4 - retries)));
                return this._ensureVocalsPlayingSync(retries - 1);
            }
            console.warn('⚠️ Вокал не запущен после ретраев');
            return false;
        }
    }

    _startSyncNudger() {
        if (this._syncNudgeInterval) { clearInterval(this._syncNudgeInterval); }
        this._syncNudgeInterval = setInterval(() => {
            try {
                if (!this._isPlaying || !this.instrumentalAudio) { return; }
                if (!this.vocalsAudio) { return; }
                // Не корректируем во время активного seek
                if (this._seekInProgress) { return; }
                const a = this.instrumentalAudio.currentTime || 0;
                const v = this.vocalsAudio.currentTime || 0;
                const delta = v - a;
                if (Math.abs(delta) > 0.09) {
                    this.vocalsAudio.currentTime = a + 0.01;
                }
                // Если вокал по какой-то причине остановился — перезапустим тихо
                if (!this.vocalsAudio.paused && !this.instrumentalAudio.paused) { return; }
                if (!this.vocalsAudio.paused && this.instrumentalAudio.paused) { return; }
                if (this.instrumentalAudio && !this.instrumentalAudio.paused && this.vocalsAudio && this.vocalsAudio.paused) {
                    this._ensureVocalsPlayingSync(1);
                }
            } catch(_) {}
        }, 200);
    }
}

// Create global audio engine instance
const audioEngine = new AudioEngine(); 
window.audioEngine = audioEngine; 