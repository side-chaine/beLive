/**
 * Device Calibration Storage Utility
 * 
 * Persists per-device sync calibration data to localStorage.
 * Implements LRU eviction with max 20 entries.
 * 
 * Research-backed: Users expect their headphone sync to be remembered.
 */

const STORAGE_KEY = 'monitor:deviceCalibrations';
const MAX_ENTRIES = 20;

export interface DeviceCalibration {
  label: string;
  delayMs: number;
  confidence: 'high' | 'medium' | 'estimate' | 'fallback';
  calibratedAt: number;
  calibrationCount: number;
}

type CalibrationsMap = Record<string, DeviceCalibration>;

/**
 * Get all calibrations from localStorage
 */
function getAllCalibrations(): CalibrationsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    
    return parsed as CalibrationsMap;
  } catch (e) {
    console.warn('[device-calibrations] Failed to parse calibrations', e);
    return {};
  }
}

/**
 * Save all calibrations to localStorage
 */
function saveAllCalibrations(calibrations: CalibrationsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibrations));
  } catch (e) {
    console.warn('[device-calibrations] Failed to save calibrations', e);
    // localStorage might be full or disabled
  }
}

/**
 * Evict least recently used entries if over capacity
 * LRU strategy: remove oldest calibratedAt first
 */
function evictLRU(calibrations: CalibrationsMap): CalibrationsMap {
  const entries = Object.entries(calibrations);
  
  if (entries.length <= MAX_ENTRIES) {
    return calibrations;
  }
  
  // Sort by calibratedAt ascending (oldest first)
  const sorted = entries.sort((a, b) => a[1].calibratedAt - b[1].calibratedAt);
  
  // Remove oldest entries until we're at cap
  const toRemove = sorted.length - MAX_ENTRIES;
  const remaining = sorted.slice(toRemove);
  
  // Convert back to record
  return Object.fromEntries(remaining);
}

/**
 * Get calibration for a specific device
 */
export function getCalibration(deviceId: string): DeviceCalibration | undefined {
  const calibrations = getAllCalibrations();
  return calibrations[deviceId];
}

/**
 * Save calibration for a device
 * Updates existing entry or creates new one
 * Applies LRU eviction if over capacity
 */
export function saveCalibration(
  deviceId: string,
  data: Omit<DeviceCalibration, 'calibrationCount'> & { calibrationCount?: number }
): DeviceCalibration {
  const calibrations = getAllCalibrations();
  
  // Get existing count if updating
  const existing = calibrations[deviceId];
  const newCount = data.calibrationCount ?? (existing?.calibrationCount ?? 0) + 1;
  
  // Create/Update entry
  calibrations[deviceId] = {
    ...data,
    calibrationCount: newCount,
  };
  
  // Apply LRU eviction
  const evicted = evictLRU(calibrations);
  
  // Persist
  saveAllCalibrations(evicted);
  
  return evicted[deviceId];
}

/**
 * Remove calibration for a specific device
 */
export function removeCalibration(deviceId: string): void {
  const calibrations = getAllCalibrations();
  delete calibrations[deviceId];
  saveAllCalibrations(calibrations);
}

/**
 * List all calibrations
 */
export function listCalibrations(): DeviceCalibration[] {
  const calibrations = getAllCalibrations();
  return Object.values(calibrations);
}

/**
 * Get calibration count (for debugging)
 */
export function getCalibrationCount(): number {
  const calibrations = getAllCalibrations();
  return Object.keys(calibrations).length;
}

/**
 * Clear all calibrations (for testing/debugging)
 */
export function clearAllCalibrations(): void {
  localStorage.removeItem(STORAGE_KEY);
}
