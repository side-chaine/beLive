export class KaraokeBackgroundManager {
  private imagePaths: string[];
  private interval: number = 60000;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private body: HTMLElement;
  private lastImageIndex: number = -1;
  private isActive: boolean = false;

  constructor(imagePaths: string[]) {
    this.imagePaths = imagePaths;
    this.body = document.body;
  }

  start(): void {
    if (!this.imagePaths || this.imagePaths.length === 0) return;
    this.body.classList.add('karaoke-active');
    this.isActive = true;
    this._changeBackground();
    if (this.imagePaths.length > 1) {
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
    this.body.classList.remove('karaoke-active');
  }

  private _changeBackground(): void {
    if (!this.isActive || !this.body.classList.contains('mode-karaoke')) {
      return;
    }
    if (this.imagePaths.length === 0) {
      console.warn('Karaoke Background Manager: No images to display.');
      return;
    }
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
      if (!this.isActive || !this.body.classList.contains('mode-karaoke')) {
        return;
      }
      this.body.style.setProperty(
        'background-image',
        `url('${imagePath}')`,
        'important'
      );
    };
    img.onerror = () => {
      console.error(
        `❌ Karaoke Background Manager: FAILED to load image at path: ${imagePath}. Check if the path is correct and the file exists.`
      );
    };
    img.src = imagePath;
  }
}
