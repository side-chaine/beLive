/**
 * Enhanced Text Editor - полноэкранный редактор с системой блоков
 * Обеспечивает разделение текста на блоки (куплеты, припевы, бриджи)
 */
class EnhancedTextEditor {
    constructor(waveformEditor, lyricsDisplay) {
        this.isVisible = false;
        this.currentTrackId = null;
        this.editorContainer = null;
        this.textBlocks = [];
        this.processedText = '';
        this.isProcessing = false;
        this.openedFromSyncEditor = false;
        this.hasEditedBlocks = false;

        this._bindMethods();
    }

    /**
     * Привязка методов к контексту
     */
    _bindMethods() {
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
        this.save = this.save.bind(this);
        this.skip = this.skip.bind(this);
        this.processText = this.processText.bind(this);
        this.createBlockFromText = this.createBlockFromText.bind(this);
        this.setBlockType = this.setBlockType.bind(this);
        this._handleKeydown = this._handleKeydown.bind(this);
        this._showNotification = this._showNotification.bind(this);
    }

    /**
     * Открытие редактора
     * @param {string} trackId - ID трека
     */
    open(trackId) {
        console.log('[EnhancedTextEditor] Opening editor for track:', trackId);
        
        // Сохраняем текущее значение флага для использования в этом вызове
        const wasOpenedFromSyncEditor = this.openedFromSyncEditor;
        
        // Сразу сбрасываем флаг для будущих вызовов
        this.openedFromSyncEditor = false;
        
        if (!trackId || !window.trackCatalog) {
            console.error('Cannot open text editor: missing track ID or track catalog');
            return;
        }
        
        this.currentTrackId = trackId;
        const track = window.trackCatalog.getTrackById(trackId);
        
        if (!track) {
            console.error('Cannot open text editor: track not found', trackId);
            return;
        }
        
        // Получаем текст песни из LyricsDisplay или из объекта трека
        let lyrics = '';
        if (window.lyricsDisplay && window.lyricsDisplay.lyrics) {
            lyrics = window.lyricsDisplay.lyrics;
            console.log(`Using lyrics from lyricsDisplay (length: ${lyrics.length})`);
        } else if (track.lyrics) {
            lyrics = track.lyrics;
            console.log(`Using lyrics from track object (length: ${lyrics.length})`);
        }
        
        // Проверяем наличие сохраненных блоков
        const savedBlocks = track.textBlocks || [];
        
        // Создаем DOM структуру редактора
        this._createEditorDOM(track.title || 'Untitled Track', lyrics, savedBlocks);
        
        // Показываем подсказку или диалог в зависимости от наличия сохраненных блоков и флагов
        if (savedBlocks && savedBlocks.length > 0) {
            // Если у нас есть сохраненные блоки, просто показываем уведомление
            this._showNotification(`Загружены сохраненные блоки (${savedBlocks.length})`, 'info');
            console.log('Блоки уже созданы, пропускаем диалог подтверждения');
        } else if (wasOpenedFromSyncEditor || track.blocksEdited === true) {
            // Если пришли из режима синхронизации или блоки уже редактировались,
            // показываем уведомление вместо диалога
            this._showNotification('Режим редактирования текста активирован', 'info');
        } else {
            // В остальных случаях показываем диалог подтверждения
            this._showConfirmDialog(track.title);
        }
        
        // Добавляем обработчик клавиш
        document.addEventListener('keydown', this._handleKeydown);
        
        this.isVisible = true;
    }

