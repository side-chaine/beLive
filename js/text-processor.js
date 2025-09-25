class TextProcessor {
    static processText(text, language = 'russian') {
        if (!text || typeof text !== 'string') {
            return { lines: [], averageCharsPerLine: 0, maxCharsPerLine: 0, totalLines: 0 };
        }

        // Удаляем BOM, если он есть
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
        }

        let lines = text.split('\n');

        // Фильтрация пустых строк и тримминг
        lines = lines.map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length <= 1 && text.length > 80) {
            // Только если очень мало строк изначально (например, текст без переносов)
            return { lines: [], averageCharsPerLine: 0, maxCharsPerLine: 0, totalLines: 0 };
        }

        let totalChars = 0;
        let maxCharsPerLine = 0;
        let totalLines = lines.length;

        for (let line of lines) {
            totalChars += line.length;
            if (line.length > maxCharsPerLine) {
                maxCharsPerLine = line.length;
            }
        }

        let averageCharsPerLine = totalChars / totalLines;

        return {
            lines: lines,
            averageCharsPerLine: averageCharsPerLine,
            maxCharsPerLine: maxCharsPerLine,
            totalLines: totalLines
        };
    }
} 