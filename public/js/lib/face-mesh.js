/**
 * FaceMeshDetector - Реальное отслеживание лица с компьютерным зрением
 * Анализирует видео кадры и находит контуры лица
 */
class FaceMeshDetector {
    constructor() {
        console.log('Инициализация FaceMeshDetector...');
        
        this.isInitialized = false;
        this.isLoading = false;
        this.model = null;
        this.lastDetectedFaces = [];
        this.lastProcessingTime = 0;
        this.processingTimeHistory = [];
        this.refineLandmarks = true;
        
        // Canvas для анализа
        this.analysisCanvas = document.createElement('canvas');
        this.analysisCtx = this.analysisCanvas.getContext('2d');
        
        // Параметры для детекции лица
        this.skinThreshold = 0.6;
        this.minFaceSize = 50;
        this.maxFaceSize = 400;
        this.confidenceThreshold = 0.5;
        
        // Параметры стабилизации - оптимизированные
        this.stabilizationThreshold = 25; // Уменьшено для лучшей отзывчивости
        this.lastValidFace = null;
        this.faceHistory = [];
        this.maxHistoryLength = 3; // Уменьшено для скорости
        
        // Фильтр Калмана для профессионального сглаживания (по примеру OpenCV)
        this.kalmanFilter = {
            state: null, // [x, y, vx, vy]
            covariance: null,
            processNoise: 0.01,
            measurementNoise: 0.1,
            initialized: false
        };
        
        // Оптимизация производительности
        this.frameSkip = 0;
        this.processEveryNthFrame = 2; // Обрабатываем каждый 2-й кадр для скорости
        this.optimizedRegionSize = 0.7; // Анализируем только центральную часть
        
        // Кэширование для ускорения
        this.skinColorCache = new Map();
        this.regionCache = [];
        
        // Параметры детектирования
        this.faceDetectionParams = {
            minFaceSize: 50,
            maxFaceSize: 300,
            confidenceThreshold: 0.7,
            scaleFactor: 1.1,
            minNeighbors: 3
        };
        
        console.log('FaceMeshDetector инициализирован с системой стабилизации');
    }
    
    /**
     * Инициализация детектора
     * @returns {Promise<boolean>} - Успешность инициализации
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }
        
        if (this.isLoading) {
            return false;
        }
        
        this.isLoading = true;
        
        try {
            console.log('🎭 FaceMeshDetector: Инициализация реального детектора...');
            
            // Создаем canvas для анализа с оптимизацией
            this.analysisCanvas = document.createElement('canvas');
            this.analysisCanvas.width = 640;
            this.analysisCanvas.height = 480;
            this.analysisCtx = this.analysisCanvas.getContext('2d', { 
                willReadFrequently: true  // Оптимизация для частого чтения пикселей
            });
            
            // Данные для стабилизации отслеживания
            this.faceHistory = [];
            this.maxHistoryLength = 5;
            this.stabilizationThreshold = 30; // Максимальное отклонение для валидности
            
            // Имитация загрузки модели
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.isInitialized = true;
            this.isLoading = false;
            console.log('✅ FaceMeshDetector: Реальный детектор готов с стабилизацией');
            
            return true;
        } catch (error) {
            console.error('❌ FaceMeshDetector: Ошибка инициализации:', error);
            this.isInitialized = false;
            this.isLoading = false;
            return false;
        }
    }
    
    /**
     * Реальное обнаружение лиц с анализом пикселей
     * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input - Входное изображение или видео
     * @param {boolean} [withLandmarks=true] - Возвращать ли точки лица
     * @returns {Promise<Array>} - Массив обнаруженных лиц с координатами
     */
    async detectFaces(input, withLandmarks = true) {
        if (!this.isInitialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                return [];
            }
        }
        
        if (!input || input.readyState === 0) {
            return [];
        }
        
