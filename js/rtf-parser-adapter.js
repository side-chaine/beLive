/**
 * RtfParserAdapter - Адаптер для обработки RTF файлов
 * Предоставляет унифицированный интерфейс для работы с различными
 * RTF парсерами, обеспечивая обратную совместимость с существующим кодом.
 */
class RtfParserAdapter {
    /**
     * Создает новый экземпляр адаптера
     * @constructor
     */
    constructor() {
        console.log('RtfParserAdapter: Инициализация (динамическая детекция в момент parse)');
    }
    
    /**
     * Проверяет, доступен ли какой-либо парсер RTF
     * @returns {boolean} true если доступен хотя бы один парсер
     */
    isAvailable() {
        const enhanced = typeof EnhancedTextProcessor !== 'undefined';
        const legacy = typeof RtfParser !== 'undefined';
        const simple = (typeof window.SimpleRtf !== 'undefined' && typeof window.SimpleRtf.toText === 'function');
        return enhanced || legacy || simple;
    }
    
    /**
     * Асинхронно парсит содержимое RTF файла 
     * с использованием наилучшего доступного парсера
     * @param {string} rtfContent - Содержимое RTF файла
     * @returns {Promise<string>} Текст, извлеченный из RTF
     */
    async parse(rtfContent) {
        if (!rtfContent) {
            console.warn('RtfParserAdapter: Получен пустой RTF контент');
            return '';
        }
        
        try {
            // Проверяем, похоже ли это на RTF файл
            if (!rtfContent.trim().startsWith('{\\rtf')) {
                console.warn('RtfParserAdapter: Контент не похож на RTF');
                return rtfContent; // Возвращаем исходный текст, если это не RTF
            }
            
            // Динамическая детекция доступных парсеров (без кеша конструктора)
            const simpleAvailable = !!(window.SimpleRtf && typeof window.SimpleRtf.toText === 'function');
            const enhancedAvailable = (typeof EnhancedTextProcessor !== 'undefined');
            const legacyAvailable = (typeof RtfParser !== 'undefined');
            
            // 1) SimpleRtf — приоритет для редактора блоков (сохраняет пустые строки)
            if (simpleAvailable) {
                console.log('RtfParserAdapter: Используем SimpleRtf');
                return this._normalizeNewlines(window.SimpleRtf.toText(rtfContent), /*preserveParagraphs*/ true);
            }
            
            // Используем улучшенный процессор, если он доступен
            if (enhancedAvailable) {
                console.log('RtfParserAdapter: Используем EnhancedTextProcessor');
                const txt = await EnhancedTextProcessor.parse(rtfContent);
                return this._normalizeNewlines(txt, true);
            }
            
            // Используем стандартный парсер, если он доступен
            if (legacyAvailable) {
                console.log('RtfParserAdapter: Используем стандартный RtfParser');
                const txt = RtfParser.parse(rtfContent);
                return this._normalizeNewlines(txt, true);
            }
            
            // Если нет доступных парсеров, используем простую очистку от тегов
            console.warn('RtfParserAdapter: Нет доступных парсеров, выполняем базовую очистку');
            return this._normalizeNewlines(this._basicCleanup(rtfContent), true);
        } catch (error) {
            console.error('RtfParserAdapter: Ошибка при парсинге RTF', error);
            
            // В случае ошибки пытаемся использовать другой доступный парсер
            if ((typeof RtfParser !== 'undefined') && (typeof EnhancedRtfProcessor !== 'undefined')) {
                // Если произошла ошибка с улучшенным процессором, попробуем стандартный
                try {
                    console.log('RtfParserAdapter: Пробуем резервный парсер');
                    const txt = RtfParser.parse(rtfContent);
                    return this._normalizeNewlines(txt, true);
                } catch (fallbackError) {
                    console.error('RtfParserAdapter: Резервный парсер также не справился', fallbackError);
                }
            }
            
            // Если все парсеры не справились, возвращаем результат базовой очистки
            return this._normalizeNewlines(this._basicCleanup(rtfContent), true);
        }
    }
    
