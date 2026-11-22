import { HistoryItem, Sentence, SRSCard, PersistedSRSCard, SRSCardRating, SRSStats, SRSReviewLogEntry } from '../types';

export const DEFAULT_EASE_FACTOR = 2.5;
export const DEFAULT_DESIRED_RETENTION = 0.9;
export const FSRS_DECAY = -0.5;
export const FSRS_FACTOR = 19 / 81;
export const FSRS_MIN_STABILITY = 0.1;
export const FSRS_MAX_INTERVAL_DAYS = 36500;
export const MASTERED_INTERVAL_DAYS = 21;

// Official FSRS-5 default parameters (19 weights: w0..w18)
export const FSRS_DEFAULT_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, // w0..w3: initial stability S0(1..4)
  7.1949, 0.5345, 1.4604, 0.0046,    // w4..w7: initial difficulty & mean reversion
  1.54575, 0.1192, 1.01925,          // w8..w10: stability after recall
  1.9395, 0.11, 0.29605, 2.2698,     // w11..w14: stability after lapse (forget)
  0.2315, 2.9898,                    // w15 (hard penalty), w16 (easy bonus)
  0.51655, 0.6621                    // w17..w18: same-day (short-term) review stability
] as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Creates a unique deterministic identifier for an SRS card
 */
export const getCardId = (storyTimestamp: number, sentenceId: number, sentenceOriginal: string): string => {
  const hash = Math.abs(
    sentenceOriginal.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  ).toString(36);
  return `${storyTimestamp}_s${sentenceId}_${hash.slice(0, 6)}`;
};

/**
 * Extracts sentenceId from any card representation (new or legacy)
 */
