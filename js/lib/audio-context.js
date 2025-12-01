/**
 * Менеджер аудио контекста для системы beLive
 */

class AudioContextManager {
    constructor() {
        this.audioContext = null;
        this.isInitialized = false;
        this.isSupported = this.checkSupport();
    }
    
    checkSupport() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }
    
    async initialize() {
        if (this.isInitialized) {return this.audioContext;}
        
        if (!this.isSupported) {
            console.warn('AudioContext не поддерживается в этом браузере');
            return null;
        }
        
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioCtx();
            
            // Разблокируем аудио контекст если нужно
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isInitialized = true;
            console.log('✅ AudioContext инициализирован');
            return this.audioContext;
            
        } catch (error) {
            console.error('Ошибка инициализации AudioContext:', error);
            return null;
        }
    }
    
    getContext() {
        return this.audioContext;
    }
    
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
    
    suspend() {
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }
    
    close() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.isInitialized = false;
        }
    }
}

// Создаем глобальный экземпляр
window.audioContextManager = new AudioContextManager();

console.log('✅ AudioContextManager загружен'); 