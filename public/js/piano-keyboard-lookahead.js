// 🎵 LOOK-AHEAD СИСТЕМА АНАЛИЗА ПИТЧА - РЕВОЛЮЦИОННАЯ АРХИТЕКТУРА
// Автор: AI Assistant, дата: 2025

class PitchLookAheadSystem {
    constructor(pianoKeyboard) {
        this.keyboard = pianoKeyboard;
        
        // 🎯 CORE СИСТЕМЫ - АНАЛИЗ ОСНОВНОЙ ЛИНИИ VS АРТЕФАКТЫ
        this.lookahead = {
            // Буфер предсканирования (5 секунд вперед)
            scanBuffer: [],
            scanWindow: 5.0, // секунд
            analysisResolution: 0.1, // шаг анализа 100мс
            
            // Детекция паттернов
            mainLineDetector: {
                confidenceThreshold: 0.7,
                stabilityWindow: 1.0, // секунда для определения стабильности
                fundamentalTracker: new Map(), // частота -> количество детекций
                harmonicRatios: [0.5, 2.0, 3.0, 4.0], // обычные гармоники
            },
            
            // Классификация нот
            noteClassifier: {
                mainLine: [], // основная мелодическая линия
                artifacts: [], // гармоники, артефакты, ошибки детекции
                transitions: [], // переходные ноты
                sustained: [], // долгие ноты
            },
            
            // Статистика обучения
            learningStats: {
                analyzedSamples: 0,
                mainLineConfidence: 0,
                artifactRejectRate: 0,
                octaveJumpAnalysis: new Map(),
            }
        };
        
        // 🎼 НАВИГАЦИОННАЯ СИСТЕМА С ГРАНИЦАМИ
        this.navigation = {
            boundaries: {
                startTime: 0,
                endTime: 0,
                totalNotes: 0,
                validRange: true
            },
            
            currentPosition: {
                index: 0,
                time: 0,
                confidence: 0,
                noteType: 'unknown' // main | artifact | transition
            },
            
            // Интеллектуальные фильтры навигации
            filters: {
                showOnlyMainLine: false,
                skipArtifacts: true,
                groupNearbyNotes: true,
                minNoteDuration: 0.1
            }
        };
        
        // 🧠 МАШИННОЕ ОБУЧЕНИЕ ДЛЯ ПАТТЕРНОВ
        this.ml = {
            patterns: {
                commonProgressions: [], // часто встречающиеся последовательности
                jumpThresholds: new Map(), // пороги для разных типов скачков
                voiceLeading: [], // голосоведение
            },
            
            training: {
                isActive: false,
                samplesNeeded: 100, // минимум для обучения
                currentSamples: 0,
                adaptiveThresholds: true
            }
        };
    }
    
    // 🎯 ИНИЦИАЛИЗАЦИЯ LOOK-AHEAD СКАНИРОВАНИЯ
    async initializeLookAhead(audioBuffer, trackDuration) {
        console.log('🔍 Инициализация Look-Ahead системы...');
        
        // Устанавливаем границы навигации
        this.navigation.boundaries = {
            startTime: 0,
            endTime: trackDuration,
            totalNotes: this.keyboard.pitchMap.notes.length,
            validRange: true
        };
        
        // Запускаем предварительное сканирование
        if (audioBuffer) {
            await this.performPreScan(audioBuffer);
        }
        
        // Инициализируем адаптивные пороги
        this.initializeAdaptiveThresholds();
        
        console.log(`✅ Look-Ahead готов: ${this.navigation.boundaries.totalNotes} нот, диапазон ${trackDuration.toFixed(1)}с`);
    }
    
    // 🔍 ПРЕДВАРИТЕЛЬНОЕ СКАНИРОВАНИЕ ВСЕГО ТРЕКА
    async performPreScan(audioBuffer) {
        console.log('🎵 Предсканирование трека для анализа основной линии...');
        
        const sampleRate = audioBuffer.sampleRate;
        const stepSize = Math.floor(this.lookahead.analysisResolution * sampleRate);
        const windowSize = 2048;
        
        const analysisResults = [];
        
        // Проходим по всему треку с шагом 100мс
        for (let i = 0; i < audioBuffer.length - windowSize; i += stepSize) {
            const timeStamp = i / sampleRate;
            
            // Извлекаем окно аудио
            const window = audioBuffer.getChannelData(0).slice(i, i + windowSize);
            
            // Анализируем питч в этом окне
            const pitchData = await this.analyzePitchWindow(window, sampleRate, timeStamp);
            
            if (pitchData) {
                analysisResults.push(pitchData);
            }
        }
        
        // Анализируем результаты для определения основной линии
        this.analyzeMainLineVsArtifacts(analysisResults);
        
        console.log(`📊 Предсканирование завершено: ${analysisResults.length} точек анализа`);
    }
    
