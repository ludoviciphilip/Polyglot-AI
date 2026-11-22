import { Sentence } from '../types';

export interface TextSpan {
  start: number;
  end: number;
}

// Common function words and explanatory meta-words across PT, EN, ES, FR, DE, IT
// that should never be mistakenly highlighted as an i+1 translation fallback.
const STOPWORDS = new Set<string>([
  // Portuguese
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'pelo', 'pela', 'pelos', 'pelas', 'para',
  'com', 'sem', 'sob', 'sobre', 'entre', 'ate', 'que', 'quem', 'qual', 'como',
  'quando', 'onde', 'porque', 'mas', 'porem', 'contudo', 'ou', 'nem', 'se', 'ao',
  'aos', 'ele', 'ela', 'eles', 'elas', 'isso', 'isto', 'aquilo', 'esse', 'essa',
  'este', 'esta', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'nosso', 'nossa',
  'muito', 'muita', 'mais', 'menos', 'algo', 'alguem', 'tudo', 'todo', 'toda',
  'ser', 'estar', 'ter', 'fazer', 'dar', 'ir', 'ver', 'poder', 'dizer',
  // English
  'the', 'an', 'and', 'or', 'but', 'nor', 'for', 'with', 'without', 'from', 'into',
  'onto', 'over', 'under', 'about', 'above', 'below', 'between', 'through', 'during',
  'that', 'this', 'these', 'those', 'which', 'who', 'whom', 'whose', 'what', 'when',
  'where', 'why', 'how', 'his', 'her', 'its', 'our', 'your', 'their', 'they', 'them',
  'she', 'him', 'you', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'does', 'did', 'will', 'would', 'could', 'should', 'very', 'more', 'most', 'some',
  'any', 'something', 'someone',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'del', 'al', 'con', 'sin',
  'por', 'para', 'sobre', 'entre', 'hasta', 'desde', 'hacia', 'pero', 'sino', 'como',
  'cuando', 'donde', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'eso', 'aquel',
  'ella', 'ellos', 'ellas', 'algo', 'alguien', 'todo', 'toda', 'muy', 'mas', 'menos',
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'au', 'aux', 'de', 'dans', 'par',
  'pour', 'avec', 'sans', 'sur', 'sous', 'entre', 'vers', 'chez', 'mais', 'donc',
  'que', 'qui', 'quoi', 'dont', 'quand', 'comme', 'elle', 'ils', 'elles', 'nous',
  'vous', 'cette', 'ces', 'son', 'ses', 'leur', 'leurs', 'tres', 'plus', 'moins',
  'quelque', 'chose', 'faire', 'etre', 'avoir',
  // German
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer',
  'eines', 'und', 'oder', 'aber', 'denn', 'weil', 'dass', 'wenn', 'als', 'wie',
  'mit', 'ohne', 'fur', 'von', 'aus', 'bei', 'nach', 'seit', 'uber', 'unter',
  'zwischen', 'durch', 'gegen', 'nicht', 'auch', 'sehr', 'mehr', 'etwas', 'jemand',
  // Italian
  'il', 'lo', 'la', 'gli', 'le', 'un', 'uno', 'una', 'del', 'dello', 'della', 'dei',
  'degli', 'delle', 'al', 'allo', 'alla', 'dal', 'dallo', 'dalla', 'nel', 'nello',
  'nella', 'sul', 'sullo', 'sulla', 'con', 'senza', 'per', 'tra', 'fra', 'che',
  'chi', 'cui', 'come', 'quando', 'dove', 'perche', 'pero', 'anche', 'molto', 'piu',
  'meno', 'qualcosa', 'qualcuno', 'essere', 'avere', 'fare',
]);

const EXPLANATION_META_STARTERS = new Set<string>([
  'significa', 'indica', 'refere', 'expressa', 'descreve', 'designa', 'equivale',
  'corresponde', 'usado', 'usada', 'utilizado', 'utilizada', 'trata', 'palavra',
  'termo', 'verbo', 'substantivo', 'adjetivo', 'adverbio', 'forma', 'acao',
  'means', 'refers', 'indicates', 'expresses', 'describes', 'used', 'word', 'term',
  'verb', 'noun', 'adjective', 'adverb', 'action', 'denotes', 'represents',
  'signifie', 'indique', 'designe', 'exprime', 'decrit', 'utilise', 'mot',
  'bedeutet', 'bezeichnet', 'beschreibt', 'druckt', 'verwendet', 'wort',
]);

export function cleanPhonetic(phonetic?: string): string {
  if (!phonetic) return '';
  return phonetic.trim().replace(/^\/+|\/+$/g, '').trim();
}

export function formatIpa(phonetic?: string): string {
  const cleaned = cleanPhonetic(phonetic);
  return cleaned ? `/${cleaned}/` : '';
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function extractWordTokens(text: string): Array<{ word: string; norm: string; start: number; end: number }> {
  const tokens: Array<{ word: string; norm: string; start: number; end: number }> = [];
  const regex = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const word = match[0];
    tokens.push({
      word,
      norm: normalizeForComparison(word),
      start: match.index,
      end: match.index + word.length,
    });
  }
  return tokens;
}

/**
 * Finds an exact whole-word/phrase occurrence of `needle` inside `text`
 * (case-insensitive, with an accent-insensitive token-sequence fallback).
 */
