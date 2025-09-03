/**
 * LoopBlock Manager for Text application
 * Handles the visualization and interaction with loop blocks on the transport bar
 */

class LoopBlockManager {
    constructor(audioEngine, lyricsDisplay, progressBarContainer) {
        this.audioEngine = audioEngine;
        this.lyricsDisplay = lyricsDisplay;
        this.progressBarContainer = progressBarContainer;
        
        this.blocks = [];
        this.isActive = false;
        this.selectedBlock = null; // Текущий выбранный блок
        this.selectedBlocks = []; // Массив выбранных блоков для последовательного воспроизведения
        this.activeLoopBlock = null; // Текущий активный блок для зацикливания
        this.isLooping = false; // Флаг зацикленного воспроизведения
        this.currentLoopIndex = 0; // Индекс текущего блока в последовательности
        this.isShiftPressed = false; // Флаг нажатия клавиши Shift
        this.sequenceLooping = false; // Зацикливание последовательности блоков
        this.currentSequenceIndex = 0; // Индекс текущего блока в последовательности
        this.loopCheckInterval = null; // Интервал для проверки зацикливания
        this.timeUpdateHandler = null; // Хранить обработчик события для возможности удаления
        this.audioInitChecks = 0; // Счетчик проверок инициализации аудио
        
        this.dragMode = null; // 'move', 'resize-left', 'resize-right'
        this.dragStartX = 0;
        this.dragStartWidth = 0;
        this.dragStartLeft = 0;
        
        // Сохраняем оригинальный обработчик клика прогресс-бара
        this.originalClickHandler = null;
        
        // Добавляем обработчики для клавиш Shift/Ctrl
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
        
        // Анализ состояния аудио и установка обработчиков для проверки загрузки
        this._checkAudioAndInitialize();
        
        // Инициализируем обработчики событий для синхронизации с WaveformEditor
        this._initSyncListeners();
        
        // Проверяем наличие и размеры контейнера
        if (this.progressBarContainer) {
            const rect = this.progressBarContainer.getBoundingClientRect();
            console.log(`LoopBlockManager: progressBarContainer found - width: ${rect.width}px, height: ${rect.height}px, overflow: ${getComputedStyle(this.progressBarContainer).overflow}`);
            console.log(`LoopBlockManager: progressBarContainer offsetWidth: ${this.progressBarContainer.offsetWidth}, offsetHeight: ${this.progressBarContainer.offsetHeight}`);
            console.log(`LoopBlockManager: progressBarContainer children:`, this.progressBarContainer.children.length);
            
            // Выводим список дочерних элементов
            for (let i = 0; i < this.progressBarContainer.children.length; i++) {
                const child = this.progressBarContainer.children[i];
                console.log(`LoopBlockManager: Child ${i}: ${child.id || child.className}, display: ${getComputedStyle(child).display}, zIndex: ${getComputedStyle(child).zIndex}`);
            }
        } else {
            console.error('LoopBlockManager: progressBarContainer not found!');
        }
        
        console.log('LoopBlockManager initialized');
    }
    