    // 🎼 АНАЛИЗ ОСНОВНОЙ ЛИНИИ VS АРТЕФАКТЫ
    analyzeMainLineVsArtifacts(analysisResults) {
        console.log('🧠 Анализ основной линии и артефактов...');
        
        // 1. ГРУППИРОВКА ПО ЧАСТОТЕ И ВРЕМЕНИ
        const frequencyGroups = this.groupByFrequency(analysisResults);
        
        // 2. ОПРЕДЕЛЕНИЕ СТАБИЛЬНЫХ ЛИНИЙ
        const stableLines = this.findStableFrequencyLines(frequencyGroups);
        
        // 3. КЛАССИФИКАЦИЯ НОТ
        for (const result of analysisResults) {
            const classification = this.classifyNote(result, stableLines);
            
            // Добавляем в соответствующую категорию
            this.lookahead.noteClassifier[classification.type].push({
                ...result,
                confidence: classification.confidence,
                reasoning: classification.reasoning
            });
        }
        
        // 4. ОБНОВЛЯЕМ СТАТИСТИКУ
        this.updateLearningStats();
        
        console.log(`📈 Классификация: ${this.lookahead.noteClassifier.mainLine.length} основных, ${this.lookahead.noteClassifier.artifacts.length} артефактов`);
    }
    
    // 🎯 ИНТЕЛЛЕКТУАЛЬНАЯ НАВИГАЦИЯ С ФИЛЬТРАМИ
    navigateIntelligent(direction, currentTime) {
        // Определяем текущую позицию в классифицированной карте
        const currentIndex = this.findCurrentPositionIndex(currentTime);
        
        // Получаем целевые ноты в зависимости от фильтров
        let targetNotes = this.getFilteredNotes();
        
        if (targetNotes.length === 0) {
            console.warn('⚠️ Нет валидных нот для навигации');
            return null;
        }
        
        // Находим следующую/предыдущую ноту
        let targetIndex = this.findTargetIndex(currentIndex, direction, targetNotes);
        
        // Проверяем границы
        if (targetIndex < 0 || targetIndex >= targetNotes.length) {
            console.log(`🔚 Достигнута граница навигации: ${direction > 0 ? 'конец' : 'начало'}`);
            return null;
        }
        
        const targetNote = targetNotes[targetIndex];
        
        // Обновляем позицию
        this.navigation.currentPosition = {
            index: targetIndex,
            time: targetNote.time,
            confidence: targetNote.confidence || 0.8,
            noteType: targetNote.type || 'main'
        };
        
        console.log(`🎯 Навигация: ${targetNote.keyId} в ${targetNote.time.toFixed(2)}с (${targetNote.type})`);
        return targetNote;
    }
    
    // 🎵 ФИЛЬТРАЦИЯ НОТ ПО КРИТЕРИЯМ
    getFilteredNotes() {
        let notes = [];
        
        if (this.navigation.filters.showOnlyMainLine) {
            notes = [...this.lookahead.noteClassifier.mainLine];
        } else {
            // Включаем основную линию и переходы, исключаем артефакты если нужно
            notes = [
                ...this.lookahead.noteClassifier.mainLine,
                ...this.lookahead.noteClassifier.transitions
            ];
            
            if (!this.navigation.filters.skipArtifacts) {
                notes.push(...this.lookahead.noteClassifier.artifacts);
            }
        }
        
        // Фильтр по длительности
        if (this.navigation.filters.minNoteDuration > 0) {
            notes = notes.filter(note => 
                (note.duration || 0.1) >= this.navigation.filters.minNoteDuration
            );
        }
        
        // Группировка близких нот
        if (this.navigation.filters.groupNearbyNotes) {
            notes = this.groupNearbyNotes(notes);
        }
        
        // Сортируем по времени
        return notes.sort((a, b) => a.time - b.time);
    }
    
