type UiLang = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it';

// Translations indexed as [en, pt, es, fr, de, it]
type PosTranslations = [string, string, string, string, string, string];

const UI_INDEX: Record<UiLang, number> = { en: 0, pt: 1, es: 2, fr: 3, de: 4, it: 5 };

const POS: Record<string, PosTranslations> = {
  noun: ['noun', 'substantivo', 'sustantivo', 'nom', 'Substantiv', 'sostantivo'],
  verb: ['verb', 'verbo', 'verbo', 'verbe', 'Verb', 'verbo'],
  adjective: ['adjective', 'adjetivo', 'adjetivo', 'adjectif', 'Adjektiv', 'aggettivo'],
  adverb: ['adverb', 'advérbio', 'adverbio', 'adverbe', 'Adverb', 'avverbio'],
  pronoun: ['pronoun', 'pronome', 'pronombre', 'pronom', 'Pronomen', 'pronome'],
  preposition: ['preposition', 'preposição', 'preposición', 'préposition', 'Präposition', 'preposizione'],
  conjunction: ['conjunction', 'conjunção', 'conjunción', 'conjonction', 'Konjunktion', 'congiunzione'],
  interjection: ['interjection', 'interjeição', 'interjección', 'interjection', 'Interjektion', 'interiezione'],
  article: ['article', 'artigo', 'artículo', 'article', 'Artikel', 'articolo'],
  determiner: ['determiner', 'determinante', 'determinante', 'déterminant', 'Determinativ', 'determinante'],
  numeral: ['numeral', 'numeral', 'numeral', 'numéral', 'Numerale', 'numerale'],
  'phrasal verb': ['phrasal verb', 'phrasal verb', 'verbo frasal', 'verbe à particule', 'Partikelverb', 'verbo frasale'],
  idiom: ['idiom', 'expressão idiomática', 'modismo', 'expression idiomatique', 'Redewendung', 'espressione idiomatica'],
  expression: ['expression', 'expressão', 'expresión', 'expression', 'Ausdruck', 'espressione'],
  'auxiliary verb': ['auxiliary verb', 'verbo auxiliar', 'verbo auxiliar', 'verbe auxiliaire', 'Hilfsverb', 'verbo ausiliare'],
  'modal verb': ['modal verb', 'verbo modal', 'verbo modal', 'verbe modal', 'Modalverb', 'verbo modale'],
  participle: ['participle', 'particípio', 'participio', 'participe', 'Partizip', 'participio'],
  particle: ['particle', 'partícula', 'partícula', 'particule', 'Partikel', 'particella'],
};

// Common variants/abbreviations the AI may return, mapped to canonical keys
const ALIASES: Record<string, string> = {
  n: 'noun',
  'proper noun': 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  pron: 'pronoun',
  prep: 'preposition',
  conj: 'conjunction',
  interj: 'interjection',
  num: 'numeral',
  number: 'numeral',
  'idiomatic expression': 'idiom',
  'fixed expression': 'expression',
  phrase: 'expression',
  auxiliary: 'auxiliary verb',
  modal: 'modal verb',
  'past participle': 'participle',
  'present participle': 'participle',
};

const resolveUiLang = (ui: string): UiLang | null => {
  const prefix = String(ui || '').trim().toLowerCase().split(/[-_]/)[0];
  return prefix in UI_INDEX ? (prefix as UiLang) : null;
};

/**
 * Localizes an English part-of-speech tag (as returned by the AI) into the UI language.
 * `ui` may be a bare code ('pt') or a BCP 47 locale ('pt-BR').
 * Returns the original string unchanged when the category or UI language is unknown.
 */
export const localizePartOfSpeech = (pos: string, ui: string): string => {
  if (!pos) return pos;
  const lang = resolveUiLang(ui);
  if (!lang) return pos;

  const normalized = pos.trim().toLowerCase().replace(/[\s_]+/g, ' ').replace(/\.$/, '');
  const key = POS[normalized] ? normalized : ALIASES[normalized];
  if (!key || !POS[key]) return pos;

  return POS[key][UI_INDEX[lang]];
};
