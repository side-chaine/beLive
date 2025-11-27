class ModalBlockEditor {
    constructor() {
        this.container = document.getElementById('modal-block-editor-container');
        this.blockListArea = this.container.querySelector('.block-list-area');
        this.addBlockBtn = this.container.querySelector('#add-block-btn');
        this.saveBtn = this.container.querySelector('#save-track-modal-btn'); // Используем новый ID
        this.cancelBtn = this.container.querySelector('#cancel-edit-modal-btn'); // Используем новый ID
        this.statusElement = this.container.querySelector('#block-editor-status');

        // История действий (Undo/Redo)
        this.historyStack = [];
        this.redoStack = [];
        this.maxHistory = 100;
        this.initialSnapshot = null;
        this.isRestoring = false; // не писать историю при восстановлении

        // Кнопки Undo/Redo
        this.undoBtn = null;
        this.redoBtn = null;

        // Ссылки на кнопки будут инициализированы в show() в первый раз
        this.editModeToggleBtn = null;
        this.deleteSelectedBlockBtn = null; 
        
        this.isEditModeActive = false;
        this.selectedBlock = null;
        this.buttonsBound = false; // Флаг для однократной привязки

        this.onSave = null;
        this.onCancel = null;
        this.currentTrackInfo = null;

        // Переменные для drag-and-merge
        this.draggedBlock = null;
        this.isDragging = false;
        this.mergeTarget = null;
        this.blockEventsBound = false; // Флаг для однократной привязки событий блоков
        this.blockTypeSelector = null; // Элемент селектора типа блока
        this.activeBlockForSelector = null; // Блок, для которого показан селектор
        this.hideSelectorTimeout = null; // Таймаут для скрытия селектора
        this.blockStylesApplied = false; // Флаг, что стили блоков уже добавлены

        this._bindInternalEvents(); // Привязываем только статические кнопки
        // _bindBlockInteractionEvents() будет вызван в show()
        console.log('ModalBlockEditor instance created.');
    }

    _bindInternalEvents() {
        // Привязка для кнопок, которые всегда существуют в разметке модального окна
        if (this.addBlockBtn) {
            this.addBlockBtn.addEventListener('click', () => this._addNewBlock());
        }
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this._handleSave());
        }
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this._handleCancel());
        }
    }

    _bindDynamicButtons() {
        // Этот метод будет вызван из show() один раз
        this.editModeToggleBtn = this.container.querySelector('#edit-mode-toggle-btn');
        this.deleteSelectedBlockBtn = this.container.querySelector('#delete-selected-block-btn');
        this.undoBtn = this.container.querySelector('#undo-block-btn');
        this.redoBtn = this.container.querySelector('#redo-block-btn');

        if (this.editModeToggleBtn) {
            this.editModeToggleBtn.addEventListener('click', () => this._toggleEditMode());
        }
        if (this.deleteSelectedBlockBtn) {
            this.deleteSelectedBlockBtn.addEventListener('click', () => this._deleteSelectedBlockHandler());
        }
        if (this.undoBtn) {
            this.undoBtn.addEventListener('click', () => this.undo());
        }
        if (this.redoBtn) {
            this.redoBtn.addEventListener('click', () => this.redo());
        }

        // Хоткеи: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z
        if (!this._hotkeysBound) {
            this._hotkeysBound = true;
            document.addEventListener('keydown', (e) => {
                if (this.container.classList.contains('hidden')) {return;}
                const isCmd = e.metaKey || e.ctrlKey;
                if (!isCmd) {return;}
                if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                } else if (e.key.toLowerCase() === 'z' && e.shiftKey) {
                    e.preventDefault();
                    this.redo();
                }
            });
        }
        this.buttonsBound = true;
    }

    _bindBlockInteractionEvents() {
        console.log('ModalBlockEditor: Attempting to bind block interaction events.'); // Отладка: начало привязки
        if (!this.blockListArea) {
            console.error('ModalBlockEditor: blockListArea is not defined at the time of binding block events!');
            return;
        }
        console.log('ModalBlockEditor: blockListArea found:', this.blockListArea); // Отладка: элемент найден

        // Удаляем старые обработчики, если они были (на всякий случай, хотя флаг blockEventsBound должен это предотвращать)
        // Но для чистоты эксперимента можно добавить, если есть подозрения на многократную привязку несмотря на флаг.
        // this.blockListArea.removeEventListener('click', ...);
        // document.removeEventListener('mousemove', ...);
        // document.removeEventListener('mouseup', ...);

        this.blockListArea.addEventListener('click', (event) => {
            console.log('ModalBlockEditor: blockListArea CLICK event fired'); // Отладка
            const targetBlock = event.target.closest('.text-block');
            if (!targetBlock || this.isDragging) {return;} // Игнорировать клики во время перетаскивания

            if (this.isEditModeActive) {
                // Если режим редактирования активен, клик должен фокусировать на блоке для редактирования.
                // Убедимся, что блок становится редактируемым и получает фокус.
                if (targetBlock.getAttribute('contenteditable') !== 'true') {
                    this._setBlockEditable(targetBlock, true);
                }
                // Не меняем this.selectedBlock активно, чтобы не мешать редактированию,
                // но можем его запомнить, если понадобится для других действий в режиме редактирования.
            } else {
                // Логика выбора блока, если режим редактирования НЕ активен
                if (this.selectedBlock && this.selectedBlock !== targetBlock) {
                    this.selectedBlock.classList.remove('selected-block-highlight');
                }
                this.selectedBlock = targetBlock;
                this.selectedBlock.classList.add('selected-block-highlight');
                this._updateButtonStates(); 
            }
        });

        // Добавляем обработчик blur для блоков, чтобы снимать contenteditable
        // когда фокус уходит из блока в режиме редактирования
        this.blockListArea.addEventListener('focusout', (event) => {
            const targetBlock = event.target.closest('.text-block');
            if (this.isEditModeActive && targetBlock && targetBlock.getAttribute('contenteditable') === 'true') {
                // Не снимаем contenteditable, если фокус перешел на кнопки управления или другой редактируемый элемент внутри
                if (!event.relatedTarget || !this.container.contains(event.relatedTarget)) {
                     // this._setBlockEditable(targetBlock, false); // Пока не будем автоматически отключать
                }
            }
        }, true); // Используем capturing phase для focusout

        this.blockListArea.addEventListener('mousedown', this._handleBlockMouseDown.bind(this));
        console.log('ModalBlockEditor: MOUSEDOWN listener attached to blockListArea.'); // Отладка
        
        document.addEventListener('mousemove', this._handleBlockDrag.bind(this));
        console.log('ModalBlockEditor: MOUSEMOVE listener attached to document.'); // Отладка

        document.addEventListener('mouseup', this._handleBlockMouseUp.bind(this));
        console.log('ModalBlockEditor: MOUSEUP listener attached to document.'); // Отладка

        // Добавляем события для показа/скрытия селектора типа блока
        this.blockListArea.addEventListener('mouseover', this._handleBlockMouseEnter.bind(this)); 
        this.blockListArea.addEventListener('mouseout', this._handleBlockMouseLeave.bind(this)); // Возвращаем/добавляем mouseout
        // document.addEventListener('mousemove', this._handleDocumentMouseMove.bind(this)); // Пока закомментируем, возможно не понадобится
    }
    
    _handleBlockMouseDown(event) {
        if (this.isEditModeActive) {return;} // Не работаем в режиме редактирования

        const targetBlock = event.target.closest('.text-block');
        console.log('ModalBlockEditor: Mouse down on block:', targetBlock); // Отладка
        if (targetBlock) {
            this.draggedBlock = targetBlock;
            this.isDragging = true;
            this.draggedBlock.classList.add('drag-source');
            console.log('ModalBlockEditor: Dragging started, draggedBlock:', this.draggedBlock); // Отладка
            event.preventDefault(); // Предотвратить выделение текста при перетаскивании
        }
    }

    _handleBlockDrag(event) {
        console.log('ModalBlockEditor: Mouse move, isDragging:', this.isDragging, 'draggedBlock:', this.draggedBlock); // Отладка
        if (!this.isDragging || !this.draggedBlock) {return;}
        event.preventDefault();

        // Сначала убираем все предыдущие подсветки кандидатов
        this.blockListArea.querySelectorAll('.text-block').forEach(block => {
            block.classList.remove('merge-candidate-top', 'merge-candidate-bottom');
        });
        this.mergeTarget = null; // Сбрасываем текущую цель для слияния

        const mouseY = event.clientY;
        const blocks = Array.from(this.blockListArea.querySelectorAll('.text-block'));

        for (const potentialTarget of blocks) {
            if (potentialTarget === this.draggedBlock) {continue;} // Не можем слиться сами с собой

            const rect = potentialTarget.getBoundingClientRect();
            const threshold = 15; // Пиксели - зона чувствительности у края блока

            if (mouseY >= rect.top && mouseY < rect.top + threshold) { // Верхний край
                potentialTarget.classList.add('merge-candidate-top');
                this.mergeTarget = potentialTarget;
                // this.mergePosition = 'top';
                break; 
            } else if (mouseY > rect.bottom - threshold && mouseY <= rect.bottom) { // Нижний край
                potentialTarget.classList.add('merge-candidate-bottom');
                this.mergeTarget = potentialTarget;
                // this.mergePosition = 'bottom';
                break;
            }
        }
    }

    _handleBlockMouseUp(event) {
        console.log('ModalBlockEditor: Mouse up, isDragging:', this.isDragging, 'draggedBlock:', this.draggedBlock, 'mergeTarget:', this.mergeTarget); // Отладка
        if (!this.isDragging || !this.draggedBlock) {return;}
        event.preventDefault();

        if (this.mergeTarget) {
            this._performMerge(); // Использует this.draggedBlock и this.mergeTarget
            // TODO: Позже добавить _pushStateToHistory();
        }

        // Очистка состояния перетаскивания
        if (this.draggedBlock) {
            this.draggedBlock.classList.remove('drag-source');
        }
        this.blockListArea.querySelectorAll('.text-block').forEach(block => {
            block.classList.remove('merge-candidate-top', 'merge-candidate-bottom');
        });

        this.isDragging = false;
        this.draggedBlock = null;
        this.mergeTarget = null;
        // this.mergePosition = null;
    }

    _performMerge() {
        if (!this.draggedBlock || !this.mergeTarget) {return;}

        const draggedText = this.draggedBlock.innerText.trim();
        const targetText = this.mergeTarget.innerText.trim();

        let blockToKeep, blockToRemove;

        if (draggedText.length > targetText.length) {
            blockToKeep = this.draggedBlock;
            blockToRemove = this.mergeTarget;
        } else if (targetText.length > draggedText.length) {
            blockToKeep = this.mergeTarget;
            blockToRemove = this.draggedBlock;
        } else { // Если длины равны, сохраняем целевой блок (тот, на который перетащили)
            blockToKeep = this.mergeTarget; 
            blockToRemove = this.draggedBlock;
        }
        
        const textOfBlockToKeep = blockToKeep.innerText.trim();
        const textOfBlockToRemove = blockToRemove.innerText.trim();

        // Объединяем текст: текст удаляемого блока добавляется к сохраняемому
        blockToKeep.innerText = textOfBlockToKeep + '\n' + textOfBlockToRemove;
        
        const blockToRemoveWasSelected = (this.selectedBlock === blockToRemove);
        const typeOfKeptBlock = blockToKeep.getAttribute('data-block-type'); // Сохраняем тип перед удалением классов
        
        blockToRemove.remove();

        // Обновление выделения и типа
        if (this.selectedBlock && this.selectedBlock !== blockToKeep) {
             if(blockToRemoveWasSelected || this.selectedBlock) { 
                if(this.selectedBlock) {this.selectedBlock.classList.remove('selected-block-highlight');}
             }
        }
        this.selectedBlock = blockToKeep; 
        this.selectedBlock.classList.add('selected-block-highlight'); // Сначала выделяем
        
        // Сбрасываем классы типов и применяем сохраненный тип, если он был
        this.selectedBlock.classList.remove('block-type-verse', 'block-type-chorus', 'block-type-bridge', 'block-type-prechorus', 'block-type-intro', 'block-type-outro');
        if (typeOfKeptBlock && typeOfKeptBlock !== 'null' && typeOfKeptBlock !== 'none') {
            this.selectedBlock.classList.add(`block-type-${typeOfKeptBlock}`);
        }
        // Атрибут data-block-type должен уже быть на blockToKeep
        
        this._updateButtonStates();
        console.log('Blocks merged. Kept:', blockToKeep, 'Removed:', blockToRemove);
        this._pushSnapshot('merge-blocks');
    }

    _setBlockEditable(block, editable) {
        if (block) {
            block.setAttribute('contenteditable', editable.toString());
            block.style.cursor = editable ? 'text' : 'pointer';
            if (editable) {
                block.focus();
            }
        }
    }

    _createAndSetupBlock(text = '', placeholder = 'Введите текст блока...', blockType = 'verse') {
        const newBlock = document.createElement('div');
        newBlock.classList.add('text-block');
        newBlock.setAttribute('contenteditable', 'false'); // Изначально не редактируемый
        newBlock.innerText = text; 
        newBlock.setAttribute('data-placeholder', placeholder);
        newBlock.setAttribute('data-block-type', blockType); 
        // newBlock.classList.add(`block-type-${blockType}`); // РАСКОММЕНТИРОВАНО: Добавляем класс типа блока здесь
        
        // Удален вызов this._addDeleteButtonToBlock(newBlock);
        
        this.blockListArea.appendChild(newBlock);
        return newBlock;
    }
    
    _splitTextIntoBlocks(text) {
        if (!text || text.trim() === '') {return [];}
        
        console.log('🔍 ModalBlockEditor: _splitTextIntoBlocks получил текст длиной:', text.length);
        console.log('🔍 Первые 400 символов входного текста:', text.substring(0, 400));
        console.log('🔍 Количество \n\n в тексте:', (text.match(/\n\n/g) || []).length);
        
        // Нормализуем переносы строк
        const normalizedText = text.replace(/\r\n|\r/g, '\n');
        
        // ИСПРАВЛЕНО: Разбиение по двум или более последовательным переносам строк (для абзацев)
        const potentialBlocks = normalizedText.split(/\n{2,}/);

        // Фильтруем пустые блоки, но сохраняем пустые строки, если они являются частью блока
        const blocks = potentialBlocks.map(b => b.trim()).filter(b => b !== '');
        console.log(`🔍 ModalBlockEditor: Разделение по абзацам дало ${blocks.length} блоков`);
        console.log('🔍 Первый блок:', blocks[0]);
        console.log('🔍 Второй блок:', blocks[1]);
        
        // Определяем типы блоков на основе содержимого
        return blocks.map((content, index) => {
            let type = 'verse'; // По умолчанию куплет
            
            // Простая эвристика для определения типа
            const lowerContent = content.toLowerCase();
            
            // Расширенная эвристика для новых типов блоков
            if (lowerContent.includes('chorus') || lowerContent.includes('припев') || 
                this._isRepeatingContent(content, blocks)) {
                type = 'chorus';
            } else if (lowerContent.includes('bridge') || lowerContent.includes('бридж') || 
                       (index > 0 && index < blocks.length - 1 && content.length < blocks[0].length * 0.7 && !this._isRepeatingContent(content, blocks))) {
                type = 'bridge';
            } else if (lowerContent.includes('prechorus') || lowerContent.includes('предприпев') ||
                       (index > 0 && content.length < blocks[0].length * 0.5 && !this._isRepeatingContent(content, blocks))) {
                type = 'prechorus';
            } else if (lowerContent.includes('intro') || lowerContent.includes('интро')) {
                type = 'intro';
            } else if (lowerContent.includes('outro') || lowerContent.includes('аутро')) {
                type = 'outro';
            } else if (content.trim() === '') {
                type = 'blank'; // Если блок пустой, назначаем тип blank
            }
            
            return { content: content, type: type };
        });
    }
    
    // Вспомогательная функция для определения повторяющегося контента (припева)
    _isRepeatingContent(content, allBlocks) {
        const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        let matchCount = 0;
        
        for (const block of allBlocks) {
            if (block === content) {continue;}
            const blockWords = block.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const commonWords = words.filter(word => blockWords.includes(word));
            if (commonWords.length > words.length * 0.45) {
                matchCount++;
            }
        }
        
        return matchCount > 0;
    }

    init(lyricsText, trackInfo, onSaveCallback, onCancelCallback) {
        console.log('ModalBlockEditor: Initializing with text:', lyricsText ? lyricsText.substring(0, 50) + '...' : 'No text');
        this.currentTrackInfo = trackInfo;
        this.onSave = onSaveCallback;
        this.onCancel = onCancelCallback;
        this.isEditModeActive = false; 
        this.selectedBlock = null;   

        this.blockListArea.innerHTML = ''; 

        // 🎯 ИСПРАВЛЕНО: Сохраняем распарсенный текст в виде массива строк
        this.lyricsLines = (lyricsText || '').split('\n').map(line => line.trim());

        const blocks = this._splitTextIntoBlocks(lyricsText || '');

        if (blocks.length === 0) {
            this._createAndSetupBlock(); 
        } else {
            blocks.forEach(blockData => {
                const newBlock = this._createAndSetupBlock(blockData.content, undefined, blockData.type); 
            });
        }
        if (!this.blockStylesApplied) { // Применяем стили только один раз
            this._applyBlockTypeStyles(); 
            this.blockStylesApplied = true;
        }
        this._updateButtonStates(); 

        // Сбрасываем историю и делаем начальный снимок как базовое состояние
        this.redoStack = [];
        this.initialSnapshot = this._serialize();
        this.historyStack = [this.initialSnapshot];
        this._updateUndoRedoButtons();
    }

    _applyBlockTypeStyles() {
        if (!document.getElementById('block-type-styles')) {
            const style = document.createElement('style');
            style.id = 'block-type-styles';
            style.textContent = `
                .text-block {
                    color: #333;
                    padding: 8px;
                    margin-bottom: 8px;
                    border-radius: 4px;
                    display: table;
                    min-width: 100px; 
                    border: 1px solid #ddd; 
                    cursor: pointer; /* По умолчанию курсор pointer */
                    transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s; /* Добавил box-shadow в transition */
                    position: relative; /* Для позиционирования дочерних элементов, таких как селектор */
                }
                .text-block:hover {
                    background-color: #f0f0f0;
                    border-color: #ccc;
                }
                .text-block[contenteditable="true"] {
                    cursor: text; 
                    border-color: #3498db; 
                    background-color: #e9f5ff; 
                }
                .selected-block-highlight {
                    background-color: #d6eaf8 !important; /* Голубоватое выделение */
                    border-color: #3498db !important; /* Синяя рамка */
                    box-shadow: 0 0 5px rgba(52, 152, 219, 0.5);
                }
                .text-block.drag-source { /* Стиль для блока, который перетаскивают */
                    border-color: #007bff !important;
                    box-shadow: 0 0 8px rgba(0, 123, 255, 0.6) !important;
                    /* opacity: 0.7; */ /* Временно убрано для отладки */
                }
                .text-block.merge-candidate-top { /* Подсветка верхнего края цели */
                    box-shadow: 0 -4px 0 0 #28a745 inset !important; 
                }
                .text-block.merge-candidate-bottom { /* Подсветка нижнего края цели */
                    box-shadow: 0 4px 0 0 #28a745 inset !important;  
                }
                /* Стили для block-type-verse, block-type-chorus и т.д. могут быть здесь, если нужны */

                .block-type-selector {
                    position: absolute; 
                    z-index: 10; 
                    background-color: #f8f9fa; /* Светлее фон */
                    border: 1px solid #dee2e6; /* Светлее рамка */
                    border-radius: 5px; /* Чуть больше скругление */
                    box-shadow: 0 3px 8px rgba(0,0,0,0.1); /* Мягче тень */
                    display: grid; /* Используем Grid для точного контроля колонок */
                    grid-template-columns: 1fr 1fr; /* Две колонки с равной шириной */
                    gap: 4px; /* Отступ между элементами Grid */
                    padding: 4px; /* Внутренний отступ селектора */
                    width: 240px; /* Оптимальная ширина контейнера для 2-х колонок */
                    box-sizing: border-box; /* Важно для корректного расчета ширины */
                    opacity: 0;
                    transform: translateY(5px); /* Анимация "сверху вниз" */
                    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
                    pointer-events: auto; /* Делаем кликабельным, когда видим */
                }
                .block-type-selector.hidden {
                    display: none; /* Остается для полного скрытия после анимации */
                }
                .block-type-selector.visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto; /* Делаем кликабельным, когда видим */
                }
                .selector-option {
                    padding: 3px 6px; /* Паддинги кнопок */
                    margin: 0;  /* Убираем индивидуальные маржины, используем gap Grid */
                    border: none;
                    border-radius: 3px; 
                    cursor: pointer;
                    font-size: 10px; 
                    color: #fff;
                    /* Ширина будет автоматически определяться Grid-ом */
                    flex-grow: 0; 
                    flex-shrink: 0; 
                    box-sizing: border-box; /* Важно для корректного расчета ширины */
                    text-align: center; /* Центрирование текста в кнопках */
                    white-space: normal; /* Разрешаем перенос текста внутри кнопки */
                    word-break: break-word; /* Принудительный перенос слов */
                    overflow: hidden; /* Скрывать переполняющий контент */
                    text-overflow: ellipsis; /* Добавлять многоточие для переполняющего текста */
                    transition: opacity 0.2s, transform 0.1s ease-in-out;
                }
                .selector-option:hover {
                    opacity: 0.85;
                    transform: scale(1.05);
                }
                .option-verse {
                    background-color: #28a745; /* Зеленый */
                }
                .option-chorus {
                    background-color: #dc3545; /* Красный */
                }
                .option-bridge {
                    background-color: #6f42c1; /* Фиолетовый */
                }
                .option-prechorus {
                    background-color: #ffc107; /* Желтый */
                }
                .option-intro,
                .option-outro {
                    background-color: #17a2b8; /* Бирюзовый */
                }
                .option-blank {
                    background-color: #6c757d; /* Серый для пустых */
                }

                /* Стили для отображения типа блока на самом блоке (пока просто цвет фона) */
                .block-type-verse {
                    /* background-color: rgba(40, 167, 69, 0.1); */
                    background-color: #e9f7ef !important; /* Светло-зеленый фон */
                    border-left: 5px solid #28a745 !important; /* Зеленая полоса слева */
                    box-shadow: 0 0 8px rgba(40, 167, 69, 0.2); /* Легкое зеленое свечение */
                }
                .block-type-chorus {
                    /* background-color: rgba(220, 53, 69, 0.1); */
                    background-color: #fcebec !important; /* Светло-красный фон */
                    border-left: 5px solid #dc3545 !important; /* Красная полоса слева */
                    box-shadow: 0 0 8px rgba(220, 53, 69, 0.2); /* Легкое красное свечение */
                }
                .block-type-bridge {
                    /* background-color: rgba(111, 66, 193, 0.1); */
                    background-color: #f1eff7 !important; /* Светло-фиолетовый фон */
                    border-left: 5px solid #6f42c1 !important; /* Фиолетовая полоса слева */
                    box-shadow: 0 0 8px rgba(111, 66, 193, 0.2); /* Легкое фиолетовое свечение */
                }
                .block-type-prechorus {
                    background-color: #fff3cd !important; /* Светло-желтый фон */
                    border-left: 5px solid #ffc107 !important; /* Желтая полоса слева */
                    box-shadow: 0 0 8px rgba(255, 193, 7, 0.2); /* Легкое желтое свечение */
                }
                .block-type-intro,
                .block-type-outro {
                    background-color: #dbeff3 !important; /* Светло-бирюзовый фон */
                    border-left: 5px solid #17a2b8 !important; /* Бирюзовая полоса слева */
                    box-shadow: 0 0 8px rgba(23, 162, 184, 0.2); /* Легкое бирюзовое свечение */
                }
                .block-type-blank {
                    background-color: rgba(255,255,255,0.05) !important; /* Очень светло-серый или почти прозрачный */
                    border-left: 5px solid rgba(108, 117, 125, 0.4) !important; /* Полупрозрачная серая полоса */
                    box-shadow: none;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Метод для обновления состояния кнопок (например, активности кнопки "Удалить")
    _updateButtonStates() {
        if (this.deleteSelectedBlockBtn) {
            this.deleteSelectedBlockBtn.disabled = !this.selectedBlock || this.isEditModeActive;
        }
        if (this.editModeToggleBtn) {
            this.editModeToggleBtn.classList.toggle('active-edit-mode', this.isEditModeActive);
            // Можно обновлять и текст кнопки, если это потребуется для нового дизайна
            // this.editModeToggleBtn.innerHTML = this.isEditModeActive ? 'ГОТОВО' : '&#9998;'; 
        }
        this._updateUndoRedoButtons();
    }

    show() {
        this.container.classList.remove('hidden');
        
        if (!this.buttonsBound) { // Привязываем динамические кнопки только один раз при первом показе
            this._bindDynamicButtons();
        }
        if (!this.blockEventsBound) { // Привязываем события взаимодействия с блоками только один раз
            this._bindBlockInteractionEvents();
            this.blockEventsBound = true;
        }

        this.isEditModeActive = false; 
        if(this.selectedBlock) {this.selectedBlock.classList.remove('selected-block-highlight');}
        this.selectedBlock = null;
        
        this.statusElement.textContent = 'Режим выбора блоков.'; // Обновленный статус
        this._updateButtonStates();
        console.log('ModalBlockEditor: Shown');
    }

    hide() {
        this.container.classList.add('hidden');
        this.statusElement.textContent = 'Редактор блоков неактивен.';
        console.log('ModalBlockEditor: Hidden');
        if (this.onCancel) {
            // this.onCancel(); // Пока не вызываем, чтобы не было двойного вызова при закрытии извне
        }
    }

    _addNewBlock() {
        const newBlock = this._createAndSetupBlock('', 'Новый блок...');
        if (!this.isEditModeActive) { // Если не в режиме редактирования, выделяем новый блок
            if (this.selectedBlock) {
                this.selectedBlock.classList.remove('selected-block-highlight');
            }
            this.selectedBlock = newBlock;
            this.selectedBlock.classList.add('selected-block-highlight');
            this._updateButtonStates();
        } else { // Если в режиме редактирования, делаем его сразу редактируемым
            newBlock.setAttribute('contenteditable', 'true');
            newBlock.focus();
        }
        // Записываем историю только для пользовательского добавления
        this._pushSnapshot('create-block');
    }

    async _handleSave() {
        console.log('ModalBlockEditor: _handleSave called');
        
        // Показываем стильный оверлей загрузки
        this._showLoadingOverlay('Сохранение трека и подготовка редактора...');

        // Небольшая задержка, чтобы пользователь успел увидеть индикатор
        await new Promise(resolve => setTimeout(resolve, 300));

        const blocks = this.blockListArea.querySelectorAll('.text-block');
        const editedBlocks = [];
        let currentLineIndex = 0;

        Array.from(blocks).forEach((blockElement, blockIndex) => {
            const blockContent = blockElement.innerText.trim();
            const blockType = blockElement.getAttribute('data-block-type') || 'verse';
            const blockLineIndices = [];
            
            // 🎯 ИСПРАВЛЕНО: Определяем lineIndices для каждого блока
            const blockLines = blockContent.split('\n').map(line => line.trim());
            blockLines.forEach(line => {
                if (line !== '') { // Игнорируем пустые строки при сопоставлении
                    const globalLineIndex = this.lyricsLines.indexOf(line, currentLineIndex);
                    if (globalLineIndex !== -1) {
                        blockLineIndices.push(globalLineIndex);
                        currentLineIndex = globalLineIndex + 1; // Начинаем поиск со следующей строки
                    } else {
                        // Если строка не найдена, это может указывать на новое содержание или ошибку
                        console.warn(`ModalBlockEditor: Line "${line}" not found in global lyrics starting from index ${currentLineIndex}.`);
                    }
                }
            });

            editedBlocks.push({
                id: `block-${Date.now()}-${blockIndex}-${Math.random().toString(36).substring(2, 15)}`, // Генерируем уникальный ID
                name: `Block ${blockIndex + 1}`, // Или используем другое имя
                lineIndices: blockLineIndices,
                type: blockType
            });
        });
            
        // Обновляем информацию о треке, но не сам текст. Этим займется TrackCatalog
        console.log('ModalBlockEditor: Saving blocks:', editedBlocks);
        console.log('ModalBlockEditor: Passing track info:', this.currentTrackInfo);
        
        // Вызываем колбэк с правильными параметрами: (editedBlocks, savedTrackInfo)
        if (this.onSave) {
            try {
                // 🎯 ИСПРАВЛЕНО: Передаем оригинальный текст, который был в редакторе,
                // чтобы TrackCatalog мог его сохранить и передать в LyricsDisplay.
                const result = await this.onSave(editedBlocks, this.lyricsLines.join('\n'), this.currentTrackInfo);
                console.log('ModalBlockEditor: Save callback result:', result);
                this.hide();

                // Очистим историю после успешного сохранения
                this.historyStack = [];
                this.redoStack = [];
                this.initialSnapshot = null;

                // 🎯 АВТОМАТИЧЕСКИ ОТКРЫВАЕМ SYNC EDITOR ПОСЛЕ СОХРАНЕНИЯ
                try {
                    if (window.waveformEditor && typeof window.waveformEditor.show === 'function') {
                                    window.waveformEditor.show();
                        console.log('ModalBlockEditor: Fallback open of Sync Editor via show()');
                            } else {
                        console.warn('ModalBlockEditor: WaveformEditor not available to show editor');
                        }
                    } catch (error) {
                    console.error('ModalBlockEditor: Error opening Sync Editor (fallback):', error);
                }
                
            } catch (error) {
                console.error('ModalBlockEditor: Error in save callback:', error);
                alert('Ошибка при сохранении блоков: ' + error.message);
            } finally {
                // Прячем оверлей в любом случае
                this._hideLoadingOverlay();
            }
        }
        
        // Проверяем, есть ли маркеры синхронизации в блоках
        if (this._hasAnyBlockMarkers(editedBlocks)) {
            console.log('ModalBlockEditor: Blocks contain sync markers');
        } else {
            console.log('ModalBlockEditor: No sync markers found in blocks');
        }
    }

    _showLoadingOverlay(message) {
        if (!this.loadingOverlay) {
            this.loadingOverlay = document.createElement('div');
            this.loadingOverlay.className = 'modal-loading-overlay';
            
            const spinner = document.createElement('div');
            spinner.className = 'modal-spinner';
            
            this.loadingMessage = document.createElement('p');
            this.loadingMessage.className = 'modal-loading-message';
            
            this.loadingOverlay.appendChild(spinner);
            this.loadingOverlay.appendChild(this.loadingMessage);
            this.container.appendChild(this.loadingOverlay);
        }
        
        this.loadingMessage.textContent = message;
        this.loadingOverlay.style.display = 'flex';
        this.loadingOverlay.style.opacity = '1';
    }

    _hideLoadingOverlay() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                this.loadingOverlay.style.display = 'none';
            }, 300); // Соответствует времени transition в CSS
        }
    }

    _handleCancel() {
        if (this.onCancel) {
            this.onCancel();
        }
        // Восстанавливаем исходное состояние, если было
        try {
            if (this.initialSnapshot) {
                this._applySerialized(this.initialSnapshot);
            }
        } catch (_) {}
        this.historyStack = [];
        this.redoStack = [];
        this.initialSnapshot = null;
        this._updateUndoRedoButtons();
        this.hide();
    }

    _toggleEditMode() {
        if (!this.editModeToggleBtn) {return;} // Защита, если кнопка не найдена
        if (this.isDragging) {return;} // Не переключать режим во время перетаскивания

        this.isEditModeActive = !this.isEditModeActive;
        this.statusElement.textContent = this.isEditModeActive ? 'Режим редактирования текста активен.' : 'Режим выбора блоков.';
        
        const blocks = this.blockListArea.querySelectorAll('.text-block');
        blocks.forEach(block => {
            this._setBlockEditable(block, this.isEditModeActive);
        });

        if (!this.isEditModeActive) { 
            if (this.selectedBlock) {
                this.selectedBlock.classList.add('selected-block-highlight');
                // Если вышли из режима редактирования и был выбран блок, с него нужно снять contenteditable
                this._setBlockEditable(this.selectedBlock, false); 
            }
        } else { 
            if (this.selectedBlock) { 
                this.selectedBlock.classList.remove('selected-block-highlight');
                this._setBlockEditable(this.selectedBlock, true); 
            }
        }
        this._updateButtonStates();
    }

    _deleteSelectedBlockHandler() {
        if (!this.deleteSelectedBlockBtn) {return;} // Защита
        if (this.isDragging) {return;} // Не удалять во время перетаскивания

        if (this.selectedBlock && !this.isEditModeActive) {
            if (this.blockListArea.children.length > 1) {
                const blockToRemove = this.selectedBlock;
                this.selectedBlock = null; // Сначала сбрасываем selectedBlock
                blockToRemove.remove();
                // Попытаемся выбрать следующий блок или предыдущий, если удалили не последний
                const remainingBlocks = this.blockListArea.querySelectorAll('.text-block');
                if (remainingBlocks.length > 0) {
                    // Логика выбора следующего/предыдущего блока может быть добавлена здесь
                    // Пока просто сбрасываем выделение
                }
                this._pushSnapshot('delete-block');
            } else {
                this.statusElement.textContent = 'Нельзя удалить единственный текстовый блок.';
                setTimeout(() => { 
                    this.statusElement.textContent = this.isEditModeActive ? 'Режим редактирования текста активен.' : 'Режим выбора блоков.'; 
                }, 3000);
            }
        }
        this._updateButtonStates(); // Обновляем состояние кнопки в любом случае
    }

    _createBlockTypeSelector() {
        if (this.blockTypeSelector) {return;} // Создаем только один раз

        const selector = document.createElement('div');
        selector.id = 'block-type-selector';
        selector.classList.add('block-type-selector', 'hidden');

        const types = [
            { name: 'Куплет', type: 'verse', className: 'option-verse' },
            { name: 'Pre-chorus', type: 'prechorus', className: 'option-prechorus' }, // Перемещено
            { name: 'Припев', type: 'chorus', className: 'option-chorus' },
            { name: 'Intro', type: 'intro', className: 'option-intro' }, // Перемещено
            { name: 'Бридж', type: 'bridge', className: 'option-bridge' },
            { name: 'Outro', type: 'outro', className: 'option-outro' }, // Перемещено
            // { name: 'Пустой', type: 'blank', className: 'option-blank' }, // Удален blank
        ];

        types.forEach(item => {
            const button = document.createElement('button');
            button.classList.add('selector-option', item.className);
            button.textContent = item.name;
            button.setAttribute('data-block-type-value', item.type);
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем всплытие, чтобы не сработал клик на блоке
                if (this.activeBlockForSelector) {
                    this._setBlockType(this.activeBlockForSelector, item.type);
                }
                this._hideBlockTypeSelector(true); // Скрываем немедленно после клика
            });
            selector.appendChild(button);
        });

        this.container.appendChild(selector); // Добавляем в контейнер модального окна
        this.blockTypeSelector = selector;

        // Добавляем обработчики для самого селектора
        this.blockTypeSelector.addEventListener('mouseenter', () => {
            if (this.hideSelectorTimeout) {
                clearTimeout(this.hideSelectorTimeout);
                this.hideSelectorTimeout = null;
            }
        });

        this.blockTypeSelector.addEventListener('mouseleave', () => {
            if (this.hideSelectorTimeout) {clearTimeout(this.hideSelectorTimeout);} // На всякий случай
            this.hideSelectorTimeout = setTimeout(() => {
                this._hideBlockTypeSelector();
                // this.activeBlockForSelector = null; // Сбрасываем здесь, если мышь ушла с селектора
            }, 300);
        });
    }

    _showBlockTypeSelector(blockElement) {
        if (!this.blockTypeSelector) {this._createBlockTypeSelector();}
        
        if (this.hideSelectorTimeout) {
            clearTimeout(this.hideSelectorTimeout);
            this.hideSelectorTimeout = null;
        }

        // Если селектор уже показан для этого блока, ничего не делаем
        if (this.activeBlockForSelector === blockElement && !this.blockTypeSelector.classList.contains('hidden')) {
            return;
        }

        if (!blockElement || this.isEditModeActive || this.isDragging) {
            this._hideBlockTypeSelector();
            return;
        }

        this.activeBlockForSelector = blockElement;
        const blockRect = blockElement.getBoundingClientRect();
        const modalRect = this.container.getBoundingClientRect();
        const selectorStyle = this.blockTypeSelector.style;

        // Позиционируем селектор НАД блоком и ГОРИЗОНТАЛЬНО ПО ЦЕНТРУ блока
        const selectorWidth = this.blockTypeSelector.offsetWidth;
        const selectorHeight = this.blockTypeSelector.offsetHeight;

        // Новое позиционирование: справа от блока, выровнено по верху
        let newLeft = blockRect.right - modalRect.left + 5; // 5px отступ справа
        const newTop = blockRect.top - modalRect.top;

        // Проверка, не выходит ли селектор за правую границу модального окна
        if (newLeft + selectorWidth > modalRect.width - 10) { // -10 для небольшого запаса
            newLeft = blockRect.left - modalRect.left - selectorWidth - 5; // Ставим слева с отступом
        }

        selectorStyle.left = `${newLeft}px`;
        selectorStyle.top = `${newTop}px`;

        this.blockTypeSelector.classList.remove('hidden');
        this.blockTypeSelector.classList.add('visible'); // Для анимации
    }

    _hideBlockTypeSelector(forceHide = false) {
        if (this.blockTypeSelector) {
            if (forceHide) { // Если нужно скрыть немедленно (например, после клика)
                this.blockTypeSelector.classList.remove('visible');
                this.blockTypeSelector.classList.add('hidden');
                // this.activeBlockForSelector = null; // Сбрасываем здесь, так как скрыли принудительно
            } else {
                this.blockTypeSelector.classList.remove('visible'); // Для анимации
                // Скрываем с небольшой задержкой, чтобы успела отработать анимация
                // Можно также использовать событие transitionend, но для простоты пока так
                setTimeout(() => {
                    if (!this.blockTypeSelector.classList.contains('visible')) { // Доп. проверка, если его снова быстро показали
                        this.blockTypeSelector.classList.add('hidden');
                    }
                }, 200); // Должно совпадать с длительностью transition
            }
        }
        // Не сбрасываем activeBlockForSelector здесь сразу,
        // чтобы логика в _handleBlockMouseLeave и _handleSelectorMouseLeave работала корректно
    }

    _setBlockType(blockElement, type) {
        if (!blockElement) {return;}
        // Удаляем старые классы типов - ОБНОВЛЕНЫ ВСЕ ТИПЫ
        blockElement.classList.remove('block-type-verse', 'block-type-chorus', 'block-type-bridge', 'block-type-prechorus', 'block-type-intro', 'block-type-outro', 'block-type-blank');
        // Добавляем новый класс типа
        if (type && type !== 'none' && type !== 'default') { // Добавляем класс, только если тип валидный
            blockElement.classList.add(`block-type-${type}`);
        }
        blockElement.setAttribute('data-block-type', type);
        console.log(`Block type set to "${type}" for block:`, blockElement);
        this._pushSnapshot('set-type');
        // TODO: Добавить визуальное отображение (фон/надпись) на самом блоке
    }
    
    _handleBlockMouseEnter(event) {
        if (this.isDragging || this.isEditModeActive) {return;}
        const targetBlock = event.target.closest('.text-block');
        
        if (targetBlock) {
            if (this.hideSelectorTimeout) { // Если был таймаут на скрытие, отменяем его
                clearTimeout(this.hideSelectorTimeout);
                this.hideSelectorTimeout = null;
            }

            // Если мышь перешла с другого блока или с пустого места на этот блок
            if (this.activeBlockForSelector !== targetBlock) {
                // Если селектор был виден для другого блока, сначала его скроем (без анимации, если быстро)
                if (this.blockTypeSelector && !this.blockTypeSelector.classList.contains('hidden') && this.activeBlockForSelector) {
                     this._hideBlockTypeSelector(true); // Принудительно и быстро
                }
                this._showBlockTypeSelector(targetBlock);
            } else if (this.blockTypeSelector && this.blockTypeSelector.classList.contains('hidden')){
                 // Если селектор был для этого блока, но скрыт, снова показываем
                 this._showBlockTypeSelector(targetBlock);
            }
        }
    }

    _handleBlockMouseLeave(event) {
        const targetBlock = event.target.closest('.text-block');
        const relatedTarget = event.relatedTarget; // Куда ушел курсор

        // Если курсор покинул блок, для которого активен селектор
        if (targetBlock && this.activeBlockForSelector === targetBlock) {
            // И курсор НЕ перешел на сам селектор
            if (!relatedTarget || !this.blockTypeSelector || !this.blockTypeSelector.contains(relatedTarget)) {
                if (this.hideSelectorTimeout) {clearTimeout(this.hideSelectorTimeout);} // Отменяем предыдущий таймаут, если есть
                this.hideSelectorTimeout = setTimeout(() => {
                    // Финальная проверка перед скрытием: действительно ли мы все еще должны его скрыть?
                    // Может быть, пользователь уже навел курсор обратно на блок или на селектор.
                    // Проверяем, активен ли селектор для ЭТОГО блока
                    // и не находится ли курсор НАД селектором
                    const currentMouseOverElement = document.elementFromPoint(event.clientX, event.clientY);
                    if (this.activeBlockForSelector === targetBlock && 
                        (!this.blockTypeSelector || !this.blockTypeSelector.contains(currentMouseOverElement))) {
                            this._hideBlockTypeSelector();
                            this.activeBlockForSelector = null; 
                        }
                }, 300); // Задержка перед скрытием
            }
        }
    }

    _handleDocumentMouseMove(event) { // Новый обработчик для отслеживания мыши вне блоков
        // Пока оставляем эту функцию, но ее роль может измениться или она может быть удалена,
        // если _handleBlockMouseLeave и обработчики селектора справятся.
        // Основная идея - если селектор видим, но мышь ушла далеко и от блока, и от селектора, то скрыть.
        if (this.activeBlockForSelector && this.blockTypeSelector && !this.blockTypeSelector.classList.contains('hidden')) {
            const hoveredElement = event.target;
            
            const isOverBlock = this.activeBlockForSelector.contains(hoveredElement) || hoveredElement === this.activeBlockForSelector;
            const isOverSelector = this.blockTypeSelector.contains(hoveredElement) || hoveredElement === this.blockTypeSelector;

            if (!isOverBlock && !isOverSelector) {
                // Если курсор не над блоком и не над селектором,
                // и не активен таймаут (чтобы не конфликтовать с более точной логикой mouseleave)
                // Эта проверка может быть избыточной, если mouseleave срабатывает корректно.
                // if (!this.hideSelectorTimeout) {
                //     this._hideBlockTypeSelector();
                //     this.activeBlockForSelector = null;
                // }
            }
        }
    }

    // Добавляем отсутствующий метод для проверки маркеров
    _hasAnyBlockMarkers(blocks) {
        // Проверяем, есть ли в блоках временные маркеры синхронизации
        // Пока возвращаем false, так как блоки только что созданы и не содержат маркеров
        return false;
    }

    // ==== История/Снапшоты ====
    _serialize() {
        const blocks = Array.from(this.blockListArea.querySelectorAll('.text-block')).map(el => ({
            content: el.innerText,
            type: el.getAttribute('data-block-type') || 'verse'
        }));
        return JSON.stringify(blocks);
    }

    _applySerialized(serialized) {
        const blocks = JSON.parse(serialized);
        this.isRestoring = true;
        try {
            this.blockListArea.innerHTML = '';
            blocks.forEach(b => this._createAndSetupBlock(b.content, undefined, b.type));
        } finally {
            this.isRestoring = false;
        }
        this._updateButtonStates();
    }

    _pushSnapshot(reason = '') {
        if (this.isRestoring) {return;} // не писать историю во время восстановления
        const snap = this._serialize();
        if (this.historyStack.length === 0 || this.historyStack[this.historyStack.length - 1] !== snap) {
            this.historyStack.push(snap);
            if (this.historyStack.length > this.maxHistory) {this.historyStack.shift();}
            this.redoStack = [];
            // console.debug('Undo snapshot saved:', reason);
            this._updateUndoRedoButtons();
        }
    }

    undo() {
        if (this.historyStack.length < 2) {return;} // нужен хотя бы один предыдущий снапшот
        const current = this.historyStack.pop();
        this.redoStack.push(current);
        const prev = this.historyStack[this.historyStack.length - 1];
        this._applySerialized(prev);
        this._updateUndoRedoButtons();
        this.statusElement.textContent = '↶ Отменено действие';
        setTimeout(() => this.statusElement.textContent = this.isEditModeActive ? 'Режим редактирования текста активен.' : 'Режим выбора блоков.', 1200);
    }

    redo() {
        if (this.redoStack.length === 0) {return;}
        const snap = this.redoStack.pop();
        this.historyStack.push(snap);
        this._applySerialized(snap);
        this._updateUndoRedoButtons();
        this.statusElement.textContent = '↷ Повтор действия';
        setTimeout(() => this.statusElement.textContent = this.isEditModeActive ? 'Режим редактирования текста активен.' : 'Режим выбора блоков.', 1200);
    }

    _updateUndoRedoButtons() {
        const canUndo = this.historyStack.length > 1;
        const canRedo = this.redoStack.length > 0;
        if (this.undoBtn) {this.undoBtn.disabled = !canUndo;}
        if (this.redoBtn) {this.redoBtn.disabled = !canRedo;}
    }
}

// Экспорт в глобальную область видимости для использования в WaveformEditor
window.ModalBlockEditor = ModalBlockEditor;

// Глобальный экземпляр для доступа из других модулей
// window.modalBlockEditor = new ModalBlockEditor(); 
// Инициализация будет происходить при необходимости, а не при загрузке скрипта 