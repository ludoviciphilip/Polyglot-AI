
export type CEFRLevel = 'Pre-A1' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type UILanguage = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it';
export type StorySize = 'short' | 'standard' | 'medium' | 'long';
export type AncientGreekDialect = 'attic' | 'koine';
export type AncientGreekFocus = 'general' | 'philosophical';
export type ShakespeareanFocus = 'general' | 'drama' | 'courtly';
export type NoveltyDensity = 'low' | 'normal' | 'high';

export interface Sentence {
  id: number;
  original: string;
  translation: string;
  phonetic?: string; 
  new_element?: string;
  explanation?: string;
  definition_target?: string; // Field for immersive learning
  part_of_speech?: string; // Grammatical category: noun, verb, adjective, adverb, phrasal verb, etc.
  extraUnknownCount?: number; // Unknown words in sentence beyond the first
}

export interface StoryResponse {
  story_title: string;
  level_target: CEFRLevel;
  sentences: Sentence[];
  estimated_vocab_count: string;
  new_words_to_add: string[];
  proper_nouns?: string[];
  annotationsFailed?: boolean;
  is_review?: boolean;
  isReopened?: boolean;
  historyTimestamp?: number;
  hasHighUnknownWords?: boolean;
  modelUsed?: string;
}

export interface UserProfile {
  name: string;
  targetLanguage: string;
  nativeLanguage: string;
  level: CEFRLevel;
  knownWords: string[];
  uiLanguage: UILanguage;
  darkMode: boolean;
  notificationTime: string; // "HH:mm"
  notificationsEnabled: boolean;
  storySize: StorySize;
  ancientGreekDialect?: AncientGreekDialect;
  ancientGreekFocus?: AncientGreekFocus;
  shakespeareanFocus?: ShakespeareanFocus;
  streakCount?: number;
  lastCompletedDate?: string;
  dailyGoal?: number;
  apiKey?: string;
  srsBackType?: SRSBackType;
  srsDailyGoal?: number;
  dailyNewCardsLimit?: number; // default 0; 0 = no limit
  srsAutoPlayAudio?: boolean; // default true: automatic browser TTS when review card appears
  noveltyDensity?: NoveltyDensity; // 'high' (1/sentence), 'normal' (~70%), 'low' (~40%)
  strictNewWords?: boolean; // default true: reject words sharing stems/roots with known vocabulary
}

export interface HistoryItem extends StoryResponse {
  timestamp: number;
  completed: boolean;
  targetLanguage?: string;
  completedAt?: number;
}

export type SRSBackType = 'full_translation' | 'element_translation' | 'target_definition';

export type SRSCardRating = 1 | 2 | 3 | 4; // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

// Compact review log entry tuple: [cardId, timestamp, rating, previousIntervalDays]
export type SRSReviewLogEntry = [cardId: string, timestamp: number | string, rating: SRSCardRating, previousIntervalDays: number];

export interface PersistedSRSCard {
  id: string;
  storyTimestamp: number;
  sentenceId: number;
  targetLanguage: string;
  nativeLanguage: string;
  state: 'new' | 'learning' | 'review' | 'mastered';
  reps: number;
  lapses: number;
  easeFactor: number; // default 2.5
  interval: number; // in days
  dueDate: number; // timestamp (ms)
  lastReviewed?: number; // timestamp (ms)
  firstReviewedAt?: number; // timestamp (ms) when card had its first review
  learningAt?: number; // timestamp (ms) when card started learning
  masteredAt?: number; // timestamp (ms) when card graduated to mastered
  // Orphan card fallback: retained if story is removed from history
  sentence?: Sentence;
  storyTitle?: string;
}

export interface SRSCard extends PersistedSRSCard {
  storyTitle: string;
  sentence: Sentence;
}

export interface SRSStats {
  totalCards: number;
  dueToday: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  masteredCards: number;
  reviewedTodayCount: number;
}
