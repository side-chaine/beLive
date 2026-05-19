/**
 * TakeAssetRegistry — session-only storage for heavy take objects.
 * Lives OUTSIDE Zustand to avoid reactive overhead on large binary data.
 * 
 * Lifecycle:
 * - Blob stored on recording stop
 * - AudioBuffer + peaks cached after decode
 * - Object URLs created lazily, revoked on delete/cleanup
 * - Everything cleared on track change via takes.bridge
 */

export interface TakeAssets {
  blob: Blob;
  objectUrl: string | null;
  audioBuffer: AudioBuffer | null;
  peaks: Float32Array | null;
}

class TakeAssetRegistry {
  private assets = new Map<string, TakeAssets>();

  /** Store a recorded blob for a take */
  store(takeId: string, blob: Blob): void {
    // Revoke old URL if overwriting
    const existing = this.assets.get(takeId);
    if (existing?.objectUrl) {
      URL.revokeObjectURL(existing.objectUrl);
    }
    this.assets.set(takeId, {
      blob,
      objectUrl: null,
      audioBuffer: null,
      peaks: null,
    });
  }

  /** Get stored blob */
  getBlob(takeId: string): Blob | undefined {
    return this.assets.get(takeId)?.blob;
  }

  /** Cache decoded AudioBuffer and peaks */
  cacheDecoded(
    takeId: string,
    audioBuffer: AudioBuffer,
    peaks: Float32Array,
  ): void {
    const existing = this.assets.get(takeId);
    if (!existing) return;
    existing.audioBuffer = audioBuffer;
    existing.peaks = peaks;
  }

  /** Get cached AudioBuffer */
  getAudioBuffer(takeId: string): AudioBuffer | null {
    return this.assets.get(takeId)?.audioBuffer ?? null;
  }

  /** Get cached peaks */
  getPeaks(takeId: string): Float32Array | null {
    return this.assets.get(takeId)?.peaks ?? null;
  }

  /** Get or create object URL for playback */
  getObjectUrl(takeId: string): string | null {
    const asset = this.assets.get(takeId);
    if (!asset) return null;
    if (!asset.objectUrl) {
      asset.objectUrl = URL.createObjectURL(asset.blob);
    }
    return asset.objectUrl;
  }

  /** Delete a single take's assets */
  delete(takeId: string): void {
    const asset = this.assets.get(takeId);
    if (!asset) return;
    if (asset.objectUrl) {
      URL.revokeObjectURL(asset.objectUrl);
    }
    this.assets.delete(takeId);
  }

  /** Check if take has assets */
  has(takeId: string): boolean {
    return this.assets.has(takeId);
  }

  /** Get count of stored takes */
  get size(): number {
    return this.assets.size;
  }

  /** Clear everything — called on track change */
  clear(): void {
    for (const asset of this.assets.values()) {
      if (asset.objectUrl) {
        URL.revokeObjectURL(asset.objectUrl);
      }
    }
    this.assets.clear();
  }
}

/** Singleton registry instance */
export const takeAssets = new TakeAssetRegistry();
