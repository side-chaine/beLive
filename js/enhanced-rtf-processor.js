/**
 * EnhancedRtfProcessor - Улучшенный процессор RTF-файлов
 * Поддерживает обработку русских текстов в кодировке CP1251,
 * а также расширенный набор символов и форматирование.
 */
class EnhancedRtfProcessor {
    /**
     * Создает экземпляр EnhancedRtfProcessor
     * @constructor
     */
    constructor() {
        /**
         * Кэш для уже обработанных RTF файлов
         * @private
         */
        this._cache = new Map();
        
        /**
         * CP1251 таблица соответствия символов для русских символов
         * @private
         */
        this._cp1251Map = {
            // Русские буквы верхнего регистра
            "'c0": 'А', "'c1": 'Б', "'c2": 'В', "'c3": 'Г', "'c4": 'Д', "'c5": 'Е',
            "'c6": 'Ж', "'c7": 'З', "'c8": 'И', "'c9": 'Й', "'ca": 'К', "'cb": 'Л',
            "'cc": 'М', "'cd": 'Н', "'ce": 'О', "'cf": 'П', "'d0": 'Р', "'d1": 'С',
            "'d2": 'Т', "'d3": 'У', "'d4": 'Ф', "'d5": 'Х', "'d6": 'Ц', "'d7": 'Ч',
            "'d8": 'Ш', "'d9": 'Щ', "'da": 'Ъ', "'db": 'Ы', "'dc": 'Ь', "'dd": 'Э',
            "'de": 'Ю', "'df": 'Я',
            // Русские буквы нижнего регистра
            "'e0": 'а', "'e1": 'б', "'e2": 'в', "'e3": 'г', "'e4": 'д', "'e5": 'е',
            "'e6": 'ж', "'e7": 'з', "'e8": 'и', "'e9": 'й', "'ea": 'к', "'eb": 'л',
            "'ec": 'м', "'ed": 'н', "'ee": 'о', "'ef": 'п', "'f0": 'р', "'f1": 'с',
            "'f2": 'т', "'f3": 'у', "'f4": 'ф', "'f5": 'х', "'f6": 'ц', "'f7": 'ч',
            "'f8": 'ш', "'f9": 'щ', "'fa": 'ъ', "'fb": 'ы', "'fc": 'ь', "'fd": 'э',
            "'fe": 'ю', "'ff": 'я',
            // Специальные символы
            "'a8": 'Ё', "'b8": 'ё', 
            "'a9": '©', "'ae": '®', "'b9": '№'
        };
    }
    
    /**
     * Проверяет, является ли текст RTF документом
     * @param {string} content - Текст для проверки
     * @returns {boolean} true если текст похож на RTF
     */
    isRtf(content) {
        return content && typeof content === 'string' && content.trim().startsWith('{\\rtf');
    }
    
    /**
     * Определяет язык текста (русский или английский)
     * @param {string} text - Текст для анализа
     * @returns {string} 'russian' или 'english'
     * @private
     */
    _detectLanguage(text) {
        // Правило: если есть кириллические символы, считаем текст русским
        const cyrillicPattern = /[а-яА-ЯёЁ]/;
        return cyrillicPattern.test(text) ? 'russian' : 'english';
    }
    
