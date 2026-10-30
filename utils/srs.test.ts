import { describe, it, expect } from 'vitest';
import {
  calculateNextInterval,
  getTargetDueDate,
  getStartOfDay,
  getDueCards,
  computeSRSStats,
  calculateRealRetentionRate,
  estimateRetentionRate,
  generate30DayRetentionData,
  formatIntervalLabel,
  getCardButtonIntervals,
  getWeakWords
} from './srs';
import {
  tokenize,
  analyzeSentenceTokens,
  analyzeStoryVocabulary,
  extractSentenceProperNouns,
  MAX_ZERO_NOVELTY_RATIO,
  MAX_HIGH_UNKNOWN_SENTENCE_RATIO,
  isDerivedFromKnown,
  evaluateEnrichmentOption,
  selectBestEnrichmentOption,
  EnrichmentOption
} from '../services/geminiService';
import { SRSCard, SRSReviewLogEntry, StoryResponse, NoveltyDensity } from '../types';

const createMockCard = (overrides: Partial<SRSCard> = {}): SRSCard => ({
  id: 'card_1',
  storyTimestamp: 1000,
  sentenceId: 1,
  targetLanguage: 'English',
  nativeLanguage: 'Portuguese',
  state: 'new',
  reps: 0,
  lapses: 0,
  easeFactor: 2.5,
  interval: 0,
  dueDate: Date.now(),
  storyTitle: 'Test Story',
  sentence: {
    id: 1,
    original: 'Hello world',
    translation: 'Olá mundo',
    phonetic: 'həˈloʊ',
    new_element: 'hello',
    explanation: 'olá',
    definition_target: 'a greeting'
  },
  ...overrides
});

