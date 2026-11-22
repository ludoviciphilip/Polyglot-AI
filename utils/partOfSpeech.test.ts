import { describe, it, expect } from 'vitest';
import { localizePartOfSpeech } from './partOfSpeech';

describe('localizePartOfSpeech', () => {
  it('translates common categories into each UI language', () => {
    expect(localizePartOfSpeech('noun', 'pt')).toBe('substantivo');
    expect(localizePartOfSpeech('verb', 'de')).toBe('Verb');
    expect(localizePartOfSpeech('adjective', 'fr')).toBe('adjectif');
    expect(localizePartOfSpeech('adverb', 'es')).toBe('adverbio');
    expect(localizePartOfSpeech('preposition', 'it')).toBe('preposizione');
    expect(localizePartOfSpeech('pronoun', 'en')).toBe('pronoun');
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(localizePartOfSpeech('NOUN', 'pt')).toBe('substantivo');
    expect(localizePartOfSpeech('  Phrasal Verb ', 'es')).toBe('verbo frasal');
  });

  it('handles multi-word categories and aliases', () => {
    expect(localizePartOfSpeech('auxiliary verb', 'de')).toBe('Hilfsverb');
    expect(localizePartOfSpeech('modal verb', 'it')).toBe('verbo modale');
    expect(localizePartOfSpeech('idiom', 'fr')).toBe('expression idiomatique');
    expect(localizePartOfSpeech('adj', 'pt')).toBe('adjetivo');
    expect(localizePartOfSpeech('past participle', 'es')).toBe('participio');
  });

  it('accepts BCP 47 locales as the UI language', () => {
    expect(localizePartOfSpeech('conjunction', 'pt-BR')).toBe('conjunção');
    expect(localizePartOfSpeech('article', 'de-DE')).toBe('Artikel');
  });

  it('returns the original string for unknown categories or languages', () => {
    expect(localizePartOfSpeech('gerundive', 'pt')).toBe('gerundive');
    expect(localizePartOfSpeech('Noun', 'ja')).toBe('Noun');
    expect(localizePartOfSpeech('noun', '')).toBe('noun');
    expect(localizePartOfSpeech('', 'pt')).toBe('');
  });
});
