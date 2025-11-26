/**
 * Lyrics Display for Text application
 * Handles displaying and synchronizing lyrics with audio
 */

class LyricsDisplay {
    constructor() {
        this.lyricsContainer = document.getElementById('lyrics-display');
        this.containerElement = document.getElementById('lyrics-container');
        this.currentLine = 0;
        this.lyrics = [];
        this.currentLyricElement = null;
        this.fullText = '';
        this.duration = 0;
        this.autoScrollEnabled = true;
        this.lastScrollTime = 0;
        this._usingLinkinParkMap = false;
        this._lastEditModeState = false;  // Track edit mode state changes
        
        // Karaoke mode elements
        this.karaokeLineElements = [];
        this.activeKaraokeEl = null;
        this.nextKaraokeEl = null;
        
        // Add style properties
        this.currentStyle = null; // Current applied style
        this.styleClasses = {}; // Store applied style classes
        this.appliedStyleClasses = []; // List of currently applied style classes
        this.currentlyFocusedBlockId = null; // ADDED: To track the currently focused block in rehearsal mode
        
        // Block mode properties
        this.textBlocks = []; // Stores defined blocks: [{ id: string, name: string, lineIndices: number[] }]
        this.currentBlockCreation = []; // Stores line indices for the block currently being created
        this.isInBlockMode = false; // True if block creation UI is active
        
        // Initialize event listeners for manual scrolling
        this._initScrollListeners();
        
        // Initialize touch handlers for mobile
        this._initTouchHandlers();
        
        // Flag to track if we're using the marker manager
        this.usingMarkerManager = false;
        
        // Configuration options
        this.options = {
            autoScroll: true, // Auto-scroll to keep active line in view
            showControls: true, // Show lyrics control buttons
            highlightActive: true, // Highlight active line
            scrollBehavior: 'smooth' // Smooth scrolling
        };
        
        console.log('LyricsDisplay initialized');
        this.isRehearsalModeActive = false; // Flag for rehearsal mode state
        this.currentActiveBlock = null; // Store the currently active block in rehearsal mode
    }
    
