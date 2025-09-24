(function(){
	// Определяем сборку по окружению
	try {
		const isLocal = (location.protocol === 'file:') || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
		window.__BUILD__ = window.__BUILD__ ?? (isLocal ? 'dev' : 'prod');
	} catch(_) { window.__BUILD__ = window.__BUILD__ ?? 'prod'; }

	// Флаги окружения
	window.__ADMIN__ = window.__ADMIN__ ?? (window.__BUILD__ === 'dev');
	window.__DEBUG__ = window.__DEBUG__ ?? (window.__BUILD__ === 'dev');
	window.__DB_NAME__FALLBACK = 'TextAppDB';
	window.__DB_NAME = window.__DB_NAME ?? (window.__BUILD__ === 'dev' ? 'TextAppDB_DEV' : 'TextAppDB');

	// Простой логгер с уровнями
	const levels = ['debug','info','warn','error'];
	const original = console;
	window.Log = {
		debug: (...args) => { if (window.__DEBUG__) {original.debug(...args);} },
		info: (...args) => original.info(...args),
		warn: (...args) => original.warn(...args),
		error: (...args) => original.error(...args)
	};

	// Удобные хелперы
	window.toggleDebugLogs = (on) => { window.__DEBUG__ = !!on; original.info(`🔧 DEBUG ${on?'ON':'OFF'}`); };
})(); 