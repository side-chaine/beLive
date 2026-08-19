/**
 * IDB Service — React-native IndexedDB access
 * F30: Own IndexedDB connection (independent of legacy)
 */

import type { PersistedTextBlock, PersistedSyncMarker } from '../types/persistence.types';
import type { Playlist } from '../catalog/types';
import type { StemAutomationData, StemDisplayOrder } from '../stem/stemTypes';

const DB_NAME = (globalThis as any).__DB_NAME || 'TextAppDB';
const DB_VERSION = 9;

// ── Types ──────────────────────────────────────────────

export interface StemDataEntry {
  data: ArrayBuffer;
  type: string;  // MIME type: 'audio/mpeg', 'audio/wav', etc.
}

export interface TrackRecord {
  id: number;
  title: string;
  instrumentalData: ArrayBuffer;
  instrumentalType: string;
  vocalsData?: ArrayBuffer | null;
  vocalsType?: string | null;
  /** Additional stem audio data (drums, bass, keys, etc.). Optional = backward compat. */
  stemsData?: Record<string, StemDataEntry> | null;
  /** Per-stem display order for mixer panel. Optional = backward compat. */
  stemDisplayOrder?: StemDisplayOrder[] | null;
  /** Per-stem automation data. Optional = backward compat. */
  stemAutomation?: StemAutomationData | null;
  /** Stems mode enabled (true = stems play, instrum muted; false = instrum plays, stems muted). Optional = default false. */
  stemsMode?: boolean | null;
  /** Cover art URL from Last.fm API. Optional = backward compat. */
  coverArtUrl?: string | null;
  /** Cover art binary for offline use (TC-COVER-02) */
  coverArtBlob?: Blob | null;
  /** Extracted dominant colors from cover art. Optional = backward compat. */
  coverTheme?: import('../types/cover-theme.types').CoverArtTheme | null;
  /** Custom background image. Wave 1: one per track. Used as effectiveTheme when active. */
  customBgBlob?: Blob | null;
  /** Extracted colors from custom background. Used as effectiveTheme when customBg is active. */
  customBgTheme?: import('../types/cover-theme.types').CoverArtTheme | null;
  /** Track meta (MusicBrainz, Last.fm, Essentia.js). Optional = backward compat. */
  trackMeta?: import('../types/track-meta.types').TrackMeta | null;
  /** Transition preset ID for preview slot animations (TC-82-*) */
  transitionPreset?: string | null;
  lyricsFileName?: string | null;
  lyricsOriginalContent?: string | null;
  lyrics?: string | null;
  blocksData?: PersistedTextBlock[] | null;
  syncMarkers?: PersistedSyncMarker[] | null;
  lineMap?: import('../sync/word-sync/line-map.types').LineMapEntry[] | null;
  alignmentData?: import('../sync/word-sync/types').AlignmentResult | null;

  /** Data processing version. 1=raw, 2=clean-lyrics, 3=voc-corrected */
  dataVersion?: number | null;

  dateAdded: string;
  lastModified: string;
  /** Guest or profile ID. null/undefined = guest tracks */
  userId?: string | null;
  // MVSEP integration fields (optional, no DB migration needed)
  mvsepStatus?: 'processing' | 'done' | 'failed' | 'timeout' | null;
  mvsepHash?: string | null;
  mvsepSubmittedAt?: string | null;
}

export interface UserRecord {
  id: string;
  serverId?: string;
  name: string;
  emoji: string;
  isGuest: boolean;
  createdAt: string;
  lastSeenAt: string;
  pinHash?: string;
  migrationStatus?: 'local' | 'migrating' | 'synced';
  preferences: {
    theme?: string;
    language?: string;
    billyMood?: 'quiet' | 'helpful' | 'attentive';
  };
}

// ── Block Scene Types (Wave 2) ──────────────────────────

