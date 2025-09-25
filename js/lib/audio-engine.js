/**
 * Аудио движок для системы beLive
 */

class SimpleAudioEngine {
    constructor() {
        this.audioContext = null;
        this.isInitialized = false;
        this.currentAudio = null;
        this.gainNode = null;
        this.isPlaying = false;
    }
    
    async initialize() {
        if (this.isInitialized) {return true;}
        
        try {
            if (window.audioContextManager) {
                this.audioContext = await window.audioContextManager.initialize();
            }
            
            if (this.audioContext) {
                this.gainNode = this.audioContext.createGain();
                this.gainNode.connect(this.audioContext.destination);
            }
            
            this.isInitialized = true;
            console.log('✅ SimpleAudioEngine инициализирован');
            return true;
            
        } catch (error) {
            console.error('Ошибка инициализации SimpleAudioEngine:', error);
            return false;
        }
    }
    
    loadAudio(src) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            
            audio.addEventListener('loadeddata', () => {
                this.currentAudio = audio;
                resolve(audio);
            });
            
            audio.addEventListener('error', (error) => {
                reject(error);
            });
            
            audio.src = src;
        });
    }
    
    play() {
        if (this.currentAudio) {
            this.currentAudio.play();
            this.isPlaying = true;
        }
    }
    
    pause() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.isPlaying = false;
        }
    }
    
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.isPlaying = false;
        }
    }
    
    setVolume(volume) {
        if (this.currentAudio) {
            this.currentAudio.volume = Math.max(0, Math.min(1, volume));
        }
    }
    
    getCurrentTime() {
        return this.currentAudio ? this.currentAudio.currentTime : 0;
    }
    
    getDuration() {
        return this.currentAudio ? this.currentAudio.duration : 0;
    }
    
    setCurrentTime(time) {
        if (this.currentAudio) {
            this.currentAudio.currentTime = time;
        }
    }
}

// Создаем глобальный экземпляр для совместимости
window.simpleAudioEngine = new SimpleAudioEngine();

console.log('✅ SimpleAudioEngine загружен'); 