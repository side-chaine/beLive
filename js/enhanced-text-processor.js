/**
 * EnhancedTextProcessor - улучшенный обработчик текста для приложения
 * Предоставляет современные методы обработки текста для различных форматов
 */
class EnhancedTextProcessor {
    /**
     * Обрабатывает простой текст и возвращает очищенный массив строк
     * @param {string} plainText - Исходный текст для обработки
     * @returns {string[]} - Массив обработанных строк
     */
    static processPlainText(plainText) {
        if (!plainText) {
            console.log("EnhancedTextProcessor: получен пустой текст");
            return [];
        }
        
        console.log(`EnhancedTextProcessor: обработка текста, начальная длина: ${plainText.length}`);

        // 1. Начальное разделение
        let lines = plainText.split(/\r?\n/);
        console.log(`EnhancedTextProcessor: строк после начального split: ${lines.length}`);

        // 2. Эвристическое разделение, если строк мало, а текст длинный
        const minLinesForLongText = 3; // Минимальное количество строк, которое мы ожидаем для длинного текста
        const longTextThreshold = 200; // Порог длины текста, после которого он считается длинным

        if (lines.length <= minLinesForLongText && plainText.length > longTextThreshold) {
            console.log("EnhancedTextProcessor: мало строк для длинного текста, применяем эвристическое разделение.");
            
            // Попытка 1: Разделение по знакам препинания, за которыми следует пробел и заглавная буква
            let heuristicallySplitLines = plainText.replace(/([.!?])\s+(?=[A-ZА-ЯЁ])/g, '$1\n').split(/\r?\n/);
            
            if (heuristicallySplitLines.length > lines.length) {
                console.log(`EnhancedTextProcessor: эвристика 1 (знаки преп. + заглавная) увеличила кол-во строк до: ${heuristicallySplitLines.length}`);
                lines = heuristicallySplitLines;
            } else {
                console.log("EnhancedTextProcessor: эвристика 1 не дала значительного улучшения.");
                // Попытка 2: Более агрессивное разделение по точке/воскл./вопр. знакам, если они не часть сокращения (Mr. Mrs. Dr.)
                // и за ними идет пробел. Это менее точно, но может помочь.
                heuristicallySplitLines = plainText.replace(/(?<!Mr|Mrs|Dr|Ms|Ltd|Inc)[.!?]\s+/g, '$&\n').split(/\r?\n/);
                if (heuristicallySplitLines.length > lines.length) {
                    console.log(`EnhancedTextProcessor: эвристика 2 (агрессивные знаки преп.) увеличила кол-во строк до: ${heuristicallySplitLines.length}`);
                    lines = heuristicallySplitLines;
                }
            }

            // Попытка 3: Разделение по смене регистра (строчная -> Заглавная) внутри слова, что может указывать на склейку строк
            // Пример: "wordAnotherWord" -> "word\nAnotherWord"
            // Эта эвристика применяется к каждой строке, полученной ранее, если она все еще слишком длинная
            const veryLongLineThreshold = 100; // Порог длины строки для применения этой эвристики
            let furtherSplitLines = [];
            lines.forEach(line => {
                if (line.length > veryLongLineThreshold && !line.includes(' ')) { // Если строка длинная и без пробелов
                    const splitByCase = line.replace(/([a-zа-яё])([A-ZА-ЯЁ])/g, '$1\n$2').split(/\r?\n/);
                    if (splitByCase.length > 1) {
                        console.log(`EnhancedTextProcessor: эвристика 3 (смена регистра) разделила строку: "${line.substring(0,30)}..." на ${splitByCase.length} частей`);
                        furtherSplitLines.push(...splitByCase);
                    } else {
                        furtherSplitLines.push(line);
                    }
                } else {
                    furtherSplitLines.push(line);
                }
            });
            if (furtherSplitLines.length > lines.length) {
                 lines = furtherSplitLines;
            }
        }
        
        // Обработка особых случаев с обратными слешами (иногда используются как маркеры переноса строк)
        // Эта логика должна идти после основного разделения, чтобы не конфликтовать
        if (lines.length === 1 && lines[0].includes('\\') && lines[0].length > longTextThreshold) {
            console.log("EnhancedTextProcessor: обнаружены обратные слеши в одной длинной строке, применяем специальную обработку");
            const textFromSlashes = lines[0].replace(/\\+/g, '\n');
            const linesFromSlashes = textFromSlashes.split(/\r?\n/);
            if (linesFromSlashes.length > lines.length) {
                 console.log(`EnhancedTextProcessor: обработка обратных слешей увеличила кол-во строк до: ${linesFromSlashes.length}`);
                 lines = linesFromSlashes;
            }
        }

        // 3. Финальная очистка и фильтрация строк
        lines = lines.map(line => {
            // Замена множественных пробелов/табуляций одним пробелом и обрезка
            return line.replace(/[ \t]+/g, ' ').trim();
        })
        .filter(line => {
            // Фильтрация пустых строк
            if (line.length === 0) {return false;}
            
            // Фильтрация строк, состоящих только из пунктуации (допускаем немного больше символов)
            if (/^[;:,.\/#!"~*$%^&+=_{}()\-\[\]<>?@'`€£¥§©®™•…–—‘'""„‚‹›«»¡¿‰‱℗℠№#\*\^\(\)\[\]\{\}\s]+$/.test(line)) {return false;}
            
            return true;
        });

        console.log(`EnhancedTextProcessor: обработка завершена, итоговое количество строк: ${lines.length}`);
        if (lines.length > 0) {
            console.log(`EnhancedTextProcessor: первые строки: "${lines.slice(0, Math.min(3, lines.length)).join('", "')}"`);
        }
        
        return lines;
    }

    /**
     * Обрабатывает RTF текст и возвращает извлеченный чистый текст
     * @param {string} rtfText - RTF текст для обработки
     * @returns {Promise<string>} - Promise с очищенным текстом
     */
    static async parseRtfUniversal(rtfText) {
        console.log("EnhancedTextProcessor: начало обработки RTF текста, длина:", rtfText ? rtfText.length : 0);
        
        return new Promise((resolve, reject) => {
            if (!rtfText) {
                console.warn("EnhancedTextProcessor: получен пустой RTF текст для parseRtfUniversal");
                resolve("");
                return;
            }
            try {
                // Проверка на доступность EnhancedRtfProcessor (внешнего)
                if (typeof window.EnhancedRtfProcessor !== 'undefined' && window.EnhancedTextProcessor.parseRtf) {
                    console.log("EnhancedTextProcessor: используется внешний EnhancedRtfProcessor (window.EnhancedRtfProcessor)");
                    
                    try {
                        // Предполагаем, что внешний EnhancedRtfProcessor возвращает Promise
                        window.EnhancedTextProcessor.parseRtf(rtfText).then(result => {
                            console.log("EnhancedTextProcessor: RTF успешно обработан через внешний EnhancedRtfProcessor");
                            resolve(result);
                        }).catch(err => {
                            console.error("EnhancedTextProcessor: ошибка внешнего EnhancedRtfProcessor:", err);
                            // Продолжаем с базовым парсером нашего класса
                            const basicResult = EnhancedTextProcessor._extractTextFromRtf(rtfText);
                            resolve(basicResult);
                        });
                    } catch (rtfErr) {
                        console.error("EnhancedTextProcessor: ошибка при вызове внешнего EnhancedRtfProcessor:", rtfErr);
                        const basicResult = EnhancedTextProcessor._extractTextFromRtf(rtfText);
                        resolve(basicResult);
                    }
                } else {
                    console.log("EnhancedTextProcessor: внешний EnhancedRtfProcessor недоступен, используется внутренний базовый парсер _extractTextFromRtf");
                    const basicResult = EnhancedTextProcessor._extractTextFromRtf(rtfText);
                    resolve(basicResult);
                }
            } catch (error) {
                console.error("EnhancedTextProcessor: общая ошибка при обработке RTF в parseRtfUniversal:", error);
                resolve(rtfText); // В случае ошибки возвращаем исходный текст
            }
        });
    }

    /**
     * Базовый метод извлечения текста из RTF (внутренний)
     * @param {string} rtfText - Текст в формате RTF
     * @returns {string} - Извлеченный текст
     * @private
     */
    static _extractTextFromRtf(rtfText) {
        if (!rtfText) {return '';}
        
        console.log("EnhancedTextProcessor: внутреннее базовое извлечение текста из RTF");
        
        try {
            let text = rtfText;
            
            // Удаляем все группы управления RTF с их содержимым (например, таблицы стилей, информацию о шрифтах)
            text = text.replace(/\{\\\*\\[^}]*\}/g, '');
            
            // Удаляем конкретные ненужные контрольные слова и группы
            text = text.replace(/\{\\fonttbl.*?\}/g, '');
            text = text.replace(/\{\\colortbl.*?\}/g, '');
            text = text.replace(/\{\\stylesheet.*?\}/g, '');
            text = text.replace(/\{\\info.*?\}/g, '');
            text = text.replace(/\{\\generator.*?\}/g, '');
            
            // Основные замены для текста
            text = text.replace(/\\pard\s?/g, '\n'); // Начало нового абзаца
            text = text.replace(/\\par\s?/g, '\n');  // Явный абзац
            text = text.replace(/\\line\s?/g, '\n'); // Явный перенос строки
            text = text.replace(/\\tab\s?/g, '\t');   // Табуляция

            // Обработка Unicode символов (например, \u1088?)
            text = text.replace(/\\u(-?\d+)\??/g, (match, code) => {
                try {
                    let n = parseInt(code, 10);
                    if (n < 0) n = 65536 + n;
                    return String.fromCharCode(n);
                } catch (e) {
                    return ''; // Возвращаем пустую строку, если код невалидный
                }
            });

            // Обработка шестнадцатеричных символов (например, \'e0)
            text = text.replace(/\\'([0-9a-fA-F]{2})/g, (match, hex) => {
                try {
                    return String.fromCharCode(parseInt(hex, 16));
                } catch (e) {
                    return ''; // Возвращаем пустую строку, если код невалидный
                }
            });
            
            // Удаляем оставшиеся RTF контрольные слова и символы
            // Сначала удаляем контрольные слова с числовыми параметрами (напр. \fi-360)
            text = text.replace(/\\[a-zA-Z0-9]+-?\d*\s?/g, ''); 
            // Затем удаляем оставшиеся контрольные слова без параметров
            text = text.replace(/\\[a-zA-Z]+\s?/g, '');
            
            // Удаляем фигурные скобки RTF, но стараемся сохранить текст внутри них, если это не группы
            text = text.replace(/\{([^\{}]+)\}/g, '$1'); // Одиночные группы
            text = text.replace(/[\{\}]/g, ''); // Оставшиеся скобки
            
            // Нормализуем переносы строк и пробелы
            text = text.replace(/\r\n|\r/g, '\n');
            text = text.replace(/\n{3,}/g, '\n\n'); // Сохраняем абзацы: 3+ переносов -> 2
            text = text.replace(/[ \t]{2,}/g, ' '); // Множественные пробелы/табы на один пробел
            
            console.log("EnhancedTextProcessor: базовое извлечение RTF завершено, длина результата:", text.length);
            return text.trim();
        } catch (error) {
            console.error("EnhancedTextProcessor: ошибка при внутреннем базовом извлечении RTF:", error);
            return rtfText; // Возвращаем исходный текст при ошибке
        }
    }

