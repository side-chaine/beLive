/**
 * State Manager - Централизованное управление состоянием приложения
 * Решает проблемы race conditions при переключении треков
 */

class StateManager {
    constructor() {
        this.isResetting = false;
        console.log('StateManager initialized');
    }

    /**
     * Выполняет полный сброс состояния всех компонентов
     * Решает баг с переключением треков согласно нейроСовету
     */
    async performHardReset() {
        if (this.isResetting) {
            console.log('StateManager: Reset already in progress, skipping');
            return;
        }

        this.isResetting = true;
        console.log('🔄 StateManager: Starting HARD RESET of all components');

        try {
            try {
                console.log('1. Resetting AudioEngine...');
                if (window.audioEngine) {
                    await window.audioEngine.reset();
                    console.log('✅ AudioEngine reset complete');
                }
            } catch (e) {
                console.error('CRITICAL FAILURE during AudioEngine reset:', e);
                throw e; // Пробрасываем ошибку дальше, чтобы остановить процесс
            }

            try {
                console.log('2. Resetting LyricsDisplay...');
                if (window.lyricsDisplay && typeof window.lyricsDisplay.fullReset === 'function') {
                    window.lyricsDisplay.fullReset();
                    console.log('✅ LyricsDisplay full reset complete');
                }
            } catch (e) {
                console.error('CRITICAL FAILURE during LyricsDisplay reset:', e);
                throw e;
            }

            try {
                console.log('3. Resetting TextStyleManager...');
                if (window.textStyleManager && typeof window.textStyleManager.reset === 'function') {
                    window.textStyleManager.reset();
                    console.log('✅ TextStyleManager reset complete.');
                }
            } catch (e) {
                console.error('CRITICAL FAILURE during TextStyleManager reset:', e);
                throw e;
            }
            
            // 🔧 НОВЫЙ: Transport Controls cleanup
            try {
                console.log('4. Cleaning up Transport Controls...');
                if (window.app && typeof window.app._cleanupTransportToggle === 'function') {
                    window.app._cleanupTransportToggle();
                    console.log('✅ Transport Controls cleanup complete');
                }
            } catch (e) {
                console.error('Warning: Transport Controls cleanup failed:', e);
                // Не останавливаем процесс - это не критичная ошибка
            }
            
            // Добавьте сюда другие компоненты для сброса по аналогии

            console.log('🎉 StateManager: HARD RESET completed successfully');
            
        } catch (error) {
            console.error('❌ StateManager: HARD RESET FAILED.', error.stack || error);
        } finally {
            this.isResetting = false;
        }
    }

    /**
     * Принудительная перерисовка текста в текущем режиме
     * Исправляет баг с "висящим" старым текстом в концертном режиме
     */
    forceTextRerender() {
        if (!window.lyricsDisplay) {return;}
        
        console.log('🎨 StateManager: Forcing text rerender in current mode');
        
        // Получаем текущий режим из app.js
        const currentMode = window.app?.currentMode || 'concert';
        
        if (currentMode === 'concert') {
            // Принудительно перерисовываем концертный режим
            console.log('🎭 Forcing concert mode rerender');
            if (window.lyricsDisplay._renderLyrics) {
                window.lyricsDisplay._renderLyrics();
                console.log('✅ Concert mode text rerendered');
            }
        } else if (currentMode === 'karaoke') {
            // Караоке режим обычно работает корректно, но на всякий случай
            console.log('🎤 Karaoke mode detected, should work correctly');
        }
    }

    /**
     * Проверяет готовность всех компонентов к загрузке нового трека
     */
    async waitForComponentsReady() {
        const maxWait = 1000; // Максимум 1 секунда ожидания
        const checkInterval = 50; // Проверяем каждые 50мс
        let waited = 0;

        while (waited < maxWait) {
            // Проверяем что все компоненты готовы
            const audioReady = !window.audioEngine?._isPlaying;
            const lyricsReady = !window.lyricsDisplay?.isRendering;
            
            if (audioReady && lyricsReady) {
                console.log('✅ All components ready for new track');
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }

        console.warn('⚠️ Components readiness timeout, proceeding anyway');
        return false;
    }
}

// Создаем глобальный экземпляр
const stateManager = new StateManager();
window.stateManager = stateManager;

// ИСПРАВЛЕНИЕ: Добавляем класс в верхнем регистре для совместимости с app.js
window.StateManager = StateManager;

console.log('📦 StateManager module loaded'); 