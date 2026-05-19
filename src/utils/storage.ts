/**
 * Thin storage utility wrapping localStorage with error handling.
 * No migrations, no key renames — just safe access.
 */

/**
 * Get a string value from localStorage.
 * @returns The stored value, or null if not found or on error.
 */
export function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

/**
 * Set a string value in localStorage.
 * @returns true on success, false on error.
 */
export function set(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Get a JSON value from localStorage.
 * @returns The parsed value, or null if not found or on parse error.
 */
export function getJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (_) {
    return null;
  }
}

/**
 * Set a JSON value in localStorage.
 * @returns true on success, false on error.
 */
export function setJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Remove a key from localStorage.
 */
export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (_) {
    // noop
  }
}