    /**
     * Определяет язык текста (русский/английский)
     * @param {string} text - Текст для анализа
     * @returns {string} - 'ru' для русского, 'en' для английского, 'unknown' для неопределенного
     */
    static detectLanguage(text) {
        if (!text) {return 'unknown';}
        
        const sample = text.substring(0, 500);
        const russianMatch = sample.match(/[а-яА-ЯёЁ]/g);
        const englishMatch = sample.match(/[a-zA-Z]/g);
        const russianCount = russianMatch ? russianMatch.length : 0;
        const englishCount = englishMatch ? englishMatch.length : 0;
        
        if (russianCount > englishCount * 1.5) { // Даем приоритет русскому, если символов заметно больше
            return 'ru';
        } else if (englishCount > russianCount * 1.5) {
            return 'en';
        } else if (russianCount > 0 && englishCount === 0) {
            return 'ru';
        } else if (englishCount > 0 && russianCount === 0) {
            return 'en';
        } else if (russianCount > 0 || englishCount > 0) { // Если есть и те и те, но разница небольшая
             return russianCount >= englishCount ? 'ru' : 'en'; // По умолчанию русский при равенстве или небольшой разнице
        }
        return 'unknown';
    }
}

// Делаем класс доступным глобально
window.EnhancedTextProcessor = EnhancedTextProcessor; 