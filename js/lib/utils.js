/**
 * Утилиты для системы beLive
 */

// Утилиты для работы с DOM
const DOMUtils = {
    createElement(tag, className = '', text = '') {
        const element = document.createElement(tag);
        if (className) {element.className = className;}
        if (text) {element.textContent = text;}
        return element;
    },
    
    addEventListeners(element, events) {
        Object.keys(events).forEach(event => {
            element.addEventListener(event, events[event]);
        });
    }
};

// Утилиты для работы с Canvas
const CanvasUtils = {
    drawPoints(ctx, points, color = '#00ff00', size = 2) {
        ctx.fillStyle = color;
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point[0], point[1], size, 0, 2 * Math.PI);
            ctx.fill();
        });
    },
    
    drawLines(ctx, points, color = '#00ff00', lineWidth = 1) {
        if (points.length < 2) {return;}
        
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.stroke();
    },
    
    drawBoundingBox(ctx, box, color = '#ff0000', lineWidth = 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
};

// Утилиты для работы с медиа
const MediaUtils = {
    async requestCamera(constraints = {}) {
        const defaultConstraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        };
        
        const finalConstraints = { ...defaultConstraints, ...constraints };
        
        try {
            return await navigator.mediaDevices.getUserMedia(finalConstraints);
        } catch (error) {
            console.error('Ошибка доступа к камере:', error);
            throw error;
        }
    },
    
    stopStream(stream) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
};

// Утилиты для производительности
const PerformanceUtils = {
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    },
    
    debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
};

// Экспорт утилит
window.DOMUtils = DOMUtils;
window.CanvasUtils = CanvasUtils;
window.MediaUtils = MediaUtils;
window.PerformanceUtils = PerformanceUtils;

console.log('✅ Utils: Утилиты загружены'); 