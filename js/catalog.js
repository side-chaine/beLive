/**
 * Catalog V2 - Новый каталог на основе catalog-design-test.html
 */

class CatalogV2 {
    constructor() {
        this.overlay = null;
        this.isOpen = false;
        this.tracks = [];
        this.db = null;
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
    }
    
    initDatabase() {
        // Подключаемся к уже существующей базе данных
        const request = indexedDB.open('TextAppDB', 5);
        
        request.onsuccess = (event) => {
            this.db = event.target.result;
            console.log('🎵 CatalogV2: База данных подключена');
            this.loadTracksFromDB();
        };
        
        request.onerror = (event) => {
            console.error('❌ CatalogV2: Ошибка подключения к базе данных:', event.target.error);
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
            
            request.onsuccess = () => {
                this.tracks = request.result || [];
                console.log(`🎵 CatalogV2: Загружено ${this.tracks.length} треков`);
                this.renderMyMusic();
            };
            
            request.onerror = () => {
                console.error('❌ CatalogV2: Ошибка загрузки треков');
            };
        } catch (error) {
            console.error('❌ CatalogV2: Ошибка при работе с базой данных:', error);
        }
    }
    
    renderMyMusic() {
        const myMusicContent = this.overlay.querySelector('.my-music-content');
        if (!myMusicContent) {return;}
        
        if (this.tracks.length === 0) {
            myMusicContent.innerHTML = '<p class="empty-state">Загрузите треки через "Upload Track" →</p>';
            return;
        }
        
        // Группируем треки по исполнителям/альбомам
        const groupedTracks = this.groupTracksByArtist();
        
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
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        myMusicContent.innerHTML = html;
    }
    
    groupTracksByArtist() {
        const grouped = {};
        
        this.tracks.forEach(track => {
            // Пытаемся определить исполнителя из названия или метаданных
            let artist = 'Неизвестный исполнитель';
            
            if (track.artist) {
                artist = track.artist;
            } else if (track.title) {
                // Пытаемся извлечь исполнителя из названия (формат "Исполнитель - Песня")
                const dashIndex = track.title.indexOf(' - ');
                if (dashIndex > 0) {
                    artist = track.title.substring(0, dashIndex);
                }
            }
            
            if (!grouped[artist]) {
                grouped[artist] = [];
            }
            grouped[artist].push(track);
        });
        
        return grouped;
    }
    
    setupEventListeners() {
        // Кнопка тестирования
        const testBtn = document.getElementById('catalog-v2-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.open());
        }
        
        // Кнопка закрытия
        const closeBtn = document.getElementById('catalog-v2-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Закрытие по клику на фон
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
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
        });
        
