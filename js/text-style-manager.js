/**
 * TextStyleManager - responsible for managing different text display styles
 * and providing UI for selecting and customizing styles
 */
class TextStyleManager {
    /**
     * Initialize the text style manager
     * @param {LyricsDisplay} lyricsDisplay - Reference to the lyrics display component
     */
    constructor(lyricsDisplay) {
        this.lyricsDisplay = lyricsDisplay;
        this.currentStyleId = 'default';
        this.currentTransition = 'explosion'; // Default to one of Claude's
        this.styles = {};
        this.activeTransitionSet = 'A'; // 'A' for Claude, 'B' for Gemini
        
        this.fonts = {
            'sans-serif': {
                name: 'Современные',
                order: 1,
                list: [
                    { id: 'Roboto', name: 'Roboto', family: "'Roboto', sans-serif" },
                    { id: 'Montserrat', name: 'Montserrat', family: "'Montserrat', sans-serif" },
                    { id: 'OpenSans', name: 'Open Sans', family: "'Open Sans', sans-serif" },
                    { id: 'BebasNeue', name: 'Bebas Neue', family: "'Bebas Neue', sans-serif" }
                ]
            },
            'serif': {
                name: 'Классические',
                order: 2,
                list: [
                    { id: 'PlayfairDisplay', name: 'Playfair Display', family: "'Playfair Display', serif" },
                    { id: 'Merriweather', name: 'Merriweather', family: "'Merriweather', serif" },
                    { id: 'Lora', name: 'Lora', family: "'Lora', serif" },
                    { id: 'PTSerif', name: 'PT Serif', family: "'PT Serif', serif" }
                ]
            },
            'display': {
                name: 'Акцентные',
                order: 3,
                list: [
                    { id: 'Oswald', name: 'Oswald', family: "'Oswald', sans-serif" },
                    { id: 'Lobster', name: 'Lobster', family: "'Lobster', cursive" },
                    { id: 'Pacifico', name: 'Pacifico', family: "'Pacifico', cursive" },
                    { id: 'Caveat', name: 'Caveat', family: "'Caveat', cursive" }
                ]
            }
        };

        // Настройки масштабирования для каждого режима
        this.scaleSettings = {
            'default':   { current: 1.0, default: 1.0 },
            'concert':   { current: 1.2, default: 1.2 },
            'karaoke':   { current: 1.2, default: 1.2 },
            'rehearsal': { current: 1.0, default: 1.0 },
            'live': { current: 1.0, default: 1.0 },
            'central': { current: 1.0, default: 1.0 },
            'minimalist': { current: 1.0, default: 1.0 },
            'neonGlow': { current: 1.0, default: 1.0 }
        };

        // Transitions by Claude (User A)
        const claudeTransitions = {
            'explosion': { name: 'Взрыв', source: 'claude' },
            'burn': { name: 'Огонь', source: 'claude' },
            'matrix': { name: 'Матрица', source: 'claude' },
            'glitch': { name: 'Глюк', source: 'claude' },
            'typewriter': { name: 'Печатная машинка', source: 'claude' },
            'neonPulse': { name: 'Неоновый пульс', source: 'claude' },
            'liquid': { name: 'Жидкость', source: 'claude' },
            'vibration': { name: 'Вибрация', source: 'claude' },
            'echo': { name: 'Эхо', source: 'claude' },
            'sparkle': { name: 'Искры', source: 'claude' },
            'wave': { name: 'Волна', source: 'claude' },
            'letterByLetter': { name: 'По буквам', source: 'claude' },
            'wordByWord': { name: 'По словам', source: 'claude' },
            'smoke': { name: 'Дым', source: 'claude' },
            'edgeGlow': { name: 'Свечение краёв', source: 'claude' },
            'pulseRim': { name: 'Пульсация контура', source: 'claude' },
            'fireEdge': { name: 'Огненный контур', source: 'claude' },
            'neonOutline': { name: 'Неоновый контур', source: 'claude' },
            'starlight': { name: 'Звёздное сияние', source: 'claude' }
        };

        // Transitions by Gemini (User B)
        const geminiTransitions = {
            'letterShine': { name: 'Сияние букв', source: 'gemini' },
            'electricEdges': { name: 'Электрические края', source: 'gemini' },
            'cometTail': { name: 'Хвост кометы', source: 'gemini' },
            'ghostlyAppear': { name: 'Призрачное появление', source: 'gemini' },
            'laserScan': { name: 'Лазерное сканирование', source: 'gemini' },
            'pixelateIn': { name: 'Пикселизация', source: 'gemini' },
            'cinemaLights': { name: 'Кино-огни', source: 'gemini' },
            'windySmoke': { name: 'Дымный ветер', source: 'gemini' },
            'starDust': { name: 'Звёздная пыль', source: 'gemini' },
            'inkBleed': { name: 'Чернильное пятно', source: 'gemini' }
        };

        this.transitions = { ...claudeTransitions, ...geminiTransitions };
        
        // Категории и дисплейные режимы для организации стилей в UI
        this.displayModes = {
            'basic': { name: 'Базовые стили', order: 1 },
            'performance': { name: 'Концертные стили', order: 2 },
            'creative': { name: 'Креативные стили', order: 3 },
            'special': { name: 'Специальные режимы', order: 4 }
        };
        
        // Initialize predefined styles
        this._initStyles();
        
        // Apply default style
        this._applyStyle('default');
        
        // ВАЖНО: не запрашиваем камеру на этапе инициализации
        
        console.log('TextStyleManager initialized with', Object.keys(this.styles).length, 'styles and', 
            Object.keys(this.transitions).length, 'total transitions');
    }
    
