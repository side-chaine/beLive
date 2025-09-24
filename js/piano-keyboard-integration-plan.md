# 🎯 ПЛАН ИНТЕГРАЦИИ ИСПРАВЛЕННОЙ НАВИГАЦИИ ПО НОТАМ

## 🚨 Выявленные проблемы:

1. **Загрязнение pitch-карты подъездами** - записываются все детекции, включая артефакты
2. **Простая временная навигация** - не учитывает качество нот
3. **Асимметрия движения** - вперед/назад работают по-разному
4. **Отсутствие фильтрации при навигации** - показываются все записанные ноты

## 📋 Этапы интеграции:

### Этап 1: Обновление записи в карту
```javascript
// В методе processNoteWithAccuracyTracking заменить:
this.recordToPitchMap(keyId, pitchData);
// НА:
this.recordToPitchMapFixed(keyId, pitchData);
```

### Этап 2: Обновление навигации
```javascript
// В методе performScrubStep заменить:
this.scrubByPitchMap(direction);
// НА:
this.scrubByPitchMapFixed(direction);
```

### Этап 3: Добавление очистки карты
```javascript
// В метод hide() добавить:
if (this.pitchMap.notes.length > 0) {
    this.cleanupPitchMap();
}
```

### Этап 4: Защита симулированных нот
```javascript
// В метод cleanupInactiveKeysConditional добавить проверку:
if (noteData.protectedFromCleanup || noteData.fromCleanMap) {
    console.log(`🛡️ Симулированная нота ${keyId} защищена от автоочистки`);
    continue; // Пропускаем очистку
}
```

## 🔧 Конкретные изменения в коде:

### 1. Строка ~865 (processNoteWithAccuracyTracking):
```javascript
// БЫЛО:
this.recordToPitchMap(keyId, pitchData);

// СТАЛО:
this.recordToPitchMapFixed(keyId, pitchData);
```

### 2. Строка ~1660 (performScrubStep):
```javascript
// БЫЛО:
this.scrubByPitchMap(direction);

// СТАЛО:
this.scrubByPitchMapFixed(direction);
```

### 3. Строка ~1780 (simulateNoteFromPitchMap):
```javascript
// БЫЛО:
this.simulateNoteFromPitchMap(targetNote);

// СТАЛО:
this.simulateNoteFromPitchMapFixed(targetNote);
```

### 4. Добавить в конец класса все методы из piano-keyboard-fixed.js

## 🧪 План тестирования:

1. **Запись нот** - проверить что подъезды не записываются
2. **Навигация назад** - должна работать точно как раньше
3. **Навигация вперед** - должна показывать только основные ноты
4. **Симметрия** - движение вперед-назад должно быть обратимым
5. **Качество карты** - в карте должны остаться только чистые ноты

## ⚠️ Критически важно:

- Сохранить работу навигации назад (она работала корректно)
- Исключить подъезды из записи в карту
- Обеспечить симметрию навигации вперед/назад
- Защитить симулированные ноты от автоочистки

## 🎯 Ожидаемый результат:

После применения исправлений:
- Навигация назад: точно те же ноты что были сыграны
- Навигация вперед: точно те же ноты что при движении назад  
- Pitch-карта: только качественные основные ноты
- Подъезды: исключены из карты и навигации 