export interface BlockScene {
  id: string;            // `${trackId}_${blockIndex}` or `${trackId}_${blockIndex}_${lineIndex}`
  trackId: number;
  blockIndex: number;
  lineIndex?: number | null;  // null/absent = block-level, number = line-level within block
  blockId?: string;      // optional, for stabilisation on block reorder
  blob: Blob;
  theme: import('../types/cover-theme.types').CoverArtTheme;
  addedAt: string;
}

export interface BlockSceneMeta {
  id: string;
  trackId: number;
  blockIndex: number;
  lineIndex?: number | null;  // null/absent = block-level, number = line-level
  blockId?: string;
  theme: import('../types/cover-theme.types').CoverArtTheme;
  addedAt: string;
  // NO blob — for listing/preview without heavy reads
}

// ── Scene Map Types (Wave 2.5) ──────────────────────────

export interface SceneEntry {
  url: string;
  theme: import('../types/cover-theme.types').CoverArtTheme;
}

export interface SceneMap {
  /** blockIndex → Object URL + theme for block-level scene */
  blockScenes: Map<number, SceneEntry>;
  /** `${blockIndex}_${lineIdxInBlock}` → Object URL + theme for line-level scene */
  lineScenes: Map<string, SceneEntry>;
}

// ── Connection ─────────────────────────────────────────

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase> | null = null;

function _getDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      if (import.meta.env.DEV) console.log(`[IDB] Upgrade: v${e.oldVersion} → v${e.newVersion}`);
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('tracks')) {
        const s = db.createObjectStore('tracks', { keyPath: 'id' });
        s.createIndex('title', 'title', { unique: false });
      }
      if (!db.objectStoreNames.contains('app_state'))
        db.createObjectStore('app_state', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('temp_audio_files'))
        db.createObjectStore('temp_audio_files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('my_music'))
        db.createObjectStore('my_music', { keyPath: 'trackId' });

      // TC-AUTH-003: users store
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('name', 'name', { unique: false });
        userStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // TC-AUTH-003: userId index on tracks (for existing databases)
      const trackStore = req.transaction?.objectStore('tracks');
      if (trackStore && !trackStore.indexNames.contains('userId')) {
        trackStore.createIndex('userId', 'userId', { unique: false });
      }



      if (import.meta.env.DEV) console.log('[IDB] Upgrade complete, stores:', [...db.objectStoreNames]);
    };

    req.onsuccess = () => {
      _db = req.result;

      // Handle version change from another tab — close gracefully
      _db.onversionchange = () => {
        console.warn('[IDB] Version change requested — closing connection');
        _db?.close();
        _db = null;
        _dbPromise = null;
      };

      resolve(_db!);
    };

    req.onerror = () => {
      console.error('[IDB] Open failed:', req.error);
      _dbPromise = null; // Reset so next call can retry
      reject(req.error);
    };

    req.onblocked = () => {
      console.warn('[IDB] Upgrade blocked — close other tabs with this app open');
      _dbPromise = null; // Allow retry on next call
      reject(new Error('[IDB] Database upgrade blocked. Please close other tabs and reload.'));
    };
  });

  return _dbPromise;
}

// ── Helper ─────────────────────────────────────────────

function _tx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode = 'readonly',
): IDBObjectStore {
  return db.transaction([store], mode).objectStore(store);
}

function _req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Tracks CRUD ────────────────────────────────────────

export async function getAllTracks(): Promise<TrackRecord[]> {
  const db = await _getDB();
  return _req(_tx(db, 'tracks').getAll());
}

/**
 * Get all tracks that are currently being processed by MVSEP.
 * Used for boot resume — resume orphaned jobs.
 */
export async function getMvsepProcessingTracks(): Promise<TrackRecord[]> {
  const all = await getAllTracks();
  return all.filter(
    (t) => t.mvsepStatus === 'processing'
  );
}

export async function getTrack(id: number): Promise<TrackRecord | undefined> {
  const db = await _getDB();
  return _req(_tx(db, 'tracks').get(id));
}