    _initScrollListeners() {
        // Skip if container doesn't exist
        if (!this.containerElement) {return;}
        
        // Initialize last scroll time
        this.lastScrollTime = 0;
        this._userInitiatedScroll = false;
        
        // Detect manual scrolling with wheel events
        this.containerElement.addEventListener('wheel', (e) => {
            // Mark this as a user-initiated scroll
            this._userInitiatedScroll = true;
            
            // Проверяем, находимся ли мы в режиме репетиции с блоками
            const isInRehearsalModeWithBlocks = this.currentStyle && 
                                              this.currentStyle.id === 'rehearsal' && 
                                              this.textBlocks && 
                                              this.textBlocks.length > 0;
            
            if (isInRehearsalModeWithBlocks) {
                // В режиме репетиции - автовозврат к началу блока через 2 секунды
                clearTimeout(this.rehearsalScrollTimeout);
                this.rehearsalScrollTimeout = setTimeout(() => {
                    if (this.containerElement) {
                        this.containerElement.scrollTop = 0;
                        console.log("Rehearsal mode: Auto-returned to top after scroll");
                    }
                }, 2000);
                return; // Не применяем стандартную логику автоскролла
            }
            
            // Disable auto-scroll for a short period after manual scroll
            this.autoScrollEnabled = false;
            this.lastScrollTime = Date.now();
            
            // Re-enable auto-scroll after 4 seconds of no scrolling
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.autoScrollEnabled = true;
                this._userInitiatedScroll = false;
                console.log("Auto-scroll re-enabled after timeout");
            }, 4000);
        }, { passive: true });
        
        // Also detect scroll events (for scrollbar dragging or momentum scrolling)
        this.containerElement.addEventListener('scroll', () => {
            // Проверяем, находимся ли мы в режиме репетиции с блоками
            const isInRehearsalModeWithBlocks = this.currentStyle && 
                                              this.currentStyle.id === 'rehearsal' && 
                                              this.textBlocks && 
                                              this.textBlocks.length > 0;
            
            if (isInRehearsalModeWithBlocks) {
                // В режиме репетиции - автовозврат к началу блока через 2 секунды
                clearTimeout(this.rehearsalScrollTimeout);
                this.rehearsalScrollTimeout = setTimeout(() => {
                    if (this.containerElement) {
                        this.containerElement.scrollTop = 0;
                        console.log("Rehearsal mode: Auto-returned to top after scroll event");
                    }
                }, 2000);
                return; // Не применяем стандартную логику автоскролла
            }
            
            if (this._userInitiatedScroll || !this.usingMarkerManager) {
                // Only update the timestamp if this is a user-initiated scroll
                // or we're not using marker manager (to avoid conflicts)
                this.lastScrollTime = Date.now();
                
                if (this.autoScrollEnabled) {
                    this.autoScrollEnabled = false;
                    
                    // Re-enable auto-scroll after 4 seconds
                    clearTimeout(this.scrollTimeout);
                    this.scrollTimeout = setTimeout(() => {
                        this.autoScrollEnabled = true;
                        this._userInitiatedScroll = false;
                        console.log("Auto-scroll re-enabled after scroll event");
                    }, 4000);
                }
            }
        }, { passive: true });
        
        // Also listen for touchpad/touch gestures
        this.containerElement.addEventListener('touchstart', () => {
            this._userInitiatedScroll = true;
            
            // Проверяем, находимся ли мы в режиме репетиции с блоками
            const isInRehearsalModeWithBlocks = this.currentStyle && 
                                              this.currentStyle.id === 'rehearsal' && 
                                              this.textBlocks && 
                                              this.textBlocks.length > 0;
            
            if (isInRehearsalModeWithBlocks) {
                // В режиме репетиции не отключаем автоскролл
                return;
            }
            
            this.autoScrollEnabled = false;
            this.lastScrollTime = Date.now();
        }, { passive: true });
        
        this.containerElement.addEventListener('touchend', () => {
            // Проверяем, находимся ли мы в режиме репетиции с блоками
            const isInRehearsalModeWithBlocks = this.currentStyle && 
                                              this.currentStyle.id === 'rehearsal' && 
                                              this.textBlocks && 
                                              this.textBlocks.length > 0;
            
            if (isInRehearsalModeWithBlocks) {
                // В режиме репетиции - автовозврат к началу блока через 2 секунды
                clearTimeout(this.rehearsalScrollTimeout);
                this.rehearsalScrollTimeout = setTimeout(() => {
                    if (this.containerElement) {
                        this.containerElement.scrollTop = 0;
                        console.log("Rehearsal mode: Auto-returned to top after touch");
                    }
                }, 2000);
                return;
            }
            
            // Re-enable auto-scroll after 4 seconds
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.autoScrollEnabled = true;
                this._userInitiatedScroll = false;
                console.log("Auto-scroll re-enabled after touch");
            }, 4000);
        }, { passive: true });
    }
    
    _initTouchHandlers() {
        // Implement touch handlers if needed
    }
    
    /**
     * Load lyrics from text
     * @param {string} text - The lyrics text
     * @param {number} duration - Track duration in seconds
     * @param {boolean} shouldRender - флаг, нужно ли сразу рендерить текст (по умолчанию true)
     */
    loadLyrics(text, duration, shouldRender = true) {
        console.log("Loading lyrics, text length:", text ? text.length : 0, shouldRender ? "с рендерингом" : "без рендеринга");
        
        // Диагностика текста перед обработкой
        if (text && text.length > 0) {
            console.log("Исходный текст (первые 200 символов):", text.substring(0, 200));
            
            // Проверка на RTF-контент
            if (text.includes('\\rtf') || text.includes('ansicpg1251') || text.includes('cocoartf')) {
                console.log("Обнаружен RTF-контент в тексте.");
            }
        }
        
        // Reset state
                this.currentLine = 0;
                this.lyrics = [];
        this.fullText = text;
                this.duration = duration;
        this.autoScrollEnabled = true;
        this._usingLinkinParkMap = false;
        this.currentlyFocusedBlockId = null; // ADDED: Reset focused block ID
        
        // Always clear the container immediately when loading new lyrics
        if (this.lyricsContainer) {
            this.lyricsContainer.innerHTML = '';
        }
        
        // Force scroll to top
                if (this.containerElement) {
                    this.containerElement.scrollTop = 0;
                }
                
        if (!text || !this.lyricsContainer) {
            if (shouldRender) {
            this.lyricsContainer.innerHTML = '<div class="no-lyrics">No lyrics text provided</div>';
            }
                return;
            }
            
        // Add additional sanitization to clean RTF formatting artifacts left after RTF parser
        text = this._sanitizeLyricsText(text);
        // console.log("Lyrics after additional sanitization:", text.substring(0, 100)); // Reduced verbosity
        
        // Process the text for non-Linkin Park lyrics
        this._processLyrics(text);
        
        console.log("Processed lyrics, lines count:", this.lyrics.length);
        
        // Display lyrics ТОЛЬКО если shouldRender = true
        if (shouldRender) {
                this._renderLyrics();
        }
        
        // If MarkerManager exists, subscribe to marker changes
        this._subscribeToMarkerManager();
    }
    
    /**
     * Обрабатывает текст песни, определяя его тип и применяя соответствующий парсер
     * @param {string} text - Текст для обработки
     * @returns {Promise<string[]>} - Массив строк обработанного текста
     * @private
     */
    async _processLyrics(text) {
        console.log(`Processing lyrics, text length: ${text ? text.length : 0}`);
        
        if (!text) {
            // Заменяем this.setText('') на установку пустого массива в this.lyrics
            this.lyrics = [];
            return [];
        }
        
        // Проверка имени файла если оно доступно
            if (window.waveformEditor && window.waveformEditor.currentTrackTitle) {
            const trackTitle = window.waveformEditor.currentTrackTitle.toLowerCase();
            console.log("Обработка текста для трека:", window.waveformEditor.currentTrackTitle);
            
            // Существующая специфическая обработка для известных треков сохранена
            // ...
        }

        // Улучшенное определение типа RTF файла
        const rtfSignatures = ['\\rtf', '{\\rtf', '\\par', '\\pard', '\\f0', '\\ansicpg', '\\cocoartf'];
        // Проверяем наличие любой RTF сигнатуры в тексте
        const isRtf = rtfSignatures.some(signature => text.includes(signature));
        
        const isLrc = text.includes('[') && text.includes(']') && /\[\d+:\d+/i.test(text);
        const hasUnicode = text.includes('\\u') || text.includes('\\\'');
        
        console.log(`Определен тип текста: RTF: ${isRtf}, LRC: ${isLrc}, Unicode: ${hasUnicode}`);
        
        let processedText = '';
        
        // Применяем соответствующий парсер в зависимости от типа файла
        if (isRtf) {
            console.log('Обнаружен RTF текст, применяем универсальный RTF парсер');
            try {
                // Асинхронно обрабатываем RTF текст
                processedText = await this._parseRtfUniversal(text);
                console.log(`RTF успешно обработан, длина результата: ${processedText ? processedText.length : 0}`);
            } catch (rtfError) {
                console.error('Ошибка при обработке RTF текста:', rtfError);
                // При ошибке пытаемся использовать резервные методы
                processedText = this._extractStructuredContentFromRtf(text) || 
                                this._extractUnicodeFromRtf(text) || 
                                this._basicTextCleanup(text);
            }
            
            // Дополнительная проверка качества парсинга
            if (!processedText || processedText.split('\n').length < 5) {
                console.log('Универсальный RTF парсер не дал результатов, пробуем альтернативные методы');
                processedText = this._extractStructuredContentFromRtf(text);
                
                if (!processedText || processedText.split('\n').length < 5) {
                    console.log('Структурный парсер не сработал, пробуем извлечение Unicode');
                    processedText = this._extractUnicodeFromRtf(text);
                }
            }
        } else if (isLrc) {
            console.log('Обнаружен LRC файл, применяем парсер временных меток');
            processedText = this._parseLrcFile(text);
        } else if (hasUnicode) {
            console.log('Обнаружены Unicode символы, применяем конвертацию');
            processedText = this._convertUnicodeCodesToChars(text);
        } else {
            console.log('Применяем стандартную обработку текста');
            processedText = this._cleanText(text);
        }
        
        // Проверяем результат обработки
        if (!processedText || processedText.trim().length === 0) {
            console.warn('Не удалось обработать текст, применяем базовую очистку');
            processedText = this._basicTextCleanup(text);
        }
        
        // Устанавливаем полный текст для дальнейшей обработки
        this.fullText = processedText;
        
        // Определяем язык текста для применения специфичных правил
        const textLanguage = this._detectLanguage(processedText);
        console.log(`Определен язык текста: ${textLanguage}`);
        
        // Разделение на строки с предварительной обработкой
        console.log("Образец текста:", this.fullText.substring(0, 100) + "...");
        
        // Решение проблемы с обратными слешами в тексте (используются как маркеры переноса строк)
        if (this.fullText.includes('\\')) {
            console.log("Обнаружены обратные слеши, преобразуем их в переносы строк");
            this.fullText = this.fullText.replace(/\\/g, '\n');
        }
        
        // Разделение текста на строки
        let lines = this.fullText.split(/\r?\n/); // ИСПРАВЛЕНО: было split(/[\r\n]+/);
        console.log("Всего сырых строк:", lines.length);
        
        // Проверяем качество разделения на строки
        if (lines.length < 3 && processedText.length > 100) {
            console.warn('Недостаточно строк после обработки, применяем интеллектуальное разделение');
            lines = this._intelligentLineSplitting(processedText);
        }
        
        // Финальная очистка строк
        lines = lines.map(line => line.trim())
                     .filter(line => line.length > 0)
                     .filter(line => !/^[;:,.\\\/#!$%\^&\*;:{}=\-_`~()]+$/.test(line));
        
        console.log(`Финальный результат обработки: ${lines.length} строк`);
        console.log(`Первые строки: "${lines.slice(0, 3).join('", "')}"`);
        
        // Заменяем this.setText(lines) на прямое присваивание в this.lyrics
        this.lyrics = lines;
    }
    
    /**
     * Универсальный парсер RTF файлов
     * @param {string} rtfText - RTF текст
     * @returns {string} - Обработанный текст
     */
    _parseRtfUniversal(rtfText) {
        console.log('Запуск универсального RTF парсера');
        if (!rtfText) {return '';}
        
        try {
            // Удаляем RTF-заголовок и форматирование
            let text = rtfText;
            
            // Сохраняем переносы строк из RTF, заменяя их на маркеры
            text = text.replace(/\\par\s?/g, '\n');
            text = text.replace(/\\line\s?/g, '\n');
            
            // Удаляем управляющие последовательности (цветовые таблицы, таблицы шрифтов и т.д.)
            text = text.replace(/\{\\rtf[^{}]*/, '');
            text = text.replace(/\{\\colortbl[^{}]*\}/g, '');
            text = text.replace(/\{\\fonttbl[^{}]*\}/g, '');
            text = text.replace(/\{\\stylesheet[^{}]*\}/g, '');
            text = text.replace(/\{\\[^{}]*\}/g, '');
            
            // Удаляем команды форматирования
            text = text.replace(/\\f\d+/g, '');
            text = text.replace(/\\fs\d+/g, '');
            text = text.replace(/\\cf\d+/g, '');
            text = text.replace(/\\[a-z]+\d*/g, ' ');
            
            // Обрабатываем Unicode символы
            text = text.replace(/\\'([0-9a-fA-F]{2})/g, (match, hex) => {
                try {
                    const charCode = parseInt(hex, 16);
                    return String.fromCharCode(charCode);
                } catch(e) {
                    return '';
                }
            });
            
            text = text.replace(/\\u(\d+)\s?/g, (match, code) => {
                try {
                    const charCode = parseInt(code, 10);
                    const actualCode = charCode < 0 ? charCode + 65536 : charCode;
                    return String.fromCharCode(actualCode);
                } catch(e) {
                    return '';
                }
            });
            
            // Завершающая очистка
            text = text.replace(/[{}\\]/g, '');
            text = text.replace(/\s{2,}/g, ' ');
            text = text.replace(/\n{3,}/g, '\n\n');
            
            // Очистка от служебной информации и лишних пробелов
            text = text.replace(/^\s+/mg, '');
            text = text.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+\s*/m, '');  // Удаляем первые строки без текста
            
            return text;
        } catch (error) {
            console.error('Ошибка при обработке RTF:', error);
            return '';
        }
    }
    
    /**
     * Резервный устаревший метод обработки RTF (на случай, если универсальный не сработал)
     * @param {string} rtfText - RTF текст
     * @returns {string} - Обработанный текст
     */
    _parseRtfLegacy(rtfText) {
        console.log('Применяем устаревший метод обработки RTF');
        let text = rtfText;
        
        // Обработка как в старой версии
        text = this._extractUnicodeFromRtf(text);
        if (!text || text.trim().length === 0) {
            text = this._convertUnicodeCodesToChars(rtfText);
        }
        
        return this._cleanText(text);
    }
    
    /**
     * Парсинг LRC файла
     * @param {string} lrcText - LRC текст
     * @returns {string} - Обработанный текст
     */
    _parseLrcFile(lrcText) {
        if (!lrcText) {return '';}
        
        console.log('Запуск парсера LRC файла');
        
        const lines = lrcText.split(/\r?\n/);
        const result = [];
        
        // Регулярное выражение для поиска временных меток [mm:ss.xx]
        const timeTagRegex = /\[\d+:\d+(\.\d+)?\]/g;
        
        // Обрабатываем каждую строку
        for (let line of lines) {
            // Удаляем все временные метки
            const textOnly = line.replace(timeTagRegex, '').trim();
            
            // Пропускаем пустые строки и метаданные (начинаются с [xx:])
            if (textOnly && !textOnly.startsWith('[') && !textOnly.match(/^\[(ar|ti|al|by|offset):/i)) {
                result.push(textOnly);
            }
        }
        
        // Возвращаем результат как текст с переносами строк
        return result.join('\n');
    }
    
    /**
     * Определение языка текста
     * @param {string} text - Текст для анализа
     * @returns {string} - Определенный язык ('russian', 'english', 'mixed')
     */
    _detectLanguage(text) {
        if (!text) {return 'unknown';}
        
        // Подсчет символов кириллицы и латиницы
        const cyrillicChars = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
        const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
        
        // Поиск ключевых слов
        const russianKeywords = ['и', 'в', 'на', 'с', 'за', 'к', 'по', 'от', 'из', 'у'];
        const englishKeywords = ['and', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for'];
        
        let russianKeywordsCount = 0;
        let englishKeywordsCount = 0;
        
        const words = text.toLowerCase().match(/\b[а-яёa-z]+\b/g) || [];
        
        words.forEach(word => {
            if (russianKeywords.includes(word)) {russianKeywordsCount++;}
            if (englishKeywords.includes(word)) {englishKeywordsCount++;}
        });
        
        console.log(`Количество русских букв: ${cyrillicChars}, английских: ${latinChars}`);
        console.log(`Количество русских ключевых слов: ${russianKeywordsCount}, английских: ${englishKeywordsCount}`);
        
        if (cyrillicChars > latinChars * 0.5 || russianKeywordsCount > englishKeywordsCount) {
            return 'russian';
        } else if (latinChars > 0) {
            return 'english';
        }
        
        return 'mixed';
    }
    
    /**
     * Базовая очистка текста (последнее средство)
     * @param {string} text - Исходный текст
     * @returns {string} - Очищенный текст
     */
    _basicTextCleanup(text) {
        if (!text) {return '';}
        
        // Удаляем все управляющие и непечатаемые символы, оставляем только печатаемые и переносы строк
        let cleaned = text.replace(/[^\x20-\x7E\nа-яА-ЯёЁ]/g, '');
        
        // Заменяем последовательности обратных слешей на переносы строк
        cleaned = cleaned.replace(/\\{1,}/g, '\n');
        
        // Очистка от повторяющихся пробельных символов
        cleaned = cleaned.replace(/\s{2,}/g, ' ');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        return cleaned;
    }
    
    /**
     * Финальная обработка текста с учётом языка
     * @param {string} text - Обработанный текст
     * @param {string} language - Язык текста
     * @returns {Array} - Массив строк
     */
    _finalizeTextProcessing(text, language) {
        // Разделение на строки
        let lines = text.split(/[\r\n]+/);
        
        // Удаление пустых строк и лишних пробелов
        lines = lines.map(line => line.trim()).filter(line => line.length > 0);
        
        // Удаление лишних технических строк
        lines = lines.filter(line => {
            // Игнорируем строки, содержащие только технические символы
            return !(/^\s*[;:,.\\\/#!$%\^&\*;:{}=\-_`~()\[\]]+\s*$/).test(line);
        });
        
        // Языковые улучшения
        if (language === 'russian') {
            // Специфические правила для русского языка
            lines = this._improveRussianStructure(lines);
        } else if (language === 'english') {
            // Специфические правила для английского языка
            lines = this._improveEnglishStructure(lines);
        }
        
        return lines;
    }
    
    /**
     * Улучшение структуры для русскоязычного текста
     * @param {Array} lines - Строки текста
     * @returns {Array} - Улучшенные строки
     */
    _improveRussianStructure(lines) {
        // Объединяем слишком короткие строки с предыдущей строкой
        const result = [];
        let currentLine = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Пропускаем строки только с пробелами
            if (line.length === 0) {continue;}
            
            // Пропускаем строки, содержащие только технические символы
            if (/^\s*[;:,.\\\/#!$%\^&\*;:{}=\-_`~()]+\s*$/.test(line)) {continue;}
            
            // Обрабатываем очень короткие строки
            if (line.length <= 2 && 
                (line === 'и' || line === 'в' || line === 'с' || line === 'а' || 
                 line === 'о' || line === 'у' || line === 'к')) {
                // Присоединяем очень короткие предлоги и союзы к следующей строке
                if (i < lines.length - 1) {
                    lines[i+1] = line + ' ' + lines[i+1];
                continue;
                }
            }
            
            result.push(line);
        }
        
        return result;
    }
    
    /**
     * Улучшение структуры для англоязычного текста
     * @param {Array} lines - Строки текста
     * @returns {Array} - Улучшенные строки
     */
    _improveEnglishStructure(lines) {
        // Объединяем слишком короткие строки с предыдущей строкой
        const result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Пропускаем строки только с пробелами
            if (line.length === 0) {continue;}
            
            // Пропускаем строки, содержащие только технические символы
            if (/^\s*[;:,.\\\/#!$%\^&\*;:{}=\-_`~()]+\s*$/.test(line)) {continue;}
            
            // Обрабатываем очень короткие строки
            if (line.length <= 2 && 
                (line === 'a' || line === 'A' || line === 'I' || line === 'i')) {
                // Присоединяем очень короткие артикли к следующей строке
                if (i < lines.length - 1) {
                    lines[i+1] = line + ' ' + lines[i+1];
                    continue;
                }
            }
            
            // Обнаруживаем обрыв предложения (строка заканчивается на предлог или союз)
            const endsWithPreposition = /\b(at|in|of|to|by|for|with|on)\s*$/.test(line.toLowerCase());
            if (endsWithPreposition && i < lines.length - 1) {
                // Переносим предлог на следующую строку
                const match = line.match(/\b(at|in|of|to|by|for|with|on)\s*$/i);
                if (match) {
                    const preposition = match[1];
                    const newLine = line.substring(0, line.length - preposition.length).trim();
                    lines[i+1] = preposition + ' ' + lines[i+1];
                    result.push(newLine);
                    continue;
                }
            }
            
            result.push(line);
        }
        
        return result;
    }
    
    /**
     * Интеллектуальное разделение текста на строки
     * @param {string} text - Текст для разделения
     * @returns {Array} - Массив строк
     */
    _intelligentLineSplitting(text) {
        console.log('Применяем интеллектуальное разделение текста на строки');
        if (!text) {return [];}
        
        // Пытаемся определить разделители строк по структуре текста
        let lines = [];
        
        // Проверяем на формат с точкой и пробелом в качестве разделителя
        if (text.includes('. ') && text.split('. ').length > 3) {
            lines = text.split('. ').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length >= 3) {
                console.log('Разделение по точке и пробелу');
                return lines.map(line => line.endsWith('.') ? line : line + '.');
            }
        }
        
        // Пробуем разделить по знакам препинания и заглавным буквам (для песенных текстов)
        let processed = text;
        
        // Разделяем по точке и новой строке с заглавной буквы
        processed = processed.replace(/([.!?])\s+([A-ZА-ЯЁ])/g, '$1\n$2');
        
        // Разделяем перед строками, начинающимися с заглавных букв
        processed = processed.replace(/([a-zа-яё])\s+([A-ZА-ЯЁ][a-zа-яё]{2,})/g, '$1\n$2');
        
        // Добавляем переносы строк перед характерными для песен фразами
        const songPatterns = [
            'Chorus', 'Verse', 'Bridge', 'Припев', 'Куплет', 'Бридж', 
            'Yeah', 'Oh', 'Woah', 'Hey'
        ];
        
        songPatterns.forEach(pattern => {
            const regex = new RegExp(`\\b${pattern}\\b`, 'g');
            processed = processed.replace(regex, `\n${pattern}`);
        });
        
        // Получаем строки после обработки
        lines = processed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Если результат все еще недостаточный, применяем более агрессивное разделение
        if (lines.length < 3) {
            console.log('Применяем агрессивное разделение текста');
            
            // Разбиваем по запятой и пробелу
            processed = text.replace(/,\s+/g, ',\n');
            lines = processed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            // Если все еще мало строк, разбиваем длинные строки
            if (lines.length < 3) {
                const newLines = [];
                lines.forEach(line => {
                    // Разбиваем строки длиннее 40 символов
                    if (line.length > 40) {
                        const parts = [];
                        let startIndex = 0;
                        
                        // Пытаемся найти логичные места для разрыва строки
                        const breakPoints = [...line.matchAll(/[\s,.;:!?]/g)].map(m => m.index);
                        
                        for (const point of breakPoints) {
                            if (point - startIndex > 30) {
                                parts.push(line.substring(startIndex, point).trim());
                                startIndex = point + 1;
                            }
                        }
                        
                        // Добавляем оставшуюся часть
                        if (startIndex < line.length) {
                            parts.push(line.substring(startIndex).trim());
                        }
                        
                        // Если нашли хотя бы одну точку разрыва
                        if (parts.length > 0) {
                            newLines.push(...parts);
        } else {
                            newLines.push(line);
                        }
                    } else {
                        newLines.push(line);
                    }
                });
                
                return newLines;
            }
        }
        
        return lines;
    }
    
    _extractPlainTextContent(text) {
        // This method attempts to extract readable text content from various formats
        console.log("Running plain text extraction from original content");
        
        // For RTF, extract text content directly
        if (text.startsWith('{\\rtf') || text.startsWith('{\rtf')) {
            console.log("Extracting from RTF");
            
            // First look for common lyrics patterns in the RTF
            const lyrics = [];
            const potential = text.match(/[A-Za-z,'\(\) ]{5,}[\r\n]/g);
            if (potential && potential.length > 0) {
                console.log("Found potential lyrics through pattern matching");
                return potential.join('\n');
            }
            
            // Extract readable ASCII and Cyrillic characters, preserving line breaks
            let result = '';
            let inControl = false;
            let lastChar = '';
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                // Skip RTF control sequences
                if (char === '\\') {
                    inControl = true;
                    continue;
                }
                
                // Handle control sequence end
                if (inControl && !/[a-zA-Z0-9]/.test(char)) {
                    inControl = false;
                }
                
                // Skip if in control sequence or braces
                if (inControl || char === '{' || char === '}') {
                    continue;
                }
                
                // Handle escaped hex characters for Cyrillic
                if (lastChar === "'" && /[0-9A-Fa-f]{2}/.test(text.substr(i, 2))) {
                    try {
                        const hexCode = text.substr(i, 2);
                            const code = parseInt(hexCode, 16);
                            
                            // Windows-1251 to Unicode conversion for Cyrillic
                        if (code >= 0xC0 && code <= 0xFF) {
                            result += String.fromCharCode(code + 0x350);
                        } else if (code === 0xA8) {
                            result += 'Ё';
                        } else if (code === 0xB8) {
                            result += 'ё';
                        }
                        
                        i += 1; // Skip the second hex digit
                    } catch (e) {
                        // Just continue if error
                    }
                    continue;
                }
                
                // Add readable characters
                if (/[\x20-\x7E\u0400-\u04FF\n\r]/.test(char)) {
                    result += char;
                }
                
                lastChar = char;
            }
            
            // Clean up the result
            return result.replace(/\s+/g, ' ')           // Normalize whitespace
                         .replace(/\s*\n\s*/g, '\n')     // Clean line breaks
                         .replace(/\n{3,}/g, '\n\n')     // Normalize multiple line breaks
                         .trim();
        }
        
        // For plain text, just normalize
        return text.replace(/[^\x20-\x7E\u0400-\u04FF\n\r]/g, '')  // Only keep readable chars
                   .trim();
    }
    
    _splitLongLines(lines) {
        const result = [];
        const maxLength = 80; // Maximum characters per line
        
        for (const line of lines) {
            if (line.length <= maxLength) {
                result.push(line);
                continue;
            }
            
            // Try to split at sentence boundaries first
            const sentences = line.split(/(?<=[.!?])\s+/);
            if (sentences.length > 1) {
                result.push(...sentences);
                continue;
            }
            
            // If no sentence boundaries, split at commas
            const phrases = line.split(/(?<=,)\s+/);
            if (phrases.length > 1) {
                result.push(...phrases);
                continue;
            }
            
            // As a last resort, break by length
            let remainingText = line;
            while (remainingText.length > maxLength) {
                // Find the last space within maxLength characters
                let breakPoint = remainingText.substring(0, maxLength).lastIndexOf(' ');
                if (breakPoint === -1) {breakPoint = maxLength;} // No space found, hard break
                
                result.push(remainingText.substring(0, breakPoint));
                remainingText = remainingText.substring(breakPoint).trim();
            }
            
            if (remainingText) {
                result.push(remainingText);
            }
        }
        
        return result;
    }
    
    /**
     * Очищает текст от лишних символов и форматирования
     * @param {string} text - Текст для очистки
     * @returns {string} - Очищенный текст
     */
    _cleanText(text) {
        console.log("Original text length:", text ? text.length : 0);
        if (!text) {return '';}
        
        // Определяем тип текста
        const isRtf = text.includes('\\rtf') || text.includes('{\\');
        const isBOM = text.charCodeAt(0) === 0xFEFF;
        
        console.log("Text processing: BOM detected:", isBOM, "RTF detected:", isRtf);
        
        let cleaned = text;
        
        // Удаляем BOM маркер, если есть
        if (isBOM) {
            cleaned = cleaned.slice(1);
        }
        
        // Стандартная очистка для не-RTF текста
        if (!isRtf) {
            console.log("Performing standard text cleaning for non-RTF text");
            
            // Удаляем все необычные символы (нечитаемые)
            cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
            
            // Заменяем одиночные символы переноса строки на пробел
            cleaned = cleaned.replace(/\r(?!\n)/g, ' ');
            
            // Нормализуем переносы строк
            cleaned = cleaned.replace(/\r\n/g, '\n');
            
            // Удаляем лишние пробелы
            cleaned = cleaned.replace(/[ \t]+/g, ' ');
            
            // Удаляем пустые строки и лишние переносы строк
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
            
            // Обрабатываем обратные слеши
            if (cleaned.includes('\\')) {
                console.log("Обнаружены обратные слеши в обычном тексте, заменяем на переносы строк");
                cleaned = cleaned.replace(/\\+/g, '\n');
            }
        } else {
            // Для RTF текстов используем специальные методы обработки, которые вызываются перед этим методом
            console.log("RTF text detected, skipping basic cleaning as it should be processed by RTF parsers");
        }
        
        return cleaned;
    }
    
    _extractTextFromRTF(rtfText) {
        // This is a more comprehensive RTF text extractor
        let text = rtfText;
        
        // Remove all RTF control groups with their content
        text = text.replace(/\{\\\*[^{}]*\}/g, '');
        
        // Step 1: Remove complex nested groups first
        let prevText = '';
        while (prevText !== text) {
            prevText = text;
            text = text.replace(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g, '');
        }
        
        // Step 2: Remove simple groups one by one
        text = text.replace(/\{\\rtf[^{}]*\}/g, '');
        text = text.replace(/\{\\stylesheet[^{}]*\}/g, '');
        text = text.replace(/\{\\colortbl[^{}]*\}/g, '');
        text = text.replace(/\{\\fonttbl[^{}]*\}/g, '');
        text = text.replace(/\{\\[a-z]+\d*\s?/g, ' '); // Удаляем команды \command
        text = text.replace(/\\\*[^{}\r\n]*/g, '');  // Удаляем \* control words
        text = text.replace(/\\[\\\{\}]/g, '');      // Удаляем экранированные символы
        text = text.replace(/[\{\}]/g, '');         // Удаляем скобки
        
        // Step 3: Remove all remaining braces and control words
        text = text.replace(/\\[a-zA-Z0-9]+(-?[0-9]+)?\s?/g, '');
        
        // Replace special RTF characters
        text = text.replace(/\\\n/g, '\n');
        text = text.replace(/\\par\s/g, '\n');
        
        // Remove remaining braces
        text = text.replace(/[{}]/g, '');
        
        // Replace special RTF characters
        text = text.replace(/\\'([0-9a-fA-F]{2})/g, (match, hex) => {
            try {
                return String.fromCharCode(parseInt(hex, 16));
            } catch (e) {
                return '';
            }
        });
        
        // Handle Unicode escape sequences
        text = text.replace(/\\u([0-9]+)\?/g, (match, code) => {
            try {
                return String.fromCharCode(parseInt(code, 10));
            } catch (e) {
                return '';
            }
        });
        
        // Normalize line endings
        text = text.replace(/\r\n/g, '\n');
        text = text.replace(/\r/g, '\n');
        
        // Replace multiple consecutive newlines with a single newline
        text = text.replace(/\n{3,}/g, '\n\n');
        
        // Additional cleanup for any remaining RTF artifacts
        text = text.replace(/\\[a-z0-9]+/g, '');
        text = text.replace(/\\\\/g, '\\');
        
        return text.trim();
    }
    
    _renderLyrics() {
        if (!this.lyricsContainer) {return;}
        
        // --- NEW KARAOKE LOGIC V2 ---
        // Special handling for Karaoke mode to prevent flickering and ensure stability.
        if (this.currentStyle && this.currentStyle.id === 'karaoke') {
            // Check if our static elements exist. If not, create them.
            if (!this.karaokeLineElements || this.karaokeLineElements.length === 0 || !document.getElementById('karaoke-line-0')) {
                console.log('[KARAOKE] DOM not found or empty in _renderLyrics, creating it.');
                this.lyricsContainer.innerHTML = `
                    <div class="karaoke-panel">
                        <div id="karaoke-line-0" class="lyric-line"></div>
                        <div id="karaoke-line-1" class="lyric-line"></div>
                    </div>
                `;
                this.karaokeLineElements = [
                    document.getElementById('karaoke-line-0'),
                    document.getElementById('karaoke-line-1')
                ];
            }
            
            // Initial setup: Assign roles and content for the first time.
            this.activeKaraokeEl = this.karaokeLineElements[0];
            this.nextKaraokeEl = this.karaokeLineElements[1];

            // Use setActiveLine to perform the initial population and styling
            this.setActiveLine(this.currentLine, true); 
            return; // Return to prevent other rendering logic from interfering.
        }
        // --- END NEW KARAOKE LOGIC V2 ---

        console.log(`Rendering lyrics. Current style ID: ${this.currentStyle ? this.currentStyle.id : 'none'}`);
        this.lyricsContainer.innerHTML = ''; // This will clear karaoke DOM when switching away.
        
        if (this.currentStyle && this.currentStyle.id === 'rehearsal' && this.textBlocks && this.textBlocks.length > 0) {
            this._renderBlocksForRehearsal();
            } else {
        if (this.lyrics.length === 0) {
            this.lyricsContainer.innerHTML = `<div class="no-lyrics">No lyrics to display</div>`;
            return;
            }
            this._renderStandardLines();
        }

        // After rendering, set the active line if it's already determined.
        // Karaoke mode returns early, so this won't be called for it.
        if (this.currentLine > 0) {
            this.setActiveLine(this.currentLine, true);
        }
    }
    
    /**
     * Renders lyrics for Karaoke mode, showing only the active and the next line.
     * @private
     */
    _renderKaraokeLines() {
        // This method is now obsolete. The main logic has been moved to _renderLyrics (for setup)
        // and setActiveLine (for updates) to prevent DOM recreation and flickering.
        console.log("[KARAOKE_RENDER] Obsolete call. Main logic moved for stability.");
    }

    _calculateFontAndLineHeightForBlock(lineCount) {
        let baseFontSize = 2.8; // rem (увеличено с 2.0)
        let baseLineHeight = 3.4; // rem (увеличено с 2.2)
        
        // Менее агрессивное масштабирование для более крупного текста
        if (lineCount >= 10) {
            // Экстремально большие блоки (10+ строк) - умеренное сжатие
            baseFontSize = Math.max(baseFontSize * 0.65, 1.8); // 1.8rem минимум (было 1.1)
            baseLineHeight = Math.max(baseLineHeight * 0.7, 2.2); // 2.2rem минимум (было 1.6)
        } else if (lineCount >= 8) {
            // Очень большие блоки (8-9 строк) - легкое сжатие
            baseFontSize = Math.max(baseFontSize * 0.75, 2.1); // 2.1rem минимум (было 1.3)
            baseLineHeight = Math.max(baseLineHeight * 0.8, 2.5); // 2.5rem минимум (было 1.8)
        } else if (lineCount >= 6) {
            // Большие блоки (6-7 строк) - минимальное сжатие
            baseFontSize = Math.max(baseFontSize * 0.85, 2.3); // 2.3rem минимум (было 1.5)
            baseLineHeight = Math.max(baseLineHeight * 0.9, 2.8); // 2.8rem минимум (было 2.0)
        } else if (lineCount >= 4) {
            // Средние блоки (4-5 строк) - без сжатия
            baseFontSize = Math.max(baseFontSize * 0.95, 2.5); 
            baseLineHeight = Math.max(baseLineHeight * 0.95, 3.0);
        } else if (lineCount <= 3) {
            // Маленькие блоки (1-3 строки) - увеличиваем для лучшей читаемости
            baseFontSize = Math.min(baseFontSize * 1.2, 3.2); // Максимум 3.2rem
            baseLineHeight = Math.min(baseLineHeight * 1.2, 4.0); // Максимум 4.0rem
        }
        
        console.log(`>>> FONT_CALC_DEBUG >>> Lines: ${lineCount}, FontSize: ${baseFontSize.toFixed(2)}rem, LineHeight: ${baseLineHeight.toFixed(2)}rem`);

        return {
            fontSize: `${baseFontSize}rem`,
            lineHeight: `${baseLineHeight}rem`
        };
    }

    _renderBlocksForRehearsal() {
        const lyricsContainer = this.lyricsContainer;
        if (!lyricsContainer) {
            console.error('LyricsDisplay: lyricsContainer not found for _renderRehearsalDisplay');
            return;
        }

        // 🧠 НЕЙРОСОВЕТ: ДОБАВЛЕНА ПРОВЕРКА ДЛЯ ПРИНУДИТЕЛЬНОЙ ПЕРЕРИСОВКИ ПОСЛЕ СМЕНЫ РЕЖИМА
        // Если lyricsContainer пуст, это значит, что DOM был очищен другим режимом.
        // Или если активный блок не найден, хотя _lastRenderedBlockId есть, это тоже указывает на проблему.
        const currentActiveBlockElement = lyricsContainer.querySelector('.rehearsal-active-block');
        if (lyricsContainer.innerHTML.trim() === '' || (!currentActiveBlockElement && this._lastRenderedBlockId)) {
            console.log('LyricsDisplay: Detected empty lyricsContainer or missing active block element after mode switch. Forcing full re-render.');
            this._lastRenderedBlockId = null; // Сбрасываем, чтобы вызвать полную перерисовку
        }

        if (!this.textBlocks || this.textBlocks.length === 0) {
            lyricsContainer.innerHTML = '<div class="no-blocks">Нет блоков для режима репетиции</div>';
            this._lastRenderedBlockId = null;
            return;
        }

        // 1. Подготовка данных (разделение больших блоков)
        const baseBlocks = this._sanitizeBlocks(this.textBlocks);
        const processedBlocks = this._splitLargeBlocks(baseBlocks);

        // 2. Поиск активного блока
        let activeBlockIndex = -1;
        let currentBlockId = null;
        let activeBlock = null;

        for (let i = 0; i < processedBlocks.length; i++) {
            const block = processedBlocks[i];
            if (block.lineIndices.includes(this.currentLine)) {
                activeBlockIndex = i;
                currentBlockId = block.id;
                activeBlock = block;
                break;
            }
        }

        // 🧠 НЕЙРОСОВЕТ: STICKY LOGIC (Липкая логика для закрывающих маркеров)
        // Если мы сейчас в "пустоте" (между блоками), но у нас уже был отрисован блок,
        // мы оставляем ЕГО, чтобы экран не моргал и текст не пропадал.
        if (activeBlockIndex === -1 && this._lastRenderedBlockId) {
             // Пытаемся найти предыдущий блок в массиве processedBlocks
             const lastBlockIndex = processedBlocks.findIndex(b => b.id === this._lastRenderedBlockId);
             if (lastBlockIndex !== -1) {
                 // Мы "застряли" на предыдущем блоке визуально, пока не начнется новый
                 activeBlockIndex = lastBlockIndex;
                 activeBlock = processedBlocks[lastBlockIndex];
                 currentBlockId = activeBlock.id;
                 // console.log('LyricsDisplay: Sticky Logic - keeping previous block visible during gap');
             }
        }

        // Если совсем ничего не нашли (начало трека или сбой)
        if (activeBlockIndex === -1) {
            // Только если контейнер не пуст, мы его чистим, чтобы не делать это постоянно
            if (lyricsContainer.innerHTML !== '<div class="no-blocks">Активный блок не найден</div>') {
                 lyricsContainer.innerHTML = '<div class="no-blocks">Активный блок не найден</div>';
            }
            this._lastRenderedBlockId = null; // Сбрасываем последний отрисованный блок
            return;
        }

        // 🧠 НЕЙРОСОВЕТ: SMART UPDATE (Умное обновление без мерцания)
        // Если ID блока не изменился с прошлого рендера -> НЕ ЧИСТИМ DOM!
        if (this._lastRenderedBlockId === currentBlockId) {
            // Мы в том же блоке! Просто обновляем подсветку активной строки.
            // console.log('LyricsDisplay: Smart Update - only updating active lines.');
            this._updateActiveRehearsalLines(lyricsContainer.querySelector('.rehearsal-active-block'), activeBlock);
            
            // Уведомляем BlockLoopControl (он может хотеть обновить прогрессбар или кнопки)
            if (window.app && window.app.blockLoopControl) {
                 // Делаем это аккуратно, чтобы не вызвать циклическую перерисовку
                 // window.app.blockLoopControl.updateForCurrentBlock(); // Можно раскомментировать, если нужно обновление UI лупа внутри блока
            }
            return; 
        }

        // === ПОЛНАЯ ПЕРЕРИСОВКА (Только если блок реально сменился) ===
        
        // 🎯 Guard для экспорта (оставляем как было у вас, но теперь это срабатывает реже)
        if (!window.isExportSelectMode()) {
            lyricsContainer.innerHTML = ''; 
        }

        this._lastRenderedBlockId = currentBlockId;
        this.currentActiveBlock = activeBlock; // Важно для BlockLoopControl

        // ... Дальше идет ваша стандартная логика отрисовки ...
        
        const fontInfo = this._calculateFontAndLineHeightForBlock(activeBlock.lineIndices.length);
        const isExtremelyLarge = activeBlock.lineIndices.length >= 10;
        const isVeryLarge = activeBlock.lineIndices.length >= 8;

        const activeBlockContainer = document.createElement('div');
        activeBlockContainer.className = 'rehearsal-active-block';
        
        if (isExtremelyLarge) activeBlockContainer.classList.add('extremely-large-block');
        else if (isVeryLarge) activeBlockContainer.classList.add('very-large-block');
        
        if (activeBlock.isContinuation) activeBlockContainer.classList.add('block-continuation');

        activeBlockContainer.style.fontSize = fontInfo.fontSize;
        activeBlockContainer.style.lineHeight = fontInfo.lineHeight;

        // Рендерим строки
        activeBlock.lineIndices.forEach((lineIndex, idx) => {
            if (this.lyrics[lineIndex]) {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'rehearsal-active-line';
                lineDiv.innerHTML = this._parseParenthesesForDuet(this.lyrics[lineIndex]);
                lineDiv.dataset.index = lineIndex;

                if (activeBlock.isContinuation && idx === 0) lineDiv.classList.add('continuation-first-line');
                
                if (this.currentStyle && this.currentStyle.css && this.currentStyle.css.base) {
                    lineDiv.classList.add(this.currentStyle.css.base);
                }
                
                // Применяем классы переходов (сохраненная логика)
                if (this.currentTransition && this.currentTransition !== 'none') {
                    lineDiv.classList.add('transition-' + this.currentTransition);
                    if (this.currentTransition === 'matrix') this._prepareMatrixEffectForLine(lineDiv);
                    else if (['letterByLetter', 'letterShine', 'cinemaLights'].includes(this.currentTransition)) this._prepareLetterByLetterEffectForLine(lineDiv);
                    else if (this.currentTransition === 'wordByWord') this._prepareWordByWordEffectForLine(lineDiv);
                    else if (['echo', 'edgeGlow', 'pulseRim', 'fireEdge', 'neonOutline', 'starlight', 'laserScan'].includes(this.currentTransition)) {
                        lineDiv.setAttribute('data-text', this.lyrics[lineIndex]);
                    }
                }
                
                // Активная строка
                if (lineIndex === this.currentLine) {
                    lineDiv.classList.add('active');
                    this.currentLyricElement = lineDiv;
                    if (this.currentStyle && this.currentStyle.cssClass) {
                        lineDiv.classList.add(this.currentStyle.cssClass + '-active');
                    }
                }
                
                activeBlockContainer.appendChild(lineDiv);
            }
        });

        lyricsContainer.appendChild(activeBlockContainer);

        // Автоскролл для больших блоков
        if ((isExtremelyLarge || isVeryLarge) && (!this.currentStyle || this.currentStyle.id !== 'rehearsal')) {
             setTimeout(() => {
                const activeLineElement = activeBlockContainer.querySelector('.rehearsal-active-line.active');
                if (activeLineElement) activeLineElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }, 50);
        }

        // Превью следующего блока
        if (activeBlockIndex < processedBlocks.length - 1) {
            const nextBlock = processedBlocks[activeBlockIndex + 1];
            const previewContainer = document.createElement('div');
            previewContainer.className = 'rehearsal-next-preview';
            previewContainer.style.justifyContent = 'center';
            
            if (nextBlock.isContinuation) previewContainer.classList.add('preview-continuation');
            
            const previewLines = nextBlock.lineIndices.slice(0, 2);
            previewLines.forEach((lineIndex, idx) => {
                if (this.lyrics[lineIndex]) {
                    const previewLine = document.createElement('div');
                    previewLine.className = 'rehearsal-preview-line';
                    previewLine.innerHTML = this._parseParenthesesForDuet(this.lyrics[lineIndex]);
                    
                    if (nextBlock.isContinuation && idx === 0) previewLine.classList.add('preview-continuation-first-line');
                    else if (!nextBlock.isContinuation && idx === 0) previewLine.classList.add('next-block-first-line');
                    
                    previewContainer.appendChild(previewLine);
                }
            });
            lyricsContainer.appendChild(previewContainer);
        }

        this.currentlyFocusedBlockId = currentBlockId;
        
        // Уведомляем BlockLoopControl о СМЕНЕ блока
        if (window.app && window.app.blockLoopControl) {
            window.app.blockLoopControl.updateForCurrentBlock();
        }

        try {
            const evt = new CustomEvent('lyrics-rendered', { detail: { mode: 'rehearsal', blockId: activeBlock.id } });
            document.dispatchEvent(evt);
        } catch (e) { console.warn('LyricsDisplay: Error dispatching event', e); }
    }

    // 🧠 НЕЙРОСОВЕТ: Новый вспомогательный метод для легкого обновления
    _updateActiveRehearsalLines(container, block) {
        if (!this.lyricsContainer) return;
        
        // Находим контейнер блока, если он не передан (хотя мы стараемся не передавать, если вызываем из smart update)
        const blockContainer = container || this.lyricsContainer.querySelector('.rehearsal-active-block');
        if (!blockContainer) return;

        const lines = blockContainer.querySelectorAll('.rehearsal-active-line');
        lines.forEach(line => {
            const lineIndex = parseInt(line.dataset.index, 10);
            
            // Снимаем старую активность
            if (line.classList.contains('active') && lineIndex !== this.currentLine) {
                line.classList.remove('active');
                if (this.currentStyle && this.currentStyle.cssClass) {
                    line.classList.remove(this.currentStyle.cssClass + '-active');
                }
            }

            // Ставим новую
            if (lineIndex === this.currentLine) {
                line.classList.add('active');
                this.currentLyricElement = line;
                if (this.currentStyle && this.currentStyle.cssClass) {
                    line.classList.add(this.currentStyle.cssClass + '-active');
                }
            }
        });
    }

    // ДОБАВЛЕНО: Метод для разделения больших блоков
    _splitLargeBlocks(blocks) {
        const MAX_LINES_PER_BLOCK = 8;
        const processedBlocks = [];
        
        blocks.forEach((originalBlock, blockIndex) => {
            // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Принудительная сортировка lineIndices
            if (!originalBlock.lineIndices || !Array.isArray(originalBlock.lineIndices)) {
                console.error(`Block ${blockIndex} has invalid lineIndices:`, originalBlock.lineIndices);
                return;
            }
            
            // Сортируем массив индексов для обеспечения правильного порядка границ
            const sortedLineIndices = [...originalBlock.lineIndices].sort((a, b) => a - b);
            console.log(`🔧 Block "${originalBlock.name}": original=[${originalBlock.lineIndices.join(',')}], sorted=[${sortedLineIndices.join(',')}]`);
            
            if (sortedLineIndices.length <= MAX_LINES_PER_BLOCK) {
                // Блок не нужно делить, но используем отсортированные индексы
                processedBlocks.push({
                    ...originalBlock,
                    lineIndices: sortedLineIndices
                });
                return;
            }
            
            // Блок нужно разделить - используем отсортированные индексы
            const lineIndices = sortedLineIndices;
            const totalLines = lineIndices.length;
            
            // Вычисляем оптимальное количество частей для равномерного разделения
            const numParts = Math.ceil(totalLines / MAX_LINES_PER_BLOCK);
            const linesPerPart = Math.ceil(totalLines / numParts);
            
            console.log(`Splitting block "${originalBlock.name}" (${totalLines} lines) into ${numParts} parts with ~${linesPerPart} lines each`);
            
            for (let partIndex = 0; partIndex < numParts; partIndex++) {
                const startIdx = partIndex * linesPerPart;
                const endIdx = Math.min(startIdx + linesPerPart, totalLines);
                const partLineIndices = lineIndices.slice(startIdx, endIdx);
                
                const partBlock = {
                    id: `${originalBlock.id}-part-${partIndex}`,
                    name: partIndex === 0 ? originalBlock.name : `${originalBlock.name} (продолжение ${partIndex + 1})`,
                    lineIndices: partLineIndices,
                    isContinuation: partIndex > 0,
                    originalBlockId: originalBlock.id,
                    partIndex: partIndex,
                    totalParts: numParts
                };
                
                processedBlocks.push(partBlock);
                console.log(`  Part ${partIndex + 1}: lines ${startIdx}-${endIdx-1} (${partLineIndices.length} lines)`);
            }
        });
        
        return processedBlocks;
    }

    // НОВОЕ: Санитизация входных блоков — убираем пустые/дубликаты и выходим за пределы текста
    _sanitizeBlocks(blocks) {
        const lyricsLen = Array.isArray(this.lyrics) ? this.lyrics.length : 0;
        const seen = new Set();
        const result = [];
        const allowedTypes = new Set(['verse', 'chorus', 'bridge', 'prechorus', 'intro', 'outro']);
        (blocks || []).forEach((blk, idx) => {
            if (!blk || !Array.isArray(blk.lineIndices) || blk.lineIndices.length === 0) {
                return; // пустой блок
            }
            // сортируем и уникализируем индексы, оставляем только валидные в пределах текста
            const sorted = [...blk.lineIndices].sort((a,b)=>a-b)
                .filter((v,i,arr)=> (i===0 || v!==arr[i-1]) && v>=0 && v<lyricsLen);
            if (sorted.length === 0) {return;}
            // используем ключ по диапазону для отбраковки полных дублей
            const key = `${sorted[0]}-${sorted[sorted.length-1]}`;
            if (seen.has(key)) {return;}
            seen.add(key);
            // сохраняем и валидируем тип блока (важно для окраски маркеров и панели)
            const rawType = typeof blk.type === 'string' ? blk.type.toLowerCase() : undefined;
            const type = allowedTypes.has(rawType) ? rawType : (blk.type ? rawType : undefined);
            result.push({
                id: blk.id || `blk-${idx}-${sorted[0]}`,
                name: blk.name || `Block ${idx+1}`,
                lineIndices: sorted,
                ...(type ? { type } : {})
            });
        });
        return result;
    }

    _renderStandardLines() {
        if (!this.lyricsContainer) {return;}
        this.lyricsContainer.innerHTML = '';
        this.lyricsContainer.className = 'lyrics-display style-standard'; // Reset classes

        // Check if manual scaling is active by seeing if fontScale is not the default 1.0
        const isManualScalingActive = window.textStyleManager && window.textStyleManager.getFontScale() !== 1.0;

        let fontSize, lineHeight;

        // Only calculate dynamic font size if manual scaling is NOT active
        if (this.currentStyle && this.currentStyle.id === 'concert' && !isManualScalingActive) {
            const result = this._calculateFontAndLineHeightForBlock(6); // For concert mode, assume 6 lines visible
            fontSize = result.fontSize;
            lineHeight = result.lineHeight;
            console.log(`Rendering standard lines with calculated fontSize=${fontSize}, lineHeight=${lineHeight}`);
        }

        this.lyrics.forEach((line, index) => {
            const lineElement = document.createElement('div');
            lineElement.className = 'lyric-line';
            console.log(`Rendering standard line [${index}]: '${line}'`); // DEBUG: Check raw lyric line
            
            if (this.currentStyle && this.currentStyle.css) {
                if (this.currentStyle.css.base) {lineElement.classList.add(this.currentStyle.css.base);}
                // Active/inactive handled by setActiveLine
            }
            lineElement.innerHTML = this._parseParenthesesForDuet(line);
            lineElement.dataset.index = index;
            
            if (this.currentStyle && this.currentStyle.options) {
                const opts = this.currentStyle.options;
                
                // Use calculated size for concert mode (if not manually scaling), otherwise use style's default
                if (fontSize && lineHeight) {
                    lineElement.style.fontSize = fontSize;
                    lineElement.style.lineHeight = lineHeight;
                } else if (opts.fontSize) {
                    lineElement.style.fontSize = opts.fontSize;
                }

                if (opts.lineSpacing && !lineHeight) { // Don't apply if lineHeight is already set
                    lineElement.style.lineHeight = opts.lineSpacing;
                }
            }
            
            this.lyricsContainer.appendChild(lineElement);
        });
        
        const bottomSpacer = document.createElement('div');
        bottomSpacer.style.height = '200px'; 
        this.lyricsContainer.appendChild(bottomSpacer);
    }
    
    /**
     * Set the active line by index
     * @param {number} index - Index of the line to activate
     */
    setActiveLine(index, force = false) {
        // --- ВОССТАНОВЛЕННАЯ ЛОГИКА КАРАОКЕ ---
        if (this.currentStyle && this.currentStyle.id === 'karaoke') {
            if (!this.activeKaraokeEl || !this.nextKaraokeEl) {
                console.warn("[KARAOKE] setActiveLine called before elements were initialized. Forcing render.");
                this._renderLyrics();
                return;
            }

            if (this.currentLine === index && !force) {
                return;
            }

            // При обновлении строк (не принудительном) меняем элементы местами, чтобы избежать "прыжка" текста
            if (!force) {
                [this.activeKaraokeEl, this.nextKaraokeEl] = [this.nextKaraokeEl, this.activeKaraokeEl];
            }

            this.currentLine = index;
            
            // Обновляем контент и стили для элементов
            const activeText = this.lyrics[index] || '';
            const nextText = this.lyrics[index + 1] || '';

            // Обновляем активный элемент
            this.activeKaraokeEl.textContent = activeText;
            this.activeKaraokeEl.classList.add('active');
            this.activeKaraokeEl.classList.remove('next');

            // Обновляем следующий элемент
            this.nextKaraokeEl.textContent = nextText;
            this.nextKaraokeEl.classList.add('next');
            this.nextKaraokeEl.classList.remove('active');

            // Применяем стили для консистентности
            const styleOptions = window.textStyleManager ? window.textStyleManager._getScaledStyle('karaoke') : {};
            if (styleOptions) {
                const { fontSize, lineHeight, textColor } = styleOptions;
                const applyStyles = (el, isActive) => {
                    if (!el) {return;}
                    el.style.fontSize = fontSize;
                    el.style.lineHeight = lineHeight;
                    el.style.color = textColor || '#ffffff';
                    el.style.transition = 'opacity 0.3s ease-in-out';
                    el.style.opacity = isActive ? '1' : '0.6';
                };
                applyStyles(this.activeKaraokeEl, true);
                applyStyles(this.nextKaraokeEl, false);
            }

            // Диспатчим событие изменения активной строки
            const event = new CustomEvent('active-line-changed', {
                detail: { lineIndex: index }
            });
            document.dispatchEvent(event);

            return; // ВАЖНО: выходим после обработки караоке.
        }
        // --- КОНЕЦ ЛОГИКИ КАРАОКЕ ---

        // Логика для Sync Editor и других режимов
        if (this.currentLyricElement) {
            this.currentLyricElement.classList.remove('active', 'becoming-active');
            if (this.currentStyle && this.currentStyle.cssClass) {
                this.currentLyricElement.classList.remove(this.currentStyle.cssClass + '-active');
            }
        }

        const lines = this.lyricsContainer.getElementsByClassName('lyric-line');
        if (index >= 0 && index < lines.length) {
        this.currentLyricElement = lines[index];
        this.currentLyricElement.classList.add('active');
            this.currentLyricElement.classList.add('becoming-active');
            if (this.currentStyle && this.currentStyle.cssClass) {
                this.currentLyricElement.classList.add(this.currentStyle.cssClass + '-active');
            }
        } else {
             this.currentLyricElement = null;
        }

        this.currentLine = index;

        console.log(`[SETACTIVE] Called with index ${index}. Current style: ${this.currentStyle ? this.currentStyle.id : 'none'}`);

        // В режиме репетиции логика другая
        if (this.currentStyle && this.currentStyle.id === 'rehearsal' && this.textBlocks.length > 0) {
            this._setActiveLineInRehearsalMode(index);
            // Диспатчим событие изменения активной строки
            const event = new CustomEvent('active-line-changed', {
                detail: { lineIndex: index }
            });
            document.dispatchEvent(event);
            return;
        }

        // Автоскролл к активной строке
        this._scrollToActiveLine();
        
        // Диспатчим событие изменения активной строки
        const event = new CustomEvent('active-line-changed', {
            detail: { lineIndex: index }
        });
        document.dispatchEvent(event);
    }

    _setActiveLineInStandardMode(index) {
        // Эта логика теперь в основном теле setActiveLine, оставляем метод пустым или удаляем
        // Оставим пока пустым, чтобы не сломать другие вызовы если они есть
    }
    
    _clearActiveLine() {
        if (this.currentLyricElement) {
            this.currentLyricElement.classList.remove('active', 'becoming-active');
            
            if (this.currentStyle && this.currentStyle.cssClass) {
                 this.currentLyricElement.classList.remove(this.currentStyle.cssClass + '-active');
            }
        }
    }
    
    updateLyricPosition(currentTime) {
        if (this.lyrics.length === 0) {return;}
        
        // Проверяем, находимся ли мы в режиме репетиции с блоками
        const isInRehearsalModeWithBlocks = this.currentStyle && 
                                          this.currentStyle.id === 'rehearsal' && 
                                          this.textBlocks && 
                                          this.textBlocks.length > 0;
        
        if (isInRehearsalModeWithBlocks) {
            // РЕЖИМ РЕПЕТИЦИИ
            const isEditMode = document.body.classList.contains('waveform-active');
            
            if (isEditMode) {
                // В режиме синхронизации используем стандартную логику маркеров
                if (window.markerManager) {
                    window.markerManager._updateLineMarkersUI(true);
                    const activeLineIndexByMarker = window.markerManager.getActiveLineAtTime(currentTime);
                    if (activeLineIndexByMarker >= 0 && activeLineIndexByMarker !== this.currentLine) {
                        this.setActiveLine(activeLineIndexByMarker);
                    }
                }
                return;
            }

            // ОСНОВНАЯ ЛОГИКА РЕПЕТИЦИИ (не-sync режим)
            let newActiveLineIndex = -1;

            // Определяем активную строку по маркерам
            if (window.markerManager && window.markerManager.getMarkers().length > 0) {
                newActiveLineIndex = window.markerManager.getActiveLineAtTime(currentTime);
            } else {
                // Если нет маркеров, не изменяем активную строку
                return;
            }
            
            if (newActiveLineIndex === -1 || newActiveLineIndex === this.currentLine) {
                return; // Активная строка не изменилась
            }

            console.log(`Rehearsal: Line changing from ${this.currentLine} to ${newActiveLineIndex}`);
            
            // ОБНОВЛЕНО: Работаем с разделенными блоками
            const processedBlocks = this._splitLargeBlocks(this.textBlocks);
            
            // Находим блок для новой активной строки
            const newActiveBlock = processedBlocks.find(block => 
                block.lineIndices && block.lineIndices.includes(newActiveLineIndex)
            );
            
            // Находим текущий активный блок
            const currentActiveBlock = processedBlocks.find(block => 
                block.lineIndices && block.lineIndices.includes(this.currentLine)
            );
            
            console.log(`Rehearsal: Current line ${this.currentLine} belongs to block:`, currentActiveBlock?.id, currentActiveBlock?.lineIndices);
            console.log(`Rehearsal: New line ${newActiveLineIndex} belongs to block:`, newActiveBlock?.id, newActiveBlock?.lineIndices);
            
            // Если блок изменился - перерисовываем весь контент
            if (!newActiveBlock || !currentActiveBlock || newActiveBlock.id !== currentActiveBlock.id) {
                console.log(`Rehearsal: *** BLOCK CHANGED *** from ${currentActiveBlock?.id || 'none'} to ${newActiveBlock?.id || 'none'}`);
                console.log(`Rehearsal: Line changed from ${this.currentLine} to ${newActiveLineIndex}`);
                console.log(`Rehearsal: Current block lines:`, currentActiveBlock?.lineIndices);
                console.log(`Rehearsal: New block lines:`, newActiveBlock?.lineIndices);
                
                // Обновляем активную строку ПЕРЕД перерисовкой
                this.currentLine = newActiveLineIndex;
                
                this._renderBlocksForRehearsal();
                
                // Сбрасываем скролл наверх (без автоскролла)
                if (this.containerElement) {
                    this.containerElement.scrollTop = 0;
                }
            } else {
                // Блок тот же, обновляем только активную строку
                console.log(`Rehearsal: Same block (${currentActiveBlock?.id}), updating active line from ${this.currentLine} to ${newActiveLineIndex}`);
                // Обновляем активную строку
                this.currentLine = newActiveLineIndex;
                this.setActiveLine(newActiveLineIndex);
            }
            
            // Автовозврат при случайном скролле (через 2 секунды)
            if (this._rehearsalScrollTimeout) {
                clearTimeout(this._rehearsalScrollTimeout);
            }
            
            // Подавляем авто-возврат в режиме репетиции (без автоскролла вообще)
            const isRehearsal = this.currentStyle && this.currentStyle.id === 'rehearsal';
            if (!isRehearsal) {
                this._rehearsalScrollTimeout = setTimeout(() => {
                    if (this.containerElement && this.containerElement.scrollTop > 10) {
                        console.log('Rehearsal: Auto-returning to top after scroll');
                        this.containerElement.scrollTo({
                            top: 0,
                            behavior: 'smooth'
                        });
                    }
                }, 2000);
            }
            
                return;
            }
        
        // СТАНДАРТНАЯ ЛОГИКА ДЛЯ ДРУГИХ РЕЖИМОВ
        // В обычном режиме воспроизведения используем маркеры для определения активной строки
        if (window.markerManager && window.markerManager.getMarkers().length > 0) {
            // Если у нас есть маркеры, используем их
            const activeLineIndexByMarker = window.markerManager.getActiveLineAtTime(currentTime);
            
            // Проверяем, находимся ли в режиме редактирования/синхронизации 
            const isEditMode = document.body.classList.contains('waveform-active');
            
            if (isEditMode) {
                // В режиме синхронизации обновляем UI маркеров
                window.markerManager._updateLineMarkersUI(true);
            }
            
            if (activeLineIndexByMarker >= 0 && activeLineIndexByMarker !== this.currentLine) {
                this.setActiveLine(activeLineIndexByMarker);
            }
        } else {
            // Если нет маркеров, используем пропорциональное время
            const progress = Math.min(currentTime / this.duration, 1);
            const targetLine = Math.floor(progress * this.lyrics.length);
            
            if (targetLine !== this.currentLine && targetLine < this.lyrics.length) {
                this.setActiveLine(targetLine);
            }
        }
    }
    
    _scrollToActiveBlock(blockId) {
        if (!this.containerElement) {return;}
        const blockElement = this.lyricsContainer.querySelector(`.lyric-block[data-block-id="${blockId}"]`);
        
        if (blockElement) {
            console.log("Scrolling to active block:", blockId);
            const containerHeight = this.containerElement.clientHeight;
            const blockTop = blockElement.offsetTop;
            const blockHeight = blockElement.offsetHeight; // Get the actual height of the block element

            // Calculate scroll target to center the block vertically
            let scrollTarget = blockTop + (blockHeight / 2) - (containerHeight / 2);

            // Ensure scrollTarget is within valid bounds [0, maxScroll]
            scrollTarget = Math.max(0, scrollTarget); // Don't scroll above the top
            const maxScroll = this.containerElement.scrollHeight - containerHeight;
            scrollTarget = Math.min(scrollTarget, maxScroll); // Don't scroll beyond the bottom

            this.containerElement.scrollTo({
                top: scrollTarget,
                behavior: 'smooth'
            });
        }
    }
    
    // New method to preprocess lyrics text
    _preprocessLyrics(text) {
        console.log("Preprocessing lyrics text, length:", text ? text.length : 0);
        if (!text || text.length === 0) {return '';}

        let processed = text;
        
        // Определяем язык для более специфичной обработки
        const language = this._detectLanguage(text);
        
        // Удаляем дополнительные символы, которые могут быть в экспортированных текстах
        processed = processed.replace(/[\u2028\u2029]/g, '\n'); // Заменяем специальные переносы строк
        processed = processed.replace(/\uFEFF/g, ''); // Удаляем BOM маркер
        
        // Заменяем HTML-энтити на соответствующие символы
        processed = processed.replace(/&quot;/g, '"');
        processed = processed.replace(/&amp;/g, '&');
        processed = processed.replace(/&lt;/g, '<');
        processed = processed.replace(/&gt;/g, '>');
        processed = processed.replace(/&nbsp;/g, ' ');
        
        // Удаляем комментарии и метаданные в скобках для текстов песен
        if (language === 'english') {
            // Удаляем стандартные метаданные в квадратных скобках
            processed = processed.replace(/\[Verse\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Chorus\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Bridge\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Intro\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Outro\s*\d*\s*\]/gi, '');
        } else if (language === 'russian') {
            // Удаляем метаданные на русском языке
            processed = processed.replace(/\[Куплет\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Припев\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Бридж\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Вступление\s*\d*\s*\]/gi, '');
            processed = processed.replace(/\[Кода\s*\d*\s*\]/gi, '');
        }
        
        // Удаляем общие временные метки, которые могут быть в текстах (например, [00:12])
        processed = processed.replace(/\[\d{1,2}:\d{2}(\.\d+)?\]/g, '');
        
        // Если в тексте остались обратные слеши (часто используются как переносы строк)
        if (processed.includes('\\')) {
            processed = processed.replace(/\\+/g, '\n');
        }
        
        return processed;
    }
    
    /**
     * Subscribe to marker manager events
     * @private
     */
    _subscribeToMarkerManager() {
        if (window.markerManager) {
            this.usingMarkerManager = true;
            
            // Subscribe to marker changes
            window.markerManager.subscribe('markersReset', () => {
                // Reset highlighting when markers are reset
                this._resetHighlighting();
            });
            
            console.log('Subscribed to MarkerManager events');
        }
    }
    
    /**
     * Reset highlighting on all lines
     * @private
     */
    _resetHighlighting() {
        const lines = this.lyricsContainer.getElementsByClassName('lyric-line');
        for (let i = 0; i < lines.length; i++) {
            lines[i].classList.remove('active');
        }
    }
    
    reset() {
        this.currentLine = 0;
        this.autoScrollEnabled = true;
        
        // Очищаем все таймауты
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        
        if (this.rehearsalScrollTimeout) {
            clearTimeout(this.rehearsalScrollTimeout);
            this.rehearsalScrollTimeout = null;
        }
        
        // Очищаем активную строку
        if (this.currentLyricElement) {
            this.currentLyricElement.classList.remove('active');
            this.currentLyricElement = null;
        }
        
        // Устанавливаем первую строку как активную только при наличии маркеров
        if (this.lyrics.length > 0) {
            // Проверяем наличие маркеров
            if (window.markerManager && window.markerManager.getMarkers().length > 0) {
            this.setActiveLine(0);
                console.log("reset: Установлена активная строка 0 (есть маркеры)");
            } else {
                // Если маркеров нет, просто обнуляем активную строку без установки новой
                console.log("reset: Активная строка не установлена (нет маркеров)");
            }
        }
    }
    
    /**
     * Перезагружает текст, даже если он уже загружен.
     * Используется при переключении между треками для гарантии обновления.
     * @param {string} text - текст для загрузки
     * @param {number} duration - длительность трека в секундах
     * @param {boolean} shouldRender - флаг, нужно ли сразу рендерить текст (по умолчанию true)
     */
    reloadLyrics(text, duration, shouldRender = true) {
        console.log("Принудительная перезагрузка текста песни", shouldRender ? "с рендерингом" : "без рендеринга");
        
        // Сбрасываем текущее состояние
        this.reset();
        
        // Загружаем текст заново
        this.loadLyrics(text, duration, shouldRender);

        // Если блоки уже есть, выводим их для отладки (УДАЛЕНО)
        // if (this.textBlocks.length > 0) {
        //     console.log('LyricsDisplay: Reloaded text with existing blocks. Total blocks:', this.textBlocks.length);
        //     console.log('LyricsDisplay: Existing blocks detailed:', this.textBlocks);
        // }

        // Применяем стили
        this.setStyle({ id: 'default', name: 'По умолчанию' });
    }
    
    /**
     * Set the style for the lyrics display
     * @param {Object} style - Style object with styling properties
     */
    setStyle(style) {
        if (!style || !style.id) {
            console.error('LyricsDisplay: Invalid style object received.', style);
            return;
        }

        const newStyleId = style.id;
        
        // Deactivate rehearsal mode if the current style was rehearsal and the new one is not
        if (this.currentStyle && this.currentStyle.id === 'rehearsal' && newStyleId !== 'rehearsal') {
            this.deactivateRehearsalDisplay();
        }

        // Remove old style classes
        if (this.currentStyle) {
            if (this.currentStyle.cssClass) {
                this.lyricsContainer.classList.remove(this.currentStyle.cssClass);
            }
            if (this.currentStyle.containerClass && this.containerElement) {
                this.containerElement.classList.remove(this.currentStyle.containerClass);
            }
        }
        
        // Set new style and apply classes
        this.currentStyle = style;
        console.log('LyricsDisplay: Setting style to', style.name);

        if (style.cssClass) {
            this.lyricsContainer.classList.add(style.cssClass);
        }
        if (style.containerClass && this.containerElement) {
            this.containerElement.classList.add(style.containerClass);
        }

        // --- FIX FOR REHEARSAL MODE ---
        // If the new style is rehearsal, activate its specific rendering logic and stop.
        if (newStyleId === 'rehearsal') {
            this.activateRehearsalDisplay(); // This handles rendering blocks
            return; // Do not proceed to generic style option application
        }
        // --- END FIX ---

        // Apply specific options like colors, fonts, etc.
        if (style.options) {
        this._applyCustomStyleOptions(style.options);
        }

        // Re-render lyrics with the new style, but only if not in rehearsal mode
        this._renderLyrics();
        
        // Update the active line to reflect the new style
        this._updateActiveLineStyle();

        // Persist the selected style
        localStorage.setItem('selectedTextStyle', newStyleId);
    }
    
    /**
     * Updates the style of the currently active line.
     * @private
     */
    _updateActiveLineStyle() {
        // Find the active line and apply the current style
        const activeLine = this.lyricsContainer.querySelector('.rehearsal-active-line.active');
        if (activeLine) {
            if (this.currentStyle && this.currentStyle.cssClass) {
                activeLine.classList.add(this.currentStyle.cssClass + '-active');
            }
        }
    }
    
    /**
     * Apply custom style options to lyrics display
     * @param {Object} options - Style options
     * @private
     */
    _applyCustomStyleOptions(options) {
        if (!options) {return;}
        
        if (this.lyricsContainer) {
            this.lyricsContainer.style.textAlign = options.textAlign || 'center';
            this.lyricsContainer.style.lineHeight = options.lineSpacing || '1.6';
            this.lyricsContainer.style.color = options.textColor || '#ffffff';
            this.lyricsContainer.style.fontSize = options.fontSize || '1em';
            this.lyricsContainer.style.fontFamily = options.fontFamily || 'Arial, sans-serif';
            
            // Handle background color and text shadow
            this.lyricsContainer.style.backgroundColor = options.backgroundColor || 'transparent';
        }
    }
    
    /**
     * Apply transition to an element
     * @param {HTMLElement} element - Target element
     * @param {string} transition - Transition type
     * @private
     */
    _applyTransition(element, transition) {
        if (!element || !transition) {return;}
        
        // Remove existing transition classes
        element.classList.remove(
            'transition-fade',
            'transition-slide-up',
            'transition-slide-down',
            'transition-zoom'
        );
        
        // Add new transition class
        element.classList.add('transition-' + transition);
    }
    
    /**
     * Set the transition animation for all lyrics
     * @param {string} transitionType - Type of transition animation
     */
    setTransition(transitionType) {
        if (!this.containerElement) {return;}
        
        console.log(`Setting lyrics transition: ${transitionType}`);
        
        // Handle 'none' transition mode (disable all transitions)
        if (transitionType === 'none') {
            console.log('Disabling transitions');
            this.currentTransition = 'none';
            
            // Remove existing transition classes from containers
            [this.containerElement, this.lyricsContainer].forEach(container => {
                if (!container) {return;}
                
                const existingClasses = Array.from(container.classList)
                    .filter(c => c.startsWith('transition-'));
                existingClasses.forEach(c => container.classList.remove(c));
            });
            
            // Restore original text if needed
            if (this._hasWrappedLetters) {
                this._unwrapLetters();
            }
            return;
        }
        
        // For regular transitions
        if (!transitionType) {return;}
        
        // Store current transition
        this.currentTransition = transitionType;
        
        // Remove existing transition classes from containers
        [this.containerElement, this.lyricsContainer].forEach(container => {
            if (!container) {return;}
            
            const existingClasses = Array.from(container.classList)
                .filter(c => c.startsWith('transition-'));
            existingClasses.forEach(c => container.classList.remove(c));
            
            // Add new transition class
            container.classList.add('transition-' + transitionType);
        });
        
        // Process each transition type appropriately
        if (transitionType === 'matrix') {
            this._prepareMatrixEffect();
        }
        else if (transitionType === 'letterByLetter' || transitionType === 'letterShine' || transitionType === 'cinemaLights') {
            this._prepareLetterByLetterEffect();
        }
        else if (transitionType === 'wordByWord') {
            this._prepareWordByWordEffect();
        }
        else if (['echo', 'edgeGlow', 'pulseRim', 'fireEdge', 'neonOutline', 'starlight', 'laserScan'].includes(transitionType)) {
            this._prepareDataTextAttributes();
        }
        else if (this._hasWrappedLetters && 
                 !['matrix', 'letterByLetter', 'wordByWord', 'echo', 'edgeGlow', 'pulseRim', 'fireEdge', 'neonOutline', 'starlight', 'laserScan', 'letterShine', 'cinemaLights'].includes(transitionType)) {
            this._unwrapLetters();
        }
        
        // Force a redraw to ensure transition is visible immediately
        void this.lyricsContainer.offsetWidth;
        
        // Force-trigger animation on the active line if one exists
        if (this.currentLyricElement) {
            this.currentLyricElement.classList.remove('becoming-active');
            void this.currentLyricElement.offsetWidth; // Force reflow
            
            // Add animation class only if NOT in rehearsal mode
            const isInRehearsalMode = this.currentStyle && this.currentStyle.id === 'rehearsal';
            if (!isInRehearsalMode) {
            this.currentLyricElement.classList.add('becoming-active');
            }
        }
    }
    
    /**
     * Prepare the letter-by-letter effect by wrapping each letter in a span
     * @private
     */
    _prepareLetterByLetterEffect() {
        if (!this.lyricsContainer) {return;}
        
        // Get all lyric lines
        const lines = this.lyricsContainer.getElementsByClassName('lyric-line');
        
        // Flag to track if we've wrapped letters
        this._hasWrappedLetters = true;
        
        // Store original text for later unwrapping if needed
        if (!this._originalLineTexts) {
            this._originalLineTexts = [];
            for (let i = 0; i < lines.length; i++) {
                this._originalLineTexts[i] = lines[i].textContent;
            }
        }
        
        // Process each line
        for (let i = 0; i < lines.length; i++) {
            // Skip if already processed
            if (lines[i].querySelector('span')) {continue;}
            
            const text = this._originalLineTexts[i] || lines[i].textContent;
            let wrappedText = '';
            
            // Create sequential delays for letter-by-letter animation
            for (let j = 0; j < text.length; j++) {
                const delay = j * 0.05; // Sequential delay based on letter position
                const char = text[j];
                
                if (char === ' ') {
                    wrappedText += `<span style="animation-delay: ${delay}s; display: inline-block; width: 0.3em;">&nbsp;</span>`;
                } else {
                    wrappedText += `<span style="animation-delay: ${delay}s;">${char}</span>`;
                }
            }
            
            // Update the content with wrapped letters
            lines[i].innerHTML = wrappedText;
        }
    }
    
    /**
     * Prepare the word-by-word effect by wrapping each word in a span
     * @private
     */
    _prepareWordByWordEffect() {
        if (!this.lyricsContainer) {return;}
        
        // Get all lyric lines
        const lines = this.lyricsContainer.getElementsByClassName('lyric-line');
        
        // Flag to track if we've wrapped words
        this._hasWrappedLetters = true;
        
        // Store original text for later unwrapping if needed
        if (!this._originalLineTexts) {
            this._originalLineTexts = [];
            for (let i = 0; i < lines.length; i++) {
                this._originalLineTexts[i] = lines[i].textContent;
            }
        }
        
        // Process each line
        for (let i = 0; i < lines.length; i++) {
            // Skip if already processed
            if (lines[i].querySelector('span')) {continue;}
            
            const text = this._originalLineTexts[i] || lines[i].textContent;
            const words = text.split(' ');
            let wrappedText = '';
            
            // Create sequential delays for word-by-word animation
            for (let j = 0; j < words.length; j++) {
                const delay = j * 0.15; // Sequential delay based on word position
                wrappedText += `<span class="word" style="animation-delay: ${delay}s;">${words[j]}</span> `;
            }
            
            // Update the content with wrapped words
            lines[i].innerHTML = wrappedText;
        }
    }
    
    /**
     * Add data-text attributes for transitions that use pseudo-elements
     * @private
     */
    _prepareDataTextAttributes() {
        if (!this.lyricsContainer) {return;}
        
        // Get all lyric lines
        const lines = this.lyricsContainer.getElementsByClassName('lyric-line');
        
        // For each line, add the data-text attribute with the line's text content
        for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i].textContent;
            lines[i].setAttribute('data-text', lineText);
        }
    }
    
    /**
     * Prepare all lines for Matrix effect by wrapping each letter in spans
     * @private
     */
    _prepareMatrixEffect() {
        if (!this.lyricsContainer) {return;}
        
        // Get all lyric lines
        const lines = this.lyricsContainer.getElementsByClassName('lyric-line');
        
        // Flag to track if we've wrapped letters
        this._hasWrappedLetters = true;
        
        // Store original text for later unwrapping if needed
        if (!this._originalLineTexts) {
            this._originalLineTexts = [];
            for (let i = 0; i < lines.length; i++) {
                this._originalLineTexts[i] = lines[i].textContent;
                
                // Проверяем целостность текста, если необходимо - восстанавливаем из lyrics
                if (lines[i].textContent.indexOf(' ') === -1 && lines[i].textContent.length > 20) {
                    console.log("Проблема с текстом строки, восстанавливаем из lyrics:", i);
                    if (i < this.lyrics.length) {
                        lines[i].textContent = this.lyrics[i];
                        this._originalLineTexts[i] = this.lyrics[i];
                    }
                }
            }
        }
        
        // Process each line
        for (let i = 0; i < lines.length; i++) {
            // Skip if already processed
            if (lines[i].querySelector('span')) {continue;}
            
            const text = this._originalLineTexts[i] || lines[i].textContent;
            let wrappedText = '';
            
            // Create random delays for letter dropping effect
            for (let j = 0; j < text.length; j++) {
                const delay = Math.random() * 0.5; // Random delay between 0 and 500ms
                const char = text[j];
                // Сохраняем пробелы как отдельные span-элементы с пробелом
                if (char === ' ') {
                    wrappedText += `<span style="animation-delay: ${delay}s; display: inline-block; width: 0.3em;">&nbsp;</span>`;
                } else {
                    wrappedText += `<span style="animation-delay: ${delay}s; display: inline-block;">${char}</span>`;
                }
            }
            
            // Update the content with wrapped letters
            lines[i].innerHTML = wrappedText;
        }
    }
    
    /**
     * Unwrap letters by restoring original text
     * @private
     */
    _unwrapLetters() {
        // Find all span elements with the 'letter' class and replace them with their text content
        this.lyricsContainer.querySelectorAll('span.letter').forEach(span => {
            const parent = span.parentNode;
            if (parent) {
                const textNode = document.createTextNode(span.textContent);
                parent.replaceChild(textNode, span);
                // Normalize to merge adjacent text nodes
                parent.normalize();
            }
        });
    }
    
    /**
     * Scroll to the active lyric line
     * @private
     */
    _scrollToActiveLine() {
        if (!this.currentLyricElement) {
            return;
        }

        const element = this.currentLyricElement;
        const isEditMode = document.body.classList.contains('waveform-active');

        // SYNC EDITOR - БЛОКИРУЕМ стандартный скролл, используем только принудительное центрирование
        if (isEditMode) {
            console.log('Sync Editor: Skipping standard scroll - using forced centering only');
            return;
        }

        // REVISED: Concert Mode Teleprompter Logic - now independent and faster
        if (this.currentStyle && this.currentStyle.id === 'concert') {
            const container = this.containerElement;
            if (container && element) {
                const offset = 30; // 30px отступ от верха, чтобы строка не прилипала к краю
                
                // Расчет целевой позиции скролла
                // element.offsetTop - позиция строки относительно начала всего контента
                // отнимаем отступ, чтобы строка была чуть ниже верха контейнера
                const targetScrollTop = element.offsetTop - offset;

                container.scrollTo({
                    top: targetScrollTop,
                    behavior: 'auto', // 'auto' для мгновенного скролла
                });
            }
            // Сообщаем поезду обновить позицию немедленно (без ожидания первой строки)
            try {
                window.dispatchEvent(new CustomEvent('lyrics-teleprompter-scroll'));
            } catch(_) {}
            return; // Выходим после обработки концертного режима
        }
        
        // Standard scrolling for other modes (respects autoScrollEnabled)
        if (!this.autoScrollEnabled) {
            return;
        }

        const container = this.containerElement;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Проверяем, находимся ли в режиме репетиции с блоками
        const isInRehearsalModeWithBlocks = this.currentStyle && 
                                          this.currentStyle.id === 'rehearsal' && 
                                          this.textBlocks && 
                                          this.textBlocks.length > 0;

        // В режиме репетиции БЕЗ Sync НЕ скроллим строки (только блоки)
        if (isInRehearsalModeWithBlocks && !isEditMode) {
            console.log('Rehearsal mode without Sync: Skipping line scroll (block-based display)');
            return; 
        }
        
        // ОБЫЧНЫЕ РЕЖИМЫ - адаптивное позиционирование
        const containerHeight = container.clientHeight;
        const lineTop = element.offsetTop;
        const lineHeight = element.offsetHeight;
        
        // Позиционируем активную строку чуть выше центра для лучшей видимости следующих строк
        const lineIndex = parseInt(element.dataset.index) || 0;
        const totalLines = this.lyrics ? this.lyrics.length : 100;
        
        let scrollTarget;
        if (lineIndex < Math.min(5, totalLines * 0.1)) {
            // Первые строки - держим по центру
                    scrollTarget = lineTop - (containerHeight / 2) + (lineHeight / 2);
        } else {
            // Остальные строки - чуть выше центра (на 1/3 от верха)
            scrollTarget = lineTop - (containerHeight / 3);
        }
        
        // Ограничиваем диапазон скролла
            scrollTarget = Math.max(0, scrollTarget);
        const maxScroll = container.scrollHeight - containerHeight;
        scrollTarget = Math.min(scrollTarget, maxScroll);
        
        // Плавный скролл
        container.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
        });
            
        console.log(`Scrolled to active line: ${scrollTarget}px (line ${lineIndex})`);
    }
    
    /**
     * Sanitizes the lyrics text to ensure proper display
     * @param {string} text - The raw lyrics text
     * @returns {string} - The sanitized text
     * @private
     */
    _sanitizeLyricsText(text) {
        if (!text) {return '';}

        // Проверяем наличие RTF-контента
        const isRtfContent = text.includes('\\rtf') || 
                           text.includes('\\f') ||
                           text.includes('\\pard') ||
                           text.includes('\\ansi') ||
                           text.includes('cocoartf') || 
                           text.includes('ansicpg');
        
        console.log("Исходный текст (первые 200 символов):", text.substring(0, 200));
        
        // Определяем язык текста
        const language = this._detectTextLanguage(text);
        console.log(`Определен язык текста: ${language === 'russian' ? 'русский' : 'английский'}`);

        // Пробуем извлечь юникод-символы для кириллицы из RTF
        if (language === 'russian' && isRtfContent) {
            console.log("Пробуем извлечь юникод-символы для кириллицы из RTF");
            const unicodeExtracted = this._extractUnicodeFromRtf(text);
            if (unicodeExtracted && unicodeExtracted.length > 20) {
                console.log("Успешно извлечены юникод-символы для кириллицы:", unicodeExtracted.substring(0, 100));
                return unicodeExtracted;
            }
        }

        // Пробуем извлечь структурированный контент из RTF
        if (isRtfContent) {
            const extractedRtf = this._extractStructuredContentFromRtf(text);
            if (extractedRtf && extractedRtf.length > 20) {
                console.log("Успешно извлечен структурированный контент из RTF:", extractedRtf.substring(0, 100));
                return extractedRtf;
            }
        }
        
        // Обычная очистка текста в зависимости от языка
        let sanitized;
        
        if (language === 'english') {
            sanitized = this._sanitizeEnglishText(text, isRtfContent);
        } else {
            sanitized = this._sanitizeRussianText(text, isRtfContent);
        }
        
        console.log("Lyrics after additional sanitization:", sanitized.substring(0, 100));
        
        // Проверяем, если после очистки получился короткий или пустой текст,
        // пробуем альтернативные методы
        if (!sanitized || sanitized.trim().length < 20) {
            console.log("Обнаружен короткий или пустой текст после очистки, пробуем альтернативные методы");
            
            // Прямое извлечение строк из RTF
            if (isRtfContent) {
                const lines = this._extractLinesDirectlyFromRtf(text);
                if (lines && lines.length > 3) {
                    console.log(`Извлечено ${lines.length} строк напрямую из RTF`);
                    return lines.join('\n');
                }
            }
            
            // Если ничего не помогло, возвращаемся к исходному тексту
            return text;
        }
        
        return sanitized;
    }
    
    /**
     * Улучшает структуру английского текста
     * @param {string} text - Исходный текст
     * @returns {string} - Улучшенный текст с правильной структурой
     * @private
     */
    _improveEnglishStructure(text) {
        // Пробуем исправить основные проблемы с переносами строк
        let result = text.replace(/([.!?])\s*([A-Z])/g, '$1\n$2')  // Разделяем предложения
               .replace(/(\w)\s+([A-Z][a-z]{2,})/g, '$1\n$2')  // Разделяем по заглавным буквам 
               .replace(/([.,!?;:])\s*([A-Z][a-z]+)/g, '$1\n$2'); // Разделяем пунктуацию и заглавные буквы
        
        // Специальная обработка известных проблем со слипшимися строками
        result = result.replace(/So insecure/g, 'So insecure\n\n')  // Добавляем двойной перенос после этой строки
               .replace(/insecureCrawling/g, 'insecure\n\nCrawling')
               .replace(/What am I leaving when I'm done here\?So, if/g, 'What am I leaving when I\'m done here?\n\nSo, if')
               .replace(/What am I leaving when I'm done here\?/g, 'What am I leaving when I\'m done here?\n')
               .replace(/the only wayAnd/g, 'the only way\n\nAnd')
               .replace(/Leave out all the restDon't/g, 'Leave out all the rest\n\nDon\'t')
               .replace(/Leave out all the restForgetting/g, 'Leave out all the rest\n\nForgetting')
               .replace(/I can't be who you areWhen/g, 'I can\'t be who you are\n\nWhen')
               .replace(/in grayAnd/g, 'in gray\n\nAnd')
               .replace(/for youAnd/g, 'for you\n\nAnd')
               .replace(/disappear Waiting/g, 'disappear\n\nWaiting')
               .replace(/let you goOh/g, 'let you go\n\n(Oh)');
               
        // Нормализация переносов и пробелов
        result = result.replace(/\n{3,}/g, '\n\n') // Максимум 2 переноса подряд
               .replace(/[ \t]+/g, ' ')    // Удаляем лишние пробелы
               .trim();
               
        return result;
    }
    
    /**
     * Определяет язык текста
     * @param {string} text - Текст для анализа
     * @returns {string} - 'russian' или 'english'
     * @private
     */
    _detectTextLanguage(text) {
        if (!text || typeof text !== 'string') {
            return 'russian'; // По умолчанию русский
        }
        
        // Подсчет символов разных языков
        const russianChars = (text.match(/[а-яА-Я]/g) || []).length;
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        
        // Проверка на ключевые слова
        const hasRussianMarkers = /\b(и|в|не|на|с|по|для|от|к|за)\b/i.test(text);
        const hasEnglishMarkers = /\b(the|and|in|of|to|a|is|for|with|as)\b/i.test(text);
        
        // Принятие решения на основе статистики
        if (russianChars > englishChars * 2) {return 'russian';}
        if (englishChars > russianChars * 2) {return 'english';}
        
        // При близком соотношении используем маркеры
        if (hasRussianMarkers && !hasEnglishMarkers) {return 'russian';}
        if (hasEnglishMarkers && !hasRussianMarkers) {return 'english';}
        
        // По умолчанию используем русский
        return russianChars >= englishChars ? 'russian' : 'english';
    }
    
    /**
     * Обработка английского текста
     * @param {string} text - Исходный текст
     * @param {boolean} isRtfContent - Является ли текст RTF-контентом
     * @returns {string} - Очищенный текст
     * @private
     */
    _sanitizeEnglishText(text, isRtfContent) {
        let result = text;
        
        // Если это RTF, удаляем RTF-теги
        if (isRtfContent) {
            console.log("Выполняем базовую очистку RTF для английского текста...");
            
            // Признаки RTF, которые нужно удалить
            const rtfPatterns = [
                '{\\rtf1', '\\\'', '\\par', '\\pard', 
                '\\f0', '\\fs', '\\cf', '\\outl', 
                '\\strokec', '\\stroke', '\\rquote', 
                '\\u', '\\tab', '\\i', '\\b',
                'f1ansiansicpg1251cocoar', 'f2580', 'cocoa',
                'ansicpg1251', 'cocoartf', 'rtf1ansi'
            ];
            
            // Удаляем RTF-теги
            for (const pattern of rtfPatterns) {
                result = result.replace(new RegExp(pattern, 'g'), '');
            }
        }
        
        // Базовая очистка для любого текста
        result = result.replace(/[^\x20-\x7E\n\r]/g, ''); // Оставляем только ASCII
        result = result.replace(/\\n/g, '\n');  // Заменяем \n на реальные переводы строк
        result = result.replace(/\\r/g, '\n');  // Заменяем \r на реальные переводы строк
        result = result.replace(/\r\n|\r/g, '\n'); // Стандартизируем переводы строк
        
        // Удаляем лишние символы
        result = result.replace(/\\/g, '');  // Удаляем оставшиеся обратные слэши
        result = result.replace(/\{|\}/g, ''); // Удаляем фигурные скобки
        result = result.replace(/[ \t]+/g, ' '); // Нормализуем пробелы
        result = result.replace(/^\s+|\s+$/gm, ''); // Обрезаем пробелы в начале и конце строк
        result = result.replace(/\n{3,}/g, '\n\n'); // Ограничиваем количество пустых строк
        
        // Улучшаем структуру текста, если это нужно
        if (!result.includes('\n\n') && result.length > 100) {
            result = this._improveEnglishStructure(result);
        }
        
        return result;
    }
    
    /**
     * Обработка русского текста
     * @param {string} text - Исходный текст
     * @param {boolean} isRtfContent - Является ли текст RTF-контентом
     * @returns {string} - Очищенный текст
     * @private
     */
    _sanitizeRussianText(text, isRtfContent) {
        let result = text;
        
        // Если это RTF, удаляем RTF-теги
        if (isRtfContent) {
            console.log("Выполняем базовую очистку RTF для русского текста...");
            
            // Признаки RTF, которые нужно удалить
            const rtfPatterns = [
                '{\\rtf1', '\\\'', '\\par', '\\pard', 
                '\\f0', '\\fs', '\\cf', '\\outl', 
                '\\strokec', '\\stroke', '\\rquote', 
                '\\u', '\\tab', '\\i', '\\b',
                'f1ansiansicpg1251cocoar', 'f2580', 'cocoa',
                'ansicpg1251', 'cocoartf', 'rtf1ansi'
            ];
            
            // Удаляем RTF-теги
            for (const pattern of rtfPatterns) {
                result = result.replace(new RegExp(pattern, 'g'), '');
            }
        }
        
        // Базовая очистка для любого текста
        result = result.replace(/[^\x20-\x7E\u0400-\u04FF\n\r]/g, ''); // Оставляем только ASCII и кириллицу
        result = result.replace(/\\n/g, '\n');  // Заменяем \n на реальные переводы строк
        result = result.replace(/\\r/g, '\n');  // Заменяем \r на реальные переводы строк
        result = result.replace(/\r\n|\r/g, '\n'); // Стандартизируем переводы строк
        
        // Удаляем лишние символы
        result = result.replace(/\\/g, '');  // Удаляем оставшиеся обратные слэши
        result = result.replace(/\{|\}/g, ''); // Удаляем фигурные скобки
        result = result.replace(/[ \t]+/g, ' '); // Нормализуем пробелы
        result = result.replace(/^\s+|\s+$/gm, ''); // Обрезаем пробелы в начале и конце строк
        result = result.replace(/\n{3,}/g, '\n\n'); // Ограничиваем количество пустых строк
        
        return result;
    }

    // --- Block Management Methods ---

    enableBlockMode(editorLinesContainer = null) {
        this.isInBlockMode = true;
        this.currentBlockCreation = [];
        console.log("Block Mode Enabled. Editor Target:", editorLinesContainer);
        // TODO: Add UI logic to show '+' buttons in editorLinesContainer
        // This will likely involve iterating over lines in the editor and adding controls.
        // This method might be better placed in waveform-editor.js to handle DOM manipulations there,
        // and call lyricsDisplay for state management.
    }

    disableBlockMode(editorLinesContainer = null) {
        this.isInBlockMode = false;
        this.currentBlockCreation = [];
        console.log("Block Mode Disabled. Editor Target:", editorLinesContainer);
        // TODO: Add UI logic to hide '+' buttons
    }

    addLineToCreatingBlock(lineIndex) {
        if (!this.isInBlockMode) {return;}
        if (!this.currentBlockCreation.includes(lineIndex)) {
            this.currentBlockCreation.push(lineIndex);
            this.currentBlockCreation.sort((a, b) => a - b); // Keep indices sorted
            console.log("Added line to current block:", lineIndex, this.currentBlockCreation);
            // TODO: Update UI for the line in editor to show it's selected
        }
    }

    removeLineFromCreatingBlock(lineIndex) {
        if (!this.isInBlockMode) {return;}
        const indexInCreation = this.currentBlockCreation.indexOf(lineIndex);
        if (indexInCreation > -1) {
            this.currentBlockCreation.splice(indexInCreation, 1);
            console.log("Removed line from current block:", lineIndex, this.currentBlockCreation);
            // TODO: Update UI for the line in editor
        }
    }

    finalizeCurrentBlock(blockName) {
        const MAX_LINES_PER_BLOCK = 8; // Set to 8 as per user request

        // Use the correct array: this.currentBlockCreation
        if (!this.currentBlockCreation || this.currentBlockCreation.length === 0) {
            console.warn("Attempted to finalize an empty block.");
            // Optionally show a notification to the user
            if (typeof showNotification === 'function') {
                showNotification("Cannot create an empty block.", "warning");
            }
            return;
        }

        // Use the correct array: this.currentBlockCreation
        if (this.currentBlockCreation.length > MAX_LINES_PER_BLOCK) {
             console.warn(`Attempted to finalize a block with ${this.currentBlockCreation.length} lines. Maximum allowed is ${MAX_LINES_PER_BLOCK}.`);
            // Show notification to the user
            if (typeof showNotification === 'function') {
                 showNotification(`Blocks cannot contain more than ${MAX_LINES_PER_BLOCK} lines. Please reduce the number of lines.`, "warning");
            }
            return; // Stop finalization if the block is too large
        }


        const blockId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        const blockData = {
            id: blockId,
            name: blockName || `Block ${this.textBlocks.length + 1}`,
            // Use the correct array: this.currentBlockCreation
            lineIndices: [...this.currentBlockCreation] 
        };
        this.textBlocks.push(blockData);
        console.log('LyricsDisplay.finalizeCurrentBlock - Current blocks after push:', JSON.stringify(this.textBlocks)); // Added for debugging
        
        // Clear the correct array after finalization
        this.currentBlockCreation = []; 
        
        console.log("Block finalized:", blockData);
        // TODO: Update "Defined Blocks\" UI list
        // TODO: Potentially refresh block buttons in editor if lines are now part of a finalized block
        this._renderTextBlocksUI(); // Placeholder for UI update
        return blockData;
    }

    clearAllTextBlocks() {
        console.trace("LyricsDisplay.clearAllTextBlocks called"); // Added for debugging
        this.textBlocks = [];
        this.currentBlockCreation = []; // Also clear any pending block
        console.log("All text blocks cleared.");
        this._renderTextBlocksUI(); // Placeholder for UI update
        // TODO: Update "Defined Blocks" UI list to be empty
    }

    getTextBlocksForExport() {
        return this.textBlocks;
    }

    async loadImportedBlocks(blocksData, lyricsContent, shouldRender = true) { // Добавляем lyricsContent
        return new Promise((resolve) => { // Возвращаем Promise
            if (!blocksData || !Array.isArray(blocksData)) {
                console.warn('LyricsDisplay: Invalid or empty blocksData provided to loadImportedBlocks.');
                this.textBlocks = [];
                // 🎯 ИСПРАВЛЕНО: НЕ ОЧИЩАЕМ this.lyrics здесь, так как оно должно прийти извне
                // this.lyrics = []; 
                if (shouldRender) {
                    this._renderLyrics(); // Re-render (will show "no lyrics" or empty)
                }
                if (typeof this.updateDefinedBlocksDisplay === 'function') {
                    this.updateDefinedBlocksDisplay([]); // Update external UI
                }
                resolve(); // Разрешаем Promise, даже если данные невалидны
                return;
            }

            console.log(`LyricsDisplay: Loading ${blocksData.length} imported blocks.`);
            this.textBlocks = JSON.parse(JSON.stringify(blocksData)); // Deep copy

            // 🎯 ИСПРАВЛЕНО: Устанавливаем this.lyrics из переданного lyricsContent
            if (lyricsContent && typeof lyricsContent === 'string') {
                this.lyrics = lyricsContent.split('\n').map(line => line.trim());
            } else {
                this.lyrics = []; // Если текста нет, очищаем
            }
            
            // Устанавливаем textBlocks
            this.textBlocks = blocksData.map(block => ({
                ...block,
                originalLineIndices: block.lineIndices ? [...block.lineIndices] : [] // Сохраняем оригинал для отладки
            }));
            // УДАЛЕНО: Логирование для отладки
            // console.log('LyricsDisplay: Successfully loaded', this.textBlocks.length, 'blocks, total lyric lines:', this.lyrics.length);
            // console.log('LyricsDisplay: Loaded blocks detailed:', this.textBlocks); // УДАЛЕНО: Детальный лог
            
            // Санитизация импортированных блоков ДО рендера, чтобы устранить пустые/дубли и неверные индексы
            try {
                this.textBlocks = this._sanitizeBlocks(this.textBlocks);
            } catch (e) {
                console.warn('LyricsDisplay: Error during block sanitization:', e);
            }
            
            // 🎯 ИСПРАВЛЕНО: Обновляем количество лирических строк для валидации маркеров
            // Эта строка не нужна, так как this.lyrics.length уже обновлен
            // if (window.markerManager) { window.markerManager.totalLyricLines = this.lyrics.length; } 

            console.log(`LyricsDisplay: Successfully loaded ${this.textBlocks.length} blocks, total lyric lines: ${this.lyrics.length}.`);

            if (shouldRender) {
                this._renderLyrics(); // Render lyrics with new blocks
            }
            if (typeof this.updateDefinedBlocksDisplay === 'function') {
                this.updateDefinedBlocksDisplay(this.textBlocks);
            }
            resolve();
        });
    }

    _renderTextBlocksUI() {
        // This is a placeholder. The actual UI update for the "Defined Blocks" list
        // will likely happen in waveform-editor.js or a dedicated UI manager.
        // For now, just log.
        console.log("Defined Blocks UI needs to be updated. Current blocks:", this.textBlocks);
        if (window.waveformEditor && typeof window.waveformEditor.updateDefinedBlocksDisplay === 'function') {
            window.waveformEditor.updateDefinedBlocksDisplay(this.textBlocks);
        }
    }

    // --- Rehearsal Mode Activation ---

    activateRehearsalDisplay() {
        console.log("Activating Rehearsal Display with blocks:", this.textBlocks);
        if (this.currentStyle && this.currentStyle.id === 'rehearsal') {
            this._renderLyrics(); // _renderLyrics will need to check for rehearsal mode
        }
    }

    deactivateRehearsalDisplay() {
        console.log("Deactivating Rehearsal Display");
         if (this.currentStyle && this.currentStyle.id !== 'rehearsal') { // Ensure we only re-render if not rehearsal
            this._renderLyrics();
        }
    }

    /**
     * Extracts Unicode characters directly from RTF text.
     * @param {string} rtfText - The RTF text to extract Unicode characters from
     * @returns {string} Extracted text with Unicode characters
     * @private
     */
    _extractUnicodeFromRtf(rtfText) {
        if (!rtfText) {return '';}
        
        // Регулярное выражение для поиска Unicode символов в RTF
        const unicodeRegex = /\\u(\d+)\s?/g;
        let extractedText = '';
            let match;
            
        // Извлекаем все Unicode символы
        while ((match = unicodeRegex.exec(rtfText)) !== null) {
            const charCode = parseInt(match[1], 10);
            // Преобразуем Unicode в символ, если это действительный код
            if (charCode > 0) {
                // Преобразуем отрицательные коды (используются в RTF для расширенных символов)
                const actualCode = charCode < 0 ? charCode + 65536 : charCode;
                extractedText += String.fromCharCode(actualCode);
            }
        }
        
        // Очищаем и структурируем итоговый текст
        if (extractedText.length > 0) {
            extractedText = this._improveRussianStructure(extractedText);
        }
        
        return extractedText;
    }
    
    /**
     * Извлекает структурированный контент из RTF-текста
     * @param {string} rtfText - RTF текст
     * @returns {string} - Извлеченный структурированный контент
     * @private
     */
    _extractStructuredContentFromRtf(rtfText) {
        console.log("Запущена улучшенная обработка RTF-файла");
        
        if (!rtfText || rtfText.length < 10) {
            console.log("RTF текст слишком короткий или отсутствует");
            return null;
        }
        
        try {
            // Шаг 1: Удаляем RTF-заголовок и прочие метаданные
            let text = rtfText;
            
            // Удаляем RTF-заголовки
            text = text.replace(/^{\\rtf1[^{}]*/, ''); 
            
            // Удаляем таблицы цветов, шрифтов и стилей
            text = text.replace(/\{\\colortbl[^{}]*\}/g, '');
            text = text.replace(/\{\\fonttbl[^{}]*\}/g, '');
            text = text.replace(/\{\\stylesheet[^{}]*\}/g, '');
            
            // Шаг 2: Заменяем RTF-команды переносов строк маркерами
            text = text.replace(/\\par\s?/g, '###NEWLINE###');
            text = text.replace(/\\line\s?/g, '###NEWLINE###');
            
            // Шаг 3: Удаляем группы управления
            text = text.replace(/\{\\[^{}]*\}/g, '');
            
            // Шаг 4: Удаляем команды форматирования, не заменяя их пробелами
            const formattingCommands = [
                /\\f\d+\s?/g,         // Шрифт
                /\\fs\d+\s?/g,        // Размер шрифта
                /\\cf\d+\s?/g,        // Цвет шрифта
                /\\b\s?/g,            // Полужирный
                /\\i\s?/g,            // Курсив
                /\\ul\s?/g,           // Подчеркнутый
                /\\strike\s?/g,       // Зачеркнутый
                /\\super\s?/g,        // Верхний индекс
                /\\sub\s?/g,          // Нижний индекс
                /\\qc\s?/g,           // Выравнивание по центру
                /\\ql\s?/g,           // Выравнивание по левому краю
                /\\qr\s?/g,           // Выравнивание по правому краю
                /\\li\d+\s?/g,        // Левый отступ
                /\\ri\d+\s?/g,        // Правый отступ
                /\\fi\d+\s?/g,        // Отступ первой строки
                /\\sb\d+\s?/g,        // Интервал перед абзацем
                /\\sa\d+\s?/g,        // Интервал после абзаца
                /\\sl\d+\s?/g,        // Межстрочный интервал
            ];
            
            formattingCommands.forEach(regex => {
                text = text.replace(regex, '');
            });
            
            // Шаг 5: Удаляем все оставшиеся RTF-команды, заменяя пробелами для сохранения структуры
            text = text.replace(/\\[a-z]+\d*\s?/g, ' ');
            
            // Шаг 6: Обрабатываем Unicode символы
            text = text.replace(/\\'([0-9a-fA-F]{2})/g, (match, hex) => {
                try {
                    const charCode = parseInt(hex, 16);
                    return String.fromCharCode(charCode);
                } catch (e) {
                    return '';
                }
            });
            
            text = text.replace(/\\u(\d+)\s?/g, (match, code) => {
                try {
                    const charCode = parseInt(code, 10);
                    const actualCode = charCode < 0 ? charCode + 65536 : charCode;
                        return String.fromCharCode(actualCode);
                    } catch (e) {
                    return '';
                }
            });
            
            // Шаг 7: Восстанавливаем переносы строк
            text = text.replace(/###NEWLINE###/g, '\n');
            
            // Шаг 8: Удаляем оставшиеся управляющие символы и скобки
            text = text.replace(/[{}\\]/g, '');
            
            // Шаг 9: Удаляем контрольные символы и очищаем пространства
            text = text.replace(/[\x00-\x1F]/g, '');
            text = text.replace(/^\s+/gm, '');  // Удаляем пробелы в начале строк
            text = text.replace(/\s+$/gm, '');  // Удаляем пробелы в конце строк
            text = text.replace(/\n{3,}/g, '\n\n'); // Не более 2 переносов строк подряд
            
            // Шаг 10: Находим и удаляем инициализирующие строки, оставшиеся от заголовка RTF
            // (обычно содержат названия шрифтов или другие метаданные)
            const lines = text.split('\n');
            let firstContentLineIndex = 0;
            
            // Пропускаем первые строки, которые могут содержать только метаданные
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const line = lines[i].trim();
                if (line.length === 0) {continue;}
                
                // Проверяем, является ли строка, вероятно, метаданными
                const seemsLikeMetadata = 
                    /^[^a-zA-Zа-яА-ЯёЁ0-9]+$/.test(line) || // Только специальные символы
                    /^[a-zA-Z]+;(\s*;)*$/.test(line) ||      // Формат "Verdana; ; ; ;"
                    /^[\d.]+$/.test(line) ||                 // Только цифры
                    /^[a-zA-Z\s]+:/.test(line);              // Формат "Name: value"
                
                if (!seemsLikeMetadata) {
                    firstContentLineIndex = i;
                    break;
                } else {
                    firstContentLineIndex = i + 1;
                }
            }
            
            // Фильтруем строки, начиная с первой реальной строки контента
            const contentLines = lines.slice(firstContentLineIndex);
            
            // Собираем финальный текст
            const result = contentLines.join('\n');
            console.log(`Результат структурированной обработки RTF: ${contentLines.length} строк`);
            
            return result;
        } catch (error) {
            console.error("Ошибка при структурированной обработке RTF:", error);
            return null;
        }
    }

    /**
     * Прямое извлечение строк из RTF-текста
     * @param {string} rtfText - RTF текст
     * @returns {string[]} - Массив строк
     * @private
     */
    _extractLinesDirectlyFromRtf(rtfText) {
        if (!rtfText) {return [];}
        
            const lines = [];
        const rtfLines = rtfText.split(/\\par\s?|\n/);
        
        for (let line of rtfLines) {
            // Удаляем RTF-теги
            line = line.replace(/\\[a-z]+\d*\s?/g, '');
            line = line.replace(/\\\*[^{}\r\n]*/g, '');
            line = line.replace(/\\[\\\{\}]/g, '');
            line = line.replace(/[\{\}]/g, '');
            
            // Преобразуем шестнадцатеричные символы в Unicode
            line = line.replace(/\\'([0-9a-fA-F]{2})/g, (match, hex) => {
                const charCode = parseInt(hex, 16);
                return String.fromCharCode(charCode);
            });
            
            // Удаляем контрольные символы
            line = line.replace(/[\x00-\x1F]/g, '');
            
            // Добавляем только непустые строки
            if (line.trim().length > 0) {
                lines.push(line.trim());
            }
        }
        
        return lines;
    }
    
    /**
     * Улучшает структуру русского текста
     * @param {string} text - Текст для улучшения
     * @returns {string} - Улучшенный текст
     * @private
     */
    _improveRussianStructure(text) {
        if (!text) {return '';}
        
        // Исправляем переносы строк
        let improved = text.replace(/([.!?])\s*(?=[А-ЯЁ])/g, '$1\n');
        
        // Исправляем случаи слипания слов без пробелов (характерно для RTF)
        improved = improved.replace(/([а-яёА-ЯЁ])([А-ЯЁ])/g, '$1 $2');
        
        // Добавляем пробелы после знаков препинания, если их нет
        improved = improved.replace(/([,.!?:;])([а-яёА-ЯЁ])/g, '$1 $2');
        
        // Удаляем множественные пробелы
        improved = improved.replace(/\s{2,}/g, ' ');
        
        // Удаляем множественные переносы строк, но сохраняем форматирование куплетов
        improved = improved.replace(/\n{3,}/g, '\n\n');
        
        return improved;
    }
    
    /**
     * Улучшает структуру английского текста
     * @param {string} text - Текст для улучшения
     * @returns {string} - Улучшенный текст
     * @private
     */
    _improveEnglishStructure(text) {
        if (!text) {return '';}
        
        // Исправляем переносы строк после знаков препинания
        let improved = text.replace(/([.!?])\s*(?=[A-Z])/g, '$1\n');
        
        // Исправляем случаи слипания слов без пробелов
        improved = improved.replace(/([a-zA-Z])([A-Z])/g, '$1 $2');
        
        // Исправляем проблему, где некоторые слова как "Yeah", "Oh" не имеют переноса строки
        improved = improved.replace(/(Yeah|Oh|Yeah,|Oh,)(?=[A-Z])/g, '$1\n');
        
        // Добавляем переносы строк в местах, которые обычно являются границами строк в тексте песен
        improved = improved.replace(/(?<=\w)([\,\.\!\?])(?=\s[A-Z])/g, '$1\n');
        
        // Улучшаем структуру для песен Linkin Park
        // Известные проблемные сочетания слов
        improved = improved.replace(/Flying at the speed of light(?=\s*Thoughts)/i, 'Flying at the speed of light\n');
        improved = improved.replace(/It's out of my control(?=\s*Flying)/i, 'It\'s out of my control\n');
        improved = improved.replace(/This is not what I had planned(?=\s*It's)/i, 'This is not what I had planned\n');
        
        // Добавляем перенос строки перед припевом или хором
        improved = improved.replace(/(?<=\w)(\s+)(And the sun will set for you)/g, '\n\n$2');
        improved = improved.replace(/(?<=\w)(\s+)(Crawling in my skin)/g, '\n\n$2');
        improved = improved.replace(/(?<=\w)(\s+)(When my time comes)/g, '\n\n$2');
        improved = improved.replace(/(?<=\w)(\s+)(Waiting for the end)/g, '\n\n$2');
        
        // Удаляем множественные пробелы
        improved = improved.replace(/\s{2,}/g, ' ');
        
        // Удаляем множественные переносы строк, но сохраняем форматирование куплетов
        improved = improved.replace(/\n{3,}/g, '\n\n');
        
        return improved;
    }
    
    /**
     * Улучшает обработку RTF-текста на русском языке
     * @param {string} text - RTF текст для обработки
     * @param {boolean} isRtfContent - Флаг, указывающий, что это RTF-контент
     * @returns {string} - Обработанный текст
     * @private
     */
    _sanitizeRussianText(text, isRtfContent) {
        if (!text) {return '';}
        
        let sanitized = text;
        
        if (isRtfContent) {
            // Пробуем извлечь русский текст из RTF
            sanitized = this._extractStructuredContentFromRtf(text);
            if (!sanitized || sanitized.trim().length < 20) {
                // Если не получилось, пробуем другой метод
                sanitized = this._extractUnicodeFromRtf(text);
            }
        }
        
        // Базовая очистка
        sanitized = sanitized.replace(/\\rtf1/g, '');
        sanitized = sanitized.replace(/\\ansi/g, '');
        sanitized = sanitized.replace(/\\ansicpg\d+/g, '');
        sanitized = sanitized.replace(/\\deff\d+/g, '');
        sanitized = sanitized.replace(/\\deflang\d+/g, '');
        sanitized = sanitized.replace(/\\deflangfe\d+/g, '');
        sanitized = sanitized.replace(/\\uc\d+/g, '');
        sanitized = sanitized.replace(/\\pard/g, '');
        sanitized = sanitized.replace(/\\par/g, '\n');
        sanitized = sanitized.replace(/\\tab/g, '\t');
        sanitized = sanitized.replace(/\\f\d+/g, '');
        sanitized = sanitized.replace(/\\fs\d+/g, '');
        sanitized = sanitized.replace(/\\cf\d+/g, '');
        sanitized = sanitized.replace(/\\'[0-9a-f]{2}/g, ''); // Hex chars
        sanitized = sanitized.replace(/\\[a-z]+\d*/g, '');   // Other control words
        sanitized = sanitized.replace(/[{}]/g, '');          // Braces
        
        // Улучшаем структуру текста
        sanitized = this._improveRussianStructure(sanitized);
        
        return sanitized;
    }
    
    /**
     * Улучшает обработку RTF-текста на английском языке
     * @param {string} text - RTF текст для обработки
     * @param {boolean} isRtfContent - Флаг, указывающий, что это RTF-контент
     * @returns {string} - Обработанный текст
     * @private
     */
    _sanitizeEnglishText(text, isRtfContent) {
        if (!text) {return '';}
        
        let sanitized = text;
        
        if (isRtfContent) {
            // Пробуем извлечь английский текст из RTF
            sanitized = this._extractStructuredContentFromRtf(text);
        }
        
        // Базовая очистка как для RTF, так и для обычного текста
        sanitized = sanitized.replace(/\\rtf1/g, '');
        sanitized = sanitized.replace(/\\ansi/g, '');
        sanitized = sanitized.replace(/\\ansicpg\d+/g, '');
        sanitized = sanitized.replace(/\\deff\d+/g, '');
        sanitized = sanitized.replace(/\\deflang\d+/g, '');
        sanitized = sanitized.replace(/\\deflangfe\d+/g, '');
        sanitized = sanitized.replace(/\\uc\d+/g, '');
        sanitized = sanitized.replace(/\\pard/g, '');
        sanitized = sanitized.replace(/\\par/g, '\n');
        sanitized = sanitized.replace(/\\tab/g, '\t');
        sanitized = sanitized.replace(/\\f\d+/g, '');
        sanitized = sanitized.replace(/\\fs\d+/g, '');
        sanitized = sanitized.replace(/\\cf\d+/g, '');
        
        // Удаляем множественные пробелы и управляющие символы
        sanitized = sanitized.replace(/\s{2,}/g, ' ');
        sanitized = sanitized.replace(/[\x00-\x1F]/g, '');
        
        // Улучшаем структуру английского текста
        sanitized = this._improveEnglishStructure(sanitized);
        
        return sanitized;
    }
    
    /**
     * Определяет язык текста
     * @param {string} text - Текст для анализа
     * @returns {string} - 'russian' или 'english'
     * @private
     */
    _detectTextLanguage(text) {
        // Если текст очень короткий, не можем определить язык
        if (!text || text.length < 10) {return 'unknown';}
        
        // Удаляем RTF-разметку для более точного определения
        let cleanText = text;
        if (text.includes('\\rtf')) {
            cleanText = text.replace(/\\[a-z]+\d*\s?/g, '');
            cleanText = cleanText.replace(/\\\*[^{}\r\n]*/g, '');
            cleanText = cleanText.replace(/\\[\\\{\}]/g, '');
            cleanText = cleanText.replace(/[\{\}]/g, '');
        }
        
        // Считаем русские и английские буквы
        let russianCount = (cleanText.match(/[а-яёА-ЯЁ]/g) || []).length;
        let englishCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
        
        // Проверяем ключевые слова на обоих языках
        const russianKeywords = ['и', 'в', 'на', 'с', 'для', 'не', 'что', 'это', 'я', 'ты', 'он', 'она', 'мы', 'вы', 'они'];
        const englishKeywords = ['and', 'in', 'on', 'with', 'for', 'not', 'that', 'this', 'i', 'you', 'he', 'she', 'we', 'they'];
        
        let russianKeywordCount = 0;
        let englishKeywordCount = 0;
        
        // Преобразуем текст в нижний регистр и разбиваем на слова
        const words = cleanText.toLowerCase().split(/\s+/);
        
        // Считаем количество ключевых слов
        for (const word of words) {
            if (russianKeywords.includes(word)) {russianKeywordCount++;}
            if (englishKeywords.includes(word)) {englishKeywordCount++;}
        }
        
        console.log(`Количество русских букв: ${russianCount}, английских: ${englishCount}`);
        console.log(`Количество русских ключевых слов: ${russianKeywordCount}, английских: ${englishKeywordCount}`);
        
        // Определяем язык на основе количества букв и ключевых слов
        if (russianCount > englishCount || russianKeywordCount > englishKeywordCount) {
            return 'russian';
        } else {
            return 'english';
        }
    }

    /**
     * Конвертирует Unicode коды в символы
     * @param {string} text - Текст с Unicode кодами
     * @returns {string} - Текст с преобразованными символами
     * @private
     */
    _convertUnicodeCodesToChars(text) {
        if (!text) {return '';}
        
        let result = text;
        
        // Преобразование \uXXXX кодов
        result = result.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
            try {
                return String.fromCharCode(parseInt(code, 16));
            } catch (e) {
                return match;
            }
        });
        
        // Преобразование отрицательных кодов (используются в RTF)
        result = result.replace(/\\u-([0-9a-fA-F]+)/g, (match, code) => {
            try {
                // В RTF отрицательные коды — это Unicode + 65536
                const codePoint = 65536 - parseInt(code, 10);
                return String.fromCharCode(codePoint);
            } catch (e) {
                return match;
            }
        });
        
        // Преобразование \uXXXX? кодов (с вопросительным знаком)
        result = result.replace(/\\u([0-9]+)\?/g, (match, code) => {
            try {
                return String.fromCharCode(parseInt(code, 10));
            } catch (e) {
                return match;
            }
        });
        
        // Преобразование \'XX hex кодов для кириллицы
        result = result.replace(/\\'([0-9a-fA-F]{2})/g, (match, hex) => {
            try {
                // Для кодировки Windows-1251 (Cyrillic)
                const charCode = parseInt(hex, 16);
                
                // Специфичные преобразования для Windows-1251
                if (charCode >= 0xC0 && charCode <= 0xFF) {
                    return String.fromCharCode(charCode + 0x350); // Смещение к UTF-16 кодам
                } else if (charCode === 0xA8) {
                    return 'Ё'; // Русская Ё
                } else if (charCode === 0xB8) {
                    return 'ё'; // Русская ё
                } else {
                    return String.fromCharCode(charCode);
                }
            } catch (e) {
                return match;
            }
        });
        
        return this._cleanText(result);
    }

    /**
     * Подготавливает Matrix эффект для отдельной строки
     * @param {HTMLElement} lineElement - Элемент строки
     * @private
     */
    _prepareMatrixEffectForLine(lineElement) {
        // Пропускаем если уже обработана
        if (lineElement.querySelector('span')) {return;}
        
        const text = lineElement.textContent;
        let wrappedText = '';
        
        // Создаем случайные задержки для эффекта падающих букв
        for (let i = 0; i < text.length; i++) {
            const delay = Math.random() * 0.5; // Случайная задержка от 0 до 500ms
            const char = text[i];
            if (char === ' ') {
                wrappedText += `<span style="animation-delay: ${delay}s; display: inline-block; width: 0.3em;">&nbsp;</span>`;
            } else {
                wrappedText += `<span style="animation-delay: ${delay}s; display: inline-block;">${char}</span>`;
            }
        }
        
        lineElement.innerHTML = wrappedText;
    }
    
    /**
     * Подготавливает letter-by-letter эффект для отдельной строки
     * @param {HTMLElement} lineElement - Элемент строки
     * @private
     */
    _prepareLetterByLetterEffectForLine(lineElement) {
        // Пропускаем если уже обработана
        if (lineElement.querySelector('span')) {return;}
        
        const text = lineElement.textContent;
        let wrappedText = '';
        
        // Создаем последовательные задержки для letter-by-letter анимации
        for (let i = 0; i < text.length; i++) {
            const delay = i * 0.05; // Последовательная задержка
            const char = text[i];
            
            if (char === ' ') {
                wrappedText += `<span style="animation-delay: ${delay}s; display: inline-block; width: 0.3em;">&nbsp;</span>`;
            } else {
                wrappedText += `<span style="animation-delay: ${delay}s;">${char}</span>`;
            }
        }
        
        lineElement.innerHTML = wrappedText;
    }
    
    /**
     * Подготавливает word-by-word эффект для отдельной строки
     * @param {HTMLElement} lineElement - Элемент строки
     * @private
     */
    _prepareWordByWordEffectForLine(lineElement) {
        // Пропускаем если уже обработана
        if (lineElement.querySelector('span')) {return;}
        
        const text = lineElement.textContent;
        const words = text.split(' ');
        let wrappedText = '';
        
        // Создаем последовательные задержки для word-by-word анимации
        for (let i = 0; i < words.length; i++) {
            const delay = i * 0.15; // Последовательная задержка
            wrappedText += `<span class="word" style="animation-delay: ${delay}s;">${words[i]}</span> `;
        }
        
        lineElement.innerHTML = wrappedText;
    }

    /**
     * Простой слайд-переход между блоками в режиме репетиции
     * @param {number} index - Индекс строки
     * @private
     */
    _setActiveLineInRehearsalMode(index) {
        console.log(`Rehearsal mode: Setting active line ${index}`);
        
        // Находим блок, содержащий эту строку
        const targetBlock = this.textBlocks.find(block => 
            block.lineIndices.includes(index)
        );
        
        if (!targetBlock) {
            console.warn(`Line ${index} not found in any block`);
            return;
        }

        // Находим текущий активный блок
        const currentBlock = this.textBlocks.find(block => 
            block.id === this.currentlyFocusedBlockId
        );

        // Если переходим в новый блок - делаем простой слайд
        if (currentBlock && targetBlock.id !== currentBlock.id) {
            console.log(`🔄 Block transition: ${currentBlock.id} → ${targetBlock.id}`);
            this._performSimpleBlockTransition(currentBlock, targetBlock, index);
        } else {
            // Внутри того же блока - простая активация
            this._activateLineInBlock(index);
        }
    }

    /**
     * Выполняет простой слайд-переход между блоками
     * @param {Object} fromBlock - Исходный блок
     * @param {Object} toBlock - Целевой блок  
     * @param {number} targetLineIndex - Индекс строки для активации
     * @private
     */
    _performSimpleBlockTransition(fromBlock, toBlock, targetLineIndex) {
        const fromContainer = this.lyricsContainer.querySelector(`[data-block-id="${fromBlock.id}"]`);
        const toContainer = this.lyricsContainer.querySelector(`[data-block-id="${toBlock.id}"]`);
        
        if (!fromContainer || !toContainer) {
            console.error('Block containers not found for transition');
            return;
        }

        // Простой переход: скрываем старый, показываем новый
        fromContainer.style.transition = 'opacity 0.3s ease-out';
        toContainer.style.transition = 'opacity 0.3s ease-in';
        
        fromContainer.style.opacity = '0';
        
        setTimeout(() => {
            fromContainer.style.display = 'none';
            toContainer.style.display = 'block';
            toContainer.style.opacity = '1';
            
            // Обновляем текущий блок
            this.currentlyFocusedBlockId = toBlock.id;
            
            // ДОБАВЛЕНО: Обновляем currentActiveBlock для BlockLoopControl
            this.currentActiveBlock = toBlock;
            
            // Активируем нужную строку в новом блоке
            this._activateLineInBlock(targetLineIndex);
            
        }, 300);
    }

    /**
     * Активирует строку внутри блока
     * @param {number} index - Индекс строки
     * @private
     */
    _activateLineInBlock(index) {
        // Убираем активность со всех строк
        const allLines = this.lyricsContainer.querySelectorAll('.rehearsal-active-line');
        allLines.forEach(line => {
            line.classList.remove('active');
        });

        // Находим и активируем нужную строку
        const targetLine = this.lyricsContainer.querySelector(
            `.rehearsal-active-line[data-index="${index}"]`
        );
        
        if (targetLine) {
            console.log(`Activating rehearsal line at index ${index}`);
            targetLine.classList.add('active');
            this.currentLyricElement = targetLine;
            this.currentLine = index;
            
            // Простая анимация появления
            targetLine.style.transition = 'all 0.2s ease-in-out';
            targetLine.classList.add('becoming-active');
        } else {
            console.warn(`Rehearsal line with index ${index} not found`);
        }
    }

    _parseParenthesesForDuet(text) {
        // Парсинг дуэтных частей в скобках
        if (!text || typeof text !== 'string') {
            return text || '';
        }
        
        // Заменяем текст в скобках на span с классом duet-partner
        return text.replace(/\(([^)]+)\)/g, '<span class="duet-partner">($1)</span>');
    }

    /**
     * Checks if lyrics are currently loaded.
     * @returns {boolean} True if lyrics are loaded, false otherwise.
     */
    hasLyrics() {
        return this.lyrics && this.lyrics.length > 0;
    }

    /**
     * Set the lyric lines to be displayed
     * @param {string[]} lines - An array of lyric lines
     */
    setLyrics(lines) {
        this.lyrics = lines;
        this._renderLyrics();
    }

    /**
     * Полный сброс компонента. Уничтожает все текстовые элементы и очищает внутреннее состояние.
     * Вызывается из StateManager для предотвращения гонки состояний при смене трека.
     */
    fullReset() {
        console.log('💥 LyricsDisplay: Performing full reset.');
        
        // 1. Физически удаляем все DOM-элементы строк
        const container = document.getElementById('lyrics-container-main');
        if (container) {
            container.innerHTML = '';
        }
        
        // 2. Очищаем массив с текстами
        this.lyricsLines = [];
        
        // 3. Сбрасываем связанные состояния
        this.activeLineIndex = -1;
        
        // 4. ОЧИЩАЕМ КЕШ ДЛЯ ЭФФЕКТОВ
        this._originalLineTexts = null;
        this._hasWrappedLetters = false;
        
        // 5. Безопасно сбрасываем стиль только если textStyleManager доступен
        if (window.textStyleManager && typeof window.textStyleManager.getStyle === 'function') {
            this.currentStyle = window.textStyleManager.getStyle('default');
        } else {
            // Если textStyleManager недоступен, устанавливаем базовый стиль
            this.currentStyle = { id: 'default', name: 'По умолчанию' };
            console.warn('⚠️ LyricsDisplay: textStyleManager not available during reset, using fallback style');
        }

        console.log('✅ LyricsDisplay: Full reset complete. All lyric data and DOM elements cleared.');
    }

    /**
     * Renders lyrics based on the current style and lines
     */
    renderLyrics() {
        console.log("Rendering lyrics. Current style ID:", this.currentStyle.id);

        const container = document.getElementById('lyrics-container-main');
        container.innerHTML = ''; // Очищаем контейнер перед рендерингом

        if (!this.lyricsLines || this.lyricsLines.length === 0) {
            console.warn("renderLyrics called with no lines to render.");
            return;
        }

        // ... остальной код renderLyrics ...
    }
}

// Create global lyrics display instance
const lyricsDisplay = new LyricsDisplay(); 
window.lyricsDisplay = lyricsDisplay; 