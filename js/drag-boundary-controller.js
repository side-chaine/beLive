/**
 * Контроллер для управления границами лупа через перетаскивание красных линий
 * Интуитивное управление границами без handles
 */
class DragBoundaryController {
    constructor(blockLoopControl, lyricsDisplay) {
        this.blockLoopControl = blockLoopControl;
        this.lyricsDisplay = lyricsDisplay;
        
        // Состояние drag системы
        this.isActive = false;
        this.currentBlock = null;
        this.blockElement = null;
        
        // Границы лупа
        this.startBoundary = null;
        this.endBoundary = null;
        
        // DOM элементы границ
        this.startLine = null;
        this.endLine = null;
        this.ghostLine = null; // Призрачная линия предпоказа
        
        // Состояние drag операции
        this.dragState = {
            isDragging: false,
            draggedLine: null, // 'start' или 'end'
            startY: 0,
            originalBoundary: null,
            currentPreviewLine: null // Текущая строка предпоказа
        };
        
        console.log('[DragBoundary] Инициализирован с интерактивными линиями и предпоказом');
    }
    
    /**
     * Активирует контроллер для блока
     * @param {Object} block - блок текста
     * @param {Element} blockElement - DOM элемент блока
     * @param {Object} initialBoundaries - начальные границы (опционально)
     */
    activate(block, blockElement, initialBoundaries, options = {}) {
        this.mode = options.mode || 'both';
        this.currentBlockId = block?.id || null;
        console.log(`✅ DragBoundaryController activated for block: ${block.name}`);
        console.log(`📊 Block line indices: [${block.lineIndices.join(',')}]`);
        console.log(`🎯 Initial boundaries received:`, initialBoundaries);
        
        // ДОБАВЛЕНО: Валидация и принудительная сортировка границ
        if (initialBoundaries && (initialBoundaries.start !== undefined && initialBoundaries.end !== undefined)) {
            // Проверяем корректность границ
            if (initialBoundaries.start > initialBoundaries.end) {
                console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Инвертированные границы! start=${initialBoundaries.start} > end=${initialBoundaries.end}`);
                console.log(`🔧 Автоматическое исправление: меняем местами границы`);
                // Меняем местами инвертированные границы
                const correctedBoundaries = {
                    start: initialBoundaries.end,
                    end: initialBoundaries.start
                };
                this.currentBoundaries = correctedBoundaries;
                console.log(`✅ Исправленные границы:`, correctedBoundaries);
            } else {
                this.currentBoundaries = initialBoundaries;
            }
            
            // Проверяем, что границы существуют в блоке
            const startExists = block.lineIndices.includes(this.currentBoundaries.start);
            const endExists = block.lineIndices.includes(this.currentBoundaries.end);
            
            if (!startExists) {
                console.error(`❌ Start boundary ${this.currentBoundaries.start} not found in block line indices`);
            }
            if (!endExists) {
                console.error(`❌ End boundary ${this.currentBoundaries.end} not found in block line indices`);
            }
            
            if (startExists && endExists) {
                console.log(`✅ Applied boundaries: start=${this.currentBoundaries.start}, end=${this.currentBoundaries.end}`);
            }
        } else {
            // Устанавливаем границы по умолчанию - ВСЕГДА используем первый и последний индекс
            const sortedIndices = [...block.lineIndices].sort((a, b) => a - b);
            this.currentBoundaries = {
                start: sortedIndices[0],
                end: sortedIndices[sortedIndices.length - 1]
            };
            console.log(`✅ Set default boundaries from sorted indices: start=${this.currentBoundaries.start}, end=${this.currentBoundaries.end}`);
        }
        
        this.currentBlock = block;
        this.blockElement = blockElement;
        this.isActive = true;
        
        // Устанавливаем начальные границы
        this.startBoundary = this.currentBoundaries.start;
        this.endBoundary = this.currentBoundaries.end;
        console.log('[DragBoundary] ✅ Применены переданные границы:', this.currentBoundaries);
        
        // Проверяем корректность границ
        if (!block.lineIndices.includes(this.startBoundary)) {
            console.error(`[DragBoundary] ❌ ОШИБКА: startBoundary ${this.startBoundary} не найден в блоке ${block.lineIndices}`);
        }
        
        if (!block.lineIndices.includes(this.endBoundary)) {
            console.error(`[DragBoundary] ❌ ОШИБКА: endBoundary ${this.endBoundary} не найден в блоке ${block.lineIndices}`);
        }
        
        // Если уже активны линии для этого же блока и DOM, не пересоздаём — обновим режим и выходим
        if (this.isActive && this._activeBlockElement === blockElement && this._activeBlockId === this.currentBlockId) {
            this._setDisabledByMode();
            console.log('[DragBoundary] 🔁 Reusing existing lines for same block, only mode updated');
            return;
        }

        this._activeBlockElement = blockElement;
        this._activeBlockId = this.currentBlockId;

        this._createBoundaryLines();
        this._setDisabledByMode();
        
        // Обновляем визуальные состояния
        this._updateVisualStates();
        
        console.log('[DragBoundary] ✅ Контроллер активирован');
    }
    
    /**
     * Деактивирует контроллер
     */
    deactivate() {
        if (!this.isActive) return;
        
        console.log('[DragBoundary] Деактивация');
        
        // Очищаем drag операцию
        this._cleanupDragOperation();
        
        // Убираем призрачную линию
        this._hideGhostPreview();
        
        // Удаляем линии границ
        this._removeBoundaryLines();
        
        // Сбрасываем состояние
        this.isActive = false;
        this.currentBlock = null;
        this.blockElement = null;
        this.startBoundary = null;
        this.endBoundary = null;
        
        console.log('[DragBoundary] Деактивирован');
    }
    
    /**
     * Создает интерактивные линии границ
     */
    _createBoundaryLines() {
        console.log(`[DragBoundary] 🎯 Создание интерактивных линий границ`);
        console.log(`[DragBoundary] 📍 Блок: ${this.currentBlock?.name}, границы: ${this.startBoundary}-${this.endBoundary}`);
        
        // Удаляем старые линии
        this._removeBoundaryLines();
        
        // Находим все строки в блоке
        const allLines = this.blockElement.querySelectorAll('.rehearsal-active-line');
        console.log(`[DragBoundary] 📋 Найдено строк в блоке: ${allLines.length}`);
        
        // Диагностика всех найденных строк
        allLines.forEach((line, idx) => {
            const dataIndex = line.dataset.index;
            const text = line.textContent.trim().substring(0, 30);
            console.log(`[DragBoundary] 📝 Строка ${idx}: data-index="${dataIndex}", текст: "${text}"`);
        });
        
        // Ищем конкретные строки для границ
        const startLineElement = this.blockElement.querySelector(`[data-index="${this.startBoundary}"]`);
        const endLineElement = this.blockElement.querySelector(`[data-index="${this.endBoundary}"]`);
        
        console.log(`[DragBoundary] 🎯 Поиск startLine (index ${this.startBoundary}):`, startLineElement ? '✅ найден' : '❌ НЕ НАЙДЕН');
        if (startLineElement) {
            console.log(`[DragBoundary] 📝 StartLine текст: "${startLineElement.textContent.trim().substring(0, 50)}"`);
            console.log(`[DragBoundary] 📐 StartLine rect:`, startLineElement.getBoundingClientRect());
        }
        
        console.log(`[DragBoundary] 🎯 Поиск endLine (index ${this.endBoundary}):`, endLineElement ? '✅ найден' : '❌ НЕ НАЙДЕН');
        if (endLineElement) {
            console.log(`[DragBoundary] 📝 EndLine текст: "${endLineElement.textContent.trim().substring(0, 50)}"`);
            console.log(`[DragBoundary] 📐 EndLine rect:`, endLineElement.getBoundingClientRect());
        }
        
        // Создаем линии только если нашли элементы
        if (startLineElement) {
            this.startLine = this._createInteractiveLine('start');
            startLineElement.style.position = 'relative';
            startLineElement.appendChild(this.startLine);
            console.log(`[DragBoundary] ✅ Создана стартовая линия для строки ${this.startBoundary}`);
        } else {
            console.error(`[DragBoundary] ❌ Не найден элемент для стартовой границы: ${this.startBoundary}`);
        }
        
        if (endLineElement) {
            this.endLine = this._createInteractiveLine('end');
            endLineElement.style.position = 'relative';
            endLineElement.appendChild(this.endLine);
            console.log(`[DragBoundary] ✅ Создана конечная линия для строки ${this.endBoundary}`);
        } else {
            console.error(`[DragBoundary] ❌ Не найден элемент для конечной границы: ${this.endBoundary}`);
        }
        
        // Финальная проверка созданных линий
        if (this.startLine && this.endLine) {
            console.log(`[DragBoundary] ✅ Обе линии успешно созданы`);
            
            // Проверяем их позиции
            const startRect = this.startLine.getBoundingClientRect();
            const endRect = this.endLine.getBoundingClientRect();
            
            console.log(`[DragBoundary] 📐 StartLine позиция: top=${startRect.top}, bottom=${startRect.bottom}`);
            console.log(`[DragBoundary] 📐 EndLine позиция: top=${endRect.top}, bottom=${endRect.bottom}`);
            
            if (startRect.top > endRect.top) {
                console.error(`[DragBoundary] ⚠️ ПРОБЛЕМА: StartLine (${startRect.top}) находится НИЖЕ EndLine (${endRect.top})!`);
            }
        } else {
            console.error(`[DragBoundary] ❌ Не удалось создать линии: start=${!!this.startLine}, end=${!!this.endLine}`);
        }
    }
    
    /**
     * Создает интерактивную линию границы
     */
    _createInteractiveLine(type) {
        const line = document.createElement('div');
        line.className = `loop-boundary-line loop-${type}-line`;
        line.dataset.boundaryType = type;
        
        // Добавляем обработчики событий
        line.addEventListener('mousedown', (e) => this._onLineMouseDown(e, type));
        line.addEventListener('touchstart', (e) => this._onLineMouseDown(e, type), { passive: false });
        
        return line;
    }
    
    /**
     * Обработчик начала перетаскивания линии
     */
    _onLineMouseDown(e, boundaryType) {
        if (!this.isActive) return;
        // Игнор кликов по заблокированной линии
        if (this.mode === 'start-only' && boundaryType === 'end') return;
        if (this.mode === 'end-only' && boundaryType === 'start') return;
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`[DragBoundary] Начато перетаскивание ${boundaryType} линии`);
        
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        this.dragState.isDragging = true;
        this.dragState.draggedLine = boundaryType;
        this.dragState.startY = clientY;
        this.dragState.originalBoundary = boundaryType === 'start' ? this.startBoundary : this.endBoundary;
        
        // Добавляем класс для визуального feedback
        const line = boundaryType === 'start' ? this.startLine : this.endLine;
        if (line) {
            line.classList.add('dragging');
        }
        
        // Добавляем глобальные обработчики
        document.addEventListener('mousemove', this._onDragMove);
        document.addEventListener('mouseup', this._onDragEnd);
        document.addEventListener('touchmove', this._onDragMove, { passive: false });
        document.addEventListener('touchend', this._onDragEnd);
        
        console.log(`[DragBoundary] Drag начат для ${boundaryType} границы`);
    }
    
    /**
     * Обработчик движения во время drag
     */
    _onDragMove = (e) => {
        if (!this.dragState.isDragging) return;
        
        e.preventDefault();
        
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        // Находим ближайшую строку для магнитного примагничивания
        const targetLineIndex = this._findNearestLine(clientY);
        
        if (targetLineIndex !== null) {
            // Проверяем валидность перемещения
            if (this._isValidBoundaryMove(targetLineIndex)) {
                // Показываем призрачную линию предпоказа
                this._showGhostPreview(targetLineIndex);
                this._updateDragPreview(targetLineIndex);
            } else {
                // Убираем призрачную линию если перемещение невалидно
                this._hideGhostPreview();
            }
        }
    }
    
    /**
     * Обработчик окончания drag
     */
    _onDragEnd = (e) => {
        if (!this.dragState.isDragging) return;
        
        console.log('[DragBoundary] Окончание перетаскивания');
        
        const clientY = e.type.includes('touch') ? e.changedTouches[0].clientY : e.clientY;
        const targetLineIndex = this._findNearestLine(clientY);
        
        if (targetLineIndex !== null && this._isValidBoundaryMove(targetLineIndex)) {
            this._applyBoundaryChange(targetLineIndex);
        }
        
        // Убираем призрачную линию
        this._hideGhostPreview();
        
        this._cleanupDragOperation();
        console.log('[DragBoundary] Перетаскивание завершено');
    }
    
    /**
     * Находит ближайшую строку к курсору
     */
    _findNearestLine(clientY) {
        let closestLineIndex = null;
        let closestDistance = Infinity;
        
        const lines = this.blockElement.querySelectorAll('.rehearsal-active-line');
        
        for (const line of lines) {
            const rect = line.getBoundingClientRect();
            const lineCenterY = rect.top + rect.height / 2;
            const distance = Math.abs(clientY - lineCenterY);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestLineIndex = parseInt(line.dataset.index);
            }
        }
        
        return closestLineIndex;
    }
    
    /**
     * Проверяет валидность перемещения границы
     */
    _isValidBoundaryMove(targetLineIndex) {
        if (this.dragState.draggedLine === 'start') {
            return targetLineIndex <= this.endBoundary;
        } else {
            return targetLineIndex >= this.startBoundary;
        }
    }
    
    /**
     * Обновляет предпросмотр во время drag
     */
    _updateDragPreview(targetLineIndex) {
        // Временно обновляем границы для предпросмотра
        const tempStart = this.dragState.draggedLine === 'start' ? targetLineIndex : this.startBoundary;
        const tempEnd = this.dragState.draggedLine === 'end' ? targetLineIndex : this.endBoundary;
        
        this._updateVisualStates(tempStart, tempEnd);
    }
    
    /**
     * Применяет изменение границы
     */
    _applyBoundaryChange(targetLineIndex) {
        console.log(`[DragBoundary] Применение изменения: ${this.dragState.draggedLine} -> ${targetLineIndex}`);
        
        if (this.dragState.draggedLine === 'start') {
            this.startBoundary = targetLineIndex;
        } else {
            this.endBoundary = targetLineIndex;
        }
        
        // Пересоздаем линии границ
        this._createBoundaryLines();
        
        // Обновляем визуальные состояния
        this._updateVisualStates();
        
        // Уведомляем BlockLoopControl
        this._notifyBoundaryChange();
        
        console.log(`[DragBoundary] Новые границы: ${this.startBoundary}-${this.endBoundary}`);
    }
    
    /**
     * Очищает состояние drag операции
     */
    _cleanupDragOperation() {
        // Убираем призрачную линию
        this._hideGhostPreview();
        
        // Убираем классы
        if (this.startLine) this.startLine.classList.remove('dragging');
        if (this.endLine) this.endLine.classList.remove('dragging');
        
        // Убираем event listeners
        document.removeEventListener('mousemove', this._onDragMove);
        document.removeEventListener('mouseup', this._onDragEnd);
        document.removeEventListener('touchmove', this._onDragMove);
        document.removeEventListener('touchend', this._onDragEnd);
        
        // Сбрасываем состояние
        this.dragState.isDragging = false;
        this.dragState.draggedLine = null;
        this.dragState.startY = 0;
        this.dragState.originalBoundary = null;
        this.dragState.currentPreviewLine = null;
    }
    
    /**
     * Обновляет визуальные состояния строк
     */
    _updateVisualStates(tempStart = null, tempEnd = null) {
        if (!this.isActive) return;

        const actualStart = tempStart !== null ? tempStart : this.startBoundary;
        const actualEnd = tempEnd !== null ? tempEnd : this.endBoundary;

        console.log(`[DragBoundary] Обновлены визуальные состояния. Диапазон: ${actualStart}-${actualEnd}`);

        // Убираем все визуальные классы - оставляем чистый фон
        const allLines = document.querySelectorAll('.rehearsal-line');
        allLines.forEach((line, index) => {
            line.classList.remove('drag-boundary-line', 'inside', 'outside', 'start', 'end');
        });

        // Не добавляем никаких визуальных индикаторов - только функциональность остается
    }
    
    /**
     * Удаляет линии границ
     */
    _removeBoundaryLines() {
        if (this.startLine && this.startLine.parentNode) {
            this.startLine.parentNode.removeChild(this.startLine);
        }
        if (this.endLine && this.endLine.parentNode) {
            this.endLine.parentNode.removeChild(this.endLine);
        }
        
        this.startLine = null;
        this.endLine = null;
        
        // Также удаляем все старые линии если они есть
        if (this.blockElement) {
            const oldLines = this.blockElement.querySelectorAll('.loop-boundary-line');
            oldLines.forEach(line => line.remove());
        }
    }
    
    /**
     * Уведомляет BlockLoopControl об изменении границ
     */
    _notifyBoundaryChange() {
        if (this.blockLoopControl && typeof this.blockLoopControl.onBoundaryChange === 'function') {
            console.log('[DragBoundary] Уведомляем BlockLoopControl об изменении границ');
            this.blockLoopControl.onBoundaryChange({
                startBoundary: this.startBoundary,
                endBoundary: this.endBoundary
            });
        }
    }
    
    /**
     * Устанавливает новые границы лупа
     */
    setBoundaries(startBoundary, endBoundary) {
        console.log(`[DragBoundary] Установка границ: ${startBoundary} - ${endBoundary}`);
        
        this.startBoundary = startBoundary;
        this.endBoundary = endBoundary;
        
        // Пересоздаем линии
        this._createBoundaryLines();
        
        // Обновляем визуальные состояния
        this._updateVisualStates();
    }
    
    /**
     * Получает текущие границы
     */
    getBoundaries() {
        return {
            startBoundary: this.startBoundary,
            endBoundary: this.endBoundary
        };
    }
    
    /**
     * Показывает призрачную линию предпоказа
     */
    _showGhostPreview(targetLineIndex) {
        // Если уже показываем предпоказ для этой строки, ничего не делаем
        if (this.dragState.currentPreviewLine === targetLineIndex) return;
        
        // Убираем старую призрачную линию
        this._hideGhostPreview();
        
        // Находим целевую строку
        const targetLine = this.blockElement.querySelector(`[data-index="${targetLineIndex}"]`);
        if (!targetLine) return;
        
        // Создаем призрачную линию
        this.ghostLine = document.createElement('div');
        this.ghostLine.className = `loop-boundary-ghost loop-ghost-${this.dragState.draggedLine}`;
        
        // Добавляем к целевой строке
        targetLine.style.position = 'relative';
        targetLine.appendChild(this.ghostLine);
        
        // Запоминаем текущую строку предпоказа
        this.dragState.currentPreviewLine = targetLineIndex;
        
        console.log(`[DragBoundary] Показан призрачный предпоказ для строки ${targetLineIndex}`);
    }
    
    /**
     * Скрывает призрачную линию предпоказа
     */
    _hideGhostPreview() {
        if (this.ghostLine && this.ghostLine.parentNode) {
            this.ghostLine.parentNode.removeChild(this.ghostLine);
        }
        this.ghostLine = null;
        this.dragState.currentPreviewLine = null;
    }

    setMode(mode) {
        this.mode = mode || 'both';
        this._setDisabledByMode();
    }

    _setDisabledByMode() {
        if (!this.startLine || !this.endLine) return;
        this.startLine.classList.remove('disabled');
        this.endLine.classList.remove('disabled');
        if (this.mode === 'start-only') {
            this.endLine.classList.add('disabled');
        } else if (this.mode === 'end-only') {
            this.startLine.classList.add('disabled');
        }
    }
} 