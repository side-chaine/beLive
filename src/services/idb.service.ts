/**
 * IDB Service — React-native IndexedDB access
 * F30: Own IndexedDB connection (independent of legacy)
 */

const DB_NAME = (globalThis as any).__DB_NAME || 'TextAppDB';
const DB_VERSION = 6;

// ── Types ──────────────────────────────────────────────

export interface TrackRecord {
  id: number;
  title: string;
  instrumentalData: ArrayBuffer;
  instrumentalType: string;
  vocalsData?: ArrayBuffer | null;
  vocalsType?: string | null;
  lyricsFileName?: string | null;
  lyricsOriginalContent?: string | null;
  lyrics?: string | null;
  blocksData?: any[] | null;
  syncMarkers?: any[] | null;
  dateAdded: string;
  lastModified: string;
}

// ── Connection ─────────────────────────────────────────

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase> | null = null;

function _getDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
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
    };
    req.onsuccess = () => { _db = req.result; resolve(_db!); };
    req.onerror = () => reject(req.error);
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
  markers: any[],
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

// ── Playlists (app_state) ──────────────────────────────

export async function loadPlaylists(): Promise<any[]> {
  const db = await _getDB();
  const row = await _req<any>(_tx(db, 'app_state').get('playlists_v1'));
  if (row?.value && Array.isArray(row.value)) return row.value;
  // fallback: localStorage
  try {
    const ls = localStorage.getItem('playlists_v1');
    return ls ? JSON.parse(ls) : [];
  } catch { return []; }
}

export async function savePlaylists(playlists: any[]): Promise<void> {
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
