// 🎯 ИСПРАВЛЕННАЯ СИСТЕМА НАВИГАЦИИ ПО НОТАМ
// Замените соответствующие методы в piano-keyboard.js

// 🗺️ УЛУЧШЕННАЯ ЗАПИСЬ В ПИТЧ-КАРТУ (исключает подъезды)
recordToPitchMapFixed(keyId, pitchData) {
    // Записываем только если трек воспроизводится (не статический анализ)
    if (!this.isTrackPlaying() || pitchData.isStatic) return;
    
    const currentTime = this.getCurrentTrackTime();
    if (currentTime < 0) return; // Некорректное время
    
    const { frequency, clarity } = pitchData;
    
    // 🚫 ФИЛЬТРАЦИЯ ПОДЪЕЗДОВ ПРИ ЗАПИСИ В КАРТУ
    if (this.isGlideToNote && this.isGlideToNote(pitchData, keyId)) {
        console.log(`🚫 Подъезд не записан в карту: ${keyId}`);
        return; // Не записываем подъезды в карту
    }
    
    // 🚫 ФИЛЬТРАЦИЯ ГАРМОНИЧЕСКИХ СКАЧКОВ
    if (this.isHarmonicJump && this.isHarmonicJump(frequency, this.currentActiveNote)) {
        console.log(`🚫 Гармонический скачок не записан в карту: ${keyId}`);
        return; // Не записываем гармоники в карту
    }
    
    // 🎯 ТРЕБОВАНИЯ К КАЧЕСТВУ ДЛЯ ЗАПИСИ В КАРТУ
    if (clarity < 0.6) { // Минимальная четкость
        console.log(`🚫 Низкая четкость не записана в карту: ${keyId} (${(clarity*100).toFixed(1)}%)`);
        return; // Не записываем неточные ноты
    }
    
    // Проверяем, нужно ли записать новую ноту или обновить существующую
    const lastNote = this.pitchMap.notes[this.pitchMap.notes.length - 1];
    
    if (lastNote && 
        lastNote.keyId === keyId && 
        (currentTime - lastNote.time) < 0.3) { // Уменьшил окно до 0.3с для точности
        
        // Обновляем существующую ноту - продлеваем её
        lastNote.endTime = currentTime;
        lastNote.duration = lastNote.endTime - lastNote.time;
        lastNote.maxClarity = Math.max(lastNote.maxClarity || clarity, clarity);
        lastNote.detectionCount = (lastNote.detectionCount || 1) + 1;
        lastNote.isMainNote = true; // Отмечаем как основную ноту
        
    } else {
        // Завершаем предыдущую ноту
        if (lastNote && !lastNote.endTime) {
            lastNote.endTime = currentTime;
            lastNote.duration = lastNote.endTime - lastNote.time;
        }
        
        // 🎯 ПРОВЕРКА НА МИНИМАЛЬНУЮ ДЛИТЕЛЬНОСТЬ
        const minDuration = 0.15; // Минимум 150мс для записи
        if (lastNote && lastNote.duration > 0 && lastNote.duration < minDuration) {
            console.log(`🚫 Короткая нота удалена из карты: ${lastNote.keyId} (${lastNote.duration.toFixed(2)}с)`);
            this.pitchMap.notes.pop(); // Удаляем слишком короткую ноту
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
            detectionCount: 1,
            isMainNote: true, // Флаг основной ноты
            qualityScore: clarity, // Оценка качества ноты
            source: 'detection' // Источник: детекция
        };
        
        this.pitchMap.notes.push(noteRecord);
        
        // Обновляем индекс для быстрого поиска
        const timeKey = Math.floor(currentTime * 10) / 10; // Округляем до 0.1с
        if (!this.pitchMap.timeIndex.has(timeKey)) {
            this.pitchMap.timeIndex.set(timeKey, []);
        }
        this.pitchMap.timeIndex.get(timeKey).push(this.pitchMap.notes.length - 1);
        
        console.log(`🗺️ КАЧЕСТВЕННАЯ нота записана в карту: ${keyId} в ${currentTime.toFixed(2)}с (${frequency.toFixed(1)}Hz, качество: ${(clarity*100).toFixed(1)}%)`);
    }
    
    // Включаем запись если ещё не включена
    if (!this.pitchMap.isRecording) {
        this.pitchMap.isRecording = true;
        console.log('🗺️ Запись ЧИСТОЙ питч-карты АКТИВИРОВАНА');
    }
}

