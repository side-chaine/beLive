/**
 * Marker Manager for Text application
 * Central component for managing lyrics timing markers
 */

class MarkerManager {
    constructor(audioEngine, lyricsDisplay) {
        // Store references to required components
        this.audioEngine = audioEngine;
        this.lyricsDisplay = lyricsDisplay;
        
        // Initialize markers array
        this.markers = [];
        
        // Initialize update interval
        this.updateInterval = null;
        
        // Subscribers for marker changes
        this.subscribers = {
            markerAdded: [],
            markerUpdated: [],
            markerDeleted: [],
            markersReset: []
        };
        
        // Initialize event listeners
        this._initEventListeners();
        
        // Start UI update loop
        this._startUpdateLoop();
        
        console.log('MarkerManager initialized');
    }
    
    /**
     * Initialize internal event listeners
     * @private
     */
    _initEventListeners() {
        // Listen for track changes to update markers
        document.addEventListener('track-loaded', (event) => {
            if (event.detail && event.detail.markers) {
                this.setMarkers(event.detail.markers);
            } else {
                this.resetMarkers();
            }
        });
        
        // Listen for keyboard events to add markers during playback
        document.addEventListener('keydown', (event) => {
            // Skip if typing in an input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            
            console.log(`Key pressed: ${event.key}, key code: ${event.keyCode}, waveform active: ${document.body.classList.contains('waveform-active')}`);
            
            // Key '1' to add marker at current time for the active line
            if (event.key === '1' || event.keyCode === 49) {
                console.log('Key "1" pressed - attempting to add marker');
                
                // Проверяем наличие активной строки даже если waveform не активен
                const activeLine = document.querySelector('.lyric-line.active');
                if (activeLine) {
                    console.log('Active line found, adding marker');
                this._addMarkerForActiveLine();
                } else {
                    console.warn('No active lyric line found when pressing "1"');
                }
            }
        });
    }
    
    /**
     * Add marker for the currently active lyric line
     * @private
     */
    _addMarkerForActiveLine() {
        console.log('_addMarkerForActiveLine called');
        
        // Проверяем состояние аудио
        if (!this.audioEngine) {
            console.error('Audio engine not available');
            return;
        }
        
        // Получаем текущее время и статус аудио напрямую
        const currentTime = this.audioEngine.getCurrentTime();
        const isPlaying = this.audioEngine.isPlaying; // Используем геттер вместо прямого обращения
        
        console.log(`Current time: ${currentTime}s, Audio is playing: ${isPlaying}`);
        
        // Убираем проверку на воспроизведение, чтобы маркеры можно было ставить и на паузе
        
        // Находим активную строку
        const activeLine = document.querySelector('.lyric-line.active');
        console.log(`[MARKER] Looking for active line. Found:`, activeLine);
        
        if (!activeLine) {
            console.warn('No active lyric line found when pressing "1"');
            
            // Дополнительная отладка - проверим все строки
            const allLines = document.querySelectorAll('.lyric-line');
            console.log(`[MARKER] Total lyric lines found: ${allLines.length}`);
            allLines.forEach((line, index) => {
                console.log(`[MARKER] Line ${index}: classes="${line.className}", text="${line.textContent.substring(0, 30)}..."`);
            });
            
            return;
        }
        
        const lineIndex = parseInt(activeLine.dataset.index, 10);
        if (isNaN(lineIndex)) {
            console.error('Invalid line index in active line');
            return;
        }
        
        console.log(`Found active line with index: ${lineIndex}`);
        
        // Проверяем, есть ли уже маркер для этой строки
        const existingMarker = this.getMarkerForLine(lineIndex);
        
        if (existingMarker) {
            console.log(`Line ${lineIndex} already has a marker at ${existingMarker.time}s`);
            // Если строка уже имеет маркер, находим следующую строку без маркера
            let nextLine = lineIndex + 1;
            while (nextLine < this.lyricsDisplay.lyrics.length) {
                if (!this.getMarkerForLine(nextLine)) {
                    // Нашли немаркированную строку, добавляем маркер для неё
                    console.log(`Adding marker for next unmarked line: ${nextLine}`);
                    this.addMarker(nextLine, currentTime);
                    this._activateNextLine(nextLine);
                    return;
                }
                nextLine++;
            }
            
            // Если дошли до этой точки, все последующие строки уже имеют маркеры
            console.log('All lines already have markers');
        } else {
            console.log(`Adding new marker for line ${lineIndex} at ${currentTime}s`);
            // Добавляем маркер для текущей активной строки
            this.addMarker(lineIndex, currentTime);
            
            // Активируем следующую строку
            this._activateNextLine(lineIndex + 1);
        }
    }
    
