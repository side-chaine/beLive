/**
 * Catalog V2 - Новый каталог на основе catalog-design-test.html
 */

console.log('🔄 ЗАГРУЗКА: catalog-v2.js начинает загрузку...');

class CatalogV2 {
    constructor() {
        this.overlay = null;
        this.isOpen = false;
        this.tracks = [];
        this.db = null;
        this.myMusicIds = new Set();
        // Плейлисты V1 (в памяти)
        this.playlists = [];
        this.isBuildingPlaylist = false;
        this.currentPlaylist = [];
        this.currentPlaylistName = 'Новый плейлист';
        this.editingPlaylistId = null;
        this.uploadSession = {
            instrumental: null,
            vocal: null,
            lyrics: null
        };
        
        this.init();
        console.log('🎵 CatalogV2 инициализирован');
    }
    
    init() {
        this.overlay = document.getElementById('catalog-v2-overlay');
        
        if (!this.overlay) {
            console.error('❌ CatalogV2: Overlay не найден');
            return;
        }
        
        this.setupEventListeners();
        this.initDatabase();
        this.attachSearchHandlers();

        // Инициализируем UI плейлистов (центральная колонка)
        this._initPlaylistsUI();
    }
    
    initDatabase() {
        const DB_NAME = (window.__DB_NAME || 'TextAppDB');
        const DB_VERSION = 6;
        const openMain = () => indexedDB.open(DB_NAME, DB_VERSION);
        const openRecovery = (name) => indexedDB.open(name, 1);

        const request = openMain();
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('tracks')) {
                const s = db.createObjectStore('tracks', { keyPath: 'id' });
                s.createIndex('title', 'title', { unique: false });
            }
            if (!db.objectStoreNames.contains('app_state')) {db.createObjectStore('app_state', { keyPath: 'key' });}
            if (!db.objectStoreNames.contains('temp_audio_files')) {db.createObjectStore('temp_audio_files', { keyPath: 'id' });}
            if (!db.objectStoreNames.contains('my_music')) {db.createObjectStore('my_music', { keyPath: 'trackId' });}
        };
        request.onsuccess = (event) => {
            this.db = event.target.result;
            console.log('🎵 CatalogV2: База данных подключена');
            this.loadTracksFromDB();
            this.loadMyMusicFromDB();
            // Загружаем сохранённые плейлисты
            this._loadPlaylistsFromDB();
        };
        request.onerror = () => {
            console.warn('❌ CatalogV2: Ошибка подключения. Пробуем пересоздать базу...');
            const del = indexedDB.deleteDatabase(DB_NAME);
            del.onsuccess = () => {
                const retry = openMain();
                retry.onupgradeneeded = request.onupgradeneeded;
                retry.onsuccess = (ev2) => { this.db = ev2.target.result; this.loadTracksFromDB(); };
                retry.onerror = () => {
                    const recovery = (DB_NAME + '_Recovery_' + Date.now());
                    const rec = openRecovery(recovery);
                    rec.onupgradeneeded = (e3) => {
                        const db = e3.target.result;
                        const s = db.createObjectStore('tracks', { keyPath: 'id' });
                        s.createIndex('title', 'title', { unique: false });
                        db.createObjectStore('app_state', { keyPath: 'key' });
                        db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                        db.createObjectStore('my_music', { keyPath: 'trackId' });
                    };
                    rec.onsuccess = (e3) => { this.db = e3.target.result; this.loadTracksFromDB(); };
                    rec.onerror = (e3) => console.error('💥 CatalogV2: Recovery DB open failed:', e3);
                };
            };
        };
    }
    
    async loadTracksFromDB() {
        if (!this.db) {
            console.error('❌ CatalogV2: База данных не инициализирована');
            return;
        }
        
        try {
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const request = store.getAll();
            
            request.onsuccess = async () => {
                this.tracks = request.result || [];
                console.log(`🎵 CatalogV2: Загружено ${this.tracks.length} треков`);
                
                // Если треков нет — пробуем миграцию из fallback баз
                if (this.tracks.length === 0) {
                    await this._tryMigrateFromFallbackDBs();
                    // Повторная загрузка после миграции
                    try {
                        const tx2 = this.db.transaction(['tracks'], 'readonly');
                        const st2 = tx2.objectStore('tracks');
                        const req2 = st2.getAll();
                        await new Promise((res, rej) => { req2.onsuccess = res; req2.onerror = rej; });
                        this.tracks = req2.result || [];
                        console.log(`🎵 CatalogV2: После миграции загружено ${this.tracks.length} треков`);
                    } catch (e) { console.warn('CatalogV2: reload after migrate failed', e); }
                }

                // 🎯 Обновляем "Мою музыку" при первой загрузке
                this.renderMyMusic();
                
                // 🎯 Также обновляем основной каталог для синхронизации
                if (window.trackCatalog && this.tracks.length > 0) {
                    // Проверяем есть ли новые треки, которых нет в основном каталоге
                    this.tracks.forEach(track => {
                        const existsInMain = window.trackCatalog.tracks.find(t => t.id === track.id);
                        if (!existsInMain) {
                            window.trackCatalog.tracks.push(track);
                            console.log(`✅ CatalogV2: Трек "${track.title}" синхронизирован с основным каталогом`);
                        }
                    });
                }

                // 🎯 Всегда рендерим правую колонку поиска всеми треками
                this.renderSearchAllTracks();
            };
            
            request.onerror = () => {
                console.error('❌ CatalogV2: Ошибка загрузки треков');
            };
        } catch (e) {
            console.error('❌ CatalogV2: Непредвиденная ошибка при загрузке треков', e);
        }
    }

    async _tryMigrateFromFallbackDBs() {
        // Кандидаты: старая прод/дев база. Исключаем текущую
        const current = (window.__DB_NAME || 'TextAppDB');
        const candidates = ['TextAppDB', 'TextAppDB_DEV'].filter(n => n !== current);
        if (candidates.length === 0) {return;}
        for (const name of candidates) {
            try {
                const srcDb = await new Promise((resolve, reject) => {
                    const req = indexedDB.open(name);
                    req.onsuccess = (e) => resolve(e.target.result);
                    req.onerror = () => reject(new Error('open failed'));
                    req.onblocked = () => reject(new Error('open blocked'));
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
                const oldMy = await readAll(srcDb, 'my_music');
                const hasData = (oldTracks && oldTracks.length) || (oldMy && oldMy.length);
                if (!hasData) { try { srcDb.close(); } catch(_){}; continue; }

                console.log(`📦 CatalogV2: Мигрирую из базы ${name}: tracks=${oldTracks.length}, my_music=${oldMy.length||0}`);
                // Запись в текущую БД
                try {
                    const tx = this.db.transaction(['tracks','my_music'], 'readwrite');
                    const dstTracks = tx.objectStore('tracks');
                    const dstMy = tx.objectStore('my_music');
                    (oldTracks || []).forEach(t => { try { dstTracks.put(t); } catch(_) {} });
                    (oldMy || []).forEach(m => { try { dstMy.put(m); } catch(_) {} });
                    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; tx.onabort = rej; });
                } catch (e) {
                    console.warn('CatalogV2: запись после миграции не удалась', e);
                }

                try { srcDb.close(); } catch(_){}
                // Загружаем my_music после миграции
                await this.loadMyMusicFromDB();
                return; // мигрировали из первой найденной базы
            } catch (e) {
                console.debug(`CatalogV2: migrate from ${name} skipped`, e?.message || e);
            }
        }
    }
    
    renderMyMusic() {
        const myMusicContent = this.overlay.querySelector('.my-music-content');
        if (!myMusicContent) {return;}
        
        // 🎯 Берём только треки, добавленные пользователем в "Мою музыку"
        const allTracks = (window.trackCatalog && window.trackCatalog.tracks) ? window.trackCatalog.tracks : this.tracks;
        const myTracks = allTracks.filter(t => this.myMusicIds.has(t.id));
        
        if (myTracks.length === 0) {
            myMusicContent.innerHTML = '<p class="empty-state">Загрузите треки через "Upload Track" →</p>';
            return;
        }
        
        // Группируем треки по исполнителям/альбомам
        const groupedTracks = this.groupTracksByArtist(myTracks);
        
        let html = '';
        for (const [artist, tracks] of Object.entries(groupedTracks)) {
            html += `
                <div class="artist-group">
                    <div class="artist-header" onclick="this.parentElement.classList.toggle('expanded')">
                        <span class="artist-name">🎵 ${artist}</span>
                        <span class="track-count">(${tracks.length})</span>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="artist-tracks">
                        ${tracks.map(track => `
                            <div class="track-item" data-track-id="${track.id}">
                                <span class="track-title">${track.title}</span>
                                <div class="track-actions">
                                    <button class="track-action-btn play-btn" title="Играть">▶</button>
                                    <button class="track-action-btn add-btn" title="Добавить в плейлист">➕</button>
                                    <button class="track-action-btn delete-btn" title="Удалить из "Моей музыки"">✕</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        myMusicContent.innerHTML = html;
        console.log(`🎵 CatalogV2: "Моя музыка" обновлена, отображено ${myTracks.length} треков`);

        // Обработчик удаления из "Моей музыки" (для всех пользователей)
        myMusicContent.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = e.currentTarget.closest('.track-item');
                const id = parseInt(item?.dataset?.trackId);
                if (!id || !this.db) {return;}
                await this.removeFromMyMusic(id);
                this.renderMyMusic();
            });
        });
    }

    // Рендер всего каталога (панель Поиск) всеми треками
    renderSearchAllTracks() {
        const searchResults = document.querySelector('.search-results');
        if (!searchResults) {return;}
        const source = (window.trackCatalog && window.trackCatalog.tracks) ? window.trackCatalog.tracks : this.tracks;
        searchResults.innerHTML = '';
        if (!source || source.length === 0) {
            searchResults.innerHTML = '<p class="empty-state">Введите запрос для поиска</p>';
            return;
        }
        source.forEach(track => {
            const el = document.createElement('div');
            el.className = 'search-result-item track-item';
            el.setAttribute('data-track-id', track.id);
            el.innerHTML = `
                <div class="track-title">${track.title}</div>
                <div class="track-actions">
                    <button class="track-action-btn play-btn" data-track-id="${track.id}">▶</button>
                    <button class="track-action-btn add-btn" data-track-id="${track.id}">➕</button>
                    <button class="track-action-btn delete-btn" data-track-id="${track.id}" title="Удалить трек">✕</button>
                </div>
            `;
            searchResults.appendChild(el);
        });
        console.log(`🎵 CatalogV2: Поиск/каталог обновлён, элементов: ${source.length}`);
    }

    // Подключение поля поиска для фильтрации
    attachSearchHandlers() {
        const input = document.querySelector('.search-mode-content input[type="text"], .search-input');
        if (!input) {return;}
        input.addEventListener('input', () => {
            const q = (input.value || '').toLowerCase();
            const searchResults = document.querySelector('.search-results');
            if (!searchResults) {return;}
            const source = (window.trackCatalog && window.trackCatalog.tracks) ? window.trackCatalog.tracks : this.tracks;
            const filtered = !q ? source : source.filter(t => (t.title || '').toLowerCase().includes(q));
            searchResults.innerHTML = '';
            filtered.forEach(track => this.addTrackToSearchResults(track));
        });
    }
    
    // ===== PLAYLISTS V1 (центр) =====
    _initPlaylistsUI() {
        try {
            const panel = this.overlay.querySelector('#playlists-panel');
            if (!panel) {return;}
            panel.innerHTML = `
                <div class="create-playlist-section">
                    <button class="create-playlist-btn" id="create-playlist-btn">
                        <span class="btn-icon">📂</span>
                        <span class="btn-text">Создать новый плейлист</span>
                    </button>
                </div>
                <div class="playlist-constructor" id="playlist-constructor" style="display:none;">
                    <div class="constructor-header">
                        <input type="text" class="playlist-name-input" id="playlist-name-input" placeholder="Название плейлиста..." value="Новый плейлист" />
                        <div class="constructor-controls">
                            <button class="constructor-btn confirm-btn" id="confirm-playlist" title="Сохранить">✅</button>
                            <button class="constructor-btn cancel-btn" id="cancel-playlist" title="Отменить">❌</button>
                        </div>
                    </div>
                    <div class="constructor-tracks" id="constructor-tracks">
                        <div class="drop-zone-message"><span class="drop-icon">🎵</span><p>Добавляйте треки кнопкой ➕</p></div>
                    </div>
                    <div class="constructor-summary">
                        Треков: <span id="constructor-track-count">0</span>
                    </div>
                </div>
                <div class="saved-playlists" id="saved-playlists"></div>
            `;
        } catch(_) {}
    }

    _startPlaylistBuilding() {
        this.isBuildingPlaylist = true;
        this.currentPlaylist = [];
        this.editingPlaylistId = null;
        const ctor = this.overlay.querySelector('#playlist-constructor');
        const btn = this.overlay.querySelector('#create-playlist-btn');
        const nameInput = this.overlay.querySelector('#playlist-name-input');
        if (ctor) {ctor.style.display = 'flex';}
        if (btn) {btn.style.display = 'none';}
        if (nameInput) {nameInput.value = this.currentPlaylistName;}
        this._setPlusPulse(true);
        this._updatePlaylistSummary();
    }

    _cancelPlaylistBuilding() {
        this.isBuildingPlaylist = false;
        this.currentPlaylist = [];
        const ctor = this.overlay.querySelector('#playlist-constructor');
        const btn = this.overlay.querySelector('#create-playlist-btn');
        if (ctor) {ctor.style.display = 'none';}
        if (btn) {btn.style.display = 'flex';}
        this._setPlusPulse(false);
    }

    _confirmPlaylist() {
        if (!this.isBuildingPlaylist || this.currentPlaylist.length === 0) {
            alert('Добавьте треки в плейлист');
            return;
        }
        const nameEl = this.overlay.querySelector('#playlist-name-input');
        const name = (nameEl?.value || 'Новый плейлист').trim();
        if (this.editingPlaylistId) {
            // Обновление существующего
            const idx = this.playlists.findIndex(p => p.id === this.editingPlaylistId);
            if (idx !== -1) {
                this.playlists[idx] = { id: this.editingPlaylistId, name, tracks: [...this.currentPlaylist] };
            }
        } else {
            // Создание нового
            const data = { id: Date.now(), name, tracks: [...this.currentPlaylist] };
            this.playlists.push(data);
        }
        this._rerenderSavedPlaylists();
        this._savePlaylistsToDB();
        this._cancelPlaylistBuilding();
    }

    _renderSavedPlaylist(data) {
        const container = this.overlay.querySelector('#saved-playlists');
        if (!container) {return;}
        const total = data.tracks.length;
        const el = document.createElement('div');
        el.className = 'playlist-item';
        el.dataset.playlistId = String(data.id);
        el.innerHTML = `
            <div class="playlist-info">
                <div class="playlist-title">${data.name}</div>
                <div class="playlist-meta">${total} треков</div>
            </div>
            <div class="playlist-actions">
                <button class="playlist-action-btn edit-btn" title="Редактировать">✏️</button>
                <button class="playlist-action-btn play-btn" title="Играть по очереди">▶️</button>
                <button class="playlist-action-btn delete-btn" title="Удалить">🗑️</button>
            </div>
        `;
        el.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this._openPlaylistEditor(data);
        });
        el.querySelector('.play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            try { this.close(); } catch(_) {}
            this._playPlaylistSequentially(data);
        });
        el.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Удалить плейлист "${data.name}"?`)) {
                el.remove();
                this.playlists = this.playlists.filter(p => p.id !== data.id);
                this._savePlaylistsToDB();
            }
        });
        container.prepend(el);
    }

    _updatePlaylistSummary() {
        const countEl = this.overlay.querySelector('#constructor-track-count');
        if (countEl) {countEl.textContent = String(this.currentPlaylist.length);}
    }

    _setPlusPulse(on) {
        try {
            const selector = '.add-btn, .add-to-playlist-btn, .add-to-setlist-btn';
            this.overlay.querySelectorAll(selector).forEach(btn => {
                if (on) {btn.classList.add('add-btn-pulse');} else {btn.classList.remove('add-btn-pulse');}
            });
        } catch(_) {}
    }

    _rerenderSavedPlaylists() {
        const container = this.overlay.querySelector('#saved-playlists');
        if (!container) {return;}
        container.innerHTML = '';
        [...this.playlists].reverse().forEach(p => this._renderSavedPlaylist(p));
    }

    // === Sequential playback (MVP) ===
    _playPlaylistSequentially(playlist) {
        if (!playlist || !Array.isArray(playlist.tracks) || playlist.tracks.length === 0) {return;}
        let index = 0;
        const playNext = () => {
            const t = playlist.tracks[index];
            if (!t) {return;}
            const all = (window.trackCatalog?.tracks || []);
            const candidate = all.find(x => (x.title || '').startsWith(t.title));
            if (!candidate) { index = (index + 1) % playlist.tracks.length; return playNext(); }
            const i = all.indexOf(candidate);
            window.trackCatalog.loadTrack(i, { autoplay: true, openSyncEditor: false }).then(() => {
                const ae = window.audioEngine;
                if (ae && typeof ae.onBothEnded === 'function') {
                    const unsub = ae.onBothEnded(() => {
                        if (typeof unsub === 'function') { try { unsub(); } catch(_) {} }
                        index = (index + 1) % playlist.tracks.length;
                        playNext();
                    });
                } else {
                    const duration = candidate.duration || 0;
                    setTimeout(() => { index = (index + 1) % playlist.tracks.length; playNext(); }, Math.max(500, duration * 1000));
                }
            });
        };
        playNext();
    }

    // === Редактор плейлиста (DnD) ===
    _openPlaylistEditor(playlist) {
        // Переиспользуем конструктор плейлиста для редактирования
        this.isBuildingPlaylist = true;
        this.currentPlaylist = [...playlist.tracks];
        this.currentPlaylistName = playlist.name;
        this.editingPlaylistId = playlist.id;
        const ctor = this.overlay.querySelector('#playlist-constructor');
        const btn = this.overlay.querySelector('#create-playlist-btn');
        if (btn) {btn.style.display = 'none';}
        if (ctor) {
            ctor.style.display = 'flex';
            const nameInput = this.overlay.querySelector('#playlist-name-input');
            if (nameInput) {nameInput.value = this.currentPlaylistName;}
            const list = this.overlay.querySelector('#constructor-tracks');
            if (list) {
                list.innerHTML = '';
                this.currentPlaylist.forEach(entry => {
                    const row = document.createElement('div');
                    row.className = 'constructor-track-item';
                    row.draggable = true;
                    row.dataset.trackId = entry.id;
                    row.innerHTML = `<span>${entry.title} - ${entry.artist || ''}</span><button class="remove-track-btn">❌</button>`;
                    row.querySelector('.remove-track-btn').addEventListener('click', () => {
                        row.remove();
                        this.currentPlaylist = this.currentPlaylist.filter(t => t.id !== entry.id);
                        this._updatePlaylistSummary();
                    });
                    list.appendChild(row);
                });
                this._enableDnD(list);
            }
            this._updatePlaylistSummary();
        }
    }

    _enableDnD(listEl) {
        let dragEl = null;
        listEl.addEventListener('dragstart', (e) => {
            const li = e.target.closest('.constructor-track-item');
            if (!li) {return;}
            dragEl = li;
            li.classList.add('dragging');
            listEl.classList.add('drag-target');
            e.dataTransfer.effectAllowed = 'move';
        });
        listEl.addEventListener('dragend', () => {
            if (dragEl) {dragEl.classList.remove('dragging');}
            listEl.classList.remove('drag-target');
            dragEl = null;
            // Обновляем порядок в currentPlaylist
            const order = Array.from(listEl.querySelectorAll('.constructor-track-item')).map(x => parseInt(x.dataset.trackId));
            const idToItem = new Map(this.currentPlaylist.map(x => [x.id, x]));
            this.currentPlaylist = order.map(id => idToItem.get(id)).filter(Boolean);
        });
        listEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterEl = this._getDragAfterElement(listEl, e.clientY);
            if (!dragEl) {return;}
            if (afterEl == null) {listEl.appendChild(dragEl);} else {listEl.insertBefore(dragEl, afterEl);}
        });
    }

    _getDragAfterElement(container, y) {
        const els = [...container.querySelectorAll('.constructor-track-item:not(.dragging)')];
        return els.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {return { offset, element: child };}
            else {return closest;}
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // === Persistence for playlists ===
    _savePlaylistsToDB() {
        try {
            if (!this.db) {return;}
            const tx = this.db.transaction('app_state', 'readwrite');
            const store = tx.objectStore('app_state');
            store.put({ key: 'playlists_v1', value: this.playlists, lastUpdated: Date.now() });
        } catch (e) {
            console.warn('Playlist save failed, fallback to localStorage', e);
            try { localStorage.setItem('playlists_v1', JSON.stringify(this.playlists)); } catch(_) {}
        }
    }
    _loadPlaylistsFromDB() {
        try {
            const tx = this.db.transaction('app_state', 'readonly');
            const store = tx.objectStore('app_state');
            const req = store.get('playlists_v1');
            req.onsuccess = () => {
                const val = req.result?.value;
                if (Array.isArray(val)) {
                    this.playlists = val;
                    this._rerenderSavedPlaylists();
                } else {
                    // fallback from localStorage
                    try {
                        const ls = localStorage.getItem('playlists_v1');
                        if (ls) { this.playlists = JSON.parse(ls); this._rerenderSavedPlaylists(); }
                    } catch(_) {}
                }
            };
        } catch (e) {
            console.warn('Playlist load failed, fallback to localStorage', e);
            try {
                const ls = localStorage.getItem('playlists_v1');
                if (ls) { this.playlists = JSON.parse(ls); this._rerenderSavedPlaylists(); }
            } catch(_) {}
        }
    }
    
    groupTracksByArtist(tracksArray = null) {
        const grouped = {};
        const tracks = tracksArray || this.tracks;

        tracks.forEach(track => {
            let artist = 'Неизвестный исполнитель';
            if (track && typeof track.artist === 'string' && track.artist.trim()) {
                artist = track.artist.trim();
            } else if (track && typeof track.title === 'string') {
                artist = this._extractArtistFromTitle(track.title) || artist;
            }
            if (!grouped[artist]) {grouped[artist] = [];}
            grouped[artist].push(track);
        });
        return grouped;
    }

    // Универсальный парсер "Исполнитель — Песня" с поддержкой разных тире и пробелов
    _extractArtistFromTitle(title) {
        try {
            // Нормализуем кавычки/пробелы, убираем мусорные хвосты типа [-]
            const cleaned = String(title)
                .replace(/\s+\[.*\]$/u, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
            // Разделители: -, – (en dash), — (em dash), ‒ (figure dash)
            const parts = cleaned.split(/\s*[\-–—‒]\s+/u);
            if (parts.length >= 2 && parts[0].trim().length > 0) {
                return parts[0].trim();
            }
        } catch(_) {}
        return null;
    }
    
    setupEventListeners() {
        // Кнопка тестирования
        const testBtn = document.getElementById('catalog-v2-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.open());
        }
        
        // Стильный крестик для закрытия (псевдоэлемент)
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                // Проверяем клик по контейнеру в области крестика
                const container = this.overlay.querySelector('.catalog-v2-container');
                if (container && e.target === container) {
                    const rect = container.getBoundingClientRect();
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    
                    // Область крестика (top: 15px, right: 20px, размер: 35px)
                    const closeAreaLeft = rect.right - 20 - 35;
                    const closeAreaTop = rect.top + 15;
                    const closeAreaRight = rect.right - 20;
                    const closeAreaBottom = rect.top + 15 + 35;
                    
                    if (clickX >= closeAreaLeft && clickX <= closeAreaRight &&
                        clickY >= closeAreaTop && clickY <= closeAreaBottom) {
                        this.close();
                        return;
                    }
                }
                
                // Закрытие по клику на фон
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Кнопка очистки IndexedDB — скрыта для пользователей; оставлена функция clearIndexedDB для админов
        
        // НОВЫЙ ФУНКЦИОНАЛ: Табы и переключатели
        this.setupTabsAndToggles();
    }
    
    setupTabsAndToggles() {
        // Управление табами в центральной колонке
        this.overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target);
            }
            
            if (e.target.classList.contains('toggle-btn')) {
                this.switchToggle(e.target);
            }
            
            // Обработчики для кнопок треков
            if (e.target.classList.contains('play-btn')) {
                this.playTrack(e.target);
            }
            
            if (e.target.classList.contains('add-btn')) {
                this.addToPlaylist(e.target);
            }

            // Удаление трека из общего каталога (правый столбец)
            if (e.target.classList.contains('delete-btn')) {
                const id = parseInt(e.target.dataset.trackId || e.target.closest('.track-item')?.dataset?.trackId);
                if (!id) {return;}
                this.deleteTrackFromCatalog(id);
            }

            // Плейлисты: делегированные обработчики (через closest, чтобы работали вложенные элементы)
            if (e.target.closest && e.target.closest('#create-playlist-btn')) {
                this._startPlaylistBuilding();
            }
            if (e.target.closest && e.target.closest('#confirm-playlist')) {
                this._confirmPlaylist();
            }
            if (e.target.closest && e.target.closest('#cancel-playlist')) {
                this._cancelPlaylistBuilding();
            }
        });
        
        // Обработчики для Upload Mode
        this.setupUploadMode();
    }
    
    setupUploadMode() {
        const fileInputs = {
            instrumental: document.getElementById('instrumental-input'),
            vocal: document.getElementById('vocal-input'),
            lyrics: document.getElementById('lyrics-input'),
            json: document.getElementById('json-input'),
            zip: document.getElementById('zip-input') // Добавляем ZIP input
        };
        
        const uploadCells = {
            instrumental: document.querySelector('.upload-cell[data-type="instrumental"]'),
            vocal: document.querySelector('.upload-cell[data-type="vocal"]'),
            lyrics: document.querySelector('.upload-cell[data-type="lyrics"]'),
            json: document.querySelector('.upload-cell[data-type="json"]'),
            zip: document.querySelector('.upload-cell[data-type="zip"]') // Добавляем ZIP cell
        };
        
        const saveButton = document.getElementById('upload-save');
        const cancelButton = document.getElementById('upload-cancel');
        
        // Обработка выбора файлов
        Object.keys(fileInputs).forEach(type => {
            const input = fileInputs[type];
            const cell = uploadCells[type];
            
            if (input && cell) {
                // Клик по ячейке открывает файловый диалог
                cell.addEventListener('click', () => {
                    input.click();
                });
                
                // Обработка выбора файла
                input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (type === 'zip') {
                            this.handleZipFileSelect(file, cell); // Специальный обработчик для ZIP
                        } else {
                        this.handleFileSelect(type, file, cell);
                        }
                    }
                });
                
                // Drag & Drop
                cell.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    cell.classList.add('drag-over');
                });
                
                cell.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    cell.classList.remove('drag-over');
                });
                
                cell.addEventListener('drop', (e) => {
                    e.preventDefault();
                    cell.classList.remove('drag-over');
                    
                    const file = e.dataTransfer.files[0];
                    if (file) {
                        input.files = e.dataTransfer.files;
                        if (type === 'zip') {
                            this.handleZipFileSelect(file, cell); // Специальный обработчик для ZIP
                        } else {
                        this.handleFileSelect(type, file, cell);
                        }
                    }
                });
            }
        });
        
        // Кнопки управления
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveTrack());
        }
        
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this.cancelUpload());
        }
    }
    
    switchTab(clickedTab) {
        const tabName = clickedTab.dataset.tab;
        
        // Убираем active у всех табов
        this.overlay.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Убираем active у всех панелей
        this.overlay.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Активируем выбранный таб и панель
        clickedTab.classList.add('active');
        const targetPanel = this.overlay.querySelector(`#${tabName}-panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
        
        console.log(`🔄 CatalogV2: Переключен на таб ${tabName}`);
    }
    
    switchToggle(clickedToggle) {
        const mode = clickedToggle.dataset.mode;
        
        // Убираем active у всех переключателей
        this.overlay.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Скрываем все режимы
        this.overlay.querySelectorAll('.search-mode-content, .upload-mode-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Активируем выбранный переключатель и режим
        clickedToggle.classList.add('active');
        const targetContent = this.overlay.querySelector(`.${mode}-mode-content`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        console.log(`🔄 CatalogV2: Переключен на режим ${mode}`);
    }
    
    playTrack(button) {
        const trackItem = button.closest('.track-item');
        if (!trackItem) {return;}
        
        const trackId = parseInt(trackItem.dataset.trackId);
        
        // Всегда стартуем воспроизведение в режиме Караоке
        try {
            if (window.app && typeof window.app._activateKaraokeMode === 'function') {
                window.app._activateKaraokeMode();
            }
        } catch (_) {}

        // 🎯 ИЩЕМ трек в ОБЪЕДИНЕННОМ массиве (основной каталог + новые треки CatalogV2)
        let track = null;
        
        // Сначала ищем в основном каталоге
        if (window.trackCatalog && window.trackCatalog.tracks) {
            track = window.trackCatalog.tracks.find(t => t.id === trackId);
        }
        
        // Если не найден в основном, ищем в CatalogV2
        if (!track) {
            track = this.tracks.find(t => t.id === trackId);
        }
        
        if (!track) {
            console.error('❌ CatalogV2: Трек не найден в обоих каталогах, ID:', trackId);
            this.showNotification('❌ Трек не найден');
            return;
        }
        
        console.log(`🎵 CatalogV2: Загружается трек "${track.title}" (ID: ${trackId})`);
        
        // Закрываем каталог
        this.close();
        
        // Загружаем трек через существующий API
        if (window.trackCatalog && typeof window.trackCatalog.loadTrack === 'function') {
            // Используем массив треков из оригинального TrackCatalog для правильного индекса
            const originalTrackIndex = window.trackCatalog.tracks.findIndex(t => t.id === trackId);
            if (originalTrackIndex !== -1) {
                console.log(`🎵 CatalogV2: Найден индекс ${originalTrackIndex} в оригинальном каталоге`);
                // Устанавливаем предпочтительный режим — Караоке
                try {
                    if (window.app && typeof window.app._activateKaraokeMode === 'function') {
                        window.app._activateKaraokeMode();
                    }
                } catch (_) {}
                // Загружаем без открытия Sync Editor и с автоплеем
                window.trackCatalog.loadTrack(originalTrackIndex, { openSyncEditor: false, autoplay: true });
            } else {
                console.error('❌ CatalogV2: Трек не найден в оригинальном каталоге');
                this.showNotification('❌ Трек не синхронизирован с основным каталогом');
            }
        } else {
            console.error('❌ CatalogV2: TrackCatalog API недоступен');
            this.showNotification('❌ TrackCatalog API недоступен');
        }
    }
    
    addToPlaylist(button) {
        const trackItem = button.closest('.track-item');
        if (!trackItem) {return;}
        
        const trackId = parseInt(trackItem.dataset.trackId);
        
        // 🎯 ИЩЕМ трек аналогично playTrack
        let track = null;
        
        // Сначала ищем в основном каталоге
        if (window.trackCatalog && window.trackCatalog.tracks) {
            track = window.trackCatalog.tracks.find(t => t.id === trackId);
        }
        
        // Если не найден в основном, ищем в CatalogV2
        if (!track) {
            track = this.tracks.find(t => t.id === trackId);
        }
        
        if (!track) {
            console.error('❌ CatalogV2: Трек не найден для плейлиста, ID:', trackId);
            this.showNotification('❌ Трек не найден');
            return;
        }
        
        // Режим конструктора плейлиста
        if (this.isBuildingPlaylist) {
            // Добавляем в текущий плейлист и помечаем чек‑маркой
            const entry = { id: track.id, title: track.title, artist: this._extractArtistFromTitle(track.title) || (track.artist || 'Неизвестный исполнитель') };
            // Уникальность по id
            if (!this.currentPlaylist.some(t => t.id === entry.id)) {
                this.currentPlaylist.push(entry);
                this._updatePlaylistSummary();
                // Галочка вместо плюса (без мигания)
                button.textContent = '✅';
                button.disabled = true;
                // Добавляем строку в конструктор
                const list = this.overlay.querySelector('#constructor-tracks');
                if (list) {
                    const row = document.createElement('div');
                    row.className = 'constructor-track-item';
                    row.innerHTML = `<span>${entry.title} - ${entry.artist}</span><button class="remove-track-btn">❌</button>`;
                    row.querySelector('.remove-track-btn').addEventListener('click', () => {
                        row.remove();
                        this.currentPlaylist = this.currentPlaylist.filter(t => t.id !== entry.id);
                        this._updatePlaylistSummary();
                        // Вернём плюс на соответствующей карточке, если найдём
                        const btn = this.overlay.querySelector(`.track-item[data-track-id="${entry.id}"] .add-btn`);
                        if (btn) { btn.textContent = '➕'; btn.disabled = false; }
                    });
                    const placeholder = list.querySelector('.drop-zone-message');
                    if (placeholder) {placeholder.style.display = 'none';}
                    list.appendChild(row);
                }
            }
            return;
        }

        // Обычный режим — добавить в "Мою музыку"
        console.log(`➕ CatalogV2: Добавление трека "${track.title}" в "Мою музыку"`);
        this.addToMyMusic(trackId).then(() => {
            this.renderMyMusic();
            this.showNotification(`✅ Трек "${track.title}" добавлен в "Мою музыку"`);
            // Короткий фидбек
        button.textContent = '✅';
            setTimeout(() => { button.textContent = '➕'; }, 1200);
        });
    }
    
    handleFileSelect(type, file, cell, fromZip = false) {
        console.log(`CatalogV2: handleFileSelect вызван для типа: ${type}, файла: ${file.name}, из ZIP: ${fromZip}`);
        this.uploadSession = this.uploadSession || {};
        console.log('CatalogV2: uploadSession до обработки файла:', JSON.parse(JSON.stringify(this.uploadSession)));

        switch (type) {
            case 'instrumental':
                this.uploadSession.instrumental = file;
                this.showNotification('info', `Инструментал ${file.name} загружен.`);
                break;
            case 'vocal':
                this.uploadSession.vocal = file;
                this.showNotification('info', `Вокал ${file.name} загружен.`);
                break;
            case 'lyrics':
                this.uploadSession.lyrics = file; // Сохраняем оригинальный файл
                const isRtf = file.name.toLowerCase().endsWith('.rtf') || file.type === 'application/rtf';
                this.readFileAsText(file).then(async (rawText) => { // Добавляем async
                    let processedText = rawText;
                    if (isRtf) {
                        console.log('CatalogV2: Обнаружен RTF файл для лирики. Парсинг...');
                        try {
                            // 🎯 ИСПРАВЛЕНО: Корректный вызов статического асинхронного метода parse
                            processedText = await RtfParserAdapter.parse(rawText);
                            if (!processedText) {
                                console.warn('CatalogV2: RTF парсер вернул пустой контент. Используем сырой текст как запасной вариант.');
                                processedText = rawText; // Fallback to raw if parsing fails
                            }
                        } catch (e) {
                            console.error('CatalogV2: Ошибка парсинга RTF в handleFileSelect, используем сырой текст. Ошибка:', e);
                            processedText = rawText; // Fallback to raw on error
                        }
                    } else {
                        console.log('CatalogV2: Загружен текстовый файл для лирики (не RTF).');
                    }
                    this.uploadSession.parsedLyricsContent = processedText; // Сохраняем распарсенный текст
                    this.updateSaveButton(); // Обновляем кнопку после парсинга
                }).catch(e => {
                    console.error('CatalogV2: Ошибка чтения файла лирики:', e);
                    this.showNotification('❌ Ошибка чтения файла лирики');
                    this.uploadSession.lyrics = null;
                    this.uploadSession.parsedLyricsContent = null;
                });
                break;
            case 'json':
                this.uploadSession.json = file;
                // Пробуем прочитать JSON и валидировать
                this.readFileAsText(file).then(text => {
                    try {
                        const data = JSON.parse(text);
                        if (Array.isArray(data)) {
                            this.uploadSession.jsonMarkers = data;
                            this.uploadSession.jsonTextBlocks = []; // Если JSON это просто массив маркеров, блоков нет
                        } else if (data && Array.isArray(data.markers)) {
                            this.uploadSession.jsonMarkers = data.markers;
                            // 🎯 ВАЖНО: СОХРАНЯЕМ TEXTBLOCKS ИЗ JSON
                            if (data.textBlocks && Array.isArray(data.textBlocks)) {
                                this.uploadSession.jsonTextBlocks = data.textBlocks;
                            } else {
                                this.uploadSession.jsonTextBlocks = [];
                            }
                        } else {
                            this.showNotification('❌ JSON должен содержать массив markers');
                            this.uploadSession.jsonMarkers = null;
                            this.uploadSession.jsonTextBlocks = null;
                        }
                    } catch (e) {
                        console.error('JSON parse error:', e);
                        this.showNotification('❌ Некорректный JSON файл');
                        this.uploadSession.jsonMarkers = null;
                        this.uploadSession.jsonTextBlocks = null;
                    }
                });
                break;
            case 'zip':
                this.uploadSession.zip = file;
                this.showNotification('info', `ZIP архив ${file.name} загружен.`);
                break;
        }
        console.log('CatalogV2: uploadSession после обработки файла:', JSON.parse(JSON.stringify(this.uploadSession)));
        // Обновляем состояние кнопки сохранения
        this.updateSaveButton();
        
        console.log(`🎵 Файл выбран для ${type}:`, file.name);
    }
    
    updateCellUI(cell, file) {
        // Обновляем текст в ячейке
        const dropText = cell.querySelector('.drop-text');
        if (dropText) {
            dropText.textContent = '✅ Файл загружен';
        }
        
        // Обновляем label файла
        const fileLabel = cell.querySelector('.file-label');
        if (fileLabel) {
            fileLabel.textContent = this._getFileNameWithoutExtension(file.name);
        }
        
        // Добавляем имя файла
        let fileNameDisplay = cell.querySelector('.file-name');
        if (!fileNameDisplay) {
            fileNameDisplay = document.createElement('div');
            fileNameDisplay.className = 'file-name';
            cell.appendChild(fileNameDisplay);
        }
        fileNameDisplay.textContent = file.name;
    }
    
    updateSaveButton() {
        const saveButton = document.getElementById('upload-save');
        if (saveButton) {
            const hasInstrumental = this.uploadSession.instrumental !== null;
            saveButton.disabled = !hasInstrumental;
            
            if (hasInstrumental) {
                saveButton.textContent = '💾 Сохранить трек';
            } else {
                saveButton.textContent = '💾 Выберите инструментал';
            }
        }
    }
    
    cancelUpload() {
        this._clearUploadCells();
        // Сбрасываем кнопку сохранения
        this.updateSaveButton();
        console.log('🔄 Upload session сброшена');
    }
    
    async saveTrack() {
        console.log('💾 CatalogV2: Сохранение трека...');
        console.log('💾 CatalogV2: uploadSession в начале saveTrack:', this.uploadSession);
        
        if (!this.uploadSession.instrumental) {
            this.showNotification('❌ Выберите инструментальную дорожку');
            console.error('💾 CatalogV2: Отмена сохранения - инструментал отсутствует.');
            return;
        }
        
        // 🎯 КРИТИЧНО: Проверяем готовность базы данных
        if (!window.trackCatalog.db) {
            console.warn('🔄 CatalogV2: База данных не готова, ожидаем инициализации...');
            
            // Ждём инициализации базы данных (максимум 5 секунд)
            let attempts = 0;
            const maxAttempts = 50; // 50 попыток по 100мс = 5 секунд
            
            while (!window.trackCatalog.db && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
                console.log(`🔄 CatalogV2: Попытка ${attempts}/${maxAttempts} ожидания базы данных...`);
            }
            
            if (!window.trackCatalog.db) {
                console.error('❌ CatalogV2: База данных не инициализировалась за 5 секунд');
                this.showNotification('❌ Ошибка: база данных недоступна');
                return;
            }
            
            console.log('✅ CatalogV2: База данных готова!');
        }
        
        try {
            // Показываем индикатор загрузки
            const saveBtn = document.getElementById('upload-save');
            if (saveBtn) {
                saveBtn.textContent = '⏳ Сохранение...';
                saveBtn.disabled = true;
            }
            
            console.log('🔧 CatalogV2: Обработка файлов...');
            console.log('💾 CatalogV2: Чтение инструментала из uploadSession:', this.uploadSession.instrumental);
            
            // Читаем все файлы
            const instrumentalData = await this.readFileAsArrayBuffer(this.uploadSession.instrumental);
            const instrumentalType = this.uploadSession.instrumental.type;
            
            let vocalsData = null;
            let vocalsType = null;
            if (this.uploadSession.vocal) {
                console.log('💾 CatalogV2: Чтение вокала из uploadSession:', this.uploadSession.vocal);
                vocalsData = await this.readFileAsArrayBuffer(this.uploadSession.vocal);
                vocalsType = this.uploadSession.vocal.type;
                console.log('✅ CatalogV2: Вокал прочитан');
            }
            
            let lyricsFileName = null;
            let lyricsOriginalContent = null;
            if (this.uploadSession.lyrics) {
                console.log('💾 CatalogV2: Чтение текста из uploadSession:', this.uploadSession.lyrics);
                lyricsOriginalContent = await this.readFileAsText(this.uploadSession.lyrics);
                lyricsFileName = this.uploadSession.lyrics.name;
                console.log('✅ CatalogV2: Текст прочитан');
            }
            
            let jsonFileName = null;
            let jsonContent = null;
            if (this.uploadSession.json) {
                console.log('💾 CatalogV2: Чтение JSON из uploadSession:', this.uploadSession.json);
                jsonContent = await this.readFileAsText(this.uploadSession.json);
                jsonFileName = this.uploadSession.json.name;
                console.log('✅ CatalogV2: JSON прочитан');
            }
            
            // Создаем объект трека
            const trackTitle = this.uploadSession.instrumental.name.replace(/\.[^/.]+$/, "");
            const trackData = {
                id: Date.now(),
                title: trackTitle,
                instrumentalData: instrumentalData,
                instrumentalType: instrumentalType,
                vocalsData: vocalsData,
                vocalsType: vocalsType,
                lyricsFileName: lyricsFileName,
                dateAdded: new Date().toISOString(),
                lyricsOriginalContent: this.uploadSession.parsedLyricsContent || lyricsOriginalContent, // 🎯 ИСПРАВЛЕНО: Используем распарсенный текст
                // 🎯 ВАЖНО: Добавляем пустой массив блоков для последующего редактирования
                blocksData: Array.isArray(this.uploadSession?.jsonTextBlocks) ? this.uploadSession.jsonTextBlocks : [],
                lyrics: this.uploadSession.parsedLyricsContent || lyricsOriginalContent, // 🎯 ИСПРАВЛЕНО: Используем распарсенный текст
                lastModified: new Date().toISOString(),
                // Если приложены маркеры JSON — сохраняем их сразу
                syncMarkers: Array.isArray(this.uploadSession?.jsonMarkers) ? this.uploadSession.jsonMarkers : []
            };
            
            console.log('📝 CatalogV2: Данные трека готовы:', trackTitle);
            
            // Сохраняем в IndexedDB
            console.log('🔄 CatalogV2: Сохранение в IndexedDB...');
            const savedTrack = await window.trackCatalog._saveTrackToDB(trackData);
            console.log('✅ CatalogV2: Трек сохранен в IndexedDB с ID:', savedTrack.id);
            
            // Добавляем в массив основного каталога
            window.trackCatalog.tracks.push(savedTrack);
            console.log('✅ CatalogV2: Трек добавлен в локальный массив');

            // --- ДОБАВЛЕНО: Загружаем лирику в LyricsDisplay перед установкой маркеров ---
            if (window.lyricsDisplay && savedTrack.lyrics && savedTrack.lyrics.length > 0) {
                // Если duration не задан, пытаемся получить его из audioEngine (если трек уже загружен туда)
                // Или просто передаем 0, так как lyricsDisplay справится без него для init
                const trackDuration = savedTrack.duration || (window.audioEngine?.duration || 0);
                window.lyricsDisplay.loadLyrics(savedTrack.lyrics, trackDuration, false); // Загружаем, но пока не рендерим
                console.log('✅ CatalogV2: Лирика загружена в LyricsDisplay перед обработкой маркеров.');
            }
            // --- КОНЕЦ ДОБАВЛЕНИЯ ---

            // Если есть маркеры — применяем в UI сразу
            try {
                if (savedTrack.syncMarkers && savedTrack.syncMarkers.length > 0 && window.markerManager) {
                    window.markerManager.setMarkers(savedTrack.syncMarkers);
                }
            } catch (e) { console.warn('Не удалось применить маркеры из JSON сразу:', e); }

            // 🎯 ВАЖНО: Добавляем трек в результаты поиска, а НЕ в "Мою музыку"
            this.addTrackToSearchResults(savedTrack);
            console.log('✅ CatalogV2: Трек добавлен в результаты поиска');
            
            // Показываем уведомление
            this.showNotification(`✅ Трек "${trackTitle}" успешно сохранен!`);
            console.log('🔔 CatalogV2: ✅ Трек "' + trackTitle + '" успешно сохранен!');
            
            // Очищаем форму
            this.cancelUpload();
            
            // 🎯 ЛОГИКА: если есть JSON маркеры — редактор блоков НЕ открываем и трек не автозапускаем
            const hasJsonMarkers = Array.isArray(savedTrack?.syncMarkers) && savedTrack.syncMarkers.length > 0;
            if (hasJsonMarkers) {
                console.log('✅ CatalogV2: JSON маркеры присутствуют, пропускаем редактор блоков. Трек доступен в поиске и "Моей музыке" (если добавите).');
                try {
                    // Маркеры уже в savedTrack.syncMarkers — применим цвета от блоков (если они будут)
                    if (window.markerManager) {
                        window.markerManager.setMarkers(savedTrack.syncMarkers);
                        window.markerManager.updateMarkerColors();
                    }
                    // Если LyricsDisplay уже содержит textBlocks (синтезированные из маркеров), включим репетиционный UI
                    if (window.lyricsDisplay && Array.isArray(window.lyricsDisplay.textBlocks) && window.lyricsDisplay.textBlocks.length > 0) {
                        if (typeof window.lyricsDisplay.activateRehearsalDisplay === 'function') {
                            window.lyricsDisplay.activateRehearsalDisplay();
                        }
                    }
                } catch (e) { console.warn('CatalogV2: post-save JSON handling failed', e); }
                this.switchToSearch();
                // this.addTrackToSearchResults(savedTrack); // Отключено, так как вызывается в _saveTrackToDB
                return; // Не открываем редакторы
            } else {
                // Иначе — старое поведение: открыть редактор блоков
                console.log('🎯 CatalogV2: Открываем редактор блоков для обработки трека');
                setTimeout(() => {
                    this.openBlockEditorForTrack(savedTrack);
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ CatalogV2: Ошибка при сохранении трека:', error);
            this.showNotification('❌ Ошибка при сохранении трека');
        } finally {
            // Сбрасываем индикатор загрузки и включаем кнопку сохранения
            const saveBtn = document.getElementById('upload-save');
            if (saveBtn) {
                saveBtn.textContent = '💾 Сохранить трек';
                saveBtn.disabled = false;
            }
            // Полная очистка всех ячеек после сохранения
            // this._clearUploadCells(); // УДАЛЕНО: Теперь очистка происходит только для ZIP-ячейки в handleZipFileSelect
            console.log('💾 CatalogV2: uploadSession после сохранения и очистки всех ячеек:', this.uploadSession);
            
            // Перенаправляем в каталог после успешного сохранения
            // this.cancelUpload(); // УДАЛЕНО: Этот вызов приводил к преждевременной очистке uploadSession
            // window.app.viewManager.showView('catalog'); // Assuming this is the correct way to navigate
        }
    }
    
    // 🎯 НОВАЯ ФУНКЦИЯ: Добавление трека в результаты поиска
    addTrackToSearchResults(track) {
        // Переключаемся на режим поиска
        this.switchToggle(document.querySelector('.toggle-btn[data-mode="search"]'));
        
        // Находим контейнер результатов поиска
        const searchResults = document.querySelector('.search-results');
        if (!searchResults) {return;}
        
        // Убираем пустое состояние
        const emptyState = searchResults.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Создаем элемент трека
        const trackElement = document.createElement('div');
        trackElement.className = 'search-result-item track-item';
        trackElement.setAttribute('data-track-id', track.id); // 🎯 ВАЖНО: добавляем ID трека
        trackElement.innerHTML = `
            <div class="track-title">${track.title}</div>
            <div class="track-actions">
                <button class="track-action-btn play-btn" data-track-id="${track.id}">▶</button>
                <button class="track-action-btn add-btn" data-track-id="${track.id}">➕</button>
                <button class="track-action-btn delete-btn" data-track-id="${track.id}" title="Удалить трек">✕</button>
            </div>
        `;
        
        // 🎯 ВАЖНО: НЕ добавляем отдельные обработчики, используем делегирование событий
        
        // Добавляем в начало списка
        if (searchResults.firstChild && !searchResults.firstChild.classList?.contains('empty-state')) {
            searchResults.insertBefore(trackElement, searchResults.firstChild);
        } else {
            searchResults.appendChild(trackElement);
        }
        
        // Анимация появления
        trackElement.style.opacity = '0';
        trackElement.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            trackElement.style.transition = 'all 0.3s ease';
            trackElement.style.opacity = '1';
            trackElement.style.transform = 'translateY(0)';
        }, 100);
    }

    // 🗑️ Удаление трека из общего каталога (IndexedDB + UI)
    async deleteTrackFromCatalog(trackId) {
        try {
            if (!confirm('Удалить трек из каталога?')) {return;}
            // Удаление из основной БД треков
            if (window.trackCatalog && typeof window.trackCatalog.deleteTrack === 'function') {
                // deleteTrack не возвращает Promise — запускаем и сразу обновляем UI
                window.trackCatalog.deleteTrack(trackId);
            }
            // Удаляем из "Моей музыки", если присутствует
            try { await this.removeFromMyMusic(trackId); } catch(_) {}
            // Немедленное удаление из DOM (правой колонки)
            try {
                const item = document.querySelector(`.search-results .track-item[data-track-id="${trackId}"]`);
                if (item && item.parentElement) {item.parentElement.removeChild(item);}
            } catch(_) {}
            // Отложенная перерисовка (даём IndexedDB завершить операцию)
            setTimeout(() => this.renderSearchAllTracks(), 200);
            try { this.renderMyMusic(); } catch(_) {}
            this.showNotification('✅ Трек удалён');
        } catch (err) {
            console.error('❌ CatalogV2: Не удалось удалить трек', err);
            this.showNotification('❌ Ошибка удаления трека');
        }
    }
    
    // 🗑️ ФУНКЦИЯ ОЧИСТКИ IndexedDB
    async clearIndexedDB() {
        console.log('🗑️ CatalogV2: Очистка IndexedDB...');
        
        try {
            const deleteRequest = indexedDB.deleteDatabase('TextAppDB');
            
            deleteRequest.onsuccess = () => {
                console.log('✅ CatalogV2: IndexedDB полностью очищен');
                this.showNotification('✅ База данных очищена');
                
                // Перезагружаем страницу для полного сброса
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            };
            
            deleteRequest.onerror = (event) => {
                console.error('❌ CatalogV2: Ошибка очистки IndexedDB:', event);
                this.showNotification('❌ Ошибка очистки базы данных');
            };
            
        } catch (error) {
            console.error('❌ CatalogV2: Критическая ошибка очистки:', error);
        }
    }
    
    // 🎯 НОВЫЙ МЕТОД: Открытие редактора блоков для трека
    async openBlockEditorForTrack(track) {
        console.log('🎯 CatalogV2: Подготовка редактора блоков для трека:', track.title);
        
        try {
            // Закрываем каталог
            this.close();
            
            // Загружаем трек в основное приложение
            console.log('🔄 CatalogV2: Загружаем трек в приложение...');
            await this.loadTrackIntoApp(track);
            
            // Небольшая задержка для завершения загрузки
            const startTs = performance.now();
            const maxWaitMs = 5000;
            const waitReady = async () => {
                const ready = window.waveformEditor
                    && typeof window.waveformEditor._openNewBlockEditor === 'function'
                    && window.waveformEditor.currentTrackId === track.id;
                if (ready) {
                    console.log('🎯 CatalogV2: WaveformEditor готов. Открываем Block Editor');
                    window.waveformEditor._openNewBlockEditor();
                    return;
                }
                if (performance.now() - startTs > maxWaitMs) {
                    console.warn('⚠️ CatalogV2: Не удалось дождаться готовности WaveformEditor для Block Editor');
                    this.showNotification('⚠️ Редактор блоков недоступен: таймаут ожидания');
                    return;
                }
                setTimeout(waitReady, 150);
            };
            waitReady();
            
        } catch (error) {
            console.error('❌ CatalogV2: Ошибка при открытии редактора блоков:', error);
            this.showNotification('❌ Ошибка открытия редактора блоков');
        }
    }
    
    // 🔄 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Загрузка трека в приложение
    async loadTrackIntoApp(track) {
        if (!window.trackCatalog || typeof window.trackCatalog.loadTrack !== 'function') {
            throw new Error('TrackCatalog недоступен');
        }
        
        // 🎯 ПРИНУДИТЕЛЬНО ПЕРЕЗАГРУЖАЕМ ТРЕКИ ИЗ БД ДЛЯ ПОЛУЧЕНИЯ СВЕЖИХ ДАННЫХ
        console.log('🔄 CatalogV2: Принудительно перезагружаем треки из IndexedDB для получения актуальных блоков...');
        await window.trackCatalog._loadTracksFromDB();
        
        // Находим индекс трека в основном каталоге
        const trackIndex = window.trackCatalog.tracks.findIndex(t => t.id === track.id);
        if (trackIndex === -1) {
            throw new Error('Трек не найден в основном каталоге');
        }
        
        // 🎯 ПРОВЕРЯЕМ НАЛИЧИЕ БЛОКОВ В ТРЕКЕ
        const foundTrack = window.trackCatalog.tracks[trackIndex];
        console.log(`🔍 CatalogV2: Найден трек "${foundTrack.title}":`, {
            hasBlocksData: !!foundTrack.blocksData,
            blocksCount: foundTrack.blocksData ? foundTrack.blocksData.length : 0,
            hasLyrics: !!foundTrack.lyrics,
            lastModified: foundTrack.lastModified
        });
        
        console.log(`🔄 CatalogV2: Загружаем трек с индексом ${trackIndex}`);
        await window.trackCatalog.loadTrack(trackIndex);
        
        return trackIndex;
    }
    
    async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
    
    async readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }
    
    showNotification(message) {
        // Используем систему уведомлений приложения если доступна
        if (window.app && typeof window.app.showNotification === 'function') {
            // Определяем тип уведомления по первому символу
            const type = message.startsWith('✅') ? 'success' : 
                        message.startsWith('❌') ? 'error' : 'info';
            const cleanMessage = message.replace(/^[✅❌ℹ️]+\s*/, '');
            window.app.showNotification(cleanMessage, type);
        } else {
            // Fallback - console.log с красивым форматированием
            const bgColor = message.startsWith('✅') ? 'background: #4CAF50; color: white;' :
                           message.startsWith('❌') ? 'background: #f44336; color: white;' :
                           'background: #2196F3; color: white;';
            console.log(`%c🔔 CatalogV2: ${message}`, bgColor + ' padding: 4px 8px; border-radius: 4px;');
        }
    }
    
    open() {
        if (!this.overlay) {return;}
        
        this.overlay.classList.remove('hidden');
        this.isOpen = true;
        
        console.log('📁 CatalogV2: Overlay открыт');
    }
    
    close() {
        if (!this.overlay) {return;}
        
        this.overlay.classList.add('hidden');
        this.isOpen = false;
        
        console.log('🔄 CatalogV2: Overlay закрыт');
    }

    async loadMyMusicFromDB() {
        if (!this.db) {return;}
        try {
            const tx = this.db.transaction(['my_music'], 'readonly');
            const store = tx.objectStore('my_music');
            const req = store.getAll();
            req.onsuccess = () => {
                const rows = req.result || [];
                this.myMusicIds = new Set(rows.map(r => r.trackId));
                this.renderMyMusic();
            };
        } catch(_) {}
    }

    async addToMyMusic(trackId) {
        if (!this.db || !trackId) {return;}
        try {
            const tx = this.db.transaction(['my_music'], 'readwrite');
            const store = tx.objectStore('my_music');
            store.put({ trackId, addedAt: new Date().toISOString() });
            this.myMusicIds.add(trackId);
        } catch(_) {}
    }

    async removeFromMyMusic(trackId) {
        if (!this.db || !trackId) {return;}
        try {
            const tx = this.db.transaction(['my_music'], 'readwrite');
            const store = tx.objectStore('my_music');
            store.delete(trackId);
            this.myMusicIds.delete(trackId);
        } catch(_) {}
    }

    // НОВЫЙ МЕТОД: Обработка ZIP-файлов
    async handleZipFileSelect(file, cell) {
        console.log('🗜️ CatalogV2: Начало обработки ZIP файла:', file.name);
        cell.classList.add('processing', 'file-selected');
        try {
            const zip = await JSZip.loadAsync(file);
            console.log('🗜️ ZIP: Архив успешно загружен.');
            
            const files = [];
            zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir) {
                    // Игнорируем файлы из папки __MACOSX и файлы, начинающиеся с '._'
                    if (relativePath.startsWith('__MACOSX/') || zipEntry.name.split('/').pop().startsWith('._')) {
                        return; 
                    }
                    files.push({ relativePath, zipEntry });
                    console.log('🗜️ ZIP: Найден файл:', relativePath);
                }
            });
            
            // Логика для определения вокальной дорожки с приоритетом _Vocals_ / _Vocal_
            let instrumentalFile = null;
            let vocalFile = null;
            let lyricsFile = null;
            let jsonFile = null;
            
            const audioExtensions = ['mp3', 'wav', 'flac', 'ogg', 'aac'];
            const textExtensions = ['txt', 'text', 'lrc', 'md', 'rtf', 'doc', 'docx', 'srt', 'sub', 'vtt', 'ass', 'ssa', 'xml', 'json', 'csv'];
            
            const potentialVocals = [];
            
            for (const { relativePath, zipEntry } of files) {
                const fileName = relativePath.toLowerCase();
                const fileExt = this._getFileExtension(fileName); // Используем this._getFileExtension
                
                if (audioExtensions.includes(fileExt)) {
                    if (fileName.includes('_vocals_') || fileName.includes('_vocal')) {
                        potentialVocals.unshift({ relativePath, zipEntry }); // Приоритет в начало
                        console.log('🗜️ ZIP: Потенциальный вокал (высокий приоритет): ', relativePath);
                    } else if (fileName.includes('vocals')) {
                        potentialVocals.push({ relativePath, zipEntry });
                        console.log('🗜️ ZIP: Потенциальный вокал (средний приоритет): ', relativePath);
                    } else if (!instrumentalFile) {
                        instrumentalFile = { relativePath, zipEntry };
                        console.log('🗜️ ZIP: Инструментал (по умолчанию): ', relativePath);
                    }
                } else if (fileExt === 'json') {
                    if (!jsonFile) {jsonFile = { relativePath, zipEntry }; console.log('🗜️ ZIP: Найден JSON:', relativePath);}
                } else if (textExtensions.includes(fileExt)) {
                    if (!lyricsFile) {lyricsFile = { relativePath, zipEntry }; console.log('🗜️ ZIP: Найден текст:', relativePath);}
                }
            }
            
            // Выбираем лучшую вокальную дорожку из потенциальных
            if (potentialVocals.length > 0) {
                vocalFile = potentialVocals[0];
                // Если вокальный файл занял место инструментала, очищаем инструментал
                if (instrumentalFile && instrumentalFile.relativePath === vocalFile.relativePath) {
                    instrumentalFile = null;
                }
            }
            
            // Если инструментал еще не найден, ищем его среди оставшихся аудиофайлов
            if (!instrumentalFile) {
                for (const { relativePath, zipEntry } of files) {
                    const fileName = relativePath.toLowerCase();
                    const fileExt = this._getFileExtension(fileName); // Используем this._getFileExtension
                    if (audioExtensions.includes(fileExt) &&
                        (!vocalFile || vocalFile.relativePath !== relativePath)) {
                        instrumentalFile = { relativePath, zipEntry };
                        break;
                    }
                }
            }
            
            // Распределяем файлы по ячейкам
            console.log('🗜️ ZIP: Распределение файлов по ячейкам.');
            if (instrumentalFile) {
                const blob = await instrumentalFile.zipEntry.async('blob');
                console.log('🗜️ ZIP (Instrumental): Blob создан. Тип:', blob.type, 'Размер:', blob.size);
                const fileObj = new File([blob], this._getBaseNameFromPath(instrumentalFile.zipEntry.name), { type: blob.type });
                console.log('🗜️ ZIP (Instrumental): File объект создан:', fileObj.name, 'Тип:', fileObj.type, 'Размер:', fileObj.size);
                this.handleFileSelect('instrumental', fileObj, document.querySelector('.upload-cell[data-type="instrumental"]'), true); // ОБНОВЛЯЕМ UI
            }
            if (vocalFile) {
                console.log('🗜️ ZIP (Vocal): Найдена запись вокала:', vocalFile.relativePath);
                const blob = await vocalFile.zipEntry.async('blob');
                console.log('🗜️ ZIP (Vocal): Blob создан. Тип:', blob.type, 'Размер:', blob.size);
                if (blob.size === 0) {
                    console.warn('🗜️ ZIP (Vocal): Создан пустой Blob для вокальной дорожки!');
                }
                const fileObj = new File([blob], this._getBaseNameFromPath(vocalFile.zipEntry.name), { type: blob.type });
                console.log('🗜️ ZIP (Vocal): File объект создан:', fileObj.name, 'Тип:', fileObj.type, 'Размер:', fileObj.size);
                this.handleFileSelect('vocal', fileObj, document.querySelector('.upload-cell[data-type="vocal"]'), true); // ОБНОВЛЯЕМ UI
            }
            if (lyricsFile) {
                console.log('🗜️ ZIP (Lyrics): Найдена запись лирики:', lyricsFile.relativePath);
                const text = await lyricsFile.zipEntry.async('string');
                const fileObj = new File([new Blob([text], { type: 'text/plain' })], this._getBaseNameFromPath(lyricsFile.zipEntry.name), { type: 'text/plain' });
                this.handleFileSelect('lyrics', fileObj, document.querySelector('.upload-cell[data-type="lyrics"]'), true); // ОБНОВЛЯЕМ UI
            }
            if (jsonFile) {
                console.log('🗜️ ZIP (JSON): Найдена запись JSON:', jsonFile.relativePath);
                const text = await jsonFile.zipEntry.async('string');
                const fileObj = new File([new Blob([text], { type: 'application/json' })], this._getBaseNameFromPath(jsonFile.zipEntry.name), { type: 'application/json' });
                this.handleFileSelect('json', fileObj, document.querySelector('.upload-cell[data-type="json"]'), true); // ОБНОВЛЯЕМ UI
            }
            
            console.log('CatalogV2: uploadSession после распределения файлов:', this.uploadSession);
            this.showNotification('success', '✅ ZIP архив успешно распакован и файлы распределены!');
            
            console.log('CatalogV2: ZIP архив успешно распакован. Вызов saveTrack напрямую.');
            await this.saveTrack();

        } catch (error) {
            console.error('❌ Ошибка обработки ZIP файла:', error);
            this.showNotification('❌ Ошибка обработки ZIP файла');
        } finally {
            // Очищаем только ZIP-ячейку после полного завершения обработки
            console.log('CatalogV2: Очистка ZIP-ячейки в finally блоке.');
            this._clearUploadCells('zip');
            cell.classList.remove('processing');
            cell.classList.remove('file-selected'); // Удаляем 'file-selected' для ZIP-ячейки
        }
    }

    _getFileNameWithoutExtension(fileName) {
        if (!fileName) return '';
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    }

    _getFileExtension(fileName) {
        if (!fileName) return '';
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';
    }

    // Helper methods for file processing (now part of the class)
    _getBaseNameFromPath(fullPath) {
        if (!fullPath) return '';
        const lastSlashIndex = fullPath.lastIndexOf('/');
        return lastSlashIndex !== -1 ? fullPath.substring(lastSlashIndex + 1) : fullPath;
    }

    _getFileNameWithoutExtension(fileName) {
        if (!fileName) return '';
        const baseName = this._getBaseNameFromPath(fileName); // Get base name first
        const lastDotIndex = baseName.lastIndexOf('.');
        return lastDotIndex !== -1 ? baseName.substring(0, lastDotIndex) : baseName;
    }

    _getFileExtension(fileName) {
        if (!fileName) return '';
        const baseName = this._getBaseNameFromPath(fileName); // Get extension from base name
        const lastDotIndex = baseName.lastIndexOf('.');
        return lastDotIndex !== -1 ? baseName.substring(lastDotIndex + 1) : '';
    }

    _clearUploadCells(typeToClear) {
        console.log('🧹 Очистка ячеек загрузки...', typeToClear ? `только тип: ${typeToClear}` : 'все');
        // Clear uploadSession
        if (typeToClear) {
            if (this.uploadSession[typeToClear]) {
                console.log(`🧹 Очистка uploadSession для типа: ${typeToClear}`);
                this.uploadSession[typeToClear] = null;
            }
        } else {
            console.log('🧹 Полная очистка uploadSession.');
            this.uploadSession = {};
        }

        // Clear UI for upload cells
        const uploadCellTypes = typeToClear ? [typeToClear] : ['instrumental', 'vocal', 'lyrics', 'json', 'zip'];
        uploadCellTypes.forEach(type => {
            const cell = document.querySelector(`.upload-cell[data-type="${type}"]`);
            if (cell) {
                cell.classList.remove('has-file', 'processing');
                const icon = cell.querySelector('.icon');
                if (icon) {
                    icon.style.display = ''; // Reset to default display
                }
                const dropText = cell.querySelector('.drop-text');
                if (dropText) {
                    dropText.style.display = ''; // Reset to default display
                }
                const fileLabel = cell.querySelector('.file-label');
                if (fileLabel) {
                    fileLabel.textContent = type === 'zip' ? 'Drop ZIP file' : `Upload ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                }
                let fileNameDisplay = cell.querySelector('.file-name');
                if (fileNameDisplay) {
                    fileNameDisplay.remove(); // Remove the file name display
                }
                // Reset file input value to allow re-uploading the same file
                const input = cell.querySelector('input[type="file"]');
                if (input) {
                    input.value = '';
                }
            }
        });
        console.log('✅ Ячейки загрузки очищены.');
    }
}

console.log('✅ ЗАГРУЗКА: catalog-v2.js загружен, класс CatalogV2 определен');
window.CatalogV2 = CatalogV2; 