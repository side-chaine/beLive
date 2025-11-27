(function(){
	window.SimpleRtf = window.SimpleRtf || {};
	/**
	 * Простой RTF→Text: сохраняет пустые строки и корректно декодирует кириллицу.
	 */
	window.SimpleRtf.toText = function toText(rtfContent){
		if (typeof rtfContent !== 'string') {return '';}
		let txt = rtfContent;
		// Удаляем RTF-заголовок и группы, которые часто содержат метаданные
		txt = txt.replace(/^{\\rtf1[^{}]*}/, '');
		txt = txt.replace(/{\\.*?}/g, ''); // Удаляем все RTF-группы
		txt = txt.replace(/\\ansicpg\d+/g, ''); // Удаляем информацию о кодировке
		txt = txt.replace(/\\deff?\d+/g, ''); // Удаляем дефолтные шрифты
		txt = txt.replace(/\\nouicompat/g, ''); // Удаляем режим совместимости UI
		// Двойные переносы как разделители блоков
		txt = txt.replace(/\\par\b\s*\\par\b/g, '\n\n').replace(/\\line\b\s*\\line\b/g, '\n\n');
		// Одиночные переносы
		txt = txt.replace(/\\par\b/g, '\n').replace(/\\line\b/g, '\n');
		// Декодирование \uXXXX (в т.ч. отрицательные)
		txt = txt.replace(/\\u(-?\d+)\??/g, function(_, code){
			let num = parseInt(code, 10);
			if (num < 0) {num = 65536 + num;} // RTF negative unicode fix
			return String.fromCharCode(num);
		});
		// Декодирование \'HH по CP1251
		try {
			const decoder = new TextDecoder('windows-1251');
			txt = txt.replace(/\\'([0-9A-Fa-f]{2})/g, function(_, hex){
				const byte = parseInt(hex, 16);
				const arr = new Uint8Array([byte]);
				return decoder.decode(arr);
			});
		} catch (_) {
			// Fallback — приблизительное отображение
			txt = txt.replace(/\\'([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex,16)));
		}
		// Удаляем управляющие слова RTF, кроме переводов строк
		txt = txt.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');
		txt = txt.replace(/[{}]/g, '');
		// Нормализации «висячих» слешей и переносов
		txt = txt.replace(/\n{3,}/g, '\n\n');
		txt = txt.replace(/\\\s*$/gm, '');
		txt = txt.replace(/^\s*\\\s*$/gm, '');
		txt = txt.replace(/\\\s*\n/g, '\n');
		return txt.trim();
	};
})(); 