export function findExactBoundaryMatch(text: string, needle: string): TextSpan | null {
  const trimmed = needle
    .trim()
    .replace(/^[«»"“”'‘’(\[\s.,;:!?]+|[«»"“”'‘’)\]\s.,;:!?]+$/g, '')
    .trim();
  if (trimmed.length < 2) return null;

  try {
    const escaped = escapeRegExp(trimmed);
    const regex = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(${escaped})(?![\\p{L}\\p{M}\\p{N}])`, 'iu');
    const match = regex.exec(text);
    if (match && match.index !== undefined) {
      return { start: match.index, end: match.index + match[0].length };
    }
  } catch {
    // Fall through to token-based matching
  }

  // Diacritic-insensitive whole-token sequence fallback
  const needleTokens = extractWordTokens(trimmed);
  if (needleTokens.length === 0) return null;
  const textTokens = extractWordTokens(text);
  for (let i = 0; i <= textTokens.length - needleTokens.length; i++) {
    let allMatch = true;
    for (let j = 0; j < needleTokens.length; j++) {
      if (textTokens[i + j].norm !== needleTokens[j].norm) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      return {
        start: textTokens[i].start,
        end: textTokens[i + needleTokens.length - 1].end,
      };
    }
  }

  return null;
}

/**
 * Finds the best single content word in `translation` closely resembling `targetWord`
 * (used for cognate matching or slight inflectional mismatch like infinitive vs conjugated form).
 */
function findClosestContentWordMatch(
  translation: string,
  targetWord: string,
  minSimilarity: number
): TextSpan | null {
  const normTarget = normalizeForComparison(targetWord);
  if (normTarget.length < 4 || STOPWORDS.has(normTarget)) return null;

  const tokens = extractWordTokens(translation);
  let bestSpan: TextSpan | null = null;
  let bestScore = 0;

  for (const tok of tokens) {
    if (tok.norm.length < 4 || STOPWORDS.has(tok.norm)) continue;
    if (tok.norm === normTarget) {
      return { start: tok.start, end: tok.end };
    }
    // Require matching starting letter (or strong shared prefix of >= 4 chars) to prevent false positives
    const sameStart = tok.norm[0] === normTarget[0];
    const sharedPrefix4 = tok.norm.slice(0, 4) === normTarget.slice(0, 4);
    if (!sameStart && !sharedPrefix4) continue;

    const maxLen = Math.max(tok.norm.length, normTarget.length);
    if (maxLen < 5) continue;
    const dist = levenshtein(tok.norm, normTarget);
    const similarity = 1 - dist / maxLen;

    if (similarity >= minSimilarity && similarity > bestScore) {
      bestScore = similarity;
      bestSpan = { start: tok.start, end: tok.end };
    }
  }

  return bestSpan;
}

/**
 * Returns the native-language word/phrase that translates `new_element` in this sentence.
 * Prefers the model-aligned `new_element_translation`; for legacy stories it falls back to the
 * span located by `findTranslationHighlightRange`. Returns '' when no reliable gloss exists.
 */
export function getElementTranslation(
  sentence: Pick<Sentence, 'translation' | 'new_element' | 'new_element_translation' | 'explanation'>
): string {
  const direct = sentence?.new_element_translation?.trim();
  if (direct) return direct;
  const span = findTranslationHighlightRange(sentence);
  return span && sentence.translation ? sentence.translation.slice(span.start, span.end).trim() : '';
}

/**
 * Locates the exact character span in `sentence.translation` that corresponds to
 * `sentence.new_element`, preferring the model-aligned `new_element_translation`
 * and falling back safely for legacy saved stories without highlighting stopwords.
 */
export function findTranslationHighlightRange(
  sentence: Pick<Sentence, 'translation' | 'new_element' | 'new_element_translation' | 'explanation'>
): TextSpan | null {
  if (!sentence?.translation || !sentence?.new_element?.trim()) return null;
  const translation = sentence.translation;

  // 1. Primary: exact verbatim translation span provided by annotateStory
  if (sentence.new_element_translation && sentence.new_element_translation.trim().length > 0) {
    const exact = findExactBoundaryMatch(translation, sentence.new_element_translation);
    if (exact) return exact;

    // Slight inflection fallback if the model gave e.g. lemma/infinitive instead of conjugated form
    const cleanSpan = sentence.new_element_translation.trim();
    if (!/\s/.test(cleanSpan)) {
      const inflected = findClosestContentWordMatch(translation, cleanSpan, 0.72);
      if (inflected) return inflected;
    }
  }

  // 2. Legacy fallback A: concise direct gloss at the start of `explanation` (e.g. "empreende — dar início...")
  // Deliberately ignores full descriptive sentences (e.g. "Significa dar início a uma jornada...").
  if (sentence.explanation) {
    const cleaned = sentence.explanation.replace(/[«»"“”'‘’]/g, '').trim();
    const head = cleaned.split(/[:;\-—–\/(.!?]/)[0].trim();
    const headTokens = extractWordTokens(head);
    if (
      headTokens.length >= 1 &&
      headTokens.length <= 3 &&
      !EXPLANATION_META_STARTERS.has(headTokens[0].norm) &&
      headTokens.some(t => t.norm.length >= 3 && !STOPWORDS.has(t.norm))
    ) {
      const glossMatch = findExactBoundaryMatch(translation, head);
      if (glossMatch) return glossMatch;
    }
  }

  // 3. Legacy fallback B: exact loanword or high-confidence cognate match with `new_element`
  // e.g. Italian "ispeziona" -> Portuguese "inspeciona"
  const elemTrimmed = sentence.new_element.trim();
  const elemNorm = normalizeForComparison(elemTrimmed);
  if (elemNorm.length >= 3 && !STOPWORDS.has(elemNorm)) {
    const exactElem = findExactBoundaryMatch(translation, elemTrimmed);
    if (exactElem) return exactElem;

    if (!/\s/.test(elemNorm)) {
      const cognate = findClosestContentWordMatch(translation, elemTrimmed, 0.72);
      if (cognate) return cognate;
    }
  }

  return null;
}
