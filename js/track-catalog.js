/**
 * Track Catalog for Text application
 * Handles track storage and management
 */

class TrackCatalog {
    constructor() {
        this.tracks = [];
        this.currentTrackIndex = -1;
        this.rtfAdapter = new RtfParserAdapter(); // Добавлено
        
        this.catalogElement = document.getElementById('catalog-tracks');
        this.catalogContainer = document.getElementById('track-catalog');
        
        // Keep track of uploads in progress to prevent duplicates
        this.uploadInProgress = false;
        
        // Initialize IndexedDB
        this._initDatabase();
        
        // Initialize event listeners
        this._initEventListeners();
        
        // Load tracks from storage
        // this._loadTracks(); // Загрузка из localStorage теперь не нужна, т.к. грузим из DB
        
        // Проверяем флаг из редактора блоков и финализируем загрузку, если необходимо
        // Вызов _finalizeUploadFromBlockEditor перенесен в onsuccess _initDatabase
        // this._finalizeUploadFromBlockEditor(); 
        
        // Проверяем треки на проблемы через небольшую задержку, чтобы база успела проинициализироваться
        setTimeout(() => {
            this._checkForOrphanedTracks();
        }, 1000);
        
        console.log('TrackCatalog initialized');
    }
    
    _idbRequestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _idbTransactionToPromise(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error); 
        });
    }
    
    _initDatabase() {
        console.log('🔄 TrackCatalog: Начинаем инициализацию базы данных...');
        
        // 🎯 ДИАГНОСТИКА: Проверяем доступность IndexedDB
        if (!window.indexedDB) {
            console.error('❌ TrackCatalog: IndexedDB не поддерживается браузером');
            return;
        }
        
        console.log('✅ TrackCatalog: IndexedDB доступен, открываем базу данных...');
        
        // 🎯 СТАБИЛЬНАЯ БАЗА: используем постоянное имя и актуальную версию
        const dbName = (window.__DB_NAME || 'TextAppDB');
        this.dbName = dbName;
        const DB_VERSION = 6;
        console.log('🔄 TrackCatalog: Открываем стабильную базу:', dbName, 'v' + DB_VERSION);
        
        const request = indexedDB.open(dbName, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('❌ TrackCatalog: Database error:', event.target.error);
            console.error('❌ TrackCatalog: Error details:', event);
            
            // 🎯 Fallback 1: Пытаемся удалить проблемную базу и создать заново
            try {
                console.warn('TrackCatalog: Пробуем пересоздать стабильную базу...');
                const del = indexedDB.deleteDatabase(dbName);
                del.onsuccess = () => {
                    console.log('TrackCatalog: Стабильная база удалена, создаем заново...');
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
                        console.log('✅ TrackCatalog: Стабильная база пересоздана');
                        this._loadTracksFromDB();
                        this._finalizeUploadFromBlockEditor();
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
                            console.log('✅ TrackCatalog: Recovery база готова');
                            this._loadTracksFromDB();
                            this._finalizeUploadFromBlockEditor();
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
                        console.log('✅ TrackCatalog: Recovery база готова');
                        this._loadTracksFromDB();
                        this._finalizeUploadFromBlockEditor();
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
            console.log('🔄 TrackCatalog: onupgradeneeded triggered');
            this.db = event.target.result;
            
            // Создаем/мигрируем stores
            if (!this.db.objectStoreNames.contains('tracks')) {
                const trackStore = this.db.createObjectStore('tracks', { keyPath: 'id' });
                trackStore.createIndex('title', 'title', { unique: false });
                console.log('✅ TrackCatalog: Object store "tracks" created.');
            }
            if (!this.db.objectStoreNames.contains('app_state')) {
                this.db.createObjectStore('app_state', { keyPath: 'key' });
                console.log('✅ TrackCatalog: Object store "app_state" created.');
            }
            if (!this.db.objectStoreNames.contains('temp_audio_files')) {
                this.db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                console.log('✅ TrackCatalog: Object store "temp_audio_files" created.');
            }
            if (!this.db.objectStoreNames.contains('my_music')) {
                this.db.createObjectStore('my_music', { keyPath: 'trackId' });
                console.log('✅ TrackCatalog: Object store "my_music" created.');
            }
        };
        
        request.onsuccess = (event) => {
            this.db = event.target.result;
            console.log('✅ TrackCatalog: База данных успешно инициализирована');
            console.log('✅ TrackCatalog: Database name:', this.db.name);
            console.log('✅ TrackCatalog: Database version:', this.db.version);
            
            // Load tracks from database
            this._loadTracksFromDB();

            // Теперь вызываем финализацию здесь, когда this.db точно инициализирована
            this._finalizeUploadFromBlockEditor(); 
        };
    }
    
    _initEventListeners() {
        // Catalog open/close buttons
        const catalogBtn = document.getElementById('catalog-btn');
        const closeBtn = document.getElementById('close-catalog');
        const clearBtn = document.getElementById('clear-catalog');
        
        catalogBtn.addEventListener('click', () => {
            if (window.catalogV2) {
                window.catalogV2.open();
            } else {
                console.error('CatalogV2 is not initialized');
                // Fallback to old catalog if new one is not available
            this.openCatalog();
            }
        });
        
        closeBtn.addEventListener('click', () => {
            this.closeCatalog();
        });
        
        // Кнопка очистки каталога
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                await this.clearAllTracks();
            });
        }
        
        // Upload button
        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.addEventListener('click', () => {
            if (!this.uploadInProgress) {
                this._handleTrackUpload();
            }
        });
        
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
                    this._importMarkersFromFile(file);
                } else {
                    importFileName.textContent = 'No file selected';
                }
            });
        }
        
        // Create and set up Load Markers button
        this._setupLoadMarkersButton();
        
        // Previous/Next track buttons
        const prevBtn = document.getElementById('prev-track');
        const nextBtn = document.getElementById('next-track');
        
        if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            this.playPreviousTrack();
        });
        }
        
        if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            this.playNextTrack();
        });
        }
        
        // Initialize drag and drop for all upload areas
        this._initDragAndDrop('instrumental');
        this._initDragAndDrop('vocals');
        this._initDragAndDrop('lyrics');
        
        // Listen for track navigation shortcuts
        document.addEventListener('keydown', this._handleKeyboardNavigation.bind(this));
        
        // Listen for marker save events
        document.addEventListener('save-track-markers', (event) => {
            if (event.detail && event.detail.trackId && event.detail.markers) {
                this.saveMarkersToTrack(event.detail.trackId, event.detail.markers);
            }
        });
        
        // Убрано: автоматическое открытие каталога после закрытия Sync
        // Пользователь сам решает когда открыть каталог
        // document.addEventListener('sync-editor-closed', () => {
        //     console.log('TrackCatalog: sync-editor-closed event received!');
        //     console.log('TrackCatalog: About to call openCatalog with 200ms delay');
        //     // Небольшая задержка для плавности переходов
        //     setTimeout(() => {
        //         console.log('TrackCatalog: Now calling openCatalog()');
        //         this.openCatalog();
        //     }, 200);
        // });
    }
    
    _initDragAndDrop(type) {
        const dropzone = document.getElementById(`${type}-dropzone`);
        if (!dropzone) {return;}
        
        const fileInput = document.getElementById(`${type}-upload`);
        
        // Handle file input change event
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                // Visual feedback
                dropzone.classList.add('file-selected');
                dropzone.querySelector('.dropzone-content').innerHTML = `
                    <div class="icon">✓</div>
                    <p>${fileInput.files[0].name}</p>
                `;
            } else {
                // Reset visual state if no file selected
                this._resetDropzone(type);
            }
        });
        
        // Handle drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        // Add/remove highlight class
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => {
                dropzone.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => {
                dropzone.classList.remove('dragover');
            }, false);
        });
        
        // Handle dropped files
        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files && files.length > 0) {
                fileInput.files = files; // Assign dropped files to the input
                
                // Trigger change event manually (since files were set programmatically)
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            }
        }, false);
    }
    
    _resetDropzone(type) {
        const dropzone = document.getElementById(`${type}-dropzone`);
        if (!dropzone) {return;}
        
        dropzone.classList.remove('file-selected');
        
        // Set icon based on type
        let icon = '📄';
        let text = 'Drop file';
        
        if (type === 'instrumental') {
            icon = '🎹';
            text = 'Drop track file';
        } else if (type === 'vocals') {
            icon = '🎤';
            text = 'Drop vocals file';
        } else if (type === 'lyrics') {
            icon = '📝';
            text = 'Drop text file';
        }
        
        dropzone.querySelector('.dropzone-content').innerHTML = `
            <div class="icon">${icon}</div>
            <p>${text}</p>
        `;
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
                console.log(`TrackCatalog: Loaded ${this.tracks.length} tracks from DB`);
                if (this.tracks.length === 0) {
                    await this._tryMigrateFromFallbackDBs();
                    // reload
                    try {
                        const tx2 = this.db.transaction(['tracks'], 'readonly');
                        const st2 = tx2.objectStore('tracks');
                        const rq2 = st2.getAll();
                        await new Promise((res, rej) => { rq2.onsuccess = res; rq2.onerror = rej; });
                        this.tracks = rq2.result || [];
                        console.log(`TrackCatalog: After migrate loaded ${this.tracks.length} tracks`);
                    } catch (e) { console.warn('TrackCatalog: reload after migrate failed', e); }
                }
                this._renderTrackList();
            };
            req.onerror = (e) => {
                console.error('TrackCatalog: Failed to load tracks from DB', e);
            };
        } catch (e) {
            console.error('TrackCatalog: Unexpected error while loading tracks', e);
        }
    }

    async _tryMigrateFromFallbackDBs() {
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
                console.log(`📦 TrackCatalog: Migrating ${oldTracks.length} tracks from ${name}`);
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
    
    async _handleTrackUpload() {
        // Prevent multiple uploads at once
        if (this.uploadInProgress) {
            console.log('Upload already in progress, ignoring duplicate request');
            return;
        }
        
        console.log('Starting track upload process');
        this.uploadInProgress = true;
        
        // Disable upload button during processing
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Processing...';
        }
        
        const instrumentalInput = document.getElementById('instrumental-upload');
        const vocalsInput = document.getElementById('vocals-upload');
        const lyricsInput = document.getElementById('lyrics-upload');
        
        // Check if instrumental file is selected
        if (!instrumentalInput.files || instrumentalInput.files.length === 0) {
            alert('Please select an instrumental track file');
            this.uploadInProgress = false;
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Track';
            }
            return;
        }
        
        try {
            // Read instrumental file
            const instrumentalFile = instrumentalInput.files[0];
            const instrumentalArrayBuffer = await this._readAudioFile(instrumentalFile);
            
            // Read vocals file if provided
            let vocalsArrayBuffer = null;
            let vocalsType = null;
            if (vocalsInput.files && vocalsInput.files.length > 0) {
                vocalsArrayBuffer = await this._readAudioFile(vocalsInput.files[0]);
                vocalsType = vocalsInput.files[0].type;
            }
            
            // Read lyrics file if provided
            let lyricsText = '';
            if (lyricsInput.files && lyricsInput.files.length > 0) {
                const lyricsFile = lyricsInput.files[0];
                
                if (!this._isLikelyTextFile(lyricsFile)) {
                    console.error('File does not appear to be a text file:', lyricsFile.name);
                    alert('The selected lyrics file does not appear to be a text file. Please select a .txt, .lrc, or .rtf file.');
                    this.uploadInProgress = false;
                    if (uploadBtn) {
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Upload Track';
                    }
                    return;
                }
                
                try {
                    const rawContent = await this._readTextFile(lyricsFile);
                    console.log('Raw lyrics content (first 100 chars):', rawContent.substring(0, 100));

                    // Создаем объект трека заранее для сохранения оригинального контента
                    const trackData = {
                        title: instrumentalFile.name.replace(/\.[^/.]+$/, '').replace(/^(\d+[\s.-]+)/, ''),
                        instrumentalData: instrumentalArrayBuffer,
                        instrumentalType: instrumentalFile.type,
                        vocalsData: vocalsArrayBuffer,
                        vocalsType: vocalsType,
                        lyricsFileName: lyricsFile.name,
                        dateAdded: new Date().toISOString(),
                        // Сохраняем оригинальный контент для ВСЕХ типов файлов
                        lyricsOriginalContent: rawContent,
                    };

                    // Проверяем, есть ли RTF файл
                    if (lyricsFile.name.toLowerCase().endsWith('.rtf')) {
                        console.log('Обнаружен RTF файл:', lyricsFile.name);
                        
                        try {
                            // Проверяем наличие RtfParserAdapter (он поддерживает оба парсера)
                            if (typeof RtfParserAdapter !== 'undefined') {
                                console.log('Используем RtfParserAdapter для парсинга RTF');
                                lyricsText = await RtfParserAdapter.parse(rawContent);
                            }
                            // Далее проверяем наличие EnhancedRtfProcessor
                            else if (typeof EnhancedRtfProcessor !== 'undefined') {
                                console.log('Используем EnhancedRtfProcessor для парсинга RTF');
                                lyricsText = await EnhancedRtfProcessor.parse(rawContent);
                            }
                            // Наконец проверяем наличие стандартного RtfParser
                            else if (typeof RtfParser !== 'undefined') {
                                console.log('Используем стандартный RtfParser для парсинга RTF');
                                lyricsText = RtfParser.parse(rawContent);
                            }
                            // Если ни один из парсеров не доступен, используем наш метод
                            else {
                                console.log('Специализированные RTF парсеры недоступны, используем универсальный метод');
                                lyricsText = this._extractStructuredTextFromRtf(rawContent);
                            }
                            
                            // Проверяем качество парсинга
                            if (!lyricsText || lyricsText.trim().length < 20) {
                                console.log('Результат парсинга RTF неудовлетворительный, пробуем запасные методы');
                                
                                // Пробуем извлечь структурированный текст нашим методом
                                let extractedText = this._extractStructuredTextFromRtf(rawContent);
                                
                                if (!extractedText || extractedText.trim().length < 20) {
                                    // Если структурированный текст не найден, используем базовую очистку
                                    extractedText = this._cleanupEnglishRtfContent(rawContent);
                                }
                                
                                if (extractedText && extractedText.trim().length > 0) {
                                    lyricsText = extractedText;
                                }
                            }
                        }
                        catch (rtfError) {
                            console.error('Ошибка при парсинге RTF:', rtfError);
                            
                            // Пробуем извлечь текст запасным методом
                            lyricsText = this._extractStructuredTextFromRtf(rawContent);
                            
                            // Если и это не помогло, сохраняем ошибку и оригинальный контент
                            if (!lyricsText || lyricsText.trim().length === 0) {
                                lyricsText = "Не удалось извлечь текст из RTF файла. Пожалуйста, редактируйте вручную.";
                                trackData.processingError = rtfError.message || "Неизвестная ошибка парсинга RTF";
                            }
                        }
                    } 
                    else {
                        // Обычная обработка не-RTF текстов
                        // Оригинальный контент уже сохранен выше
                        lyricsText = this._cleanupPlainText(rawContent, lyricsFile.name);
                    }

                    // Проверка на пустой результат
                    if (!lyricsText || lyricsText.trim().length === 0) {
                        console.warn('Не удалось извлечь текст из файла:', lyricsFile.name);
                        lyricsText = "Не удалось извлечь текст из файла. Пожалуйста, редактируйте вручную.";
                    }
                    
                    // Добавляем текст в объект трека
                    trackData.lyrics = lyricsText;
                    
                    console.log(`Успешно обработан текст (${lyricsText.length} символов):`);
                    console.log(lyricsText.substring(0, 100) + '...');
                    
                    // <<< НАЧАЛО ИЗМЕНЕНИЙ ДЛЯ РЕДАКТОРА БЛОКОВ >>>
                    try {
                        const tempAudioId = Date.now().toString();
                        const audioDataToStore = {
                            id: tempAudioId,
                            instrumentalFile: {
                                data: instrumentalArrayBuffer,
                                type: instrumentalFile.type,
                                name: instrumentalFile.name
                            }
                        };
                        if (vocalsArrayBuffer && vocalsInput.files.length > 0) {
                            audioDataToStore.vocalsFile = {
                                data: vocalsArrayBuffer,
                                type: vocalsInput.files[0].type,
                                name: vocalsInput.files[0].name
                            };
                        }

                        const tx = this.db.transaction('temp_audio_files', 'readwrite');
                        const store = tx.objectStore('temp_audio_files');
                        const putRequest = store.put(audioDataToStore);
                        await this._idbRequestToPromise(putRequest);
                        await this._idbTransactionToPromise(tx);
                        console.log('Временные аудиоданные сохранены в IndexedDB с ID:', tempAudioId);

                        // Информация о треке для передачи в редактор и последующего сохранения
                        const trackInfoForEditor = {
                            title: trackData.title,
                            lyricsFileName: trackData.lyricsFileName,
                            lyricsOriginalContent: trackData.lyricsOriginalContent, // Может быть undefined
                            // Не передаем аудио буферы, они возьмутся из tempAudioId при сохранении
                            tempAudioId: tempAudioId // Сохраняем ID для доступа к аудио при финальном сохранении
                        };
                        
                        // Создаем или получаем экземпляр ModalBlockEditor
                        if (!window.modalBlockEditorInstance) {
                            window.modalBlockEditorInstance = new ModalBlockEditor();
                        }

                        const onSaveCallback = async (editedBlocks, savedTrackInfo) => {
                            console.log('ModalBlockEditor Save Callback Triggered. Blocks:', editedBlocks, 'TrackInfo:', savedTrackInfo);
                            try {
                                // Создаем полный объект для сохранения, объединяя информацию
                                const trackDataToSave = {
                                    ...savedTrackInfo,
                                    blocksData: editedBlocks,
                                    lyrics: this._convertBlocksToPlainText(editedBlocks), // Обновляем плоский текст
                                    lastModified: new Date().toISOString()
                                };
                                
                                // 🎯 ГЛАВНОЕ ИСПРАВЛЕНИЕ: Гарантируем наличие ID для новых треков
                                if (!trackDataToSave.id) {
                                    trackDataToSave.id = Date.now();
                                    console.log('TrackCatalog: Generated new ID for the track:', trackDataToSave.id);
                                }

                                // Извлекаем аудиоданные из временного хранилища
                                const tempAudioId = savedTrackInfo.tempAudioId;
                                if (tempAudioId) {
                                    try {
                                        const tx = this.db.transaction('temp_audio_files', 'readonly');
                                        const store = tx.objectStore('temp_audio_files');
                                        const getRequest = store.get(tempAudioId);
                                        const tempAudioData = await this._idbRequestToPromise(getRequest);
                                        
                                        if (tempAudioData) {
                                            trackDataToSave.instrumentalData = tempAudioData.instrumentalFile.data;
                                            trackDataToSave.instrumentalType = tempAudioData.instrumentalFile.type;
                                            if (tempAudioData.vocalsFile) {
                                                trackDataToSave.vocalsData = tempAudioData.vocalsFile.data;
                                                trackDataToSave.vocalsType = tempAudioData.vocalsFile.type;
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Ошибка при извлечении временных аудиоданных:', error);
                                    }
                                }

                                // Сохраняем трек в базу, ОЖИДАЯ полного завершения
                                const savedTrack = await this._saveTrackToDB(trackDataToSave);
                                console.log('TrackCatalog: Track saved to DB, result:', savedTrack);

                                // 🔄 ПРИНУДИТЕЛЬНО ПЕРЕЗАГРУЖАЕМ СПИСОК ТРЕКОВ ИЗ БД
                                await this._loadTracksFromDB();
                                console.log('TrackCatalog: Tracks reloaded from DB to include the new one.');

                                // 🎯 ИЩЕМ СОХРАНЕННЫЙ ТРЕК С НЕСКОЛЬКИМИ ПОПЫТКАМИ
                                let savedTrackFromArray = null;
                                let attempts = 0;
                                const maxAttempts = 3;
                                
                                while (!savedTrackFromArray && attempts < maxAttempts) {
                                    attempts++;
                                    console.log(`TrackCatalog: Attempt ${attempts} to find saved track with ID:`, savedTrack.id);
                                    
                                    savedTrackFromArray = this.tracks.find(track => track.id === savedTrack.id);
                                    
                                    if (!savedTrackFromArray && attempts < maxAttempts) {
                                        console.log('TrackCatalog: Track not found, waiting and reloading...');
                                        await new Promise(resolve => setTimeout(resolve, 200)); // Ждем 200мс
                                        await this._loadTracksFromDB(); // Перезагружаем еще раз
                                    }
                                }

                                if (!savedTrackFromArray) {
                                    console.error('TrackCatalog: Saved track not found in tracks array after', maxAttempts, 'attempts');
                                    // Все равно продолжаем с данными из БД
                                    savedTrackFromArray = savedTrack;
                                }

                                // Удаляем временные данные
                                if (tempAudioId) {
                                    try {
                                        const deleteTx = this.db.transaction('temp_audio_files', 'readwrite');
                                        const deleteStore = deleteTx.objectStore('temp_audio_files');
                                        const deleteRequest = deleteStore.delete(tempAudioId);
                                        await this._idbRequestToPromise(deleteRequest);
                                        await this._idbTransactionToPromise(deleteTx);
                                console.log('Временные аудиоданные удалены из IndexedDB после финального сохранения.');
                                    } catch (error) {
                                        console.warn('Не удалось удалить временные аудиоданные:', error);
                                    }
                                }
                                
                                // Формируем результат для возврата в ModalBlockEditor
                                const successResult = {
                                    success: true,
                                    trackId: savedTrack.id,
                                    title: savedTrack.title,
                                    blocksData: editedBlocks,
                                    duration: savedTrackFromArray.duration || null
                                };

                                // 🔄 СБРАСЫВАЕМ ФОРМУ ЗАГРУЗКИ ПОСЛЕ УСПЕШНОГО СОХРАНЕНИЯ
                                this._resetUploadForm();

                                console.log('TrackCatalog: onSaveCallback (in _handleTrackUpload) - RETURNING SUCCESS RESULT:', JSON.stringify(successResult, null, 2));
                                return successResult;

                            } catch (error) {
                                console.error('TrackCatalog: Error in onSaveCallback:', error);
                                throw error;
                            }
                        };

                        const onCancelCallback = async () => {
                            console.log('ModalBlockEditor Cancel Callback Triggered.');
                            // Удалить временные аудиоданные, если пользователь отменил редактирование
                            const delTx = this.db.transaction('temp_audio_files', 'readwrite');
                            await this._idbRequestToPromise(delTx.objectStore('temp_audio_files').delete(trackInfoForEditor.tempAudioId));
                            await this._idbTransactionToPromise(delTx);
                            console.log('Временные аудиоданные удалены из IndexedDB из-за отмены редактирования.');
                            this._resetUploadForm(); // Также сбрасываем форму загрузки
                        };

                        window.modalBlockEditorInstance.init(lyricsText, trackInfoForEditor, onSaveCallback, onCancelCallback);
                        
                        // ДОБАВЛЕНО: Автоматически закрываем каталог при открытии редактора блоков
                        this.closeCatalog();
                        
                        window.modalBlockEditorInstance.show();

                        // Старое перенаправление и localStorage удалены
                        // window.location.href = 'block_editor.html'; 
                        return; 

                    } catch (e) {
                        console.error('Ошибка при сохранении текста в localStorage или перенаправлении:', e);
                        // Продолжаем обычное сохранение, если что-то пошло не так с localStorage
                    }
                    // <<< КОНЕЦ ИЗМЕНЕНИЙ ДЛЯ РЕДАКТОРА БЛОКОВ >>>

                    // Сохраняем трек в базу данных
                    await this._saveTrackToDB(trackData);
                    
                } catch (error) {
                    console.error('Error reading or parsing lyrics file:', error);
                    alert('Error reading lyrics file. Check console for details.');
                    this.uploadInProgress = false;
                    if (uploadBtn) {
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Upload Track';
                    }
                    return;
                }
            } else {
                // Если текстовый файл не был выбран, создаем трек без текста
            const trackData = {
                    title: instrumentalFile.name.replace(/\.[^/.]+$/, '').replace(/^(\d+[\s.-]+)/, ''),
                instrumentalData: instrumentalArrayBuffer,
                instrumentalType: instrumentalFile.type,
                vocalsData: vocalsArrayBuffer,
                vocalsType: vocalsType,
                    lyrics: '',
                dateAdded: new Date().toISOString()
            };
            
                // Сохраняем трек в базу данных
                await this._saveTrackToDB(trackData);
            }
            
            // Reset form
            this._resetUploadForm();
            
        } catch (error) {
            console.error('Error processing audio file:', error);
            alert('Error processing audio file. Please try a different format.');
        } finally {
            // Re-enable upload button
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Track';
            }
            
            console.log('Track upload process completed');
            this.uploadInProgress = false;
        }
    }
    
    /**
     * Извлекает структурированный текст из RTF-файла с поддержкой русского языка
     * @param {string} rtfContent - Содержимое RTF-файла
     * @returns {string} Извлеченный текст
     * @private
     */
    _extractStructuredTextFromRtf(rtfContent) {
        console.log('Начинаем извлечение текста из RTF с поддержкой CP1251');
        
        if (!rtfContent || !rtfContent.startsWith('{\\rtf')) {
            console.warn('Неверный формат RTF');
            return '';
        }
        
        try {
            // Основная замена для сохранения разделителей блоков
            rtfContent = rtfContent.replace(/\\pard\\\s*\\pard/g, '\\par\\par'); // Захватываем разделители блоков
            
            // Специальная обработка кириллицы в RTF
            // CP1251 таблица соответствия символов для русских символов
            const cp1251Map = {
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
            
            // Удаляем RTF-заголовок и завершающую скобку
            let text = rtfContent.replace(/^.*\\fonttbl.*?(\{|\\)/s, '');
            text = text.replace(/}$/s, '');
            
            // Обрабатываем группы и скрытый текст
            text = text.replace(/\{\\[\*\w]+\s+[^{}]*\}/g, ''); // Удаляем группы специальных тегов
            
            // Заменяем экранированные символы CP1251 на соответствующие Unicode
            Object.keys(cp1251Map).forEach(code => {
                const regex = new RegExp('\\\\' + code, 'g');
                text = text.replace(regex, cp1251Map[code]);
            });
            
            // Заменяем Unicode-экранированные последовательности
            text = text.replace(/\\u([0-9]+)[\\'\s]?/g, (match, code) => {
                return String.fromCharCode(parseInt(code, 10));
            });
            
            // Обрабатываем основные RTF-команды
            text = text.replace(/\\par\b/g, '\n'); 
            text = text.replace(/\\line\b/g, '\n');
            
            // НОВЫЙ КОД: Заменяем двойные переносы с пробелами на двойные переносы
            text = text.replace(/(\n\s*)\n/g, '\n\n');
            
            // Удаляем одиночные переносы между строками
            text = text.replace(/([^\n])\n([^\n])/g, '$1 $2');
            
            // Восстанавливаем двойные переносы как разделители блоков
            text = text.replace(/(\n{2,})/g, '\n\n');
            
            // Удаляем команды форматирования
            text = text.replace(/\\[a-z0-9]+[-]?\d*/g, ''); // Общие команды
            text = text.replace(/\\[a-z0-9]+/g, ''); // Команды без параметров
            text = text.replace(/[{}]/g, ''); // Фигурные скобки
            
            // Заменяем экранированные символы
            text = text.replace(/\\\\/g, '\\'); // Обратная косая черта
            text = text.replace(/\\{/g, '{'); // Открывающая скобка
            text = text.replace(/\\}/g, '}'); // Закрывающая скобка
            text = text.replace(/\\\'/g, '\''); // Апостроф
            
            // Нормализуем пробелы
            text = text.replace(/[ \t]+/g, ' ');
            text = text.replace(/\n{3,}/g, '\n\n');
            
            console.log(`Извлечено ${text.length} символов из RTF`);
            return text.trim();
        } catch (error) {
            console.error('Ошибка извлечения текста из RTF:', error);
            // В случае ошибки возвращаем очищенный от RTF-команд текст
            return rtfContent.replace(/\{\\rtf[^}]*\}/g, '').replace(/\\[a-z0-9]+/g, '').trim();
        }
    }
    
    /**
     * Универсальный метод очистки английского RTF контента
     * @param {string} text - RTF контент
     * @returns {string} Очищенный текст
     * @private
     */
    _cleanupEnglishRtfContent(text) {
        if (!text || text.trim().length === 0) {
            return '';
        }
        
        // Удаляем RTF-разметку
        let cleanedText = text
            .replace(/\\[a-z0-9]+\s?/g, ' ')   // Удаляем RTF команды
            .replace(/[{}\\]/g, ' ')           // Удаляем скобки и слеши
            .replace(/\s+/g, ' ')              // Нормализуем пробелы
            .trim();
            
        // Если текст слит в одну строку, пытаемся разделить его на осмысленные части
        if (!cleanedText.includes('\n') || cleanedText.split('\n').length < 3) {
            // Добавляем разрывы строк в типичных местах для песен
            cleanedText = cleanedText
                .replace(/\s+([A-Z][a-z][a-z])/g, '\n$1')         // Новая строка перед словами с заглавной буквы
                .replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2')        // Двойной перенос после конца предложения
                .replace(/([,:])\s+([A-Z])/g, '$1\n$2')          // Перенос после запятой или двоеточия и заглавной буквы
                .replace(/(\b(?:And|But|When|If|So|The|You|I|We|They)\b)/g, '\n$1');  // Перенос перед типичными началами строк
        }
        
        // Удаляем слишком короткие строки и строки с RTF-остатками
        const lines = cleanedText.split('\n')
            .map(line => line.trim())
            .filter(line => 
                line.length > 3 && 
                !/^\\/.test(line) && 
                !/^\d+$/.test(line)
            );
            
        // Если получилось меньше 3 строк, возможно мы потеряли структуру
        if (lines.length < 3) {
            // Последняя попытка разбить на строки по словесным шаблонам
            const words = cleanedText.split(/\s+/).filter(w => w.length > 1);
            
            if (words.length > 20) {
                const resultLines = [];
                // Группируем по ~7 слов в строку для более естественной структуры песни
                for (let i = 0; i < words.length; i += 7) {
                    const line = words.slice(i, Math.min(i + 7, words.length)).join(' ');
                    if (line.length > 5) {
                        resultLines.push(line);
                    }
                }
                
                // Добавляем пустые строки между каждыми 4 строками (примерно куплет)
                const finalText = [];
                for (let i = 0; i < resultLines.length; i++) {
                    finalText.push(resultLines[i]);
                    if ((i + 1) % 4 === 0 && i < resultLines.length - 1) {
                        finalText.push('');
                    }
                }
                
                return finalText.join('\n');
            }
            
            return cleanedText; // Возвращаем очищенный текст без разбивки
        }
        
        return lines.join('\n');
    }
    
    /**
     * Perform cleanup on plain text content
     * @param {string} text - Text to cleanup
     * @param {string} [fileName] - Optional filename to help identify the format
     * @returns {string} Cleaned text
     * @private
     */
    _cleanupPlainText(text, fileName) {
        if (!text || text.trim().length === 0) {
            return '';
        }
        
        // Проверяем, может ли это быть RTF, который не был правильно идентифицирован
        if (text.startsWith('{\\rtf')) {
            console.log('Обнаружен RTF-формат в обычном тексте, применяем специальную обработку');
            return this._extractStructuredTextFromRtf(text);
        }
        
        // Проверяем на наличие BOM-маркера и удаляем его
        let cleanedText = text;
        if (text.charCodeAt(0) === 0xFEFF) {
            console.log('BOM маркер обнаружен и удален');
            cleanedText = text.slice(1);
        }
        
        // Нормализация переводов строк
        cleanedText = cleanedText.replace(/\r\n|\r/g, '\n');
        
        // Для русских текстов часто используется '0' как разделитель строк в некоторых форматах
        if (/[А-Яа-я]/.test(cleanedText)) {
            console.log('Обнаружен русский текст, применяем специальную обработку разделителей');
            
            // Обработка '0' как разделителя строк для русских текстов
            cleanedText = cleanedText.replace(/([А-Яа-яA-Za-z,.!?:;)»]+)0\s*([А-Яа-яA-Za-z«(])/g, '$1\n$2'); // Между предложениями
            cleanedText = cleanedText.replace(/([А-Яа-яA-Za-z])0([А-Яа-яA-Za-z])/g, '$1 $2'); // Между словами
            cleanedText = cleanedText.replace(/(\S)0(\s)/g, '$1\n$2'); // В конце строки
            cleanedText = cleanedText.replace(/(\s)0(\S)/g, '$1\n$2'); // В начале строки
            cleanedText = cleanedText.replace(/\b0\b/g, '\n'); // Отдельный символ '0'
        
        // Особые шаблоны для случаев с -0 как разделителем строк
            cleanedText = cleanedText.replace(/\s-0\s/g, '\n');
            cleanedText = cleanedText.replace(/([а-яА-Я])-0\s/g, '$1\n');
            cleanedText = cleanedText.replace(/\s-0([а-яА-Я])/g, '\n$1');
        }
        
        // Удаление остатков RTF-форматирования
        cleanedText = cleanedText.replace(/\\[a-z0-9]+/g, '');
        cleanedText = cleanedText.replace(/[{}\\\[\]]/g, '');
        
        // HTML-теги тоже могут встречаться в текстах
        if (cleanedText.includes('<') && cleanedText.includes('>')) {
            cleanedText = cleanedText.replace(/<[^>]*>/g, '');
        }
        
        // Стандартизация маркеров для русских песен
        cleanedText = cleanedText.replace(/\[припев\]/gi, '\n[Припев]\n');
        cleanedText = cleanedText.replace(/\[проигрыш\]/gi, '\n[Проигрыш]\n');
        cleanedText = cleanedText.replace(/\[куплет\s*\d*\]/gi, (match) => `\n${match}\n`);
        
        // Удаление множественных пробелов и пустых строк
        cleanedText = cleanedText.replace(/[ \t]+/g, ' ');
        cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
        
        // Удаление строк только с цифрами или символами
        const lines = cleanedText.split('\n');
        const filteredLines = lines.filter(line => {
            const trimmed = line.trim();
            // Оставляем строки с хотя бы одной буквой или специальными маркерами
            return trimmed.length > 0 && 
                (/[A-Za-zА-Яа-я]/.test(trimmed) || 
                 /\[(припев|проигрыш|куплет|intro|outro|solo|бридж)\b/i.test(trimmed));
        });
        
        return filteredLines.join('\n').trim();
    }
    
    _resetUploadForm() {
        // Clear file inputs
        document.getElementById('instrumental-upload').value = '';
        document.getElementById('vocals-upload').value = '';
        document.getElementById('lyrics-upload').value = '';
        
        // Reset dropzones
        this._resetDropzone('instrumental');
        this._resetDropzone('vocals');
        this._resetDropzone('lyrics');
    }
    
    _isLikelyTextFile(file) {
        // Max size for text files
        const MAX_TEXT_SIZE = 2 * 1024 * 1024; // 2MB
        
        // Check file size first
        if (file.size > MAX_TEXT_SIZE) {
            console.log(`File ${file.name} exceeds maximum text file size (${MAX_TEXT_SIZE} bytes)`);
            return false;
        }
        
        // Check file extension for common text formats
        const fileName = file.name.toLowerCase();
        const textExtensions = ['.txt', '.lrc', '.json', '.rtf', '.doc', '.srt', '.vtt', '.sub', '.sbv'];
        
        for (const ext of textExtensions) {
            if (fileName.endsWith(ext)) {
                console.log(`File ${file.name} has valid text extension: ${ext}`);
                return true;
            }
        }
        
        // Check MIME type for text content
        const textMimeTypes = [
            'text/plain', 'text/rtf', 'application/rtf', 
            'text/json', 'application/json', 
            'text/html', 'text/xml', 'application/xml',
            'text/vtt', 'text/srt', 'application/x-subrip'
        ];
        
        if (file.type && textMimeTypes.includes(file.type)) {
            console.log(`File ${file.name} has valid text MIME type: ${file.type}`);
            return true;
        }
        
        // If no extension or MIME type match, check the first few bytes
        // This will be handled in the _readTextFile method by trying to read as text
        
        console.log(`File ${file.name} doesn't appear to be a text file. Type: ${file.type}`);
        return false;
    }
    
    async _saveTrackToDB(trackData) {
            if (!this.db) {
            console.error('Database not initialized, cannot save track.');
            throw new Error('Database not initialized.');
        }

        const transaction = this.db.transaction(['tracks'], 'readwrite');
        const objectStore = transaction.objectStore('tracks');
        const trackToStore = { ...trackData };

        // Если у трека еще нет ID, это новая запись.
        const isNewTrack = !trackToStore.id;
        const request = isNewTrack ? objectStore.add(trackToStore) : objectStore.put(trackToStore);

        return new Promise((resolve, reject) => {
            request.onerror = (event) => {
                console.error('Error in request while saving track to DB:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                // Если это была новая запись, добавляем ID в объект
                if (isNewTrack) {
                    trackToStore.id = event.target.result;
                }
                console.log(`Track request successful, ID: ${trackToStore.id}`);
            };

            transaction.onerror = (event) => {
                console.error('Error in transaction while saving track:', event.target.error);
                reject(event.target.error);
            };

            transaction.oncomplete = () => {
                console.log(`Transaction completed successfully for track: ${trackToStore.title}`);
                // Возвращаем обновленный объект trackToStore ПОСЛЕ завершения транзакции
                resolve(trackToStore);
            };
        });
    }
    
    async _readAudioFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = (error) => {
                reject(error);
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    deleteTrack(id) {
        if (!this.db || id === undefined) {return;}
        
        const transaction = this.db.transaction(['tracks'], 'readwrite');
        const store = transaction.objectStore('tracks');
        const request = store.delete(id);
        
        request.onsuccess = () => {
            // Удаляем трек из локального массива this.tracks
            const deletedIndex = this.tracks.findIndex(track => track.id === id);
            
            // Если трек найден, удаляем его из массива
            if (deletedIndex !== -1) {
                console.log(`Удаляем трек с ID ${id} из локального массива tracks`);
                this.tracks.splice(deletedIndex, 1);
                
                // Если удаленный трек был текущим, останавливаем воспроизведение
            if (deletedIndex === this.currentTrackIndex) {
                if (window.audioEngine) {
                    audioEngine.stop();
                }
                this.currentTrackIndex = -1;
            } else if (deletedIndex < this.currentTrackIndex) {
                // Adjust current track index if a track before it was deleted
                this.currentTrackIndex--;
            }
            
                // Очищаем возможные ссылки на удаленный трек
                if (window.waveformEditor && window.waveformEditor.currentTrackId === id) {
                    window.waveformEditor.currentTrackId = null;
                    window.waveformEditor.lastLoadedFile = null;
                }
                
                // Обновляем UI каталога
                this._renderTrackList();
                
                // Если треков больше нет, показываем приветственный экран
                if (this.tracks.length === 0 && window.app) {
                    window.app._showWelcomeIfNoTracks();
                }
                
                console.log(`Трек успешно удален. Осталось треков: ${this.tracks.length}`);
            } else {
                console.warn(`Трек с ID ${id} не найден в локальном массиве`);
                // Перезагружаем треки из базы данных для синхронизации состояния
            this._loadTracksFromDB();
            }
        };
        
        request.onerror = (event) => {
            console.error('Error deleting track:', event.target.error);
            alert('Ошибка при удалении трека');
        };
    }
    
    /**
     * Read a text file for import operations
     * @private
     * @param {File} file - File to read
     * @returns {Promise<string>} Promise resolving to file content
     */
    _readImportFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsText(file);
        });
    }
    
    /**
     * Read a text file and return its contents
     * @param {File} file - The file to read
     * @returns {Promise<string>} Promise resolving to file contents
     */
    async _readTextFile(file) { // Сделаем метод async, так как processLyricsText асинхронный
        return new Promise(async (resolve, reject) => { // Добавим async для Promise executor
            const reader = new FileReader();
            
            reader.onload = async (event) => { // Сделаем и этот обработчик async
                try {
                    let content = event.target.result;
                    
                    if (content.charCodeAt(0) === 0xFEFF) {
                        console.log('BOM detected: true');
                        content = content.substring(1);
                    } else {
                        console.log('BOM detected: false');
                    }
                    
                    // Вызываем нашу новую функцию обработки
                    const processedContent = await this.processLyricsText(file.name, content, this.rtfAdapter);
                    resolve(processedContent);
                } catch (e) {
                    console.error('Error during text file processing or BOM removal:', e);
                    reject(e);
                }
            };
            
            reader.onerror = function(event) {
                console.error('FileReader error for file:', file.name, event);
                reject(new Error('Error reading file: ' + file.name));
            };
            
                reader.readAsText(file, 'UTF-8');
        });
    }
    
    _renderTrackList() {
        if (!this.catalogElement) {return;}
        
        // Clear catalog element
        this.catalogElement.innerHTML = '';
        
        if (this.tracks.length === 0) {
            this.catalogElement.innerHTML = '<div class="no-tracks">No tracks added yet.</div>';
            return;
        }
        
        // Add tracks to catalog
        this.tracks.forEach((track, index) => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.dataset.index = index;
            trackElement.dataset.id = track.id;
            
            if (index === this.currentTrackIndex) {
                trackElement.classList.add('current-track');
            }
            
            const deleteBtnHtml = (window.__ADMIN__ ? `<button class="delete-track" data-id="${track.id}">Delete</button>` : '');
            trackElement.innerHTML = `
                <div class="track-title">${track.title}</div>
                <div class="track-info">
                    <span>${track.vocalsData ? 'Track + Vocals' : 'Track Only'}</span>
                    <span>${track.lyrics ? 'Has Lyrics' : 'No Lyrics'}</span>
                    <button class="import-track-markers" data-id="${track.id}" title="Добавить JSON маркеров">+ JSON</button>
                    ${deleteBtnHtml}
                </div>
            `;
            
            // Add click event for track selection
            trackElement.addEventListener('click', (e) => {
                // Don't select the track if buttons were clicked
                if (e.target.classList.contains('delete-track') || 
                    e.target.classList.contains('import-track-markers')) {
                    return;
                }
                
                this.loadTrack(index);
                this.closeCatalog();
            });
            
            this.catalogElement.appendChild(trackElement);
        });
        
        // Add event listeners for delete buttons
        const deleteButtons = this.catalogElement.querySelectorAll('.delete-track');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent track selection
                const trackId = parseInt(button.dataset.id);
                if (confirm('Are you sure you want to delete this track?')) {
                    this.deleteTrack(trackId);
                }
            });
        });

        // Add event listeners for per-track JSON import
        const importButtons = this.catalogElement.querySelectorAll('.import-track-markers');
        importButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackId = parseInt(button.dataset.id);
                this._importMarkersForSpecificTrack(trackId);
            });
        });
    }
    
    async loadTrack(index, options = {}) {
        if (index < 0 || index >= this.tracks.length) {return;}
        
        const prevTrackId = (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.tracks.length)
            ? (this.tracks[this.currentTrackIndex] && this.tracks[this.currentTrackIndex].id) : null;
        const track = this.tracks[index];
        this.currentTrackIndex = index;

        // Единый сигнал о смене трека — чтобы компоненты очистились до загрузки нового
        try {
            document.dispatchEvent(new CustomEvent('before-track-change', { detail: { fromTrackId: prevTrackId, toTrackId: track.id } }));
        } catch(_) {}

        // Жёсткая очистка текста/поезда во избежание "смешанных" блоков
        try { if (window.app && window.app.blockLoopControl) { window.app.blockLoopControl.deactivate(); } } catch(_) {}
        try { if (window.lyricsDisplay && typeof window.lyricsDisplay.clearAllTextBlocks === 'function') { window.lyricsDisplay.clearAllTextBlocks(); } } catch(_) {}
        try { if (window.lyricsDisplay && typeof window.lyricsDisplay.fullReset === 'function') { window.lyricsDisplay.fullReset(); } } catch(_) {}

        // ПОКАЗЫВАЕМ ИНДИКАТОР ЗАГРУЗКИ
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {loadingOverlay.classList.remove('hidden');}

        console.log(`🔄 Loading track: "${track.title}"`);
        console.time('⏱️ TOTAL_TRACK_LOAD_TIME'); // Диагностика общего времени

        // КРИТИЧНО: Выполняем полный сброс состояния перед загрузкой нового трека
        console.time('⏱️ HARD_RESET_TIME'); // Диагностика времени сброса
        if (window.stateManager) {
            await window.stateManager.performHardReset();
            await window.stateManager.waitForComponentsReady();
        } else {
            console.warn('⚠️ StateManager not available, proceeding without hard reset');
        }
        console.timeEnd('⏱️ HARD_RESET_TIME');

        // Update WaveformEditor with the current track ID
        if (window.waveformEditor) {
            window.waveformEditor.currentTrackId = track.id;
            // Также устанавливаем имя последнего загруженного файла, если оно есть
            if (track.lyricsFileName) {
                window.waveformEditor.lastLoadedFile = track.lyricsFileName;
                console.log(`TrackCatalog: Set waveformEditor.lastLoadedFile to ${track.lyricsFileName}`);
            } else {
                window.waveformEditor.lastLoadedFile = track.title; // Используем имя трека, если имя файла недоступно
            }
            console.log(`TrackCatalog: Set waveformEditor.currentTrackId to ${track.id}`);
        }

        // КРИТИЧНО: Подготавливаем данные для рендеринга, но НЕ РЕНДЕРИМ сразу
        console.time('⏱️ LYRICS_PREPARE_TIME'); // Диагностика подготовки текста
        if (track.blocksData && Array.isArray(track.blocksData) && track.blocksData.length > 0 && window.lyricsDisplay) {
            console.log(`TrackCatalog: Found ${track.blocksData.length} blocks. Preparing them for rendering after audio load.`);
            // ЗАГРУЖАЕМ БЛОКИ БЕЗ РЕНДЕРИНГА (false вместо true)
            await window.lyricsDisplay.loadImportedBlocks(track.blocksData, false);
        } else if (window.lyricsDisplay) {
             // Если блоков нет, подготавливаем стандартную обработку текста
            console.log(`TrackCatalog: No blocks found for "${track.title}". Preparing text for processing.`);
            if (track.lyrics || track.lyricsOriginalContent) {
                 let textToProcess = track.lyricsOriginalContent || track.lyrics;
                 // Подготавливаем текст БЕЗ рендеринга
                 await window.lyricsDisplay.reloadLyrics(textToProcess, track.duration, false);
            } else {
                 // Если нет ни блоков, ни текста
                 await window.lyricsDisplay.reloadLyrics('', track.duration, false);
            }
        }
        console.timeEnd('⏱️ LYRICS_PREPARE_TIME');
        
        // Load blob URLs from stored data. This part is independent of lyrics processing.
        console.time('⏱️ BLOB_CREATION_TIME'); // Диагностика создания blob
        const instrumentalBlob = new Blob([track.instrumentalData], { type: track.instrumentalType });
        const instrumentalUrl = URL.createObjectURL(instrumentalBlob);
        
        let vocalsUrl = null;
        if (track.vocalsData) {
            const vocalsBlob = new Blob([track.vocalsData], { type: track.vocalsType });
            vocalsUrl = URL.createObjectURL(vocalsBlob);
        }
        console.timeEnd('⏱️ BLOB_CREATION_TIME');
        
        // КРИТИЧНО: Загружаем аудио и ТОЛЬКО ПОСЛЕ ЭТОГО рендерим текст
        console.time('⏱️ AUDIO_LOAD_TIME'); // Диагностика загрузки аудио
        try {
            const result = await audioEngine.loadTrack(instrumentalUrl, vocalsUrl);
            console.timeEnd('⏱️ AUDIO_LOAD_TIME');
            
                    // Load sync markers if available
                    if (track.syncMarkers && track.syncMarkers.length > 0) {
                        console.log(`Loading ${track.syncMarkers.length} markers for track ${track.title}`);
                        
                        // Dispatch event to load markers in MarkerManager
                        const event = new CustomEvent('track-loaded', {
                            detail: {
                                markers: track.syncMarkers
                            }
                        });
                        document.dispatchEvent(event);
                    } else {
                        console.log(`No markers available for track ${track.title}`);
                        // Reset any existing markers
                        const event = new CustomEvent('track-loaded', {
                            detail: {
                                markers: []
                            }
                        });
                        document.dispatchEvent(event);
                    }
                    
            // КРИТИЧНО: ТЕПЕРЬ рендерим текст с правильными стилями
            console.time('⏱️ FINAL_RENDER_TIME'); // Диагностика финального рендеринга
            setTimeout(() => {
                if (window.stateManager) {
                    window.stateManager.forceTextRerender();
                }
                // После финального рендера — доп.санитизация блоков (устранить «пустые/смешанные»)
                try {
                    if (window.lyricsDisplay && Array.isArray(window.lyricsDisplay.textBlocks)) {
                        const sanitized = window.lyricsDisplay._sanitizeBlocks(window.lyricsDisplay.textBlocks);
                        window.lyricsDisplay.textBlocks = sanitized;
                    }
                } catch(_) {}
                console.timeEnd('⏱️ FINAL_RENDER_TIME');
                console.timeEnd('⏱️ TOTAL_TRACK_LOAD_TIME'); // Общее время загрузки
            }, 100); // Небольшая задержка для завершения всех операций
            
            // 🚀 АВТОПЛЕЙ: по опции
            if (options && options.autoplay) {
            console.log('🎵 АВТОПЛЕЙ: Запуск воспроизведения...');
            setTimeout(async () => {
                try {
                    await audioEngine.play();
                    console.log('✅ АВТОПЛЕЙ: Воспроизведение начато успешно');
                } catch (playError) {
                    console.warn('⚠️ АВТОПЛЕЙ: Не удалось запустить автоматическое воспроизведение:', playError);
                }
                }, 200);
            }
            
            // Update track list
            this._renderTrackList();

            // Отображаем WaveformEditor только если НЕ запрещено опциями
            const shouldOpenSync = !(options && options.openSyncEditor === false);
            if (shouldOpenSync && window.waveformEditor) {
                window.waveformEditor.show();
                // Нам нужен URL для загрузки в waveform-редактор
                const instrumentalUrl = track.instrumentalUrl || track.audioUrl;
                const vocalsUrl = track.vocalsUrl;

                // Используем безопасные URL из гибридного движка, если они уже подготовлены
                const instrumentalUrlForEditor = (audioEngine && audioEngine.hybridEngine && audioEngine.hybridEngine.instrumentalUrl) || instrumentalUrl;
                const vocalsUrlForEditor = (audioEngine && audioEngine.hybridEngine && audioEngine.hybridEngine.vocalsUrl) || vocalsUrl;

                if (instrumentalUrlForEditor || vocalsUrlForEditor) {
                    window.waveformEditor.loadDualWaveforms(instrumentalUrlForEditor, vocalsUrlForEditor)
                        .then(() => console.log('WaveformEditor: Обе дорожки успешно загружены.'))
                        .catch(error => console.error('TrackCatalog: Ошибка при загрузке двойных волновых форм:', error));
                }
            }

            console.log(`✅ Track "${track.title}" loaded successfully`);
            
        } catch (error) {
            console.timeEnd('⏱️ AUDIO_LOAD_TIME');
            console.timeEnd('⏱️ TOTAL_TRACK_LOAD_TIME');
            console.error('Error loading track:', error);
            alert('Error loading track. Please try again.');
        } finally {
            // ПРЯЧЕМ ИНДИКАТОР ЗАГРУЗКИ в любом случае
            if (loadingOverlay) {loadingOverlay.classList.add('hidden');}
        }
    }
    
    playNextTrack() {
        if (this.tracks.length === 0) {return;}
        
        let nextIndex = this.currentTrackIndex + 1;
        if (nextIndex >= this.tracks.length) {
            nextIndex = 0; // Loop to first track
        }
        
        this.loadTrack(nextIndex);
    }
    
    playPreviousTrack() {
        if (this.tracks.length === 0) {return;}
        
        let prevIndex = this.currentTrackIndex - 1;
        if (prevIndex < 0) {
            prevIndex = this.tracks.length - 1; // Loop to last track
        }
        
        this.loadTrack(prevIndex);
    }
    
    openCatalog() {
        console.log('TrackCatalog: openCatalog() called');
        console.log('TrackCatalog: catalogContainer exists:', !!this.catalogContainer);
        console.log('TrackCatalog: catalogContainer classes before:', this.catalogContainer?.className);
        
        if (this.catalogContainer) {
        this.catalogContainer.classList.remove('hidden');
            console.log('TrackCatalog: catalogContainer classes after:', this.catalogContainer.className);
            console.log('TrackCatalog: Catalog should now be visible');
        } else {
            console.error('TrackCatalog: catalogContainer is null or undefined!');
        }
    }
    
    closeCatalog() {
        this.catalogContainer.classList.add('hidden');
    }
    
    /**
     * Save markers to a track
     * @param {number} trackId - ID of track to save markers to
     * @param {Array} markers - Array of marker objects
     */
    saveMarkersToTrack(trackId, markers) {
        // Find track by ID
        const trackIndex = this.tracks.findIndex(track => track.id === trackId);
        
        if (trackIndex === -1) {
            console.error('Track not found:', trackId);
            return false;
        }
        
        // Save markers to track
        this.tracks[trackIndex].syncMarkers = JSON.parse(JSON.stringify(markers));
        
        console.log(`Saved ${markers.length} markers to track:`, this.tracks[trackIndex].title);
        
        // Save tracks to IndexedDB
        this._saveTracksToDb(this.tracks[trackIndex]);
        
        return true;
    }
    
    /**
     * Save track to database
     * @param {Object} track - The track to save
     * @private
     */
    _saveTracksToDb(track) {
        if (!this.db) {
            console.error('Database not initialized');
            return;
        }
        
        try {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            
            // Update the track in the database
            const request = store.put(track);
            
            request.onsuccess = () => {
                console.log('Track updated in database');
            };
            
            request.onerror = (event) => {
                console.error('Error updating track in database:', event.target.error);
            };
        } catch (error) {
            console.error('Exception during database save:', error);
        }
    }
    
    /**
     * Convert old marker format to new format if needed
     * @param {Array} markers - Array of marker objects
     * @returns {Array} - Converted marker array
     */
    _convertMarkerFormat(markers) {
        if (!Array.isArray(markers) || markers.length === 0) {
            return [];
        }
        
        // Check if markers are already in the new format
        if (markers[0].id && markers[0].lineIndex !== undefined && markers[0].time !== undefined) {
            return markers;
        }
        
        // Convert old format to new format
        return markers.map((marker, index) => {
            // Handle different legacy formats
            const lineIndex = marker.lineIndex !== undefined ? marker.lineIndex : 
                             (marker.line !== undefined ? marker.line : index);
            
            return {
                id: Date.now() + Math.random().toString(36).substr(2, 5) + index,
                lineIndex: lineIndex,
                time: marker.time || 0,
                text: marker.text || `Line ${lineIndex}`
            };
        });
    }
    
    /**
     * Save markers from the current track to storage
     */
    saveCurrentTrackMarkers() {
        if (this.currentTrackIndex < 0 || this.currentTrackIndex >= this.tracks.length) {
            return false;
        }
        
        if (window.markerManager) {
            const markers = window.markerManager.getMarkers();
            return this.saveMarkersToTrack(this.tracks[this.currentTrackIndex].id, markers);
        }
        
        return false;
    }
    
    /**
     * Load tracks from local storage
     * @private
     */
    _loadTracks() {
        try {
            const savedTracks = localStorage.getItem('tracks');
            
            if (savedTracks) {
                this.tracks = JSON.parse(savedTracks);
                console.log(`Loaded ${this.tracks.length} tracks from storage`);
                
                // Convert legacy marker formats if needed
                this.tracks.forEach(track => {
                    if (track.syncMarkers) {
                        track.syncMarkers = this._convertMarkerFormat(track.syncMarkers);
                    }
                });
                
                // Update catalog UI
                this._updateCatalogUI();
            }
        } catch (error) {
            console.error('Error loading tracks from storage:', error);
        }
    }
    
    /**
     * Update catalog UI
     * @private
     */
    _updateCatalogUI() {
        this._renderTrackList();
    }
    
    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    _handleKeyboardNavigation(event) {
        if (event.key === 'ArrowLeft') {
            this.playPreviousTrack();
        } else if (event.key === 'ArrowRight') {
            this.playNextTrack();
        }
    }
    
    /**
     * Export all tracks to a backup file
     * @returns {Blob} Backup file blob
     */
    exportAllTracks() {
        const backupData = {
            version: '1.1', // Added version for future compatibility
            timestamp: new Date().toISOString(),
            tracks: this.tracks.map(track => ({
                id: track.id,
                title: track.title,
                lyrics: track.lyrics,
                // Store paths as relative if possible, or placeholder if only File objects exist
                // This part might need refinement based on how paths are managed persistently
                instrumentalPath: track.instrumentalPath || (track.instrumentalFile ? 'file://' + track.instrumentalFile.name : null),
                vocalsPath: track.vocalsPath || (track.vocalsFile ? 'file://' + track.vocalsFile.name : null),
                markers: track.syncMarkers || [],
                blocksData: track.blocksData || [], // Add blocksData
                duration: track.duration || 0,
                lastModified: track.lastModified || new Date().toISOString()
            }))
        };
        
        // Convert to JSON with UTF-8 BOM for Cyrillic support
        const jsonData = JSON.stringify(backupData, null, 2);
        const utf8BomJsonData = '\uFEFF' + jsonData;
        
        // Create download blob with proper UTF-8 encoding
        const blob = new Blob([utf8BomJsonData], { type: 'application/json;charset=utf-8' });
        
        return blob;
    }
    
    /**
     * Export a single track with its audio data to a backup file
     * @param {number} trackId - ID of track to export
     * @returns {Promise<Blob>} Promise resolving to a backup file blob
     */
    async exportTrackWithAudio(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) {throw new Error('Track not found for export with audio');}

        const zip = new JSZip();

        // 1. Add track metadata (lyrics, markers, blocksData, etc.) as tracklist.json
        const trackMetadata = {
                id: track.id,
                title: track.title,
                lyrics: track.lyrics,
            markers: track.syncMarkers || [],
            blocksData: track.blocksData || [], // Add blocksData
            duration: track.duration || 0,
            lastModified: track.lastModified || new Date().toISOString(),
            // Store original filenames for reconstruction if needed
            originalInstrumentalName: track.instrumentalFile ? track.instrumentalFile.name : (track.instrumentalPath ? track.instrumentalPath.split('/').pop() : null),
            originalVocalsName: track.vocalsFile ? track.vocalsFile.name : (track.vocalsPath ? track.vocalsPath.split('/').pop() : null),
        };
        zip.file('tracklist.json', JSON.stringify([trackMetadata], null, 2));

        // 2. Add instrumental audio file
        if (track.instrumentalFile) {
            const instBlob = await track.instrumentalFile.arrayBuffer();
            zip.file(`instrumental.${this._getFileExtension(track.instrumentalFile.type)}`, instBlob, { binary: true });
        } else if (track.instrumentalPath) {
            // Fallback to path if no file object exists
            const instBlob = await this._readAudioFile(new File([], track.instrumentalPath.split('/').pop(), { type: track.instrumentalPath.split('.').pop().split('/').pop() }));
            zip.file(`instrumental.${this._getFileExtension(track.instrumentalPath.split('.').pop().split('/').pop())}`, instBlob, { binary: true });
        }

        // 3. Add vocals audio file
        if (track.vocalsFile) {
            const vocBlob = await track.vocalsFile.arrayBuffer();
            zip.file(`vocals.${this._getFileExtension(track.vocalsFile.type)}`, vocBlob, { binary: true });
        } else if (track.vocalsPath) {
            // Fallback to path if no file object exists
            const vocBlob = await this._readAudioFile(new File([], track.vocalsPath.split('/').pop(), { type: track.vocalsPath.split('.').pop().split('/').pop() }));
            zip.file(`vocals.${this._getFileExtension(track.vocalsPath.split('.').pop().split('/').pop())}`, vocBlob, { binary: true });
        }
        
        // Generate zip file with proper encoding options
        const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 9 },
            encodeFileName: function(filename) {
                // Ensure filenames inside the zip are properly encoded
                return unescape(encodeURIComponent(filename));
            }
        });
        return zipBlob;
    }
    
    /**
     * Import tracks from a backup file
     * @param {File} backupFile - The backup file to import
     * @returns {Promise<{success: boolean, message: string, imported: number}>} Result of import operation
     */
    async importTracks(backupFile) {
        try {
            // Check if file is JSON
            if (backupFile.name.endsWith('.json')) {
                return this._importFromJson(backupFile);
            } 
            // Check if file is ZIP (individual track with audio)
            else if (backupFile.name.endsWith('.zip')) {
                return this._importFromZip(backupFile);
            } 
            else {
                return {
                    success: false,
                    message: 'Invalid backup file format. Expected .json or .zip',
                    imported: 0
                };
            }
        } catch (error) {
            console.error('Error importing tracks:', error);
            return {
                success: false,
                message: `Error importing tracks: ${error.message}`,
                imported: 0
            };
        }
    }
    
    /**
     * Import tracks from a JSON backup file
     * @private
     * @param {File} jsonFile - JSON backup file
     * @returns {Promise<{success: boolean, message: string, imported: number}>} Result of import
     */
    async _importFromJson(jsonFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const rawData = event.target.result;
                    const parsedData = JSON.parse(rawData);
                    let importedCount = 0;
                    let tracksToImport = [];

                    if (parsedData && parsedData.tracks && Array.isArray(parsedData.tracks)) {
                        // New backup format with a tracks array
                        tracksToImport = parsedData.tracks;
                    } else if (Array.isArray(parsedData)) {
                        // Old backup format (array of tracks directly)
                        tracksToImport = parsedData;
                } else {
                        throw new Error('Invalid JSON backup file format.');
                    }

                    if (tracksToImport.length === 0) {
                        resolve({ success: true, message: 'No tracks found in the backup file.', importedCount });
                        return;
                    }

                    for (const trackData of tracksToImport) {
                        const newTrack = {
                            id: trackData.id || Date.now() + Math.random(), // Ensure unique ID
                            title: trackData.title || 'Untitled Imported Track',
                            lyrics: trackData.lyrics || '',
                            instrumentalPath: trackData.instrumentalPath || null,
                            vocalsPath: trackData.vocalsPath || null,
                            // No File objects from JSON, these will be null unless loaded from a ZIP later
                            instrumentalFile: null,
                            vocalsFile: null,
                            markers: trackData.markers || [],
                            blocksData: trackData.blocksData || [], // Add blocksData
                            duration: trackData.duration || 0,
                            lastModified: trackData.lastModified ? new Date(trackData.lastModified) : new Date()
                        };

                        await this._saveTrackToDB(newTrack);
                    importedCount++;
            }
            
            // Reload tracks from database
            await this._loadTracksFromDB();
            
            // Return result
            let message = `Successfully imported metadata for ${importedCount} tracks.`;
                    resolve({
                success: true,
                message: message,
                imported: importedCount
                    });
        } catch (error) {
            console.error('Error importing from JSON:', error);
                    resolve({
                success: false,
                message: `Error importing from JSON: ${error.message}`,
                imported: 0
                    });
                }
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsText(jsonFile, 'UTF-8');
        });
    }
    
    /**
     * Import a track from a ZIP backup file
     * @private
     * @param {File} zipFile - ZIP backup file
     * @returns {Promise<{success: boolean, message: string, imported: number}>} Result of import
     */
    async _importFromZip(zipFile) {
        return new Promise(async (resolve, reject) => {
            try {
                const zip = await JSZip.loadAsync(zipFile);
                const tracklistFile = zip.file('tracklist.json');

                if (!tracklistFile) {
                    throw new Error('tracklist.json not found in the ZIP archive.');
                }

                const tracklistContent = await tracklistFile.async('string');
                const tracksMetadata = JSON.parse(tracklistContent);
                let importedCount = 0;

                if (!Array.isArray(tracksMetadata) || tracksMetadata.length === 0) {
                    resolve({ success: true, message: 'No track metadata found in tracklist.json.', importedCount });
                    return;
                }

                for (const trackMeta of tracksMetadata) {
                    let instrumentalFile = null;
                    let vocalsFile = null;

                    // Try to load audio files based on stored names or common names
                    const instrumentalFileName = trackMeta.originalInstrumentalName || 'instrumental.mp3'; // or .wav etc.
                    const vocalsFileName = trackMeta.originalVocalsName || 'vocals.mp3';

                    const audioFiles = Object.values(zip.files).filter(file => 
                        !file.dir && (file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.ogg') || file.name.endsWith('.m4a'))
                    );

                    if (audioFiles.length > 0) {
                        // Attempt to find by original name first
                        let instFileEntry = zip.file(instrumentalFileName);
                        if (!instFileEntry && audioFiles.length === 1) {instFileEntry = audioFiles[0];} // If only one audio, assume it's instrumental
                        if (!instFileEntry && audioFiles.length > 0 && audioFiles.find(f => f.name.toLowerCase().includes('instrumental') || f.name.toLowerCase().includes('backing'))) {
                            instFileEntry = audioFiles.find(f => f.name.toLowerCase().includes('instrumental') || f.name.toLowerCase().includes('backing'));
                        } else if (!instFileEntry && audioFiles.length > 0 && !audioFiles.find(f => f.name.toLowerCase().includes('vocal'))) {
                            instFileEntry = audioFiles[0]; // Fallback if no clear instrumental
                        }
                        
                        let vocFileEntry = zip.file(vocalsFileName);
                        if (!vocFileEntry && audioFiles.find(f => f.name.toLowerCase().includes('vocal'))) {
                            vocFileEntry = audioFiles.find(f => f.name.toLowerCase().includes('vocal'));
                        } else if (!vocFileEntry && instFileEntry && audioFiles.length > 1) {
                            // If instrumental found, try to pick another for vocals
                            vocFileEntry = audioFiles.find(f => f.name !== instFileEntry.name);
                        }

                        if (instFileEntry) {
                            const instBlob = await instFileEntry.async('blob');
                            instrumentalFile = new File([instBlob], instFileEntry.name, { type: instBlob.type });
                        }
                        if (vocFileEntry) {
                            const vocBlob = await vocFileEntry.async('blob');
                            vocalsFile = new File([vocBlob], vocFileEntry.name, { type: vocBlob.type });
                        }
                    }

                    const newTrack = {
                        id: trackMeta.id || Date.now() + Math.random(),
                        title: trackMeta.title || 'Untitled Imported Track',
                        lyrics: trackMeta.lyrics || '',
                        instrumentalPath: instrumentalFile ? 'file://' + instrumentalFile.name : null, // Path from file name
                        vocalsPath: vocalsFile ? 'file://' + vocalsFile.name : null,
                        instrumentalFile: instrumentalFile,
                        vocalsFile: vocalsFile,
                        markers: trackMeta.markers || [],
                        blocksData: trackMeta.blocksData || [], // Add blocksData
                        duration: trackMeta.duration || 0, // Duration might need recalculation if not in metadata
                        lastModified: trackMeta.lastModified ? new Date(trackMeta.lastModified) : new Date()
                    };

                    const savedTrackId = await this._saveTrackToDB(newTrack);
                    importedCount++;
            }
            
            // Reload tracks from database
            await this._loadTracksFromDB();
            
                // Return result
                let message = `Successfully imported ${importedCount} tracks.`;
                resolve({
                success: true,
                    message: message,
                    imported: importedCount
                });
        } catch (error) {
            console.error('Error importing from ZIP:', error);
                resolve({
                success: false,
                message: `Error importing from ZIP: ${error.message}`,
                imported: 0
                });
        }
        });
    }
    
    /**
     * Get file extension from MIME type
     * @private
     * @param {string} mimeType - MIME type
     * @returns {string} File extension
     */
    _getFileExtension(mimeType) {
        if (!mimeType) {return 'mp3';}
        
        const extensions = {
            'audio/mp3': 'mp3',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/x-wav': 'wav',
            'audio/ogg': 'ogg',
            'audio/flac': 'flac',
            'audio/aac': 'aac',
            'audio/m4a': 'm4a'
        };
        
        return extensions[mimeType] || 'mp3';
    }
    
    /**
     * Import markers from a JSON file
     * @param {File} file - The JSON file containing markers
     * @private
     */
    async _importMarkersFromFile(file) {
        try {
            // Read the file content
            const content = await this._readTextFile(file);
            
            // Check if we have marker manager
            if (!window.markerManager) {
                alert('Marker manager not available');
                return;
            }
            
            // Import markers
            const success = window.markerManager.importMarkers(content);
            
            if (success) {
                // Close catalog to show the updated markers
                this.closeCatalog();
                
                // Show success message
                alert('Markers imported successfully!');
                
                // Убрано: автоматическое открытие Sync режима
                // Пользователь теперь может сразу начать репетицию/пение без лишних переходов
            } else {
                alert('Failed to import markers. Invalid file format.');
            }
        } catch (error) {
            console.error('Error importing markers:', error);
            alert('Error importing markers: ' + error.message);
        }
    }
    
    /**
     * Import markers for a specific track
     * @param {number} trackId - The ID of the track to import markers for
     * @private
     */
    _importMarkersForSpecificTrack(trackId) {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // Handle file selection
        fileInput.addEventListener('change', async () => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                
                try {
                    // Find the track
                    const trackIndex = this.tracks.findIndex(track => track.id === trackId);
                    if (trackIndex === -1) {
                        throw new Error('Track not found');
                    }
                    
                    // Store the track data
                    const trackData = this.tracks[trackIndex];
                    
                    // Read file content first so we have it ready
                    console.log(`Reading marker file: ${file.name}`);
                    const content = await this._readTextFile(file);
                    
                    // Load track first to ensure it's active
                    console.log(`Loading track: ${trackData.title}`);
                    this.loadTrack(trackIndex);
                    this.closeCatalog();
                    
                    // Wait longer for track and lyrics to fully load
                    console.log('Waiting for track and lyrics to fully load...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Ensure lyrics are loaded by checking the LyricsDisplay component
                    let lyricLines = 0;
                    if (window.lyricsDisplay && window.lyricsDisplay.lyrics) {
                        lyricLines = window.lyricsDisplay.lyrics.length;
                    }
                    
                    console.log(`Current lyrics loaded: ${lyricLines} lines`);
                    
                    // If lyrics aren't loaded yet, wait a bit longer
                    if (lyricLines === 0) {
                        console.log('Lyrics not loaded yet, waiting longer...');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        // Check again
                        if (window.lyricsDisplay && window.lyricsDisplay.lyrics) {
                            lyricLines = window.lyricsDisplay.lyrics.length;
                        }
                        console.log(`After additional wait, lyrics loaded: ${lyricLines} lines`);
                    }
                    
                    // Make sure marker manager exists
                    if (!window.markerManager) {
                        alert('Marker manager not available');
                        return;
                    }
                    
                    // Check if lyrics are actually loaded
                    if (lyricLines === 0) {
                        console.error('Failed to load lyrics for the track');
                        
                        // Try to load lyrics directly from the file
                        try {
                            const jsonData = JSON.parse(content);
                            if (jsonData && jsonData.lyrics && window.lyricsDisplay) {
                                console.log('Using lyrics from marker file instead');
                                window.lyricsDisplay.loadLyrics(jsonData.lyrics, window.audioEngine.duration);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        } catch (e) {
                            console.error('Could not extract lyrics from marker file:', e);
                        }
                        
                        // Final check
                        if (window.lyricsDisplay && window.lyricsDisplay.lyrics) {
                            lyricLines = window.lyricsDisplay.lyrics.length;
                        }
                        
                        if (lyricLines === 0) {
                            alert('Could not load lyrics for this track. Please ensure the track is properly loaded first.');
                            return;
                        }
                    }
                    
                    console.log(`Proceeding to import markers with ${lyricLines} lyric lines available`);
                    
                    // Import markers now that lyrics are loaded
                    const success = window.markerManager.importMarkers(content);
                    
                    if (success) {
                        // Save markers to track immediately
                        window.markerManager.saveMarkersToTrack();
                        
                        // Show confirmation
                        alert(`Markers imported and applied to "${this.tracks[trackIndex].title}" successfully!`);
                        
                        // Убрано: автоматическое открытие Sync режима
                        // Пользователь теперь может сразу начать репетицию/пение без лишних переходов
                    } else {
                        alert('Failed to import markers. Invalid file format.');
                    }
                } catch (error) {
                    console.error('Error importing markers for track:', error);
                    alert('Error importing markers: ' + error.message);
                } finally {
                    // Remove file input
                    document.body.removeChild(fileInput);
                }
            }
        });
        
        // Trigger file selection dialog
        fileInput.click();
    }
    
    /**
     * Set up the Load Markers button
     * @private
     */
    _setupLoadMarkersButton() {
        const importContainer = document.querySelector('.import-markers-container');
        if (!importContainer) {return;}
        
        // Create the Load Markers button
        const loadMarkersBtn = document.createElement('button');
        loadMarkersBtn.id = 'load-markers-btn';
        loadMarkersBtn.className = 'btn btn-secondary';
        loadMarkersBtn.innerHTML = '<i class="fas fa-folder-open"></i> Load Markers';
        loadMarkersBtn.title = 'Load markers for a specific track';
        
        // Insert after Import Markers button
        const importBtn = document.getElementById('import-markers-btn');
        if (importBtn) {
            importBtn.parentNode.insertBefore(loadMarkersBtn, importBtn.nextSibling);
        } else {
            importContainer.appendChild(loadMarkersBtn);
        }
        
        // Add click event
        loadMarkersBtn.addEventListener('click', () => {
            this._showLoadMarkersUI();
        });
    }
    
    /**
     * Show the Load Markers UI with + buttons next to tracks
     * @private
     */
    _showLoadMarkersUI() {
        // Remove any existing + buttons first
        this._hideLoadMarkersUI();
        
        // Add + buttons next to each track
        const trackItems = this.catalogElement.querySelectorAll('.track-item');
        trackItems.forEach(trackItem => {
            const trackInfo = trackItem.querySelector('.track-info');
            const trackId = trackItem.dataset.id;
            
            if (trackInfo && trackId) {
                // Create + button
                const importBtn = document.createElement('button');
                importBtn.className = 'import-track-markers';
                importBtn.title = 'Import markers for this track';
                importBtn.dataset.id = trackId;
                importBtn.textContent = '+';
                
                // Insert before delete button
                const deleteBtn = trackInfo.querySelector('.delete-track');
                if (deleteBtn) {
                    trackInfo.insertBefore(importBtn, deleteBtn);
                } else {
                    trackInfo.appendChild(importBtn);
                }
                
                // Add click event
                importBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent track selection
                    const id = parseInt(importBtn.dataset.id);
                    this._importMarkersForSpecificTrack(id);
                });
            }
        });
        
        // Add a message that buttons are visible
        const importContainer = document.querySelector('.import-markers-container');
        if (importContainer) {
            const message = document.createElement('div');
            message.className = 'load-markers-message';
            message.textContent = 'Click + next to a track to import markers for it';
            importContainer.appendChild(message);
            
            // Add a cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-small';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => {
                this._hideLoadMarkersUI();
            });
            message.appendChild(cancelBtn);
        }
    }
    
    /**
     * Hide the Load Markers UI
     * @private
     */
    _hideLoadMarkersUI() {
        // Remove all + buttons
        const importButtons = this.catalogElement.querySelectorAll('.import-track-markers');
        importButtons.forEach(btn => btn.remove());
        
        // Remove any message
        const message = document.querySelector('.load-markers-message');
        if (message) {message.remove();}
    }

    updateTrackLyrics(trackId, newLyricsText) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            track.lyrics = newLyricsText;
            track.lastModified = new Date();
            this._saveTrackToDB(track).then(() => {
                // If it's the current track, reload lyrics display
                if (this.tracks[this.currentTrackIndex] && this.tracks[this.currentTrackIndex].id === trackId) {
                    if (this.lyricsDisplay) {
                        this.lyricsDisplay.loadLyrics(track.lyrics, track.duration);
                        if (track.blocksData) { // Reload blocks too
                            this.lyricsDisplay.loadImportedBlocks(track.blocksData);
                        }
                    }
                }
                showNotification(`Lyrics for "${track.title}" updated.`, 'success');
            }).catch(err => {
                showNotification(`Error updating lyrics: ${err.message}`, 'error');
            });
        } else {
            showNotification('Track not found for lyrics update.', 'error');
        }
    }

    saveLyricsBlocks(trackId, blocksData) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            track.blocksData = blocksData;
            track.lastModified = new Date();
            this._saveTrackToDB(track).then(() => {
                // 🎯 ИСПРАВЛЕННОЕ уведомление
                if (window.app && typeof window.app.showNotification === 'function') {
                    window.app.showNotification(`Lyric blocks for "${track.title}" saved.`, 'success');
                } else {
                    console.log(`✅ Lyric blocks for "${track.title}" saved.`);
                }
                // If it's the current track and rehearsal mode is active, we might want to refresh its display
                if (this.tracks[this.currentTrackIndex] && this.tracks[this.currentTrackIndex].id === trackId) {
                    if (this.lyricsDisplay) {
                        this.lyricsDisplay.loadImportedBlocks(track.blocksData); // Reload blocks
                        if (this.lyricsDisplay.currentStyle && this.lyricsDisplay.currentStyle.id === 'rehearsal') {
                           this.lyricsDisplay.activateRehearsalDisplay();
                        }
                        // 🔔 Сообщаем всем слушателям (WaveformEditor/MarkerManager), что блоки применены
                        try {
                            const evt = new CustomEvent('blocks-applied', { detail: { trackId, blocksCount: track.blocksData.length } });
                            document.dispatchEvent(evt);
                        } catch (e) {
                            console.warn('TrackCatalog: Failed to dispatch blocks-applied event', e);
                        }
                        // Принудительно обновляем цвета маркеров
                        if (window.markerManager && typeof window.markerManager.updateMarkerColors === 'function') {
                            window.markerManager.updateMarkerColors();
                        }
                    }
                }
            }).catch(err => {
                // 🎯 ИСПРАВЛЕННОЕ уведомление об ошибке
                if (window.app && typeof window.app.showNotification === 'function') {
                    window.app.showNotification(`Error saving lyric blocks: ${err.message}`, 'error');
                } else {
                    console.error(`❌ Error saving lyric blocks: ${err.message}`);
                }
            });
        } else {
            // 🎯 ИСПРАВЛЕННОЕ уведомление об ошибке
            if (window.app && typeof window.app.showNotification === 'function') {
                window.app.showNotification('Track not found for saving blocks.', 'error');
            } else {
                console.error('❌ Track not found for saving blocks.');
            }
        }
    }

    /**
     * Полностью очищает каталог треков (используется для восстановления при проблемах)
     * @returns {Promise<boolean>} Успешность операции
     */
    async clearAllTracks() {
        if (!this.db) {
            console.error('База данных не инициализирована');
            return false;
        }
        
        return new Promise((resolve) => {
            try {
                // Спрашиваем подтверждение перед удалением всех треков
                if (!confirm('Вы уверены, что хотите удалить ВСЕ треки из каталога? Это действие невозможно отменить!')) {
                    resolve(false);
                    return;
                }
                
                console.log('Начинаем очистку каталога треков...');
                
                // Создаем транзакцию на очистку хранилища
                const transaction = this.db.transaction(['tracks'], 'readwrite');
                const store = transaction.objectStore('tracks');
                const clearRequest = store.clear();
                
                clearRequest.onsuccess = () => {
                    console.log('Хранилище треков успешно очищено');
                    
                    // Останавливаем воспроизведение
                    if (window.audioEngine) {
                        audioEngine.stop();
                    }
                    
                    // Очищаем локальные данные
                    this.tracks = [];
                    this.currentTrackIndex = -1;
                    
                    // Очищаем различные ссылки
                    if (window.waveformEditor) {
                        window.waveformEditor.currentTrackId = null;
                        window.waveformEditor.lastLoadedFile = null;
                    }
                    
                    if (window.lyricsDisplay) {
                        window.lyricsDisplay.clearAllTextBlocks();
                    }
                    
                    // Обновляем UI
                    this._renderTrackList();
                    
                    // Показываем приветственный экран
                    if (window.app && typeof window.app._showWelcomeIfNoTracks === 'function') {
                        window.app._showWelcomeIfNoTracks();
                    }
                    
                    // Отправляем событие очистки каталога
                    document.dispatchEvent(new CustomEvent('catalog-cleared'));
                    
                    resolve(true);
                };
                
                clearRequest.onerror = (event) => {
                    console.error('Ошибка при очистке хранилища треков:', event.target.error);
                    alert('Произошла ошибка при очистке каталога треков');
                    resolve(false);
                };
            } catch (error) {
                console.error('Исключение при очистке каталога треков:', error);
                alert('Произошла ошибка при очистке каталога треков');
                resolve(false);
            }
        });
    }

    /**
     * Проверяет и исправляет ссылки на треки в базе данных
     * @private
     */
    async _checkForOrphanedTracks() {
        if (!this.db) {
            console.error('База данных не инициализирована, невозможно проверить треки');
            return;
        }
        
        try {
            // Получаем все треки из базы
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const request = store.getAll();
            
            let tracksToCheck = [];
            let problemsFound = false;
            
            request.onsuccess = async () => {
                tracksToCheck = request.result || [];
                
                // Проверяем треки на проблемы
                for (const track of tracksToCheck) {
                    // Проверяем корректность ID
                    if (typeof track.id !== 'number' || isNaN(track.id)) {
                        problemsFound = true;
                        console.error(`Найден трек с некорректным ID: ${track.id}, title: ${track.title}`);
                    }
                    
                    // Проверяем наличие обязательных полей
                    if (!track.title) {
                        problemsFound = true;
                        console.error(`Найден трек без названия, ID: ${track.id}`);
                    }
                    
                    // Проверяем наличие аудиоданных
                    if (!track.instrumentalData) {
                        problemsFound = true;
                        console.error(`Найден трек без аудиоданных, ID: ${track.id}, title: ${track.title}`);
                    }
                }
                
                if (problemsFound) {
                    console.warn('Найдены проблемы с треками в каталоге. Рекомендуется очистить каталог и загрузить треки заново.');
                } else {
                    console.log('Проверка треков завершена успешно, проблем не обнаружено');
                }
            };
            
            request.onerror = (event) => {
                console.error('Ошибка при проверке треков:', event.target.error);
            };
        } catch (error) {
            console.error('Исключение при проверке треков:', error);
        }
    }

    async _finalizeUploadFromBlockEditor() {
        // ЭТА ФУНКЦИЯ БОЛЬШЕ НЕ НУЖНА В СТАРОМ ВИДЕ, так как логика сохранения
        // теперь обрабатывается в колбэке onSaveCallback модального редактора.
        // Оставляем ее пустой или удаляем, если она больше нигде не вызывается напрямую.
        console.log('TrackCatalog: _finalizeUploadFromBlockEditor CALLED - should be obsolete now.');
        localStorage.removeItem('finalizeTrackUpload'); // Очистка старых флагов на всякий случай
                        localStorage.removeItem('editedBlockTextResult');
                        localStorage.removeItem('trackInfoForBlockEditor');
                        localStorage.removeItem('currentTempAudioId');
        localStorage.removeItem('pendingBlockEditText');      
        localStorage.removeItem('redirectToBlockEditor'); 
    }

    async processLyricsText(fileName, fileContent, rtfAdapterInstance) {
        let blocksText = '';
        const lowerFileName = fileName.toLowerCase();

        if (lowerFileName.endsWith('.rtf')) {
            console.log('TrackCatalog: Processing RTF file:', fileName);
            try {
                const blockSeparatorRTFPattern = /^\s*\\\s*$/gm;
                const blockSeparatorMarker = 'RTF_BLOCK_SEPARATOR_TOKEN';
                
                let rtfContentForParser = fileContent.replace(blockSeparatorRTFPattern, blockSeparatorMarker);
                
                if (rtfContentForParser.includes(blockSeparatorMarker)){
                    console.log('TrackCatalog: RTF with blockSeparatorMarker (first 200 chars):', rtfContentForParser.substring(0, 200));
                } else {
                    console.log('TrackCatalog: No block separator patterns found in RTF.');
                }

                const parsedText = await rtfAdapterInstance.parse(rtfContentForParser);
                console.log('TrackCatalog: Parsed by Adapter (first 200 chars):', parsedText.substring(0, 200));

                blocksText = parsedText.replace(new RegExp(blockSeparatorMarker, 'g'), '\n\n');
                blocksText = blocksText.replace(/\s*\n\n\s*/g, '\n\n');
                blocksText = blocksText.replace(/\n{3,}/g, '\n\n');
                blocksText = blocksText.trim();

                console.log('TrackCatalog: RTF processed into blocksText (first 200 chars):', blocksText.substring(0, 200));
                } catch (error) {
                console.error('TrackCatalog: Error processing RTF file:', fileName, error);
                blocksText = fileContent; // В случае ошибки, возвращаем исходный контент
                }
        } else if (lowerFileName.endsWith('.txt')) {
            console.log('TrackCatalog: Processing TXT file:', fileName);
            blocksText = fileContent.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
            console.log('TrackCatalog: TXT processed (first 200 chars):', blocksText.substring(0, 200));
            } else {
            console.log('TrackCatalog: File is not RTF or TXT, returning content as is:', fileName);
            blocksText = fileContent; // Для других файлов пока возвращаем как есть
        }
        return blocksText;
    }

    async onSaveCallback(blocks, trackInfo) {
        try {
            console.log('TrackCatalog: onSaveCallback - ENTERED TRY BLOCK', { blocks, trackInfo });

            // 1. Retrieve temporary audio data from IndexedDB
            const tempAudioData = await this._getTempAudioData(trackInfo.tempAudioId);
            console.log('TrackCatalog: onSaveCallback - After _getTempAudioData', { tempAudioData });

            if (!tempAudioData || !tempAudioData.instrumentalData) {
                // ... existing code ...
            }

            const savedTrackDBInfo = await this._saveTrackToDB(trackInfo, blocks, tempAudioData.instrumentalData, tempAudioData.vocalsData, tempAudioData.audioFormat);
            console.log('TrackCatalog: onSaveCallback - After _saveTrackToDB', { savedTrackDBInfo });

            // 3. Load audio into AudioEngine
            let audioLoadResult = { duration: null };
            if (savedTrackDBInfo.instrumentalData) {
                const instrumentalBlob = new Blob([savedTrackDBInfo.instrumentalData], { type: savedTrackDBInfo.instrumentalType });
                const instrumentalUrl = URL.createObjectURL(instrumentalBlob);
                audioLoadResult = await this.audioEngine.loadTrack(instrumentalUrl, null);
            }
            console.log('TrackCatalog: onSaveCallback - After audioEngine.loadTrack (or skipped if no audio)', { audioLoadResult });

            // 4. Delete temporary audio data from IndexedDB
            await this._deleteTempAudioData(trackInfo.tempAudioId);

            // ... existing code ...

            const resultToReturn = {
                success: true, 
                trackId: savedTrackDBInfo.id,
                title: savedTrackDBInfo.title, 
                duration: audioLoadResult.duration, 
                blocksData: savedTrackDBInfo.blocksData 
            };
            console.log('TrackCatalog: onSaveCallback - FINAL RESULT TO RETURN:', JSON.stringify(resultToReturn, null, 2));
            return resultToReturn;

        } catch (error) {
            console.error('TrackCatalog: Error in onSaveCallback:', error);
            alert(`Error saving track: ${error.message}`);
            // В случае ошибки, важно также вернуть объект с success: false
            const errorResult = { success: false, error: error.message, trackId: trackInfo.id || null };
            console.log('TrackCatalog: onSaveCallback - ERROR RESULT TO RETURN:', JSON.stringify(errorResult, null, 2));
            return Promise.reject(errorResult);
        }
    }

    /**
     * Конвертирует массив объектов блоков в единый текст.
     * @param {Array<Object>} blocks - Массив блоков.
     * @returns {string} - Отформатированный текст.
     */
    _convertBlocksToPlainText(blocks) {
        if (!blocks || !Array.isArray(blocks)) {
            console.warn('TrackCatalog: _convertBlocksToPlainText received invalid input:', blocks);
            return '';
        }
        return blocks.map(block => block.content).join('\n\n');
    }

    async _initializeDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);
            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                if (!this.db.objectStoreNames.contains('tracks')) {
                    const trackStore = this.db.createObjectStore('tracks', { keyPath: 'id' });
                    trackStore.createIndex('title', 'title', { unique: false });
                    console.log('Object store "tracks" created.');
                }
                if (!this.db.objectStoreNames.contains('app_state')) {
                    this.db.createObjectStore('app_state', { keyPath: 'key' });
                    console.log('Object store "app_state" created.');
                }
                // Новое хранилище для временных аудиофайлов
                if (!this.db.objectStoreNames.contains('temp_audio_files')) {
                    this.db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                    console.log('Object store "temp_audio_files" created.');
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
        });
    }

    // 🎯 ЭКСТРЕННЫЙ МЕТОД: Принудительное пересоздание базы данных
    async forceRecreateDatabase() {
        console.log('🚨 TrackCatalog: ЭКСТРЕННОЕ пересоздание базы данных...');
        
        try {
            // Удаляем старую базу
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            
            deleteRequest.onsuccess = () => {
                console.log('✅ TrackCatalog: Старая база удалена, создаем новую...');
                
                // Пытаемся создать новую базу с простым именем
                const newRequest = indexedDB.open('TextAppDB_New', 1);
                
                newRequest.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Создаем stores
                    const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
                    trackStore.createIndex('title', 'title', { unique: false });
                    db.createObjectStore('app_state', { keyPath: 'key' });
                    db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                    
                    console.log('✅ TrackCatalog: Новая база создана с stores');
                };
                
                newRequest.onsuccess = (event) => {
                    this.db = event.target.result;
                    console.log('🎉 TrackCatalog: ЭКСТРЕННАЯ база данных готова!');
                    
                    // Вызываем загрузку треков
                    this._loadTracksFromDB();
                    this._finalizeUploadFromBlockEditor();
                };
                
                newRequest.onerror = (event) => {
                    console.error('💥 TrackCatalog: КРИТИЧЕСКАЯ ОШИБКА создания новой базы:', event);
                };
            };
            
            deleteRequest.onerror = (event) => {
                console.error('❌ TrackCatalog: Ошибка удаления старой базы:', event);
            };
            
        } catch (error) {
            console.error('💥 TrackCatalog: КРИТИЧЕСКАЯ ОШИБКА пересоздания:', error);
        }
    }
}

// Create global track catalog instance
const trackCatalog = new TrackCatalog(); 
window.trackCatalog = trackCatalog; 