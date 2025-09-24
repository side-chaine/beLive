class ConcertBackgroundManager {
    constructor(imagePaths, interval = 60000) {
        this.imagePaths = imagePaths;
        this.interval = interval;
        this.timerId = null;
        this.body = document.body;
        this.lastImageIndex = -1;
        this.isActive = false;
    }

    start() {
        if (!this.imagePaths || this.imagePaths.length === 0) {return;}
        this.body.classList.add('concert-active');
        this.isActive = true;
        this._changeBackground();
        if (this.imagePaths.length > 1 && this.interval > 0) {
            this.timerId = setInterval(this._changeBackground.bind(this), this.interval);
        }
    }

    stop() {
        if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
        this.isActive = false;
        this.body.classList.remove('concert-active');
        // Сбросим фон, если другой режим не активен
        if (!this.body.classList.contains('rehearsal-active') && !this.body.classList.contains('karaoke-active')) {
            this.body.style.backgroundImage = '';
        }
    }

    _changeBackground() {
        if (!this.isActive || !this.body.classList.contains('mode-concert')) {return;}
        if (this.imagePaths.length === 0) {return;}
        let nextImageIndex;
        do {
            nextImageIndex = Math.floor(Math.random() * this.imagePaths.length);
        } while (this.imagePaths.length > 1 && nextImageIndex === this.lastImageIndex);
        this.lastImageIndex = nextImageIndex;
        const imagePath = this.imagePaths[nextImageIndex];

        const img = new Image();
        img.onload = () => {
            if (!this.isActive || !this.body.classList.contains('mode-concert')) {return;}
            this.body.style.setProperty('background-image', `url('${imagePath}')`, 'important');
            console.log(`✅ Concert Background: set ${imagePath}`);
        };
        img.onerror = () => console.error(`❌ Concert Background: failed to load ${imagePath}`);
        img.src = imagePath;
    }
}