    /**
     * Создание DOM структуры редактора
     * @param {string} trackTitle - Название трека
     * @param {string} lyrics - Текст песни
     * @param {Array} savedBlocks - Сохраненные блоки
     */
    _createEditorDOM(trackTitle, lyrics, savedBlocks) {
        // Удаляем существующий редактор, если есть
        if (this.editorContainer) {
            document.body.removeChild(this.editorContainer);
        }
        
        // Создаем контейнер редактора
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'lyrics-editor-fullscreen';
        
        // Заголовок редактора
        const header = document.createElement('div');
        header.className = 'lyrics-editor-header';
        
        const headerLeft = document.createElement('div');
        headerLeft.className = 'lyrics-editor-header-left';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'lyrics-editor-btn back-btn';
        backBtn.textContent = 'Назад';
        backBtn.addEventListener('click', this.close);
        
        const title = document.createElement('div');
        title.className = 'lyrics-editor-title';
        title.textContent = `Редактор текста: ${trackTitle}`;
        
        headerLeft.appendChild(backBtn);
        headerLeft.appendChild(title);
        
        const headerRight = document.createElement('div');
        headerRight.className = 'lyrics-editor-header-right';
        
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        
        // Основное содержимое редактора
        const body = document.createElement('div');
        body.className = 'lyrics-editor-body';
        
        const content = document.createElement('div');
        content.className = 'lyrics-editor-content';
        
        // Заполняем содержимое редактора блоками
        this._populateContent(content, lyrics, savedBlocks);
        
        body.appendChild(content);
        
        // Футер редактора
        const footer = document.createElement('div');
        footer.className = 'lyrics-editor-footer';
        
        const leftButtons = document.createElement('div');
        
        const skipBtn = document.createElement('button');
        skipBtn.className = 'lyrics-editor-btn skip-btn';
        skipBtn.textContent = 'Пропустить';
        skipBtn.addEventListener('click', this.skip);
        
        leftButtons.appendChild(skipBtn);
        
        const rightButtons = document.createElement('div');
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'lyrics-editor-btn save-btn';
        saveBtn.textContent = 'Сохранить';
        saveBtn.addEventListener('click', this.save);
        
        rightButtons.appendChild(saveBtn);
        
        footer.appendChild(leftButtons);
        footer.appendChild(rightButtons);
        
        // Собираем структуру редактора
        this.editorContainer.appendChild(header);
        this.editorContainer.appendChild(body);
        this.editorContainer.appendChild(footer);
        
        // Добавляем редактор в DOM
        document.body.appendChild(this.editorContainer);
    }

    /**
     * Заполнение содержимого редактора блоками
     * @param {HTMLElement} contentElement - Контейнер для содержимого
     * @param {string} lyrics - Текст песни
     * @param {Array} savedBlocks - Сохраненные блоки
     */
    _populateContent(contentElement, lyrics, savedBlocks) {
        // Очищаем контейнер
        contentElement.innerHTML = '';
        
        console.log('Populating content with saved blocks:', 
                   savedBlocks ? savedBlocks.length : 'none', 
                   'and lyrics length:', lyrics ? lyrics.length : 'none');
        
        // Проверяем наличие сохраненных блоков
        if (Array.isArray(savedBlocks) && savedBlocks.length > 0) {
            console.log(`[EnhancedTextEditor] Using ${savedBlocks.length} saved blocks`);
            
            // Сохраняем блоки в экземпляре класса
            this.textBlocks = JSON.parse(JSON.stringify(savedBlocks));
            
            // Создаем блоки на основе сохраненных данных
            savedBlocks.forEach(block => {
                if (block.content && block.type) {
                    this.createBlockFromText(block.content, contentElement, block.type);
                }
            });
        } else if (lyrics) {
            console.log('[EnhancedTextEditor] No saved blocks, creating from lyrics');
            
            // Если нет сохраненных блоков, создаем один блок с текстом песни
            this.createBlockFromText(lyrics, contentElement, 'verse');
        } else {
            console.warn('[EnhancedTextEditor] No lyrics or blocks available');
            
            // Создаем пустой блок, если нет ни текста, ни блоков
            const emptyBlock = document.createElement('div');
            emptyBlock.className = 'lyrics-block verse';
            emptyBlock.innerHTML = '<textarea placeholder="Введите текст песни..."></textarea>';
            
            const blockControls = document.createElement('div');
            blockControls.className = 'block-controls';
            
            const typeSelector = document.createElement('select');
            typeSelector.className = 'block-type-selector';
            
            const types = [
                { value: 'verse', label: this._getBlockTypeLabel('verse') },
                { value: 'chorus', label: this._getBlockTypeLabel('chorus') },
                { value: 'bridge', label: this._getBlockTypeLabel('bridge') }
            ];
            
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.label;
                typeSelector.appendChild(option);
            });
            
            typeSelector.value = 'verse';
            typeSelector.addEventListener('change', () => {
                this.setBlockType(emptyBlock, typeSelector.value);
            });
            
