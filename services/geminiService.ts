import { GoogleGenAI, Type } from "@google/genai";
import { CEFRLevel, StoryResponse, StorySize, AncientGreekDialect, AncientGreekFocus, ShakespeareanFocus, NoveltyDensity } from "../types";
import { resolveNativeLanguage } from "../utils/starterVocab";

// ============================================================
// Constants
// ============================================================
export interface ModelChainEntry {
  model: string;
  attempts: number;
}

export const MODEL_CHAIN: ModelChainEntry[] = [
  { model: "gemini-3.8-flash",      attempts: 2 },
  { model: "gemini-3.6-flash",      attempts: 1 },
  { model: "gemini-3.5-flash-lite", attempts: 1 },
  { model: "gemini-3.1-flash-lite", attempts: 1 },
];

export const PROMPT_VOCAB_LIMIT = 800; // how many known words go into prompt
export const COOLDOWN_DAILY_MS = 6 * 60 * 60 * 1000; // 6 hours for daily quota
export const COOLDOWN_RATE_LIMIT_MS = 60 * 1000; // 60 seconds for standard rate limit
export const OVERLOAD_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes for 503/504 overload
export const MAX_INVALID_NEW_ELEMENT_RATIO = 0.3; // max 30% invalid new elements before regen
export const MAX_HIGH_UNKNOWN_SENTENCE_RATIO = 0.3; // max 30% sentences with >=3 unknowns before full regen
export const MAX_ZERO_NOVELTY_RATIO: Record<NoveltyDensity, number> = {
  high: 0.3,
  normal: 0.5,
  low: 0.7
};
const quotaCooldowns = new Map<string, number>(); // in-memory: model name -> quota cooldown expiry timestamp
const overloadCooldowns = new Map<string, number>(); // in-memory: model name -> overload cooldown expiry timestamp
const REQUEST_TIMEOUT_MS = 120000;   // long stories can take a while; a client abort does NOT cancel server-side quota usage

// ============================================================
// API key
// ============================================================
// Decentralized by design: only the key provided by the user is ever used.
// No environment-variable fallback, so no developer key is bundled or shared.
export const getApiKey = (customApiKey?: string): string => {
  return customApiKey?.trim() || "";
};

// ============================================================
// Vocabulary
// ============================================================
const sanitizeKnownWords = (words: any): string[] => {
  if (!words) return [];
  let list: any[] = [];
  if (typeof words === 'string') {
    list = words.split(',');
  } else if (Array.isArray(words)) {
    list = words;
  }
  return Array.from(new Set(
    list
      .map(w => {
        if (typeof w === 'string') return w.trim().toLowerCase();
        if (w && typeof w === 'object') {
          return String(w.word || w.term || w.original || '').trim().toLowerCase();
        }
        return String(w || '').trim().toLowerCase();
      })
      .filter(w => w.length > 0 && w !== '[object object]')
  ));
};

// Fisher-Yates shuffle (unbiased, does not mutate the original array)
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Selects up to `targetCount` known words for the AI prompt:
 * 1. Up to 150 weak words that are also in the user's known vocabulary (if provided).
 * 2. The 300 most recent words from known vocabulary to guarantee active reinforcement.
 * 3. Random Fisher-Yates sample of remaining words up to targetCount.
 * Maintains no duplicates.
 */
export const selectVocabularyForPrompt = (
  cleanWords: string[],
  targetCount = PROMPT_VOCAB_LIMIT,
  weakWords?: string[]
): string[] => {
  const cleanSet = new Set(cleanWords);
  const result: string[] = [];
  const added = new Set<string>();

  // 1. Up to 150 weak words that are also known
  if (weakWords && weakWords.length > 0) {
    for (const w of weakWords) {
      const lower = w.trim().toLowerCase();
      if (lower && cleanSet.has(lower) && !added.has(lower)) {
        result.push(lower);
        added.add(lower);
        if (result.length >= 150) break;
      }
    }
  }

  // If cleanWords total <= targetCount, append all remaining known words
  if (cleanWords.length <= targetCount) {
    for (const w of cleanWords) {
      if (!added.has(w)) {
        result.push(w);
        added.add(w);
      }
    }
    return shuffle(result);
  }

  // 2. 300 most recent words from cleanWords
  const ultraRecentCount = Math.min(300, cleanWords.length);
  const ultraRecent = cleanWords.slice(-ultraRecentCount);
  for (let i = ultraRecent.length - 1; i >= 0; i--) {
    const w = ultraRecent[i];
    if (!added.has(w) && result.length < targetCount) {
      result.push(w);
      added.add(w);
    }
  }

  // 3. Fisher-Yates sample from remaining words
  const remaining = cleanWords.filter(w => !added.has(w));
  const shuffled = shuffle(remaining);
  for (const w of shuffled) {
    if (result.length >= targetCount) break;
    result.push(w);
    added.add(w);
  }

  return shuffle(result);
};

// ============================================================
// Response parsing
// ============================================================
const parseJsonResponse = (responseText?: string): any => {
  if (!responseText) {
    throw new Error("No response text received from AI.");
  }
  let text = responseText.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Failed to parse valid JSON from AI response.");
  }
};

// ============================================================
// Language configuration
// ============================================================
export interface LanguageConfig {
  langDisplay: string;
  focusInstruction: string;
}

export const getLanguageConfig = (
  targetLanguage: string,
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus
): LanguageConfig => {
  if (targetLanguage === 'Ancient Greek') {
    const isKoine = ancientGreekDialect === 'koine';
    const dialectName = isKoine ? 'Koine Greek (Hellenistic / New Testament)' : 'Classical Attic Greek';
    const focusDetail = ancientGreekFocus === 'philosophical'
      ? 'Focus on classical philosophical, ethical, and dialectic themes (Platonic and Aristotelian vocabulary).'
      : 'Focus on narrative Attic prose, daily life, history, and classical storytelling.';
    return {
      langDisplay: `Ancient Greek (${dialectName})`,
      focusInstruction: `DIALECT & REGISTER: Write in authentic ${dialectName}. ${focusDetail} Use polytonic accents and classical Greek grammar principles.`
    };
  }

  if (targetLanguage === 'Shakespearean English') {
    let styleDetail = 'Classic Elizabethan drama and dialogue (thou/thee/thy/thine, -eth verbs, authentic 16th/17th-century stage English).';
    if (shakespeareanFocus === 'drama') {
      styleDetail = 'High dramatic tragedy and soliloquy tone reminiscent of Hamlet and Macbeth, noble vocabulary, intense theatrical gravitas.';
    } else if (shakespeareanFocus === 'courtly') {
      styleDetail = 'Courtly romance, wit, poetic sonnet cadence and playful dialogue reminiscent of Twelfth Night and Much Ado About Nothing.';
    }
    return {
      langDisplay: 'Shakespearean English (Early Modern English, Elizabethan / Jacobean)',
      focusInstruction: `REGISTER & STYLE: Write in authentic Early Modern English (${styleDetail}). Use appropriate archaic pronouns (thou, thee, thy, thine, ye), conjugations (art, doth, hath, canst), and period-accurate idioms without sacrificing comprehension under i+1.`
    };
  }

  if (targetLanguage === 'Latin') {
    return {
      langDisplay: 'Classical Latin',
      focusInstruction: 'REGISTER: Use authentic Classical Latin syntax, standard vocabulary, and appropriate case agreements.'
    };
  }

  return {
    langDisplay: targetLanguage,
    focusInstruction: `Ensure natural, authentic, idiomatic expressions appropriate for contemporary ${targetLanguage} at the specified CEFR level.`
  };
};

