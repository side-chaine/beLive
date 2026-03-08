/**
 * Track Catalog for Text application
 * Handles track storage and management
 */

class TrackCatalog {
    constructor() {
        this.tracks = [];
        this.currentTrackIndex = -1;
        this.rtfAdapter = {
            parse: async (text) => window.rtfService?.parseRtf ? window.rtfService.parseRtf(text) : (typeof text === 'string' ? text : ''),
        };
        
        this.catalogElement = document.getElementById('catalog-tracks');
        this.catalogContainer = document.getElementById('track-catalog');
        
        // Keep track of uploads in progress to prevent duplicates
        this.uploadInProgress = false;
        
        // Initialize IndexedDB
        this._initDatabase();
        
        // Initialize event listeners
        this._initEventListeners();
        
        // Load tracks from storage
        
        // Проверяем флаг из редактора блоков и финализируем загрузку, если необходимо

        
        // Проверяем треки на проблемы через небольшую задержку, чтобы база успела проинициализироваться
    }
    

    
    _initDatabase() {
        
        // 🎯 ДИАГНОСТИКА: Проверяем доступность IndexedDB
        if (!window.indexedDB) {
            console.error('❌ TrackCatalog: IndexedDB не поддерживается браузером');
            return;
        }
        
        
        // 🎯 СТАБИЛЬНАЯ БАЗА: используем постоянное имя и актуальную версию
        const dbName = (window.__DB_NAME || 'TextAppDB');
        this.dbName = dbName;
        const DB_VERSION = 6;
        
        const request = indexedDB.open(dbName, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('❌ TrackCatalog: Database error:', event.target.error);
            console.error('❌ TrackCatalog: Error details:', event);
            
            // 🎯 Fallback 1: Пытаемся удалить проблемную базу и создать заново
            try {
                console.warn('TrackCatalog: Пробуем пересоздать стабильную базу...');
                const del = indexedDB.deleteDatabase(dbName);
                del.onsuccess = () => {
                    const retry = indexedDB.open(dbName, DB_VERSION);
                    retry.onupgradeneeded = (ev) => {
                        const db = ev.target.result;
                        if (!db.objectStoreNames.contains('tracks')) {
                            const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
                            trackStore.createIndex('title', 'title', { unique: false });
                        }
                        if (!db.objectStoreNames.contains('app_state')) {
                            db.createObjectStore('app_state', { keyPath: 'key' });
                        }
                        if (!db.objectStoreNames.contains('temp_audio_files')) {
                            db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                        }
                        if (!db.objectStoreNames.contains('my_music')) {
                            db.createObjectStore('my_music', { keyPath: 'trackId' });
                        }
                    };
                    retry.onsuccess = (ev2) => {
                        this.db = ev2.target.result;
                        this.dbName = dbName;
                        this._loadTracksFromDB();
                    };
                    retry.onerror = () => {
                        // 🎯 Fallback 2: Открываем Recovery базу
                        const recoveryName = (dbName + '_Recovery_' + Date.now());
                        console.warn('TrackCatalog: Переходим на Recovery базу:', recoveryName);
                        const rec = indexedDB.open(recoveryName, 1);
                        rec.onupgradeneeded = (ev3) => {
                            const db = ev3.target.result;
                            const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
                            trackStore.createIndex('title', 'title', { unique: false });
                            db.createObjectStore('app_state', { keyPath: 'key' });
                            db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                            db.createObjectStore('my_music', { keyPath: 'trackId' });
                        };
                        rec.onsuccess = (ev3) => {
                            this.db = ev3.target.result;
                            this.dbName = recoveryName;
                            this._loadTracksFromDB();
                        };
                        rec.onerror = (e3) => {
                            console.error('💥 TrackCatalog: Не удалось открыть Recovery базу:', e3);
                        };
                    };
                };
                del.onerror = () => {
                    console.warn('TrackCatalog: Не удалось удалить стабильную базу. Переходим к Recovery.');
                    const recoveryName = (dbName + '_Recovery_' + Date.now());
                    const rec = indexedDB.open(recoveryName, 1);
                    rec.onupgradeneeded = (ev3) => {
                        const db = ev3.target.result;
                        const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
                        trackStore.createIndex('title', 'title', { unique: false });
                        db.createObjectStore('app_state', { keyPath: 'key' });
                        db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                        db.createObjectStore('my_music', { keyPath: 'trackId' });
                    };
                    rec.onsuccess = (ev3) => {
                        this.db = ev3.target.result;
                        this.dbName = recoveryName;
                        this._loadTracksFromDB();
                    };
                };
            } catch (e) {
                console.error('TrackCatalog: Fallback init exception:', e);
            }
        };
        
        request.onblocked = (event) => {
            console.warn('⚠️ TrackCatalog: Database blocked:', event);
            console.warn('⚠️ TrackCatalog: Trying to force close other connections...');
        };
        
        request.onupgradeneeded = (event) => {
            this.db = event.target.result;
            
            // Создаем/мигрируем stores
            if (!this.db.objectStoreNames.contains('tracks')) {
                const trackStore = this.db.createObjectStore('tracks', { keyPath: 'id' });
                trackStore.createIndex('title', 'title', { unique: false });
            }
            if (!this.db.objectStoreNames.contains('app_state')) {
                this.db.createObjectStore('app_state', { keyPath: 'key' });
            }
            if (!this.db.objectStoreNames.contains('temp_audio_files')) {
                this.db.createObjectStore('temp_audio_files', { keyPath: 'id' });
            }
            if (!this.db.objectStoreNames.contains('my_music')) {
                this.db.createObjectStore('my_music', { keyPath: 'trackId' });
            }
        };
        
        request.onsuccess = (event) => {
            this.db = event.target.result;
            
            // Load tracks from database
            this._loadTracksFromDB();
        };
    }
    
