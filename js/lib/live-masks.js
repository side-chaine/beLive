/**
 * LiveMasks
 * Библиотека масок для режима Live
 * Предоставляет набор масок и эффектов для наложения на видео
 */

class LiveMasks {
    constructor(videoProcessor) {
        // Ссылка на видеопроцессор
        this.videoProcessor = videoProcessor;
        
        // Коллекция доступных масок
        this.availableMasks = [];
        
        // Загруженные ресурсы для масок
        this.resources = {};
        
        // Флаг инициализации
        this.initialized = false;
        
        console.log('LiveMasks: Initialized');
    }
    
    /**
     * Инициализирует библиотеку масок и регистрирует стандартные маски
     * @returns {Promise} - Promise, который разрешается, когда все маски загружены
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        
        console.log('LiveMasks: Loading resources...');
        
        try {
            // Загружаем общие ресурсы для масок
            await this._loadCommonResources();
            
            // Регистрируем стандартные маски
            this._registerStandardMasks();
            
            this.initialized = true;
            console.log(`LiveMasks: Initialization complete, ${this.availableMasks.length} masks available`);
            
            return true;
        } catch (error) {
            console.error('LiveMasks: Initialization failed', error);
            return false;
        }
    }
    
    /**
     * Загружает общие ресурсы для масок
     * @private
     */
    async _loadCommonResources() {
        // Путь к ресурсам
        const resourcesPath = 'resources/masks/';
        
        // Загружаем основные изображения для масок
        const resourcesPromises = [
            this._loadImage('glasses1', `${resourcesPath}glasses1.svg`),
            this._loadImage('glasses2', `${resourcesPath}glasses2.svg`),
            this._loadImage('hat1', `${resourcesPath}hat1.svg`),
            this._loadImage('mustache', `${resourcesPath}mustache.svg`),
            this._loadImage('rainbow', `${resourcesPath}rainbow.svg`),
            this._loadImage('confetti', `${resourcesPath}confetti.svg`)
        ];
        
        // Ждем загрузки всех ресурсов
        await Promise.all(resourcesPromises);
        console.log('LiveMasks: Common resources loaded');
    }
    
    /**
     * Загружает изображение и сохраняет его в ресурсах
     * @param {string} id - Идентификатор изображения
     * @param {string} url - URL изображения
     * @returns {Promise} - Promise, который разрешается, когда изображение загружено
     * @private
     */
    async _loadImage(id, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.resources[id] = img;
                console.log(`LiveMasks: Resource "${id}" loaded`);
                resolve(img);
            };
            
            img.onerror = (err) => {
                console.error(`LiveMasks: Failed to load resource "${id}"`, err);
                reject(err);
            };
            
