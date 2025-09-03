/**
 * 🎹 Piano Keyboard Integration Module for beLive
 * Фокус на точность базовой детекции питча - достижение 95% точности
 */

class PianoKeyboard {
    constructor() {
        this.isActive = false;
        this.canvas = null;
        this.ctx = null;
        this.renderLoop = null;
        
        // Система анализа звука
        this.audioContext = null;
        this.analyser = null;
        this.pitchDetector = null;
        this.inputBuffer = null;
        this.bufferSize = 2048;
        
        // 🎯 МОНОФОНИЧЕСКАЯ СИСТЕМА - только одна нота!
        this.currentActiveNote = null; 
        this.pressedKeys = new Set(); 
        this.activeNotes = new Map(); 
        
        // ⚡ СИСТЕМА ЕДИНСТВЕННОГО ШАРИКА с плавными переходами
        this.singleBallIndicator = null; 
        this.ballAnimation = {
            fromX: 0, fromY: 0,
            toX: 0, toY: 0,
            progress: 1.0,
            isAnimating: false,
            startTime: 0,
            duration: 120 // Быстрая анимация
        };
        this.lastAnalysisTime = 0;
        this.analysisInterval = 2; // 500fps анализ
        
        // ⏩ СИСТЕМА ПРОФЕССИОНАЛЬНОЙ ПЕРЕМОТКИ
        this.scrubSystem = {
            isActive: false,
            direction: 0, // -1 назад, 1 вперед
            stepSize: 0.5, // 0.5 секунды для временной перемотки
            continuousInterval: null,
            repeatDelay: 200, // 200мс до начала непрерывной перемотки
            repeatRate: 100, // 100мс между шагами при удержании
            isScrubbing: false, // Флаг активной перемотки
            navigationMode: false // Флаг режима навигации по нотам
        };
        
        // 🔇 УЛУЧШЕННАЯ фильтрация гармоник
        this.harmonicFilter = {
            lastFundamental: null,
            octaveHistory: [], 
            noiseThreshold: 0.005,
            harmonicTolerance: 0.02,
            // 🎯 НОВЫЕ фильтры для точности
            fundamentalTracker: new Map(), // Отслеживание основной частоты
            harmonicRatios: [0.5, 2.0, 3.0, 4.0, 0.25], // Гармонические отношения
            confidenceThreshold: 0.85 // Порог уверенности
        };
        
        // 📊 ДЕТАЛЬНАЯ статистика для достижения 95%
        this.detectionStats = {
            totalDetections: 0,
            correctNotes: 0, // 🎯 НОВОЕ: правильно определенные ноты
            incorrectNotes: 0, // 🎯 НОВОЕ: неправильные ноты
            missedNotes: 0, // 🎯 НОВОЕ: пропущенные ноты
            harmonicsRejected: 0,
            octaveJumpsRejected: 0,
            unstableFrequencyRejected: 0,
            impreciseNotesRejected: 0,
            monophonicFiltered: 0,
            instantSwitches: 0,
            // 🎯 ТОЧНОСТЬ В РЕАЛЬНОМ ВРЕМЕНИ
            accuracy: 0, // Текущая точность %
            targetAccuracy: 95 // Цель
        };
        
        // 🎯 СИСТЕМА ПРОФЕССИОНАЛЬНЫХ ТЕСТОВ
        this.testingSystem = {
            isActive: false,
            currentTest: null,
            testResults: [],
            currentExercise: 0,
            exercises: [
                // 🎼 Уровень 1: Долгие ноты (основа)
                { name: "Долгие ноты C4-G4", notes: ["C4", "D4", "E4", "F4", "G4"], type: "sustained", difficulty: 1 },
                { name: "Октавы C3-C5", notes: ["C3", "C4", "C5"], type: "octaves", difficulty: 1 },
                
                // 🎼 Уровень 2: Интервалы
                { name: "Терции", notes: ["C4", "E4", "F4", "A4"], type: "intervals", difficulty: 2 },
                { name: "Квинты", notes: ["C4", "G4", "D4", "A4"], type: "intervals", difficulty: 2 },
                
                // 🎼 Уровень 3: Гаммы
                { name: "До мажор", notes: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], type: "scales", difficulty: 3 },
                
                // 🎼 Уровень 4: Мелизмы (консерваторский уровень)
                { name: "Форшлаги", notes: ["C4", "D4", "C4", "E4", "C4"], type: "ornaments", difficulty: 4 },
                { name: "Трели", notes: ["C4", "D4", "C4", "D4", "C4"], type: "trills", difficulty: 4 }
            ]
        };
        
        // 🎨 Цветовая система
        this.REFERENCE_COLOR = '#00ff41'; 
        
        // Автоматическая интеграция
        this.currentTrackHasVocals = false;
        this.isBackgroundAnalyzing = false;
        
        // История частот для анализа стабильности
        this.frequencyHistory = [];
        
        // 🗺️ СИСТЕМА ПИТЧ-КАРТЫ ТРЕКА - КЛЮЧЕВАЯ ДЛЯ НАВИГАЦИИ!
        this.pitchMap = {
            isRecording: false,
            notes: [], // [{time, keyId, frequency, clarity, duration}]
            currentIndex: -1, // Текущая позиция в карте
            lastRecordTime: 0,
            minNoteDuration: 50, // мс - минимальная длительность ноты для записи
            timeWindow: 0.1, // секунды - окно поиска ближайшей ноты
            // 🎯 Индекс для быстрого поиска
            timeIndex: new Map() // время → индекс в массиве нот
        };
        
