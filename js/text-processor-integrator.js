/**
 * TextProcessorIntegrator - интегрирует улучшенную обработку текста с существующим кодом
 * Заменяет оригинальные функции обработки текста на улучшенные версии
 */
(function() {
    console.log("TextProcessorIntegrator: v2.1 инициализация");
    let integrationAttempted = false;
    let integrationSuccessful = false;
    let retryAttempts = 0;

    function runIntegration() {
        if (integrationAttempted) {
            // console.log("TextProcessorIntegrator: Повторная попытка интеграции или интеграция уже выполнена.");
            if (integrationSuccessful) {return;}
        }
        integrationAttempted = true;

        console.debug("TextProcessorIntegrator: Попытка интеграции улучшенных обработчиков текста...");

        if (typeof window.LyricsDisplay === 'undefined' || typeof window.EnhancedTextProcessor === 'undefined') {
            retryAttempts += 1;
            if (retryAttempts > 10) {
                console.debug("TextProcessorIntegrator: Превышен лимит попыток. Интегратор временно отключен.");
                return;
            }
            setTimeout(runIntegration, 800); // Больше интервал и ограничение по количеству
            return;
        }

        // Проверяем, не выполнена ли интеграция ранее (на случай многократных вызовов DOMContentLoaded/load)
        if (window.textProcessorIntegrated) {
            console.log("TextProcessorIntegrator: Интеграция уже была успешно выполнена ранее (флаг window.textProcessorIntegrated).");
            integrationSuccessful = true;
            return;
        }

        try {
            // Сохраняем оригинальные методы, если они еще не сохранены
            if (!LyricsDisplay.prototype._originalProcessLyrics) {
                LyricsDisplay.prototype._originalProcessLyrics = LyricsDisplay.prototype._processLyrics;
                console.log("TextProcessorIntegrator: Оригинальный _processLyrics сохранен.");
            }
            if (!LyricsDisplay.prototype._originalCleanText) {
                LyricsDisplay.prototype._originalCleanText = LyricsDisplay.prototype._cleanText;
                console.log("TextProcessorIntegrator: Оригинальный _cleanText сохранен.");
            }
            if (LyricsDisplay.prototype._parseRtfUniversal && !LyricsDisplay.prototype._originalParseRtfUniversal) {
                LyricsDisplay.prototype._originalParseRtfUniversal = LyricsDisplay.prototype._parseRtfUniversal;
                console.log("TextProcessorIntegrator: Оригинальный _parseRtfUniversal сохранен.");
            }

            // Заменяем _processLyrics
            LyricsDisplay.prototype._processLyrics = async function(text) {
                console.log("TextProcessorIntegrator (Hooked): Перехвачен вызов _processLyrics.");
                
                if (!text) {
                    this.lyrics = [];
                    // Убедимся, что и fullText очищен
                    if (this.hasOwnProperty('fullText')) {
                        this.fullText = '';
                    }
                    return [];
                }
                
                try {
                    const rtfSignatures = ['\\rtf', '{\\rtf', '\\par', '\\pard', '\\f0', '\\ansicpg', '\\cocoartf'];
                    const isRtf = typeof text === 'string' && rtfSignatures.some(signature => text.includes(signature));
                    const isLrc = typeof text === 'string' && text.includes('[') && text.includes(']') && /^\[\d+:\d+/i.test(text);
                    
                    let processedText = '';
                    let lines = [];

                    if (isRtf) {
                        console.log("TextProcessorIntegrator (Hooked): Обработка RTF через EnhancedTextProcessor.parseRtfUniversal.");
                        processedText = await window.EnhancedTextProcessor.parseRtfUniversal(text);
                        lines = window.EnhancedTextProcessor.processPlainText(processedText);
                    } else if (isLrc) {
                        console.log("TextProcessorIntegrator (Hooked): Обработка LRC.");
                        // Для LRC лучше использовать оригинальный парсер, если он есть и специфичен,
                        // а затем наш очиститель для текста.
                        if (this._originalParseLrcFile && typeof this._originalParseLrcFile === 'function') {
                           processedText = this._originalParseLrcFile(text); // Предполагаем, что такой метод может быть
                        } else if (this._parseLrcFile && typeof this._parseLrcFile === 'function' && this._parseLrcFile !== LyricsDisplay.prototype._parseLrcFile) {
                           // Если есть кастомный, но не сохраненный оригинал
                           processedText = this._parseLrcFile(text);
                        } else {
                           // Базовый парсинг LRC, если нет специализированного
                           processedText = text.split(/\r?\n/).map(line => line.replace(/\[.*?\]/g, '').trim()).join('\n');
                        }
                        lines = window.EnhancedTextProcessor.processPlainText(processedText);
                    } else {
                        console.log("TextProcessorIntegrator (Hooked): Обработка обычного текста через EnhancedTextProcessor.processPlainText.");
                        lines = window.EnhancedTextProcessor.processPlainText(text);
                        processedText = lines.join('\n'); 
                    }
                    
                    this.fullText = processedText; // Сохраняем обработанный текст в fullText
                    this.lyrics = lines;

                    console.log(`TextProcessorIntegrator (Hooked): _processLyrics завершен, строк: ${lines.length}`);
                    return lines;

                } catch (error) {
                    console.error("TextProcessorIntegrator (Hooked): Ошибка в _processLyrics, возврат к оригиналу.", error);
                    // Важно! Убедиться, что this._originalProcessLyrics существует и вызывается корректно
                    if (LyricsDisplay.prototype._originalProcessLyrics) {
                        return LyricsDisplay.prototype._originalProcessLyrics.call(this, text);
                    } else {
                        // Крайний случай, если оригинал не сохранился
                        console.error("TextProcessorIntegrator (Hooked): _originalProcessLyrics не найден!");
                        this.lyrics = text.split(/\r?\n/); // Очень базовый фоллбэк
                        return this.lyrics;
                    }
                }
            };

            // Заменяем _cleanText
            LyricsDisplay.prototype._cleanText = function(text) {
                console.log("TextProcessorIntegrator (Hooked): Перехвачен вызов _cleanText.");
                try {
                    if (!text) {return '';}
                    // Всегда используем наш EnhancedTextProcessor.processPlainText для очистки и разделения,
                    // так как _cleanText обычно ожидает на выходе строку, а не массив.
                    const lines = window.EnhancedTextProcessor.processPlainText(text);
                    return lines.join('\n');
                } catch (error) {
                    console.error("TextProcessorIntegrator (Hooked): Ошибка в _cleanText, возврат к оригиналу.", error);
                    if (LyricsDisplay.prototype._originalCleanText) {
                        return LyricsDisplay.prototype._originalCleanText.call(this, text);
                    } else {
                        console.error("TextProcessorIntegrator (Hooked): _originalCleanText не найден!");
                        return text; // Базовый фоллбэк
                    }
                }
            };

            // Заменяем _parseRtfUniversal, если он существует в прототипе
            if (LyricsDisplay.prototype.hasOwnProperty('_parseRtfUniversal')) {
                 console.log("TextProcessorIntegrator (Hooked): Заменяем _parseRtfUniversal.");
                LyricsDisplay.prototype._parseRtfUniversal = async function(rtfText) {
                    console.log("TextProcessorIntegrator (Hooked): Перехвачен вызов _parseRtfUniversal.");
                    try {
                        return await window.EnhancedTextProcessor.parseRtfUniversal(rtfText);
                    } catch (error) {
                        console.error("TextProcessorIntegrator (Hooked): Ошибка в _parseRtfUniversal, возврат к оригиналу.", error);
                        if (LyricsDisplay.prototype._originalParseRtfUniversal) {
                            return LyricsDisplay.prototype._originalParseRtfUniversal.call(this, rtfText);
                        } else {
                             console.error("TextProcessorIntegrator (Hooked): _originalParseRtfUniversal не найден!");
                            return rtfText; // Базовый фоллбэк
                        }
                    }
                };
            } else {
                console.log("TextProcessorIntegrator: Метод _parseRtfUniversal не найден в прототипе LyricsDisplay для перехвата.");
            }
            
            window.textProcessorIntegrated = true;
            integrationSuccessful = true;
            console.log("TextProcessorIntegrator: Интеграция улучшенных обработчиков текста УСПЕШНО ЗАВЕРШЕНА (v2.1).");

        } catch (error) {
            console.error("TextProcessorIntegrator: КРИТИЧЕСКАЯ ОШИБКА при интеграции:", error);
            integrationSuccessful = false;
        }
    }

    // Используем requestAnimationFrame для более надежного ожидания готовности DOM и других скриптов
    function scheduleIntegration() {
        if (document.readyState === 'complete' || (document.readyState !== 'loading' && !document.documentElement.doScroll)) {
            runIntegration();
        } else {
            document.addEventListener('DOMContentLoaded', runIntegration);
            window.addEventListener('load', runIntegration); // Дополнительно для полной уверенности
        }
    }
    
    scheduleIntegration();

})(); 