class ViewManager {
    constructor() {
        this.appContainer = document.querySelector('.app-container');
        this.liveFeedContainer = document.getElementById('live-feed-concept');
        
        // Другие контейнеры экранов будут добавлены здесь
        this.avatarPageContainer = null; // Будет инициализирован позже

        this.stateManager = null;
        this.app = null;

        console.log('🎛️ ViewManager: Конструктор выполнен');
    }

    /**
     * Инициализация ViewManager с зависимостями
     * @param {StateManager} stateManager - Менеджер состояния
     * @param {App} app - Основное приложение
     */
    init(stateManager, app) {
        console.log('🔗 ViewManager: Инициализация с зависимостями');
        this.stateManager = stateManager;
        this.app = app;
        console.log('✅ ViewManager: Зависимости успешно подключены');
    }

    /**
     * Переключение на Avatar Studio
     */
    showAvatarPage() {
        console.log('🎭 ViewManager: Переключение на Avatar Studio');
        
        // Скрываем основной контейнер приложения
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.classList.add('hidden');
        }
        
        // Показываем контейнер аватар-страницы
        const avatarContainer = document.getElementById('avatar-page-container');
        if (avatarContainer) {
            avatarContainer.classList.remove('hidden');
        }
        
        // Уведомляем StateManager об изменении режима
        if (this.stateManager) {
            this.stateManager.currentMode = 'avatar';
        }
        
        // Загружаем данные первого трека
        setTimeout(() => {
            this.loadDefaultTrackData();
        }, 100);
        
        console.log('✅ ViewManager: Avatar Studio активирован');
    }

    /**
     * Переключение на Live Feed (основная страница)
     */
    showLiveFeed() {
        console.log('📺 ViewManager: Переключение на Live Feed');
        
        // Скрываем контейнер аватар-страницы
        const avatarContainer = document.getElementById('avatar-page-container');
        if (avatarContainer) {
            avatarContainer.classList.add('hidden');
        }
        
        // Показываем основной контейнер приложения
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.classList.remove('hidden');
        }
        
        // Уведомляем StateManager об изменении режима
        if (this.stateManager) {
            this.stateManager.currentMode = 'live-feed';
        }
        
        console.log('✅ ViewManager: Live Feed активирован');
    }

    /**
     * Инициализация обработчиков событий для переключения экранов
     */
    initEventHandlers() {
        console.log('🎯 ViewManager: Инициализация обработчиков событий');
        
        // Обработчик кнопки аватара в основном приложении
        const avatarBtn = document.getElementById('avatar-btn');
        if (avatarBtn) {
            avatarBtn.addEventListener('click', () => this.showAvatarPage());
            console.log('✅ ViewManager: Обработчик кнопки аватара (основное приложение) подключен');
        }
        
        // Обработчик кнопки аватара в live-feed
        const liveFeedAvatar = document.querySelector('#live-feed-concept .user-avatar');
        if (liveFeedAvatar) {
            liveFeedAvatar.addEventListener('click', () => this.showAvatarPage());
            console.log('✅ ViewManager: Обработчик кнопки аватара в Live Feed подключен');
        }
        
        // Обработчик кнопки возврата в Avatar Studio
        const backBtn = document.getElementById('back-to-live-feed');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showLiveFeed());
            console.log('✅ ViewManager: Обработчик кнопки возврата подключен');
        }
        
        // Обработчик кнопки beLIVE в Avatar Studio (возврат в Live Feed)
        const avatarHomeBtn = document.querySelector('#avatar-page-container .home-btn');
        if (avatarHomeBtn) {
            avatarHomeBtn.addEventListener('click', () => this.showLiveFeed());
            console.log('✅ ViewManager: Обработчик кнопки beLIVE в Avatar Studio подключен');
        }
        
        // Обработчики кнопок режимов в Avatar Studio
        const avatarModeButtons = document.querySelectorAll('#avatar-page-container .mode-button');
        avatarModeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.handleModeSwitch(mode);
            });
        });
        
        // Обработчик кнопки каталога в Avatar Studio
        const avatarCatalogBtn = document.querySelector('#avatar-page-container .animated-gradient-btn');
        if (avatarCatalogBtn) {
            avatarCatalogBtn.addEventListener('click', () => {
                // Переключаемся в основное приложение и открываем каталог
                this.showLiveFeed();
                setTimeout(() => {
                    document.getElementById('catalog-btn').click();
                }, 100);
            });
        }
        
        // Инициализация карусели треков
        this.initTrackCarousel();
        console.log('🎵 ViewManager: Карусель треков инициализирована');
        
        console.log('🎯 ViewManager: Все обработчики событий готовы');
    }

    /**
     * Инициализация карусели треков и переключения контента
     */
    initTrackCarousel() {
        // Загружаем данные первого трека по умолчанию при открытии Avatar Studio
        window.selectTrack = (element) => {
            // Снимаем выделение со всех треков
            document.querySelectorAll('.carousel-track-item').forEach(el => el.classList.remove('active'));
            // Выделяем текущий трек
            element.classList.add('active');
            
            const trackId = element.dataset.trackId;
            const trackDataSource = document.getElementById(`track-data-${trackId}`);
            
            if (trackDataSource) {
                const leftPanelData = trackDataSource.querySelector('.left-panel-data').innerHTML;
                const rightPanelData = trackDataSource.querySelector('.right-panel-data').innerHTML;
                
                const userStatsContent = document.getElementById('user-track-stats-content');
                const liveSessionContent = document.getElementById('live-session-list-content');
                
                // Анимация смены контента
                if (userStatsContent && liveSessionContent) {
                    userStatsContent.style.opacity = '0';
                    liveSessionContent.style.opacity = '0';

                    setTimeout(() => {
                        userStatsContent.innerHTML = leftPanelData;
                        liveSessionContent.innerHTML = rightPanelData;
                        userStatsContent.style.opacity = '1';
                        liveSessionContent.style.opacity = '1';
                    }, 300);
                }
            }
        };
        
        console.log('🎵 ViewManager: Карусель треков инициализирована');
    }

    /**
     * Загрузка данных первого трека при показе Avatar Studio
     */
    loadDefaultTrackData() {
        const firstTrack = document.querySelector('.carousel-track-item.active');
        if (firstTrack && window.selectTrack) {
            window.selectTrack(firstTrack);
        }
    }

    handleModeSwitch(mode) {
        console.log(`🎯 ViewManager: Переключение в режим ${mode}`);
        
        // Переключаемся в основное приложение
        this.showLiveFeed();
        
        // Активируем нужный режим
        setTimeout(() => {
            const modeBtn = document.querySelector(`[data-mode="${mode}"]`);
            if (modeBtn) {
                modeBtn.click();
            }
        }, 100);
    }
}

// Добавляем в глобальное пространство имен для доступа из app.js
window.ViewManager = ViewManager; 