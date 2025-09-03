/**
 * BlockLoopControl - Компонент для зацикливания блоков в режиме репетиции
 * Создает кнопку Loop рядом с активным блоком и управляет зацикливанием
 */

class BlockLoopControl {
    constructor(audioEngine, lyricsDisplay, markerManager) {
        this.audioEngine = audioEngine;
        this.lyricsDisplay = lyricsDisplay;
        this.markerManager = markerManager;
        
        // Состояние компонента
        this.isActive = false;
        this.isLooping = false;
        this.currentLoopBlock = null;
        this.loopStartTime = null; // null вместо 0 - чтобы отличать неустановленное значение
        this.loopEndTime = null;   // null вместо 0 - чтобы отличать неустановленное значение
        this.lastJumpTime = 0;      // Защита от частых прыжков
        this.diagnosticCounter = 0;  // Счетчик для логирования
        
        // 🎯 НОВЫЙ ФЛАГ: Отслеживание пользовательских границ
        this.hasUserDefinedBoundaries = false;
        this.userBoundaries = null; // Сохраняем пользовательские границы
        
         // 🎯 MULTI-LOOP (MVP: +1 блок)
         this.isMultiLoopEnabled = false;   // общий флаг
         this.linkedBlock = null;           // следующий блок
         this.combinedStartTime = null;     // итоговое начало (из первого блока)
         this.combinedEndTime = null;       // итоговый конец (из второго блока)
         this.plusButton = null;            // UI плюсик под Stop
         // Многоблочный паровозик
         this.selectedBlocks = [];          // массив blockId в порядке воспроизведения
         this.loopChipsContainer = null;    // контейнер чипов под Stop
         // Поезд вагончиков (V2 UI)
         this.loopTrainContainer = null;

        // Состояние перемотки для предотвращения race condition
        this.isSeekingInProgress = false;
        this.seekStartTime = null;
        
        // Буферное время после перемотки для игнорирования изменений блоков
        this.lastSeekTime = 0;
        this.seekStabilizationBuffer = 500; // 500мс буфер после перемотки
        
        // Флаг для точной коррекции
        this.isCorrectionInProgress = false;
        this.correctionStartTime = null;
        
        // ⚡ НОВЫЕ ФЛАГИ ДЛЯ УСИЛЕННОЙ НАДЕЖНОСТИ ЛУПА
        this.isPreJumpReady = false; // Флаг готовности к упреждающему прыжку
        this.seekTimeouts = null; // Массив timeouts для очистки при успешном seek
        
        // UI элементы
        this.loopButton = null;
        this.currentBlockElement = null;
        this.lastRenderedBlockId = null;
        
        // Инициализируем DragBoundaryController
        this.dragBoundaryController = new DragBoundaryController(this, this.lyricsDisplay);
        
        // Память пользовательских границ по блокам: blockId -> { startBoundary, endBoundary }
        this.blockBoundaryMemory = new Map();
        
        // Привязываем контекст для обработчиков
        this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
        this.handleBlockChange = this.handleBlockChange.bind(this);
        this.handleLoopSeek = this.handleLoopSeek.bind(this);
        
        console.log('🎛️ BlockLoopControl initialized with seeking flag and seek buffer');

        // Флаг открытого Sync Editor (гибридный режим) — поезд скрываем полностью
        this._isSyncEditorOpen = false;
    }
    
    /**
     * Активирует компонент (только в режиме репетиции)
     */
    activate() {
        if (this.isActive) {return;}
        
        this.isActive = true;
        console.log('BlockLoopControl: Активирован');
        
        // Настраиваем обработчики событий
        this._setupEventListeners();
        
        // Создаем кнопку для текущего активного блока
        this._createLoopButtonForCurrentBlock();
        
        // Запускаем систему автоматического восстановления
        this._startAutoRecoverySystem();

        // Перерисовка поезда при ресайзе окна
        this._onResize = () => {
            try { this._renderLoopTrain(); } catch(_) {}
        };
        window.addEventListener('resize', this._onResize);

        // Слежение за скроллом с лёгким дебаунсом
        this._onScroll = () => {
            clearTimeout(this._trainPosTimer);
            this._trainPosTimer = setTimeout(() => {
                try { this._updateTrainPortalPosition(); } catch(_) {}
            }, 120);
        };
        window.addEventListener('scroll', this._onScroll, { passive: true });

        // Наблюдаем за каталогом и сменой режимов
        this._ensureOverlayAndModeObservers();

        // Мягкое сокрытие/появление поезда при смене режимов, чтобы избежать скачков
        this._onModeChanged = (e) => {
            const detail = (e && e.detail) || {};
            const from = detail.from;
            const to = detail.to;
            if (to === 'live' || to === 'concert') {
                try { this._hideTrainContainer(); } catch(_) {}
            } else if ((from === 'live' || from === 'concert') && (to === 'karaoke' || to === 'rehearsal')) {
                clearTimeout(this._trainPosTimer);
                this._trainPosTimer = setTimeout(() => {
                    try {
                        this._renderLoopTrain();
                        this._updateTrainPortalPosition();
                    } catch(_) {}
                }, 140);
                // Несколько упреждающих репозиций в первые ~400мс после смены режима
                try {
                    const kicks = [40, 120, 240, 360];
                    kicks.forEach(ms => setTimeout(() => {
                        try { this._updateTrainPortalPosition(); } catch(_) {}
                    }, ms));
                } catch(_) {}
            }
        };
        window.addEventListener('mode-changed', this._onModeChanged);

        // Событие телепромптера (концерт/лайв): обновить позицию немедленно
        this._onTeleprompterScroll = () => {
            try {
                this._updateTrainPortalPosition();
                this._updateTrainPortalPositionUntilStable();
            } catch(_) {}
        };
        window.addEventListener('lyrics-teleprompter-scroll', this._onTeleprompterScroll);

        // События Sync Editor: скрываем поезд при открытии, возвращаем при закрытии
        this._onSyncOpened = () => {
            this._isSyncEditorOpen = true;
            try { this._hideTrainContainer(); } catch(_) {}
            // Во время Sync Editor убираем слушатели скролла/ресайза
            try {
                if (this._onScroll) { window.removeEventListener('scroll', this._onScroll); }
                if (this._onResize) { window.removeEventListener('resize', this._onResize); }
            } catch(_) {}
        };
        this._onSyncClosed = () => {
            this._isSyncEditorOpen = false;
            // Небольшая задержка для стабилизации layout, затем ререндер и стабильное позиционирование
            setTimeout(() => {
                try {
                    // Если после Sync активна караоке-имитация — не показывать поезд
                    const isWaveformActive = document.body.classList.contains('waveform-active');
                    const isKaraoke = document.body.classList.contains('mode-karaoke');
                    if (!isWaveformActive && !isKaraoke) {
                        this._renderLoopTrain();
                    } else {
                        this._hideTrainContainer();
                    }
                    this._updateTrainPortalPosition();
                    this._updateTrainPortalPositionUntilStable();
                    // Возвращаем слушатели после закрытия редактора
                    if (this._onResize) { window.addEventListener('resize', this._onResize); }
                    if (this._onScroll) { window.addEventListener('scroll', this._onScroll, { passive: true }); }
                } catch(_) {}
            }, 60);
        };
        window.addEventListener('sync-editor-opened', this._onSyncOpened);
        window.addEventListener('sync-editor-closed', this._onSyncClosed);

        // Быстрый поллинг на первые секунды: показать поезд сразу после появления блоков
        let pollCount = 0;
        this._trainReadyPoll = setInterval(() => {
            pollCount += 1;
            const isRehearsal = document.body.classList.contains('mode-rehearsal');
            const hasBlocks = Array.isArray(this.lyricsDisplay?.textBlocks) && this.lyricsDisplay.textBlocks.length > 0;
            if (isRehearsal && hasBlocks) {
                try { this._renderLoopTrain(); } catch(_) {}
                clearInterval(this._trainReadyPoll);
                this._trainReadyPoll = null;
            }
            if (pollCount >= 60) { // максимум ~6 секунд
                clearInterval(this._trainReadyPoll);
                this._trainReadyPoll = null;
            }
        }, 100);
    }
    
    /**
     * Деактивирует компонент
     */
    deactivate() {
        if (!this.isActive) {return;}
        
        this.isActive = false;
        console.log('BlockLoopControl: Деактивирован');
        
        // Останавливаем зацикливание если активно
        if (this.isLooping) {
            this.stopLooping();
        }
        
        // Останавливаем систему автоматического восстановления
        this._stopAutoRecoverySystem();
        
        // Деактивируем DragBoundaryController
        if (this.dragBoundaryController) {
            this.dragBoundaryController.deactivate();
        }
        
        // Убираем кнопку
        this._removeLoopButton();
        
        // Отписываемся от событий
        this._removeEventListeners();

        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this._onScroll) {
            window.removeEventListener('scroll', this._onScroll);
            this._onScroll = null;
        }
        if (this._onModeChanged) {
            window.removeEventListener('mode-changed', this._onModeChanged);
            this._onModeChanged = null;
        }
        if (this._onTeleprompterScroll) {
            window.removeEventListener('lyrics-teleprompter-scroll', this._onTeleprompterScroll);
            this._onTeleprompterScroll = null;
        }
        if (this._onSyncOpened) {
            window.removeEventListener('sync-editor-opened', this._onSyncOpened);
            this._onSyncOpened = null;
        }
        if (this._onSyncClosed) {
            window.removeEventListener('sync-editor-closed', this._onSyncClosed);
            this._onSyncClosed = null;
        }
        if (this._trainReadyPoll) {
            clearInterval(this._trainReadyPoll);
            this._trainReadyPoll = null;
        }

