
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserProfile, HistoryItem, CEFRLevel, StoryResponse, UILanguage, StorySize, SRSCard, PersistedSRSCard, SRSBackType, SRSReviewLogEntry } from './types';
import { generateStory, generateReviewStory, normalizeStoryResponse, annotateStory } from './services/geminiService';
import Dashboard from './components/Dashboard';
import StudyArea from './components/StudyArea';
import History from './components/History';
import Settings from './components/Settings';
import { SRSReviewArea } from './components/SRSReviewArea';
import { VocabularyModal } from './components/VocabularyModal';
import { ApiKeyPromptModal } from './components/ApiKeyPromptModal';
import { ApiKeyTutorialModal } from './components/ApiKeyTutorialModal';
import { JsonBackupTutorialModal } from './components/JsonBackupTutorialModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { calculateStreak } from './utils/streak';
import { computeSRSStats, resolveAllCards, toPersistedCard, compactAndFilterPersistedCards, getWeakWords, MAX_REVIEW_LOG_ENTRIES } from './utils/srs';
import translations from './locales';
import { getNativeLanguageFromUI, resolveNativeLanguage } from './utils/starterVocab';
import { BookOpen, LayoutDashboard, History as HistoryIcon, Settings as SettingsIcon, Download, Upload, Sun, Moon, RefreshCw, Flame, Key, FileJson, HelpCircle, Layers, Menu, X } from 'lucide-react';

const STORAGE_KEY = 'polyglot_i1_data_v3';
const SRS_STORAGE_KEY = 'polyglot_srs_cards_v1';
const SRS_LOG_STORAGE_KEY = 'polyglot_srs_review_log_v1';

const DEFAULT_PROFILE: UserProfile = {
  name: 'User',
  targetLanguage: 'English',
  nativeLanguage: 'Portuguese',
  level: 'Pre-A1',
  knownWords: ['hello', 'world', 'the', 'is', 'a', 'to', 'in', 'and'],
  uiLanguage: 'pt',
  darkMode: false,
  notificationTime: '09:00',
  notificationsEnabled: false,
  storySize: 'standard',
  ancientGreekDialect: 'attic',
  ancientGreekFocus: 'general',
  shakespeareanFocus: 'general',
  dailyGoal: 2,
  srsBackType: 'full_translation',
  srsDailyGoal: 20,
  srsAutoPlayAudio: true,
  noveltyDensity: 'high',
  strictNewWords: true
};