describe('SRS SM-2 Algorithm Tests', () => {
  const fixedNow = new Date(2026, 9, 23, 14, 30, 0).getTime(); // 2026-10-23 14:30:00 local

  describe('calculateNextInterval for New Cards (reps === 0)', () => {
    it('handles Rating 1 (Again): schedules in 10 minutes, sets state to learning, increments lapse', () => {
      const card = createMockCard({ state: 'new', reps: 0, lapses: 0, easeFactor: 2.5 });
      const next = calculateNextInterval(card, 1, fixedNow);

      expect(next.state).toBe('learning');
      expect(next.reps).toBe(0);
      expect(next.lapses).toBe(1);
      expect(next.interval).toBeLessThan(0.01);
      expect(next.dueDate).toBe(fixedNow + 10 * 60 * 1000);
      expect(next.easeFactor).toBe(2.3); // 2.5 - 0.20
    });

    it('handles Rating 2 (Hard) on new card: keeps learning, 10 min, does NOT add lapse, penalises easeFactor', () => {
      const card = createMockCard({ state: 'new', reps: 0, lapses: 0, easeFactor: 2.5 });
      const next = calculateNextInterval(card, 2, fixedNow);

      expect(next.state).toBe('learning');
      expect(next.reps).toBe(0);
      expect(next.lapses).toBe(0); // No lapse added!
      expect(next.interval).toBeLessThan(0.01);
      expect(next.dueDate).toBe(fixedNow + 10 * 60 * 1000);
      expect(next.easeFactor).toBe(2.35); // 2.5 - 0.15
    });

    it('handles Rating 3 (Good) on new card: graduates to 1 day at 00:00 of tomorrow', () => {
      const card = createMockCard({ state: 'new', reps: 0, lapses: 0, easeFactor: 2.5 });
      const next = calculateNextInterval(card, 3, fixedNow);

      expect(next.state).toBe('review');
      expect(next.reps).toBe(1);
      expect(next.lapses).toBe(0);
      expect(next.interval).toBe(1);

      // Verify due date is exactly at 00:00 local of tomorrow
      const dueDateObj = new Date(next.dueDate);
      expect(dueDateObj.getHours()).toBe(0);
      expect(dueDateObj.getMinutes()).toBe(0);
      expect(dueDateObj.getSeconds()).toBe(0);
      expect(dueDateObj.getDate()).toBe(24);
    });

    it('handles Rating 4 (Easy) on new card: graduates to 3 days at 00:00 of target day', () => {
      const card = createMockCard({ state: 'new', reps: 0, lapses: 0, easeFactor: 2.5 });
      const next = calculateNextInterval(card, 4, fixedNow);

      expect(next.state).toBe('review');
      expect(next.reps).toBe(1);
      expect(next.interval).toBe(3);
      expect(next.easeFactor).toBe(2.65); // 2.5 + 0.15

      const dueDateObj = new Date(next.dueDate);
      expect(dueDateObj.getHours()).toBe(0);
      expect(dueDateObj.getDate()).toBe(26); // 23 + 3 days
    });
  });

  describe('calculateNextInterval for Mature Cards (reps > 0)', () => {
    const matureCard = createMockCard({
      state: 'review',
      reps: 3,
      lapses: 0,
      easeFactor: 2.5,
      interval: 10,
      dueDate: fixedNow
    });

    it('handles Rating 1 (Again) on mature card: resets reps, lapses + 1, reschedules in 10 minutes', () => {
      const next = calculateNextInterval(matureCard, 1, fixedNow);
      expect(next.state).toBe('learning');
      expect(next.reps).toBe(0);
      expect(next.lapses).toBe(1);
      expect(next.dueDate).toBe(fixedNow + 10 * 60 * 1000);
    });

    it('handles Rating 2 (Hard) on mature card: multiplies interval by 1.2 at 00:00', () => {
      const next = calculateNextInterval(matureCard, 2, fixedNow);
      expect(next.state).toBe('review'); // 12 < 21
      expect(next.reps).toBe(4);
      expect(next.interval).toBe(12); // round(10 * 1.2)
      const dueObj = new Date(next.dueDate);
      expect(dueObj.getHours()).toBe(0);
    });

    it('handles Rating 3 (Good) on mature card: multiplies by easeFactor (10 * 2.5 = 25 => mastered)', () => {
      const next = calculateNextInterval(matureCard, 3, fixedNow);
      expect(next.interval).toBe(25);
      expect(next.state).toBe('mastered'); // >= 21 days
      expect(next.reps).toBe(4);
      const dueObj = new Date(next.dueDate);
      expect(dueObj.getHours()).toBe(0);
    });

    it('handles Rating 4 (Easy) on mature card: multiplies by easeFactor * 1.3', () => {
      const next = calculateNextInterval(matureCard, 4, fixedNow);
      expect(next.interval).toBe(34); // round(10 * 2.65 * 1.3) = 34
      expect(next.state).toBe('mastered');
      expect(next.easeFactor).toBe(2.65);
      const dueObj = new Date(next.dueDate);
      expect(dueObj.getHours()).toBe(0);
    });
  });

  describe('Due Date at Start of Day (00:00)', () => {
    it('sets start of day for interval >= 1', () => {
      const due = getTargetDueDate(2, fixedNow);
      const d = new Date(due);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getSeconds()).toBe(0);
      expect(d.getMilliseconds()).toBe(0);
      expect(d.getDate()).toBe(25); // 23 + 2
    });

    it('retains minute-based timing for sub-day interval (< 1)', () => {
      const due = getTargetDueDate(0.007, fixedNow);
      expect(due).toBeGreaterThan(fixedNow);
      expect(due).toBeLessThan(fixedNow + 15 * 60 * 1000);
    });
  });

  describe('Daily New Cards Limit', () => {
    it('limits new cards in getDueCards to dailyNewCardsLimit', () => {
      const cards: SRSCard[] = Array.from({ length: 30 }, (_, i) =>
        createMockCard({ id: `c_${i}`, state: 'new', sentenceId: i })
      );

      const due = getDueCards(cards, 'English', 20, fixedNow);
      expect(due.length).toBe(20);
    });

    it('deducts cards already reviewed today from the new cards limit', () => {
      const startOfToday = getStartOfDay(fixedNow);
      // 5 cards reviewed today
      const reviewedCards: SRSCard[] = Array.from({ length: 5 }, (_, i) =>
        createMockCard({ id: `rev_${i}`, state: 'learning', firstReviewedAt: startOfToday + 3600000 })
      );
      // 25 waiting new cards
      const newCards: SRSCard[] = Array.from({ length: 25 }, (_, i) =>
        createMockCard({ id: `new_${i}`, state: 'new', sentenceId: i })
      );

      const all = [...reviewedCards, ...newCards];
      // 20 limit - 5 already reviewed today = 15 new cards allowed
      const due = getDueCards(all, 'English', 20, fixedNow);
      const newInDue = due.filter(c => c.state === 'new');
      expect(newInDue.length).toBe(15);
    });

    it('never limits review cards that are due', () => {
      const startOfToday = getStartOfDay(fixedNow);
      // 20 cards already reviewed today
      const reviewedCards: SRSCard[] = Array.from({ length: 20 }, (_, i) =>
        createMockCard({ id: `rev_${i}`, state: 'review', firstReviewedAt: startOfToday + 1000 })
      );
      // 10 review cards due now
      const dueReviewCards: SRSCard[] = Array.from({ length: 10 }, (_, i) =>
        createMockCard({ id: `due_${i}`, state: 'review', dueDate: fixedNow - 1000, reps: 2 })
      );
      // 15 new cards
      const newCards: SRSCard[] = Array.from({ length: 15 }, (_, i) =>
        createMockCard({ id: `new_${i}`, state: 'new' })
      );

      const due = getDueCards([...reviewedCards, ...dueReviewCards, ...newCards], 'English', 20, fixedNow);
      // All 10 due review cards should be returned, and 0 new cards (since 20 already reviewed)
      expect(due.length).toBe(10);
      expect(due.every(c => c.state === 'review')).toBe(true);
    });

    it('allows all new cards when limit is 0 (unlimited)', () => {
      const cards: SRSCard[] = Array.from({ length: 50 }, (_, i) =>
        createMockCard({ id: `c_${i}`, state: 'new', sentenceId: i })
      );

      const due = getDueCards(cards, 'English', 0, fixedNow);
      expect(due.length).toBe(50);
    });

    it('defaults dailyNewCardsLimit to 0 (unlimited) when omitted', () => {
      const cards: SRSCard[] = Array.from({ length: 50 }, (_, i) =>
        createMockCard({ id: `c_${i}`, state: 'new', sentenceId: i })
      );

      const due = getDueCards(cards, 'English', undefined, fixedNow);
      expect(due.length).toBe(50);
    });
  });

  describe('Review Log and Real Retention Rate', () => {
    it('returns null when log has fewer than 5 eligible reviews', () => {
      const logs: SRSReviewLogEntry[] = [
        ['c1', new Date(fixedNow - 10000).toISOString(), 3, 2],
        ['c2', new Date(fixedNow - 20000).toISOString(), 3, 3]
      ];
      expect(calculateRealRetentionRate(logs, 30, fixedNow)).toBeNull();
    });

    it('calculates real retention rate accurately from eligible reviews (prevInterval >= 1)', () => {
      const logs: SRSReviewLogEntry[] = [
        ['c1', new Date(fixedNow - 10000).toISOString(), 3, 1], // pass
        ['c2', new Date(fixedNow - 20000).toISOString(), 4, 3], // pass
        ['c3', new Date(fixedNow - 30000).toISOString(), 2, 2], // pass (Hard >= 2)
        ['c4', new Date(fixedNow - 40000).toISOString(), 1, 4], // fail (Again = 1)
        ['c5', new Date(fixedNow - 50000).toISOString(), 3, 6], // pass
        ['c6', new Date(fixedNow - 60000).toISOString(), 1, 0.007], // ignored! (prevInterval < 1)
      ];

      // 5 eligible reviews: 4 passed (rating >= 2), 1 failed (rating 1) => 4/5 = 80%
      const res = calculateRealRetentionRate(logs, 30, fixedNow);
      expect(res).not.toBeNull();
      expect(res?.rate).toBe(80);
      expect(res?.count).toBe(5);
    });

    it('supports numeric epoch timestamps in logs', () => {
      const logs: SRSReviewLogEntry[] = [
        ['c1', fixedNow - 10000, 3, 1],
        ['c2', fixedNow - 20000, 4, 3],
        ['c3', fixedNow - 30000, 2, 2],
        ['c4', fixedNow - 40000, 1, 4],
        ['c5', fixedNow - 50000, 3, 6],
      ];
      const res = calculateRealRetentionRate(logs, 30, fixedNow);
      expect(res?.rate).toBe(80);
      expect(res?.count).toBe(5);
    });

    it('estimateRetentionRate marks isEstimated false when real log exists', () => {
      const logs: SRSReviewLogEntry[] = [
        ['c1', new Date(fixedNow - 1000).toISOString(), 3, 1],
        ['c2', new Date(fixedNow - 2000).toISOString(), 3, 1],
        ['c3', new Date(fixedNow - 3000).toISOString(), 3, 1],
        ['c4', new Date(fixedNow - 4000).toISOString(), 3, 1],
        ['c5', new Date(fixedNow - 5000).toISOString(), 3, 1]
      ];
      const res = estimateRetentionRate([], logs);
      expect(res.isEstimated).toBe(false);
      expect(res.rate).toBe(100);
    });
  });

  describe('generate30DayRetentionData', () => {
    it('returns 30 data points with null retentionRate when logs have fewer than 5 eligible reviews', () => {
      const cards = [createMockCard({ id: 'c1', state: 'learning' })];
      const points = generate30DayRetentionData(cards, 'English', []);
      expect(points.length).toBe(30);
      expect(points.every(p => p.retentionRate === null)).toBe(true);
    });

    it('computes rolling 30-day retentionRate per day when eligible reviews exist', () => {
      const ONE_DAY_MS = 86400000;
      const now = Date.now();
      const logs: SRSReviewLogEntry[] = [
        ['c1', now - 1 * ONE_DAY_MS, 3, 2],
        ['c2', now - 2 * ONE_DAY_MS, 4, 3],
        ['c3', now - 3 * ONE_DAY_MS, 3, 4],
        ['c4', now - 4 * ONE_DAY_MS, 2, 5],
        ['c5', now - 5 * ONE_DAY_MS, 1, 6],
      ];
      const cards = [createMockCard({ id: 'c1', state: 'review' })];
      const points = generate30DayRetentionData(cards, 'English', logs);
      expect(points.length).toBe(30);
      const latestPoint = points[points.length - 1];
      expect(latestPoint.retentionRate).toBe(80); // 4 / 5 = 80%
      expect(latestPoint.isEstimated).toBe(false);
    });

    it('uses mastered heuristic rating >= 3 and prevInterval * 2 >= 21', () => {
      const ONE_DAY_MS = 86400000;
      const now = Date.now();
      // Card with prevInterval 11, * 2 = 22 >= 21 -> graduates to mastered
      const logs: SRSReviewLogEntry[] = [
        ['c_mature', now - 2 * ONE_DAY_MS, 3, 11]
      ];
      const matureCard = createMockCard({
        id: 'c_mature',
        state: 'mastered',
        storyTimestamp: now - 10 * ONE_DAY_MS
      });
      const points = generate30DayRetentionData([matureCard], 'English', logs);
      const latestPoint = points[points.length - 1];
      expect(latestPoint.mastered).toBe(1);
    });
  });

  describe('In-Code new_element Detection and Tokenization', () => {
    it('tokenize drops elided prefixes and keeps Unicode words > 1 char', () => {
      const tokens = tokenize("L'amico dell'arte e un'ora con qu'est-ce don't a-b");
      expect(tokens).toContain('amico');
      expect(tokens).toContain('arte');
      expect(tokens).toContain('ora');
      expect(tokens).toContain('est');
      expect(tokens).not.toContain("l'");
      expect(tokens).not.toContain("dell'");
    });

    it('extractSentenceProperNouns includes global proper nouns and middle-of-sentence capitalized words', () => {
      const globalProper = new Set(['roma']);
      const sentence = 'Oggi Marco e Giulia visitano Roma con grande entusiasmo.';
      const proper = extractSentenceProperNouns(sentence, globalProper);

      expect(proper.has('roma')).toBe(true);
      expect(proper.has('marco')).toBe(true);
      expect(proper.has('giulia')).toBe(true);
      // "Oggi" is at sentence start (index 0), so not treated as middle capitalized
      expect(proper.has('oggi')).toBe(false);
    });

    it('analyzeSentenceTokens detects the first unknown token as new_element and computes extraUnknownCount', () => {
      const known = new Set(['l', 'amico', 'compra', 'il', 'pane']);
      const proper = new Set<string>();
      const sentence = { id: 1, original: "L'amico compra un delizioso pane fresco." };
      const analysis = analyzeSentenceTokens(sentence, known, proper);

      // "un", "delizioso", "fresco" are unknown (length > 1)
      // "un" has length 2
      expect(analysis.newElement).toBe('un');
      expect(analysis.unknownTokens).toEqual(['un', 'delizioso', 'fresco']);
      expect(analysis.extraUnknownCount).toBe(2);
    });

    it('analyzeSentenceTokens ignores proper nouns and middle capitalized words', () => {
      const known = new Set(['oggi', 'compra', 'un', 'libro']);
      const globalProper = new Set(['milano']);
      const sentence = { id: 2, original: 'Oggi Marco compra un libro fantastico a Milano.' };
      const analysis = analyzeSentenceTokens(sentence, known, globalProper);

      // Marco (middle-capitalized) and Milano (globalProper) ignored
      // Only "fantastico" is unknown
      expect(analysis.newElement).toBe('fantastico');
      expect(analysis.unknownTokens).toEqual(['fantastico']);
      expect(analysis.extraUnknownCount).toBe(0);
    });

    it('analyzeStoryVocabulary identifies sentences with >=3 unknowns and sentences with 0 unknowns', () => {
      const mockStory: StoryResponse = {
        story_title: 'Test Story',
        level_target: 'A1',
        estimated_vocab_count: '10',
        new_words_to_add: [],
        proper_nouns: ['Marco'],
        sentences: [
          {
            id: 1,
            original: 'Marco compra una mela rossa fresca.', // unknown: una, mela, rossa, fresca (4 unknowns)
            translation: 'Marco compra uma maçã vermelha fresca.'
          },
          {
            id: 2,
            original: 'Marco parla bene.', // known: parla, bene -> 0 unknowns
            translation: 'Marco fala bem.'
          },
          {
            id: 3,
            original: 'Marco legge un libro.', // known: legge, libro; unknown: un (1 unknown)
            translation: 'Marco lê um livro.'
          }
        ]
      };

      const knownWords = ['parla', 'bene', 'legge', 'libro'];
      const analysis = analyzeStoryVocabulary(mockStory, knownWords);

      expect(analysis.totalSentences).toBe(3);
      expect(analysis.sentencesWith3OrMoreUnknowns).toBe(1); // sentence 1 has >= 3 unknowns
      expect(analysis.sentencesWith0Unknowns).toBe(1); // sentence 2 has 0 unknowns
      expect(analysis.problematicCount).toBe(2);
      expect(analysis.ratioWith3OrMore).toBeCloseTo(1 / 3, 2);
      expect(analysis.ratioWith0).toBeCloseTo(1 / 3, 2);
    });

    describe('Novelty Density Mode Limits (MAX_ZERO_NOVELTY_RATIO)', () => {
      it('has expected threshold values per mode', () => {
        expect(MAX_ZERO_NOVELTY_RATIO.high).toBe(0.3);
        expect(MAX_ZERO_NOVELTY_RATIO.normal).toBe(0.5);
        expect(MAX_ZERO_NOVELTY_RATIO.low).toBe(0.7);
        expect(MAX_HIGH_UNKNOWN_SENTENCE_RATIO).toBe(0.3);
      });

      it('correctly evaluates when zero-novelty threshold is exceeded for different modes', () => {
        const checkNeedsEnrichment = (ratioWith0: number, density: NoveltyDensity): boolean => {
          return ratioWith0 > MAX_ZERO_NOVELTY_RATIO[density];
        };

        // Ratio of 0.45 zero-novelty sentences:
        // - In 'high' (limit 0.3): 0.45 > 0.3 -> needs enrichment
        expect(checkNeedsEnrichment(0.45, 'high')).toBe(true);
        // - In 'normal' (limit 0.5): 0.45 <= 0.5 -> ok
        expect(checkNeedsEnrichment(0.45, 'normal')).toBe(false);
        // - In 'low' (limit 0.7): 0.45 <= 0.7 -> ok
        expect(checkNeedsEnrichment(0.45, 'low')).toBe(false);

        // Ratio of 0.60 zero-novelty sentences:
        // - In 'high' (0.3): needs enrichment
        expect(checkNeedsEnrichment(0.60, 'high')).toBe(true);
        // - In 'normal' (0.5): 0.60 > 0.5 -> needs enrichment
        expect(checkNeedsEnrichment(0.60, 'normal')).toBe(true);
        // - In 'low' (0.7): 0.60 <= 0.7 -> ok
        expect(checkNeedsEnrichment(0.60, 'low')).toBe(false);

        // Ratio of 0.80 zero-novelty sentences:
        // - In all modes: exceeds limit
        expect(checkNeedsEnrichment(0.80, 'high')).toBe(true);
        expect(checkNeedsEnrichment(0.80, 'normal')).toBe(true);
        expect(checkNeedsEnrichment(0.80, 'low')).toBe(true);

        // Ratio of 0.20 zero-novelty sentences:
        // - Within bounds for all modes
        expect(checkNeedsEnrichment(0.20, 'high')).toBe(false);
        expect(checkNeedsEnrichment(0.20, 'normal')).toBe(false);
        expect(checkNeedsEnrichment(0.20, 'low')).toBe(false);
      });
    });
  });

  describe('getWeakWords', () => {
    it('identifies and orders weak words from learning and lapsed cards', () => {
      const cardA = createMockCard({
        id: 'cA',
        state: 'learning',
        lapses: 3,
        sentence: { ...createMockCard().sentence, new_element: 'difficult' }
      });
      const cardB = createMockCard({
        id: 'cB',
        state: 'review',
        lapses: 1,
        sentence: { ...createMockCard().sentence, new_element: 'moderate' }
      });
      const cardC = createMockCard({
        id: 'cC',
        state: 'mastered',
        lapses: 0,
        sentence: { ...createMockCard().sentence, new_element: 'easyword' }
      });

      const weak = getWeakWords([cardA, cardB, cardC], 'English');
      expect(weak).toContain('difficult');
      expect(weak).toContain('moderate');
      expect(weak).not.toContain('easyword');
      expect(weak[0]).toBe('difficult'); // weaker card first
    });
  });

  describe('isDerivedFromKnown', () => {
    it('detects derived words that share a substantial stem with known words', () => {
      const knownSet = new Set(['grande', 'molto', 'bambino']);

      // "grandissimo" vs "grande": minLen=6, threshold=4.2, prefix="grand"(5) >= 4.2 -> derived
      const res1 = isDerivedFromKnown('grandissimo', knownSet);
      expect(res1.isDerived).toBe(true);
      expect(res1.matchingKnown).toBe('grande');

      // "molti" vs "molto": minLen=5, threshold=4, prefix="molt"(4) >= 4 -> derived
      const res2 = isDerivedFromKnown('molti', knownSet);
      expect(res2.isDerived).toBe(true);
      expect(res2.matchingKnown).toBe('molto');

      // "bambina" vs "bambino": minLen=7, threshold=4.9, prefix="bambin"(6) >= 4.9 -> derived
      const res3 = isDerivedFromKnown('bambina', knownSet);
      expect(res3.isDerived).toBe(true);
      expect(res3.matchingKnown).toBe('bambino');
    });

    it('does not reject unrelated words or words with prefix shorter than 4 characters', () => {
      const knownSet = new Set(['grande', 'casa', 'pane']);

      // Unrelated word
      expect(isDerivedFromKnown('nuvola', knownSet).isDerived).toBe(false);

      // Short words with 3-char prefix (< 4 threshold)
      const shortSet = new Set(['cat']);
      expect(isDerivedFromKnown('cats', shortSet).isDerived).toBe(false);
    });
  });

  describe('Enrichment Alternative Selection', () => {
    const knownWords = ['io', 'leggo', 'un', 'libro', 'sul', 'tavolo', 'grande', 'la', 'musica'];
    const knownSet = new Set(knownWords);
    const properNounTokens = new Set(['marco', 'roma']);

    it('rejects an alternative whose word is already in known vocabulary', () => {
      const option: EnrichmentOption = {
        word: 'libro',
        sentence: 'Io leggo un libro sul tavolo.',
        translation: 'Eu leio um livro sobre a mesa.'
      };

      const result = evaluateEnrichmentOption(option, knownSet, properNounTokens, true);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('word already known');
    });

    it('rejects an alternative whose target word does not appear in the sentence', () => {
      const option: EnrichmentOption = {
        word: 'quaderno',
        sentence: 'Io leggo un giornale sul tavolo.',
        translation: 'Eu leio um jornal sobre a mesa.'
      };

      const result = evaluateEnrichmentOption(option, knownSet, properNounTokens, true);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('word absent from sentence');
    });

    it('rejects an alternative whose sentence has more than 1 unknown word', () => {
      // Unknowns: 'chitarra', 'antico', 'strano' (3 unknowns)
      const option: EnrichmentOption = {
        word: 'chitarra',
        sentence: 'Io suono la chitarra antico e strano.',
        translation: 'Eu toco o violão antigo e estranho.'
      };

      const result = evaluateEnrichmentOption(option, knownSet, properNounTokens, true);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('more than 1 unknown word');
    });

    it('rejects when word shares stem with known word in strict mode, but accepts in relaxed mode', () => {
      // "grandissimo" shares stem with known word "grande"
      const option: EnrichmentOption = {
        word: 'grandissimo',
        sentence: 'Io leggo un grandissimo libro sul tavolo.',
        translation: 'Eu leio um livro grandíssimo sobre a mesa.'
      };

      // In strict mode (default): rejected
      const strictResult = evaluateEnrichmentOption(option, knownSet, properNounTokens, true);
      expect(strictResult.valid).toBe(false);
      expect(strictResult.reason).toContain('shares stem with known word: grande');

      // In relaxed mode (strictNewWords = false): accepted
      const relaxedResult = evaluateEnrichmentOption(option, knownSet, properNounTokens, false);
      expect(relaxedResult.valid).toBe(true);
      expect(relaxedResult.chosenWord).toBe('grandissimo');
    });

    it('selects the first valid alternative among multiple options and reports rejections', () => {
      const options: EnrichmentOption[] = [
        // 1. Rejected: word already known
        {
          word: 'libro',
          sentence: 'Io leggo un libro sul tavolo.',
          translation: 'Eu leio um livro sobre a mesa.'
        },
        // 2. Rejected: word absent from sentence
        {
          word: 'mela',
          sentence: 'Io mangio il pane con piacere.',
          translation: 'Eu como o pão com prazer.'
        },
        // 3. Valid: exactly 1 unknown word ("chitarra") which is in sentence and not in known
        {
          word: 'chitarra',
          sentence: 'Io ascolto la chitarra con piacere.',
          translation: 'Eu escuto o violão com prazer.'
        },
        // 4. Also valid alternative
        {
          word: 'violino',
          sentence: 'Io ascolto il violino con piacere.',
          translation: 'Eu escuto o violino com prazer.'
        }
      ];

      // Add 'ascolto', 'il', 'con', 'piacere' to knownSet so only 'chitarra' is unknown in #3
      const customKnownSet = new Set([...knownWords, 'ascolto', 'il', 'con', 'piacere']);

      const selection = selectBestEnrichmentOption(options, customKnownSet, properNounTokens, true);
      expect(selection.acceptedOption).toBeDefined();
      expect(selection.chosenWord).toBe('chitarra');
      expect(selection.acceptedOption?.sentence).toBe('Io ascolto la chitarra con piacere.');
      expect(selection.acceptedCount).toBe(2);
      expect(selection.rejectedCount).toBe(2);
      expect(selection.rejectionReasons[0]).toContain('word already known');
      expect(selection.rejectionReasons[1]).toBe('word absent from sentence');
    });

    it('correctly accepts a target word when an article is included in option.word', () => {
      // "il" is already known, "focolare" is unknown
      const customKnownSet = new Set([...knownWords, 'il', 'vicino', 'al']);
      const option: EnrichmentOption = {
        word: 'il focolare',
        sentence: 'Io leggo un libro vicino al focolare.',
        translation: 'Eu leio um livro perto da lareira.'
      };

      const result = evaluateEnrichmentOption(option, customKnownSet, properNounTokens, true);
      expect(result.valid).toBe(true);
      expect(result.chosenWord).toBe('focolare');
    });

    it('accepts compound/multi-token target word when all unknown tokens belong to the target word', () => {
      // "ferrovia" tokenized or 2 unknown tokens both belonging to word
      const customKnownSet = new Set([...knownWords, 'vicino', 'alla']);
      const option: EnrichmentOption = {
        word: 'ferrovia sotterranea',
        sentence: 'Io cammino vicino alla ferrovia sotterranea.',
        translation: 'Eu caminho perto da ferrovia subterrânea.'
      };
      // "cammino" is in knownSet
      customKnownSet.add('cammino');

      const result = evaluateEnrichmentOption(option, customKnownSet, properNounTokens, false);
      expect(result.valid).toBe(true);
      expect(result.chosenWord).toBe('ferrovia');
    });
  });
});


