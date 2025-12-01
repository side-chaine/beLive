/**
 * VideoProcessor - Обработчик видео с отслеживанием лица
 * Показывает реальные точки лица в реальном времени
 */
class VideoProcessor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.video = null;
        this.faceDetector = null;
        this.isProcessing = false;
        this.animationId = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
        
        // Настройки отображения
        this.showFacePoints = true;
        this.showBoundingBox = true;
        this.facePointColor = '#00ff00';
        this.boundingBoxColor = '#ff0000';
        this.pointSize = 2;
        
        console.log('🎥 VideoProcessor: Инициализирован');
    }
    
    /**
     * Инициализация процессора
     */
    initialize(video, canvas) {
        this.video = video;
        this.canvas = canvas;
        
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 640;
            this.canvas.height = 480;
            console.log('VideoProcessor: Canvas dimensions set to 640x480');
        }
        
        // Создаем overlay canvas для отображения точек лица
        this.createOverlayCanvas();
        
        return this;
    }
    
    /**
     * Создание overlay canvas для отображения точек лица
     */
    createOverlayCanvas() {
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.width = 640;
        this.overlayCanvas.height = 480;
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCanvas.style.zIndex = '10';
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        // Добавляем overlay к родительскому элементу canvas
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.style.position = 'relative';
            this.canvas.parentNode.appendChild(this.overlayCanvas);
        }
        
        console.log('🎥 VideoProcessor: Overlay canvas создан для отображения точек лица');
    }
    
    /**
     * Установка детектора лица
     */
    setFaceDetector(detector) {
        this.faceDetector = detector;
        console.log('VideoProcessor: Face detector set');
    }
    
    /**
     * Запуск обработки видео
     */
    startProcessing() {
        if (this.isProcessing) {return;}
        
        this.isProcessing = true;
        console.log('🎥 VideoProcessor: Запуск обработки видео');
        this.processFrame();
    }
    
    /**
     * Остановка обработки видео
     */
    stopProcessing() {
        this.isProcessing = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Очищаем overlay
        if (this.overlayCtx) {
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }
        
        console.log('🎥 VideoProcessor: Обработка остановлена');
    }
    
    /**
     * Обработка кадра
     */
    async processFrame() {
        if (!this.isProcessing || !this.video || !this.ctx) {
            return;
        }
        
        try {
            // Отображаем видео на canvas
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Обнаружение лица и отображение точек
            if (this.faceDetector) {
                await this.detectAndDrawFace();
            }
            
        } catch (error) {
            console.warn('Ошибка обработки кадра:', error);
        }
        
        // Планируем следующий кадр
        if (this.isProcessing) {
            this.animationId = requestAnimationFrame(() => this.processFrame());
        }
    }
    
    /**
     * Обнаружение лица и отображение точек
     */
    async detectAndDrawFace() {
        try {
            const faces = await this.faceDetector.detectFaces(this.video, true);
            
            // Очищаем overlay
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            
            if (faces && faces.length > 0) {
                const face = faces[0];
                
                // Отображаем bounding box
                if (this.showBoundingBox && face.boundingBox) {
                    this.drawBoundingBox(face.boundingBox);
                }
                
                // Отображаем точки лица
                if (this.showFacePoints && face.landmarks) {
                    this.drawFacePoints(face.landmarks);
                    console.log(`🎭 VideoProcessor: Отрисовано ${face.landmarks.length} точек лица`);
                }
                
                // Отображаем ключевые точки (глаза, нос, рот)
                if (face.annotations) {
                    this.drawKeyPoints(face.annotations);
                }
            }
            
        } catch (error) {
            console.warn('Ошибка детектирования лица:', error);
        }
    }
    
    /**
     * Отображение точек лица
     */
    drawFacePoints(landmarks) {
        if (!landmarks || !Array.isArray(landmarks)) {return;}
        
        this.overlayCtx.fillStyle = this.facePointColor;
        
        landmarks.forEach(point => {
            if (Array.isArray(point) && point.length >= 2) {
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(point[0], point[1], this.pointSize, 0, 2 * Math.PI);
                this.overlayCtx.fill();
            }
        });
    }
    
    /**
     * Отображение bounding box
     */
    drawBoundingBox(boundingBox) {
        this.overlayCtx.strokeStyle = this.boundingBoxColor;
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.strokeRect(
            boundingBox.x, 
            boundingBox.y, 
            boundingBox.width, 
            boundingBox.height
        );
    }
    
    /**
     * Отображение ключевых точек (глаза, нос, рот)
     */
    drawKeyPoints(annotations) {
        // Глаза - синие точки
        this.overlayCtx.fillStyle = '#0066ff';
        if (annotations.leftEye) {
            annotations.leftEye.forEach(point => {
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
                this.overlayCtx.fill();
            });
        }
        
        if (annotations.rightEye) {
            annotations.rightEye.forEach(point => {
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
                this.overlayCtx.fill();
            });
        }
        
        // Нос - желтые точки
        this.overlayCtx.fillStyle = '#ffff00';
        if (annotations.noseTip) {
            annotations.noseTip.forEach(point => {
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(point[0], point[1], 3, 0, 2 * Math.PI);
                this.overlayCtx.fill();
            });
        }
        
        // Рот - розовые точки
        this.overlayCtx.fillStyle = '#ff69b4';
        if (annotations.lipsUpperOuter) {
            annotations.lipsUpperOuter.forEach(point => {
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(point[0], point[1], 3, 0, 2 * Math.PI);
                this.overlayCtx.fill();
            });
        }
    }
    
    /**
     * Применение фильтра к видео
     */
    applyFilter(filterName, value = 1) {
        if (!this.canvas) {return;}
        
        const filters = {
            blur: `blur(${value}px)`,
            brightness: `brightness(${value})`,
            contrast: `contrast(${value})`,
            grayscale: `grayscale(${value})`,
            sepia: `sepia(${value})`,
            saturate: `saturate(${value})`,
            invert: `invert(${value})`,
            'hue-rotate': `hue-rotate(${value}deg)`
        };
        
        if (filters[filterName]) {
            this.canvas.style.filter = filters[filterName];
        }
    }
    
    /**
     * Очистка всех фильтров
     */
    clearFilters() {
        if (this.canvas) {
            this.canvas.style.filter = 'none';
        }
    }
    
    /**
     * Настройка отображения
     */
    updateSettings(settings) {
        if (settings.showFacePoints !== undefined) {
            this.showFacePoints = settings.showFacePoints;
        }
        if (settings.showBoundingBox !== undefined) {
            this.showBoundingBox = settings.showBoundingBox;
        }
        if (settings.facePointColor) {
            this.facePointColor = settings.facePointColor;
        }
        if (settings.boundingBoxColor) {
            this.boundingBoxColor = settings.boundingBoxColor;
        }
        if (settings.pointSize) {
            this.pointSize = settings.pointSize;
        }
        
        console.log('🎥 VideoProcessor: Настройки обновлены');
    }
    
    /**
     * Освобождение ресурсов
     */
    dispose() {
        this.stopProcessing();
        
        if (this.overlayCanvas && this.overlayCanvas.parentNode) {
            this.overlayCanvas.parentNode.removeChild(this.overlayCanvas);
        }
        
        this.canvas = null;
        this.ctx = null;
        this.video = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
        
        console.log('🎥 VideoProcessor: Ресурсы освобождены');
    }
}

// Экспорт класса
window.VideoProcessor = VideoProcessor; 

console.log('✅ VideoProcessor: Загружен с поддержкой отслеживания лица'); 