    // 🔍 АДАПТИВНЫЕ ПОРОГИ ДЛЯ ОКТАВНЫХ СКАЧКОВ
    initializeAdaptiveThresholds() {
        // Базовые пороги, которые будут адаптироваться
        this.ml.patterns.jumpThresholds.set('octave_up', {
            ratio: 2.0,
            tolerance: 0.05,
            minDuration: 50, // мс
            confidence: 0.8
        });
        
        this.ml.patterns.jumpThresholds.set('octave_down', {
            ratio: 0.5,
            tolerance: 0.025,
            minDuration: 50,
            confidence: 0.8
        });
        
        this.ml.patterns.jumpThresholds.set('double_octave_up', {
            ratio: 4.0,
            tolerance: 0.1,
            minDuration: 100,
            confidence: 0.6
        });
        
        this.ml.patterns.jumpThresholds.set('double_octave_down', {
            ratio: 0.25,
            tolerance: 0.05,
            minDuration: 100,
            confidence: 0.6
        });
    }
    
    // 🧠 УЛУЧШЕННАЯ ДЕТЕКЦИЯ ОКТАВНЫХ СКАЧКОВ
    analyzeOctaveJump(currentFreq, newFreq, duration, context) {
        const ratio = newFreq / currentFreq;
        
        // Проверяем каждый тип скачка
        for (const [jumpType, threshold] of this.ml.patterns.jumpThresholds) {
            const expectedRatio = threshold.ratio;
            const tolerance = threshold.tolerance;
            
            if (Math.abs(ratio - expectedRatio) <= tolerance) {
                // Анализируем контекст для принятия решения
                const decision = this.analyzeJumpContext(jumpType, ratio, duration, context);
                
                // Обновляем статистику для обучения
                this.updateJumpStatistics(jumpType, decision, context);
                
                return {
                    type: jumpType,
                    shouldAllow: decision.allow,
                    confidence: decision.confidence,
                    reasoning: decision.reasoning
                };
            }
        }
        
        return { type: 'normal', shouldAllow: true, confidence: 1.0 };
    }
    
    // 🎯 КОНТЕКСТНЫЙ АНАЛИЗ СКАЧКОВ
    analyzeJumpContext(jumpType, ratio, duration, context) {
        const threshold = this.ml.patterns.jumpThresholds.get(jumpType);
        let confidence = threshold.confidence;
        let reasoning = [];
        
        // 1. Анализ длительности ноты
        if (duration >= threshold.minDuration) {
            confidence += 0.1;
            reasoning.push('достаточная_длительность');
        } else {
            confidence -= 0.2;
            reasoning.push('короткая_нота');
        }
        
        // 2. Анализ мелодического контекста
        if (context.previousNotes && context.previousNotes.length > 0) {
            const melodicDirection = this.analyzeMelodicDirection(context.previousNotes);
            if (melodicDirection.trend === 'ascending' && jumpType.includes('up')) {
                confidence += 0.15;
                reasoning.push('мелодическое_восхождение');
            } else if (melodicDirection.trend === 'descending' && jumpType.includes('down')) {
                confidence += 0.15;
                reasoning.push('мелодическое_нисхождение');
            }
        }
        
        // 3. Анализ гармонического контекста
        if (context.accompaniment) {
            const harmonicFit = this.analyzeHarmonicFit(ratio, context.accompaniment);
            confidence += harmonicFit.score * 0.2;
            reasoning.push(`гармония_${harmonicFit.quality}`);
        }
        
        // 4. Частотный анализ подобных скачков
        const jumpHistory = this.ml.patterns.jumpAnalysisHistory.get(jumpType) || [];
        if (jumpHistory.length > 10) {
            const successRate = jumpHistory.filter(h => h.wasCorrect).length / jumpHistory.length;
            confidence = confidence * 0.7 + successRate * 0.3;
            reasoning.push(`история_${successRate.toFixed(2)}`);
        }
        
        return {
            allow: confidence > 0.6,
            confidence: Math.max(0, Math.min(1, confidence)),
            reasoning: reasoning.join(', ')
        };
    }
}

// 🎯 ИНТЕГРАЦИЯ С СУЩЕСТВУЮЩЕЙ СИСТЕМОЙ
// Добавить в constructor PianoKeyboard:
/*
this.lookAhead = new PitchLookAheadSystem(this);
*/

// 🎯 ПЛАН ВНЕДРЕНИЯ:
/*
ЭТАП 1 (НЕМЕДЛЕННО):
- Исправить навигацию с границами
- Добавить базовую классификацию нот
- Восстановить октавные скачки

ЭТАП 2 (1-2 дня):
- Внедрить предсканирование
- Обучающиеся алгоритмы
- Адаптивные пороги

ЭТАП 3 (ДАЛЬНЕЙШЕЕ РАЗВИТИЕ):
- ML модели для паттернов
- Экспорт/импорт настроек
- Пользовательская калибровка
*/ 