export const getSentenceIdFromCard = (card: { sentenceId?: number; sentence?: { id?: number }; id?: string }): number => {
  if (typeof card.sentenceId === 'number') return card.sentenceId;
  if (card.sentence && typeof card.sentence.id === 'number') return card.sentence.id;
  if (card.id) {
    const match = card.id.match(/_s(\d+)_/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
};

/**
 * Checks if a card has departed from its initial state (reviewed at least once or moved beyond new)
 */
export const isCardNonInitial = (card: PersistedSRSCard | SRSCard): boolean => {
  return card.state !== 'new' || (card.reps || 0) > 0 || (card.lapses || 0) > 0;
};

/**
 * Converts a runtime or raw SRS card to its compact persisted format.
 * Strips sentence and storyTitle if the story exists in history.
 * Retains sentence and storyTitle ONLY for orphan cards (story deleted from history).
 */
export const toPersistedCard = (
  card: SRSCard | PersistedSRSCard,
  history: HistoryItem[]
): PersistedSRSCard => {
  const sentenceId = getSentenceIdFromCard(card);
  const storyExists = Array.isArray(history) && history.some(h => h && h.timestamp === card.storyTimestamp);

  const persisted: PersistedSRSCard = {
    id: card.id,
    storyTimestamp: card.storyTimestamp,
    sentenceId,
    targetLanguage: card.targetLanguage,
    nativeLanguage: card.nativeLanguage,
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    easeFactor: card.easeFactor || DEFAULT_EASE_FACTOR,
    interval: card.interval || 0,
    dueDate: card.dueDate
  };

  if (card.stability !== undefined) persisted.stability = card.stability;
  if (card.difficulty !== undefined) persisted.difficulty = card.difficulty;
  if (card.lastReviewed !== undefined) persisted.lastReviewed = card.lastReviewed;
  if (card.firstReviewedAt !== undefined) persisted.firstReviewedAt = card.firstReviewedAt;
  if (card.learningAt !== undefined) persisted.learningAt = card.learningAt;
  if (card.masteredAt !== undefined) persisted.masteredAt = card.masteredAt;

  // Orphan fallback: If story does not exist in history, keep sentence and storyTitle
  if (!storyExists) {
    if (card.sentence) persisted.sentence = card.sentence;
    if (card.storyTitle) persisted.storyTitle = card.storyTitle;
  }

  return persisted;
};

/**
 * Filters and compacts cards for persistence (localStorage and export).
 * Only cards that have exited the initial state are stored, plus any orphan cards with fallback data.
 */
export const compactAndFilterPersistedCards = (
  cards: (PersistedSRSCard | SRSCard)[],
  history: HistoryItem[]
): PersistedSRSCard[] => {
  if (!Array.isArray(cards)) return [];
  return cards
    .filter(c => {
      if (!c) return false;
      if (isCardNonInitial(c)) return true;
      const storyExists = Array.isArray(history) && history.some(h => h && h.timestamp === c.storyTimestamp);
      return !storyExists && Boolean(c.sentence);
    })
    .map(c => toPersistedCard(c, history));
};

/**
 * Resolves a single persisted SRS card into a complete runtime SRSCard.
 * Rule: Uses embedded sentence and storyTitle if present (orphan fallback), otherwise looks up in history.
 */
export const resolveCard = (
  card: PersistedSRSCard | SRSCard,
  history: HistoryItem[]
): SRSCard | null => {
  const sentenceId = getSentenceIdFromCard(card);

  // 1. Embedded fallback (orphan cards or pre-resolved)
  if (card.sentence && card.storyTitle) {
    return {
      ...card,
      sentenceId,
      sentence: card.sentence,
      storyTitle: card.storyTitle
    };
  }

  // 2. Lookup story in history by timestamp
  const story = Array.isArray(history) ? history.find(h => h && h.timestamp === card.storyTimestamp) : null;
  if (!story || !Array.isArray(story.sentences)) {
    if (card.sentence) {
      return {
        ...card,
        sentenceId,
        sentence: card.sentence,
        storyTitle: card.storyTitle || 'Archived Story'
      };
    }
    return null;
  }

  // 3. Lookup sentence in story
  const foundSentence = story.sentences.find((s, idx) => {
    if (s.id !== undefined) return s.id === sentenceId;
    return idx === sentenceId;
  }) || story.sentences[sentenceId] || story.sentences[0];

  if (!foundSentence) return null;

  return {
    ...card,
    sentenceId,
    sentence: foundSentence,
    storyTitle: story.story_title || 'Untitled Story'
  };
};

/**
 * Resolves all active SRS cards at runtime:
 * 1. Resolves all persisted non-initial cards (and orphan cards) via resolveCard.
 * 2. Lazily generates virtual "new" cards from history in stable order (oldest story to newest story)
 *    for any sentence that has not yet been reviewed/persisted.
 */
export const resolveAllCards = (
  persistedCards: PersistedSRSCard[],
  history: HistoryItem[],
  targetLanguage: string,
  nativeLanguage: string
): SRSCard[] => {
  const resolvedList: SRSCard[] = [];
  const trackedCardIds = new Set<string>();
  const trackedStorySentenceKeys = new Set<string>();

  // 1. Resolve persisted cards
  if (Array.isArray(persistedCards)) {
    persistedCards.forEach(pc => {
      const resolved = resolveCard(pc, history);
      if (resolved) {
        resolvedList.push(resolved);
        trackedCardIds.add(resolved.id);
        trackedStorySentenceKeys.add(`${resolved.storyTimestamp}_${resolved.sentenceId}`);
      }
    });
  }

  // 2. Generate virtual "new" cards from history (oldest story to newest story)
  if (Array.isArray(history)) {
    const completedStories = history
      .filter(h => h && h.completed && Array.isArray(h.sentences))
      .slice()
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    completedStories.forEach(story => {
      story.sentences.forEach((sentence, idx) => {
        if (!sentence || !sentence.original) return;
        const sid = sentence.id ?? idx;
        const cardId = getCardId(story.timestamp, sid, sentence.original);
        const storySentenceKey = `${story.timestamp}_${sid}`;

        if (!trackedCardIds.has(cardId) && !trackedStorySentenceKeys.has(storySentenceKey)) {
          const virtualCard: SRSCard = {
            id: cardId,
            storyTimestamp: story.timestamp,
            sentenceId: sid,
            sentence,
            storyTitle: story.story_title || 'Untitled Story',
            targetLanguage: story.targetLanguage || targetLanguage || 'Language',
            nativeLanguage: (story as any).nativeLanguage || nativeLanguage || 'Native',
            state: 'new',
            reps: 0,
            lapses: 0,
            easeFactor: DEFAULT_EASE_FACTOR,
            interval: 0,
            dueDate: story.completedAt || story.timestamp || Date.now()
          };
          resolvedList.push(virtualCard);
          trackedCardIds.add(cardId);
          trackedStorySentenceKeys.add(storySentenceKey);
        }
      });
    });
  }

  return resolvedList;
};

/**
 * Legacy compatibility stub: kept for backward compatibility if imported elsewhere
 */
export const syncCardsFromHistory = (
  history: HistoryItem[],
  existingCards: SRSCard[],
  targetLanguage: string,
  nativeLanguage: string
): SRSCard[] => {
  return resolveAllCards(existingCards, history, targetLanguage, nativeLanguage);
};

/**
 * Returns local 00:00:00.000 timestamp for the given timestamp/date
 */
export const getStartOfDay = (dateInput: Date | number = Date.now()): number => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Calculates due date:
 * - Sub-day intervals (< 1 day) stay relative to now (e.g. 10 minutes)
 * - Intervals >= 1 day are set to 00:00 local time of the target day (today + interval)
 */
export const getTargetDueDate = (intervalDays: number, now: number = Date.now()): number => {
  if (intervalDays < 1) {
    return now + Math.round(intervalDays * 86400 * 1000);
  }
  const target = new Date(now);
  target.setDate(target.getDate() + Math.round(intervalDays));
  target.setHours(0, 0, 0, 0);
  return target.getTime();
};

/**
 * FSRS-5 power-law forgetting curve: probability of recall (0..1) after `elapsedDays`
 * given memory stability `S` (in days). At `elapsedDays === S`, R(S, S) === 0.9.
 */
export const calculateRetrievability = (elapsedDays: number, stability: number): number => {
  if (stability <= 0) return 0;
  if (elapsedDays <= 0) return 1;
  return clamp(Math.pow(1 + FSRS_FACTOR * (elapsedDays / stability), FSRS_DECAY), 0, 1);
};

/**
 * FSRS-5 optimal next interval in days for a given stability and desired retention rate.
 */
export const calculateNextIntervalDays = (
  stability: number,
  desiredRetention: number = DEFAULT_DESIRED_RETENTION
): number => {
  const r = clamp(desiredRetention, 0.7, 0.99);
  const rawDays = (Math.max(FSRS_MIN_STABILITY, stability) / FSRS_FACTOR) * (Math.pow(r, 1 / FSRS_DECAY) - 1);
  return clamp(Math.round(rawDays), 1, FSRS_MAX_INTERVAL_DAYS);
};

const fsrsInitDifficulty = (rating: SRSCardRating, w = FSRS_DEFAULT_WEIGHTS): number => {
  return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
};

const fsrsNextDifficulty = (difficulty: number, rating: SRSCardRating, w = FSRS_DEFAULT_WEIGHTS): number => {
  const deltaD = -w[6] * (rating - 3);
  const dampedD = difficulty + deltaD * ((10 - difficulty) / 9);
  const d0Easy = fsrsInitDifficulty(4, w);
  const meanReverted = w[7] * d0Easy + (1 - w[7]) * dampedD;
  return clamp(meanReverted, 1, 10);
};

const fsrsShortTermStability = (stability: number, rating: SRSCardRating, w = FSRS_DEFAULT_WEIGHTS): number => {
  return Math.max(FSRS_MIN_STABILITY, stability * Math.exp(w[17] * (rating - 3 + w[18])));
};

const fsrsRecallStability = (
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: SRSCardRating,
  w = FSRS_DEFAULT_WEIGHTS
): number => {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  const nextS = stability * (
    1 +
    Math.exp(w[8]) *
    (11 - difficulty) *
    Math.pow(Math.max(FSRS_MIN_STABILITY, stability), -w[9]) *
    (Math.exp(w[10] * (1 - retrievability)) - 1) *
    hardPenalty *
    easyBonus
  );
  return Math.max(FSRS_MIN_STABILITY, nextS);
};

const fsrsForgetStability = (
  difficulty: number,
  stability: number,
  retrievability: number,
  w = FSRS_DEFAULT_WEIGHTS
): number => {
  const postLapseS =
    w[11] *
    Math.pow(difficulty, -w[12]) *
    (Math.pow(Math.max(FSRS_MIN_STABILITY, stability) + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - retrievability));
  // Stability after a lapse never exceeds prior stability
  return clamp(postLapseS, FSRS_MIN_STABILITY, Math.max(FSRS_MIN_STABILITY, stability));
};

const difficultyToLegacyEaseFactor = (difficulty: number): number => {
  // Smooth mapping from FSRS difficulty (1..10, neutral ~5.28) to legacy SM-2 easeFactor (1.3..3.0, neutral 2.5)
  return round2(clamp(2.5 + (5.28 - difficulty) * 0.25, 1.3, 3.0));
};

/**
 * Seamlessly migrates a legacy SM-2 card (without stability/difficulty) into FSRS-5 memory state.
 * Existing FSRS cards are returned unchanged.
 */
export const migrateLegacyCardToFSRS = (
  card: Pick<PersistedSRSCard, 'stability' | 'difficulty' | 'easeFactor' | 'interval' | 'lapses'>
): { stability: number; difficulty: number } => {
  if (
    typeof card.stability === 'number' &&
    card.stability > 0 &&
    typeof card.difficulty === 'number' &&
    card.difficulty >= 1
  ) {
    return {
      stability: card.stability,
      difficulty: clamp(card.difficulty, 1, 10)
    };
  }

  const stability = Math.max(
    FSRS_MIN_STABILITY,
    card.interval && card.interval >= 1
      ? card.interval
      : (card.lapses || 0) > 0
        ? FSRS_DEFAULT_WEIGHTS[0]
        : 1
  );
  const legacyEase = card.easeFactor || DEFAULT_EASE_FACTOR;
  const difficulty = clamp(5.28 - (legacyEase - 2.5) * 3.0, 1, 10);

  return { stability: round2(stability), difficulty: round2(difficulty) };
};

/**
 * Calculates the next SRS interval, FSRS stability/difficulty, and due date following the FSRS-5 algorithm:
 * - New cards use initial stability S0(rating) and initial difficulty D0(rating)
 * - Same-day / learning reviews use FSRS-5 short-term stability update
 * - Long-term reviews use DSR power-law retrievability R(t, S) to reward spacing and preserve partial stability on lapses
 * - Automatically migrates legacy SM-2 cards on their first FSRS review
 */
export const calculateNextInterval = (
  card: SRSCard,
  rating: SRSCardRating,
  now: number = Date.now(),
  desiredRetention: number = DEFAULT_DESIRED_RETENTION
): {
  interval: number;
  easeFactor: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: SRSCard['state'];
  dueDate: number;
} => {
  const w = FSRS_DEFAULT_WEIGHTS;
  const r = clamp(desiredRetention || DEFAULT_DESIRED_RETENTION, 0.7, 0.99);
  const isNewCard =
    card.state === 'new' &&
    (card.reps || 0) === 0 &&
    (card.lapses || 0) === 0 &&
    card.stability === undefined;

  let reps = card.reps || 0;
  let lapses = card.lapses || 0;
  let stability: number;
  let difficulty: number;
  let interval: number;
  let state: SRSCard['state'];
  let dueDate: number;

  if (isNewCard) {
    stability = Math.max(FSRS_MIN_STABILITY, w[rating - 1]);
    difficulty = fsrsInitDifficulty(rating, w);

    if (rating === 1) {
      // Again: enters learning queue for re-review in 10 minutes
      reps = 0;
      lapses += 1;
      interval = 0.007; // ~10 minutes
      state = 'learning';
      dueDate = now + 10 * 60 * 1000;
    } else {
      // Strictly monotonic intervals across Hard, Good, Easy
      const hardIvl = calculateNextIntervalDays(w[1], r);
      const goodIvl = Math.max(hardIvl + 1, calculateNextIntervalDays(w[2], r));
      const easyIvl = Math.max(goodIvl + 1, calculateNextIntervalDays(w[3], r));

      interval = rating === 2 ? hardIvl : rating === 3 ? goodIvl : easyIvl;
      reps = 1;
      state = interval >= MASTERED_INTERVAL_DAYS ? 'mastered' : 'review';
      dueDate = getTargetDueDate(interval, now);
    }
  } else {
    const { stability: prevS, difficulty: prevD } = migrateLegacyCardToFSRS(card);
    const elapsedDays = card.lastReviewed !== undefined
      ? Math.max(0, (now - card.lastReviewed) / 86400000)
      : card.state === 'learning'
        ? 0
        : Math.max(0, card.interval || 0);

    difficulty = fsrsNextDifficulty(prevD, rating, w);
    const isShortTerm = card.state === 'learning' || elapsedDays < 1;

    if (rating === 1) {
      // Lapse: preserve partial stability rather than wiping memory completely
      const retrievability = calculateRetrievability(elapsedDays, prevS);
      stability = isShortTerm
        ? fsrsShortTermStability(prevS, 1, w)
        : fsrsForgetStability(difficulty, prevS, retrievability, w);
      reps = 0;
      lapses += 1;
      interval = 0.007; // ~10 minutes
      state = 'learning';
      dueDate = now + 10 * 60 * 1000;
    } else if (isShortTerm) {
      stability = fsrsShortTermStability(prevS, rating, w);

      if (card.state === 'learning' && rating === 2 && stability < 1) {
        // Still struggling during re-learning: keep in short-term learning without adding a lapse
        interval = 0.007;
        state = 'learning';
        dueDate = now + 10 * 60 * 1000;
      } else {
        const hardS = fsrsShortTermStability(prevS, 2, w);
        const goodS = fsrsShortTermStability(prevS, 3, w);
        const easyS = fsrsShortTermStability(prevS, 4, w);

        const hardIvl = calculateNextIntervalDays(hardS, r);
        const goodIvl = card.state === 'learning'
          ? calculateNextIntervalDays(goodS, r)
          : Math.max(hardIvl + 1, calculateNextIntervalDays(goodS, r));
        const easyIvl = Math.max(goodIvl + 1, calculateNextIntervalDays(easyS, r));

        interval = rating === 2 ? hardIvl : rating === 3 ? goodIvl : easyIvl;
        reps += 1;
        state = interval >= MASTERED_INTERVAL_DAYS ? 'mastered' : 'review';
        dueDate = getTargetDueDate(interval, now);
      }
    } else {
      // Standard long-term FSRS-5 recall
      const retrievability = calculateRetrievability(elapsedDays, prevS);
      const hardD = fsrsNextDifficulty(prevD, 2, w);
      const goodD = fsrsNextDifficulty(prevD, 3, w);
      const easyD = fsrsNextDifficulty(prevD, 4, w);

      const hardS = fsrsRecallStability(hardD, prevS, retrievability, 2, w);
      const goodS = fsrsRecallStability(goodD, prevS, retrievability, 3, w);
      const easyS = fsrsRecallStability(easyD, prevS, retrievability, 4, w);

      stability = rating === 2 ? hardS : rating === 3 ? goodS : easyS;

      const hardIvl = calculateNextIntervalDays(hardS, r);
      const goodIvl = Math.max(hardIvl + 1, calculateNextIntervalDays(goodS, r));
      const easyIvl = Math.max(goodIvl + 1, calculateNextIntervalDays(easyS, r));

      interval = rating === 2 ? hardIvl : rating === 3 ? goodIvl : easyIvl;
      reps += 1;
      state = interval >= MASTERED_INTERVAL_DAYS ? 'mastered' : 'review';
      dueDate = getTargetDueDate(interval, now);
    }
  }

  const roundedStability = round2(stability);
  const roundedDifficulty = round2(difficulty);

  return {
    interval,
    easeFactor: difficultyToLegacyEaseFactor(roundedDifficulty),
    stability: roundedStability,
    difficulty: roundedDifficulty,
    reps,
    lapses,
    state,
    dueDate
  };
};

/**
 * Returns user-friendly time string for Anki button badges (e.g. "< 10m", "1d", "4d", "2m")
 */
export const formatIntervalLabel = (intervalInDays: number): string => {
  if (intervalInDays < 0.05) {
    return '< 10m';
  }
  if (intervalInDays < 1) {
    return `${Math.round(intervalInDays * 24)}h`;
  }
  if (intervalInDays < 30) {
    return `${Math.round(intervalInDays)}d`;
  }
  if (intervalInDays < 365) {
    const months = Math.round(intervalInDays / 30);
    return `${months}m`;
  }
  const years = (intervalInDays / 365).toFixed(1);
  return `${years}y`;
};

/**
 * Calculates preview labels for each rating button on a card consistent with actual FSRS-5 rules
 */
export const getCardButtonIntervals = (
  card: SRSCard,
  desiredRetention: number = DEFAULT_DESIRED_RETENTION,
  now: number = Date.now()
): Record<SRSCardRating, string> => {
  return {
    1: '< 10m',
    2: formatIntervalLabel(calculateNextInterval(card, 2, now, desiredRetention).interval),
    3: formatIntervalLabel(calculateNextInterval(card, 3, now, desiredRetention).interval),
    4: formatIntervalLabel(calculateNextInterval(card, 4, now, desiredRetention).interval)
  };
};

/**
 * Filters cards that are due for review today or newly introduced:
 * - Review cards due (dueDate <= now) are never limited
 * - New cards ('new') are limited by dailyNewCardsLimit (default 0, 0 = unlimited)
 *   counting how many cards had their first review today
 */
export const getDueCards = (
  cards: SRSCard[],
  targetLanguage?: string,
  dailyNewCardsLimit = 0,
  now: number = Date.now()
): SRSCard[] => {
  const startOfTodayMs = getStartOfDay(now);

  const langCards = cards.filter(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return false;
    }
    return true;
  });

  // Count how many new cards were reviewed today for the first time
  const newCardsReviewedToday = langCards.filter(
    c => c.firstReviewedAt && c.firstReviewedAt >= startOfTodayMs
  ).length;

  const remainingNewSlots = dailyNewCardsLimit > 0
    ? Math.max(0, dailyNewCardsLimit - newCardsReviewedToday)
    : Infinity;

  // Review cards due are never limited
  const reviewCardsDue = langCards.filter(
    c => c.state !== 'new' && c.dueDate <= now
  );

  // New cards sorted by oldest story first, then sentenceId
  const newCardsAll = langCards
    .filter(c => c.state === 'new')
    .sort((a, b) => {
      if (a.storyTimestamp !== b.storyTimestamp) {
        return (a.storyTimestamp || 0) - (b.storyTimestamp || 0);
      }
      return (a.sentenceId ?? 0) - (b.sentenceId ?? 0);
    });

  const availableNewCards = remainingNewSlots > 0
    ? newCardsAll.slice(0, remainingNewSlots)
    : [];

  const combined = [...reviewCardsDue, ...availableNewCards];

  return combined.sort((a, b) => {
    // Prioritize learning cards first, then review due, then new cards, then mastered
    const order: Record<string, number> = { learning: 0, review: 1, new: 2, mastered: 3 };
    const orderA = order[a.state] ?? 1;
    const orderB = order[b.state] ?? 1;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    if (a.state === 'new' && b.state === 'new') {
      if (a.storyTimestamp !== b.storyTimestamp) {
        return (a.storyTimestamp || 0) - (b.storyTimestamp || 0);
      }
      return (a.sentenceId ?? 0) - (b.sentenceId ?? 0);
    }

    return a.dueDate - b.dueDate;
  });
};