// ============================================================
// Resilience: retry with exponential backoff + model fallback
// ============================================================
type ErrorKind = 'overloaded' | 'quota' | 'timeout' | 'not_found' | 'permanent';

const classifyError = (e: any): ErrorKind => {
  const code = Number(e?.status ?? e?.code);
  const msg = String(e?.message || "");
  if (code === 404 || /NOT_FOUND|not found/i.test(msg)) return 'not_found';
  if (code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'quota';
  if ([500, 502, 503, 504].includes(code) || /UNAVAILABLE|high demand|overloaded|fetch failed|network/i.test(msg)) return 'overloaded';
  if (/timed? ?out|aborted|AbortError/i.test(msg) || e?.name === 'AbortError') return 'timeout';
  return 'permanent';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface GenerationResult<T> {
  result: T;
  modelUsed: string;
}

/**
 * Strategy per error kind:
 * - overloaded (5xx): retry the SAME model with exponential backoff up to attempts, then move to next model.
 * - quota (429): do NOT retry; put model into COOLDOWN_MS cooldown and jump directly to next model.
 * - timeout: do NOT retry same model; jump to next model.
 * - not_found (404): model does not exist for this key; log a warning and skip to next model without retrying.
 * - permanent (400/401/403...): throw immediately.
 * 
 * Cooldown:
 * - Models currently in quota cooldown are skipped.
 * - If ALL models in chain are in cooldown, ignore cooldown and try the chain normally once.
 */
const buildChainWithPreferred = (baseChain: ModelChainEntry[], preferred?: string): ModelChainEntry[] => {
  if (!preferred) return baseChain;
  const preferredEntry = baseChain.find(entry => entry.model === preferred);
  if (!preferredEntry) return baseChain;
  return [preferredEntry, ...baseChain.filter(entry => entry.model !== preferred)];
};

/**
 * Strategy per error kind:
 * - overloaded (5xx): retry the SAME model with exponential backoff up to attempts, then move to next model.
 *   If all attempts fail, put model into OVERLOAD_COOLDOWN_MS cooldown.
 * - quota (429): do NOT retry; put model into COOLDOWN_MS cooldown and jump directly to next model.
 * - timeout: do NOT retry same model; jump to next model.
 * - not_found (404): model does not exist for this key; log a warning and skip to next model without retrying.
 * - permanent (400/401/403...): throw immediately.
 * 
 * Cooldown:
 * - Models currently in quota or overload cooldown are skipped.
 * - If ALL models in chain are in cooldown, ignore cooldown and try the chain normally once.
 */
const generateWithResilience = async <T,>(
  run: (model: string) => Promise<T>,
  chain: ModelChainEntry[] = MODEL_CHAIN,
  preferredModel?: string
): Promise<GenerationResult<T>> => {
  const orderedChain = buildChainWithPreferred(chain, preferredModel);
  const now = Date.now();
  // Filter out models currently in quota or overload cooldown
  let activeChain = orderedChain.filter(entry => {
    const quotaUntil = quotaCooldowns.get(entry.model);
    if (quotaUntil && quotaUntil > now) return false;
    const overloadUntil = overloadCooldowns.get(entry.model);
    if (overloadUntil && overloadUntil > now) return false;
    return true;
  });

  // If ALL models are in cooldown, ignore cooldown and attempt the chain normally once
  if (activeChain.length === 0) {
    activeChain = orderedChain;
  }

  let lastErr: any;
  let lastKind: ErrorKind = 'permanent';

  for (const entry of activeChain) {
    const { model, attempts } = entry;
    let attemptsFailedCount = 0;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await run(model);
        // Successful response - clear any active cooldown for this model
        quotaCooldowns.delete(model);
        overloadCooldowns.delete(model);
        return { result: res, modelUsed: model };
      } catch (e: any) {
        lastErr = e;
        lastKind = classifyError(e);

        if (lastKind === 'permanent') {
          throw e;
        }

        if (lastKind === 'not_found') {
          console.warn(`[${model}] model not found for this key (404), skipping model in chain:`, e?.message || e);
          break; // skip to next model in chain immediately without retrying
        }

        if (lastKind === 'quota') {
          const isDaily = /PerDay|per day|daily/i.test(String(e?.message || ""));
          const cooldownDuration = isDaily ? COOLDOWN_DAILY_MS : COOLDOWN_RATE_LIMIT_MS;
          console.warn(`[${model}] quota exceeded (429), ${isDaily ? 'daily limit' : 'rate limit'}, entering ${cooldownDuration / 1000}s cooldown; moving to next model:`, e?.message || e);
          quotaCooldowns.set(model, Date.now() + cooldownDuration);
          break; // jump straight to next model without retrying
        }

        if (lastKind === 'timeout') {
          console.warn(`[${model}] request timeout, moving to next model:`, e?.message || e);
          break; // jump straight to next model without retrying
        }

        // 'overloaded' (5xx)
        attemptsFailedCount++;
        console.warn(`[${model}] attempt ${i + 1}/${attempts} failed (${lastKind}):`, e?.message || e);
        if (i < attempts - 1) {
          await sleep(800 * 2 ** i + Math.random() * 400);
        }
      }
    }

    if (lastKind === 'overloaded' && attemptsFailedCount === attempts) {
      console.warn(`[${model}] all ${attempts} attempt(s) failed with overload (5xx), entering ${OVERLOAD_COOLDOWN_MS / 1000}s cooldown`);
      overloadCooldowns.set(model, Date.now() + OVERLOAD_COOLDOWN_MS);
    }
  }

  const err: any = new Error(
    lastKind === 'quota'
      ? "QUOTA_EXCEEDED"
      : lastKind === 'timeout'
        ? "REQUEST_TIMEOUT"
        : "MODEL_OVERLOADED"
  );
  err.cause = lastErr;
  throw err;
};

// ============================================================
// Gemini call (schemas & execution)
// ============================================================
export const storyGenerationSchema = {
  type: Type.OBJECT,
  properties: {
    story_title: { type: Type.STRING },
    level_target: { type: Type.STRING },
    proper_nouns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Names of people, places, and characters appearing in the story, written as in the text"
    },
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          original: { type: Type.STRING },
          translation: { type: Type.STRING }
        },
        required: ["id", "original", "translation"]
      }
    }
  },
  required: ["story_title", "level_target", "proper_nouns", "sentences"]
};

