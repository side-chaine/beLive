class WaveformEditor {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.lyricsDisplay = window.lyricsDisplay; // Ensure WaveformEditor has a reference to lyricsDisplay
        this.markerManager = window.markerManager; // Assuming markerManager is also globally available or passed
        
        // Флаг для игнорирования следующего клика по canvas после отпускания маркера
        this.ignoringNextClick = false;
        
        this.isVisible = false;
        this.container = null;
        this.canvas = null;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.header = null;
        this.playhead = null;
        this.timeDisplay = null;
        this.audioDuration = 0;
        this.sampleRate = 44100;      // Default sample rate
        this.zoom = 100;              // Default zoom level (percentage)
        this.scrollPosition = 0;      // Scroll position in pixels
        this.pixelsPerSecond = 100;   // Default value, will be recalculated
        this.followPlayhead = false;  // Auto-scroll with playhead
        this.centeredPlayhead = false; // Whether playhead stays centered
        this.playheadReachedCenter = false; // Flag for centered mode logic
        this.lastKnownPosition = 0; // Track last known audio position
        this.gridInterval = 1; // Default grid interval in seconds
        this.snapToGrid = false; // Snap markers/playhead to grid
        
        // Marker selection
        this.selectedMarkers = [];
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.selectionElement = null;
        
        // Marker visblty flag - default false
        this.showMarkers = false;
        
        // Loop region variables
        this.loopActive = false;
        this.loopStart = null;
        this.loopEnd = null;
        this.isDraggingLoopStart = false;
        this.isDraggingLoopEnd = false;
        this.isDraggingLoop = false;
        this.loopHandleWidth = 8; // Width of loop drag handles in pixels
        this.loopBottomHandleHeight = 12; // Height of bottom loop handle
        this.dragOffset = 0; // Offset for dragging the entire loop
        
        // Selection variables
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        
        // Marker dragging
        this.isDragging = false;
        this.draggingMarker = null;
        
        // Try to get the marker manager if available
        this.markerManager = window.markerManager || null;
        
        // Состояние перетаскивания маркеров
        this.isDraggingMarker = false;
        this.draggedMarker = null;
        this.dragStartX = 0;
        this.dragStartTime = 0;
        
        // Waveform source switching
        this.currentWaveformSource = "vocals"; // По умолчанию показываем вокал
        this.currentWaveformColor = "#FFD700"; // Золотой цвет для вокала
        this.sourceButtons = {};
        
        // Кэш для данных волновых форм
        this.vocalAudioData = null;
        this.instrumentalAudioData = null;
        this.masterAudioData = null; // Данные мастер-дорожки
        this.rawVocalData = null;
        this.rawInstrumentalData = null;
        this.rawMasterData = null; // Сырые данные мастер-дорожки
        
        this._createUI();
        this._attachEventListeners();
        
        // Bind callbacks for position and track updates
        this._updatePlayheadBound = this._updatePlayhead.bind(this);
        this._loadAudioDataBound = this._loadAudioData.bind(this);
        this._handlePositionChangeBound = this._handlePositionChange.bind(this);
        
        // Register for AudioEngine events
        if (this.audioEngine) {
            // Register for position updates
            this.audioEngine.onPositionUpdate(this._updatePlayheadBound);
            
            // Register for track loaded events
            // DEACTIVATED FOR HYBRID CORE: Waveform editor will now load its own data on demand.
            // this.audioEngine.onTrackLoaded(this._loadAudioDataBound);
        }
        
        // Добавляем слушатель для обнаружения скачков в позиции
        document.addEventListener("audio-position-changed", this._handlePositionChangeBound);
        
        // Subscribe to marker manager events if available
        if (this.markerManager) {
            this.markerManager.subscribe("markersReset", () => {
                this._drawWaveform();
            });
            
            this.markerManager.subscribe("markerAdded", () => {
                this._drawWaveform();
            });
            
            this.markerManager.subscribe("markerUpdated", () => {
                this._drawWaveform();
            });
            
            this.markerManager.subscribe("markerDeleted", () => {
                this._drawWaveform();
            });
        }
        
        console.log("WaveformEditor initialized");
        
        // In the constructor section, add global event listeners for drag prevention
        document.addEventListener("dragstart", (e) => {
            // Prevent default browser drag behavior when we're dragging our own elements
            if (this.isDraggingLoopStart || this.isDraggingLoopEnd || this.isDraggingLoop) {
                e.preventDefault();
                return false;
            }
        });

        document.addEventListener("blocks-applied", (e) => {
            try {
                if (this.markerManager) {
                    this.markerManager.updateMarkerColors();
                }
                this._drawWaveform();
                console.log("WaveformEditor: blocks-applied handled", e.detail);
            } catch (err) {
                console.warn("WaveformEditor: failed to handle blocks-applied", err);
            }
        });
    }
    
    /**
     * Public method to load audio data specifically for the editor.
     * This allows the editor to have high-fidelity audio data while the main engine streams.
     * @param {string} audioUrl - The URL of the audio file to load.
     * @returns {Promise} Promise that resolves when audio is loaded
     */
    async loadAudioForSync(audioUrl) {
// eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            if (!audioUrl) {
                console.error("WaveformEditor: No audio URL provided for sync loading.");
                this.audioData = this._createMockAudioData();
                this._drawWaveform();
                reject(new Error("No audio URL provided"));
                return;
            }

            console.log(`WaveformEditor: Starting high-fidelity audio load for sync: ${audioUrl}`);
            try {
                const response = await fetch(audioUrl);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();

                // Use an OfflineAudioContext for decoding to avoid interfering with the main AudioContext
                const offlineContext = new OfflineAudioContext(1, 1, 44100);
                const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

                // Сохраняем "сырые" данные и генерируем пики для вокала (по умолчанию)
                this.rawVocalData = audioBuffer.getChannelData(0);
                this.vocalAudioData = this._generatePeaks(this.rawVocalData);
                
                this.audioDuration = audioBuffer.duration;
                this.sampleRate = audioBuffer.sampleRate;
                
                console.log(`WaveformEditor: High-fidelity audio loaded successfully. Duration: ${this.audioDuration.toFixed(2)}s`);
                
                this._drawWaveform();
                resolve();

            } catch (error) {
                console.error("WaveformEditor: Error loading audio data for sync:", error);
                this.audioData = this._createMockAudioData();
                this._drawWaveform();
                reject(error);
            }
        });
    }
    
    // Create UI elements
    _createUI() {
        // Create container
        this.container = document.createElement("div");
        this.container.id = "waveform-editor";
        this.container.classList.add("waveform-editor");
        this.container.style.display = "none"; // Initially hidden
        
        // Create header with controls
        this.header = document.createElement("div");
        this.header.classList.add("waveform-header");
        
        // Add back button
        const backButton = document.createElement("button");
        backButton.textContent = "Back";
        backButton.className = "waveform-btn back-btn";
        backButton.title = "Return to main view";
        backButton.addEventListener("click", () => this.hide());
        
        // Add title
        const title = document.createElement("div");
        title.classList.add("waveform-title");
        title.textContent = "Sync Editor";
        
        // Create header sections for better organization
        const leftSide = document.createElement("div");
        leftSide.className = "waveform-header-left";
        leftSide.appendChild(backButton);
        leftSide.appendChild(title);
        
        const centerSection = document.createElement("div");
        centerSection.className = "waveform-header-center";
        
        // Time display - перемещаем в центр
        this.timeDisplay = document.createElement("div");
        this.timeDisplay.id = "waveform-time-display";
        this.timeDisplay.classList.add("waveform-time-display");
        this.timeDisplay.textContent = "00:00";
        centerSection.appendChild(this.timeDisplay);
        
        // Create right side section with controls
        const rightSide = document.createElement("div");
        rightSide.className = "waveform-header-right";
        
        // Add zoom controls in a button group
        const zoomControls = document.createElement("div");
        zoomControls.classList.add("btn-group");
        
        const zoomInBtn = document.createElement("button");
        zoomInBtn.textContent = "🔍+";
        zoomInBtn.title = "Zoom In";
        zoomInBtn.className = "waveform-btn";
        zoomInBtn.addEventListener("click", () => this._zoomIn());
        
        const zoomOutBtn = document.createElement("button");
        zoomOutBtn.textContent = "🔍−";
        zoomOutBtn.title = "Zoom Out";
        zoomOutBtn.className = "waveform-btn";
        zoomOutBtn.addEventListener("click", () => this._zoomOut());
        
        zoomControls.appendChild(zoomInBtn);
        zoomControls.appendChild(zoomOutBtn);
        
        // Add follow playhead toggle button
        const followGroup = document.createElement("div");
        followGroup.classList.add("btn-group");
        
        const followToggle = document.createElement("button");
        followToggle.textContent = this.followPlayhead ? "Follow: On" : "Follow: Off";
        followToggle.title = "Toggle auto-follow playhead (centered mode)";
        followToggle.className = "waveform-btn";
        followToggle.addEventListener("click", () => {
            this.followPlayhead = !this.followPlayhead;
            
            // Также включаем/выключаем режим центрированного плейхеда
            if (this.followPlayhead) {
                this.centeredPlayhead = true;
                
                // При включении Follow, сбрасываем признак достижения центра
                // Playhead начнет движение с текущей позиции к центру
                this.playheadReachedCenter = false;
                
                // Вычисляем правильную стартовую позицию, чтобы избежать скачков
                if (this.audioEngine) {
                    const currentTime = this.audioEngine.getCurrentTime();
                    // Позиция обновится автоматически при следующем вызове _updatePlayhead
                }
            } else {
                this.centeredPlayhead = false;
                // Сбрасываем флаг центрирования
                this.playheadReachedCenter = false;
            }
            
            followToggle.textContent = this.followPlayhead ? "Follow: On" : "Follow: Off";
            followToggle.classList.toggle("active", this.followPlayhead);
            
            // Перерисовываем волновую форму с новыми настройками
            this._drawWaveform();
        });
        
        // Set active class based on initial state
        if (this.followPlayhead) {
            followToggle.classList.add("active");
        }
        
        followGroup.appendChild(followToggle);
        
        // Add loop toggle button
        const loopToggle = document.createElement("button");
        loopToggle.textContent = "Loop: Off";
        loopToggle.title = "Toggle loop mode (Shift+Click to set loop)";
        loopToggle.className = "waveform-btn loop-btn";
        loopToggle.addEventListener("click", () => this._toggleLoop());
        this.loopToggleBtn = loopToggle;  // Store reference to update later
        
        followGroup.appendChild(loopToggle);
        
        // Markers toggle button
        const markersToggleBtn = document.createElement("button");
        markersToggleBtn.textContent = "Markers: Off";
        markersToggleBtn.title = "Toggle markers visibility";
        markersToggleBtn.className = "waveform-btn markers-toggle-btn";
        markersToggleBtn.addEventListener("click", () => this._toggleMarkers());
        this.markersToggleBtn = markersToggleBtn; // Store reference to update text
        
        // Add marker button (double-click functionality will be added later)
        const addMarkerBtn = document.createElement("button");
        addMarkerBtn.textContent = "Add Marker";
        addMarkerBtn.title = "Add Marker at Current Position";
        addMarkerBtn.className = "waveform-btn add-marker-btn";
        addMarkerBtn.addEventListener("click", () => this._addMarkerAtPlayhead());
        
        // Add text edit button
        const editTextBtn = document.createElement("button");
        editTextBtn.innerHTML = "<strong>T</strong>"; // Bold "T" icon
        editTextBtn.title = "Edit Lyrics Text";
        editTextBtn.className = "waveform-btn edit-text-btn";
        editTextBtn.addEventListener("click", () => this._openNewBlockEditor());
        
        // Добавляем кнопку удаления выбранных маркеров в группу
        const actionGroup = document.createElement("div");
        actionGroup.classList.add("btn-group");
        
        const deleteMarkersBtn = document.createElement("button");
        deleteMarkersBtn.textContent = "Delete Selected";
        deleteMarkersBtn.title = "Delete Selected Markers";
        deleteMarkersBtn.className = "waveform-btn delete-btn";
        deleteMarkersBtn.addEventListener("click", () => this._deleteSelectedMarkers());
        
        // Добавляем кнопку сброса всех маркеров
        const resetMarkersBtn = document.createElement("button");
        resetMarkersBtn.textContent = "Reset All";
        resetMarkersBtn.title = "Remove All Markers";
        resetMarkersBtn.className = "waveform-btn reset-btn";
        resetMarkersBtn.addEventListener("click", () => this._resetAllMarkers());
        
        actionGroup.appendChild(deleteMarkersBtn);
        actionGroup.appendChild(resetMarkersBtn);
        
        // Add save button for markers
        const saveMarkersBtn = document.createElement("button");
        saveMarkersBtn.textContent = "Save & Close";
        saveMarkersBtn.className = "waveform-btn save-btn";
        saveMarkersBtn.title = "Save markers and close editor";
        saveMarkersBtn.addEventListener("click", () => {
            this._saveMarkers();
            // Close the editor after saving
            this.hide();
        });
        
        // Create main controls container
        const mainControls = document.createElement("div");
        mainControls.className = "waveform-controls";
        
        // Add all control groups
        mainControls.appendChild(zoomControls);
        mainControls.appendChild(followGroup);
        mainControls.appendChild(markersToggleBtn);
        mainControls.appendChild(addMarkerBtn);
        mainControls.appendChild(editTextBtn);
        mainControls.appendChild(actionGroup);
        mainControls.appendChild(saveMarkersBtn);
        
        // Add main controls to right side
        rightSide.appendChild(mainControls);
        
        // Add all sections to header
        this.header.appendChild(leftSide);
        this.header.appendChild(centerSection);
        this.header.appendChild(rightSide);
        
        // Create canvas container
        const canvasContainer = document.createElement("div");
        canvasContainer.className = "waveform-canvas-container";
        
        // Create canvas for waveform
        this.canvas = document.createElement("canvas");
        this.canvas.classList.add("waveform-canvas");
        canvasContainer.appendChild(this.canvas);
        
        // Create playhead
        this.playhead = document.createElement("div");
        this.playhead.classList.add("playhead");
        canvasContainer.appendChild(this.playhead);
        
        // Create loop region elements
        this.loopElement = document.createElement("div");
        this.loopElement.className = "waveform-loop-region";
        this.loopElement.style.position = "absolute";
        this.loopElement.style.top = "0";
        this.loopElement.style.height = "100%";
        this.loopElement.style.display = "none";
        // Remove the inline background color to use the CSS class styles
        // Remove the inline border styles to use the CSS class styles
        this.loopElement.style.zIndex = "2";
        // Make it non-blocking for mouse events
        this.loopElement.style.pointerEvents = "none";
        canvasContainer.appendChild(this.loopElement);
        
        // Create loop bottom drag handle
        this.loopBottomHandle = document.createElement("div");
        this.loopBottomHandle.className = "waveform-loop-handle bottom-handle";
        this.loopBottomHandle.style.position = "absolute";
        this.loopBottomHandle.style.bottom = "0";
        this.loopBottomHandle.style.height = "12px";
        this.loopBottomHandle.style.display = "none";
        // Remove inline styles that are defined in CSS
        // this.loopBottomHandle.style.cursor = 'grab';
        // this.loopBottomHandle.style.backgroundColor = 'rgba(255, 200, 50, 0.7)';
        // this.loopBottomHandle.style.border = '1px solid rgba(255, 255, 255, 0.7)';
        // this.loopBottomHandle.style.borderRadius = '3px 3px 0 0';
        this.loopBottomHandle.style.zIndex = "5";
        this.loopBottomHandle.style.pointerEvents = "auto"; // Ensure it's clickable
        canvasContainer.appendChild(this.loopBottomHandle);
        
        // Create loop start handle
        this.loopStartHandle = document.createElement("div");
        this.loopStartHandle.className = "waveform-loop-handle start-handle";
        this.loopStartHandle.style.position = "absolute";
        this.loopStartHandle.style.top = "0";
        this.loopStartHandle.style.width = "5px"; // Using a fixed width instead of this.loopHandleWidth
        this.loopStartHandle.style.height = "100%";
        this.loopStartHandle.style.display = "none";
        // Remove inline styles that are defined in CSS
        // this.loopStartHandle.style.cursor = 'ew-resize';
        // this.loopStartHandle.style.backgroundColor = 'rgba(255, 200, 50, 0.5)';
        // this.loopStartHandle.style.border = '1px solid rgba(255, 255, 255, 0.5)';
        this.loopStartHandle.style.zIndex = "5";
        this.loopStartHandle.style.pointerEvents = "auto"; // Ensure it's clickable
        canvasContainer.appendChild(this.loopStartHandle);
        
        // Create loop end handle
        this.loopEndHandle = document.createElement("div");
        this.loopEndHandle.className = "waveform-loop-handle end-handle";
        this.loopEndHandle.style.position = "absolute";
        this.loopEndHandle.style.top = "0";
        this.loopEndHandle.style.width = "5px"; // Using a fixed width instead of this.loopHandleWidth
        this.loopEndHandle.style.height = "100%";
        this.loopEndHandle.style.display = "none";
        // Remove inline styles that are defined in CSS
        // this.loopEndHandle.style.cursor = 'ew-resize';
        // this.loopEndHandle.style.backgroundColor = 'rgba(255, 200, 50, 0.5)';
        // this.loopEndHandle.style.border = '1px solid rgba(255, 255, 255, 0.5)';
        this.loopEndHandle.style.zIndex = "5";
        this.loopEndHandle.style.pointerEvents = "auto"; // Ensure it's clickable
        canvasContainer.appendChild(this.loopEndHandle);
        
        // Создаем элемент для отображения выделения
        this.selectionElement = document.createElement("div");
        this.selectionElement.className = "waveform-selection";
        this.selectionElement.style.position = "absolute";
        this.selectionElement.style.top = "0";
        this.selectionElement.style.height = "100%";
        this.selectionElement.style.display = "none";
        this.selectionElement.style.pointerEvents = "none";
        this.selectionElement.style.zIndex = "3";
        canvasContainer.appendChild(this.selectionElement);
        
        // Create main content container
        const contentContainer = document.createElement("div");
        contentContainer.className = "sync-editor-container";
        contentContainer.appendChild(this.header);
        contentContainer.appendChild(canvasContainer);
        
        // Create footer for source controls
        const footerControls = document.createElement("div");
        footerControls.className = "waveform-footer-controls";

        // Добавляем переключатель источника волн
        const waveformSourceGroup = document.createElement("div");
        waveformSourceGroup.className = "waveform-source-group";
        
        // Кнопка Вокал
        const vocalsBtn = document.createElement("button");
        vocalsBtn.textContent = "V";
        vocalsBtn.title = "Vocals - Вокальная дорожка";
        vocalsBtn.className = "waveform-btn source-btn active"; // Активна по умолчанию
        vocalsBtn.dataset.source = "vocals";
        vocalsBtn.addEventListener("click", async () => {
            vocalsBtn.disabled = true;
            try {
                await this._switchWaveformSource("vocals");
            } finally {
                vocalsBtn.disabled = false;
            }
        });
        
        // Кнопка Инструментал
        const instrumentalBtn = document.createElement("button");
        instrumentalBtn.textContent = "I";
        instrumentalBtn.title = "Instrumental - Инструментальная дорожка";
        instrumentalBtn.className = "waveform-btn source-btn";
        instrumentalBtn.dataset.source = "instrumental";
        instrumentalBtn.addEventListener("click", async () => {
            instrumentalBtn.disabled = true;
            try {
                await this._switchWaveformSource("instrumental");
            } finally {
                instrumentalBtn.disabled = false;
            }
        });
        
        // Кнопка Мастер (микс)
        const masterBtn = document.createElement("button");
        masterBtn.textContent = "M";
        masterBtn.title = "Master - Смешанный трек";
        masterBtn.className = "waveform-btn source-btn";
        masterBtn.dataset.source = "master";
        masterBtn.addEventListener("click", async () => {
            masterBtn.disabled = true;
            try {
                await this._switchWaveformSource("master");
            } finally {
                masterBtn.disabled = false;
            }
        });
        
        waveformSourceGroup.appendChild(vocalsBtn);
        waveformSourceGroup.appendChild(instrumentalBtn);
        waveformSourceGroup.appendChild(masterBtn);

        // Кнопка выбора цвета
        const colorPickerBtn = document.createElement("button");
        colorPickerBtn.className = "color-picker-button";
        colorPickerBtn.title = "Выбор цветовой схемы волн";
        colorPickerBtn.innerHTML = "🎨";
        
        console.log("🎨 Создаю кнопку выбора цвета, ColorService доступен:", !!window.colorService);
        
        // Выпадающее меню цветов
        const colorDropdown = document.createElement("div");
        colorDropdown.className = "color-dropdown";
        
        // Создаем элементы цветовых схем
        if (window.colorService) {
            console.log("🎨 ColorService найден, создаю схемы...");
            const schemes = window.colorService.getColorSchemes();
            const currentScheme = window.colorService.getCurrentScheme();
            
            console.log("🎨 Доступные схемы:", schemes.length);
            
            schemes.forEach(scheme => {
                const schemeItem = document.createElement("div");
                schemeItem.className = `color-scheme-item ${scheme.id === currentScheme.id ? "active" : ""}`;
                schemeItem.dataset.schemeId = scheme.id;
                
                // Превью цветов
                const preview = window.colorService.createPreviewCanvas(scheme);
                preview.className = "color-preview";
                
                // Название схемы
                const schemeName = document.createElement("span");
                schemeName.className = "scheme-name";
                schemeName.textContent = scheme.name;
                
                schemeItem.appendChild(preview);
                schemeItem.appendChild(schemeName);
                
                // Обработчик клика
                schemeItem.addEventListener("click", () => {
                    console.log("🎨 Выбрана схема:", scheme.name);
                    window.colorService.setColorScheme(scheme.id);
                    this._updateColorDropdown();
                    this._hideColorDropdown();
                });
                
                colorDropdown.appendChild(schemeItem);
            });
        } else {
            console.warn("🎨 ColorService не найден при создании UI");
        }
        
        // Обработчики для кнопки и меню
        colorPickerBtn.addEventListener("click", (e) => {
            console.log("🎨 Клик по кнопке выбора цвета");
            e.stopPropagation();
            this._toggleColorDropdown();
        });
        
        // Закрытие меню при клике вне его
        document.addEventListener("click", (e) => {
            if (!colorPickerBtn.contains(e.target) && !colorDropdown.contains(e.target)) {
                this._hideColorDropdown();
            }
        });
        
        // ИСПРАВЛЯЕМ: добавляем меню в waveformSourceGroup, а не в кнопку
        waveformSourceGroup.appendChild(colorPickerBtn);
        waveformSourceGroup.appendChild(colorDropdown); // Меню рядом с кнопкой, не внутри!

        // Сохраняем ссылки для управления
        this.colorPickerBtn = colorPickerBtn;
        this.colorDropdown = colorDropdown;

        footerControls.appendChild(waveformSourceGroup);

        // Сохраняем ссылки на кнопки для обновления состояния
        this.sourceButtons = {
            vocals: vocalsBtn,
            instrumental: instrumentalBtn,
            master: masterBtn
        };

        contentContainer.appendChild(footerControls);
        
        // Add all elements to container
        this.container.appendChild(contentContainer);
        
        // Add to document
        document.body.appendChild(this.container);
        
        // Set initial canvas dimensions
        this._resizeCanvas();
        
        // Инициализируем слушателя цветовых изменений
        this._initColorServiceListener();
        
        // Initial draw
        this._drawWaveform();
    }
    
    // Attach event listeners
    _attachEventListeners() {
        // Double-click on canvas to add marker
        this.canvas.addEventListener("dblclick", (e) => {
            if (!this.markerManager || !this.showMarkers) {return;}
            
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickTime = this._pixelsToTime(clickX);
            
            // Find closest line to this time position and add marker
            this._addMarkerAtTime(clickTime);
        });
        
        // Canvas click for playhead positioning or loop creation
        this.canvas.addEventListener("click", (e) => {
            // Если установлен флаг игнорирования следующего клика после отпускания маркера,
            // то игнорируем это событие и сбрасываем флаг
            if (this.ignoringNextClick) {
                console.log("Ignoring click after marker drag");
                this.ignoringNextClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // If in selection mode or dragging, ignore clicks
            if (this.isSelecting || e.shiftKey) {return;}
            
            if (this.audioEngine && this.audioDuration) {
                const rect = this.canvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                
                // Если использовать центрированный плейхед, адаптируем логику
                if (this.followPlayhead && this.centeredPlayhead) {
                    let targetTime;
                    
                    // Если плейхед уже центрирован, расчет относительно центра
                    if (this.playheadReachedCenter) {
                        const centerX = this.canvasWidth / 2;
                        const offset = (clickX - centerX) / this.pixelsPerSecond;
                        const currentTime = this.audioEngine.getCurrentTime();
                        targetTime = currentTime + offset;
                    } else {
                        // Иначе используем обычный расчет
                        targetTime = this._pixelsToTime(clickX);
                    }
                    
                    // Ограничиваем значения времени
                    const finalTime = Math.max(0, Math.min(targetTime, this.audioDuration));
                    
                    // Устанавливаем новое время
                    this.audioEngine.setCurrentTime(finalTime);
                    
                    // При перемещении на новую позицию сбрасываем флаг достижения центра
                    // чтобы playhead снова мог двигаться к центру экрана с новой позиции
                    this.playheadReachedCenter = false;
                } else {
                    // Обычная логика для режима без центрирования
                // Use pixelsToTime to properly account for zoom and scroll position
                const targetTime = this._pixelsToTime(clickX);
                
                // If snap is enabled, round to nearest grid interval
                let finalTime = targetTime;
                if (this.snapToGrid) {
                        finalTime = Math.round(finalTime / this.gridInterval) * this.gridInterval;
                }
                
                // Ensure time is within valid range
                finalTime = Math.max(0, Math.min(finalTime, this.audioDuration));
                
                console.log(`Seeking to ${finalTime.toFixed(2)}s by canvas click`);
                this.audioEngine.setCurrentTime(finalTime);
                }
                
                // Обновляем отображение плейхеда
                this._updatePlayhead(this.audioEngine.getCurrentTime());
            }
        });
        
        // Mouse down - начало выделения, перетаскивания маркера, или петли
        this.canvas.addEventListener("mousedown", (e) => {
            if (!this.audioEngine) {return;}
            
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Handle Shift+Click for selection or creating loop
            if (e.shiftKey) {
                // If we already have a selection and user is holding Shift+Click,
                // create a loop from the current selection
                if (this.selectionStart !== null && this.selectionEnd !== null &&
                    Math.abs(this.selectionEnd - this.selectionStart) > 0.1) {
                    this.createLoopFromSelection();
                    return;
                }
                
                // Otherwise start a new selection
                this.isSelecting = true;
                
                // Calculate time at click position, accounting for follow mode
                const time = this._pixelsToTime(clickX);
                this.selectionStart = time;
                this.selectionEnd = time;
                this._updateSelectionDisplay();
                return;
            }
            
            // Check if clicking on loop region or handles if loop is active
            if (this.loopActive && this.loopStart !== null && this.loopEnd !== null) {
                const loopStartX = this._timeToPixels(this.loopStart);
                const loopEndX = this._timeToPixels(this.loopEnd);
                
                // Check if clicking on bottom handle (for dragging whole loop)
                if (clickY >= rect.height - 15 && clickX >= loopStartX && clickX <= loopEndX) {
                    this.isDraggingLoop = true;
                    this.dragOffset = clickX - loopStartX;
                    
                    // Add dragging class for visual feedback
                    this.loopBottomHandle.classList.add("dragging");
                    console.log("Starting to drag entire loop, offset:", this.dragOffset);
                    
                    e.preventDefault();
                    e.stopPropagation();
                return;
                }
                
                // Check if clicking on loop start handle
                if (Math.abs(clickX - loopStartX) <= 5) { // Use fixed width of 5px
                    this.isDraggingLoopStart = true;
                    this.loopStartHandle.classList.add("dragging");
                    console.log("Starting to drag loop start handle");
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // Check if clicking on loop end handle
                if (Math.abs(clickX - loopEndX) <= 5) { // Use fixed width of 5px
                    this.isDraggingLoopEnd = true;
                    this.loopEndHandle.classList.add("dragging");
                    console.log("Starting to drag loop end handle");
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            
            // Проверка на попадание в маркер для перетаскивания
            // Делегируем обработку специализированному методу
            this._handleMarkerDragStart(e);
        });
        
        // Mouse move - обновление выделения, перетаскивание маркера или границ петли
        document.addEventListener("mousemove", (e) => {
            // Handle selection during mouse drag
            if (this.isSelecting) {
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                
                // Update end of selection
                this.selectionEnd = this._pixelsToTime(mouseX);
                
                // Update the selection display
                this._updateSelectionDisplay();
                return;
            }
            
            // Skip if none of the drag operations are active
            if (!this.isDraggingLoopStart && !this.isDraggingLoopEnd && !this.isDraggingLoop && !this.isDragging) {
                // Handle hover effects when not dragging
                if (this.loopActive && this.loopElement) {
                    const rect = this.canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    
                    // Check if hovering over loop handles
                    if (this.loopStartHandle && this.loopEndHandle && this.loopBottomHandle) {
                        const loopStartX = this._timeToPixels(this.loopStart);
                        const loopEndX = this._timeToPixels(this.loopEnd);
                        
                        // Hover effects are now handled by CSS classes
                        // Just add/remove hover classes as needed
                        
                        // Handle hover for start handle
                        if (Math.abs(mouseX - loopStartX) <= 5) { // 5px is the handle width
                            this.loopStartHandle.classList.add("hover");
                        } else {
                            this.loopStartHandle.classList.remove("hover");
                        }
                        
                        // Handle hover for end handle
                        if (Math.abs(mouseX - loopEndX) <= 5) { // 5px is the handle width
                            this.loopEndHandle.classList.add("hover");
                        } else {
                            this.loopEndHandle.classList.remove("hover");
                        }
                        
                        // Handle hover for bottom handle
                        const bottomHandleHover = mouseX >= loopStartX && mouseX <= loopEndX && 
                                                e.clientY >= rect.bottom - 15 && // 12px handle height + some buffer
                                                e.clientY <= rect.bottom;
                        if (bottomHandleHover) {
                            this.loopBottomHandle.classList.add("hover");
                        } else {
                            this.loopBottomHandle.classList.remove("hover");
                        }
                    }
                }
                return;
            }
            
            // Get canvas bounds and mouse position
                const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            
            if (this.isDraggingLoopStart) {
                // Handle dragging the start of the loop
                let newLoopStart = this._pixelsToTime(mouseX);
                
                // Ensure new start is within bounds and not past the end of the loop
                newLoopStart = Math.max(0, Math.min(newLoopStart, this.loopEnd - 0.1));
                
                // Only update if the value has changed meaningfully
                if (Math.abs(newLoopStart - this.loopStart) > 0.01) {
                    this.loopStart = newLoopStart;
                    if (this.audioEngine) {
                        this.audioEngine.setLoop(this.loopStart, this.loopEnd);
                    }
                    this._updateLoopDisplay();
                    console.log(`Loop start updated to: ${this.loopStart.toFixed(2)}s`);
                }
            }
            else if (this.isDraggingLoopEnd) {
                // Handle dragging the end of the loop
                let newLoopEnd = this._pixelsToTime(mouseX);
                
                // Ensure new end is within bounds and not before the start of the loop
                newLoopEnd = Math.min(this.audioDuration, Math.max(newLoopEnd, this.loopStart + 0.1));
                
                // Only update if the value has changed meaningfully
                if (Math.abs(newLoopEnd - this.loopEnd) > 0.01) {
                    this.loopEnd = newLoopEnd;
                    if (this.audioEngine) {
                        this.audioEngine.setLoop(this.loopStart, this.loopEnd);
                    }
                    this._updateLoopDisplay();
                    console.log(`Loop end updated to: ${this.loopEnd.toFixed(2)}s`);
                }
            }
            else if (this.isDraggingLoop) {
                // Handle dragging the entire loop
                // Calculate new position with the stored offset to maintain grab point
                const newLoopStart = this._pixelsToTime(mouseX - this.dragOffset);
                const loopWidth = this.loopEnd - this.loopStart;
                
                // Ensure new positions are within the audio bounds
                if (newLoopStart >= 0 && newLoopStart + loopWidth <= this.audioDuration) {
                    this.loopStart = newLoopStart;
                    this.loopEnd = newLoopStart + loopWidth;
                    if (this.audioEngine) {
                        this.audioEngine.setLoop(this.loopStart, this.loopEnd);
                    }
                    this._updateLoopDisplay();
                    console.log(`Loop moved to: ${this.loopStart.toFixed(2)}s - ${this.loopEnd.toFixed(2)}s`);
                }
            }
            
            // Обрабатываем перетаскивание маркера через специализированный метод
            if (this.isDraggingMarker && this.draggedMarker) {
                this._handleMarkerDrag(e);
                return;
            }
        });
        
        // Mouse up - завершение выделения, перетаскивания маркера или ручки петли
        document.addEventListener("mouseup", (e) => {
            // Handle end of selection
            if (this.isSelecting) {
                this.isSelecting = false;
                
                // If selection is too small, clear it
                if (Math.abs(this.selectionEnd - this.selectionStart) < 0.1) {
                    console.log("Selection too small, clearing");
                    this._clearSelection();
                } else if (e.shiftKey) {
                    // If shift is still held when releasing, create loop from selection
                    this.createLoopFromSelection();
                } else {
                    console.log(`Completed selection: ${Math.min(this.selectionStart, this.selectionEnd).toFixed(2)}s - ${Math.max(this.selectionStart, this.selectionEnd).toFixed(2)}s`);
                }
                return;
            }
            
            // Reset loop handle dragging flags
            if (this.isDraggingLoopStart || this.isDraggingLoopEnd || this.isDraggingLoop) {
                e.preventDefault();
                
                // Remove dragging classes
                this.loopStartHandle.classList.remove("dragging");
                this.loopEndHandle.classList.remove("dragging");
                this.loopBottomHandle.classList.remove("dragging");
                
                // Reset user select
                document.body.style.userSelect = "";
                
                this.isDraggingLoopStart = false;
                this.isDraggingLoopEnd = false;
                this.isDraggingLoop = false;
                
                // If shift key is pressed when releasing, also toggle loop state
                if (e.shiftKey) {
                    this._toggleLoop();
                }
                
                return;
            }
            
            // Завершение перетаскивания маркера
            if (this.isDraggingMarker) {
                this._handleMarkerDragEnd(e);
                return;
            }
            
            // Завершение перетаскивания
            this.isDragging = false;
            this.draggedMarker = null;
        });
        
        // Prevent default browser context menu on canvas
        this.canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            
            // Show delete option if right-clicking on a marker
            if (this.markerManager) {
                const rect = this.canvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const threshold = 10;
                
                const markers = this.markerManager.getMarkers();
                for (const marker of markers) {
                    const markerX = this._timeToPixels(marker.time);
                    
                    if (Math.abs(markerX - clickX) < threshold) {
                        if (confirm("Delete this marker?")) {
                            this.markerManager.deleteMarker(marker.id);
                            this._drawWaveform();
                        }
                        break;
                    }
                }
            }
        });
        
        // Escape key для отмены выделения и другие глобальные клавиши
        document.addEventListener("keydown", (e) => {
            // Отмена выделения при нажатии Escape
            if (e.key === "Escape" && this.isVisible) {
                this._clearSelection();
                
                // Also clear loop if Escape is pressed with Alt key
                if (e.altKey && this.loopActive) {
                    this._clearLoop();
                }
            }
            
            // Shift+L to toggle loop
            if (e.key === "l" && e.shiftKey && this.isVisible) {
                e.preventDefault();
                this._toggleLoop();
            }
        });
        
        // Trackpad gestures for zooming and scrolling
        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault(); // Prevent default scroll behavior
            
            // Check if we have audio data and duration
            if (!this.audioDuration || (!this.rawVocalData && !this.rawInstrumentalData)) {return;}
            
            // Get current mouse position for zoom focus
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            
            // Get time at current mouse position for zoom centering
            const mouseTime = this._pixelsToTime(mouseX);
            
            // For Mac trackpad, pinch gestures come as ctrlKey + wheel
            if (e.ctrlKey) {
                // This is a pinch zoom gesture
                // REVERSED: Now negative deltaY (pinch out) = zoom in = lower zoom value
                const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9; // Reversed from previous implementation
                
                // Calculate new zoom level with limits
                let newZoom;
                if (e.deltaY > 0) {
                    // Zooming out (increasing zoom value)
                    newZoom = Math.min(100, this.zoom * zoomFactor);
                } else {
                    // Zooming in (decreasing zoom value)
                    newZoom = Math.max(25, this.zoom * zoomFactor);
                }
                
                // Store old time-to-pixel mapping
                const oldPixelsPerSecond = this.pixelsPerSecond;
                
                // Update zoom and recalculate pixels per second
                this.zoom = newZoom;
                const totalWidth = (this.canvasWidth * 100) / this.zoom;
                this.pixelsPerSecond = totalWidth / this.audioDuration;
                
                // Adjust scroll position to keep the mouse position at the same time point
                const timeAtMouse = mouseTime; // Time at mouse position
                const newMouseX = timeAtMouse * this.pixelsPerSecond; // New pixel position for same time
                const oldMouseX = timeAtMouse * oldPixelsPerSecond; // Old pixel position
                
                // В режиме центрированного плейхеда не настраиваем scrollPosition здесь
                if (!(this.followPlayhead && this.centeredPlayhead)) {
                    this.scrollPosition += (newMouseX - oldMouseX); // Adjust scroll to keep mouse over same time point
                // Ensure scroll position is valid
                this.scrollPosition = Math.max(0, this.scrollPosition);
                }
                
                // Redraw with new zoom level
                this._drawWaveform();
                
                // Update loop display if active
                if (this.loopActive) {
                    this._updateLoopDisplay();
                }
            } else {
                // Regular trackpad scroll (horizontal and vertical)
                
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    // Horizontal scroll - move the view left/right
                    // В режиме центрированного плейхеда не реагируем на горизонтальную прокрутку
                    if (!(this.followPlayhead && this.centeredPlayhead)) {
                    this.scrollPosition += e.deltaX;
                    
                    // Ensure scroll position is within valid range
                    this.scrollPosition = Math.max(0, this.scrollPosition);
                    
                    // Redraw with new scroll position
                    this._drawWaveform();
                        
                        // Update loop display if active
                        if (this.loopActive) {
                            this._updateLoopDisplay();
                        }
                    }
                }
            }
        }, { passive: false });
        
        // Window resize
        window.addEventListener("resize", () => {
            this._resizeCanvas();
            this._drawWaveform();
            
            // Update loop display if active
            if (this.loopActive) {
                this._updateLoopDisplay();
            }
        });
        
        // Add direct event listeners to handle dragging for each handle
        this.loopStartHandle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDraggingLoopStart = true;
            this.loopStartHandle.classList.add("dragging");
            console.log("Starting to drag loop start handle");
        });

        this.loopEndHandle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDraggingLoopEnd = true;
            this.loopEndHandle.classList.add("dragging");
            console.log("Starting to drag loop end handle");
        });

        this.loopBottomHandle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDraggingLoop = true;
            this.loopBottomHandle.classList.add("dragging");
            
            // Calculate offset from mouse to start of loop for consistent dragging
            const rect = this.canvas.getBoundingClientRect();
            const loopStartPixel = this._timeToPixels(this.loopStart);
            const mouseX = e.clientX - rect.left;
            this.dragOffset = mouseX - loopStartPixel;
            console.log("Starting to drag entire loop, offset:", this.dragOffset);
        });

        // Add mouseup and mouseleave events to document to handle drag end
        document.addEventListener("mouseup", (e) => {
            if (this.isDraggingLoopStart || this.isDraggingLoopEnd || this.isDraggingLoop) {
                console.log("Ending loop drag operation");
            }
            
            // Reset all dragging states
            if (this.isDraggingLoopStart) {
                this.loopStartHandle.classList.remove("dragging");
                this.isDraggingLoopStart = false;
            }
            
            if (this.isDraggingLoopEnd) {
                this.loopEndHandle.classList.remove("dragging");
                this.isDraggingLoopEnd = false;
            }
            
            if (this.isDraggingLoop) {
                this.loopBottomHandle.classList.remove("dragging");
                this.isDraggingLoop = false;
                this.dragOffset = 0;
            }
        });
        
        // Добавляем обработку drag and drop для маркеров
        this.canvas.addEventListener("mousedown", this._handleMarkerDragStart.bind(this));
        document.addEventListener("mousemove", this._handleMarkerDrag.bind(this));
        document.addEventListener("mouseup", this._handleMarkerDragEnd.bind(this));
    }
    
    // Load audio data for visualization
    _loadAudioData() {
        console.warn("WaveformEditor: _loadAudioData is deprecated. Use loadAudioForSync() instead.");
        // We no longer get data from the streaming engine as it doesn't hold the buffer.
        // If this is called, it means we don't have data, so we draw mock data.
        if (!this.audioData) {
            this.audioData = this._createMockAudioData();
            this.audioDuration = this.audioEngine ? this.audioEngine.duration : 300; // Use duration from engine if available
        }
                this._drawWaveform();
            }
            
    // Create mock audio data for placeholder visualization
    _createMockAudioData() {
        const peaks = [];
        const width = this.canvasWidth || 800;
        
        for (let i = 0; i < width; i++) {
            // Create simple waveform with some random variance
            const position = i / width;
            const base = Math.sin(position * Math.PI * 10) * 0.3;
            const variance = Math.random() * 0.1 - 0.05;
            peaks.push([base - 0.1 + variance, base + 0.1 + variance]);
        }
        
        this.audioData = peaks;
    }
    
    // Generate peaks data from audio channel
    _generatePeaks(channelData) {
        if (!channelData || !this.audioDuration || !this.pixelsPerSecond || this.pixelsPerSecond <= 0) {return [];}
        
        // --- (Rest of the method is likely ok, but ensure pps is valid) ---
        const totalSamples = channelData.length;
        const samplesPerSecond = totalSamples / this.audioDuration;
        const totalPixels = this.audioDuration * this.pixelsPerSecond;
        const samplesPerPixel = Math.max(1, Math.floor(totalSamples / totalPixels));
        
        const peaks = [];
        
        const startPixelAbs = Math.floor(this.scrollPosition);
        const endPixelAbs = Math.ceil(this.scrollPosition + this.canvasWidth);

        for (let pixelIndex = startPixelAbs; pixelIndex < endPixelAbs; pixelIndex++) {
            const timePosition = pixelIndex / this.pixelsPerSecond;
            const sampleIndex = Math.floor(timePosition * samplesPerSecond);
            
            if (sampleIndex >= totalSamples) {
                // Fill remaining visible pixels with 0 if we go past the end
                 if (pixelIndex - startPixelAbs < this.canvasWidth) {
                      peaks.push([0, 0]);
                 }
                continue;
            }
            
            const start = Math.max(0, sampleIndex);
            const end = Math.min(sampleIndex + samplesPerPixel, totalSamples);
            
            let min = channelData[start];
            let max = channelData[start];
            
            for (let j = start + 1; j < end; j++) {
                const value = channelData[j];
                if (value < min) {min = value;}
                if (value > max) {max = value;}
            }
            
            // Only add peaks for the visible canvas area
            if (pixelIndex - startPixelAbs < this.canvasWidth) {
                 peaks.push([min, max]);
            }
        }
        
        return peaks;
    }
    
    // Draw waveform on canvas
    _drawWaveform() {
        if (!this.canvas) {return;}
        
        const ctx = this.canvas.getContext("2d");
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Определяем какие данные использовать для отрисовки
        let audioData = null;
        let waveformColor = this.currentWaveformColor || "#FFD700";

        switch (this.currentWaveformSource) {
            case "vocals":
                audioData = this.vocalAudioData;
                waveformColor = "#FFD700"; // Золотой для вокала
                break;
            case "instrumental":
                audioData = this.instrumentalAudioData;
                waveformColor = "#00CED1"; // Бирюзовый для инструментала
                break;
            case "master":
                audioData = this.masterAudioData;
                waveformColor = "#FF6B6B"; // Красный для мастер-дорожки
                break;
            default:
                // Fallback на первые доступные данные
                audioData = this.vocalAudioData || this.instrumentalAudioData || this.masterAudioData || this.audioData;
                break;
        }

        // Если нет данных, показываем mock волну
        if (!audioData) {
            audioData = this._createMockAudioData();
            waveformColor = "#666666"; // Серый для mock данных
        }
        
        // Draw background with gradient
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, "#1e1e1e");
        bgGradient.addColorStop(1, "#171717");
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Refresh audio peaks based on current zoom and scroll for all loaded tracks
        if (this.rawInstrumentalData && this.audioDuration) {
            this.instrumentalAudioData = this._generatePeaks(this.rawInstrumentalData);
        }
        if (this.rawVocalData && this.audioDuration) {
            this.vocalAudioData = this._generatePeaks(this.rawVocalData);
        }
        if (this.rawMasterData && this.audioDuration) {
            this.masterAudioData = this._generatePeaks(this.rawMasterData);
        }
        
        // Draw grid lines
        this._drawGrid(ctx);
        
        // Draw waveform
            this._drawWaveformData(ctx, this.currentWaveformSource);
        
        // Draw loop region (if active)
        this._drawLoopRegion(ctx);
        
        // Draw markers
        this._drawMarkers(ctx);
        
        // Draw playhead position based on current mode
        if (this.audioEngine && this.playhead) {
            const currentTime = this.audioEngine.getCurrentTime();
            // Обновляем позицию плейхеда согласно текущему режиму и состоянию
            if (this.followPlayhead && this.centeredPlayhead && this.playheadReachedCenter) {
                // Если плейхед достиг центра и режим центрирования включен, фиксируем в центре
                const centerX = this.canvasWidth / 2;
                this.playhead.style.left = `${centerX}px`;
            } else {
                // В противном случае рассчитываем обычную позицию
                const x = this._timeToPixels(currentTime);
                this.playhead.style.left = `${x}px`;
            }
        }
        
        // Обновляем отображение выделения
        this._updateSelectionDisplay();
    }
    
    /**
     * Draw grid lines in the background
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @private
     */
    _drawGrid(ctx) {
        if (!this.audioDuration) {return;}
            
            // Calculate time range visible in view
            const startTime = this.scrollPosition / this.pixelsPerSecond;
            const endTime = (this.scrollPosition + this.canvasWidth) / this.pixelsPerSecond;
            
            // Determine appropriate grid interval based on zoom level
            let gridInterval = this.gridInterval;
        let minorInterval = 0.2; // Small tick interval
        
        if (this.zoom < 30) {
            gridInterval = 30;
            minorInterval = 10;
        } else if (this.zoom < 50) {
            gridInterval = 10;
            minorInterval = 2;
        } else if (this.zoom < 100) {
            gridInterval = 5;
            minorInterval = 1;
        } else if (this.zoom < 200) {
            gridInterval = 1;
            minorInterval = 0.2;
        } else if (this.zoom < 400) {
            gridInterval = 0.5;
            minorInterval = 0.1;
        } else {
            gridInterval = 0.1;
            minorInterval = 0.02;
        }
            
            // Find first grid line in view
            const firstGridLine = Math.floor(startTime / gridInterval) * gridInterval;
        const firstMinorLine = Math.floor(startTime / minorInterval) * minorInterval;
        
        // Draw minor grid lines first (thinner and lighter)
        ctx.strokeStyle = "rgba(80, 80, 80, 0.15)";
        ctx.lineWidth = 1;
        
        for (let time = firstMinorLine; time <= endTime; time += minorInterval) {
            if (time < 0) {continue;}
            
            // Skip if this is also a major grid line
            if (Math.abs(time / gridInterval - Math.round(time / gridInterval)) < 0.001) {
                continue;
            }
            
            const x = this._timeToPixels(time);
            if (x >= 0 && x <= this.canvasWidth) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.canvasHeight);
                ctx.stroke();
            }
        }
        
        // Draw major grid lines
        ctx.strokeStyle = "rgba(120, 120, 120, 0.2)";
        ctx.lineWidth = 1;
        
            for (let time = firstGridLine; time <= endTime; time += gridInterval) {
                if (time < 0) {continue;}
                
                const x = this._timeToPixels(time);
                if (x >= 0 && x <= this.canvasWidth) {
                // Draw grid line
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, this.canvasHeight);
                    ctx.stroke();
                    
                    // Draw time labels
                ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
                    ctx.font = "10px Arial";
                ctx.textAlign = "center";
                
                // Format time differently based on scale
                let timeText;
                if (gridInterval >= 60) {
                    // Format as minutes:seconds for larger intervals
                    const minutes = Math.floor(time / 60);
                    const seconds = Math.floor(time % 60);
                    timeText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
                } else if (gridInterval >= 1) {
                    // Show seconds with no decimal for medium intervals
                    timeText = `${Math.floor(time)}s`;
                } else {
                    // Show decimals for small intervals
                    timeText = time.toFixed(1) + "s";
                }
                
                ctx.fillText(timeText, x, 12);
            }
        }
    }
    
    /**
     * Рисует волну(ы) на основе выбранного источника: 'instrumental' | 'vocals' | 'master'
     * @private
     */
    _drawWaveformData(ctx, mode = this.currentWaveformSource) {
        const width = this.canvas.width;
        const middle = this.canvas.height / 2;

        // Цвета и альфы из ColorService (с фолбэками)
        const scheme = (window.colorService && window.colorService.getCurrentScheme())
            ? window.colorService.getCurrentScheme()
            : null;

        const instrColor = this._getSourceColor('instrumental'); // из ColorService или дефолт
        const vocalColor = this._getSourceColor('vocals');       // из ColorService или дефолт

        // Поддержка альф из схемы (если заданы), иначе разумные дефолты
        const instrAlpha = scheme?.instrumentalAlpha ?? 0.85;
        const vocalAlpha = scheme?.vocalsAlpha ?? 0.9;

        // Хелперы для фолбэков текста
        const dpr = window.devicePixelRatio || 1;
        const drawText = (txt) => {
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.font = `${14 * dpr}px Arial`;
            ctx.textAlign = "center";
            ctx.fillText(txt, width / 2, middle);
        };

        // Отрисовываем в зависимости от выбранного режима
        switch (mode) {
            case 'instrumental': {
                if (this.instrumentalAudioData) {
                    this._drawSingleWaveform(ctx, middle, this.instrumentalAudioData, instrColor, instrAlpha, false);
                } else {
                    drawText("Инструментальная дорожка не загружена");
                }
                break;
            }
            case 'vocals': {
                if (this.vocalAudioData) {
                    this._drawSingleWaveform(ctx, middle, this.vocalAudioData, vocalColor, vocalAlpha, false);
                } else {
                    drawText("Вокальная дорожка не загружена");
                }
                break;
            }
            case 'master':
            default: {
                // Наложение: сначала инструментал, поверх — вокал
                if (this.instrumentalAudioData) {
                    this._drawSingleWaveform(ctx, middle, this.instrumentalAudioData, instrColor, instrAlpha, false);
                }
                if (this.vocalAudioData) {
                    this._drawSingleWaveform(ctx, middle, this.vocalAudioData, vocalColor, vocalAlpha, false);
                }
                if (!this.instrumentalAudioData && !this.vocalAudioData) {
                    drawText("Аудиоданные недоступны");
                }
                break;
            }
        }
    }
    
    /**
     * Рисует одну волновую форму с заданным цветом и прозрачностью
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {number} middle - Средняя линия canvas
     * @param {string} color - Цвет в формате hex
     * @param {number} alpha - Прозрачность (0-1)
     * @param {boolean} isMasterVocal - Флаг, указывающий, является ли это вокалом для мастер-трека
     * @private
     */
    _drawSingleWaveform(ctx, middle, audioData, color, alpha, isMasterVocal = false) {
        const width = this.canvas.width;
        const dpr = window.devicePixelRatio || 1;
        const totalPixels = width * dpr;
        
        if (!audioData) {return;}

        // Извлекаем RGB компоненты из hex цвета
        const rgb = this._hexToRgb(color) || { r: 65, g: 150, b: 255 };
        
        // Draw waveform as a filled area
        ctx.beginPath();
        ctx.moveTo(0, middle);
            
            for (let i = 0; i < audioData.length; i++) {
                const [min, max] = audioData[i];
            const maxY = middle + (max * middle * 0.9); // Scale to 90% of height
                ctx.lineTo(i, maxY);
        }
        
        // Complete the shape by going back through the minimum values
        for (let i = audioData.length - 1; i >= 0; i--) {
            const [min, max] = audioData[i];
            const minY = middle + (min * middle * 0.9);
            ctx.lineTo(i, minY);
        }
        
        ctx.lineTo(0, middle);
        ctx.closePath();

        // Если это вокал для мастер-дорожки, сначала "вырезаем" фон
        if (isMasterVocal) {
            // Блок "стирания" фона удален, чтобы волны нормально накладывались.
        }
        
        // Используем градиент для всех дорожек (включая мастер-вид)
        const gradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.6})`);  // Light at top
        gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);  // Bright in middle
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.6})`);  // Light at bottom
        ctx.fillStyle = gradient;
        
        ctx.fill(); // Заполняем тот же путь основным цветом
        
        // Добавляем контур для всех дорожек
        ctx.strokeStyle = `rgba(${Math.max(0, rgb.r - 35)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 55)}, ${alpha * 0.5})`;
        ctx.lineWidth = 0.5;
                ctx.stroke();
        
        // Добавляем reflection эффект для всех дорожек
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.1})`;
        for (let i = 0; i < audioData.length; i++) {
            const [min, max] = audioData[i];
            const maxY = middle + (max * middle * 0.9);
            
            // Draw a small rectangle for reflection
            ctx.fillRect(i, this.canvasHeight - 20, 1, -(this.canvasHeight - maxY) * 0.1);
        }
    }
    
    /**
     * Draw markers on the canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @private
     */
    _drawMarkers(ctx) {
        if (!this.markerManager || !this.showMarkers) {return;}
        
        const markers = this.markerManager.getMarkers();
        
        for (const marker of markers) {
            const x = this._timeToPixels(marker.time);
            
            // Skip if outside view
            if (x < -10 || x > this.canvasWidth + 10) {continue;}
            
            // Проверяем, выделен ли маркер или это перетаскиваемый маркер
            const isSelected = this.selectedMarkers.some(m => m.id === marker.id);
            const isDragging = this.isDraggingMarker && this.draggedMarker && this.draggedMarker.id === marker.id;
            
            // Определяем цвет маркера
            let markerColor;
            if (isSelected || isDragging) {
                markerColor = "#ff9800"; // Оранжевый для выделенных/перетаскиваемых
            } else if (marker.color) {
                markerColor = marker.color; // Цвет на основе типа блока
            } else {
                markerColor = "#4CAF50"; // Зеленый по умолчанию
            }
            
            // Draw marker line with glow effect
            ctx.strokeStyle = markerColor;
            ctx.lineWidth = 2;
            
            if (isSelected || isDragging) {
                // Add glow effect for selected or dragged markers
                ctx.shadowColor = "rgba(255, 152, 0, 0.7)";
                ctx.shadowBlur = 8;
            } else {
                // Subtle glow for colored markers based on their type
                const rgbColor = this._hexToRgb(markerColor);
                if (rgbColor) {
                    ctx.shadowColor = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.5)`;
                    ctx.shadowBlur = 4;
                } else {
                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                }
            }
            
            // Draw marker line
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvasHeight);
            ctx.stroke();
            
            // Draw marker handle/knob at top
            ctx.beginPath();
            ctx.fillStyle = markerColor;
            ctx.arc(x, 10, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Reset shadow for text
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            
            // Draw time label below marker
            ctx.fillStyle = "#fff";
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(this._formatTime(marker.time), x, this.canvasHeight - 5);
        }
    }
    
    /**
     * Конвертирует hex цвет в RGB объект
     * @param {string} hex - Цвет в формате hex (#RRGGBB)
     * @returns {Object|null} - Объект с компонентами {r, g, b} или null
     * @private
     */
    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    /**
     * Draw a rounded rectangle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} radius - Corner radius
     * @param {string} fill - Fill color
     * @private
     */
    _drawRoundedRect(ctx, x, y, width, height, radius, fill) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    }
    
    // Центрирование на определенном времени
    _centerPlayheadAtTime(time) {
        if (!this.audioDuration) {return;}
        
        // Рассчитать scrollPosition, чтобы указанное время было в центре экрана
        const centerOffset = (this.canvasWidth / 2) / this.pixelsPerSecond;
        this.scrollPosition = Math.max(0, (time * this.pixelsPerSecond) - centerOffset);
    }
    
    // Обработчик изменения позиции
    _handlePositionChange(event) {
        if (!this.isVisible) {return;}
        
        const currentTime = this.audioEngine ? this.audioEngine.getCurrentTime() : 0;
        
        // Проверяем, был ли значительный скачок позиции
        // (это может указывать на то, что пользователь установил новую позицию)
        if (Math.abs(currentTime - this.lastKnownPosition) > 1.0) { // Скачок больше 1 секунды
            console.log("Detected position jump, resetting centered playhead state");
            // Сбрасываем флаг центрирования, чтобы плейхед начал движение заново
            this.playheadReachedCenter = false;
        }
        
        // Обновляем последнюю известную позицию
        this.lastKnownPosition = currentTime;
    }
    
    // Update playhead position based on current time
    _updatePlayhead(currentTime) {
        // Skip updates if editor is not visible
        if (!this.isVisible) {return;}
        
        if (!this.playhead || !this.audioDuration) {return;}
        
        // Обновляем последнюю известную позицию
        this.lastKnownPosition = currentTime;
        
        // Обработка в зависимости от режима
        if (this.followPlayhead && this.centeredPlayhead) {
            // Рассчитаем позицию плейхеда без учета прокрутки (абсолютная позиция)
            const absolutePlayheadX = currentTime * this.pixelsPerSecond;
            const centerX = this.canvasWidth / 2;
            
            // Проверяем, достиг ли плейхед центра экрана
            if (absolutePlayheadX >= centerX) {
                // Если плейхед достиг или прошел центр экрана, фиксируем его в центре
                this.playheadReachedCenter = true;
                this.playhead.style.left = `${centerX}px`;
                
                // Обновляем scrollPosition, чтобы центрировать текущую позицию
                this.scrollPosition = absolutePlayheadX - centerX;
                
                // Добавляем класс для стилизации центрированного режима
                this.container.classList.add("centered-playhead");
                
                // Перерисовываем волновую форму
                this._drawWaveform();
            } else {
                // Если плейхед еще не достиг центра, он движется слева направо
                this.playheadReachedCenter = false;
                
                // Рассчитываем позицию плейхеда с учетом прокрутки
                const x = absolutePlayheadX - this.scrollPosition;
                this.playhead.style.left = `${x}px`;
                
                // В этом случае убираем класс центрированного режима
                this.container.classList.remove("centered-playhead");
            }
        } else {
            // Стандартный режим - плейхед движется по экрану
        const x = this._timeToPixels(currentTime);
        this.playhead.style.left = `${x}px`;
            
            // Убираем класс центрированного режима
            this.container.classList.remove("centered-playhead");
        
        // Auto-scroll if playhead goes off screen and followPlayhead is enabled
        if (this.followPlayhead) {
            const margin = 50; // Keep 50px margin when scrolling
            
            if (x > this.scrollPosition + this.canvasWidth - margin) {
                // Playhead is near the right edge - scroll forward
                this.scrollPosition = x - (this.canvasWidth - margin);
            this._drawWaveform();
            } else if (x < this.scrollPosition + margin) {
                // Playhead is near the left edge - scroll backward
                this.scrollPosition = Math.max(0, x - margin);
            this._drawWaveform();
            }
        }
        }
        
        // Update time display - используем формат без миллисекунд
        this.timeDisplay.textContent = this._formatTime(currentTime, false);
    }
    
    // Сбросить состояние центрированного плейхеда
    _resetCenteredPlayheadState() {
        this.playheadReachedCenter = false;
        this.scrollPosition = 0;
        this.container.classList.remove("centered-playhead");
    }
    
    // Convert time in seconds to pixel position
    _timeToPixels(time) {
        // Ensure we have a valid time value
        if (typeof time !== "number" || isNaN(time)) {
            console.warn("Invalid time value in _timeToPixels:", time);
            return 0; 
        }
        
        // Ensure pixelsPerSecond is valid, use default if not
        const pps = (this.pixelsPerSecond && this.pixelsPerSecond > 0) ? this.pixelsPerSecond : 100;
        
        // Calculate pixel position based on current mode
        if (this.followPlayhead && this.centeredPlayhead && this.playheadReachedCenter) {
            // In centered mode, calculate relative to center point
            const centerX = this.canvasWidth / 2;
            const currentTime = this.audioEngine ? this.audioEngine.getCurrentTime() : 0;
            const offset = (time - currentTime) * pps;
            return centerX + offset;
        } else {
            // Standard calculation (time * pixelsPerSecond - scrollPosition)
            return (time * pps) - this.scrollPosition;
        }
    }
    
    // Convert pixel position to time in seconds
    _pixelsToTime(pixels) {
        // Ensure we have a valid pixel value
        if (typeof pixels !== "number" || isNaN(pixels)) {
            console.warn("Invalid pixels value in _pixelsToTime:", pixels);
            return 0; 
        }
        
        // Ensure pixelsPerSecond is valid, use default if not
        const pps = (this.pixelsPerSecond && this.pixelsPerSecond > 0) ? this.pixelsPerSecond : 100;
        
        // Calculate time based on current mode
        if (this.followPlayhead && this.centeredPlayhead && this.playheadReachedCenter) {
            // In centered mode, calculate relative to center point and current time
            const centerX = this.canvasWidth / 2;
            const currentTime = this.audioEngine ? this.audioEngine.getCurrentTime() : 0;
            const offset = (pixels - centerX) / pps;
            return currentTime + offset;
        } else {
            // Standard calculation (pixels + scrollPosition) / pixelsPerSecond
            return (pixels + this.scrollPosition) / pps;
        }
    }
    
    // Format time in seconds to MM:SS.mmm format
    _formatTime(seconds, includeMs = false) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        
        if (includeMs) {
            const ms = Math.floor((seconds % 1) * 1000);
            return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
        } else {
            return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
    }
    
    // Zoom in
    _zoomIn() {
        // Zoom in means *decreasing* the zoom value (showing less of the track)
        this.zoom = Math.max(25, this.zoom / 1.2);
        
        // Recalculate pixels per second
        if (this.audioDuration) {
            const totalWidth = (this.canvasWidth * 100) / this.zoom;
            this.pixelsPerSecond = totalWidth / this.audioDuration;
        }
        
        this._drawWaveform();
    }
    
    // Zoom out
    _zoomOut() {
        // Zoom out means *increasing* the zoom value (showing more of the track)
        // Limit minimum zoom to 100 (original full view)
        this.zoom = Math.min(100, this.zoom * 1.2);
        
        // Recalculate pixels per second
        if (this.audioDuration) {
            const totalWidth = (this.canvasWidth * 100) / this.zoom;
            this.pixelsPerSecond = totalWidth / this.audioDuration;
        }
        
        this._drawWaveform();
    }
    
    // Show editor
    show() {
        if (this.container) {
            // Save current position to ensure proper scrolling
            const currentTime = this.audioEngine ? this.audioEngine.getCurrentTime() : 0;
            
            // Сохраняем текущий стиль и масштаб, затем устанавливаем стиль редактора и новый масштаб
            if (window.textStyleManager) {
                this.preSyncStyleId = window.textStyleManager.currentStyleId;
                this.preSyncScale = window.textStyleManager.getFontScale(); // Сохраняем текущий масштаб

                console.log(`Sync Editor: Stored original style "${this.preSyncStyleId}" and scale ${this.preSyncScale}. Applying "default" editor style and 0.8 scale.`);
                
                window.textStyleManager.setStyle("default"); // Устанавливаем стиль редактора
                window.textStyleManager.setFontScale(0.8);  // Устанавливаем масштаб 80%
            }
            
            this.container.style.display = "flex";
            this.isVisible = true;

            // 🎯 NEW: По умолчанию переключаемся на мастер-трек при открытии
            setTimeout(() => this._switchWaveformSource("master"), 100);
            
            // Добавляем слушатель для центровки при каждом изменении активной строки
            this._syncEditorCenteringHandler = () => {
                // Исправление: если пришли из репетиции, но открыли Sync — принудительно ведём себя как караоке/концерт
                const isRehearsal = (document.body && document.body.classList.contains("mode-rehearsal")) ||
                                    (window.textStyleManager && window.textStyleManager.currentStyleId === "rehearsal");
                const treatAsTeleprompter = document.body.classList.contains("mode-karaoke") || document.body.classList.contains("mode-concert");
                if (!isRehearsal || treatAsTeleprompter) {
                    this._centerActiveLineInSyncEditor();
                }
            };
            document.addEventListener("active-line-changed", this._syncEditorCenteringHandler);
            // На всякий случай включаем авто-скролл у дисплея
            try { if (window.lyricsDisplay) {window.lyricsDisplay.autoScrollEnabled = true;} } catch(_) {}
            // Дополнительно: при скролле колесом в редакторе — не разрешаем lyricsDisplay перехватывать авто-скролл
            try {
                if (window.lyricsDisplay) {
                    window.lyricsDisplay.autoScrollEnabled = true;
                }
            } catch(_) {}
            
            // Сбрасываем состояние центрированного плейхеда при открытии редактора
            this._resetCenteredPlayheadState();
            
            // Reset markers visibility state when opening editor
            this.showMarkers = false;
            if (this.markersToggleBtn) {
                this.markersToggleBtn.textContent = "Markers: Off";
                this.markersToggleBtn.classList.remove("active");
            }
            
            // Add class to body to adjust layout
            document.body.classList.add("waveform-active");

            requestAnimationFrame(() => {
                this._resizeCanvas();
                
                // 🎯 НЕ ВЫЗЫВАЕМ _loadAudioData ЕСЛИ АУДИО УЖЕ ЗАГРУЖЕНО
                if (!this.audioData || this.audioData.length === 0) {
                    console.log("WaveformEditor: No audio data found, trying to load...");
                this._loadAudioData(); // Try to load audio data when editor is shown
                } else {
                    console.log("WaveformEditor: Audio data already loaded, skipping _loadAudioData");
                }
                
                // Перерисовываем
                this._drawWaveform();
                
                // Update markers UI to show green highlights in edit mode
                if (this.markerManager) {
                    this.markerManager._updateLineMarkersUI(true);
                    
                    // Instead of just activating first unmarked line, maintain current line position
                    // based on current playback time if available
                    const currentLyricsDisplay = window.lyricsDisplay;
                    
                    if (currentLyricsDisplay) {
                        // First, make sure auto-scrolling is enabled when entering sync mode
                        currentLyricsDisplay.autoScrollEnabled = true;
                        
                        // Ensure current position is visible in lyrics view
                        const activeLineIndex = this.markerManager.getActiveLineAtTime(currentTime);
                        
                        if (activeLineIndex >= 0) {
                            // Immediately activate the current line at this time position
                            window.lyricsDisplay.setActiveLine(activeLineIndex);
                            console.log("Sync mode: activating line at current time position:", activeLineIndex);
                        } else {
                            // If no active line for current position, fallback to first unmarked line
                            this._activateFirstUnmarkedLine();
                        }
                        
                        // ПРИНУДИТЕЛЬНОЕ центрирование активной строчки в Sync Editor
                        setTimeout(() => {
                            const isRehearsal = (document.body && document.body.classList.contains("mode-rehearsal")) ||
                                                (window.textStyleManager && window.textStyleManager.currentStyleId === "rehearsal");
                            const treatAsTeleprompter = document.body.classList.contains("mode-karaoke") || document.body.classList.contains("mode-concert");
                            if (!isRehearsal || treatAsTeleprompter) {
                                this._centerActiveLineInSyncEditor();
                            } else {
                                console.log("Sync Editor: Initial centering suppressed in rehearsal mode");
                            }
                        }, 150); // Увеличил задержку для стабильности
                    }
                }
                
                // Update playhead position
                if (this.audioEngine) {
                    this._updatePlayhead(currentTime);
                }
                
                // Создаем и диспатчим событие открытия редактора
            const event = new CustomEvent("sync-editor-opened", { 
                    detail: {
                        isLoopEnabled: this.isLoopEnabled,
                        loopStart: this.loopStart,
                        loopEnd: this.loopEnd
                    }
                });
            document.dispatchEvent(event);
                console.log("WaveformEditor: Dispatched sync-editor-opened event", event.detail);
            });
            
            console.log("WaveformEditor: Shown");
        }
    }

    /**
     * Центрирует активную строчку в Sync Editor
     * @private
     */
    _centerActiveLineInSyncEditor() {
        // Подавляем центровку в режиме репетиции
        const isRehearsal = (document.body && document.body.classList.contains("mode-rehearsal")) ||
                            (window.textStyleManager && window.textStyleManager.currentStyleId === "rehearsal");
        if (isRehearsal) {
            console.log("Sync Editor: Centering suppressed in rehearsal mode");
            return;
        }
        const currentLyricsDisplay = window.lyricsDisplay;
        if (currentLyricsDisplay && currentLyricsDisplay.currentLyricElement) {
            // SYNC EDITOR TELEPROMPTER MODE - активная строка прикреплена к верху как в концертном режиме
            const activeElement = currentLyricsDisplay.currentLyricElement;
            
            // Используем точно такую же механику как в концертном режиме
            activeElement.scrollIntoView({
                behavior: "smooth", // Плавная анимация для комфорта
                block: "start",     // ПРИКРЕПЛЯЕМ К ВЕРХУ ЭКРАНА!
                inline: "nearest"
            });
            
            const lineIndex = parseInt(activeElement.dataset.index) || 0;
            console.log(`Sync Editor: Positioned line ${lineIndex} at TOP (teleprompter mode)`);
        }
    }
    
    /**
     * Activate the first line that doesn't have a marker yet
     * @private
     */
    _activateFirstUnmarkedLine() {
        if (!this.markerManager || !window.lyricsDisplay) {
            console.log("WaveformEditor: _activateFirstUnmarkedLine - markerManager or lyricsDisplay not available.");
            return;
        }

        const markers = this.markerManager.getMarkers();
        const totalLines = window.lyricsDisplay.lyrics ? window.lyricsDisplay.lyrics.length : 0;

        console.log("WaveformEditor: _activateFirstUnmarkedLine called.");
        console.log("WaveformEditor: Markers length:", markers.length);
        console.log("WaveformEditor: Total lyric lines from lyricsDisplay:", totalLines);

        // If no markers, activate the first line
        if (markers.length === 0 && totalLines > 0) {
            console.log("WaveformEditor: No markers found, attempting to activate line 0.");
            window.lyricsDisplay.setActiveLine(0);
            return;
        }

        // Find the first unmarked line
        for (let i = 0; i < totalLines; i++) {
            // Check if this line has a marker
            const hasMarker = markers.some(marker => marker.lineIndex === i);
            
            if (!hasMarker) {
                // Found an unmarked line, activate it
                window.lyricsDisplay.setActiveLine(i);
                return;
            }
        }
        
        // If all lines have markers, activate the first line
        if (totalLines > 0) {
            window.lyricsDisplay.setActiveLine(0);
        }
    }
    
    // Hide editor
    hide() {
        if (this.container) {
            // Remove body class
            document.body.classList.remove("waveform-active");
            
            // Удаляем слушатель центровки активной строки
            if (this._syncEditorCenteringHandler) {
                document.removeEventListener("active-line-changed", this._syncEditorCenteringHandler);
                this._syncEditorCenteringHandler = null;
            }
            
            this.container.style.display = "none";
            this.isVisible = false;
            
            // Восстанавливаем оригинальный стиль и масштаб
            if (window.textStyleManager && this.preSyncStyleId !== undefined && this.preSyncScale !== undefined) {
                console.log(`Sync Editor: Restoring original style "${this.preSyncStyleId}" and scale ${this.preSyncScale}`);
                
                window.textStyleManager.setStyle(this.preSyncStyleId); // Восстанавливаем стиль
                
                // Проверяем, что масштаб является числом перед восстановлением
                if (typeof this.preSyncScale === "number" && !isNaN(this.preSyncScale)) {
                    window.textStyleManager.setFontScale(this.preSyncScale); // Восстанавливаем масштаб
                } else {
                    console.warn(`Sync Editor: Invalid scale value ${this.preSyncScale}, not restoring`);
                }
                
                // Очищаем сохраненные значения
                this.preSyncStyleId = undefined;
                this.preSyncScale = undefined;
            }
            
            // Создаем и диспатчим событие закрытия редактора
            const event = new CustomEvent("sync-editor-closed");
            document.dispatchEvent(event);
            console.log("WaveformEditor: Dispatched sync-editor-closed event");
            
            console.log("WaveformEditor: Hidden");
        }
    }
    
    // Toggle editor visibility
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    // Clear all data
    clear() {
        this.audioData = null;
        this.audioDuration = 0;
        this._drawWaveform();
    }
    
    /**
     * Clean up resources and event listeners
     */
    cleanup() {
        // Unregister event listeners
        if (this.audioEngine) {
            this.audioEngine.removeEventListener("positionUpdate", this._updatePlayheadBound);
            this.audioEngine.removeEventListener("trackLoaded", this._loadAudioDataBound);
        }
        
        // Удаляем глобальный слушатель позиции
        document.removeEventListener("audio-position-changed", this._handlePositionChangeBound);
        
        // Unsubscribe from marker manager
        if (this.markerManager) {
            // Assuming the subscribe method returns an unsubscribe function
            // If not, we'll need to add that functionality to MarkerManager
        }
        
        // Hide the editor
        this.hide();
        
        // Remove container from DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        console.log("WaveformEditor cleaned up");
    }
    
    /**
     * Save current markers to the track (without downloading file)
     * @private
     */
    _saveMarkersToTrack() {
        if (!this.markerManager) {
            console.error("Marker manager not available");
            return false;
        }
        
        // Save markers to track catalog only
        const success = this.markerManager.saveMarkersToTrack();
        
        if (!success) {
            console.error("Failed to save markers to track");
        }
        
        return success;
    }
    
    /**
     * Save current markers to the track and download as file
     * @private
     */
    _saveMarkers() {
        console.log("WaveformEditor: Starting _saveMarkers");
        
        if (!this.markerManager) {
            console.error("Marker manager not available");
            alert("Marker manager not available");
            return false;
        }
        
        // Проверяем наличие трекКаталога
        const trackCatalog = window.trackCatalog;
        if (!trackCatalog) {
            console.error("Track catalog not available");
            alert("Track catalog not available");
            return false;
        }
        
        console.log("TrackCatalog status:", {
            exists: !!trackCatalog,
            tracksLength: trackCatalog.tracks ? trackCatalog.tracks.length : 0,
            currentTrackIndex: trackCatalog.currentTrackIndex
        });
        
        // Save markers to track catalog first
        const success = this.markerManager.saveMarkersToTrack();
        console.log("Save to track result:", success);
        
        if (success) {
            // Get current track and markers
            if (trackCatalog.currentTrackIndex < 0 || trackCatalog.currentTrackIndex >= trackCatalog.tracks.length) {
                console.error("Invalid current track index:", trackCatalog.currentTrackIndex);
                alert("No valid track selected for saving markers");
                return false;
            }
            
            const currentTrack = trackCatalog.tracks[trackCatalog.currentTrackIndex];
            const markers = this.markerManager.getMarkers();
            
            console.log("Current track:", currentTrack);
            console.log("Markers count:", markers.length);
            
            // Получаем блоки из lyrics display если есть
            let textBlocks = [];
            if (window.lyricsDisplay && window.lyricsDisplay.textBlocks) {
                textBlocks = window.lyricsDisplay.getTextBlocksForExport();
                console.log("Text blocks count:", textBlocks.length);
            }
            
            // Create track backup data
            const trackData = {
                id: currentTrack.id,
                title: currentTrack.title,
                savedAt: new Date().toISOString(),
                markers: markers,
                lyrics: currentTrack.lyrics || "",
                textBlocks: textBlocks
            };
            
            console.log("Track data prepared for export:", trackData);
            
            try {
                // Convert to JSON
                const jsonData = JSON.stringify(trackData, null, 2);
                
                // Add UTF-8 BOM to ensure proper encoding for Cyrillic characters
                const utf8BomJsonData = "\uFEFF" + jsonData;
                
                // Create filename based on track title - preserve original name
                const fileName = `text_track_${currentTrack.title}.json`;
                
                console.log("Creating download for file:", fileName);
                
                // Create download link
                const blob = new Blob([utf8BomJsonData], { type: "application/json;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                a.style.display = "none";
                
                // Trigger download
                document.body.appendChild(a);
                a.click();
                
                console.log("Download triggered successfully");
                
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    console.log("Download cleanup completed");
                }, 100);
                
                alert(`Markers saved to file: ${fileName}`);
                return true;
            } catch (error) {
                console.error("Error saving markers to file:", error);
                alert("Markers saved in the track catalog, but file export failed: " + error.message);
                return false;
            }
        } else {
            alert("Failed to save markers. Please ensure a track is loaded.");
            return false;
        }
    }
    
    /**
     * Обновляет список выбранных маркеров на основе текущего выделения
     * @private
     */
    _updateSelectedMarkers() {
        if (!this.markerManager) {return;}
        
        // Получаем все маркеры
        const allMarkers = this.markerManager.getMarkers();
        
        // Определяем границы выделения
        const minTime = Math.min(this.selectionStart, this.selectionEnd);
        const maxTime = Math.max(this.selectionStart, this.selectionEnd);
        
        // Фильтруем маркеры, которые попадают в выделение
        this.selectedMarkers = allMarkers.filter(marker => 
            marker.time >= minTime && marker.time <= maxTime
        );
        
        console.log(`Selected ${this.selectedMarkers.length} markers`);
    }
    
    /**
     * Обновляет отображение выделения
     * @private
     */
    _updateSelectionDisplay() {
        if (!this.selectionElement) {return;}
        
        if (this.selectionStart === null || this.selectionEnd === null) {
            this.selectionElement.style.display = "none";
            return;
        }
        
        // Get min/max for display
        const startTime = Math.min(this.selectionStart, this.selectionEnd);
        const endTime = Math.max(this.selectionStart, this.selectionEnd);
        
        // Convert to pixels for display
        const startX = this._timeToPixels(startTime);
        const endX = this._timeToPixels(endTime);
        const width = Math.abs(endX - startX);
        
        // Display selection
        this.selectionElement.style.display = "block";
        this.selectionElement.style.left = `${startX}px`;
        this.selectionElement.style.width = `${width}px`;
        this.selectionElement.style.backgroundColor = "rgba(0, 255, 0, 0.2)";
        
        // Show selection info
        const duration = endTime - startTime;
        console.log(`Selection: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${duration.toFixed(2)}s)`);
    }
    
    /**
     * Очищает текущее выделение
     * @private
     */
    _clearSelection() {
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.selectedMarkers = [];
        this._updateSelectionDisplay();
        this._drawWaveform();
    }
    
    /**
     * Удаляет выбранные маркеры
     * @private
     */
    _deleteSelectedMarkers() {
        if (!this.markerManager || this.selectedMarkers.length === 0) {
            alert("No markers selected. Shift+click and drag to select markers.");
            return;
        }
        
        if (confirm(`Delete ${this.selectedMarkers.length} selected markers?`)) {
            // Удаляем каждый выбранный маркер
            this.selectedMarkers.forEach(marker => {
                this.markerManager.deleteMarker(marker.id);
            });
            
            // Очищаем выделение
            this._clearSelection();
            
            // Перерисовываем
            this._drawWaveform();
            
            console.log(`Deleted ${this.selectedMarkers.length} markers`);
        }
    }
    
    /**
     * Сбрасывает все маркеры
     * @private
     */
    _resetAllMarkers() {
        if (!this.markerManager) {return;}
        
        if (confirm("Delete ALL markers? This cannot be undone!")) {
            this.markerManager.resetMarkers();
            this._clearSelection();
            this._drawWaveform();
            console.log("All markers have been reset");
        }
    }
    
    /**
     * Add marker at current playhead position
     * @private
     */
    _addMarkerAtPlayhead() {
        if (!this.markerManager || !this.showMarkers) {return;}
        
        // Get current time from audio engine
        const currentTime = this.audioEngine ? this.audioEngine.getCurrentTime() : 0;
        
        // Call helper method to add marker at this time
        this._addMarkerAtTime(currentTime);
    }
    
    /**
     * Add marker at specified time, finding the closest lyric line
     * @param {number} time - Time in seconds to add marker
     * @private
     */
    _addMarkerAtTime(time) {
        if (!this.markerManager || !this.showMarkers || !window.lyricsDisplay) {return;}
        
        // Get all lyric lines
        const lines = document.querySelectorAll(".lyric-line");
        if (!lines || lines.length === 0) {
            console.log("No lyric lines found to add marker");
            return;
        }
        
        // First try to use the active line
        const activeLine = document.querySelector(".lyric-line.active");
        if (activeLine) {
            const lineIndex = parseInt(activeLine.dataset.index, 10);
            if (!isNaN(lineIndex) && lineIndex >= 0) {
                // Add marker for the active line
                this.markerManager.addMarker(lineIndex, time);
                
                // Visual feedback
                activeLine.classList.add("flash-highlight");
                setTimeout(() => {
                    activeLine.classList.remove("flash-highlight");
                }, 200);
                
                // Force redraw of waveform
                this._drawWaveform();
                return;
            }
        }
        
        // If no active line or it's invalid, find a suitable line
        // Ask marker manager for the active line at this time
        const lineIndex = this.markerManager.getActiveLineAtTime(time);
        
        if (lineIndex >= 0) {
            // Found a line, add marker
            this.markerManager.addMarker(lineIndex, time);
            
            // Flash the line for visual feedback
            const lineElement = document.querySelector(`.lyric-line[data-index="${lineIndex}"]`);
            if (lineElement) {
                lineElement.classList.add("flash-highlight");
                setTimeout(() => {
                    lineElement.classList.remove("flash-highlight");
                }, 200);
            }
            
            // Force redraw of waveform
            this._drawWaveform();
        } else {
            console.log("No suitable line found for marker at time:", time);
        }
    }
    
    // Resize canvas to fill container
    _resizeCanvas() {
        if (!this.canvas || !this.container) {return;}
        
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight - this.header.clientHeight;
        
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        
        this.canvasWidth = this.canvas.width;
        this.canvasHeight = this.canvas.height;
        
        // Update playhead height
        this.playhead.style.height = `${containerHeight}px`;
        
        // Calculate pixels per second based on zoom
        if (this.audioDuration) {
            const totalWidth = (containerWidth * 100) / this.zoom;
            this.pixelsPerSecond = totalWidth / this.audioDuration;
        }
    }
    
    /**
     * Draw loop region on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @private
     */
    _drawLoopRegion(ctx) {
        if (!this.loopActive || this.loopStart === null || this.loopEnd === null) {return;}
        
        // We'll only draw thin lines for loop region boundaries, not the region itself
        const startX = this._timeToPixels(this.loopStart);
        const endX = this._timeToPixels(this.loopEnd);
        
        // Skip if loop region is completely outside visible area
        if ((startX < 0 && endX < 0) || (startX > this.canvasWidth && endX > this.canvasWidth)) {
            return;
        }
        
        // Don't draw the filled region on canvas to avoid the "ghost" effect
        // Instead only draw thin lines at start and end
        
        // Draw loop borders
        ctx.strokeStyle = "rgba(255, 200, 50, 0.8)";
        ctx.lineWidth = 1;
        
        // Draw start line
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, this.canvasHeight);
        ctx.stroke();
        
        // Draw end line
        ctx.beginPath();
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, this.canvasHeight);
        ctx.stroke();
    }
    
    /**
     * Toggle loop on/off or create a new loop
     */
    _toggleLoop() {
        // If no loop exists yet, create one at playhead position
        if (this.loopStart === null || this.loopEnd === null || isNaN(this.loopStart) || isNaN(this.loopEnd)) {
            console.log("No loop exists, creating one at playhead position");
            this.createLoopAtPlayhead();
            return;
        }
        
        // If we have a selection, create loop from selection
        if (!this.loopActive && this.selectionStart !== null && this.selectionEnd !== null &&
            Math.abs(this.selectionEnd - this.selectionStart) > 0.1) {
            console.log("Creating loop from current selection");
            this.createLoopFromSelection();
            return;
        }
        
        // Toggle existing loop
        this.loopActive = !this.loopActive;
        
        // Update UI
        if (this.loopToggleBtn) {
            this.loopToggleBtn.textContent = this.loopActive ? "Loop: On" : "Loop: Off";
            this.loopToggleBtn.classList.toggle("active", this.loopActive);
        }
        
        // Update loop in audio engine
        if (this.audioEngine) {
            if (this.loopActive && this.loopStart !== null && this.loopEnd !== null) {
                this.audioEngine.setLoop(this.loopStart, this.loopEnd);
            } else {
                this.audioEngine.clearLoop();
            }
        }
        
        // Update visual display
        this._updateLoopDisplay();
        this._drawWaveform();
        
        console.log(`Loop ${this.loopActive ? "enabled" : "disabled"}`);
    }
    
    /**
     * Create a loop from the current selection
     */
    createLoopFromSelection() {
        if (this.selectionStart === null || this.selectionEnd === null) {
            console.log("No selection available to create loop");
            return;
        }
        
        // Get min/max times from selection
        const start = Math.min(this.selectionStart, this.selectionEnd);
        const end = Math.max(this.selectionStart, this.selectionEnd);
        
        // Ensure loop has minimum size
        if (end - start < 0.1) {
            console.warn("Selection too small for loop");
            return;
        }
        
        // Set loop times
        this.loopStart = start;
        this.loopEnd = end;
        
        // Enable loop if not already active
            this.loopActive = true;
            
            // Update button state
            if (this.loopToggleBtn) {
                this.loopToggleBtn.textContent = "Loop: On";
                this.loopToggleBtn.classList.add("active");
        }
        
        // Clear selection after creating loop
        this._clearSelection();
        
        // Update loop in audio engine
        if (this.audioEngine) {
            this.audioEngine.setLoop(this.loopStart, this.loopEnd);
        }
        
        // Update visual display
        this._updateLoopDisplay();
        
        console.log(`Loop set from selection: ${this.loopStart.toFixed(2)}s - ${this.loopEnd.toFixed(2)}s`);
    }
    
    /**
     * Clear the current loop
     * @private
     */
    _clearLoop() {
        this.loopActive = false;
        
        // Update button state
        if (this.loopToggleBtn) {
            this.loopToggleBtn.textContent = "Loop: Off";
            this.loopToggleBtn.classList.remove("active");
        }
        
        // Clear loop in audio engine
        if (this.audioEngine) {
            this.audioEngine.clearLoop();
        }
        
        // Update visual display
        this._updateLoopDisplay();
        
        console.log("Loop cleared");
    }
    
    /**
     * Create a loop at the current playhead position with default duration
     */
    createLoopAtPlayhead() {
        if (!this.audioEngine || !this.audioDuration) {
            console.warn("Cannot create loop: Audio not loaded");
            return;
        }
        
        const currentTime = this.audioEngine.getCurrentTime();
        const loopDuration = 4; // Default loop length in seconds
        
        let loopStart = currentTime;
        let loopEnd = currentTime + loopDuration;
        
        // Ensure loop end doesn't exceed audio duration
        if (loopEnd > this.audioDuration) {
            loopEnd = this.audioDuration;
            loopStart = Math.max(0, loopEnd - loopDuration);
        }
        
        // Set loop times
        this.loopStart = loopStart;
        this.loopEnd = loopEnd;
        
        // Enable loop
            this.loopActive = true;
            
            // Update button state
            if (this.loopToggleBtn) {
                this.loopToggleBtn.textContent = "Loop: On";
                this.loopToggleBtn.classList.add("active");
        }
        
        // Update loop in audio engine
        if (this.audioEngine) {
            this.audioEngine.setLoop(this.loopStart, this.loopEnd);
        }
        
        // Update visual display
        this._updateLoopDisplay();
        
        console.log(`Loop created at playhead: ${this.loopStart.toFixed(2)}s - ${this.loopEnd.toFixed(2)}s`);
    }
    
    /**
     * Update the visual display of the loop region
     * @private
     */
    _updateLoopDisplay() {
        if (!this.loopElement || !this.loopStartHandle || !this.loopEndHandle || !this.loopBottomHandle) {
            console.warn("Loop display elements not initialized");
            return;
        }
        
        // If loop is not active or loop times are invalid, hide all loop elements
        if (!this.loopActive || this.loopStart === null || this.loopEnd === null || 
            isNaN(this.loopStart) || isNaN(this.loopEnd) || this.loopStart >= this.loopEnd) {
            
            this.loopElement.style.display = "none";
            this.loopStartHandle.style.display = "none";
            this.loopEndHandle.style.display = "none";
            this.loopBottomHandle.style.display = "none";
            
            // If there's an error with loop settings, log it
            if (this.loopActive && (this.loopStart === null || this.loopEnd === null || 
                isNaN(this.loopStart) || isNaN(this.loopEnd))) {
                console.warn("Loop is active but times are invalid:", this.loopStart, this.loopEnd);
            }
            
            // Force a canvas redraw to remove any ghost marks
            this._drawWaveform();
            return;
        }
        
        // Ensure loop times are valid
        const safeLoopStart = Math.max(0, this.loopStart);
        const safeLoopEnd = Math.min(this.audioDuration, this.loopEnd);
        
        // Calculate position and width based on current mode
        const loopStartPixels = this._timeToPixels(safeLoopStart);
        const loopEndPixels = this._timeToPixels(safeLoopEnd);
        const loopWidth = Math.max(1, loopEndPixels - loopStartPixels); // Ensure minimum width
        
        // Check if loop is visible in the current view
        if (loopEndPixels < 0 || loopStartPixels > this.canvasWidth) {
            console.log("Loop outside visible area, hiding");
            this.loopElement.style.display = "none";
            this.loopStartHandle.style.display = "none"; 
            this.loopEndHandle.style.display = "none";
            this.loopBottomHandle.style.display = "none";
            return;
        }
        
        // Position and show the loop region
        this.loopElement.style.display = "block";
        this.loopElement.style.left = `${loopStartPixels}px`;
        this.loopElement.style.width = `${loopWidth}px`;
        
        // Position and show the loop start handle
        this.loopStartHandle.style.display = "block";
        this.loopStartHandle.style.left = `${loopStartPixels - 2.5}px`; // Center the 5px wide handle
        
        // Position and show the loop end handle
        this.loopEndHandle.style.display = "block";
        this.loopEndHandle.style.left = `${loopEndPixels - 2.5}px`; // Center the 5px wide handle
        
        // Position and show the loop bottom handle
        this.loopBottomHandle.style.display = "block";
        this.loopBottomHandle.style.left = `${loopStartPixels}px`;
        this.loopBottomHandle.style.width = `${loopWidth}px`;
        
        // Force a redraw of the canvas to remove any previous loop region "ghost"
        this._drawWaveform();
        
        console.log(`Loop display updated: ${safeLoopStart.toFixed(2)}s - ${safeLoopEnd.toFixed(2)}s`);
    }
    
    // Toggle markers visibility
    _toggleMarkers() {
        this.showMarkers = !this.showMarkers;
        
        // Update button text
        if (this.markersToggleBtn) {
            this.markersToggleBtn.textContent = this.showMarkers ? "Markers: On" : "Markers: Off";
            this.markersToggleBtn.classList.toggle("active", this.showMarkers);
        }
        
        // 🎨 ОБНОВЛЯЕМ ЦВЕТА МАРКЕРОВ ПРИ АКТИВАЦИИ
        if (this.showMarkers && this.markerManager) {
            console.log("WaveformEditor: Updating marker colors on activation...");
            this.markerManager.updateMarkerColors();
        }
        
        this._drawWaveform();
    }
    
    // Добавляем новые методы для обработки перетаскивания маркеров
    _handleMarkerDragStart(e) {
        // Проверяем видимость маркеров
        if (!this.markerManager || !this.showMarkers) {return;}
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Получаем маркеры из менеджера маркеров
        const markers = this.markerManager.getMarkers();
        if (!markers || markers.length === 0) {return;}
        
        // Проверяем, попал ли клик на маркер
        for (let i = 0; i < markers.length; i++) {
            const marker = markers[i];
            const markerX = this._timeToPixels(marker.time);
            
            // Проверяем, находится ли курсор достаточно близко к маркеру
            // Используем область захвата (10px с каждой стороны)
            if (Math.abs(x - markerX) <= 10) {
                // Сохраняем маркер и начальные значения
                this.draggedMarker = marker;
                this.dragStartX = x;
                this.dragStartTime = marker.time;
                
                // Отмечаем маркер как перетаскиваемый
                this.isDraggingMarker = true;
                
                // Устанавливаем курсор
                this.canvas.style.cursor = "ew-resize";
                
                // Добавляем маркер в выделенные
                this.selectedMarkers = [marker];
                
                // Предотвращаем дальнейшую обработку
                e.preventDefault();
                e.stopPropagation();
                
                console.log("Началось перетаскивание маркера:", marker.id);
                break;
            }
        }
    }

    _handleMarkerDrag(e) {
        if (!this.isDraggingMarker || !this.draggedMarker) {return;}
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        // Вычисляем новое время для маркера напрямую из текущей позиции мыши
        // вместо использования относительного смещения
        const newTime = this._pixelsToTime(x);
        
        // Ограничиваем новое время в пределах длительности трека
        const boundedTime = Math.max(0, Math.min(newTime, this.audioDuration));
        
        // Обновляем время маркера
        if (this.draggedMarker) {
            this.draggedMarker.time = boundedTime;
            
            // Обновляем отображение
            this._drawWaveform();
            
            // Если есть менеджер маркеров, обновляем его
            if (this.markerManager && typeof this.markerManager.updateMarker === "function") {
                this.markerManager.updateMarker(
                    this.draggedMarker.id, 
                    { time: boundedTime }
                );
            }
            
            console.log(`Перетаскивание маркера ${this.draggedMarker.id} на ${boundedTime.toFixed(2)}s`);
        }
    }

    _handleMarkerDragEnd(e) {
        if (!this.isDraggingMarker) {return;}
        
        // Предотвращаем дальнейшую обработку и всплытие события
        // чтобы избежать запуска воспроизведения из-за клика по canvas
        e.preventDefault();
        e.stopPropagation();
        
        // Устанавливаем флаг, чтобы игнорировать следующий клик по canvas
        this.ignoringNextClick = true;
        
        // Сохраняем изменения в маркерах
        if (this.markerManager && this.draggedMarker) {
            this.markerManager.updateMarker(
                this.draggedMarker.id, 
                { time: this.draggedMarker.time }
            );
            
            // Сохраняем маркеры в базе данных, но НЕ загружаем файл
            this._saveMarkersToTrack();
            
            console.log("Завершено перетаскивание маркера:", this.draggedMarker.id);
        }
        
        // Сбрасываем состояние перетаскивания
        this.isDraggingMarker = false;
        this.draggedMarker = null;
        this.canvas.style.cursor = "default";
        
        // Перерисовываем
        this._drawWaveform();
    }
    
    /**
     * Open text editor for lyrics
     * @private
     */
    async _openNewBlockEditor() {
        console.log("WaveformEditor: Opening NEW block editor for track:", this.currentTrackId);
        
        // Проверяем наличие трека
        if (!this.currentTrackId) {
            this._showNotification("Ошибка: Трек не выбран", "error");
            console.error("WaveformEditor: No currentTrackId available");
            return;
        }
        
        if (!window.trackCatalog) {
            this._showNotification("Ошибка: Каталог треков недоступен", "error");
            console.error("WaveformEditor: TrackCatalog not available");
            return;
        }
        
                 const track = window.trackCatalog.tracks.find(t => t.id === this.currentTrackId);
        if (!track) {
            this._showNotification("Ошибка: Трек не найден", "error");
            console.error("WaveformEditor: Track not found for ID:", this.currentTrackId);
            return;
        }
        
        // Получаем ОРИГИНАЛЬНЫЙ текст с сохранением форматирования
        let currentLyrics = "";
        
        // 🎯 ИСПРАВЛЕНО: Для RTF файлов сначала парсим, потом передаем в редактор
        if (track.lyricsOriginalContent) {
            console.log("Using ORIGINAL lyrics from track.lyricsOriginalContent. Length:", track.lyricsOriginalContent.length);
            
            // Проверяем если это RTF - парсим его
            if (track.lyricsOriginalContent.trim().startsWith("{\\rtf")) {
                console.log("WaveformEditor: Парсим RTF перед передачей в редактор блоков");
                try {
                    const raw = String(track.lyricsOriginalContent);
                    let txt;
                    if (window.SimpleRtf && typeof window.SimpleRtf.toText === "function") {
                        // Предпочтительно: синхронный парс с сохранением абзацев
                        txt = window.SimpleRtf.toText(raw);
                    } else {
                        // Фоллбэк: ваш ручной парсинг
                        txt = raw
                            .replace(/\\par\b\s*\\par\b/g, "\n\n")
                            .replace(/\\line\b\s*\\line\b/g, "\n\n")
                            .replace(/\\par\b/g, "\n")
                            .replace(/\\line\b/g, "\n")
                            .replace(/\\u(-?\d+)\s?/g, (m, numStr) => {
                            let code = parseInt(numStr, 10);
                                if (code < 0) { code = 65536 + code; } // корректировка отрицательных
                            try { return String.fromCharCode(code); } catch (_) { return ""; }
                            })
                            .replace(/\\'([0-9a-fA-F]{2})/g, (m, hex) => {
                            try {
                                if (typeof TextDecoder !== "undefined") {
                                    const dec = new TextDecoder("windows-1251");
                                    const u8 = new Uint8Array([parseInt(hex, 16)]);
                                    return dec.decode(u8);
                                }
                            } catch (_) { /* ignore */ }
                            return String.fromCharCode(parseInt(hex, 16));
                            })
                            // Удаляем управляющие слова, не трогая переводы строк
                            .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
                            .replace(/[{}]/g, "");
                    }
                    // Нормализуем переносы: CRLF→LF, 3+ → 2 (сохраняем абзацы)
                    txt = txt.replace(/\r\n|\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
                    currentLyrics = txt;
                        console.log("WaveformEditor: SIMPLE-RTF parsed for BlockEditor, length:", currentLyrics.length);

                    // ✅ ОТЛАДКА: Проверяем результат парсинга
                    console.log('=== ОТЛАДКА: Результат парсинга RTF для редактора блоков ===');
                    console.log('Длина текста:', currentLyrics.length);
                    console.log('Количество строк:', currentLyrics.split('\n').length);
                    console.log('Количество двойных переносов (\\n\\n):', (currentLyrics.match(/\n\n/g) || []).length);
                    console.log('Есть ли RTF-теги (\\\\):', currentLyrics.includes('\\'));
                    console.log('Есть ли фигурные скобки:', currentLyrics.includes('{') || currentLyrics.includes('}'));
                    console.log('Первые 400 символов:');
                    console.log(currentLyrics.substring(0, 400));
                    console.log('=====================================================');

                } catch (error) {
                    console.error("WaveformEditor: Ошибка парсинга RTF:", error);
                    currentLyrics = track.lyricsOriginalContent;
                }
            } else {
                currentLyrics = track.lyricsOriginalContent;
            }
        } else if (track.lyrics) {
            currentLyrics = track.lyrics;
            console.log("Using track.lyrics. Length:", currentLyrics.length);
        } else if (window.lyricsDisplay && window.lyricsDisplay.fullText) {
            currentLyrics = window.lyricsDisplay.fullText;
            console.log("Using lyrics from lyricsDisplay.fullText. Length:", currentLyrics.length);
        }
        
        // Создаем или используем существующий экземпляр ModalBlockEditor
        if (!this.modalBlockEditor) {
            this.modalBlockEditor = new ModalBlockEditor();
        }
        
        // Fallback: если в currentLyrics нет пустых строк как разделителей — пробуем собрать блоки из уже загруженных строк LyricsDisplay
        try {
            const hasDoubleNewlines = /\n\s*\n/.test(currentLyrics || "");
            if (!hasDoubleNewlines && window.lyricsDisplay && Array.isArray(window.lyricsDisplay.lyrics) && window.lyricsDisplay.lyrics.length > 0) {
                const lines = window.lyricsDisplay.lyrics.map(l => String(l || "").trim()).filter(Boolean);
                const blocks = [];
                const boundary = /(\[?\s*(припев|проигрыш)\s*\]?)/i;
                let acc = [];
                for (const line of lines) {
                    if (boundary.test(line)) {
                        if (acc.length) { blocks.push(acc.join("\n")); acc = []; }
                        blocks.push(line);
                        continue;
                    }
                    acc.push(line);
                    if (acc.length >= 2) { blocks.push(acc.join("\n")); acc = []; }
                }
                if (acc.length) {blocks.push(acc.join("\n"));}
                if (blocks.length > 0) {
                    currentLyrics = blocks.join("\n\n");
                    console.log("WaveformEditor: Applied LyricsDisplay fallback, blocks:", blocks.length);
                }
            }
        } catch (e) { console.warn("WaveformEditor: LyricsDisplay fallback failed", e); }
        
        // Инициализируем редактор с оригинальным текстом
        this.modalBlockEditor.init(
            currentLyrics,
            track,
            // 🎯 ИСПРАВЛЕННЫЙ Callback для сохранения (новый формат: editedBlocks, newLyricsText, savedTrackInfo)
            async (editedBlocks, newLyricsText, savedTrackInfo) => { // Добавляем newLyricsText
                console.log("WaveformEditor: Block editor save callback triggered");
                console.log("WaveformEditor: Edited blocks:", editedBlocks);
                console.log("WaveformEditor: New lyrics text from editor:", newLyricsText ? newLyricsText.substring(0, 50) + '...' : 'No text');
                console.log("WaveformEditor: Track info:", savedTrackInfo);
                
                if (window.trackCatalog && this.currentTrackId) {
                    try {
                        // 🎯 СОХРАНЯЕМ БЛОКИ И ТЕКСТ НАПРЯМУЮ, ИСПОЛЬЗУЯ newLyricsText ИЗ РЕДАКТОРА
                        console.log("WaveformEditor: Сохраняем блоки и текст через saveLyricsBlocks...");
                        window.trackCatalog.saveLyricsBlocks(this.currentTrackId, editedBlocks, newLyricsText);
                        
                        // 🎯 СРАЗУ ПРИМЕНЯЕМ БЛОКИ И ТЕКСТ К ОТОБРАЖЕНИЮ LYRICSDISPLAY
                        if (window.lyricsDisplay && typeof window.lyricsDisplay.loadImportedBlocks === "function") {
                            window.lyricsDisplay.loadImportedBlocks(editedBlocks, newLyricsText, true); // true для рендера
                        }

                        // 🎯 ОБНОВЛЯЕМ ЦВЕТА МАРКЕРОВ ПОСЛЕ ПРИМЕНЕНИЯ БЛОКОВ
                        if (window.markerManager && typeof window.markerManager.updateMarkerColors === "function") {
                            window.markerManager.updateMarkerColors();
                        }

                        if (window.app && typeof window.app.showNotification === 'function') {
                        window.app.showNotification("Текст и блоки сохранены успешно!", 'success'); // Добавляем уведомление
                        }
                        console.log("WaveformEditor: Текст и блоки сохранены успешно!");

                    } catch (error) {
                        console.error("WaveformEditor: Ошибка при сохранении блоков или текста:", error);
                        if (window.app && typeof window.app.showNotification === 'function') {
                            window.app.showNotification(`Ошибка сохранения: ${error.message || error}`, 'error');
                        }
                    }
                }
            },
            () => {
                console.log("WaveformEditor: Block editor cancel callback triggered");
                // TODO: Handle cancel if needed
                if (window.app && typeof window.app.showNotification === 'function') {
                window.app.showNotification("Редактирование блоков отменено.", 'info'); // Добавляем уведомление
                }
            }
        );
        
        // Показываем редактор
        this.modalBlockEditor.show();
    }
    
    /**
     * Show notification message
     * @param {string} message - The message to display
     * @param {string} type - The notification type (info, success, warning, error)
     * @private
     */
    _showNotification(message, type = "info") {
        console.log(`WaveformEditor notification: ${message}`);
        
        // Create notification element
        const notification = document.createElement("div");
        notification.className = `waveform-notification ${type}`;
        notification.textContent = message;
        
        // Add to container
        if (this.container) {
            this.container.appendChild(notification);
            
            // Remove after delay
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }
    
    /**
     * Переключает источник отображения волны
     * @param {string} source - Источник: 'vocals', 'instrumental', 'master'
     */
    async _switchWaveformSource(source) {
        console.log(`🔄 WaveformEditor: Начинаем переключение на источник: ${source}`);

        if (!this.audioEngine || !this.audioEngine.hybridEngine) {
            console.warn("❌ WaveformEditor: AudioEngine или hybridEngine недоступны");
            this._showNotification("Источники аудио недоступны", "error");
            return;
        }

        // 1. Обновить активную кнопку и текущий источник
        this._updateActiveButton(source);
        this.currentWaveformSource = source;

        try {
            if (source === "master") {
                // Для мастер-дорожки используем наложение инструментальной и вокальной волн
                this._showNotification("Загружаем компоненты для Мастер-вида...", "info");
                
                // Убеждаемся что у нас есть данные для обеих волн
                let needsInstrumentalLoad = !this.instrumentalAudioData;
                let needsVocalLoad = !this.vocalAudioData;
                
                // Загружаем недостающие данные
                if (needsInstrumentalLoad && this.audioEngine.hybridEngine.instrumentalUrl) {
                    const instrumentalBuffer = await this._loadBufferFromUrl(this.audioEngine.hybridEngine.instrumentalUrl);
                    if (!this.audioDuration) {this.audioDuration = instrumentalBuffer.duration;}
                    if (!this.sampleRate) {this.sampleRate = instrumentalBuffer.sampleRate;}
                    this.rawInstrumentalData = instrumentalBuffer.getChannelData(0);
                    this.instrumentalAudioData = this._generatePeaks(this.rawInstrumentalData);
                    console.log("✅ Instrumental data loaded for master view");
                }
                
                if (needsVocalLoad && this.audioEngine.hybridEngine.vocalsUrl) {
                    const vocalBuffer = await this._loadBufferFromUrl(this.audioEngine.hybridEngine.vocalsUrl);
                    if (!this.audioDuration) {this.audioDuration = vocalBuffer.duration;}
                    if (!this.sampleRate) {this.sampleRate = vocalBuffer.sampleRate;}
                    this.rawVocalData = vocalBuffer.getChannelData(0);
                    this.vocalAudioData = this._generatePeaks(this.rawVocalData);
                    console.log("✅ Vocal data loaded for master view");
                }
                
                console.log("✅ WaveformEditor: Master view prepared with overlay waves");
                this._drawWaveform();
                this._showNotification("Переключено на Мастер", "success");
            } else { // Обработка для 'vocals' и 'instrumental'
                const isVocal = source === "vocals";
                const targetDataProp = isVocal ? "vocalAudioData" : "instrumentalAudioData";
                const sourceUrl = isVocal ? this.audioEngine.hybridEngine.vocalsUrl : this.audioEngine.hybridEngine.instrumentalUrl;
                
                if (!sourceUrl) {
                    throw new Error(`${this._getSourceDisplayName(source)} URL is missing`);
                }

                this.currentWaveformColor = this._getSourceColor(source);

                if (this[targetDataProp]) {
                    console.log(`✅ Using cached data for ${source}`);
                    this._drawWaveform();
            } else {
                    this._showNotification(`Загружаем ${this._getSourceDisplayName(source)}...`, "info");
                    const buffer = await this._loadBufferFromUrl(sourceUrl);
                    if (!this.audioDuration) {this.audioDuration = buffer.duration;}
                    if (!this.sampleRate) {this.sampleRate = buffer.sampleRate;}
                    this[isVocal ? "rawVocalData" : "rawInstrumentalData"] = buffer.getChannelData(0);
                    this[targetDataProp] = this._generatePeaks(this[isVocal ? "rawVocalData" : "rawInstrumentalData"]);
                    console.log(`✅ Data loaded for ${source}`);
                    this._drawWaveform();
                }
                this._showNotification(`Переключено на ${this._getSourceDisplayName(source)}`, "success");
            }
            
        } catch (error) {
            console.error(`❌ WaveformEditor: Ошибка переключения на источник ${source}:`, error);
            this._showNotification(`Ошибка загрузки ${this._getSourceDisplayName(source)}`, "error");
        }
    }
    
    /**
     * Helper to load an ArrayBuffer from a URL and decode it.
     * @param {string} audioUrl 
     * @returns {Promise<AudioBuffer>}
     * @private
     */
    async _loadBufferFromUrl(audioUrl) {
        console.log(`🔄 WaveformEditor: Загружаем аудио из URL: ${audioUrl.substring(0, 50)}...`);
        
        // Проверяем на некорректные blob URL
        if (audioUrl.includes("blob:null/")) {
            console.warn("❌ WaveformEditor: Обнаружен некорректный blob:null URL, пропускаем загрузку");
            throw new Error("Invalid blob:null URL detected");
        }
        
        try {
            // Для data URL используем прямое декодирование
            if (audioUrl.startsWith("data:")) {
                console.log("📊 WaveformEditor: Обрабатываем data URL...");
                const response = await fetch(audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                
                const offlineContext = new OfflineAudioContext(1, 1, 44100);
                const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);
                console.log(`✅ WaveformEditor: Data URL декодирован, длительность: ${audioBuffer.duration.toFixed(2)}с`);
                return audioBuffer;
            }
            
            // Обычная загрузка для http/https/blob URL
        const response = await fetch(audioUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const offlineContext = new OfflineAudioContext(1, 1, 44100);
        const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);
            
            console.log(`✅ WaveformEditor: URL загружен, длительность: ${audioBuffer.duration.toFixed(2)}с`);
        return audioBuffer;
            
        } catch (error) {
            console.error(`❌ WaveformEditor: Ошибка загрузки из URL ${audioUrl.substring(0, 50)}:`, error);
            throw error;
        }
    }

    /**
     * Обновляет активное состояние кнопок
     * @param {string} source - Активный источник
     * @private
     */
    _updateActiveButton(source) {
        Object.keys(this.sourceButtons).forEach(key => {
            const button = this.sourceButtons[key];
            if (button) {
                button.classList.toggle("active", key === source);
            }
        });
    }
    
    /**
     * Загружает волну из URL
     * @param {string} audioUrl - URL аудио файла
     */
    async _loadWaveformFromUrl(audioUrl) {
        try {
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            
            // Декодируем аудио данные
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Обновляем данные волны
            this.audioBuffer = audioBuffer;
            this.audioDuration = audioBuffer.duration;
            
            // Генерируем пики для отображения
            const channelData = audioBuffer.getChannelData(0);
            this.peaks = this._generatePeaks(channelData);
            
            return true;
        } catch (error) {
            console.error("Error loading waveform from URL:", error);
            throw error;
        }
    }
    
    /**
     * Возвращает отображаемое имя источника
     * @param {string} source - Источник
     * @returns {string} - Отображаемое имя
     */
    _getSourceDisplayName(source) {
        switch (source) {
            case "vocals":
                return "Вокал";
            case "instrumental":
                return "Инструментал";
            case "master":
            default:
                return "Мастер";
        }
    }
    
    /**
     * Возвращает цвет для источника
     * @param {string} source - Источник
     * @returns {string} - Hex цвет
     */
    _getSourceColor(source) {
        if (window.colorService) {
            switch (source) {
                case "vocals":
                    return window.colorService.getVocalsColor();
                case "instrumental":
                    return window.colorService.getInstrumentalColor();
                case "master":
                    // Для мастера возвращаем цвет инструментала (базовый цвет)
                    return window.colorService.getInstrumentalColor();
                default:
                    return "#2196F3";
            }
        }
        
        // Fallback цвета если ColorService недоступен
        switch (source) {
            case "vocals":
                return "#FFD700";
            case "instrumental":
                return "#2196F3";
            case "master":
                return "#2196F3";
            default:
                return "#2196F3";
        }
    }

    /**
     * Переключить отображение выпадающего меню цветов
     */
    _toggleColorDropdown() {
        console.log("🎨 _toggleColorDropdown вызван, colorDropdown:", !!this.colorDropdown);
        
        if (!this.colorDropdown) {
            console.warn("🎨 colorDropdown не найден!");
            return;
        }

        const isCurrentlyActive = this.colorDropdown.classList.contains("active");
        console.log("🎨 Текущее состояние меню:", isCurrentlyActive ? "активно" : "скрыто");
        
        if (isCurrentlyActive) {
            // Закрываем меню
            this.colorDropdown.classList.remove("active");
            console.log("🎨 Меню закрыто");
        } else {
            // Открываем меню
            this.colorDropdown.classList.add("active");
            console.log("🎨 Меню открыто");
        }
        
        // Проверяем позицию и размеры для отладки
        const rect = this.colorDropdown.getBoundingClientRect();
        console.log("🎨 Позиция меню:", {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            visible: isCurrentlyActive ? "закрыто" : "открыто"
        });
    }

    /**
     * Скрыть выпадающее меню цветов
     */
    _hideColorDropdown() {
        // console.log("🎨 _hideColorDropdown вызван. Скрывает дропдаун цвета."); // Удаляем эту строку
        // Добавляем проверку, чтобы не закрывать наш AI picker, если он существует
        const aiPicker = document.getElementById('belive-ai-picker');
        if (aiPicker && aiPicker.classList.contains('open')) {
            // Если наш AI picker открыт, мы его не трогаем
            return;
        }

        if (this.colorDropdown) {
            this.colorDropdown.classList.remove("active");
        }
    }

    /**
     * Обновить состояние выпадающего меню цветов
     */
    _updateColorDropdown() {
        if (!this.colorDropdown || !window.colorService) {return;}
        
        const currentScheme = window.colorService.getCurrentScheme();
        const items = this.colorDropdown.querySelectorAll(".color-scheme-item");
        
        items.forEach(item => {
            if (item.dataset.schemeId === currentScheme.id) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
        
        // Обновляем отображение волн с новыми цветами
        this._drawWaveform();
        
        console.log(`🎨 Цветовая схема обновлена: ${currentScheme.name}`);
    }

    /**
     * Инициализация слушателя изменений цветовой схемы
     */
    _initColorServiceListener() {
        if (window.colorService) {
            window.colorService.addListener((scheme) => {
                this._updateColorDropdown();
            });
        }
    }

    /**
     * Загружает данные для обеих волновых форм (инструментальной и вокальной).
     * @param {string} instrumentalUrl URL для инструментальной дорожки.
     * @param {string} vocalsUrl URL для вокальной дорожки.
     * @returns {Promise<void>}
     */
    async loadDualWaveforms(instrumentalUrl, vocalsUrl) {
        console.log(`WaveformEditor: Загрузка двойных волновых форм. Инструментал: ${instrumentalUrl}, Вокал: ${vocalsUrl}`);
        // Авто-подмена blob:null на безопасные URL из audioEngine.hybridEngine
        if (this.audioEngine && this.audioEngine.hybridEngine) {
            if (instrumentalUrl && instrumentalUrl.includes("blob:null/")) {
                const safeI = this.audioEngine.hybridEngine.instrumentalUrl;
                if (safeI) {instrumentalUrl = safeI;}
            }
            if (vocalsUrl && vocalsUrl.includes("blob:null/")) {
                const safeV = this.audioEngine.hybridEngine.vocalsUrl;
                if (safeV) {vocalsUrl = safeV;}
            }
        }
        
        // Сбрасываем предыдущие данные
        this.instrumentalAudioData = null;
        this.vocalAudioData = null;
        this.rawInstrumentalData = null;
        this.rawVocalData = null;
        
        const loadPromises = [];

        if (instrumentalUrl) {
            loadPromises.push(this._loadBufferFromUrl(instrumentalUrl).then(buffer => {
                console.log("Инструментальная дорожка загружена.");
                this.rawInstrumentalData = buffer.getChannelData(0);
                this.instrumentalAudioData = this._generatePeaks(this.rawInstrumentalData);
                if (!this.audioDuration) {this.audioDuration = buffer.duration;}
            }));
        }

        if (vocalsUrl) {
            loadPromises.push(this._loadBufferFromUrl(vocalsUrl).then(buffer => {
                console.log("Вокальная дорожка загружена.");
                this.rawVocalData = buffer.getChannelData(0);
                this.vocalAudioData = this._generatePeaks(this.rawVocalData);
                if (!this.audioDuration) {this.audioDuration = buffer.duration;}
            }));
        }

        try {
            await Promise.all(loadPromises);
            console.log("Все волновые формы успешно загружены и обработаны.");
            this._drawWaveform();
        } catch (error) {
            console.error("Ошибка при загрузке одной из волновых форм:", error);
            this._showNotification("Не удалось загрузить аудио для редактора.", "error");
            // Даже если есть ошибка, пытаемся отрисовать то, что загрузилось
            this._drawWaveform();
        }
    }
    
    /**
     * Базовая очистка RTF кода (fallback)
     * @param {string} rtfText - RTF текст
     * @returns {string} - Очищенный текст
     * @private
     */
    _basicRtfCleanup(rtfText) {
        if (!rtfText) {return "";}
        
        try {
            let cleanText = rtfText;
            
            // Удаляем RTF заголовки и метаданные
            cleanText = cleanText.replace(/^{\\rtf1[^{}]*/, "");
            cleanText = cleanText.replace(/\{\\colortbl[^{}]*\}/g, "");
            cleanText = cleanText.replace(/\{\\fonttbl[^{}]*\}/g, "");
            cleanText = cleanText.replace(/\{\\stylesheet[^{}]*\}/g, "");
            
            // Заменяем команды переносов
            cleanText = cleanText.replace(/\\par\s?/g, "\n");
            cleanText = cleanText.replace(/\\line\s?/g, "\n");
            
            // Удаляем RTF команды
            cleanText = cleanText.replace(/\\[a-z]+\d*\s?/g, "");
            cleanText = cleanText.replace(/[{}]/g, "");
            
            // Очищаем множественные переносы
            cleanText = cleanText.replace(/\n{3,}/g, "\n\n");
            cleanText = cleanText.trim();
            
            return cleanText;
        } catch (error) {
            console.error("WaveformEditor: Ошибка базовой очистки RTF:", error);
            return rtfText;
        }
    }

    /**
     * Helper to get color from ColorService or fallback to default
     * @param {string} source - 'instrumental' or 'vocals'
     * @returns {string} color HEX
     */
    _getSourceColor(source) {
        if (window.colorService) {
            if (source === 'instrumental') {
                return window.colorService.getInstrumentalColor();
            } else if (source === 'vocals') {
                return window.colorService.getVocalsColor();
            }
        }
        // Fallback colors
        return source === 'instrumental' ? "#4497ff" : "#FFD700";
    }

    /**
     * Helper to get alpha from ColorService or fallback to default
     * @param {string} source - 'instrumental' or 'vocals'
     * @returns {number} alpha value (0-1)
     */
    _getSourceAlpha(source) {
        if (window.colorService) {
            if (source === 'instrumental') {
                return window.colorService.getInstrumentalAlpha();
            } else if (source === 'vocals') {
                return window.colorService.getVocalsAlpha();
            }
        }
        // Fallback alpha
        return source === 'instrumental' ? 0.85 : 0.9;
    }
}

console.log("WaveformEditor loaded");

// Initialize immediately when audio engine is available
// Make it globally accessible
    window.waveformEditor = null;
    
// Check if audio engine is already available
if (window.audioEngine) {
    window.waveformEditor = new WaveformEditor(window.audioEngine);
} else {
    // Wait for audio engine to be ready
    const initInterval = setInterval(() => {
        if (window.audioEngine) {
            window.waveformEditor = new WaveformEditor(window.audioEngine);
            clearInterval(initInterval);
        }
    }, 10); // Reduced interval for faster initialization
} 
