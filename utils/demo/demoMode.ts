/**
 * Demo mode: builds a realistic, self-contained learner snapshot (profile, ~4 weeks of
 * completed lessons, FSRS review history) so the app can be shown or recorded without an
 * API key and without touching the real user's data.
 *
 * Enable with `?demo` (or `?demo=clean` to hide the badge). Everything is in memory.
 */
import { HistoryItem, PersistedSRSCard, SRSCard, SRSCardRating, SRSReviewLogEntry, StoryResponse, UserProfile } from '../../types';
import { STORAGE_KEY, SRS_STORAGE_KEY, SRS_LOG_STORAGE_KEY } from '../persistentStore';
import { calculateNextInterval, getCardId, toPersistedCard, DEFAULT_EASE_FACTOR } from '../srs';
import { applyOptimizedAdvancedSettings } from '../profileOptimizer';

export interface DemoStoryData {
  story_title: string;
  level_target: StoryResponse['level_target'];
  proper_nouns?: string[];
  sentences: StoryResponse['sentences'];
}

export interface DemoContent {
  history: DemoStoryData[];
  fresh: DemoStoryData[];
  review: DemoStoryData;
}

const DAY = 24 * 60 * 60 * 1000;
const DEMO_TARGET = 'Italian';
const DEMO_NATIVE = 'English';
const DEMO_MODEL = 'gemini-3.8-flash';

// Deterministic PRNG so every demo run (and every recording take) looks the same
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const newWordsOf = (story: DemoStoryData) =>
  Array.from(new Set(story.sentences.map(s => (s.new_element || '').trim().toLowerCase()).filter(Boolean)));

/**
 * Day offsets (days ago) on which each history lesson was completed.
 * Shape: a few scattered early sessions, a missed day, then a 12-day streak ending today
 * (some days with two lessons), so the calendar, chart and streak all look lived-in.
 */