export const annotationsSchema = {
  type: Type.OBJECT,
  properties: {
    annotations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          phonetic: { type: Type.STRING },
          explanation: { type: Type.STRING },
          definition_target: { type: Type.STRING },
          part_of_speech: { type: Type.STRING }
        },
        required: ["id", "phonetic", "explanation", "definition_target", "part_of_speech"]
      }
    }
  },
  required: ["annotations"]
};

export const enrichmentSchema = {
  type: Type.OBJECT,
  properties: {
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                sentence: { type: Type.STRING },
                translation: { type: Type.STRING }
              },
              required: ["word", "sentence", "translation"]
            }
          }
        },
        required: ["id", "options"]
      }
    }
  },
  required: ["sentences"]
};

const buildStorySchema = (required: string[]) => ({
  type: Type.OBJECT,
  properties: {
    story_title: { type: Type.STRING },
    level_target: { type: Type.STRING },
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          original: { type: Type.STRING },
          translation: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          new_element: { type: Type.STRING },
          explanation: { type: Type.STRING },
          definition_target: { type: Type.STRING },
          part_of_speech: { type: Type.STRING }
        },
        required: ["id", "original", "translation"]
      }
    },
    estimated_vocab_count: { type: Type.STRING },
    new_words_to_add: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required
});

export const callGeminiWithSchema = async (
  apiKey: string,
  prompt: string,
  schema: any,
  preferredModel?: string
): Promise<{ data: any; modelUsed: string }> => {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });

  const run = (model: string) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

  const { result: response, modelUsed } = await generateWithResilience(run, MODEL_CHAIN, preferredModel);
  console.info(
    `[Model: ${modelUsed}] Prompt tokens:`, response.usageMetadata?.promptTokenCount,
    "| output tokens:", response.usageMetadata?.candidatesTokenCount
  );
  const data = parseJsonResponse(response.text);
  return { data, modelUsed };
};

export const callGemini = async (
  apiKey: string,
  prompt: string,
  required: string[] = ["story_title", "sentences"],
  preferredModel?: string
): Promise<{ data: any; modelUsed: string }> => {
  return callGeminiWithSchema(apiKey, prompt, buildStorySchema(required), preferredModel);
};

// ============================================================
// Post-generation i+1 validation & Vocabulary Analysis
// ============================================================
export const MIN_KNOWN_RATIO_STORY = 0.85; // 85% known words threshold for i+1 story
export const MAX_UNKNOWN_RATIO_REVIEW = 0.05; // 5% max unknown words for review story
export const MIN_VOCAB_FOR_VALIDATION = 100; // Skip validation/regeneration if known words < 100

export interface StoryValidationResult {
  knownRatio: number;
  unknownRatio: number;
  unknownWordsPerSentence: { sentenceId: number; unknownWords: string[] }[];
  sentencesWithMultipleNewElements: number[];
  isValid: boolean;
}

/**
 * Tokenizer dropping elided prefixes (l', dell', un', qu', don') and matching Unicode words > 1 char
 */
