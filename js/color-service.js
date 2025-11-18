/**
 * Сервис управления цветовыми схемами волн
 * Управляет цветами инструментальной и вокальной волн
 */
class ColorService {
    constructor() {
        // Предустановленные цветовые дуэты
        this.colorSchemes = [
            {
                id: 'classic',
                name: 'Classic Blue & Gold',
                instrumental: '#2196F3',
                vocals: '#FFD700'
            },
            {
                id: 'neon',
                name: 'Neon Cyber',
                instrumental: '#00FFFF',
                vocals: '#FF00FF'
            },
            {
                id: 'sunset',
                name: 'Sunset Vibes',
                instrumental: '#FF6B35',
                vocals: '#FFE66D',
                instrumentalAlpha: 0.8,
                vocalsAlpha: 0.6
            },
            {
                id: 'ocean',
                name: 'Ocean Deep',
                instrumental: '#0077BE',
                vocals: '#00CED1',
                instrumentalAlpha: 0.7,
                vocalsAlpha: 0.8
            },
            {
                id: 'forest',
                name: 'Forest Fire',
                instrumental: '#4CAF50',
                vocals: '#FF5722',
                instrumentalAlpha: 0.8,
                vocalsAlpha: 0.7
            },
            {
                id: 'royal',
                name: 'Royal Purple',
                instrumental: '#9C27B0',
                vocals: '#E91E63',
                instrumentalAlpha: 0.7,
                vocalsAlpha: 0.8
            },
            {
                id: 'mono',
                name: 'Monochrome',
                instrumental: '#607D8B',
                vocals: '#90A4AE',
                instrumentalAlpha: 0.8,
                vocalsAlpha: 0.8
            }
        ];

        // Текущая активная схема
        this.currentScheme = this.loadFromStorage() || this.colorSchemes[0];
        
        // Слушатели изменений
        this.listeners = [];
        
        // Применяем загруженную схему к CSS переменным
        this.applyCSSVariables();
    }

    /**
     * Получить все доступные цветовые схемы
     */
    getColorSchemes() {
        return this.colorSchemes;
    }

    /**
     * Получает текущую активную цветовую схему
     * @returns {Object} Текущая схема с настройками
     */
    getCurrentScheme() {
        return this.colorSchemes.find(scheme => scheme.id === this.currentScheme.id) || this.colorSchemes[0];
    }

    /**
     * Установить цветовую схему по ID
     */
    setColorScheme(schemeId) {
        const scheme = this.colorSchemes.find(s => s.id === schemeId);
        if (scheme) {
            this.currentScheme = scheme;
            this.saveToStorage();
            this.applyCSSVariables();
            this.notifyListeners();
            console.log(`🎨 Цветовая схема изменена на: ${scheme.name}`);
        }
    }

    /**
     * Получить цвет для указанного источника
     * @param {string} source - Источник ('instrumental' или 'vocals')
     * @returns {string} HEX цвет
     */
    getColor(source) {
        if (source === 'instrumental') {
            return this.currentScheme.instrumental;
        } else if (source === 'vocals') {
            return this.currentScheme.vocals;
        }
        return this.currentScheme.instrumental; // fallback
    }

    /**
     * Получить цвет инструментальной волны
     */
    getInstrumentalColor() {
        return this.currentScheme.instrumental;
    }

    /**
     * Получить цвет вокальной волны
     */
    getVocalsColor() {
        return this.currentScheme.vocals;
    }

    /**
     * Получить градиент для мастер кнопки
     */
    getMasterGradient() {
        return `linear-gradient(45deg, ${this.currentScheme.instrumental}, ${this.currentScheme.vocals})`;
    }

    /**
     * Применить цвета к CSS переменным
     */
    applyCSSVariables() {
        const root = document.documentElement;
        root.style.setProperty('--instrumental-color', this.currentScheme.instrumental);
        root.style.setProperty('--vocals-color', this.currentScheme.vocals);
        root.style.setProperty('--master-gradient', this.getMasterGradient());
    }

    /**
     * Добавить слушателя изменений цветовой схемы
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Удалить слушателя
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    /**
     * Уведомить всех слушателей об изменении
     */
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.currentScheme);
            } catch (error) {
                console.error('Ошибка в слушателе ColorService:', error);
            }
        });
    }

    /**
     * Сохранить в localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem('waveform-color-scheme', JSON.stringify({
                id: this.currentScheme.id,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Не удалось сохранить цветовую схему:', error);
        }
    }

    /**
     * Загрузить из localStorage
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('waveform-color-scheme');
            if (saved) {
                const data = JSON.parse(saved);
                return this.colorSchemes.find(s => s.id === data.id);
            }
        } catch (error) {
            console.warn('Не удалось загрузить цветовую схему:', error);
        }
        return null;
    }

    /**
     * Создать превью волны для схемы (для выпадающего меню)
     */
    createPreviewCanvas(scheme, width = 60, height = 30) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Простая волна для превью
        const points = 20;
        const instrumentalData = [];
        const vocalsData = [];
        
        // Генерируем примерные данные волн
        for (let i = 0; i < points; i++) {
            instrumentalData.push(Math.sin(i * 0.5) * 0.8 + Math.random() * 0.2);
            vocalsData.push(Math.sin(i * 0.3 + 1) * 0.6 + Math.random() * 0.3);
        }

        // Рисуем инструментальную волну
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = scheme.instrumental;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        
        for (let i = 0; i < points; i++) {
            const x = (i / points) * width;
            const y = height / 2 + instrumentalData[i] * (height / 4);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height / 2);
        ctx.closePath();
        ctx.fill();

        // Рисуем вокальную волну
        ctx.fillStyle = scheme.vocals;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        
        for (let i = 0; i < points; i++) {
            const x = (i / points) * width;
            const y = height / 2 + vocalsData[i] * (height / 4);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height / 2);
        ctx.closePath();
        ctx.fill();

        return canvas;
    }
}

// Глобальный экземпляр сервиса
window.colorService = new ColorService(); 