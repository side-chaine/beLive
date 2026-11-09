/**
 * First-paint boot contract — SINGLE SOURCE OF TRUTH for the startup splash.
 *
 * `index.html` paints a plain HTML/CSS layer before any JS module is fetched or
 * evaluated (the Vite module graph is large and evaluates bootAether before the
 * React root mounts). React's `LoadingSplash` takes over once the video has a
 * decodable frame and dismisses that layer.
 *
 * Keeping the id, the hide class, the poster URL and the dismissal in ONE module
 * means the markup (`index.html`), the controller (`LoadingSplash`) and the
 * CSS-only watchdog can never drift apart.
 */

export const BOOT_SPLASH_ID = 'bl-boot-splash';
export const BOOT_SPLASH_HIDE_CLASS = 'bl-boot-splash--hide';

/** Vite resolves BASE_URL to `/beLive/` in dev and `/` in the CF Pages build. */
export const SPLASH_POSTER_URL = `${import.meta.env.BASE_URL}splash-poster.jpg`;

/**
 * Fade out and remove the static boot layer. Idempotent — `canplay`,
 * `loadeddata`, the phase watcher, the fallback timer and the video error path
 * can all race to call it. `data-hiding` is the single latch.
 */
export function dismissBootSplash(): void {
  const el = document.getElementById(BOOT_SPLASH_ID);
  if (!el || el.dataset.hiding) {return;}
  el.dataset.hiding = '1';
  el.classList.add(BOOT_SPLASH_HIDE_CLASS);
  window.setTimeout(() => el.remove(), 600);
}