export async function saveTrack(data: TrackRecord): Promise<TrackRecord> {
  const db = await _getDB();
  const store = _tx(db, 'tracks', 'readwrite');

  if (!data.id) {
    // New track
    const id = await _req(store.add(data));
    return { ...data, id: id as number };
  }

  // Existing: merge with stored data to preserve fields
  const existing = await _req<TrackRecord | undefined>(
    _tx(db, 'tracks').get(data.id),
  );
  const merged = existing ? { ...existing, ...data } : data;
  await _req(_tx(db, 'tracks', 'readwrite').put(merged));
  await clearCatalogClearedFlag();
  return merged;
}

export async function deleteTrack(id: number): Promise<void> {
  const db = await _getDB();
  await _req(_tx(db, 'tracks', 'readwrite').delete(id));
}

export async function clearAllTracks(): Promise<void> {
  const db = await _getDB();
  await _req(_tx(db, 'tracks', 'readwrite').clear());
  await setCatalogCleared();
}

export async function updateTrackField(
  id: number,
  updates: Partial<TrackRecord>,
): Promise<void> {
  const db = await _getDB();
  const track = await _req<TrackRecord | undefined>(_tx(db, 'tracks').get(id));
  if (!track) return;
  const updated = { ...track, ...updates, lastModified: new Date().toISOString() };
  await _req(_tx(db, 'tracks', 'readwrite').put(updated));
}

// ── Markers shortcut ───────────────────────────────────

export async function saveMarkers(
  trackId: number,
  markers: PersistedSyncMarker[],
): Promise<void> {
  await updateTrackField(trackId, {
    syncMarkers: JSON.parse(JSON.stringify(markers)),
  });
}

// ── My Music ───────────────────────────────────────────

export async function getMyMusicIds(): Promise<number[]> {
  const db = await _getDB();
  const rows = await _req<any[]>(_tx(db, 'my_music').getAll());
  return rows.map((r) => r.trackId);
}

export async function addToMyMusic(trackId: number): Promise<void> {
  const db = await _getDB();
  await _req(
    _tx(db, 'my_music', 'readwrite').put({
      trackId,
      addedAt: new Date().toISOString(),
    }),
  );
}

export async function removeFromMyMusic(trackId: number): Promise<void> {
  const db = await _getDB();
  await _req(_tx(db, 'my_music', 'readwrite').delete(trackId));
}

// ── Users CRUD (TC-AUTH-003) ────────────────────────────

export async function getUser(id: string): Promise<UserRecord | undefined> {
  const db = await _getDB();
  return _req(_tx(db, 'users').get(id));
}

export async function getUserByName(name: string): Promise<UserRecord | undefined> {
  const db = await _getDB();
  const index = _tx(db, 'users').index('name');
  return _req(index.get(name));
}

export async function saveUser(user: UserRecord): Promise<UserRecord> {
  const db = await _getDB();
  await _req(_tx(db, 'users', 'readwrite').put(user));
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const db = await _getDB();
  await _req(_tx(db, 'users', 'readwrite').delete(id));
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const db = await _getDB();
  return _req(_tx(db, 'users').getAll());
}

// ── Guest → Profile Migration (TC-AUTH-003) ─────────────

export async function migrateGuestTracksToProfile(profileId: string): Promise<number> {
  const db = await _getDB();
  const tx = db.transaction(['tracks'], 'readwrite');
  const store = tx.objectStore('tracks');

  return new Promise<number>((resolve, reject) => {
    const request = store.openCursor();
    let migrated = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const track = cursor.value;
        if (!track.userId) {
          track.userId = profileId;
          cursor.update(track);
          migrated++;
        }
        cursor.continue();
      } else {
        tx.oncomplete = () => resolve(migrated);
      }
    };

    tx.onerror = () => reject(tx.error);
  });
}

export async function migrateGuestMyMusicToProfile(profileId: string): Promise<number> {
  const db = await _getDB();
  const rows = await _req<any[]>(_tx(db, 'my_music').getAll());
  return rows.length;
}

// ── Scenes Database (separate from TextAppDB to avoid migration blocking) ──

const SCENES_DB_NAME = 'beLive_scenes';
const SCENES_DB_VERSION = 1;