        // Полная очистка портала-поезда и наблюдателей
        try { this._destroyLoopTrain(); } catch(_) {}
        if (this._catalogObserver) { try { this._catalogObserver.disconnect(); } catch(_) {} this._catalogObserver = null; }
        if (this._bodyClassObserver) { try { this._bodyClassObserver.disconnect(); } catch(_) {} this._bodyClassObserver = null; }
        if (this._lyricsContainerObserver) { try { this._lyricsContainerObserver.disconnect(); } catch(_) {} this._lyricsContainerObserver = null; }
    }
    
    /**
     * Настраивает обработчики событий
     * @private
     */
    _setupEventListeners() {
        // Подписываемся на обновления позиции от AudioEngine
            this.audioEngine.onPositionUpdate(this.handleTimeUpdate);
        
        // Подписываемся на событие завершения перемотки
        if (this.audioEngine.audioElement) {
            this.audioEngine.audioElement.addEventListener('seeked', this.handleLoopSeek);
            console.log('🔔 SEEKED event listener subscribed');
        }
        
        // Слушаем изменения активного блока
        document.addEventListener('active-line-changed', this.handleBlockChange);

        // Ранний хук после рендера текста (если событие используется в системе)
        try {
            document.addEventListener('lyrics-rendered', () => {
                if (!this.isActive) {return;}
                try {
                    this._createLoopButtonForCurrentBlock();
                    // Ранний ререндер и позиционирование портала, чтобы поезд не появлялся наверху
                    this._renderLoopTrain();
                    this._updateTrainPortalPosition();
                } catch (e) {
                    console.warn('BlockLoopControl: Не удалось создать Loop-кнопку по событию lyrics-rendered', e);
                }
            });
        } catch (e) {
            // безопасно игнорируем, если события нет в системе
        }
    }
    
    /**
     * Убирает обработчики событий
     * @private
     */
    _removeEventListeners() {
        // Убираем колбэк обновления позиции из AudioEngine
        if (this.audioEngine && this.audioEngine._onPositionUpdateCallbacks) {
            const callbackIndex = this.audioEngine._onPositionUpdateCallbacks.indexOf(this.handleTimeUpdate);
            if (callbackIndex > -1) {
                this.audioEngine._onPositionUpdateCallbacks.splice(callbackIndex, 1);
            }
        }
        
        // Убираем слушатель события seeked
        if (this.audioEngine && this.audioEngine.audioElement) {
            this.audioEngine.audioElement.removeEventListener('seeked', this.handleLoopSeek);
            console.log('🔔 SEEKED event listener removed');
        }
        
        document.removeEventListener('active-line-changed', this.handleBlockChange);
    }
    
    /**
     * Создает кнопку Loop для текущего активного блока
     * @private
     */
    _createLoopButtonForCurrentBlock() {
        console.log('BlockLoopControl: _createLoopButtonForCurrentBlock called');
        
        if (!this.lyricsDisplay) {
            console.log('BlockLoopControl: lyricsDisplay not available');
            return;
        }
        
        console.log('BlockLoopControl: lyricsDisplay.currentActiveBlock:', this.lyricsDisplay.currentActiveBlock);
        console.log('BlockLoopControl: lyricsDisplay.textBlocks:', this.lyricsDisplay.textBlocks);
        
        // В режиме репетиции получаем активный блок напрямую
        if (this.lyricsDisplay.currentActiveBlock) {
            const currentBlock = this.lyricsDisplay.currentActiveBlock;
            if (this.lastRenderedBlockId === currentBlock.id && this.loopButton) {
                // Обновим только режим линий/визуал если надо
                this._syncDragModeForBlock(currentBlock);
                this._updateButtonState(this.isLooping);
                // Удерживаем оранжевую рамку при активном лупе
                if (this.isLooping && this.currentBlockElement) {
                    this.currentBlockElement.classList.add('loop-active');
                }
                return;
            }
            console.log('BlockLoopControl: Создаем кнопку для активного блока репетиции:', currentBlock.name);
            this._createLoopButton(currentBlock);
            return;
        }
        
        // В других режимах используем textBlocks
        if (!this.lyricsDisplay.textBlocks) {
            console.log('BlockLoopControl: textBlocks not available');
            return;
        }
        
        // Находим текущий активный блок
        const activeLineIndex = this.lyricsDisplay.activeLineIndex;
        console.log('BlockLoopControl: activeLineIndex:', activeLineIndex);
        
        if (activeLineIndex === null || activeLineIndex === undefined) {
            console.log('BlockLoopControl: activeLineIndex is null/undefined');
            return;
        }
        
        const currentBlock = this._findBlockByLineIndex(activeLineIndex);
        if (!currentBlock) {
            console.log('BlockLoopControl: currentBlock not found for line', activeLineIndex);
            return;
        }
        
        console.log('BlockLoopControl: Создаем кнопку для блока:', currentBlock.name);
        this._createLoopButton(currentBlock);
    }
    
    /**
     * Находит блок по индексу строки
     * @param {number} lineIndex - индекс строки
     * @returns {Object|null} - найденный блок или null
     * @private
     */
    _findBlockByLineIndex(lineIndex) {
        if (!this.lyricsDisplay || !this.lyricsDisplay.textBlocks) {return null;}
        
        let currentLineCount = 0;
        
        for (const block of this.lyricsDisplay.textBlocks) {
            const blockEndLine = currentLineCount + block.lines.length - 1;
            
            if (lineIndex >= currentLineCount && lineIndex <= blockEndLine) {
                return {
                    ...block,
                    startLineIndex: currentLineCount,
                    endLineIndex: blockEndLine
                };
            }
            
            currentLineCount += block.lines.length;
        }
        
        return null;
    }
    
    /**
     * Создает кнопку Loop для блока
     * @param {Object} block - блок для зацикливания
     * @private
     */
    _createLoopButton(block) {
        console.log('BlockLoopControl: _createLoopButton called for block:', block.name);
        
        // Убираем старую кнопку если есть
        this._removeLoopButton();
        
        // Находим DOM элемент блока
        const blockElement = this._findBlockDOMElement(block);
        console.log('BlockLoopControl: blockElement found:', !!blockElement);
        
        if (!blockElement) {
            console.log('BlockLoopControl: DOM element for block not found');
            return;
        }
        
        // Создаем кнопку
        this.loopButton = document.createElement('button');
        this.loopButton.className = 'block-loop-btn';
        this.loopButton.innerHTML = this.isLooping ? 'Stop' : 'Loop';
        this.loopButton.title = `Зациклить блок "${block.name}"`;
        
        // Обработчик клика (Stop должен полностью сбрасывать систему)
        this.loopButton.addEventListener('click', () => {
            this.toggleLooping(block);
            if (!this.isLooping) {
                // Если произошла остановка — очистить паровозик и UI
                this._clearTrain();
            }
        });
        
        // Добавляем кнопку рядом с блоком
        this._positionLoopButton(blockElement);
        
        // Сохраняем привязки DOM
        this.currentBlockElement = blockElement;
        this.lastRenderedBlockId = block.id;

        // Активируем DragBoundaryController с восстановлением границ и корректным режимом
        if (this.dragBoundaryController && this.isActive) {
            let mode = 'both';
            if (this.isLooping && this.isMultiLoopEnabled) {
                if (this.linkedBlock && block.id === this.linkedBlock.id) {
                    mode = 'end-only';
                } else if (this.currentLoopBlock && block.id === this.currentLoopBlock.id) {
                    mode = 'start-only';
                }
            }
            const remembered = this._getRememberedBoundaries(block.id);
            this.dragBoundaryController.activate(block, blockElement, remembered || null, { mode });
            console.log('BlockLoopControl: Создана кнопка для блока:', block.name);
        }

        // Отрисовка поезда вагончиков (всегда в репетиции)
        this._renderLoopTrain();
        
        // Если луп активен — синхронизируем состоян ие Stop и подсветку
        if (this.isLooping) {
            // Синхронизируем визуальное состояние Stop сразу после пересоздания DOM
            this._updateButtonState(true);
            // Подсветка активного блока всегда при включенном лупе
            if (blockElement) {
                blockElement.classList.add('loop-active');
            }
        }
        
        // На всякий случай обновим подсветку вагона
        this._updateTrainPlayingHighlight();
        
        console.log('BlockLoopControl: Кнопка создана для блока:', block.name);
    }
    
    /**
     * Находит DOM элемент блока
     * @param {Object} block - блок
     * @returns {Element|null} - DOM элемент или null
     * @private
     */
    _findBlockDOMElement(block) {
        // В режиме репетиции ищем активный блок
        const rehearsalBlock = document.querySelector('.rehearsal-active-block');
        if (rehearsalBlock) {
            return rehearsalBlock;
        }
        
        // В других режимах ищем .block-container
        const blockContainers = document.querySelectorAll('.block-container');
        
        for (const container of blockContainers) {
            // Ищем по названию блока или ID
            if (container.dataset.blockId === block.id || 
                container.querySelector('.block-name')?.textContent === block.name) {
                return container;
            }
        }
        
        return null;
    }
    
    /**
     * Позиционирует кнопку Loop рядом с блоком
     * @param {Element} blockElement - DOM элемент блока
     * @private
     */
    _positionLoopButton(blockElement) {
        // Добавляем кнопку в правый верхний угол блока
        blockElement.style.position = 'relative';
        this.loopButton.style.position = 'absolute';
        // Переносим кнопку в правый НИЖНИЙ угол, чтобы не перекрывалась вагончиками
        this.loopButton.style.right = '10px';
        this.loopButton.style.bottom = '10px';
        this.loopButton.style.top = '';
        // Повышаем z-index на случай наложения
        this.loopButton.style.zIndex = '1016';
        
        blockElement.appendChild(this.loopButton);
    }
    
    /**
     * Убирает кнопку Loop
     * @private
     */
    _removeLoopButton() {
        if (this.loopButton) {
            this.loopButton.remove();
            this.loopButton = null;
        }
        if (this.plusButton) { this.plusButton.remove(); this.plusButton = null; }
        
        // НЕ деактивируем drag boundaries при удалении кнопки
        // Границы должны деактивироваться только при полном отключении контроллера
        // if (this.dragBoundaryController) {
        //     this.dragBoundaryController.deactivate();
        // }
        
        this.currentBlockElement = null;
        // НЕ сбрасываем currentLoopBlock - он может понадобиться для drag boundaries
        // this.currentLoopBlock = null;
        
        console.log('BlockLoopControl: Кнопка удалена, drag boundaries остаются активными');
    }
    
    /**
     * Переключает зацикливание блока
     * @param {Object} block - блок для зацикливания
     */
    toggleLooping(block) {
        if (this.isLooping && this.currentLoopBlock?.id === block.id) {
            this.stopLooping();
        } else {
            this.startLooping(block);
        }
    }
    
    /**
     * Запускает зацикливание блока
     * @param {Object} block - блок для зацикливания
     */
    startLooping(block) {
        if (!this.audioEngine || !block) {
            console.warn('BlockLoopControl: Cannot start looping - missing audioEngine or block');
            return;
        }

        console.log(`BlockLoopControl: Запуск зацикливания блока: ${block.name}`);

        // 🎯 КРИТИЧЕСКОЕ УЛУЧШЕНИЕ: Проверяем пользовательские границы из DragBoundaryController
        let timeRange = null;
        
        if (this.dragBoundaryController && this.dragBoundaryController.isActive) {
            const boundaries = this.dragBoundaryController.getBoundaries();
            
            if (boundaries && boundaries.startBoundary !== null && boundaries.endBoundary !== null) {
                // Получаем временные метки для пользовательских границ
                const startTime = this._findTimeByLine(boundaries.startBoundary);
                const endTime = this._findTimeByLine(boundaries.endBoundary + 1); // следующая строка для конца
                
                if (startTime !== null && endTime !== null) {
                    timeRange = { startTime, endTime };
                    console.log(`🎯 USING USER BOUNDARIES: Lines ${boundaries.startBoundary}-${boundaries.endBoundary} = ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s`);
                } else {
                    console.warn('🎯 USER BOUNDARIES INVALID: Could not convert line indices to time, falling back to block boundaries');
                }
            }
        }
        
        // Если пользовательские границы не доступны, используем границы блока
        if (!timeRange) {
            timeRange = this._getBlockTimeRange(block);
            console.log(`📦 USING BLOCK BOUNDARIES: ${timeRange?.startTime?.toFixed(2)}s-${timeRange?.endTime?.toFixed(2)}s`);
        }

        if (!timeRange || timeRange.startTime === null || timeRange.endTime === null) {
            console.error('BlockLoopControl: Не удалось определить временные границы');
            return;
        }

        // Сохраняем параметры зацикливания
        this.loopStartTime = timeRange.startTime;
        this.loopEndTime = timeRange.endTime;
        this.currentLoopBlock = block;
        this.isLooping = true;

        console.log(`BlockLoopControl: Временные границы лупа: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);

        // НЕ перематываем на начало блока - пусть воспроизведение продолжается
        // Зацикливание сработает когда дойдет до конца блока естественным образом
        console.log(`BlockLoopControl: Зацикливание установлено, воспроизведение продолжается без прерывания`);

        // Обновляем состояние кнопки
        this._updateButtonState(true);

        // Добавляем оранжевую окантовку блока
        if (this.currentBlockElement) {
            this.currentBlockElement.classList.add('loop-active');
            console.log('BlockLoopControl: Добавлена оранжевая окантовка блока');
        }

        // Инициализация комбинированных границ (пока только один блок)
        this.combinedStartTime = this.loopStartTime;
        this.combinedEndTime = this.loopEndTime;
        this.isMultiLoopEnabled = false;
        this.linkedBlock = null;
        // Плюсик отключён в новой концепции поезда
 
        console.log(`BlockLoopControl: Зацикливание активно ${this.loopStartTime}s - ${this.loopEndTime}s (без прерывания воспроизведения)`);
    }
    
    /**
     * Останавливает зацикливание
     */
    stopLooping() {
        if (!this.isLooping) {return;}
        
        console.log('BlockLoopControl: Остановка зацикливания');
        
        this.isLooping = false;
        // НЕ сбрасываем currentLoopBlock - он нужен для drag boundaries
        // this.currentLoopBlock = null; 
        this.loopStartTime = null;
        this.loopEndTime = null;
        this.lastJumpTime = 0; // Сбрасываем защиту от прыжков
        
        // 🔧 ИСПРАВЛЕНИЕ: Сбрасываем пользовательские границы при остановке лупа
        this.hasUserDefinedBoundaries = false;
        this.userBoundaries = null;

        // Сбрасываем multi-loop
        this.isMultiLoopEnabled = false;
        this.linkedBlock = null;
        this.combinedStartTime = null;
        this.combinedEndTime = null;
        
        // Обновляем вид кнопки
        this._updateButtonState(false);
        
        // Убираем эффект свечения блока
        if (this.currentBlockElement) {
            this.currentBlockElement.classList.remove('loop-active');
        }
        // Убираем подсветку с подключенного блока
        const linkedEl = document.querySelector('.rehearsal-active-block.loop-linked');
        if (linkedEl) {linkedEl.classList.remove('loop-linked');}
        
        // НЕ деактивируем drag boundaries при остановке лупа
        // Границы должны оставаться активными для возможности перетаскивания
        console.log('BlockLoopControl: Зацикливание остановлено, drag boundaries остаются активными');
    }
    
    /**
     * Получает временные границы блока
     * @param {Object} block - блок
     * @returns {Object|null} - объект с start и end временами или null
     * @private
     */
    _getBlockTimeRange(block) {
        if (!block || !block.lineIndices || block.lineIndices.length === 0) {
            console.warn('BlockLoopControl: Invalid block for time range calculation:', block);
            return { startTime: null, endTime: null };
        }

        if (!this.markerManager) {
            console.warn('BlockLoopControl: MarkerManager not available');
            return { startTime: null, endTime: null };
        }

        const markers = this.markerManager.getMarkers();
        if (!markers || markers.length === 0) {
            console.warn('BlockLoopControl: No markers available');
            return { startTime: null, endTime: null };
        }

        console.log(`BlockLoopControl: Calculating time range for block "${block.name}" with lines [${block.lineIndices.join(',')}]`);
        console.log(`BlockLoopControl: Available markers count: ${markers.length}`);

        // Получаем индекс первой строки текущего блока
        const firstLineIndex = Math.min(...block.lineIndices);
        
        // Получаем индекс последней строки текущего блока
        const lastLineIndex = Math.max(...block.lineIndices);
        
        console.log(`BlockLoopControl: Block line range: ${firstLineIndex} to ${lastLineIndex}`);

        // Находим первый маркер текущего блока (начало лупа)
        let startMarker = null;
        for (const marker of markers) {
            if (marker.lineIndex === firstLineIndex) {
                startMarker = marker;
                console.log(`BlockLoopControl: Found start marker for line ${firstLineIndex}: ${marker.time.toFixed(2)}s`);
                break;
            }
        }

        // Если не нашли точный маркер для первой строки, ищем ближайший
        if (!startMarker) {
            console.log(`BlockLoopControl: No exact start marker found for line ${firstLineIndex}, searching for nearest next marker`);
            for (const marker of markers) {
                if (marker.lineIndex >= firstLineIndex) {
                    startMarker = marker;
                    console.log(`BlockLoopControl: Using nearest marker for line ${marker.lineIndex}: ${marker.time.toFixed(2)}s as start`);
                    break;
                }
            }
        }

        // Находим первый маркер СЛЕДУЮЩЕГО блока (конец лупа)
        // Это будет первый маркер после последней строки текущего блока
        let endMarker = null;
        console.log(`BlockLoopControl: Searching for end marker after line ${lastLineIndex}`);
        
        for (const marker of markers) {
            if (marker.lineIndex > lastLineIndex) {
                endMarker = marker;
                console.log(`BlockLoopControl: Found end marker (first of next block) for line ${marker.lineIndex}: ${marker.time.toFixed(2)}s`);
                break;
            }
        }

        // Если не нашли следующий блок, используем продолжительность трека
        if (!endMarker && this.audioEngine) {
            const duration = (typeof this.audioEngine.getDuration === 'function')
                ? this.audioEngine.getDuration()
                : (this.audioEngine.duration || 0);
            if (duration > 0) {
                endMarker = { time: duration };
                console.log(`BlockLoopControl: Using track duration ${duration.toFixed(2)}s as end marker (no next block found)`);
            }
        }

        if (!startMarker) {
            console.warn('BlockLoopControl: Could not determine start time for block');
            return { startTime: null, endTime: null };
        }

        if (!endMarker) {
            console.warn('BlockLoopControl: Could not determine end time for block');
            return { startTime: null, endTime: null };
        }

        const startTime = startMarker.time;
        const endTime = endMarker.time;

        console.log(`BlockLoopControl: Block "${block.name}" LOOP BOUNDS: START=${startTime.toFixed(2)}s END=${endTime.toFixed(2)}s (duration: ${(endTime - startTime).toFixed(2)}s)`);

        return { startTime, endTime };
    }
    
    /**
     * Обновляет состояние кнопки
     * @param {boolean} isActive - активно ли зацикливание
     * @private
     */
    _updateButtonState(isActive) {
        if (!this.loopButton) {return;}
        
        if (isActive) {
            this.loopButton.classList.add('active');
            this.loopButton.innerHTML = 'Stop'; // Активная иконка
            this.loopButton.title = 'Остановить зацикливание';
        } else {
            this.loopButton.classList.remove('active');
            this.loopButton.innerHTML = 'Loop'; // Неактивная иконка
            this.loopButton.title = `Зациклить блок "${this.currentLoopBlock?.name || ''}"`;
        }
    }
    
    /**
     * Обработчик обновления времени - проверяет зацикливание
     * @param {number} currentTime - текущее время воспроизведения
     */
    handleTimeUpdate(currentTime) {
        if (!this.isActive || !this.isLooping) {return;}
        
        this.diagnosticCounter++;
        
        // 🔒 КРИТИЧЕСКАЯ ЗАЩИТА: Блокируем все проверки лупа во время перемотки
        if (this.isSeekingInProgress) {
            const seekDuration = Date.now() - this.seekStartTime;
            console.log(`🔒 LOOP CHECKS BLOCKED: Seek in progress for ${seekDuration}ms`);
            return;
        }
        
        // 🔒 ЗАЩИТА ОТ КОРРЕКЦИИ: Блокируем проверки во время точной коррекции
        if (this.isCorrectionInProgress) {
            const correctionDuration = Date.now() - this.correctionStartTime;
            console.log(`🔧 LOOP CHECKS BLOCKED: Correction in progress for ${correctionDuration}ms`);
            return;
        }
        
        // Детальная диагностика реже, каждые 30 проверок
        if (this.diagnosticCounter % 30 === 0) {
            const audioState = this.audioEngine.isPlaying ? 'playing' : 'paused';
            console.debug(`🔍 LOOP DIAGNOSTIC #${this.diagnosticCounter}:`);
            const s = this.isMultiLoopEnabled ? this.combinedStartTime : this.loopStartTime;
            const e = this.isMultiLoopEnabled ? this.combinedEndTime : this.loopEndTime;
            console.debug(`     Current: ${currentTime.toFixed(3)}s`);
            console.debug(`     Loop Range: ${s?.toFixed(3)}s - ${e?.toFixed(3)}s`);
            console.debug(`     End Threshold: ${(e - 0.05).toFixed(3)}s`);
            console.debug(`     Time Since Last Jump: ${(Date.now() - this.lastJumpTime) / 1000}s`);
            console.debug(`     Audio State: ${audioState}`);
        }
        
        // ⚡ КРИТИЧЕСКОЕ УСИЛЕНИЕ: Расширенные "ворота" для надежного срабатывания
        // Увеличиваем буфер до 150мс и добавляем упреждающий прыжок
        const loopEnd = this.isMultiLoopEnabled ? this.combinedEndTime : this.loopEndTime;
        const loopStart = this.isMultiLoopEnabled ? this.combinedStartTime : this.loopStartTime;
        const preJumpThreshold = loopEnd - 0.15;
        const criticalThreshold = loopEnd - 0.05;
        
        // 🎯 УПРЕЖДАЮЩИЙ ПРЫЖОК: Готовимся к прыжку заранее
        if (currentTime >= preJumpThreshold && currentTime < criticalThreshold) {
            // Проверяем готовность к прыжку
        const now = Date.now();
            const timeSinceLastJump = this.lastJumpTime ? now - this.lastJumpTime : Infinity;
            const minJumpInterval = 1200; // Уменьшаем интервал до 1.2 секунды для более отзывчивого лупа
            
            if (timeSinceLastJump >= minJumpInterval && !this.isSeekingInProgress) {
                console.log(`🚀 PRE-JUMP PREPARATION at ${currentTime.toFixed(3)}s (${(this.loopEndTime - currentTime).toFixed(3)}s until end)`);
                this.isPreJumpReady = true;
            }
        }
        
        // 🔄 ОСНОВНАЯ ЛОГИКА ПРЫЖКА: Срабатывает в критическом пороге или при готовности к упреждающему прыжку
        if (currentTime >= criticalThreshold || (this.isPreJumpReady && currentTime >= preJumpThreshold)) {
            const triggerType = this.isPreJumpReady ? 'PRE-JUMP' : 'CRITICAL';
            console.log(`🚨 LOOP ${triggerType} TRIGGERED at ${currentTime.toFixed(3)}s`);
            
            // Проверяем минимальный интервал между перемотками
            const now = Date.now();
            const timeSinceLastJump = this.lastJumpTime ? now - this.lastJumpTime : Infinity;
            const minJumpInterval = 1200; // Уменьшенный интервал для более отзывчивого лупа
            
            console.log(`    Time since last jump: ${(timeSinceLastJump / 1000).toFixed(1)}s`);
            console.log(`    Jump allowed: ${timeSinceLastJump >= minJumpInterval} (min interval: ${minJumpInterval/1000}s)`);
            console.log(`    Currently seeking: ${this.isSeekingInProgress}`);
            
            if (timeSinceLastJump >= minJumpInterval && !this.isSeekingInProgress) {
                // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем что цель перемотки находится в том же блоке
                const currentBlock = this.currentLoopBlock;
                if (currentBlock && currentBlock.lineIndices) {
                    // Находим строку, соответствующую loopStartTime
                    const targetLine = this._findLineByTime(loopStart);
                    const blockContainsTarget = currentBlock.lineIndices.includes(targetLine);
                    
                    console.log(`🎯 JUMP TARGET VALIDATION:`);
                    console.log(`    Target time: ${loopStart.toFixed(3)}s`);
                    console.log(`    Target line: ${targetLine}`);
                    console.log(`    Current block lines: [${currentBlock.lineIndices.join(',')}]`);
                    console.log(`    Block contains target: ${blockContainsTarget}`);
                    
                    if (!blockContainsTarget) {
                        console.warn(`⚠️ JUMP TARGET OUTSIDE BLOCK: Adjusting to block start`);
                        // Корректируем цель перемотки на начало текущего блока
                        const blockStartLine = Math.min(...currentBlock.lineIndices);
                        const adjustedStartTime = this._findTimeByLine(blockStartLine);
                        if (adjustedStartTime !== null) {
                            console.log(`🔧 ADJUSTED TARGET: ${adjustedStartTime.toFixed(3)}s (line ${blockStartLine})`);
                            this.loopStartTime = adjustedStartTime; this.combinedStartTime = adjustedStartTime;
                        }
                    }
                }
                
                // ⚡ ДВОЙНОЕ ПОДТВЕРЖДЕНИЕ: Усиленный механизм seek с подтверждением
                const seekTarget = loopStart + 0.01;
                console.log(`🔄 EXECUTING ${triggerType} LOOP JUMP: ${currentTime.toFixed(3)}s → ${loopStart.toFixed(3)}s (target: ${seekTarget.toFixed(3)}s)`);
                console.log(`🔒 SEEK STARTED: isSeekingInProgress = true`);
                
                // Устанавливаем флаги
                this.isSeekingInProgress = true;
                this.isPreJumpReady = false; // Сбрасываем флаг готовности
                this.seekStartTime = Date.now();
                
                // ⚡ АВАРИЙНЫЙ FALLBACK: Двойной timeout для надежности
                const primaryTimeout = setTimeout(() => {
                    if (this.isSeekingInProgress) {
                        console.warn('⚠️ PRIMARY SEEK TIMEOUT: Forcing isSeekingInProgress = false after 300ms');
                        this.isSeekingInProgress = false;
                        this.lastSeekTime = Date.now();
                    }
                }, 300);
                
                const emergencyTimeout = setTimeout(() => {
                    if (this.isSeekingInProgress) {
                        console.error('💥 EMERGENCY SEEK TIMEOUT: Force-clearing seek state after 800ms');
                        this.isSeekingInProgress = false;
                        this.lastSeekTime = Date.now();
                        clearTimeout(primaryTimeout);
                    }
                }, 800);
                
                try {
                    console.log(`   Executing setCurrentTime(${seekTarget.toFixed(3)})`);
                    console.log(`   Time before seek: ${currentTime.toFixed(3)}s`);
                    this.audioEngine.setCurrentTime(seekTarget);
                    this.lastJumpTime = Date.now();
                    
                    // Сохраняем timeouts для очистки при успешном seek
                    this.seekTimeouts = [primaryTimeout, emergencyTimeout];
                } catch (error) {
                    console.error('❌ SEEK ERROR:', error);
                    this.isSeekingInProgress = false;
                    this.isPreJumpReady = false;
                    clearTimeout(primaryTimeout);
                    clearTimeout(emergencyTimeout);
                }
            } else if (this.isSeekingInProgress) {
                console.log(`⏳ JUMP BLOCKED: Seek already in progress`);
            } else {
                console.log(`⏳ JUMP SUPPRESSED: Too soon since last jump (${(timeSinceLastJump / 1000).toFixed(1)}s < ${minJumpInterval/1000}s)`);
                
                // 🚨 ДИАГНОСТИКА КАСКАДНЫХ СБОЕВ: Более агрессивная защита
                if (timeSinceLastJump < minJumpInterval && currentTime > this.loopEndTime + 0.5) {
                    console.error(`💥 CASCADE FAILURE DETECTED: Playback ${(currentTime - this.loopEndTime).toFixed(1)}s beyond loop end`);
                    console.error(`   Emergency action: Force-allowing immediate jump to prevent complete loop failure`);
                    // В критической ситуации разрешаем экстренный прыжок
                    this.lastJumpTime = 0; // Сбрасываем ограничение
                    this.isPreJumpReady = true; // Активируем готовность к прыжку
                }
            }
        } else {
            // Логируем когда мы в "безопасной зоне"
            const timeUntilEnd = loopEnd - currentTime;
            if (this.diagnosticCounter % 10 === 0 && timeUntilEnd > 1.0) {
                console.log(`✅ LOOP SAFE: ${timeUntilEnd.toFixed(1)}s until loop end`);
            }
        }
    }
    
    /**
     * Обработчик изменения активного блока
     * @param {Event} event - событие изменения блока
     */
    handleBlockChange(event) {
        if (!this.isActive) {return;}
        
        // Обновляем мягкую подсветку текущего вагона
        try { this._updateTrainPlayingHighlight(); } catch(_) {}
        
        const currentLoopBlock = this.currentLoopBlock;
        const newActiveBlock = this.lyricsDisplay.currentActiveBlock;
        
        console.log('📡 BLOCK CHANGE EVENT received');
        console.log(`   Current loop block: ${currentLoopBlock ? currentLoopBlock.name + ' (ID: ' + currentLoopBlock.id + ')' : 'None'}`);
        console.log(`   New active block: ${newActiveBlock ? newActiveBlock.name + ' (ID: ' + newActiveBlock.id + ')' : 'None'}`);
        console.log(`   Loop is active: ${this.isLooping}`);
        console.log(`   Seeking in progress: ${this.isSeekingInProgress}`);
        
        // 🛡️ КРИТИЧЕСКАЯ ЗАЩИТА: Игнорируем изменения блоков во время перемотки
        if (this.isSeekingInProgress) {
            console.log('🔒 IGNORING BLOCK CHANGE: Seek in progress, this is likely caused by the loop jump');
            return;
        }
        
        // 🛡️ НОВАЯ ЗАЩИТА: Игнорируем изменения блоков в течение буферного времени после перемотки
        if (this.lastSeekTime) {
            const timeSinceSeek = Date.now() - this.lastSeekTime;
            if (timeSinceSeek < this.seekStabilizationBuffer) {
                console.log(`🛡️ SEEK BUFFER ACTIVE: Ignoring block change (${timeSinceSeek}ms since seek, buffer: ${this.seekStabilizationBuffer}ms)`);
                return;
            } else {
                console.log(`✅ SEEK BUFFER EXPIRED: ${timeSinceSeek}ms since seek, processing block change`);
                this.lastSeekTime = 0; // Сбрасываем буфер
            }
        }
        
        // 🎯 КРИТИЧЕСКАЯ ПРОВЕРКА: Если луп активен, проверяем пользовательские границы DragBoundaryController
        if (this.isLooping) {
            console.log(`🎯 LOOP IS ACTIVE: Checking user boundaries`);
            console.log(`   DragBoundaryController exists: ${!!this.dragBoundaryController}`);
            console.log(`   DragBoundaryController is active: ${this.dragBoundaryController?.isActive}`);
            console.log(`   Has user defined boundaries: ${this.hasUserDefinedBoundaries}`);
            
            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем, что границы относятся к текущему блоку
            if (this.dragBoundaryController && this.dragBoundaryController.isActive) {
                const currentLineIndex = this.lyricsDisplay.activeLineIndex;
                const boundaries = this.dragBoundaryController.getBoundaries();
                
                console.log(`🎯 USER BOUNDARY DETAILED CHECK:`);
                console.log(`   Current line index: ${currentLineIndex}`);
                console.log(`   Boundaries object:`, boundaries);
                
                // 🔧 НОВАЯ ПРОВЕРКА: Убеждаемся что границы относятся к текущему блоку
                if (boundaries && newActiveBlock && currentLineIndex !== null && currentLineIndex !== undefined) {
                    const { startBoundary, endBoundary } = boundaries;
                    const blockLines = newActiveBlock.lineIndices || [];
                    
                    // Проверяем, что границы находятся в пределах текущего блока
                    const boundariesInCurrentBlock = blockLines.includes(startBoundary) && blockLines.includes(endBoundary);
                    
                    console.log(`🎯 BOUNDARY VALIDATION:`);
                    console.log(`   Current block lines: [${blockLines.join(',')}]`);
                    console.log(`   User boundaries: ${startBoundary} - ${endBoundary}`);
                    console.log(`   Boundaries in current block: ${boundariesInCurrentBlock}`);
                    
                    if (!boundariesInCurrentBlock) {
                        // В режиме multi-loop допускаем границы второго блока
                        if (this.isMultiLoopEnabled && this.linkedBlock) {
                            const linkedLines = this.linkedBlock.lineIndices || [];
                            const inLinked = linkedLines.includes(startBoundary) && linkedLines.includes(endBoundary);
                            if (inLinked) {
                                console.log('✅ MULTI-LOOP BOUNDARIES: Boundaries belong to linked block, keeping loop');
                                this._createLoopButtonForCurrentBlock();
                                return;
                            }
                        }
                        console.log(`🚨 INVALID BOUNDARIES: User boundaries don't belong to current block, stopping loop`);
                        // Сбрасываем пользовательские границы
                        this.hasUserDefinedBoundaries = false;
                        this.userBoundaries = null;
                    } else {
                        const isWithinUserBoundaries = currentLineIndex >= startBoundary && currentLineIndex <= endBoundary;
                        
                        console.log(`🎯 USER BOUNDARY CHECK:`);
                        console.log(`   Current line: ${currentLineIndex}`);
                        console.log(`   User boundaries: ${startBoundary} - ${endBoundary}`);
                        console.log(`   Within boundaries: ${isWithinUserBoundaries}`);
                        
                        if (isWithinUserBoundaries) {
                            console.log(`✅ STAYING WITHIN USER BOUNDARIES: Not stopping loop - line ${currentLineIndex} is within user-defined range ${startBoundary}-${endBoundary}`);
                            
                            // Обновляем кнопку для нового блока, но НЕ останавливаем луп
                            this._createLoopButtonForCurrentBlock();
                            return;
                        }
                        
                        console.log(`🚨 LINE OUTSIDE USER BOUNDARIES: Line ${currentLineIndex} is outside user range ${startBoundary}-${endBoundary}, checking other conditions`);
                    }
                } else {
                    console.log(`⚠️ BOUNDARY CHECK FAILED: boundaries=${!!boundaries}, currentLineIndex=${currentLineIndex}`);
                }
            } else {
                console.log(`⚠️ NO USER BOUNDARIES: DragBoundaryController not active, proceeding with normal block change logic`);
            }
        }
        
        // Диагностика мерцающих состояний
        if (!newActiveBlock && currentLoopBlock) {
            console.warn('⚠️ FLICKER DETECTED: New active block is null while loop block exists');
            console.log(`   Current time: ${Date.now()}`);
            
            // Grace period для восстановления состояния
            setTimeout(() => {
                const recoveredBlock = this.lyricsDisplay.currentActiveBlock;
                if (recoveredBlock) {
                    console.log(`✅ FLICKER RECOVERED: Block restored to ${recoveredBlock.name}`);
                } else {
                    console.warn('❌ FLICKER PERSISTS: Block still null after grace period');
                }
            }, 100);
            return;
        }
        
        // ТРИГГЕР СМЕНЫ ФОНА ДЛЯ РЕПЕТИЦИИ (без лупа и без перемотки)
        try {
            const isRehearsal = document.body.classList.contains('mode-rehearsal');
            if (isRehearsal && !this.isLooping && !this.isSeekingInProgress && window.app?.rehearsalBackgroundManager) {
                window.app.rehearsalBackgroundManager.setRandomBackgroundSmooth();
            }
        } catch(_) {}
        
        // Если новый блок и текущий блок лупа существуют
        if (newActiveBlock && this.currentLoopBlock) {
            // Ранний guard: при активном multi-loop держим луп при переходах по ЛЮБОМУ блоку цепочки
            if (this.isLooping && this.isMultiLoopEnabled && (
                (Array.isArray(this.selectedBlocks) && this.selectedBlocks.includes(newActiveBlock.id)) ||
                newActiveBlock.id === this.currentLoopBlock.id || (this.linkedBlock && newActiveBlock.id === this.linkedBlock.id)
            )) {
                console.log('✅ MULTI-LOOP CONTINUE (early guard): keep looping across linked blocks');
                this._createLoopButtonForCurrentBlock();
                return;
            }
            // ✅ MULTI-LOOP: если активный блок входит в цепочку — продолжаем без остановки
            if (this.isLooping && this.isMultiLoopEnabled && (
                (Array.isArray(this.selectedBlocks) && this.selectedBlocks.includes(newActiveBlock.id)) ||
                newActiveBlock.id === this.currentLoopBlock.id || (this.linkedBlock && newActiveBlock.id === this.linkedBlock.id)
            )) {
                console.log('✅ MULTI-LOOP CONTINUE: staying in combined loop across blocks');
                // Переставляем кнопку на новый активный блок, чтобы она всегда была рядом
                this._createLoopButtonForCurrentBlock();
                return;
            }
            // Сравниваем по ID блока И по имени блока для большей точности
            const sameBlockId = newActiveBlock.id === this.currentLoopBlock.id;
            const sameBlockName = newActiveBlock.name === this.currentLoopBlock.name;
            
            console.log(`   Same block ID: ${sameBlockId}`);
            console.log(`   Same block name: ${sameBlockName}`);
            
            // Дополнительная проверка: сравниваем индексы строк блоков
            const currentBlockLines = this.currentLoopBlock.lineIndices || [];
            const newBlockLines = newActiveBlock.lineIndices || [];
            const sameLines = JSON.stringify(currentBlockLines.sort()) === JSON.stringify(newBlockLines.sort());
            
            console.log(`   Current block lines: [${currentBlockLines.join(',')}]`);
            console.log(`   New block lines: [${newBlockLines.join(',')}]`);
            console.log(`   Same lines: ${sameLines}`);
            
            // Дополнительная проверка: сравниваем временные границы блоков
            let sameTimeRange = false;
            if (this.markerManager) {
                const currentTimeRange = this._getBlockTimeRange(this.currentLoopBlock);
                const newTimeRange = this._getBlockTimeRange(newActiveBlock);
                
                if (currentTimeRange && newTimeRange && 
                    currentTimeRange.startTime !== null && newTimeRange.startTime !== null &&
                    currentTimeRange.endTime !== null && newTimeRange.endTime !== null) {
                    
                    const timeDiff = Math.abs(currentTimeRange.startTime - newTimeRange.startTime) + 
                                   Math.abs(currentTimeRange.endTime - newTimeRange.endTime);
                    sameTimeRange = timeDiff < 0.1; // Разница менее 0.1 секунды считается одинаковой
                    
                    console.log(`   Current time range: ${currentTimeRange.startTime.toFixed(3)}s - ${currentTimeRange.endTime.toFixed(3)}s`);
                    console.log(`   New time range: ${newTimeRange.startTime.toFixed(3)}s - ${newTimeRange.endTime.toFixed(3)}s`);
                    console.log(`   Time difference: ${timeDiff.toFixed(3)}s`);
                    console.log(`   Same time range: ${sameTimeRange}`);
                }
            }
            
            if ((sameBlockId || sameBlockName) && sameLines && sameTimeRange) {
                console.log(`✅ SAME BLOCK CONFIRMED: Not stopping loop - this is the same block`);
                return; // Остаемся в том же блоке - НЕ трогаем зацикливание и handles
            }
        }
        
        console.log(`🔄 DIFFERENT BLOCK DETECTED: Proceeding with block change logic`);
        console.log(`   Was looping: ${this.isLooping}`);
        
        // Останавливаем текущее зацикливание только если блок действительно изменился
        if (this.isLooping) {
            console.log(`BlockLoopControl: Блок изменился, останавливаем зацикливание`);
            console.log(`BlockLoopControl: Текущий блок лупа: ${this.currentLoopBlock?.name}`);
            console.log(`BlockLoopControl: Новый активный блок: ${newActiveBlock?.name}`);
            this.stopLooping();
        } else {
            console.log(`ℹ️ NO LOOP TO STOP: Loop was not active`);
        }
        
        // Создаем кнопку для нового блока
        console.log(`🔧 CREATING LOOP BUTTON: For new active block`);
        this._createLoopButtonForCurrentBlock();
        // Ререндер поезда на смене блока
        try { this._renderLoopTrain(); } catch(_) {}
    }
    
    /**
     * Обновляет кнопку для текущего активного блока
     * Вызывается при изменении блока
     */
    updateForCurrentBlock() {
        if (!this.isActive) {return;}
        
        console.log('BlockLoopControl: Обновление для текущего блока');
        // Обновляем подсветку поезда
        try { this._updateTrainPlayingHighlight(); } catch(_) {}
        
        // 🎯 КРИТИЧЕСКАЯ ПРОВЕРКА: Если луп активен, проверяем пользовательские границы DragBoundaryController
        if (this.isLooping && this.dragBoundaryController && this.dragBoundaryController.isActive) {
            const currentLineIndex = this.lyricsDisplay.activeLineIndex;
            const boundaries = this.dragBoundaryController.getBoundaries();
            
            if (boundaries && currentLineIndex !== null && currentLineIndex !== undefined) {
                const { startBoundary, endBoundary } = boundaries;
                const isWithinUserBoundaries = currentLineIndex >= startBoundary && currentLineIndex <= endBoundary;
                
                console.log(`🎯 UPDATE BOUNDARY CHECK:`);
                console.log(`   Current line: ${currentLineIndex}`);
                console.log(`   User boundaries: ${startBoundary} - ${endBoundary}`);
                console.log(`   Within boundaries: ${isWithinUserBoundaries}`);
                
                if (isWithinUserBoundaries) {
                    console.log(`✅ STAYING WITHIN USER BOUNDARIES (UPDATE): Not stopping loop - line ${currentLineIndex} is within user-defined range ${startBoundary}-${endBoundary}`);
                    
                    // Обновляем кнопку для нового блока, но НЕ останавливаем луп
                    this._createLoopButtonForCurrentBlock();
                    return;
                }
                
                console.log(`🚨 LINE OUTSIDE USER BOUNDARIES (UPDATE): Line ${currentLineIndex} is outside user range ${startBoundary}-${endBoundary}, checking other conditions`);
            }
        }
        
        // Проверяем, изменился ли блок на самом деле
        const newActiveBlock = this.lyricsDisplay?.currentActiveBlock;
        // ✅ MULTИ-LOOP: если активен ЛЮБОЙ блок из выбранной цепочки — не трогаем луп
        if (this.isLooping && this.isMultiLoopEnabled && newActiveBlock) {
            const isChainMember = Array.isArray(this.selectedBlocks) && this.selectedBlocks.includes(newActiveBlock.id);
            const isEdge = (newActiveBlock.id === this.currentLoopBlock?.id) || (this.linkedBlock && newActiveBlock.id === this.linkedBlock.id);
            if (isChainMember || isEdge) {
            console.log('✅ MULTI-LOOP CONTINUE (update): staying in combined loop across blocks');
            this._createLoopButtonForCurrentBlock();
            return;
            }
        }
        
        // Если новый блок и текущий блок лупа существуют
        if (newActiveBlock && this.currentLoopBlock) {
            // Сравниваем по ID блока И по имени блока для большей точности
            const sameBlockId = newActiveBlock.id === this.currentLoopBlock.id;
            const sameBlockName = newActiveBlock.name === this.currentLoopBlock.name;
            
            // Дополнительная проверка: сравниваем индексы строк блоков
            const currentBlockLines = this.currentLoopBlock.lineIndices || [];
            const newBlockLines = newActiveBlock.lineIndices || [];
            const sameLines = JSON.stringify(currentBlockLines.sort()) === JSON.stringify(newBlockLines.sort());
            
            // Дополнительная проверка: сравниваем временные границы блоков
            let sameTimeRange = false;
            if (this.markerManager) {
                const currentTimeRange = this._getBlockTimeRange(this.currentLoopBlock);
                const newTimeRange = this._getBlockTimeRange(newActiveBlock);
                
                if (currentTimeRange && newTimeRange && 
                    currentTimeRange.startTime !== null && newTimeRange.startTime !== null &&
                    currentTimeRange.endTime !== null && newTimeRange.endTime !== null) {
                    
                    const timeDiff = Math.abs(currentTimeRange.startTime - newTimeRange.startTime) + 
                                   Math.abs(currentTimeRange.endTime - newTimeRange.endTime);
                    sameTimeRange = timeDiff < 0.1; // Разница менее 0.1 секунды считается одинаковой
                }
            }
            
            if ((sameBlockId || sameBlockName) && sameLines && sameTimeRange) {
                console.log('BlockLoopControl: Тот же блок с теми же временными границами, зацикливание продолжается');
            return; // Остаемся в том же блоке - не трогаем зацикливание
            }
        }
        
        console.log('BlockLoopControl: Блок изменился, останавливаем зацикливание');
        console.log('BlockLoopControl: Текущий блок лупа:', this.currentLoopBlock?.name);
        console.log('BlockLoopControl: Новый активный блок:', newActiveBlock?.name);
        
        // Останавливаем текущее зацикливание только если блок действительно изменился
        if (this.isLooping) {
            this.stopLooping();
        }
        
        // Создаем кнопку для нового блока
        this._createLoopButtonForCurrentBlock();
        // Ререндер поезда при обновлении
        try { this._renderLoopTrain(); } catch(_) {}
    }
    
    /**
     * Обработчик изменения границ от DragBoundaryController
     * @param {Object} boundaries - новые границы {startTime, endTime}
     */
    onBoundaryChange(boundaries) {
        if (!this.isLooping || !boundaries) {return;}
        
        console.log('BlockLoopControl: Границы изменены через drag:', boundaries);
        
        // 🎯 УСТАНАВЛИВАЕМ ФЛАГ ПОЛЬЗОВАТЕЛЬСКИХ ГРАНИЦ
        this.hasUserDefinedBoundaries = true;
        this.userBoundaries = { ...boundaries };
        console.log('🎯 USER BOUNDARIES SET: hasUserDefinedBoundaries = true');
        
        // Сохраняем границы для текущего блока (память линий)
        try {
            const activeBlockId = this.lyricsDisplay?.currentActiveBlock?.id;
            if (activeBlockId != null && typeof boundaries.startBoundary === 'number' && typeof boundaries.endBoundary === 'number') {
                this._rememberBoundariesForBlock(activeBlockId, { startBoundary: boundaries.startBoundary, endBoundary: boundaries.endBoundary });
            }
        } catch(_) {}
        
        // 🎯 КРИТИКАЛЬНО: В multi-loop корректируем ТОЛЬКО нужную сторону и синхронизируем combined*
        const activeBlock = this.lyricsDisplay?.currentActiveBlock;
        const isMulti = this.isMultiLoopEnabled && this.linkedBlock;
        const mode = this.dragBoundaryController?.mode || 'both';

        if (boundaries.startTime !== undefined && boundaries.endTime !== undefined) {
            // Редкий случай передачи времён напрямую — распределяем по режиму
            if (isMulti && activeBlock) {
                if (activeBlock.id === this.currentLoopBlock?.id && (mode === 'start-only' || mode === 'both')) {
            this.loopStartTime = boundaries.startTime;
                    this.combinedStartTime = this.loopStartTime;
                }
                if (activeBlock.id === this.linkedBlock?.id && (mode === 'end-only' || mode === 'both')) {
            this.loopEndTime = boundaries.endTime;
                    this.combinedEndTime = this.loopEndTime;
                }
            } else {
                this.loopStartTime = boundaries.startTime;
                this.loopEndTime = boundaries.endTime;
            }
            console.log(`🎯 LOOP BOUNDARIES UPDATED: ${this.loopStartTime?.toFixed(2)}s - ${this.loopEndTime?.toFixed(2)}s | combined=${(this.combinedStartTime??this.loopStartTime).toFixed(2)}s-${(this.combinedEndTime??this.loopEndTime).toFixed(2)}s`);
            return;
        }

        if (boundaries.startBoundary !== undefined && boundaries.endBoundary !== undefined) {
            // Индексы строк → времена
            const startTime = this._findTimeByLine(boundaries.startBoundary);
            const endTime = this._findTimeByLine(boundaries.endBoundary + 1);
            
            if (isMulti && activeBlock) {
                if (activeBlock.id === this.currentLoopBlock?.id && (mode === 'start-only' || mode === 'both')) {
                    if (startTime !== null) {
                this.loopStartTime = startTime;
                        this.combinedStartTime = this.loopStartTime;
                    }
                }
                if (activeBlock.id === this.linkedBlock?.id && (mode === 'end-only' || mode === 'both')) {
                    if (endTime !== null) {
                this.loopEndTime = endTime;
                        this.combinedEndTime = this.loopEndTime;
                    }
                }
            } else {
                if (startTime !== null) {this.loopStartTime = startTime;}
                if (endTime !== null) {this.loopEndTime = endTime;}
            }

            console.log(`�� LOOP BOUNDARIES UPDATED FROM LINES: start=${this.loopStartTime?.toFixed(2)}s end=${this.loopEndTime?.toFixed(2)}s | combined=${(this.combinedStartTime??this.loopStartTime).toFixed(2)}s-${(this.combinedEndTime??this.loopEndTime).toFixed(2)}s`);
            return;
        }
    }
    
    /**
     * Обновляет границы лупа на основе индексов строк
     * @param {number} startLineIndex - индекс начальной строки
     * @param {number} endLineIndex - индекс конечной строки
     */
    updateLoopBoundaries(startLineIndex, endLineIndex) {
        if (!this.isLooping || !this.markerManager) {return;}
        
        console.log(`BlockLoopControl: Обновление границ лупа: строки ${startLineIndex}-${endLineIndex}`);
        
        // Получаем временные метки для новых границ
        const markers = this.markerManager.getMarkers();
        const startMarker = markers.find(m => m.lineIndex === startLineIndex);
        const endMarker = markers.find(m => m.lineIndex === endLineIndex + 1); // следующая строка для конца
        
        if (startMarker) {
            this.loopStartTime = startMarker.time;
            console.log(`BlockLoopControl: Новое время начала: ${this.loopStartTime.toFixed(2)}s`);
        }
        
        if (endMarker) {
            this.loopEndTime = endMarker.time;
            console.log(`BlockLoopControl: Новое время окончания: ${this.loopEndTime.toFixed(2)}s`);
        } else {
            // Если нет следующего маркера, используем конец блока
            const blockEndMarker = markers.find(m => m.lineIndex > endLineIndex);
            if (blockEndMarker) {
                this.loopEndTime = blockEndMarker.time;
                console.log(`BlockLoopControl: Используем конец блока: ${this.loopEndTime.toFixed(2)}s`);
            }
        }
        
        console.log(`BlockLoopControl: Обновленные границы лупа: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);
    }
    
    /**
     * Обработчик события seeked - вызывается когда перемотка завершена
     * @private
     */
    handleLoopSeek() {
        const currentTime = this.audioEngine.getCurrentTime();
        const seekDuration = Date.now() - this.seekStartTime;
        
        console.log(`🎯 LOOP SEEK COMPLETED: Position ${currentTime.toFixed(3)}s (duration: ${seekDuration}ms)`);
        
        // ⚡ ДВОЙНОЕ ПОДТВЕРЖДЕНИЕ: Очищаем timeouts при успешном seek
        if (this.seekTimeouts) {
            this.seekTimeouts.forEach(timeout => clearTimeout(timeout));
            this.seekTimeouts = null;
            console.log(`✅ SEEK TIMEOUTS CLEARED: Emergency timeouts cancelled`);
        }
        
        if (this.isSeekingInProgress) {
            this.isSeekingInProgress = false;
            this.lastSeekTime = Date.now();
            console.log(`🔓 SEEK FLAG RESET: isSeekingInProgress = false, stabilization buffer activated`);
        }

        // 🎯 КРИТИЧЕСКАЯ КОРРЕКЦИЯ: Проверяем точность попадания
        if (this.loopStartTime !== null) {
            const targetTime = this.loopStartTime;
            const actualTime = currentTime;
            const timeDifference = Math.abs(actualTime - targetTime);
            
            console.log(`📊 SEEK ACCURACY CHECK:`);
            console.log(`   Expected: ${targetTime.toFixed(3)}s`);
            console.log(`   Actual: ${actualTime.toFixed(3)}s`);
            console.log(`   Difference: ${timeDifference.toFixed(3)}s`);
            
            // ⚡ УСИЛЕННАЯ КОРРЕКЦИЯ: Более строгие требования к точности
            if (timeDifference > 0.1) { // Уменьшаем допустимую погрешность до 100мс
                console.log(`⚠️ SEEK INACCURACY DETECTED: ${timeDifference.toFixed(3)}s difference`);
                console.log(`🔧 PERFORMING PRECISION CORRECTION: ${actualTime.toFixed(3)}s → ${targetTime.toFixed(3)}s`);
                
                this.isCorrectionInProgress = true;
                this.correctionStartTime = Date.now();
                
                // Точная коррекция с микро-смещением
                const preciseTarget = targetTime + 0.005; // 5мс смещение для стабильности
                this.audioEngine.setCurrentTime(preciseTarget);
                
                // Более короткий timeout для коррекции
                setTimeout(() => {
                    if (this.isCorrectionInProgress) {
                        console.log(`⚠️ CORRECTION TIMEOUT: Forcing isCorrectionInProgress = false after 150ms`);
                        this.isCorrectionInProgress = false;
                    }
                }, 150);
            } else {
                console.log(`✅ SEEK ACCURACY OK: Within acceptable range (${timeDifference.toFixed(3)}s)`);
            }
        }
        
        // ⚡ ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ: Проверяем что мы в правильном блоке
        if (this.currentLoopBlock && this.lyricsDisplay) {
            const currentLineIndex = this.lyricsDisplay.currentLine;
            const blockContainsCurrentLine = this.currentLoopBlock.lineIndices && 
                                           this.currentLoopBlock.lineIndices.includes(currentLineIndex);
            
            console.log(`🎯 POST-SEEK BLOCK VALIDATION:`);
            console.log(`   Current line: ${currentLineIndex}`);
            console.log(`   Loop block lines: [${this.currentLoopBlock.lineIndices?.join(',')}]`);
            console.log(`   Line in loop block: ${blockContainsCurrentLine}`);
            
            if (!blockContainsCurrentLine) {
                console.warn(`⚠️ POST-SEEK WARNING: Current line ${currentLineIndex} not in loop block`);
                console.warn(`   This may indicate seek accuracy issues or block synchronization problems`);
            } else {
                console.log(`✅ POST-SEEK VALIDATION: Successfully landed in correct block`);
            }
        }
    }
    
    /**
     * Запускает систему автоматического восстановления лупа
     * @private
     */
    _startAutoRecoverySystem() {
        // Проверяем состояние лупа каждые 2 секунды
        this.autoRecoveryInterval = setInterval(() => {
            this._checkLoopHealth();
        }, 2000);
        
        console.log('🛡️ AUTO RECOVERY: System started (checking every 2s)');
    }
    
    /**
     * Останавливает систему автоматического восстановления
     * @private
     */
    _stopAutoRecoverySystem() {
        if (this.autoRecoveryInterval) {
            clearInterval(this.autoRecoveryInterval);
            this.autoRecoveryInterval = null;
            console.log('🛡️ AUTO RECOVERY: System stopped');
        }
    }
    
    /**
     * Проверяет состояние лупа и восстанавливает при необходимости
     * @private
     */
    _checkLoopHealth() {
        if (!this.isActive || this.isSeekingInProgress) {return;}
        
        const currentTime = this.audioEngine?.getCurrentTime();
        const currentBlock = this.lyricsDisplay?.currentActiveBlock;
        
        // Если нет текущего времени или блока, пропускаем проверку
        if (currentTime === undefined || !currentBlock) {return;}
        
        // Проверяем: должен ли быть активен луп, но он неактивен?
        const s = this.isMultiLoopEnabled ? this.combinedStartTime : this.loopStartTime;
        const e = this.isMultiLoopEnabled ? this.combinedEndTime : this.loopEndTime;
        const shouldBeLooping = this.currentLoopBlock && currentTime >= s && currentTime <= e;
        
        if (shouldBeLooping && !this.isLooping) {
            console.log(`🚨 AUTO RECOVERY: Loop should be active but isn't!`);
            console.log(`   Current block: ${currentBlock.name} (ID: ${currentBlock.id})`);
            console.log(`   Loop block: ${this.currentLoopBlock.name} (ID: ${this.currentLoopBlock.id})`);
            console.log(`   Current time: ${currentTime.toFixed(3)}s`);
            console.log(`   Loop range: ${s?.toFixed(3)}s - ${e?.toFixed(3)}s`);
            
            // Попытка автоматического восстановления
            console.log(`🔧 AUTO RECOVERY: Attempting to restore loop`);
            this.startLooping(this.currentLoopBlock);
            return;
        }
        
        // Проверяем: активен луп, но мы далеко за его пределами?
        const loopEndForHealth = this.isMultiLoopEnabled ? this.combinedEndTime : this.loopEndTime;
        if (this.isLooping && loopEndForHealth && 
            currentTime > loopEndForHealth + 2.0) { // Если ушли на 2+ секунды за границу
            
            console.log(`🚨 AUTO RECOVERY: Loop is active but we're far beyond its boundaries!`);
            console.log(`   Current time: ${currentTime.toFixed(3)}s`);
            console.log(`   Loop end: ${loopEndForHealth.toFixed(3)}s`);
            console.log(`   Distance beyond: ${(currentTime - loopEndForHealth).toFixed(1)}s`);
            
            // Это признак cascade failure - останавливаем сломанный луп
            console.log(`🛑 AUTO RECOVERY: Stopping broken loop`);
            this.stopLooping();
            return;
        }
        
        // Все в порядке - логируем только каждые 10 проверок
        if (!this.diagnosticCounter) {this.diagnosticCounter = 0;}
        this.diagnosticCounter++;
        
        if (this.diagnosticCounter % 30 === 0) {
            console.debug(`✅ AUTO RECOVERY: Loop health OK (check #${this.diagnosticCounter})`);
            console.debug(`   Loop active: ${this.isLooping}`);
            console.debug(`   Current time: ${currentTime.toFixed(1)}s`);
            if (this.isLooping) {
                console.debug(`   Loop range: ${s?.toFixed(1)}s - ${e?.toFixed(1)}s`);
            }
        }
    }
    
    /**
     * Находит строку по времени
     */
    _findLineByTime(targetTime) {
        if (!this.markerManager || !this.markerManager.markers) {
            return null;
        }
        
        let closestLine = null;
        let closestDistance = Infinity;
        
        for (const marker of this.markerManager.markers) {
            const distance = Math.abs(marker.time - targetTime);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestLine = marker.lineIndex;
            }
        }
        
        return closestLine;
    }
    
    /**
     * Находит время по строке
     */
    _findTimeByLine(lineIndex) {
        if (!this.markerManager || !this.markerManager.markers) {
            return null;
        }
        
        const marker = this.markerManager.markers.find(m => m.lineIndex === lineIndex);
        return marker ? marker.time : null;
    }

    _onCorrectionCompleted() {
        if (this.isCorrectionInProgress) {
            const correctionDuration = Date.now() - this.correctionStartTime;
            const currentTime = this.audioEngine.getCurrentTime();
            
            console.log(`✅ CORRECTION COMPLETED: Position ${currentTime.toFixed(3)}s (took ${correctionDuration}ms)`);
            
            this.isCorrectionInProgress = false;
            this.correctionStartTime = null;
            this.lastSeekTime = Date.now(); // Обновляем время последней перемотки
            
            console.log(`🔓 CORRECTION FLAG CLEARED: System ready for normal operation`);
        }
    }

    // Создаёт/обновляет плюсик под кнопкой Stop
    _ensurePlusButton(blockElement, block) {
        // Новая концепция поезда: плюсик не используется
        if (this.plusButton) { this.plusButton.remove(); this.plusButton = null; }
    }

    _hasNextBlock(block) {
        const blocks = this._getProcessedBlocks();
        const idx = blocks.findIndex(b => b.id === block.id);
        return idx !== -1 && idx < blocks.length - 1;
    }

    _attachNextBlock(block) {
        if (!this._hasNextBlock(block)) {return;}
        const blocks = this._getProcessedBlocks();
        const idx = blocks.findIndex(b => b.id === block.id);
        const nextBlock = blocks[idx + 1];
        this.linkedBlock = nextBlock;
        this.isMultiLoopEnabled = true;
        // Подсветка второго блока (если есть отдельный элемент)
        const nextEl = this._findBlockDOMElement(nextBlock) || document.querySelector('.rehearsal-preview-block');
        if (nextEl) { nextEl.classList.add('loop-linked'); nextEl.classList.add('loop-active'); }
        // Визуальный фидбэк для плюсика
        if (this.plusButton) {
            this.plusButton.classList.add('active');
            setTimeout(() => this.plusButton && this.plusButton.classList.remove('active'), 180);
        }
        // Поддержка массива выбранных блоков (паровозик)
        if (this.selectedBlocks.length === 0) {this.selectedBlocks.push(block.id);}
        if (!this.selectedBlocks.includes(nextBlock.id)) {this.selectedBlocks.push(nextBlock.id);}
        // Если луп ещё не запущен — запускаем от первого блока
        if (!this.isLooping) {
            this.startLooping(block);
        }
        // Мгновенно расширяем временной диапазон до конца следующего блока
        const tr = this._getBlockTimeRange(nextBlock);
        if (tr && tr.endTime != null) {
            this.combinedStartTime = this.loopStartTime ?? this._getBlockTimeRange(block)?.startTime ?? 0;
            this.combinedEndTime = tr.endTime;
            console.log(`🔗 Combined loop set: ${this.combinedStartTime.toFixed(2)}s - ${this.combinedEndTime.toFixed(2)}s`);
        } else {
            this._recalculateCombinedRange();
        }
        // Обновляем drag-режимы по краям паровозика и чипы
        this._syncTrainEdges();
        this._renderLoopChips();
        // ВАЖНО: НЕ переактивируем DragBoundary на втором блоке, оставляем линии на первом
        // Возможность тянуть конец во втором блоке добавим на следующем этапе, когда будет DOM всех строк
    }

    _recalculateCombinedRange() {
        // Если выбран один блок — комбинированный = одиночный
        if (!Array.isArray(this.selectedBlocks) || this.selectedBlocks.length === 0) {
            this.combinedStartTime = this.loopStartTime;
            this.combinedEndTime = this.loopEndTime;
            return;
        }
        const blocks = this._getProcessedBlocks();
        const first = blocks.find(b => b.id === this.selectedBlocks[0]) || this.currentLoopBlock;
        const last = blocks.find(b => b.id === this.selectedBlocks[this.selectedBlocks.length - 1]) || this.linkedBlock;
        const firstRange = first ? this._getBlockTimeRange(first) : null;
        const lastRange = last ? this._getBlockTimeRange(last) : null;
        this.combinedStartTime = (firstRange?.startTime ?? this.loopStartTime) ?? null;
        this.combinedEndTime = (lastRange?.endTime ?? this.loopEndTime) ?? null;
        if (this.combinedStartTime != null && this.combinedEndTime != null) {
        console.log(`🔗 Combined loop: ${this.combinedStartTime.toFixed(2)}s - ${this.combinedEndTime.toFixed(2)}s`);
        } else {
            console.log('🔗 Combined loop: not ready (null bounds)');
        }
    }

    _getProcessedBlocks() {
        try {
            if (this.lyricsDisplay && typeof this.lyricsDisplay._splitLargeBlocks === 'function') {
                const src = this.lyricsDisplay.textBlocks || [];
                const processed = this.lyricsDisplay._splitLargeBlocks(src) || [];
                return Array.isArray(processed) ? processed : src;
            }
        } catch (_) {}
        return this.lyricsDisplay?.textBlocks || [];
    }

    _syncDragModeForBlock(block) {
        if (!this.dragBoundaryController || !this.dragBoundaryController.isActive) {return;}
        let mode = 'both';
        if (this.isLooping && this.isMultiLoopEnabled) {
            if (this.linkedBlock && block.id === this.linkedBlock.id) {
                mode = 'end-only';
            } else if (this.currentLoopBlock && block.id === this.currentLoopBlock.id) {
                mode = 'start-only';
            }
        }
        if (typeof this.dragBoundaryController.setMode === 'function') {
            this.dragBoundaryController.setMode(mode);
        }
    }

    _rememberBoundariesForBlock(blockId, { startBoundary, endBoundary }) {
        this.blockBoundaryMemory.set(blockId, { startBoundary, endBoundary, start: startBoundary, end: endBoundary });
    }

    _getRememberedBoundaries(blockId) {
        const b = this.blockBoundaryMemory.get(blockId);
        if (!b) {return null;}
        const start = typeof b.start === 'number' ? b.start : b.startBoundary;
        const end = typeof b.end === 'number' ? b.end : b.endBoundary;
        if (typeof start === 'number' && typeof end === 'number') {return { start, end };}
        return null;
    }

    // Полная очистка паровозика/визуала
    _clearTrain() {
        this.selectedBlocks = [];
        if (this.loopChipsContainer) { this.loopChipsContainer.innerHTML = ''; }
        const linkedEl = document.querySelector('.rehearsal-active-block.loop-linked, .rehearsal-preview-block.loop-linked');
        if (linkedEl) {linkedEl.classList.remove('loop-linked');}
        this.isMultiLoopEnabled = false;
        this.linkedBlock = null;
        this.combinedStartTime = null;
        this.combinedEndTime = null;
        // Плюсик снова отображается как у одиночного режима (решит _ensurePlusButton при необходимости)
    }

    // Рендер вертикального стека чипов по selectedBlocks
    _renderLoopChips() {
        if (!this.loopChipsContainer) {return;}
        this.loopChipsContainer.innerHTML = '';
        if (!this.isLooping || this.selectedBlocks.length < 2) {return;} // показываем только при паровозике
        const blocks = this._getProcessedBlocks();
        const allowRemove = (id) => {
            // V1: разрешаем удалять только крайние, центральные заблокированы
            const first = this.selectedBlocks[0];
            const last = this.selectedBlocks[this.selectedBlocks.length - 1];
            return id === first || id === last;
        };
        for (const id of this.selectedBlocks) {
            const chip = document.createElement('button');
            chip.className = 'loop-chip';
            chip.innerText = '☒';
            chip.title = 'Исключить блок из лупа';
            chip.style.opacity = allowRemove(id) ? '1' : '0.55';
            chip.disabled = !allowRemove(id);
            chip.onclick = () => this._removeFromTrain(id);
            this.loopChipsContainer.appendChild(chip);
        }
    }

    _removeFromTrain(blockId) {
        if (!this.isLooping || this.selectedBlocks.length < 2) {return;}
        const first = this.selectedBlocks[0];
        const last = this.selectedBlocks[this.selectedBlocks.length - 1];
        // V1: удалять можно только края
        if (blockId !== first && blockId !== last) {return;}
        this.selectedBlocks = this.selectedBlocks.filter(id => id !== blockId);
        if (this.selectedBlocks.length === 1) {
            // Возврат к одиночному режиму
            this.linkedBlock = null;
            this.isMultiLoopEnabled = false;
            const anchorId = this.selectedBlocks[0];
            const blocks = this._getProcessedBlocks();
            const anchor = blocks.find(b => b.id === anchorId) || this.currentLoopBlock;
            if (anchor) {
                const r = this._getBlockTimeRange(anchor);
                if (r) { this.loopStartTime = r.startTime; this.loopEndTime = r.endTime; }
            }
        } else {
            // Паровозик остаётся — пересчитать края и комбинированные времена
            this._syncTrainEdges();
        }
        this._renderLoopChips();
    }

    _syncTrainEdges() {
        if (this.selectedBlocks.length < 2) {return;}
        const blocks = this._getProcessedBlocks();
        const first = blocks.find(b => b.id === this.selectedBlocks[0]);
        const last = blocks.find(b => b.id === this.selectedBlocks[this.selectedBlocks.length - 1]);
        if (first) {this.currentLoopBlock = first;}
        if (last) {this.linkedBlock = last;}
        // Пересчёт комбинированного диапазона
        const firstRange = first ? this._getBlockTimeRange(first) : null;
        const lastRange = last ? this._getBlockTimeRange(last) : null;
        if (firstRange) {this.combinedStartTime = this.loopStartTime ?? firstRange.startTime;}
        if (lastRange) {this.combinedEndTime = lastRange.endTime;}
        // Выставляем режимы линий: начало у первого, конец у последнего
        this._syncDragModeForBlock(first);
        this._syncDragModeForBlock(last);
    }

    // ====== V2: Поезд вагончиков ======
    _renderLoopTrain() {
        // Отображаем поезд только в режиме репетиции и только когда есть блоки
        const isRehearsal = document.body.classList.contains('mode-rehearsal');
        const catalogOverlay = document.getElementById('catalog-v2-overlay') || document.querySelector('#catalog-v2-overlay, .catalog-v2-overlay');
        const catalogOpen = catalogOverlay && !(catalogOverlay.classList.contains('hidden') || catalogOverlay.style.display === 'none');
        // ФИКС: при активном Sync Editor скрываем поезд даже если событие не дошло (по классу body)
        const isWaveformActive = document.body.classList.contains('waveform-active');
        if (!isRehearsal || catalogOpen || this._isSyncEditorOpen || isWaveformActive) { this._hideTrainContainer(); return; }

        const blockElement = this.currentBlockElement || this._findBlockDOMElement(this.lyricsDisplay.currentActiveBlock);
        if (!blockElement) { this._hideTrainContainer(); return; }
        const blocks = this._getProcessedBlocks();
        if (!blocks || blocks.length === 0) { this._hideTrainContainer(); return; }

        // Гарантируем корректный контекст позиционирования и отсутствие клиппинга
        try {
            blockElement.style.position = blockElement.style.position || 'relative';
            blockElement.style.overflow = 'visible';
        } catch(_) {}

        if (!this.loopTrainContainer) {
            const container = document.createElement('div');
            container.className = 'loop-train';
            // Рендерим как портал поверх всех слоёв
            container.style.position = 'fixed';
            // ФИКС: якорим не к блоку, а к контейнеру лирики — стабильная высота в любом стиле
            try {
                const lc = document.getElementById('lyrics-container');
                const lcRect = lc ? lc.getBoundingClientRect() : null;
                const baseTop = lcRect ? lcRect.top + 6 : blockElement.getBoundingClientRect().top - 28;
                container.style.top = `${Math.max(0, baseTop)}px`;
            } catch(_) {
                const rect = blockElement.getBoundingClientRect();
                container.style.top = `${Math.max(0, rect.top - 28)}px`;
            }
            // Растягиваем на всю ширину окна
            container.style.left = '0px';
            container.style.right = '0px';
            container.style.transform = '';
            container.style.display = 'flex';
            container.style.gap = '6px';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'flex-start';
            container.style.pointerEvents = 'auto';
            container.style.padding = '2px 12px';
            container.style.borderRadius = '12px';
            container.style.background = 'rgba(20,20,20,0.35)';
            container.style.border = '1px solid rgba(255,255,255,0.25)';
            container.style.backdropFilter = 'blur(4px)';
            container.style.webkitBackdropFilter = 'blur(4px)';
            // Поверх всех верхних панелей/оверлеев
            container.style.zIndex = '99999';
            document.body.appendChild(container);
            this.loopTrainContainer = container;
            // Устойчивое позиционирование в ближайшие кадры, чтобы не зависал на top=0
            try { this._updateTrainPortalPositionUntilStable(blockElement); } catch(_) {}
        } else {
            // Гарантируем, что контейнер — портал в body
            if (this.loopTrainContainer.parentElement !== document.body) {
                try { this.loopTrainContainer.remove(); } catch(_) {}
                document.body.appendChild(this.loopTrainContainer);
            }
            // сохраняем текущий скролл, чтобы не скакал при ререндере
            this.loopTrainScrollLeft = this.loopTrainContainer.scrollLeft;
            // На всякий случай повышаем z-index на последующих рендерах
            this.loopTrainContainer.style.zIndex = '99999';
            this.loopTrainContainer.innerHTML = '';
            // Обновляем позицию относительно контейнера лирики
            this._updateTrainPortalPosition(blockElement);
            try { this._updateTrainPortalPositionUntilStable(blockElement); } catch(_) {}
            // Покажем, если ранее был скрыт
            this.loopTrainContainer.style.display = 'flex';
        }

        // Адаптивная ширина вагонов под общую доступную ширину (минимизируем скролл)
        const horizontalPadding = 24; // соответствует 12px внутренним отступам слева/справа
        const gapPx = 6;
        // Во всю ширину окна, чтобы исключить горизонтальный скролл и использовать всю площадь
        const viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 800);
        const availableWidth = Math.max(220, viewportWidth - horizontalPadding * 2);
        const totalGaps = gapPx * Math.max(0, blocks.length - 1);
        const rawPerWagon = Math.floor((availableWidth - totalGaps) / blocks.length);
        // Заполняем всю ширину: жёстких минимумов нет; все вагоны всегда помещаются
        let perWagon = Math.max(48, rawPerWagon);
        // Ширину контейнера не задаём явно — left/right растягивают на весь вьюпорт
        this.loopTrainContainer.style.width = '';

        for (let i = 0; i < blocks.length; i += 1) {
            const block = blocks[i];
            const wagon = document.createElement('button');
            wagon.className = 'loop-wagon';
            wagon.dataset.index = String(i);
			wagon.dataset.blockId = block.id || `blk-${i}`;
            wagon.style.width = `${perWagon}px`;

            // Индекс (номер вагона)
            const idx = document.createElement('span');
            idx.className = 'loop-wagon__index';
            idx.textContent = String(i + 1);

            // Первая строка блока
            let firstLineText = '';
            try {
                const firstIndex = Array.isArray(block.lineIndices) ? block.lineIndices[0] : null;
                if (typeof firstIndex === 'number' && this.lyricsDisplay && Array.isArray(this.lyricsDisplay.lyrics)) {
                    firstLineText = this.lyricsDisplay.lyrics[firstIndex] || '';
                }
            } catch (_) {}
            const titleEl = document.createElement('span');
            titleEl.className = 'loop-wagon__title';
            const fullText = firstLineText || (block.name || `Block ${i + 1}`);
            titleEl.textContent = fullText;
            // Кастомная подсказка (вверх), чтобы не смешивалась с текстом
            wagon.setAttribute('data-title', fullText);

            // Тип блока → аккуратная цветовая тема вагона
            // 1) Пытаемся использовать явный block.type (приходит из LyricsDisplay._sanitizeBlocks)
            // 2) Фолбэки: по id (blk-verse-*, blk-chorus-*, blk-bridge-*) или по имени
            const explicitType = typeof block.type === 'string' ? block.type.toLowerCase() : '';
            const idStr = String(block.id || '');
            const name = (block.name || '').toLowerCase();
            const inferFromId = /blk-(verse|chorus|bridge)-/i.test(idStr)
                ? idStr.replace(/^.*blk-(verse|chorus|bridge)-.*$/i, '$1').toLowerCase()
                : '';
            const inferFromName = /(verse|куплет)/.test(name)
                ? 'verse'
                : (/(chorus|припев)/.test(name)
                    ? 'chorus'
                    : (/(bridge|бридж)/.test(name) ? 'bridge' : ''));
            const blockType = explicitType || inferFromId || inferFromName;
            if (blockType === 'verse') {
                wagon.classList.add('loop-wagon--verse');
            } else if (blockType === 'chorus') {
                wagon.classList.add('loop-wagon--chorus');
            } else if (blockType === 'bridge') {
                wagon.classList.add('loop-wagon--bridge');
            }

			// Кнопка-тогглер лупа в конце вагона
			const toggleBtn = document.createElement('button');
			toggleBtn.className = 'wagon-loop-toggle';
			toggleBtn.title = 'Добавить в луп';
			toggleBtn.onclick = (ev) => {
				ev.stopPropagation();
				this._onWagonToggle(block);
				// Мгновенный визуальный фидбэк
				try {
					const idStr = String(block.id);
					const isSelected = Array.isArray(this.selectedBlocks) && this.selectedBlocks.includes(idStr);
					if (isSelected) {
						toggleBtn.classList.add('is-on');
						wagon.classList.add('is-in-loop');
						toggleBtn.title = 'Убрать из лупа';
					} else {
						toggleBtn.classList.remove('is-on');
						wagon.classList.remove('is-in-loop');
						toggleBtn.title = 'Добавить в луп';
					}
				} catch(_) {}
			};

			// Вставляем элементы внутрь кнопки-вагона
			wagon.appendChild(idx);
			wagon.appendChild(titleEl);
			wagon.appendChild(toggleBtn);

            // Умное сокращение по фактической ширине (на основе измерения)
            try { this._trimTitleToFit(titleEl, fullText); } catch(_) {}

            // Пока без логики диапазона — только навигация по клику
            wagon.onclick = () => {
                const tr = this._getBlockTimeRange(block);
                if (tr && typeof tr.startTime === 'number') {
                    try { this.audioEngine.setCurrentTime(tr.startTime); } catch (e) {}
                }
            };

			// Применяем состояние выделения (цепочки) при рендере
			if (this.selectedBlocks && this.selectedBlocks.includes(block.id)) {
				wagon.classList.add('is-in-loop');
				toggleBtn.classList.add('is-on');
				toggleBtn.title = 'Убрать из лупа';
			}

            this.loopTrainContainer.appendChild(wagon);
        }

        // восстановим скролл если был
        if (typeof this.loopTrainScrollLeft === 'number') {
            this.loopTrainContainer.scrollLeft = this.loopTrainScrollLeft;
        }

        this._updateTrainPlayingHighlight();
		// Синхронизация стилей выбранных вагонов
		try { this._updateTrainSelectionStyles(); } catch(_) {}
        // и плавно центрируем активный вагон
        try { this._scrollActiveWagonIntoView(); } catch(_) {}
    }

    /**
     * Возвращает массив блоков для поезда (сохранённый порядок LyricsDisplay)
     * @private
     */
    _getProcessedBlocks() {
        if (!this.lyricsDisplay || !Array.isArray(this.lyricsDisplay.textBlocks)) {return [];} 
        return this.lyricsDisplay.textBlocks.slice();
    }

    /**
     * Обработчик нажатия на плюс у вагона: добавляет/удаляет блок из цепочки
     * @param {Object} block - блок, соответствующий вагону
     * @private
     */
    _onWagonToggle(block) {
        if (!block || block.id === undefined || block.id === null) {return;}

        const blocks = this._getProcessedBlocks();
        const order = new Map(blocks.map((b, i) => [String(b.id), i]));

        // Если луп не активен — стартуем с текущего активного блока
        if (!this.isLooping) {
            const anchor = this.lyricsDisplay?.currentActiveBlock || block;
            this.startLooping(anchor);
            this.selectedBlocks = [String(anchor.id)];
        }

        // Переключаем выбранность вагона (всегда работаем со строковыми id)
        const blockId = String(block.id);
        const already = this.selectedBlocks.includes(blockId);
        if (already) {
            // Удаляем только крайние блоки, чтобы сохранять непрерывность
            if (this.selectedBlocks.length > 1) {
                const first = this.selectedBlocks[0];
                const last = this.selectedBlocks[this.selectedBlocks.length - 1];
                if (blockId === first || blockId === last) {
                    this.selectedBlocks = this.selectedBlocks.filter(id => id !== blockId);
                }
            }
        } else {
            // Добавляем и сортируем по порядку следования
            this.selectedBlocks.push(blockId);
            this.selectedBlocks.sort((a, b) => (order.get(String(a)) ?? 0) - (order.get(String(b)) ?? 0));
        }

        // Обновляем режим multi-loop
        if (this.selectedBlocks.length >= 2) {
            this.isMultiLoopEnabled = true;
            const firstBlock = blocks.find(b => String(b.id) === this.selectedBlocks[0]);
            const lastBlock = blocks.find(b => String(b.id) === this.selectedBlocks[this.selectedBlocks.length - 1]);
            this.currentLoopBlock = firstBlock || this.currentLoopBlock;
            this.linkedBlock = lastBlock && lastBlock.id !== this.currentLoopBlock?.id ? lastBlock : null;

            // Пересчёт объединённых временных границ
            const firstRange = firstBlock ? this._getBlockTimeRange(firstBlock) : null;
            const lastRange = lastBlock ? this._getBlockTimeRange(lastBlock) : null;
            if (firstRange && lastRange && firstRange.startTime != null && lastRange.endTime != null) {
                this.combinedStartTime = firstRange.startTime;
                this.combinedEndTime = lastRange.endTime;
            }
        } else {
            this.isMultiLoopEnabled = false;
            this.linkedBlock = null;
            // Синхронизируем single-loop границы с текущим блоком
            const single = blocks.find(b => String(b.id) === this.selectedBlocks[0]) || this.currentLoopBlock;
            const r = single ? this._getBlockTimeRange(single) : null;
            if (r) { this.loopStartTime = r.startTime; this.loopEndTime = r.endTime; }
        }

        // Визуальный фидбэк: обновляем чек состояния кнопок/вагонов
        this._updateTrainSelectionStyles();
        // Также обновим состояние главной кнопки (Stop/Loop)
        this._updateButtonState(true);
    }

    /**
     * Применяет классы выбранности для вагонов и их кнопок (+ → ×)
     * @private
     */
    _updateTrainSelectionStyles() {
        if (!this.loopTrainContainer) {return;}
        const selected = new Set(this.selectedBlocks || []);
        const wagons = this.loopTrainContainer.querySelectorAll('.loop-wagon');
        wagons.forEach(wagon => {
            const id = wagon.dataset.blockId;
            const toggle = wagon.querySelector('.wagon-loop-toggle');
            const isSelected = selected.has(id);
            if (isSelected) {
                wagon.classList.add('is-in-loop');
                if (toggle) { toggle.classList.add('is-on'); toggle.title = 'Убрать из лупа'; }
            } else {
                wagon.classList.remove('is-in-loop');
                if (toggle) { toggle.classList.remove('is-on'); toggle.title = 'Добавить в луп'; }
            }
        });
    }

    /**
     * Центрирует активный вагон по возможности
     * @private
     */
    _scrollActiveWagonIntoView() {
        if (!this.loopTrainContainer || !this.lyricsDisplay?.currentActiveBlock) {return;}
        const id = this.lyricsDisplay.currentActiveBlock.id;
        const el = this.loopTrainContainer.querySelector(`.loop-wagon[data-block-id="${id}"]`);
        if (!el || typeof el.scrollIntoView !== 'function') {return;}
        try {
            el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        } catch(_) {}
    }

    _hideTrainContainer() {
        if (this.loopTrainContainer) {this.loopTrainContainer.style.display = 'none';}
    }

    _destroyLoopTrain() {
        if (this.loopTrainContainer) {
            try { this.loopTrainContainer.remove(); } catch(_) {}
            this.loopTrainContainer = null;
        }
    }

    // Наблюдаем за каталогом и сменой классов body, чтобы правильно скрывать/показывать поезд
    _ensureOverlayAndModeObservers() {
        // Каталог (overlay)
        try {
            const overlay = document.getElementById('catalog-v2-overlay') || document.querySelector('#catalog-v2-overlay, .catalog-v2-overlay');
            if (overlay && !this._catalogObserver) {
                this._catalogObserver = new MutationObserver(() => {
                    const isHidden = overlay.classList.contains('hidden') || overlay.style.display === 'none';
                    // Если каталог открыт — поезд убираем полностью, чтобы он не "ехал" в каталоге
                    if (!isHidden) {
                        this._hideTrainContainer();
                        return;
                    }
                    // Каталог закрыт: если мы в репетиции и есть блоки — мгновенно перерисовать поезд
                    const isRehearsal = document.body.classList.contains('mode-rehearsal');
                    const hasBlocks = Array.isArray(this.lyricsDisplay?.textBlocks) && this.lyricsDisplay.textBlocks.length > 0;
                    if (isRehearsal && hasBlocks) {
                        this._renderLoopTrain();
                    } else {
                        this._destroyLoopTrain();
                    }
                });
                this._catalogObserver.observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
            }
        } catch(_) {}

        // Классы body (смена режима)
        try {
            if (!this._bodyClassObserver) {
                this._bodyClassObserver = new MutationObserver(() => {
                    const isRehearsal = document.body.classList.contains('mode-rehearsal');
                    if (isRehearsal) {
                        const hasBlocks = Array.isArray(this.lyricsDisplay?.textBlocks) && this.lyricsDisplay.textBlocks.length > 0;
                        if (hasBlocks) {this._renderLoopTrain();} else {this._destroyLoopTrain();}
                    } else {
                        this._destroyLoopTrain();
                    }
                });
                this._bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            }
        } catch(_) {}

        // Наблюдаем за изменениями стилей контейнера лирики — влияет на топ активного блока
        try {
            const lc = document.getElementById('lyrics-container');
            if (lc && !this._lyricsContainerObserver) {
                this._lyricsContainerObserver = new MutationObserver(() => {
                    // Срабатывает при смене класса style-*
                    const isRehearsal = document.body.classList.contains('mode-rehearsal');
                    if (this._isSyncEditorOpen) { this._hideTrainContainer(); return; }
                    if (!isRehearsal) { this._destroyLoopTrain(); return; }
                    // Даем стилям примениться, затем стабильно позиционируем
                    setTimeout(() => {
                        try {
                            this._renderLoopTrain();
                            this._updateTrainPortalPosition();
                            this._updateTrainPortalPositionUntilStable();
                        } catch(_) {}
                    }, 30);
                });
                this._lyricsContainerObserver.observe(lc, { attributes: true, attributeFilter: ['class', 'style'] });
            }
        } catch(_) {}
    }

    // Обновляет позицию портала-поезда над активным блоком
    _updateTrainPortalPosition(blockEl) {
        if (!this.loopTrainContainer) {return;}
        // ФИКС: привязка к #lyrics-container для устойчивости между стилями/режимами
        try {
            const lc = document.getElementById('lyrics-container');
            if (lc) {
                const lcRect = lc.getBoundingClientRect();
                const baseTop = Math.max(0, lcRect.top + 6);
                this.loopTrainContainer.style.top = `${baseTop}px`;
                return;
            }
        } catch(_) {}
        // Fallback на активный блок
        const el = blockEl || this.currentBlockElement || this._findBlockDOMElement(this.lyricsDisplay.currentActiveBlock);
        if (!el) {return;}
        try {
            const rect = el.getBoundingClientRect();
            this.loopTrainContainer.style.top = `${Math.max(0, rect.top - 28)}px`;
        } catch(_) {}
    }

    // Многокадровое обновление позиции до стабилизации layout, чтобы поезд не зависал на верхней кромке
    _updateTrainPortalPositionUntilStable(blockEl) {
        if (!this.loopTrainContainer) {return;}
        let attempts = 0;
        const maxAttempts = 20; // ~20 кадров (~330-400мс)
        const tick = () => {
            if (!this.loopTrainContainer) {return;}
            try {
                const lc = document.getElementById('lyrics-container');
                if (lc) {
                    const lcRect = lc.getBoundingClientRect();
                    const newTop = Math.max(0, lcRect.top + 6);
                    const prevTop = parseFloat(this.loopTrainContainer.style.top || '0');
                    if (Math.abs(prevTop - newTop) > 0.5) {
                        this.loopTrainContainer.style.top = `${newTop}px`;
                    }
                } else {
                    const el = blockEl || this.currentBlockElement || this._findBlockDOMElement(this.lyricsDisplay.currentActiveBlock);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        const newTop = Math.max(0, rect.top - 28);
                        const prevTop = parseFloat(this.loopTrainContainer.style.top || '0');
                        if (Math.abs(prevTop - newTop) > 0.5) {
                            this.loopTrainContainer.style.top = `${newTop}px`;
                        }
                    }
                }
            } catch(_) {}
            attempts += 1;
            if (attempts < maxAttempts) {requestAnimationFrame(tick);}
        };
        requestAnimationFrame(tick);
    }

    /**
     * Усекает текст заголовка вагона так, чтобы он поместился в доступную ширину.
     * Сохраняем начало фразы и добавляем многоточие (быстро и читабельно).
     */
    _trimTitleToFit(element, fullText) {
        if (!element || !fullText) {return;}
        // Быстрый путь: если уже помещается, выходим
        if (element.scrollWidth <= element.clientWidth) {return;}
        let left = 4; // минимум видимых символов
        let right = fullText.length;
        let best = '';
        // Бинарный поиск по длине для end-ellipsis
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            element.textContent = fullText.slice(0, mid) + '…';
            if (element.scrollWidth <= element.clientWidth) {
                best = element.textContent;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        if (best) {element.textContent = best;} else {element.textContent = fullText;}
    }

    _updateTrainPlayingHighlight() {
        if (!this.loopTrainContainer) {return;}
        const blocks = this._getProcessedBlocks();
        if (!blocks || blocks.length === 0) {return;}
        const current = this.lyricsDisplay?.currentActiveBlock;
        if (!current) {return;}
        const idx = blocks.findIndex(b => b.id === current.id);
        const wagons = this.loopTrainContainer.querySelectorAll('.loop-wagon');
        wagons.forEach(w => w.classList.remove('playing'));
        if (idx >= 0 && idx < wagons.length) {
            wagons[idx].classList.add('playing');
            // автоцентрируем текущий вагон
            this._scrollActiveWagonIntoView(idx);
        }
    }

    // Обновление визуала выбранных вагонов (цепочки)
    _updateTrainSelectionStyles() {
        if (!this.loopTrainContainer) {return;}
        const wagons = this.loopTrainContainer.querySelectorAll('.loop-wagon');
        wagons.forEach(w => {
            const id = w.dataset.blockId;
            const on = this.selectedBlocks && id && this.selectedBlocks.includes(id);
            w.classList.toggle('is-in-loop', !!on);
            const btn = w.querySelector('.wagon-loop-toggle');
            if (btn) {
                btn.classList.toggle('is-on', !!on);
                btn.title = on ? 'Убрать из лупа' : 'Добавить в луп';
            }
        });
    }

    // Клик по тогглеру вагона
    _onWagonToggle(block) {
        if (!block || !block.id) {return;}
        if (!Array.isArray(this.selectedBlocks)) {this.selectedBlocks = [];}
        // Если луп не включен — включаем на выбранном блоке
        if (!this.isLooping) {
            this.selectedBlocks = [block.id];
            this.startLooping(block);
            this._updateTrainSelectionStyles();
            return;
        }
        // Правило непрерывной цепочки (только расширение по краям или снятие краёв)
        const chain = this.selectedBlocks.slice();
        if (chain.length === 0) {chain.push(this.currentLoopBlock?.id || block.id);}
        const blocks = this._getProcessedBlocks();
        const idToIndex = new Map(blocks.map((b, i) => [b.id, i]));
        const bIdx = idToIndex.get(block.id);
        const firstIdx = idToIndex.get(chain[0]);
        const lastIdx = idToIndex.get(chain[chain.length - 1]);
        if (bIdx == null || firstIdx == null || lastIdx == null) {return;}
        // Снятие с краёв
        if (block.id === chain[0] || block.id === chain[chain.length - 1]) {
            if (chain.length === 1) {
                // Один блок → выключаем луп полностью
                this.stopLooping();
                this.selectedBlocks = [];
                this.isMultiLoopEnabled = false;
                this.linkedBlock = null;
                this.combinedStartTime = null;
                this.combinedEndTime = null;
            } else if (block.id === chain[0]) {
                chain.shift();
                this.selectedBlocks = chain;
            } else {
                chain.pop();
                this.selectedBlocks = chain;
            }
            this._syncTrainEdges();
            this._recalculateCombinedRange();
            // После изменения цепочки обнуляем пользовательские границы (они относились к прошлой конфигурации)
            this.hasUserDefinedBoundaries = false;
            this.userBoundaries = null;
            // Обновляем рабочие времена, чтобы прыжок ориентировался на новый комбинированный диапазон
            if (this.isLooping && this.isMultiLoopEnabled && this.combinedStartTime != null && this.combinedEndTime != null) {
                this.loopStartTime = this.combinedStartTime;
                this.loopEndTime = this.combinedEndTime;
            }
            this._createLoopButtonForCurrentBlock();
            this._updateTrainSelectionStyles();
            return;
        }
        // Расширение по краям
        if (bIdx === lastIdx + 1) {
            chain.push(block.id);
            this.selectedBlocks = chain;
            this.isMultiLoopEnabled = this.selectedBlocks.length > 1;
            this._syncTrainEdges();
            this._recalculateCombinedRange();
            this.hasUserDefinedBoundaries = false;
            this.userBoundaries = null;
            if (this.isLooping && this.combinedStartTime != null && this.combinedEndTime != null) {
                // Применяем общий диапазон немедленно
                this.loopStartTime = this.combinedStartTime;
                this.loopEndTime = this.combinedEndTime;
            }
            this._createLoopButtonForCurrentBlock();
            this._updateTrainSelectionStyles();
            return;
        }
        if (bIdx === firstIdx - 1) {
            chain.unshift(block.id);
            this.selectedBlocks = chain;
            this.isMultiLoopEnabled = this.selectedBlocks.length > 1;
            this._syncTrainEdges();
            this._recalculateCombinedRange();
            this.hasUserDefinedBoundaries = false;
            this.userBoundaries = null;
            if (this.isLooping && this.combinedStartTime != null && this.combinedEndTime != null) {
                this.loopStartTime = this.combinedStartTime;
                this.loopEndTime = this.combinedEndTime;
            }
            this._createLoopButtonForCurrentBlock();
            this._updateTrainSelectionStyles();
            return;
        }
        // Иначе игнор (неразрывность)
    }

    // Центрирование активного вагона в области видимости
    _scrollActiveWagonIntoView(idx) {
        if (!this.loopTrainContainer) {return;}
        const wagons = this.loopTrainContainer.querySelectorAll('.loop-wagon');
        if (!wagons || wagons.length === 0) {return;}
        let index = typeof idx === 'number' ? idx : Array.from(wagons).findIndex(w => w.classList.contains('playing'));
        if (index < 0) {return;}
        const wagon = wagons[index];
        const container = this.loopTrainContainer;
        const targetLeft = wagon.offsetLeft - (container.clientWidth - wagon.clientWidth) / 2;
        const clamped = Math.max(0, Math.min(targetLeft, container.scrollWidth - container.clientWidth));
        container.scrollTo({ left: clamped, behavior: 'smooth' });
    }
}

// Экспортируем для использования в других модулях
window.BlockLoopControl = BlockLoopControl;

console.log('BlockLoopControl: Класс загружен'); 