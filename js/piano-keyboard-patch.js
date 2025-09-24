// 🚨 КРИТИЧЕСКИЙ ПАТЧ ДЛЯ ИСПРАВЛЕНИЯ НАВИГАЦИИ ВПЕРЕД
// Вставить в browser console для немедленного исправления

if (window.pianoKeyboard) {
    // Заменяем метод findNoteInPitchMap на исправленную версию
    window.pianoKeyboard.findNoteInPitchMap = function(currentTime, direction) {
        // ФИЛЬТРУЕМ ТОЛЬКО КАЧЕСТВЕННЫЕ ОСНОВНЫЕ НОТЫ
        const notes = this.pitchMap.notes.filter(note => {
            // Проверяем качество ноты
            if (!note.maxClarity || note.maxClarity < 0.6) {return false;}
            
            // Проверяем длительность (исключаем короткие подъезды)
            if (note.duration && note.duration < 0.15) {return false;}
            
            // Проверяем что это не артефакт
            if (note.detectionCount && note.detectionCount < 3) {return false;}
            
            return true; // Это качественная нота
        });
        
        console.log(`🔍 ПАТЧ: Поиск ноты: время=${currentTime.toFixed(2)}с, направление=${direction === 1 ? 'вперед' : 'назад'}, всего нот=${this.pitchMap.notes.length}, качественных=${notes.length}`);
        
        if (notes.length === 0) {
            console.warn('⚠️ ПАТЧ: Нет качественных нот в карте');
            return null;
        }
        
        if (direction === 1) {
            // ВПЕРЕД - ищем первую качественную ноту ПОСЛЕ текущего времени
            for (let i = 0; i < notes.length; i++) {
                if (notes[i].time > currentTime + 0.05) { // +0.05с для точности
                    console.log(`➡️ ПАТЧ: Найдена следующая качественная нота: ${notes[i].keyId} в ${notes[i].time.toFixed(2)}с (качество: ${(notes[i].maxClarity*100).toFixed(1)}%)`);
                    return notes[i];
                }
            }
            // Если достигли конца - остаемся на последней качественной
            const lastNote = notes[notes.length - 1];
            console.log(`🔚 ПАТЧ: Достигнут конец карты, остаемся на: ${lastNote.keyId}`);
            return lastNote;
            
        } else {
            // НАЗАД - ищем последнюю качественную ноту ПЕРЕД текущим временем
            for (let i = notes.length - 1; i >= 0; i--) {
                if (notes[i].time < currentTime - 0.05) { // -0.05с для точности
                    console.log(`⬅️ ПАТЧ: Найдена предыдущая качественная нота: ${notes[i].keyId} в ${notes[i].time.toFixed(2)}с (качество: ${(notes[i].maxClarity*100).toFixed(1)}%)`);
                    return notes[i];
                }
            }
            // Если достигли начала - переходим к первой качественной
            const firstNote = notes[0];
            console.log(`🔚 ПАТЧ: Достигнуто начало карты, переходим к: ${firstNote.keyId}`);
            return firstNote;
        }
    };
    
    console.log('✅ ПАТЧ ПРИМЕНЕН: Навигация вперед теперь фильтрует только качественные ноты!');
    console.log('🧪 Протестируйте навигацию стрелочками - теперь должна работать симметрично');
} else {
    console.error('❌ pianoKeyboard не найден - откройте клавиатуру сначала');
}

// ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ:
// 1. Скопируйте весь этот код
// 2. Откройте Developer Tools (F12)
// 3. Перейдите на вкладку Console
// 4. Вставьте код и нажмите Enter
// 5. Увидите сообщение "ПАТЧ ПРИМЕНЕН"
// 6. Протестируйте навигацию стрелочками 

// 🔧 ПАТЧ ДЛЯ ИСПРАВЛЕНИЯ НАВИГАЦИИ В РЕЖИМЕ ПАУЗЫ
// Применить к piano-keyboard.js

// ПРОБЛЕМА 1: Растущий таймер симулированных нот
// ИСПРАВЛЕНИЕ в updateExistingNote (строка 995-1003):

/*
ЗАМЕНИТЬ:
        // Обновляем данные
        noteData.lastDetection = timestamp;
        noteData.maxClarity = Math.max(noteData.maxClarity, clarity);
        noteData.maxAmplitude = Math.max(noteData.maxAmplitude, amplitude);
        noteData.detectionCount++;
        noteData.currentFrequency = frequency;

НА:
        // 🔥 ИСПРАВЛЕНИЕ РАСТУЩЕГО ТАЙМЕРА: защита симулированных нот
        if (!noteData.isSimulated && !noteData.fromPitchMap && !noteData.protectedFromCleanup) {
            // Обычная нота - обновляем данные
            noteData.lastDetection = timestamp;
            noteData.maxClarity = Math.max(noteData.maxClarity, clarity);
            noteData.maxAmplitude = Math.max(noteData.maxAmplitude, amplitude);
            noteData.detectionCount++;
            noteData.currentFrequency = frequency;
        } else {
            // Симулированная нота - НЕ МЕНЯЕМ startTime и НЕ увеличиваем счетчики
            console.log(`🎯 Симулированная нота ${keyId} защищена от обновления таймера`);
        }
*/

// ПРОБЛЕМА 2: Недостаточно четкая навигация в режиме паузы
// ДОБАВИТЬ перед getCurrentTrackTime (строка 1899):

function forceShowNotesInPauseMode(currentTime) {
    // Если есть питч-карта, показываем ноты из неё
    if (this.pitchMap && this.pitchMap.notes && this.pitchMap.notes.length > 0) {
        const tolerance = 0.1; // 100мс толерантность
        const activeNote = this.pitchMap.notes.find(note => 
            Math.abs(note.time - currentTime) <= tolerance
        );
        
        if (activeNote) {
            console.log(`🎯 Принудительно показываем ноту из карты: ${activeNote.keyId} на времени ${currentTime.toFixed(2)}с`);
            this.simulateNoteFromPitchMap(activeNote);
            return true;
        }
    }
    
    return false;
}

// ПРОБЛЕМА 3: scrubByPitchMap не вызывает forceShowNotesInPauseMode
// ДОБАВИТЬ в конец scrubByPitchMap (после строки this.seekToTime(targetTime)):

/*
        // Принудительно показываем ноты в режиме паузы
        setTimeout(() => {
            const newCurrentTime = this.getCurrentTrackTime();
            this.forceShowNotesInPauseMode(newCurrentTime);
        }, 50);
*/

console.log('🔧 Патч для исправления навигации готов к применению'); 