let _scenesDb: IDBDatabase | null = null;

function _getScenesDB(): Promise<IDBDatabase> {
  if (_scenesDb) return Promise.resolve(_scenesDb);

  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(SCENES_DB_NAME, SCENES_DB_VERSION);

    req.onupgradeneeded = (e) => {
      if (import.meta.env.DEV) console.log(`[ScenesDB] Upgrade: v${e.oldVersion} → v${e.newVersion}`);
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('custom_backgrounds')) {
        const store = db.createObjectStore('custom_backgrounds', { keyPath: 'id' });
        store.createIndex('trackId', 'trackId', { unique: false });
      }
      if (import.meta.env.DEV) console.log('[ScenesDB] Stores:', [...db.objectStoreNames]);
    };

    req.onsuccess = () => {
      _scenesDb = req.result;
      _scenesDb.onversionchange = () => {
        _scenesDb?.close();
        _scenesDb = null;
      };
      resolve(_scenesDb!);
    };

    req.onerror = () => {
      console.error('[ScenesDB] Open failed:', req.error);
      _scenesDb = null;
      reject(req.error);
    };

    req.onblocked = () => {
      console.warn('[ScenesDB] Upgrade blocked');
      _scenesDb = null;
      reject(new Error('[ScenesDB] Database upgrade blocked'));
    };
  });
}

// ── Block Scenes CRUD (Wave 2) ────────────────────────────

export async function getScenesForTrack(trackId: number): Promise<BlockSceneMeta[]> {
  const db = await _getScenesDB();
  const store = _tx(db, 'custom_backgrounds');
  const index = store.index('trackId');
  const records = await _req<any[]>(index.getAll(trackId));
  return records.map(({ blob, ...meta }) => meta as BlockSceneMeta);
}

export async function getSceneBlob(sceneId: string): Promise<Blob | null> {
  const db = await _getScenesDB();
  const record = await _req<any>(_tx(db, 'custom_backgrounds').get(sceneId));
  return record?.blob || null;
}

export async function getFullScene(sceneId: string): Promise<BlockScene | null> {
  const db = await _getScenesDB();
  const record = await _req<any>(_tx(db, 'custom_backgrounds').get(sceneId));
  return record || null;
}

export async function saveScene(scene: BlockScene): Promise<void> {
  const db = await _getScenesDB();
  await _req(_tx(db, 'custom_backgrounds', 'readwrite').put(scene));
}

export async function deleteScene(sceneId: string): Promise<void> {
  const db = await _getScenesDB();
  await _req(_tx(db, 'custom_backgrounds', 'readwrite').delete(sceneId));
}

export async function clearScenesForTrack(trackId: number): Promise<void> {
  const db = await _getScenesDB();
  const records = await getScenesForTrack(trackId);
  const store = _tx(db, 'custom_backgrounds', 'readwrite');
  for (const record of records) {
    store.delete(record.id);
  }
}

export async function getScenesCountForTrack(trackId: number): Promise<number> {
  const scenes = await getScenesForTrack(trackId);
  return scenes.length;
}

// ── Playlists (app_state) ──────────────────────────────

export async function loadPlaylists(): Promise<Playlist[]> {
  const db = await _getDB();
  const row = await _req<any>(_tx(db, 'app_state').get('playlists_v1'));
  if (row?.value && Array.isArray(row.value)) return row.value;
  // fallback: localStorage
  try {
    const ls = localStorage.getItem('playlists_v1');
    return ls ? JSON.parse(ls) : [];
  } catch { return []; }
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  const db = await _getDB();
  await _req(
    _tx(db, 'app_state', 'readwrite').put({
      key: 'playlists_v1',
      value: playlists,
      lastUpdated: Date.now(),
    }),
  );
}

export async function setCatalogCleared(): Promise<void> {
  const db = await _getDB();
  await _req(_tx(db, 'app_state', 'readwrite').put({ key: 'catalog_cleared_v1', value: true }));
}

