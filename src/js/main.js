// === PITCH DETECTION ENGINE ===
class PitchDetectionEngine {
    constructor() {
        this.detector = null;
        this.audioContext = null;
        this.microphone = null;
        this.analyser = null;
        this.dataArray = null;
        this.isActive = false;
        this.sampleRate = 44100;
        this.bufferLength = 1024;
        this.onPitchCallback = null;
        console.log('🎵 PitchDetectionEngine: Инициализирован');
    }
    
    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferLength * 2;
            this.microphone.connect(this.analyser);
            this.dataArray = new Float32Array(this.analyser.fftSize);
            
            if (window.Pitchy) {
                this.detector = window.Pitchy.PitchDetector.forFloat32Array(this.analyser.fftSize);
                console.log('✅ PitchDetectionEngine: Инициализация завершена');
                return true;
            } else {
                console.error('❌ Pitchy библиотека не загружена');
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации PitchDetectionEngine:', error);
            return false;
        }
    }
    
    startDetection() {
        if (!this.detector) {return;}
        this.isActive = true;
        console.log('🎵 Запуск pitch detection...');
        this.detectPitch();
    }
    
    stopDetection() {
        this.isActive = false;
        console.log('⏹️ Остановка pitch detection');
    }
    
    detectPitch() {
        if (!this.isActive) {return;}
        
        this.analyser.getFloatTimeDomainData(this.dataArray);
        const [frequency, clarity] = this.detector.findPitch(this.dataArray, this.audioContext.sampleRate);
        
        if (clarity > 0.8 && frequency > 80 && frequency < 1000) {
            const midiNote = 12 * Math.log2(frequency / 440) + 69;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteNumber = Math.round(midiNote);
            const octave = Math.floor(noteNumber / 12) - 1;
            const noteIndex = noteNumber % 12;
            const noteName = `${noteNames[noteIndex]}${octave}`;
            
            const pitchData = {
                frequency: frequency.toFixed(2),
                midiNote: midiNote.toFixed(2),
                noteName: noteName,
                clarity: clarity.toFixed(3)
            };
            
            if (this.onPitchCallback) {
                this.onPitchCallback(pitchData);
            }
        }
        
        requestAnimationFrame(() => this.detectPitch());
    }
    
    onPitch(callback) {
        this.onPitchCallback = callback;
    }
}

// Создаем глобальный экземпляр
window.pitchEngine = new PitchDetectionEngine();

// ... existing code ... 
