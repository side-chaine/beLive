/**
 * Utilities Module - Вспомогательные функции для beLive
 */

class Utils {
    /**
     * Форматирует время в секундах в формат MM:SS
     */
    static formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) {return '0:00';}
        
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Дебаунс функции
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Проверяет является ли файл аудио
     */
    static isAudioFile(filename) {
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return audioExtensions.includes(ext);
    }

    /**
     * Проверяет является ли файл текстовым
     */
    static isTextFile(filename) {
        const textExtensions = ['.txt', '.rtf', '.lrc'];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return textExtensions.includes(ext);
    }

    /**
     * Генерирует уникальный ID
     */
    static generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Безопасное получение элемента по ID
     */
    static getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    }

    /**
     * Логирование с временной меткой
     */
    static log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] Utils:`;
        
        switch(level) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }
}

// Делаем Utils доступным глобально
window.Utils = Utils;

console.log('📦 Utils module loaded'); 