export const tokenize = (text: string): string[] =>
  text.toLowerCase()
    .replace(/[\p{L}\p{M}]+['’]/gu, ' ')   // drop elided prefixes: l', dell', un', qu', don'
    .match(/[\p{L}\p{M}]+/gu)?.filter(t => t.length > 1) || [];

/**
 * Extracts proper nouns and detects middle-of-sentence capitalized words as extra safeguard
 */
export const extractSentenceProperNouns = (
  sentenceText: string,
  globalProperNounTokens: Set<string>
): Set<string> => {
  const ignored = new Set<string>(globalProperNounTokens);
  // Match word chunks to detect middle-of-sentence capitalized words
  const rawWords = sentenceText.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?/gu) || [];
  for (let i = 1; i < rawWords.length; i++) {
    const word = rawWords[i];
    const firstChar = word.charAt(0);
    // Ignore middle-of-sentence capitalized words as proper nouns
    if (firstChar !== firstChar.toLowerCase() && firstChar === firstChar.toUpperCase()) {
      const tokens = tokenize(word);
      tokens.forEach(t => ignored.add(t));
    }
  }
  return ignored;
};

export interface DerivedCheckResult {
  isDerived: boolean;
  matchingKnown?: string;
}

/**
 * Pure function checking if a candidate word shares a substantial stem with any known word.
 * Formula: commonPrefixLen >= Math.max(4, 0.7 * Math.min(w.length, k.length))
 */
export const isDerivedFromKnown = (word: string, knownSet: Set<string>): DerivedCheckResult => {
  const w = word.toLowerCase().trim();
  if (!w) return { isDerived: false };

  for (const known of knownSet) {
    const k = known.toLowerCase().trim();
    if (!k) continue;
    const minLen = Math.min(w.length, k.length);
    let commonPrefixLen = 0;
    while (commonPrefixLen < minLen && w[commonPrefixLen] === k[commonPrefixLen]) {
      commonPrefixLen++;
    }
    const threshold = Math.max(4, 0.7 * minLen);
    if (commonPrefixLen >= threshold) {
      return { isDerived: true, matchingKnown: k };
    }
  }
  return { isDerived: false };
};

export interface EnrichmentOption {
  word: string;
  sentence: string;
  translation: string;
}

export interface OptionEvaluationResult {
  valid: boolean;
  reason?: string;
  chosenWord?: string;
  unknownTokens: string[];
}

export interface SentenceEnrichmentSelection {
  acceptedOption?: EnrichmentOption;
  chosenWord?: string;
  acceptedCount: number;
  rejectedCount: number;
  rejectionReasons: string[];
}

/**
 * Pure function that evaluates a single enrichment alternative:
 * (a) word tokens appear in the sentence
 * (b) no token of word belongs to full known vocabulary or proper nouns
 * (c) the sentence has at most 1 unknown token total
 * (d) if strictNewWords is enabled, no token of word is derived from a known word
 */
export const evaluateEnrichmentOption = (
  option: EnrichmentOption,
  knownSet: Set<string>,
  globalProperNounTokens: Set<string>,
  strictNewWords = true
): OptionEvaluationResult => {
  const wordTokens = tokenize(option.word || '');
  if (wordTokens.length === 0) {
    return { valid: false, reason: 'empty word', unknownTokens: [] };
  }

  const sentenceTokens = tokenize(option.sentence || '');
  if (sentenceTokens.length === 0) {
    return { valid: false, reason: 'empty sentence', unknownTokens: [] };
  }

  // (b) Find the target unknown tokens in option.word.
  // If the word contains a known article/particle (e.g. "il", "la", "to", "der") plus an unknown word,
  // we identify the unknown tokens. If ALL tokens of word are already known or proper nouns, reject.
  const unknownWordTokens = wordTokens.filter(wt => !knownSet.has(wt) && !globalProperNounTokens.has(wt));
  if (unknownWordTokens.length === 0) {
    return { valid: false, reason: `word already known (${wordTokens[0] || ''})`, unknownTokens: [] };
  }

  // (a) target unknown word tokens must appear in the sentence
  const sentenceTokenSet = new Set(sentenceTokens);
  const wordAbsent = unknownWordTokens.some(t => !sentenceTokenSet.has(t));
  if (wordAbsent) {
    return { valid: false, reason: 'word absent from sentence', unknownTokens: [] };
  }

  // (d) if strictNewWords is enabled, no target token of word shares stem with known word
  if (strictNewWords) {
    for (const uwt of unknownWordTokens) {
      const derivedCheck = isDerivedFromKnown(uwt, knownSet);
      if (derivedCheck.isDerived) {
        return {
          valid: false,
          reason: `shares stem with known word: ${derivedCheck.matchingKnown}`,
          unknownTokens: []
        };
      }
    }
  }

  // (c) the sentence has at most 1 unknown token total outside the target word tokens
  const sentenceProperNouns = extractSentenceProperNouns(option.sentence, globalProperNounTokens);
  const unknownTokens: string[] = [];
  for (const st of sentenceTokens) {
    if (knownSet.has(st)) continue;
    if (sentenceProperNouns.has(st)) continue;
    unknownTokens.push(st);
  }

  const extraUnknownTokens = unknownTokens.filter(t => !wordTokens.includes(t));
  if (unknownTokens.length > 1 && extraUnknownTokens.length > 0) {
    return {
      valid: false,
      reason: `more than 1 unknown word (${unknownTokens.length}: ${unknownTokens.join(', ')})`,
      unknownTokens
    };
  }

  const chosenWord = unknownWordTokens[0];
  return {
    valid: true,
    chosenWord,
    unknownTokens
  };
};

/**
 * Pure function that evaluates the options of a sentence in order,
 * picks the first valid alternative, and collects statistics and rejection reasons.
 */
export const selectBestEnrichmentOption = (
  options: EnrichmentOption[],
  knownSet: Set<string>,
  globalProperNounTokens: Set<string>,
  strictNewWords = true
): SentenceEnrichmentSelection => {
  let acceptedOption: EnrichmentOption | undefined;
  let chosenWord: string | undefined;
  let acceptedCount = 0;
  let rejectedCount = 0;
  const rejectionReasons: string[] = [];

  for (const option of options) {
    const evalResult = evaluateEnrichmentOption(option, knownSet, globalProperNounTokens, strictNewWords);
    if (evalResult.valid) {
      acceptedCount++;
      if (!acceptedOption) {
        acceptedOption = option;
        chosenWord = evalResult.chosenWord;
      }
    } else {
      rejectedCount++;
      rejectionReasons.push(evalResult.reason || 'invalid option');
    }
  }

  return {
    acceptedOption,
    chosenWord,
    acceptedCount,
    rejectedCount,
    rejectionReasons
  };
};

export interface SentenceAnalysis {
  sentenceId: number;
  tokens: string[];
  unknownTokens: string[];
  newElement: string;
  extraUnknownCount: number;
}

/**
 * In-code analysis of a sentence against known vocabulary and proper nouns:
 * - Tokenizes sentence
 * - Ignores proper nouns (from proper_nouns list and middle-of-sentence capitalization)
 * - Identifies unknown tokens (not in known vocabulary)
 * - Sets new_element to first unknown token (or empty)
 * - Records extraUnknownCount (Math.max(0, unknownTokens.length - 1))
 */
export const analyzeSentenceTokens = (
  sentence: { id: number; original: string },
  knownSet: Set<string>,
  globalProperNounTokens: Set<string>
): SentenceAnalysis => {
  const tokens = tokenize(sentence.original);
  const sentenceProperNouns = extractSentenceProperNouns(sentence.original, globalProperNounTokens);

  const unknownTokens: string[] = [];
  for (const token of tokens) {
    if (knownSet.has(token)) continue;
    if (sentenceProperNouns.has(token)) continue;
    unknownTokens.push(token);
  }

  const newElement = unknownTokens.length > 0 ? unknownTokens[0] : '';
  const extraUnknownCount = Math.max(0, unknownTokens.length - 1);

  return {
    sentenceId: sentence.id,
    tokens,
    unknownTokens,
    newElement,
    extraUnknownCount
  };
};

export interface StoryAnalysis {
  sentenceAnalyses: SentenceAnalysis[];
  sentencesWith3OrMoreUnknowns: number;
  sentencesWith0Unknowns: number;
  totalSentences: number;
  ratioWith3OrMore: number;
  ratioWith0: number;
  problematicCount: number;
  uniqueUnknownWords: string[];
}

/**
 * Analyzes the entire story vocabulary against full known vocabulary
 */
export const analyzeStoryVocabulary = (
  story: StoryResponse,
  knownWords: string[]
): StoryAnalysis => {
  const cleanKnown = sanitizeKnownWords(knownWords);
  const knownSet = new Set(cleanKnown);

  const globalProperNounTokens = new Set<string>();
  const rawProperNouns = Array.isArray(story.proper_nouns) ? story.proper_nouns : [];
  for (const pn of rawProperNouns) {
    if (typeof pn === 'string') {
      tokenize(pn).forEach(t => globalProperNounTokens.add(t));
    }
  }

  const sentences = Array.isArray(story.sentences) ? story.sentences : [];
  const sentenceAnalyses: SentenceAnalysis[] = [];
  let sentencesWith3OrMoreUnknowns = 0;
  let sentencesWith0Unknowns = 0;
  const seenUnknowns = new Set<string>();
  const uniqueUnknownWords: string[] = [];

  for (const s of sentences) {
    const analysis = analyzeSentenceTokens(s, knownSet, globalProperNounTokens);
    sentenceAnalyses.push(analysis);

    if (analysis.unknownTokens.length >= 3) {
      sentencesWith3OrMoreUnknowns++;
    }
    if (analysis.unknownTokens.length === 0) {
      sentencesWith0Unknowns++;
    }

    for (const u of analysis.unknownTokens) {
      if (!seenUnknowns.has(u)) {
        seenUnknowns.add(u);
        uniqueUnknownWords.push(u);
      }
    }
  }

  const totalSentences = sentences.length;
  const ratioWith3OrMore = totalSentences > 0 ? sentencesWith3OrMoreUnknowns / totalSentences : 0;
  const ratioWith0 = totalSentences > 0 ? sentencesWith0Unknowns / totalSentences : 0;
  const problematicCount = sentencesWith3OrMoreUnknowns + sentencesWith0Unknowns;

  return {
    sentenceAnalyses,
    sentencesWith3OrMoreUnknowns,
    sentencesWith0Unknowns,
    totalSentences,
    ratioWith3OrMore,
    ratioWith0,
    problematicCount,
    uniqueUnknownWords
  };
};

/**
 * Applies in-code sentence analysis (new_element and extraUnknownCount) to the story
 */
export const applyAnalysisToStory = (
  story: StoryResponse,
  analysis: StoryAnalysis
): StoryResponse => {
  const analysisMap = new Map<number, SentenceAnalysis>();
  for (const a of analysis.sentenceAnalyses) {
    analysisMap.set(a.sentenceId, a);
  }

  const updatedSentences = (story.sentences || []).map(s => {
    const a = analysisMap.get(s.id);
    if (!a) return s;
    return {
      ...s,
      new_element: a.newElement,
      extraUnknownCount: a.extraUnknownCount
    };
  });

  const uniqueNewElements = Array.from(
    new Set(
      updatedSentences
        .map(s => s.new_element?.trim().toLowerCase())
        .filter((w): w is string => Boolean(w && w.length > 0))
    )
  );

  return {
    ...story,
    sentences: updatedSentences,
    new_words_to_add: uniqueNewElements
  };
};

/**
 * Validates the story vocabulary against the user's complete known vocabulary (used for review stories).
 */
export const validateStoryAgainstVocabulary = (
  story: StoryResponse,
  knownWords: string[],
  isReview = false
): StoryValidationResult => {
  const cleanKnown = sanitizeKnownWords(knownWords);
  const knownSet = new Set(cleanKnown);

  let totalWords = 0;
  let unknownCount = 0;
  const unknownWordsPerSentence: { sentenceId: number; unknownWords: string[] }[] = [];
  const sentencesWithMultipleNewElements: number[] = [];

  const sentences = Array.isArray(story.sentences) ? story.sentences : [];

  for (const s of sentences) {
    if (!s.original) continue;

    const tokens = tokenize(s.original);
    if (tokens.length === 0) continue;

    const allowed = new Set(knownSet);
    if (s.new_element) {
      const elemTokens = tokenize(s.new_element);
      elemTokens.forEach(t => allowed.add(t));
    }

    const sentenceUnknowns: string[] = [];
    for (const token of tokens) {
      totalWords++;
      if (!allowed.has(token)) {
        sentenceUnknowns.push(token);
        unknownCount++;
      }
    }

    if (sentenceUnknowns.length > 0) {
      unknownWordsPerSentence.push({
        sentenceId: s.id,
        unknownWords: sentenceUnknowns
      });
    }

    const distinctSentenceUnknowns = new Set(sentenceUnknowns);
    if (!isReview && distinctSentenceUnknowns.size > 1) {
      sentencesWithMultipleNewElements.push(s.id);
    }
  }

  const knownRatio = totalWords > 0 ? (totalWords - unknownCount) / totalWords : 1;
  const unknownRatio = totalWords > 0 ? unknownCount / totalWords : 0;

  const isValid = isReview
    ? unknownRatio <= MAX_UNKNOWN_RATIO_REVIEW
    : knownRatio >= MIN_KNOWN_RATIO_STORY;

  return {
    knownRatio,
    unknownRatio,
    unknownWordsPerSentence,
    sentencesWithMultipleNewElements,
    isValid
  };
};

// ============================================================
// Phase 2: Linguistic Annotation (batch call for story)
// ============================================================
export const annotateStory = async (
  apiKey: string,
  story: StoryResponse,
  targetLanguage: string,
  nativeLanguage: string,
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus,
  preferredModel?: string
): Promise<{ story: StoryResponse; modelUsed?: string }> => {
  const sentences = Array.isArray(story.sentences) ? story.sentences : [];
  const itemsToAnnotate = sentences
    .filter(s => s.new_element && s.new_element.trim().length > 0)
    .map(s => ({
      id: s.id,
      sentence: s.original,
      word: s.new_element
    }));

  if (itemsToAnnotate.length === 0) {
    return {
      story: {
        ...story,
        annotationsFailed: false
      }
    };
  }

  const { langDisplay } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);
  const resolvedNative = resolveNativeLanguage(nativeLanguage);

  const annotationPrompt = `
Act as a Linguistic Annotation Specialist.
Annotate the target new vocabulary words in the following sentences for a student learning ${langDisplay} whose native language is ${resolvedNative}.

Sentences and target words to annotate:
${JSON.stringify(itemsToAnnotate, null, 2)}

REQUIREMENTS FOR EACH ITEM:
1. phonetic: IPA (International Phonetic Alphabet) transcription of the target word.
2. explanation: In ${resolvedNative}, a short sentence explaining the meaning and nuance of the word in this sentence context.
3. definition_target: In ${targetLanguage}, a simple, concise definition or synonym using basic vocabulary.
4. part_of_speech: The grammatical category (e.g. noun, verb, adjective, adverb, preposition).

CRITICAL LANGUAGE REQUIREMENT:
The field 'explanation' MUST be written in ${resolvedNative}.
The field 'definition_target' MUST be written in ${targetLanguage}.
`;

  try {
    const { data: annotData, modelUsed } = await callGeminiWithSchema(
      apiKey,
      annotationPrompt,
      annotationsSchema,
      preferredModel
    );
    const annotationsList = Array.isArray(annotData?.annotations) ? annotData.annotations : [];
    const annotMap = new Map<number, any>();
    for (const item of annotationsList) {
      if (typeof item?.id === 'number') {
        annotMap.set(item.id, item);
      }
    }

    const annotatedSentences = sentences.map(s => {
      const annot = annotMap.get(s.id);
      if (annot) {
        return {
          ...s,
          phonetic: String(annot.phonetic || '').trim(),
          explanation: String(annot.explanation || '').trim(),
          definition_target: String(annot.definition_target || '').trim(),
          part_of_speech: String(annot.part_of_speech || '').trim()
        };
      }
      return {
        ...s,
        phonetic: '',
        explanation: '',
        definition_target: '',
        part_of_speech: ''
      };
    });

    return {
      story: {
        ...story,
        sentences: annotatedSentences,
        annotationsFailed: false
      },
      modelUsed
    };
  } catch (err) {
    console.warn("[Annotations] Annotation call failed, retaining story with empty annotations:", err);
    const fallbackSentences = sentences.map(s => ({
      ...s,
      phonetic: '',
      explanation: '',
      definition_target: '',
      part_of_speech: ''
    }));

    return {
      story: {
        ...story,
        sentences: fallbackSentences,
        annotationsFailed: true
      }
    };
  }
};