/**
 * Computes high-level statistics of the SRS deck taking into account the daily new card limit
 */
export const computeSRSStats = (
  cards: SRSCard[],
  targetLanguage?: string,
  dailyNewCardsLimit = 0,
  now: number = Date.now()
): SRSStats => {
  const startOfTodayMs = getStartOfDay(now);

  let totalCards = 0;
  let totalNewInDeck = 0;
  let learningCards = 0;
  let reviewCards = 0;
  let masteredCards = 0;
  let reviewedTodayCount = 0;
  let newReviewedTodayCount = 0;
  let reviewDueCount = 0;

  cards.forEach(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return;
    }

    totalCards += 1;

    if (card.state === 'new') {
      totalNewInDeck += 1;
    } else if (card.dueDate <= now) {
      reviewDueCount += 1;
    }

    if (card.state === 'learning') learningCards += 1;
    else if (card.state === 'review') reviewCards += 1;
    else if (card.state === 'mastered') masteredCards += 1;

    if (card.lastReviewed && card.lastReviewed >= startOfTodayMs) {
      reviewedTodayCount += 1;
    }
    if (card.firstReviewedAt && card.firstReviewedAt >= startOfTodayMs) {
      newReviewedTodayCount += 1;
    }
  });

  const remainingNewSlots = dailyNewCardsLimit > 0
    ? Math.max(0, dailyNewCardsLimit - newReviewedTodayCount)
    : totalNewInDeck;

  const newCardsQueuedToday = Math.min(totalNewInDeck, remainingNewSlots);
  const dueToday = reviewDueCount + newCardsQueuedToday;

  return {
    totalCards,
    dueToday,
    newCards: newCardsQueuedToday,
    learningCards,
    reviewCards,
    masteredCards,
    reviewedTodayCount
  };
};