    /**
     * Анализирует структуру RTF файла для выбора оптимальной стратегии обработки
     * @param {string} rtfContent - Содержимое RTF файла
     * @returns {Object} Информация о структуре файла
     * @private
     */
    _analyzeRtfStructure(rtfContent) {
        // Анализируем структуру файла
        const info = {
            hasParTags: false,
            hasLineTags: false,
            hasPardTags: false,
            hasUnicode: false,
            hasCP1251: false,
            estimatedLines: 0
        };
        
        // Проверяем наличие тегов переноса строк
        info.hasParTags = rtfContent.includes('\\par');
        info.hasLineTags = rtfContent.includes('\\line');
        info.hasPardTags = rtfContent.includes('\\pard');
        
        // Оцениваем количество строк, подсчитывая маркеры переноса
        const parCount = (rtfContent.match(/\\par\b/g) || []).length;
        const lineCount = (rtfContent.match(/\\line\b/g) || []).length;
        info.estimatedLines = Math.max(parCount, lineCount);
        
        // Проверяем наличие Юникода
        info.hasUnicode = rtfContent.includes('\\u');
        
        // Проверяем наличие CP1251
        info.hasCP1251 = /\\\'[cdef][0-9a-f]/i.test(rtfContent);
        
        console.log('RtfParserAdapter: Анализ структуры RTF файла', info);
        
        return info;
    }
    
    /**
     * Выполняет базовую очистку RTF-контента без использования специализированных парсеров
     * @param {string} rtfContent - Содержимое RTF файла
     * @returns {string} Очищенный текст
     * @private
     */
    _basicCleanup(rtfContent) {
        if (!rtfContent) {return '';}
        
        // Удаляем RTF-заголовок и команды
        let cleanedText = rtfContent
            .replace(/\{\\rtf[^}]*\}/g, '')          // Удаляем RTF-заголовок
            .replace(/\{\\[^}]*\}/g, '')             // Удаляем RTF-группы
            .replace(/\\[a-z0-9]+\s?/g, '')          // Удаляем RTF-команды
            .replace(/[{}\\]/g, '')                  // Удаляем управляющие символы
            .replace(/\s+/g, ' ')                    // Нормализуем пробелы
            // .replace(/\n{3,}/g, '\n\n')              // Удаляем лишние переносы строк - перемещено в _normalizeNewlines
            .trim();
        
        // Проверяем наличие строк в результате
        if (!cleanedText.includes('\n') && cleanedText.length > 200) {
            // Если текст получился в одну строку, применяем интеллектуальное разделение
            cleanedText = this._intelligentLineSplitting(cleanedText);
        }
        
        return cleanedText;
    }

    _normalizeNewlines(s, preserveParagraphs = true) {
        if (!s) return '';
        let out = String(s).replace(/\r\n|\r/g, '\n');
        // Сохраняем абзацы: схлопываем только 3+ переводов до двух
        if (preserveParagraphs) {
            out = out.replace(/\n{3,}/g, '\n\n');
        }
        return out.trim();
    }
    
    /**
     * Интеллектуальное разделение текста на строки
     * @param {string} text - Текст для разделения
     * @returns {string} Текст с переносами строк
     * @private
     */
    _intelligentLineSplitting(text) {
        if (!text) {return '';}
        
        // Определяем язык текста
        const isRussian = /[а-яА-ЯёЁ]/.test(text);
        
        let processed = text;
        
        // Разделяем по знакам препинания
        if (isRussian) {
            // Для русского текста
            processed = processed.replace(/([.!?…])\s+([А-ЯЁ])/g, '$1\n$2');
        } else {
            // Для английского текста
            processed = processed.replace(/([.!?…])\s+([A-Z])/g, '$1\n$2');
        }
        
        // Разделяем по запятым для длинных частей
        const parts = processed.split('\n');
        
        return parts.map(part => {
            if (part.length > 80 && part.includes(',')) {
                return part.replace(/,\s+/g, ',\n');
            }
            return part;
        }).join('\n');
    }
    
    /**
     * Статический метод для простого парсинга RTF (для совместимости с существующим API)
     * @param {string} rtfContent - Содержимое RTF файла
     * @returns {Promise<string>} Извлеченный текст
     */
    static async parse(rtfContent) {
        const adapter = new RtfParserAdapter();
        return await adapter.parse(rtfContent);
    }
}

// Экспортируем класс как глобальную переменную
if (typeof window !== 'undefined') {
    window.RtfParserAdapter = RtfParserAdapter;
} 