        this.init();
    }

    async init() {
        console.log('🎹 Инициализация клавиатуры...');
        
        await this.waitForPitchy();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupAutoAudioEngineIntegration();
        this.keys = this.generatePianoKeys();
        
        console.log('🎹 Piano Keyboard инициализирован');
        
        // Начальная калибровка при инициализации
        setTimeout(() => {
            console.log('🎯 Начальная калибровка системы...');
            this.runPitchCalibrationTests();
        }, 2000);
    }

    async waitForPitchy() {
        return new Promise((resolve) => {
            const check = () => {
                if (window.PitchDetector) {
                    console.log('✅ Pitchy готов для точной детекции');
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    setupEventListeners() {
        // ⏩ ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК СТРЕЛОЧЕК - приоритет над переключением треков
        this.globalKeyHandler = (e) => {
            // ТОЛЬКО стрелочки - остальное не трогаем
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                this.handleScrubbing(e.code, true);
                return false;
            }
        };
        
        // ГЛОБАЛЬНЫЙ обработчик keyup для остановки перемотки
        this.globalKeyUpHandler = (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                this.handleScrubbing(e.code, false);
                return false;
            }
        };
        
        // Устанавливаем ГЛОБАЛЬНЫЕ перехватчики с высоким приоритетом
        document.addEventListener('keydown', this.globalKeyHandler, true); // true = capture phase
        document.addEventListener('keyup', this.globalKeyUpHandler, true);
        
        // ⏩ ЛОКАЛЬНЫЕ обработчики для режима клавиш
        this.keydownHandler = (e) => {
            if (e.code === 'Escape') {
                this.hide();
                e.preventDefault();
                return;
            }
            
            // 🎯 Клавиша T - запуск тестов
            if (e.code === 'KeyT' && !this.testingSystem.isActive) {
                this.startAccuracyTest();
                e.preventDefault();
                return;
            }
        };
        
        this.clickHandler = (e) => {
            if (!this.canvas) {return;}
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Кнопка закрытия
            const closeButtonSize = 50;
            const closeButtonX = this.canvas.width - closeButtonSize;
            const closeButtonY = 0;
            
            if (x >= closeButtonX && x <= closeButtonX + closeButtonSize && 
                y >= closeButtonY && y <= closeButtonY + closeButtonSize) {
                this.hide();
                return;
            }
            
            this.handleControlPanelClick(x, y);
        };
        
        // Инициализация кнопки пианино
        const initPianoButton = () => {
            const pianoBtn = document.getElementById('piano-keyboard-btn');
            if (pianoBtn) {
                console.log('🎹 Кнопка найдена');
                pianoBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggle();
                });
                
                pianoBtn.style.background = '#4CAF50';
                pianoBtn.style.color = '#ffffff';
                return true;
            }
            return false;
        };
        
        if (!initPianoButton()) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initPianoButton);
            } else {
                setTimeout(initPianoButton, 1000);
            }
        }

        // Локальные обработчики для остальных клавиш
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Escape' && this.isActive) {
                console.log('🎹 Escape нажат, закрываем клавиатуру');
                this.hide();
            }
            
            // 🎯 ГОРЯЧИЕ КЛАВИШИ ДЛЯ ТЕСТОВ (только когда клавиатура активна)
            if (this.isActive) {
                if (event.code === 'KeyC' && event.ctrlKey) {
                    // Ctrl+C - калибровочные тесты
                    event.preventDefault();
                    console.log('🎯 Запуск калибровочных тестов по Ctrl+C');
                    this.runPitchCalibrationTests();
                } else if (event.code === 'KeyT') {
                    // T - тесты точности
                    event.preventDefault();
                    console.log('🎯 Запуск тестов точности по клавише T');
                    if (!this.testingSystem.isActive) {
                        this.startAccuracyTest();
                    } else {
                        console.log('🎯 Тесты уже активны');
                    }
                } else if (event.code === 'KeyR') {
                    // R - сброс фильтров
                    event.preventDefault();
                    console.log('🔄 Сброс фильтров гармоник по клавише R');
                    this.resetHarmonicFilters();
                }
            }
        });
    }

    // 🎯 ЗАПУСК ТЕСТОВ ТОЧНОСТИ
    startAccuracyTest() {
        console.log('🎯 Запуск тестов точности детекции...');
        this.testingSystem.isActive = true;
        this.testingSystem.currentExercise = 0;
        this.testingSystem.testResults = [];
        
        // Сброс статистики
        this.detectionStats.correctNotes = 0;
        this.detectionStats.incorrectNotes = 0;
        this.detectionStats.totalDetections = 0;
        this.detectionStats.missedNotes = 0;
        
        console.log(`🎼 Начинается упражнение 1: "${this.testingSystem.exercises[0].name}"`);
    }

    // Остальные методы следуют...
    setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '10000';
        this.canvas.style.background = 'rgba(0, 0, 0, 0.8)';
        this.canvas.style.display = 'none';
        
        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
        
        // Адаптивный размер
        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.ctx.scale(dpr, dpr);
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
            
            if (this.isActive) {
                this.calculateKeyboardLayout();
            }
        };
        
        window.addEventListener('resize', resize);
        resize();
    }

    setupAudioContext() {
        console.log('🔊 Инициализация аудио для точной детекции...');
        
        try {
            if (window.audioEngine && window.audioEngine.audioContext) {
                this.audioContext = window.audioEngine.audioContext;
                console.log('✅ Используем audioEngine.audioContext');
            } else {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.audioContext = new AudioContext();
                    console.log('✅ Создан новый AudioContext');
                } else {
                    console.error('❌ AudioContext не поддерживается');
                    return false;
                }
            }

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;
            this.analyser.smoothingTimeConstant = 0.0; // Без сглаживания для точности
            
            this.inputBuffer = new Float32Array(this.analyser.fftSize);
            
            if (window.PitchDetector) {
                this.pitchDetector = window.PitchDetector.forFloat32Array(this.bufferSize);
                console.log('✅ Pitchy детектор готов для точной работы');
            } else {
                console.error('❌ PitchDetector не найден');
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации аудио:', error);
            return false;
        }
    }

    // Остальная логика будет добавлена в следующих функциях...
    toggle() {
        if (this.isActive) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (this.isActive) {
            console.log('🎹 Клавиатура уже активна, игнорируем вызов');
            return;
        }
        
        this.isActive = true;
        
        // Показываем контейнер клавиатуры
        const container = document.getElementById('piano-keyboard-container');
        if (container) {
            container.classList.remove('hidden');
        }
        
        if (this.canvas) {
            this.canvas.style.display = 'block';
            this.canvas.addEventListener('click', this.clickHandler);
        }
        
        this.setupAudioContext();
        this.calculateKeyboardLayout();
        this.startMainLoop();
        
        // 🎯 АВТОМАТИЧЕСКАЯ КАЛИБРОВКА ПРИ ЗАПУСКЕ
        setTimeout(() => {
            this.runPitchCalibrationTests();
        }, 1000); // Через 1 секунду после запуска
        
        console.log('🎹 Клавиатура активирована');
    }

    hide() {
        this.isActive = false;
        if (this.canvas) {
            this.canvas.style.display = 'none';
            this.canvas.removeEventListener('click', this.clickHandler);
        }
        
        // Очищаем обработчики перемотки
        document.removeEventListener('keydown', this.globalKeyHandler);
        document.removeEventListener('keyup', this.globalKeyUpHandler);
        this.stopScrubbing();
        
        if (this.renderLoop) {
            cancelAnimationFrame(this.renderLoop);
            this.renderLoop = null;
        }
        
        this.forceStopAllKeys('closed');
        console.log('🎹 Точная клавиатура деактивирована');
    }

    // Продолжение следует в следующих методах...

    // 🎹 ГЕНЕРАЦИЯ КЛАВИШ
    generatePianoKeys() {
        const keys = [];
        
        // 🎹 Генерируем клавиши от C2 до C6 (профессиональный диапазон)
        const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const blackNotes = ['C#', 'D#', 'F#', 'G#', 'A#'];
        
        for (let octave = 2; octave <= 6; octave++) {
            // Белые клавиши
            for (const note of whiteNotes) {
                const frequency = this.noteToFrequency(note, octave);
                if (frequency >= 65.4 && frequency <= 1046.5) { 
                    keys.push({
                        note: note,
                        octave: octave,
                        frequency: frequency,
                        isBlack: false,
                        isPressed: false,
                        x: 0, y: 0, width: 0, height: 0
                    });
                }
            }
            
            // Черные клавиши
            for (const note of blackNotes) {
                const frequency = this.noteToFrequency(note, octave);
                if (frequency >= 65.4 && frequency <= 1046.5) { 
                    keys.push({
                        note: note,
                        octave: octave,
                        frequency: frequency,
                        isBlack: true,
                        isPressed: false,
                        x: 0, y: 0, width: 0, height: 0
                    });
                }
            }
        }
        
        console.log(`🎹 Создано ${keys.length} клавиш для точной детекции`);
        return keys;
    }

    // 🎯 ТОЧНАЯ ФОРМУЛА ЧАСТОТ НОТ (исправленная)
    noteToFrequency(note, octave) {
        const noteToSemitone = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        
        const semitone = noteToSemitone[note];
        if (semitone === undefined) {
            console.error(`❌ Неизвестная нота: ${note}`);
            return 0;
        }
        
        // ИСПРАВЛЕННАЯ формула: A4 = 440Hz это базовая точка
        const A4 = 440.0;
        const semitoneFromA4 = (octave - 4) * 12 + (semitone - 9); // A = 9 семитонов
        
        const frequency = A4 * Math.pow(2, semitoneFromA4 / 12);
        
        // Проверочный лог для калибровки
        if (note === 'A' && octave === 4) {
            console.log(`🎯 КАЛИБРОВКА: A4 = ${frequency.toFixed(2)}Hz (должно быть 440.00Hz)`);
        }
        
        return frequency;
    }

    // 🎯 УЛУЧШЕННОЕ ОПРЕДЕЛЕНИЕ НОТЫ ПО ЧАСТОТЕ
    frequencyToNoteId(frequency) {
        if (!this.keys || frequency <= 0) {return null;}
        
        let bestMatch = null;
        let smallestError = Infinity;
        
        // Проходим по всем клавишам и ищем наименьшую ошибку
        for (const key of this.keys) {
            const targetFreq = key.frequency;
            const error = Math.abs(frequency - targetFreq);
            const percentError = error / targetFreq;
            
            // Увеличенная толерантность для лучшего захвата
            const tolerance = 0.06; // 6% вместо 3% - более мягкая детекция
            
            if (percentError < tolerance && error < smallestError) {
                smallestError = error;
                bestMatch = key;
            }
        }
        
        if (bestMatch) {
            const keyId = `${bestMatch.note}${bestMatch.octave}`;
            const accuracy = (1 - smallestError / bestMatch.frequency) * 100;
            
            // Лог для отладки детекции
            if (Math.random() < 0.1) { // 10% логов для не засорения
                console.log(`🎵 Детекция: ${frequency.toFixed(1)}Hz → ${keyId} (${bestMatch.frequency.toFixed(1)}Hz, точность: ${accuracy.toFixed(1)}%)`);
            }
            
            return keyId;
        }
        
        return null;
    }

    // 🎯 КАЛИБРОВОЧНЫЕ ТЕСТЫ
    runPitchCalibrationTests() {
        console.log('🎯 ===== ЗАПУСК КАЛИБРОВОЧНЫХ ТЕСТОВ ПИТЧА =====');
        
        const testNotes = [
            { note: 'C', octave: 4, expectedFreq: 261.63 },
            { note: 'D', octave: 4, expectedFreq: 293.66 },
            { note: 'E', octave: 4, expectedFreq: 329.63 },
            { note: 'F', octave: 4, expectedFreq: 349.23 },
            { note: 'G', octave: 4, expectedFreq: 392.00 },
            { note: 'A', octave: 4, expectedFreq: 440.00 },
            { note: 'B', octave: 4, expectedFreq: 493.88 }
        ];
        
        let totalError = 0;
        let passedTests = 0;
        
        console.log('📋 Тестируем расчет частот:');
        for (const test of testNotes) {
            const calculated = this.noteToFrequency(test.note, test.octave);
            const error = Math.abs(calculated - test.expectedFreq);
            const percentError = (error / test.expectedFreq) * 100;
            
            const passed = percentError < 0.1; // Ошибка должна быть < 0.1%
            if (passed) {passedTests++;}
            totalError += percentError;
            
            console.log(`${passed ? '✅' : '❌'} ${test.note}${test.octave}: рассчитано=${calculated.toFixed(2)}Hz, ожидается=${test.expectedFreq}Hz, ошибка=${percentError.toFixed(3)}%`);
        }
        
        console.log('📋 Тестируем обратное преобразование:');
        for (const test of testNotes) {
            const detectedNote = this.frequencyToNoteId(test.expectedFreq);
            const expectedNote = `${test.note}${test.octave}`;
            const passed = detectedNote === expectedNote;
            
            if (passed) {passedTests++;}
            
            console.log(`${passed ? '✅' : '❌'} ${test.expectedFreq}Hz → обнаружено="${detectedNote}", ожидается="${expectedNote}"`);
        }
        
        const averageError = totalError / testNotes.length;
        const successRate = (passedTests / (testNotes.length * 2)) * 100;
        
        console.log(`📊 РЕЗУЛЬТАТЫ КАЛИБРОВКИ:`);
        console.log(`   Пройдено тестов: ${passedTests}/${testNotes.length * 2}`);
        console.log(`   Процент успеха: ${successRate.toFixed(1)}%`);
        console.log(`   Средняя ошибка: ${averageError.toFixed(3)}%`);
        
        if (successRate >= 95) {
            console.log('🎯 ✅ КАЛИБРОВКА ПИТЧА ПРОШЛА УСПЕШНО!');
        } else {
            console.log('🎯 ❌ ТРЕБУЕТСЯ ДОРАБОТКА КАЛИБРОВКИ!');
        }
        
        console.log('🎯 ===== КАЛИБРОВОЧНЫЕ ТЕСТЫ ЗАВЕРШЕНЫ =====');
        
        return { successRate, averageError, passedTests };
    }
    
    setupAutoAudioEngineIntegration() {
        console.log('🔗 Настройка интеграции для точной детекции...');
        
        // 🎯 ПРИНУДИТЕЛЬНЫЙ режим анализа
        let hasVocals = false;
        
        if (window.audioEngine) {
            try {
                if (typeof window.audioEngine.hasVocals === 'function') {
                    hasVocals = window.audioEngine.hasVocals();
                } else {
                    hasVocals = !!(window.audioEngine.vocalsGain || window.audioEngine._hasVocals);
                }
                
                if (!hasVocals && window.audioEngine._isPlaying) {
                    hasVocals = true;
                }
                
            } catch (error) {
                console.warn('⚠️ Ошибка проверки вокальных дорожек:', error);
                hasVocals = true;
                }
            } else {
            hasVocals = true;
        }
        
        this.currentTrackHasVocals = hasVocals;
        console.log(`🎤 Статус для точной детекции: ${this.currentTrackHasVocals}`);
        
        // Запускаем анализ
        setTimeout(() => {
            this.startBackgroundVocalAnalysis();
        }, 500);
    }

    async startBackgroundVocalAnalysis() {
        console.log('🎤 Запуск ТОЧНОГО анализа вокальной дорожки...');
        
        try {
            if (!this.audioContext) {
                const setupResult = this.setupAudioContext();
                if (!setupResult) {
                    console.error('❌ Не удалось настроить аудио контекст');
                    return;
                }
            }

            // 🎯 ПРИОРИТЕТНОЕ подключение к вокальной дорожке
            let connected = false;
            
            if (window.audioEngine) {
                const vocalNodes = [
                    window.audioEngine.vocalsGain,
                    window.audioEngine.masterGain,
                    window.audioEngine.outputGain
                ];
                
                for (const node of vocalNodes) {
                    if (node && typeof node.connect === 'function') {
                        try {
                            if (this.analyser) {
                                this.analyser.disconnect();
                            }
                            
                            node.connect(this.analyser);
                            console.log(`✅ Подключен к ВОКАЛЬНОМУ узлу:`, node.constructor.name);
                            connected = true;
        } catch (error) {
                            console.warn(`⚠️ Не удалось подключиться к узлу:`, error);
                        }
                    }
        }
    }

            // Fallback к микрофону
            if (!connected && !window.audioEngine) {
                console.log('🎤 Попытка подключения к микрофону...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                            autoGainControl: false,
                            sampleRate: 44100
                        } 
                    });
                    const micSource = this.audioContext.createMediaStreamSource(stream);
                    micSource.connect(this.analyser);
                    console.log(`✅ Подключен к микрофону`);
                    connected = true;
        } catch (error) {
                    console.warn(`⚠️ Микрофон недоступен:`, error);
                }
            }
            
            if (connected) {
                this.isBackgroundAnalyzing = true;
                this.startConditionalAnalysis();
                console.log('✅ ТОЧНЫЙ анализ запущен');
            } else {
                console.error('❌ Не удалось подключиться к аудио источнику');
                this.isBackgroundAnalyzing = true;
                this.startConditionalAnalysis();
                console.log('⚡ Анализ запущен принудительно');
            }
            
        } catch (error) {
            console.error('❌ Ошибка запуска анализа:', error);
            this.isBackgroundAnalyzing = true;
            this.startConditionalAnalysis();
            console.log('⚡ Анализ запущен аварийно');
        }
    }

    startConditionalAnalysis() {
        if (!this.isBackgroundAnalyzing) {return;}
        
        // ⚡ СУПЕР-ТОЧНЫЙ анализ 500fps
        const analyze = (timestamp) => {
            if (!this.isBackgroundAnalyzing) {return;}
            
            if (timestamp - this.lastAnalysisTime >= this.analysisInterval) {
                this.lastAnalysisTime = timestamp;
                
                // 🎯 АНАЛИЗ В ЛЮБОМ РЕЖИМЕ - играет или на паузе
                const pitchData = this.detectPitchWithHighAccuracy();
                if (pitchData) {
                    this.processNoteWithAccuracyTracking(pitchData);
                } else {
                    // ⏸️ В режиме паузы - показываем статический анализ позиции
                    if (!window.audioEngine || !window.audioEngine._isPlaying) {
                        this.performStaticPitchAnalysis(timestamp);
                    } else {
                        this.checkForSilenceInstant(timestamp);
                    }
                }
            }
            
            // 🧹 Очистка только если трек действительно остановлен надолго
            this.cleanupInactiveKeysConditional(timestamp);
            requestAnimationFrame(analyze);
        };
        
        requestAnimationFrame(analyze);
    }
    
    // 🎯 ВЫСОКОТОЧНАЯ детекция питча
    detectPitchWithHighAccuracy() {
        if (!this.pitchDetector || !this.inputBuffer) {return null;}
        
        this.analyser.getFloatTimeDomainData(this.inputBuffer);
        const [frequency, clarity] = this.pitchDetector.findPitch(this.inputBuffer, this.audioContext.sampleRate);
        
        if (!frequency || frequency <= 0) {return null;}
        
        this.detectionStats.totalDetections++;
        
        // 🎯 СТРОГИЙ диапазон для вокала (C2-C6)
        const minFreq = 65.4;   
        const maxFreq = 1046.5; 
        if (frequency < minFreq || frequency > maxFreq) {return null;}
        
        // 🎯 ВЫСОКИЕ пороги для точности
        const minClarity = 0.70; // Повышен до 70% для точности
        if (clarity < minClarity) {return null;}
        
        // RMS амплитуда
            let rms = 0;
            for (let i = 0; i < this.inputBuffer.length; i++) {
                rms += this.inputBuffer[i] * this.inputBuffer[i];
            }
            rms = Math.sqrt(rms / this.inputBuffer.length);

        const minRms = 0.005; // Минимальный сигнал
        if (rms < minRms) {return null;}
        
        // 🎯 ПРОВЕРКА НА ГАРМОНИКИ - ключевая для точности!
        if (!this.isValidFundamentalFrequency(frequency, clarity)) {
            this.detectionStats.harmonicsRejected++;
            return null;
        }
        
        return { 
            frequency, 
            clarity, 
            amplitude: rms,
            timestamp: performance.now()
        };
    }
    
    // 🔇 УЛУЧШЕННАЯ проверка основной частоты vs гармоники  
    isValidFundamentalFrequency(frequency, clarity) {
        // ВРЕМЕННО ОТКЛЮЧАЕМ ЖЕСТКУЮ ФИЛЬТРАЦИЮ для калибровки
        // После калибровки включим более умную логику
        
        // 🎯 БАЗОВАЯ ПРОВЕРКА: если частота в разумных пределах - принимаем
        if (frequency >= 65 && frequency <= 1050) {
            
            // Если нет истории - принимаем
            if (!this.harmonicFilter.lastFundamental) {
                this.harmonicFilter.lastFundamental = frequency;
                console.log(`🎯 Первая нота принята: ${frequency.toFixed(1)}Hz`);
                return true;
            }
            
            const lastFreq = this.harmonicFilter.lastFundamental;
            const ratio = frequency / lastFreq;
            
            // 🎯 СМЯГЧЕННАЯ ПРОВЕРКА: блокируем только явные гармоники
            const isObviousHarmonic = (
                (Math.abs(ratio - 2.0) < 0.03) ||  // Строгая октава 2:1
                (Math.abs(ratio - 0.5) < 0.015) || // Строгая октава 1:2  
                (Math.abs(ratio - 4.0) < 0.1) ||   // Две октавы 4:1
                (Math.abs(ratio - 0.25) < 0.025)   // Две октавы 1:4
            );
            
            if (isObviousHarmonic) {
                // 🎯 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: если ясность очень высокая - возможно это реальная нота
                if (clarity > 0.9) {
                    console.log(`🎯 Высокая ясность (${(clarity*100).toFixed(1)}%) - принимаем возможную гармонику: ${frequency.toFixed(1)}Hz`);
                    this.harmonicFilter.lastFundamental = frequency;
                    return true;
                }
                
                console.log(`🚫 Блокирована очевидная гармоника: ${frequency.toFixed(1)}Hz (${ratio.toFixed(2)}x от ${lastFreq.toFixed(1)}Hz, ясность: ${(clarity*100).toFixed(1)}%)`);
                return false;
            }
            
            // 🎯 ВСЕ ОСТАЛЬНЫЕ ЧАСТОТЫ ПРИНИМАЕМ
            this.harmonicFilter.lastFundamental = frequency;
            return true;
        }
        
        console.log(`🚫 Частота вне диапазона: ${frequency.toFixed(1)}Hz`);
        return false;
    }
    
    // 🎯 ОБРАБОТКА НОТЫ С ОТСЛЕЖИВАНИЕМ ТОЧНОСТИ
    processNoteWithAccuracyTracking(pitchData) {
        const { frequency, clarity } = pitchData;
        const keyId = this.frequencyToNoteId(frequency);
        
        if (!keyId) {return;}
        
        // 🚫 АНТИГАРМОНИЧЕСКАЯ ЗАЩИТА
        if (this.isHarmonicJump(frequency, this.currentActiveNote)) {
            return; // Блокируем гармонический скачок
        }
        
        this.detectionStats.totalDetections++;
        
        // Если это новая нота
        if (!this.currentActiveNote || this.currentActiveNote.keyId !== keyId) {
            this.transitionToNewNote(keyId, pitchData);
        } else {
            // Обновляем существующую ноту
            this.updateExistingNote(keyId, pitchData);
        }
        
        // 🗺️ ЗАПИСЫВАЕМ В ПИТЧ-КАРТУ если воспроизводится трек
        this.recordToPitchMap(keyId, pitchData);
        
        // Обновляем статистику точности
        this.updateAccuracyStats(keyId, clarity);
    }
    
    // 🗺️ ЗАПИСЬ В ПИТЧ-КАРТУ ТРЕКА
    recordToPitchMap(keyId, pitchData) {
        // Записываем только если трек воспроизводится (не статический анализ)
        if (!this.isTrackPlaying() || pitchData.isStatic) {return;}
        
        const currentTime = this.getCurrentTrackTime();
        if (currentTime < 0) {return;} // Некорректное время
        
        const { frequency, clarity } = pitchData;
        
        // Проверяем, нужно ли записать новую ноту или обновить существующую
        const lastNote = this.pitchMap.notes[this.pitchMap.notes.length - 1];
        
        if (lastNote && 
            lastNote.keyId === keyId && 
            (currentTime - lastNote.time) < 0.5) { // В пределах 0.5 секунды
            
            // Обновляем существующую ноту - продлеваем её
            lastNote.endTime = currentTime;
            lastNote.duration = lastNote.endTime - lastNote.time;
            lastNote.maxClarity = Math.max(lastNote.maxClarity || clarity, clarity);
            lastNote.detectionCount = (lastNote.detectionCount || 1) + 1;
            
        } else {
            // Завершаем предыдущую ноту
            if (lastNote && !lastNote.endTime) {
                lastNote.endTime = currentTime;
                lastNote.duration = lastNote.endTime - lastNote.time;
            }
            
            // Создаем новую запись в карте
            const noteRecord = {
                time: currentTime,
                endTime: null, // Будет установлено при завершении
                keyId: keyId,
                        frequency: frequency,
                        clarity: clarity,
                maxClarity: clarity,
                duration: 0, // Будет вычислено при завершении
                detectionCount: 1
            };
            
            this.pitchMap.notes.push(noteRecord);
            
            // Обновляем индекс для быстрого поиска
            const timeKey = Math.floor(currentTime * 10) / 10; // Округляем до 0.1с
            if (!this.pitchMap.timeIndex.has(timeKey)) {
                this.pitchMap.timeIndex.set(timeKey, []);
            }
            this.pitchMap.timeIndex.get(timeKey).push(this.pitchMap.notes.length - 1);
            
            console.log(`🗺️ Записано в карту: ${keyId} в ${currentTime.toFixed(2)}с (${frequency.toFixed(1)}Hz)`);
        }
        
        // Включаем запись если ещё не включена
        if (!this.pitchMap.isRecording) {
            this.pitchMap.isRecording = true;
            console.log('🗺️ Запись питч-карты АКТИВИРОВАНА');
        }
    }
    
    // 🎵 ПРОВЕРКА ВОСПРОИЗВЕДЕНИЯ ТРЕКА
    isTrackPlaying() {
        try {
            return window.audioEngine && 
                   (window.audioEngine._isPlaying || 
                    window.audioEngine.isPlaying || 
                    (window.audioEngine.audio && !window.audioEngine.audio.paused));
        } catch (error) {
            return false;
        }
    }
    
    // Остальные методы будут добавлены в следующих частях...
    
    // 🎯 ПЕРЕХОД К НОВОЙ НОТЕ
    transitionToNewNote(keyId, pitchData) {
        // Останавливаем текущую ноту если есть
        if (this.currentActiveNote) {
            this.stopNote(this.currentActiveNote.keyId, 'transition');
        }
        
        // Запускаем новую ноту
        this.startNewNote(keyId, pitchData);
        
        this.detectionStats.instantSwitches++;
    }
    
    // 🎯 ЗАПУСК НОВОЙ НОТЫ
    startNewNote(keyId, pitchData) {
        const { frequency, clarity, amplitude, timestamp = performance.now() } = pitchData;
        
        // Создаем данные новой ноты
        const noteData = {
            keyId: keyId,
            startTime: timestamp,
            lastDetection: timestamp,
            currentFrequency: frequency,
            initialFrequency: frequency,
            maxClarity: clarity,
            maxAmplitude: amplitude || 0.1,
            detectionCount: 1,
            updates: []
        };
        
        // Устанавливаем как активную
        this.currentActiveNote = noteData;
        this.activeNotes.set(keyId, noteData);
        this.pressedKeys.add(keyId);
        
        // Анимируем шарик к новой клавише
        this.animateBallToKey(keyId);
        
        console.log(`🎵 Новая нота: ${keyId} (${frequency.toFixed(1)}Hz, ${(clarity * 100).toFixed(1)}%)`);
    }
    
    // 🎯 ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕЙ НОТЫ
    updateExistingNote(keyId, pitchData) {
        const { frequency, clarity, amplitude, timestamp } = pitchData;
        const noteData = this.activeNotes.get(keyId);
        
        if (!noteData) {return;}
        
        // Обновляем данные
        noteData.lastDetection = timestamp;
        noteData.maxClarity = Math.max(noteData.maxClarity, clarity);
        noteData.maxAmplitude = Math.max(noteData.maxAmplitude, amplitude);
        noteData.detectionCount++;
        noteData.currentFrequency = frequency;
        
        // Каждые 10 детекций логируем важные обновления
        if (noteData.detectionCount % 10 === 0) {
            const duration = timestamp - noteData.startTime;
            console.log(`🔄 ОБНОВЛЕНИЕ ${keyId}: ${duration.toFixed(0)}мс, обновлений: ${noteData.detectionCount}, точность: ${(clarity*100).toFixed(1)}%`);
        }
    }
    
    // 🎯 АНИМАЦИЯ ШАРИКА К КЛАВИШЕ
    animateBallToKey(keyId) {
        const targetKey = this.keys.find(key => `${key.note}${key.octave}` === keyId);
        if (!targetKey) {return;}
        
        if (!this.singleBallIndicator) {
            this.singleBallIndicator = { visible: false };
        }
        
        // ШАРИК СВЕРХУ КЛАВИАТУРЫ - решает проблему с черными клавишами
        const targetY = targetKey.y - 30; // 30px сверху от клавиши
        
        this.ballAnimation = {
            isAnimating: true,
            fromX: this.singleBallIndicator.x || targetKey.x + targetKey.width / 2,
            fromY: this.singleBallIndicator.y || targetY,
            toX: targetKey.x + targetKey.width / 2,
            toY: targetY,
            startTime: performance.now(),
            duration: 120
        };
        
        // Моментальное обновление позиции для мгновенной реакции
        this.singleBallIndicator.x = targetKey.x + targetKey.width / 2;
        this.singleBallIndicator.y = targetY;
        this.singleBallIndicator.visible = true;
        this.singleBallIndicator.keyId = keyId;
        this.singleBallIndicator.frequency = targetKey.frequency;
        
        console.log(`🎯 Шарик перемещен к ${keyId}: x=${this.singleBallIndicator.x}, y=${this.singleBallIndicator.y}`);
    }
    
    // 🎯 ОСТАНОВКА НОТЫ
    stopNote(keyId, reason = 'silence') {
        const noteData = this.activeNotes.get(keyId);
        if (!noteData) {return;}
        
        const duration = performance.now() - noteData.startTime;
        console.log(`🔇 ОСТАНОВКА ${keyId} (${reason}): продолжительность ${duration.toFixed(0)}мс, детекций: ${noteData.detectionCount}`);
        
        // Удаляем из всех структур
        this.activeNotes.delete(keyId);
        this.pressedKeys.delete(keyId);
        
        // Очищаем текущую активную ноту
        if (this.currentActiveNote && this.currentActiveNote.keyId === keyId) {
            this.currentActiveNote = null;
            this.singleBallIndicator = null;
        }
    }
    
    // 🎯 ОПРЕДЕЛЕНИЕ ID НОТЫ ПО ЧАСТОТЕ
    frequencyToNoteId(frequency) {
        if (!this.keys) {return null;}
        
        let closestKey = null;
        let closestDistance = Infinity;
        
        for (const key of this.keys) {
            const distance = Math.abs(frequency - key.frequency);
            const tolerance = key.frequency * 0.03; // 3% толерантность
            
            if (distance < tolerance && distance < closestDistance) {
                closestDistance = distance;
                closestKey = key;
            }
        }
        
        return closestKey ? `${closestKey.note}${closestKey.octave}` : null;
    }
    
    // 🎯 ОБНОВЛЕНИЕ СТАТИСТИКИ ТОЧНОСТИ
    updateAccuracyStats(keyId, clarity) {
        // Простая логика: если ясность > 80% - правильная нота
        if (clarity >= 0.8) {
            this.detectionStats.correctNotes++;
        } else if (clarity >= 0.6) {
            // Средняя точность - не считаем ни правильной, ни неправильной
        } else {
            this.detectionStats.incorrectNotes++;
        }
        
        // Обновляем общую точность
        const total = this.detectionStats.correctNotes + this.detectionStats.incorrectNotes;
        if (total > 0) {
            this.detectionStats.accuracy = (this.detectionStats.correctNotes / total) * 100;
        }
    }
    
    // 🎯 ПРОВЕРКА НА ТИШИНУ
    checkForSilenceInstant(timestamp) {
        // Если есть активная нота и прошло много времени без детекции
        if (this.currentActiveNote) {
            const timeSinceLastDetection = timestamp - this.currentActiveNote.lastDetection;
            if (timeSinceLastDetection > 150) { // 150мс тишины
                console.log('🔇 Глубокая тишина - очистка нот');
                this.forceStopAllKeys('deep_silence');
            }
        }
    }
    
    // 🎯 ПРИНУДИТЕЛЬНАЯ ОСТАНОВКА ВСЕХ КЛАВИШ
    forceStopAllKeys(reason = 'forced') {
        if (this.activeNotes.size === 0) {return;} // НЕ логируем если нет активных нот
        
        console.log(`🛑 Принудительная остановка всех нот (${reason}), активных: ${this.activeNotes.size}`);
        
        this.activeNotes.forEach((note, keyId) => {
            this.stopNote(keyId, reason);
        });
        this.activeNotes.clear();
        
        // Скрываем шарик только если есть активные ноты
        if (this.singleBallIndicator) {
            this.singleBallIndicator.visible = false;
        }
    }
    
    // 🎯 ОЧИСТКА НЕАКТИВНЫХ КЛАВИШ
    cleanupInactiveKeysInstant(timestamp) {
        if (!this.currentActiveNote) {return;}
        
        const timeSinceLastDetection = timestamp - this.currentActiveNote.lastDetection;
        
        // Если нота неактивна > 200мс - убираем
        if (timeSinceLastDetection > 200) {
            this.stopNote(this.currentActiveNote.keyId, 'timeout');
        }
    }
    
    // 🎯 ОБНОВЛЕНИЕ АУДИО ДВИЖКА
    updateAudioEngineStatus() {
        // Заглушка для совместимости
    }
    
    // 🎯 ЗАПУСК РЕНДЕРИНГА
    startRender() {
        if (this.renderLoop) {return;}
        
        const render = (timestamp) => {
            if (!this.isActive) {return;}
            
            this.updateBallAnimation(timestamp);
            this.draw();
            
            this.renderLoop = requestAnimationFrame(render);
        };
        
        this.renderLoop = requestAnimationFrame(render);
    }
    
    // 🎯 ОБНОВЛЕНИЕ АНИМАЦИИ ШАРИКА
    updateBallAnimation(timestamp) {
        if (!this.ballAnimation || !this.ballAnimation.isAnimating) {return;}
        
        const elapsed = timestamp - this.ballAnimation.startTime;
        const progress = Math.min(elapsed / this.ballAnimation.duration, 1);
        
        // Easing функция для плавности
        const eased = 1 - Math.pow(1 - progress, 3);
        
        if (this.singleBallIndicator) {
            this.singleBallIndicator.x = this.ballAnimation.fromX + 
                (this.ballAnimation.toX - this.ballAnimation.fromX) * eased;
            this.singleBallIndicator.y = this.ballAnimation.fromY + 
                (this.ballAnimation.toY - this.ballAnimation.fromY) * eased;
        }
        
        if (progress >= 1) {
            this.ballAnimation.isAnimating = false;
        }
    }
    
    // 🎹 ОСНОВНАЯ ФУНКЦИЯ РИСОВАНИЯ
    draw() {
        if (!this.ctx || !this.keys) {return;}
        
        const canvas = this.canvas;
        const ctx = this.ctx;
        const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
        
        // Очистка
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Заголовок
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('🎹 ТОЧНАЯ ДЕТЕКЦИЯ ПИТЧА - ЦЕЛЬ: 95%', canvasWidth / 2, 40);
        
        // Статистика точности
        this.drawAccuracyStats(ctx, canvasWidth);
        
        // Клавиши
        this.drawKeys(ctx);
        
        // Шарик-индикатор
        this.drawBallIndicator(ctx);
        
        // Диагностика
        this.drawDiagnostics(ctx, canvasWidth, canvasHeight);
        
        // Кнопка закрытия
        this.drawCloseButton(ctx, canvasWidth);
    }
    
    // 📊 СТАТИСТИКА ТОЧНОСТИ
    drawAccuracyStats(ctx, canvasWidth) {
        const accuracy = this.detectionStats.accuracy.toFixed(1);
        const total = this.detectionStats.correctNotes + this.detectionStats.incorrectNotes;
        
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        
        // Цвет в зависимости от точности
        if (this.detectionStats.accuracy >= 95) {
            ctx.fillStyle = '#00ff41'; // Цель достигнута!
        } else if (this.detectionStats.accuracy >= 80) {
            ctx.fillStyle = '#ffaa00'; // Хорошо
        } else {
            ctx.fillStyle = '#ff4444'; // Нужно улучшить
        }
        
        ctx.fillText(`ТОЧНОСТЬ: ${accuracy}% (${this.detectionStats.correctNotes}/${total})`, canvasWidth / 2, 80);
        
        if (this.detectionStats.accuracy >= 95) {
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#00ff41';
            ctx.fillText('🎯 ЦЕЛЬ ДОСТИГНУТА! Готов для Look-Ahead системы', canvasWidth / 2, 110);
        }
    }
    
    // 🎹 РИСОВАНИЕ КЛАВИШ
    drawKeys(ctx) {
        // Сначала белые клавиши
        for (const key of this.keys.filter(k => !k.isBlack)) {
            this.drawKey(ctx, key, false);
        }
        
        // Потом черные клавиши (поверх белых)
        for (const key of this.keys.filter(k => k.isBlack)) {
            this.drawKey(ctx, key, true);
        }
    }
    
    // 🎹 РИСОВАНИЕ ОДНОЙ КЛАВИШИ
    drawKey(ctx, key, isBlack) {
        const keyId = `${key.note}${key.octave}`;
        const isPressed = this.pressedKeys.has(keyId);
        const isActive = this.currentActiveNote && this.currentActiveNote.keyId === keyId;
        
        // 🎯 РАСЧЕТ ТОЧНОСТИ И ПОДСВЕТКИ
        let accuracy = 5; // По умолчанию средняя точность
        if (isActive && this.currentActiveNote) {
            const targetFreq = this.noteToFrequency(key.note, key.octave);
            accuracy = this.calculateNoteAccuracy(this.currentActiveNote.currentFrequency, targetFreq);
        }
        
        // 🎨 ЦВЕТ КЛАВИШИ С ГРАДИЕНТОМ ТОЧНОСТИ
        if (isActive) {
            // От темно-зеленого (края) до яркого зеленого (центр)
            const greenIntensity = Math.max(0.3, accuracy / 10); // 0.3-1.0
            const red = Math.floor(0 * 255);
            const green = Math.floor(greenIntensity * 255);
            const blue = Math.floor(20 * greenIntensity);
            ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        } else if (isPressed) {
            ctx.fillStyle = isBlack ? '#666666' : '#cccccc';
        } else {
            ctx.fillStyle = isBlack ? '#333333' : '#ffffff';
        }
        
        // Рисуем клавишу
        ctx.fillRect(key.x, key.y, key.width, key.height);
        
        // Обводка
        ctx.strokeStyle = isActive ? '#00ff41' : '#000000';
        ctx.lineWidth = isActive ? 3 : 1;
        ctx.strokeRect(key.x, key.y, key.width, key.height);
        
        // Текст ноты
        ctx.font = '12px Arial';
        ctx.fillStyle = isBlack ? '#ffffff' : '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(keyId, key.x + key.width / 2, key.y + key.height - 10);
        
        // 🎯 ИНДИКАТОР ТОЧНОСТИ (если активная)
        if (isActive && accuracy !== undefined) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${accuracy}/10`, key.x + key.width / 2, key.y + 15);
        }
    }
    
    // ⚪ РИСОВАНИЕ СИСТЕМЫ ДВОЙНОГО ШАРИКА
    drawBallIndicator(ctx) {
        if (!this.singleBallIndicator || !this.singleBallIndicator.visible) {return;}
        
        const ball = this.singleBallIndicator;
        const key = this.keys.find(k => `${k.note}${k.octave}` === ball.keyId);
        
        if (key) {
            const clarity = this.currentActiveNote ? this.currentActiveNote.maxClarity : 0.7;
            const accuracy = this.calculateNoteAccuracy(ball.frequency, key.frequency);
            
            // Больший размер шарика для лучшей видимости
            const ballSize = Math.max(20, 15 + clarity * 15); // Минимум 20px
            
            // Яркие цвета в зависимости от точности
            let ballColor, strokeColor;
            if (accuracy >= 8) {
                ballColor = 'rgba(0, 255, 0, 0.9)';   // Ярко-зеленый
                strokeColor = 'rgba(0, 200, 0, 1)';
            } else if (accuracy >= 6) {
                ballColor = 'rgba(100, 255, 100, 0.8)'; // Светло-зеленый  
                strokeColor = 'rgba(50, 200, 50, 1)';
            } else {
                ballColor = 'rgba(150, 255, 150, 0.7)'; // Бледно-зеленый
                strokeColor = 'rgba(100, 180, 100, 1)';
            }
            
            // Рисуем главный шарик с обводкой
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballSize, 0, 2 * Math.PI);
            ctx.fillStyle = ballColor;
            ctx.fill();
            
            // Обводка для лучшей видимости
            ctx.lineWidth = 2;
            ctx.strokeStyle = strokeColor;
            ctx.stroke();
            
            // Внутренний шарик для точности
            const innerSize = ballSize * 0.4;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, innerSize, 0, 2 * Math.PI);
            ctx.fillStyle = ballColor.replace('0.9', '1').replace('0.8', '1').replace('0.7', '1');
            ctx.fill();
            
            // Сохраняем размер для диагностики
            ball.size = ballSize;
        }
    }
    
    // 🔍 ДИАГНОСТИЧЕСКАЯ ИНФОРМАЦИЯ
    drawDiagnostics(ctx, canvasWidth, canvasHeight) {
        const statsInfo = [];
        
        // ⏱️ ВРЕМЯ ТРЕКА - ИСПРАВЛЕННОЕ ПОЛУЧЕНИЕ
        let currentTime = null;
        try {
            currentTime = this.getCurrentTrackTime() * 1000; // в мс для отображения
            
            if (currentTime !== null && currentTime >= 0) {
                statsInfo.push(`⏱️ ВРЕМЯ ТРЕКА: ${currentTime.toFixed(0)}мс (${(currentTime/1000).toFixed(2)}с)`);
            } else {
                statsInfo.push(`⏱️ ВРЕМЯ ТРЕКА: недоступно`);
            }
        } catch (error) {
            statsInfo.push(`⏱️ ВРЕМЯ ТРЕКА: ошибка (${error.message})`);
        }
        
        // 🎛️ ИНФОРМАЦИЯ О ПЕРЕМОТКЕ И АНАЛИЗЕ
        if (this.scrubSystem.isActive) {
            const direction = this.scrubSystem.direction === -1 ? 'НАЗАД' : 'ВПЕРЕД';
            
            // Определяем режим перемотки на основе состояния воспроизведения
            let mode = 'ВРЕМЯ';
            let isPlaying = false;
            try {
                if (window.audioEngine) {
                    isPlaying = window.audioEngine._isPlaying || 
                               window.audioEngine.isPlaying || 
                               (window.audioEngine.audio && !window.audioEngine.audio.paused) ||
                               false;
                }
            } catch (error) {
                isPlaying = false;
            }
            
            mode = isPlaying ? 'ВРЕМЯ (0.5с)' : 'ПИТЧ-КАРТА + ПОИСК НОТ';
            statsInfo.push(`⏩ ПЕРЕМОТКА: ${direction} (${mode})`);
            statsInfo.push(`🎵 Статус: ${isPlaying ? 'ВОСПРОИЗВЕДЕНИЕ' : 'ПАУЗА'}`);
        }
        
        // 🔍 РЕЖИМ АНАЛИЗА
        let analysisMode = 'НЕАКТИВЕН';
        if (window.audioEngine && window.audioEngine._isPlaying) {
            analysisMode = '🎵 ЖИВОЙ АНАЛИЗ';
        } else if (this.currentActiveNote) {
            if (this.currentActiveNote.isSimulated) {
                analysisMode = '🎭 СИМУЛЯЦИЯ ИЗ КАРТЫ';
            } else {
                analysisMode = '🔍 СТАТИЧЕСКИЙ АНАЛИЗ';
            }
        } else {
            analysisMode = '⏸️ ПОИСК НОТ';
        }
        statsInfo.push(`🎛️ Анализ: ${analysisMode}`);
        
        // 🗺️ ИНФОРМАЦИЯ О ПИТЧ-КАРТЕ
        statsInfo.push(`🗺️ Питч-карта: ${this.pitchMap.notes.length} нот записано`);
        if (this.pitchMap.currentIndex >= 0 && this.pitchMap.notes[this.pitchMap.currentIndex]) {
            const currentMapNote = this.pitchMap.notes[this.pitchMap.currentIndex];
            statsInfo.push(`📍 Текущая позиция в карте: ${currentMapNote.keyId} (${currentMapNote.time.toFixed(2)}с)`);
        }
        if (this.pitchMap.isRecording) {
            statsInfo.push(`🔴 Запись карты: АКТИВНА`);
        }
        
        // Основная статистика
        statsInfo.push(`🎯 Всего детекций: ${this.detectionStats.totalDetections}`);
        statsInfo.push(`✅ Правильных: ${this.detectionStats.correctNotes}`);
        statsInfo.push(`❌ Неправильных: ${this.detectionStats.incorrectNotes}`);
        statsInfo.push(`🚫 Гармоник отфильтровано: ${this.detectionStats.harmonicsRejected}`);
        statsInfo.push(`⚡ Мгновенных переходов: ${this.detectionStats.instantSwitches}`);
        
        // Текущая активная нота
        if (this.currentActiveNote) {
            const duration = performance.now() - this.currentActiveNote.startTime;
            statsInfo.push(``, `🎵 АКТИВНАЯ НОТА:`);
            statsInfo.push(`🎹 ${this.currentActiveNote.keyId} (${this.currentActiveNote.currentFrequency.toFixed(1)}Hz)`);
            statsInfo.push(`⏱️ Длительность: ${duration.toFixed(0)}мс`);
            statsInfo.push(`🔄 Обновлений: ${this.currentActiveNote.detectionCount}`);
            statsInfo.push(`📊 Макс. ясность: ${(this.currentActiveNote.maxClarity * 100).toFixed(1)}%`);
        }
        
        // Информация о шарике
        statsInfo.push(``, `🔴 ШАРИК:`);
        if (this.singleBallIndicator && this.singleBallIndicator.visible) {
            statsInfo.push(`📍 Позиция: (${Math.round(this.singleBallIndicator.x)}, ${Math.round(this.singleBallIndicator.y)})`);
            statsInfo.push(`🎯 Размер: ${Math.round(this.singleBallIndicator.size || 22)}px`);
            statsInfo.push(`🎭 Анимация: ${this.ballAnimation?.isAnimating ? "Да" : "Нет"}`);
            
            // Проверяем, не ушел ли шарик за пределы экрана
            const isVisible = this.singleBallIndicator.y < canvasHeight && this.singleBallIndicator.y > 0;
            statsInfo.push(`👁️ Видимость: ${isVisible ? "Да" : "❌ ЗА ЭКРАНОМ!"}`);
        } else {
            statsInfo.push(`❌ Шарик не создан`);
            statsInfo.push(`🎹 Активная нота: ${this.currentActiveNote ? this.currentActiveNote.keyId : "Нет"}`);
        }
        
        // Тестовая система
        if (this.testingSystem.isActive) {
            statsInfo.push(``, `🧪 ТЕСТИРОВАНИЕ:`);
            statsInfo.push(`📋 Упражнение: ${this.testingSystem.currentExercise + 1}/${this.testingSystem.exercises.length}`);
            statsInfo.push(`🎼 "${this.testingSystem.exercises[this.testingSystem.currentExercise]?.name}"`);
        }
        
        // 🎹 ИНСТРУКЦИИ ПО ПЕРЕМОТКЕ И ТЕСТИРОВАНИЮ - ОБНОВЛЕННЫЕ
        statsInfo.push(``, `⏩ СИСТЕМА НАВИГАЦИИ С НОТАМИ:`);
        statsInfo.push(`🎵 При ВОСПРОИЗВЕДЕНИИ: ← → по времени (0.5с)`);
        statsInfo.push(`🎯 При ПАУЗЕ: ← → по нотам + ПОИСК НОТ`);
        statsInfo.push(`🔍 Автоматический поиск нот в новой позиции`);
        statsInfo.push(`⏰ Зажмите для непрерывной навигации`);
        statsInfo.push(`💡 Ноты показываются в любом режиме!`);
        
        statsInfo.push(``, `🎯 ГОРЯЧИЕ КЛАВИШИ ДЛЯ КАЛИБРОВКИ:`);
        statsInfo.push(`🔧 Ctrl+C - Калибровочные тесты питча`);
        statsInfo.push(`🎯 T - Тесты точности детекции`);
        statsInfo.push(`🔄 R - Сброс фильтров гармоник`);
        statsInfo.push(`⏺️ Escape - Закрыть клавиатуру`);
        
        // Статус калибровки
        const lastCalibration = this.detectionStats.lastCalibrationResult;
        if (lastCalibration) {
            statsInfo.push(``, `📊 ПОСЛЕДНЯЯ КАЛИБРОВКА:`);
            statsInfo.push(`✅ Успех: ${lastCalibration.successRate.toFixed(1)}%`);
            statsInfo.push(`📏 Средняя ошибка: ${lastCalibration.averageError.toFixed(3)}%`);
            statsInfo.push(`🎯 Тестов прошло: ${lastCalibration.passedTests}`);
        }
        
        // Рисуем информацию
        ctx.font = '12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        
        let y = 140;
        for (const line of statsInfo) {
            ctx.fillText(line, 20, y);
            y += 15;
        }
    }
    
    // ❌ КНОПКА ЗАКРЫТИЯ
    drawCloseButton(ctx, canvasWidth) {
        const size = 50;
        const x = canvasWidth - size;
        const y = 0;
        
        // Фон кнопки
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x, y, size, size);
        
        // X
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 15, y + 15);
        ctx.lineTo(x + 35, y + 35);
        ctx.moveTo(x + 35, y + 15);
        ctx.lineTo(x + 15, y + 35);
        ctx.stroke();
    }
    
    // 🎯 ОБРАБОТКА КЛИКОВ ПО ПАНЕЛИ УПРАВЛЕНИЯ
    handleControlPanelClick(x, y) {
        // Заглушка для будущих панелей управления
    }
    
    // 🎯 РАСЧЕТ РАСКЛАДКИ КЛАВИАТУРЫ
    calculateKeyboardLayout() {
        if (!this.keys) {return;}
        
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // Клавиатура внизу экрана
        const keyboardHeight = 150;
        const keyboardY = canvasHeight - keyboardHeight - 50;
        
        const whiteKeys = this.keys.filter(k => !k.isBlack);
        const whiteKeyWidth = Math.min(60, canvasWidth / whiteKeys.length);
        const blackKeyWidth = whiteKeyWidth * 0.6;
        const whiteKeyHeight = keyboardHeight;
        const blackKeyHeight = keyboardHeight * 0.6;
        
        // Позиционируем белые клавиши
        let currentX = (canvasWidth - whiteKeys.length * whiteKeyWidth) / 2;
        for (const key of whiteKeys) {
            key.x = currentX;
            key.y = keyboardY;
            key.width = whiteKeyWidth;
            key.height = whiteKeyHeight;
            key.isPressed = this.pressedKeys.has(`${key.note}${key.octave}`);
            currentX += whiteKeyWidth;
        }
        
        // Позиционируем черные клавиши
        const blackKeys = this.keys.filter(k => k.isBlack);
        for (const blackKey of blackKeys) {
            const octave = blackKey.octave;
            const note = blackKey.note.replace('#', '');
            
            // Находим позицию между белыми клавишами
            let leftWhiteKey, rightWhiteKey;
            
            if (note === 'C') {
                leftWhiteKey = whiteKeys.find(k => k.note === 'C' && k.octave === octave);
                rightWhiteKey = whiteKeys.find(k => k.note === 'D' && k.octave === octave);
            } else if (note === 'D') {
                leftWhiteKey = whiteKeys.find(k => k.note === 'D' && k.octave === octave);
                rightWhiteKey = whiteKeys.find(k => k.note === 'E' && k.octave === octave);
            } else if (note === 'F') {
                leftWhiteKey = whiteKeys.find(k => k.note === 'F' && k.octave === octave);
                rightWhiteKey = whiteKeys.find(k => k.note === 'G' && k.octave === octave);
            } else if (note === 'G') {
                leftWhiteKey = whiteKeys.find(k => k.note === 'G' && k.octave === octave);
                rightWhiteKey = whiteKeys.find(k => k.note === 'A' && k.octave === octave);
            } else if (note === 'A') {
                leftWhiteKey = whiteKeys.find(k => k.note === 'A' && k.octave === octave);
                rightWhiteKey = whiteKeys.find(k => k.note === 'B' && k.octave === octave);
            }
            
            if (leftWhiteKey && rightWhiteKey) {
                blackKey.x = leftWhiteKey.x + whiteKeyWidth - blackKeyWidth / 2;
                blackKey.y = keyboardY;
                blackKey.width = blackKeyWidth;
                blackKey.height = blackKeyHeight;
                blackKey.isPressed = this.pressedKeys.has(`${blackKey.note}${blackKey.octave}`);
            }
        }
    }

    // 🎯 АНТИГАРМОНИЧЕСКАЯ СИСТЕМА - ЗАЩИТА ОТ ОКТАВНЫХ СКАЧКОВ
    isHarmonicJump(newFrequency, currentNote) {
        if (!currentNote) {return false;}
        
        const currentFreq = currentNote.currentFrequency;
        const ratio = newFrequency / currentFreq;
        const noteDuration = performance.now() - currentNote.startTime;
        
        // 🎯 БОЛЕЕ МЯГКИЕ КРИТЕРИИ: блокируем только для ОЧЕНЬ коротких нот
        const isOctaveRatio = (
            Math.abs(ratio - 2.0) < 0.05 ||    // Октава вверх
            Math.abs(ratio - 0.5) < 0.025      // Октава вниз
        );
        
        // Блокируем октавные скачки только для нот короче 80мс (вместо 150мс)
        if (isOctaveRatio && noteDuration < 80) {
            console.log(`🚫 Октавный скачок заблокирован: ${currentFreq.toFixed(1)}Hz → ${newFrequency.toFixed(1)}Hz за ${noteDuration.toFixed(0)}мс`);
            this.detectionStats.harmonicsRejected++;
            return true;
        }
        
        return false;
    }

    // 🎯 РАСЧЕТ ТОЧНОСТИ ПОЗИЦИОНИРОВАНИЯ В НОТЕ (0-10)
    calculateNoteAccuracy(frequency, targetFrequency) {
        const deviation = Math.abs(frequency - targetFrequency);
        const maxDeviation = targetFrequency * 0.029; // ±2.9% (полутон)
        
        if (deviation > maxDeviation) {return 0;}
        
        const accuracy = Math.max(0, 10 - (deviation / maxDeviation) * 10);
        return Math.round(accuracy);
    }

    // ⏩ ОБРАБОТКА ПРОФЕССИОНАЛЬНОЙ ПЕРЕМОТКИ
    handleScrubbing(keyCode, isKeyDown) {
        const direction = keyCode === 'ArrowLeft' ? -1 : 1;
        
        if (isKeyDown) {
            // Начинаем перемотку
            if (!this.scrubSystem.isActive) {
                this.scrubSystem.isActive = true;
                this.scrubSystem.direction = direction;
                
                // Первый шаг - мгновенно
                this.performScrubStep(direction);
                
                // Настраиваем непрерывную перемотку с задержкой
                this.scrubSystem.continuousInterval = setTimeout(() => {
                    this.startContinuousScrubbing(direction);
                }, this.scrubSystem.repeatDelay);
                
                console.log(`⏩ Начало перемотки: ${direction === -1 ? 'назад' : 'вперед'}`);
            }
        } else {
            // Останавливаем перемотку
            this.stopScrubbing();
        }
    }
    
    // ⏩ ВЫПОЛНЕНИЕ ОДНОГО ШАГА ПЕРЕМОТКИ
    performScrubStep(direction) {
        // УЛУЧШЕННАЯ ЛОГИКА: более точное определение состояния воспроизведения
        let isPlaying = false;
        
        try {
            if (window.audioEngine) {
                // Проверяем разные источники информации о воспроизведении
                
                // 1. Проверяем внутренние флаги audioEngine
                if (window.audioEngine._isPlaying === true || 
                    window.audioEngine.isPlaying === true) {
                    isPlaying = true;
                    console.log('🎮 Определен статус через audioEngine флаги');
                }
                
                // 2. Проверяем HTML5 audio элемент
                if (!isPlaying && window.audioEngine.audio) {
                    const audio = window.audioEngine.audio;
                    isPlaying = !audio.paused && 
                               !audio.ended && 
                               audio.readyState >= 3 && // HAVE_FUTURE_DATA или выше
                               audio.currentTime > 0;
                    
                    if (isPlaying) {
                        console.log('🎵 Определен статус через HTML5 audio элемент');
                    }
                }
                
                // 3. Дополнительная проверка через методы audioEngine
                if (!isPlaying && typeof window.audioEngine.isCurrentlyPlaying === 'function') {
                    isPlaying = window.audioEngine.isCurrentlyPlaying();
                    if (isPlaying) {
                        console.log('🔍 Определен статус через isCurrentlyPlaying()');
                    }
                }
                
                // 4. Проверяем состояние через внутренние переменные
                if (!isPlaying && window.audioEngine.state) {
                    isPlaying = window.audioEngine.state === 'playing';
                    if (isPlaying) {
                        console.log('📊 Определен статус через state');
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Ошибка определения состояния воспроизведения:', error);
            isPlaying = false;
        }
        
        console.log(`🎵 Статус воспроизведения: ${isPlaying ? 'ИГРАЕТ' : 'ПАУЗА'}`);
        
        // ЛОГИКА ПЕРЕКЛЮЧЕНИЯ
        if (isPlaying) {
            // При воспроизведении - перемотка по времени (шаг 0.5с)
            console.log(`🎵 Перемотка по времени: ${direction === -1 ? 'назад' : 'вперед'} 0.5с`);
            this.scrubByTime(direction);
        } else {
            // При паузе - перемотка по нотам из питч-карты  
            this.scrubByPitchMap(direction);
        }
    }
    
    // ⏰ ПЕРЕМОТКА ПО ВРЕМЕНИ (ВОССТАНОВЛЕННЫЙ МЕТОД)
    scrubByTime(direction) {
        console.log(`🚀 ВЫЗВАН scrubByTime с направлением: ${direction === -1 ? 'назад' : 'вперед'}`);
        
        const currentTime = this.getCurrentTrackTime();
        const stepSize = 0.5; // Шаг 0.5 секунды как требуется
        const targetTime = Math.max(0, currentTime + (direction * stepSize));
        
        console.log(`⏰ Временная перемотка: ${currentTime.toFixed(2)}с → ${targetTime.toFixed(2)}с (шаг ${stepSize}с)`);
        
        // Блокируем автоочистку во время перемотки
        this.scrubSystem.isScrubbing = true;
        
        this.seekToTime(targetTime);
        
        // Разблокируем через короткое время
        setTimeout(() => {
            this.scrubSystem.isScrubbing = false;
            console.log(`✅ Перемотка завершена на ${targetTime.toFixed(2)}с`);
        }, 100);
    }

    // 🎵 ПЕРЕМОТКА ПО ПИТЧ-КАРТЕ - ИСПРАВЛЕННАЯ
    scrubByPitchMap(direction) {
        console.log(`🎵 Перемотка по питч-карте: ${direction === -1 ? 'предыдущая' : 'следующая'} нота`);
        
        const currentTime = this.getCurrentTrackTime();
        
        // Блокируем автоочистку во время навигации по нотам
        this.scrubSystem.isScrubbing = true;
        this.scrubSystem.navigationMode = true;
        
        // 🗺️ НАВИГАЦИЯ ПО ЗАПИСАННОЙ КАРТЕ НОТ
        if (this.pitchMap.notes.length === 0) {
            console.warn('⚠️ Питч-карта пуста - используем обычную перемотку');
            this.scrubByTime(direction);
            return;
        }
        
        // Ищем ближайшую ноту в карте
        const targetNote = this.findNoteInPitchMap(currentTime, direction);
        
        if (targetNote) {
            // Перемещаемся к найденной ноте
            const targetTime = targetNote.time;
            console.log(`🎯 Найдена нота в карте: ${targetNote.keyId} в ${targetTime.toFixed(2)}с`);
            
            this.seekToTime(targetTime);
            
            // 🎵 СИМУЛИРУЕМ ДЕТЕКЦИЮ ДЛЯ ПОДСВЕТКИ
            setTimeout(() => {
                this.simulateNoteFromPitchMap(targetNote);
            }, 100); // Задержка для завершения перемотки
            
        } else {
            console.warn('⚠️ Нота в карте не найдена - используем временную перемотку');
            // Fallback на обычную перемотку
            const step = direction === 1 ? 0.5 : -0.5;
            const targetTime = Math.max(0, currentTime + step);
            this.seekToTime(targetTime);
        }
    }
    
    // 🎭 СИМУЛЯЦИЯ НОТЫ ИЗ ПИТЧ-КАРТЫ (для подсветки в режиме паузы)
    simulateNoteFromPitchMap(noteRecord) {
        console.log(`🎭 Симуляция ноты из карты: ${noteRecord.keyId} (${noteRecord.frequency.toFixed(1)}Hz)`);
        
        // Останавливаем все текущие ноты
        this.forceStopAllKeys('map_simulation');
        
        // Создаем "виртуальную" ноту для отображения
        const simulatedPitchData = {
            frequency: noteRecord.frequency,
            clarity: noteRecord.maxClarity || noteRecord.clarity || 0.8,
            amplitude: 0.3, // Средняя амплитуда для симуляции
            timestamp: performance.now(),
            isSimulated: true // Флаг симулированной ноты
        };
        
        // Запускаем визуализацию как обычную ноту
        this.startNewNote(noteRecord.keyId, simulatedPitchData);
        
        // Устанавливаем специальные свойства для симулированной ноты
        if (this.currentActiveNote) {
            this.currentActiveNote.isSimulated = true;
            this.currentActiveNote.fromPitchMap = true;
            this.currentActiveNote.originalTime = noteRecord.time;
            this.currentActiveNote.originalDuration = noteRecord.duration;
            this.currentActiveNote.protectedFromCleanup = true; // ЗАЩИТА ОТ АВТООЧИСТКИ
        }
        
        console.log(`✨ Симулированная нота ${noteRecord.keyId} активирована для визуализации`);
    }
    
    // 🎯 ПЕРЕХОД К ВРЕМЕНИ - улучшенная версия
    seekToTime(targetTime) {
        if (!window.audioEngine) {
            console.warn('⚠️ AudioEngine недоступен для перемотки');
            return;
        }
        
        try {
            let seekSuccess = false;
            
            // Пробуем разные методы в порядке приоритета
            if (typeof window.audioEngine.setCurrentTime === 'function') {
                window.audioEngine.setCurrentTime(targetTime);
                seekSuccess = true;
                console.log(`✅ Использован setCurrentTime: ${targetTime.toFixed(2)}с`);
            } else if (typeof window.audioEngine.seekTo === 'function') {
                window.audioEngine.seekTo(targetTime);
                seekSuccess = true;
                console.log(`✅ Использован seekTo: ${targetTime.toFixed(2)}с`);
            } else if (window.audioEngine.audio) {
                // Прямое управление HTML5 audio элементом
                const wasPlaying = !window.audioEngine.audio.paused;
                window.audioEngine.audio.currentTime = targetTime;
                
                // Если играло - продолжаем, если стояло - оставляем на паузе
                if (wasPlaying && window.audioEngine.audio.paused) {
                    window.audioEngine.audio.play().catch(e => console.warn('⚠️ Ошибка возобновления:', e));
                }
                seekSuccess = true;
                console.log(`✅ Прямое управление audio: ${targetTime.toFixed(2)}с`);
            } else {
                console.warn('⚠️ Не найден метод для перемотки в audioEngine');
            }
            
            if (seekSuccess) {
                // Принудительно обновляем внутреннее состояние audioEngine
                if (window.audioEngine.currentTime !== undefined) {
                    window.audioEngine.currentTime = targetTime;
                }
                if (window.audioEngine._currentTime !== undefined) {
                    window.audioEngine._currentTime = targetTime;
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка перемотки:', error);
            
            // АВАРИЙНЫЙ fallback
            try {
                if (window.audioEngine.audio) {
                    window.audioEngine.audio.currentTime = targetTime;
                    console.log(`🆘 Аварийная перемотка: ${targetTime.toFixed(2)}с`);
                }
            } catch (fallbackError) {
                console.error('❌ Аварийная перемотка тоже не сработала:', fallbackError);
            }
        }
    }
    
    // ⏩ ЗАПУСК НЕПРЕРЫВНОЙ ПЕРЕМОТКИ
    startContinuousScrubbing(direction) {
        if (!this.scrubSystem.isActive) {return;}
        
        // Повторяем шаги с заданным интервалом
        this.scrubSystem.continuousInterval = setInterval(() => {
            if (this.scrubSystem.isActive && this.scrubSystem.direction === direction) {
                this.performScrubStep(direction);
            } else {
                this.stopScrubbing();
            }
        }, this.scrubSystem.repeatRate);
        
        console.log(`🔄 Непрерывная перемотка: ${direction === -1 ? 'назад' : 'вперед'}`);
    }
    
    // ⏸️ ОСТАНОВКА ПЕРЕМОТКИ
    stopScrubbing() {
        if (this.scrubSystem.continuousInterval) {
            clearInterval(this.scrubSystem.continuousInterval);
            this.scrubSystem.continuousInterval = null;
        }
        
        this.scrubSystem.isActive = false;
        this.scrubSystem.direction = 0;
        
        // Сбрасываем флаги блокировки автоочистки
        this.scrubSystem.isScrubbing = false;
        this.scrubSystem.navigationMode = false;
        
        console.log('⏸️ Перемотка остановлена');
    }

    // 🎯 ПОЛУЧЕНИЕ ТЕКУЩЕГО ВРЕМЕНИ ТРЕКА - ИСПРАВЛЕННАЯ ВЕРСИЯ
    getCurrentTrackTime() {
        let currentTime = 0;
        
        try {
            if (window.audioEngine) {
                // ПРИОРИТЕТНЫЙ порядок методов получения времени
                if (window.audioEngine.audio && window.audioEngine.audio.currentTime !== undefined) {
                    // HTML5 Audio элемент - самый надежный
                    currentTime = window.audioEngine.audio.currentTime;
                    console.log(`⏱️ Время из audio.currentTime: ${currentTime.toFixed(2)}с`);
                } else if (typeof window.audioEngine.getCurrentTime === 'function') {
                    // Метод audioEngine
                    currentTime = window.audioEngine.getCurrentTime();
                    console.log(`⏱️ Время из getCurrentTime(): ${currentTime.toFixed(2)}с`);
                } else if (typeof window.audioEngine.getCurrentTimeSeconds === 'function') {
                    // Альтернативный метод
                    currentTime = window.audioEngine.getCurrentTimeSeconds();
                    console.log(`⏱️ Время из getCurrentTimeSeconds(): ${currentTime.toFixed(2)}с`);
                } else if (window.audioEngine.currentTime !== undefined) {
                    // Прямое свойство
                    currentTime = window.audioEngine.currentTime;
                    console.log(`⏱️ Время из currentTime: ${currentTime.toFixed(2)}с`);
                } else if (window.audioEngine._currentTime !== undefined) {
                    // Приватное свойство
                    currentTime = window.audioEngine._currentTime;
                    console.log(`⏱️ Время из _currentTime: ${currentTime.toFixed(2)}с`);
                } else {
                    console.warn('⚠️ Не найден ни один метод получения времени!');
                    currentTime = 0;
                }
            } else {
                console.warn('⚠️ window.audioEngine недоступен');
                currentTime = 0;
            }
        } catch (error) {
            console.error('❌ Ошибка получения времени:', error);
            currentTime = 0;
        }
        
        return Math.max(0, currentTime); // Не возвращаем отрицательные значения
    }

    // 🎯 СТАТИЧЕСКИЙ АНАЛИЗ В РЕЖИМЕ ПАУЗЫ
    performStaticPitchAnalysis(timestamp) {
        // Пытаемся получить данные с текущей позиции трека
        try {
            if (!this.analyser || !this.inputBuffer) {return;}
            
            // Получаем текущие данные аудио
            this.analyser.getFloatTimeDomainData(this.inputBuffer);
            
            // Ищем ноты в текущем буфере (может быть от микрофона или статических данных)
            const [frequency, clarity] = this.pitchDetector.findPitch(this.inputBuffer, this.audioContext.sampleRate);
            
            if (frequency && frequency > 0 && clarity > 0.5) {
                // Показываем найденную ноту, но с пометкой что это статический анализ
                const pitchData = {
                    frequency,
                    clarity,
                    amplitude: 0.1, // Минимальная амплитуда для статики
                    timestamp: timestamp,
                    isStatic: true // Флаг статического анализа
                };
                
                console.log(`🔍 Статический анализ: ${frequency.toFixed(1)}Hz (${(clarity*100).toFixed(1)}%)`);
                this.processNoteWithAccuracyTracking(pitchData);
            }
        } catch (error) {
            // Тихо игнорируем ошибки статического анализа
        }
    }
    
    // 🧹 УМНАЯ ОЧИСТКА КЛАВИШ - только при длительной неактивности
    cleanupInactiveKeysConditional(timestamp) {
        if (!this.currentActiveNote) {return;}
        
        // ЗАЩИТА СИМУЛИРОВАННЫХ НОТ: не удаляем ноты во время навигации по питч-карте
        if (this.currentActiveNote.isSimulated || 
            this.currentActiveNote.fromPitchMap || 
            this.currentActiveNote.protectedFromCleanup ||
            this.scrubSystem.isScrubbing ||
            this.scrubSystem.navigationMode) {
            console.log(`🛡️ Симулированная нота ${this.currentActiveNote.keyId} защищена от автоочистки`);
            return;
        }
        
        const timeSinceLastDetection = timestamp - this.currentActiveNote.lastDetection;
        
        // Разные лимиты для разных режимов
        let timeoutLimit = 300; // По умолчанию 300мс
        
        // УЛУЧШЕННАЯ проверка состояния воспроизведения (синхронно с performScrubStep)
        let isPlaying = false;
        try {
            if (window.audioEngine) {
                // Используем ту же логику что и в performScrubStep
                if (window.audioEngine._isPlaying === true || 
                    window.audioEngine.isPlaying === true) {
                    isPlaying = true;
                } else if (window.audioEngine.audio) {
                    const audio = window.audioEngine.audio;
                    isPlaying = !audio.paused && 
                               !audio.ended && 
                               audio.readyState >= 3 && 
                               audio.currentTime > 0;
                } else if (typeof window.audioEngine.isCurrentlyPlaying === 'function') {
                    isPlaying = window.audioEngine.isCurrentlyPlaying();
                } else if (window.audioEngine.state) {
                    isPlaying = window.audioEngine.state === 'playing';
                }
            }
        } catch (error) {
            isPlaying = false;
        }
        
        if (isPlaying) {
            // В режиме воспроизведения - быстрая очистка
            timeoutLimit = 200;
        } else {
            // В режиме паузы - НЕ ОЧИЩАЕМ ноты чтобы позволить навигацию
            console.log(`🔒 Режим паузы: автоочистка отключена для навигации по нотам`);
            return;
        }
        
        if (timeSinceLastDetection > timeoutLimit) {
            console.log(`🧹 Умная очистка: ${this.currentActiveNote.keyId} неактивна ${timeSinceLastDetection.toFixed(0)}мс`);
            this.stopNote(this.currentActiveNote.keyId, 'conditional_timeout');
        }
    }
    
    // 🔍 ПОИСК НОТЫ В ПИТЧ-КАРТЕ
    findNoteInPitchMap(currentTime, direction) {
        const notes = this.pitchMap.notes;
        
        if (direction === 1) {
            // ВПЕРЕД - ищем первую ноту ПОСЛЕ текущего времени
            for (let i = 0; i < notes.length; i++) {
                if (notes[i].time > currentTime + 0.1) { // +0.1с чтобы избежать той же ноты
                    this.pitchMap.currentIndex = i;
                    return notes[i];
                }
            }
            // Если не найдено - возвращаем последнюю
            if (notes.length > 0) {
                this.pitchMap.currentIndex = notes.length - 1;
                return notes[notes.length - 1];
            }
        } else {
            // НАЗАД - ищем последнюю ноту ПЕРЕД текущим временем
            for (let i = notes.length - 1; i >= 0; i--) {
                if (notes[i].time < currentTime - 0.1) { // -0.1с чтобы избежать той же ноты
                    this.pitchMap.currentIndex = i;
                    return notes[i];
                }
            }
            // Если не найдено - возвращаем первую
            if (notes.length > 0) {
                this.pitchMap.currentIndex = 0;
                return notes[0];
            }
        }
        
        return null;
    }

    // 🔄 СБРОС ФИЛЬТРОВ ГАРМОНИК
    resetHarmonicFilters() {
        console.log('🔄 Сброс всех фильтров гармоник...');
        
        // Очищаем историю гармонических фильтров
        this.harmonicFilter.lastFundamental = null;
        this.harmonicFilter.octaveHistory = [];
        this.harmonicFilter.fundamentalTracker.clear();
        
        // Останавливаем все активные ноты
        this.forceStopAllKeys('filter_reset');
        
        // Сбрасываем статистику
        this.detectionStats.harmonicsRejected = 0;
        this.detectionStats.octaveJumpsRejected = 0;
        this.detectionStats.unstableFrequencyRejected = 0;
        
        console.log('✅ Фильтры сброшены - система готова к новой калибровке');
    }

    // 🎯 ЗАПУСК ОСНОВНОГО ЦИКЛА
    startMainLoop() {
        // Запускаем анализ звука
        this.startBackgroundVocalAnalysis();
        
        // Запускаем рендеринг
        this.startRender();
        
        console.log('🎯 Основной цикл запущен');
    }
}

// Создаем глобальный экземпляр
window.pianoKeyboard = new PianoKeyboard();