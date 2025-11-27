updateExistingNote(keyId, pitchData) {
    const { frequency, clarity, amplitude, timestamp } = pitchData;
    const noteData = this.activeNotes.get(keyId);
    
    if (!noteData) return;
    
    // ЗАЩИТА СИМУЛИРОВАННЫХ НОТ: не обновляем таймер для симулированных нот
    if (noteData.isSimulated || noteData.fromPitchMap || noteData.protectedFromCleanup) {
        console.log(`🛡️ Симулированная нота ${keyId} защищена от обновления таймера`);
        return;
    }
    
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