export const MAX_REVIEW_LOG_ENTRIES = 8000;

/**
 * Calculates real retention rate from review logs:
 * Among reviews of cards that already had interval >= 1 day, the fraction with rating >= 2 (not Again) in the last 30 days.
 */
export const calculateRealRetentionRate = (
  reviewLogs?: SRSReviewLogEntry[],
  days = 30,
  now = Date.now()
): { rate: number; count: number } | null => {
  if (!Array.isArray(reviewLogs) || reviewLogs.length === 0) return null;

  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const eligible = reviewLogs.filter(([_, timestamp, __, prevInterval]) => {
    const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return time >= cutoff && prevInterval >= 1;
  });

  if (eligible.length < 5) {
    return null;
  }

  const successful = eligible.filter(([_, __, rating]) => rating >= 2);
  const rate = Math.round((successful.length / eligible.length) * 100);
  return { rate, count: eligible.length };
};

/**
 * Calculates retention rate:
 * - Uses real review logs if available and sufficient data exists
 * - Falls back to card state estimation if no logs, marking isEstimated: true
 * - Returns rate: null if insufficient data (< 5 reviews)
 */
export const estimateRetentionRate = (
  cards: SRSCard[],
  reviewLogs?: SRSReviewLogEntry[]
): { rate: number | null; isEstimated: boolean } => {
  const real = calculateRealRetentionRate(reviewLogs);
  if (real !== null) {
    return { rate: real.rate, isEstimated: false };
  }

  const reviewedCards = cards.filter(c => c.reps > 0 || c.lapses > 0);
  if (reviewedCards.length < 5) {
    return { rate: null, isEstimated: true };
  }

  let totalWeight = 0;
  let successWeight = 0;

  reviewedCards.forEach(c => {
    const trials = c.reps + c.lapses;
    totalWeight += trials;
    successWeight += c.reps;
  });

  if (totalWeight === 0) return { rate: null, isEstimated: true };
  const rate = Math.max(60, Math.min(99, Math.round((successWeight / totalWeight) * 100)));
  return { rate, isEstimated: true };
};