    /**
     * Initialize predefined styles
     * @private
     */
    _initStyles() {
        // Default style - clean, professional appearance
        this.styles.default = {
            id: 'default',
            name: 'Стандартный',
            description: 'Классический стиль с четким отображением текста',
            category: 'basic',
            cssClass: 'style-default',
            containerClass: 'container-default',
            transition: 'fade',
            options: {
                textAlign: 'center',
                fontSize: '1.8em',
                lineSpacing: '1.6',
                fontFamily: 'Arial, sans-serif',
                textColor: '#ffffff',
                backgroundColor: 'transparent'
            }
        };
        
        // Центральный стиль - крупный текст и 6 строк
        this.styles.central = {
            id: 'central',
            name: 'Центральный',
            description: 'Оптимизированный режим с 6 строками текста и крупным шрифтом',
            category: 'basic',
            cssClass: 'style-central',
            containerClass: 'container-central',
            transition: 'fade',
            options: {
                textAlign: 'center',
                fontSize: '2.0em',
                lineSpacing: '1.5',
                fontFamily: 'Arial, sans-serif',
                textColor: '#ffffff',
                backgroundColor: 'transparent'
            }
        };
        
        // Minimalist style - very clean, focused on text
        this.styles.minimalist = {
            id: 'minimalist',
            name: 'Минималистичный',
            description: 'Чистый, фокусированный стиль, идеален для концентрации',
            category: 'performance',
            cssClass: 'style-minimalist',
            containerClass: 'container-minimalist',
            transition: 'fade',
            options: {
                textAlign: 'center',
                fontSize: '1.1em',
                lineSpacing: '2',
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                textColor: '#ffffff',
                backgroundColor: 'transparent'
            }
        };
        
        // Karaoke style - highlighted syllables
        this.styles.karaoke = {
            id: 'karaoke',
            name: 'Караоке',
            description: 'Стиль с подсветкой текущей строки и выделением',
            category: 'hidden',
            cssClass: 'style-karaoke',
            containerClass: 'container-karaoke',
            transition: 'slide-up',
            options: {
                textAlign: 'center',
                fontSize: '1.4em',
                lineSpacing: '1.8',
                fontFamily: "'Times New Roman', Times, serif",
                textColor: '#ffffff',
                backgroundColor: 'transparent'
            }
        };
        
        // Concert style - large, bold text for performances
        this.styles.concert = {
            id: 'concert',
            name: 'Концертный',
            description: 'Крупный, контрастный текст для выступлений',
            category: 'hidden',
            cssClass: 'style-concert',
            containerClass: 'container-concert',
            transition: 'zoom',
            options: {
                textAlign: 'center',
                fontSize: '1.6em',
                lineSpacing: '1.6',
                fontFamily: '"Oswald", sans-serif',
                textColor: '#ffffff',
                backgroundColor: 'transparent',
                fontWeight: 'bold'
            }
        };
        
        // Neon Glow style - stylized text with glow effect
        this.styles.neonGlow = {
            id: 'neonGlow',
            name: 'Неоновое Свечение',
            description: 'Стилизованный текст с эффектом неонового свечения',
            category: 'creative',
            cssClass: 'style-neon-glow',
            containerClass: 'container-neon',
            transition: 'fade',
            options: {
                textAlign: 'center',
                fontSize: '1.4em',
                lineSpacing: '1.8',
                fontFamily: '"Orbitron", sans-serif',
                textColor: '#ffffff',
                backgroundColor: 'transparent',
                textShadow: '0 0 5px #fff, 0 0 10px #fff, 0 0 15px #0073e6, 0 0 20px #0073e6'
            }
        };

        // Rehearsal style - for block-based display
        this.styles.rehearsal = {
            id: 'rehearsal',
            name: 'Репетиция',
            description: 'Режим для репетиций с отображением блоков текста',
            category: 'hidden',
            cssClass: 'style-rehearsal', // General class for rehearsal mode
            containerClass: 'container-rehearsal',
            transition: 'fade', // Default transition
            options: {
                // Most styling is handled by block rendering logic in LyricsDisplay
                // and specific CSS for .lyric-block, .rehearsal-spacer etc.
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif' // Basic font
            }
        };
        
        // Добавляем режим Live
        this.styles.live = {
            id: 'live',
            name: 'Live',
            description: 'Режим Live с видео, камерой и эффектами',
            category: 'hidden',
            cssClass: 'style-live',
            containerClass: 'container-live',
            transition: 'fade',
            options: {
                textAlign: 'center',
                fontSize: '1.6em',
                lineSpacing: '1.8',
                fontFamily: '"Roboto", sans-serif',
                textColor: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.5)'
            }
        };
    }
    
    /**
     * Get list of all available styles
     * @returns {Object[]} Array of style objects
     */
    getAllStyles() {
        return Object.values(this.styles);
    }
    
    /**
     * Get all available transitions
     * @returns {Object} Object with transition ids as keys and names as values
     */
    getAllTransitions() {
        return this.transitions;
    }
    
    /**
     * Get styles grouped by category
     * @returns {Object} Object with categories as keys and arrays of styles as values
     */
    getStylesByCategory() {
        const categories = {};
        
        Object.values(this.styles).forEach(style => {
            if (!categories[style.category]) {
                categories[style.category] = [];
            }
            categories[style.category].push(style);
        });
        
        return categories;
    }
    
    /**
     * Get a style by its ID
     * @param {string} styleId - The ID of the style to get
     * @returns {Object|null} The style object or null if not found
     */
    getStyle(styleId) {
        return this.styles[styleId] || null;
    }
    
    /**
     * Get the current font scale multiplier.
     * @returns {number} The current font scale.
     */
    getFontScale() {
        return this.scaleSettings[this.currentStyleId]?.current || 1.0;
    }

    /**
     * Set the font scale and re-apply the current style
     * @param {number} scale - The new font scale (e.g., 1.0 for 100%)
     */
    setFontScale(scale) {
        const settings = this.scaleSettings[this.currentStyleId];
        if (!settings) {
            console.warn(`No scale settings found for style: ${this.currentStyleId}`);
            return;
        }

        let newScale = scale;
        // Clamp scale for karaoke mode to a maximum of 150%
        if (this.currentStyleId === 'karaoke') {
            newScale = Math.max(0.5, Math.min(scale, 1.5));
        } else {
            newScale = Math.max(0.5, scale); // Minimum scale of 50% for all modes
        }

        settings.current = newScale;
        console.log(`TextStyleManager: Font scale for ${this.currentStyleId} set to ${settings.current.toFixed(2)}`);
        this.setStyle(this.currentStyleId, false); // false to avoid scale reset
    }

    /**
     * Increase the font scale by a step, with mode-specific increments
     */
    increaseScale() {
        const step = 0.05; // Unified step
        this.setFontScale(this.getFontScale() + step);
    }

    /**
     * Decrease the font scale by a step, with mode-specific decrements
     */
    decreaseScale() {
        const step = 0.05; // Unified step
        this.setFontScale(this.getFontScale() - step);
    }

    /**
     * Resets the font scale for the current style to its default value.
     */
    resetScale() {
        const settings = this.scaleSettings[this.currentStyleId];
        if (settings) {
            this.setFontScale(settings.default);
        }
    }
    
    /**
     * Set the current style by ID
     * @param {string} styleId - The ID of the style to apply
     * @param {boolean} resetScale - Whether to reset the scale to default for the new style
     */
    setStyle(styleId, resetScale = false) {
        if (!this.styles[styleId]) {
            console.warn(`Style '${styleId}' not found. Applying default.`);
            styleId = 'default';
        }

        this.currentStyleId = styleId;

        if (resetScale) {
            this.resetScale();
        }

        // Принудительно ограничиваем масштаб при переключении на караоке, если он был изменен в другом режиме
        if (this.currentStyleId === 'karaoke' && this.getFontScale() > 1.5) {
            this.scaleSettings.karaoke.current = 1.5;
            console.log(`TextStyleManager: Font scale for Karaoke clamped to 1.5 on style switch.`);
        }

        console.log(`Applying style: ${this.styles[styleId].name} with scale ${this.getFontScale().toFixed(2)}`);

        const styleToApply = this._getScaledStyle(this.currentStyleId);
        
        // This will trigger a re-render in LyricsDisplay with the new style
        if (this.lyricsDisplay.setStyle) {
            this.lyricsDisplay.setStyle(styleToApply);
        } else {
            // Fallback for older LyricsDisplay versions
            this._applyStyle(styleId); // Note: Fallback won't be scaled
        }
        
        // If rehearsal mode is active, we need to re-render blocks
        if (styleId === 'rehearsal' && this.lyricsDisplay.isRehearsalModeActive) {
            this.lyricsDisplay.renderLyrics();
        }
    }
    
    /**
     * Set the current transition 
     * @param {string} transitionId - ID of the transition to apply
     */
    setTransition(transitionId) {
        if (transitionId === 'none') {
            this.currentTransition = 'none';
            if (this.lyricsDisplay && this.lyricsDisplay.setTransition) {
                this.lyricsDisplay.setTransition('none');
            }
            // Update activeTransitionSet based on the source of the 'none' (if applicable) or keep current
            return;
        }

        if (this.transitions[transitionId]) {
            this.currentTransition = transitionId;
            const selectedTransitionSource = this.transitions[transitionId].source;
            this.activeTransitionSet = selectedTransitionSource === 'claude' ? 'A' : 'B';
            
            if (this.lyricsDisplay && this.lyricsDisplay.setTransition) {
                this.lyricsDisplay.setTransition(transitionId);
            }
        } else {
            console.warn(`Transition ID '${transitionId}' not found.`);
        }
    }
    
    /**
     * Apply a style to the lyrics display
     * @param {string} styleId - The ID of the style to apply
     * @private
     */
    _applyStyle(styleId) {
        if (!this.styles[styleId]) {return;}
        
        const style = this.styles[styleId];
        this.currentStyleId = styleId;
        
        // Apply style to lyrics display
        if (this.lyricsDisplay && this.lyricsDisplay.setStyle) {
            this.lyricsDisplay.setStyle(style);
            console.log(`Applied style '${style.name}'`);
        } else {
            console.warn('LyricsDisplay component does not support setStyle method');
        }
    }
    
    /**
     * Show the style selector modal
     */
    showStyleSelector() {
        console.log("Attempting to show font selector...");
        const existingModal = document.querySelector('.font-selector-modal');

        if (existingModal) {
            console.log("Modal exists. Removing it.");
            existingModal.remove();
            return;
        }

        console.log("Creating new font selector modal.");
        const modal = document.createElement('div');
        modal.className = 'font-selector-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.innerHTML = '<h2>Text Styles</h2><span class="close-button">&times;</span>';
        modalContent.appendChild(modalHeader);
        
        const mainContent = document.createElement('div');
        mainContent.className = 'style-selector-main-content';
        
        // Render the new font selector
        this._renderFontSelector(mainContent);
        
        // Render the transitions selector on the right
        this._addTransitionsSection(mainContent);

        modalContent.appendChild(mainContent);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('.close-button').onclick = () => modal.remove();
        modal.onclick = (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        };

        // Transition set toggles
        const toggleA = document.getElementById('transition-toggle-A');
        const toggleB = document.getElementById('transition-toggle-B');
        if(toggleA && toggleB) {
            toggleA.addEventListener('click', () => this.setActiveTransitionSet('A'));
            toggleB.addEventListener('click', () => this.setActiveTransitionSet('B'));
        }

        modal.style.display = 'block';
    }

    /**
     * Renders the new font selector UI
     * @param {HTMLElement} container - The parent element to render into
     * @private
     */
    _renderFontSelector(container) {
        const fontContainer = document.createElement('div');
        fontContainer.id = 'font-selector-container';
        
        const sortedCategories = Object.values(this.fonts).sort((a, b) => a.order - b.order);

        sortedCategories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'font-category';
            
            const title = document.createElement('h3');
            title.textContent = category.name;
            categoryDiv.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'font-grid';

            category.list.forEach(font => {
        const card = document.createElement('div');
                card.className = 'font-card';
                card.textContent = 'Абвг';
                card.style.fontFamily = font.family;
                card.dataset.fontId = font.id;
                card.dataset.fontFamily = font.family;
                card.dataset.fontName = font.name;

                // Highlight the currently selected font for the concert style
                if (this.styles.concert.options.fontFamily === font.family) {
            card.classList.add('selected');
        }
        
                card.addEventListener('click', () => {
                    // Visually mark as selected
                    document.querySelectorAll('.font-card.selected').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');

                    // Apply the font, but only if we are in concert mode
                    if (this.lyricsDisplay.currentStyle.id === 'concert') {
                        this.applyFontToCurrentStyle(font.family);
                    } else {
                        // Optional: provide feedback that fonts only work in concert mode
                        console.log('Font selection is only available in Concert Mode.');
                    }
                });

                grid.appendChild(card);
            });

            categoryDiv.appendChild(grid);
            fontContainer.appendChild(categoryDiv);
        });

        container.appendChild(fontContainer);
    }
    
    /**
     * Applies a new font family to the current style and re-applies it.
     * Currently hardcoded to only affect the 'concert' style object.
     * @param {string} fontFamily - The CSS font-family string.
     */
    applyFontToCurrentStyle(fontFamily) {
        if (!fontFamily) {return;}

        console.log(`Applying font "${fontFamily}" to concert style.`);
        
        // Update the font in the concert style definition
        this.styles.concert.options.fontFamily = fontFamily;

        // If the user is currently in concert mode, re-apply the style immediately
        if (this.lyricsDisplay.currentStyle.id === 'concert') {
            this.setStyle('concert');
        }
    }
    
    _getCategoryDisplayName(category) {
        return this.displayModes[category] ? this.displayModes[category].name : category;
    }

    _addTransitionsSection(container) {
        const transitionsColumn = document.createElement('div');
        transitionsColumn.className = 'transitions-column';
        container.appendChild(transitionsColumn);

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'transitions-header';

        const headerContent = document.createElement('div');
        headerContent.className = 'transitions-header-content';

        this.buttonA_ref = document.createElement('button');
        this.buttonA_ref.textContent = 'A';
        this.buttonA_ref.className = 'transition-set-btn';
        if (this.activeTransitionSet === 'A') {this.buttonA_ref.classList.add('active');}
        this.buttonA_ref.addEventListener('click', () => {
            this.activeTransitionSet = 'A';
            this._renderTransitionsGrid(transitionsGrid); // Pass the grid container
            this.buttonA_ref.classList.add('active');
            if (this.buttonB_ref) {this.buttonB_ref.classList.remove('active');}
        });
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Переходы';
        sectionTitle.style.margin = '0 10px'; // Add some space around the title

        this.buttonB_ref = document.createElement('button');
        this.buttonB_ref.textContent = 'B';
        this.buttonB_ref.className = 'transition-set-btn';
        if (this.activeTransitionSet === 'B') {this.buttonB_ref.classList.add('active');}
        this.buttonB_ref.addEventListener('click', () => {
            this.activeTransitionSet = 'B';
            this._renderTransitionsGrid(transitionsGrid); // Pass the grid container
            this.buttonB_ref.classList.add('active');
            if (this.buttonA_ref) {this.buttonA_ref.classList.remove('active');}
        });

        headerContent.appendChild(this.buttonA_ref);
        headerContent.appendChild(sectionTitle);
        headerContent.appendChild(this.buttonB_ref);
        
        sectionHeader.appendChild(headerContent);
        transitionsColumn.appendChild(sectionHeader);

        const transitionsGrid = document.createElement('div');
        transitionsGrid.className = 'transitions-grid';
        transitionsColumn.appendChild(transitionsGrid);

        this._renderTransitionsGrid(transitionsGrid); 
    }

    _renderTransitionsGrid(gridContainer) {
        gridContainer.innerHTML = ''; 

        const transitionsToDisplay = Object.entries(this.transitions).filter(([id, transition]) => {
            return (this.activeTransitionSet === 'A' && transition.source === 'claude') ||
                   (this.activeTransitionSet === 'B' && transition.source === 'gemini');
        });

        let selectedCardElement = null;

        transitionsToDisplay.forEach(([id, transition]) => {
            const name = transition.name;
            const transitionCard = document.createElement('div');
            transitionCard.className = 'transition-card';
            if (id === this.currentTransition) {
                transitionCard.classList.add('selected');
                selectedCardElement = transitionCard; // Store reference to selected card
            }
            
            const previewContainer = document.createElement('div');
            previewContainer.className = 'transition-preview-container';
            
            const previewText = document.createElement('span');
            previewText.className = 'transition-preview-text';
            previewText.textContent = name; 
            previewText.setAttribute('data-content', name); 
            
            previewContainer.appendChild(previewText);
            transitionCard.appendChild(previewContainer);
            
            transitionCard.addEventListener('mouseenter', () => {
                previewText.classList.add('animate-preview', `preview-${id}`);
            });
            transitionCard.addEventListener('mouseleave', () => {
                previewText.classList.remove('animate-preview', `preview-${id}`);
                void previewText.offsetWidth;
            });
            transitionCard.addEventListener('click', () => {
                this.setTransition(id); // This will now also update activeTransitionSet
                
                document.querySelectorAll('.transition-card.selected').forEach(card => card.classList.remove('selected'));
                transitionCard.classList.add('selected');
                
                // Update A/B button highlighting based on the source of the selected transition
                const source = this.transitions[id].source;
                if (source === 'claude') {
                    if(this.buttonA_ref) {this.buttonA_ref.classList.add('active');}
                    if(this.buttonB_ref) {this.buttonB_ref.classList.remove('active');}
                } else if (source === 'gemini') {
                    if(this.buttonB_ref) {this.buttonB_ref.classList.add('active');}
                    if(this.buttonA_ref) {this.buttonA_ref.classList.remove('active');}
                }

                const styleSelectorContainer = document.getElementById('style-selector-container');
                if (styleSelectorContainer) {
                    styleSelectorContainer.classList.add('hidden');
                }
            });
            gridContainer.appendChild(transitionCard);
        });

        // Scroll to selected card if it exists
        if (selectedCardElement) {
            // Use a timeout to ensure the element is in the DOM and scrollable
            setTimeout(() => {
                selectedCardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
        }
    }
    
    /**
     * Add custom presets section (for future use)
     * @param {HTMLElement} container - The parent container
     * @private  
     */
    _addCustomPresetsSection(container) {
        // Create section header
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'style-category-header';
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'My Presets';
        
        sectionHeader.appendChild(sectionTitle);
        container.appendChild(sectionHeader);
        
        // Create presets container
        const presetsContainer = document.createElement('div');
        presetsContainer.className = 'presets-container';
        
        // Add save preset button
        const saveButton = document.createElement('button');
        saveButton.className = 'save-preset-btn';
        saveButton.innerHTML = '<i class="fas fa-save"></i> Save Current Style';
        saveButton.addEventListener('click', () => {
            this._saveCurrentAsPreset();
        });
        
        // Add placeholder text for future presets
        const placeholderText = document.createElement('p');
        placeholderText.className = 'presets-placeholder';
        placeholderText.textContent = 'Your saved presets will appear here';
        
        presetsContainer.appendChild(saveButton);
        presetsContainer.appendChild(placeholderText);
        container.appendChild(presetsContainer);
    }
    
    /**
     * Save current style and transition as a user preset (for future implementation)
     * @private
     */
    _saveCurrentAsPreset() {
        console.log('Saving current style as preset (to be implemented)');
        alert('This feature will be available soon!');
    }
    
    /**
     * Предварительная инициализация камеры для Live режима
     */
    _initLiveCamera() {
        console.log('TextStyleManager: Проверка доступности LiveMode...');
        
        if (typeof LiveMode !== 'undefined') {
            console.log('TextStyleManager: Класс LiveMode найден, предварительная инициализация камеры...');
            
            // Если LiveMode еще не инициализирован глобально
            if (!window.liveMode) {
                try {
                    window.liveMode = new LiveMode();
                    console.log('TextStyleManager: LiveMode успешно инициализирован');
                } catch (error) {
                    console.error('TextStyleManager: Ошибка инициализации LiveMode:', error);
                }
            } else {
                console.log('TextStyleManager: LiveMode уже инициализирован');
            }
        } else {
            console.log('TextStyleManager: Класс LiveMode не найден, предварительная инициализация камеры невозможна');
        }
    }

    /**
     * Creates a temporary style object with scaled font size.
     * @param {string} styleId - The ID of the style to scale.
     * @returns {Object} A new style object with scaled font options.
     * @private
     */
    _getScaledStyle(styleId) {
        const originalStyle = this.styles[styleId];
        if (!originalStyle) {return null;}

        const currentScale = this.getFontScale();

        // Deep clone the original style to avoid permanent modification
        const scaledStyle = JSON.parse(JSON.stringify(originalStyle));

        if (scaledStyle.options && scaledStyle.options.fontSize) {
            const originalFontSize = scaledStyle.options.fontSize;
            // Use regex to separate the numeric value from the unit (e.g., "1.6em" -> 1.6 and "em")
            const match = originalFontSize.match(/([0-9\.]+)(.*)/);
            
            if (match && match.length === 3) {
                const value = parseFloat(match[1]);
                const unit = match[2];
                const scaledValue = value * currentScale;
                scaledStyle.options.fontSize = `${scaledValue.toFixed(2)}${unit}`;
                console.log(`TextStyleManager: Scaled font size from ${originalFontSize} to ${scaledStyle.options.fontSize}`);
            }
        }
        
        return scaledStyle;
    }

    /**
     * Сбрасывает состояние менеджера стилей.
     * Очищает кэшированные настройки для устранения бага с "висящими" стилями.
     */
    reset() {
        console.log('💥 TextStyleManager: Full reset initiated.');

        // 1. Принудительная остановка всех активных анимаций
        if (this.activeAnimationFrameId) {
            console.log(`🛑 Stopping active animation frame: ${this.activeAnimationFrameId}`);
            cancelAnimationFrame(this.activeAnimationFrameId);
            this.activeAnimationFrameId = null;
        }

        // 2. Сброс всех стилей и переходов
        this.currentStyle = 'concert'; 
        this.currentTransition = 'none';
        this.currentScale = 1.0;

        // 3. Полная очистка кэша эффектов и DOM-элементов
        // Это самая важная часть для исправления бага
        if (this.effectCache) {
            console.log('🗑️ Clearing effect cache...');
            this.effectCache = {
                wordByWord: {
                    prepared: false,
                    elements: []
                },
                letterByLetter: {
                    prepared: false,
                    elements: []
                }
                // Добавьте другие эффекты, если они кэшируются
            };
        }
        
        // 4. Сброс временных и вычисленных свойств
        this.baseFontSize = 1.6; 
        this.fontScales = {};

        console.log('✅ TextStyleManager: Reset complete. All states and caches cleared.');
    }

    /**
     * Применяет выбранный стиль к контейнеру с текстами.
     * @param {string} transitionId - ID эффекта перехода (например, 'wordByWord').
     */
    setLyricsTransition(transitionId) {
        this.currentTransition = transitionId;
        console.log(`Setting lyrics transition: ${transitionId}`);
        
        // Сообщаем LyricsDisplay о необходимости переключить переход
        if (window.lyricsDisplay) {
            window.lyricsDisplay.setTransition(transitionId);
        }
    }
}

// Create global instance
window.TextStyleManager = TextStyleManager; 