// 🎯 ИНТЕЛЛЕКТУАЛЬНЫЙ ПОИСК НОТ В КАРТЕ
findNoteInPitchMapFixed(currentTime, direction) {
    const notes = this.pitchMap.notes.filter(note => note.isMainNote); // Только основные ноты
    
    if (notes.length === 0) {
        console.warn('⚠️ Нет основных нот в карте');
        return null;
    }
    
    console.log(`🔍 Поиск ноты: время=${currentTime.toFixed(2)}с, направление=${direction === 1 ? 'вперед' : 'назад'}, нот в карте=${notes.length}`);
    
    if (direction === 1) {
        // ВПЕРЕД - ищем первую основную ноту ПОСЛЕ текущего времени
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].time > currentTime + 0.05) { // +0.05с для точности
                console.log(`➡️ Найдена следующая нота: ${notes[i].keyId} в ${notes[i].time.toFixed(2)}с`);
                return notes[i];
            }
        }
        // Если достигли конца - остаемся на последней
        const lastNote = notes[notes.length - 1];
        console.log(`🔚 Достигнут конец карты, остаемся на: ${lastNote.keyId}`);
        return lastNote;
        
    } else {
        // НАЗАД - ищем последнюю основную ноту ПЕРЕД текущим временем
        for (let i = notes.length - 1; i >= 0; i--) {
            if (notes[i].time < currentTime - 0.05) { // -0.05с для точности
                console.log(`⬅️ Найдена предыдущая нота: ${notes[i].keyId} в ${notes[i].time.toFixed(2)}с`);
                return notes[i];
            }
        }
        // Если достигли начала - переходим к первой
        const firstNote = notes[0];
        console.log(`🔚 Достигнуто начало карты, переходим к: ${firstNote.keyId}`);
        return firstNote;
    }
}

// 🎯 УЛУЧШЕННАЯ НАВИГАЦИЯ ПО КАРТАМ С СИММЕТРИЧНОЙ ЛОГИКОЙ
scrubByPitchMapFixed(direction) {
    console.log(`🎵 ТОЧНАЯ перемотка по питч-карте: ${direction === -1 ? 'предыдущая' : 'следующая'} нота`);
    
    const currentTime = this.getCurrentTrackTime();
    
    // Блокируем автоочистку во время навигации по нотам
    this.scrubSystem.isScrubbing = true;
    this.scrubSystem.navigationMode = true;
    
    // 🗺️ НАВИГАЦИЯ ПО ОЧИЩЕННОЙ КАРТЕ НОТ
    if (this.pitchMap.notes.length === 0) {
        console.warn('⚠️ Питч-карта пуста - используем обычную перемотку');
        this.scrubByTime(direction);
        return;
    }
    
    // Ищем ближайшую КАЧЕСТВЕННУЮ ноту в карте
    const targetNote = this.findNoteInPitchMapFixed(currentTime, direction);
    
    if (targetNote) {
        // Перемещаемся к найденной ноте
        const targetTime = targetNote.time;
        console.log(`🎯 Переход к КАЧЕСТВЕННОЙ ноте: ${targetNote.keyId} в ${targetTime.toFixed(2)}с (качество: ${(targetNote.maxClarity*100).toFixed(1)}%)`);
        
        this.seekToTime(targetTime);
        
        // 🎵 СИМУЛИРУЕМ ДЕТЕКЦИЮ ДЛЯ ПОДСВЕТКИ
        setTimeout(() => {
            this.simulateNoteFromPitchMapFixed(targetNote);
        }, 100); // Задержка для завершения перемотки
        
    } else {
        console.warn('⚠️ Качественная нота в карте не найдена - используем временную перемотку');
        // Fallback на обычную перемотку
        const step = direction === 1 ? 0.5 : -0.5;
        const targetTime = Math.max(0, currentTime + step);
        this.seekToTime(targetTime);
    }
}