    _initEventListeners() {
        // Catalog open/close buttons
        const catalogBtn = document.getElementById('catalog-btn');
        const clearBtn = document.getElementById('clear-catalog');
        
        catalogBtn.addEventListener('click', () => {
            if (window.openCatalog) {
                window.openCatalog();
            }
        });
        
        // Кнопка очистки каталога
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (window.clearAllTracksAction) {
                    await window.clearAllTracksAction();
                }
            });
        }
        
        
        // Import Markers button
        const importMarkersBtn = document.getElementById('import-markers-btn');
        const importMarkersInput = document.getElementById('import-markers-input');
        const importFileName = document.getElementById('import-file-name');
        
        if (importMarkersBtn && importMarkersInput) {
            // Show file selector when the button is clicked
            importMarkersBtn.addEventListener('click', () => {
                importMarkersInput.click();
            });
            
            // Handle file selection
            importMarkersInput.addEventListener('change', () => {
                if (importMarkersInput.files && importMarkersInput.files.length > 0) {
                    const file = importMarkersInput.files[0];
                    importFileName.textContent = file.name;
                    
                    // Read the file and import markers
                    if (window.importMarkersAction) {
                    window.importMarkersAction(file);
                }
                } else {
                    importFileName.textContent = 'No file selected';
                }
            });
        }
        
        // Create and set up Load Markers button
        
        
        // Убрано: автоматическое открытие каталога после закрытия Sync
        // Пользователь сам решает когда открыть каталог

    }
    
    async _loadTracksFromDB() {
        try {
            if (!this.db) { console.error('TrackCatalog: DB is not initialized'); return; }
            const tx = this.db.transaction(['tracks'], 'readonly');
            const store = tx.objectStore('tracks');
            const req = store.getAll();
            req.onsuccess = async () => {
                const result = req.result || [];
                this.tracks = result;
                if (this.tracks.length === 0) {
                    await this._tryMigrateFromFallbackDBs();
                    // reload
                    try {
                        const tx2 = this.db.transaction(['tracks'], 'readonly');
                        const st2 = tx2.objectStore('tracks');
                        const rq2 = st2.getAll();
                        await new Promise((res, rej) => { rq2.onsuccess = res; rq2.onerror = rej; });
                        this.tracks = rq2.result || [];
                    } catch (e) { console.warn('TrackCatalog: reload after migrate failed', e); }
                }
            };
            req.onerror = (e) => {
                console.error('TrackCatalog: Failed to load tracks from DB', e);
            };
        } catch (e) {
            console.error('TrackCatalog: Unexpected error while loading tracks', e);
        }
    }

    async _tryMigrateFromFallbackDBs() {
        try {
            const tx = this.db.transaction(['app_state'], 'readonly');
            const st = tx.objectStore('app_state');
            const req = st.get('catalog_cleared_v1');
            await new Promise((res, rej) => { req.onsuccess = res; req.onerror = rej; });
            if (req.result && req.result.value === true) return;
        } catch (_) {}
        const current = (window.__DB_NAME || 'TextAppDB');
        const candidates = ['TextAppDB', 'TextAppDB_DEV'].filter(n => n !== current);
        for (const name of candidates) {
            try {
                const srcDb = await new Promise((resolve, reject) => {
                    const req = indexedDB.open(name);
                    req.onsuccess = (e) => resolve(e.target.result);
                    req.onerror = () => reject(new Error('open failed'));
                });
                if (!srcDb || !srcDb.objectStoreNames.contains('tracks')) { try { srcDb.close(); } catch(_){}; continue; }
                const readAll = (db, storeName) => new Promise((resolve) => {
                    if (!db.objectStoreNames.contains(storeName)) { resolve([]); return; }
                    const tx = db.transaction([storeName], 'readonly');
                    const st = tx.objectStore(storeName);
                    const rq = st.getAll();
                    rq.onsuccess = () => resolve(rq.result || []);
                    rq.onerror = () => resolve([]);
                });
                const oldTracks = await readAll(srcDb, 'tracks');
                if (!oldTracks || oldTracks.length === 0) { try { srcDb.close(); } catch(_){}; continue; }
                try {
                    const tx = this.db.transaction(['tracks'], 'readwrite');
                    const dst = tx.objectStore('tracks');
                    oldTracks.forEach(t => { try { dst.put(t); } catch(_) {} });
                    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; tx.onabort = rej; });
                } catch (e) { console.warn('TrackCatalog: write after migrate failed', e); }
                try { srcDb.close(); } catch(_){}
                return;
            } catch (e) {
                console.debug(`TrackCatalog: migrate from ${name} skipped`, e?.message || e);
            }
        }
    }

    /**
     * Import markers for a specific track
     * @param {number} trackId - The ID of the track to import markers for
     * @private
     */
    
    /**
     * Set up the Load Markers button
     * @private
     */
    
    /**
     * Show the Load Markers UI with + buttons next to tracks
     * @private
     */

    /**
     * Полностью очищает каталог треков (используется для восстановления при проблемах)
     * @returns {Promise<boolean>} Успешность операции
    /**
     * Проверяет и исправляет ссылки на треки в базе данных
     * @private
     */


    /* FINAL2: onSaveCallback removed - dead broken residue, TS upload service owns this flow */

}

// Create global track catalog instance
const trackCatalog = new TrackCatalog(); 
window.trackCatalog = trackCatalog; 