// ============================================================
// Story generation (Two-Phase Pipeline)
// ============================================================
export const generateStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  level: CEFRLevel,
  knownWords: string[],
  storySize: StorySize,
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus,
  customApiKey?: string,
  weakWords?: string[],
  noveltyDensity: NoveltyDensity = 'high',
  strictNewWords = true
): Promise<StoryResponse> => {
  const apiKey = getApiKey(customApiKey);
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const sizeMap = { short: "5 to 10", standard: "exactly 10", medium: "10 to 15", long: "15 to 25" };
  const sentenceCount = sizeMap[storySize] || "exactly 10";
  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);
  const resolvedNative = resolveNativeLanguage(nativeLanguage);

  const cleanWords = sanitizeKnownWords(knownWords);
  const wordsForPrompt = selectVocabularyForPrompt(cleanWords, PROMPT_VOCAB_LIMIT, weakWords);
  const wordsDisplay = wordsForPrompt.length > 0 ? wordsForPrompt.join(", ") : "hello, world, is, the, in, to, and";

  const explicitLanguageInstruction = `The field 'translation' MUST be written in ${resolvedNative}. The field 'explanation' MUST be written in ${resolvedNative}. 'definition_target' MUST be written in ${targetLanguage}.`;

  const densityRule =
    noveltyDensity === 'low'
      ? 'About 40% of the sentences MUST contain exactly one word NOT in the list (a word a learner at this level would NOT yet know; avoid basic high-frequency vocabulary; never a proper name); the others use only known words.'
      : noveltyDensity === 'normal'
        ? 'About 70% of the sentences MUST contain exactly one word NOT in the list (a word a learner at this level would NOT yet know; avoid basic high-frequency vocabulary; never a proper name); the others use only known words.'
        : 'Every sentence MUST contain exactly ONE word that is NOT in the KNOWN WORDS list (a word a learner at this level would NOT yet know; avoid basic high-frequency vocabulary; never a proper name).';

  const prompt = `
    Act as a Natural Language Acquisition Specialist. 
    Generate a story following the Natural Method (i+1).
    Target Language: ${langDisplay}
    Native Language: ${resolvedNative}
    CEFR Level: ${level}
    
    ${focusInstruction}
    
    KNOWN WORDS (${cleanWords.length} total words): [${wordsDisplay}]
    
    CRITICAL LANGUAGE REQUIREMENT:
    ${explicitLanguageInstruction}

    STORY GUIDELINES:
    1. Write simple, natural sentences in ${langDisplay}.
    2. MANDATORY NOVELTY DENSITY: ${densityRule}
       Ensure that every new word or structure introduced is an authentic, useful vocabulary item suitable for CEFR ${level}. It MUST NOT appear anywhere in the KNOWN WORDS list, and must NOT be a proper name.
    3. KNOWN WORDS REINFORCEMENT: All other words in each sentence MUST come strictly from the KNOWN WORDS list (or be listed proper nouns).
    4. Length: ${sentenceCount} sentences.
    5. List all character names, person names, and place names that appear in the story in 'proper_nouns' exactly as written in the text.
    6. For each sentence, provide 'id', 'original', and 'translation'.
  `;

  // Phase 1: Generate story sentences and proper nouns
  const { data: parsed, modelUsed: phase1Model } = await callGeminiWithSchema(
    apiKey,
    prompt,
    storyGenerationSchema
  );
  let story = normalizeStoryResponse(parsed, false, level);
  let storyModelUsed = phase1Model;

  // In-code detection of new_element and extraUnknownCount
  let analysis = analyzeStoryVocabulary(story, cleanWords);
  story = applyAnalysisToStory(story, analysis);

  const initialZeroRatio = analysis.ratioWith0;
  let finalZeroRatio = initialZeroRatio;
  let enrichmentOccurred = false;

  const canValidate = cleanWords.length >= MIN_VOCAB_FOR_VALIDATION;
  const zeroNoveltyLimit = MAX_ZERO_NOVELTY_RATIO[noveltyDensity] ?? 0.3;
  const hasExcessUnknowns = canValidate && analysis.ratioWith3OrMore > MAX_HIGH_UNKNOWN_SENTENCE_RATIO;
  const lacksNovelty = !hasExcessUnknowns && (
    analysis.ratioWith0 > zeroNoveltyLimit ||
    (noveltyDensity === 'high' && analysis.sentencesWith0Unknowns > 0)
  );

  // Full regeneration applies ONLY to excess unknown words (>=3 unknowns in >30% sentences)
  if (hasExcessUnknowns) {
    console.warn(
      `[Story Validation] Excess unknown words: ${(analysis.ratioWith3OrMore * 100).toFixed(1)}% sentences with >=3 unknowns ` +
      `(limit ${MAX_HIGH_UNKNOWN_SENTENCE_RATIO * 100}%). Attempting 1 full regeneration...`
    );
    try {
      const top30 = analysis.uniqueUnknownWords.slice(0, 30);
      const revisionNotes = `CRITICAL REVISION REQUIREMENT:\n` +
        `AVOID these words, they are not in the known list: [${top30.join(', ')}].\n` +
        `Use ONLY words from the KNOWN WORDS list for 95% of each sentence, introducing at most 1 new word per sentence.\n`;

      const regenPrompt = `${prompt}\n\n${revisionNotes}\n${explicitLanguageInstruction}`;
      const { data: regenParsed, modelUsed: regenModel } = await callGeminiWithSchema(
        apiKey,
        regenPrompt,
        storyGenerationSchema
      );
      let regenStory = normalizeStoryResponse(regenParsed, false, level);
      const regenAnalysis = analyzeStoryVocabulary(regenStory, cleanWords);
      regenStory = applyAnalysisToStory(regenStory, regenAnalysis);

      // Keep version with fewest problematic sentences
      if (regenAnalysis.problematicCount < analysis.problematicCount) {
        story = regenStory;
        analysis = regenAnalysis;
        storyModelUsed = regenModel;
        finalZeroRatio = analysis.ratioWith0;
      }
    } catch (e) {
      console.warn("[Story Validation] Full regeneration attempt failed, retaining original story:", e);
    }
  } else if (lacksNovelty) {
    // Targeted enrichment: rewrite only zero-novelty sentences with 4 alternatives per sentence
    console.warn(
      `[Story Enrichment] Lacks novelty for mode '${noveltyDensity}': ${(analysis.ratioWith0 * 100).toFixed(1)}% sentences with 0 new elements ` +
      `(limit ${(zeroNoveltyLimit * 100).toFixed(0)}%). Attempting targeted enrichment...`
    );
    try {
      const zeroNoveltySentences = story.sentences
        .filter(s => {
          const sa = analysis.sentenceAnalyses.find(a => a.sentenceId === s.id);
          return sa ? sa.unknownTokens.length === 0 : !s.new_element;
        })
        .map(s => ({ id: s.id, original: s.original, translation: s.translation }));

      if (zeroNoveltySentences.length > 0) {
        const enrichmentPrompt = `
Act as a Natural Language Acquisition Specialist.
Rewrite ONLY the zero-novelty sentences provided below to introduce a suitable new vocabulary word or grammatical structure, while preserving the story's meaning, tone, grammatical correctness, and narrative continuity.

Target Language: ${langDisplay}
Native Language: ${resolvedNative}
CEFR Level: ${level}

SENTENCES TO ENRICH:
${JSON.stringify(zeroNoveltySentences, null, 2)}

REQUIREMENTS FOR EACH SENTENCE:
1. Provide exactly 4 distinct alternative rewrites in 'options' for each sentence.
2. MINIMAL CHANGE RULE (CRITICAL): In each alternative, change ONLY the target new word (or replace a single simple word with the new target word). Keep ALL OTHER words of the original sentence EXACTLY as written. DO NOT rephrase the rest of the sentence, and DO NOT add extra adjectives, adverbs, or clauses.
3. Each alternative re-writes the original sentence, preserving meaning, grammar, and story continuity, introducing exactly ONE word of suitable level that is NOT among the 2000 most frequent words of the language, and is not a proper name.
4. The 4 alternatives for the same sentence MUST use 4 DIFFERENT new words.
5. The field 'word' MUST appear in 'sentence' exactly as written.
6. The word MUST be a different lexeme, not a simple derivation of a common word: no superlatives (such as -issimo), no diminutives or augmentatives, no adverbs formed with -mente, and no mere inflection of a common word.
7. The field 'translation' MUST be written in ${resolvedNative}.

CRITICAL LANGUAGE REQUIREMENT:
${explicitLanguageInstruction}
`;

        const { data: enrichData, modelUsed: enrichModelUsed } = await callGeminiWithSchema(
          apiKey,
          enrichmentPrompt,
          enrichmentSchema,
          storyModelUsed
        );

        const enrichedSentences = Array.isArray(enrichData?.sentences) ? enrichData.sentences : [];
        if (enrichedSentences.length > 0) {
          const enrichOptionsMap = new Map<number, EnrichmentOption[]>();
          for (const item of enrichedSentences) {
            if (typeof item?.id === 'number' && Array.isArray(item.options)) {
              enrichOptionsMap.set(item.id, item.options);
            }
          }

          const knownSet = new Set(cleanWords);
          const globalProperNounTokens = new Set<string>();
          const rawProperNouns = Array.isArray(story.proper_nouns) ? story.proper_nouns : [];
          for (const pn of rawProperNouns) {
            if (typeof pn === 'string') {
              tokenize(pn).forEach(t => globalProperNounTokens.add(t));
            }
          }

          const replacements = new Map<number, { original: string; translation: string; newElement: string }>();

          for (const s of zeroNoveltySentences) {
            const rawOptions = enrichOptionsMap.get(s.id) || [];
            const sanitizedOptions: EnrichmentOption[] = rawOptions.map(opt => ({
              word: String(opt?.word || '').trim(),
              sentence: String(opt?.sentence || '').trim(),
              translation: String(opt?.translation || '').trim()
            }));

            const selection = selectBestEnrichmentOption(
              sanitizedOptions,
              knownSet,
              globalProperNounTokens,
              strictNewWords
            );

            if (selection.acceptedOption && selection.chosenWord) {
              replacements.set(s.id, {
                original: selection.acceptedOption.sentence,
                translation: selection.acceptedOption.translation || s.translation,
                newElement: selection.chosenWord
              });
              console.info(
                `[Enrichment Sentence #${s.id}] Accepted: ${selection.acceptedCount}, Rejected: ${selection.rejectedCount} | ` +
                `Chosen word: "${selection.chosenWord}" | Old: "${s.original}" -> New: "${selection.acceptedOption.sentence}"` +
                (selection.rejectionReasons.length > 0 ? ` | Rejections: [${selection.rejectionReasons.join("; ")}]` : "")
              );
            } else {
              console.info(
                `[Enrichment Sentence #${s.id}] Accepted: 0, Rejected: ${selection.rejectedCount} | No valid alternative chosen, retaining original` +
                (selection.rejectionReasons.length > 0 ? ` | Rejections: [${selection.rejectionReasons.join("; ")}]` : "")
              );
            }
          }

          if (replacements.size > 0) {
            const mergedSentences = story.sentences.map(s => {
              const rep = replacements.get(s.id);
              if (rep) {
                return {
                  ...s,
                  original: rep.original,
                  translation: rep.translation,
                  new_element: rep.newElement
                };
              }
              return s;
            });

            const enrichedStoryCandidate: StoryResponse = {
              ...story,
              sentences: mergedSentences
            };

            const enrichedAnalysis = analyzeStoryVocabulary(enrichedStoryCandidate, cleanWords);
            story = applyAnalysisToStory(enrichedStoryCandidate, enrichedAnalysis);
            analysis = enrichedAnalysis;
            finalZeroRatio = analysis.ratioWith0;
            enrichmentOccurred = true;
          }
        }
      }
    } catch (e) {
      console.warn("[Story Enrichment] Targeted enrichment attempt failed, retaining original story:", e);
    }
  }

  if (canValidate && analysis.ratioWith3OrMore > MAX_HIGH_UNKNOWN_SENTENCE_RATIO) {
    story.hasHighUnknownWords = true;
  } else {
    story.hasHighUnknownWords = false;
  }

  // Phase 2: Annotations (IPA, explanation, definition, POS)
  const { story: annotatedStory, modelUsed: annotModelUsed } = await annotateStory(
    apiKey,
    story,
    targetLanguage,
    nativeLanguage,
    ancientGreekDialect,
    ancientGreekFocus,
    shakespeareanFocus,
    storyModelUsed
  );
  story = annotatedStory;

  // Novelty density info log
  console.info(
    `[Story Novelty Density] Mode: ${noveltyDensity} | Zero-novelty ratio before: ${(initialZeroRatio * 100).toFixed(1)}%, after: ${(finalZeroRatio * 100).toFixed(1)}% | Enriched: ${enrichmentOccurred}`
  );

  // Single Requirement 10 log per story
  console.info(
    `[Story Generation Summary] Story model: ${storyModelUsed}, Annotations model: ${annotModelUsed || 'none (failed or skipped)'} | ` +
    `Sentences: ${story.sentences.length}, With new_element: ${story.sentences.filter(s => Boolean(s.new_element)).length}, ` +
    `With >=3 unknowns: ${analysis.sentencesWith3OrMoreUnknowns}, Known vocabulary size: ${cleanWords.length}`
  );

  story.modelUsed = storyModelUsed;
  return story;
};