export const DEMO_SCHEDULE_DAYS_AGO = [27, 26, 24, 23, 21, 19, 18, 16, 14, 13, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

const pickRating = (rand: () => number, lapses: number): SRSCardRating => {
  const r = rand();
  const againP = lapses > 0 ? 0.14 : 0.09;
  if (r < againP) return 1;
  if (r < againP + 0.14) return 2;
  if (r < 0.86) return 3;
  return 4;
};

export const buildDemoState = (content: DemoContent, baseVocab: string[], now = Date.now()) => {
  const rand = mulberry32(20261122);
  const today = startOfDay(now);

  // 1. History: lessons completed in the evening on the scheduled days (+ one this morning)
  const history: HistoryItem[] = [];
  const schedule = DEMO_SCHEDULE_DAYS_AGO.slice(0, content.history.length);
  content.history.forEach((story, i) => {
    const daysAgo = schedule[i] ?? 0;
    const sameDayIndex = schedule.slice(0, i).filter(d => d === daysAgo).length;
    const ts = today - daysAgo * DAY + (19 + sameDayIndex) * 60 * 60 * 1000 + Math.floor(rand() * 40) * 60 * 1000;
    history.push({
      ...story,
      proper_nouns: story.proper_nouns || [],
      estimated_vocab_count: '',
      new_words_to_add: newWordsOf(story),
      is_review: false,
      modelUsed: DEMO_MODEL,
      targetLanguage: DEMO_TARGET,
      timestamp: ts,
      completedAt: ts,
      completed: true,
    });
  });

  // 2. FSRS simulation: replay one review session per day (8–9pm) up to yesterday,
  //    so today's queue contains genuinely due cards.
  const cards: SRSCard[] = [];
  history.forEach(story => {
    story.sentences.forEach(sentence => {
      cards.push({
        id: getCardId(story.timestamp, sentence.id, sentence.original),
        storyTimestamp: story.timestamp,
        sentenceId: sentence.id,
        sentence,
        storyTitle: story.story_title,
        targetLanguage: DEMO_TARGET,
        nativeLanguage: DEMO_NATIVE,
        state: 'new',
        reps: 0,
        lapses: 0,
        easeFactor: DEFAULT_EASE_FACTOR,
        interval: 0,
        dueDate: story.timestamp,
      });
    });
  });

  const logs: SRSReviewLogEntry[] = [];
  const firstDay = startOfDay(Math.min(...history.map(h => h.timestamp)));
  for (let day = firstDay; day < today; day += DAY) {
    // Skip the deliberately missed day so the streak/calendar story stays consistent
    const daysAgo = Math.round((today - day) / DAY);
    if (!schedule.includes(daysAgo)) continue;
    let minute = 0;
    const sessionStart = day + 20 * 60 * 60 * 1000;
    for (let idx = 0; idx < cards.length; idx++) {
      const card = cards[idx];
      if (card.storyTimestamp > sessionStart + 2 * 60 * 60 * 1000) continue; // story not studied yet
      // Up to two passes per day: a failed card comes back later in the same session
      for (let pass = 0; pass < 2; pass++) {
        const reviewAt = sessionStart + 60 * 60 * 1000 + minute * 20 * 1000;
        if (card.dueDate > day + DAY - 1) break;
        if (pass === 1 && card.dueDate > reviewAt) break;
        minute++;
        const rating = pickRating(rand, card.lapses);
        const prevInterval = card.interval || 0;
        const isFirst = (card.reps || 0) === 0 && !card.firstReviewedAt;
        const result = calculateNextInterval(card, rating, reviewAt, 0.9);
        Object.assign(card, {
          interval: result.interval,
          easeFactor: result.easeFactor,
          stability: result.stability,
          difficulty: result.difficulty,
          reps: result.reps,
          lapses: result.lapses,
          state: result.state,
          dueDate: result.dueDate,
          lastReviewed: reviewAt,
          firstReviewedAt: card.firstReviewedAt || (isFirst ? reviewAt : undefined),
          learningAt: card.learningAt || (result.state === 'learning' || result.state === 'review' ? reviewAt : undefined),
          masteredAt: result.state === 'mastered' ? (card.masteredAt || reviewAt) : undefined,
        });
        logs.push([card.id, reviewAt, rating, prevInterval]);
        if (rating !== 1) break;
      }
    }
  }

  const persistedCards: PersistedSRSCard[] = cards
    .filter(c => c.reps > 0 || c.state !== 'new')
    .map(c => toPersistedCard(c, history));

  // 3. Profile: base frequency vocabulary + every word learned in the lessons
  const knownWords = Array.from(new Set([...baseVocab, ...history.flatMap(h => h.new_words_to_add)]));
  const profile: UserProfile = applyOptimizedAdvancedSettings({
    name: 'Luis',
    targetLanguage: DEMO_TARGET,
    nativeLanguage: DEMO_NATIVE,
    level: 'A2',
    knownWords,
    uiLanguage: 'en',
    darkMode: false,
    notificationTime: '09:00',
    notificationsEnabled: false,
    storySize: 'standard',
    dailyGoal: 2,
    srsDailyGoal: 20,
    srsAutoPlayAudio: false,
    apiKey: '',
    manualAdvancedOverrides: ['srsAutoPlayAudio', 'srsBackType'],
    srsBackType: 'element_translation',
  });

  return {
    profile,
    history: history.slice().reverse(), // app stores newest first
    persistedCards,
    logs,
  };
};

let cachedContent: DemoContent | null = null;

const loadContent = async (): Promise<{ content: DemoContent; baseVocab: string[] }> => {
  const [contentModule, vocabModule] = await Promise.all([
    import('./demoStories.it.json'),
    import('./demoBaseVocab.it.json'),
  ]);
  cachedContent = (contentModule.default || contentModule) as unknown as DemoContent;
  return { content: cachedContent, baseVocab: (vocabModule.default || vocabModule) as unknown as string[] };
};

export const buildDemoSnapshot = async (): Promise<Record<string, string>> => {
  const { content, baseVocab } = await loadContent();
  const { profile, history, persistedCards, logs } = buildDemoState(content, baseVocab);
  return {
    [STORAGE_KEY]: JSON.stringify({ profile, history }),
    [SRS_STORAGE_KEY]: JSON.stringify(persistedCards),
    [SRS_LOG_STORAGE_KEY]: JSON.stringify(logs),
  };
};

// ============================================================
// Scripted "generation" (no API calls in demo mode)
// ============================================================
let freshIndex = 0;

const toStoryResponse = (story: DemoStoryData, isReview: boolean): StoryResponse => ({
  ...story,
  proper_nouns: story.proper_nouns || [],
  estimated_vocab_count: '',
  new_words_to_add: isReview ? [] : newWordsOf(story),
  is_review: isReview,
  hasHighUnknownWords: false,
  annotationsFailed: false,
  modelUsed: DEMO_MODEL,
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Returns the next showcase story after a realistic "thinking" delay. */
export const generateDemoStory = async (delayMs = 3200): Promise<StoryResponse> => {
  const content = cachedContent || (await loadContent()).content;
  const story = content.fresh[freshIndex % content.fresh.length];
  freshIndex++;
  await sleep(delayMs);
  return toStoryResponse(story, false);
};

export const generateDemoReviewStory = async (delayMs = 3200): Promise<StoryResponse> => {
  const content = cachedContent || (await loadContent()).content;
  await sleep(delayMs);
  return toStoryResponse(content.review, true);
};
