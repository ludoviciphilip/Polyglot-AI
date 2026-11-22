import { describe, it, expect } from 'vitest';
import {
  createMemoryBackend,
  loadWithMigration,
  initPersistentStore,
  getStoredItem,
  setStoredItem,
  flushPersistentStore,
  STORAGE_KEY,
  SRS_STORAGE_KEY,
  KVBackend,
} from './persistentStore';
import { shouldRegisterServiceWorker } from './pwa';

const failingBackend = (base: KVBackend): KVBackend => ({
  ...base,
  name: 'failing',
  async set() {
    throw new Error('QuotaExceededError');
  },
});

describe('loadWithMigration', () => {
  it('copies legacy values into the primary store and removes them from legacy after verification', async () => {
    const primary = createMemoryBackend({}, 'idb');
    const legacy = createMemoryBackend({ [STORAGE_KEY]: '{"profile":{}}', [SRS_STORAGE_KEY]: '[]' }, 'ls');

    const { migrated, snapshot } = await loadWithMigration(primary, legacy, [STORAGE_KEY, SRS_STORAGE_KEY, 'missing']);

    expect(migrated).toEqual([STORAGE_KEY, SRS_STORAGE_KEY]);
    expect(snapshot[STORAGE_KEY]).toBe('{"profile":{}}');
    expect(snapshot.missing).toBeNull();
    expect(await primary.get(STORAGE_KEY)).toBe('{"profile":{}}');
    expect(await legacy.get(STORAGE_KEY)).toBeNull();
  });

  it('prefers existing primary data over legacy data', async () => {
    const primary = createMemoryBackend({ [STORAGE_KEY]: 'new' });
    const legacy = createMemoryBackend({ [STORAGE_KEY]: 'old' });
    const { migrated, snapshot } = await loadWithMigration(primary, legacy, [STORAGE_KEY]);
    expect(migrated).toEqual([]);
    expect(snapshot[STORAGE_KEY]).toBe('new');
    expect(await legacy.get(STORAGE_KEY)).toBe('old');
  });

  it('keeps the legacy copy (and still returns its value) when writing to primary fails', async () => {
    const primary = failingBackend(createMemoryBackend());
    const legacy = createMemoryBackend({ [STORAGE_KEY]: 'precious' });
    const { migrated, snapshot } = await loadWithMigration(primary, legacy, [STORAGE_KEY]);
    expect(migrated).toEqual([]);
    expect(snapshot[STORAGE_KEY]).toBe('precious');
    expect(await legacy.get(STORAGE_KEY)).toBe('precious');
  });
});

describe('persistent store', () => {
  it('serves synchronous reads from the snapshot and flushes writes to the backend', async () => {
    const backend = createMemoryBackend({ [STORAGE_KEY]: 'v1' });
    await initPersistentStore({ backend });
    expect(getStoredItem(STORAGE_KEY)).toBe('v1');

    setStoredItem(STORAGE_KEY, 'v2');
    setStoredItem(STORAGE_KEY, 'v3');
    expect(getStoredItem(STORAGE_KEY)).toBe('v3');
    await flushPersistentStore();
    expect(await backend.get(STORAGE_KEY)).toBe('v3');
  });

  it('never writes to the backend in read-only (demo) mode', async () => {
    const backend = createMemoryBackend({ [STORAGE_KEY]: 'real-user-data' });
    await initPersistentStore({ backend, readOnly: true });
    setStoredItem(STORAGE_KEY, 'demo-change');
    expect(getStoredItem(STORAGE_KEY)).toBe('demo-change');
    await flushPersistentStore();
    expect(await backend.get(STORAGE_KEY)).toBe('real-user-data');
  });
});

describe('shouldRegisterServiceWorker', () => {
  it('only registers in production, top-level windows with service worker support', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, hasServiceWorker: true, isTopLevel: true })).toBe(true);
    expect(shouldRegisterServiceWorker({ isProd: false, hasServiceWorker: true, isTopLevel: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ isProd: true, hasServiceWorker: true, isTopLevel: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ isProd: true, hasServiceWorker: false, isTopLevel: true })).toBe(false);
  });
});
