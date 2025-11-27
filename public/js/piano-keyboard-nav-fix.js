// КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ НАВИГАЦИИ ПО НОТАМ
// Применить в js/piano-keyboard.js

// 1. ИСПРАВЛЕННЫЙ МЕТОД findNoteInPitchMap (строка ~2030)
findNoteInPitchMap(currentTime, direction) {
    const notes = this.pitchMap.notes;
    
    if (!notes || notes.length === 0) {
        console.warn('⚠️ Питч-карта пуста!');
        return null;
    }

    console.log(`🔍 Поиск ноты: время=${currentTime.toFixed(2)}с, направление=${direction === 1 ? 'вперед' : 'назад'}, всего нот=${notes.length}`);
    
    if (direction === 1) {
        // ВПЕРЕД - используем индексный поиск
        let currentIndex = this.pitchMap.currentIndex || 0;
        
        // Если текущий индекс не установлен, найдем ближайший к текущему времени
        if (currentIndex === 0 || !this.pitchMap.hasOwnProperty('currentIndex')) {
            for (let i = 0; i < notes.length; i++) {
                if (notes[i].time >= currentTime) {
                    currentIndex = i;
                    break;
                }
            }
        }
        
        // Ищем следующую ноту
        let nextIndex = currentIndex + 1;
        if (nextIndex >= notes.length) {
            // Достигли конца - остаемся на последней ноте
            nextIndex = notes.length - 1;
            console.log(`🔚 Достигнут конец карты, остаемся на ноте ${nextIndex}`);
        }
        
        this.pitchMap.currentIndex = nextIndex;
        const foundNote = notes[nextIndex];
        console.log(`➡️ Найдена нота вперед: ${foundNote.keyId} в ${foundNote.time.toFixed(2)}с (индекс ${nextIndex})`);
        return foundNote;
        
    } else {
        // НАЗАД - используем индексный поиск
        let currentIndex = this.pitchMap.currentIndex || 0;
        
        // Если текущий индекс не установлен, найдем ближайший к текущему времени
        if (currentIndex === 0 || !this.pitchMap.hasOwnProperty('currentIndex')) {
            for (let i = notes.length - 1; i >= 0; i--) {
                if (notes[i].time <= currentTime) {
                    currentIndex = i;
                    break;
                }
            }
        }
        
        // Ищем предыдущую ноту
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            // Достигли начала - остаемся на первой ноте
            prevIndex = 0;
            console.log(`🔚 Достигнуто начало карты, остаемся на ноте 0`);
        }
        
        this.pitchMap.currentIndex = prevIndex;
        const foundNote = notes[prevIndex];
        console.log(`⬅️ Найдена нота назад: ${foundNote.keyId} в ${foundNote.time.toFixed(2)}с (индекс ${prevIndex})`);
        return foundNote;
    }
}

// 2. УЛУЧШЕННЫЙ МЕТОД simulateNoteFromPitchMap (строка ~1776)
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
        isSimulated: true, // Флаг симулированной ноты
        fromPitchMap: true, // Флаг ноты из карты
        protectedFromUpdate: true // ЗАЩИТА ОТ ОБНОВЛЕНИЙ
    };
    
    // Запускаем визуализацию как обычную ноту
    this.startNewNote(noteRecord.keyId, simulatedPitchData);
    
    // Устанавливаем специальные свойства для симулированной ноты
    if (this.currentActiveNote) {
        this.currentActiveNote.isSimulated = true;
        this.currentActiveNote.fromPitchMap = true;
        this.currentActiveNote.originalTime = noteRecord.time;
        this.currentActiveNote.originalDuration = noteRecord.duration;
        this.currentActiveNote.protectedFromCleanup = true;
        this.currentActiveNote.protectedFromUpdate = true; // НОВАЯ ЗАЩИТА
        
        // ФИКСИРУЕМ ДЛИТЕЛЬНОСТЬ - НЕ ПОЗВОЛЯЕМ ЕЙ РАСТИ
        this.currentActiveNote.lastDetection = this.currentActiveNote.startTime;
    }
    
    console.log(`✨ Симулированная нота ${noteRecord.keyId} активирована (ЗАЩИЩЕНА ОТ ОБНОВЛЕНИЙ)`);
}

// 3. УЛУЧШЕННЫЙ МЕТОД updateExistingNote (строка ~989)
updateExistingNote(keyId, pitchData) {
    const { frequency, clarity, amplitude, timestamp } = pitchData;
    const noteData = this.activeNotes.get(keyId);
    
    if (!noteData) return;
    
    // УСИЛЕННАЯ ЗАЩИТА СИМУЛИРОВАННЫХ НОТ
    if (noteData.isSimulated || 
        noteData.fromPitchMap || 
        noteData.protectedFromCleanup ||
        noteData.protectedFromUpdate) {
        console.log(`🛡️ Симулированная нота ${keyId} полностью защищена от обновлений`);
        return;
    }
    
    // Обновляем данные только для реальных нот
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