    /**
     * Извлекает обычный текст из RTF-документа
     * @param {string} rtfContent - Содержимое RTF файла
     * @returns {Promise<string>} Извлеченный текст
     */
    async parse(rtfContent) {
        // Проверка входных данных
        if (!rtfContent || typeof rtfContent !== 'string') {
            console.error('EnhancedRtfProcessor: Получены некорректные данные для парсинга');
            return '';
        }
        
        if (!this.isRtf(rtfContent)) {
            console.warn('EnhancedRtfProcessor: Переданный контент не похож на RTF');
            return rtfContent; // Возвращаем исходный текст, если это не RTF
        }
        
        // Проверка кэша
        const cacheKey = this._generateCacheKey(rtfContent);
        if (this._cache.has(cacheKey)) {
            console.log('EnhancedRtfProcessor: Использование кэшированного результата');
            return this._cache.get(cacheKey);
        }
        
        console.log('EnhancedRtfProcessor: Начало парсинга RTF');
        
        try {
            // Определяем язык RTF документа по наличию русских символов или CP1251 кодов
            const hasRussianCodes = /\\\'[cdef][0-9a-f]/i.test(rtfContent);
            
            let parsedText = '';
            
            if (hasRussianCodes) {
                console.log('EnhancedRtfProcessor: Обнаружен русский RTF (CP1251)');
                parsedText = this._parseRussianRtf(rtfContent);
            } else {
                console.log('EnhancedRtfProcessor: Обрабатываем как обычный RTF');
                parsedText = this._parseGenericRtf(rtfContent);
            }
            
            // Дополнительная обработка после парсинга
            parsedText = this._postProcessText(parsedText);
            
            // Проверяем качество разделения на строки
            parsedText = this._ensureProperLineStructure(parsedText);
            
            // Сохраняем результат в кэш
            this._cache.set(cacheKey, parsedText);
            
            return parsedText;
        } catch (error) {
            console.error('EnhancedRtfProcessor: Ошибка парсинга RTF', error);
            
            // В случае ошибки пытаемся вернуть хотя бы что-то полезное
            const fallbackText = rtfContent
                .replace(/\{\\rtf[^}]*\}/g, '')
                .replace(/\\[a-z0-9]+/g, '')
                .replace(/[{}\\]/g, '')
                .trim();
                
            return fallbackText || rtfContent;
        }
    }
    
    /**
     * Генерирует ключ для кэширования на основе хеша содержимого
     * @param {string} content - Контент для хеширования
     * @returns {string} Хеш для использования в качестве ключа кэша
     * @private
     */
    _generateCacheKey(content) {
        // Простой хеш-алгоритм для строк
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return 'rtf_' + Math.abs(hash).toString(16);
    }
    
    /**
     * Парсит русский RTF с учетом кодировки CP1251 и Unicode-escape
     * @param {string} rtfContent - RTF контент
     * @returns {string} Извлеченный текст
     * @private
     */
    _parseRussianRtf(rtfContent) {
        // Предварительно анализируем структуру RTF-документа
        const hasLineBreakMarkers = this._analyzeRtfStructure(rtfContent);
        
        // Удаляем RTF-заголовок и завершающую скобку
        let text = rtfContent.replace(/^.*\\fonttbl.*?(\{|\\)/s, '');
        text = text.replace(/}$/s, '');
        
        // Обрабатываем группы и скрытый текст
        text = text.replace(/\{\\[\*\w]+\s+[^{}]*\}/g, ''); // Удаляем группы специальных тегов
        
        // Заменяем экранированные символы CP1251 на соответствующие Unicode
        Object.keys(this._cp1251Map).forEach(code => {
            const regex = new RegExp('\\\\' + code, 'g');
            text = text.replace(regex, this._cp1251Map[code]);
        });
        
        // Заменяем Unicode-экранированные последовательности (включая кириллицу)
        text = text.replace(/\\u([0-9]+)(\\?[\s;'cf0-9])?/g, (match, code) => {
            // Добавил (\\?[\s;'cf0-9])? для обработки необязательных завершающих символов после \uXXXX
            return String.fromCharCode(parseInt(code, 10));
        });
        
        // Более точная обработка RTF-команд переноса строк
        if (hasLineBreakMarkers) {
            // Если документ использует стандартные маркеры переноса строк, обрабатываем их точно
            text = text.replace(/\\par\b/g, '\n'); // Параграфы
            text = text.replace(/\\line\b/g, '\n'); // Переносы строк
            text = text.replace(/\\sect\b/g, '\n'); // Секции
            text = text.replace(/\\page\b/g, '\n'); // Страницы
            text = text.replace(/\\pard\\plain/g, '\n'); // Форматирование абзаца
        } else {
            // Если стандартных маркеров нет, используем эвристический подход
            text = text.replace(/\\par\b/g, '\n');
            text = text.replace(/\\line\b/g, '\n');
            
            // Ищем потенциальные переносы строк после команд форматирования
            text = text.replace(/\\pard(\\[\w]+)*\s+/g, '\n');
            text = text.replace(/\\plain(\\[\w]+)*\s+/g, '\n');
            text = text.replace(/\\sa\d+\\sb\d+/g, '\n');
        }
        
        text = text.replace(/\\tab\b/g, '\t'); // Табуляции
        text = text.replace(/\\\n/g, '\n'); // Экранированные переносы строк
        text = text.replace(/\pict.*?\wmetafile\d.*?}/gs, ''); // Удаляем метафайлы
        text = text.replace(/\'[0-9a-fA-F]{2}/g, ''); // Удаляем оставшиеся hex-коды, которые не были CP1251

        // Удаляем команды форматирования (более агрессивно)
        text = text.replace(/\\[a-z0-9*]+[-]?\d*/g, ' '); // NEW: Replace commands with a space
        text = text.replace(/[{}]/g, ''); // Фигурные скобки
        text = text.replace(/\\pardirnatural\s?/g, ''); // Специфичные теги

        // Заменяем экранированные символы
        text = text.replace(/\\\\/g, '\\'); // Обратная косая черта
        text = text.replace(/\\{/g, '{'); // Открывающая скобка
        text = text.replace(/\\}/g, '}'); // Закрывающая скобка
        text = text.replace(/\\\'/g, '\''); // Апостроф
        
        // Дополнительная обработка для русских текстов
        text = text.replace(/([А-Яа-яA-Za-z,.!?:;)»]+)0\s*([А-Яа-яA-Za-z«(])/g, '$1\n$2');
        text = text.replace(/([А-Яа-яA-Za-z])0([А-Яа-яA-Za-z])/g, '$1 $2');
        text = text.replace(/(\S)0(\s)/g, '$1\n$2');
        text = text.replace(/(\s)0(\S)/g, '$1\n$2');
        text = text.replace(/\b0\b/g, '\n');
        
        return text;
    }
    
    /**
     * Анализирует структуру RTF-документа для определения способов переноса строк
     * @param {string} rtfContent - RTF контент
     * @returns {boolean} true, если обнаружены стандартные маркеры переноса строк
     * @private 
     */
    _analyzeRtfStructure(rtfContent) {
        // Подсчитываем количество стандартных маркеров переноса строк
        const parCount = (rtfContent.match(/\\par\b/g) || []).length;
        const lineCount = (rtfContent.match(/\\line\b/g) || []).length;
        const paragraphStyleCount = (rtfContent.match(/\\pard\b/g) || []).length;
        
        // Логируем информацию о структуре документа
        console.log(`RTF структура документа: \\par: ${parCount}, \\line: ${lineCount}, \\pard: ${paragraphStyleCount}`);
        
        // Если есть достаточное количество маркеров, считаем что документ использует стандартную структуру
        return (parCount > 3 || lineCount > 3);
    }
    
    /**
     * Парсит обычный RTF без специальной обработки для русского языка, но с поддержкой Unicode-escape
     * @param {string} rtfContent - RTF контент
     * @returns {string} Извлеченный текст
     * @private
     */
    _parseGenericRtf(rtfContent) {
        // Анализируем структуру RTF-документа
        const hasLineBreakMarkers = this._analyzeRtfStructure(rtfContent);
        
        // Удаляем RTF-заголовок
        let text = rtfContent.replace(/^.*?\\fonttbl.*?(\{|\\)/s, '');
        
        // Заменяем Unicode-экранированные последовательности
        text = text.replace(/\\u([0-9]+)(\\?[\s;'cf0-9])?/g, (match, code) => {
            return String.fromCharCode(parseInt(code, 10));
        });
        
        // Более точная обработка RTF-команд переноса строк
        if (hasLineBreakMarkers) {
            // Если документ использует стандартные маркеры переноса строк
            text = text.replace(/\\par\b/g, '\n'); // Параграфы
            text = text.replace(/\\line\b/g, '\n'); // Переносы строк
            text = text.replace(/\\sect\b/g, '\n\n'); // Секции как двойной перенос
            text = text.replace(/\\page\b/g, '\n\n'); // Страницы как двойной перенос
        } else {
            // Если стандартных маркеров нет, ищем потенциальные переносы строк
            text = text.replace(/\\par\b/g, '\n');
            text = text.replace(/\\line\b/g, '\n');
            text = text.replace(/\\pard(\\[\w]+)*\s+/g, '\n'); // Стили абзаца часто означают новый абзац
        }
        
        text = text.replace(/\\tab\b/g, '\t');
        text = text.replace(/\\\n/g, '\n');
        text = text.replace(/\\'[0-9a-fA-F]{2}/g, ''); // Удаляем hex-коды
        
        // Удаляем все остальные RTF команды (более агрессивно)
        text = text.replace(/\\[a-zA-Z0-9*]+(-?\d+)?/g, ' '); // NEW: Replace commands with a space
        text = text.replace(/[{}]/g, '');
        text = text.replace(/\\pardirnatural\s?/g, '');
        
        // Заменяем экранированные символы
        text = text.replace(/\\\\/g, '\\');
        text = text.replace(/\\{/g, '{');
        text = text.replace(/\\}/g, '}');
        
        return text;
    }
    
    /**
     * Выполняет дополнительную обработку текста после парсинга
     * @param {string} text - Текст для обработки
     * @returns {string} Обработанный текст
     * @private
     */
    _postProcessText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        
        // Удаляем распространенные остаточные RTF-теги и метаданные шрифтов
        // Например, f0, Helvetica-Bold, charset0 и т.д.
        let processedText = text.replace(/\b[fb]\d+\b/gi, ''); // Удаляет \f0, \b0, \f1 и т.д.
        processedText = processedText.replace(/\\fs\d+/gi, '');   // Удаляет \fsXX (размер шрифта)
        processedText = processedText.replace(/([A-Za-z0-9-]+);/g, ''); // Удаляет конструкции типа "Helvetica-Bold;"
        processedText = processedText.replace(/\b(charset\d+|ansicpg\d+|cocoartf\d+|cocoatextscaling\d+|expandedcolortbl;;|paperw\d+|paperh\d+|margl\d+|margr\d+|vieww\d+|viewh\d+|pard\b|tx\d+)/gi, '');
        processedText = processedText.replace(/\b(Helvetica-Bold|Helvetica|Arial|Times New Roman|Symbol|Verdana|Tahoma)\b/gi, ''); // Названия шрифтов
        processedText = processedText.replace(/;;/g, ';'); // Двойные точки с запятой
        processedText = processedText.replace(/[;:,](?=\s*\n)|^[;:,\s]+/gm, ''); // Лишние символы в начале строк или перед переводом строки

        // Нормализация пробелов и переносов строк
        processedText = processedText.replace(/[ \t]+/g, ' ');
        processedText = processedText.replace(/\n{3,}/g, '\n\n');
        
        // Удаление строк, содержащих только непечатные символы или остатки тегов
        const lines = processedText.split('\n');
        const filteredLines = lines.filter(line => {
            const trimmed = line.trim();
            // Оставляем строки с хотя бы одной буквой/цифрой или специальными маркерами
            return trimmed.length > 0 && (
                /[A-Za-zА-Яа-яЁё0-9]/.test(trimmed) || 
                /\[(припев|проигрыш|куплет|intro|outro|solo|бридж|chorus|verse|bridge)\b/i.test(trimmed)
            );
        });
        
        // Для русских песен стандартизируем маркеры
        const lang = this._detectLanguage(processedText);
        let result = filteredLines.join('\n').trim();
        
        if (lang === 'russian') {
            result = result.replace(/\[припев\]/gi, '\n[Припев]\n');
            result = result.replace(/\[проигрыш\]/gi, '\n[Проигрыш]\n');
            result = result.replace(/\[куплет\s*\d*\]/gi, (match) => `\n${match}\n`);
        } else {
            result = result.replace(/\[chorus\]/gi, '\n[Chorus]\n');
            result = result.replace(/\[verse\s*\d*\]/gi, (match) => `\n${match}\n`);
            result = result.replace(/\[bridge\]/gi, '\n[Bridge]\n');
        }
        
        return result;
    }
    
    /**
     * Проверяет качество разделения на строки и улучшает его при необходимости
     * @param {string} text - Обработанный текст
     * @returns {string} - Текст с улучшенной структурой строк
     * @private
     */
    _ensureProperLineStructure(text) {
        // Проверяем, есть ли переносы строк в тексте
        if (!text.includes('\n') && text.length > 100) {
            console.log('EnhancedRtfProcessor: Текст не содержит переносов строк, применяем интеллектуальное разделение');
            return this._intelligentLineSplitting(text);
        }
        
        const lines = text.split('\n');
        // Если после первоначального разделения (например, по \par) у нас очень мало строк,
        // а текст длинный, это признак того, что \par было недостаточно.
        if (lines.length < 5 && text.length > 200) { 
            console.log('EnhancedRtfProcessor: Недостаточно строк после базового разделения, применяем интеллектуальное разделение ко всему тексту');
            return this._intelligentLineSplitting(text); 
        }
        
        const improvedLines = lines.flatMap(line => { // Используем flatMap для прямого добавления массивов строк
            if (line.length > 100) { // Порог для очень длинных строк, которые точно требуют дополнительного внимания
                // Если строка очень длинная, сначала пытаемся ее интеллектуально разделить
                const subSplitLines = this._intelligentLineSplitting(line);
                // И затем каждую из них еще раз через _splitLongLine, если они все еще слишком длинные
                return subSplitLines.split('\n').flatMap(ssl => this._splitLongLine(ssl, this._detectLanguage(ssl) === 'russian'));
            }
            return [line]; // Возвращаем как массив, чтобы flatMap работал корректно
        });
        
        return improvedLines.join('\n');
    }
    
    /**
     * Интеллектуальное разделение текста на строки
     * @param {string} text - Текст для разделения
     * @returns {string} - Текст с улучшенной структурой
     * @private
     */
    _intelligentLineSplitting(text) {
        if (!text || text.trim().length === 0) {return '';}
        
        const isRussian = this._detectLanguage(text) === 'russian';
        console.log(`EnhancedRtfProcessor: Применяем интеллектуальное разделение для ${isRussian ? 'русского' : 'английского'} текста (акцент на заглавных буквах)`);
        
        let processedText = text;

        // 1. Стандартные разделители по знакам препинания и заглавным буквам
        if (isRussian) {
            processedText = processedText.replace(/([.!?…])\s+([А-ЯЁ])/g, '$1\n$2');
            // Менее агрессивное разделение по заглавной букве после строчной, чтобы не рвать имена собственные
            // processedText = processedText.replace(/([а-яё])\s+([А-ЯЁ][а-яё]{2,})/g, '$1\n$2'); 
        } else {
            processedText = processedText.replace(/([.!?…])\s+([A-Z])/g, '$1\n$2');
            // processedText = processedText.replace(/([a-z])\s+([A-Z][a-z]{2,})/g, '$1\n$2');
        }

        // 2. Добавляем переносы перед типичными песенными паттернами
        const songPatterns = isRussian
            ? ['Припев', 'Куплет', 'Бридж', 'Проигрыш', 'Вступление', 'Кода', 'Аутро'] // Убрал местоимения отсюда
            : ['Chorus', 'Verse', 'Bridge', 'Intro', 'Outro', 'Coda', 'Solo'];
            
        songPatterns.forEach(pattern => {
            const regex = new RegExp(`\\b${pattern}`, 'g');
            processedText = processedText.replace(regex, `\n${pattern}`);
        });
        
        const lines = processedText.split('\n');
        const finalLines = [];

        for (const line of lines) {
            if (line.trim().length === 0) {continue;}

            // Проверяем, нужно ли дополнительно делить эту строку
            // Эвристика: если строка длинная И (в ней мало пробелов ИЛИ она не заканчивается пунктуацией)
            // ИЛИ если строка длинная и содержит несколько заглавных букв не в начале слов (потенциальные начала строк)
            const words = line.split(' ');
            if (words.length === 1 && line.length > 60) { // Очень длинное слово без пробелов - вероятно, ошибка парсинга RTF, не трогаем
                finalLines.push(line);
                continue;
            }

            let currentSegment = '';
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (word.trim().length === 0) {continue;}

                // Условие для начала новой строки: 
                // 1. Не первое слово в обрабатываемом сегменте (currentSegment уже что-то содержит)
                // 2. Слово начинается с заглавной буквы
                // 3. Предыдущее слово не заканчивается на точку/запятую (чтобы не дублировать разрыв)
                // 4. Длина текущего сегмента уже достаточная (например, > 30 символов)
                const prevWord = i > 0 ? words[i-1] : '';
                const segmentHasContent = currentSegment.trim().length > 0;
                const wordStartsWithCapital = isRussian ? /^[А-ЯЁ]/.test(word) : /^[A-Z]/.test(word);
                const prevWordEndsWithPunctuation = /[.,!?…]$/.test(prevWord);
                const currentSegmentLongEnough = currentSegment.length > 30;

                if (segmentHasContent && wordStartsWithCapital && !prevWordEndsWithPunctuation && currentSegmentLongEnough) {
                     // Дополнительная проверка: не является ли это частью имени собственного или аббревиатуры
                    if (!(isRussian && /^[А-ЯЁ]{2,}$/.test(word) && currentSegment.endsWith('.')) && 
                        !(!isRussian && /^[A-Z]{2,}$/.test(word) && currentSegment.endsWith('.'))) {
                        finalLines.push(currentSegment.trim());
                        currentSegment = word;
                        continue;
                    }
                }
                currentSegment += (currentSegment ? ' ' : '') + word;
            }
            if (currentSegment.trim().length > 0) {
                finalLines.push(currentSegment.trim());
            }
        }
        
        let resultText = finalLines.join('\n');

        // Применяем _splitLongLine к каждой строке, полученной после интеллектуального разделения
        // Это поможет доразбить строки, которые все еще слишком длинные, но уже логически разделены.
        return resultText.split('\n').flatMap(l => this._splitLongLine(l, isRussian))
               .map(l => l.trim())
               .filter(l => l.length > 0)
               .join('\n');
    }
    
    /**
     * Разбивает длинную строку на более короткие по логическим точкам разделения
     * @param {string} line - Длинная строка для разделения
     * @param {boolean} isRussian - Флаг русского языка для специфичных правил
     * @returns {string[]} - Массив коротких строк
     * @private
     */
    _splitLongLine(line, isRussian) {
        if (!line || line.trim().length === 0) {return [];} // Возвращаем пустой массив, если строка пуста
        
        // Если строка короткая, нет смысла ее делить
        const minLengthToSplit = isRussian ? 70 : 80;
        if (line.length < minLengthToSplit) {return [line.trim()];}

        const result = [];
        const maxLength = isRussian ? 60 : 70;
        let currentSegment = '';
        const words = line.split(' ');

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (word.trim().length === 0) {continue;}

            if (currentSegment.length + word.length + 1 > maxLength && currentSegment.length > 0) {
                const prevWord = i > 0 ? words[i-1].toLowerCase() : '';
                const commonPrepositionsAndConjunctions = isRussian
                    ? ['и', 'а', 'но', 'да', 'в', 'на', 'с', 'к', 'по', 'о', 'из', 'у', 'без', 'до', 'за', 'над', 'об', 'от', 'перед', 'при', 'через', 'для', 'про', 'сквозь', 'между', 'то', 'же', 'бы', 'ли']
                    : ['and', 'or', 'but', 'so', 'in', 'on', 'at', 'to', 'for', 'with', 'a', 'the', 'of', 'is', 'was', 'be', 'has', 'had', 'as', 'it'];
                
                // Стараемся не разрывать строку прямо перед коротким словом (предлог/союз)
                if (currentSegment.length > maxLength * 0.6 && !commonPrepositionsAndConjunctions.includes(word.toLowerCase())) {
                    result.push(currentSegment.trim());
                    currentSegment = word;
                } else {
                    currentSegment += ' ' + word;
                }
            } else {
                currentSegment += (currentSegment ? ' ' : '') + word;
            }
        }
        
        if (currentSegment.trim().length > 0) {
            result.push(currentSegment.trim());
        }
        
        // Если после разбивки первая строка всё равно слишком длинная и состоит из нескольких слов,
        // применяем более жесткое разделение этой первой строки.
        if (result.length > 0 && result[0].length > maxLength * 1.2 && result[0].includes(' ')) {
            const firstLineWords = result[0].split(' ');
            const midPoint = Math.ceil(firstLineWords.length / 2);
            if (midPoint > 0 && midPoint < firstLineWords.length) {
                const newFirstLine = firstLineWords.slice(0, midPoint).join(' ');
                const newSecondLine = firstLineWords.slice(midPoint).join(' ');
                if (newFirstLine.length > 0 && newSecondLine.length > 0) {
                    result.splice(0, 1, newFirstLine, newSecondLine);
                }
            }
        }
        return result.filter(l => l.trim().length > 0);
    }
    
    /**
     * Очищает кэш или удаляет конкретную запись
     * @param {string} [key] - Ключ кэша для удаления (необязательно)
     */
    clearCache(key) {
        if (key) {
            this._cache.delete(key);
        } else {
            this._cache.clear();
        }
        console.log('EnhancedRtfProcessor: Кэш очищен');
    }
    
    /**
     * Статический метод для упрощенного парсинга RTF
     * @param {string} rtfContent - RTF контент
     * @returns {Promise<string>} Извлеченный текст
     */
    static async parse(rtfContent) {
        const processor = new EnhancedRtfProcessor();
        return processor.parse(rtfContent);
    }
}

// Экспортируем класс как глобальную переменную
if (typeof window !== 'undefined') {
    window.EnhancedRtfProcessor = EnhancedRtfProcessor;
} 