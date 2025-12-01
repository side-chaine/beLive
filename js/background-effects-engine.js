/**
 * 🎯 Background Effects Engine v2.0
 * Модуль для безопасной интеграции эффектов удаления фона в основное приложение
 * Исправлено зеркалирование и синхронизация
 */

class BackgroundEffectsEngine {
    constructor() {
        this.selfieSegmentation = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.currentEffect = 'none';
        this.frameCount = 0;
        
        // Настройки
        this.config = {
            modelSelection: 1,
            selfieMode: true,
            enableMirroring: true // Ключевая настройка для зеркалирования
        };
        
        console.log('🎯 Background Effects Engine v2.0 инициализирован');
    }
    
    /**
     * Инициализация MediaPipe Selfie Segmentation
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                console.log('⚠️ Background Effects Engine уже инициализирован');
                return true;
            }
            
            console.log('🔄 Инициализация Background Effects Engine...');
            
            // Проверяем доступность MediaPipe
            if (typeof SelfieSegmentation === 'undefined') {
                throw new Error('MediaPipe SelfieSegmentation не загружен');
            }
            
            // Создаем экземпляр Selfie Segmentation
            this.selfieSegmentation = new SelfieSegmentation({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
            });
            
            // Настраиваем опции
            await this.selfieSegmentation.setOptions(this.config);
            
            // Устанавливаем callback для результатов
            this.selfieSegmentation.onResults((results) => {
                this.processResults(results);
            });
            
            this.isInitialized = true;
            console.log('✅ Background Effects Engine готов');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации Background Effects Engine:', error);
            return false;
        }
    }
    
    /**
     * Установка целевого canvas для рендеринга
     */
    setTargetCanvas(canvas) {
        this.targetCanvas = canvas;
        this.targetCtx = canvas.getContext('2d', { willReadFrequently: true });
        console.log('🎨 Canvas цель установлена:', canvas.width + 'x' + canvas.height);
        
        // Настройка временного canvas для вычислений
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });
        
        // Настройка фоновых эффектов
        this.backgroundEffects = {
            blur: { enabled: false, intensity: 5 },
            particles: { enabled: false, count: 50 },
            gradient: { enabled: false, colors: ['#1a1a1a', '#333333'] },
            neon: { enabled: false, color: '#00ffff' }
        };
        
        console.log('🎨 BackgroundEffectsEngine инициализирован');
    }
    
    /**
     * Установка источника видео
     */
    setVideoSource(video) {
        this.videoElement = video;
        console.log('📹 Видео источник установлен');
    }
    
    /**
     * Обработка результатов от MediaPipe
     */
    processResults(results) {
        if (!this.targetCanvas || !this.targetCtx || !this.videoElement) {
            return;
        }
        
        try {
            // Очищаем canvas
            this.targetCtx.clearRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
            
            if (results.segmentationMask && this.currentEffect !== 'none') {
                const mask = results.segmentationMask;
                
                // Получаем данные маски с правильным зеркалированием
                const maskData = this.extractMaskData(mask);
                
                // Применяем эффект
                this.applyEffect(this.currentEffect, maskData);
            }
            
            // Логирование производительности
            this.frameCount++;
            if (this.frameCount % 60 === 0) {
                console.log(`🎯 Background Effects: Обработано ${this.frameCount} кадров (эффект: ${this.currentEffect})`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка обработки результатов Background Effects:', error);
        }
    }
    
    /**
     * Извлечение данных маски с правильным зеркалированием
     */
    extractMaskData(mask) {
        // Создаем временный canvas для обработки маски
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.targetCanvas.width;
        tempCanvas.height = this.targetCanvas.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        if (this.config.enableMirroring) {
            // КРИТИЧЕСКИ ВАЖНО: Зеркалируем маску для соответствия CSS-зеркалированному видео
            tempCtx.save();
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(mask, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.restore();
        } else {
            // Без зеркалирования (для случаев когда видео не зеркалировано)
            tempCtx.drawImage(mask, 0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        // Получаем данные пикселей
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        return imageData.data;
    }
    
    /**
     * Применение конкретного эффекта
     */
    applyEffect(effect, maskData) {
        switch (effect) {
            case 'blur':
                this.applyBlurEffect(maskData);
                break;
            case 'green':
                this.applyColorEffect(maskData, '#00FF00');
                break;
            case 'blue':
                this.applyColorEffect(maskData, '#0000FF');
                break;
            case 'gradient':
                this.applyGradientEffect(maskData);
                break;
            case 'matrix':
                this.applyMatrixEffect(maskData);
                break;
            case 'neon':
                this.applyNeonEffect(maskData);
                break;
            default:
                console.warn(`⚠️ Неизвестный эффект: ${effect}`);
        }
    }
    
    /**
     * Эффект размытого фона
     */
    applyBlurEffect(maskData) {
        const ctx = this.targetCtx;
        const canvas = this.targetCanvas;
        
        // Создаем размытый фон
        ctx.save();
        ctx.filter = 'blur(15px)';
        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
        ctx.restore();
        
        // Накладываем человека
        this.overlayPerson(maskData);
    }
    
    /**
     * Эффект цветного фона
     */
    applyColorEffect(maskData, color) {
        const ctx = this.targetCtx;
        const canvas = this.targetCanvas;
        
        // Заливаем фон цветом
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Накладываем человека
        this.overlayPerson(maskData);
    }
    
    /**
     * Эффект градиентного фона
     */
    applyGradientEffect(maskData) {
        const ctx = this.targetCtx;
        const canvas = this.targetCanvas;
        
        // Создаем градиент
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#FF0080');
        gradient.addColorStop(0.5, '#7928CA');
        gradient.addColorStop(1, '#FF8A80');
        
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Накладываем человека
        this.overlayPerson(maskData);
    }
    
    /**
     * Эффект Matrix
     */
    applyMatrixEffect(maskData) {
        const ctx = this.targetCtx;
        const canvas = this.targetCanvas;
        
        // Черный фон
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Зеленые символы
        ctx.fillStyle = '#00FF41';
        ctx.font = '14px monospace';
        const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
        for (let i = 0; i < 80; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(char, x, y);
        }
        ctx.restore();
        
        // Накладываем человека
        this.overlayPerson(maskData);
    }
    
    /**
     * Неоновый эффект
     */
    applyNeonEffect(maskData) {
        const ctx = this.targetCtx;
        const canvas = this.targetCanvas;
        
        // Радиальный градиент
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
        );
        gradient.addColorStop(0, '#FF00FF');
        gradient.addColorStop(0.5, '#00FFFF');
        gradient.addColorStop(1, '#000033');
        
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Накладываем человека
        this.overlayPerson(maskData);
    }
    
    /**
     * Наложение человека на фон
     */
    overlayPerson(maskData) {
        const canvas = this.targetCanvas;
        const ctx = this.targetCtx;
        
        // Создаем временный canvas для человека
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        // Рисуем видео без дополнительного зеркалирования
        tempCtx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        
        // Применяем маску
        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < maskData.length; i += 4) {
            const alpha = maskData[i] > 128 ? imageData.data[i + 3] : 0;
            imageData.data[i + 3] = alpha;
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        // Накладываем результат на основной canvas
        ctx.drawImage(tempCanvas, 0, 0);
    }
    
    /**
     * Изменение текущего эффекта
     */
    setEffect(effect) {
        this.currentEffect = effect;
        console.log(`🎨 Эффект изменен на: ${effect}`);
    }
    
    /**
     * Запуск обработки кадров
     */
    async startProcessing() {
        if (!this.isInitialized) {
            console.error('❌ Engine не инициализирован');
            return false;
        }
        
        if (!this.videoElement) {
            console.error('❌ Видео источник не установлен');
            return false;
        }
        
        this.isProcessing = true;
        this.processFrame();
        console.log('▶️ Обработка кадров запущена');
        return true;
    }
    
    /**
     * Остановка обработки кадров
     */
    stopProcessing() {
        this.isProcessing = false;
        console.log('⏹️ Обработка кадров остановлена');
    }
    
    /**
     * Обработка одного кадра
     */
    async processFrame() {
        if (!this.isProcessing || !this.selfieSegmentation || !this.videoElement) {
            return;
        }
        
        try {
            await this.selfieSegmentation.send({ image: this.videoElement });
        } catch (error) {
            console.error('❌ Ошибка обработки кадра:', error);
        }
        
        if (this.isProcessing) {
            requestAnimationFrame(() => this.processFrame());
        }
    }
    
    /**
     * Включение/выключение зеркалирования
     */
    setMirroring(enabled) {
        this.config.enableMirroring = enabled;
        console.log(`🪞 Зеркалирование: ${enabled ? 'включено' : 'выключено'}`);
    }
    
    /**
     * Проверка состояния
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            processing: this.isProcessing,
            currentEffect: this.currentEffect,
            frameCount: this.frameCount,
            mirroring: this.config.enableMirroring
        };
    }
    
    /**
     * Очистка ресурсов
     */
    dispose() {
        this.stopProcessing();
        this.selfieSegmentation = null;
        this.isInitialized = false;
        console.log('🗑️ Background Effects Engine очищен');
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackgroundEffectsEngine;
} else if (typeof window !== 'undefined') {
    window.BackgroundEffectsEngine = BackgroundEffectsEngine;
} 