export async function isCatalogCleared(): Promise<boolean> {
  const db = await _getDB();
  const row = await _req<any>(_tx(db, 'app_state').get('catalog_cleared_v1'));
  return row?.value === true;
}

export async function clearCatalogClearedFlag(): Promise<void> {
  const db = await _getDB();
  try {
    await _req(_tx(db, 'app_state', 'readwrite').delete('catalog_cleared_v1'));
  } catch (_) {}
}

// ── Generic App State Helpers ──

async function loadFromAppState<T>(key: string): Promise<T | null> {
  const db = await _getDB();
  const row = await _req<any>(_tx(db, 'app_state').get(key));
  return row?.value ?? null;
}

async function saveToAppState<T>(key: string, value: T): Promise<void> {
  const db = await _getDB();
  await _req(
    _tx(db, 'app_state', 'readwrite').put({
      key,
      value,
      lastUpdated: Date.now(),
    }),
  );
}

// ── Show Scenario Persistence ──

const REC_SCENARIO_KEY = 'rec_studio_scenario_v1';

interface ShowScenarioPersisted {
  schemaVersion: number;
  scenario: import('../types/show.types').ShowScenario;
}

export async function loadShowScenario(): Promise<import('../types/show.types').ShowScenario | null> {
  const raw = await loadFromAppState<ShowScenarioPersisted>(REC_SCENARIO_KEY);
  if (!raw) return null;
  return raw.scenario;
}

export async function saveShowScenario(scenario: import('../types/show.types').ShowScenario): Promise<void> {
  const persisted: ShowScenarioPersisted = {
    schemaVersion: 1,
    scenario,
  };
  await saveToAppState(REC_SCENARIO_KEY, persisted);
}

// ── Show Slide Image Persistence ──
// Используем beLive_scenes DB → custom_backgrounds store (тот же что и Block Scenes)
// Key: 'rec_img_${imageId}', trackId: 'rec'

export async function saveStepImage(imageId: string, blob: Blob): Promise<void> {
  const db = await _getScenesDB();
  await _req(
    _tx(db, 'custom_backgrounds', 'readwrite').put({
      id: `rec_img_${imageId}`,
      trackId: 'rec',
      blob,
    }),
  );
}

export async function getStepImage(imageId: string): Promise<Blob | null> {
  const db = await _getScenesDB();
  const record = await _req<any>(_tx(db, 'custom_backgrounds').get(`rec_img_${imageId}`));
  return record?.blob ?? null;
}

export async function deleteStepImage(imageId: string): Promise<void> {
  const db = await _getScenesDB();
  await _req(_tx(db, 'custom_backgrounds', 'readwrite').delete(`rec_img_${imageId}`));
}

export async function deleteStepImagesByPrefix(stepId: string): Promise<void> {
  const db = await _getScenesDB();
  const tx = db.transaction('custom_backgrounds', 'readwrite');
  const store = tx.objectStore('custom_backgrounds');
  const request = store.getAllKeys();
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      const keys = request.result as string[];
      const prefix = `rec_img_${stepId}_`;
      keys.forEach(key => {
        if (typeof key === 'string' && key.startsWith(prefix)) {
          store.delete(key);
        }
      });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Show HTML Persistence ──
// Key: 'rec_html_${htmlId}', trackId: 'rec'

export async function saveStepHtml(htmlId: string, blob: Blob): Promise<void> {
  const db = await _getScenesDB();
  await _req(
    _tx(db, 'custom_backgrounds', 'readwrite').put({
      id: `rec_html_${htmlId}`,
      trackId: 'rec',
      blob,
    }),
  );
}

export async function getStepHtml(htmlId: string): Promise<Blob | null> {
  const db = await _getScenesDB();
  const record = await _req<any>(_tx(db, 'custom_backgrounds').get(`rec_html_${htmlId}`));
  return record?.blob ?? null;
}

export async function deleteStepHtml(htmlId: string): Promise<void> {
  const db = await _getScenesDB();
  await _req(_tx(db, 'custom_backgrounds', 'readwrite').delete(`rec_html_${htmlId}`));
}
