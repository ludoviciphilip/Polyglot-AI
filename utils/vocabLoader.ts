import { CEFRLevel } from '../types';

function getVocabUrl(level: CEFRLevel): string | null {
  const map: Partial<Record<CEFRLevel, string>> = {
    'A1': '/vocab/en_a1.json',
    'A2': '/vocab/en_a2.json',
    'B1': '/vocab/en_b1.json',
    'B2': '/vocab/en_b2.json',
  };
  return map[level] ?? null;
}

const cache = new Map<string, string[]>();

/**
 * Loads English vocabulary for the given CEFR level via fetch (lazy load).
 * Pre-A1, C1 and C2 return [] without fetching (no file available).
 * On network/parse error, returns [] without throwing.
 */
export async function loadEnglishVocab(level: CEFRLevel): Promise<string[]> {
  const url = getVocabUrl(level);
  if (!url) return [];

  if (cache.has(url)) return cache.get(url)!;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    const words = data.filter((w): w is string => typeof w === 'string' && w.length > 0);
    cache.set(url, words);
    return words;
  } catch {
    return [];
  }
}
