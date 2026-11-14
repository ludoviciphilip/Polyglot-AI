/**
 * Valida os arquivos de vocabulário em public/vocab, gerados por scripts/vocab/build_en.py.
 * Os arquivos viram o knownWords do usuário no onboarding, então um erro aqui
 * muda o nível calculado e o que o validador de histórias aceita.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokenize } from '../services/geminiService';

const loadList = (file: string): string[] =>
  JSON.parse(readFileSync(resolve(__dirname, '../public/vocab', file), 'utf-8'));

// Sizes match the minimum of each level in calculateLevelFromVocab (App.tsx)
const ENGLISH_FILES = [
  { file: 'en_a1.json', size: 600 },
  { file: 'en_a2.json', size: 1500 },
  { file: 'en_b1.json', size: 3000 },
  { file: 'en_b2.json', size: 6000 },
];

describe('English vocabulary files', () => {
  const lists = ENGLISH_FILES.map(({ file, size }) => ({ file, size, words: loadList(file) }));

  describe.each(lists)('$file', ({ size, words }) => {
    it(`has exactly ${size} words`, () => {
      expect(words).toHaveLength(size);
    });

    it('has no duplicates', () => {
      expect(new Set(words).size).toBe(words.length);
    });

    it('contains only lowercase single words (a-z)', () => {
      const invalid = words.filter(w => !/^[a-z]+$/.test(w));
      expect(invalid).toEqual([]);
    });

    it('keeps every word intact through the story tokenizer', () => {
      // tokenize() drops 1-letter tokens, so "a" and "i" are skipped here
      const broken = words.filter(w => w.length > 1 && tokenize(w).join(' ') !== w);
      expect(broken).toEqual([]);
    });
  });

  it('is cumulative: each level starts with the whole previous level, in order', () => {
    for (let i = 1; i < lists.length; i++) {
      const previous = lists[i - 1].words;
      expect(lists[i].words.slice(0, previous.length)).toEqual(previous);
    }
  });

  it('A1 contains the most basic words', () => {
    const a1 = new Set(lists[0].words);
    for (const word of ['the', 'is', 'you', 'have', 'go', 'good', 'house', 'water', 'friend']) {
      expect(a1.has(word), word).toBe(true);
    }
  });

  it('A2 already covers everyday words and their irregular forms', () => {
    // Regression: the first version of these files missed these words even at B2
    const a2 = new Set(lists[1].words);
    for (const word of ['always', 'never', 'happy', 'dog', 'cat', 'children', 'morning', 'went', 'better', 'women']) {
      expect(a2.has(word), word).toBe(true);
    }
  });
});