        // Обработчики для Upload Mode
        this.setupUploadMode();
    }
    
    setupUploadMode() {
        // Обработчики для файловых инпутов
        ['instrumental', 'vocal', 'lyrics'].forEach(type => {
            const input = this.overlay.querySelector(`#${type}-input`);
            if (input) {
                input.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        this.handleFileSelect(type, e.target.files[0]);
                    }
                });
            }
        });
        
        // Drag-and-drop для upload cells
        this.overlay.querySelectorAll('.upload-cell').forEach(cell => {
            const type = cell.dataset.type;
            
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                cell.classList.add('drag-over');
            });
            
            cell.addEventListener('dragleave', (e) => {
                if (!cell.contains(e.relatedTarget)) {
                    cell.classList.remove('drag-over');
                }
            });
            
            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect(type, files[0]);
                }
            });
        });
        
        // Кнопки управления
        const cancelBtn = this.overlay.querySelector('#upload-cancel');
        const saveBtn = this.overlay.querySelector('#upload-save');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelUpload());
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTrack());
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
        const track = this.tracks.find(t => t.id === trackId);
        
        if (!track) {
            console.error('❌ CatalogV2: Трек не найден');
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
                window.trackCatalog.loadTrack(originalTrackIndex);
            } else {
                console.error('❌ CatalogV2: Трек не найден в оригинальном каталоге');
            }
        } else {
            console.error('❌ CatalogV2: TrackCatalog API недоступен');
            // Альтернативный способ - проверим существует ли глобальная переменная
            if (window.app && window.app.trackCatalog && typeof window.app.trackCatalog.loadTrack === 'function') {
                const originalTrackIndex = window.app.trackCatalog.tracks.findIndex(t => t.id === trackId);
                if (originalTrackIndex !== -1) {
                    console.log(`🎵 CatalogV2: Найден индекс ${originalTrackIndex} в app.trackCatalog`);
                    window.app.trackCatalog.loadTrack(originalTrackIndex);
                } else {
                    console.error('❌ CatalogV2: Трек не найден в app.trackCatalog');
                }
            } else {
                console.error('❌ CatalogV2: Альтернативный TrackCatalog API также недоступен');
            }
        }
    }
    
    addToPlaylist(button) {
        const trackItem = button.closest('.track-item');
        if (!trackItem) {return;}
        
        const trackId = parseInt(trackItem.dataset.trackId);
        const track = this.tracks.find(t => t.id === trackId);
        
        if (!track) {
            console.error('❌ CatalogV2: Трек не найден');
            return;
        }
        
        console.log(`➕ CatalogV2: Добавление трека "${track.title}" в плейлист`);
        
        // Временно просто уведомляем, потом добавим плейлисты
        button.textContent = '✅';
        button.disabled = true;
        
        setTimeout(() => {
            button.textContent = '➕';
            button.disabled = false;
        }, 2000);
    }
    
    handleFileSelect(type, file) {
        console.log(`📁 CatalogV2: Выбран файл для ${type}:`, file.name);
        
        // Сохраняем файл в сессии
        this.uploadSession[type] = file;
        
        // Обновляем UI
        const cell = this.overlay.querySelector(`[data-type="${type}"]`);
        if (cell) {
            cell.classList.add('has-file');
            const dropText = cell.querySelector('.drop-text');
            if (dropText) {
                dropText.textContent = `✅ ${file.name}`;
            }
        }
        
        // Проверяем можно ли сохранять
        this.updateSaveButton();
    }
    
    updateSaveButton() {
        const saveBtn = this.overlay.querySelector('#upload-save');
        if (!saveBtn) {return;}
        
        // Требуется хотя бы инструментальная дорожка
        const hasInstrumental = this.uploadSession.instrumental !== null;
        
        saveBtn.disabled = !hasInstrumental;
        
        if (hasInstrumental) {
            console.log('✅ CatalogV2: Готов к сохранению трека');
        }
    }
    
    cancelUpload() {
        console.log('❌ CatalogV2: Отмена загрузки');
        
        // Очищаем сессию
        this.uploadSession = {
            instrumental: null,
            vocal: null,
            lyrics: null
        };
        
        // Очищаем UI
        this.overlay.querySelectorAll('.upload-cell').forEach(cell => {
            cell.classList.remove('has-file');
            const dropText = cell.querySelector('.drop-text');
            if (dropText) {
                const type = cell.dataset.type;
                const defaultTexts = {
                    instrumental: 'Перетащите файл или нажмите для выбора',
                    vocal: 'Перетащите файл или нажмите для выбора',
                    lyrics: 'Перетащите .txt или .rtf файл'
                };
                dropText.textContent = defaultTexts[type];
            }
        });
        
        // Очищаем файловые инпуты
        this.overlay.querySelectorAll('.file-input').forEach(input => {
            input.value = '';
        });
        
        // Восстанавливаем кнопку сохранения
        const saveBtn = this.overlay.querySelector('#upload-save');
        if (saveBtn) {
            saveBtn.textContent = '💾 Сохранить трек';
            saveBtn.disabled = true; // Отключена пока нет инструментала
        }
        
        this.updateSaveButton();
    }
    
    async saveTrack() {
        console.log('💾 CatalogV2: Сохранение трека...');
        
        if (!this.uploadSession.instrumental) {
            console.error('❌ CatalogV2: Нет инструментальной дорожки');
            return;
        }
        
        try {
            // Показываем индикатор загрузки
            const saveBtn = this.overlay.querySelector('#upload-save');
            if (saveBtn) {
                saveBtn.textContent = '⏳ Сохранение...';
                saveBtn.disabled = true;
            }
            
            console.log('🔧 CatalogV2: Обработка файлов...');
            
            // Читаем аудиофайлы как ArrayBuffer
            const instrumentalData = await this.readFileAsArrayBuffer(this.uploadSession.instrumental);
            console.log('✅ CatalogV2: Инструментал прочитан');
            
            let vocalsData = null;
            if (this.uploadSession.vocal) {
                vocalsData = await this.readFileAsArrayBuffer(this.uploadSession.vocal);
                console.log('✅ CatalogV2: Вокал прочитан');
            }
            
            // Читаем текст если есть
            let lyricsContent = null;
            if (this.uploadSession.lyrics) {
                lyricsContent = await this.readFileAsText(this.uploadSession.lyrics);
                console.log('✅ CatalogV2: Текст прочитан');
            }
            
            // Создаем объект трека согласно структуре TrackCatalog
            const trackData = {
                id: Date.now(), // Генерируем уникальный ID как в TrackCatalog
                title: this.uploadSession.instrumental.name.replace(/\.[^/.]+$/, '').replace(/^(\d+[\s.-]+)/, ''),
                instrumentalData: instrumentalData,
                instrumentalType: this.uploadSession.instrumental.type,
                vocalsData: vocalsData,
                vocalsType: this.uploadSession.vocal ? this.uploadSession.vocal.type : null,
                lyricsFileName: this.uploadSession.lyrics ? this.uploadSession.lyrics.name : null,
                dateAdded: new Date().toISOString(),
                lyricsOriginalContent: lyricsContent
            };
            
            console.log('📝 CatalogV2: Данные трека готовы:', trackData.title);
            
            // Сохраняем через TrackCatalog API
            if (window.trackCatalog && typeof window.trackCatalog._saveTrackToDB === 'function') {
                console.log('🔄 CatalogV2: Сохранение в IndexedDB...');
                
                const savedTrack = await window.trackCatalog._saveTrackToDB(trackData);
                console.log('✅ CatalogV2: Трек сохранен в IndexedDB с ID:', savedTrack.id);
                
                // Добавляем трек в локальный массив TrackCatalog
                window.trackCatalog.tracks.push(savedTrack);
                console.log('✅ CatalogV2: Трек добавлен в локальный массив');
                
                // Обновляем список треков в новом каталоге
                this.tracks.push(savedTrack);
                this.renderMyMusic();
                console.log('✅ CatalogV2: UI обновлен');
                
                this.showNotification(`✅ Трек "${savedTrack.title}" успешно сохранен!`);
                
            } else {
                console.error('❌ CatalogV2: TrackCatalog API недоступен');
                this.showNotification('❌ Ошибка: TrackCatalog API недоступен');
                return;
            }
            
            // Очищаем форму
            this.cancelUpload();
            
        } catch (error) {
            console.error('❌ CatalogV2: Ошибка при сохранении:', error);
            this.showNotification('❌ Ошибка при сохранении трека: ' + error.message);
            
            // Восстанавливаем кнопку
            const saveBtn = this.overlay.querySelector('#upload-save');
            if (saveBtn) {
                saveBtn.textContent = '💾 Сохранить трек';
                saveBtn.disabled = false;
            }
        }
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
        
        console.log('�� CatalogV2: Overlay закрыт');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.catalogV2 = new CatalogV2();
}); 