    /**
     * Activate the next line for easier sequential marking
     * @param {number} lineIndex - Index of the line to activate
     * @private
     */
    _activateNextLine(lineIndex) {
        // Make sure the line index is valid
        if (lineIndex < 0 || lineIndex >= this.lyricsDisplay.lyrics.length) {return;}
        
        // Tell the lyrics display to activate this line
        this.lyricsDisplay.setActiveLine(lineIndex);
    }
    
    /**
     * Add a new marker
     * @param {number} lineIndex - The lyrics line index
     * @param {number} time - The time in seconds
     * @returns {Object} The created marker object
     */
    addMarker(lineIndex, time) {
        // Validate inputs
        if (lineIndex < 0 || lineIndex >= this.lyricsDisplay.lyrics.length) {
            console.error('Invalid line index:', lineIndex);
            return null;
        }
        
        if (time === undefined || time === null) {
            time = this.audioEngine.getCurrentTime();
        }
        
        // Определяем тип блока для строки и соответствующий цвет
        const blockType = this._getBlockTypeForLine(lineIndex);
        // Цвет назначаем только для известных типов, иначе оставляем undefined
        const markerColor = (blockType && blockType !== 'unknown')
            ? this._getColorForBlockType(blockType)
            : undefined;
        
        // Create marker object
        const marker = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            lineIndex,
            time,
            text: this.lyricsDisplay.lyrics[lineIndex],
            blockType: blockType,
            color: markerColor
        };
        
        console.log(`Creating marker for line ${lineIndex}: type=${blockType}, color=${markerColor}`);
        
        // Check if a marker already exists for this line
        const existingIndex = this.markers.findIndex(m => m.lineIndex === lineIndex);
        
        if (existingIndex >= 0) {
            // Update existing marker
            this.markers[existingIndex] = marker;
            this._notifySubscribers('markerUpdated', marker);
        } else {
            // Add new marker
            this.markers.push(marker);
            
            // Sort markers by time
            this.markers.sort((a, b) => a.time - b.time);
            
            this._notifySubscribers('markerAdded', marker);
        }
        
        // Update UI to highlight lines with markers
        this._updateLineMarkersUI();
        
