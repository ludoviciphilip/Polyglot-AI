/**
 * Persistent key-value store for app data.
 *
 * Data lives in IndexedDB (much larger quota than localStorage and eligible for
 * `navigator.storage.persist()`), with localStorage as a fallback when IndexedDB
 * is unavailable (e.g. some private-browsing modes).
 *
 * The store keeps a synchronous in-memory snapshot so the app can read its initial
 * state synchronously after a single async `initPersistentStore()` call at startup.
 * Writes update the snapshot immediately and are flushed to the backend
 * asynchronously, coalescing rapid writes to the same key (latest value wins).
 */

export const STORAGE_KEY = 'polyglot_i1_data_v3';
export const SRS_STORAGE_KEY = 'polyglot_srs_cards_v1';
export const SRS_LOG_STORAGE_KEY = 'polyglot_srs_review_log_v1';

export const PERSISTED_KEYS = [STORAGE_KEY, SRS_STORAGE_KEY, SRS_LOG_STORAGE_KEY] as const;

export interface KVBackend {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// ============================================================
// Backends
// ============================================================
const IDB_NAME = 'polyglot-ai';
const IDB_STORE = 'kv';

const promisifyRequest = <T,>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const openIndexedDBBackend = async (dbName = IDB_NAME): Promise<KVBackend> => {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB unavailable');
  }
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) {
        request.result.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });

  const run = async <T,>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const tx = db.transaction(IDB_STORE, mode);
    const result = await promisifyRequest(fn(tx.objectStore(IDB_STORE)));
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      });
    }
    return result;
  };

  return {
    name: 'indexeddb',
    async get(key) {
      const value = await run('readonly', store => store.get(key));
      return typeof value === 'string' ? value : null;
    },
    async set(key, value) {
      await run('readwrite', store => store.put(value, key));
    },
    async remove(key) {
      await run('readwrite', store => store.delete(key));
    },
  };
};

export const createLocalStorageBackend = (storage: Storage | undefined = globalThis.localStorage): KVBackend => ({
  name: 'localstorage',
  async get(key) {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    storage?.setItem(key, value);
  },
  async remove(key) {
    try {
      storage?.removeItem(key);
    } catch {
      // ignore
    }
  },
});

export const createMemoryBackend = (seed: Record<string, string> = {}, name = 'memory'): KVBackend => {
  const map = new Map(Object.entries(seed));
  return {
    name,
    async get(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
  };
};

// ============================================================
// Migration
// ============================================================
export interface MigrationResult {
  migrated: string[];
  snapshot: Record<string, string | null>;
}

/**
 * Loads `keys` from `primary`. Any key missing in `primary` but present in `legacy`
 * is copied over, verified by read-back, and only then removed from `legacy`.
 * If the copy fails, the legacy value is still returned so no data is lost.
 */
export const loadWithMigration = async (
  primary: KVBackend,
  legacy: KVBackend | null,
  keys: readonly string[]
): Promise<MigrationResult> => {
  const snapshot: Record<string, string | null> = {};
  const migrated: string[] = [];

  for (const key of keys) {
    let value = await primary.get(key);
    if (value === null && legacy) {
      const legacyValue = await legacy.get(key);
      if (legacyValue !== null) {
        try {
          await primary.set(key, legacyValue);
          const verify = await primary.get(key);
          if (verify === legacyValue) {
            await legacy.remove(key);
            migrated.push(key);
          }
        } catch (e) {
          console.warn(`[Storage] Failed to migrate "${key}" to ${primary.name}; keeping legacy copy`, e);
        }
        value = legacyValue;
      }
    }
    snapshot[key] = value;
  }

  return { migrated, snapshot };
};

// ============================================================
// Store (module singleton)
// ============================================================
let backend: KVBackend | null = null;
const cache = new Map<string, string | null>();
const pendingWrites = new Map<string, string | null>();
let flushScheduled = false;
let flushPromise: Promise<void> = Promise.resolve();
let readOnly = false;

export interface InitOptions {
  /** Use this backend instead of IndexedDB/localStorage (demo mode, tests). */
  backend?: KVBackend;
  /** Never write anything (demo mode keeps the real user data untouched). */
  readOnly?: boolean;
}

export const initPersistentStore = async (options: InitOptions = {}): Promise<{ backend: string; migrated: string[] }> => {
  cache.clear();
  pendingWrites.clear();
  readOnly = Boolean(options.readOnly);

  if (options.backend) {
    backend = options.backend;
    const { snapshot } = await loadWithMigration(backend, null, PERSISTED_KEYS);
    Object.entries(snapshot).forEach(([k, v]) => cache.set(k, v));
    return { backend: backend.name, migrated: [] };
  }

  const legacy = createLocalStorageBackend();
  let migrated: string[] = [];
  try {
    const idb = await openIndexedDBBackend();
    const result = await loadWithMigration(idb, legacy, PERSISTED_KEYS);
    Object.entries(result.snapshot).forEach(([k, v]) => cache.set(k, v));
    migrated = result.migrated;
    backend = idb;
  } catch (e) {
    console.warn('[Storage] IndexedDB unavailable, falling back to localStorage', e);
    backend = legacy;
    for (const key of PERSISTED_KEYS) {
      cache.set(key, await legacy.get(key));
    }
  }

  void requestPersistentStorage();
  return { backend: backend.name, migrated };
};

/** Synchronous read from the in-memory snapshot. */
export const getStoredItem = (key: string): string | null => (cache.has(key) ? cache.get(key)! : null);

/** Updates the snapshot immediately and schedules an async flush to the backend. */
export const setStoredItem = (key: string, value: string): void => {
  cache.set(key, value);
  if (readOnly) return;
  pendingWrites.set(key, value);
  scheduleFlush();
};

export const removeStoredItem = (key: string): void => {
  cache.set(key, null);
  if (readOnly) return;
  pendingWrites.set(key, null);
  scheduleFlush();
};

const scheduleFlush = () => {
  if (flushScheduled) return;
  flushScheduled = true;
  flushPromise = flushPromise.then(() => new Promise<void>(resolve => {
    // Microtask-ish delay coalesces bursts of state updates into one write per key
    setTimeout(async () => {
      flushScheduled = false;
      const entries = Array.from(pendingWrites.entries());
      pendingWrites.clear();
      for (const [key, value] of entries) {
        try {
          if (!backend) continue;
          if (value === null) await backend.remove(key);
          else await backend.set(key, value);
        } catch (e) {
          console.error(`[Storage] Failed to persist "${key}" to ${backend?.name}`, e);
          globalThis.dispatchEvent?.(new CustomEvent('polyglot-storage-error', { detail: { key, error: e } }));
        }
      }
      resolve();
    }, 50);
  }));
};

/** Resolves once all scheduled writes have been attempted. */
export const flushPersistentStore = (): Promise<void> => flushPromise;

export const getActiveBackendName = (): string => backend?.name ?? 'none';

/** Asks the browser not to evict our data under storage pressure (best effort). */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      if (await navigator.storage.persisted?.()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
};

// Flush pending writes when the page is being hidden (tab switch, app backgrounded on mobile)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pendingWrites.size > 0) {
      void flushPersistentStore();
    }
  });
}