            blockControls.appendChild(typeSelector);
            emptyBlock.appendChild(blockControls);
            contentElement.appendChild(emptyBlock);
        }
    }

    /**
     * Создание блока из текста
     * @param {string} text - Текст для блока
     * @param {HTMLElement} container - Контейнер для блока
     * @param {string} type - Тип блока (verse, chorus, bridge)
     */
    createBlockFromText(text, container, type = null) {
        const blockContainer = document.createElement('div');
        blockContainer.className = 'block-container';
        if (type) {
            blockContainer.setAttribute('data-block-type', type);
            blockContainer.classList.add(`block-type-${type}`);
            
            const blockLabel = document.createElement('div');
            blockLabel.className = `block-label type-${type}`;
            blockLabel.textContent = this._getBlockTypeLabel(type);
            blockContainer.appendChild(blockLabel);
        }
        
        // Текстовое содержимое блока
        const blockText = document.createElement('div');
        blockText.className = 'block-text';
        blockText.contentEditable = true;
        blockText.textContent = text;
        
        // Кнопки для выбора типа блока
        const blockButtons = document.createElement('div');
        blockButtons.className = 'block-buttons';
        
        const verseBtn = document.createElement('button');
        verseBtn.className = 'block-type-btn type-verse';
        verseBtn.textContent = 'Куплет';
        verseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setBlockType(blockContainer, 'verse');
        });
        
        const chorusBtn = document.createElement('button');
        chorusBtn.className = 'block-type-btn type-chorus';
        chorusBtn.textContent = 'Припев';
        chorusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setBlockType(blockContainer, 'chorus');
        });
        
        const bridgeBtn = document.createElement('button');
        bridgeBtn.className = 'block-type-btn type-bridge';
        bridgeBtn.textContent = 'Бридж';
        bridgeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setBlockType(blockContainer, 'bridge');
        });
        
        blockButtons.appendChild(verseBtn);
        blockButtons.appendChild(chorusBtn);
        blockButtons.appendChild(bridgeBtn);
        
        // Собираем блок
        blockContainer.appendChild(blockText);
        blockContainer.appendChild(blockButtons);
        
        // Добавляем блок в контейнер
        container.appendChild(blockContainer);
        
        // Если блок пустой, устанавливаем фокус
        if (!text) {
            blockText.focus();
        }
        
        return blockContainer;
    }

    /**
     * Установка типа блока
     * @param {HTMLElement} blockElement - Элемент блока
     * @param {string} type - Тип блока (verse, chorus, bridge)
     */
    setBlockType(blockElement, type) {
        // Удаляем предыдущий тип
        blockElement.classList.remove('block-type-verse', 'block-type-chorus', 'block-type-bridge');
        
        // Устанавливаем новый тип
        blockElement.setAttribute('data-block-type', type);
        blockElement.classList.add(`block-type-${type}`);
        
        // Удаляем старую метку, если есть
        const oldLabel = blockElement.querySelector('.block-label');
        if (oldLabel) {
            blockElement.removeChild(oldLabel);
        }
        
        // Добавляем новую метку
        const blockLabel = document.createElement('div');
        blockLabel.className = `block-label type-${type}`;
        blockLabel.textContent = this._getBlockTypeLabel(type);
        
        // Вставляем метку в начало блока
        blockElement.insertBefore(blockLabel, blockElement.firstChild);
        
        this._showNotification(`Блок установлен как ${this._getBlockTypeLabel(type)}`);
    }

    /**
     * Получение текстового представления типа блока
     * @param {string} type - Тип блока
     * @returns {string} - Текстовое представление
     */
    _getBlockTypeLabel(type) {
        switch (type) {
            case 'verse': return 'Куплет';
            case 'chorus': return 'Припев';
            case 'bridge': return 'Бридж';
            default: return 'Блок';
        }
    }

    /**
     * Обработка текста и формирование структуры для сохранения
     * @returns {string} - Обработанный текст
     */
    processText() {
        this.isProcessing = true;
        this._showProcessingOverlay();
        
        try {
            // Получаем все блоки
            const blocks = this.editorContainer.querySelectorAll('.block-container');
            const processedBlocks = [];
            
            blocks.forEach(block => {
                const blockText = block.querySelector('.block-text');
                if (!blockText || !blockText.textContent.trim()) {return;}
                
                const blockType = block.getAttribute('data-block-type') || 'verse';
                const blockContent = blockText.textContent.trim();
                
                processedBlocks.push({
                    type: blockType,
                    content: blockContent
                });
            });
            
            // Сохраняем структуру блоков
            this.textBlocks = processedBlocks;
            
            // Формируем единый текст
            this.processedText = processedBlocks.map(block => block.content).join('\n\n');
            
            console.log('[EnhancedTextEditor] Processed text blocks:', processedBlocks);
            return this.processedText;
            
        } catch (error) {
            console.error('[EnhancedTextEditor] Error processing text:', error);
            return '';
        } finally {
            this.isProcessing = false;
            this._hideProcessingOverlay();
        }
    }

    /**
     * Отображение оверлея загрузки
     */
    _showProcessingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'processing-overlay';
        overlay.id = 'processing-overlay';
        
        const spinner = document.createElement('div');
        spinner.className = 'processing-spinner';
        
        const message = document.createElement('div');
        message.textContent = 'Обработка текста...';
        
        const skipButton = document.createElement('button');
        skipButton.className = 'skip-processing-btn';
        skipButton.textContent = 'Пропустить';
        skipButton.addEventListener('click', this.skip);
        
        overlay.appendChild(spinner);
        overlay.appendChild(message);
        overlay.appendChild(skipButton);
        
        this.editorContainer.appendChild(overlay);
    }

    /**
     * Скрытие оверлея загрузки
     */
    _hideProcessingOverlay() {
        const overlay = document.getElementById('processing-overlay');
        if (overlay) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    /**
     * Сохранение текста и блоков
     */
    save() {
        const processedText = this.processText();
        
        if (!processedText) {
            this._showNotification('Текст пуст или содержит ошибки', 'error');
            return;
        }
        
        try {
            if (!this.currentTrackId || !window.trackCatalog) {
                console.error('Cannot save lyrics: missing track ID or track catalog');
                this._showNotification('Ошибка сохранения текста: трек не найден', 'error');
                return;
            }
            
            const track = window.trackCatalog.getTrackById(this.currentTrackId);
            
            if (!track) {
                console.error('Cannot save lyrics: track not found', this.currentTrackId);
                this._showNotification('Ошибка сохранения текста: трек не найден', 'error');
                return;
            }
            
            // Используем метод обновления текста в TrackCatalog
            if (typeof window.trackCatalog.updateTrackLyrics === 'function') {
                window.trackCatalog.updateTrackLyrics(this.currentTrackId, processedText);
                
                // Сохраняем структуру блоков, если доступен соответствующий метод
                if (typeof window.trackCatalog.saveLyricsBlocks === 'function' && this.textBlocks.length > 0) {
                    console.log(`Saving ${this.textBlocks.length} text blocks for track ${this.currentTrackId}`);
                    window.trackCatalog.saveLyricsBlocks(this.currentTrackId, this.textBlocks);
                    
                    // Явно устанавливаем флаг, что блоки были отредактированы
                    if (typeof window.trackCatalog.setBlocksEditedFlag === 'function') {
                        window.trackCatalog.setBlocksEditedFlag(this.currentTrackId, true);
                        console.log(`Set blocksEdited=true for track ${this.currentTrackId}`);
                    }
                }
            } else {
                // Резервный вариант - сохраняем напрямую в объект трека
                track.lyrics = processedText;
                track.textBlocks = this.textBlocks;
                track.blocksEdited = true; // Устанавливаем флаг
            }
            
            // Обновляем отображение текста, если LyricsDisplay доступен
            if (window.lyricsDisplay) {
                window.lyricsDisplay.loadLyrics(processedText);
                
                // Передаем структуру блоков в LyricsDisplay, если есть соответствующий метод
                if (typeof window.lyricsDisplay.loadTextBlocks === 'function') {
                    window.lyricsDisplay.loadTextBlocks(this.textBlocks);
                }
            }
            
            this._showNotification('Текст успешно сохранен');
            
            // Сохраняем состояние флага для будущего использования во время этой сессии
            this.hasEditedBlocks = true;
            
            // Закрываем редактор
            this.close();
            
            // Автоматически переходим в режим Sync с активированными маркерами
            setTimeout(() => {
                if (window.waveformEditor) {
                    // Устанавливаем флаг, чтобы предотвратить повторное показывание диалога
                    // при следующем открытии редактора для этого трека
                    if (window.waveformEditor.enhancedTextEditor) {
                        window.waveformEditor.enhancedTextEditor.openedFromSyncEditor = true;
                    }
                    
                    // ВАЖНО: Переключаем с режима репетиции на стандартный режим отображения
                    if (window.textStyleManager && window.textStyleManager.currentStyleId === 'rehearsal') {
                        console.log('EnhancedTextEditor: Switching from rehearsal to default mode for Sync editor');
                        window.textStyleManager.applyStyle('default');
                    }
                    
                    // Открываем редактор синхронизации
                    window.waveformEditor.show();
                    
                    // Активируем маркеры (включаем их отображение)
                    if (!window.waveformEditor.showMarkers) {
                        window.waveformEditor._toggleMarkers();
                    }
                }
            }, 500); // Небольшая задержка для плавного перехода между режимами
            
        } catch (error) {
            console.error('[EnhancedTextEditor] Error saving lyrics:', error);
            this._showNotification('Ошибка сохранения текста', 'error');
        }
    }

    /**
     * Пропуск редактирования текста
     */
    skip() {
        // Просто закрываем редактор без уведомлений
        this.close();
        
        // Автоматически переходим в режим Sync с активированными маркерами
        setTimeout(() => {
            if (window.waveformEditor) {
                window.waveformEditor.show();
                
                if (!window.waveformEditor.showMarkers) {
                    window.waveformEditor._toggleMarkers();
                }
            }
        }, 300);
    }

    /**
     * Закрытие редактора
     */
    close() {
        if (this.editorContainer) {
            document.body.removeChild(this.editorContainer);
            this.editorContainer = null;
        }
        
        document.removeEventListener('keydown', this._handleKeydown);
        
        this.isVisible = false;
        this.currentTrackId = null;
    }

    /**
     * Обработка нажатий клавиш
     * @param {KeyboardEvent} event - Событие клавиатуры
     */
    _handleKeydown(event) {
        // Escape для закрытия
        if (event.key === 'Escape') {
            this.close();
        }
        
        // Ctrl+S для сохранения
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.save();
        }
    }

    /**
     * Отображение уведомления
     * @param {string} message - Текст уведомления
     * @param {string} type - Тип уведомления (success, error)
     */
    _showNotification(message, type = 'success') {
        // Используем глобальную функцию уведомлений, если доступна
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // Резервная реализация уведомления
            console.log(`[Notification] ${message} (${type})`);
            alert(message);
        }
    }

    /**
     * Показывает диалог подтверждения редактирования
     * @param {string} trackTitle - Название трека
     */
    _showConfirmDialog(trackTitle) {
        const dialog = document.createElement('div');
        dialog.className = 'lyrics-editor-confirm-dialog';
        
        const content = document.createElement('div');
        content.className = 'lyrics-editor-confirm-content';
        
        const message = document.createElement('p');
        message.textContent = 'Хотите отредактировать текст песни сейчас?';
        
        const subMessage = document.createElement('p');
        subMessage.textContent = 'Можно разделить текст на блоки (куплеты, припевы, бриджи).';
        subMessage.className = 'lyrics-editor-confirm-submessage';
        
        const buttons = document.createElement('div');
        buttons.className = 'lyrics-editor-confirm-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Отмена';
        cancelButton.className = 'lyrics-editor-btn cancel-btn';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(dialog);
            
            // Просто закрываем редактор без дополнительных действий
            this.close();
        });
        
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'lyrics-editor-btn ok-btn';
        okButton.addEventListener('click', () => {
            document.body.removeChild(dialog);
            // При нажатии OK просто закрываем диалог, оставляя пользователя в редакторе
        });
        
        buttons.appendChild(cancelButton);
        buttons.appendChild(okButton);
        
        content.appendChild(message);
        content.appendChild(subMessage);
        content.appendChild(buttons);
        dialog.appendChild(content);
        
        document.body.appendChild(dialog);
        
        // Добавляем стили для диалога
        const style = document.createElement('style');
        style.textContent = `
            .lyrics-editor-confirm-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .lyrics-editor-confirm-content {
                background-color: #2c2c2c;
                border-radius: 5px;
                padding: 20px;
                width: 400px;
                max-width: 90%;
                text-align: center;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            }
            
            .lyrics-editor-confirm-submessage {
                color: #aaa;
                font-size: 14px;
                margin-bottom: 20px;
            }
            
            .lyrics-editor-confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 15px;
            }
            
            .lyrics-editor-btn.cancel-btn {
                background-color: #555;
            }
            
            .lyrics-editor-btn.ok-btn {
                background-color: #4a89dc;
            }
        `;
        
        document.head.appendChild(style);
    }
} 