// 🎭 УЛУЧШЕННАЯ СИМУЛЯЦИЯ НОТЫ ИЗ ПИТЧ-КАРТЫ
simulateNoteFromPitchMapFixed(noteRecord) {
    console.log(`🎭 Симуляция КАЧЕСТВЕННОЙ ноты: ${noteRecord.keyId} (${noteRecord.frequency.toFixed(1)}Hz, качество: ${(noteRecord.maxClarity*100).toFixed(1)}%)`);
    
    // Останавливаем все текущие ноты
    this.forceStopAllKeys('map_simulation');
    
    // Создаем "виртуальную" ноту для отображения с высоким качеством
    const simulatedPitchData = {
        frequency: noteRecord.frequency,
        clarity: noteRecord.maxClarity || 0.8,
        amplitude: 0.4, // Увеличенная амплитуда для симуляции
        timestamp: performance.now(),
        isSimulated: true, // Флаг симулированной ноты
        isMainNote: true, // Флаг основной ноты
        fromCleanMap: true // Флаг что из очищенной карты
    };
    
    // Запускаем визуализацию как обычную ноту
    this.startNewNote(noteRecord.keyId, simulatedPitchData);
    
    // Устанавливаем специальные свойства для симулированной ноты
    if (this.currentActiveNote) {
        this.currentActiveNote.isSimulated = true;
        this.currentActiveNote.fromPitchMap = true;
        this.currentActiveNote.isMainNote = true;
        this.currentActiveNote.originalTime = noteRecord.time;
        this.currentActiveNote.originalDuration = noteRecord.duration;
        this.currentActiveNote.qualityScore = noteRecord.maxClarity;
        this.currentActiveNote.protectedFromCleanup = true; // ЗАЩИТА ОТ АВТООЧИСТКИ
        
        console.log(`🛡️ Симулированная нота ${noteRecord.keyId} защищена от автоочистки`);
    }
    
    console.log(`✨ Качественная симулированная нота ${noteRecord.keyId} активирована для визуализации`);
}

// 🧹 ОЧИСТКА КАРТЫ ОТ АРТЕФАКТОВ (вызывать после записи)
cleanupPitchMap() {
    if (this.pitchMap.notes.length === 0) return;
    
    console.log(`🧹 Очистка питч-карты: было ${this.pitchMap.notes.length} нот`);
    
    const cleanNotes = [];
    const minDuration = 0.1; // Минимум 100мс
    const minClarity = 0.5; // Минимум 50% четкости
    
    for (const note of this.pitchMap.notes) {
        // Фильтруем по качеству и длительности
        if (note.duration >= minDuration && 
            note.maxClarity >= minClarity && 
            note.isMainNote) {
            cleanNotes.push(note);
        } else {
            console.log(`🗑️ Удалена некачественная нота: ${note.keyId} (${note.duration?.toFixed(2)}с, ${(note.maxClarity*100).toFixed(1)}%)`);
        }
    }
    
    this.pitchMap.notes = cleanNotes;
    console.log(`✅ Очистка завершена: осталось ${cleanNotes.length} качественных нот`);
    
    // Перестраиваем индекс
    this.pitchMap.timeIndex.clear();
    cleanNotes.forEach((note, index) => {
        const timeKey = Math.floor(note.time * 10) / 10;
        if (!this.pitchMap.timeIndex.has(timeKey)) {
            this.pitchMap.timeIndex.set(timeKey, []);
        }
        this.pitchMap.timeIndex.get(timeKey).push(index);
    });
}

// ИНСТРУКЦИИ ПО ПРИМЕНЕНИЮ:
// 1. Замените recordToPitchMap на recordToPitchMapFixed
// 2. Замените findNoteInPitchMap на findNoteInPitchMapFixed  
// 3. Замените scrubByPitchMap на scrubByPitchMapFixed
// 4. Замените simulateNoteFromPitchMap на simulateNoteFromPitchMapFixed
// 5. Добавьте вызов cleanupPitchMap() при паузе трека 