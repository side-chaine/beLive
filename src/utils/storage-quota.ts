/**
 * Storage quota utility for Block Scenes (Wave 2)
 * Checks IDB storage availability before saving backgrounds
 */

const MAX_BACKGROUNDS_PER_TRACK = 20;
const WARN_QUOTA_PERCENT = 80;

export interface StorageQuotaResult {
  allowed: boolean;
  reason?: string;
  usedMB: number;
  quotaMB: number;
}

export async function checkBgStorageQuota(): Promise<StorageQuotaResult> {
  if (!navigator.storage?.estimate) {
    // Old browsers — allow, but no info
    return { allowed: true, usedMB: 0, quotaMB: Infinity };
  }

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const usedMB = usage / 1024 / 1024;
    const quotaMB = quota / 1024 / 1024;
    const usedPercent = quota > 0 ? (usage / quota) * 100 : 0;

    if (usedPercent > WARN_QUOTA_PERCENT) {
      return {
        allowed: false,
        reason: `Storage ${Math.round(usedPercent)}% full (${Math.round(usedMB)}/${Math.round(quotaMB)}MB)`,
        usedMB,
        quotaMB,
      };
    }

    return { allowed: true, usedMB, quotaMB };
  } catch {
    return { allowed: true, usedMB: 0, quotaMB: Infinity };
  }
}

export function isWithinBgLimit(currentCount: number): boolean {
  return currentCount < MAX_BACKGROUNDS_PER_TRACK;
}

export const MAX_BG_PER_TRACK = MAX_BACKGROUNDS_PER_TRACK;
