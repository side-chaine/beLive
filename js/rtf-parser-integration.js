/**
 * RTF Parser Integration
 * Интегрирует EnhancedRtfProcessor и RtfParserAdapter в основное приложение
 * для улучшенной обработки RTF-файлов.
 */

/**
 * Объект для интеграции RTF-парсера в приложение
 */
const rtfParserIntegration = {
    /**
     * Инициализирует интеграцию, расширяя прототипы необходимых классов
     */
    init() {
        console.log('RTF Parser Integration: Начало интеграции');
        this.extendLyricsDisplay();
        this.extendTrackCatalog();
        console.log('RTF Parser Integration: Интеграция завершена успешно');
    },

    /**
     * Расширяет функционал LyricsDisplay для работы с улучшенным RTF-парсером
     */
    extendLyricsDisplay() {
        const originalLoadLyrics = LyricsDisplay.prototype.loadLyrics;
        const originalProcessLyrics = LyricsDisplay.prototype._processLyrics;
        const originalParseRtfUniversal = LyricsDisplay.prototype._parseRtfUniversal;

        // Добавляем новый метод для парсинга RTF через адаптер
        LyricsDisplay.prototype._parseRtfWithAdapter = async function(rtfText) {
            console.log('RTF Integration: Запуск парсинга RTF через RtfParserAdapter');
            if (!rtfText) {return '';}
            
            try {
                // Создаем экземпляр адаптера
                const rtfAdapter = new RtfParserAdapter();
                console.log('RTF Integration: Используем RtfParserAdapter для обработки RTF');
                
                // Парсим RTF асинхронно
                const parsedText = await rtfAdapter.parse(rtfText);
                console.log(`RTF Integration: Адаптер завершил обработку, результат: ${parsedText ? parsedText.length : 0} символов`);
                
                return parsedText || '';
            } catch (error) {
                console.error('RTF Integration: Ошибка при парсинге RTF через адаптер:', error);
                // В случае ошибки возвращаем пустую строку
                return '';
            }
        };

        // Делаем _processLyrics асинхронным и подключаем улучшенный парсер
        LyricsDisplay.prototype._processLyrics = async function(text) {
            console.log(`RTF Integration: Обработка текста, длина: ${text ? text.length : 0}`);
            
            // Выполняем оригинальную проверку на пустой текст
            if (!text) {
                this.lyrics = [];
                return;
            }
            
            // Определяем тип текста
            const isRtf = text.includes('\\rtf') || 
                         text.includes('\\par') || 
                         text.includes('\\pard') || 
                         text.includes('\\fonttbl');
                         
            if (isRtf) {
                console.log('RTF Integration: Обнаружен RTF, используем улучшенный парсер');
                try {
                    // Пытаемся обработать текст через адаптер
                    const processedText = await this._parseRtfWithAdapter(text);
                    if (processedText && processedText.length > 0) {
                        console.log(`RTF Integration: Успешно обработан RTF, длина: ${processedText.length}`);
                        this.fullText = processedText;
                    } else {
                        console.warn('RTF Integration: Адаптер вернул пустой результат, используем оригинальный метод');
                        // Если адаптер не справился, используем оригинальный обработчик
                        return originalProcessLyrics.call(this, text);
                    }
                } catch (error) {
                    console.error('RTF Integration: Ошибка обработки RTF', error);
                    // При ошибке используем оригинальный обработчик
                    return originalProcessLyrics.call(this, text);
                }
                
                // Если успешно обработали RTF, разделяем на строки и рендерим
                let lines = this.fullText.split(/[\r\n]+/);
                console.log(`RTF Integration: Получено ${lines.length} строк`);
                
                // Дополнительная обработка строк
                lines = lines.map(line => line.trim())
                         .filter(line => line.length > 0);
                
                this.lyrics = lines;
                return;
            } else {
                // Для не-RTF используем оригинальный метод обработки
                return originalProcessLyrics.call(this, text);
            }
        };

        // Делаем loadLyrics асинхронным для работы с промисами
        LyricsDisplay.prototype.loadLyrics = async function(lyrics, duration = 0) {
            console.log(`RTF Integration: Загрузка текста, длина: ${lyrics ? lyrics.length : 0}`);
            
            // Сброс состояния
            this.reset();
            
            // Сохраняем параметры
            this.duration = duration;
            this.originalText = lyrics;
            
            try {
                // Асинхронно обрабатываем текст
                await this._processLyrics(lyrics);
                
                // Отрисовываем текст
                this._renderLyrics();
                
                console.log('RTF Integration: Текст успешно загружен и отображен');
            } catch (error) {
                console.error('RTF Integration: Ошибка загрузки текста:', error);
                
                // Пытаемся использовать оригинальный метод как запасной вариант
                try {
                    originalLoadLyrics.call(this, lyrics, duration);
                } catch (fallbackError) {
                    console.error('RTF Integration: Запасной метод также не сработал:', fallbackError);
                    // В случае ошибки отображаем сообщение об ошибке
                    this.lyrics = ['Ошибка обработки текста. Проверьте консоль браузера.'];
                    this._renderLyrics();
                }
            }
        };
    },

    /**
     * Расширяет функционал TrackCatalog для улучшенной обработки RTF при загрузке треков
     */
    extendTrackCatalog() {
        // На данный момент в TrackCatalog уже есть код для использования RtfParserAdapter,
        // поэтому дополнительные изменения не требуются
        console.log('RTF Parser Integration: TrackCatalog уже использует RtfParserAdapter если он доступен');
    }
}; 

// Проверяем, что необходимые компоненты доступны и инициализируем интеграцию
// Этот блок теперь находится ПОСЛЕ определения rtfParserIntegration
if (typeof LyricsDisplay === 'undefined') {
    console.error('RTF Parser Integration: LyricsDisplay не обнаружен, интеграция невозможна');
} else if (typeof RtfParserAdapter === 'undefined') {
    console.error('RTF Parser Integration: RtfParserAdapter не обнаружен, интеграция невозможна');
} else if (typeof rtfParserIntegration === 'undefined' || typeof rtfParserIntegration.init !== 'function') {
    console.error('RTF Parser Integration: rtfParserIntegration не определен или не имеет метода init()');
} else {
    console.log('RTF Parser Integration: Инициализация интеграции улучшенного RTF-парсера (после определения объекта)');
    rtfParserIntegration.init();
} 