import {
  AdvancedSettingKey,
  CEFRLevel,
  NoveltyDensity,
  SRSBackType,
  StorySize,
  UserProfile,
} from '../types';

export interface OptimizedAdvancedSettings {
  level: CEFRLevel;
  noveltyDensity: NoveltyDensity;
  strictNewWords: boolean;
  dailyNewCardsLimit: number;
  srsBackType: SRSBackType;
  srsDesiredRetention: number;
  srsAutoPlayAudio: boolean;
}

/**
 * Estimates CEFR proficiency level from the learner's known vocabulary count.
 */
export function calculateLevelFromVocab(count: number): CEFRLevel {
  if (count < 600) return 'Pre-A1';
  if (count < 1500) return 'A1';
  if (count < 3000) return 'A2';
  if (count < 6000) return 'B1';
  if (count < 12000) return 'B2';
  if (count < 20000) return 'C1';
  return 'C2';
}

/**
 * Computes optimal advanced settings from the user's basic settings and progress
 * (known vocabulary size, story size, and daily study goal).
 */
export function computeOptimalAdvancedSettings(
  profile: Pick<UserProfile, 'knownWords' | 'storySize' | 'dailyGoal'>
): OptimizedAdvancedSettings {
  const vocabCount = Array.isArray(profile.knownWords) ? profile.knownWords.length : 0;
  const level = calculateLevelFromVocab(vocabCount);
  const storySize: StorySize = profile.storySize || 'standard';
  const dailyGoal = Math.max(1, profile.dailyGoal ?? 2);

  // Novelty density (i+1): balance fast vocabulary acquisition with comprehensible input flow
  let noveltyDensity: NoveltyDensity = 'high';
  if (level === 'B2' || level === 'C1' || level === 'C2') {
    noveltyDensity = storySize === 'long' ? 'low' : 'normal';
  } else if (level === 'Pre-A1' || level === 'A1') {
    noveltyDensity = storySize === 'medium' || storySize === 'long' ? 'normal' : 'high';
  } else if (storySize === 'long') {
    // A2 / B1 on long stories: slightly gentler density prevents fatigue
    noveltyDensity = 'normal';
  }

  // Strict root & stem filter prevents duplicate inflections/derivations as "new words"
  const strictNewWords = true;

  // Daily new SRS cards limit scaled to daily lessons & story length to avoid review burnout
  let dailyNewCardsLimit = 20;
  if (dailyGoal <= 1 && (storySize === 'short' || storySize === 'standard')) {
    dailyNewCardsLimit = 10;
  } else if (dailyGoal >= 3 || storySize === 'long') {
    dailyNewCardsLimit = 30;
  }

  // SRS card back adapts from native translation -> focused element -> full target immersion
  let srsBackType: SRSBackType = 'full_translation';
  if (level === 'A2' || level === 'B1') {
    srsBackType = 'element_translation';
  } else if (level === 'B2' || level === 'C1' || level === 'C2') {
    srsBackType = 'target_definition';
  }

  // FSRS target retention: 0.90 is optimal for most learners; 0.85 reduces load for heavy study paces
  const srsDesiredRetention =
    dailyGoal >= 4 || (dailyGoal >= 3 && storySize === 'long') ? 0.85 : 0.9;

  // Automatic browser TTS reinforces listening & pronunciation during flashcards
  const srsAutoPlayAudio = true;

  return {
    level,
    noveltyDensity,
    strictNewWords,
    dailyNewCardsLimit,
    srsBackType,
    srsDesiredRetention,
    srsAutoPlayAudio,
  };
}

/**
 * For legacy profiles saved before `manualAdvancedOverrides` existed, preserve any
 * advanced setting that explicitly differed from the previous app defaults.
 */
export function inferLegacyOverrides(rawProfile: Partial<UserProfile>): AdvancedSettingKey[] {
  const overrides: AdvancedSettingKey[] = [];

  if (
    rawProfile.level &&
    Array.isArray(rawProfile.knownWords) &&
    rawProfile.level !== calculateLevelFromVocab(rawProfile.knownWords.length)
  ) {
    overrides.push('level');
  }
  if (rawProfile.noveltyDensity && rawProfile.noveltyDensity !== 'high') {
    overrides.push('noveltyDensity');
  }
  if (rawProfile.strictNewWords === false) {
    overrides.push('strictNewWords');
  }
  if (typeof rawProfile.dailyNewCardsLimit === 'number' && rawProfile.dailyNewCardsLimit !== 0) {
    overrides.push('dailyNewCardsLimit');
  }
  if (rawProfile.srsBackType && rawProfile.srsBackType !== 'full_translation') {
    overrides.push('srsBackType');
  }
  if (
    typeof rawProfile.srsDesiredRetention === 'number' &&
    Math.abs(rawProfile.srsDesiredRetention - 0.9) >= 0.005
  ) {
    overrides.push('srsDesiredRetention');
  }
  if (rawProfile.srsAutoPlayAudio === false) {
    overrides.push('srsAutoPlayAudio');
  }

  return overrides;
}

/**
 * Applies system-optimized values to every advanced setting that has not been
 * manually overridden by the user.
 */
export function applyOptimizedAdvancedSettings(profile: UserProfile): UserProfile {
  const overrides = new Set<AdvancedSettingKey>(profile.manualAdvancedOverrides ?? []);
  const optimal = computeOptimalAdvancedSettings(profile);

  return {
    ...profile,
    level: overrides.has('level') ? profile.level : optimal.level,
    noveltyDensity: overrides.has('noveltyDensity') ? profile.noveltyDensity : optimal.noveltyDensity,
    strictNewWords: overrides.has('strictNewWords') ? profile.strictNewWords : optimal.strictNewWords,
    dailyNewCardsLimit: overrides.has('dailyNewCardsLimit')
      ? profile.dailyNewCardsLimit
      : optimal.dailyNewCardsLimit,
    srsBackType: overrides.has('srsBackType') ? profile.srsBackType : optimal.srsBackType,
    srsDesiredRetention: overrides.has('srsDesiredRetention')
      ? profile.srsDesiredRetention
      : optimal.srsDesiredRetention,
    srsAutoPlayAudio: overrides.has('srsAutoPlayAudio')
      ? profile.srsAutoPlayAudio
      : optimal.srsAutoPlayAudio,
  };
}

/**
 * Adds an advanced setting key to the manual overrides list without duplicates.
 */
export function markAdvancedOverride(
  existing: AdvancedSettingKey[] | undefined,
  key: AdvancedSettingKey
): AdvancedSettingKey[] {
  const current = existing ?? [];
  return current.includes(key) ? current : [...current, key];
}
