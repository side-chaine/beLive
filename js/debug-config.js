// 🔧 ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ ЛОГИРОВАНИЯ
// Централизованное управление логами всех модулей

window.DEBUG_CONFIG = {
    // Общие настройки
    ENABLED: false, // Главный переключатель для всех логов
    
    // Настройки для Piano Keyboard
    PIANO: {
        enableErrors: false,           // Ошибки клавиатуры
        enableDetection: false,        // Детекция нот
        enableRecording: false,        // Запись в питч-карту
        enableBallAnimation: false,    // Анимация шарика
        enableNoteTransitions: false,  // Переходы между нотами
        enablePitchMap: false,         // Работа с питч-картой
        enableTimeTracking: false      // Отслеживание времени трека
    },
    
    // Настройки для Mask System
    MASKS: {
        enableErrors: false,           // Ошибки масок
        enableInitialization: false,   // Инициализация
        enableTracking: false          // Отслеживание лица
    },
    
    // Настройки для App
    APP: {
        enableModeChanges: false,      // Смена режимов
        enableNavigation: false        // Навигация
    }
};

// 🛠️ ФУНКЦИЯ ДЛЯ ВКЛЮЧЕНИЯ/ОТКЛЮЧЕНИЯ ВСЕХ ЛОГОВ
function toggleDebugLogs(enabled) {
    DEBUG_CONFIG.ENABLED = enabled;
    
    // Включаем/отключаем все модули
    Object.keys(DEBUG_CONFIG).forEach(moduleKey => {
        if (typeof DEBUG_CONFIG[moduleKey] === 'object' && moduleKey !== 'ENABLED') {
            Object.keys(DEBUG_CONFIG[moduleKey]).forEach(key => {
                DEBUG_CONFIG[moduleKey][key] = enabled;
            });
        }
    });
    
    console.log(`🔧 DEBUG: Все логи ${enabled ? 'ВКЛЮЧЕНЫ' : 'ОТКЛЮЧЕНЫ'}`);
}

// 🎯 ФУНКЦИЯ ДЛЯ ВКЛЮЧЕНИЯ ЛОГОВ КОНКРЕТНОГО МОДУЛЯ
function enableModuleDebug(moduleName, enabled) {
    if (DEBUG_CONFIG[moduleName]) {
        Object.keys(DEBUG_CONFIG[moduleName]).forEach(key => {
            DEBUG_CONFIG[moduleName][key] = enabled;
        });
        console.log(`🔧 DEBUG: Модуль ${moduleName} ${enabled ? 'ВКЛЮЧЕН' : 'ОТКЛЮЧЕН'}`);
    } else {
        console.warn(`🔧 DEBUG: Модуль ${moduleName} не найден`);
    }
}

// 🔄 СОВМЕСТИМОСТЬ СО СТАРЫМИ МОДУЛЯМИ
window.DEBUG_PIANO = false;  // Для обратной совместимости
window.DEBUG_MASKS = false;  // Для обратной совместимости

// Экспорт функций
window.toggleDebugLogs = toggleDebugLogs;
window.enableModuleDebug = enableModuleDebug;

console.log('🔧 DEBUG_CONFIG загружен. Используйте toggleDebugLogs(true) для включения логов'); 