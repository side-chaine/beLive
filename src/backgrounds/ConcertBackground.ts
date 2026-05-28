export class ConcertBackgroundManager {
  private imagePaths: string[];
  private interval: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private body: HTMLElement;
  private lastImageIndex: number = -1;
  private isActive: boolean = false;

  constructor(imagePaths: string[], interval: number = 60000) {
    this.imagePaths = imagePaths;
    this.interval = interval;
    this.body = document.body;
  }

  start(): void {
    if (!this.imagePaths || this.imagePaths.length === 0) return;
    this.body.classList.add('concert-active');
    this.isActive = true;
    this._changeBackground();
    if (this.imagePaths.length > 1 && this.interval > 0) {
      this.timerId = setInterval(
        this._changeBackground.bind(this), 
        this.interval
      );
    }
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isActive = false;
    this.body.style.removeProperty('background-image');
    this.body.style.removeProperty('background');
    this.body.classList.remove('concert-active');
  }

  private _changeBackground(): void {
    if (!this.isActive || !this.body.classList.contains('mode-concert')) {
      return;
    }
    if (this.imagePaths.length === 0) return;

    let nextImageIndex: number;
    do {
      nextImageIndex = Math.floor(Math.random() * this.imagePaths.length);
    } while (
      this.imagePaths.length > 1 && 
      nextImageIndex === this.lastImageIndex
    );

    this.lastImageIndex = nextImageIndex;
    const imagePath = this.imagePaths[nextImageIndex];

    const img = new Image();
    img.onload = () => {
      if (!this.isActive || !this.body.classList.contains('mode-concert')) {
        return;
      }
      this.body.style.setProperty(
        'background-image', 
        `url('${imagePath}')`, 
        'important'
      );
    };
    img.onerror = () => {
      console.error(`❌ Concert Background: failed to load ${imagePath}`);
    };
    img.src = imagePath;
  }
}
