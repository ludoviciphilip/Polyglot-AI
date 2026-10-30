import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function mockFetch(data: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  }));
}

function mockFetchThrow() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
}

// Each test that needs an isolated cache must use a fresh module import.
// We use vi.resetModules() + dynamic import inside the test to achieve that.
async function freshLoad() {
  vi.resetModules();
  const mod = await import('./vocabLoader.ts');
  return mod.loadEnglishVocab;
}

describe('loadEnglishVocab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('levels without a vocab file (no fetch)', () => {
    it('returns [] for Pre-A1 without calling fetch', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('Pre-A1');

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns [] for C1 without calling fetch', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('C1');

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns [] for C2 without calling fetch', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('C2');

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('happy path — fetches correct URL and returns words', () => {
    it('fetches /vocab/en_a1.json for A1 and returns the word array', async () => {
      const words = ['apple', 'book', 'cat'];
      mockFetch(words);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(global.fetch).toHaveBeenCalledWith('/vocab/en_a1.json');
      expect(result).toEqual(words);
    });

    it('fetches /vocab/en_a2.json for A2', async () => {
      mockFetch(['dog', 'door']);
      const loadEnglishVocab = await freshLoad();

      await loadEnglishVocab('A2');

      expect(global.fetch).toHaveBeenCalledWith('/vocab/en_a2.json');
    });

    it('fetches /vocab/en_b1.json for B1', async () => {
      mockFetch(['effort', 'engage']);
      const loadEnglishVocab = await freshLoad();

      await loadEnglishVocab('B1');

      expect(global.fetch).toHaveBeenCalledWith('/vocab/en_b1.json');
    });

    it('fetches /vocab/en_b2.json for B2', async () => {
      mockFetch(['hypothesis', 'inference']);
      const loadEnglishVocab = await freshLoad();

      await loadEnglishVocab('B2');

      expect(global.fetch).toHaveBeenCalledWith('/vocab/en_b2.json');
    });
  });

  describe('error cases', () => {
    it('returns [] when response is not ok (status 404)', async () => {
      mockFetch(null, false);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual([]);
    });

    it('returns [] when fetch throws (network error)', async () => {
      mockFetchThrow();
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual([]);
    });

    it('returns [] when JSON response is not an array (object)', async () => {
      mockFetch({ words: ['apple'] });
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual([]);
    });

    it('returns [] when JSON response is not an array (string)', async () => {
      mockFetch('apple,book');
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual([]);
    });

    it('returns [] when JSON response is null', async () => {
      mockFetch(null);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual([]);
    });
  });

  describe('filtering — only non-empty strings', () => {
    it('filters out non-string entries from the JSON array', async () => {
      mockFetch(['apple', 42, true, null, 'book']);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual(['apple', 'book']);
    });

    it('filters out empty strings from the JSON array', async () => {
      mockFetch(['apple', '', 'book', '']);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual(['apple', 'book']);
    });

    it('returns [] when all entries are empty strings or non-strings', async () => {
      mockFetch(['', '', 0, false]);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual([]);
    });

    it('returns [] when JSON array is empty', async () => {
      mockFetch([]);
      const loadEnglishVocab = await freshLoad();

      const result = await loadEnglishVocab('A1');

      expect(result).toEqual([]);
    });
  });

  describe('caching', () => {
    it('calls fetch only once for the same level on repeated calls', async () => {
      const words = ['apple', 'book'];
      mockFetch(words);
      const loadEnglishVocab = await freshLoad();

      const first = await loadEnglishVocab('A1');
      const second = await loadEnglishVocab('A1');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(first).toEqual(words);
      expect(second).toEqual(words);
    });

    it('fetches separately for each distinct level (different URLs)', async () => {
      mockFetch(['apple']);
      const loadEnglishVocab = await freshLoad();

      await loadEnglishVocab('A1');
      await loadEnglishVocab('A2');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/vocab/en_a1.json');
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/vocab/en_a2.json');
    });

    it('does not cache failed responses (not-ok), so a retry can fetch again', async () => {
      // First call: not ok -> returns []
      mockFetch(null, false);
      const loadEnglishVocab = await freshLoad();
      const first = await loadEnglishVocab('A1');
      expect(first).toEqual([]);
      const firstSpy = global.fetch as ReturnType<typeof vi.fn>;
      expect(firstSpy).toHaveBeenCalledTimes(1);

      // Second call: replace stub with a successful one
      // (failed responses are not cached, so fetch is called again)
      mockFetch(['apple']);
      const second = await loadEnglishVocab('A1');
      expect(second).toEqual(['apple']);
      const secondSpy = global.fetch as ReturnType<typeof vi.fn>;
      expect(secondSpy).toHaveBeenCalledTimes(1);
    });
  });
});