export interface RetentionProgressPoint {
  date: string;
  fullDate: string;
  dayNumber: number;
  timestamp: number;
  learning: number;
  mastered: number;
  totalActive: number;
  graduatedToday: number;
  retentionRate: number | null;
  isEstimated?: boolean;
}

/**
 * Generates a 30-day time series tracking cards moving from Learning to Mastered.
 * When review logs or masteredAt are available, uses real transition timestamps instead of fabricated dates.
 * Computes retentionRate for each day over the 30-day window ending on that day (or null if < 5 reviews).
 */
export const generate30DayRetentionData = (
  cards: SRSCard[],
  targetLanguage?: string,
  reviewLogs?: SRSReviewLogEntry[],
  locale?: string
): RetentionProgressPoint[] => {
  const filtered = cards.filter(c => !targetLanguage || !c.targetLanguage || c.targetLanguage === targetLanguage);
  const now = Date.now();
  const ONE_DAY_MS = 86400000;
  
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();

  // If logs exist, build a map of exact mastered timestamps
  // Mastered heuristic from logs: rating >= 3 and prevInterval * 2 >= 21
  const masteredDatesFromLogs = new Map<string, number>();
  if (Array.isArray(reviewLogs)) {
    reviewLogs.forEach(([cardId, timestamp, rating, prevInterval]) => {
      if (rating >= 3 && prevInterval * 2 >= 21) {
        const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
        if (!masteredDatesFromLogs.has(cardId) || time < masteredDatesFromLogs.get(cardId)!) {
          masteredDatesFromLogs.set(cardId, time);
        }
      }
    });
  }

  const dataPoints: RetentionProgressPoint[] = [];

  for (let i = 29; i >= 0; i--) {
    const dayEndMs = endOfTodayMs - (i * ONE_DAY_MS);
    const dayStartMs = dayEndMs - ONE_DAY_MS + 1;
    const dateObj = new Date(dayEndMs);

    const dateLabel = dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const fullDateLabel = dateObj.toLocaleDateString(locale, {
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });

    let learningCount = 0;
    let masteredCount = 0;
    let graduatedToday = 0;

    filtered.forEach(card => {
      const cardCreated = card.storyTimestamp || card.firstReviewedAt || (now - 25 * ONE_DAY_MS);
      
      // Check if card existed on this day
      if (cardCreated <= dayEndMs) {
        const isMasteredNow = card.state === 'mastered';
        
        let graduationTime: number | null = null;
        if (card.masteredAt) {
          graduationTime = card.masteredAt;
        } else if (masteredDatesFromLogs.has(card.id)) {
          graduationTime = masteredDatesFromLogs.get(card.id)!;
        } else if (isMasteredNow) {
          // If no logs exist, use lastReviewed if valid, without fabricating +14 days
          graduationTime = card.lastReviewed || null;
        }

        if (graduationTime !== null && graduationTime <= dayEndMs) {
          masteredCount++;
          if (graduationTime >= dayStartMs && graduationTime <= dayEndMs) {
            graduatedToday++;
          }
        } else {
          learningCount++;
        }
      }
    });

    const totalActive = learningCount + masteredCount;

    // Rolling 30-day window ending on this day
    const windowStartMs = dayEndMs - 30 * ONE_DAY_MS;
    let dayRetentionRate: number | null = null;
    let isDayEstimated = false;

    if (Array.isArray(reviewLogs) && reviewLogs.length > 0) {
      const eligible = reviewLogs.filter(([_, timestamp, __, prevInterval]) => {
        const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
        return time >= windowStartMs && time <= dayEndMs && prevInterval >= 1;
      });

      if (eligible.length >= 5) {
        const successful = eligible.filter(([_, __, rating]) => rating >= 2);
        dayRetentionRate = Math.round((successful.length / eligible.length) * 100);
        isDayEstimated = false;
      } else {
        dayRetentionRate = null;
        isDayEstimated = true;
      }
    } else {
      dayRetentionRate = null;
      isDayEstimated = true;
    }

    dataPoints.push({
      date: dateLabel,
      fullDate: fullDateLabel,
      dayNumber: 30 - i,
      timestamp: dayEndMs,
      learning: learningCount,
      mastered: masteredCount,
      totalActive,
      graduatedToday,
      retentionRate: dayRetentionRate,
      isEstimated: isDayEstimated
    });
  }

  return dataPoints;
};

