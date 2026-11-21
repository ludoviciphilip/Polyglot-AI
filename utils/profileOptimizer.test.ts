import { describe, it, expect } from 'vitest';
import {
  applyOptimizedAdvancedSettings,
  calculateLevelFromVocab,
  computeOptimalAdvancedSettings,
  inferLegacyOverrides,
  markAdvancedOverride,
} from './profileOptimizer';
import { UserProfile } from '../types';

const makeWords = (count: number) => Array.from({ length: count }, (_, i) => `word${i}`);

const baseProfile: UserProfile = {
  name: 'Alice',
  targetLanguage: 'English',
  nativeLanguage: 'Portuguese',
  level: 'Pre-A1',
  knownWords: makeWords(50),
  uiLanguage: 'pt',
  darkMode: false,
  notificationTime: '09:00',
  notificationsEnabled: false,
  storySize: 'standard',
  dailyGoal: 2,
  srsBackType: 'full_translation',
  srsDailyGoal: 20,
  srsAutoPlayAudio: true,
  srsDesiredRetention: 0.9,
  noveltyDensity: 'high',
  strictNewWords: true,
};

describe('profileOptimizer', () => {
  it('maps vocabulary counts to expected CEFR levels', () => {
    expect(calculateLevelFromVocab(100)).toBe('Pre-A1');
    expect(calculateLevelFromVocab(600)).toBe('A1');
    expect(calculateLevelFromVocab(1500)).toBe('A2');
    expect(calculateLevelFromVocab(3000)).toBe('B1');
    expect(calculateLevelFromVocab(6000)).toBe('B2');
    expect(calculateLevelFromVocab(12000)).toBe('C1');
    expect(calculateLevelFromVocab(20000)).toBe('C2');
  });

  it('computes beginner-friendly defaults for Pre-A1 casual learners', () => {
    const optimal = computeOptimalAdvancedSettings({
      knownWords: makeWords(100),
      storySize: 'standard',
      dailyGoal: 1,
    });
    expect(optimal).toEqual({
      level: 'Pre-A1',
      noveltyDensity: 'high',
      strictNewWords: true,
      dailyNewCardsLimit: 10,
      srsBackType: 'full_translation',
      srsDesiredRetention: 0.9,
      srsAutoPlayAudio: true,
    });
  });

  it('adapts card back, density, retention and daily limit for advanced heavy learners', () => {
    const optimal = computeOptimalAdvancedSettings({
      knownWords: makeWords(7000),
      storySize: 'long',
      dailyGoal: 4,
    });
    expect(optimal).toEqual({
      level: 'B2',
      noveltyDensity: 'low',
      strictNewWords: true,
      dailyNewCardsLimit: 30,
      srsBackType: 'target_definition',
      srsDesiredRetention: 0.85,
      srsAutoPlayAudio: true,
    });
  });

  it('preserves manually overridden settings while optimizing non-overridden ones', () => {
    const profile: UserProfile = {
      ...baseProfile,
      knownWords: makeWords(2000), // A2 -> optimal srsBackType is element_translation
      dailyGoal: 1, // optimal dailyNewCardsLimit is 10
      srsBackType: 'target_definition',
      srsDesiredRetention: 0.95,
      manualAdvancedOverrides: ['srsBackType', 'srsDesiredRetention'],
    };

    const result = applyOptimizedAdvancedSettings(profile);
    expect(result.level).toBe('A2');
    expect(result.dailyNewCardsLimit).toBe(10);
    // Manual overrides remain intact
    expect(result.srsBackType).toBe('target_definition');
    expect(result.srsDesiredRetention).toBe(0.95);
  });

  it('infers legacy overrides only for fields differing from historical defaults', () => {
    expect(inferLegacyOverrides(baseProfile)).toEqual([]);

    const customizedLegacy: Partial<UserProfile> = {
      ...baseProfile,
      noveltyDensity: 'low',
      strictNewWords: false,
      srsAutoPlayAudio: false,
      srsDesiredRetention: 0.95,
    };
    const inferred = inferLegacyOverrides(customizedLegacy);
    expect(inferred).toContain('noveltyDensity');
    expect(inferred).toContain('strictNewWords');
    expect(inferred).toContain('srsAutoPlayAudio');
    expect(inferred).toContain('srsDesiredRetention');
    expect(inferred).not.toContain('srsBackType');
  });

  it('adds manual override keys without duplicates', () => {
    const step1 = markAdvancedOverride(undefined, 'noveltyDensity');
    const step2 = markAdvancedOverride(step1, 'noveltyDensity');
    const step3 = markAdvancedOverride(step2, 'srsBackType');
    expect(step3).toEqual(['noveltyDensity', 'srsBackType']);
  });
});