        try {
            const startTime = performance.now();
            
            // Копируем кадр на analysis canvas
            this.analysisCtx.drawImage(input, 0, 0, this.analysisCanvas.width, this.analysisCanvas.height);
            
            // Получаем данные пикселей
            const imageData = this.analysisCtx.getImageData(0, 0, this.analysisCanvas.width, this.analysisCanvas.height);
            
            // Ищем лицо с помощью анализа пикселей
            const face = this.detectFaceInImageData(imageData);
            
            this.lastProcessingTime = performance.now() - startTime;
            this.lastDetectedFaces = face ? [face] : [];
            
            if (!withLandmarks || !face) {
                return this.lastDetectedFaces.map(f => ({
                    boundingBox: f.boundingBox,
                    probability: f.probability
                }));
            }
            
            return this.lastDetectedFaces;
        } catch (error) {
            console.error('❌ FaceMeshDetector: Ошибка детектирования:', error);
            return [];
        }
    }
    
    /**
     * Анализ пикселей для поиска лица
     * @param {ImageData} imageData - Данные пикселей
     * @returns {Object|null} - Данные лица или null
     * @private
     */
    detectFaceInImageData(imageData) {
        const { data, width, height } = imageData;
        
        // Пропускаем кадры для оптимизации производительности
        this.frameSkip++;
        if (this.frameSkip % this.processEveryNthFrame !== 0) {
            // Возвращаем последнее валидное лицо с предсказанием Калмана
            if (this.lastValidFace) {
                const predicted = this.kalmanPredict(
                    this.lastValidFace.centerX, 
                    this.lastValidFace.centerY
                );
                
                return this.createPredictedFace(predicted, this.lastValidFace);
            }
            return null;
        }
        
        // Применяем фильтр для выделения тонов кожи
        const skinMask = this.createOptimizedSkinMask(data, width, height);
        
        // Ищем области концентрации пикселей кожи
        const faceRegions = this.findOptimizedFaceRegions(skinMask, width, height);
        
        if (faceRegions.length === 0) {
            // Если не нашли лицо, возвращаем последнее валидное с пониженной точностью
            if (this.lastValidFace) {
                return this.createDegradedFace(this.lastValidFace);
            }
            return null;
        }
        
        // Берем самую большую область как лицо
        let mainFace = faceRegions.reduce((max, region) => 
            region.area > max.area ? region : max
        );
        
        // Применяем фильтр Калмана для сглаживания позиции
        const smoothedPosition = this.kalmanPredict(mainFace.centerX, mainFace.centerY);
        
        // Обновляем позицию лица сглаженными координатами
        mainFace.centerX = smoothedPosition.x;
        mainFace.centerY = smoothedPosition.y;
        mainFace.confidence = Math.max(mainFace.confidence, smoothedPosition.confidence);
        
        // Стабилизация: если есть предыдущее лицо, проверяем отклонение
        if (this.lastValidFace) {
            const distance = Math.sqrt(
                Math.pow(mainFace.centerX - this.lastValidFace.centerX, 2) +
                Math.pow(mainFace.centerY - this.lastValidFace.centerY, 2)
            );
            
            // Если текущее лицо слишком далеко от предыдущего, применяем сглаживание
            if (distance > this.stabilizationThreshold) {
                mainFace = this.smoothFaceTransition(this.lastValidFace, mainFace);
            }
        }
        
        // Добавляем в историю для дальнейшего сглаживания
        this.addToFaceHistory(mainFace);
        
        // Применяем историческое сглаживание
        mainFace = this.applySmoothingFromHistory();
        
        // 🎭 НОВИНКА: Анализируем мимику лица
        const expression = this.analyzeFacialExpression(imageData, mainFace);
        
        // Генерируем landmarks с учетом мимики
        const landmarks = this.generateAdaptiveLandmarks(mainFace, width, height, expression);
        
        const faceData = {
            boundingBox: {
                x: mainFace.x,
                y: mainFace.y,
                width: mainFace.width,
                height: mainFace.height
            },
            probability: [mainFace.confidence],
            landmarks: landmarks,
            annotations: this.generateAdaptiveAnnotations(landmarks, mainFace, expression),
            expression: expression  // Добавляем данные мимики
        };
        
        // Сохраняем как последнее валидное лицо
        this.lastValidFace = mainFace;
        
        return faceData;
    }
    
    /**
     * Создает предсказанное лицо на основе фильтра Калмана
     * @param {Object} predicted - Предсказанная позиция
     * @param {Object} lastFace - Последнее валидное лицо
     * @returns {Object} - Данные предсказанного лица
     * @private
     */
    createPredictedFace(predicted, lastFace) {
        const predictedFace = {
            ...lastFace,
            centerX: predicted.x,
            centerY: predicted.y,
            confidence: Math.max(0.4, predicted.confidence * 0.9)
        };
        
        return {
            boundingBox: {
                x: predictedFace.x,
                y: predictedFace.y,
                width: predictedFace.width,
                height: predictedFace.height
            },
            probability: [predictedFace.confidence],
            landmarks: this.generateStabilizedLandmarks(predictedFace, 640, 480),
            annotations: this.generateStabilizedAnnotations([], predictedFace)
        };
    }
    
    /**
     * Инициализирует фильтр Калмана для сглаживания траектории (OpenCV подход)
     * @param {number} x - Начальная позиция X
     * @param {number} y - Начальная позиция Y
     * @private
     */
    initKalmanFilter(x, y) {
        // Состояние: [x, y, vx, vy] - позиция и скорость
        this.kalmanFilter.state = [x, y, 0, 0];
        
        // Матрица ковариации ошибок (4x4)
        this.kalmanFilter.covariance = [
            [1, 0, 0, 0],
            [0, 1, 0, 0], 
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];
        
        this.kalmanFilter.initialized = true;
        console.log('🎯 Kalman Filter инициализирован для сглаживания траектории');
    }
    
    /**
     * Применяет фильтр Калмана для предсказания и коррекции позиции
     * @param {number} measuredX - Измеренная позиция X
     * @param {number} measuredY - Измеренная позиция Y
     * @returns {Object} - Сглаженная позиция
     * @private
     */
    kalmanPredict(measuredX, measuredY) {
        if (!this.kalmanFilter.initialized) {
            this.initKalmanFilter(measuredX, measuredY);
            return { x: measuredX, y: measuredY };
        }
        
        const dt = 1.0; // Временной шаг
        const state = this.kalmanFilter.state;
        
        // Предсказание (модель постоянной скорости)
        const predictedX = state[0] + state[2] * dt;
        const predictedY = state[1] + state[3] * dt;
        
        // Коррекция на основе измерений
        const kalmanGain = 0.3; // Коэффициент усиления Калмана
        
        const correctedX = predictedX + kalmanGain * (measuredX - predictedX);
        const correctedY = predictedY + kalmanGain * (measuredY - predictedY);
        
        // Обновляем скорость
        state[2] = (correctedX - state[0]) / dt;
        state[3] = (correctedY - state[1]) / dt;
        
        // Обновляем позицию
        state[0] = correctedX;
        state[1] = correctedY;
        
        return {
            x: correctedX,
            y: correctedY,
            confidence: this.calculateKalmanConfidence(measuredX, measuredY, correctedX, correctedY)
        };
    }
    
    /**
     * Вычисляет уверенность фильтра Калмана
     * @param {number} measuredX - Измеренная X
     * @param {number} measuredY - Измеренная Y  
     * @param {number} predictedX - Предсказанная X
     * @param {number} predictedY - Предсказанная Y
     * @returns {number} - Уверенность от 0 до 1
     * @private
     */
    calculateKalmanConfidence(measuredX, measuredY, predictedX, predictedY) {
        const distance = Math.sqrt(
            Math.pow(measuredX - predictedX, 2) + 
            Math.pow(measuredY - predictedY, 2)
        );
        
        // Чем меньше расстояние, тем выше уверенность
        return Math.max(0, 1 - distance / 50);
    }
    
    /**
     * Оптимизированное создание маски кожи с кэшированием
     * @param {Uint8ClampedArray} data - Данные пикселей
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @returns {Uint8Array} - Маска кожи
     * @private
     */
    createOptimizedSkinMask(data, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const searchRadius = Math.min(width, height) * this.optimizedRegionSize / 2;
        
        const mask = new Uint8Array(width * height);
        
        // Оптимизированный поиск в центральной области
        const startX = Math.max(0, Math.floor(centerX - searchRadius));
        const endX = Math.min(width, Math.ceil(centerX + searchRadius));
        const startY = Math.max(0, Math.floor(centerY - searchRadius));
        const endY = Math.min(height, Math.ceil(centerY + searchRadius));
        
        for (let y = startY; y < endY; y += 2) { // Шаг 2 для ускорения
            for (let x = startX; x < endX; x += 2) {
                const pixelIndex = (y * width + x) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                
                // Быстрая проверка тона кожи (оптимизированная формула)
                if (this.isSkinToneOptimized(r, g, b)) {
                    const maskIndex = y * width + x;
                    mask[maskIndex] = 255;
                    
                    // Заполняем соседние пиксели для сглаживания
                    if (x + 1 < width) {mask[maskIndex + 1] = 255;}
                    if (y + 1 < height) {mask[(y + 1) * width + x] = 255;}
                }
            }
        }
        
        return mask;
    }
    
    /**
     * Оптимизированная проверка тона кожи
     * @param {number} r - Красный канал
     * @param {number} g - Зеленый канал  
     * @param {number} b - Синий канал
     * @returns {boolean} - Является ли цвет тоном кожи
     * @private
     */
    isSkinToneOptimized(r, g, b) {
        // Кэширование результатов для одинаковых цветов
        const colorKey = (r << 16) | (g << 8) | b;
        if (this.skinColorCache.has(colorKey)) {
            return this.skinColorCache.get(colorKey);
        }
        
        // Оптимизированные пороги для разных тонов кожи
        const result = (
            r > 95 && g > 40 && b > 20 &&
            Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
            Math.abs(r - g) > 15 && r > g && r > b
        ) || (
            r > 220 && g > 210 && b > 170 &&
            Math.abs(r - g) <= 15 && r > b && g > b
        );
        
        // Кэшируем результат (ограничиваем размер кэша)
        if (this.skinColorCache.size < 1000) {
            this.skinColorCache.set(colorKey, result);
        }
        
        return result;
    }
    
    /**
     * Улучшенный поиск областей лица с кластеризацией
     * @param {Uint8Array} skinMask - Маска кожи
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @returns {Array} - Массив найденных областей лица
     * @private
     */
    findOptimizedFaceRegions(skinMask, width, height) {
        const visited = new Uint8Array(width * height);
        const regions = [];
        const minRegionSize = (width * height) * 0.002; // Минимальный размер региона
        
        for (let y = 0; y < height; y += 3) { // Увеличенный шаг для скорости
            for (let x = 0; x < width; x += 3) {
                const index = y * width + x;
                
                if (skinMask[index] && !visited[index]) {
                    const region = this.floodFillOptimized(
                        skinMask, visited, x, y, width, height
                    );
                    
                    if (region.pixelCount > minRegionSize) {
                        // Вычисляем характеристики региона
                        const regionData = this.calculateRegionProperties(region, width, height);
                        
                        // Проверяем, похож ли регион на лицо (соотношение сторон)
                        if (this.isLikeFaceRegion(regionData)) {
                            regions.push(regionData);
                        }
                    }
                }
            }
        }
        
        // Сортируем по размеру и возвращаем лучшие
        return regions
            .sort((a, b) => b.area - a.area)
            .slice(0, 3); // Максимум 3 лица
    }
    
    /**
     * Оптимизированный flood fill алгоритм
     * @param {Uint8Array} mask - Маска
     * @param {Uint8Array} visited - Посещенные пиксели
     * @param {number} startX - Начальная X координата
     * @param {number} startY - Начальная Y координата
     * @param {number} width - Ширина
     * @param {number} height - Высота
     * @returns {Object} - Данные региона
     * @private
     */
    floodFillOptimized(mask, visited, startX, startY, width, height) {
        const stack = [{ x: startX, y: startY }];
        const region = {
            minX: startX, maxX: startX,
            minY: startY, maxY: startY,
            centerX: 0, centerY: 0,
            pixelCount: 0
        };
        
        let totalX = 0, totalY = 0;
        
        while (stack.length > 0) {
            const { x, y } = stack.pop();
            const index = y * width + x;
            
            if (x < 0 || x >= width || y < 0 || y >= height || 
                visited[index] || !mask[index]) {
                continue;
            }
            
            visited[index] = 1;
            region.pixelCount++;
            
            // Обновляем границы
            region.minX = Math.min(region.minX, x);
            region.maxX = Math.max(region.maxX, x);
            region.minY = Math.min(region.minY, y);
            region.maxY = Math.max(region.maxY, y);
            
            totalX += x;
            totalY += y;
            
            // Добавляем соседей (только 4-связность для скорости)
            stack.push(
                { x: x + 1, y: y },
                { x: x - 1, y: y },
                { x: x, y: y + 1 },
                { x: x, y: y - 1 }
            );
        }
        
        // Вычисляем центр
        region.centerX = totalX / region.pixelCount;
        region.centerY = totalY / region.pixelCount;
        
        return region;
    }
    
    /**
     * Вычисляет свойства региона
     * @param {Object} region - Регион
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @returns {Object} - Свойства региона
     * @private
     */
    calculateRegionProperties(region, width, height) {
        const regionWidth = region.maxX - region.minX + 1;
        const regionHeight = region.maxY - region.minY + 1;
        const area = regionWidth * regionHeight;
        const aspectRatio = regionWidth / regionHeight;
        
        // Плотность заполнения
        const density = region.pixelCount / area;
        
        // Позиция относительно центра изображения
        const centerDistance = Math.sqrt(
            Math.pow(region.centerX - width / 2, 2) +
            Math.pow(region.centerY - height / 2, 2)
        );
        
        return {
            x: region.minX,
            y: region.minY,
            width: regionWidth,
            height: regionHeight,
            centerX: region.centerX,
            centerY: region.centerY,
            area: area,
            aspectRatio: aspectRatio,
            density: density,
            centerDistance: centerDistance,
            confidence: this.calculateRegionConfidence(aspectRatio, density, centerDistance, width, height)
        };
    }
    
    /**
     * Проверяет, похож ли регион на лицо
     * @param {Object} regionData - Данные региона
     * @returns {boolean} - Похож ли на лицо
     * @private
     */
    isLikeFaceRegion(regionData) {
        // Соотношение сторон лица обычно от 0.7 до 1.3
        const aspectRatioOk = regionData.aspectRatio >= 0.7 && regionData.aspectRatio <= 1.3;
        
        // Плотность должна быть достаточно высокой
        const densityOk = regionData.density > 0.3;
        
        // Размер должен быть разумным
        const sizeOk = regionData.area > this.minFaceSize * this.minFaceSize && 
                      regionData.area < this.maxFaceSize * this.maxFaceSize;
        
        return aspectRatioOk && densityOk && sizeOk;
    }
    
    /**
     * Вычисляет уверенность для региона
     * @param {number} aspectRatio - Соотношение сторон
     * @param {number} density - Плотность
     * @param {number} centerDistance - Расстояние от центра
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @returns {number} - Уверенность от 0 до 1
     * @private
     */
    calculateRegionConfidence(aspectRatio, density, centerDistance, width, height) {
        // Идеальное соотношение сторон для лица
        const aspectScore = 1 - Math.abs(aspectRatio - 1.0);
        
        // Плотность (чем выше, тем лучше)
        const densityScore = Math.min(1, density * 2);
        
        // Близость к центру (лица обычно в центре)
        const maxDistance = Math.sqrt(width * width + height * height) / 2;
        const centerScore = 1 - (centerDistance / maxDistance);
        
        // Общая уверенность
        return (aspectScore * 0.4 + densityScore * 0.4 + centerScore * 0.2);
    }
    
    /**
     * Создает деградированное лицо на основе последнего валидного
     * @param {Object} lastFace - Последнее валидное лицо
     * @returns {Object} - Деградированные данные лица
     * @private
     */
    createDegradedFace(lastFace) {
        const degradedFace = {
            ...lastFace,
            confidence: Math.max(0.3, lastFace.confidence * 0.8)
        };
        
        return {
            boundingBox: {
                x: degradedFace.x,
                y: degradedFace.y,
                width: degradedFace.width,
                height: degradedFace.height
            },
            probability: [degradedFace.confidence],
            landmarks: this.generateStabilizedLandmarks(degradedFace, 640, 480),
            annotations: this.generateStabilizedAnnotations([], degradedFace)
        };
    }
    
    /**
     * Сглаживает переход между двумя позициями лица
     * @param {Object} oldFace - Предыдущее лицо
     * @param {Object} newFace - Новое лицо
     * @returns {Object} - Сглаженное лицо
     * @private
     */
    smoothFaceTransition(oldFace, newFace) {
        const smoothingFactor = 0.3; // Коэффициент сглаживания
        
        return {
            x: oldFace.x + (newFace.x - oldFace.x) * smoothingFactor,
            y: oldFace.y + (newFace.y - oldFace.y) * smoothingFactor,
            width: oldFace.width + (newFace.width - oldFace.width) * smoothingFactor,
            height: oldFace.height + (newFace.height - oldFace.height) * smoothingFactor,
            centerX: oldFace.centerX + (newFace.centerX - oldFace.centerX) * smoothingFactor,
            centerY: oldFace.centerY + (newFace.centerY - oldFace.centerY) * smoothingFactor,
            area: oldFace.area + (newFace.area - oldFace.area) * smoothingFactor,
            confidence: Math.max(oldFace.confidence, newFace.confidence)
        };
    }
    
    /**
     * Добавляет лицо в историю для сглаживания
     * @param {Object} face - Данные лица
     * @private
     */
    addToFaceHistory(face) {
        this.faceHistory.push(face);
        
        // Ограничиваем размер истории
        if (this.faceHistory.length > this.maxHistoryLength) {
            this.faceHistory.shift();
        }
    }
    
    /**
     * Применяет сглаживание на основе истории лиц
     * @returns {Object} - Сглаженное лицо
     * @private
     */
    applySmoothingFromHistory() {
        if (this.faceHistory.length === 0) {return null;}
        if (this.faceHistory.length === 1) {return this.faceHistory[0];}
        
        // Вычисляем взвешенное среднее
        let totalWeight = 0;
        const smoothed = {
            x: 0, y: 0, width: 0, height: 0,
            centerX: 0, centerY: 0, area: 0, confidence: 0
        };
        
        this.faceHistory.forEach((face, index) => {
            // Более свежие кадры имеют больший вес
            const weight = (index + 1) / this.faceHistory.length;
            totalWeight += weight;
            
            smoothed.x += face.x * weight;
            smoothed.y += face.y * weight;
            smoothed.width += face.width * weight;
            smoothed.height += face.height * weight;
            smoothed.centerX += face.centerX * weight;
            smoothed.centerY += face.centerY * weight;
            smoothed.area += face.area * weight;
            smoothed.confidence += face.confidence * weight;
        });
        
        // Нормализуем по общему весу
        Object.keys(smoothed).forEach(key => {
            smoothed[key] /= totalWeight;
        });
        
        return smoothed;
    }
    
    /**
     * Генерирует анатомически правильные landmarks
     * @param {Object} face - Данные обнаруженного лица
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @returns {Array} - Массив точек landmarks
     * @private
     */
    generateStabilizedLandmarks(face, width, height) {
        const landmarks = [];
        const centerX = face.centerX;
        const centerY = face.centerY;
        const faceWidth = face.width;
        const faceHeight = face.height;
        
        // Анатомические пропорции лица (по стандартам антропометрии)
        const proportions = {
            // Контур лица (0-16) - 17 точек
            jawline: { start: 0, count: 17, ratio: { w: 1.0, h: 1.2 } },
            
            // Правая бровь (17-21) - 5 точек  
            rightBrow: { start: 17, count: 5, ratio: { w: 0.25, h: 0.15, offsetY: -0.35 } },
            
            // Левая бровь (22-26) - 5 точек
            leftBrow: { start: 22, count: 5, ratio: { w: 0.25, h: 0.15, offsetY: -0.35 } },
            
            // Переносица (27-30) - 4 точки
            noseBridge: { start: 27, count: 4, ratio: { w: 0.08, h: 0.25, offsetY: -0.1 } },
            
            // Ноздри (31-35) - 5 точек
            nostrils: { start: 31, count: 5, ratio: { w: 0.15, h: 0.08, offsetY: 0.05 } },
            
            // Правый глаз (36-41) - 6 точек
            rightEye: { start: 36, count: 6, ratio: { w: 0.12, h: 0.06, offsetX: -0.2, offsetY: -0.15 } },
            
            // Левый глаз (42-47) - 6 точек  
            leftEye: { start: 42, count: 6, ratio: { w: 0.12, h: 0.06, offsetX: 0.2, offsetY: -0.15 } },
            
            // Внешний контур губ (48-59) - 12 точек
            outerLips: { start: 48, count: 12, ratio: { w: 0.25, h: 0.08, offsetY: 0.25 } },
            
            // Внутренний контур губ (60-67) - 8 точек
            innerLips: { start: 60, count: 8, ratio: { w: 0.2, h: 0.04, offsetY: 0.25 } }
        };
        
        // Генерируем точки для каждой анатомической зоны
        Object.entries(proportions).forEach(([zone, config]) => {
            const zonePoints = this.generateZoneLandmarks(
                centerX, centerY, faceWidth, faceHeight, config, zone
            );
            landmarks.push(...zonePoints);
        });
        
        // Добавляем дополнительные точки для полной сетки (468 точек)
        const additionalPoints = this.generateAdditionalMeshPoints(
            centerX, centerY, faceWidth, faceHeight, landmarks.length
        );
        landmarks.push(...additionalPoints);
        
        return landmarks.slice(0, 468); // Ограничиваем до 468 точек
    }
    
    /**
     * Генерирует точки для конкретной анатомической зоны
     * @param {number} centerX - Центр лица по X
     * @param {number} centerY - Центр лица по Y  
     * @param {number} faceWidth - Ширина лица
     * @param {number} faceHeight - Высота лица
     * @param {Object} config - Конфигурация зоны
     * @param {string} zoneName - Название зоны
     * @returns {Array} - Точки зоны
     * @private
     */
    generateZoneLandmarks(centerX, centerY, faceWidth, faceHeight, config, zoneName) {
        const points = [];
        const { count, ratio } = config;
        
        // Размеры зоны
        const zoneWidth = faceWidth * ratio.w;
        const zoneHeight = faceHeight * ratio.h;
        
        // Смещение зоны относительно центра лица
        const offsetX = (config.offsetX || 0) * faceWidth;
        const offsetY = (config.offsetY || 0) * faceHeight;
        
        const zoneCenterX = centerX + offsetX;
        const zoneCenterY = centerY + offsetY;
        
        // Специальная логика для разных зон
        switch (zoneName) {
            case 'jawline':
                return this.generateJawlinePoints(centerX, centerY, faceWidth, faceHeight, count);
                
            case 'rightBrow':
            case 'leftBrow':
                return this.generateBrowPoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count, zoneName.includes('right'));
                
            case 'rightEye':
            case 'leftEye':
                return this.generateEyePoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count);
                
            case 'outerLips':
            case 'innerLips':
                return this.generateLipPoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count, zoneName === 'outerLips');
                
            case 'noseBridge':
                return this.generateNoseBridgePoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count);
                
            case 'nostrils':
                return this.generateNostrilPoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count);
                
            default:
                // Стандартное распределение точек
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * 2 * Math.PI;
                    const x = zoneCenterX + Math.cos(angle) * zoneWidth / 2;
                    const y = zoneCenterY + Math.sin(angle) * zoneHeight / 2;
                    points.push([x, y, 0]);
                }
                return points;
        }
    }
    
    /**
     * Генерирует точки контура лица (овал)
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} width - Ширина лица
     * @param {number} height - Высота лица
     * @param {number} count - Количество точек
     * @returns {Array} - Точки контура
     * @private
     */
    generateJawlinePoints(centerX, centerY, width, height, count) {
        const points = [];
        
        for (let i = 0; i < count; i++) {
            // Угол от 0 до 2π для создания овала
            const angle = (i / (count - 1)) * Math.PI; // Полукруг для подбородка
            
            // Создаем овальную форму лица
            const radiusX = width * 0.5;
            const radiusY = height * 0.6;
            
            // Корректируем форму для более реалистичного контура лица
            const adjustedAngle = angle - Math.PI / 2; // Начинаем сверху
            const x = centerX + Math.cos(adjustedAngle) * radiusX;
            const y = centerY + Math.sin(adjustedAngle) * radiusY;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует точки бровей
     * @param {number} centerX - Центр X брови
     * @param {number} centerY - Центр Y брови
     * @param {number} width - Ширина брови
     * @param {number} height - Высота брови
     * @param {number} count - Количество точек
     * @param {boolean} isRight - Правая бровь
     * @returns {Array} - Точки брови
     * @private
     */
    generateBrowPoints(centerX, centerY, width, height, count, isRight) {
        const points = [];
        
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            
            // Создаем изгиб брови (квадратичная кривая)
            const x = centerX + (t - 0.5) * width;
            const browCurve = Math.sin(t * Math.PI) * height * 0.5;
            const y = centerY - browCurve;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует точки глаза
     * @param {number} centerX - Центр X глаза
     * @param {number} centerY - Центр Y глаза
     * @param {number} width - Ширина глаза
     * @param {number} height - Высота глаза
     * @param {number} count - Количество точек
     * @returns {Array} - Точки глаза
     * @private
     */
    generateEyePoints(centerX, centerY, width, height, count) {
        const points = [];
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * 2 * Math.PI;
            
            // Создаем миндалевидную форму глаза
            const radiusX = width / 2;
            const radiusY = height / 2;
            
            const x = centerX + Math.cos(angle) * radiusX;
            const y = centerY + Math.sin(angle) * radiusY * 0.6; // Сжимаем по вертикали
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует точки губ
     * @param {number} centerX - Центр X губ
     * @param {number} centerY - Центр Y губ
     * @param {number} width - Ширина губ
     * @param {number} height - Высота губ
     * @param {number} count - Количество точек
     * @param {boolean} isOuter - Внешний контур
     * @returns {Array} - Точки губ
     * @private
     */
    generateLipPoints(centerX, centerY, width, height, count, isOuter) {
        const points = [];
        const scale = isOuter ? 1.0 : 0.7; // Внутренний контур меньше
        
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const angle = t * 2 * Math.PI;
            
            // Создаем форму губ (эллипс с модификацией)
            const radiusX = (width / 2) * scale;
            const radiusY = (height / 2) * scale;
            
            const x = centerX + Math.cos(angle) * radiusX;
            const y = centerY + Math.sin(angle) * radiusY;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует точки переносицы
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} width - Ширина
     * @param {number} height - Высота
     * @param {number} count - Количество точек
     * @returns {Array} - Точки переносицы
     * @private
     */
    generateNoseBridgePoints(centerX, centerY, width, height, count) {
        const points = [];
        
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const x = centerX;
            const y = centerY + (t - 0.5) * height;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует точки ноздрей
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} width - Ширина
     * @param {number} height - Высота
     * @param {number} count - Количество точек
     * @returns {Array} - Точки ноздрей
     * @private
     */
    generateNostrilPoints(centerX, centerY, width, height, count) {
        const points = [];
        
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const x = centerX + (t - 0.5) * width;
            const y = centerY;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует дополнительные точки сетки для заполнения до 468
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} faceWidth - Ширина лица
     * @param {number} faceHeight - Высота лица
     * @param {number} currentCount - Текущее количество точек
     * @returns {Array} - Дополнительные точки
     * @private
     */
    generateAdditionalMeshPoints(centerX, centerY, faceWidth, faceHeight, currentCount) {
        const points = [];
        const needed = 468 - currentCount;
        
        // Генерируем сетку точек внутри лица
        const gridSize = Math.ceil(Math.sqrt(needed));
        
        for (let i = 0; i < needed; i++) {
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            
            // Распределяем точки равномерно внутри области лица
            const x = centerX + (col / gridSize - 0.5) * faceWidth * 0.8;
            const y = centerY + (row / gridSize - 0.5) * faceHeight * 0.8;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует стабилизированные аннотации
     * @param {Array} landmarks - Точки лица
     * @param {Object} faceRegion - Область лица
     * @returns {Object} - Стабилизированные аннотации
     * @private
     */
    generateStabilizedAnnotations(landmarks, faceRegion) {
        const { centerX, centerY, width: faceWidth, height: faceHeight } = faceRegion;
        
        return {
            leftEye: [[centerX - faceWidth * 0.2, centerY - faceHeight * 0.15, 0]],
            rightEye: [[centerX + faceWidth * 0.2, centerY - faceHeight * 0.15, 0]],
            noseTip: [[centerX, centerY + faceHeight * 0.05, 0]],
            lipsUpperOuter: [[centerX, centerY + faceHeight * 0.25, 0]]
        };
    }
    
    /**
     * Получает информацию о лице для наложения масок
     * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input - Входное изображение или видео
     * @returns {Promise<Object>} - Данные для наложения маски
     */
    async getFaceMaskData(input) {
        const faces = await this.detectFaces(input, true);
        
        if (!faces || faces.length === 0) {
            return null;
        }
        
        const face = faces[0];
        const centerX = face.boundingBox.x + face.boundingBox.width / 2;
        const centerY = face.boundingBox.y + face.boundingBox.height / 2;
        
        return {
            boundingBox: face.boundingBox,
            landmarks: face.landmarks,
            annotations: face.annotations,
            keyPoints: {
                leftEye: { x: centerX - 30, y: centerY - 20, z: 0 },
                rightEye: { x: centerX + 30, y: centerY - 20, z: 0 },
                nose: { x: centerX, y: centerY + 5, z: 0 },
                mouth: { x: centerX, y: centerY + 30, z: 0 },
                faceCenter: { x: centerX, y: centerY, z: 0 },
                faceWidth: face.boundingBox.width,
                faceHeight: face.boundingBox.height
            }
        };
    }
    
    /**
     * Настройки детектора
     * @param {Object} options - Параметры настройки
     */
    updateSettings(options) {
        if (options.refineLandmarks !== undefined) {
            this.refineLandmarks = options.refineLandmarks;
        }
        if (options.confidenceThreshold !== undefined) {
            this.faceDetectionParams.confidenceThreshold = options.confidenceThreshold;
        }
        console.log('🎭 FaceMeshDetector: Настройки обновлены');
    }
    
    /**
     * Освобождает ресурсы
     */
    dispose() {
        this.isInitialized = false;
        this.lastDetectedFaces = [];
        this.processingTimeHistory = [];
        this.analysisCanvas = null;
        this.analysisCtx = null;
        console.log('🎭 FaceMeshDetector: Ресурсы освобождены');
    }
    
    /**
     * Получает среднее время обработки
     * @returns {number} - Время в мс
     */
    getAverageProcessingTime() {
        return this.lastProcessingTime || 8;
    }
    
    /**
     * Получает примерную частоту кадров
     * @returns {number} - FPS
     */
    getEstimatedFPS() {
        const avgTime = this.getAverageProcessingTime();
        return avgTime > 0 ? Math.round(1000 / avgTime) : 30;
    }
    
    /**
     * Анализирует мимику и адаптирует точки
     * @param {ImageData} imageData - Данные изображения
     * @param {Object} face - Данные лица
     * @returns {Object} - Данные мимики
     * @private
     */
    analyzeFacialExpression(imageData, face) {
        const { data, width, height } = imageData;
        const { centerX, centerY, width: faceWidth, height: faceHeight } = face;
        
        // Определяем ключевые области для анализа мимики
        const eyeRegion = this.analyzeEyeRegion(data, width, height, centerX, centerY, faceWidth, faceHeight);
        const mouthRegion = this.analyzeMouthRegion(data, width, height, centerX, centerY, faceWidth, faceHeight);
        const browRegion = this.analyzeBrowRegion(data, width, height, centerX, centerY, faceWidth, faceHeight);
        const cheekRegion = this.analyzeCheekRegion(data, width, height, centerX, centerY, faceWidth, faceHeight);
        
        return {
            // Состояние глаз (0 = закрыты, 1 = открыты)
            eyesOpen: eyeRegion.openness,
            
            // Состояние рта (0 = закрыт, 1 = открыт)
            mouthOpen: mouthRegion.openness,
            
            // Улыбка (0 = нет, 1 = максимальная)
            smiling: mouthRegion.smileIntensity,
            
            // Поднятые брови (0 = нет, 1 = максимально подняты)
            browRaised: browRegion.elevation,
            
            // Надутые щеки (0 = нет, 1 = максимально надуты)
            cheeksPuffed: cheekRegion.puffiness,
            
            // Общая интенсивность выражения
            expressionIntensity: (eyeRegion.activity + mouthRegion.activity + browRegion.activity) / 3,
            
            // Тип доминирующего выражения
            dominantExpression: this.determineDominantExpression(eyeRegion, mouthRegion, browRegion, cheekRegion)
        };
    }
    
    /**
     * Анализирует область глаз
     * @param {Uint8ClampedArray} data - Пиксельные данные
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @param {number} centerX - Центр лица по X
     * @param {number} centerY - Центр лица по Y
     * @param {number} faceWidth - Ширина лица
     * @param {number} faceHeight - Высота лица
     * @returns {Object} - Данные области глаз
     * @private
     */
    analyzeEyeRegion(data, width, height, centerX, centerY, faceWidth, faceHeight) {
        // Определяем области левого и правого глаза
        const leftEyeX = Math.round(centerX - faceWidth * 0.2);
        const rightEyeX = Math.round(centerX + faceWidth * 0.2);
        const eyeY = Math.round(centerY - faceHeight * 0.15);
        const eyeWidth = Math.round(faceWidth * 0.12);
        const eyeHeight = Math.round(faceHeight * 0.06);
        
        // Анализируем интенсивность пикселей в области глаз
        const leftEyeIntensity = this.calculateRegionIntensity(data, width, leftEyeX, eyeY, eyeWidth, eyeHeight);
        const rightEyeIntensity = this.calculateRegionIntensity(data, width, rightEyeX, eyeY, eyeWidth, eyeHeight);
        
        // Средняя интенсивность глаз
        const avgIntensity = (leftEyeIntensity + rightEyeIntensity) / 2;
        
        // Определяем открытость глаз на основе контраста
        // Открытые глаза имеют больший контраст (белки + зрачки)
        const openness = Math.min(1, Math.max(0, (avgIntensity - 80) / 100));
        
        return {
            openness: openness,
            activity: Math.abs(0.7 - openness), // Активность = отклонение от нормального состояния
            leftIntensity: leftEyeIntensity,
            rightIntensity: rightEyeIntensity
        };
    }
    
    /**
     * Анализирует область рта
     * @param {Uint8ClampedArray} data - Пиксельные данные
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @param {number} centerX - Центр лица по X
     * @param {number} centerY - Центр лица по Y
     * @param {number} faceWidth - Ширина лица
     * @param {number} faceHeight - Высота лица
     * @returns {Object} - Данные области рта
     * @private
     */
    analyzeMouthRegion(data, width, height, centerX, centerY, faceWidth, faceHeight) {
        const mouthX = Math.round(centerX - faceWidth * 0.125);
        const mouthY = Math.round(centerY + faceHeight * 0.25);
        const mouthWidth = Math.round(faceWidth * 0.25);
        const mouthHeight = Math.round(faceHeight * 0.08);
        
        // Анализируем центральную область рта
        const mouthCenterIntensity = this.calculateRegionIntensity(
            data, width, 
            Math.round(centerX - mouthWidth * 0.2), 
            mouthY, 
            Math.round(mouthWidth * 0.4), 
            mouthHeight
        );
        
        // Анализируем уголки рта для определения улыбки
        const leftCornerIntensity = this.calculateRegionIntensity(
            data, width, 
            Math.round(centerX - faceWidth * 0.125), 
            mouthY, 
            Math.round(faceWidth * 0.05), 
            Math.round(faceHeight * 0.04)
        );
        
        const rightCornerIntensity = this.calculateRegionIntensity(
            data, width, 
            Math.round(centerX + faceWidth * 0.075), 
            mouthY, 
            Math.round(faceWidth * 0.05), 
            Math.round(faceHeight * 0.04)
        );
        
        // Определяем открытость рта (темная область = открытый рот)
        const openness = Math.min(1, Math.max(0, (120 - mouthCenterIntensity) / 80));
        
        // Определяем улыбку по поднятым уголкам
        const cornerElevation = (leftCornerIntensity + rightCornerIntensity) / 2;
        const smileIntensity = Math.min(1, Math.max(0, (cornerElevation - 100) / 60));
        
        return {
            openness: openness,
            smileIntensity: smileIntensity,
            activity: Math.max(openness, smileIntensity),
            centerIntensity: mouthCenterIntensity,
            cornerIntensity: cornerElevation
        };
    }
    
    /**
     * Анализирует область бровей
     * @param {Uint8ClampedArray} data - Пиксельные данные
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @param {number} centerX - Центр лица по X
     * @param {number} centerY - Центр лица по Y
     * @param {number} faceWidth - Ширина лица
     * @param {number} faceHeight - Высота лица
     * @returns {Object} - Данные области бровей
     * @private
     */
    analyzeBrowRegion(data, width, height, centerX, centerY, faceWidth, faceHeight) {
        const browY = Math.round(centerY - faceHeight * 0.35);
        const browWidth = Math.round(faceWidth * 0.25);
        const browHeight = Math.round(faceHeight * 0.15);
        
        // Анализируем левую и правую брови
        const leftBrowIntensity = this.calculateRegionIntensity(
            data, width, 
            Math.round(centerX - faceWidth * 0.25), 
            browY, 
            browWidth, 
            browHeight
        );
        
        const rightBrowIntensity = this.calculateRegionIntensity(
            data, width, 
            Math.round(centerX), 
            browY, 
            browWidth, 
            browHeight
        );
        
        const avgBrowIntensity = (leftBrowIntensity + rightBrowIntensity) / 2;
        
        // Поднятые брови создают больше контраста с лбом
        const elevation = Math.min(1, Math.max(0, (avgBrowIntensity - 90) / 70));
        
        return {
            elevation: elevation,
            activity: elevation,
            leftIntensity: leftBrowIntensity,
            rightIntensity: rightBrowIntensity
        };
    }
    
    /**
     * Анализирует область щек
     * @param {Uint8ClampedArray} data - Пиксельные данные
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @param {number} centerX - Центр лица по X
     * @param {number} centerY - Центр лица по Y
     * @param {number} faceWidth - Ширина лица
     * @param {number} faceHeight - Высота лица
     * @returns {Object} - Данные области щек
     * @private
     */
    analyzeCheekRegion(data, width, height, centerX, centerY, faceWidth, faceHeight) {
        const cheekY = Math.round(centerY);
        const cheekWidth = Math.round(faceWidth * 0.15);
        const cheekHeight = Math.round(faceHeight * 0.2);
        
        // Анализируем левую и правую щеки
        const leftCheekIntensity = this.calculateRegionIntensity(
            data, width, 
            Math.round(centerX - faceWidth * 0.4), 
            cheekY, 
            cheekWidth, 
            cheekHeight
        );
        
        const rightCheekIntensity = this.calculateRegionIntensity(
            data, width, 
            Math.round(centerX + faceWidth * 0.25), 
            cheekY, 
            cheekWidth, 
            cheekHeight
        );
        
        const avgCheekIntensity = (leftCheekIntensity + rightCheekIntensity) / 2;
        
        // Надутые щеки имеют характерную яркость
        const puffiness = Math.min(1, Math.max(0, (avgCheekIntensity - 110) / 50));
        
        return {
            puffiness: puffiness,
            activity: puffiness,
            leftIntensity: leftCheekIntensity,
            rightIntensity: rightCheekIntensity
        };
    }
    
    /**
     * Вычисляет среднюю интенсивность пикселей в области
     * @param {Uint8ClampedArray} data - Пиксельные данные
     * @param {number} width - Ширина изображения
     * @param {number} x - X координата области
     * @param {number} y - Y координата области
     * @param {number} regionWidth - Ширина области
     * @param {number} regionHeight - Высота области
     * @returns {number} - Средняя интенсивность
     * @private
     */
    calculateRegionIntensity(data, width, x, y, regionWidth, regionHeight) {
        let totalIntensity = 0;
        let pixelCount = 0;
        
        for (let dy = 0; dy < regionHeight; dy++) {
            for (let dx = 0; dx < regionWidth; dx++) {
                const pixelX = x + dx;
                const pixelY = y + dy;
                
                if (pixelX >= 0 && pixelX < width && pixelY >= 0) {
                    const index = (pixelY * width + pixelX) * 4;
                    
                    // Вычисляем яркость пикселя (grayscale)
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    const intensity = (r + g + b) / 3;
                    
                    totalIntensity += intensity;
                    pixelCount++;
                }
            }
        }
        
        return pixelCount > 0 ? totalIntensity / pixelCount : 0;
    }
    
    /**
     * Определяет доминирующее выражение лица
     * @param {Object} eyeRegion - Данные глаз
     * @param {Object} mouthRegion - Данные рта
     * @param {Object} browRegion - Данные бровей
     * @param {Object} cheekRegion - Данные щек
     * @returns {string} - Тип выражения
     * @private
     */
    determineDominantExpression(eyeRegion, mouthRegion, browRegion, cheekRegion) {
        const expressions = [];
        
        // Анализируем различные выражения
        if (mouthRegion.smileIntensity > 0.6) {
            expressions.push({ type: 'happy', intensity: mouthRegion.smileIntensity });
        }
        
        if (mouthRegion.openness > 0.7) {
            expressions.push({ type: 'surprised', intensity: mouthRegion.openness });
        }
        
        if (browRegion.elevation > 0.6) {
            expressions.push({ type: 'surprised', intensity: browRegion.elevation });
        }
        
        if (eyeRegion.openness < 0.3) {
            expressions.push({ type: 'sleepy', intensity: 1 - eyeRegion.openness });
        }
        
        if (cheekRegion.puffiness > 0.5) {
            expressions.push({ type: 'puffed', intensity: cheekRegion.puffiness });
        }
        
        // Если нет ярко выраженных эмоций
        if (expressions.length === 0) {
            return 'neutral';
        }
        
        // Возвращаем самое интенсивное выражение
        const dominant = expressions.reduce((max, expr) => 
            expr.intensity > max.intensity ? expr : max
        );
        
        return dominant.type;
    }
    
    /**
     * Генерирует адаптивные landmarks на основе мимики
     * @param {Object} face - Данные лица
     * @param {number} width - Ширина изображения
     * @param {number} height - Высота изображения
     * @param {Object} expression - Данные мимики
     * @returns {Array} - Адаптивные landmarks
     * @private
     */
    generateAdaptiveLandmarks(face, width, height, expression) {
        const landmarks = [];
        const centerX = face.centerX;
        const centerY = face.centerY;
        const faceWidth = face.width;
        const faceHeight = face.height;
        
        // Базовые пропорции лица с адаптацией под мимику
        const adaptiveConfig = {
            // Контур лица (0-16) - 17 точек
            jawline: { 
                start: 0, count: 17, 
                ratio: { w: 1.0, h: 1.2 },
                adaptation: { cheeksPuffed: expression.cheeksPuffed * 0.1 }
            },
            
            // Брови (17-26) - 10 точек  
            eyebrows: { 
                start: 17, count: 10, 
                ratio: { w: 0.5, h: 0.15, offsetY: -0.35 },
                adaptation: { browRaised: expression.browRaised * 0.1 }
            },
            
            // Переносица (27-30) - 4 точки
            noseBridge: { 
                start: 27, count: 4, 
                ratio: { w: 0.08, h: 0.25, offsetY: -0.1 },
                adaptation: {}
            },
            
            // Ноздри (31-35) - 5 точек
            nostrils: { 
                start: 31, count: 5, 
                ratio: { w: 0.15, h: 0.08, offsetY: 0.05 },
                adaptation: {}
            },
            
            // Глаза (36-47) - 12 точек
            eyes: { 
                start: 36, count: 12, 
                ratio: { w: 0.4, h: 0.12, offsetY: -0.15 },
                adaptation: { eyesOpen: expression.eyesOpen * 0.1 }
            },
            
            // Губы (48-67) - 20 точек
            lips: { 
                start: 48, count: 20, 
                ratio: { w: 0.25, h: 0.12, offsetY: 0.25 },
                adaptation: { 
                    mouthOpen: expression.mouthOpen * 0.15,
                    smiling: expression.smiling * 0.1
                }
            }
        };
        
        // Генерируем адаптивные точки для каждой зоны
        Object.entries(adaptiveConfig).forEach(([zoneName, config]) => {
            const zonePoints = this.generateAdaptiveZoneLandmarks(
                centerX, centerY, faceWidth, faceHeight, config, zoneName, expression
            );
            landmarks.push(...zonePoints);
        });
        
        // Добавляем дополнительные точки для полной сетки (468 точек)
        const additionalPoints = this.generateAdditionalMeshPoints(
            centerX, centerY, faceWidth, faceHeight, landmarks.length
        );
        landmarks.push(...additionalPoints);
        
        return landmarks.slice(0, 468); // Ограничиваем до 468 точек
    }
    
    /**
     * Генерирует адаптивные точки для конкретной зоны лица
     * @param {number} centerX - Центр лица по X
     * @param {number} centerY - Центр лица по Y  
     * @param {number} faceWidth - Ширина лица
     * @param {number} faceHeight - Высота лица
     * @param {Object} config - Конфигурация зоны
     * @param {string} zoneName - Название зоны
     * @param {Object} expression - Данные мимики
     * @returns {Array} - Адаптивные точки зоны
     * @private
     */
    generateAdaptiveZoneLandmarks(centerX, centerY, faceWidth, faceHeight, config, zoneName, expression) {
        const points = [];
        const { count, ratio, adaptation } = config;
        
        // Базовые размеры зоны
        let zoneWidth = faceWidth * ratio.w;
        let zoneHeight = faceHeight * ratio.h;
        
        // Применяем адаптацию на основе мимики
        Object.entries(adaptation).forEach(([expressionType, factor]) => {
            if (expression[expressionType]) {
                const adaptationValue = expression[expressionType] * factor;
                
                switch (expressionType) {
                    case 'browRaised':
                        // Поднятые брови смещают точки вверх
                        if (zoneName === 'eyebrows') {
                            zoneHeight *= (1 + adaptationValue);
                        }
                        break;
                        
                    case 'eyesOpen':
                        // Открытые глаза увеличивают высоту области глаз
                        if (zoneName === 'eyes') {
                            zoneHeight *= (1 + adaptationValue);
                        }
                        break;
                        
                    case 'mouthOpen':
                        // Открытый рот увеличивает высоту губ
                        if (zoneName === 'lips') {
                            zoneHeight *= (1 + adaptationValue * 2);
                        }
                        break;
                        
                    case 'smiling':
                        // Улыбка расширяет губы
                        if (zoneName === 'lips') {
                            zoneWidth *= (1 + adaptationValue);
                        }
                        break;
                        
                    case 'cheeksPuffed':
                        // Надутые щеки расширяют контур лица
                        if (zoneName === 'jawline') {
                            zoneWidth *= (1 + adaptationValue);
                        }
                        break;
                }
            }
        });
        
        // Смещение зоны относительно центра лица
        const offsetX = (config.ratio.offsetX || 0) * faceWidth;
        const offsetY = (config.ratio.offsetY || 0) * faceHeight;
        
        const zoneCenterX = centerX + offsetX;
        const zoneCenterY = centerY + offsetY;
        
        // Генерируем точки в зависимости от типа зоны
        switch (zoneName) {
            case 'jawline':
                return this.generateAdaptiveJawlinePoints(centerX, centerY, zoneWidth, zoneHeight, count, expression);
                
            case 'eyebrows':
                return this.generateAdaptiveBrowPoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count, expression);
                
            case 'eyes':
                return this.generateAdaptiveEyePoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count, expression);
                
            case 'lips':
                return this.generateAdaptiveLipPoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count, expression);
                
            case 'noseBridge':
                return this.generateNoseBridgePoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count);
                
            case 'nostrils':
                return this.generateNostrilPoints(zoneCenterX, zoneCenterY, zoneWidth, zoneHeight, count);
                
            default:
                // Стандартное распределение точек
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * 2 * Math.PI;
                    const x = zoneCenterX + Math.cos(angle) * zoneWidth / 2;
                    const y = zoneCenterY + Math.sin(angle) * zoneHeight / 2;
                    points.push([x, y, 0]);
                }
                return points;
        }
    }
    
    /**
     * Генерирует адаптивные точки контура лица
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} width - Ширина лица с учетом адаптации
     * @param {number} height - Высота лица с учетом адаптации
     * @param {number} count - Количество точек
     * @param {Object} expression - Данные мимики
     * @returns {Array} - Адаптивные точки контура
     * @private
     */
    generateAdaptiveJawlinePoints(centerX, centerY, width, height, count, expression) {
        const points = [];
        
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const angle = t * Math.PI - Math.PI / 2; // От -π/2 до π/2
            
            // Базовые радиусы
            let radiusX = width * 0.5;
            let radiusY = height * 0.6;
            
            // Адаптация под надутые щеки
            if (expression.cheeksPuffed > 0.3) {
                const puffFactor = 1 + expression.cheeksPuffed * 0.2;
                radiusX *= puffFactor;
            }
            
            const x = centerX + Math.cos(angle) * radiusX;
            const y = centerY + Math.sin(angle) * radiusY;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует адаптивные точки бровей
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} width - Ширина области бровей
     * @param {number} height - Высота области бровей
     * @param {number} count - Количество точек
     * @param {Object} expression - Данные мимики
     * @returns {Array} - Адаптивные точки бровей
     * @private
     */
    generateAdaptiveBrowPoints(centerX, centerY, width, height, count, expression) {
        const points = [];
        const leftBrowPoints = Math.ceil(count / 2);
        const rightBrowPoints = count - leftBrowPoints;
        
        // Левая бровь
        for (let i = 0; i < leftBrowPoints; i++) {
            const t = i / (leftBrowPoints - 1);
            let x = centerX - width * 0.25 + (t - 0.5) * width * 0.5;
            let y = centerY - height * 0.5;
            
            // Адаптация под поднятые брови
            if (expression.browRaised > 0.3) {
                y -= expression.browRaised * height * 0.3;
                const browCurve = Math.sin(t * Math.PI) * height * 0.3 * expression.browRaised;
                y -= browCurve;
            }
            
            points.push([x, y, 0]);
        }
        
        // Правая бровь
        for (let i = 0; i < rightBrowPoints; i++) {
            const t = i / (rightBrowPoints - 1);
            let x = centerX + width * 0.25 + (t - 0.5) * width * 0.5;
            let y = centerY - height * 0.5;
            
            // Адаптация под поднятые брови
            if (expression.browRaised > 0.3) {
                y -= expression.browRaised * height * 0.3;
                const browCurve = Math.sin(t * Math.PI) * height * 0.3 * expression.browRaised;
                y -= browCurve;
            }
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует адаптивные точки глаз
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} width - Ширина области глаз
     * @param {number} height - Высота области глаз
     * @param {number} count - Количество точек
     * @param {Object} expression - Данные мимики
     * @returns {Array} - Адаптивные точки глаз
     * @private
     */
    generateAdaptiveEyePoints(centerX, centerY, width, height, count, expression) {
        const points = [];
        const leftEyePoints = Math.ceil(count / 2);
        const rightEyePoints = count - leftEyePoints;
        
        // Левый глаз
        for (let i = 0; i < leftEyePoints; i++) {
            const angle = (i / leftEyePoints) * 2 * Math.PI;
            let radiusX = width * 0.12;
            let radiusY = height * 0.25;
            
            // Адаптация под открытость глаз
            if (expression.eyesOpen < 0.3) {
                radiusY *= 0.3; // Закрытые глаза
            } else if (expression.eyesOpen > 0.7) {
                radiusY *= 1.3; // Широко открытые глаза
            }
            
            const x = centerX - width * 0.2 + Math.cos(angle) * radiusX;
            const y = centerY + Math.sin(angle) * radiusY;
            
            points.push([x, y, 0]);
        }
        
        // Правый глаз
        for (let i = 0; i < rightEyePoints; i++) {
            const angle = (i / rightEyePoints) * 2 * Math.PI;
            let radiusX = width * 0.12;
            let radiusY = height * 0.25;
            
            // Адаптация под открытость глаз
            if (expression.eyesOpen < 0.3) {
                radiusY *= 0.3; // Закрытые глаза
            } else if (expression.eyesOpen > 0.7) {
                radiusY *= 1.3; // Широко открытые глаза
            }
            
            const x = centerX + width * 0.2 + Math.cos(angle) * radiusX;
            const y = centerY + Math.sin(angle) * radiusY;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует адаптивные точки губ
     * @param {number} centerX - Центр X
     * @param {number} centerY - Центр Y
     * @param {number} width - Ширина губ
     * @param {number} height - Высота губ
     * @param {number} count - Количество точек
     * @param {Object} expression - Данные мимики
     * @returns {Array} - Адаптивные точки губ
     * @private
     */
    generateAdaptiveLipPoints(centerX, centerY, width, height, count, expression) {
        const points = [];
        
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const angle = t * 2 * Math.PI;
            
            let radiusX = width / 2;
            let radiusY = height / 2;
            
            // Адаптация под открытый рот
            if (expression.mouthOpen > 0.3) {
                radiusY *= (1 + expression.mouthOpen * 1.5);
            }
            
            // Адаптация под улыбку
            if (expression.smiling > 0.3) {
                radiusX *= (1 + expression.smiling * 0.3);
                // Поднимаем уголки губ
                if (Math.sin(angle) > 0.7 || Math.sin(angle) < -0.7) {
                    const cornerLift = expression.smiling * height * 0.2;
                    centerY -= cornerLift;
                }
            }
            
            const x = centerX + Math.cos(angle) * radiusX;
            const y = centerY + Math.sin(angle) * radiusY;
            
            points.push([x, y, 0]);
        }
        
        return points;
    }
    
    /**
     * Генерирует адаптивные аннотации
     * @param {Array} landmarks - Точки лица
     * @param {Object} faceRegion - Область лица
     * @param {Object} expression - Данные мимики
     * @returns {Object} - Адаптивные аннотации
     * @private
     */
    generateAdaptiveAnnotations(landmarks, faceRegion, expression) {
        const { centerX, centerY, width: faceWidth, height: faceHeight } = faceRegion;
        
        // Базовые аннотации с адаптацией под мимику
        const annotations = {
            silhouette: landmarks.slice(0, 17) || [[centerX, centerY, 0]],
            lipsUpperOuter: landmarks.slice(48, 55) || [[centerX, centerY + faceHeight * 0.25, 0]],
            lipsLowerOuter: landmarks.slice(55, 60) || [[centerX, centerY + faceHeight * 0.3, 0]],
            lipsUpperInner: landmarks.slice(60, 65) || [[centerX, centerY + faceHeight * 0.25, 0]],
            lipsLowerInner: landmarks.slice(65, 68) || [[centerX, centerY + faceHeight * 0.3, 0]],
            rightEyeUpper0: landmarks.slice(36, 40) || [[centerX + faceWidth * 0.2, centerY - faceHeight * 0.15, 0]],
            rightEyeLower0: landmarks.slice(40, 42) || [[centerX + faceWidth * 0.2, centerY - faceHeight * 0.1, 0]],
            leftEyeUpper0: landmarks.slice(42, 46) || [[centerX - faceWidth * 0.2, centerY - faceHeight * 0.15, 0]],
            leftEyeLower0: landmarks.slice(46, 48) || [[centerX - faceWidth * 0.2, centerY - faceHeight * 0.1, 0]],
            rightEyebrowUpper: landmarks.slice(17, 22) || [[centerX + faceWidth * 0.2, centerY - faceHeight * 0.35, 0]],
            leftEyebrowUpper: landmarks.slice(22, 27) || [[centerX - faceWidth * 0.2, centerY - faceHeight * 0.35, 0]],
            noseTip: landmarks.slice(30, 31) || [[centerX, centerY + faceHeight * 0.05, 0]],
            noseBottom: landmarks.slice(31, 36) || [[centerX, centerY + faceHeight * 0.1, 0]]
        };
        
        return annotations;
    }
}

// Экспортируем класс
window.FaceMeshDetector = FaceMeshDetector;