export const generateReviewStory = async (
  targetLanguage: string,
  nativeLanguage: string,
  knownWords: string[],
  ancientGreekDialect?: AncientGreekDialect,
  ancientGreekFocus?: AncientGreekFocus,
  shakespeareanFocus?: ShakespeareanFocus,
  customApiKey?: string,
  weakWords?: string[]
): Promise<StoryResponse> => {
  const apiKey = getApiKey(customApiKey);
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const { langDisplay, focusInstruction } = getLanguageConfig(targetLanguage, ancientGreekDialect, ancientGreekFocus, shakespeareanFocus);
  const resolvedNative = resolveNativeLanguage(nativeLanguage);

  const cleanWords = sanitizeKnownWords(knownWords);
  const wordsForPrompt = selectVocabularyForPrompt(cleanWords, PROMPT_VOCAB_LIMIT, weakWords);

  const weakWordsBlock = (weakWords && weakWords.length > 0)
    ? `\n    WEAK / LEARNING WORDS (PRIORITY): [${weakWords.slice(0, 50).join(", ")}]\n    CRITICAL REPETITION RULE: The weak/learning words listed above MUST appear multiple times throughout the story in different contexts to solidify retention.`
    : '';

  const prompt = `
    Act as a Polyglot Instructor. Generate a REVIEW story.
    Target Language: ${langDisplay}
    Native Language: ${resolvedNative}
    
    ${focusInstruction}
    
    GOAL: Create a long, complex and coherent story using ONLY words from the known vocabulary list provided below. 
    
    KNOWN VOCABULARY: [${wordsForPrompt.join(", ")}]
    ${weakWordsBlock}
    
    RULES:
    1. USE ONLY KNOWN WORDS. Do not introduce new vocabulary.
    2. LENGTH: 25 to 35 sentences.
    3. COHESION: The story must be very high quality and engaging.
    4. Fill 'new_element', 'phonetic', 'explanation', 'definition_target', and 'part_of_speech' with empty strings.
  `;

  const { data: parsed, modelUsed } = await callGemini(apiKey, prompt, ["story_title", "sentences"]);
  let story = normalizeStoryResponse(parsed, true);
  story.modelUsed = modelUsed;

  // Validation against full known vocabulary for review story (max 5% unknown)
  const canValidate = cleanWords.length >= MIN_VOCAB_FOR_VALIDATION;
  let validation = validateStoryAgainstVocabulary(story, cleanWords, true);
  if (canValidate && !validation.isValid) {
    console.warn(`[Review Validation] Unknown ratio ${(validation.unknownRatio * 100).toFixed(1)}% > ${(MAX_UNKNOWN_RATIO_REVIEW * 100)}%. Attempting 1 regeneration...`);
    try {
      const unknownWordsList: string[] = [];
      const seenUnknowns = new Set<string>();
      validation.unknownWordsPerSentence.forEach(u => {
        u.unknownWords.forEach(w => {
          if (!seenUnknowns.has(w)) {
            seenUnknowns.add(w);
            unknownWordsList.push(w);
          }
        });
      });
      const top30Unknowns = unknownWordsList.slice(0, 30);
      const avoidBlock = top30Unknowns.length > 0 ? `AVOID these words, they are not in the known list: [${top30Unknowns.join(', ')}].\n` : '';

      const regenPrompt = `${prompt}
      CRITICAL REVISION REQUIREMENT: The previous output contained words outside known vocabulary (${(validation.unknownRatio * 100).toFixed(1)}% unknown).
      ${avoidBlock}Strictly use ONLY the provided KNOWN VOCABULARY list with ZERO unknown words.`;
      const { data: regenParsed, modelUsed: regenModel } = await callGemini(apiKey, regenPrompt, ["story_title", "sentences"]);
      const regenStory = normalizeStoryResponse(regenParsed, true);
      regenStory.modelUsed = regenModel;
      const regenValidation = validateStoryAgainstVocabulary(regenStory, cleanWords, true);
      if (regenValidation.isValid || regenValidation.unknownRatio < validation.unknownRatio) {
        story = regenStory;
        validation = regenValidation;
      }
    } catch (e) {
      console.warn("[Review Validation] Regeneration attempt failed, retaining original story:", e);
    }
  }

  if (canValidate && !validation.isValid) {
    story.hasHighUnknownWords = true;
  } else {
    story.hasHighUnknownWords = false;
  }

  return story;
};