    /**
     * Обработчик нажатия клавиш
     * @param {KeyboardEvent} e - событие клавиатуры
     * @private
     */
    _handleKeyDown(e) {
        if (e.key === 'Shift') {
            this.isShiftPressed = true;
            console.log('LoopBlockManager: Shift key pressed, multiple selection mode active');
        }
        
        // Добавляем обработку клавиши Alt для снятия зацикливания
        if (e.key === 'Alt' || e.key === 'AltLeft' || e.key === 'AltRight') {
            this.isAltPressed = true;
        }
        
        // Добавляем обработку Alt+Escape для принудительного снятия зацикливания
        if ((this.isAltPressed || e.altKey) && e.key === 'Escape') {
            if (this.isLooping) {
                console.log('LoopBlockManager: Alt+Escape detected, emergency stopping looping');
                this.forceStopLooping();
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }
    
    /**
     * Обработчик отпускания клавиш
     * @param {KeyboardEvent} e - событие клавиатуры
     * @private
     */
    _handleKeyUp(e) {
        if (e.key === 'Shift') {
            this.isShiftPressed = false;
            console.log('LoopBlockManager: Shift key released, multiple selection mode deactivated');
        }
        
        // Обработка отпускания Alt
        if (e.key === 'Alt' || e.key === 'AltLeft' || e.key === 'AltRight') {
            this.isAltPressed = false;
            
            // Проверяем, был ли Alt нажат один (без других клавиш)
            if (this.isLooping && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                console.log('LoopBlockManager: Clean Alt release detected, stopping looping');
                this.stopLooping();
            }
        }
    }
    
    /**
     * Проверяет состояние аудио движка и инициализирует обработчики при загрузке
     * @private
     */
    _checkAudioAndInitialize() {
        console.log('LoopBlockManager: Checking audio initialization...');
        
        // Проверка на наличие аудио движка
        if (!this.audioEngine) {
            console.warn(`LoopBlockManager: Audio engine not available (check ${this.audioInitChecks})`);
            
            // Если аудио движок недоступен, пробуем проверить снова через интервал
            if (this.audioInitChecks < 50) {
                this.audioInitChecks++;
                setTimeout(() => this._checkAudioAgain(), 800);
            } else {
                console.error('LoopBlockManager: Failed to initialize audio after multiple attempts');
            }
            return false;
        }
        
        // В AudioEngine используется Web Audio API, а не HTML Audio элемент
        // Поэтому мы проверим наличие буфера и контекста
        if (!this.audioEngine.instrumentalBuffer || !this.audioEngine.audioContext) {
            console.warn(`LoopBlockManager: Audio buffer or context not available (check ${this.audioInitChecks})`);
            
            // Если аудио буфер недоступен, пробуем проверить снова через интервал
            if (this.audioInitChecks < 50) {
                this.audioInitChecks++;
                setTimeout(() => this._checkAudioAgain(), 800);
            } else {
                console.error('LoopBlockManager: Failed to initialize audio after multiple attempts');
            }
            return false;
        }
        
        // Проверяем состояние загрузки аудио через длительность трека
        if (!this.audioEngine.duration || this.audioEngine.duration <= 0) {
            console.warn(`LoopBlockManager: Audio duration not available: ${this.audioEngine.duration}`);
            
            // Если длительность трека недоступна, пробуем проверить снова через интервал
            if (this.audioInitChecks < 50) {
                this.audioInitChecks++;
                setTimeout(() => this._checkAudioAgain(), 800);
            } else {
                console.error('LoopBlockManager: Failed to initialize audio after multiple attempts');
            }
            return false;
        }
        
        // Аудио готово, устанавливаем обработчик события timeupdate
        this._setupAudioTimeUpdate();
        console.log(`LoopBlockManager: Audio initialized successfully, duration: ${this.audioEngine.duration}s`);
        return true;
    }
    
    /**
     * Обработчик события, когда аудио готово к воспроизведению
     * @private
     */
    _onAudioReady() {
        console.log('LoopBlockManager: Audio is now ready for playback');
        
        // Устанавливаем обработчик события timeupdate
        this._setupAudioTimeUpdate();
    }
    
    /**
     * Повторная проверка состояния аудио
     * @private
     */
    _checkAudioAgain() {
        const MAX_ATTEMPTS = 5; // Ограничиваем количество попыток
        
        // Добавляем более информативное сообщение только при первых нескольких попытках
        if (this.audioInitChecks < 3) {
            console.log(`LoopBlockManager: Проверка доступности аудио (попытка ${this.audioInitChecks + 1}/${MAX_ATTEMPTS})`);
        }
        
        // Проверяем наличие аудио движка
        if (!this.audioEngine) {
            if (this.audioInitChecks === 0) {
                console.warn('LoopBlockManager: Аудио движок недоступен');
            }
            
            if (this.audioInitChecks < MAX_ATTEMPTS) {
                this.audioInitChecks++;
                setTimeout(() => this._checkAudioAgain(), 800);
            } else if (this.audioInitChecks === MAX_ATTEMPTS) {
                console.warn(`LoopBlockManager: Аудио движок не загружен после ${MAX_ATTEMPTS} попыток. Остановка проверок.`);
                this.audioInitChecks++; // Увеличиваем, чтобы это сообщение больше не повторялось
            }
            return;
        }

        // Проверяем наличие аудио контекста и буферов
        if (!this.audioEngine.audioContext || (!this.audioEngine.instrumentalBuffer && !this.audioEngine.vocalsBuffer)) {
            if (this.audioInitChecks === 0) {
                console.warn('LoopBlockManager: Аудио контекст или буферы недоступны');
            }
            
            // Если аудиофайл не загружен или аудиоконтекст не создан
            if (this.audioInitChecks < MAX_ATTEMPTS) {
                this.audioInitChecks++;
                setTimeout(() => this._checkAudioAgain(), 800);
            } else if (this.audioInitChecks === MAX_ATTEMPTS) {
                console.warn(`LoopBlockManager: Аудио не загружено после ${MAX_ATTEMPTS} попыток. Для работы функций зацикливания необходимо загрузить аудиофайл.`);
                this.audioInitChecks++; // Увеличиваем, чтобы это сообщение больше не повторялось
            }
            return;
        }

        // Если все компоненты аудио движка доступны, инициализируем обработчики
        console.log('LoopBlockManager: Аудио доступно, инициализация');
        this._checkAudioAndInitialize();
    }
    
    /**
     * Настройка обработчика события timeupdate для зацикливания
     * @private
     */
    _setupAudioTimeUpdate() {
        console.log('LoopBlockManager: Setting up audio time update handler');
        
        // Проверка на наличие аудио движка
        if (!this.audioEngine) {
            console.warn('LoopBlockManager: Audio engine not available for timeupdate setup');
            return false;
        }
        
        // Удаляем предыдущий интервал проверки, если он был установлен
        if (this.loopCheckInterval) {
            clearInterval(this.loopCheckInterval);
            this.loopCheckInterval = null;
            console.log('LoopBlockManager: Cleared previous loop check interval');
        }
        
        // Устанавливаем интервал для более частой проверки позиции воспроизведения
        console.log('LoopBlockManager: Setting up new loop check interval (10ms)');
        this.loopCheckInterval = setInterval(() => {
            if (this.isLooping) {
                this._checkPlaybackPosition();
            }
        }, 10); // Максимально частая проверка - каждые 10 мс
        
        console.log('LoopBlockManager: Audio time update handler set up successfully');
        return true;
    }
    
    /**
     * Обработчик события timeupdate
     * @private
     */
    _handleTimeUpdate() {
        if (this.isLooping && this.activeLoopBlock) {
            this._checkPlaybackPosition();
        }
    }
    
    /**
     * Проверка позиции воспроизведения и управление зацикливанием
     * @private
     */
    _checkPlaybackPosition() {
        // Проверяем наличие аудиодвижка и активного зацикливания
        if (!this.audioEngine || !this.isLooping) {
            return;
        }
        
        try {
            // Получаем текущее время воспроизведения
        const currentTime = this.audioEngine.getCurrentTime();
        
            // Проверяем на ошибки в значении времени
            if (isNaN(currentTime) || currentTime < 0) {
                console.warn(`LoopBlockManager: Invalid current time: ${currentTime}`);
                this.consecutiveLoopErrors++;
                
                // Если накопилось слишком много ошибок, останавливаем зацикливание
                if (this.consecutiveLoopErrors > 5) {
                    console.error('LoopBlockManager: Too many consecutive errors, stopping loop');
                    this.stopLooping();
                }
                return;
            }
            
            // Сбрасываем счетчик ошибок при успешной проверке
            this.consecutiveLoopErrors = 0;

            // Если есть активный блок, проверяем границы зацикливания
            if (this.activeLoopBlock) {
                const startTime = parseFloat(this.activeLoopBlock.getAttribute('data-start-time'));
                const endTime = parseFloat(this.activeLoopBlock.getAttribute('data-end-time'));
                
                // Если текущее время за пределами блока и не было недавнего принудительного перехода
                if (currentTime < startTime || currentTime >= endTime) {
                    // Перемещаемся к началу блока
                    this.audioEngine.setCurrentTime(startTime);
                    console.log(`LoopBlockManager: Loop triggered, jumping to ${startTime.toFixed(2)}s`);
                }
            } else {
                // Если нет активного блока, но зацикливание включено - остановить его
                console.warn('LoopBlockManager: No active loop block, stopping loop');
                this.stopLooping();
            }
        } catch (error) {
            console.error('LoopBlockManager: Error checking playback position:', error);
            this.consecutiveLoopErrors++;
            
            // Если накопилось слишком много ошибок, останавливаем зацикливание
            if (this.consecutiveLoopErrors > 5) {
                console.error('LoopBlockManager: Too many consecutive errors, stopping loop');
                this.stopLooping();
            }
        }
    }
    
    /**
     * Force seek to specified time
     * @param {number} time - Time in seconds to seek to
     * @private
     */
    _forceSeekTo(time) {
        if (!this.audioEngine) {
            console.warn('LoopBlockManager: Cannot force seek, audioEngine is not available');
            return;
        }

        try {
            // Проверяем, что время валидное
            if (isNaN(time) || time < 0) {
                console.warn(`LoopBlockManager: Invalid seek time: ${time}`);
                return;
            }
            
        console.log(`LoopBlockManager: Force seeking to ${time.toFixed(2)}s`);
        
            // Запоминаем время последнего принудительного перехода
            this._lastForceSeekTime = Date.now();
            
            // Используем метод setCurrentTime аудио-движка
            this.audioEngine.setCurrentTime(time);
            
            // Если не был отправлен пользовательский интерфейс, обновляем положение маркера
            if (window.waveformEditor) {
                window.waveformEditor.setMarkerPosition(time);
            }
        } catch (error) {
            console.error('LoopBlockManager: Error during force seek:', error);
        }
    }
    
    /**
     * Toggle LoopBlock mode on/off
     * @param {boolean} isActive - Whether to activate or deactivate LoopBlock mode
     */
    toggleMode(isActive) {
        console.log(`LoopBlockManager: Toggle mode, isActive = ${isActive}`);
        this.isActive = isActive;
        
        if (isActive) {
            // Проверяем инициализацию аудио при активации режима
            this._checkAudioAndInitialize();
            
            // Отображаем блоки на прогресс-баре
            this.displayBlocks();
            
            // Отключаем взаимодействие с прогресс-баром
            this._disableProgressBarInteraction();
        } else {
            // Останавливаем любое активное зацикливание
            this.stopLooping();
            
            // Удаляем блоки и включаем взаимодействие с прогресс-баром
            this._clearBlocks();
            this._enableProgressBarInteraction();
        }
    }
    
    /**
     * Запускает зацикливание по блоку
     * @param {HTMLElement} blockElement - Элемент блока для зацикливания
     * @returns {boolean} - Успешность запуска зацикливания
     */
    startLooping(blockElement) {
        try {
        if (!this.audioEngine) {
                console.warn('LoopBlockManager: Audio engine not available');
            return false;
        }
        
            if (!blockElement || !blockElement.classList.contains('loop-block-indicator')) {
                console.warn('LoopBlockManager: Invalid block element for looping', blockElement);
            return false;
        }
        
            // Получаем время начала и конца из атрибутов блока
            const startTime = parseFloat(blockElement.getAttribute('data-start-time'));
            const endTime = parseFloat(blockElement.getAttribute('data-end-time'));
            const blockName = blockElement.getAttribute('data-block-name');

            if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime <= startTime) {
                console.warn(`LoopBlockManager: Invalid block times: ${startTime}s - ${endTime}s`);
            return false;
        }
        
            // Сначала останавливаем любое предыдущее зацикливание
        this.stopLooping();
        
            // Устанавливаем флаги и активный блок
        this.isLooping = true;
        this.sequenceLooping = false;
            this.activeLoopBlock = blockElement;
            this.consecutiveLoopErrors = 0;
            this.selectedBlocks = [blockElement]; // Устанавливаем только этот блок как выбранный
        
        // Подсвечиваем активный блок
            this._highlightLoopBlock(blockElement);

            // Запускаем зацикливание в аудио-движке
            const success = this.audioEngine.setLoop(startTime, endTime);

            // Если аудио не воспроизводится, запускаем его с начала цикла
            if (!this.audioEngine.isPlaying()) {
                this.audioEngine.setCurrentTime(startTime);
                this.audioEngine.play();
            } else if (this.audioEngine.getCurrentTime() < startTime || this.audioEngine.getCurrentTime() > endTime) {
                // Если текущее время находится вне цикла, устанавливаем его на начало цикла
                this.audioEngine.setCurrentTime(startTime);
            }

            console.log(`LoopBlockManager: Started looping ${blockName} (${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)`);
            this._updateActiveLoopStatus(true, blockName);
            
            return success;
        } catch (error) {
            console.error('LoopBlockManager: Error starting loop:', error);
            return false;
        }
    }
    
    /**
     * Синхронизирует состояние лупа с WaveformEditor
     * @param {number} startTime - Время начала зацикливания в секундах
     * @param {number} endTime - Время окончания зацикливания в секундах
     * @param {boolean} isActive - Флаг активности зацикливания
     * @private
     */
    _syncWithWaveformEditor(startTime, endTime, isActive) {
        console.log(`LoopBlockManager: Set loop in opened editor: ${startTime}s - ${endTime}s`);
        
        try {
            // Проверяем доступ к waveformEditor
        if (!window.waveformEditor) {
                console.warn('LoopBlockManager: waveformEditor not available for sync');
            return false;
        }
        
            // Проверяем наличие нужных методов
            if (typeof window.waveformEditor.setLoopBounds !== 'function') {
                // Используем альтернативный метод, если setLoopBounds не доступен
                if (typeof window.waveformEditor.createLoopFromSelection === 'function') {
                    // Второй вариант API - создаем выделение и делаем из него луп
                    console.log('LoopBlockManager: Using createLoopFromSelection as fallback');
                    
                    // Устанавливаем selection границы
                    if (typeof window.waveformEditor.setSelectionBounds === 'function') {
                        window.waveformEditor.setSelectionBounds(startTime, endTime);
                        window.waveformEditor.createLoopFromSelection();
                        return true;
                    }
                }
                
                // Третий вариант - просто сдвигаем воспроизведение
                if (isActive && typeof window.waveformEditor._forceSeekTo === 'function') {
                    window.waveformEditor._forceSeekTo(startTime);
                    return true;
                }
                
                throw new TypeError('waveformEditor.setLoopBounds is not a function');
            }
            
            // Стандартный вызов - задаем границы лупа напрямую
            window.waveformEditor.setLoopBounds(startTime, endTime);
            return true;
        } catch (error) {
            console.error('LoopBlockManager: Error syncing with WaveformEditor:', error);
            return false;
        }
    }
    
    /**
     * Активирует последовательное зацикливание для нескольких блоков
     * @param {Array<HTMLElement>} blocks - Массив блоков для зацикливания
     * @returns {boolean} - Успешность запуска последовательного зацикливания
     */
    startSequenceLooping(blocks) {
        console.log(`LoopBlockManager: startSequenceLooping called with ${blocks ? blocks.length : 0} blocks`);
        
        try {
            if (!this.isActive || !this.audioEngine) {
                console.error('LoopBlockManager: Cannot start sequence looping - inactive mode or no audio engine');
            return false;
        }
        
            if (!blocks || !blocks.length) {
                console.error('LoopBlockManager: No blocks provided for sequence looping');
                return false;
            }
            
            // Очищаем последовательность от дубликатов
            this.selectedBlocks = blocks;
            this._updateSelectedBlocksDisplay();
            
            // После очистки дубликатов проверяем, остались ли блоки
            if (!this.selectedBlocks || this.selectedBlocks.length === 0) {
                console.error('LoopBlockManager: No valid blocks after duplicate removal');
                return false;
            }
            
            // Если остался только один блок, используем обычное зацикливание
            if (this.selectedBlocks.length === 1) {
                console.log('LoopBlockManager: Only one valid block, using single block looping');
                return this.startLooping(this.selectedBlocks[0]);
            }
            
            // Проверяем блоки на валидность
            const validBlocks = this.selectedBlocks.filter(block => {
                if (!block) {return false;}
                
                const startTime = parseFloat(block.getAttribute('data-start-time'));
                const endTime = parseFloat(block.getAttribute('data-end-time'));
                
                return !isNaN(startTime) && !isNaN(endTime) && startTime >= 0 && endTime > startTime;
            });
            
            if (validBlocks.length === 0) {
                console.error('LoopBlockManager: No valid blocks for sequence looping');
                return false;
            }
            
            // Отключаем предыдущее зацикливание, если оно было
            this.stopLooping();
        
        // Устанавливаем новую последовательность блоков
            this.selectedBlocks = validBlocks;
        this.currentSequenceIndex = 0;
        this.isLooping = true;
        this.sequenceLooping = true;
        this.activeLoopBlock = null; // Сбрасываем одиночный блок
        
        // Визуально выделяем все блоки в последовательности
            this._highlightBlocks(validBlocks);
            
            // Вывод информации о последовательности
            console.log(`LoopBlockManager: Started sequence looping for ${validBlocks.length} blocks`);
            validBlocks.forEach((block, index) => {
                const name = block.getAttribute('data-block-name');
                const start = parseFloat(block.getAttribute('data-start-time')).toFixed(2);
                const end = parseFloat(block.getAttribute('data-end-time')).toFixed(2);
                console.log(`  Block ${index + 1}: "${name}" (${start}s - ${end}s)`);
            });
            
            // Устанавливаем обработчик для смены блока
            this._setupSequenceChangeListener();
            
            // Переходим к первому блоку в последовательности
            this._moveToSequenceBlock(0);
        
        // Запускаем воспроизведение, если оно приостановлено
            if (!this.audioEngine.isPlaying()) {
            this.audioEngine.play();
        }
        
        return true;
        } catch (error) {
            console.error('LoopBlockManager: Error starting sequence looping:', error);
            return false;
        }
    }
    
    /**
     * Устанавливает обработчик для смены блока в последовательности
     * @private
     */
    _setupSequenceChangeListener() {
        // Удаляем предыдущий обработчик, если он существует
        if (this._sequenceChangeHandler) {
            document.removeEventListener('audio-position-changed', this._sequenceChangeHandler);
            document.removeEventListener('timeupdate', this._sequenceChangeHandler);
        }
        
        // Очищаем предыдущий интервал проверки
        if (this._sequenceCheckInterval) {
            clearInterval(this._sequenceCheckInterval);
            this._sequenceCheckInterval = null;
        }
        
        // Создаем обработчик для проверки и перехода к следующему блоку
        this._sequenceChangeHandler = () => {
            if (!this.sequenceLooping || !this.selectedBlocks || this.selectedBlocks.length <= 1) {
                return;
            }
            
            try {
            const currentTime = this.audioEngine.getCurrentTime();
                if (isNaN(currentTime)) {
                    console.warn('LoopBlockManager: Invalid current time in sequence check');
                    return;
                }
                
            const currentBlock = this.selectedBlocks[this.currentSequenceIndex];
                if (!currentBlock) {
                    console.warn('LoopBlockManager: Invalid current block in sequence');
                    return;
                }
                
                const startTime = parseFloat(currentBlock.getAttribute('data-start-time'));
                const endTime = parseFloat(currentBlock.getAttribute('data-end-time'));
                
                if (isNaN(startTime) || isNaN(endTime)) {
                    console.warn('LoopBlockManager: Invalid block times in sequence check');
                    return;
                }
                
                // Проверяем, достигли ли мы конца текущего блока
                if (currentTime >= endTime - 0.05) {
                    console.log(`LoopBlockManager: End of block reached, moving to next (currentTime=${currentTime.toFixed(2)}, blockEnd=${endTime.toFixed(2)})`);
                    
                    // Переходим к следующему блоку в последовательности
                this.currentSequenceIndex = (this.currentSequenceIndex + 1) % this.selectedBlocks.length;
                this._moveToSequenceBlock(this.currentSequenceIndex);
                }
            } catch (error) {
                console.error('LoopBlockManager: Error in sequence change handler:', error);
            }
        };
        
        // Устанавливаем интервал для проверки позиции воспроизведения
        this._sequenceCheckInterval = setInterval(() => {
            this._sequenceChangeHandler();
        }, 50); // Проверяем каждые 50 мс для большей точности
        
        console.log('LoopBlockManager: Sequence change listener set up');
    }
    
    /**
     * Переходит к блоку по индексу в последовательности
     * @param {number} index - Индекс блока в последовательности
     * @private
     */
    _moveToSequenceBlock(index) {
        if (!this.selectedBlocks || !this.selectedBlocks.length) {
            console.warn('LoopBlockManager: No blocks in sequence');
            return;
        }
        
        if (index >= this.selectedBlocks.length) {
            console.warn(`LoopBlockManager: Invalid index ${index} in sequence of ${this.selectedBlocks.length} blocks`);
            return;
        }
        
        const nextBlock = this.selectedBlocks[index];
        if (!nextBlock) {
            console.warn(`LoopBlockManager: Block at index ${index} is undefined`);
            return;
        }
        
        try {
            const startTime = parseFloat(nextBlock.getAttribute('data-start-time'));
            const endTime = parseFloat(nextBlock.getAttribute('data-end-time'));
            const blockName = nextBlock.getAttribute('data-block-name');
            
            if (isNaN(startTime) || isNaN(endTime)) {
                console.warn(`LoopBlockManager: Invalid block times at index ${index}: start=${startTime}, end=${endTime}`);
                return;
            }
            
            console.log(`LoopBlockManager: Moving to block ${index+1}/${this.selectedBlocks.length} "${blockName}" (${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)`);
            
            // Обновляем визуальное выделение блоков
        this._highlightBlocks(this.selectedBlocks, index);
            
            // Очищаем любые предыдущие точки зацикливания
            this.audioEngine.clearLoop();
        
        // Устанавливаем зацикливание для нового блока
        this.audioEngine.setLoop(startTime, endTime);
        
            // Перемещаемся к началу блока
            this.audioEngine.setCurrentTime(startTime);
            
            // Проверяем, воспроизводится ли аудио, и при необходимости запускаем
            if (!this.audioEngine.isPlaying()) {
                this.audioEngine.play();
            }
            
            // Обновляем статус активного блока
            this._updateActiveLoopStatus(true, blockName);
        } catch (error) {
            console.error(`LoopBlockManager: Error moving to sequence block ${index}:`, error);
        }
    }
    
    /**
     * Останавливает зацикливание
     */
    stopLooping() {
        console.log('LoopBlockManager: Stopping looping');
        
        // Сбрасываем флаги
        this.isLooping = false;
        this.sequenceLooping = false;
        this.activeLoopBlock = null;
        this.currentSequenceIndex = 0;
        this.consecutiveLoopErrors = 0;

        // Очищаем зацикливание в аудиодвижке
        if (this.audioEngine) {
            this.audioEngine.clearLoop();
        }
        
        // Сбрасываем стили блоков
        this._resetAllBlockStyles();
        
        // Очищаем интервал проверки зацикливания
        if (this.loopCheckInterval) {
            clearInterval(this.loopCheckInterval);
            this.loopCheckInterval = null;
        }
        
        // Очищаем интервал проверки последовательности
        if (this._sequenceCheckInterval) {
            clearInterval(this._sequenceCheckInterval);
            this._sequenceCheckInterval = null;
        }
        
        // Удаляем обработчики событий для последовательного воспроизведения
        if (this._sequenceChangeHandler) {
            document.removeEventListener('audio-position-changed', this._sequenceChangeHandler);
            document.removeEventListener('timeupdate', this._sequenceChangeHandler);
            this._sequenceChangeHandler = null;
        }

        console.log('LoopBlockManager: Stopped looping.');
        this._updateActiveLoopStatus(false);
    }
    
    /**
     * Отключает режим зацикливания в редакторе Sync
     * @private
     */
    _clearSyncLoop() {
        if (window.waveformEditor) {
            console.log('LoopBlockManager: Clearing loop in WaveformEditor');
            
            try {
                // Отключаем режим лупа в редакторе Sync
                window.waveformEditor.enableLoop(false);
                
                // Обновляем отображение
                window.waveformEditor.updateLoopDisplay();
                
                console.log('LoopBlockManager: Successfully cleared loop in WaveformEditor');
            } catch (error) {
                console.error('LoopBlockManager: Error clearing loop in WaveformEditor:', error);
            }
        }
    }
    
    /**
     * Выделяет блок визуально
     * @param {HTMLElement} blockElement - Блок для выделения
     * @private
     */
    _highlightBlock(blockElement) {
        console.log(`LoopBlockManager: Highlighting block "${blockElement ? blockElement.dataset.blockName : 'undefined'}"`, blockElement);
        
        if (!blockElement) {
            console.error('LoopBlockManager: Cannot highlight undefined block');
            return;
        }
        
        // Сначала сбрасываем стили всех блоков
        if (!this.isShiftPressed) {
            this._resetBlockStyles();
        }
        
        // Затем выделяем указанный блок
        blockElement.classList.add('selected');
        blockElement.classList.add('active-loop');
        blockElement.style.backgroundColor = 'rgba(255, 140, 0, 0.6)'; // Более яркий оранжевый
        blockElement.style.border = '2px solid rgba(255, 140, 0, 0.9)';
        blockElement.style.zIndex = '10';
        
        console.log(`LoopBlockManager: Block highlighted - selected: ${blockElement.classList.contains('selected')}, active-loop: ${blockElement.classList.contains('active-loop')}`);
    }
    
    /**
     * Выделяет несколько блоков визуально
     * @param {Array<HTMLElement>} blocks - Массив блоков для выделения
     * @param {number} activeIndex - Индекс активного блока (по умолчанию 0)
     * @private
     */
    _highlightBlocks(blocks, activeIndex = 0) {
        if (!blocks || blocks.length === 0) {
            console.warn('LoopBlockManager: No blocks to highlight');
            return;
        }
        
        // Сначала сбрасываем стили всех блоков
        this._resetBlockStyles();
        
        console.log(`LoopBlockManager: Highlighting ${blocks.length} blocks, active index: ${activeIndex}`);
        
        // Затем выделяем указанные блоки
        blocks.forEach((block, index) => {
            if (!block) {
                console.warn(`LoopBlockManager: Block at index ${index} is undefined`);
                return;
            }
            
            block.classList.add('selected');
            block.classList.add('sequence-block');
            
            // Активный блок выделяем ярче
            if (index === activeIndex) {
                block.classList.add('active-loop');
                block.style.backgroundColor = 'rgba(255, 140, 0, 0.7)';
                block.style.border = '2px solid rgba(255, 140, 0, 1)';
                block.style.zIndex = '11'; // Поднимаем активный над остальными
            } else {
                // Остальные блоки делаем другого цвета
                block.style.backgroundColor = 'rgba(255, 165, 0, 0.5)';
                block.style.border = '2px solid rgba(255, 140, 0, 0.7)';
                block.style.zIndex = '10';
            }
            
            // Удаляем старый номер, если он есть
            const oldNumber = block.querySelector('.sequence-number');
            if (oldNumber) {
                oldNumber.remove();
            }
            
            // Добавляем порядковый номер
            const numberEl = document.createElement('div');
            numberEl.className = 'sequence-number';
            numberEl.textContent = index + 1;
            numberEl.style.position = 'absolute';
            numberEl.style.top = '50%';
            numberEl.style.left = '50%';
            numberEl.style.transform = 'translate(-50%, -50%)';
            numberEl.style.fontSize = '14px';
            numberEl.style.fontWeight = 'bold';
            numberEl.style.color = 'rgba(255, 255, 255, 0.9)';
            numberEl.style.textShadow = '0 0 2px rgba(0, 0, 0, 0.8)';
            
            block.appendChild(numberEl);
        });
    }
    
    /**
     * Сбрасывает стили всех блоков
     * @private
     */
    _resetBlockStyles() {
        if (!this.blocks || this.blocks.length === 0) {return;}
        
        this.blocks.forEach(block => {
            if (!block) {return;}
            
            try {
                // Удаляем классы
            block.classList.remove('selected', 'active-loop', 'sequence-block');
                
                // Сбрасываем стили
            block.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
            block.style.border = '1px solid rgba(255, 165, 0, 0.7)';
            block.style.zIndex = '5';
                block.style.boxShadow = 'none';
            
            // Удаляем порядковый номер, если он есть
            const numberEl = block.querySelector('.sequence-number');
            if (numberEl) {
                numberEl.remove();
                }
            } catch (error) {
                console.warn('LoopBlockManager: Error resetting block styles:', error);
            }
        });
        
        console.log('LoopBlockManager: Reset styles for all blocks');
    }
    
    /**
     * Disable progress bar click interaction
     * @private
     */
    _disableProgressBarInteraction() {
        if (!this.progressBarContainer) {return;}
        
        // Сохраняем стиль cursor, чтобы изменить его
        this.originalCursorStyle = getComputedStyle(this.progressBarContainer).cursor;
        this.progressBarContainer.style.cursor = 'default';
        
        // Создаем обработчик, который блокирует клики
        this._blockClickHandler = (e) => {
            // Пропускаем блокировку, если нажата клавиша Shift
            if (e.shiftKey || this.isShiftPressed) {
                console.log('LoopBlockManager: Progress bar click allowed with Shift key pressed');
                return true;
            }
            
            e.stopPropagation();
            e.preventDefault();
            console.log('LoopBlockManager: Progress bar click blocked in LoopBlock mode');
            
            // Убираем показ сообщения при клике
            // this._showClickBlockedMessage(e.clientX, e.clientY);
            
            return false;
        };
        
        // Добавляем обработчик событий
        this.progressBarContainer.addEventListener('click', this._blockClickHandler, true);
        this.progressBarContainer.addEventListener('mousedown', this._blockClickHandler, true);
        
        console.log('LoopBlockManager: Progress bar interaction disabled (except with Shift key)');
    }
    
    /**
     * Enable progress bar click interaction
     * @private
     */
    _enableProgressBarInteraction() {
        if (!this.progressBarContainer) {return;}
        
        // Восстанавливаем курсор
        this.progressBarContainer.style.cursor = this.originalCursorStyle || 'pointer';
        
        // Удаляем обработчик, блокирующий клики
        if (this._blockClickHandler) {
            this.progressBarContainer.removeEventListener('click', this._blockClickHandler, true);
            this.progressBarContainer.removeEventListener('mousedown', this._blockClickHandler, true);
            this._blockClickHandler = null;
        }
        
        console.log('LoopBlockManager: Progress bar interaction enabled');
    }
    
    /**
     * Show message when progress bar click is blocked
     * @param {number} x - The x position of the click
     * @param {number} y - The y position of the click
     * @private
     */
    _showClickBlockedMessage(x, y) {
        // Удаляем предыдущее сообщение, если оно есть
        const oldMessage = document.querySelector('.loopblock-click-message');
        if (oldMessage) {
            oldMessage.remove();
        }
        
        // Создаем элемент с сообщением
        const messageElement = document.createElement('div');
        messageElement.className = 'loopblock-click-message';
        messageElement.textContent = 'В режиме LoopBlock используйте блоки для навигации';
        messageElement.style.position = 'absolute';
        messageElement.style.top = `${y - 40}px`;
        messageElement.style.left = `${x - 100}px`;
        messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        messageElement.style.color = 'white';
        messageElement.style.padding = '5px 10px';
        messageElement.style.borderRadius = '4px';
        messageElement.style.fontSize = '12px';
        messageElement.style.zIndex = '100';
        messageElement.style.pointerEvents = 'none';
        messageElement.style.transition = 'opacity 0.5s ease-out';
        
        // Добавляем сообщение на страницу
        document.body.appendChild(messageElement);
        
        // Удаляем сообщение через 2 секунды
        setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 500);
        }, 2000);
    }
    
    /**
     * Add message about LoopBlock mode
     * @private
     */
    _addLoopModeMessage() {
        // Удаляем существующее сообщение, если оно есть
        this._removeLoopModeMessage();
        
        // Создаем элемент с сообщением
        const messageElement = document.createElement('div');
        messageElement.className = 'loopblock-mode-message';
        messageElement.innerHTML = 'Режим <strong>LoopBlock</strong>: используйте блоки для навигации по трекам. <span style="color:#ffcc00">Клик</span> на блоке запускает зацикливание. <span style="color:#ffcc00">Shift+клик</span> добавляет блоки к последовательности.';
        
        // Добавляем сообщение на страницу
        document.body.appendChild(messageElement);
        
        // Показываем сообщение на 5 секунд, затем делаем его менее заметным
        setTimeout(() => {
            messageElement.style.opacity = '0.7';
            messageElement.style.transform = 'translateY(20px)';
            messageElement.style.height = 'auto';
            messageElement.innerHTML = 'Режим <strong>LoopBlock</strong> активен';
        }, 5000);
    }
    
    /**
     * Remove message about LoopBlock mode
     * @private
     */
    _removeLoopModeMessage() {
        const messageElement = document.querySelector('.loopblock-mode-message');
        if (messageElement) {
            messageElement.remove();
        }
    }
    
    /**
     * Display blocks on the progress bar
     */
    displayBlocks() {
        // Сначала удалим существующие блоки, если они есть
        this.clearBlocks();
        
        // Проверяем состояние контейнера перед отображением блоков
        if (this.progressBarContainer) {
            const rect = this.progressBarContainer.getBoundingClientRect();
            console.log(`LoopBlockManager: Before displaying blocks - width: ${rect.width}px, height: ${rect.height}px, visibility: ${getComputedStyle(this.progressBarContainer).visibility}, display: ${getComputedStyle(this.progressBarContainer).display}`);
        }
        
        // Получаем текстовые блоки из lyricsDisplay, если они есть
        let textBlocks = [];
        if (this.lyricsDisplay && this.lyricsDisplay.textBlocks) {
            textBlocks = this.lyricsDisplay.textBlocks;
            console.log('LoopBlockManager: Found textBlocks:', textBlocks.length);
        }
        
        // Если блоков нет, покажем тестовый блок
        if (textBlocks.length === 0) {
            this._createTestBlock();
            console.log('LoopBlockManager: No textBlocks found. Displayed test block.');
            return;
        }
        
        // Проверим наличие маркеров для строк
        const markers = window.markerManager ? window.markerManager.getMarkers() : null;
        if (markers && markers.length > 0) {
            console.log(`LoopBlockManager: Found ${markers.length} markers for blocks`);
        } else {
            console.warn('LoopBlockManager: No markers available! Blocks may display incorrectly.');
        }
        
        // Создаем блоки на основе текстовых блоков
        let createdBlocks = 0;
        for (const block of textBlocks) {
            if (this._createBlockElement(block)) {
                createdBlocks++;
            } else {
                console.warn(`LoopBlockManager: Failed to create visual block for "${block.name}"`);
            }
        }
        
        if (createdBlocks === 0) {
            console.warn('LoopBlockManager: No blocks could be created from text blocks. Displaying test block instead.');
            this._createTestBlock();
        } else {
            console.log(`LoopBlockManager: Successfully displayed ${createdBlocks} blocks out of ${textBlocks.length} text blocks.`);
        }
        
        // Проверяем, отображаются ли блоки
        setTimeout(() => {
            const visibleBlocks = document.querySelectorAll('.loop-block-indicator');
            console.log(`LoopBlockManager: Checking blocks visibility - ${visibleBlocks.length} blocks found in DOM`);
            if (visibleBlocks.length > 0) {
                const firstBlock = visibleBlocks[0];
                const blockStyle = getComputedStyle(firstBlock);
                console.log(`LoopBlockManager: First block - visibility: ${blockStyle.visibility}, display: ${blockStyle.display}, opacity: ${blockStyle.opacity}, z-index: ${blockStyle.zIndex}`);
                console.log(`LoopBlockManager: First block position - top: ${blockStyle.top}, left: ${blockStyle.left}, width: ${blockStyle.width}, height: ${blockStyle.height}`);
            }
        }, 100);
        
        // Выводим диагностическую информацию
        setTimeout(() => this.logDiagnosticInfo(), 200);
    }
    
    /**
     * Create a test block for demonstration purposes
     * @private
     */
    _createTestBlock() {
        const blockElement = document.createElement('div');
        blockElement.className = 'loop-block-indicator';
        blockElement.style.position = 'absolute';
        blockElement.style.top = '0';
        blockElement.style.left = '30%';
        blockElement.style.width = '40%';
        blockElement.style.height = '100%';
        blockElement.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
        blockElement.style.border = '1px solid rgba(255, 165, 0, 0.7)';
        blockElement.style.borderRadius = '3px';
        blockElement.style.zIndex = '5';
        blockElement.style.cursor = 'pointer';
        
        this._setupBlockInteractions(blockElement);
        this.progressBarContainer.appendChild(blockElement);
        this.blocks.push(blockElement);
    }
    
    /**
     * Create a block element from a text block
     * @param {Object} block - The text block data
     * @private
     * @returns {boolean} - Whether the block was successfully created
     */
    _createBlockElement(block) {
        if (!block || !block.lineIndices || !block.lineIndices.length) {
            console.warn('LoopBlockManager: Invalid block data:', block);
            return false;
        }
        
        console.log(`LoopBlockManager: Creating block "${block.name}" with ${block.lineIndices.length} lines`);
        
        const totalDuration = this.audioEngine ? this.audioEngine.duration : 0;
        if (totalDuration <= 0) {
            console.warn('LoopBlockManager: Invalid audio duration:', totalDuration);
            return false;
        }
        
        // Определяем время начала и конца блока на основе маркеров
        let startTime = Number.MAX_VALUE;
        let endTime = 0;
        
        // Сначала попробуем получить маркеры из MarkerManager
        const markers = window.markerManager ? window.markerManager.getMarkers() : null;
        
        console.log(`LoopBlockManager: Using ${markers ? 'MarkerManager markers' : 'lyricsDisplay.markers'} for block timing`);
        
        if (markers && markers.length > 0) {
            // Сначала найдем маркер для первой строки блока
            const firstLineIndex = Math.min(...block.lineIndices);
            const firstLineMarker = markers.find(m => m.lineIndex === firstLineIndex);
            
            if (firstLineMarker && firstLineMarker.time !== undefined) {
                startTime = firstLineMarker.time;
                    } else {
                console.warn(`LoopBlockManager: No marker for first line ${firstLineIndex} of block "${block.name}"`);
            }
            
            // Теперь найдем маркер для строки, следующей за последней строкой блока
            const lastLineIndex = Math.max(...block.lineIndices);
            let nextLineMarker = null;
            
            // Найдем следующий маркер после нашего последнего
            for (const marker of markers) {
                if (marker.lineIndex > lastLineIndex) {
                    nextLineMarker = marker;
                    break;
                }
            }
            
            if (nextLineMarker && nextLineMarker.time !== undefined) {
                endTime = nextLineMarker.time;
            } else {
                // Если нет маркера для следующей строки, найдем маркер для последней строки блока
                const lastLineMarker = markers.find(m => m.lineIndex === lastLineIndex);
                
                if (lastLineMarker && lastLineMarker.time !== undefined) {
                    // Оценка длительности последнего маркера - используем среднюю длительность строк (~3 сек)
                    endTime = lastLineMarker.time + 3;
                    
                    // Проверяем, чтобы не выйти за пределы трека
                    endTime = Math.min(endTime, totalDuration);
                } else {
                    console.warn(`LoopBlockManager: No marker for last line ${lastLineIndex} of block "${block.name}"`);
                }
            }
            
            console.log(`LoopBlockManager: Block "${block.name}" determined times - startTime: ${startTime}, endTime: ${endTime}`);
        } else if (this.lyricsDisplay && this.lyricsDisplay.markers) {
            // Пробуем использовать маркеры из lyricsDisplay
            for (const lineIndex of block.lineIndices) {
                if (lineIndex >= 0 && lineIndex < this.lyricsDisplay.markers.length) {
                    const marker = this.lyricsDisplay.markers[lineIndex];
                    if (marker && marker.time !== undefined) {
                        startTime = Math.min(startTime, marker.time);
                        
                        // Если указано время конца, используем его, иначе используем время следующего маркера
                        if (marker.endTime !== undefined) {
                            endTime = Math.max(endTime, marker.endTime);
                        } else if (lineIndex + 1 < this.lyricsDisplay.markers.length && this.lyricsDisplay.markers[lineIndex + 1]) {
                            endTime = Math.max(endTime, this.lyricsDisplay.markers[lineIndex + 1].time);
                        }
                    }
                }
            }
        }
        
        // Если не удалось определить время для блока, используем более надежный метод аппроксимации
        if (startTime === Number.MAX_VALUE || endTime === 0 || startTime >= endTime) {
            console.warn(`LoopBlockManager: Could not determine valid time boundaries for block: ${block.name}`);
            
            // Переход к более надежному методу оценки - используем индексы строк и общее количество текста
            if (this.lyricsDisplay && this.lyricsDisplay.lyrics && this.lyricsDisplay.lyrics.length > 0) {
                const totalLines = this.lyricsDisplay.lyrics.length;
                const firstLine = Math.min(...block.lineIndices);
                const lastLine = Math.max(...block.lineIndices);
                
                // Рассчитываем примерное время на основе позиции строки в общем тексте
                startTime = (firstLine / totalLines) * totalDuration;
                endTime = ((lastLine + 1) / totalLines) * totalDuration;
                
                console.log(`LoopBlockManager: Using improved approximation for block "${block.name}": ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
            } else {
                // Если всё еще не получилось, используем старый метод аппроксимации
            const textBlocks = this.lyricsDisplay && this.lyricsDisplay.textBlocks ? this.lyricsDisplay.textBlocks : [];
            const blockIndex = textBlocks.findIndex(b => b.id === block.id);
            const totalBlocks = textBlocks.length;
            
            if (blockIndex >= 0 && totalBlocks > 0) {
                const blockWidth = totalDuration / totalBlocks;
                startTime = blockIndex * blockWidth;
                endTime = (blockIndex + 1) * blockWidth;
                    console.log(`LoopBlockManager: Using simple approximation for block "${block.name}": ${startTime.toFixed(2)} - ${endTime.toFixed(2)}`);
            } else {
                // Если совсем ничего не получается, используем дефолтные значения
                startTime = 0;
                endTime = totalDuration;
                console.log(`LoopBlockManager: Using default full-length timing for block "${block.name}"`);
            }
        }
        }
        
        // Преобразуем время в проценты для позиционирования
        const startPercent = (startTime / totalDuration) * 100;
        const endPercent = (endTime / totalDuration) * 100;
        const widthPercent = endPercent - startPercent;
        
        console.log(`LoopBlockManager: Block "${block.name}" position - startPercent: ${startPercent}%, endPercent: ${endPercent}%, width: ${widthPercent}%`);
        
        // Создаем элемент блока
        const blockElement = document.createElement('div');
        blockElement.className = 'loop-block-indicator';
        blockElement.dataset.blockId = block.id;
        blockElement.dataset.blockName = block.name;
        blockElement.dataset.startTime = startTime;
        blockElement.dataset.endTime = endTime;
        
        blockElement.style.position = 'absolute';
        blockElement.style.top = '0';
        blockElement.style.left = `${startPercent}%`;
        blockElement.style.width = `${widthPercent}%`;
        blockElement.style.height = '100%';
        blockElement.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
        blockElement.style.border = '1px solid rgba(255, 165, 0, 0.7)';
        blockElement.style.borderRadius = '3px';
        blockElement.style.zIndex = '5';
        blockElement.style.cursor = 'pointer';
        
        // Добавляем подпись с названием блока (скрытую)
        const nameLabel = document.createElement('div');
        nameLabel.className = 'loop-block-name';
        nameLabel.textContent = block.name || 'Unnamed';
        nameLabel.style.display = 'none'; // Скрываем полностью, вместо показа при hover
        blockElement.appendChild(nameLabel);
        
        // Добавляем элементы для resize
        const leftResizer = document.createElement('div');
        leftResizer.className = 'loop-block-resizer-left';
        leftResizer.style.position = 'absolute';
        leftResizer.style.top = '0';
        leftResizer.style.left = '0';
        leftResizer.style.width = '5px';
        leftResizer.style.height = '100%';
        leftResizer.style.cursor = 'ew-resize';
        leftResizer.style.zIndex = '6';
        blockElement.appendChild(leftResizer);
        
        const rightResizer = document.createElement('div');
        rightResizer.className = 'loop-block-resizer-right';
        rightResizer.style.position = 'absolute';
        rightResizer.style.top = '0';
        rightResizer.style.right = '0';
        rightResizer.style.width = '5px';
        rightResizer.style.height = '100%';
        rightResizer.style.cursor = 'ew-resize';
        rightResizer.style.zIndex = '6';
        blockElement.appendChild(rightResizer);
        
        // Настраиваем обработчики событий для блока
        this._setupBlockInteractions(blockElement);
        
        // Добавляем блок на страницу
        this.progressBarContainer.appendChild(blockElement);
        this.blocks.push(blockElement);
        
        console.log(`LoopBlockManager: Block "${block.name}" created and added to DOM`);
        return true;
    }
    
    /**
     * Set up event listeners for block interactions
     * @param {HTMLElement} blockElement - The block element to set up interactions for
     * @private
     */
    _setupBlockInteractions(blockElement) {
        if (!blockElement) {return;}
        
        // Обработчик для mousedown на блоке (для перетаскивания и изменения размера)
        blockElement.addEventListener('mousedown', (e) => {
            // Отменяем bubbling, чтобы клик не прошел к progress bar
            e.stopPropagation();
            
            const target = e.target;
            
            // Сохраняем выбранный блок для использования в других методах
            this.selectedBlock = blockElement;
            
            // Если клик на ресайзере, обрабатываем перетаскивание
            if (target.classList.contains('loop-block-resizer-left') || 
                target.classList.contains('loop-block-resizer-right')) {
                // Определяем режим перетаскивания
                if (target.classList.contains('loop-block-resizer-left')) {
                    this.dragMode = 'resize-left';
                } else if (target.classList.contains('loop-block-resizer-right')) {
                    this.dragMode = 'resize-right';
                }
                
                // Запоминаем начальные координаты для перетаскивания
                this.dragStartX = e.clientX;
                this.dragStartWidth = blockElement.offsetWidth;
                this.dragStartLeft = blockElement.offsetLeft;
                
                // Добавляем обработчики для перетаскивания
                document.addEventListener('mousemove', this._handleMouseMove);
                document.addEventListener('mouseup', this._handleMouseUp);
                return;
            }
        });
        
        // Обработчик для клика по блоку
        blockElement.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Если зажата клавиша Shift, добавляем блок в последовательность
            if (e.shiftKey || this.isShiftPressed) {
                console.log(`LoopBlockManager: Shift+click detected on block "${blockElement.getAttribute('data-block-name')}"`);
                this._handleShiftClick(blockElement);
                return;
            }
            
            // Если Alt зажат, выполняем другое действие (например, удаление)
            if (e.altKey || this.isAltPressed) {
                console.log(`LoopBlockManager: Alt+click detected on block "${blockElement.getAttribute('data-block-name')}"`);
                // Реализация удаления или другого действия с блоком
                return;
            }
            
            // Обычный клик запускает зацикливание для одного блока
            console.log(`LoopBlockManager: Click detected on block "${blockElement.getAttribute('data-block-name')}"`);
            
            // Сбрасываем выбранные блоки, если они были
            this.selectedBlocks = [blockElement];
            
            // Запускаем зацикливание для этого блока
                    this.startLooping(blockElement);
        });
        
        // Двойной клик - переход к позиции блока без зацикливания
        blockElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            console.log(`LoopBlockManager: Double-click detected on block "${blockElement.getAttribute('data-block-name')}"`);
            this._navigateToBlockTime(blockElement, 'start');
        });
        
        // Контекстное меню - опции для блока
        blockElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            console.log(`LoopBlockManager: Context menu requested for block "${blockElement.getAttribute('data-block-name')}"`);
            // Здесь можно добавить отображение меню с опциями
        });
        
        // Привязываем контекст this к обработчикам
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);
    }
    
    /**
     * Handle mouse move events for dragging blocks
     * @param {MouseEvent} e - The mouse event
     * @private
     */
    _handleMouseMove(e) {
        if (!this.selectedBlock || !this.dragMode) {return;}
        
        const containerWidth = this.progressBarContainer.offsetWidth;
        const deltaX = e.clientX - this.dragStartX;
        
        if (this.dragMode === 'move') {
            // Перемещение блока
            let newLeft = this.dragStartLeft + deltaX;
            
            // Ограничиваем перемещение границами контейнера
            newLeft = Math.max(0, Math.min(containerWidth - this.selectedBlock.offsetWidth, newLeft));
            
            // Обновляем позицию блока
            this.selectedBlock.style.left = `${newLeft}px`;
        } else if (this.dragMode === 'resize-left') {
            // Изменение размера слева
            let newWidth = this.dragStartWidth - deltaX;
            let newLeft = this.dragStartLeft + deltaX;
            
            // Ограничиваем минимальную ширину и границы контейнера
            if (newWidth < 10) {
                newWidth = 10;
                newLeft = this.dragStartLeft + this.dragStartWidth - 10;
            }
            
            if (newLeft < 0) {
                newLeft = 0;
                newWidth = this.dragStartLeft + this.dragStartWidth;
            }
            
            // Обновляем размер и позицию блока
            this.selectedBlock.style.width = `${newWidth}px`;
            this.selectedBlock.style.left = `${newLeft}px`;
        } else if (this.dragMode === 'resize-right') {
            // Изменение размера справа
            let newWidth = this.dragStartWidth + deltaX;
            
            // Ограничиваем минимальную ширину и границы контейнера
            newWidth = Math.max(10, Math.min(containerWidth - this.dragStartLeft, newWidth));
            
            // Обновляем размер блока
            this.selectedBlock.style.width = `${newWidth}px`;
        }
    }
    
    /**
     * Handle mouse up events for ending drag operations
     * @private
     */
    _handleMouseUp() {
        // Обновляем данные блока после перетаскивания (startTime и endTime)
        if (this.selectedBlock) {
            const containerWidth = this.progressBarContainer.offsetWidth;
            const totalDuration = this.audioEngine ? this.audioEngine.duration : 0;
            
            if (totalDuration > 0) {
                const startPercent = (this.selectedBlock.offsetLeft / containerWidth);
                const endPercent = ((this.selectedBlock.offsetLeft + this.selectedBlock.offsetWidth) / containerWidth);
                
                const startTime = startPercent * totalDuration;
                const endTime = endPercent * totalDuration;
                
                this.selectedBlock.dataset.startTime = startTime;
                this.selectedBlock.dataset.endTime = endTime;
                
                // Обновляем отображение времени в процентах
                this.selectedBlock.style.left = `${startPercent * 100}%`;
                this.selectedBlock.style.width = `${(endPercent - startPercent) * 100}%`;
                
                // Если этот блок в последовательности или активен для зацикливания
                // обновляем состояние и перезапускаем зацикливание
                if (this.isLooping) {
                    if (this.activeLoopBlock === this.selectedBlock) {
                        // Обновляем зацикливание для одного блока
                        this.startLooping(this.selectedBlock);
                    } else if (this.selectedBlocks.includes(this.selectedBlock)) {
                        // Обновляем последовательность
                        this.startSequenceLooping(this.selectedBlocks);
                    }
                }
            }
        }
        
        // Сбрасываем состояние перетаскивания
        this.dragMode = null;
        
        // Удаляем обработчики после завершения перетаскивания
        document.removeEventListener('mousemove', this._handleMouseMove);
        document.removeEventListener('mouseup', this._handleMouseUp);
    }
    
    /**
     * Navigate to a time position in the block
     * @param {HTMLElement} blockElement - The block element to navigate to
     * @param {string} position - The position to navigate to ('start', 'end', or 'middle')
     * @private
     */
    _navigateToBlockTime(blockElement, position = 'start') {
        if (!this.audioEngine || !blockElement.dataset.startTime) {return;}
        
        let timeToSeek;
        const startTime = parseFloat(blockElement.dataset.startTime);
        const endTime = parseFloat(blockElement.dataset.endTime);
        
        switch (position) {
            case 'end':
                timeToSeek = endTime;
                break;
            case 'middle':
                timeToSeek = startTime + (endTime - startTime) / 2;
                break;
            case 'start':
            default:
                timeToSeek = startTime;
                break;
        }
        
        // Переходим к нужному времени и запускаем воспроизведение
        this.audioEngine.setCurrentTime(timeToSeek);
        this.audioEngine.play();
        
        // Если воспроизведение уже зациклено, то не меняем выделение
        if (!this.isLooping) {
            // Выделяем блок визуально
            if (this.selectedBlock) {
                this.selectedBlock.classList.remove('selected');
            }
            
            this.selectedBlock = blockElement;
            blockElement.classList.add('selected');
        }
        
        console.log(`LoopBlockManager: Navigated to block time: ${timeToSeek}s (${position})`);
    }
    
    /**
     * Clear all blocks from the progress bar
     */
    clearBlocks() {
        // Останавливаем зацикливание
        this.stopLooping();
        
        for (const block of this.blocks) {
            if (block.parentNode) {
                block.parentNode.removeChild(block);
            }
        }
        this.blocks = [];
        this.selectedBlock = null;
        this.selectedBlocks = [];
        this.activeLoopBlock = null;
        console.log('LoopBlockManager: Cleared blocks.');
    }
    
    /**
     * Инициализирует обработчики событий для синхронизации с WaveformEditor
     * @private
     */
    _initSyncListeners() {
        console.log('LoopBlockManager: Initializing sync listeners');
        
        // Слушаем событие открытия редактора
        document.addEventListener('sync-editor-opened', this._handleSyncEditorOpened.bind(this));
        
        // Слушаем событие закрытия редактора
        document.addEventListener('sync-editor-closed', this._handleSyncEditorClosed.bind(this));
        
        // Добавляем слушатели для обновления блоков при изменении маркеров
        if (window.markerManager) {
            const refreshBlocks = () => {
                if (this.isActive) {
                    setTimeout(() => this.refreshBlockPositions(), 100);
                }
            };
            
            window.markerManager.subscribe('markerAdded', refreshBlocks);
            window.markerManager.subscribe('markerUpdated', refreshBlocks);
            window.markerManager.subscribe('markerDeleted', refreshBlocks);
            window.markerManager.subscribe('markersReset', refreshBlocks);
        }
    }
    
    /**
     * Обработчик события открытия Sync редактора
     * @param {CustomEvent} event - Событие открытия редактора
     * @private
     */
    _handleSyncEditorOpened(event) {
        console.log('LoopBlockManager: Sync editor opened event received');
        
        // Если есть активный луп, синхронизируем его с редактором
        if (this.isLooping && this.activeLoopBlock) {
            // Задержка для того, чтобы редактор успел инициализироваться
            setTimeout(() => {
                const startTime = parseFloat(this.activeLoopBlock.getAttribute('data-start-time'));
                const endTime = parseFloat(this.activeLoopBlock.getAttribute('data-end-time'));
                
                this._syncWithWaveformEditor(startTime, endTime, true);
                console.log(`LoopBlockManager: Set loop in opened editor: ${startTime}s - ${endTime}s`);
            }, 200);
        }
    }
    
    /**
     * Обработчик события закрытия Sync редактора
     * @param {CustomEvent} event - Событие закрытия редактора
     * @private
     */
    _handleSyncEditorClosed(event) {
        console.log('LoopBlockManager: Sync editor closed event received');
        
        // Проверяем, есть ли данные о состоянии лупа в событии
        if (event.detail && typeof event.detail.isLoopEnabled !== 'undefined') {
            const { isLoopEnabled, loopStart, loopEnd } = event.detail;
            
            // Если луп был включен в редакторе
            if (isLoopEnabled && typeof loopStart === 'number' && typeof loopEnd === 'number') {
                console.log(`LoopBlockManager: Sync editor was closed with active loop: ${loopStart}s - ${loopEnd}s`);
                
                // Устанавливаем луп в аудио движке
                if (this.audioEngine) {
                    this.audioEngine.setLoop(loopStart, loopEnd);
                    console.log('LoopBlockManager: Updated AudioEngine loop from Sync editor');
                }
                
                // Если в LoopBlockManager не активен режим лупа, активируем его
                if (!this.isLooping) {
                    this.isLooping = true;
                    
                    // Находим блок, соответствующий границам лупа или создаем временный
                    let matchingBlock = this._findBlockByTimeRange(loopStart, loopEnd);
                    
                    if (matchingBlock) {
                        this.activeLoopBlock = matchingBlock;
                        this._highlightActiveBlock(matchingBlock);
                        console.log('LoopBlockManager: Found matching block for sync editor loop');
                    } else {
                        console.log('LoopBlockManager: No matching block found for sync editor loop');
                    }
                }
            } else if (!isLoopEnabled && this.isLooping) {
                // Если луп был выключен в редакторе, а у нас активен - синхронизируем состояние
                console.log('LoopBlockManager: Sync editor loop was disabled, stopping loop');
                this.stopLooping();
            }
        }
    }
    
    /**
     * Ищет блок, соответствующий заданному временному диапазону
     * @param {number} startTime - Время начала в секундах
     * @param {number} endTime - Время окончания в секундах
     * @returns {HTMLElement|null} - Найденный блок или null
     * @private
     */
    _findBlockByTimeRange(startTime, endTime) {
        if (!this.active || !this.container) {return null;}
        
        // Допустимая погрешность в секундах
        const tolerance = 0.2;
        
        // Получаем все блоки
        const blocks = this.container.querySelectorAll('.loop-block-indicator');
        
        // Ищем блок с соответствующими границами
        for (const block of blocks) {
            const blockStartTime = parseFloat(block.getAttribute('data-start-time'));
            const blockEndTime = parseFloat(block.getAttribute('data-end-time'));
            
            // Проверяем, совпадают ли границы с заданной точностью
            if (Math.abs(blockStartTime - startTime) <= tolerance && 
                Math.abs(blockEndTime - endTime) <= tolerance) {
                return block;
            }
        }
        
        return null;
    }

    /**
     * Начинает создание нового блока на основе позиции клика на прогресс-баре
     * @param {number} x - X координата клика
     * @private
     */
    _startBlockCreation(x) {
        // Проверяем, активен ли режим LoopBlock и нажата ли клавиша Shift
        if (!this.isActive) {
            console.log('LoopBlockManager: Block creation attempt while not in LoopBlock mode');
            return;
        }
        
        // Проверяем наличие аудио движка
        if (!this.audioEngine) {return;}
        
        const containerWidth = this.progressBarContainer.offsetWidth;
        const totalDuration = this.audioEngine.duration;
        
        // Если позиция клика превышает ширину контейнера, выходим
        if (x > containerWidth) {return;}
        
        // Вычисляем позицию и время блока
        const startPercent = (x / containerWidth);
        const startTime = startPercent * totalDuration;
        
        // Создаем блок с начальной шириной
        const blockElement = document.createElement('div');
        blockElement.className = 'loop-block-indicator creating';
        blockElement.style.position = 'absolute';
        blockElement.style.top = '0';
        blockElement.style.left = `${startPercent * 100}%`;
        blockElement.style.width = `5%`; // Начальная ширина
        blockElement.style.height = '100%';
        blockElement.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
        blockElement.style.border = '1px solid rgba(255, 165, 0, 0.7)';
        blockElement.style.borderRadius = '3px';
        blockElement.style.zIndex = '5';
        blockElement.style.cursor = 'pointer';
        
        blockElement.dataset.startTime = startTime;
        blockElement.dataset.endTime = startTime + (0.05 * totalDuration); // Начальный размер
        blockElement.dataset.blockId = `block-${Date.now()}`;
        blockElement.dataset.blockName = `Block ${this.blocks.length + 1}`;
        
        this._setupBlockInteractions(blockElement);
        this.progressBarContainer.appendChild(blockElement);
        this.blocks.push(blockElement);
        
        // Выбираем блок
        this.selectedBlock = blockElement;
        
        console.log(`LoopBlockManager: New block created at ${startTime.toFixed(2)}s`);
        
        // Если нажат Shift, начинаем перетаскивание правой границы
        if (this.isShiftPressed) {
            this.dragMode = 'resize-right';
            this.dragStartX = x;
            this.dragStartWidth = blockElement.offsetWidth;
            this.dragStartLeft = blockElement.offsetLeft;
            
            // Добавляем обработчики для перетаскивания
            document.addEventListener('mousemove', this._handleMouseMove.bind(this));
            document.addEventListener('mouseup', this._handleMouseUp.bind(this));
            
            console.log('LoopBlockManager: Started resize of new block (Shift pressed)');
        }
        
        return blockElement;
    }

    /**
     * Enable LoopBlock mode
     * @param {boolean} [notify=true] - Whether to show notification
     */
    enable(notify = true) {
        if (this.isActive) {return;}
        
        this.isActive = true;
        
        // Disable progress bar normal clicks
        this._disableProgressBarInteraction();
        
        // Add class to the container
        if (this.progressBarContainer) {
            this.progressBarContainer.classList.add('loopblock-mode');
            
            // Добавляем обработчик кликов на прогресс-бар для создания блоков при нажатом Shift
            this._progressBarClickHandler = (e) => {
                // Обрабатываем только клики с нажатым Shift
                if (e.shiftKey || this.isShiftPressed) {
                    const rect = this.progressBarContainer.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    
                    // Создаем блок с начальной позицией в месте клика
                    this._startBlockCreation(clickX);
                    
                    // Предотвращаем дальнейшую обработку события
                    e.stopPropagation();
                    e.preventDefault();
                }
            };
            
            // Добавляем обработчик кликов
            this.progressBarContainer.addEventListener('click', this._progressBarClickHandler);
        }
        
        if (notify) {
            this._showLoopBlockModeNotification(true);
        }
        
        console.log('LoopBlockManager: Mode enabled');
    }

    /**
     * Disable LoopBlock mode
     * @param {boolean} [notify=true] - Whether to show notification
     */
    disable(notify = true) {
        if (!this.isActive) {return;}
        
        this.isActive = false;
        
        // Re-enable progress bar interaction
        this._enableProgressBarInteraction();
        
        // Remove class from container
        if (this.progressBarContainer) {
            this.progressBarContainer.classList.remove('loopblock-mode');
            
            // Удаляем обработчик кликов для создания блоков
            if (this._progressBarClickHandler) {
                this.progressBarContainer.removeEventListener('click', this._progressBarClickHandler);
                this._progressBarClickHandler = null;
            }
        }
        
        // Stop looping
        this.stopLooping();
        
        if (notify) {
            this._showLoopBlockModeNotification(false);
        }
        
        console.log('LoopBlockManager: Mode disabled');
    }

    /**
     * Принудительно останавливает зацикливание и сбрасывает все состояния
     * Используется как экстренная мера при зависании лупов
     */
    forceStopLooping() {
        console.log('LoopBlockManager: Forcing loop stop - emergency mode');
        
        // Принудительно сбрасываем все переменные состояния
        this.isLooping = false;
        this.sequenceLooping = false;
        this.activeLoopBlock = null;
        this.selectedBlocks = [];
        this.currentSequenceIndex = 0;
        this._lastForceSeekTime = null;
        
        // Сбрасываем визуальные стили
        this._resetBlockStyles();
        
        // Очищаем все интервалы
        if (this.loopCheckInterval) {
            clearInterval(this.loopCheckInterval);
            this.loopCheckInterval = null;
        }
        
        // Отключаем зацикливание в AudioEngine
        if (this.audioEngine) {
            this.audioEngine.clearLoop();
        }
        
        // Отключаем зацикливание в редакторе Sync
        this._clearSyncLoop();
        
        // Показываем уведомление пользователю
        this._showEmergencyNotification();
        
        console.log('LoopBlockManager: Emergency loop stop completed');
    }

    /**
     * Показывает уведомление о принудительной остановке зацикливания
     * @private
     */
    _showEmergencyNotification() {
        // Удаляем старое уведомление, если оно есть
        const oldNotification = document.querySelector('.loopblock-emergency-notification');
        if (oldNotification) {
            oldNotification.remove();
        }
        
        // Создаем новое уведомление
        const notification = document.createElement('div');
        notification.className = 'loopblock-emergency-notification';
        notification.textContent = 'Зацикливание принудительно остановлено';
        notification.style.position = 'fixed';
        notification.style.top = '50%';
        notification.style.left = '50%';
        notification.style.transform = 'translate(-50%, -50%)';
        notification.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        notification.style.color = 'white';
        notification.style.padding = '20px';
        notification.style.borderRadius = '10px';
        notification.style.zIndex = '9999';
        notification.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        notification.style.fontWeight = 'bold';
        
        // Добавляем уведомление
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }
        }, 3000);
    }

    /**
     * Настраивает регулярную проверку положения воспроизведения для зацикливания
     * @private
     */
    _setupLoopCheck() {
        // Очищаем предыдущий интервал, если он существует
        if (this.loopCheckInterval) {
            clearInterval(this.loopCheckInterval);
            this.loopCheckInterval = null;
        }
        
        // Если нет активного блока или AudioEngine, не устанавливаем проверку
        if (!this.isLooping || !this.audioEngine) {
            return;
        }
        
        // Сбрасываем счетчик последовательных ошибок
        this.consecutiveLoopErrors = 0;
        this.lastLoopedTime = null;
        
        // Устанавливаем интервал проверки положения воспроизведения
        this.loopCheckInterval = setInterval(() => {
            // Проверки безопасности
            if (!this.isLooping || !this.audioEngine) {
                this._clearLoopCheck();
                return;
            }
            
            try {
                // Если воспроизведение приостановлено, не выполняем проверку
                if (!this.audioEngine.isPlaying) {
                    return;
                }
                
                const currentTime = this.audioEngine.getCurrentTime();
                
                // Если время недействительно, пропускаем итерацию
                if (isNaN(currentTime)) {
                    console.warn('LoopBlockManager: Invalid current time', currentTime);
                    return;
                }
                
                // Выбираем активный блок в зависимости от режима зацикливания
                let activeBlock;
                
                if (this.sequenceLooping && this.selectedBlocks.length > 0) {
                    activeBlock = this.selectedBlocks[this.currentSequenceIndex];
                } else {
                    activeBlock = this.activeLoopBlock;
                }
                
                if (!activeBlock) {
                    console.warn('LoopBlockManager: No active block for looping check');
                    return;
                }
                
                const blockStartTime = parseFloat(activeBlock.dataset.startTime);
                const blockEndTime = parseFloat(activeBlock.dataset.endTime);
                
                // Проверяем, что начало и конец блока действительны
                if (isNaN(blockStartTime) || isNaN(blockEndTime)) {
                    console.warn('LoopBlockManager: Invalid block times', {
                        start: activeBlock.dataset.startTime,
                        end: activeBlock.dataset.endTime
                    });
                    return;
                }
                
                // Защита от слишком частых переходов
                const now = Date.now();
                const timeSinceLastSeek = this._lastForceSeekTime ? (now - this._lastForceSeekTime) : 5000;
                
                // Если недавно был выполнен переход (менее 300 мс назад), пропускаем проверку
                if (timeSinceLastSeek < 300) {
                    return;
                }
                
                // Проверка на зацикливание
                if (currentTime > blockEndTime + 0.1) {
                    // Защита от повторного зацикливания в одном и том же месте
                    if (this.lastLoopedTime && Math.abs(this.lastLoopedTime - currentTime) < 0.5) {
                        this.consecutiveLoopErrors++;
                        
                        // Если много последовательных ошибок, принудительно отключаем зацикливание
                        if (this.consecutiveLoopErrors > 5) {
                            console.error('LoopBlockManager: Too many consecutive loop errors, emergency stopping loop');
                            this.forceStopLooping();
                            return;
                        }
                        
                        // Пропускаем текущий цикл, чтобы избежать зацикливания
                        console.warn('LoopBlockManager: Skipping potential infinite loop', {
                            currentTime,
                            lastLoopedTime: this.lastLoopedTime
                        });
                        return;
                    }
                    
                    console.log(`LoopBlockManager: Current time ${currentTime.toFixed(2)} is after block end ${blockEndTime.toFixed(2)}, looping to start ${blockStartTime.toFixed(2)}`);
                    
                    // Сохраняем время последнего зацикливания
                    this.lastLoopedTime = currentTime;
                    
                    // Выполняем переход к началу блока
                    this._forceSeekTo(blockStartTime);
                    
                    // Обрабатываем последовательности блоков
                    if (this.sequenceLooping && this.selectedBlocks.length > 1) {
                        this._advanceToNextBlockInSequence();
                    }
                } else if (currentTime < blockStartTime - 0.1) {
                    // Защита от обратного зацикливания
                    console.log(`LoopBlockManager: Current time ${currentTime.toFixed(2)} is before block start ${blockStartTime.toFixed(2)}, seeking to start`);
                    
                    // Отмечаем время перед переходом
                    const beforeSeekTime = this.audioEngine.getCurrentTime();
                    
                    // Выполняем переход
                    this._forceSeekTo(blockStartTime);
                    
                    // Проверяем, изменилось ли время после перехода
                    setTimeout(() => {
                        const afterSeekTime = this.audioEngine.getCurrentTime();
                        if (Math.abs(afterSeekTime - beforeSeekTime) < 0.1) {
                            console.warn('LoopBlockManager: Seek did not change time position!');
                            this.consecutiveLoopErrors++;
                            
                            // Если много последовательных ошибок, принудительно отключаем зацикливание
                            if (this.consecutiveLoopErrors > 5) {
                                console.error('LoopBlockManager: Too many consecutive seek errors, emergency stopping loop');
                                this.forceStopLooping();
                            }
                        }
                    }, 100);
                } else {
                    // Сбрасываем счетчик ошибок, если все в порядке
                    this.consecutiveLoopErrors = 0;
                }
            } catch (error) {
                console.error('LoopBlockManager: Error in loop check', error);
                this.consecutiveLoopErrors++;
                
                // Если много последовательных ошибок, принудительно отключаем зацикливание
                if (this.consecutiveLoopErrors > 5) {
                    console.error('LoopBlockManager: Too many loop check errors, emergency stopping loop');
                    this.forceStopLooping();
                }
            }
        }, 50); // Проверяем каждые 50 мс
        
        console.log('LoopBlockManager: Loop check interval set up');
    }

    /**
     * Визуально выделяет блок, активный для зацикливания
     * @param {HTMLElement} block - блок для выделения
     * @private
     */
    _highlightLoopBlock(block) {
        // Сначала сбрасываем все стили
        this._resetBlockStyles();
        
        if (!block) {
            return;
        }
        
        // Добавляем класс активного зацикливания
        block.classList.add('active-loop');
        block.style.backgroundColor = 'rgba(0, 150, 255, 0.5)';
        block.style.borderColor = '#0082e6';
        block.style.boxShadow = '0 0 8px rgba(0, 130, 230, 0.7)';
        
        // Добавляем анимацию
        block.style.transition = 'background-color 0.3s, box-shadow 0.3s';
    }

    /**
     * Перезапускает AudioEngine при возникновении проблем
     * @private
     */
    _restartAudioEngineIfNeeded() {
        console.log('LoopBlockManager: Attempting to restart AudioEngine due to issues');
        
        // Показываем уведомление о перезапуске
        const notification = document.createElement('div');
        notification.className = 'audio-restart-notification';
        notification.textContent = 'Перезапуск аудио системы...';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '9999';
        document.body.appendChild(notification);
        
        // Сохраняем текущую позицию воспроизведения
        let currentPosition = 0;
        let wasPlaying = false;
        
        try {
            if (this.audioEngine) {
                currentPosition = this.audioEngine.getCurrentTime();
                wasPlaying = this.audioEngine.isPlaying;
                
                // Останавливаем воспроизведение
                if (wasPlaying) {
                    this.audioEngine.pause();
                }
            }
            
            // Отправляем событие для перезапуска аудио системы
            const event = new CustomEvent('audio-engine-restart-request', {
                detail: {
                    currentPosition,
                    wasPlaying
                }
            });
            window.dispatchEvent(event);
            
            // Удаляем уведомление через 3 секунды
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        } catch (error) {
            console.error('LoopBlockManager: Error during AudioEngine restart attempt:', error);
            
            // Показываем ошибку в уведомлении
            if (notification.parentNode) {
                notification.textContent = 'Ошибка перезапуска аудио системы';
                notification.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                
                // Удаляем уведомление об ошибке через 5 секунд
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 5000);
            }
        }
    }

    /**
     * Обновляет визуальное отображение выбранных блоков с правильной нумерацией
     * @private
     */
    _updateBlocksHighlighting() {
        // Сначала сбрасываем стили всех блоков
        this._resetAllBlockStyles();
        
        // Если нет выбранных блоков, просто выходим
        if (!this.selectedBlocks || this.selectedBlocks.length === 0) {
            return;
        }
        
        // Если у нас один активный блок, выделяем его как активный
        if (this.activeLoopBlock && !this.sequenceLooping) {
            this._highlightLoopBlock(this.activeLoopBlock);
            return;
        }
        
        // Если у нас последовательность, выделяем все блоки в ней
        if (this.sequenceLooping) {
            this._highlightBlocks(this.selectedBlocks, this.currentSequenceIndex);
            console.log(`LoopBlockManager: Updated highlighting for ${this.selectedBlocks.length} blocks`);
        }
    }
    
    /**
     * Запускает зацикливание для последовательности блоков
     * @private
     */
    _startSequenceLooping() {
        if (!this.selectedBlocks.length || !this.audioEngine) {
            console.log('LoopBlockManager: Cannot start sequence looping - no blocks or audio engine');
            return;
        }
        
        try {
            // Сортируем блоки по времени начала для правильного порядка воспроизведения
            this.selectedBlocks.sort((a, b) => {
                return parseFloat(a.dataset.startTime) - parseFloat(b.dataset.startTime);
            });
            
            // Устанавливаем флаги зацикливания
            this.isLooping = true;
            this.sequenceLooping = true;
            this.activeLoopBlock = null;  // Сбрасываем одиночный блок
            
            // Если только один блок, устанавливаем зацикливание для него
            if (this.selectedBlocks.length === 1) {
                const block = this.selectedBlocks[0];
                const startTime = parseFloat(block.dataset.startTime);
                const endTime = parseFloat(block.dataset.endTime);
                
                if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
                    console.warn('LoopBlockManager: Invalid block for looping:', block.dataset);
                    return;
                }
                
                console.log(`LoopBlockManager: Setting loop for single block: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
                this.audioEngine.setLoop(startTime, endTime);
                
                // Инициализируем индекс последовательности
                this.currentSequenceIndex = 0;
                
                // Подсвечиваем блок
                this._highlightBlocks(this.selectedBlocks, 0);
                
                // Переходим к началу блока, если необходимо
                const currentTime = this.audioEngine.getCurrentTime();
                if (currentTime < startTime || currentTime > endTime) {
                    this.audioEngine.seekTo(startTime);
                }
                
                return;
            }
            
            // Для нескольких блоков настраиваем последовательное воспроизведение
            console.log(`LoopBlockManager: Started sequence looping for ${this.selectedBlocks.length} blocks`);
            
            // Выводим информацию о последовательности блоков
            this.selectedBlocks.forEach((block, index) => {
                const startTime = parseFloat(block.dataset.startTime);
                const endTime = parseFloat(block.dataset.endTime);
                console.log(`  Block ${index + 1}: "${block.dataset.blockName}" (${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)`);
            });
            
            // Инициализируем индекс текущего блока в последовательности
            // и устанавливаем точки зацикливания для первого блока
            this.currentSequenceIndex = 0;
            const firstBlock = this.selectedBlocks[0];
            const startTime = parseFloat(firstBlock.dataset.startTime);
            const endTime = parseFloat(firstBlock.dataset.endTime);
            
            // Устанавливаем зацикливание только для первого блока изначально
            this.audioEngine.setLoop(startTime, endTime);
            
            // Подсвечиваем первый блок в последовательности
            this._highlightBlocks(this.selectedBlocks, 0);
            
            // Переходим к началу последовательности, если необходимо
            const currentTime = this.audioEngine.getCurrentTime();
            if (currentTime < startTime) {
                this.audioEngine.seekTo(startTime);
            }
        } catch (error) {
            console.error('LoopBlockManager: Error starting sequence looping:', error);
            // Отключаем зацикливание в случае ошибки
            this.isLooping = false;
            this.sequenceLooping = false;
        }
    }

    /**
     * Запускает интервал проверки позиции воспроизведения
     * @private
     */
    _startPlaybackPositionCheck() {
        // Очищаем существующий интервал, если он есть
        if (this.loopCheckInterval) {
            clearInterval(this.loopCheckInterval);
            this.loopCheckInterval = null;
        }

        // Создаем новый интервал проверки
        this.loopCheckInterval = setInterval(() => {
            this._checkPlaybackPosition();
        }, 50); // Проверяем каждые 50 мс
    }

    /**
     * Обновляет статус активного зацикливания и отображает уведомление
     * @param {boolean} isActive - Активно ли зацикливание
     * @param {string} [blockName] - Название блока (опционально)
     * @private
     */
    _updateActiveLoopStatus(isActive, blockName = '') {
        // Обновляем статус в DOM
        const statusEl = document.getElementById('loop-status');
        if (!statusEl) {
            const newStatusEl = document.createElement('div');
            newStatusEl.id = 'loop-status';
            newStatusEl.className = 'loop-status';
            document.body.appendChild(newStatusEl);
        }
        
        const statusElement = document.getElementById('loop-status');
        if (statusElement) {
            if (isActive) {
                statusElement.textContent = `Looping: ${blockName || 'Active'}`;
                statusElement.classList.add('active');
            } else {
                statusElement.textContent = 'Loop: Inactive';
                statusElement.classList.remove('active');
            }
        }
        
        // Добавляем стиль, если его нет
        if (!document.getElementById('loop-status-style')) {
            const style = document.createElement('style');
            style.id = 'loop-status-style';
            style.textContent = `
                .loop-status {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-size: 12px;
                    z-index: 9999;
                    transition: all 0.2s ease;
                    opacity: 0.7;
                }
                .loop-status.active {
                    background-color: rgba(0, 128, 0, 0.7);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Сбрасывает стили всех блоков на стандартные
     * @private
     */
    _resetAllBlockStyles() {
        const blocks = document.querySelectorAll('.loop-block');
        blocks.forEach(block => {
            // Сбрасываем стили блока
            block.style.backgroundColor = '';
            block.style.borderColor = '';
            block.style.boxShadow = '';
            
            // Удаляем класс активного лупа
            block.classList.remove('active-loop');
            
            // Удаляем индикаторы зацикливания, если они есть
            const indicators = block.querySelectorAll('.loop-indicator');
            indicators.forEach(indicator => indicator.remove());
        });
    }

    /**
     * Обрабатывает Shift+клик на блоке
     * @param {HTMLElement} blockElement - Элемент блока, по которому был клик
     * @private
     */
    _handleShiftClick(blockElement) {
        if (!blockElement) {return;}
        
        // Получаем информацию о блоке
        const blockName = blockElement.getAttribute('data-block-name');
        
        // Проверяем, существует ли массив выбранных блоков
        if (!this.selectedBlocks) {
            this.selectedBlocks = [];
        }
        
        // Проверяем, есть ли уже блок в последовательности
        const blockIndex = this.selectedBlocks.findIndex(block => 
            block.getAttribute('data-block-name') === blockName && 
            block.getAttribute('data-start-time') === blockElement.getAttribute('data-start-time')
        );
        
        if (blockIndex !== -1) {
            // Если блок уже выбран, удаляем его из последовательности
            this.selectedBlocks.splice(blockIndex, 1);
            console.log(`LoopBlockManager: Removed block "${blockName}" from sequence (total: ${this.selectedBlocks.length})`);
        } else {
            // Если не выбран, добавляем его в последовательность
            this.selectedBlocks.push(blockElement);
            console.log(`LoopBlockManager: Added block "${blockName}" to sequence (total: ${this.selectedBlocks.length})`);
        }
        
        // Обновляем визуальное отображение выбранных блоков
        this._updateBlocksHighlighting();
        
        // Если у нас есть хотя бы один блок, запускаем последовательное воспроизведение
        if (this.selectedBlocks && this.selectedBlocks.length > 0) {
            // Если только один блок, запускаем обычное зацикливание
            if (this.selectedBlocks.length === 1) {
                console.log(`LoopBlockManager: Setting loop for single block: ${this.selectedBlocks[0].getAttribute('data-start-time')}s - ${this.selectedBlocks[0].getAttribute('data-end-time')}s`);
                this.startLooping(this.selectedBlocks[0]);
            } else {
                // Иначе запускаем последовательное воспроизведение
                this.startSequenceLooping(this.selectedBlocks);
            }
        } else {
            // Если блоков не осталось, останавливаем зацикливание
            this.stopLooping();
        }
    }

    /**
     * Обновляет отображение последовательности выбранных блоков
     * @private
     */
    _updateSelectedBlocksDisplay() {
        // Удаляем дубликаты блоков в последовательности
        if (this.selectedBlocks && this.selectedBlocks.length > 0) {
            // Создаем карту для проверки дубликатов
            const uniqueBlocks = new Map();
            
            // Фильтруем только уникальные блоки
            this.selectedBlocks = this.selectedBlocks.filter(block => {
                if (!block) {return false;}
                
                const blockId = block.getAttribute('data-block-name') + '_' + 
                                block.getAttribute('data-start-time') + '_' + 
                                block.getAttribute('data-end-time');
                
                if (uniqueBlocks.has(blockId)) {
                    console.log(`LoopBlockManager: Removing duplicate block "${block.getAttribute('data-block-name')}"`);
                    return false;
                } else {
                    uniqueBlocks.set(blockId, true);
                    return true;
                }
            });
            
            // Сортируем блоки по времени начала
            this.selectedBlocks.sort((a, b) => {
                return parseFloat(a.getAttribute('data-start-time')) - 
                       parseFloat(b.getAttribute('data-start-time'));
            });
            
            console.log(`LoopBlockManager: Updated sequence with ${this.selectedBlocks.length} unique blocks`);
            
            // Обновляем визуальное отображение
            if (this.sequenceLooping) {
                this._highlightBlocks(this.selectedBlocks, this.currentSequenceIndex);
            }
        }
    }

    /**
     * Показывает диагностическую информацию о блоках и маркерах
     * Полезно для отладки несоответствий
     */
    logDiagnosticInfo() {
        console.group('LoopBlockManager: Diagnostic Information');
        
        try {
            console.log('Audio Duration:', this.audioEngine ? this.audioEngine.duration : 'Not available');
            
            // Выводим информацию о текстовых блоках
            const textBlocks = this.lyricsDisplay ? this.lyricsDisplay.textBlocks : [];
            console.log(`Text Blocks: ${textBlocks.length}`);
            
            textBlocks.forEach((block, index) => {
                console.group(`Block ${index + 1}: ${block.name}`);
                console.log('ID:', block.id);
                console.log('Lines:', block.lineIndices);
                
                // Находим соответствующий визуальный блок
                const visualBlock = document.querySelector(`.loop-block-indicator[data-block-id="${block.id}"]`);
                if (visualBlock) {
                    console.log('Visual Block Found');
                    console.log('StartTime:', visualBlock.dataset.startTime);
                    console.log('EndTime:', visualBlock.dataset.endTime);
                    console.log('Position:', `${visualBlock.style.left} - Width: ${visualBlock.style.width}`);
                } else {
                    console.warn('No Visual Block Found for this text block!');
                }
                
                // Выводим маркеры для строк этого блока
                const markers = window.markerManager ? window.markerManager.getMarkers() : [];
                const blockMarkers = markers.filter(m => block.lineIndices.includes(m.lineIndex));
                
                console.log(`Markers for this block: ${blockMarkers.length}`);
                blockMarkers.forEach(marker => {
                    console.log(`Line ${marker.lineIndex}: ${marker.time}s - "${marker.text?.substring(0, 30)}..."`);
                });
                
                // Находим маркер для следующей строки после последней в блоке
                if (markers.length > 0) {
                    const lastLineIndex = Math.max(...block.lineIndices);
                    const nextMarkers = markers.filter(m => m.lineIndex > lastLineIndex);
                    if (nextMarkers.length > 0) {
                        nextMarkers.sort((a, b) => a.lineIndex - b.lineIndex);
                        const nextMarker = nextMarkers[0];
                        console.log(`Next Marker: Line ${nextMarker.lineIndex}: ${nextMarker.time}s`);
                    } else {
                        console.log('No Next Marker Found');
                    }
                }
                
                console.groupEnd();
            });
            
            // Общая информация о маркерах
            const markers = window.markerManager ? window.markerManager.getMarkers() : [];
            console.log(`Total Markers: ${markers.length}`);
            
            if (markers.length > 0) {
                const firstMarker = markers.reduce((min, marker) => 
                    marker.time < min.time ? marker : min, markers[0]);
                const lastMarker = markers.reduce((max, marker) => 
                    marker.time > max.time ? marker : max, markers[0]);
                
                console.log(`First Marker: Line ${firstMarker.lineIndex} at ${firstMarker.time}s`);
                console.log(`Last Marker: Line ${lastMarker.lineIndex} at ${lastMarker.time}s`);
            }
        } catch (error) {
            console.error('Error generating diagnostic info:', error);
        }
        
        console.groupEnd();
    }

    /**
     * Обновляет позиции визуальных блоков без полной перерисовки
     * Полезно при изменении маркеров
     */
    refreshBlockPositions() {
        console.log('LoopBlockManager: Refreshing block positions');
        
        if (!this.lyricsDisplay || !this.lyricsDisplay.textBlocks || !this.audioEngine) {
            console.warn('LoopBlockManager: Cannot refresh blocks - missing dependencies');
            return false;
        }
        
        // Получаем текстовые блоки и маркеры
        const textBlocks = this.lyricsDisplay.textBlocks;
        const markers = window.markerManager ? window.markerManager.getMarkers() : null;
        const totalDuration = this.audioEngine.duration;
        
        if (textBlocks.length === 0) {
            console.warn('LoopBlockManager: No text blocks to refresh');
            return false;
        }
        
        // Счетчик обновленных блоков
        let updatedBlocks = 0;
        
        // Проходим по всем текстовым блокам
        for (const block of textBlocks) {
            // Находим соответствующий визуальный блок в DOM
            const blockElement = document.querySelector(`.loop-block-indicator[data-block-id="${block.id}"]`);
            if (!blockElement) {
                console.warn(`LoopBlockManager: No visual block found for "${block.name}"`);
                continue;
            }
            
            // Получаем индексы строк блока
            const lineIndices = block.lineIndices;
            if (!lineIndices || lineIndices.length === 0) {
                console.warn(`LoopBlockManager: No line indices for block "${block.name}"`);
                continue;
            }
            
            // Определяем время блока на основе маркеров
            let startTime = parseFloat(blockElement.dataset.startTime) || 0;
            let endTime = parseFloat(blockElement.dataset.endTime) || totalDuration;
            let wasUpdated = false;
            
            // Если доступны маркеры, обновляем времена
            if (markers && markers.length > 0) {
                // Находим маркер для первой строки блока
                const firstLineIndex = Math.min(...lineIndices);
                const firstLineMarker = markers.find(m => m.lineIndex === firstLineIndex);
                
                // Находим следующий маркер после последней строки блока
                const lastLineIndex = Math.max(...lineIndices);
                let nextLineMarker = null;
                
                for (const marker of markers) {
                    if (marker.lineIndex > lastLineIndex) {
                        nextLineMarker = marker;
                        break;
                    }
                }
                
                // Обновляем времена если найдены соответствующие маркеры
                if (firstLineMarker && firstLineMarker.time !== undefined) {
                    startTime = firstLineMarker.time;
                    wasUpdated = true;
                }
                
                if (nextLineMarker && nextLineMarker.time !== undefined) {
                    endTime = nextLineMarker.time;
                    wasUpdated = true;
                } else if (wasUpdated) {
                    // Если нашли только первый маркер, примерно оцениваем длительность
                    const lastLineMarker = markers.find(m => m.lineIndex === lastLineIndex);
                    if (lastLineMarker && lastLineMarker.time !== undefined) {
                        endTime = lastLineMarker.time + 3;
                        endTime = Math.min(endTime, totalDuration);
                    }
                }
            }
            
            if (wasUpdated) {
                // Обновляем атрибуты и позицию блока
                blockElement.dataset.startTime = startTime;
                blockElement.dataset.endTime = endTime;
                
                // Рассчитываем проценты для позиционирования
                const startPercent = (startTime / totalDuration) * 100;
                const endPercent = (endTime / totalDuration) * 100;
                const widthPercent = endPercent - startPercent;
                
                // Обновляем стили
                blockElement.style.left = `${startPercent}%`;
                blockElement.style.width = `${widthPercent}%`;
                
                updatedBlocks++;
                console.log(`LoopBlockManager: Updated block "${block.name}": ${startTime}s - ${endTime}s`);
            }
        }
        
        console.log(`LoopBlockManager: Refreshed ${updatedBlocks} of ${textBlocks.length} blocks`);
        return updatedBlocks > 0;
    }
}

// Создаем глобальный экземпляр LoopBlockManager только если этот скрипт загружен после зависимостей
if (window.audioEngine && window.lyricsDisplay) {
    window.LoopBlockManager = LoopBlockManager;
} else {
    console.warn('LoopBlockManager: Required dependencies not loaded. LoopBlockManager class is available but not initialized.');
} 