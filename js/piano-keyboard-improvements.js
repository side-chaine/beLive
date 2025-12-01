// 🎯 УЛУЧШЕНИЯ ДЛЯ PIANO-KEYBOARD.JS
// Добавить эти методы в класс PianoKeyboard

// 🎯 ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕЙ НОТЫ С ИСПРАВЛЕНИЕМ ТАЙМЕРА
updateExistingNoteFixed(keyId, pitchData) {
    const { frequency, clarity, amplitude, timestamp = performance.now() } = pitchData;
    const noteData = this.activeNotes.get(keyId);
    
    if (!noteData) return;
    
    // Обновляем данные с правильным timestamp
    noteData.lastDetection = timestamp;
    noteData.maxClarity = Math.max(noteData.maxClarity, clarity);
    noteData.maxAmplitude = Math.max(noteData.maxAmplitude, amplitude || 0.1);
    noteData.detectionCount++;
    noteData.currentFrequency = frequency;
    
    // Каждые 10 детекций логируем важные обновления
    if (noteData.detectionCount % 10 === 0) {
        const duration = timestamp - noteData.startTime;
        console.log(`🔄 ОБНОВЛЕНИЕ ${keyId}: ${duration.toFixed(0)}мс, обновлений: ${noteData.detectionCount}, точность: ${(clarity*100).toFixed(1)}%`);
    }
}

// 🚫 ФИЛЬТРАЦИЯ ПОДЪЕЗДОВ К НОТАМ
isGlideToNote(pitchData, targetKeyId) {
    const { frequency, clarity } = pitchData;
    
    // Если нет активной ноты, то это не подъезд
    if (!this.currentActiveNote) return false;
    
    const currentKeyId = this.currentActiveNote.keyId;
    const currentFreq = this.currentActiveNote.currentFrequency;
    
    // Если это та же нота, то не подъезд
    if (currentKeyId === targetKeyId) return false;
    
    // Вычисляем расстояние между нотами в полутонах
    const currentNote = this.noteIdToMidiNote(currentKeyId);
    const targetNote = this.noteIdToMidiNote(targetKeyId);
    const semitoneDistance = Math.abs(targetNote - currentNote);
    
    // Если расстояние больше 2 полутонов, то это не подъезд
    if (semitoneDistance > 2) return false;
    
    // Проверяем направление движения частоты
    const freqRatio = frequency / currentFreq;
    const expectedDirection = targetNote > currentNote ? 'up' : 'down';
    const actualDirection = freqRatio > 1 ? 'up' : 'down';
    
    // Если направление не совпадает, то это не подъезд
    if (expectedDirection !== actualDirection) return false;
    
    // Проверяем, что частота находится между текущей и целевой
    const targetFreq = this.noteIdToFrequency(targetKeyId);
    const minFreq = Math.min(currentFreq, targetFreq);
    const maxFreq = Math.max(currentFreq, targetFreq);
    
    // Если частота не в промежуточном диапазоне, то это не подъезд
    if (frequency <= minFreq || frequency >= maxFreq) return false;
    
    // Проверяем четкость - подъезды обычно имеют низкую четкость
    if (clarity > 0.7) return false;
    
    // Проверяем время - подъезд должен быть коротким
    const timeSinceLastNote = Date.now() - this.currentActiveNote.startTime;
    if (timeSinceLastNote > 300) return false; // Более 300мс - не подъезд
    
    console.log(`🚫 Заблокирован подъезд: ${currentKeyId} → ${targetKeyId}, clarity: ${clarity.toFixed(2)}`);
    return true;
}

// 🎵 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С НОТАМИ
noteIdToMidiNote(noteId) {
    // Преобразуем noteId в MIDI номер ноты
    // Формат noteId: "C4", "C#4", "D4" и т.д.
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    const match = noteId.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return 60; // Возвращаем C4 по умолчанию
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    return (octave + 1) * 12 + (noteMap[noteName] || 0);
}

noteIdToFrequency(noteId) {
    // Преобразуем noteId в частоту
    const midiNote = this.noteIdToMidiNote(noteId);
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// ИЗМЕНЕНИЯ В МЕТОДЕ processNoteWithAccuracyTracking:
// Добавить после строки "if (!keyId) return;":
/*
// 🚫 ФИЛЬТРАЦИЯ ПОДЪЕЗДОВ К НОТАМ (только для обычной детекции, не для тестов)
if (!this.testingSystem?.isActive && this.isGlideToNote && this.isGlideToNote(pitchData, keyId)) {
    return; // Блокируем подъезды
}
*/

// Заменить строку "this.updateExistingNote(keyId, pitchData);" на:
// this.updateExistingNoteFixed(keyId, pitchData); 