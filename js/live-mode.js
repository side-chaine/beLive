/**
 * Text Live Mode
 * Модуль для работы с камерой, видеоэффектами и трансляцией
 */

class LiveMode {
    constructor() {
        // Получаем элементы DOM или создаем их если необходимо
        this._initializeElements();
        
        // Состояние видеопотока
        this.videoStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.isStreaming = false;
        this.currentMask = 'none';
        this.isActive = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isCameraInitialized = false; // Флаг для отслеживания статуса инициализации камеры
        
        // Данные для отображения текста
        this.currentActiveLine = -1;
        this.lyricsLines = [];
        this.isLyricsDisplayUpdating = false;
        
        // Canvas для обработки видео
        this.canvas = document.createElement('canvas');
        this.canvasContext = this.canvas.getContext('2d');
        
        // Объекты для эффектов и фильтров
        this.videoProcessor = null;
        this.faceDetector = null;
        
        // Поддерживает ли браузер getUserMedia
        this.hasGetUserMedia = this._checkGetUserMediaSupport();
        
        // Поддерживается ли протокол HTTPS для безопасного доступа
        this.isSecureContext = this._checkSecureContext();
        
        // Инициализация базовых компонентов, но не активируем камеру
        this._init();
        
        // Добавляем слушателей событий для маркеров
        this._addMarkerListeners();
        
        // ВАЖНО: не запрашиваем камеру в конструкторе — единственная точка запроса в bootstrap/activate()
        
        console.log('LiveMode: экземпляр создан');
    }
    
    /**
     * Проверка поддержки getUserMedia
     * @private
     */
    _checkGetUserMediaSupport() {
        // Получаем правильную версию getUserMedia для разных браузеров
        const getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia;
        
        const hasGetUserMedia = !!(navigator.mediaDevices && 
                                 navigator.mediaDevices.getUserMedia) || 
                               !!getUserMedia;
        
        console.log('LiveMode: getUserMedia поддерживается:', hasGetUserMedia);
        return hasGetUserMedia;
    }
    
    /**
     * Проверка безопасного контекста (HTTPS)
     * @private
     */
    _checkSecureContext() {
        const isSecure = window.isSecureContext;
        console.log('LiveMode: Безопасный контекст:', isSecure);
        
        // Если localhost, то позволяем и HTTP
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname.includes('192.168.') ||
                           window.location.protocol === 'file:';
        
        if (isLocalhost) {
            console.log('LiveMode: Определен localhost, разрешен HTTP');
            return true;
        }
        
        return isSecure;
    }
    
    /**
     * Проверяем и инициализируем элементы интерфейса
     */
    _initializeElements() {
        this.videoElement = document.getElementById('live-video');
        this.videoContainer = document.getElementById('live-video-container');
        this.lyricsOverlay = document.getElementById('lyrics-overlay');
        this.masksPanel = document.getElementById('masks-panel');
        this.masksContainer = document.getElementById('masks-container');
        this.modalContainer = document.getElementById('modal-container');
        this.statusDisplay = document.getElementById('live-status-display');
        
        // Проверяем наличие всех необходимых элементов и создаем их, если они отсутствуют
        if (!this.videoElement || !this.videoContainer) {
            console.error('LiveMode: Видеоэлементы не найдены, создаем новые');
            this._createVideoElements();
        }
        
        if (!this.lyricsOverlay) {
            console.log('LiveMode: Элемент lyricsOverlay не найден, создаем новый');
            this._createLyricsOverlay();
        }
        
        if (!this.masksPanel || !this.masksContainer) {
            console.log('LiveMode: Элементы для масок не найдены, создаем новые');
            this._createMasksPanel();
        }
        
        if (!this.modalContainer) {
            console.log('LiveMode: Модальное окно не найдено, создаем новое');
            this._createModalContainer();
        }
        
        // Заполняем контейнер масок примерами
        if (this.masksContainer) {
            this._initMasks();
        }
    }
    
    /**
     * Создает элемент для отображения текста, если он не существует
     */
    _createLyricsOverlay() {
        this.lyricsOverlay = document.createElement('div');
        this.lyricsOverlay.id = 'lyrics-overlay';
        
        // Если есть видеоконтейнер, добавляем оверлей внутрь него
        if (this.videoContainer) {
            this.videoContainer.appendChild(this.lyricsOverlay);
        } else {
            // Если нет видеоконтейнера, добавляем в body
            document.body.appendChild(this.lyricsOverlay);
        }
        
        console.log('LiveMode: Создан элемент lyricsOverlay');
    }
    
    /**
     * Создает элементы для видео, если они не существуют
     */
    _createVideoElements() {
        try {
            // Создаем контейнер для видео, если его нет
            if (!this.videoContainer) {
                this.videoContainer = document.createElement('div');
                this.videoContainer.id = 'live-video-container';
                this.videoContainer.classList.add('hidden');
                document.body.appendChild(this.videoContainer);
            }
            
            // Создаем элемент видео, если его нет
            if (!this.videoElement) {
                this.videoElement = document.createElement('video');
                this.videoElement.id = 'live-video';
                this.videoElement.autoplay = true;
                this.videoElement.muted = true;
                this.videoElement.setAttribute('playsinline', '');
                this.videoElement.setAttribute('disablepictureinpicture', '');
                this.videoElement.setAttribute('disableremoteplayback', '');
                this.videoElement.setAttribute('webkit-playsinline', '');
                this.videoElement.setAttribute('x-webkit-airplay', 'deny');
                this.videoContainer.appendChild(this.videoElement);
            }
            
            // Создаем заголовок "LIVE" вверху экрана
            let liveHeader = document.getElementById('live-header');
            if (liveHeader) {
                // Принудительно обновляем стиль заголовка если он существует
                liveHeader.style.background = 'linear-gradient(90deg, #ff3366, #7b1fa2)';
                liveHeader.style.webkitBackgroundClip = 'text';
                liveHeader.style.webkitTextFillColor = 'transparent';
                liveHeader.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
                liveHeader.style.fontWeight = 'bold';
                liveHeader.style.letterSpacing = '10px';
            } else {
                liveHeader = document.createElement('div');
                liveHeader.id = 'live-header';
                liveHeader.textContent = 'LIVE';
                liveHeader.style.background = 'linear-gradient(90deg, #ff3366, #7b1fa2)';
                liveHeader.style.webkitBackgroundClip = 'text';
                liveHeader.style.webkitTextFillColor = 'transparent';
                liveHeader.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
                liveHeader.style.fontWeight = 'bold';
                liveHeader.style.letterSpacing = '10px';
                this.videoContainer.appendChild(liveHeader);
            }
            
            // Принудительно удаляем старый контейнер кнопок, чтобы пересоздать его с новым дизайном
            const oldControlsContainer = document.getElementById('live-controls-container');
            if (oldControlsContainer) {
                console.log('LiveMode: Удаляем старый контейнер кнопок для пересоздания');
                oldControlsContainer.remove();
            }
            
            // Создаем контейнер для кнопок управления в верхнем правом углу
            let controlsContainer = document.createElement('div');
            controlsContainer.id = 'live-controls-container';
            this.videoContainer.appendChild(controlsContainer);
            
            // Создаем кнопки в современном стиле
            const buttons = [
                {
                    id: 'live-modes-button',
                    icon: '<i class="fas fa-sliders-h"></i>',
                    title: 'Режимы',
                    handler: this._toggleSettingsPanel ? this._toggleSettingsPanel.bind(this) : null
                },
                {
                    id: 'live-rec-button',
                    icon: '<i class="fas fa-circle"></i> REC',
                    title: 'Запись',
                    handler: this.toggleRecording ? this.toggleRecording.bind(this) : null,
                    color: 'rgba(255, 0, 0, 0.8)'
                },
                {
                    id: 'live-stream-button',
                    icon: '<i class="fas fa-broadcast-tower"></i> LIVE',
                    title: 'Стрим',
                    handler: this.toggleStreaming ? this.toggleStreaming.bind(this) : null,
                    color: 'rgba(0, 123, 255, 0.8)'
                },
                {
                    id: 'live-effects-button',
                    icon: '<i class="fas fa-magic"></i>',
                    title: 'Эффекты',
                    handler: this.toggleMasksPanel ? this.toggleMasksPanel.bind(this) : null,
                    color: 'rgba(138, 43, 226, 0.8)'
                }
            ];
            
            // Создаем кнопки в контейнере
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.id = btn.id;
                button.className = 'live-control-button';
                button.innerHTML = btn.icon;
                button.title = btn.title;
                
                if (btn.color) {
                    button.style.backgroundColor = btn.color;
                }
                
                if (btn.handler) {
                    button.addEventListener('click', btn.handler);
                } else {
                    console.warn(`LiveMode: Обработчик для кнопки ${btn.id} не найден`);
                    // Добавляем заглушку, чтобы избежать ошибок
                    button.addEventListener('click', () => {
                        console.log(`LiveMode: Нажатие на кнопку ${btn.id} (обработчик не определен)`);
                    });
                }
                
                controlsContainer.appendChild(button);
            });
            
            // Добавляем кнопку закрытия отдельно
            const closeButton = document.createElement('button');
            closeButton.id = 'live-close-button';
            closeButton.className = 'live-control-button';
            closeButton.innerHTML = '<i class="fas fa-times"></i>';
            closeButton.title = 'Закрыть';
            
            // Безопасно добавляем обработчик с проверкой
            if (this.deactivate && typeof this.deactivate === 'function') {
                closeButton.addEventListener('click', this.deactivate.bind(this));
            } else {
                console.warn('LiveMode: Метод deactivate не найден для кнопки закрытия');
                closeButton.addEventListener('click', () => {
                    console.log('LiveMode: Нажатие на кнопку закрытия (обработчик не определен)');
                    // Запасной вариант - просто скрываем контейнер
                    if (this.videoContainer) {
                        this.videoContainer.classList.add('hidden');
                    }
                });
            }
            
            closeButton.style.backgroundColor = 'rgba(220, 53, 69, 0.8)'; 
            controlsContainer.appendChild(closeButton);
            
            // Создаем индикатор записи, если его нет
            let recordingIndicator = document.getElementById('recording-indicator');
            if (recordingIndicator) {
                recordingIndicator.classList.add('hidden');
            } else {
                recordingIndicator = document.createElement('div');
                recordingIndicator.id = 'recording-indicator';
                recordingIndicator.textContent = 'REC';
                recordingIndicator.classList.add('hidden');
                this.videoContainer.appendChild(recordingIndicator);
            }
            
            console.log('LiveMode: Созданы элементы для видео в современном стиле');
            
