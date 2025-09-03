/**
 * AutoIntegrator - автоматический интегратор улучшенных обработчиков текста
 * Добавляет скрипты обработки текста на страницу, если они еще не добавлены
 */
(function() {
    console.log("AutoIntegrator: v1.1 инициализация");
    let scriptsInjected = false;
    
    function injectScripts() {
        if (scriptsInjected) {
            // console.log("AutoIntegrator: Скрипты уже были добавлены или попытка была совершена.");
            return;
        }
        scriptsInjected = true; // Помечаем, что попытка совершена, чтобы избежать многократных запусков
        
        console.log("AutoIntegrator: Попытка инъекции скриптов...");
        
        // Проверяем, есть ли у нас LyricsDisplay на странице
        if (typeof window.LyricsDisplay === 'undefined') {
            console.warn("AutoIntegrator: LyricsDisplay не найден. Улучшенные обработчики не будут инъецированы автоматически без основного компонента.");
            // Можно добавить логику для ожидания или поиска LyricsDisplay, если это необходимо
            // setTimeout(injectScripts, 1000); // Пример повторной попытки
            return; 
        }
        
        // Проверяем, не добавлены ли наши скрипты уже (по ID)
        if (document.getElementById('enhanced-text-processor-script') && 
            document.getElementById('text-processor-integrator-script')) {
            console.log("AutoIntegrator: Улучшенные обработчики (enhanced-text-processor, text-processor-integrator) уже присутствуют на странице (проверка по ID).");
            window.autoIntegratorInjected = true; // Устанавливаем флаг, что все на месте
            return;
        }
        
        try {
            let basePath = '';
            try {
                 // Пытаемся определить базовый путь более надежно
                const currentScriptTag = document.currentScript || (function() {
                    const scripts = document.getElementsByTagName('script');
                    return scripts[scripts.length - 1];
                })();
                if (currentScriptTag && currentScriptTag.src) {
                    const scriptPath = currentScriptTag.src;
                    basePath = scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);
                } else {
                    // Фоллбэк, если не удалось определить путь (например, инлайн скрипт или особенности загрузки)
                    // Предполагаем, что скрипты находятся в папке js/ относительно корня
                    basePath = 'js/'; 
                    console.warn("AutoIntegrator: Не удалось точно определить базовый путь для скриптов, используется фоллбэк: ", basePath);
                }
            } catch (e) {
                 basePath = 'js/'; // Фоллбэк в случае ошибки
                 console.error("AutoIntegrator: Ошибка при определении базового пути, используется фоллбэк: ", basePath, e);
            }
            
            console.log("AutoIntegrator: Базовый путь для скриптов определен как:", basePath);
            
            const loadScript = (id, path, onLoadCallback) => {
                if (document.getElementById(id)) {
                    console.log(`AutoIntegrator: Скрипт с ID '${id}' уже существует.`);
                    if (onLoadCallback) {onLoadCallback();}
                    return;
                }
                const script = document.createElement('script');
                script.id = id;
                script.src = path;
                script.async = false; // Важно для последовательной загрузки
                script.onload = () => {
                    console.log(`AutoIntegrator: Скрипт '${path}' успешно загружен.`);
                    if (onLoadCallback) {onLoadCallback();}
                };
                script.onerror = () => {
                    console.error(`AutoIntegrator: Ошибка при загрузке скрипта '${path}'.`);
                };
                document.head.appendChild(script);
            };
            
            // Загружаем EnhancedTextProcessor, затем TextProcessorIntegrator
            loadScript('enhanced-text-processor-script', basePath + 'enhanced-text-processor.js', () => {
                loadScript('text-processor-integrator-script', basePath + 'text-processor-integrator.js', () => {
                    console.log("AutoIntegrator: Все улучшенные обработчики успешно загружены и должны быть интегрированы.");
                    window.autoIntegratorInjected = true; // Финальный флаг успешной инъекции
                    window.enhancedFeaturesReady = true; // << НОВЫЙ ФЛАГ
                    console.log("AutoIntegrator: Флаг enhancedFeaturesReady установлен в true.");
                    // Опционально: диспатчим событие
                    // document.dispatchEvent(new CustomEvent('enhancedFeaturesLoaded'));
                });
            });
            
        } catch (error) {
            console.error("AutoIntegrator: КРИТИЧЕСКАЯ ОШИБКА при инъекции скриптов:", error);
        }
    }
    
    // Используем requestAnimationFrame для более надежного ожидания готовности DOM и других скриптов
    function scheduleInjection() {
        if (document.readyState === 'complete' || (document.readyState !== 'loading' && !document.documentElement.doScroll)) {
            injectScripts();
        } else {
            document.addEventListener('DOMContentLoaded', injectScripts);
            window.addEventListener('load', injectScripts); // Дополнительно для полной уверенности
        }
    }
    
    scheduleInjection();
})(); 