        return marker;
    }
    
    /**
     * Определяет тип блока для указанной строки лирики
     * @param {number} lineIndex - Индекс строки
     * @returns {string} - Тип блока ('verse', 'chorus', 'bridge', 'unknown')
     * @private
     */
    _getBlockTypeForLine(lineIndex) {
        // Проверяем, есть ли у LyricsDisplay загруженные блоки
        if (!this.lyricsDisplay || !this.lyricsDisplay.textBlocks || this.lyricsDisplay.textBlocks.length === 0) {
            return 'unknown';
        }
        
        // Ищем блок, содержащий данную строку
        for (const block of this.lyricsDisplay.textBlocks) {
            if (block.lineIndices && block.lineIndices.includes(lineIndex)) {
                // Разрешённые типы
                const allowed = new Set(['verse','chorus','bridge']);
                if (block.type && allowed.has(block.type)) {return block.type;}
                return 'unknown';
            }
        }
        
        return 'unknown';
    }
    
    /**
     * Возвращает цвет маркера для указанного типа блока
     * @param {string} blockType - Тип блока
     * @returns {string} - Цвет в формате hex
     * @private
     */
    _getColorForBlockType(blockType) {
        const colorMap = {
            'verse': '#4CAF50',     // Зеленый для куплетов
            'chorus': '#F44336',    // Красный для припевов
            'bridge': '#6f42c1',    // Фиолетовый для бриджей
        };
        
        return colorMap[blockType]; // Без дефолта, чтобы не ломать соответствие
    }
    
    /**
     * Update an existing marker
     * @param {string} markerId - The ID of the marker to update
     * @param {Object} updates - The properties to update
     * @returns {Object} The updated marker
     */
    updateMarker(markerId, updates) {
        const index = this.markers.findIndex(marker => marker.id === markerId);
        
        if (index === -1) {
            console.error('Marker not found:', markerId);
            return null;
        }
        
        // Update marker with new properties
        this.markers[index] = {
            ...this.markers[index],
            ...updates
        };
        
        // If time was updated, re-sort markers
        if (updates.time !== undefined) {
            this.markers.sort((a, b) => a.time - b.time);
        }
        
        this._notifySubscribers('markerUpdated', this.markers[index]);
        
        // Пересчитываем цвета в привязке к блокам и обновляем UI
        this.updateMarkerColors();
        
        return this.markers[index];
    }
    
    /**
     * Delete a marker
     * @param {string} markerId - The ID of the marker to delete
     * @returns {boolean} Success status
     */
    deleteMarker(markerId) {
        const index = this.markers.findIndex(marker => marker.id === markerId);
        
        if (index === -1) {
            console.error('Marker not found:', markerId);
            return false;
        }
        
        const deletedMarker = this.markers[index];
        this.markers.splice(index, 1);
        
        this._notifySubscribers('markerDeleted', deletedMarker);
        
        // Update UI to highlight lines with markers
        this._updateLineMarkersUI();
        
        return true;
    }
    
    /**
     * Delete marker by line index
     * @param {number} lineIndex - The line index to delete marker for
     * @returns {boolean} Success status
     */
    deleteMarkerByLine(lineIndex) {
        const index = this.markers.findIndex(marker => marker.lineIndex === lineIndex);
        
        if (index === -1) {
            return false;
        }
        
        return this.deleteMarker(this.markers[index].id);
    }
    
    /**
     * Get all markers
     * @returns {Array} Array of all markers
     */
    getMarkers() {
        return [...this.markers];
    }
    
    /**
     * Set all markers (replacing existing ones)
     * @param {Array} markers - Array of marker objects
     */
    setMarkers(markers) {
        // Validate markers
        if (!Array.isArray(markers)) {
            console.error('Invalid markers array');
            return;
        }
        
        // Создаем временный массив для обработанных маркеров
        let validMarkers = [];
        const usedLineIndexes = new Set();
        const totalLyricLines = this.lyricsDisplay ? this.lyricsDisplay.lyrics.length : 0;
        
        console.log(`Validating ${markers.length} markers for ${totalLyricLines} lyric lines`);
        
        // Фильтруем только валидные маркеры
        markers.forEach(marker => {
            // Проверяем, что маркер имеет правильный формат и корректный lineIndex
            if (marker && typeof marker.lineIndex === 'number' && 
                marker.lineIndex >= 0 && marker.lineIndex < totalLyricLines) {
                
                // Проверяем, нет ли уже маркера для этой строки
                if (!usedLineIndexes.has(marker.lineIndex)) {
                    usedLineIndexes.add(marker.lineIndex);
                    
                    // Обновляем цвет и тип блока для загружаемого маркера
                    const updatedMarker = { ...marker };
                    if (!updatedMarker.blockType) {
                        updatedMarker.blockType = this._getBlockTypeForLine(marker.lineIndex);
                    }
                    if (!updatedMarker.color) {
                        const typeForColor = updatedMarker.blockType && updatedMarker.blockType !== 'unknown'
                            ? updatedMarker.blockType
                            : this._getBlockTypeForLine(marker.lineIndex);
                        updatedMarker.color = this._getColorForBlockType(typeForColor);
                    }
                    
                    validMarkers.push(updatedMarker);
                } else {
                    console.log(`Ignoring duplicate marker for line ${marker.lineIndex}`);
                }
            } else {
                console.log(`Ignoring invalid marker: ${JSON.stringify(marker)}`);
            }
        });
        
        console.log(`Kept ${validMarkers.length} valid markers out of ${markers.length}`);
        
        this.markers = validMarkers;
        
        // Ensure markers are sorted by time
        this.markers.sort((a, b) => a.time - b.time);
        
        // Если блоки ещё не загружены, но в маркерах есть типы — синтезируем textBlocks из маркеров
        try {
            const hasBlocks = !!(this.lyricsDisplay && Array.isArray(this.lyricsDisplay.textBlocks) && this.lyricsDisplay.textBlocks.length > 0);
            const hasTypedMarkers = this.markers.some(m => m.blockType && m.blockType !== 'unknown');
            if (!hasBlocks && this.lyricsDisplay && hasTypedMarkers) {
                const synthesized = this._buildBlocksFromMarkers(this.markers);
                if (synthesized.length > 0) {
                    this.lyricsDisplay.textBlocks = synthesized;
                    if (typeof this.lyricsDisplay.updateDefinedBlocksDisplay === 'function') {
                        this.lyricsDisplay.updateDefinedBlocksDisplay(synthesized);
                    }
                    console.log(`MarkerManager: Synthesized ${synthesized.length} textBlocks from JSON markers.`);
                }
            }
        } catch (e) { console.warn('MarkerManager: Failed to synthesize blocks from markers', e); }

        this._notifySubscribers('markersReset', this.markers);
        
        // Update UI to highlight lines with markers
        this._updateLineMarkersUI();
    }
    
    /**
     * Обновляет цвета и типы блоков для всех существующих маркеров
     * Используется когда загружаются новые блоки текста
     */
    updateMarkerColors() {
        if (!this.markers || this.markers.length === 0) {return;}
        
        let updated = false;
        const hasBlocks = !!(this.lyricsDisplay && Array.isArray(this.lyricsDisplay.textBlocks) && this.lyricsDisplay.textBlocks.length > 0);
        this.markers.forEach(marker => {
            const newBlockType = this._getBlockTypeForLine(marker.lineIndex);
            // Если блоки не загружены или тип неизвестен — не перезаписываем переданные из JSON тип/цвет
            if (!hasBlocks || newBlockType === 'unknown') {
                return;
            }
            const newColor = this._getColorForBlockType(newBlockType);
            
            if (marker.blockType !== newBlockType || marker.color !== newColor) {
                marker.blockType = newBlockType;
                marker.color = newColor;
                updated = true;
                console.log(`Updated marker for line ${marker.lineIndex}: type=${newBlockType}, color=${newColor}`);
            }
        });
        
        if (updated) {
            // Уведомляем подписчиков об обновлении
            this._notifySubscribers('markersReset', this.markers);
            
            // Обновляем UI
            this._updateLineMarkersUI();
            
            // Перерисовываем waveform если доступен
            if (window.waveformEditor) {
                window.waveformEditor._drawWaveform();
            }
        }
    }
    
    /**
     * Reset all markers
     */
    resetMarkers() {
        this.markers = [];
        this._notifySubscribers('markersReset', []);
        
        // Update UI to highlight lines with markers
        this._updateLineMarkersUI();
    }
    
    /**
     * Get marker for a specific line
     * @param {number} lineIndex - The line index
     * @returns {Object|null} The marker object or null if not found
     */
    getMarkerForLine(lineIndex) {
        return this.markers.find(marker => marker.lineIndex === lineIndex) || null;
    }
    
    /**
     * Get the active line index at a specific time
     * @param {number} time - The time in seconds
     * @returns {number} The active line index or -1 if no active line
     */
    getActiveLineAtTime(time) {
        // If no markers, return -1 to indicate no active line
        if (!this.markers || this.markers.length === 0) {
            return -1;
        }
        
        // Handle special case - if time is before the first marker
        if (time < this.markers[0].time) {
            // Return first line index if we're close (within 2 seconds) to its marker
            if (this.markers[0].time - time < 2.0) {
                return this.markers[0].lineIndex;
            }
            return -1;
        }
        
        // Find the current active marker and the next marker
        let activeMarkerIndex = -1;
        
        for (let i = 0; i < this.markers.length; i++) {
            if (time >= this.markers[i].time) {
                activeMarkerIndex = i;
            } else {
                // Found the first marker after current time
                break;
            }
        }
        
        // If we found an active marker, return its line index
        if (activeMarkerIndex >= 0) {
            return this.markers[activeMarkerIndex].lineIndex;
        }
        
        // If we're past the last marker, return the last line
        if (time > this.markers[this.markers.length - 1].time) {
            return this.markers[this.markers.length - 1].lineIndex;
        }
        
        // Fallback, should not reach here
        return -1;
    }
    
    /**
     * Update UI to highlight lines that have markers
     * @param {boolean} showHighlights - Whether to show green highlights (true for edit mode)
     * @private
     */
    _updateLineMarkersUI(showHighlights = true) {
        // Only highlight markers in edit mode
        const isEditMode = document.body.classList.contains('waveform-active');
        const shouldShowHighlights = showHighlights && isEditMode;
        
        // Remove existing marker highlights and color classes
        const allLines = document.querySelectorAll('.lyric-line, .rehearsal-active-line');
        allLines.forEach(line => {
            line.classList.remove('has-marker', 'played-marker');
            // Удаляем все цветовые классы маркеров
            line.classList.remove('marker-verse', 'marker-chorus', 'marker-bridge', 'marker-intro', 'marker-outro', 'marker-unknown');
            // Очищаем inline стили цвета границы, если они были установлены
            line.style.borderLeftColor = '';
            // Очищаем inline стили цвета текста
            line.style.color = '';
        });
        
        // If not in edit mode or no markers, nothing to highlight
        if (!this.markers || this.markers.length === 0) {return;}
        
        // Get all line indexes that have markers
        const markedLines = this.markers.map(marker => marker.lineIndex);
        
        // For edit mode (Sync mode) - show lines dynamically based on current time
        if (isEditMode && this.audioEngine) {
            const currentTime = this.audioEngine.getCurrentTime();
            
            // Add highlight classes based on playback progress
            this.markers.forEach(marker => {
                const line = document.querySelector(`.lyric-line[data-index="${marker.lineIndex}"], .rehearsal-active-line[data-index="${marker.lineIndex}"]`);
                if (line) {
                    // Применяем цвет маркера
                    this._applyMarkerColorToLine(line, marker);
                    
                    // If this line has already played (its marker time is less than current time)
                    if (marker.time < currentTime) {
                        line.classList.add('played-marker');
                    } else {
                        // Line not yet played but has a marker
                        line.classList.add('has-marker');
                    }
                }
            });
            
            // Highlight active line
            const activeLineIndex = this.getActiveLineAtTime(currentTime);
            if (activeLineIndex >= 0) {
                const activeLine = document.querySelector(`.lyric-line[data-index="${activeLineIndex}"], .rehearsal-active-line[data-index="${activeLineIndex}"]`);
                if (activeLine) {
                    // Remove any existing classes to ensure proper styling
                    activeLine.classList.remove('has-marker', 'played-marker');
                    activeLine.classList.add('active');
                    
                    // Ensure this line is visible by scrolling to it if needed
                    // This is crucial for keeping the active line visible in Sync mode
                    if (window.lyricsDisplay && window.lyricsDisplay.currentLine !== activeLineIndex) {
                        window.lyricsDisplay.setActiveLine(activeLineIndex);
                    }
                }
            }
            
            // If song ended (within 0.5 seconds of end), mark all lines as played
            if (this.audioEngine.duration > 0 && 
                currentTime >= this.audioEngine.duration - 0.5) {
                markedLines.forEach(lineIndex => {
                    const line = document.querySelector(`.lyric-line[data-index="${lineIndex}"], .rehearsal-active-line[data-index="${lineIndex}"]`);
                    if (line) {
                        line.classList.remove('has-marker');
                        line.classList.add('played-marker');
                    }
                });
            }
        } 
        // For non-edit mode - no green highlights
        else if (!isEditMode) {
            // Don't add any highlights in normal playback mode
            // Active line is handled by lyrics-display.js
        }
        // Default case - just highlight all marked lines
        else {
            // Add highlight class to lines with markers
            this.markers.forEach(marker => {
                const line = document.querySelector(`.lyric-line[data-index="${marker.lineIndex}"], .rehearsal-active-line[data-index="${marker.lineIndex}"]`);
                if (line) {
                    line.classList.add('has-marker');
                    // Применяем цвет маркера
                    this._applyMarkerColorToLine(line, marker);
                }
            });
        }
    }
    
    /**
     * Применяет цвет маркера к строке лирики
     * @param {HTMLElement} lineElement - Элемент строки лирики
     * @param {Object} marker - Объект маркера с информацией о цвете
     * @private
     */
    _applyMarkerColorToLine(lineElement, marker) {
        if (!lineElement || !marker) {return;}
        
        // Добавляем CSS класс для типа блока
        if (marker.blockType) {
            lineElement.classList.add(`marker-${marker.blockType}`);
        }
        
        // Если у маркера есть цвет, применяем его через inline стиль
        if (marker.color) {
            lineElement.style.borderLeftColor = marker.color;
            // Также применяем цвет к тексту для лучшей видимости
            lineElement.style.color = marker.color;
        }
    }
    
    /**
     * Subscribe to marker events
     * @param {string} event - Event type ('markerAdded', 'markerUpdated', 'markerDeleted', 'markersReset')
     * @param {Function} callback - Callback function to be called when event occurs
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.subscribers[event]) {
            console.error('Invalid event type:', event);
            return () => {};
        }
        
        this.subscribers[event].push(callback);
        
        // Return unsubscribe function
        return () => {
            this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
        };
    }
    
    /**
     * Notify all subscribers of an event
     * @param {string} event - Event type
     * @param {*} data - Event data
     * @private
     */
    _notifySubscribers(event, data) {
        if (!this.subscribers[event]) {return;}
        
        this.subscribers[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in event subscriber:', error);
            }
        });
    }
    
    /**
     * Export markers to JSON
     * @returns {string} JSON string of markers
     */
    exportMarkers() {
        // Add UTF-8 BOM to the beginning of the string for proper handling of Cyrillic characters
        const bom = '\uFEFF';
        const json = JSON.stringify(this.markers, null, 2);
        return bom + json;
    }
    
    /**
     * Import markers from JSON
     * @param {string} json - JSON string of markers
     * @returns {boolean} Success status
     */
    importMarkers(json) {
        try {
            // Remove UTF-8 BOM if present
            let jsonContent = json;
            if (json.charCodeAt(0) === 0xFEFF) {
                jsonContent = json.substring(1);
            }
            
            // Parse the JSON
            const data = JSON.parse(jsonContent);
            
            // Check if this is a complete track backup file or just markers array
            if (Array.isArray(data)) {
                // Direct array of markers
                this.setMarkers(data);
            } else if (data && data.markers && Array.isArray(data.markers)) {
                // Track backup file format
                this.setMarkers(data.markers);
                
                // If we have lyrics, update the lyrics display
                if (data.lyrics && window.lyricsDisplay) {
                    // Store the title for display
                    const title = data.title || 'Imported Track';
                    console.log(`Importing markers and lyrics for "${title}"`);
                    
                    // Use lyrics if they exist and current track doesn't have lyrics
                    // Only update if we have an audioEngine with duration
                    if (this.audioEngine && this.audioEngine.duration > 0) {
                        window.lyricsDisplay.loadLyrics(data.lyrics, this.audioEngine.duration);
                    }
                }
            } else {
                throw new Error('Invalid markers format');
            }
            
            // Force UI update
            if (window.waveformEditor) {
                window.waveformEditor._drawWaveform();
            }
            
            return true;
        } catch (error) {
            console.error('Error importing markers:', error);
            return false;
        }
    }
    
    /**
     * Save markers to the current track
     * @returns {boolean} Success status
     */
    saveMarkersToTrack() {
        // Check if track catalog and current track are available
        if (!window.trackCatalog || window.trackCatalog.currentTrackIndex < 0) {
            console.error('No current track to save markers to');
            return false;
        }
        
        const currentTrack = window.trackCatalog.tracks[window.trackCatalog.currentTrackIndex];
        
        // Dispatch event to notify track catalog to save markers
        const event = new CustomEvent('save-track-markers', {
            detail: {
                trackId: currentTrack.id,
                markers: this.markers
            }
        });
        
        document.dispatchEvent(event);
        return true;
    }
    
    /**
     * Start a loop to update the markers UI regularly
     * @private
     */
    _startUpdateLoop() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Set interval to update the markers UI every 100ms during playback
        this.updateInterval = setInterval(() => {
            if (this.audioEngine && this.audioEngine.isPlaying) {
                this._updateLineMarkersUI();
            }
        }, 100); // Update 10 times per second
    }
    
    /**
     * Stop the update loop
     * @private
     */
    _stopUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Строит textBlocks из последовательности маркеров с типами.
     * Группируем по непрерывным отрезкам одинакового blockType.
     */
    _buildBlocksFromMarkers(markers) {
        if (!Array.isArray(markers) || markers.length === 0) {return [];}
        const sorted = [...markers].sort((a,b)=>a.lineIndex-b.lineIndex);
        const blocks = [];
        let current = null;
        const counters = { verse:0, chorus:0, bridge:0 };
        for (const m of sorted) {
            const t = (m.blockType && m.blockType !== 'unknown') ? m.blockType : 'verse';
            if (!current || current.type !== t || m.lineIndex !== current._lastLineIndex + 1) {
                // Закрываем предыдущий
                if (current) {
                    delete current._lastLineIndex;
                    blocks.push(current);
                }
                counters[t] = (counters[t]||0) + 1;
                current = {
                    id: `blk-${t}-${counters[t]}`,
                    name: `${t.charAt(0).toUpperCase()+t.slice(1)} ${counters[t]}`,
                    type: t,
                    lineIndices: [m.lineIndex],
                    _lastLineIndex: m.lineIndex
                };
            } else {
                current.lineIndices.push(m.lineIndex);
                current._lastLineIndex = m.lineIndex;
            }
        }
        if (current) { delete current._lastLineIndex; blocks.push(current); }
        return blocks;
    }
}

// Create global marker manager instance
const markerManager = new MarkerManager(window.audioEngine, window.lyricsDisplay);
window.markerManager = markerManager; 