            // Добавляем версию для отслеживания изменений и обхода кеширования
            window.liveModeVersion = new Date().getTime();
            console.log('LiveMode: Версия компонентов обновлена:', window.liveModeVersion);
        } catch (error) {
            console.error('LiveMode: Ошибка при создании видео-элементов:', error);
        }
    }
    
    /**
     * Создает элементы для панели масок, если они не существуют
     */
    _createMasksPanel() {
        // Создаем панель масок, если её нет
        if (!this.masksPanel) {
            this.masksPanel = document.createElement('div');
            this.masksPanel.id = 'masks-panel';
            this.masksPanel.classList.add('hidden');
            
            // Создаем заголовок
            const masksHeader = document.createElement('div');
            masksHeader.className = 'masks-header';
            
            const backButton = document.createElement('button');
            backButton.className = 'back-button';
            backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Назад';
            backButton.addEventListener('click', this.backToMainView.bind(this));
            
            const heading = document.createElement('h2');
            heading.textContent = 'Доступные маски';
            
            masksHeader.appendChild(backButton);
            masksHeader.appendChild(heading);
            
            // Создаем контейнер для категорий
            const categories = document.createElement('div');
            categories.className = 'categories';
            
            // Создаем контейнер для масок, если его нет
            if (!this.masksContainer) {
                this.masksContainer = document.createElement('div');
                this.masksContainer.id = 'masks-container';
            }
            
            this.masksPanel.appendChild(masksHeader);
            this.masksPanel.appendChild(categories);
            this.masksPanel.appendChild(this.masksContainer);
            
            document.body.appendChild(this.masksPanel);
        }
        
        console.log('LiveMode: Создана современная панель масок');
    }
    
    /**
     * Создает элементы для модального окна, если они не существуют
     */
    _createModalContainer() {
        this.modalContainer = document.createElement('div');
        this.modalContainer.id = 'modal-container';
        this.modalContainer.classList.add('hidden');
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        
        const heading = document.createElement('h3');
        heading.textContent = 'Настройки';
        
        const closeButton = document.createElement('button');
        closeButton.id = 'close-modal';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', this.hideModal);
        
        modalHeader.appendChild(heading);
        modalHeader.appendChild(closeButton);
        
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        
        this.modalContainer.appendChild(modalContent);
        document.body.appendChild(this.modalContainer);
        
        console.log('LiveMode: Создано модальное окно');
    }
    
    /**
     * Инициализируем примеры масок
     */
    _initMasks() {
        // Очищаем контейнер
        this.masksContainer.innerHTML = '';
        
        // Маски для LiveMode
        const masks = [
            { id: 'none', name: 'Отключено', category: 'all' },
            { id: 'blur', name: 'Размытие', category: 'effects' },
            { id: 'vintage', name: 'Ретро', category: 'creative' },
            { id: 'grayscale', name: 'Ч/Б', category: 'effects' },
            { id: 'sepia', name: 'Сепия', category: 'creative' },
            { id: 'concert', name: 'Концерт', category: 'concert' },
            { id: 'party', name: 'Вечеринка', category: 'fun' },
            { id: 'stars', name: 'Звездный', category: 'fun' },
            { id: 'sunset', name: 'Закат', category: 'background' },
            { id: 'studio', name: 'Студия', category: 'background' },
            { id: 'nature', name: 'Природа', category: 'background' },
            { id: 'neon', name: 'Неон', category: 'concert' }
        ];
        
        // Добавляем маски в контейнер
        masks.forEach(mask => {
            const maskItem = document.createElement('div');
            maskItem.className = 'mask-item';
            maskItem.dataset.mask = mask.id;
            maskItem.dataset.category = mask.category;
            
            // Создаем контейнер вместо изображения для избежания ошибок
            const iconContainer = document.createElement('div');
            iconContainer.className = 'mask-icon';
            iconContainer.innerHTML = `<i class="fas fa-${mask.id === 'none' ? 'ban' : 'mask'}"></i>`;
            
            const maskName = document.createElement('div');
            maskName.className = 'mask-name';
            maskName.textContent = mask.name;
            
            maskItem.appendChild(iconContainer);
            maskItem.appendChild(maskName);
            this.masksContainer.appendChild(maskItem);
        });
        
        console.log('LiveMode: Маски инициализированы без использования изображений');
    }
    
    /**
     * Инициализация компонентов Live режима
     */
    async _init() {
        // Привязываем контекст методов
        this._bindMethods();
        
        // Создаем кнопку Назад для Live режима
        this._createBackButton();
        
        // Настраиваем обработчики событий UI
        this._setupEventListeners();
        
        console.log('LiveMode: Базовая инициализация завершена');
    }
    
    /**
     * Привязываем контекст к методам класса для использования в обработчиках событий
     */
    _bindMethods() {
        // Проверяем существование каждого метода перед вызовом bind
        const methods = [
            'toggleRecording',
            'toggleStreaming',
            'toggleMasksPanel',
            'selectMask',
            'backToMainView',
            'showSettingsModal',
            'hideModal',
            'filterMasks',
            'activate',
            'deactivate'
        ];
        
        // Безопасно привязываем только те методы, которые существуют
        methods.forEach(methodName => {
            if (typeof this[methodName] === 'function') {
                this[methodName] = this[methodName].bind(this);
            } else {
                console.warn(`LiveMode: Метод ${methodName} не найден и не может быть привязан`);
            }
        });
        
        // Также привязываем обработчики событий
        this._onMarkerActivated = this._onMarkerActivated ? this._onMarkerActivated.bind(this) : (() => {});
        this._onLyricsRendered = this._onLyricsRendered ? this._onLyricsRendered.bind(this) : (() => {});
        this._onActiveLineChanged = this._onActiveLineChanged ? this._onActiveLineChanged.bind(this) : (() => {});
        this._onPlaybackPositionChanged = this._onPlaybackPositionChanged ? this._onPlaybackPositionChanged.bind(this) : (() => {});
        this._onTimeUpdated = this._onTimeUpdated ? this._onTimeUpdated.bind(this) : (() => {});
        this._onDisplayLineActivated = this._onDisplayLineActivated ? this._onDisplayLineActivated.bind(this) : (() => {});
        this._onModeChanged = this._onModeChanged ? this._onModeChanged.bind(this) : (() => {});
    }
    
    /**
     * Создаем кнопку "Назад" для выхода из режима Live
     */
    _createBackButton() {
        // Проверяем, существует ли уже кнопка
        let backButton = document.getElementById('live-back-button');
        if (backButton) {
            return;
        }
        
        // Создаем кнопку Назад
        backButton = document.createElement('button');
        backButton.id = 'live-back-button';
        backButton.className = 'back-button';
        backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Назад';
        backButton.style.position = 'absolute';
        backButton.style.top = '10px';
        backButton.style.left = '10px';
        backButton.style.zIndex = '200';
        backButton.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        backButton.style.color = 'white';
        backButton.style.border = 'none';
        backButton.style.borderRadius = '5px';
        backButton.style.padding = '8px 15px';
        backButton.style.cursor = 'pointer';
        backButton.style.display = 'none'; // Изначально скрыта
        
        // Добавляем обработчик события
        backButton.addEventListener('click', () => {
            this.deactivate();
            
            // Переключаемся на предыдущий режим через App
            if (window.app && typeof window.app.switchToLastMode === 'function') {
                window.app.switchToLastMode();
            } else if (window.textStyleManager) {
                // Если нет специального метода, просто переключаемся на стандартный режим
                window.textStyleManager.applyStyle('default');
            }
        });
        
        // Добавляем кнопку в body
        document.body.appendChild(backButton);
    }
    
    /**
     * Настройка обработчиков событий
     */
    _setupEventListeners() {
        // Кнопки управления
        const recordButton = document.getElementById('record-button');
        const streamButton = document.getElementById('stream-button');
        const effectsButton = document.getElementById('toggle-effects');
        const settingsButton = document.getElementById('settings-button');
        const backButton = document.querySelector('.back-button');
        const closeModalButton = document.getElementById('close-modal');
        
        if (recordButton) {recordButton.addEventListener('click', this.toggleRecording);}
        if (streamButton) {streamButton.addEventListener('click', this.toggleStreaming);}
        if (effectsButton) {effectsButton.addEventListener('click', this.toggleMasksPanel);}
        if (settingsButton) {settingsButton.addEventListener('click', this.showSettingsModal);}
        if (backButton) {backButton.addEventListener('click', this.backToMainView);}
        if (closeModalButton) {closeModalButton.addEventListener('click', this.hideModal);}
        
        // Обработка клика на масках
        if (this.masksContainer) {
            this.masksContainer.addEventListener('click', (e) => {
                const maskItem = e.target.closest('.mask-item');
                if (maskItem) {
                    this.selectMask(maskItem.dataset.mask);
                }
            });
        }
        
        // Создаем и добавляем категории
        this._setupCategoryButtons();
    }
    
    /**
     * Создаем и добавляем кнопки категорий масок
     */
    _setupCategoryButtons() {
        // Список категорий масок
        const categories = [
            { id: 'all', name: 'Все' },
            { id: 'effects', name: 'Эффекты' },
            { id: 'creative', name: 'Креативные' },
            { id: 'concert', name: 'Концертные' },
            { id: 'fun', name: 'Забавные' },
            { id: 'background', name: 'Фоны' }
        ];
        
        // Находим контейнер категорий
        const categoriesContainer = document.querySelector('.categories');
        if (!categoriesContainer) {
            console.error('LiveMode: Контейнер категорий не найден');
            return;
        }
        
        // Очищаем контейнер категорий
        categoriesContainer.innerHTML = '';
        
        // Добавляем кнопки категорий
        categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            if (category.id === 'all') {
                btn.classList.add('active');
            }
            btn.dataset.category = category.id;
            btn.textContent = category.name;
            
            btn.addEventListener('click', () => {
                // Убираем активный класс у всех кнопок
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                // Добавляем активный класс текущей кнопке
                btn.classList.add('active');
                // Фильтруем маски по категории
                this.filterMasks(category.id);
            });
            
            categoriesContainer.appendChild(btn);
        });
    }
    
    /**
     * Предварительно инициализирует камеру при загрузке страницы
     * для избегания повторных запросов разрешений
     * @private
     */
    async _preInitCamera() {
        // Проверяем основные требования
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('LiveMode: getUserMedia не поддерживается');
            return false;
        }

        try {
            console.log('LiveMode: Предварительная инициализация камеры...');
            
            // Запрашиваем доступ к камере только один раз
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            
            console.log('LiveMode: Доступ к камере получен при предварительной инициализации');
            
            // Получаем информацию о треках
            const videoTracks = this.videoStream.getVideoTracks();
            if (videoTracks.length > 0) {
                console.log(`LiveMode: Получено ${videoTracks.length} видеотреков. Активный: ${videoTracks[0].label}`);
                
                // Временно отключаем треки, но не останавливаем их полностью
                videoTracks.forEach(track => {
                    track.enabled = false;
                });
                
                this.isCameraInitialized = true;
                
                // Явно логируем успешную инициализацию
                console.log('LiveMode: Предварительная инициализация камеры успешно завершена');
                
                return true;
            } else {
                console.warn('LiveMode: Не получено видеотреков при предварительной инициализации');
                return false;
            }
            
        } catch (e) {
            if (e?.name === "NotAllowedError") {
                console.info("LiveMode: доступ к камере отклонен пользователем.");
            } else {
                console.error("LiveMode: Ошибка при предварительной инициализации камеры:", e);
            }
            return false;
        }
        return true;
    }
    
    /**
     * Активирует режим Live
     * @returns {Promise<boolean>} Успешность активации
     */
    async activate() {
        console.log('LiveMode: Начало активации режима');
        
        if (this.isActive) {
            console.log('LiveMode: Режим уже активен');
            return true;
        }
        
        try {
            // Сбрасываем флаг записи
            this.isRecording = false;
            
            // Принудительно скрываем индикатор записи при активации
            const recordingIndicator = document.getElementById('recording-indicator');
            if (recordingIndicator) {
                recordingIndicator.classList.add('hidden');
            }
            
            // Скрываем также старый индикатор записи
            const oldRecIndicator = document.querySelector('.rec-indicator, #rec-indicator');
            if (oldRecIndicator) {
                oldRecIndicator.style.display = 'none';
                oldRecIndicator.classList.add('hidden');
            }
            
            // Сбрасываем стили кнопки REC при активации
            const recButton = document.getElementById('live-rec-button');
            if (recButton) {
                recButton.innerHTML = '<i class="fas fa-circle"></i> REC';
                recButton.classList.remove('recording');
                recButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            }
            
            // Сохраняем текущий режим для возможности вернуться к нему
            if (window.app && window.app.currentMode) {
                this.previousMode = window.app.currentMode;
                console.log('LiveMode: Сохранен предыдущий режим:', this.previousMode);
            }
            
            // Инициализируем хранилище для последних текстов
            this._lastActiveLineText = null;
            this._lastNextLineText = null;
            
            // Принудительно удаляем панель настроек перед созданием новой
            const oldPanel = document.querySelector('.live-settings-panel');
            if (oldPanel) {
                oldPanel.remove();
                console.log('LiveMode: Удалена старая панель настроек');
            }
            
            // НОВОЕ: Скрываем нижние кнопки, так как они дублируются
            const bottomButtons = document.querySelectorAll('.bottom-controls button, #bottom-controls button, .footer-controls button');
            if (bottomButtons && bottomButtons.length > 0) {
                bottomButtons.forEach(button => {
                    // Проверяем по id или классу, не относится ли кнопка к управлению громкостью или полноэкранному режиму
                    if (button.id !== 'fullscreen-button' && 
                        !button.classList.contains('volume-control') && 
                        !button.id.includes('volume') && 
                        !button.classList.contains('playback-control')) {
                        // Сохраняем оригинальный display для восстановления
                        button.dataset.originalDisplay = button.style.display;
                        button.style.display = 'none';
                    }
                });
                console.log('LiveMode: Скрыты дублирующие кнопки внизу экрана');
            }
            
            // Скрываем панели настроек/редактирования в нижней части экрана
            ['.bottom-controls', '.footer-controls', '#bottom-tools', '#settings-bar', '.editor-panel'].forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.dataset.originalDisplay = element.style.display;
                    element.style.display = 'none';
                    console.log(`LiveMode: Скрыт элемент ${selector}`);
                }
            });
            
            // Проверяем основные требования
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this._showErrorMessage('Ваш браузер не поддерживает доступ к камере', 'error');
                return false;
            }
            
            // Показываем контейнер видео с плавным появлением
            if (this.videoContainer) {
                // Принудительно пересоздаем элементы для видео
                this._createVideoElements();
                
                // Убедимся, что элемент скрыт перед анимацией
                this.videoContainer.style.opacity = '0';
                this.videoContainer.classList.remove('hidden');
                
                // Запускаем плавное появление через requestAnimationFrame
                requestAnimationFrame(() => {
                    this.videoContainer.style.transition = 'opacity 0.3s ease-in-out';
                    this.videoContainer.style.opacity = '1';
                });
                
                console.log('LiveMode: Контейнер видео отображен с плавным переходом');
            }
            
            // Принудительно применяем новые стили для Live режима
            this._addLiveLyricsStyles();
            
            // Создаем или обновляем панель настроек
            this._createSettingsPanel();
            
            // Активируем доступ к камере
            let cameraInitialized;
            
            if (this.isCameraInitialized && this.videoStream) {
                console.log('LiveMode: Используем ранее инициализированную камеру');
                
                // Включаем треки, если они были отключены
                const videoTracks = this.videoStream.getVideoTracks();
                videoTracks.forEach(track => {
                    track.enabled = true;
                });
                
                // Настраиваем поток для UI
                this._setupVideoStreamAndUI(this.videoStream);
                cameraInitialized = true;
            } else {
                // Если предварительная инициализация не удалась, делаем обычную
                this._showErrorMessage('Запрашиваем доступ к камере...', 'info');
                cameraInitialized = await this._initCamera();
            }
            
            if (cameraInitialized) {
                // Устанавливаем флаг активности
                this.isActive = true;
                console.log('LiveMode: Режим успешно активирован');
                this._showErrorMessage('Камера активирована', 'success');
                
                // Активируем соответствующую кнопку режима в интерфейсе
                const liveModeButton = document.querySelector('.mode-button[data-mode="live"]');
                if (liveModeButton) {
                    // Убираем активный класс у всех кнопок режимов
                    document.querySelectorAll('.mode-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // Добавляем активный класс для кнопки LIVE
                    liveModeButton.classList.add('active');
                }
                
                // Запускаем обработку видео
                this._startVideoProcessing();
                
                // Создаем контейнер для текста
                let container = document.getElementById('live-lyrics-container');
                if (container) {
                    container.remove();
                    console.log('LiveMode: Удален старый контейнер для текста');
                }
                
                container = document.createElement('div');
                container.id = 'live-lyrics-container';
                container.style.opacity = '0';
                document.body.appendChild(container);
                
                // Плавное появление текстового контейнера
                requestAnimationFrame(() => {
                    container.style.transition = 'opacity 0.3s ease-in-out';
                    container.style.opacity = '1';
                });
                
                // Настраиваем синхронизацию текста
                this._syncWithMainDisplay();
                this._setupDirectLyricsSync();
                
                // Анимируем появление заголовка LIVE
                const liveHeader = document.getElementById('live-header');
                if (liveHeader) {
                    liveHeader.style.opacity = '0';
                    
                    // Анимируем появление с задержкой для последовательности эффектов
                    setTimeout(() => {
                        liveHeader.style.transition = 'opacity 0.5s ease-in-out';
                        liveHeader.style.opacity = '0.8';
                    }, 300);
                }
                
                // Добавляем класс активности для LIVE режима на всю страницу
                document.body.classList.add('live-mode-active');
                
                return true;
            } else {
                throw new Error('Не удалось инициализировать камеру');
            }
        } catch (error) {
            console.error('LiveMode: Ошибка при активации режима:', error);
            this._showErrorMessage(`Ошибка активации Live режима: ${error.message}`, 'error');
            
            // Скрываем контейнер видео при ошибке с плавной анимацией
            if (this.videoContainer && !this.videoContainer.classList.contains('hidden')) {
                this.videoContainer.style.transition = 'opacity 0.3s ease-in-out';
                this.videoContainer.style.opacity = '0';
                
                setTimeout(() => {
                    this.videoContainer.classList.add('hidden');
                }, 300);
            }
            
            return false;
        }
    }
    
    /**
     * Создает панель настроек
     * @private
     */
    _createSettingsPanel() {
        // Удаляем старую панель настроек, если она есть
        const oldPanel = document.querySelector('.live-settings-panel');
        if (oldPanel) {
            oldPanel.remove();
        }
        
        // Создаем панель настроек
        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'live-settings-panel';
        settingsPanel.id = 'live-settings-panel';
        
        // Добавляем содержимое панели
        const content = `
            <ul>
                <li>
                    <button id="live-mode-btn" class="live-settings-button active">
                        <i class="fas fa-video"></i>
                        Режим Live
                    </button>
                </li>
                <li>
                    <button id="concert-mode-btn" class="live-settings-button">
                        <i class="fas fa-music"></i>
                        Концертный режим
                    </button>
                </li>
                <li>
                    <button id="karaoke-mode-btn" class="live-settings-button">
                        <i class="fas fa-microphone"></i>
                        Караоке режим
                    </button>
                </li>
                <li>
                    <button id="rehearsal-mode-btn" class="live-settings-button">
                        <i class="fas fa-guitar"></i>
                        Репетиция
                    </button>
                </li>
                <li>
                    <button id="settings-mode-btn" class="live-settings-button">
                        <i class="fas fa-cog"></i>
                        Настройки
                    </button>
                </li>
            </ul>
        `;
        
        settingsPanel.innerHTML = content;
        
        // Добавляем панель в DOM
        document.body.appendChild(settingsPanel);
        
        // Добавляем обработчики для кнопок режима
        document.getElementById('concert-mode-btn').addEventListener('click', () => this._switchMode('concert'));
        document.getElementById('karaoke-mode-btn').addEventListener('click', () => this._switchMode('karaoke'));
        document.getElementById('rehearsal-mode-btn').addEventListener('click', () => this._switchMode('rehearsal'));
        document.getElementById('settings-mode-btn').addEventListener('click', () => this._openSettings());
        document.getElementById('live-mode-btn').addEventListener('click', () => this._switchMode('live'));
        
        // Добавляем обработчик на кнопку настроек
        const settingsButton = document.getElementById('live-settings-button');
        if (settingsButton) {
            settingsButton.addEventListener('click', this._toggleSettingsPanel.bind(this));
        }
    }
    
    /**
     * Переключает видимость панели настроек
     * @private
     */
    _toggleSettingsPanel() {
        // Проверяем, существует ли панель настроек
        let panel = document.getElementById('live-settings-panel');
        
        // Если панели нет - создаем её
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'live-settings-panel';
            panel.className = 'live-settings-panel';
            
            // Создаем список режимов
            const modesList = document.createElement('ul');
            
            // Добавляем режимы
            const modes = [
                { id: 'live', name: 'Режим Live', icon: 'video' },
                { id: 'concert', name: 'Концертный режим', icon: 'music' },
                { id: 'karaoke', name: 'Караоке режим', icon: 'microphone' },
                { id: 'rehearsal', name: 'Репетиция', icon: 'guitar' },
                { id: 'settings', name: 'Настройки', icon: 'cog' }
            ];
            
            // Создаем элементы списка для каждого режима
            modes.forEach(mode => {
                const li = document.createElement('li');
                const button = document.createElement('button');
                button.id = `${mode.id}-mode-btn`;
                button.className = 'live-settings-button';
                if (mode.id === 'live') {button.classList.add('active');}
                
                button.innerHTML = `<i class="fas fa-${mode.icon}"></i> ${mode.name}`;
                
                // Добавляем обработчик события
                if (mode.id === 'settings') {
                    button.addEventListener('click', () => {
                        this.showSettingsModal();
                        this._toggleSettingsPanel();
                    });
                } else {
                    button.addEventListener('click', () => {
                        this._switchMode(mode.id);
                    });
                }
                
                li.appendChild(button);
                modesList.appendChild(li);
            });
            
            // Добавляем список в панель
            panel.appendChild(modesList);
            
            // Добавляем панель в DOM
            document.body.appendChild(panel);
        }
        
        // Переключаем отображение панели
        panel.classList.toggle('active');
    }
    
    /**
     * Переключает режим приложения
     * @param {string} mode - Название режима
     * @private
     */
    _switchMode(mode) {
        // Проверяем, доступен ли объект app
        if (window.app && typeof window.app.switchMode === 'function') {
            window.app.switchMode(mode);
            
            // Обновляем активную кнопку в панели настроек
            document.querySelectorAll('.live-settings-button').forEach(btn => {
                btn.classList.remove('active');
                
                if (btn.id === `${mode}-mode-btn`) {
                    btn.classList.add('active');
                }
            });
            
            // Скрываем панель настроек
            const panel = document.getElementById('live-settings-panel');
            if (panel) {
                panel.classList.remove('active');
            }
        } else {
            console.warn('LiveMode: Функция переключения режима недоступна');
        }
    }
    
    /**
     * Открывает окно настроек
     * @private
     */
    _openSettings() {
        this.showSettingsModal();
        this._toggleSettingsPanel();
    }
    
    /**
     * Инициализация доступа к камере
     */
    async _initCamera() {
            // Очищаем предыдущий поток, если он был
            if (this.videoStream && !this.isCameraInitialized) {
                this._cleanupVideoStream(true);
                console.log('LiveMode: Предыдущий неинициализированный поток очищен');
            }
            
        try {
            // Простой запрос камеры без лишних опций
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false  // Начинаем без аудио для большей совместимости
            });
            try { window.dispatchEvent(new CustomEvent('camera-permission-resolved', { detail: { allowed: true } })); } catch(_) {}
            
            console.log('LiveMode: Доступ к камере получен');
            
            // Получаем информацию о треках
            const videoTracks = this.videoStream.getVideoTracks();
            if (videoTracks.length > 0) {
                console.log(`LiveMode: Получено ${videoTracks.length} видеотреков. Активный: ${videoTracks[0].label}`);
            } else {
                console.warn('LiveMode: Не получено видеотреков');
                throw new Error('Не удалось получить видеотреки');
            }
            
            // Настраиваем поток
            this._setupVideoStreamAndUI(this.videoStream);
            
            // Устанавливаем флаг инициализированной камеры
            this.isCameraInitialized = true;
            
            // Сбрасываем счетчик повторных попыток при успехе
            this.retryCount = 0;
            
            return true;
            
        } catch (e) {
            try { window.dispatchEvent(new CustomEvent('camera-permission-resolved', { detail: { allowed: false, error: e.name } })); } catch(_) {}
            if (e?.name === "NotAllowedError") {
                console.info("LiveMode: доступ к камере отклонен пользователем.");
                this._showErrorMessage('Доступ к камере отклонен. Пожалуйста, разрешите доступ в настройках браузера.', 'info');
            } else {
                console.error("LiveMode: Ошибка инициализации камеры:", e);
                this._showErrorMessage(`Не удалось инициализировать камеру: ${e.message || e.name}`, 'error');
            }
            throw new Error('Не удалось инициализировать камеру');
        }
    }
    
    /**
     * Настраивает видеопоток и UI после получения доступа к камере
     */
    _setupVideoStreamAndUI(stream) {
        // Настраиваем видеоэлемент
        if (!this.videoElement) {
            console.error('LiveMode: Видеоэлемент не найден');
            return;
        }
        
        try {
            console.log('LiveMode: Настраиваем видеопоток для UI');
            
            // Устанавливаем базовые атрибуты для видео
            this.videoElement.muted = true;
            this.videoElement.autoplay = true;
            this.videoElement.setAttribute('playsinline', '');
            
            // Устанавливаем поток
            this.videoElement.srcObject = stream;
            
            // Запускаем воспроизведение
            this.videoElement.play()
                .then(() => {
                    console.log('LiveMode: Видео успешно запущено');
                })
                .catch(err => {
                    console.error('LiveMode: Ошибка запуска видео:', err);
                    // Добавляем обработчик клика для запуска видео
                    this._showErrorMessage('Нажмите на видео для активации камеры', 'info');
                    this.videoElement.addEventListener('click', () => this.videoElement.play());
                });
            
            // Настраиваем canvas для обработки видео (если нужно)
            this.canvas.width = 1280;
            this.canvas.height = 720;
            
            console.log('LiveMode: Доступ к камере настроен успешно');
        } catch (error) {
            console.error('LiveMode: Ошибка настройки видеопотока:', error);
            this._showErrorMessage('Ошибка настройки видео: ' + error.message, 'error');
        }
    }
    
    /**
     * Очистка ресурсов видеопотока
     * @param {boolean} fullCleanup - Если true, полностью останавливает треки, иначе только отключает
     * @private
     */
    _cleanupVideoStream(fullCleanup = true) {
        if (this.videoStream) {
            // Работаем с треками
            this.videoStream.getTracks().forEach(track => {
                if (fullCleanup) {
                    // Полная остановка треков
                    track.stop();
                    console.log(`LiveMode: Трек ${track.kind} остановлен полностью`);
                } else {
                    // Только отключение треков без полной остановки
                    track.enabled = false;
                    console.log(`LiveMode: Трек ${track.kind} отключен временно`);
                }
            });
            
            // Очищаем ссылку только при полной очистке
            if (fullCleanup) {
                this.videoStream = null;
                this.isCameraInitialized = false;
            }
        }
        
        // Очищаем видеоэлемент в любом случае
        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement.src = '';
            this.videoElement.load();
        }
    }
    
    /**
     * Инициализация распознавания лиц
     */
    async _initFaceDetection() {
        try {
            console.log('LiveMode: Инициализация распознавания лица...');
            
            // Заглушка для распознавания лиц
            // В реальном приложении здесь будет загрузка модели TensorFlow.js
            setTimeout(() => {
                console.log('LiveMode: Распознавание лица готово');
                this.faceDetector = {
                    detect: async () => {
                        return [{ boundingBox: { x: 100, y: 100, width: 200, height: 200 } }];
                    }
                };
            }, 1000);
        } catch (error) {
            console.error('LiveMode: Ошибка инициализации распознавания лиц:', error);
        }
    }
    
    /**
     * Запуск обработки видеопотока
     */
    _startVideoProcessing() {
        if (!this.videoElement || !this.videoStream) {return;}
        
        console.log('LiveMode: Запуск обработки видео');
        
        // Создаем объект для обработки видео
        this.videoProcessor = {
            process: (maskName) => {
                // В реальном приложении здесь будет обработка видео в зависимости от выбранной маски
                if (!this.videoElement.paused) {
                    this.canvasContext.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
                    
                    // Применяем простые эффекты в зависимости от маски
                    if (maskName === 'blur') {
                        this.canvasContext.filter = 'blur(5px)';
                        this.canvasContext.drawImage(this.canvas, 0, 0);
                        this.canvasContext.filter = 'none';
                    } else if (maskName === 'vintage') {
                        this.canvasContext.filter = 'sepia(80%)';
                        this.canvasContext.drawImage(this.canvas, 0, 0);
                        this.canvasContext.filter = 'none';
                    } else if (maskName === 'grayscale') {
                        this.canvasContext.filter = 'grayscale(100%)';
                        this.canvasContext.drawImage(this.canvas, 0, 0);
                        this.canvasContext.filter = 'none';
                    } else if (maskName === 'sepia') {
                        this.canvasContext.filter = 'sepia(100%)';
                        this.canvasContext.drawImage(this.canvas, 0, 0);
                        this.canvasContext.filter = 'none';
                    }
                }
            }
        };
        
        // Запуск процесса обработки видео
        this._processVideoFrame();
    }
    
    /**
     * Процесс обработки кадров видео
     */
    _processVideoFrame() {
        if (this.videoProcessor && this.currentMask !== 'none' && this.isActive) {
            this.videoProcessor.process(this.currentMask);
        }
        
        // Запрашиваем следующий кадр для обработки только если режим активен
        if (this.isActive) {
            requestAnimationFrame(() => this._processVideoFrame());
        }
    }
    
    /**
     * Деактивирует режим Live
     */
    deactivate() {
        console.log('LiveMode: Деактивация режима');
        
        if (!this.isActive) {
            console.log('LiveMode: Режим уже неактивен');
            return;
        }
        
        try {
            // 1. Очищаем интервалы и наблюдатели текстового режима
            if (this._mainDisplayObserver) {
                clearInterval(this._mainDisplayObserver);
                this._mainDisplayObserver = null;
            }
            
            if (this._mutationObserver) {
                this._mutationObserver.disconnect();
                this._mutationObserver = null;
            }
            
            if (this._syncInterval) {
                clearInterval(this._syncInterval);
                this._syncInterval = null;
            }
            
            // 2. Удаляем DOM элементы текстового режима с плавным переходом
            const container = document.getElementById('live-lyrics-container');
            if (container) {
                container.style.transition = 'opacity 0.3s ease-out';
                container.style.opacity = '0';
                
                // Удаляем контейнер после завершения анимации
                setTimeout(() => {
                    container.remove();
                }, 300);
            }
            
            // Удаляем стили
            const styles = document.getElementById('live-mode-styles');
            if (styles) {
                styles.remove();
            }
            
            // 3. Скрываем контейнер видео с плавным переходом
            if (this.videoContainer) {
                // Сначала плавно скрываем заголовок LIVE
                const liveHeader = document.getElementById('live-header');
                if (liveHeader) {
                    liveHeader.style.transition = 'opacity 0.3s ease-out';
                    liveHeader.style.opacity = '0';
                }
                
                // Затем с небольшой задержкой начинаем плавно скрывать весь контейнер
                setTimeout(() => {
                    this.videoContainer.style.transition = 'opacity 0.5s ease-out';
                    this.videoContainer.style.opacity = '0';
                    
                    // Скрываем контейнер после завершения анимации
                    setTimeout(() => {
                        this.videoContainer.classList.add('hidden');
                        this.videoContainer.style.opacity = '1'; // Сбрасываем для следующей активации
                    }, 500);
                }, 200);
            }
            
            // 4. Скрываем панель масок и модальное окно с плавным переходом
            if (this.masksPanel && !this.masksPanel.classList.contains('hidden')) {
                this.masksPanel.style.transition = 'opacity 0.3s ease-out';
                this.masksPanel.style.opacity = '0';
                
                setTimeout(() => {
                    this.masksPanel.classList.add('hidden');
                    this.masksPanel.style.opacity = '1'; // Сбрасываем для следующего использования
                }, 300);
            }
            
            if (this.modalContainer && !this.modalContainer.classList.contains('hidden')) {
                this.modalContainer.style.transition = 'opacity 0.3s ease-out';
                this.modalContainer.style.opacity = '0';
                
                setTimeout(() => {
                    this.modalContainer.classList.add('hidden');
                    this.modalContainer.style.opacity = '1'; // Сбрасываем для следующего использования
                }, 300);
            }
            
            // 5. Останавливаем запись, если она идет
            if (this.isRecording && this.mediaRecorder) {
                this.mediaRecorder.stop();
                this.isRecording = false;
                
                const recordingIndicator = document.getElementById('recording-indicator');
                if (recordingIndicator) {
                    recordingIndicator.classList.add('hidden');
                }
                
                // Скрываем также старый индикатор записи
                const oldRecIndicator = document.querySelector('.rec-indicator, #rec-indicator');
                if (oldRecIndicator) {
                    oldRecIndicator.style.display = 'none';
                    oldRecIndicator.classList.add('hidden');
                }
            }
            
            // 6. Отключаем треки видео, но НЕ останавливаем их полностью
            if (this.videoStream) {
                const videoTracks = this.videoStream.getVideoTracks();
                videoTracks.forEach(track => {
                    track.enabled = false;  // Только отключаем треки, но не останавливаем
                    console.log(`LiveMode: Трек ${track.kind} отключен (но не остановлен)`);
                });
                
                // Очищаем только видеоэлемент
                if (this.videoElement) {
                    this.videoElement.srcObject = null;
                    this.videoElement.src = '';
                    this.videoElement.load();
                }
            }
            
            // НОВОЕ: Восстанавливаем отображение нижних кнопок
            const bottomButtons = document.querySelectorAll('.bottom-controls button, #bottom-controls button, .footer-controls button');
            if (bottomButtons && bottomButtons.length > 0) {
                bottomButtons.forEach(button => {
                    if (button.dataset.originalDisplay !== undefined) {
                        button.style.display = button.dataset.originalDisplay;
                    } else {
                        button.style.display = '';
                    }
                });
                console.log('LiveMode: Восстановлены кнопки в нижней части экрана');
            }
            
            // Восстанавливаем отображение всех скрытых панелей
            ['.bottom-controls', '.footer-controls', '#bottom-tools', '#settings-bar', '.editor-panel'].forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    if (element.dataset.originalDisplay !== undefined) {
                        element.style.display = element.dataset.originalDisplay;
                    } else {
                        element.style.display = '';
                    }
                    console.log(`LiveMode: Восстановлен элемент ${selector}`);
                }
            });
            
            // 7. Сбрасываем флаги состояния
            this.isActive = false;
            this.currentMask = 'none';
            
            // Удаляем класс активности для LIVE режима
            document.body.classList.remove('live-mode-active');
            
            // Сбрасываем активную кнопку режима
            document.querySelectorAll('.mode-button').forEach(btn => {
                if (btn.dataset.mode === 'live') {
                    btn.classList.remove('active');
                }
            });
            
            // 8. Возврат в режим приложения
            // Если задан принудительный режим после Live — используем его и НЕ прыгаем обратно в live
            if (window.app) {
                if (window.__forceAfterLiveMode) {
                    const targetMode = window.__forceAfterLiveMode;
                    window.__forceAfterLiveMode = null;
                    try {
                        if (typeof window.app._enableResidualLiveOverlay === 'function') {
                            window.app._enableResidualLiveOverlay(true);
                        }
                        if (targetMode === 'catalog') {
                            // Открываем каталог напрямую
                            if (typeof window.openCatalog === 'function') {
                                window.openCatalog();
                            }
                        } else if (typeof window.app._handleModeChange === 'function') {
                            window.app._handleModeChange(targetMode);
                        } else if (typeof window.app.switchToLastMode === 'function') {
                            window.app.switchToLastMode();
                        }
                    } catch (e) { console.warn('LiveMode: force return failed', e); }
                } else if (typeof window.app.switchToLastMode === 'function') {
                    window.app.switchToLastMode();
                }
            } else if (window.textStyleManager) {
                // Если нет специального метода, просто переключаемся на стандартный режим
                try {
                    window.textStyleManager.applyStyle('default');
                } catch (e) {
                    console.error('LiveMode: Ошибка при деактивации:', e);
                }
            }
            
            console.log('LiveMode: Режим успешно деактивирован');
        } catch (error) {
            console.error('LiveMode: Ошибка при деактивации:', error);
        }
    }
    
    /**
     * Переключение панели масок
     */
    toggleMasksPanel() {
        if (!this.masksPanel) {
            console.error('LiveMode: Панель масок не найдена');
            return;
        }
        
        const isHidden = this.masksPanel.classList.contains('hidden');
        
        if (isHidden) {
            // Показываем панель масок
            this.masksPanel.classList.remove('hidden');
            
            // Устанавливаем активную категорию
            document.querySelectorAll('.category-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === 'all');
            });
        } else {
            // Скрываем панель масок
            this.masksPanel.classList.add('hidden');
        }
    }
    
    /**
     * Выбор маски
     */
    selectMask(maskName) {
        console.log('LiveMode: Выбрана маска:', maskName);
        
        // Устанавливаем текущую маску
        this.currentMask = maskName;
        
        // Удаляем выделение со всех масок
        document.querySelectorAll('.mask-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Добавляем выделение выбранной маске
        const selectedMask = document.querySelector(`.mask-item[data-mask="${maskName}"]`);
        if (selectedMask) {
            selectedMask.classList.add('active');
        }
        
        // Скрываем панель масок после небольшой задержки
        setTimeout(() => {
            if (this.masksPanel) {
                this.masksPanel.classList.add('hidden');
            }
        }, 300);
        
        // Применяем эффект к видео
        this._applyMaskEffect(maskName);
        
        // Показываем уведомление
        this._showErrorMessage(`Маска "${maskName}" применена`, 'info');
    }
    
    /**
     * Применение эффекта маски к видео
     */
    _applyMaskEffect(maskName) {
        // В реальном приложении здесь будет логика применения эффектов
        // Для простоты демонстрации просто выводим в консоль
        console.log(`LiveMode: Применяем эффект ${maskName} к видео`);
        
        // Разные эффекты в зависимости от выбранной маски
        switch(maskName) {
            case 'blur':
                console.log('Применяем размытие');
                break;
            case 'vintage':
                console.log('Применяем винтажный фильтр');
                break;
            case 'grayscale':
                console.log('Применяем чёрно-белый фильтр');
                break;
            case 'sepia':
                console.log('Применяем сепию');
                break;
            case 'concert':
                console.log('Применяем концертный эффект');
                break;
            default:
                console.log('Отключаем эффекты');
                break;
        }
    }
    
    /**
     * Фильтрация масок по категории
     */
    filterMasks(category) {
        if (!this.masksContainer) {return;}
        
        // Получаем все элементы масок
        const masks = this.masksContainer.querySelectorAll('.mask-item');
        
        // Фильтруем маски по категории
        masks.forEach(mask => {
            if (category === 'all' || mask.dataset.category === category) {
                mask.style.display = '';
            } else {
                mask.style.display = 'none';
            }
        });
    }
    
    /**
     * Возврат к основному виду
     */
    backToMainView() {
        if (this.masksPanel) {
            this.masksPanel.classList.add('hidden');
        }
    }
    
    /**
     * Показать модальное окно настроек
     */
    showSettingsModal() {
        if (!this.modalContainer) {return;}
        
        // Очищаем содержимое модального окна
        const modalBody = this.modalContainer.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = '';
            
            // Создаем группы настроек
            
            // Группа настроек камеры
            const cameraSettings = document.createElement('div');
            cameraSettings.className = 'settings-group';
            
            const cameraTitle = document.createElement('h4');
            cameraTitle.textContent = 'Настройки камеры';
            cameraSettings.appendChild(cameraTitle);
            
            // Выбор камеры
            const cameraSelect = document.createElement('div');
            cameraSelect.className = 'setting-item';
            
            const cameraLabel = document.createElement('label');
            cameraLabel.textContent = 'Выбор камеры:';
            
            const cameraInput = document.createElement('select');
            cameraInput.id = 'camera-select';
            
            // Добавляем опции (реально они должны заполняться доступными камерами)
            const defaultOption = document.createElement('option');
            defaultOption.value = 'default';
            defaultOption.textContent = 'Основная камера';
            cameraInput.appendChild(defaultOption);
            
            cameraSelect.appendChild(cameraLabel);
            cameraSelect.appendChild(cameraInput);
            cameraSettings.appendChild(cameraSelect);
            
            // Добавляем настройки разрешения видео
            const resolutionSelect = document.createElement('div');
            resolutionSelect.className = 'setting-item';
            
            const resolutionLabel = document.createElement('label');
            resolutionLabel.textContent = 'Разрешение видео:';
            
            const resolutionInput = document.createElement('select');
            resolutionInput.id = 'resolution-select';
            
            // Опции разрешения
            ['1280x720', '1920x1080', '640x480', '320x240'].forEach(res => {
                const option = document.createElement('option');
                option.value = res.toLowerCase();
                option.textContent = res;
                resolutionInput.appendChild(option);
            });
            
            resolutionSelect.appendChild(resolutionLabel);
            resolutionSelect.appendChild(resolutionInput);
            cameraSettings.appendChild(resolutionSelect);
            
            // Добавляем группу в модальное окно
            modalBody.appendChild(cameraSettings);
            
            // Кнопки действий
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            
            const saveButton = document.createElement('button');
            saveButton.className = 'btn btn-primary';
            saveButton.textContent = 'Сохранить';
            saveButton.addEventListener('click', () => {
                // Логика сохранения настроек
                this.hideModal();
                this._showErrorMessage('Настройки сохранены', 'info');
            });
            
            const cancelButton = document.createElement('button');
            cancelButton.className = 'btn btn-secondary';
            cancelButton.textContent = 'Отмена';
            cancelButton.addEventListener('click', this.hideModal);
            
            buttonGroup.appendChild(cancelButton);
            buttonGroup.appendChild(saveButton);
            modalBody.appendChild(buttonGroup);
        }
        
        // Показываем модальное окно
        this.modalContainer.classList.remove('hidden');
    }
    
    /**
     * Показать модальное окно настроек стрима
     */
    showStreamSettingsModal() {
        if (!this.modalContainer) {return;}
        
        // Очищаем содержимое модального окна
        const modalBody = this.modalContainer.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = '';
            
            // Изменяем заголовок модального окна
            const modalHeader = this.modalContainer.querySelector('.modal-header h3');
            if (modalHeader) {
                modalHeader.textContent = 'Настройки стриминга';
            }
            
            // Создаем форму настроек стрима
            const streamForm = document.createElement('form');
            streamForm.id = 'stream-settings-form';
            
            // URL стрим-сервера
            const serverUrlGroup = document.createElement('div');
            serverUrlGroup.className = 'setting-item';
            
            const serverUrlLabel = document.createElement('label');
            serverUrlLabel.textContent = 'URL сервера:';
            
            const serverUrlInput = document.createElement('input');
            serverUrlInput.type = 'text';
            serverUrlInput.id = 'server-url';
            serverUrlInput.placeholder = 'rtmp://your-streaming-server/live';
            
            serverUrlGroup.appendChild(serverUrlLabel);
            serverUrlGroup.appendChild(serverUrlInput);
            streamForm.appendChild(serverUrlGroup);
            
            // Ключ стрима
            const streamKeyGroup = document.createElement('div');
            streamKeyGroup.className = 'setting-item';
            
            const streamKeyLabel = document.createElement('label');
            streamKeyLabel.textContent = 'Ключ стрима:';
            
            const streamKeyInput = document.createElement('input');
            streamKeyInput.type = 'password';
            streamKeyInput.id = 'stream-key';
            streamKeyInput.placeholder = 'Ваш секретный ключ стрима';
            
            streamKeyGroup.appendChild(streamKeyLabel);
            streamKeyGroup.appendChild(streamKeyInput);
            streamForm.appendChild(streamKeyGroup);
            
            // Добавляем форму в модальное окно
            modalBody.appendChild(streamForm);
            
            // Кнопки действий
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            
            const startStreamButton = document.createElement('button');
            startStreamButton.className = 'btn btn-primary';
            startStreamButton.textContent = 'Начать стрим';
            startStreamButton.addEventListener('click', (e) => {
                e.preventDefault();
                
                // В реальном приложении здесь будет логика подключения к стрим-серверу
                console.log('LiveMode: Начало стриминга');
                
                // Обновляем UI
                const streamButton = document.getElementById('stream-button');
                if (streamButton) {
                    streamButton.textContent = 'Стоп стрим';
                }
                
                // Устанавливаем флаг
                this.isStreaming = true;
                
                // Скрываем модальное окно
                this.hideModal();
                
                // Показываем уведомление
                this._showErrorMessage('Стрим запущен!', 'info');
            });
            
            const cancelButton = document.createElement('button');
            cancelButton.className = 'btn btn-secondary';
            cancelButton.textContent = 'Отмена';
            cancelButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideModal();
            });
            
            buttonGroup.appendChild(cancelButton);
            buttonGroup.appendChild(startStreamButton);
            modalBody.appendChild(buttonGroup);
        }
        
        // Показываем модальное окно
        this.modalContainer.classList.remove('hidden');
    }
    
    /**
     * Скрыть модальное окно
     */
    hideModal() {
        if (this.modalContainer) {
            this.modalContainer.classList.add('hidden');
        }
    }
    
    /**
     * Показать сообщение об ошибке или статус
     */
    _showErrorMessage(message, type = 'error') {
        // Выводим в консоль для отладки
        if (type === 'error') {
            console.error('LiveMode:', message);
        } else {
            console.log('LiveMode:', message);
        }
        
        // Проверяем наличие statusDisplay
        if (!this.statusDisplay) {
            // Пробуем найти альтернативный элемент для отображения
            const alternativeDisplay = document.getElementById('live-status-display') || 
                                       document.getElementById('status-display');
            
            if (alternativeDisplay) {
                this.statusDisplay = alternativeDisplay;
            } else {
                // Если нет подходящего элемента, создаем его
                const newStatusDisplay = document.createElement('div');
                newStatusDisplay.id = 'live-status-display';
                newStatusDisplay.style.position = 'fixed';
                newStatusDisplay.style.bottom = '20px';
                newStatusDisplay.style.left = '50%';
                newStatusDisplay.style.transform = 'translateX(-50%)';
                newStatusDisplay.style.background = 'rgba(0, 0, 0, 0.8)';
                newStatusDisplay.style.color = 'white';
                newStatusDisplay.style.padding = '10px 20px';
                newStatusDisplay.style.borderRadius = '5px';
                newStatusDisplay.style.zIndex = '1000';
                newStatusDisplay.style.fontSize = '16px';
                newStatusDisplay.style.fontWeight = 'bold';
                
                document.body.appendChild(newStatusDisplay);
                this.statusDisplay = newStatusDisplay;
            }
        }
        
        // Устанавливаем классы и цвета для стилизации
        this.statusDisplay.className = '';
        this.statusDisplay.classList.add('status-' + type);
        
        // Добавляем цвет в зависимости от типа
        switch (type) {
            case 'error':
                this.statusDisplay.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
                break;
            case 'success':
                this.statusDisplay.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
                break;
            case 'info':
                this.statusDisplay.style.backgroundColor = 'rgba(0, 123, 255, 0.9)';
                break;
            default:
                this.statusDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        }
        
        // Устанавливаем сообщение
        this.statusDisplay.textContent = message;
        
        // Показываем сообщение
        this.statusDisplay.classList.remove('hidden');
        
        // Автоматически скрываем сообщение через 5 секунд
        setTimeout(() => {
            if (this.statusDisplay) {
                this.statusDisplay.classList.add('hidden');
            }
        }, 5000);
        
        // Пытаемся также отобразить сообщение через statusDisplay из lyricsDisplay, если он доступен
        if (window.app && window.app.lyricsDisplay && window.app.lyricsDisplay.statusDisplay) {
            window.app.lyricsDisplay.statusDisplay.updateStatus(message, type);
        }
    }
    
    /**
     * Обновить текст в оверлее
     */
    updateLyricsOverlay(text) {
        if (this.lyricsOverlay) {
            this.lyricsOverlay.innerHTML = text;
        }
    }
    
    /**
     * Освобождение ресурсов
     */
    dispose() {
        // Остановка видеопотока полностью
        this._cleanupVideoStream(true);
        
        // Удаление обработчиков событий
        document.removeEventListener('marker-activated', this._onMarkerActivated);
        document.removeEventListener('lyrics-rendered', this._onLyricsRendered);
        document.removeEventListener('active-line-changed', this._onActiveLineChanged);
        document.removeEventListener('playback-position-changed', this._onPlaybackPositionChanged);
        document.removeEventListener('time-updated', this._onTimeUpdated);
        document.removeEventListener('display-line-activated', this._onDisplayLineActivated);
        document.removeEventListener('mode-changed', this._onModeChanged);
        
        console.log('LiveMode: Ресурсы освобождены');
    }
    
    /**
     * Остановка видеопотока
     */
    _stopVideoStream() {
        // Используем полную очистку при полной остановке
        this._cleanupVideoStream(true);
        console.log('LiveMode: Видеопоток полностью остановлен');
    }
    
    /**
     * Добавляем слушателей событий для синхронизации с маркерами
     * @private
     */
    _addMarkerListeners() {
        // Инициализируем массив для хранения буфера событий
        this.eventBuffer = {
            markers: [],
            activeLines: [],
            lastEventTime: 0
        };
        
        // Обработка события изменения маркеров
        document.addEventListener('marker-activated', (e) => {
            if (this.isActive && e.detail && e.detail.markerIndex !== undefined) {
                // Вместо прямого обновления, добавляем событие в буфер
                const now = Date.now();
                this.eventBuffer.markers.push({
                    time: now,
                    index: e.detail.markerIndex
                });
                
                // Храним только последние 5 событий
                if (this.eventBuffer.markers.length > 5) {
                    this.eventBuffer.markers.shift();
                }
                
                this.eventBuffer.lastEventTime = now;
                
                console.log(`LiveMode: Буферизация события marker-activated для строки ${e.detail.markerIndex}`);
            }
        });
        
        // Слушаем события обновления текста от LyricsDisplay
        document.addEventListener('lyrics-rendered', (e) => {
            if (this.isActive) {
                console.log('LiveMode: Получено событие lyrics-rendered, переинициализация текста');
                // Переинициализируем отображение текста при обновлении LyricsDisplay
                this._syncWithMainDisplay();
            }
        });
        
        // Слушаем события изменения активной строки
        document.addEventListener('active-line-changed', (e) => {
            if (this.isActive && e && e.detail && typeof e.detail.lineIndex !== 'undefined') {
                // Вместо прямого обновления, добавляем событие в буфер
                const now = Date.now();
                this.eventBuffer.activeLines.push({
                    time: now,
                    index: e.detail.lineIndex
                });
                
                // Храним только последние 5 событий
                if (this.eventBuffer.activeLines.length > 5) {
                    this.eventBuffer.activeLines.shift();
                }
                
                this.eventBuffer.lastEventTime = now;
                
                console.log(`LiveMode: Буферизация события active-line-changed для строки ${e.detail.lineIndex}`);
                
                // Синхронизируемся с основным режимом
                this._syncWithMainDisplay();
            }
        });
        
        // Подписываемся на события позиции воспроизведения и обновления времени
        document.addEventListener('playback-position-changed', () => {
            this.eventBuffer.lastEventTime = Date.now();
            // Синхронизируемся с основным режимом при изменении позиции
            if (this.isActive) {
                this._syncWithMainDisplay();
            }
        });
        
        document.addEventListener('time-updated', () => {
            this.eventBuffer.lastEventTime = Date.now();
            // Синхронизируемся с основным режимом при обновлении времени
            if (this.isActive) {
                this._syncWithMainDisplay();
            }
        });
        
        // Прямая синхронизация c основным телепромптером
        document.addEventListener('display-line-activated', (e) => {
            if (this.isActive && e.detail && typeof e.detail.lineIndex === 'number') {
                console.log(`LiveMode: Получено событие display-line-activated с индексом ${e.detail.lineIndex}`);
                // Синхронизируемся с основным режимом
                this._syncWithMainDisplay();
            }
        });
        
        // Отслеживаем события смены режима для автоматического обновления
        document.addEventListener('mode-changed', (e) => {
            if (e.detail && e.detail.mode === 'live' && !this.isActive) {
                console.log('LiveMode: Обнаружено переключение на режим Live');
                // Активируем режим, если он еще не активирован
                this.activate();
            }
        });
        
        // Отслеживаем аудио-события
        const audios = document.querySelectorAll('audio');
        audios.forEach(audio => {
            audio.addEventListener('timeupdate', () => {
                if (this.isActive) {
                    this.eventBuffer.lastEventTime = Date.now();
                    // Синхронизируемся с основным режимом при обновлении времени
                    this._syncWithMainDisplay();
                }
            });
        });
    }
    
    /**
     * Инициализирует систему отображения текста для Live режима
     * @private
     */
    _initLyricsDisplay() {
        console.log('LiveMode: Инициализация отображения текста');
        
        // Очищаем предыдущие данные
        this.lyricsLines = [];
        this.currentActiveLine = -1;
        
        // Добавляем плавные переходы для lyricsOverlay
        if (this.lyricsOverlay) {
            this.lyricsOverlay.style.transition = 'opacity 0.15s ease-in-out';
            this.lyricsOverlay.style.opacity = '1';
        }
        
        // Добавляем стили отображения текста сразу
        this._addLiveLyricsStyles();
        
        // Устанавливаем слушатель для подписки на события основного режима
        this._setupDirectLyricsSync();
        
        // Выполняем начальное обновление
        this._syncWithMainDisplay();
    }
    
    /**
     * Показывает стандартное сообщение в оверлее текста
     * @private
     */
    _showDefaultLyricsMessage() {
        if (this.lyricsOverlay) {
            // Формируем HTML для отображения
            let html = `
                <div class="live-active-line">Режим Live активен</div>
                <div class="live-next-line">Загрузите песню для отображения текста</div>
            `;
            
            // Обновляем содержимое overlay
            this.lyricsOverlay.innerHTML = html;
        }
    }
    
    /**
     * Обновляет активную строку и отображение текста
     * @param {number} lineIndex - Индекс активной строки
     * @private
     */
    _updateActiveLine(lineIndex) {
        // Проверяем валидность индекса
        if (!this.isActive || lineIndex < 0 || lineIndex >= this.lyricsLines.length) {return;}
        
        // Предотвращаем многократные обновления за короткое время
        if (this.isLyricsDisplayUpdating) {
            clearTimeout(this.lyricsUpdateTimeout);
        }
        
        this.isLyricsDisplayUpdating = true;
        
        // Обновляем индекс активной строки
        if (this.currentActiveLine !== lineIndex) {
            console.log(`LiveMode: Обновление активной строки с ${this.currentActiveLine} на ${lineIndex}`);
            this.currentActiveLine = lineIndex;
        }
        
        // Обновляем отображение текста
        this._updateLyricsDisplay();
        
        // Разрешаем следующее обновление через короткий промежуток времени
        this.lyricsUpdateTimeout = setTimeout(() => {
            this.isLyricsDisplayUpdating = false;
        }, 100);
    }
    
    /**
     * Обновляет отображение текста в режиме Live
     * @private
     */
    _updateLyricsDisplay() {
        // Получаем активную и следующую строки
        const activeLineText = this._getMainActiveLineText();
        const nextLineText = this._getMainNextLineText() || '';
        
        // Проверяем, изменился ли текст
        if (this._lastActiveLineText === activeLineText && this._lastNextLineText === nextLineText) {
            return; // текст не изменился, пропускаем обновление
        }
        
        // Обновляем сохраненные значения
        this._lastActiveLineText = activeLineText;
        this._lastNextLineText = nextLineText;
        
        // Найти или создать контейнер
        let container = document.getElementById('live-lyrics-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'live-lyrics-container';
            document.body.appendChild(container);
        }
        
        // Очистить контейнер для нового контента
        container.innerHTML = '';
        
        // Создаем внутренний контейнер для строк
        const linesContainer = document.createElement('div');
        linesContainer.className = 'karaoke-lines-container';
        
        // Создаем элемент активной строки
        const activeLine = document.createElement('div');
        activeLine.className = 'live-active-line';
        activeLine.textContent = this._formatLyricLine(activeLineText);
        linesContainer.appendChild(activeLine);
        
        // Если есть следующая строка, добавляем ее
        if (nextLineText) {
            const nextLine = document.createElement('div');
            nextLine.className = 'live-next-line';
            nextLine.textContent = this._formatLyricLine(nextLineText);
            linesContainer.appendChild(nextLine);
        }
        
        // Добавляем контейнер строк в основной контейнер
        container.appendChild(linesContainer);
        
        // Применяем анимацию через requestAnimationFrame для плавности
        requestAnimationFrame(() => {
            activeLine.classList.add('animate');
        });
        
        console.log(`LiveMode: Обновлен текст. Активная: "${activeLineText}", Следующая: "${nextLineText}"`);
    }
    
    /**
     * Добавляет стили для отображения текста в режиме Live
     * @private
     */
    _addLiveLyricsStyles() {
        // Удаляем все существующие стили LiveMode из DOM
        document.querySelectorAll('style').forEach(style => {
            if (style.id && (
                style.id === 'live-mode-styles' || 
                style.id.includes('live-') || 
                style.textContent.includes('live-')
            )) {
                console.log('LiveMode: Удаляем старые стили:', style.id);
                style.remove();
            }
        });
        
        // Создаем элемент стилей с высоким приоритетом
        const styleEl = document.createElement('style');
        styleEl.id = 'live-mode-styles-v2'; // Новый ID для избежания кеширования
        
        // Уникальный идентификатор для стилей (обход кеша)
        const uniqueId = new Date().getTime();
        
        // Устанавливаем стили с !important для всего интерфейса
        styleEl.innerHTML = `
            /* Основной контейнер для Live режима (${uniqueId}) */
            #live-video-container {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background-color: black !important;
                z-index: 9000 !important;
                overflow: hidden !important;
            }
            
            /* Стили для видео */
            #live-video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                transform: scale(1.01) !important; /* Небольшое увеличение для избежания белых краев */
                z-index: 9001 !important;
                position: absolute !important;
            }
            
            /* Заголовок LIVE вверху экрана */
            #live-header {
                position: absolute !important;
                top: 20px !important;
                left: 0 !important;
                right: 0 !important;
                text-align: center !important;
                font-size: 48px !important;
                font-weight: 700 !important;
                color: #ff3366 !important;
                text-shadow: 0 0 10px rgba(255,51,102,0.5) !important;
                letter-spacing: 10px !important;
                z-index: 9100 !important;
                font-family: 'Arial', sans-serif !important;
                opacity: 0.8 !important;
                transition: opacity 0.3s !important;
                background: linear-gradient(90deg, #ff3366, #7b1fa2) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                display: block !important;
            }
            
            /* Контейнер для кнопок управления */
            #live-controls-container {
                position: absolute !important;
                top: 20px !important;
                right: 20px !important;
                display: flex !important;
                align-items: center !important;
                gap: 15px !important;
                z-index: 9100 !important;
            }
            
            /* Стиль кнопок управления */
            .live-control-button {
                background-color: rgba(0, 0, 0, 0.6) !important;
                color: white !important;
                border: 2px solid rgba(255, 255, 255, 0.8) !important;
                border-radius: 30px !important;
                padding: 8px 20px !important;
                font-weight: bold !important;
                font-size: 16px !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                outline: none !important;
                min-width: 100px !important;
                text-align: center !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 8px !important;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2) !important;
            }
            
            /* Стиль кнопки STOP */
            #live-close-button {
                background-color: rgba(220, 53, 69, 0.8) !important;
            }
            
            /* Стиль кнопки REC */
            #live-rec-button {
                background-color: rgba(255, 0, 0, 0.8) !important;
            }
            
            /* Стиль кнопки LIVE */
            #live-stream-button {
                background-color: rgba(0, 123, 255, 0.8) !important;
            }
            
            /* Стиль кнопки спецэффектов */
            #live-effects-button {
                background-color: rgba(138, 43, 226, 0.8) !important; 
            }
            
            /* Стиль кнопки режимов */
            #live-modes-button {
                background-color: rgba(52, 152, 219, 0.8) !important; 
            }
            
            /* Эффект при наведении на кнопки */
            .live-control-button:hover {
                transform: scale(1.05) !important;
                box-shadow: 0 0 15px rgba(255, 255, 255, 0.5) !important;
                filter: brightness(1.2) !important;
            }
            
            /* Эффект нажатия на кнопки */
            .live-control-button:active {
                transform: scale(0.98) !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
            }
            
            /* Кнопка "Назад" больше не нужна, скрываем её */
            #live-back-button {
                display: none !important;
            }
            
            /* Контейнер с текстом в стиле караоке - внизу экрана */
            #live-lyrics-container {
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100% !important;
                text-align: center !important;
                z-index: 9999 !important;
                pointer-events: none !important;
                opacity: 1 !important;
                background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.9) 100%) !important; /* Плавный градиент только снизу */
                padding: 40px 0 30px 0 !important;
                box-shadow: none !important; /* Убираем тень */
            }
            
            /* Контейнер строк внутри основного контейнера */
            .karaoke-lines-container {
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                align-items: center !important;
                max-width: 1200px !important;
                margin: 0 auto !important;
                padding: 0 20px !important;
            }
            
            /* Активная строка - яркий контрастный текст */
            .live-active-line {
                font-size: 42px !important;
                font-weight: 700 !important;
                color: white !important;
                text-shadow: 
                    -2px -2px 0 rgba(0,0,0,0.8) !important,
                    2px -2px 0 rgba(0,0,0,0.8) !important,
                    -2px 2px 0 rgba(0,0,0,0.8) !important,
                    2px 2px 0 rgba(0,0,0,0.8) !important,
                    0 0 8px rgba(255,255,255,0.4) !important;
                line-height: 1.3 !important;
                margin: 0 auto 10px !important;
                padding: 5px !important;
                display: block !important;
                background: transparent !important;
                max-width: 95% !important;
                -webkit-font-smoothing: antialiased !important;
                letter-spacing: 0.5px !important;
                animation: textGlow${uniqueId} 1.5s infinite alternate !important;
            }
            
            @keyframes textGlow${uniqueId} {
                0% { text-shadow: -2px -2px 0 rgba(0,0,0,0.8), 2px -2px 0 rgba(0,0,0,0.8), -2px 2px 0 rgba(0,0,0,0.8), 2px 2px 0 rgba(0,0,0,0.8), 0 0 8px rgba(255,255,255,0.4); }
                100% { text-shadow: -2px -2px 0 rgba(0,0,0,0.8), 2px -2px 0 rgba(0,0,0,0.8), -2px 2px 0 rgba(0,0,0,0.8), 2px 2px 0 rgba(0,0,0,0.8), 0 0 12px rgba(255,255,255,0.7); }
            }
            
            /* Следующая строка - менее яркая, подготавливает пользователя */
            .live-next-line {
                font-size: 32px !important;
                font-weight: 500 !important;
                color: rgba(255, 255, 255, 0.7) !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8) !important;
                line-height: 1.3 !important;
                margin: 5px auto 0 !important;
                padding: 3px !important;
                display: block !important;
                background: transparent !important;
                max-width: 95% !important;
                -webkit-font-smoothing: antialiased !important;
            }
            
            /* Анимация появления текста */
            @keyframes textSlideUp${uniqueId} {
                0% { transform: translateY(15px); opacity: 0; }
                100% { transform: translateY(0); opacity: 1; }
            }
            
            /* Применяем анимацию к активной строке */
            .live-active-line.animate {
                animation: textSlideUp${uniqueId} 0.3s ease-out forwards !important;
            }
            
            /* Стили для индикатора записи */
            #recording-indicator {
                position: absolute !important;
                top: 20px !important;
                left: 20px !important;
                display: flex !important;
                align-items: center !important;
                color: white !important;
                font-weight: bold !important;
                z-index: 9100 !important;
                border-radius: 50px !important;
                padding: 6px 15px !important;
                background-color: rgba(220, 53, 69, 0.8) !important;
                gap: 6px !important;
            }
            
            #recording-indicator:before {
                content: "" !important;
                display: inline-block !important;
                width: 12px !important;
                height: 12px !important;
                background-color: red !important;
                border-radius: 50% !important;
                margin-right: 8px !important;
                animation: blink${uniqueId} 1s infinite !important;
            }
            
            @keyframes blink${uniqueId} {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            /* Адаптивные стили для мобильных устройств */
            @media (max-width: 768px) {
                #live-header {
                    font-size: 36px !important;
                    top: 10px !important;
                }
                
                #live-controls-container {
                    top: 70px !important;
                    right: 10px !important;
                    flex-direction: row !important;
                }
                
                .live-control-button {
                    font-size: 14px !important;
                    padding: 6px 12px !important;
                    min-width: 80px !important;
                }
                
                .live-active-line {
                    font-size: 32px !important;
                }
                
                .live-next-line {
                    font-size: 24px !important;
                }
            }
            
            /* Для маленьких экранов еще больше уменьшаем */
            @media (max-width: 480px) {
                #live-header {
                    font-size: 24px !important;
                }
                
                .live-control-button {
                    font-size: 12px !important;
                    padding: 4px 10px !important;
                }
                
                .live-active-line {
                    font-size: 24px !important;
                }
                
                .live-next-line {
                    font-size: 18px !important;
                }
            }
            
            /* Стили для панели настроек */
            .live-settings-panel {
                position: fixed !important;
                top: 70px !important;
                right: 20px !important;
                background-color: rgba(0, 0, 0, 0.85) !important;
                border-radius: 8px !important;
                padding: 15px !important;
                z-index: 9200 !important;
                min-width: 200px !important;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5) !important;
                transition: all 0.3s ease !important;
                opacity: 0 !important;
                transform: translateY(-10px) !important;
                pointer-events: none !important;
            }
            
            .live-settings-panel.active {
                opacity: 1 !important;
                transform: translateY(0) !important;
                pointer-events: auto !important;
            }
            
            .live-settings-panel ul {
                list-style: none !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            
            .live-settings-panel li {
                margin-bottom: 10px !important;
            }
            
            .live-settings-panel button {
                background: none !important;
                border: none !important;
                color: white !important;
                padding: 8px 10px !important;
                width: 100% !important;
                text-align: left !important;
                border-radius: 5px !important;
                cursor: pointer !important;
                transition: background-color 0.2s !important;
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            
            .live-settings-panel button:hover {
                background-color: rgba(255, 255, 255, 0.1) !important;
            }
            
            .live-settings-panel button i {
                width: 20px !important;
                text-align: center !important;
            }
            
            /* Скрываем элемент, если у него есть класс hidden */
            .hidden {
                display: none !important;
            }
        `;
        
        // Добавляем стили в начало head для максимального приоритета
        document.head.insertBefore(styleEl, document.head.firstChild);
        
        console.log("LiveMode: Стили обновлены в караоке-формате (версия " + uniqueId + ")");
    }
    
    /**
     * Форматирует строку текста для отображения
     * @param {string} line - Строка текста
     * @returns {string} - Отформатированная строка
     * @private
     */
    _formatLyricLine(line) {
        if (!line || typeof line !== 'string') {
            return '';
        }
        
        // Базовое форматирование
        let formatted = line.trim();
        
        // Заменяем множественные пробелы на одинарные
        formatted = formatted.replace(/\s+/g, ' ');
        
        // Удаляем HTML-теги для безопасности (предотвращение XSS)
        formatted = formatted.replace(/<[^>]*>?/gm, '');
        
        // НЕ заменяем спецсимволы HTML, т.к. используем textContent
        // который не интерпретирует HTML-сущности
        
        // Заменяем переносы строк на пробелы (т.к. используем textContent)
        formatted = formatted.replace(/\n/g, ' ');
        
        return formatted;
    }

    /**
     * Обработка ошибок доступа к камере
     * @param {Error} error - Объект ошибки
     * @private
     */
    _handleCameraError(error) {
        let errorMessage = 'Не удалось получить доступ к камере. ';
        let shouldRetry = false;
        
        // Определяем тип ошибки для более точного сообщения
        switch (error.name) {
            case 'NotAllowedError':
                errorMessage += 'Доступ к камере отклонен. Пожалуйста, разрешите доступ в настройках браузера.';
                break;
            
            case 'NotFoundError':
                errorMessage += 'Камера не найдена. Проверьте подключение камеры.';
                shouldRetry = true; // Возможно, устройство подключат
                break;
            
            case 'NotReadableError':
            case 'AbortError':
                errorMessage += 'Камера уже используется другим приложением или недоступна.';
                shouldRetry = true; // Возможно, освободится
                break;
            
            case 'OverconstrainedError':
                errorMessage += 'Указанные параметры камеры не поддерживаются.';
                shouldRetry = true; // Попробуем с другими параметрами
                break;
            
            case 'SecurityError':
                errorMessage += 'Доступ к камере запрещен политикой безопасности.';
                break;
            
            case 'TypeError':
                errorMessage += 'Проблема с типами данных при запросе камеры.';
                break;
            
            default:
                errorMessage += error.message || 'Неизвестная ошибка.';
                shouldRetry = true;
                break;
        }
        
        // Показываем сообщение об ошибке
        this._showErrorMessage(errorMessage, 'error');
        
        // Если нужно повторить попытку и не исчерпан лимит
        if (shouldRetry && this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`LiveMode: Повторная попытка ${this.retryCount} из ${this.maxRetries}`);
            
            // Показываем сообщение о повторной попытке
            this._showErrorMessage(`Повторная попытка ${this.retryCount} из ${this.maxRetries}...`, 'info');
            
            // Запускаем таймер для повторной попытки
            setTimeout(() => {
                this._initCamera().catch(e => {
                    console.error('LiveMode: Повторная попытка не удалась:', e);
                });
            }, 2000); // Подождем 2 секунды перед повтором
            
            return false;
        }
        
        // Если исчерпаны все попытки, предлагаем пользователю обновить страницу
        if (this.retryCount >= this.maxRetries) {
            this._showErrorMessage('Исчерпаны все попытки подключения к камере. Попробуйте обновить страницу или проверьте настройки камеры.', 'error');
        }
        
        return false;
    }

    /**
     * Настраивает прямую синхронизацию текста с основным режимом
     * @private
     */
    _setupDirectLyricsSync() {
        // Отменяем предыдущие интервалы, если они есть
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
        
        // Буфер для событий
        const eventBuffer = {
            markerActivated: new Date().getTime(),
            lyricsRendered: new Date().getTime(),
            activeLineChanged: new Date().getTime(),
            playbackPositionChanged: new Date().getTime(),
            timeUpdated: new Date().getTime(),
            displayLineActivated: new Date().getTime(),
            lastSync: new Date().getTime()
        };
        
        // Минимальный интервал между обновлениями (мс)
        const MIN_UPDATE_INTERVAL = 30;
        
        // Обработчик синхронизации для всех событий
        const handleSyncEvent = (eventType) => {
            const now = new Date().getTime();
            eventBuffer[eventType] = now;
            
            // Проверяем, прошло ли достаточно времени с последней синхронизации
            if (now - eventBuffer.lastSync >= MIN_UPDATE_INTERVAL) {
                eventBuffer.lastSync = now;
                requestAnimationFrame(() => this._updateLyricsDisplay());
            }
        };
        
        // Добавляем обработчики на все возможные события обновления текста
        window.addEventListener('marker-activated', () => handleSyncEvent('markerActivated'), false);
        window.addEventListener('lyrics-rendered', () => handleSyncEvent('lyricsRendered'), false);
        window.addEventListener('active-line-changed', () => handleSyncEvent('activeLineChanged'), false);
        window.addEventListener('playback-position-changed', () => handleSyncEvent('playbackPositionChanged'), false);
        window.addEventListener('time-updated', () => handleSyncEvent('timeUpdated'), false);
        window.addEventListener('display-line-activated', () => handleSyncEvent('displayLineActivated'), false);
        
        // Устанавливаем резервный интервал синхронизации с высокой частотой
        this._syncInterval = setInterval(() => {
            this._updateLyricsDisplay();
        }, 50); // Проверка каждые 50 мс для максимальной отзывчивости
        
        console.log('LiveMode: Установлена прямая синхронизация с основным режимом');
    }

    /**
     * Синхронизирует отображение текста с основным режимом
     * @private
     */
    _syncWithMainDisplay() {
        try {
            // Обновляем текст немедленно
            this._updateLyricsDisplay();
            
            // Отслеживаем изменения в DOM для основного режима каждые 50мс
            if (this._mainDisplayObserver) {
                clearInterval(this._mainDisplayObserver);
            }
            
            // Создаем быстрый интервал для отслеживания изменений
            this._mainDisplayObserver = setInterval(() => {
                this._updateLyricsDisplay();
            }, 50); // Очень частая проверка для мгновенной реакции
            
            // Также устанавливаем MutationObserver для реакции на изменения в DOM
            if (this._mutationObserver) {
                this._mutationObserver.disconnect();
            }
            
            // Создаем наблюдатель за изменениями в DOM
            this._mutationObserver = new MutationObserver(() => {
                this._updateLyricsDisplay();
            });
            
            // Отслеживаем изменения в различных местах DOM
            const lyricsContainers = [
                document.getElementById('lyrics-display'),
                document.querySelector('.lyrics-container'),
                document.querySelector('.main-display')
            ];
            
            // Подключаем наблюдатель к каждому контейнеру, если он существует
            for (const container of lyricsContainers) {
                if (container) {
                    this._mutationObserver.observe(container, { 
                        childList: true,
                        subtree: true,
                        attributes: true,
                        characterData: true
                    });
                }
            }
            
            console.log("LiveMode: Синхронизация с основным режимом установлена");
        } catch (error) {
            console.error("LiveMode: Ошибка синхронизации с основным режимом:", error);
        }
    }

    /**
     * Получает текст текущей активной строки из основного режима
     * @returns {string} Текст активной строки или пустую строку
     * @private
     */
    _getMainActiveLineText() {
        try {
            // Метод 1: Поиск в DOM через все возможные селекторы
            const selectors = [
                '#lyrics-display .lyric-line.active',
                '.lyric-line.active',
                '.active-line',
                '.current-line',
                '[data-active="true"]'
            ];
            
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent) {
                    return element.textContent.trim();
                }
            }
            
            // Метод 2: Через объект LyricsDisplay
            if (window.app && window.app.lyricsDisplay) {
                const lyricsDisplay = window.app.lyricsDisplay;
                
                // Прямой доступ к текущему тексту
                if (lyricsDisplay.activeLineText) {
                    return lyricsDisplay.activeLineText.trim();
                }
                
                // Через индекс и массив строк
                if (typeof lyricsDisplay.currentActiveLine === 'number' && 
                    Array.isArray(lyricsDisplay.lines) && 
                    lyricsDisplay.lines.length > lyricsDisplay.currentActiveLine &&
                    lyricsDisplay.currentActiveLine >= 0) {
                    return lyricsDisplay.lines[lyricsDisplay.currentActiveLine].trim();
                }
                
                // Через LyricsDisplay container
                if (lyricsDisplay.container) {
                    const activeEl = lyricsDisplay.container.querySelector('.lyric-line.active, .active');
                    if (activeEl && activeEl.textContent) {
                        return activeEl.textContent.trim();
                    }
                }
            }
            
            // Метод 3: Через аудио позицию и маркеры
            if (window.audioEngine && window.app && window.app.markerManager) {
                const currentTime = window.audioEngine.getCurrentTime();
                const activeLineIndex = window.app.markerManager.getActiveLineAtTime(currentTime);

                if (activeLineIndex !== -1 && window.app && window.app.lyricsDisplay && typeof window.app.lyricsDisplay.getLineTextByIndex === 'function') {
                    const lineText = window.app.lyricsDisplay.getLineTextByIndex(activeLineIndex);
                    if (lineText) {
                        return lineText.trim();
                    }
                }
            }
            
            // Последняя попытка: проверяем любые видимые строки
            const visibleLines = document.querySelectorAll('.lyric-line:not(.hidden)');
            if (visibleLines && visibleLines.length > 0) {
                // Берем первую видимую строку как активную
                return visibleLines[0].textContent.trim();
            }
        } catch (error) {
            console.error('LiveMode: Ошибка при получении активной строки:', error);
        }
        
        // Запасной вариант: информационное сообщение
        return "Режим Live активен";
    }

    /**
     * Получает текст следующей строки из основного режима
     * @returns {string|null} Текст следующей строки или null
     * @private
     */
    _getMainNextLineText() {
        if (this.mainLyricsDisplay && typeof this.mainLyricsDisplay.getNextLineText === 'function') {
            return this.mainLyricsDisplay.getNextLineText();
        }
        return '';
    }

    /**
     * Переключение записи видео
     */
    async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    /**
     * Начинает запись видео.
     */
    async startRecording() {
        if (this.isRecording) {
            console.warn("LiveMode: Запись уже идет.");
            return;
        }

        console.log("LiveMode: Запуск записи мастер-трека...");
        this._showSpinner(true);

        try {
            // 1. Захват видеопотока с экрана (БЕЗ АУДИО)
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 25, width: 1920, height: 1080 },
                audio: false 
            });

            // 2. Захват аудиопотока из AudioEngine
            if (!window.audioEngine || typeof window.audioEngine.captureStream !== 'function') {
                throw new Error('AudioEngine не найден или не поддерживает captureStream.');
            }
            
            const masterAudioStream = window.audioEngine.captureStream();
            if (masterAudioStream.getAudioTracks().length === 0) {
                 console.warn("LiveMode: Аудиопоток из AudioEngine не содержит аудиодорожек. Запись будет без звука.");
                 // Можно добавить дорожку с тишиной для совместимости, как раньше
            } else {
                console.log("LiveMode: Аудиопоток мастер-трека успешно захвачен.");
            }

            // 3. Объединение видео и аудиопотока мастер-трека
            const videoTracks = displayStream.getVideoTracks();
            const audioTracks = masterAudioStream.getAudioTracks();
            
            const combinedStream = new MediaStream([
                ...videoTracks,
                ...audioTracks
            ]);
            
            this.recordedStream = combinedStream;
            this.originalDisplayStream = displayStream; // Сохраняем для остановки

            // 4. Настройка MediaRecorder
            const options = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 3500000, 
                audioBitsPerSecond: 256000  // Увеличим битрейт для качества музыки
            };

            this.mediaRecorder = new MediaRecorder(this.recordedStream, options);
            this.recordedChunks = [];

            // 5. Сбор данных
            this.mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                console.log("LiveMode: Запись остановлена, обработка данных.");
                const blob = new Blob(this.recordedChunks, { type: options.mimeType });
                const url = URL.createObjectURL(blob);
                this._saveRecording(url);
                this.recordedChunks = [];
                 // Остановка видеопотока с экрана
                if (this.originalDisplayStream) {
                    this.originalDisplayStream.getTracks().forEach(track => track.stop());
                    this.originalDisplayStream = null;
                }
                if (this.recordedStream) {
                    this.recordedStream.getTracks().forEach(track => track.stop());
                    this.recordedStream = null;
                }
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error(`LiveMode: Ошибка MediaRecorder: ${event.error.name}`, event.error);
                this._showErrorMessage(`Ошибка записи: ${event.error.name}`);
                this.stopRecording(); 
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.statusDisplay.textContent = 'REC';
            this.statusDisplay.style.color = 'red';
            console.log("LiveMode: Запись мастер-трека началась.");

        } catch (error) {
            console.error('LiveMode: Ошибка при запуске записи:', error);
            this._showErrorMessage(`Не удалось начать запись: ${error.message}`);
            this.isRecording = false;
        } finally {
            this._showSpinner(false);
        }
    }
    
    /**
     * Останавливает запись видео.
     */
    async stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            console.warn("LiveMode: Запись не активна.");
            return;
        }
        
        console.log("LiveMode: Остановка записи...");
        this._showSpinner(true);
        
        return new Promise(resolve => {
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
                const url = URL.createObjectURL(blob);
                this._saveRecording(url);
                
                // Остановка видеопотока с экрана
                if (this.originalDisplayStream) {
                    this.originalDisplayStream.getTracks().forEach(track => track.stop());
                }
                
                this.isRecording = false;
                this.statusDisplay.textContent = '';
                this.recordedChunks = [];
                this.mediaRecorder = null;
                this.recordedStream = null;
                this.originalDisplayStream = null;
                
                this._showSpinner(false);
                console.log("LiveMode: Запись мастер-трека успешно остановлена и сохранена.");
                resolve();
            };
            
            this.mediaRecorder.stop();
        });
    }
    
    /**
     * Сохраняет записанное видео.
     * @param {string} url - URL записанного Blob.
     * @private
     */
    _saveRecording(url) {
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
        a.download = `beLive-recording-${formattedDate}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
            console.log("LiveMode: Запись сохранена, ресурсы очищены.");
                    }, 100);
    }
    
    /**
     * Показывает или скрывает спиннер загрузки.
     * @param {boolean} show - Показать или скрыть.
     * @private
     */
    _showSpinner(show) {
        let spinner = document.getElementById('live-mode-spinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'live-mode-spinner';
            spinner.innerHTML = '<div></div><div></div><div></div>'; // Простая анимация спиннера
            const style = document.createElement('style');
            style.textContent = `
                #live-mode-spinner {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 10001;
                    display: none; /* Скрыт по умолчанию */
                }
                #live-mode-spinner.show {
                    display: inline-block;
                }
                #live-mode-spinner div {
                    display: inline-block;
                    width: 18px;
                    height: 18px;
                    background: #fff;
                    border-radius: 50%;
                    animation: sk-bouncedelay 1.4s infinite ease-in-out both;
                }
                #live-mode-spinner div:nth-child(1) { animation-delay: -0.32s; }
                #live-mode-spinner div:nth-child(2) { animation-delay: -0.16s; }
                @keyframes sk-bouncedelay {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(spinner);
        }

        if (show) {
            spinner.classList.add('show');
        } else {
            spinner.classList.remove('show');
        }
    }

    /**
     * Обработчик события активации маркера
     * @param {CustomEvent} e - Событие с данными о маркере
     * @private
     */
    _onMarkerActivated(e) {
        if (this.isActive && e && e.detail && typeof e.detail.markerIndex !== 'undefined') {
            console.log(`LiveMode: Активирован маркер с индексом ${e.detail.markerIndex}`);
            this._syncWithMainDisplay();
        }
    }

    /**
     * Обработчик события рендеринга текста песни
     * @param {CustomEvent} e - Событие рендеринга
     * @private
     */
    _onLyricsRendered(e) {
        if (this.isActive) {
            console.log('LiveMode: Текст песни обновлен');
            this._syncWithMainDisplay();
        }
    }

    /**
     * Обработчик изменения активной строки
     * @param {CustomEvent} e - Событие с данными об активной строке
     * @private
     */
    _onActiveLineChanged(e) {
        if (this.isActive && e && e.detail && typeof e.detail.lineIndex !== 'undefined') {
            console.log(`LiveMode: Изменена активная строка на ${e.detail.lineIndex}`);
            this._syncWithMainDisplay();
        }
    }

    /**
     * Обработчик изменения позиции воспроизведения
     * @param {CustomEvent} e - Событие изменения позиции
     * @private
     */
    _onPlaybackPositionChanged(e) {
        if (this.isActive) {
            this._syncWithMainDisplay();
        }
    }

    /**
     * Обработчик обновления времени
     * @param {CustomEvent} e - Событие обновления времени
     * @private
     */
    _onTimeUpdated(e) {
        if (this.isActive) {
            this._syncWithMainDisplay();
        }
    }

    /**
     * Обработчик активации строки дисплея
     * @param {CustomEvent} e - Событие с данными о строке
     * @private
     */
    _onDisplayLineActivated(e) {
        if (this.isActive && e && e.detail && typeof e.detail.lineIndex !== 'undefined') {
            console.log(`LiveMode: Активирована строка дисплея ${e.detail.lineIndex}`);
            this._syncWithMainDisplay();
        }
    }

    /**
     * Обработчик изменения режима
     * @param {CustomEvent} e - Событие с данными о режиме
     * @private
     */
    _onModeChanged(e) {
        if (e && e.detail && e.detail.mode) {
            console.log(`LiveMode: Сменился режим на ${e.detail.mode}`);
            if (e.detail.mode === 'live' && !this.isActive) {
                this.activate();
            }
        }
    }

    /**
     * Переключение стриминга (заглушка)
     */
    toggleStreaming() {
        console.log('LiveMode: Функция стриминга еще не реализована.');
        this._showErrorMessage('Стриминг пока не доступен', 'info');
        // В будущем здесь будет логика запуска/остановки стрима
        this.isStreaming = !this.isStreaming;
        const streamButton = document.getElementById('live-stream-button');
        if (streamButton) {
            if (this.isStreaming) {
                streamButton.innerHTML = '<i class="fas fa-stop-circle"></i> STOP';
                streamButton.style.backgroundColor = 'rgba(255, 100, 0, 0.8)';
            } else {
                streamButton.innerHTML = '<i class="fas fa-broadcast-tower"></i> LIVE';
                streamButton.style.backgroundColor = 'rgba(0, 123, 255, 0.8)';
            }
        }
    }
} 

// Автоматически создаём экземпляр без запроса доступа к камере
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Здесь не нужна проверка typeof LiveMode === 'undefined', так как класс уже определен
        if (!window.liveMode) {
            window.liveMode = new LiveMode();
        }
    } catch (_) {}
}); 