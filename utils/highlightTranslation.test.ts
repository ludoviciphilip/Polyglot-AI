import { describe, it, expect } from 'vitest';
import {
  cleanPhonetic,
  findTranslationHighlightRange,
  formatIpa,
} from './highlightTranslation';

const sliceSpan = (text: string, span: { start: number; end: number } | null) =>
  span ? text.slice(span.start, span.end) : null;

describe('highlightTranslation', () => {
  it('highlights the exact new_element_translation span when provided', () => {
    const sentence = {
      new_element: 'intraprende',
      new_element_translation: 'empreende',
      translation: 'Marco empreende uma viagem importante em direção à cidade.',
      explanation: 'Significa dar início a uma jornada, projeto ou ação.',
    };
    const span = findTranslationHighlightRange(sentence);
    expect(sliceSpan(sentence.translation, span)).toBe('empreende');
  });

  it('highlights multi-word idioms from new_element_translation cleanly', () => {
    const sentence = {
      new_element: 'give up',
      new_element_translation: 'desistir de',
      translation: 'Ele nunca vai desistir de seus sonhos.',
      explanation: 'Significa abandonar uma tentativa.',
    };
    const span = findTranslationHighlightRange(sentence);
    expect(sliceSpan(sentence.translation, span)).toBe('desistir de');
  });

  it('never highlights a stopword like "uma" from a descriptive legacy explanation', () => {
    const sentence = {
      new_element: 'intraprende',
      translation: 'Marco empreende uma viagem importante em direção à cidade.',
      explanation: 'Significa dar início a uma jornada, projeto ou ação.',
    };
    const span = findTranslationHighlightRange(sentence);
    // Without new_element_translation, must NOT match "uma"
    expect(sliceSpan(sentence.translation, span)).not.toBe('uma');
  });

  it('finds high-confidence cognates on legacy stories without new_element_translation', () => {
    const sentence = {
      new_element: 'ispeziona',
      translation: 'Ele inspeciona uma plataforma da estação.',
      explanation: 'Significa examinar ou observar algo detalhadamente para verificar seu estado.',
    };
    const span = findTranslationHighlightRange(sentence);
    expect(sliceSpan(sentence.translation, span)).toBe('inspeciona');
  });

  it('supports concise direct glosses in legacy explanations', () => {
    const sentence = {
      new_element: 'binario',
      translation: 'Ele inspeciona uma plataforma da estação.',
      explanation: 'plataforma — local onde o trem para na estação.',
    };
    const span = findTranslationHighlightRange(sentence);
    expect(sliceSpan(sentence.translation, span)).toBe('plataforma');
  });

  it('handles diacritic-insensitive matches cleanly', () => {
    const sentence = {
      new_element: 'stazione',
      new_element_translation: 'estacao',
      translation: 'Ele chegou na estação cedo.',
      explanation: 'Estação de trem.',
    };
    const span = findTranslationHighlightRange(sentence);
    expect(sliceSpan(sentence.translation, span)).toBe('estação');
  });

  it('cleans and formats IPA without double slashes', () => {
    expect(cleanPhonetic("/intra'prɛnde/")).toBe("intra'prɛnde");
    expect(formatIpa("/intra'prɛnde/")).toBe("/intra'prɛnde/");
    expect(formatIpa("intra'prɛnde")).toBe("/intra'prɛnde/");
    expect(formatIpa("//ispet'tsjona//")).toBe("/ispet'tsjona/");
    expect(formatIpa('')).toBe('');
  });
});