            img.src = url;
        });
    }
    
    /**
     * Регистрирует стандартные маски
     * @private
     */
    _registerStandardMasks() {
        // Регистрируем базовые маски
        this._registerGlassesMask();
        this._registerHatMask();
        this._registerMustacheMask();
        this._registerRainbowMask();
        this._registerPartyMask();
        this._registerPixelateFaceMask();
        this._registerEmotionMask();
        
        // Регистрируем маски с эффектами фона
        this._registerBackgroundMasks();
        
        console.log('LiveMasks: Standard masks registered');
    }
    
    /**
     * Получает список доступных масок
     * @returns {Array} - Массив объектов с информацией о масках
     */
    getAvailableMasks() {
        return this.availableMasks.map(mask => ({
            id: mask.id,
            name: mask.name,
            description: mask.description,
            preview: mask.preview
        }));
    }
    
    /**
     * Активирует маску по ID
     * @param {string} maskId - ID маски для активации
     */
    activateMask(maskId) {
        if (!this.videoProcessor) {
            console.error('LiveMasks: VideoProcessor not available');
            return false;
        }
        
        // Отключаем маску, если передан null или 'none'
        if (maskId === null || maskId === 'none') {
            this.videoProcessor.setActiveMask(null);
            return true;
        }
        
        // Проверяем, существует ли маска
        const maskExists = this.availableMasks.some(mask => mask.id === maskId);
        
        if (!maskExists) {
            console.error(`LiveMasks: Mask "${maskId}" not found`);
            return false;
        }
        
        // Активируем маску
        this.videoProcessor.setActiveMask(maskId);
        return true;
    }
    
    /**
     * Регистрирует маску с очками
     * @private
     */
    _registerGlassesMask() {
        const glassesOptions = [
            { id: 'glasses1', name: 'Классические очки', resource: 'glasses1' },
            { id: 'glasses2', name: 'Солнечные очки', resource: 'glasses2' }
        ];
        
        glassesOptions.forEach(option => {
            if (!this.resources[option.resource]) {
                console.warn(`LiveMasks: Resource "${option.resource}" not found, skipping mask`);
                return;
            }
            
            const maskData = {
                id: option.id,
                name: option.name,
                description: 'Маска с очками',
                preview: this.resources[option.resource].src,
                
                // Функция рендеринга маски
                render: (ctx, faceData) => {
                    if (!faceData || !faceData.keyPoints) {return;}
                    
                    const { leftEye, rightEye } = faceData.keyPoints;
                    const eyeDistance = Math.sqrt(
                        Math.pow(rightEye.x - leftEye.x, 2) + 
                        Math.pow(rightEye.y - leftEye.y, 2)
                    );
                    
                    // Вычисляем размер и положение очков
                    const glassesWidth = eyeDistance * 2.5;
                    const glassesHeight = glassesWidth * (this.resources[option.resource].height / this.resources[option.resource].width);
                    const glassesX = (leftEye.x + rightEye.x) / 2 - glassesWidth / 2;
                    const glassesY = (leftEye.y + rightEye.y) / 2 - glassesHeight / 2;
                    
                    // Вычисляем угол наклона лица
                    const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
                    
                    // Рисуем очки
                    ctx.save();
                    ctx.translate(glassesX + glassesWidth / 2, glassesY + glassesHeight / 2);
                    ctx.rotate(angle);
                    ctx.drawImage(
                        this.resources[option.resource],
                        -glassesWidth / 2, -glassesHeight / 2,
                        glassesWidth, glassesHeight
                    );
                    ctx.restore();
                }
            };
            
            // Регистрируем маску в видеопроцессоре
            this.videoProcessor.registerMask(option.id, maskData);
            
            // Добавляем в список доступных масок
            this.availableMasks.push({
                id: option.id,
                name: option.name,
                description: maskData.description,
                preview: maskData.preview
            });
        });
    }
    
    /**
     * Регистрирует маску с шляпой
     * @private
     */
    _registerHatMask() {
        if (!this.resources.hat1) {
            console.warn('LiveMasks: Hat resource not found, skipping mask');
            return;
        }
        
        const maskData = {
            id: 'hat',
            name: 'Шляпа',
            description: 'Маска со шляпой',
            preview: this.resources.hat1.src,
            
            // Функция рендеринга маски
            render: (ctx, faceData) => {
                if (!faceData || !faceData.keyPoints) {return;}
                
                const { leftEye, rightEye, faceWidth, faceHeight } = faceData.keyPoints;
                const eyeDistance = Math.sqrt(
                    Math.pow(rightEye.x - leftEye.x, 2) + 
                    Math.pow(rightEye.y - leftEye.y, 2)
                );
                
                // Вычисляем размер и положение шляпы
                const hatWidth = faceWidth * 1.5;
                const hatHeight = hatWidth * (this.resources.hat1.height / this.resources.hat1.width);
                const hatX = (leftEye.x + rightEye.x) / 2 - hatWidth / 2;
                const hatY = Math.min(leftEye.y, rightEye.y) - hatHeight * 0.8;
                
                // Вычисляем угол наклона лица
                const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
                
                // Рисуем шляпу
                ctx.save();
                ctx.translate(hatX + hatWidth / 2, hatY + hatHeight / 2);
                ctx.rotate(angle);
                ctx.drawImage(
                    this.resources.hat1,
                    -hatWidth / 2, -hatHeight / 2,
                    hatWidth, hatHeight
                );
                ctx.restore();
            }
        };
        
        // Регистрируем маску в видеопроцессоре
        this.videoProcessor.registerMask('hat', maskData);
        
        // Добавляем в список доступных масок
        this.availableMasks.push({
            id: 'hat',
            name: maskData.name,
            description: maskData.description,
            preview: maskData.preview
        });
    }
    
    /**
     * Регистрирует маску с усами
     * @private
     */
    _registerMustacheMask() {
        if (!this.resources.mustache) {
            console.warn('LiveMasks: Mustache resource not found, skipping mask');
            return;
        }
        
        const maskData = {
            id: 'mustache',
            name: 'Усы',
            description: 'Маска с усами',
            preview: this.resources.mustache.src,
            
            // Функция рендеринга маски
            render: (ctx, faceData) => {
                if (!faceData || !faceData.keyPoints) {return;}
                
                const { nose, mouth, faceWidth } = faceData.keyPoints;
                
                // Вычисляем размер и положение усов
                const mustacheWidth = faceWidth * 0.7;
                const mustacheHeight = mustacheWidth * (this.resources.mustache.height / this.resources.mustache.width);
                const mustacheX = nose.x - mustacheWidth / 2;
                const mustacheY = (nose.y + mouth.y) / 2 - mustacheHeight / 2;
                
                // Рисуем усы
                ctx.drawImage(
                    this.resources.mustache,
                    mustacheX, mustacheY,
                    mustacheWidth, mustacheHeight
                );
            }
        };
        
        // Регистрируем маску в видеопроцессоре
        this.videoProcessor.registerMask('mustache', maskData);
        
        // Добавляем в список доступных масок
        this.availableMasks.push({
            id: 'mustache',
            name: maskData.name,
            description: maskData.description,
            preview: maskData.preview
        });
    }
    
    /**
     * Регистрирует маску с радугой
     * @private
     */
    _registerRainbowMask() {
        if (!this.resources.rainbow) {
            console.warn('LiveMasks: Rainbow resource not found, skipping mask');
            return;
        }
        
        const maskData = {
            id: 'rainbow',
            name: 'Радуга',
            description: 'Радужная маска',
            preview: this.resources.rainbow.src,
            
            // Функция рендеринга маски
            render: (ctx, faceData) => {
                if (!faceData || !faceData.keyPoints) {return;}
                
                const { faceCenter, faceWidth, faceHeight } = faceData.keyPoints;
                
                // Вычисляем размер и положение радуги
                const rainbowWidth = faceWidth * 1.8;
                const rainbowHeight = rainbowWidth * 0.6;
                const rainbowX = faceCenter.x - rainbowWidth / 2;
                const rainbowY = faceCenter.y - faceHeight * 0.7;
                
                // Рисуем радугу
                ctx.save();
                ctx.globalAlpha = 0.8;
                ctx.drawImage(
                    this.resources.rainbow,
                    rainbowX, rainbowY,
                    rainbowWidth, rainbowHeight
                );
                ctx.restore();
            }
        };
        
        // Регистрируем маску в видеопроцессоре
        this.videoProcessor.registerMask('rainbow', maskData);
        
        // Добавляем в список доступных масок
        this.availableMasks.push({
            id: 'rainbow',
            name: maskData.name,
            description: maskData.description,
            preview: maskData.preview
        });
    }
    
    /**
     * Регистрирует праздничную маску
     * @private
     */
    _registerPartyMask() {
        if (!this.resources.confetti) {
            console.warn('LiveMasks: Confetti resource not found, skipping mask');
            return;
        }
        
        // Создаем частицы конфетти
        const particles = [];
        for (let i = 0; i < 50; i++) {
            particles.push({
                x: Math.random(),
                y: Math.random(),
                size: 5 + Math.random() * 15,
                speedX: (Math.random() - 0.5) * 2,
                speedY: 1 + Math.random() * 3,
                color: `hsl(${Math.random() * 360}, 100%, 50%)`
            });
        }
        
        const maskData = {
            id: 'party',
            name: 'Вечеринка',
            description: 'Праздничная маска с конфетти',
            preview: this.resources.confetti.src,
            
            // Данные для анимации
            particles: particles,
            lastUpdate: 0,
            
            // Функция рендеринга маски
            render: (ctx, faceData, timestamp) => {
                if (!faceData) {return;}
                
                const canvasWidth = ctx.canvas.width;
                const canvasHeight = ctx.canvas.height;
                
                // Обновляем частицы
                if (!timestamp) {timestamp = performance.now();}
                const deltaTime = timestamp - this.lastUpdate || 16;
                this.lastUpdate = timestamp;
                
                // Рисуем конфетти
                ctx.save();
                
                // Рисуем фоновый эффект
                ctx.globalAlpha = 0.3;
                ctx.drawImage(
                    this.resources.confetti,
                    0, 0,
                    canvasWidth, canvasHeight
                );
                
                // Рисуем частицы
                ctx.globalAlpha = 0.8;
                for (let i = 0; i < maskData.particles.length; i++) {
                    const p = maskData.particles[i];
                    
                    // Обновляем положение
                    p.y += p.speedY * (deltaTime / 100);
                    p.x += p.speedX * (deltaTime / 100);
                    
                    // Возвращаем частицу в начало, если она вышла за пределы
                    if (p.y > 1) {
                        p.y = -0.1;
                        p.x = Math.random();
                    }
                    if (p.x < 0) {p.x = 1;}
                    if (p.x > 1) {p.x = 0;}
                    
                    // Рисуем частицу
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(
                        p.x * canvasWidth, 
                        p.y * canvasHeight, 
                        p.size, 0, Math.PI * 2
                    );
                    ctx.fill();
                }
                
                ctx.restore();
            }
        };
        
        // Регистрируем маску в видеопроцессоре
        this.videoProcessor.registerMask('party', maskData);
        
        // Добавляем в список доступных масок
        this.availableMasks.push({
            id: 'party',
            name: maskData.name,
            description: maskData.description,
            preview: maskData.preview
        });
    }
    
    /**
     * Регистрирует маску с пикселизацией лица
     * @private
     */
    _registerPixelateFaceMask() {
        const maskData = {
            id: 'pixelate',
            name: 'Пиксели',
            description: 'Пикселизация лица',
            preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="0" width="20" height="20" fill="%23ff0000"/><rect x="20" y="0" width="20" height="20" fill="%23ff7700"/><rect x="40" y="0" width="20" height="20" fill="%23ffff00"/><rect x="60" y="0" width="20" height="20" fill="%2300ff00"/><rect x="80" y="0" width="20" height="20" fill="%230000ff"/><rect x="0" y="20" width="20" height="20" fill="%23ff0077"/><rect x="20" y="20" width="20" height="20" fill="%23ff77ff"/><rect x="40" y="20" width="20" height="20" fill="%23ffff77"/><rect x="60" y="20" width="20" height="20" fill="%2300ff77"/><rect x="80" y="20" width="20" height="20" fill="%230077ff"/></svg>',
            
            // Размер пикселя
            pixelSize: 10,
            
            // Функция рендеринга маски
            render: (ctx, faceData) => {
                if (!faceData || !faceData.boundingBox) {return;}
                
                const { boundingBox } = faceData;
                const { topLeft, bottomRight, width, height } = boundingBox;
                
                // Создаем временный холст для пикселизации
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // Расширяем область пикселизации
                const padding = Math.min(width, height) * 0.2;
                const x = Math.max(0, topLeft[0] - padding);
                const y = Math.max(0, topLeft[1] - padding);
                const w = Math.min(ctx.canvas.width - x, width + padding * 2);
                const h = Math.min(ctx.canvas.height - y, height + padding * 2);
                
                // Устанавливаем размеры временного холста
                tempCanvas.width = w;
                tempCanvas.height = h;
                
                // Копируем область лица на временный холст
                tempCtx.drawImage(
                    ctx.canvas,
                    x, y, w, h,
                    0, 0, w, h
                );
                
                // Уменьшаем размер для создания эффекта пикселизации
                const pixelSize = maskData.pixelSize;
                const smallCanvas = document.createElement('canvas');
                const smallCtx = smallCanvas.getContext('2d');
                
                smallCanvas.width = Math.max(1, Math.floor(w / pixelSize));
                smallCanvas.height = Math.max(1, Math.floor(h / pixelSize));
                
                // Рисуем уменьшенное изображение
                smallCtx.drawImage(
                    tempCanvas,
                    0, 0,
                    smallCanvas.width, smallCanvas.height
                );
                
                // Очищаем область на основном холсте
                ctx.clearRect(x, y, w, h);
                
                // Рисуем пикселизированное изображение обратно
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(
                    smallCanvas,
                    0, 0,
                    smallCanvas.width, smallCanvas.height,
                    x, y, w, h
                );
                ctx.imageSmoothingEnabled = true;
            }
        };
        
        // Регистрируем маску в видеопроцессоре
        this.videoProcessor.registerMask('pixelate', maskData);
        
        // Добавляем в список доступных масок
        this.availableMasks.push({
            id: 'pixelate',
            name: maskData.name,
            description: maskData.description,
            preview: maskData.preview
        });
    }
    
    /**
     * Регистрирует маску с эмоциями
     * @private
     */
    _registerEmotionMask() {
        const maskData = {
            id: 'emotion',
            name: 'Эмоции',
            description: 'Отображение эмоций',
            preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ffdd00" stroke="%23ff8800" stroke-width="2"/><circle cx="35" cy="40" r="8" fill="%23000"/><circle cx="65" cy="40" r="8" fill="%23000"/><path d="M30 65 Q50 80 70 65" stroke="%23000" stroke-width="4" fill="none"/></svg>',
            
            // Последняя обнаруженная эмоция
            lastEmotion: 'neutral',
            
            // Функция рендеринга маски
            render: (ctx, faceData) => {
                if (!faceData || !faceData.keyPoints) {return;}
                
                const { faceCenter, faceWidth, faceHeight } = faceData.keyPoints;
                
                // Определяем эмоцию по положению ключевых точек
                // Это упрощенная демонстрация, в реальности нужен более сложный алгоритм
                let emotion = 'neutral';
                if (faceData.annotations && faceData.annotations.lipsUpperOuter && faceData.annotations.lipsLowerOuter) {
                    const upperLip = this._getPointAverage(faceData.annotations.lipsUpperOuter);
                    const lowerLip = this._getPointAverage(faceData.annotations.lipsLowerOuter);
                    const mouthHeight = lowerLip.y - upperLip.y;
                    
                    if (mouthHeight > faceHeight * 0.05) {
                        emotion = 'happy';
                    } else if (mouthHeight < faceHeight * 0.01) {
                        emotion = 'serious';
                    }
                }
                
                // Сохраняем последнюю эмоцию
                maskData.lastEmotion = emotion;
                
                // Рисуем эмоцию
                ctx.save();
                ctx.font = `${Math.round(faceWidth / 5)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 2;
                
                // Определяем текст эмоции
                let emotionText = '😐';
                if (emotion === 'happy') {emotionText = '😊';}
                else if (emotion === 'serious') {emotionText = '😑';}
                
                // Рисуем фон для текста
                const textWidth = ctx.measureText(emotionText).width;
                const padding = faceWidth * 0.1;
                const bgX = faceCenter.x - textWidth / 2 - padding;
                const bgY = faceCenter.y - faceHeight * 0.6;
                const bgWidth = textWidth + padding * 2;
                const bgHeight = faceWidth / 4 + padding;
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
                
                // Рисуем текст эмоции
                ctx.fillStyle = 'white';
                ctx.fillText(
                    emotionText,
                    faceCenter.x,
                    bgY + padding / 2
                );
                
                ctx.restore();
            }
        };
        
        // Регистрируем маску в видеопроцессоре
        this.videoProcessor.registerMask('emotion', maskData);
        
        // Добавляем в список доступных масок
        this.availableMasks.push({
            id: 'emotion',
            name: maskData.name,
            description: maskData.description,
            preview: maskData.preview
        });
    }
    
    /**
     * Регистрирует маски с эффектами фона
     * @private
     */
    _registerBackgroundMasks() {
        // Размытый фон
        this.availableMasks.push({
            id: 'background-blur',
            name: 'Размытый фон',
            description: 'Размывает фон, оставляя человека четким',
            preview: 'img/masks/blur.png',
            type: 'mediapipe',
            effect: 'blur',
            render: null // Обработка происходит в MaskSystem
        });
        
        // Зеленый фон (хромакей)
        this.availableMasks.push({
            id: 'background-green',
            name: 'Зеленый фон',
            description: 'Заменяет фон на зеленый цвет для хромакея',
            preview: 'img/masks/green.png',
            type: 'mediapipe',
            effect: 'green',
            render: null
        });
        
        // Синий фон
        this.availableMasks.push({
            id: 'background-blue',
            name: 'Синий фон',
            description: 'Заменяет фон на синий цвет',
            preview: 'img/masks/blue.png',
            type: 'mediapipe',
            effect: 'blue',
            render: null
        });
        
        // Градиентный фон
        this.availableMasks.push({
            id: 'background-gradient',
            name: 'Градиентный фон',
            description: 'Красивый градиентный фон',
            preview: 'img/masks/gradient.png',
            type: 'mediapipe',
            effect: 'gradient',
            render: null
        });
        
        // Матричный эффект
        this.availableMasks.push({
            id: 'background-matrix',
            name: 'Матрица',
            description: 'Эффект из фильма "Матрица"',
            preview: 'img/masks/matrix.png',
            type: 'mediapipe',
            effect: 'matrix',
            render: null
        });
        
        // Неоновый фон
        this.availableMasks.push({
            id: 'background-neon',
            name: 'Неоновый фон',
            description: 'Яркий неоновый фон',
            preview: 'img/masks/neon.png',
            type: 'mediapipe',
            effect: 'neon',
            render: null
        });
        
        console.log('LiveMasks: Background effect masks registered');
    }
    
    /**
     * Вычисляет среднее значение для группы точек
     * @param {Array} points - Массив точек с координатами [x, y, z]
     * @returns {Object} - Средние координаты
     * @private
     */
    _getPointAverage(points) {
        if (!points || points.length === 0) {return { x: 0, y: 0, z: 0 };}
        
        const sum = points.reduce(
            (acc, point) => {
                acc.x += point[0];
                acc.y += point[1];
                acc.z += point[2] || 0;
                return acc;
            }, 
            { x: 0, y: 0, z: 0 }
        );
        
        return {
            x: sum.x / points.length,
            y: sum.y / points.length,
            z: sum.z / points.length
        };
    }
}

// Экспортируем класс
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LiveMasks };
} 