/**
 * Extracts weak words from SRS cards for priority reinforcement in story generation:
 * - Cards in targetLanguage that are in 'learning', have lapses > 0, or had Again/Hard in last 14 days
 * - Ordered from weakest to strongest
 */
export const getWeakWords = (
  cards: SRSCard[],
  targetLanguage: string,
  reviewLogs?: SRSReviewLogEntry[],
  now: number = Date.now()
): string[] => {
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  // Build card rating stats from logs if available
  const recentRatingsByCard = new Map<string, { againCount: number; hardCount: number }>();
  if (Array.isArray(reviewLogs)) {
    reviewLogs.forEach(([cardId, timestamp, rating]) => {
      const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
      if (time >= fourteenDaysAgo) {
        const current = recentRatingsByCard.get(cardId) || { againCount: 0, hardCount: 0 };
        if (rating === 1) current.againCount += 1;
        if (rating === 2) current.hardCount += 1;
        recentRatingsByCard.set(cardId, current);
      }
    });
  }

  // Filter cards of target language that qualify as weak
  const weakCandidates = cards.filter(card => {
    if (targetLanguage && card.targetLanguage && card.targetLanguage !== targetLanguage) {
      return false;
    }
    const logStats = recentRatingsByCard.get(card.id);
    const hasRecentAgainOrHard = logStats ? (logStats.againCount > 0 || logStats.hardCount > 0) : false;
    
    return card.state === 'learning' || (card.lapses || 0) > 0 || hasRecentAgainOrHard;
  });

  // Calculate weakness score (higher = weaker), incorporating FSRS difficulty when available
  const scored = weakCandidates.map(card => {
    let score = 0;
    if (card.state === 'learning') score += 10;
    score += (card.lapses || 0) * 4;
    if (typeof card.difficulty === 'number') {
      score += Math.max(0, (card.difficulty - 5.0) * 1.5);
    } else {
      score += Math.max(0, (2.5 - (card.easeFactor || 2.5)) * 4);
    }
    if (typeof card.stability === 'number' && card.stability > 0 && card.stability < 7) {
      score += (7 - card.stability) * 0.5;
    }

    const logStats = recentRatingsByCard.get(card.id);
    if (logStats) {
      score += logStats.againCount * 5;
      score += logStats.hardCount * 2;
    }

    return { card, score };
  });

  // Sort from weakest (highest score) to strongest
  scored.sort((a, b) => b.score - a.score);

  // Extract new_element, clean, lowercase, deduplicate
  const words: string[] = [];
  const seen = new Set<string>();

  for (const { card } of scored) {
    const rawWord = card.sentence?.new_element?.trim().toLowerCase();
    if (rawWord && !seen.has(rawWord) && rawWord.length >= 2) {
      seen.add(rawWord);
      words.push(rawWord);
    }
  }

  return words;
};