const calculateLevelFromVocab = (count: number): CEFRLevel => {
  if (count < 600) return 'Pre-A1';
  if (count < 1500) return 'A1';
  if (count < 3000) return 'A2';
  if (count < 6000) return 'B1';
  if (count < 12000) return 'B2';
  if (count < 20000) return 'C1';
  return 'C2';
};

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [persistedSrsCards, setPersistedSrsCards] = useState<PersistedSRSCard[]>([]);
  const [srsReviewLogs, setSrsReviewLogs] = useState<SRSReviewLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'study' | 'srs' | 'history' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [currentStory, setCurrentStory] = useState<StoryResponse | null>(null);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [isApiKeyPromptOpen, setIsApiKeyPromptOpen] = useState(false);
  const [apiKeyPromptAction, setApiKeyPromptAction] = useState<'story' | 'review'>('story');
  const [isGlobalApiKeyTutorialOpen, setIsGlobalApiKeyTutorialOpen] = useState(false);
  const [isGlobalJsonTutorialOpen, setIsGlobalJsonTutorialOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sidebarFileInputRef = useRef<HTMLInputElement>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });
  const [hasShownQuotaWarning, setHasShownQuotaWarning] = useState(false);

  // Native language is derived from the user's configured interface language
  const effectiveNativeLanguage = useMemo(() => {
    return getNativeLanguageFromUI(profile.uiLanguage);
  }, [profile.uiLanguage]);

  const handleCompleteOnboarding = (data: {
    name: string;
    nativeLanguage: string;
    uiLanguage: UILanguage;
    targetLanguage: string;
    knownWords: string[];
  }) => {
    const newProfile: UserProfile = {
      ...DEFAULT_PROFILE,
      name: data.name,
      nativeLanguage: data.nativeLanguage,
      uiLanguage: data.uiLanguage,
      targetLanguage: data.targetLanguage,
      storySize: 'standard',
      knownWords: data.knownWords,
      level: calculateLevelFromVocab(data.knownWords.length)
    };
    setProfile(newProfile);
    setIsOnboardingOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: newProfile, history: [] }));
    } catch (err) {
      console.error("Failed to save initial onboarding profile", err);
    }
  };

  // Dynamically resolve full SRS cards in memory:
  // Combines non-initial persisted cards and virtual "new" cards derived from history (oldest to newest)
  const srsCards = useMemo(() => {
    return resolveAllCards(
      persistedSrsCards,
      history,
      profile.targetLanguage,
      effectiveNativeLanguage
    );
  }, [persistedSrsCards, history, profile.targetLanguage, effectiveNativeLanguage]);

  const t = useMemo(() => translations[profile.uiLanguage || 'en'] as any, [profile.uiLanguage]);
  const streakInfo = useMemo(() => calculateStreak(history), [history]);
  const srsStats = useMemo(() => computeSRSStats(srsCards, profile.targetLanguage, profile.dailyNewCardsLimit ?? 0), [srsCards, profile.targetLanguage, profile.dailyNewCardsLimit]);
  const weakWords = useMemo(() => {
    return getWeakWords(srsCards, profile.targetLanguage, srsReviewLogs);
  }, [srsCards, profile.targetLanguage, srsReviewLogs]);

  useEffect(() => {
    let initialHistory: HistoryItem[] = [];
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const { profile: savedProfile, history: savedHistory } = JSON.parse(savedData);
        if (savedProfile) setProfile({ ...DEFAULT_PROFILE, ...savedProfile });
        if (savedHistory && Array.isArray(savedHistory)) {
          const seen = new Set<string>();
          const dedupedHistory = savedHistory.filter(item => {
            if (!item) return false;
            const key = item.timestamp 
              ? `${item.timestamp}_${item.story_title}` 
              : `${item.story_title}_${item.sentences?.[0]?.original || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          initialHistory = dedupedHistory;
          setHistory(dedupedHistory);
        }
      } catch (e) {
        console.error("Failed to parse stored data", e);
      }
    }

    const savedSrs = localStorage.getItem(SRS_STORAGE_KEY);
    if (savedSrs) {
      try {
        const parsed = JSON.parse(savedSrs);
        if (Array.isArray(parsed)) {
          // Backward compatibility: automatically migrate legacy format to compact on startup
          const migrated = compactAndFilterPersistedCards(parsed, initialHistory);
          setPersistedSrsCards(migrated);
        }
      } catch (e) {
        console.error("Failed to parse stored SRS cards", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!profile.notificationsEnabled) return;

    const checkNotification = () => {
      const now = new Date();
      const currentStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentStr === profile.notificationTime) {
        if (Notification.permission === 'granted') {
          new Notification(t.notificationTitle, { body: t.notificationBody });
        }
      }
    };

    const interval = setInterval(checkNotification, 60000);
    return () => clearInterval(interval);
  }, [profile.notificationsEnabled, profile.notificationTime, t]);

  useEffect(() => {
    if (profile.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile.darkMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, history }));
  }, [profile, history]);

  // Persist compact non-initial cards to localStorage without indentation
  useEffect(() => {
    const compactList = compactAndFilterPersistedCards(persistedSrsCards, history);
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(compactList));
  }, [persistedSrsCards, history]);

  useEffect(() => {
    try {
      localStorage.setItem(SRS_LOG_STORAGE_KEY, JSON.stringify(srsReviewLogs.slice(-MAX_REVIEW_LOG_ENTRIES)));
    } catch (e) {
      console.error("Failed to persist SRS review logs, attempting to trim to 4000", e);
      try {
        const trimmed = srsReviewLogs.slice(-4000);
        localStorage.setItem(SRS_LOG_STORAGE_KEY, JSON.stringify(trimmed));
        setSrsReviewLogs(trimmed);
      } catch (innerErr) {
        console.error("Failed to persist trimmed SRS review logs", innerErr);
      }
      if (!hasShownQuotaWarning) {
        setHasShownQuotaWarning(true);
        alert(t.storageQuotaNotice || "O espaço de armazenamento do navegador está cheio. O log de revisões foi reduzido às entradas recentes. Recomendamos exportar um backup para proteger seu progresso.");
      }
    }
  }, [srsReviewLogs, hasShownQuotaWarning, t]);

  const handleLogReview = (entry: SRSReviewLogEntry) => {
    setSrsReviewLogs(prev => {
      const next = [...prev, entry];
      return next.length > MAX_REVIEW_LOG_ENTRIES ? next.slice(-MAX_REVIEW_LOG_ENTRIES) : next;
    });
  };

  const handleUpdateSrsCard = (updatedCard: SRSCard) => {
    const compactCard = toPersistedCard(updatedCard, history);
    setPersistedSrsCards(prev => {
      const idx = prev.findIndex(c => c.id === compactCard.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = compactCard;
        return next;
      }
      return [...prev, compactCard];
    });
  };

  const handleUpdateSrsCardsBatch = (updatedCards: SRSCard[]) => {
    const compactBatch = updatedCards.map(c => toPersistedCard(c, history));
    const batchMap = new Map(compactBatch.map(c => [c.id, c]));
    setPersistedSrsCards(prev => {
      const remaining = prev.filter(c => !batchMap.has(c.id));
      return [...remaining, ...compactBatch];
    });
  };

  const handleGenerateStory = async () => {
    const hasKey = Boolean(profile.apiKey && profile.apiKey.trim().length > 0);
    if (!hasKey) {
      setApiKeyPromptAction('story');
      setIsApiKeyPromptOpen(true);
      return;
    }
    setLoading(true);
    try {
      const story = await generateStory(
        profile.targetLanguage,
        effectiveNativeLanguage,
        profile.level,
        profile.knownWords,
        profile.storySize || 'standard',
        profile.ancientGreekDialect,
        profile.ancientGreekFocus,
        profile.shakespeareanFocus,
        profile.apiKey,
        weakWords,
        profile.noveltyDensity || 'high',
        profile.strictNewWords !== false
      );
      setCurrentStory(story);
      setActiveTab('study');
    } catch (error: any) {
      console.error("Error generating story:", error);
      const msg = error?.message || "Error generating story.";
      if (msg.includes("NO_API_KEY") || msg.includes("API key not configured")) {
        setApiKeyPromptAction('story');
        setIsApiKeyPromptOpen(true);
      } else {
        alert(`${t.errorGeneratingStory || "Error generating lesson:"} ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReview = async () => {
    const hasKey = Boolean(profile.apiKey && profile.apiKey.trim().length > 0);
    if (!hasKey) {
      setApiKeyPromptAction('review');
      setIsApiKeyPromptOpen(true);
      return;
    }
    if (profile.knownWords.length < 20) {
      alert(t.needMoreWordsForReview || "You need at least 20 known words for a high-quality review session.");
      return;
    }
    setLoading(true);
    try {
      const story = await generateReviewStory(
        profile.targetLanguage,
        effectiveNativeLanguage,
        profile.knownWords,
        profile.ancientGreekDialect,
        profile.ancientGreekFocus,
        profile.shakespeareanFocus,
        profile.apiKey,
        weakWords
      );
      setCurrentStory(story);
      setActiveTab('study');
    } catch (error: any) {
      console.error("Error generating review story:", error);
      const msg = error?.message || "Error generating review story.";
      if (msg.includes("NO_API_KEY") || msg.includes("API key not configured")) {
        setApiKeyPromptAction('review');
        setIsApiKeyPromptOpen(true);
      } else {
        alert(`${t.errorGeneratingReview || "Error generating review lesson:"} ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeyAndProceed = async (newKey: string) => {
    const trimmed = newKey.trim();
    const updatedProfile = { ...profile, apiKey: trimmed };
    setProfile(updatedProfile);
    setIsApiKeyPromptOpen(false);

    setLoading(true);
    try {
      if (apiKeyPromptAction === 'review') {
        if (updatedProfile.knownWords.length < 20) {
          alert(t.needMoreWordsForReview || "You need at least 20 known words for a high-quality review session.");
          return;
        }
        const story = await generateReviewStory(
          updatedProfile.targetLanguage,
          effectiveNativeLanguage,
          updatedProfile.knownWords,
          updatedProfile.ancientGreekDialect,
          updatedProfile.ancientGreekFocus,
          updatedProfile.shakespeareanFocus,
          trimmed,
          weakWords
        );
        setCurrentStory(story);
        setActiveTab('study');
      } else {
        const story = await generateStory(
          updatedProfile.targetLanguage,
          effectiveNativeLanguage,
          updatedProfile.level,
          updatedProfile.knownWords,
          updatedProfile.storySize || 'standard',
          updatedProfile.ancientGreekDialect,
          updatedProfile.ancientGreekFocus,
          updatedProfile.shakespeareanFocus,
          trimmed,
          weakWords,
          updatedProfile.noveltyDensity || 'high',
          updatedProfile.strictNewWords !== false
        );
        setCurrentStory(story);
        setActiveTab('study');
      }
    } catch (error: any) {
      console.error("Error generating after configuring key:", error);
      const msg = error?.message || "Error generating story.";
      alert(`${t.errorGeneratingStory || "Error generating lesson:"} ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLesson = (story: StoryResponse) => {
    // If this story was reopened from history, simply close it and return to history without duplicating vocabulary or stats
    if (story.isReopened) {
      setCurrentStory(null);
      setActiveTab('history');
      return;
    }

    // Safety check: if this exact story is already in history, do not duplicate
    const isAlreadyInHistory = history.some(h => 
      (story.historyTimestamp && h.timestamp === story.historyTimestamp) ||
      (h.story_title === story.story_title && h.sentences?.length === story.sentences?.length && h.sentences?.[0]?.original === story.sentences?.[0]?.original)
    );
    if (isAlreadyInHistory) {
      setCurrentStory(null);
      setActiveTab('history');
      return;
    }

    const isReview = !!story.is_review;
    const newWords = Array.isArray(story.new_words_to_add) ? story.new_words_to_add : [];
    const updatedKnownWords = Array.from(new Set([...profile.knownWords, ...newWords]));
    const newLevel = calculateLevelFromVocab(updatedKnownWords.length);
    const levelChanged = newLevel !== profile.level;
    
    const now = Date.now();
    const newHistoryItem: HistoryItem = {
      ...story,
      targetLanguage: (story as any).targetLanguage || profile.targetLanguage,
      completedAt: now,
      timestamp: now,
      completed: true
    };
    
    const updatedHistory = [newHistoryItem, ...history];
    const newStreakInfo = calculateStreak(updatedHistory);
    
    setProfile(prev => ({ 
      ...prev, 
      knownWords: updatedKnownWords,
      level: newLevel,
      streakCount: newStreakInfo.streak,
      lastCompletedDate: newStreakInfo.lastCompletedDate || undefined
    }));
    
    setHistory(updatedHistory);
    setCurrentStory(null);
    setActiveTab('dashboard');
    
    if (isReview) {
      alert(t.reviewCongrats);
    } else {
      alert(levelChanged ? `${t.congrats} ${t.levelUp} ${newLevel}!` : t.congrats);
    }
  };

  const handleReopenStory = (story: StoryResponse) => {
    const isRev = !!story.is_review;
    const normalized = normalizeStoryResponse(story, isRev);
    const histTimestamp = (story as HistoryItem).timestamp;
    setCurrentStory({
      ...normalized,
      isReopened: true,
      historyTimestamp: histTimestamp || undefined
    });
    setActiveTab('study');
  };

  const handleReannotateStory = async () => {
    if (!currentStory || !profile.apiKey) return;
    try {
      const effectiveNativeLanguage = profile.nativeLanguage || getNativeLanguageFromUI(profile.uiLanguage);
      const { story: annotatedStory } = await annotateStory(
        profile.apiKey,
        currentStory,
        profile.targetLanguage,
        effectiveNativeLanguage,
        profile.ancientGreekDialect,
        profile.ancientGreekFocus,
        profile.shakespeareanFocus
      );
      setCurrentStory(annotatedStory);
      if ((currentStory as any).completedAt || (currentStory as any).timestamp) {
        setHistory(prev =>
          prev.map(item =>
            (item.timestamp && item.timestamp === (currentStory as any).timestamp) ||
            item.story_title === currentStory.story_title
              ? { ...item, ...annotatedStory }
              : item
          )
        );
      }
    } catch (err) {
      console.error("Re-annotation failed:", err);
    }
  };

  const handleExport = () => {
    const compactCards = compactAndFilterPersistedCards(persistedSrsCards, history);
    const data = JSON.stringify({
      profile,
      history,
      srsCards: compactCards,
      srsReviewLogs: srsReviewLogs.slice(-MAX_REVIEW_LOG_ENTRIES)
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polyglot_progress_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const data = JSON.parse(raw);
        
        // Support both { profile: {...}, history: [...] } and top-level profile objects
        const rawProfile = data.profile || (data.knownWords || data.targetLanguage ? data : null);
        
        if (rawProfile) {
          let rawWords = rawProfile.knownWords;
          let cleanWords: string[] = [];
          if (typeof rawWords === 'string') {
            cleanWords = rawWords.split(/[,\n\r]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
          } else if (Array.isArray(rawWords)) {
            cleanWords = rawWords.map((w: any) => {
              if (typeof w === 'string') return w.trim().toLowerCase();
              if (w && typeof w === 'object') return String(w.word || w.term || w.original || '').trim().toLowerCase();
              return String(w || '').trim().toLowerCase();
            }).filter((w: string) => w.length > 0 && w !== '[object object]');
          }
          cleanWords = Array.from(new Set(cleanWords));
          if (cleanWords.length === 0) {
            cleanWords = DEFAULT_PROFILE.knownWords;
          }

          const calculatedLevel = calculateLevelFromVocab(cleanWords.length);
          const finalLevel = rawProfile.level || calculatedLevel;

          setProfile(prev => ({
            ...DEFAULT_PROFILE,
            ...prev,
            ...rawProfile,
            apiKey: prev.apiKey || rawProfile.apiKey || '',
            knownWords: cleanWords,
            level: finalLevel
          }));
        }

        const effectiveHistory = Array.isArray(data.history) ? data.history : history;
        if (Array.isArray(data.history)) {
          setHistory(data.history);
        }

        if (Array.isArray(data.srsCards)) {
          const migratedCards = compactAndFilterPersistedCards(data.srsCards, effectiveHistory);
          setPersistedSrsCards(migratedCards);
        }

        if (Array.isArray(data.srsReviewLogs)) {
          setSrsReviewLogs(data.srsReviewLogs.slice(-MAX_REVIEW_LOG_ENTRIES));
        }

        setIsOnboardingOpen(false);
        alert(t.importSuccess);
      } catch (err) {
        console.error("Import error:", err);
        alert(t.invalidFile);
      } finally {
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const navigateToTab = (tab: 'dashboard' | 'study' | 'srs' | 'history' | 'settings') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <nav className="w-full md:w-64 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 md:p-6 flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 transition-all">
        {/* Top Header Bar: Logo, App Name, Streak, Theme Toggle & Mobile Hamburger */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-500 p-2 rounded-lg"><BookOpen size={24} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Polyglot AI</h1>
              {streakInfo.streak > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Flame size={12} className="fill-amber-500 text-amber-500" />
                  <span>{streakInfo.streak} {streakInfo.streak === 1 ? (t.day || 'day') : (t.days || 'days')} {t.streak ? t.streak.toLowerCase() : 'streak'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={() => setProfile(p => ({...p, darkMode: !p.darkMode}))} 
              aria-label="Alternar tema escuro/claro"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {profile.darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              aria-label="Abrir ou fechar menu"
              aria-expanded={isMobileMenuOpen}
              className="md:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer relative"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              {srsStats.dueToday > 0 && !isMobileMenuOpen && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Items (Always visible on desktop md:flex, collapsible on mobile) */}
        <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col gap-2 flex-grow mt-5 md:mt-8 animate-in fade-in slide-in-from-top-2 duration-150`}>
          <button 
            type="button"
            onClick={() => navigateToTab('dashboard')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} /> {t.dashboard}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('study')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'study' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <BookOpen size={20} /> {t.studyArea}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('srs')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'srs' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Layers size={20} />
            <span className="flex-1 text-left">{t.srsReview || "Revisão Anki"}</span>
            {srsStats.dueToday > 0 && (
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${activeTab === 'srs' ? 'bg-white text-indigo-700' : 'bg-amber-500 text-white'}`}>
                {srsStats.dueToday}
              </span>
            )}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('history')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <HistoryIcon size={20} /> {t.history}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('settings')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <SettingsIcon size={20} /> {t.settings}
          </button>

          {/* Quick Save & Load Data Buttons (Alias for Settings Export/Import) */}
          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-2 flex items-center justify-between">
              <span>{t.backupSystem || "Backup Local (JSON)"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleExport();
                  setIsMobileMenuOpen(false);
                }}
                title={t.exportBackupTitle || "Salvar / Exportar dados em arquivo JSON"}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 group"
              >
                <Download size={15} className="text-indigo-600 dark:text-indigo-400 group-hover:translate-y-0.5 transition-transform" />
                <span>{t.saveAction || "Salvar"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sidebarFileInputRef.current?.click();
                  setIsMobileMenuOpen(false);
                }}
                title={t.importBackupTitle || "Carregar / Importar dados de arquivo JSON"}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 group"
              >
                <Upload size={15} className="text-emerald-600 dark:text-emerald-400 group-hover:-translate-y-0.5 transition-transform" />
                <span>{t.loadAction || "Carregar"}</span>
              </button>
            </div>
          </div>

          {/* Hidden File Input for Sidebar Carregar / Import */}
          <input
            type="file"
            ref={sidebarFileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />

          {/* Quick Tutorial Links in Navigation */}
          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsGlobalApiKeyTutorialOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer text-left"
            >
              <Key size={15} className="shrink-0 text-amber-500" />
              <span className="truncate">{t.howToGetFreeKey || "Chave API Gratuita"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsGlobalJsonTutorialOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer text-left"
            >
              <FileJson size={15} className="shrink-0 text-emerald-500" />
              <span className="truncate">{t.backupRestoreGuideBtn || "Salvar & Restaurar"}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow p-4 md:p-10 overflow-y-auto max-h-screen">
        {activeTab === 'dashboard' && (
          <Dashboard 
            profile={profile} 
            onGenerate={handleGenerateStory} 
            onReview={handleGenerateReview}
            loading={loading} 
            historyCount={history.length}
            t={t}
            history={history}
            onOpenVocabModal={() => setIsVocabModalOpen(true)}
            srsDueCount={srsStats.dueToday}
            onNavigateToSRS={() => setActiveTab('srs')}
          />
        )}
        {activeTab === 'study' && (
          <ErrorBoundary onReset={() => setActiveTab('dashboard')}>
            <StudyArea 
              story={currentStory} 
              loading={loading}
              onGenerate={handleGenerateStory}
              onComplete={handleCompleteLesson}
              onReannotate={handleReannotateStory}
              targetLanguage={profile.targetLanguage}
              t={t}
              apiKey={profile.apiKey}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'srs' && (
          <SRSReviewArea
            cards={srsCards}
            onUpdateCard={handleUpdateSrsCard}
            onUpdateCardsBatch={handleUpdateSrsCardsBatch}
            targetLanguage={profile.targetLanguage}
            nativeLanguage={effectiveNativeLanguage}
            srsBackType={profile.srsBackType || 'full_translation'}
            onChangeBackType={(newType) => setProfile(prev => ({ ...prev, srsBackType: newType }))}
            dailyNewCardsLimit={profile.dailyNewCardsLimit ?? 0}
            reviewLogs={srsReviewLogs}
            onLogReview={handleLogReview}
            autoPlayAudio={profile.srsAutoPlayAudio ?? true}
            onToggleAutoPlayAudio={(enabled) => setProfile(prev => ({ ...prev, srsAutoPlayAudio: enabled }))}
            apiKey={profile.apiKey}
            onNavigateToStudy={() => {
              setActiveTab('study');
              handleGenerateStory();
            }}
            t={t}
          />
        )}
        {activeTab === 'history' && <History history={history} onReopen={handleReopenStory} targetLanguage={profile.targetLanguage} t={t} />}
        {activeTab === 'settings' && (
          <Settings 
            profile={profile} 
            setProfile={setProfile} 
            onExport={handleExport}
            onImport={handleImport}
            t={t}
          />
        )}
      </main>

      {/* Dedicated Learned Vocabulary Explorer Modal */}
      <VocabularyModal
        isOpen={isVocabModalOpen}
        onClose={() => setIsVocabModalOpen(false)}
        words={profile.knownWords}
        onChangeWords={(newWords) => {
          const newLevel = calculateLevelFromVocab(newWords.length);
          setProfile(prev => ({ ...prev, knownWords: newWords, level: newLevel }));
        }}
        targetLanguage={profile.targetLanguage}
        t={t}
      />

      {/* Friendly API Key Required Prompt Modal */}
      <ApiKeyPromptModal
        isOpen={isApiKeyPromptOpen}
        onClose={() => setIsApiKeyPromptOpen(false)}
        onGoToSettings={() => {
          setIsApiKeyPromptOpen(false);
          setActiveTab('settings');
        }}
        onOpenTutorial={() => {
          setIsApiKeyPromptOpen(false);
          setIsGlobalApiKeyTutorialOpen(true);
        }}
        onSaveKeyAndProceed={handleSaveKeyAndProceed}
        actionType={apiKeyPromptAction}
        t={t}
      />

      {/* Global API Key Tutorial Modal */}
      <ApiKeyTutorialModal
        isOpen={isGlobalApiKeyTutorialOpen}
        onClose={() => setIsGlobalApiKeyTutorialOpen(false)}
        currentApiKey={profile.apiKey}
        onSaveKey={(newKey) => {
          setProfile(prev => ({ ...prev, apiKey: newKey }));
        }}
        t={t}
      />

      {/* Global JSON Backup & Restore Tutorial Modal */}
      <JsonBackupTutorialModal
        isOpen={isGlobalJsonTutorialOpen}
        onClose={() => setIsGlobalJsonTutorialOpen(false)}
        onExport={handleExport}
        onTriggerImport={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => handleImport(e as any);
          input.click();
        }}
        t={t}
      />

      {/* Friendly First-Launch Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={handleCompleteOnboarding}
      />
    </div>
  );
};

export default App;
