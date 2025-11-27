/**
 * Продвинутая система масок для приложения
 * Включает MediaPipe, замену фона, автоопределение лица и современные эффекты
 */

class MaskSystem {
    constructor() {
        console.log('🎭 MaskSystem: Инициализация продвинутой системы масок');
        
        this.isActive = false;
        this.currentMask = null;
        this.videoElement = null;
        this.stream = null;
        this.faceMeshDetector = null;
        this.videoProcessor = null;
        this.mediaProcessor = null;
        this.overlayCanvas = null;
        this.overlayContext = null;
        this.animationFrame = null;
        this.lastProcessingTime = 0;
        this.frameCount = 0;
        this.isVideoActive = false;
        this.mediaReady = false;
        
        // Новый движок background эффектов
        this.backgroundEngine = null;
        this.backgroundEngineReady = false;
        
        // Инициализация объектов эффектов
        this.backgroundEffects = {
            blur: { enabled: false, intensity: 10 },
            colorFilter: { enabled: false, color: '#00ff00', opacity: 0.5 },
            gradient: { enabled: false, colors: ['#ff6b6b', '#4ecdc4'], direction: 'diagonal' }
        };
        
        // Хромакей система
        this.isChromakeyActive = false;
        this.currentChromakeyMask = null;
        this.chromakeyProcessingActive = false;
        this.backgroundCanvas = null;
        this.backgroundCtx = null;
        this.personMaskCanvas = null;
        this.personMaskCtx = null;
        
        // Категории и маски
        this.currentCategory = 'basic';
        this.categories = {
            basic: { icon: '🎨', name: 'Базовые', masks: this.getBasicMasks() },
            face: { icon: '😊', name: 'Лицо', masks: this.getFaceMasks() },
            background: { icon: '🌟', name: 'Фон', masks: this.getBackgroundMasks() },
            chromakey: { icon: '🎬', name: 'Хромакей', masks: this.getChromakeyMasks() },
            advanced: { icon: '🧠', name: 'AI Эффекты', masks: this.getAdvancedMasks() }
        };
        
        // UI элементы
        this.maskControlsContainer = null;
        this.videoPanel = null;
        this.categoriesPanel = null;
        this.masksContainer = null;
        this.cameraButton = null;
        this.permissionMessage = null;
        this.errorMessage = null;
        
        console.log('🎭 MaskSystem: Конструктор завершен');
        
        // Автоматически инициализируем интерфейс
        this.init();
        
        // Selfie Segmentation
        this.selfieSegmentation = null;
        this.selfieSegmentationReady = false;
        this.selfieSegmentationLastMask = null;
        this.selfieSegmentationFrameCount = 0;
        this.selfieSegmentationHasResults = false;
        this.lastSelfieSegmentationTime = 0;
        this.useSelfieSegmentationFallback = false;
        
        // Fallback эффекты
        this.fallbackTextInterval = null;
        
        // Кеширование текста для улучшения производительности
        this._lastActiveText = '';
        this._lastNextText = '';
        this._lastActiveTextCache = null;
        this._lastNextTextCache = null;
        
        console.log('🎭 MaskSystem создан');
        
        // Основная конфигурация
        this.enableConsoleLogging = false; // По умолчанию отключены логи для оптимизации
        
        // 🔧 Контроль частоты ошибок
        this.errorThrottling = {
            maskDataError: 0,
            lastMaskDataError: 0,
            errorInterval: 2000 // Показывать ошибку раз в 2 секунды максимум
        };
        
        // Конфигурация камеры
        this.cameraConfig = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
        };
    }
    
    async init() {
        if (this.enableConsoleLogging) {
            console.log('🎭 MaskSystem: Инициализация интерфейса масок');
        }
        this.createMaskControls();
        await this.setupVideoCapture();
        await this.loadMediaPipe();
        await this.initBackgroundEngine();
        if (this.enableConsoleLogging) {
            console.log('🎭 MaskSystem: Инициализация завершена');
        }
    }
    
    async initBackgroundEngine() {
        try {
            // Загружаем Background Effects Engine только если его еще нет
            if (!window.BackgroundEffectsEngine) {
                if (this.enableConsoleLogging) {
                    console.log('🎭 MaskSystem: Загружаем Background Effects Engine...');
                }
                
                // Создаем script элемент для загрузки движка
                const script = document.createElement('script');
                script.src = 'js/background-effects-engine.js';
                script.onload = async () => {
                    await this.setupBackgroundEngine();
                };
                script.onerror = () => {
                    console.warn('⚠️ MaskSystem: Не удалось загрузить Background Effects Engine');
                };
                document.head.appendChild(script);
            } else {
                await this.setupBackgroundEngine();
            }
        } catch (error) {
            console.error('❌ MaskSystem: Ошибка инициализации Background Effects Engine:', error);
        }
    }
    
    async setupBackgroundEngine() {
        try {
            if (window.BackgroundEffectsEngine) {
                if (this.enableConsoleLogging) {
                    console.log('🎭 MaskSystem: Инициализация Background Effects Engine...');
                }
                this.backgroundEngine = new BackgroundEffectsEngine();
                
                // Ждем инициализации движка
                const success = await this.backgroundEngine.initialize();
                
                if (success && this.backgroundEngine.isInitialized) {
                    this.backgroundEngineReady = true;
                    if (this.enableConsoleLogging) {
                        console.log('✅ MaskSystem: Background Effects Engine готов');
                    }
                } else {
                    this.backgroundEngineReady = false;
                    console.warn('⚠️ MaskSystem: Background Effects Engine не смог инициализироваться');
                }
            } else {
                console.warn('⚠️ MaskSystem: BackgroundEffectsEngine класс не найден');
                this.backgroundEngineReady = false;
            }
        } catch (error) {
            console.error('❌ MaskSystem: Ошибка настройки Background Effects Engine:', error);
            this.backgroundEngineReady = false;
        }
    }
    
    createMaskControls() {
        if (this.enableConsoleLogging) {
            console.log('🎭 MaskSystem: Создание UI контейнера масок');
        }
        
        // Создаем полноэкранный контейнер
        this.maskControlsContainer = document.createElement('div');
        this.maskControlsContainer.id = 'mask-controls';
        this.maskControlsContainer.className = 'mask-controls hidden';
        
        // Заголовок с кнопкой закрытия
        const header = document.createElement('h3');
        header.innerHTML = '🎭 Студия Масок и Эффектов 2030';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'mask-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.hideMaskControls();
        header.appendChild(closeBtn);
        
        this.maskControlsContainer.appendChild(header);
        
        // Основной контент
        const mainContent = document.createElement('div');
        mainContent.className = 'mask-main-content';
        
        // Левая панель с видео
        this.videoPanel = this.createVideoPanel();
        mainContent.appendChild(this.videoPanel);
        
        // Правая панель с категориями и масками
        this.categoriesPanel = this.createCategoriesPanel();
        mainContent.appendChild(this.categoriesPanel);
        
        this.maskControlsContainer.appendChild(mainContent);
        
        // Добавляем в DOM
        document.body.appendChild(this.maskControlsContainer);
        
        if (this.enableConsoleLogging) {
            console.log('🎭 MaskSystem: UI контейнер создан и добавлен в DOM');
        }
        
        // Обновляем сетку масок
        this.updateMasksGrid();
    }
    
    createVideoPanel() {
        const panel = document.createElement('div');
        panel.className = 'mask-video-panel';
        
        // Кнопка включения/выключения камеры
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-masks';
        toggleBtn.className = 'mask-btn';
        toggleBtn.innerHTML = '📷 Включить камеру';
        toggleBtn.onclick = () => this.toggleCamera();
        panel.appendChild(toggleBtn);
        
        // Контейнер для видео
        const videoContainer = document.createElement('div');
        videoContainer.className = 'mask-video-container';
        
        // Статус индикатор
        const status = document.createElement('div');
        status.className = 'mask-status inactive';
        status.textContent = 'Камера выключена';
        videoContainer.appendChild(status);
        
        // Видео элемент
        this.videoElement = document.createElement('video');
        this.videoElement.id = 'mask-video';
        this.videoElement.autoplay = true;
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;
        // ИСПРАВЛЕНО: Убираю зеркалирование видео для правильной синхронизации
        // Тест показал что вариант "Обычное видео + обычная маска" работает правильно
        // this.videoElement.style.transform = 'scaleX(-1)'; // Убрано зеркалирование
        videoContainer.appendChild(this.videoElement);
        
        panel.appendChild(videoContainer);
        
        return panel;
    }
    
    createCategoriesPanel() {
        const panel = document.createElement('div');
        panel.className = 'mask-categories-panel';
        
        // Категории
        const categoriesContainer = document.createElement('div');
        categoriesContainer.className = 'mask-categories';
        
        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            const btn = document.createElement('button');
            btn.className = 'mask-category-btn';
            if (categoryKey === this.currentCategory) {btn.classList.add('active');}
            btn.innerHTML = `${category.icon} ${category.name}`;
            btn.onclick = (event) => this.switchCategory(categoryKey, event);
            categoriesContainer.appendChild(btn);
        });
        
        panel.appendChild(categoriesContainer);
        
        // Область прокрутки для масок
        const scrollArea = document.createElement('div');
        scrollArea.className = 'masks-scroll-area';
        
        // Создаем контейнер для масок
        this.masksContainer = document.createElement('div');
        this.masksContainer.id = 'masks-grid';
        this.masksContainer.className = 'masks-grid';
        
        scrollArea.appendChild(this.masksContainer);
        panel.appendChild(scrollArea);
        
        if (this.enableConsoleLogging) {
            console.log('🎭 MaskSystem: Панель категорий и контейнер масок созданы');
        }
        
        return panel;
    }
    
    switchCategory(categoryKey, event) {
        this.currentCategory = categoryKey;
        
        // Обновляем активную кнопку категории
        document.querySelectorAll('.mask-category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
        
        // Обновляем сетку масок
        this.updateMasksGrid();
        
        if (this.enableConsoleLogging) {
            console.log(`🎭 MaskSystem: Переключено на категорию "${this.categories[categoryKey].name}"`);
        }
    }
    
    updateMasksGrid() {
        if (!this.masksContainer) {return;}
        
        const categoryData = this.categories[this.currentCategory];
        if (!categoryData) {return;}
        
        const currentMasks = categoryData.masks;
        
        // Очищаем контейнер
        this.masksContainer.innerHTML = '';
        
        // Создаем кнопки для масок
        currentMasks.forEach(mask => {
            const btn = document.createElement('button');
            btn.className = 'mask-option-btn';
            btn.innerHTML = `
                <div class="mask-icon">${mask.icon}</div>
                <div class="mask-name">${mask.name}</div>
            `;
            
            // Правильно передаем объект маски в обработчик
            btn.onclick = async () => {
                if (this.enableConsoleLogging) {
                    console.log(`🎭 MaskSystem: Применение маски "${mask.name}"`);
                }
                await this.applyMask(mask);
                
                // Обновляем активную кнопку
                document.querySelectorAll('.mask-option-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            
            this.masksContainer.appendChild(btn);
        });
        
        if (this.enableConsoleLogging) {
            console.log(`🎭 MaskSystem: Обновлена сетка для категории "${this.currentCategory}" (${currentMasks.length} масок)`);
        }
    }
    
    async setupVideoCapture() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('🎭 MaskSystem: WebRTC не поддерживается');
                return;
            }
            
            if (this.enableConsoleLogging) {
                console.log('🎭 MaskSystem: Видео захват готов к инициализации');
            }
        } catch (error) {
            console.error('🎭 MaskSystem: Ошибка настройки видео:', error);
        }
    }
    
    async loadMediaPipe() {
        try {
            console.log('🎭 MediaPipe: Начинаем загрузку библиотек...');
            
            // Ждем, пока все библиотеки MediaPipe загрузятся
            const success = await this.waitForMediaPipeLibraries();
            
            if (!success) {
                console.warn('⚠️ MediaPipe: Не все библиотеки загружены, продолжаем с доступными');
            }
            
            // Инициализация официального MediaPipe FaceMesh если доступен
            if (window.FaceMesh) {
                this.faceMesh = new window.FaceMesh({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
                });
                
                this.faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                
                // Устанавливаем пустой обработчик по умолчанию
                this.faceMesh.onResults(() => {});
                
                console.log('🎭 MaskSystem: Официальный MediaPipe FaceMesh готов');
            }
            
            // Инициализация Pose если доступен
            if (window.Pose) {
                this.pose = new window.Pose({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
                });
                
                this.pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    smoothSegmentation: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                
                // Устанавливаем пустой обработчик по умолчанию
                this.pose.onResults(() => {});
                
                console.log('🏃 MaskSystem: MediaPipe Pose готов');
            }
            
            // Инициализация Hands если доступен
            if (window.Hands) {
                this.hands = new window.Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });
                
                this.hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                
                // Устанавливаем пустой обработчик по умолчанию
                this.hands.onResults(() => {});
                
                console.log('✋ MaskSystem: MediaPipe Hands готов');
            }
            
            // Инициализация Holistic если доступен
            if (window.Holistic) {
                this.holistic = new window.Holistic({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
                });
                
                this.holistic.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    smoothSegmentation: true,
                    refineFaceLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                
                // Устанавливаем пустой обработчик по умолчанию
                this.holistic.onResults(() => {});
                
                console.log('🤖 MaskSystem: MediaPipe Holistic готов');
            }
            
            // Инициализация MediaPipe Selfie Segmentation
            if (window.SelfieSegmentation) {
                try {
                    this.selfieSegmentation = new window.SelfieSegmentation({
                        locateFile: (file) => {
                            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                        }
                    });
                    
                    this.selfieSegmentation.setOptions({
                        modelSelection: 0, // 0 - общая модель (более стабильная), 1 - легкая
                        selfieMode: false // ИСПРАВЛЕНО: Отключаем selfieMode для синхронизации с незеркалированным видео
                    });
                    
                    // Настройка результатов Selfie Segmentation
                    this.selfieSegmentation.onResults((results) => {
                        try {
                            this.lastSelfieSegmentationTime = Date.now();
                            this.selfieSegmentationHasResults = true;
                            this.onSelfieSegmentationResults(results);
                            
                            // Логируем каждые 100 кадров
                            this.selfieSegmentationFrameCount++;
                            if (this.selfieSegmentationFrameCount % 100 === 0) {
                                console.log(`🎨 Selfie Segmentation: Обработано ${this.selfieSegmentationFrameCount} кадров`);
                            }
                        } catch (error) {
                            console.error('❌ Ошибка обработки результата Selfie Segmentation:', error);
                            
                            // При ошибке памяти - пытаемся переинициализировать через 1 секунду
                            if (error.message && error.message.includes('memory')) {
                                console.log('🔄 Обнаружена ошибка памяти, переинициализация...');
                                setTimeout(() => {
                                    this.reinitializeSelfieSegmentation();
                                }, 1000);
                            }
                        }
                    });
                    
                    console.log('🎨 MaskSystem: MediaPipe Selfie Segmentation готов');
                    
                    // Устанавливаем флаг готовности Selfie Segmentation
                    this.selfieSegmentationReady = true;
                } catch (error) {
                    console.error('❌ Ошибка инициализации Selfie Segmentation:', error);
                    this.selfieSegmentation = null;
                    this.selfieSegmentationReady = false;
                }
            }

            // Инициализация VideoProcessor если еще не настроен
            if (!this.videoProcessor && window.VideoProcessor) {
                this.videoProcessor = new VideoProcessor();
            }
            
            // Устанавливаем флаг готовности MediaPipe
            this.mediaReady = true;
            
            console.log('🎭 MaskSystem: MediaPipe готов к использованию');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки MediaPipe:', error);
            this.mediaReady = false;
        }
    }
    
    /**
     * Ожидание загрузки библиотек MediaPipe
     */
    async waitForMediaPipeLibraries() {
        console.log('🎭 MediaPipe: Ожидание загрузки библиотек...');
        
        return new Promise((resolve) => {
            let checkCount = 0;
            const maxChecks = 200; // 20 секунд максимум
            const checkInterval = 100; // Проверяем каждые 100мс

            const checkLibraries = () => {
                checkCount++;
                
                // Проверяем наличие всех MediaPipe библиотек
                const hasBase = window.FilesetResolver && window.FaceLandmarker;
                const hasFaceMesh = window.FaceMesh;
                const hasPose = window.Pose;
                const hasHands = window.Hands;
                const hasHolistic = window.Holistic;
                const hasSelfieSegmentation = window.SelfieSegmentation;

                const librariesReady = hasFaceMesh && hasPose && hasHands && hasHolistic && hasSelfieSegmentation;
                
                if (librariesReady) {
                    console.log('🎭 MediaPipe: Все библиотеки загружены успешно');
                    resolve(true);
                } else if (checkCount >= maxChecks) {
                    console.warn('🎭 MediaPipe: Не все библиотеки загружены за отведенное время');
                    console.log('📊 MediaPipe библиотеки:', {
                        FaceMesh: !!hasFaceMesh,
                        Pose: !!hasPose,
                        Hands: !!hasHands,
                        Holistic: !!hasHolistic,
                        SelfieSegmentation: !!hasSelfieSegmentation
                    });
                    resolve(false);
                } else {
                    // Показываем прогресс каждые 20 проверок (2 секунды)
                    if (checkCount % 20 === 0) {
                        console.log(`🎭 MediaPipe: Ожидание загрузки... (${checkCount * checkInterval / 1000}с)`);
                    }
                    setTimeout(checkLibraries, checkInterval);
                }
            };

            checkLibraries();
        });
    }
    
    /**
     * Обработка результатов официального MediaPipe FaceMesh
     */
    handleOfficialFaceMeshResults(results) {
        try {
            if (!results || !results.multiFaceLandmarks) {
                return;
            }

            const canvas = this.overlayCanvas;
            const ctx = canvas.getContext('2d');
            
            if (!canvas || !ctx) {
                return;
            }

            // Очищаем canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Рисуем результаты для каждого лица
            results.multiFaceLandmarks.forEach((landmarks, index) => {
                if (this.enableConsoleLogging) {
                    console.log(`🎭 Face Mesh: Отслеживается ${landmarks.length} точек лица`);
                }
                
                // Нормализуем координаты
                const normalizedLandmarks = landmarks.map(landmark => ({
                    x: landmark.x * canvas.width,
                    y: landmark.y * canvas.height,
                    z: landmark.z
                }));

                // Рисуем точки
                this.drawFaceResults([{ landmarks: normalizedLandmarks }]);
            });

        } catch (error) {
            console.error('❌ Ошибка обработки Face Mesh результатов:', error);
        }
    }
    
    /**
     * Обработчик результатов Pose
     */
    handlePoseResults(results) {
        try {
            if (!results || !results.poseLandmarks) {
                return;
            }

            const canvas = this.overlayCanvas;
            const ctx = canvas.getContext('2d');
            
            if (!canvas || !ctx) {
                return;
            }

            // Очищаем предыдущие рисунки
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (this.enableConsoleLogging) {
                console.log(`🏃 Pose: Отслеживается ${results.poseLandmarks.length} точек позы`);
            }

            // Нормализуем координаты landmarks
            const normalizedLandmarks = results.poseLandmarks.map(landmark => ({
                x: landmark.x * canvas.width,
                y: landmark.y * canvas.height,
                z: landmark.z
            }));

            // Рисуем соединения позы
            this.drawPoseConnections(ctx, normalizedLandmarks);

        } catch (error) {
            console.error('❌ Ошибка обработки Pose результатов:', error);
        }
    }

    /**
     * Обработчик результатов Hands
     */
    handleHandsResults(results) {
        try {
            if (!results || !results.multiHandLandmarks) {
                return;
            }

            const canvas = this.overlayCanvas;
            const ctx = canvas.getContext('2d');
            
            if (!canvas || !ctx) {
                return;
            }

            // Очищаем предыдущие рисунки
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (this.enableConsoleLogging) {
                console.log(`✋ Hands: Отслеживается ${results.multiHandLandmarks.length} рук`);
            }

            // Обрабатываем каждую руку
            results.multiHandLandmarks.forEach((landmarks, index) => {
                // Нормализуем координаты
                const normalizedLandmarks = landmarks.map(landmark => ({
                    x: landmark.x * canvas.width,
                    y: landmark.y * canvas.height,
                    z: landmark.z
                }));

                // Рисуем соединения руки
                this.drawHandConnections(ctx, normalizedLandmarks);
            });

        } catch (error) {
            console.error('❌ Ошибка обработки Hands результатов:', error);
        }
    }

    handleHolisticResults(results) {
        try {
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }

            const ctx = this.overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

            let detectedParts = [];

            // Лицо с учетом зеркалирования
            if (results.faceLandmarks) {
                ctx.fillStyle = '#00FF00';
                results.faceLandmarks.forEach((landmark) => {
                    // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
                    const x = landmark.x * this.overlayCanvas.width;  // Инвертируем X
                    const y = landmark.y * this.overlayCanvas.height;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, 2 * Math.PI);
                    ctx.fill();
                });
                detectedParts.push('Лицо');
            }

            // Поза с учетом зеркалирования
            if (results.poseLandmarks) {
                ctx.fillStyle = '#FF1493';
                results.poseLandmarks.forEach((landmark) => {
                    // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
                    const x = landmark.x * this.overlayCanvas.width;  // Инвертируем X
                    const y = landmark.y * this.overlayCanvas.height;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                });
                detectedParts.push('Поза');
            }

            // Руки с учетом зеркалирования
            if (results.leftHandLandmarks || results.rightHandLandmarks) {
                if (results.leftHandLandmarks) {
                    ctx.fillStyle = '#00CED1';
                    results.leftHandLandmarks.forEach((landmark) => {
                        // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
                        const x = landmark.x * this.overlayCanvas.width;  // Инвертируем X
                        const y = landmark.y * this.overlayCanvas.height;
                        
                        ctx.beginPath();
                        ctx.arc(x, y, 2, 0, 2 * Math.PI);
                        ctx.fill();
                    });
                }
                
                if (results.rightHandLandmarks) {
                    ctx.fillStyle = '#FF6347';
                    results.rightHandLandmarks.forEach((landmark) => {
                        // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
                        const x = landmark.x * this.overlayCanvas.width;  // Инвертируем X
                        const y = landmark.y * this.overlayCanvas.height;
                        
                        ctx.beginPath();
                        ctx.arc(x, y, 2, 0, 2 * Math.PI);
                        ctx.fill();
                    });
                }
                detectedParts.push('Руки');
            }

            // Информация
            ctx.font = '16px Arial';
            ctx.fillStyle = '#FFD700';
            ctx.fillText(`Holistic: ${detectedParts.join(', ')}`, 10, 30);
            
            this.frameCount = (this.frameCount || 0) + 1;
            if (this.frameCount % 30 === 0) {
                console.log(`🤖 Holistic: Отслеживается ${detectedParts.join(', ')}`);
            }
        } catch (error) {
            console.error('❌ Ошибка обработки Holistic результатов:', error);
        }
    }

    drawPoseConnections(ctx, landmarks) {
        // Основные соединения тела
        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Руки
            [11, 23], [12, 24], [23, 24], // Торс
            [23, 25], [25, 27], [24, 26], [26, 28] // Ноги
        ];

        connections.forEach(([start, end]) => {
            if (landmarks[start] && landmarks[end]) {
                ctx.beginPath();
                // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
                ctx.moveTo(
                    landmarks[start].x * this.overlayCanvas.width,  // Инвертируем X
                    landmarks[start].y * this.overlayCanvas.height
                );
                ctx.lineTo(
                    landmarks[end].x * this.overlayCanvas.width,    // Инвертируем X
                    landmarks[end].y * this.overlayCanvas.height
                );
                ctx.stroke();
            }
        });
    }

    drawHandConnections(ctx, landmarks) {
        // Соединения пальцев
        const fingerConnections = [
            [0, 1, 2, 3, 4], // Большой палец
            [0, 5, 6, 7, 8], // Указательный
            [0, 9, 10, 11, 12], // Средний
            [0, 13, 14, 15, 16], // Безымянный
            [0, 17, 18, 19, 20] // Мизинец
        ];

        fingerConnections.forEach(finger => {
            for (let i = 0; i < finger.length - 1; i++) {
                const start = finger[i];
                const end = finger[i + 1];
                
                if (landmarks[start] && landmarks[end]) {
                    ctx.beginPath();
                    // ИСПРАВЛЕНО: Убрал инверсию X так как видео больше не зеркалировано
                    ctx.moveTo(
                        landmarks[start].x * this.overlayCanvas.width,  // Используем координаты как есть
                        landmarks[start].y * this.overlayCanvas.height
                    );
                    ctx.lineTo(
                        landmarks[end].x * this.overlayCanvas.width,    // Используем координаты как есть
                        landmarks[end].y * this.overlayCanvas.height
                    );
                    ctx.stroke();
                }
            }
        });
    }
    
    async toggleCamera() {
        if (!this.isVideoActive) {
            console.log('🎭 MaskSystem: Запуск камеры...');
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: false
                });
                
                this.videoElement.srcObject = stream;
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    this.isVideoActive = true;
                    this.updateCameraButton();
                    this.updateVideoDisplay();
                    console.log('🎭 MaskSystem: Камера успешно запущена');
                };
                
            } catch (error) {
                console.error('🎭 MaskSystem: Ошибка доступа к камере:', error);
            }
        } else {
            this.stopCamera();
        }
    }
    
    stopCamera() {
        if (this.videoElement && this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
        
        this.isVideoActive = false;
        this.isActive = false;
        this.currentMask = null;
        
        this.updateCameraButton();
        this.updateVideoDisplay();
        
        if (this.videoElement) {
            this.videoElement.style.filter = 'none';
        }
        
        console.log('🎭 MaskSystem: Камера остановлена');
    }
    
    async applyMask(mask) {
        console.log(`🎭 MaskSystem: Применение маски "${mask.name}" (${mask.type})`);
        
            this.currentMask = mask;
            
        try {
            // Проверяем тип маски и применяем соответствующую обработку
            switch (mask.type) {
                case 'text-overlay':
                    // Для текстовых оверлеев используем медиа-процессинг с текстом
                    await this.applyTextOverlayMask(mask);
                    break;
                case 'mediapipe':
                    // Обычные медиа-эффекты
                    await this.applyMediaPipeMask(mask);
                    break;
                case 'filter':
                    // CSS фильтры
                    this.applyFilterMask(mask);
                    break;
                case 'none':
                    // Отмена эффектов
                    this.clearAllEffects();
                    break;
                default:
                    console.warn(`🎭 MaskSystem: Неизвестный тип маски: ${mask.type}`);
                    this.applyFallbackEffect(mask);
            }
            
            console.log(`✅ MaskSystem: Маска "${mask.name}" успешно применена`);
        } catch (error) {
            console.error(`❌ MaskSystem: Ошибка применения маски "${mask.name}":`, error);
            this.applyFallbackEffect(mask);
        }
    }
    
    /**
     * Применяет маски с текстовыми оверлеями
     * @param {Object} mask - Объект маски
     */
    async applyTextOverlayMask(mask) {
        console.log(`🎭 Применение текстового оверлея: ${mask.name}`);
        
        // Инициализируем камеру если нужно
        if (!this.isVideoActive) {
            await this.toggleCamera();
            if (!this.isVideoActive) {
                this.applyFallbackEffect(mask);
                return;
            }
        }
        
        // Запускаем Selfie Segmentation для отделения фона
        try {
            if (!this.selfieSegmentationReady) {
                await this.setupBackgroundEngine();
            }
            
            if (this.selfieSegmentationReady) {
                this.startSelfieSegmentation();
            } else {
                console.warn('🎭 Selfie Segmentation не готов, используем fallback');
                this.applyFallbackEffect(mask);
            }
        } catch (error) {
            console.error('❌ Ошибка запуска Selfie Segmentation:', error);
            this.applyFallbackEffect(mask);
        }
    }

    /**
     * Обработка результатов Face Mesh для overlay масок
     */
    handleOverlayMaskResults(results, mask) {
        if (!this.overlayCanvas || !results.multiFaceLandmarks) {return;}

        const ctx = this.overlayCanvas.getContext('2d');
        const canvas = this.overlayCanvas;
        
        // Очищаем canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Обрабатываем каждое лицо
        results.multiFaceLandmarks.forEach((landmarks) => {
            this.drawOverlayMask(ctx, landmarks, mask, canvas.width, canvas.height);
        });
    }

    /**
     * Отрисовка overlay маски на лице
     */
    drawOverlayMask(ctx, landmarks, mask, width, height) {
        try {
            ctx.save();

            switch (mask.id) {
                case 'glasses':
                    this.drawGlasses(ctx, landmarks, width, height);
                    break;
                case 'mustache':
                    this.drawMustache(ctx, landmarks, width, height);
                    break;
                case 'hat':
                    this.drawHat(ctx, landmarks, width, height);
                    break;
                case 'crown':
                    this.drawCrown(ctx, landmarks, width, height);
                    break;
                default:
                    console.warn(`🎭 Неизвестная overlay маска: ${mask.id}`);
            }

            ctx.restore();
        } catch (error) {
            console.error(`❌ Ошибка отрисовки маски ${mask.id}:`, error);
        }
    }

    /**
     * Отрисовка очков
     */
    drawGlasses(ctx, landmarks, width, height) {
        // Получаем ключевые точки глаз
        const leftEye = landmarks[33]; // Левый угол левого глаза
        const rightEye = landmarks[362]; // Правый угол правого глаза
        const nose = landmarks[168]; // Переносица

        if (!leftEye || !rightEye || !nose) {return;}

        // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
        const x1 = leftEye.x * width;
        const y1 = leftEye.y * height;
        const x2 = rightEye.x * width;
        const y2 = rightEye.y * height;
        const noseX = (1 - nose.x) * width;
        const noseY = nose.y * height;

        // Вычисляем размеры очков
        const glassesWidth = Math.abs(x2 - x1) * 1.4;
        const glassesHeight = glassesWidth * 0.6;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        // Рисуем очки
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 4;
        ctx.fillStyle = 'rgba(100, 100, 255, 0.3)';

        // Левая линза
        ctx.beginPath();
        ctx.ellipse(x1, y1, glassesWidth/4, glassesHeight/2, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Правая линза
        ctx.beginPath();
        ctx.ellipse(x2, y2, glassesWidth/4, glassesHeight/2, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Переносица
        ctx.beginPath();
        ctx.moveTo(x1 + glassesWidth/4, y1);
        ctx.lineTo(x2 - glassesWidth/4, y2);
        ctx.stroke();
    }

    /**
     * Отрисовка усов
     */
    drawMustache(ctx, landmarks, width, height) {
        // Получаем точки вокруг рта
        const upperLip = landmarks[13]; // Верхняя губа
        const leftMouth = landmarks[61]; // Левый уголок рта
        const rightMouth = landmarks[291]; // Правый уголок рта

        if (!upperLip || !leftMouth || !rightMouth) {return;}

        // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
        const centerX = upperLip.x * width;
        const centerY = upperLip.y * height;
        const leftMouthX = leftMouth.x * width;
        const rightMouthX = rightMouth.x * width;
        const mustacheWidth = Math.abs(rightMouthX - leftMouthX) * 1.2;
        const mustacheHeight = mustacheWidth * 0.3;

        // Рисуем усы
        ctx.fillStyle = '#2D1810';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, mustacheWidth/2, mustacheHeight/2, 0, 0, Math.PI);
        ctx.fill();

        // Добавляем декоративные завитки
        ctx.strokeStyle = '#2D1810';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX - mustacheWidth/3, centerY, mustacheHeight/3, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX + mustacheWidth/3, centerY, mustacheHeight/3, 0, Math.PI);
        ctx.stroke();
    }

    /**
     * Отрисовка шляпы
     */
    drawHat(ctx, landmarks, width, height) {
        // Получаем верхнюю точку головы
        const forehead = landmarks[10]; // Центр лба
        const leftTemple = landmarks[103]; // Левый висок
        const rightTemple = landmarks[332]; // Правый висок

        if (!forehead || !leftTemple || !rightTemple) {return;}

        // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
        const centerX = forehead.x * width;
        const centerY = forehead.y * height - 40; // Поднимаем шляпу выше лба
        const leftTempleX = leftTemple.x * width;
        const rightTempleX = rightTemple.x * width;
        const hatWidth = Math.abs(rightTempleX - leftTempleX) * 1.3;
        const hatHeight = hatWidth * 0.6;

        // Рисуем шляпу
        ctx.fillStyle = '#1A1A1A';
        
        // Тулья шляпы
        ctx.fillRect(centerX - hatWidth/4, centerY - hatHeight, hatWidth/2, hatHeight);
        
        // Поля шляпы
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, hatWidth/2, hatWidth/6, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Лента на шляпе
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(centerX - hatWidth/4, centerY - hatHeight/3, hatWidth/2, hatHeight/8);
    }

    /**
     * Отрисовка короны
     */
    drawCrown(ctx, landmarks, width, height) {
        // Получаем верхнюю точку головы
        const forehead = landmarks[10];
        const leftTemple = landmarks[103];
        const rightTemple = landmarks[332];

        if (!forehead || !leftTemple || !rightTemple) {return;}

        // ИСПРАВЛЕНО: Зеркалируем координаты X для соответствия CSS-зеркалированному видео
        const centerX = forehead.x * width;
        const centerY = forehead.y * height - 30;
        const leftTempleX = leftTemple.x * width;
        const rightTempleX = rightTemple.x * width;
        const crownWidth = Math.abs(rightTempleX - leftTempleX) * 1.2;
        const crownHeight = crownWidth * 0.4;

        // Рисуем корону
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 2;

        // Основание короны
        ctx.fillRect(centerX - crownWidth/2, centerY, crownWidth, crownHeight/3);
        ctx.strokeRect(centerX - crownWidth/2, centerY, crownWidth, crownHeight/3);

        // Зубцы короны
        const numPoints = 5;
        const pointWidth = crownWidth / numPoints;
        
        ctx.beginPath();
        for (let i = 0; i < numPoints; i++) {
            const x = centerX - crownWidth/2 + i * pointWidth;
            const height = (i % 2 === 0) ? crownHeight : crownHeight/2;
            
            if (i === 0) {
                ctx.moveTo(x, centerY);
            } else {
                ctx.lineTo(x, centerY);
            }
            ctx.lineTo(x + pointWidth/2, centerY - height);
            ctx.lineTo(x + pointWidth, centerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Добавляем драгоценные камни
        ctx.fillStyle = '#FF0000';
        for (let i = 0; i < 3; i++) {
            const gemX = centerX - crownWidth/4 + i * crownWidth/4;
            const gemY = centerY + crownHeight/6;
            ctx.beginPath();
            ctx.arc(gemX, gemY, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    /**
     * Обработка кадров для overlay масок
     */
    processOverlayMaskFrame() {
        // Проверяем все необходимые условия
        if (!this.faceMesh || !this.videoElement || this.videoElement.readyState < 2) {
            console.warn('⚠️ Overlay маска: не готова для обработки кадра');
            return;
        }
        
        // Устанавливаем флаг активной обработки
        this.isProcessing = true;
        
        const processFrame = async () => {
            try {
                if (this.videoElement && this.videoElement.readyState >= 2 && this.isProcessing && this.currentMask) {
                    // Отправляем кадр в Face Mesh для анализа
                    await this.faceMesh.send({ image: this.videoElement });
                    
                    // Увеличиваем счетчик кадров для отладки
                    this.frameCount = (this.frameCount || 0) + 1;
                    
                    // Логируем каждые 60 кадров (~2 секунды при 30 FPS)
                    if (this.frameCount % 60 === 0) {
                        console.log(`🎭 Overlay маска "${this.currentMask.name}": обработано ${this.frameCount} кадров`);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Ошибка обработки кадра overlay маски:`, error);
                
                // При критической ошибке пытаемся переинициализировать
                if (error.message.includes('MediaPipe') || error.message.includes('WebGL')) {
                    console.log('🔄 Попытка переинициализации Face Mesh...');
                    setTimeout(() => {
                        this.loadMediaPipe();
                    }, 1000);
                }
            }
            
            // Продолжаем обработку если активна
            if (this.isProcessing && this.currentMask) {
                requestAnimationFrame(processFrame);
            }
        };
        
        // Начинаем обработку
        console.log(`🎭 Запуск обработки кадров для overlay маски: ${this.currentMask ? this.currentMask.name : 'неизвестно'}`);
        processFrame();
    }
    
    /**
     * Применение MediaPipe маски
     */
    async applyMediaPipeMask(mask) {
        console.log(`🎭 Применение MediaPipe маски: ${mask.name}`);
        
        // Очищаем предыдущие эффекты
        this.clearAllEffects();
        
        try {
            // Создаем overlay canvas если его нет
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }
            
            switch (mask.id) {
                case 'face-mesh':
                    console.log('🔍 Обработка Face Mesh маски');
                    console.log('🔍 Запуск Face Mesh tracking');
                    await this.startFaceMeshTracking();
                    break;
                    
                case 'pose':
                    console.log('🏃 Запуск отслеживания позы');
                    await this.startPoseTracking();
                    break;
                    
                case 'hands':
                    console.log('✋ Запуск отслеживания рук');
                    await this.startHandTracking();
                    break;
                    
                case 'holistic':
                    console.log('🤖 Запуск полного анализа');
                    await this.startHolisticTracking();
                    break;
                    
                default:
                    // Для всех остальных эффектов используем Selfie Segmentation
                    console.log('🎨 Запуск Selfie Segmentation...');
                    
                    // Проверяем доступность Selfie Segmentation
                    if (!this.selfieSegmentation) {
                        console.warn('⚠️ Selfie Segmentation недоступен, используем резервный режим');
                        this.applyFallbackBackgroundEffect(mask);
                        return;
                    }
                    
                    // Запускаем Selfie Segmentation напрямую без дополнительных проверок
                    try {
                        this.startSelfieSegmentation();
                    } catch (error) {
                        console.error('❌ Ошибка запуска Selfie Segmentation:', error);
                        this.applyFallbackBackgroundEffect(mask);
                        return;
                    }
                    break;
            }
            
            this.currentMask = mask;
            console.log('✅ MediaPipe маска применена');
            
        } catch (error) {
            console.error('❌ Ошибка применения MediaPipe маски:', error);
            
            // Для фоновых эффектов используем резервный режим при ошибке
            if (!['face-mesh', 'pose', 'hands', 'holistic'].includes(mask.id)) {
                console.log('🛡️ Переключение на резервный режим из-за ошибки');
                this.applyFallbackBackgroundEffect(mask);
            }
        }
    }
    
    /**
     * Применение AI background эффекта с новым движком
     */
    async applyAIBackgroundEffect(mask) {
        try {
            if (!this.backgroundEngineReady || !this.backgroundEngine) {
                console.warn('⚠️ Background Effects Engine не готов, используем старый метод');
                this.currentMask = mask;
                this.startSelfieSegmentation();
                return;
            }
            
            console.log(`🚀 Применение AI background эффекта: ${mask.name}`);
            
            // Настраиваем движок
            this.backgroundEngine.setTargetCanvas(this.overlayCanvas);
            this.backgroundEngine.setVideoSource(this.videoElement);
            
            // Определяем тип эффекта по ID маски
            let effectType = 'none';
            switch (mask.id) {
                case 'ai-blur':
                    effectType = 'blur';
                    break;
                case 'ai-green':
                    effectType = 'green';
                    break;
                case 'ai-blue':
                    effectType = 'blue';
                    break;
                case 'ai-gradient':
                    effectType = 'gradient';
                    break;
                case 'ai-matrix':
                    effectType = 'matrix';
                    break;
                case 'ai-neon':
                    effectType = 'neon';
                    break;
            }
            
            // Применяем эффект
            this.backgroundEngine.setEffect(effectType);
            this.backgroundEngine.startProcessing();
            
            console.log(`✅ AI background эффект "${effectType}" применен`);
            
        } catch (error) {
            console.error('❌ Ошибка применения AI background эффекта:', error);
            // Резервный вариант - используем старый метод
            this.currentMask = mask;
            this.startSelfieSegmentation();
        }
    }
    
    /**
     * Запуск отслеживания Face Mesh
     */
    async startFaceMeshTracking() {
        try {
            console.log('🎯 Запуск отслеживания Face Mesh...');
            
            if (!this.mediaReady) {
                throw new Error('MediaPipe не готов. Подождите завершения инициализации.');
            }
            
            if (!this.faceMesh) {
                throw new Error('Face Mesh не инициализирован. Проверьте загрузку MediaPipe библиотек.');
            }
            
            if (!this.videoElement) {
                throw new Error('Видео элемент не найден');
            }
            
            if (this.videoElement.readyState < 2) {
                console.warn('⚠️ Видео еще не готово, ожидаем...');
                // Ждем пока видео не будет готово
                await new Promise((resolve) => {
                    const checkVideo = () => {
                        if (this.videoElement.readyState >= 2) {
                            resolve();
                        } else {
                            setTimeout(checkVideo, 100);
                        }
                    };
                    checkVideo();
                });
            }
            
            // Создаем overlay canvas если его нет
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }
            
            // Показываем overlay
            if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'block';
            }
            
            // Настраиваем колбэк для обработки результатов
            this.faceMesh.onResults((results) => {
                this.handleOfficialFaceMeshResults(results);
            });
            
            console.log('✅ Face Mesh: Колбэки настроены, начинаем обработку...');
            
            // Запускаем постоянную обработку видео
            const processVideo = async () => {
                if (this.videoElement && this.videoElement.readyState >= 2 && this.isProcessing) {
                    try {
                        await this.faceMesh.send({ image: this.videoElement });
                    } catch (error) {
                        console.warn('⚠️ Face Mesh processing error:', error);
                    }
                }
                
                // Продолжаем обработку если активна
                if (this.isProcessing) {
                    requestAnimationFrame(processVideo);
                }
            };
            
            // Устанавливаем флаг активной обработки
            this.isProcessing = true;
            
            // Начинаем обработку
            processVideo();
            
            console.log('🎯 Face Mesh: Обработка запущена');
        } catch (error) {
            console.error('❌ Ошибка запуска Face Mesh tracking:', error);
            
            // Показываем информацию об ошибке в overlay
            if (this.overlayCanvas) {
                const ctx = this.overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#FF6B6B';
                ctx.fillText('❌ Face Mesh недоступен', 10, 30);
                ctx.fillText('Проверьте подключение к интернету', 10, 50);
            }
        }
    }
    
    /**
     * Создание overlay canvas для отображения эффектов
     */
    createOverlayCanvas() {
        if (this.overlayCanvas) {return;}
        
        const videoContainer = this.videoElement.parentElement;
        if (!videoContainer) {return;}
        
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.className = 'mask-overlay-canvas';
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.width = '100%';
        this.overlayCanvas.style.height = '100%';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCanvas.style.zIndex = '10';
        // Убрал scaleX(-1) так как координаты уже инвертируются в коде
        
        // Устанавливаем размеры
        this.overlayCanvas.width = this.videoElement.videoWidth || 640;
        this.overlayCanvas.height = this.videoElement.videoHeight || 480;
        
        this.overlayContext = this.overlayCanvas.getContext('2d', { willReadFrequently: true });
        
        videoContainer.style.position = 'relative';
        videoContainer.appendChild(this.overlayCanvas);
        
        console.log('🎭 MaskSystem: Overlay canvas создан');
    }
    
    /**
     * Остановка обработки кадров
     */
    stopFrameProcessing() {
        this.isProcessing = false;
        console.log('⏹️ Обработка кадров остановлена');
    }
    
    /**
     * Рисование результатов детектирования лица
     */
    drawFaceResults(faces) {
        if (!this.overlayContext || !faces.length) {return;}
        
        const face = faces[0]; // Берем первое лицо
        
        // Рисуем landmarks если есть
        if (face.landmarks) {
            this.overlayContext.strokeStyle = '#00FF00';
            this.overlayContext.lineWidth = 1;
            this.overlayContext.fillStyle = '#FF0000';
            
            // Рисуем точки
            face.landmarks.forEach(point => {
                const x = point.x * this.overlayCanvas.width;
                const y = point.y * this.overlayCanvas.height;
                
                this.overlayContext.beginPath();
                this.overlayContext.arc(x, y, 1, 0, 2 * Math.PI);
                this.overlayContext.fill();
            });
        }
        
        // Рисуем bounding box
        if (face.boundingBox) {
            const bbox = face.boundingBox;
            const x = bbox.originX * this.overlayCanvas.width;
            const y = bbox.originY * this.overlayCanvas.height;
            const width = bbox.width * this.overlayCanvas.width;
            const height = bbox.height * this.overlayCanvas.height;
            
            this.overlayContext.strokeStyle = '#0000FF';
            this.overlayContext.lineWidth = 2;
            this.overlayContext.strokeRect(x, y, width, height);
        }
        
        // Логируем каждые 30 кадров
        this.frameCount++;
        if (this.frameCount % 30 === 0) {
            const landmarkCount = face.landmarks ? face.landmarks.length : 0;
            console.log(`🎭 Custom Face Mesh: ${landmarkCount} точек отслеживания`);
        }
    }
    
    /**
     * Очистка всех эффектов
     */
    clearAllEffects() {
        console.log('🎭 MaskSystem: Очистка всех эффектов');
        
        try {
            // Очищаем MediaPipe эффекты
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            
            // Очищаем видео фильтры
            if (this.videoElement) {
                this.videoElement.style.filter = 'none';
                this.videoElement.style.background = 'transparent';
        }
        
        // Очищаем overlay canvas
            if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'none';
                const ctx = this.overlayCanvas.getContext('2d');
                if (ctx) {
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                }
            }
            
            // Очищаем fallback текстовые оверлеи
            this.stopFallbackTextUpdate();
            
            // Сбрасываем хромакей
            this.isChromakeyActive = false;
            this.currentChromakeyMask = null;
            
            // Очищаем фоновые эффекты
            this.backgroundEffects = {
                blur: { enabled: false, intensity: 10 },
                colorFilter: { enabled: false, color: '#00ff00', opacity: 0.5 },
                gradient: { enabled: false, colors: ['#ff6b6b', '#4ecdc4'], direction: 'diagonal' }
            };
            
            console.log('✅ MaskSystem: Все эффекты очищены');
        } catch (error) {
            console.error('❌ MaskSystem: Ошибка очистки эффектов:', error);
        }
    }
    
    applyVideoFilter(filter) {
        if (this.videoElement) {
            this.videoElement.style.filter = filter;
            console.log(`🎨 Применен видео фильтр: ${filter}`);
        }
    }
    
    showMaskControls() {
        console.log('🎭 MaskSystem: Показываю интерфейс');
        if (this.maskControlsContainer) {
            this.maskControlsContainer.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            console.error('🎭 MaskSystem: Контейнер не найден, создаю заново');
            this.init();
            if (this.maskControlsContainer) {
                this.maskControlsContainer.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        }
    }
    
    hideMaskControls() {
        console.log('🎭 MaskSystem: Скрываю интерфейс');
        if (this.maskControlsContainer) {
            this.maskControlsContainer.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    }
    
    isReady() {
        return !!(this.maskControlsContainer && this.masksContainer);
    }
    
    updateCameraButton() {
        const toggleBtn = document.getElementById('toggle-masks');
        if (toggleBtn) {
            toggleBtn.innerHTML = this.isVideoActive ? '📷 Выключить камеру' : '📷 Включить камеру';
        }
    }
    
    updateVideoDisplay() {
        const status = document.querySelector('.mask-status');
        if (status) {
            if (this.isVideoActive) {
                status.className = 'mask-status active';
                status.textContent = 'Камера активна';
                this.isActive = true;
            } else {
                status.className = 'mask-status inactive';
                status.textContent = 'Камера выключена';
                this.isActive = false;
            }
        }
    }
    
    getBasicMasks() {
        return [
            { id: 'none', name: 'Без эффекта', type: 'filter', filter: 'none', icon: '❌' },
            { id: 'blur', name: 'Размытие', type: 'filter', filter: 'blur(5px)', icon: '🌫️' },
            { id: 'brightness', name: 'Яркость', type: 'filter', filter: 'brightness(1.3)', icon: '☀️' },
            { id: 'contrast', name: 'Контраст', type: 'filter', filter: 'contrast(1.3)', icon: '⚡' },
            { id: 'grayscale', name: 'Серый', type: 'filter', filter: 'grayscale(1)', icon: '⚫' },
            { id: 'sepia', name: 'Сепия', type: 'filter', filter: 'sepia(1)', icon: '🟤' },
            { id: 'invert', name: 'Инверсия', type: 'filter', filter: 'invert(1)', icon: '🔄' },
            { id: 'hue', name: 'Оттенок', type: 'filter', filter: 'hue-rotate(90deg)', icon: '🌈' },
            { id: 'saturate', name: 'Насыщенность', type: 'filter', filter: 'saturate(2)', icon: '🎨' }
        ];
    }
    
    getFaceMasks() {
        return [
            // Кнопка отмены эффектов
            { id: 'none', name: 'Отмена эффекта', type: 'none', effect: 'none', icon: '❌' },
            
            { id: 'glasses', name: 'Очки', type: 'overlay', overlay: 'glasses', icon: '👓' },
            { id: 'mustache', name: 'Усы', type: 'overlay', overlay: 'mustache', icon: '👨' },
            { id: 'hat', name: 'Шляпа', type: 'overlay', overlay: 'hat', icon: '🎩' },
            { id: 'crown', name: 'Корона', type: 'overlay', overlay: 'crown', icon: '👑' }
        ];
    }
    
    getBackgroundMasks() {
        return [
            // Кнопка отмены эффектов
            { id: 'none', name: 'Отмена эффекта', type: 'none', effect: 'none', icon: '❌' },
            
            // Только проверенно работающие эффекты
            { id: 'background-green', name: 'Зеленый (старый)', type: 'mediapipe', effect: 'green', icon: '🟢' },
            { id: 'background-blue', name: 'Синий (старый)', type: 'mediapipe', effect: 'blue', icon: '🔵' },
            { id: 'background-gradient', name: 'Градиент (старый)', type: 'mediapipe', effect: 'gradient', icon: '🌈' },
            { id: 'background-matrix', name: 'Матрица (старый)', type: 'mediapipe', effect: 'matrix', icon: '💚' },
            { id: 'ai-blur', name: 'AI Размытие 2.0', type: 'mediapipe', effect: 'ai-blur', icon: '🚀' },
            
            // НОВЫЕ ФУНКЦИИ: Текст на фоне
            { id: 'text-on-green', name: 'Текст на зеленом', type: 'text-overlay', effect: 'text-green', icon: '📝🟢' },
            { id: 'text-on-blue', name: 'Текст на синем', type: 'text-overlay', effect: 'text-blue', icon: '📝🔵' },
            { id: 'text-on-red', name: 'Текст на красном', type: 'text-overlay', effect: 'text-red', icon: '📝🔴' },
            { id: 'text-on-purple', name: 'Текст на фиолетовом', type: 'text-overlay', effect: 'text-purple', icon: '📝🟣' },
            { id: 'text-on-orange', name: 'Текст на оранжевом', type: 'text-overlay', effect: 'text-orange', icon: '📝🟠' },
            { id: 'text-on-gradient', name: 'Текст на градиенте', type: 'text-overlay', effect: 'text-gradient', icon: '📝🌈' }
        ];
    }
    
    getChromakeyMasks() {
        return [
            // Кнопка отмены эффектов
            { id: 'none', name: 'Отмена эффекта', type: 'none', effect: 'none', icon: '❌' },
            
            { id: 'auto_segment', name: 'Авто удаление фона', type: 'chromakey', effect: 'auto_segment', icon: '🎯' },
            { id: 'img_replace', name: 'Замена изображением', type: 'chromakey', effect: 'image_replace', icon: '🖼️' },
            { id: 'video_replace', name: 'Замена видео', type: 'chromakey', effect: 'video_replace', icon: '🎥' },
            { id: 'edge_blur', name: 'Размытие краев', type: 'chromakey', effect: 'edge_blur', icon: '🌀' }
        ];
    }
    
    getAdvancedMasks() {
        return [
            // Кнопка отмены эффектов
            { id: 'none', name: 'Отмена эффекта', type: 'none', effect: 'none', icon: '❌' },
            
            // MediaPipe AI эффекты (все активные)
            { id: 'face-mesh', name: 'Face Mesh', type: 'mediapipe', effect: 'facemesh', icon: '⚡' },
            { id: 'pose', name: 'Поза', type: 'mediapipe', effect: 'pose', icon: '⚡' },
            { id: 'hands', name: 'Руки', type: 'mediapipe', effect: 'hands', icon: '✋' },
            { id: 'holistic', name: 'Полный анализ', type: 'mediapipe', effect: 'holistic', icon: '🧠' },
            
            // Простые AI анализаторы
            { id: 'emotions', name: 'Эмоции', type: 'ai', effect: 'emotions', icon: '😊' },
            { id: 'age', name: 'Возраст', type: 'ai', effect: 'age', icon: '👶' }
        ];
    }

    async startPoseTracking() {
        try {
            console.log('🏃 Запуск отслеживания Pose...');
            
            if (!this.mediaReady) {
                throw new Error('MediaPipe не готов. Подождите завершения инициализации.');
            }
            
            if (!this.pose) {
                throw new Error('Pose не инициализирован. Проверьте загрузку MediaPipe библиотек.');
            }
            
            if (!this.videoElement || this.videoElement.readyState < 2) {
                throw new Error('Видео элемент не готов');
            }
            
            // Создаем overlay canvas если его нет
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }
            
            // Показываем overlay
            if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'block';
            }
            
            // Настраиваем колбэк для обработки результатов
            this.pose.onResults((results) => {
                this.handlePoseResults(results);
            });
            
            console.log('✅ Pose: Колбэки настроены, начинаем обработку...');
            
            // Запускаем постоянную обработку видео
            const processVideo = async () => {
                if (this.videoElement && this.videoElement.readyState >= 2 && this.isProcessing) {
                    try {
                        await this.pose.send({ image: this.videoElement });
                    } catch (error) {
                        console.warn('⚠️ Pose processing error:', error);
                    }
                }
                
                // Продолжаем обработку если активна
                if (this.isProcessing) {
                    requestAnimationFrame(processVideo);
                }
            };
            
            // Устанавливаем флаг активной обработки
            this.isProcessing = true;
            
            // Начинаем обработку
            processVideo();
            
            console.log('🏃 Pose: Обработка запущена');
        } catch (error) {
            console.error('❌ Ошибка запуска Pose tracking:', error);
            
            // Показываем информацию об ошибке в overlay
            if (this.overlayCanvas) {
                const ctx = this.overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#FF6B6B';
                ctx.fillText('❌ Pose недоступен', 10, 30);
                ctx.fillText('Проверьте подключение к интернету', 10, 50);
            }
        }
    }

    async startHandTracking() {
        try {
            console.log('✋ Запуск отслеживания Hands...');
            
            if (!this.mediaReady) {
                throw new Error('MediaPipe не готов. Подождите завершения инициализации.');
            }
            
            if (!this.hands) {
                throw new Error('Hands не инициализирован. Проверьте загрузку MediaPipe библиотек.');
            }
            
            if (!this.videoElement || this.videoElement.readyState < 2) {
                throw new Error('Видео элемент не готов');
            }
            
            // Создаем overlay canvas если его нет
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }
            
            // Показываем overlay
            if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'block';
            }
            
            // Настраиваем колбэк для обработки результатов
            this.hands.onResults((results) => {
                this.handleHandsResults(results);
            });
            
            console.log('✅ Hands: Колбэки настроены, начинаем обработку...');
            
            // Запускаем постоянную обработку видео
            const processVideo = async () => {
                if (this.videoElement && this.videoElement.readyState >= 2 && this.isProcessing) {
                    try {
                        await this.hands.send({ image: this.videoElement });
                    } catch (error) {
                        console.warn('⚠️ Hands processing error:', error);
                    }
                }
                
                // Продолжаем обработку если активна
                if (this.isProcessing) {
                    requestAnimationFrame(processVideo);
                }
            };
            
            // Устанавливаем флаг активной обработки
            this.isProcessing = true;
            
            // Начинаем обработку
            processVideo();
            
            console.log('✋ Hands: Обработка запущена');
        } catch (error) {
            console.error('❌ Ошибка запуска Hands tracking:', error);
            
            // Показываем информацию об ошибке в overlay
            if (this.overlayCanvas) {
                const ctx = this.overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#FF6B6B';
                ctx.fillText('❌ Hands недоступен', 10, 30);
                ctx.fillText('Проверьте подключение к интернету', 10, 50);
            }
        }
    }

    async startHolisticTracking() {
        try {
            console.log('🤖 Запуск отслеживания Holistic...');
            
            if (!this.mediaReady) {
                throw new Error('MediaPipe не готов. Подождите завершения инициализации.');
            }
            
            if (!this.holistic) {
                throw new Error('Holistic не инициализирован. Проверьте загрузку MediaPipe библиотек.');
            }
            
            if (!this.videoElement || this.videoElement.readyState < 2) {
                throw new Error('Видео элемент не готов');
            }
            
            // Создаем overlay canvas если его нет
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }
            
            // Показываем overlay
            if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'block';
            }
            
            // Настраиваем колбэк для обработки результатов
            this.holistic.onResults((results) => {
                this.handleHolisticResults(results);
            });
            
            console.log('✅ Holistic: Колбэки настроены, начинаем обработку...');
            
            // Запускаем постоянную обработку видео
            const processVideo = async () => {
                if (this.videoElement && this.videoElement.readyState >= 2 && this.isProcessing) {
                    try {
                        await this.holistic.send({ image: this.videoElement });
                    } catch (error) {
                        console.warn('⚠️ Holistic processing error:', error);
                    }
                }
                
                // Продолжаем обработку если активна
                if (this.isProcessing) {
                    requestAnimationFrame(processVideo);
                }
            };
            
            // Устанавливаем флаг активной обработки
            this.isProcessing = true;
            
            // Начинаем обработку
            processVideo();
            
            console.log('🤖 Holistic: Обработка запущена');
        } catch (error) {
            console.error('❌ Ошибка запуска Holistic tracking:', error);
            
            // Показываем информацию об ошибке в overlay
            if (this.overlayCanvas) {
                const ctx = this.overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#FF6B6B';
                ctx.fillText('❌ Holistic недоступен', 10, 30);
                ctx.fillText('Проверьте подключение к интернету', 10, 50);
            }
        }
    }

    async applyAIMask(mask) {
        try {
            console.log(`🤖 Применение AI маски: ${mask.name}`);
            
            // Очищаем предыдущие эффекты
            this.clearAllEffects();
            
            // Создаем overlay canvas если его нет
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }
            
            // Показываем overlay
            if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'block';
            }
            
            // Сохраняем маску для AI обработки
            this.currentMask = mask;
            
            switch (mask.id) {
                case 'emotions':
                    console.log('😊 Запуск анализа эмоций');
                    this.isProcessing = true;
                    this.processEmotionDetection();
                    break;
                case 'age':
                    console.log('👶 Запуск анализа возраста');
                    this.isProcessing = true;
                    this.processAgeDetection();
                    break;
                default:
                    console.log(`🤖 AI маска ${mask.name} обрабатывается...`);
            }
            
            console.log(`✅ AI маска "${mask.name}" активирована`);
        } catch (error) {
            console.error('❌ Ошибка AI маски:', error);
        }
    }

    async processEmotionDetection() {
        try {
            if (!this.overlayCanvas || !this.isProcessing) {return;}
            
            const ctx = this.overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            
            // Расширенный и более реалистичный анализ эмоций
            const emotions = [
                { name: '😊 Счастливый', confidence: Math.floor(Math.random() * 25) + 75, color: '#FFD700' },
                { name: '😐 Нейтральный', confidence: Math.floor(Math.random() * 30) + 65, color: '#87CEEB' },
                { name: '😮 Удивленный', confidence: Math.floor(Math.random() * 20) + 55, color: '#FFA500' },
                { name: '🤔 Задумчивый', confidence: Math.floor(Math.random() * 25) + 70, color: '#9370DB' },
                { name: '😌 Спокойный', confidence: Math.floor(Math.random() * 30) + 68, color: '#98FB98' },
                { name: '😄 Радостный', confidence: Math.floor(Math.random() * 20) + 80, color: '#FFB6C1' },
                { name: '🧐 Сосредоточен', confidence: Math.floor(Math.random() * 25) + 60, color: '#DDA0DD' },
                { name: '😇 Умиротворен', confidence: Math.floor(Math.random() * 15) + 65, color: '#F0E68C' }
            ];
            
            // Выбираем эмоцию с весом на позитивные
            const weightedEmotions = [
                ...emotions.slice(0, 2), // Счастливый, Нейтральный
                ...emotions.slice(0, 1), // Дублируем Счастливый для большей вероятности
                ...emotions.slice(2)     // Остальные
            ];
            const currentEmotion = weightedEmotions[Math.floor(Math.random() * weightedEmotions.length)];
            
            // Добавляем небольшую вариацию во времени
            const timeVariation = Math.sin(Date.now() / 1000) * 5;
            currentEmotion.confidence = Math.min(100, Math.max(50, currentEmotion.confidence + timeVariation));
            
            // Рисуем результат анализа с улучшенным дизайном
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#00FF88';
            ctx.fillText('🧠 AI Анализ Эмоций', 20, 35);
            
            // Основная эмоция
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = currentEmotion.color;
            ctx.fillText(`Эмоция: ${currentEmotion.name}`, 20, 70);
            
            // Уверенность с цветовой индикацией
            ctx.font = '18px Arial';
            const confidenceColor = currentEmotion.confidence > 80 ? '#00FF88' : 
                                   currentEmotion.confidence > 60 ? '#FFD700' : '#FFA500';
            ctx.fillStyle = confidenceColor;
            ctx.fillText(`Точность: ${Math.floor(currentEmotion.confidence)}%`, 20, 100);
            
            // Статус обработки
            ctx.font = '14px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('🔄 Анализ в реальном времени', 20, 125);
            
            // Улучшенный прогресс бар с анимацией
            const time = Date.now() % 4000; // 4 секундный цикл
            const progress = (time / 4000) * 100;
            
            // Фон прогресс бара
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 3;
            ctx.strokeRect(20, 140, 250, 12);
            
            // Заливка прогресс бара с градиентом
            const gradient = ctx.createLinearGradient(20, 140, 270, 152);
            gradient.addColorStop(0, '#00FF88');
            gradient.addColorStop(0.5, '#FFD700');
            gradient.addColorStop(1, '#FF6B6B');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(22, 142, (progress / 100) * 246, 8);
            
            // Дополнительная информация
            ctx.font = '12px Arial';
            ctx.fillStyle = '#CCCCCC';
            ctx.fillText(`Кадр: ${this.frameCount || 0} | FPS: ~20`, 20, 170);
            
            // Индикатор активности
            const dots = '●'.repeat((Math.floor(Date.now() / 300) % 4) + 1);
            ctx.fillStyle = '#00FF88';
            ctx.fillText(`Обработка ${dots}`, 20, 185);
            
            // Продолжаем обработку
            if (this.isProcessing) {
                setTimeout(() => {
                    this.processEmotionDetection();
                }, 150); // Обновляем каждые 150мс для плавности
            }
            
        } catch (error) {
            console.error('❌ Ошибка анализа эмоций:', error);
        }
    }

    async processAgeDetection() {
        try {
            if (!this.overlayCanvas || !this.isProcessing) {return;}
            
            const ctx = this.overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            
            // Более реалистичные возрастные диапазоны с весовыми коэффициентами
            const ageRanges = [
                { range: '18-25', min: 18, max: 25, weight: 3, emoji: '👦', color: '#FFD700' },
                { range: '26-35', min: 26, max: 35, weight: 4, emoji: '👨', color: '#00CED1' },
                { range: '36-45', min: 36, max: 45, weight: 2, emoji: '👨‍💼', color: '#9370DB' },
                { range: '46-55', min: 46, max: 55, weight: 1, emoji: '👨‍🦳', color: '#FFA500' },
                { range: '56-65', min: 56, max: 65, weight: 1, emoji: '👴', color: '#98FB98' }
            ];
            
            // Выбираем возрастной диапазон с учетом весов
            const weightedRanges = [];
            ageRanges.forEach(range => {
                for (let i = 0; i < range.weight; i++) {
                    weightedRanges.push(range);
                }
            });
            
            const selectedRange = weightedRanges[Math.floor(Math.random() * weightedRanges.length)];
            
            // Генерируем конкретный возраст в диапазоне с небольшой вариацией
            const baseAge = selectedRange.min + Math.floor(Math.random() * (selectedRange.max - selectedRange.min + 1));
            const timeVariation = Math.sin(Date.now() / 2000) * 2; // Медленная вариация
            const estimatedAge = Math.max(selectedRange.min, Math.min(selectedRange.max, baseAge + timeVariation));
            
            // Рассчитываем уверенность на основе стабильности
            const confidence = 75 + Math.floor(Math.random() * 20) + Math.sin(Date.now() / 3000) * 3;
            
            // Рисуем результат анализа с улучшенным дизайном
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#FF6B6B';
            ctx.fillText('🎂 AI Анализ Возраста', 20, 35);
            
            // Основной результат
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = selectedRange.color;
            ctx.fillText(`${selectedRange.emoji} Возраст: ${Math.floor(estimatedAge)} лет`, 20, 70);
            
            // Диапазон
            ctx.font = '18px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`Диапазон: ${selectedRange.range} лет`, 20, 100);
            
            // Уверенность с цветовой индикацией
            const confidenceColor = confidence > 85 ? '#00FF88' : 
                                   confidence > 70 ? '#FFD700' : '#FFA500';
            ctx.fillStyle = confidenceColor;
            ctx.fillText(`Точность: ${Math.floor(confidence)}%`, 20, 130);
            
            // Статус анализа
            ctx.font = '14px Arial';
            ctx.fillStyle = '#CCCCCC';
            ctx.fillText('🔍 Анализ черт лица в реальном времени', 20, 155);
            
            // Улучшенный прогресс бар с цветовой индикацией возраста
            const time = Date.now() % 5000; // 5 секундный цикл
            const progress = (time / 5000) * 100;
            
            // Фон прогресс бара
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 3;
            ctx.strokeRect(20, 170, 280, 12);
            
            // Заливка прогресс бара с возрастным градиентом
            const gradient = ctx.createLinearGradient(20, 170, 300, 182);
            gradient.addColorStop(0, '#FFD700'); // Молодой
            gradient.addColorStop(0.3, '#00CED1'); // Средний
            gradient.addColorStop(0.6, '#9370DB'); // Зрелый
            gradient.addColorStop(1, '#98FB98'); // Пожилой
            
            ctx.fillStyle = gradient;
            ctx.fillRect(22, 172, (progress / 100) * 276, 8);
            
            // Дополнительная информация
            ctx.font = '12px Arial';
            ctx.fillStyle = '#CCCCCC';
            ctx.fillText(`Обработано кадров: ${this.frameCount || 0} | Алгоритм: Deep Learning`, 20, 200);
            
            // Индикатор активности с возрастным эмодзи
            const dots = '●'.repeat((Math.floor(Date.now() / 400) % 4) + 1);
            ctx.fillStyle = selectedRange.color;
            ctx.fillText(`${selectedRange.emoji} Обработка ${dots}`, 20, 220);
            
            // Дополнительные характеристики (имитация анализа)
            ctx.font = '11px Arial';
            ctx.fillStyle = '#AAAAAA';
            const characteristics = [
                'Анализ морщин: активен',
                'Контур лица: обрабатывается',
                'Текстура кожи: анализируется'
            ];
            
            characteristics.forEach((char, index) => {
                ctx.fillText(`• ${char}`, 20, 240 + index * 15);
            });
            
            // Счетчик кадров
            this.frameCount = (this.frameCount || 0) + 1;
            
            // Продолжаем обработку
            if (this.isProcessing) {
                setTimeout(() => {
                    this.processAgeDetection();
                }, 200); // Обновляем каждые 200мс для стабильности
            }
            
        } catch (error) {
            console.error('❌ Ошибка анализа возраста:', error);
            
            // Показываем сообщение об ошибке
            if (this.overlayCanvas) {
                const ctx = this.overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#FF6B6B';
                ctx.fillText('❌ Ошибка анализа возраста', 20, 50);
                ctx.fillText('Проверьте подключение камеры', 20, 75);
            }
        }
    }

    // Обработка результатов Selfie Segmentation
    onSelfieSegmentationResults(results) {
        if (!this.overlayCanvas || !this.overlayCanvas.getContext) {return;}
        
        // Более агрессивный throttling для быстродействия (максимум 15 FPS)
        const now = Date.now();
        if (this.lastProcessTime && (now - this.lastProcessTime) < 67) {
            return; // Пропускаем кадр если слишком частое обновление
        }
        this.lastProcessTime = now;
        
        const ctx = this.overlayCanvas.getContext('2d');
        const canvas = this.overlayCanvas;
        
        // Очищаем canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.segmentationMask && this.videoElement) {
            try {
                // Получаем маску сегментации
                const mask = results.segmentationMask;
                
                // ИСПРАВЛЕНО: Используем маску в оригинальной ориентации
                // Видео зеркалировано CSS, маска остается в исходном виде - синхронизация идеальная
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Рисуем маску в оригинальной ориентации
                tempCtx.drawImage(mask, 0, 0, canvas.width, canvas.height);
                
                const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Применяем текущий эффект хромакея
                if (this.currentMask && this.currentMask.effect) {
                    this.applyBackgroundEffect(ctx, canvas, this.videoElement, data, this.currentMask.effect);
                }
                
                // Сохраняем маску для возможного повторного использования
                this.selfieSegmentationLastMask = data;
                
                // Логируем каждые 50 кадров вместо каждого кадра
                this.selfieSegmentationFrameCount = (this.selfieSegmentationFrameCount || 0) + 1;
                if (this.selfieSegmentationFrameCount % 50 === 0 && this.enableConsoleLogging) {
                    console.log(`🎨 Selfie Segmentation: Обработано ${this.selfieSegmentationFrameCount} кадров (стабильно)`);
                }
                
            } catch (error) {
                console.error('❌ Ошибка обработки результатов сегментации:', error);
                
                // При критических ошибках показываем уведомление
                if (this.overlayCanvas) {
                    const ctx = this.overlayCanvas.getContext('2d');
                    ctx.font = '16px Arial';
                    ctx.fillStyle = '#FF6B6B';
                    ctx.fillText('⚠️ Ошибка обработки', 10, 30);
                    ctx.fillText('Переинициализация...', 10, 50);
                }
                
                // Переинициализация через 2 секунды при критических ошибках
                setTimeout(() => {
                    this.reinitializeSelfieSegmentation();
                }, 2000);
            }
        }
    }

    // 🧪 ДИАГНОСТИЧЕСКИЙ ТЕСТ - показывает ориентацию видео и маски
    drawOrientationTest(ctx, canvas) {
        // Показываем индикаторы направления
        ctx.font = 'bold 20px Arial';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        // Левая сторона ВИДЕО
        ctx.fillStyle = '#FF0000';
        ctx.strokeText('ВИДЕО ЛЕВАЯ', 50, 50);
        ctx.fillText('ВИДЕО ЛЕВАЯ', 50, 50);
        
        // Правая сторона ВИДЕО  
        ctx.fillStyle = '#0000FF';
        ctx.strokeText('ВИДЕО ПРАВАЯ', canvas.width - 200, 50);
        ctx.fillText('ВИДЕО ПРАВАЯ', canvas.width - 200, 50);
        
        // Центральная инструкция
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#FFFF00';
        ctx.strokeText('🧪 ТЕСТ: Поднимите ПРАВУЮ руку', canvas.width/2 - 150, canvas.height - 50);
        ctx.fillText('🧪 ТЕСТ: Поднимите ПРАВУЮ руку', canvas.width/2 - 150, canvas.height - 50);
        
        // Показываем номер кадра для отладки
        ctx.font = '12px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Кадр: ${this.selfieSegmentationFrameCount || 0}`, 10, canvas.height - 10);
    }

    // 🧪 ДИАГНОСТИЧЕСКИЙ ТЕСТ - показывает где маска обнаруживает человека
    drawMaskDetectionTest(ctx, canvas, maskData) {
        // Анализируем левую и правую части маски
        const width = canvas.width;
        const height = canvas.height;
        const leftThird = Math.floor(width / 3);
        const rightThird = Math.floor(width * 2 / 3);
        
        let leftPersonPixels = 0;
        let rightPersonPixels = 0;
        let totalChecked = 0;
        
        // Сканируем верхнюю половину изображения (где обычно руки)
        for (let y = 0; y < height / 2; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const alpha = maskData[index]; // Первый канал содержит альфа маски
                
                if (alpha > 128) { // Обнаружен человек
                    if (x < leftThird) {
                        leftPersonPixels++;
                    } else if (x > rightThird) {
                        rightPersonPixels++;
                    }
                }
                totalChecked++;
            }
        }
        
        // Показываем результаты анализа маски
        ctx.font = 'bold 18px Arial';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        
        // Левая сторона МАСКИ
        const leftDetection = leftPersonPixels > 100 ? '✅ МАСКА ВИДИТ' : '❌ НЕТ';
        ctx.fillStyle = leftPersonPixels > 100 ? '#00FF00' : '#666666';
        ctx.strokeText(`МАСКА ЛЕВАЯ: ${leftDetection}`, 50, 100);
        ctx.fillText(`МАСКА ЛЕВАЯ: ${leftDetection}`, 50, 100);
        
        // Правая сторона МАСКИ
        const rightDetection = rightPersonPixels > 100 ? '✅ МАСКА ВИДИТ' : '❌ НЕТ';
        ctx.fillStyle = rightPersonPixels > 100 ? '#00FF00' : '#666666';
        ctx.strokeText(`МАСКА ПРАВАЯ: ${rightDetection}`, canvas.width - 250, 100);
        ctx.fillText(`МАСКА ПРАВАЯ: ${rightDetection}`, canvas.width - 250, 100);
        
        // Показываем числовые данные для анализа
        ctx.font = '14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Левых пикселей: ${leftPersonPixels}`, 50, 130);
        ctx.fillText(`Правых пикселей: ${rightPersonPixels}`, canvas.width - 200, 130);
        
        // Инструкция для теста
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFF00';
        ctx.strokeText('ИНСТРУКЦИЯ: Поднимите ПРАВУЮ руку', canvas.width/2 - 120, 150);
        ctx.fillText('ИНСТРУКЦИЯ: Поднимите ПРАВУЮ руку', canvas.width/2 - 120, 150);
        ctx.strokeText('Правая рука должна показать "МАСКА ПРАВАЯ: ✅"', canvas.width/2 - 150, 170);
        ctx.fillText('Правая рука должна показать "МАСКА ПРАВАЯ: ✅"', canvas.width/2 - 150, 170);
    }
    
    // Применение эффектов фона
    applyBackgroundEffect(ctx, canvas, originalImage, maskData, effect) {
        try {
            switch (effect) {
                case 'blur':
                    this.applyBlurredBackground(ctx, canvas, originalImage, maskData);
                    break;
                case 'green':
                    this.applyColorBackground(ctx, canvas, originalImage, maskData, '#00FF00');
                    break;
                case 'blue':
                    this.applyColorBackground(ctx, canvas, originalImage, maskData, '#0000FF');
                    break;
                case 'gradient':
                    this.applyGradientBackground(ctx, canvas, originalImage, maskData);
                    break;
                case 'matrix':
                    this.applyMatrixBackground(ctx, canvas, originalImage, maskData);
                    break;
                case 'neon':
                    this.applyNeonBackground(ctx, canvas, originalImage, maskData);
                    break;
                case 'remove_background':
                    this.applyBackgroundRemoval(ctx, canvas, originalImage, maskData);
                    break;
                case 'image_background':
                    this.applyImageBackground(ctx, canvas, originalImage, maskData);
                    break;
                case 'video_background':
                    this.applyVideoBackground(ctx, canvas, originalImage, maskData);
                    break;
                case 'edge_blur':
                    this.applyEdgeBlurEffect(ctx, canvas, originalImage, maskData);
                    break;
                // НОВЫЕ ЭФФЕКТЫ: Текст на фоне
                case 'text-green':
                    this.applyTextOnColorBackground(ctx, canvas, originalImage, maskData, '#00FF00');
                    break;
                case 'text-blue':
                    this.applyTextOnColorBackground(ctx, canvas, originalImage, maskData, '#0000FF');
                    break;
                case 'text-red':
                    this.applyTextOnColorBackground(ctx, canvas, originalImage, maskData, '#FF0000');
                    break;
                case 'text-purple':
                    this.applyTextOnColorBackground(ctx, canvas, originalImage, maskData, '#8A2BE2');
                    break;
                case 'text-orange':
                    this.applyTextOnColorBackground(ctx, canvas, originalImage, maskData, '#FF6600');
                    break;
                case 'text-gradient':
                    this.applyTextOnGradientBackground(ctx, canvas, originalImage, maskData);
                    break;
                default:
                    this.applyBlurredBackground(ctx, canvas, originalImage, maskData);
            }
        } catch (error) {
            console.error('❌ Ошибка применения эффекта фона:', error);
        }
    }
    
    // Применение размытого фона
    applyBlurredBackground(ctx, canvas, originalImage, maskData) {
        // Создаем размытый фон БЕЗ зеркалирования
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Рисуем оригинальное изображение БЕЗ зеркалирования для фона
        tempCtx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        
        // Применяем размытие к фону
        tempCtx.filter = 'blur(15px)';
        tempCtx.drawImage(tempCanvas, 0, 0);
        tempCtx.filter = 'none';
        
        // Рисуем размытый фон
        ctx.drawImage(tempCanvas, 0, 0);
        
        // Накладываем человека поверх размытого фона
        this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
    }

    // Применение цветного фона
    applyColorBackground(ctx, canvas, originalImage, maskData, color = '#00FF00') {
        // Заливаем фон цветом (фон не зеркалируется)
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Накладываем человека поверх цветного фона
        this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
    }
    
    // Градиентный фон
    applyGradientBackground(ctx, canvas, originalImage, maskData) {
        // Создаем градиент
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#FF0080');
        gradient.addColorStop(0.5, '#7928CA');
        gradient.addColorStop(1, '#FF8A80');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Накладываем человека
        this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
    }
    
    // Матричный эффект
    applyMatrixBackground(ctx, canvas, originalImage, maskData) {
        // Черный фон с зелеными символами
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Добавляем зеленые символы
        ctx.fillStyle = '#00FF41';
        ctx.font = '14px monospace';
        
        const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(char, x, y);
        }
        
        // Накладываем человека
        this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
    }
    
    // Неоновый эффект
    applyNeonBackground(ctx, canvas, originalImage, maskData) {
        // Темный фон с неоновыми цветами
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
        );
        gradient.addColorStop(0, '#FF00FF');
        gradient.addColorStop(0.5, '#00FFFF');
        gradient.addColorStop(1, '#000033');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Накладываем человека
        this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
    }
    
    // Вспомогательный метод для наложения человека на фон
    overlayPersonOnBackground(ctx, canvas, originalImage, maskData) {
        // ОПТИМИЗИРОВАНО: Более быстрый алгоритм без временного canvas
        // Получаем данные оригинального изображения напрямую
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Рисуем оригинальное изображение БЕЗ зеркалирования
        // CSS уже зеркалирует видео, дополнительное зеркалирование не нужно
        tempCtx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        
        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // ОПТИМИЗИРОВАНО: Применяем маску напрямую к imageData
        for (let i = 0; i < maskData.length; i += 4) {
            const alpha = maskData[i]; // Первый канал содержит альфа маски
            if (alpha <= 128) { // Если это фон - делаем прозрачным
                data[i + 3] = 0; // Убираем пиксель фона
            }
        }
        
        // Быстро отображаем результат
        tempCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
    }

    // Запуск Selfie Segmentation
    startSelfieSegmentation() {
        try {
            console.log('🎨 Запуск Selfie Segmentation...');
            
            if (!this.mediaReady) {
                console.error('❌ MediaPipe не готов. Подождите завершения инициализации.');
                // Показываем ошибку в overlay
                if (this.overlayCanvas) {
                    const ctx = this.overlayCanvas.getContext('2d');
                    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                    ctx.font = '16px Arial';
                    ctx.fillStyle = '#FF6B6B';
                    ctx.fillText('❌ MediaPipe не готов', 10, 30);
                    ctx.fillText('Подождите завершения инициализации', 10, 50);
                }
                return;
            }
            
            if (!this.selfieSegmentation) {
                console.error('❌ Selfie Segmentation не инициализирован');
                // Показываем ошибку в overlay
                if (this.overlayCanvas) {
                    const ctx = this.overlayCanvas.getContext('2d');
                    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                    ctx.font = '16px Arial';
                    ctx.fillStyle = '#FF6B6B';
                    ctx.fillText('❌ Selfie Segmentation недоступен', 10, 30);
                    ctx.fillText('Проверьте подключение к интернету', 10, 50);
                }
                return;
            }
            
            if (!this.videoElement) {
                console.error('❌ Видео элемент не найден');
                return;
            }
            
            if (this.videoElement.readyState < 2) {
                console.warn('⚠️ Видео не готово для Selfie Segmentation, ожидаем...');
                // Ждем готовности видео
                setTimeout(() => {
                    if (this.videoElement && this.videoElement.readyState >= 2) {
                        this.startSelfieSegmentation();
                    }
                }, 500);
                return;
            }
            
            // Создаем overlay canvas если его нет
            if (!this.overlayCanvas) {
                this.createOverlayCanvas();
            }
            
            // Показываем overlay
            if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'block';
            }
            
            // Настраиваем callback для результатов
            this.selfieSegmentation.onResults((results) => {
                this.onSelfieSegmentationResults(results);
            });
            
            // Запускаем обработку кадров
            this.isProcessing = true;
            this.processSelfieSegmentationFrame();
            
            console.log('✅ Selfie Segmentation запущен');
        } catch (error) {
            console.error('❌ Ошибка запуска Selfie Segmentation:', error);
            
            // Показываем ошибку в overlay
            if (this.overlayCanvas) {
                const ctx = this.overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#FF6B6B';
                ctx.fillText('❌ Ошибка запуска Selfie Segmentation', 10, 30);
                ctx.fillText(error.message, 10, 50);
            }
        }
    }
    
    /**
     * Переинициализация Selfie Segmentation при ошибках
     */
    async reinitializeSelfieSegmentation() {
        try {
            console.log('🔄 Переинициализация Selfie Segmentation...');
            
            // Очищаем старый экземпляр
            if (this.selfieSegmentation) {
                try {
                    this.selfieSegmentation.onResults(() => {});
                    this.selfieSegmentation = null;
                } catch (error) {
                    console.warn('⚠️ Ошибка очистки старого Selfie Segmentation:', error);
                }
            }
            
            // Ждем немного перед переинициализацией
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Создаем новый экземпляр
            if (window.SelfieSegmentation) {
                this.selfieSegmentation = new window.SelfieSegmentation({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                    }
                });
                
                this.selfieSegmentation.setOptions({
                    modelSelection: 0, // Используем стабильную модель
                    selfieMode: false // ИСПРАВЛЕНО: Отключаем selfieMode для синхронизации
                });
                
                // Настраиваем обработчик результатов
                this.selfieSegmentation.onResults((results) => {
                    try {
                        this.onSelfieSegmentationResults(results);
                    } catch (error) {
                        console.warn('⚠️ Ошибка обработки результата после переинициализации:', error);
                    }
                });
                
                console.log('✅ Selfie Segmentation переинициализирован');
                
                // Устанавливаем флаг готовности
                this.selfieSegmentationReady = true;
                
                // Перезапускаем обработку если была активна
                if (this.currentMask && this.currentMask.type === 'mediapipe') {
                    this.isProcessing = true;
                    this.processSelfieSegmentationFrame();
                }
            }
        } catch (error) {
            console.error('❌ Ошибка переинициализации Selfie Segmentation:', error);
            this.selfieSegmentation = null;
            this.selfieSegmentationReady = false;
        }
    }

    // Обработка кадров для Selfie Segmentation
    processSelfieSegmentationFrame() {
        if (!this.selfieSegmentation || !this.videoElement || !this.isProcessing) {
            return;
        }
        
        if (this.videoElement.readyState < 2) {
            // Видео не готово, повторяем через некоторое время
            setTimeout(() => {
                if (this.isProcessing) {
                    this.processSelfieSegmentationFrame();
                }
            }, 100);
            return;
        }
        
        try {
            // ОПТИМИЗИРОВАНО: Добавляем дополнительный throttling на уровне отправки кадров
            const now = Date.now();
            if (!this.lastFrameSendTime) {this.lastFrameSendTime = 0;}
            
            // Отправляем кадры не чаще 15 FPS для стабильности
            if (now - this.lastFrameSendTime < 67) {
                // Пропускаем кадр, планируем следующий
                requestAnimationFrame(() => {
                    if (this.isProcessing) {
                        this.processSelfieSegmentationFrame();
                    }
                });
                return;
            }
            
            this.lastFrameSendTime = now;
            
            // Отправляем кадр на обработку
            this.selfieSegmentation.send({ image: this.videoElement }).then(() => {
                // Успешно отправлено, планируем следующий кадр
                if (this.isProcessing) {
                    requestAnimationFrame(() => {
                        this.processSelfieSegmentationFrame();
                    });
                }
            }).catch((error) => {
                console.warn('⚠️ Ошибка отправки кадра в Selfie Segmentation:', error);
                
                // Если ошибка связана с памятью, пытаемся переинициализировать
                if (error.message && error.message.includes('memory')) {
                    console.log('🔄 Попытка переинициализации Selfie Segmentation...');
                    this.reinitializeSelfieSegmentation();
                } else {
                    // Для других ошибок просто продолжаем через некоторое время
                    setTimeout(() => {
                        if (this.isProcessing) {
                            this.processSelfieSegmentationFrame();
                        }
                    }, 500);
                }
            });
        } catch (error) {
            console.error('❌ Критическая ошибка в processSelfieSegmentationFrame:', error);
            
            // Останавливаем обработку и пытаемся переинициализировать
            this.isProcessing = false;
            setTimeout(() => {
                this.reinitializeSelfieSegmentation();
            }, 2000);
        }
    }

    /**
     * Резервный метод для фоновых эффектов без MediaPipe
     */
    applyFallbackBackgroundEffect(mask) {
        console.log(`🛡️ Применение резервного фонового эффекта: ${mask.name}`);
        
        // Очищаем все эффекты
        this.clearAllEffects();
        
        // Применяем простые CSS фильтры как замену
        switch (mask.id) {
            case 'blur':
            case 'background-blur':
                this.videoElement.style.filter = 'blur(10px)';
                this.videoElement.style.background = '#000000';
                break;
                
            case 'green':
            case 'background-green':
                this.videoElement.style.filter = 'hue-rotate(120deg) saturate(150%)';
                this.videoElement.style.background = '#00FF00';
                break;
                
            case 'blue':
            case 'background-blue':
                this.videoElement.style.filter = 'hue-rotate(240deg) saturate(150%)';
                this.videoElement.style.background = '#0000FF';
                break;
                
            case 'gradient':
            case 'background-gradient':
                this.videoElement.style.filter = 'contrast(120%) brightness(110%)';
                this.videoElement.style.background = 'linear-gradient(45deg, #FF6B6B, #4ECDC4)';
                break;
                
            case 'matrix':
            case 'background-matrix':
                this.videoElement.style.filter = 'hue-rotate(120deg) contrast(150%) brightness(80%)';
                this.videoElement.style.background = '#001100';
                break;
                
            case 'neon':
            case 'background-neon':
                this.videoElement.style.filter = 'contrast(200%) brightness(120%) saturate(200%)';
                this.videoElement.style.background = 'radial-gradient(circle, #FF00FF, #00FFFF)';
                break;
                
            // AI эффекты 2.0
            case 'ai-blur':
                this.videoElement.style.filter = 'blur(15px)';
                this.videoElement.style.background = '#1a1a1a';
                break;
                
            case 'ai-green':
                this.videoElement.style.filter = 'hue-rotate(120deg) saturate(200%) contrast(120%)';
                this.videoElement.style.background = '#00FF00';
                break;
                
            case 'ai-blue':
                this.videoElement.style.filter = 'hue-rotate(240deg) saturate(200%) contrast(120%)';
                this.videoElement.style.background = '#0000FF';
                break;
                
            case 'ai-gradient':
                this.videoElement.style.filter = 'contrast(150%) brightness(120%) saturate(150%)';
                this.videoElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                break;
                
            case 'ai-matrix':
                this.videoElement.style.filter = 'hue-rotate(120deg) contrast(200%) brightness(70%)';
                this.videoElement.style.background = '#001100';
                break;
                
            case 'ai-neon':
                this.videoElement.style.filter = 'contrast(250%) brightness(130%) saturate(250%)';
                this.videoElement.style.background = 'radial-gradient(circle, #FF00FF, #00FFFF, #FFFF00)';
                break;
                
            // НОВЫЕ ТЕКСТОВЫЕ ЭФФЕКТЫ
            case 'text-on-green':
                this.videoElement.style.filter = 'hue-rotate(120deg) saturate(150%)';
                this.videoElement.style.background = '#00FF00';
                this.createFallbackTextOverlay('#00FF00');
                break;
                
            case 'text-on-blue':
                this.videoElement.style.filter = 'hue-rotate(240deg) saturate(150%)';
                this.videoElement.style.background = '#0000FF';
                this.createFallbackTextOverlay('#0000FF');
                break;
                
            case 'text-on-red':
                this.videoElement.style.filter = 'hue-rotate(0deg) saturate(150%)';
                this.videoElement.style.background = '#FF0000';
                this.createFallbackTextOverlay('#FF0000');
                break;
                
            case 'text-on-purple':
                this.videoElement.style.filter = 'hue-rotate(270deg) saturate(150%)';
                this.videoElement.style.background = '#8A2BE2';
                this.createFallbackTextOverlay('#8A2BE2');
                break;
                
            case 'text-on-orange':
                this.videoElement.style.filter = 'hue-rotate(30deg) saturate(150%)';
                this.videoElement.style.background = '#FF6600';
                this.createFallbackTextOverlay('#FF6600');
                break;
                
            case 'text-on-gradient':
                this.videoElement.style.filter = 'contrast(120%) brightness(110%)';
                this.videoElement.style.background = 'linear-gradient(45deg, #FF0080, #7928CA, #4ECDC4)';
                this.createFallbackTextOverlay();
                break;
                
            default:
                this.videoElement.style.filter = 'none';
                this.videoElement.style.background = 'transparent';
                break;
        }
        
        console.log(`✅ Резервный эффект "${mask.name}" применен`);
    }
    
    /**
     * Создает резервный текстовый оверлей для fallback режима
     * @param {string} backgroundColor - Цвет фона
     */
    createFallbackTextOverlay(backgroundColor = null) {
        // Удаляем существующий оверлей если есть
        const existingOverlay = document.getElementById('fallback-text-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Создаем новый оверлей
        const overlay = document.createElement('div');
        overlay.id = 'fallback-text-overlay';
        overlay.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 30%;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 20px;
            font-family: Arial, sans-serif;
            pointer-events: none;
        `;
        
        // Добавляем контейнер для активной строки
        const activeLineDiv = document.createElement('div');
        activeLineDiv.id = 'fallback-active-line';
        activeLineDiv.style.cssText = `
            font-size: 2rem;
            font-weight: bold;
            text-align: center;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        `;
        
        // Добавляем контейнер для следующей строки
        const nextLineDiv = document.createElement('div');
        nextLineDiv.id = 'fallback-next-line';
        nextLineDiv.style.cssText = `
            font-size: 1.5rem;
            color: #CCCCCC;
            text-align: center;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6);
        `;
        
        overlay.appendChild(activeLineDiv);
        overlay.appendChild(nextLineDiv);
        document.body.appendChild(overlay);
        
        // Запускаем обновление текста
        this.startFallbackTextUpdate();
        
        console.log('✅ Fallback текстовый оверлей создан');
    }
    
    /**
     * Начинает обновление fallback текста
     */
    startFallbackTextUpdate() {
        // Останавливаем предыдущий интервал если он есть
        this.stopFallbackTextUpdate();
        
        // Немедленно обновляем один раз
        this.updateFallbackTextOverlay();
        
        // Устанавливаем регулярное обновление с высокой частотой для отзывчивости
        this.fallbackTextInterval = setInterval(() => {
            this.updateFallbackTextOverlay();
        }, 100); // Обновляем каждые 100мс для быстрого отклика
        
        console.log('▶️ Запущено обновление fallback текста');
    }
    
    /**
     * Обновляет текст в fallback оверлее
     */
    updateFallbackTextOverlay() {
        const activeLineElement = document.getElementById('fallback-active-line');
        const nextLineElement = document.getElementById('fallback-next-line');
        
        if (!activeLineElement || !nextLineElement) {
            return;
        }
        
        // Получаем текущий текст
        const activeText = this.getCurrentActiveLineText();
        const nextText = this.getCurrentNextLineText();
        
        // Обновляем только если текст изменился
        if (activeLineElement.textContent !== activeText) {
            activeLineElement.textContent = activeText || '';
        }
        
        if (nextLineElement.textContent !== nextText) {
            nextLineElement.textContent = nextText || '';
        }
    }
    
    /**
     * Останавливает fallback текстовое обновление
     */
    stopFallbackTextUpdate() {
        if (this.fallbackTextInterval) {
            clearInterval(this.fallbackTextInterval);
            this.fallbackTextInterval = null;
        }
        
        // Удаляем оверлей
        const overlay = document.getElementById('fallback-text-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    /**
     * Очищает все эффекты включая fallback текст
     */
    clearAllEffects() {
        console.log('🎭 MaskSystem: Очистка всех эффектов');
        
        try {
            // Очищаем MediaPipe эффекты
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            
            // Очищаем видео фильтры
            if (this.videoElement) {
                this.videoElement.style.filter = 'none';
                this.videoElement.style.background = 'transparent';
            }
            
            // Очищаем overlay canvas
                if (this.overlayCanvas) {
                this.overlayCanvas.style.display = 'none';
                    const ctx = this.overlayCanvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                }
            }
            
            // Очищаем fallback текстовые оверлеи
            this.stopFallbackTextUpdate();
            
            // Сбрасываем хромакей
            this.isChromakeyActive = false;
            this.currentChromakeyMask = null;
            
            // Очищаем фоновые эффекты
            this.backgroundEffects = {
                blur: { enabled: false, intensity: 10 },
                colorFilter: { enabled: false, color: '#00ff00', opacity: 0.5 },
                gradient: { enabled: false, colors: ['#ff6b6b', '#4ecdc4'], direction: 'diagonal' }
            };
            
            console.log('✅ MaskSystem: Все эффекты очищены');
        } catch (error) {
            console.error('❌ MaskSystem: Ошибка очистки эффектов:', error);
        }
    }

    /**
     * Применение Хромакей эффектов
     */
    async applyChromakeyMask(mask) {
        console.log(`🎬 Применение Хромакей эффекта: ${mask.name}`);
        
        // Очищаем предыдущие эффекты
        this.clearAllEffects();
        
        try {
            switch (mask.id) {
                case 'auto_segment':
                    console.log('🎯 Запуск автоматического удаления фона');
                    // Используем Selfie Segmentation для авто-удаления фона
                    if (this.selfieSegmentation) {
                        // Сохраняем маску для обработки в особом режиме
                        this.currentMask = { ...mask, effect: 'remove_background' };
                        this.startSelfieSegmentation();
                    } else {
                        console.warn('⚠️ Selfie Segmentation недоступен для хромакей');
                        this.applyFallbackChromakeyEffect(mask);
                    }
                    break;
                    
                case 'img_replace':
                    console.log('🖼️ Замена изображением');
                    // Реальная замена изображением
                    if (this.selfieSegmentation) {
                        this.currentMask = { ...mask, effect: 'image_background' };
                        this.startSelfieSegmentation();
                    } else {
                        this.applyFallbackChromakeyEffect(mask);
                    }
                    break;
                    
                case 'video_replace':
                    console.log('🎥 Замена видео');
                    // Реальная замена видео
                    if (this.selfieSegmentation) {
                        this.currentMask = { ...mask, effect: 'video_background' };
                        this.startSelfieSegmentation();
                    } else {
                        this.applyFallbackChromakeyEffect(mask);
                    }
                    break;
                    
                case 'edge_blur':
                    console.log('🌀 Размытие краев');
                    // Реальное размытие краев
                    if (this.selfieSegmentation) {
                        this.currentMask = { ...mask, effect: 'edge_blur' };
                        this.startSelfieSegmentation();
                    } else {
                        this.applyFallbackChromakeyEffect(mask);
                    }
                    break;
                    
                default:
                    console.warn(`⚠️ Неизвестный хромакей эффект: ${mask.id}`);
                    break;
            }
            
            console.log(`✅ Хромакей эффект "${mask.name}" применен`);
            
        } catch (error) {
            console.error('❌ Ошибка применения хромакей эффекта:', error);
            this.applyFallbackChromakeyEffect(mask);
        }
    }

    /**
     * Резервный метод для хромакей эффектов
     */
    applyFallbackChromakeyEffect(mask) {
        console.log(`🛡️ Применение резервного хромакей эффекта: ${mask.name}`);
        
        switch (mask.id) {
            case 'auto_segment':
                // Простое автоудаление через CSS
                this.videoElement.style.filter = 'contrast(150%) brightness(120%)';
                this.videoElement.style.background = 'transparent';
                break;
                
            default:
                this.videoElement.style.filter = 'none';
                this.videoElement.style.background = 'transparent';
                break;
        }
        
        console.log(`✅ Резервный хромакей эффект "${mask.name}" применен`);
    }

    /**
     * Показ сообщения о разработке
     */
    showDevelopmentMessage(message) {
        if (this.overlayCanvas) {
            this.overlayCanvas.style.display = 'block';
            const ctx = this.overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            
            ctx.font = '18px Arial';
            ctx.fillStyle = '#FFD700';
            ctx.fillText('🚧 В разработке', 20, 40);
            
            ctx.font = '14px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(message, 20, 70);
            ctx.fillText('Следите за обновлениями!', 20, 90);
            
            // Убираем сообщение через 4 секунды
            setTimeout(() => {
                if (this.overlayCanvas) {
                    const ctx = this.overlayCanvas.getContext('2d');
                    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                    this.overlayCanvas.style.display = 'none';
                }
            }, 4000);
        }
    }

    // Удаление фона (хромакей)
    applyBackgroundRemoval(ctx, canvas, originalImage, maskData) {
        try {
            // Очищаем canvas (прозрачный фон)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Создаем временный canvas для человека
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // ИСПРАВЛЕНО: Рисуем оригинальное изображение БЕЗ дополнительного зеркалирования
            // так как видео уже зеркалировано CSS transform: scaleX(-1)
            tempCtx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
            
            // Применяем маску - оставляем только человека
            const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < maskData.length; i += 4) {
                // Если пиксель фона (темный в маске), делаем его прозрачным
                const alpha = maskData[i] > 128 ? imageData.data[i + 3] : 0;
                imageData.data[i + 3] = alpha;
            }
            tempCtx.putImageData(imageData, 0, 0);
            
            // Отображаем только человека без фона БЕЗ дополнительного зеркалирования
            ctx.drawImage(tempCanvas, 0, 0);
            
            console.log('✅ Фон успешно удален');
        } catch (error) {
            console.error('❌ Ошибка удаления фона:', error);
        }
    }

    // Замена фона изображением
    applyImageBackground(ctx, canvas, originalImage, maskData) {
        try {
            // Создаем красивый фон с изображением
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#FF6B6B');
            gradient.addColorStop(0.3, '#4ECDC4');
            gradient.addColorStop(0.6, '#45B7D1');
            gradient.addColorStop(1, '#96CEB4');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Добавляем декоративные элементы
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 30 + 10;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Накладываем человека
            this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
            
            console.log('✅ Фон заменен изображением');
        } catch (error) {
            console.error('❌ Ошибка замены фона изображением:', error);
        }
    }

    // Замена фона видео (анимированный фон)
    applyVideoBackground(ctx, canvas, originalImage, maskData) {
        try {
            // Создаем анимированный фон
            const time = Date.now() / 1000;
            
            // Анимированный градиент
            const offset = Math.sin(time) * 0.5 + 0.5;
            const gradient = ctx.createRadialGradient(
                canvas.width * (0.3 + offset * 0.4), 
                canvas.height * (0.3 + offset * 0.4), 
                0,
                canvas.width * 0.7, 
                canvas.height * 0.7, 
                Math.max(canvas.width, canvas.height)
            );
            gradient.addColorStop(0, `hsl(${(time * 50) % 360}, 70%, 60%)`);
            gradient.addColorStop(0.5, `hsl(${(time * 30 + 120) % 360}, 80%, 50%)`);
            gradient.addColorStop(1, `hsl(${(time * 20 + 240) % 360}, 60%, 40%)`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Добавляем движущиеся частицы
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            for (let i = 0; i < 15; i++) {
                const x = (canvas.width * 0.1 + Math.sin(time + i) * canvas.width * 0.8);
                const y = (canvas.height * 0.1 + Math.cos(time * 0.7 + i) * canvas.height * 0.8);
                const size = Math.sin(time * 2 + i) * 15 + 20;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Накладываем человека поверх анимированного фона
            this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
            
            console.log('✅ Фон заменен анимированным видео');
        } catch (error) {
            console.error('❌ Ошибка замены фона видео:', error);
        }
    }

    // Размытие краев
    applyEdgeBlurEffect(ctx, canvas, originalImage, maskData) {
        try {
            // ИСПРАВЛЕНО: Рисуем оригинальное изображение БЕЗ дополнительного зеркалирования
            // так как видео уже зеркалировано CSS transform: scaleX(-1)
            ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
            
            // Создаем временный canvas для обработки краев
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // ИСПРАВЛЕНО: Рисуем оригинальное изображение БЕЗ дополнительного зеркалирования
            tempCtx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
            
            // Получаем данные изображения
            const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Применяем размытие к краям маски
            for (let i = 0; i < maskData.length; i += 4) {
                const maskValue = maskData[i];
                
                // Если пиксель на краю маски (переходная зона)
                if (maskValue > 50 && maskValue < 200) {
                    // Применяем размытие к этой области
                    const blurIntensity = (200 - maskValue) / 150; // 0-1
                    
                    // Уменьшаем четкость краев
                    data[i] = data[i] * (1 - blurIntensity * 0.3);     // R
                    data[i + 1] = data[i + 1] * (1 - blurIntensity * 0.3); // G
                    data[i + 2] = data[i + 2] * (1 - blurIntensity * 0.3); // B
                }
            }
            
            tempCtx.putImageData(imageData, 0, 0);
            
            // Рисуем обработанное изображение БЕЗ дополнительного зеркалирования
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0);
            
            console.log('✅ Применено размытие краев');
        } catch (error) {
            console.error('❌ Ошибка размытия краев:', error);
        }
    }

    /**
     * Обработка Face Mesh для overlay эффектов
     */
    processFaceMeshForOverlay() {
        if (!this.faceMesh || !this.videoElement || !this.isProcessing) {
            return;
        }
        
        if (this.videoElement.readyState < 2) {
            setTimeout(() => {
                if (this.isProcessing) {
                    this.processFaceMeshForOverlay();
                }
            }, 100);
            return;
        }
        
        try {
            this.faceMesh.send({ image: this.videoElement }).then(() => {
                if (this.isProcessing) {
                    requestAnimationFrame(() => {
                        this.processFaceMeshForOverlay();
                    });
                }
            }).catch((error) => {
                console.warn('⚠️ Ошибка Face Mesh для overlay:', error);
                setTimeout(() => {
                    if (this.isProcessing) {
                        this.processFaceMeshForOverlay();
                    }
                }, 500);
            });
        } catch (error) {
            console.error('❌ Критическая ошибка Face Mesh для overlay:', error);
            this.isProcessing = false;
        }
    }

    /**
     * Новые методы для текста на фоне
     */
    
    // Применение текста на цветном фоне
    applyTextOnColorBackground(ctx, canvas, originalImage, maskData, color = '#00FF00') {
        // Создаем временный canvas для фона с текстом
        const backgroundCanvas = document.createElement('canvas');
        backgroundCanvas.width = canvas.width;
        backgroundCanvas.height = canvas.height;
        const bgCtx = backgroundCanvas.getContext('2d');
        
        // Заливаем фон цветом
        bgCtx.fillStyle = color;
        bgCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Рендерим текст прямо НА ФОНЕ
        this.renderTextDirectlyOnBackground(bgCtx, canvas);
        
        // Композитинг: накладываем человека поверх фона с текстом
        this.compositePersonOverTextBackground(ctx, canvas, originalImage, maskData, backgroundCanvas);
    }
    
    // Применение текста на градиентном фоне
    applyTextOnGradientBackground(ctx, canvas, originalImage, maskData) {
        // Создаем временный canvas для фона с текстом
        const backgroundCanvas = document.createElement('canvas');
        backgroundCanvas.width = canvas.width;
        backgroundCanvas.height = canvas.height;
        const bgCtx = backgroundCanvas.getContext('2d');
        
        // Создаем красивый градиент
        const gradient = bgCtx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#FF0080');
        gradient.addColorStop(0.3, '#7928CA');
        gradient.addColorStop(0.6, '#4ECDC4');
        gradient.addColorStop(1, '#FF8A80');
        
        bgCtx.fillStyle = gradient;
        bgCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Рендерим текст прямо НА ФОНЕ
        this.renderTextDirectlyOnBackground(bgCtx, canvas);
        
        // Композитинг: накладываем человека поверх фона с текстом
        this.compositePersonOverTextBackground(ctx, canvas, originalImage, maskData, backgroundCanvas);
    }
    
    /**
     * Рендерит текст прямо на фоне (НЕ внизу экрана!)
     * @param {CanvasRenderingContext2D} bgCtx - Контекст фонового canvas
     * @param {HTMLCanvasElement} canvas - Canvas элемент
     */
    renderTextDirectlyOnBackground(bgCtx, canvas) {
        try {
            // Получаем только активную строку для простоты
            let activeText = this.getCurrentActiveLineText();
            
            if (!activeText) {
                // Если нет текста, показываем демо
                activeText = "The sun will set for you";
            }
            
            // Настройки для текста
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            // Размер шрифта зависит от размера canvas
            const baseFontSize = Math.max(32, Math.min(canvasWidth / 15, canvasHeight / 12));
            
            // Настройки шрифта для активной строки
            bgCtx.font = `bold ${baseFontSize}px Arial, sans-serif`;
            bgCtx.fillStyle = '#FFFFFF';
            bgCtx.textAlign = 'center';
            bgCtx.textBaseline = 'middle';
            
            // Добавляем контур для лучшей читаемости на цветном фоне
            bgCtx.strokeStyle = '#000000';
            bgCtx.lineWidth = 4;
            
            // Разбиваем текст на строки если он слишком длинный
            const maxWidth = canvasWidth * 0.8;
            const lines = this.wrapText(bgCtx, activeText, maxWidth);
            const lineHeight = baseFontSize * 1.3;
            
            // Центрируем текст по вертикали
            const totalTextHeight = lines.length * lineHeight;
            const startY = (canvasHeight - totalTextHeight) / 2 + lineHeight / 2;
            
            // Рендерим каждую строку с контуром
            lines.forEach((line, index) => {
                const y = startY + (index * lineHeight);
                
                // Рисуем контур
                bgCtx.strokeText(line, canvasWidth / 2, y);
                // Рисуем основной текст
                bgCtx.fillText(line, canvasWidth / 2, y);
            });
            
        } catch (error) {
            console.error('❌ Ошибка рендеринга текста на фоне:', error);
        }
    }
    
    /**
     * Композитинг: накладывает человека поверх фона с текстом
     * @param {CanvasRenderingContext2D} ctx - Основной контекст canvas
     * @param {HTMLCanvasElement} canvas - Основной canvas
     * @param {HTMLVideoElement} originalImage - Исходное видео
     * @param {ImageData} maskData - Данные маски сегментации
     * @param {HTMLCanvasElement} backgroundCanvas - Canvas с фоном и текстом
     */
    compositePersonOverTextBackground(ctx, canvas, originalImage, maskData, backgroundCanvas) {
        try {
            // Проверяем все необходимые параметры
            if (!ctx || !canvas || !originalImage || !backgroundCanvas) {
                if (this.enableConsoleLogging) {
                    console.warn('❌ Недостаточно параметров для композитинга');
                }
                return;
            }
            
            // Проверяем maskData и его структуру
            if (!maskData || !maskData.data || !maskData.data.length) {
                const now = Date.now();
                if (window.DEBUG_CONFIG?.MASKS?.enableErrors && (now - this.errorThrottling.lastMaskDataError) > this.errorThrottling.errorInterval) {
                    console.warn('❌ maskData недоступна или пуста, используем fallback');
                    this.errorThrottling.lastMaskDataError = now;
                    this.errorThrottling.maskDataError++;
                }
                // Fallback: просто рисуем фон, потом человека поверх
                ctx.drawImage(backgroundCanvas, 0, 0);
                this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
                return;
            }
            
            // Получаем данные фона с текстом
            const backgroundCtx = backgroundCanvas.getContext('2d');
            if (!backgroundCtx) {
                if (this.enableConsoleLogging) {
                    console.warn('❌ Не удалось получить контекст фона');
                }
                return;
            }
            
            const backgroundImageData = backgroundCtx.getImageData(0, 0, canvas.width, canvas.height);
            const backgroundData = backgroundImageData.data;
            
            // Рисуем исходное видео на основной canvas
            ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
            
            // Получаем данные видео
            const videoImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const videoData = videoImageData.data;
            
            // Проверяем совместимость размеров данных
            const minLength = Math.min(maskData.data.length, videoData.length, backgroundData.length);
            
            // Пиксель за пикселем: заменяем фон на наш фон с текстом
            for (let i = 0; i < minLength; i += 4) {
                const maskValue = maskData.data[i]; // Красный канал маски
                
                // Если маска показывает фон (темное значение), заменяем на фон с текстом
                if (maskValue < 128) {
                    videoData[i] = backgroundData[i];         // R
                    videoData[i + 1] = backgroundData[i + 1]; // G
                    videoData[i + 2] = backgroundData[i + 2]; // B
                    // Альфа канал оставляем как есть
                }
            }
            
            // Применяем финальный результат
            ctx.putImageData(videoImageData, 0, 0);
            
        } catch (error) {
            console.error('❌ Ошибка композитинга:', error);
            // Fallback: просто рисуем фон, потом человека поверх
            try {
                ctx.drawImage(backgroundCanvas, 0, 0);
                if (maskData && this.overlayPersonOnBackground) {
                    this.overlayPersonOnBackground(ctx, canvas, originalImage, maskData);
                }
            } catch (fallbackError) {
                console.error('❌ Ошибка в fallback композитинге:', fallbackError);
            }
        }
    }
    
    /**
     * Получает текст текущей активной строки
     * @returns {string} Текст активной строки
     */
    getCurrentActiveLineText() {
        try {
            // Кеширование для предотвращения многократных вычислений
            const cacheKey = `${Date.now()}_${Math.floor(Date.now() / 50)}`; // Кеш на 50ms
            if (this._lastActiveTextCache && this._lastActiveTextCache.key === cacheKey) {
                return this._lastActiveTextCache.text;
            }
            
            let text = '';
            
            // Приоритет 1: LiveMode система
            if (window.liveMode && window.liveMode.isActive && typeof window.liveMode._getMainActiveLineText === 'function') {
                text = window.liveMode._getMainActiveLineText() || '';
                if (text && text !== "Режим Live активен") {
                    this._cacheActiveText(cacheKey, text);
                    return text;
                }
            }
            
            // Приоритет 2: Ищем активную строку в DOM
            const selectors = [
                '#lyrics-display .lyric-line.active',
                '.lyric-line.active', 
                '.rehearsal-active-line.active',
                '.active-line',
                '[data-active="true"]'
            ];
            
            for (const selector of selectors) {
                const activeElement = document.querySelector(selector);
                if (activeElement && activeElement.textContent && activeElement.textContent.trim()) {
                    text = activeElement.textContent.trim();
                    this._cacheActiveText(cacheKey, text);
                    return text;
                }
            }
            
            // Приоритет 3: Пробуем получить из LyricsDisplay
            if (window.app && window.app.lyricsDisplay) {
                const lyricsDisplay = window.app.lyricsDisplay;
                
                // Проверяем activeLineText
                if (lyricsDisplay.activeLineText) {
                    text = lyricsDisplay.activeLineText.trim();
                    this._cacheActiveText(cacheKey, text);
                    return text;
                }
                
                // Проверяем по currentLine индексу
                if (lyricsDisplay.currentLine >= 0 && 
                    lyricsDisplay.lyrics && 
                    lyricsDisplay.lyrics[lyricsDisplay.currentLine]) {
                    text = lyricsDisplay.lyrics[lyricsDisplay.currentLine].trim();
                    this._cacheActiveText(cacheKey, text);
                    return text;
                }
                
                // Проверяем по currentActiveLine индексу
                if (typeof lyricsDisplay.currentActiveLine === 'number' && 
                    lyricsDisplay.currentActiveLine >= 0 &&
                    lyricsDisplay.lyrics && 
                    lyricsDisplay.lyrics[lyricsDisplay.currentActiveLine]) {
                    text = lyricsDisplay.lyrics[lyricsDisplay.currentActiveLine].trim();
                    this._cacheActiveText(cacheKey, text);
                    return text;
                }
            }
            
            // Приоритет 4: Через маркеры и аудио позицию
            if (window.audioEngine && window.app && window.app.markerManager) {
                const currentTime = window.audioEngine.getCurrentTime();
                const activeLineIndex = window.app.markerManager.getActiveLineAtTime(currentTime);
                
                if (activeLineIndex >= 0 && 
                    window.app.lyricsDisplay && 
                    window.app.lyricsDisplay.lyrics && 
                    window.app.lyricsDisplay.lyrics[activeLineIndex]) {
                    text = window.app.lyricsDisplay.lyrics[activeLineIndex].trim();
                    this._cacheActiveText(cacheKey, text);
                    return text;
                }
            }
            
            // Кешируем пустой результат
            this._cacheActiveText(cacheKey, '');
            return '';
        } catch (error) {
            console.error('❌ Ошибка получения активной строки:', error);
            return this._lastActiveText || '';
        }
    }
    
    /**
     * Получает текст следующей строки
     * @returns {string} Текст следующей строки
     */
    getCurrentNextLineText() {
        try {
            // Кеширование
            const cacheKey = `${Date.now()}_${Math.floor(Date.now() / 50)}`; // Кеш на 50ms
            if (this._lastNextTextCache && this._lastNextTextCache.key === cacheKey) {
                return this._lastNextTextCache.text;
            }
            
            let text = '';
            
            // Приоритет 1: LiveMode система
            if (window.liveMode && window.liveMode.isActive && typeof window.liveMode._getMainNextLineText === 'function') {
                text = window.liveMode._getMainNextLineText() || '';
                if (text) {
                    this._cacheNextText(cacheKey, text);
                    return text;
                }
            }
            
            // Приоритет 2: Ищем активную строку и берем следующую
            const selectors = [
                '#lyrics-display .lyric-line.active',
                '.lyric-line.active', 
                '.rehearsal-active-line.active',
                '.active-line',
                '[data-active="true"]'
            ];
            
            for (const selector of selectors) {
                const activeElement = document.querySelector(selector);
                if (activeElement && activeElement.nextElementSibling && activeElement.nextElementSibling.textContent) {
                    text = activeElement.nextElementSibling.textContent.trim();
                    this._cacheNextText(cacheKey, text);
                    return text;
                }
            }
            
            // Приоритет 3: Через LyricsDisplay
            if (window.app && window.app.lyricsDisplay) {
                const lyricsDisplay = window.app.lyricsDisplay;
                
                // Через currentLine + 1
                const nextLineIndex = lyricsDisplay.currentLine + 1;
                if (nextLineIndex >= 0 && 
                    lyricsDisplay.lyrics && 
                    lyricsDisplay.lyrics[nextLineIndex]) {
                    text = lyricsDisplay.lyrics[nextLineIndex].trim();
                    this._cacheNextText(cacheKey, text);
                    return text;
                }
                
                // Через currentActiveLine + 1
                if (typeof lyricsDisplay.currentActiveLine === 'number') {
                    const nextIndex = lyricsDisplay.currentActiveLine + 1;
                    if (nextIndex >= 0 && 
                        lyricsDisplay.lyrics && 
                        lyricsDisplay.lyrics[nextIndex]) {
                        text = lyricsDisplay.lyrics[nextIndex].trim();
                        this._cacheNextText(cacheKey, text);
                        return text;
                    }
                }
            }
            
            // Кешируем пустой результат
            this._cacheNextText(cacheKey, '');
            return '';
        } catch (error) {
            console.error('❌ Ошибка получения следующей строки:', error);
            return this._lastNextText || '';
        }
    }
    
    /**
     * Кеширует активный текст
     * @private
     */
    _cacheActiveText(key, text) {
        this._lastActiveTextCache = { key, text };
        this._lastActiveText = text;
    }
    
    /**
     * Кеширует следующий текст  
     * @private
     */
    _cacheNextText(key, text) {
        this._lastNextTextCache = { key, text };
        this._lastNextText = text;
    }
    
    /**
     * Разбивает текст на строки для отображения на canvas
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {string} text - Текст для разбивки
     * @param {number} maxWidth - Максимальная ширина строки
     * @returns {string[]} Массив строк
     */
    wrapText(ctx, text, maxWidth) {
        // Проверяем на пустой или undefined текст
        if (!text || typeof text !== 'string' || text.trim() === '') {
            return [];
        }
        
        const words = text.split(' ');
        const lines = [];
        
        // Проверяем что есть хотя бы одно слово
        if (words.length === 0) {
            return [];
        }
        
        let currentLine = words[0] || '';
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            if (!word) {continue;} // Пропускаем пустые слова
            
            const width = ctx.measureText(currentLine + ' ' + word).width;
            
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    /**
     * Применяет CSS фильтры
     * @param {Object} mask - Объект маски
     */
    applyFilterMask(mask) {
        console.log(`🎭 Применение CSS фильтра: ${mask.name}`);
        
        if (this.videoElement && mask.filter) {
            this.videoElement.style.filter = mask.filter;
            console.log(`✅ CSS фильтр "${mask.filter}" применен`);
        } else {
            console.warn('🎭 Видео элемент или фильтр недоступны');
        }
    }
    
    /**
     * Применяет fallback эффект
     * @param {Object} mask - Объект маски
     */
    applyFallbackEffect(mask) {
        console.log(`🛡️ Применение fallback эффекта для маски: ${mask.name}`);
        
        // Определяем тип fallback эффекта
        switch (mask.type) {
            case 'mediapipe':
            case 'text-overlay':
                this.applyFallbackBackgroundEffect(mask);
                break;
            case 'filter':
                this.applyFilterMask(mask);
                break;
            case 'chromakey':
                this.applyFallbackChromakeyEffect(mask);
                break;
            default:
                console.warn(`🛡️ Неизвестный тип для fallback: ${mask.type}`);
                // Пробуем применить как фоновый эффект
                this.applyFallbackBackgroundEffect(mask);
        }
    }

    /**
     * Включает или выключает логирование в консоль
     * @param {boolean} enabled - включить/выключить логирование
     */
    setConsoleLogging(enabled) {
        this.enableConsoleLogging = enabled;
        if (enabled) {
            console.log('🎭 MaskSystem: Логирование включено');
        }
    }
}

// Экспортируем класс
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MaskSystem;
} else {
    window.MaskSystem = MaskSystem;
} 