// ============================================================
// Response normalization
// ============================================================
export const normalizeStoryResponse = (data: any, isReview = false, fallbackLevel = 'A1'): StoryResponse => {
  if (!data || typeof data !== 'object') {
    return {
      story_title: "Generated Story",
      level_target: fallbackLevel as any,
      sentences: [],
      estimated_vocab_count: "0",
      new_words_to_add: [],
      is_review: isReview
    };
  }

  const source = data.story && typeof data.story === 'object' ? data.story : data;
  const story_title = String(source.story_title || source.title || data.story_title || data.title || "Lesson Story");
  const level_target = source.level_target || data.level_target || fallbackLevel;
  const estimated_vocab_count = String(source.estimated_vocab_count || data.estimated_vocab_count || "0");
  const modelUsed = source.modelUsed || data.modelUsed || undefined;
  const proper_nouns = Array.isArray(source.proper_nouns)
    ? source.proper_nouns.map((p: any) => String(p || '').trim()).filter(Boolean)
    : (Array.isArray(data.proper_nouns) ? data.proper_nouns.map((p: any) => String(p || '').trim()).filter(Boolean) : undefined);
  const annotationsFailed = source.annotationsFailed !== undefined
    ? Boolean(source.annotationsFailed)
    : (data.annotationsFailed !== undefined ? Boolean(data.annotationsFailed) : undefined);

  let rawSentences = source.sentences || data.sentences || source.sentence_list || data.sentence_list;
  if (!Array.isArray(rawSentences)) {
    if (typeof source.text === 'string' || typeof data.text === 'string') {
      const text = source.text || data.text;
      rawSentences = text.split(/(?<=[.?!])\s+/).filter(Boolean).map((s: string, idx: number) => ({
        id: idx + 1,
        original: s,
        translation: '',
        new_element: '',
        explanation: '',
        part_of_speech: ''
      }));
    } else {
      rawSentences = [];
    }
  }

  const sentences = (rawSentences as any[]).map((s: any, idx: number) => {
    if (typeof s === 'string') {
      return {
        id: idx + 1,
        original: s,
        translation: '',
        phonetic: '',
        new_element: '',
        explanation: '',
        definition_target: '',
        part_of_speech: ''
      };
    }
    return {
      id: typeof s?.id === 'number' ? s.id : idx + 1,
      original: String(s?.original || s?.sentence || s?.text || '').trim(),
      translation: String(s?.translation || s?.meaning || '').trim(),
      phonetic: String(s?.phonetic || s?.ipa || '').trim(),
      new_element: String(s?.new_element || s?.new_word || s?.target_word || '').trim(),
      explanation: String(s?.explanation || '').trim(),
      definition_target: String(s?.definition_target || s?.definition || '').trim(),
      part_of_speech: String(s?.part_of_speech || s?.grammar_class || s?.pos || '').trim(),
      extraUnknownCount: typeof s?.extraUnknownCount === 'number' ? s.extraUnknownCount : undefined
    };
  }).filter((s: any) => s.original.length > 0);

  let rawNewWords = source.new_words_to_add || data.new_words_to_add;
  let new_words_to_add: string[] = [];
  if (Array.isArray(rawNewWords)) {
    new_words_to_add = rawNewWords.map((w: any) => String(w || '').trim().toLowerCase()).filter(Boolean);
  } else if (typeof rawNewWords === 'string') {
    new_words_to_add = rawNewWords.split(/[,;\s]+/).map((w: string) => w.trim().toLowerCase()).filter(Boolean);
  } else if (!isReview) {
    new_words_to_add = Array.from(new Set(
      sentences.map((s: any) => s.new_element).filter(Boolean).map((w: string) => w.toLowerCase())
    ));
  }

  return {
    story_title,
    level_target,
    sentences,
    estimated_vocab_count,
    new_words_to_add,
    is_review: isReview,
    modelUsed,
    proper_nouns,
    annotationsFailed
  };
};