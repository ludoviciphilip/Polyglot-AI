import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Layers, 
  Volume2, 
  VolumeX,
  Loader2,
  RotateCw, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  Settings2, 
  BookOpen, 
  Flame, 
  HelpCircle, 
  ArrowRight, 
  Calendar, 
  BrainCircuit, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Filter, 
  Play, 
  Award,
  Clock,
  X
} from 'lucide-react';
import { SRSCard, SRSCardRating, SRSBackType, Sentence, SRSReviewLogEntry } from '../types';
import { 
  calculateNextInterval, 
  getCardButtonIntervals, 
  getDueCards, 
  computeSRSStats, 
  estimateRetentionRate,
  formatIntervalLabel 
} from '../utils/srs';
import { stopAllAudio, speakWithBrowser, playNaturalAudio } from '../utils/audio';
import { SRSRetentionChart } from './SRSRetentionChart';

interface SRSReviewAreaProps {
  cards: SRSCard[];
  onUpdateCard: (updatedCard: SRSCard) => void;
  onUpdateCardsBatch: (updatedCards: SRSCard[]) => void;
  targetLanguage: string;
  nativeLanguage: string;
  srsBackType: SRSBackType;
  onChangeBackType: (type: SRSBackType) => void;
  onNavigateToStudy: () => void;
  dailyNewCardsLimit?: number;
  reviewLogs?: SRSReviewLogEntry[];
  onLogReview?: (entry: SRSReviewLogEntry) => void;
  autoPlayAudio?: boolean;
  onToggleAutoPlayAudio?: (enabled: boolean) => void;
  desiredRetention?: number;
  apiKey?: string;
  t: any;
}

const speakText = (text: string, lang: string) => speakWithBrowser(text, lang, 0.95);

export const SRSReviewArea: React.FC<SRSReviewAreaProps> = ({
  cards,
  onUpdateCard,
  onUpdateCardsBatch,
  targetLanguage,
  nativeLanguage,
  srsBackType,
  onChangeBackType,
  onNavigateToStudy,
  dailyNewCardsLimit = 0,
  reviewLogs,
  onLogReview,
  autoPlayAudio,
  onToggleAutoPlayAudio,
  desiredRetention = 0.9,
  apiKey,
  t
}) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<SRSCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showPhonetic, setShowPhonetic] = useState(false);
  const [selectedStoryFilter, setSelectedStoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, againCount: 0, goodCount: 0 });
  const [cramMode, setCramMode] = useState(false);
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const [showForgettingCurveInfo, setShowForgettingCurveInfo] = useState(false);
  const [showExtraDetails, setShowExtraDetails] = useState(false);
  const [isPlayingNaturalVoice, setIsPlayingNaturalVoice] = useState(false);

  const [localAutoPlay, setLocalAutoPlay] = useState<boolean>(() => {
    if (autoPlayAudio !== undefined) return autoPlayAudio;
    try {
      const saved = localStorage.getItem('srs_auto_play_tts');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const effectiveAutoPlay = autoPlayAudio !== undefined ? autoPlayAudio : localAutoPlay;

  const handleToggleAutoPlay = (newVal: boolean) => {
    setLocalAutoPlay(newVal);
    try {
      localStorage.setItem('srs_auto_play_tts', String(newVal));
    } catch {}
    onToggleAutoPlayAudio?.(newVal);
    if (!newVal) {
      stopAllAudio();
    }
  };

  // Filter cards by target language
  const languageCards = useMemo(() => {
    return cards.filter(c => !c.targetLanguage || c.targetLanguage === targetLanguage);
  }, [cards, targetLanguage]);

  // Overall stats taking into account daily new cards limit
  const stats = useMemo(() => {
    return computeSRSStats(languageCards, targetLanguage, dailyNewCardsLimit);
  }, [languageCards, targetLanguage, dailyNewCardsLimit]);

  const retention = useMemo(() => {
    return estimateRetentionRate(languageCards, reviewLogs);
  }, [languageCards, reviewLogs]);

  // Available unique stories for filter
  const storiesList = useMemo(() => {
    const map = new Map<string, { title: string; count: number; timestamp: number }>();
    languageCards.forEach(c => {
      const key = `${c.storyTimestamp}_${c.storyTitle}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { title: c.storyTitle, count: 1, timestamp: c.storyTimestamp });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [languageCards]);

  // Start review session
  const startReviewSession = (allCards: boolean = false) => {
    let queue: SRSCard[] = [];
    if (allCards) {
      // Cram mode: review all cards, shuffled
      queue = [...languageCards].sort(() => Math.random() - 0.5);
      setCramMode(true);
    } else {
      // Standard SRS due cards taking daily new cards limit into account
      queue = getDueCards(languageCards, targetLanguage, dailyNewCardsLimit);
      setCramMode(false);
    }

    if (selectedStoryFilter !== 'all') {
      queue = queue.filter(c => c.storyTitle === selectedStoryFilter);
    }

    if (queue.length > 0) {
      stopAllAudio();
      setReviewQueue(queue);
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowPhonetic(false);
      setShowExtraDetails(false);
      setSessionStats({ reviewed: 0, againCount: 0, goodCount: 0 });
      setSessionActive(true);
    }
  };

  const currentCard = reviewQueue[currentIndex] || null;

  // Auto-play simple browser TTS when review card appears
  useEffect(() => {
    if (!sessionActive || !currentCard || !currentCard.sentence?.original) return;
    if (!effectiveAutoPlay) return;

    stopAllAudio();

    // Short 150ms delay to let the card render before browser speech begins
    const timer = setTimeout(() => {
      speakText(currentCard.sentence.original, targetLanguage);
    }, 150);

    return () => {
      clearTimeout(timer);
      stopAllAudio();
    };
  }, [sessionActive, currentIndex, currentCard?.id, effectiveAutoPlay, targetLanguage]);

  // Active manual playback: uses natural AI voice if apiKey is available, otherwise browser TTS fallback
  const handlePlayActiveAudio = async () => {
    if (!currentCard || !currentCard.sentence?.original) return;
    if (isPlayingNaturalVoice) return;

    stopAllAudio();

    const trimmedKey = apiKey?.trim();
    if (trimmedKey) {
      setIsPlayingNaturalVoice(true);
      try {
        await playNaturalAudio(currentCard.sentence.original, trimmedKey);
      } catch (err) {
        console.warn("[SRS TTS] Natural voice playback failed, falling back to browser speech synthesis:", err);
        speakText(currentCard.sentence.original, targetLanguage);
      } finally {
        setIsPlayingNaturalVoice(false);
      }
    } else {
      speakText(currentCard.sentence.original, targetLanguage);
    }
  };

  // Handle rating submission
  const handleRate = useCallback((rating: SRSCardRating) => {
    if (!currentCard) return;

    stopAllAudio();

    const now = Date.now();
    const prevInterval = currentCard.interval || 0;
    const isFirstReview = (currentCard.reps || 0) === 0 && !currentCard.firstReviewedAt;
    const result = calculateNextInterval(currentCard, rating, now, desiredRetention);

    const updatedCard: SRSCard = {
      ...currentCard,
      interval: result.interval,
      easeFactor: result.easeFactor,
      stability: result.stability,
      difficulty: result.difficulty,
      reps: result.reps,
      lapses: result.lapses,
      state: result.state,
      dueDate: result.dueDate,
      lastReviewed: now,
      firstReviewedAt: currentCard.firstReviewedAt || (isFirstReview ? now : undefined),
      learningAt: currentCard.learningAt || (result.state === 'learning' || result.state === 'review' ? now : undefined),
      masteredAt: result.state === 'mastered' ? (currentCard.masteredAt || now) : undefined
    };

    onUpdateCard(updatedCard);
    onLogReview?.([currentCard.id, now, rating, prevInterval]);

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      againCount: rating === 1 ? prev.againCount + 1 : prev.againCount,
      goodCount: rating >= 3 ? prev.goodCount + 1 : prev.goodCount
    }));

    // If rated "Again", re-insert into queue 3-4 cards later or at the end
    let nextQueueLength = reviewQueue.length;
    if (rating === 1) {
      const remainingQueue = [...reviewQueue];
      // Put failed card back into this session queue
      const reinsertIndex = Math.min(currentIndex + 3, remainingQueue.length);
      remainingQueue.splice(reinsertIndex, 0, updatedCard);
      nextQueueLength = remainingQueue.length;
      setReviewQueue(remainingQueue);
    }

    // Advance to next card using the updated queue length
    if (currentIndex + 1 < nextQueueLength) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setShowPhonetic(false);
      setShowExtraDetails(false);
    } else {
      // End of session
      setCurrentIndex(nextQueueLength);
    }
  }, [currentCard, currentIndex, reviewQueue, desiredRetention, onUpdateCard, onLogReview]);

  // Keyboard navigation (Space/Enter to flip, 1-4 to rate)
  useEffect(() => {
    if (!sessionActive || !currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (!isFlipped) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          setIsFlipped(true);
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          handleRate(1);
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate(2);
        } else if (e.key === '3') {
          e.preventDefault();
          handleRate(3);
        } else if (e.key === '4') {
          e.preventDefault();
          handleRate(4);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionActive, currentCard, isFlipped, handleRate]);

  // Highlight new element inside sentence
  const renderHighlightedSentence = (sentence: Sentence) => {
    if (!sentence) return null;
    const text = sentence.original;
    const targetWord = sentence.new_element?.trim();

    if (!targetWord) {
      return <span>{text}</span>;
    }

    try {
      const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match whole words using Unicode letter/number boundaries so small words (e.g. 'He') aren't highlighted inside larger words (e.g. 'The')
      const boundaryRegex = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, 'giu');
      const parts = boundaryRegex.test(text)
        ? text.split(boundaryRegex)
        : text.split(new RegExp(`(${escaped})`, 'gi'));

      return (
        <span className="leading-relaxed">
          {parts.map((part, i) => {
            if (part.toLowerCase() === targetWord.toLowerCase()) {
              return (
                <span
                  key={i}
                  className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-md font-semibold border-b-2 border-amber-500 shadow-xs inline-block"
                >
                  {part}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    } catch {
      return <span>{text}</span>;
    }
  };

  const buttonIntervals = currentCard ? getCardButtonIntervals(currentCard, desiredRetention) : null;

  // Back config labels & descriptions
  const backTypeOptions: { id: SRSBackType; label: string; desc: string; icon: string }[] = [
    {
      id: 'full_translation',
      label: t.srsBackFull || 'Tradução da Frase Completa',
      desc: t.srsBackFullDesc || 'Exibe a tradução completa em seu idioma nativo.',
      icon: '📝'
    },
    {
      id: 'element_translation',
      label: t.srsBackElement || 'Tradução Apenas do Elemento i+1',
      desc: t.srsBackElementDesc || 'Foco exato no novo vocábulo ou elemento desconhecido.',
      icon: '🎯'
    },
    {
      id: 'target_definition',
      label: t.srsBackDefinition || 'Definição do Elemento no Idioma Alvo',
      desc: t.srsBackDefinitionDesc || 'Imersão pura: definição explicada na própria língua de estudo.',
      icon: '🌐'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Layers size={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {t.srsTitle || 'Revisão Espaçada (SRS / Anki)'}
            </h2>
            <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full">
              SM-2 Algorithm
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t.srsSubtitle || 'Curva do esquecimento e repetição espaçada para fixar cada frase i+1 na memória de longo prazo.'}
          </p>
        </div>

        {/* Card Back Configuration Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowConfigDropdown(!showConfigDropdown)}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-semibold transition-all border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
          >
            <Settings2 size={16} className="text-indigo-500" />
            <div className="text-left">
              <span className="text-[10px] text-slate-600 dark:text-slate-400 block uppercase tracking-wider">
                {t.srsCardBackSetting || 'Configuração do Verso'}:
              </span>
              <span className="truncate max-w-[180px] font-bold text-slate-900 dark:text-white">
                {backTypeOptions.find(o => o.id === srsBackType)?.label}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-600" />
          </button>

          {showConfigDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                {t.srsSelectBackMode || 'O que você deseja ver no verso do card?'}
              </div>
              <div className="space-y-1 mt-1">
                {backTypeOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeBackType(opt.id);
                      setShowConfigDropdown(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                      srsBackType === opt.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-bold flex items-center justify-between">
                        {opt.label}
                        {srsBackType === opt.id && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Auto-TTS toggle inside dropdown */}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 px-1">
                <button
                  type="button"
                  onClick={() => handleToggleAutoPlay(!effectiveAutoPlay)}
                  className="w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  <div className="flex items-center gap-2">
                    {effectiveAutoPlay ? (
                      <Volume2 size={16} className="text-emerald-500" />
                    ) : (
                      <VolumeX size={16} className="text-slate-400" />
                    )}
                    <span>{t.srsAutoPlayAudio || "Áudio Automático (TTS)"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    effectiveAutoPlay 
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {effectiveAutoPlay ? (t.srsAutoOn || "Ativado") : (t.srsAutoOff || "Desativado")}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Active Session */}
      {sessionActive && (
        <div className="space-y-6">
          {currentIndex < reviewQueue.length && currentCard ? (
            <div className="space-y-6 animate-fade-in">
              {/* Session Header / Progress */}
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    Card {currentIndex + 1} / {reviewQueue.length}
                  </span>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                      {currentCard.state === 'new' ? 'Novo' : currentCard.state === 'learning' ? 'Aprendendo' : 'Revisão'}
                    </span>
                    <span>•</span>
                    <span className="truncate max-w-[200px]">{currentCard.storyTitle}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopAllAudio();
                      setSessionActive(false);
                      setIsFlipped(false);
                      setShowPhonetic(false);
                      setShowExtraDetails(false);
                    }}
                    className="text-xs text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
                    title={t.srsFinishSession || 'Sair'}
                  >
                    <X size={14} />
                    <span>{t.srsFinishSession || 'Sair'}</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / reviewQueue.length) * 100}%` }}
                />
              </div>

              {/* Anki Flashcard Container */}
              <div className="relative bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-lg min-h-[380px] flex flex-col justify-between transition-all">
                {/* Front of Card */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {t.srsCardFront || 'FRENTE (Frase i+1)'}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                        {targetLanguage}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Quick Auto-TTS Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAutoPlay(!effectiveAutoPlay)}
                        title={effectiveAutoPlay ? (t.srsAutoPlayOnTip || "Áudio automático ativado (clique para silenciar)") : (t.srsAutoPlayOffTip || "Áudio automático desativado (clique para ativar)")}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer font-medium ${
                          effectiveAutoPlay
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        {effectiveAutoPlay ? (
                          <Volume2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <VolumeX size={15} />
                        )}
                        <span className="text-[11px] font-bold">
                          {effectiveAutoPlay ? (t.srsAutoOn || 'Auto') : (t.srsAutoOff || 'Mudo')}
                        </span>
                      </button>

                      {/* Active Audio Play Button: Natural AI Voice (with Browser TTS fallback) */}
                      <button
                        type="button"
                        onClick={handlePlayActiveAudio}
                        disabled={isPlayingNaturalVoice}
                        title={apiKey ? (t.srsPlayNaturalVoice || "Ouvir com voz natural (IA)") : (t.srsPlayBrowserVoice || "Ouvir pronúncia")}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-900/40 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold disabled:opacity-75"
                      >
                        {isPlayingNaturalVoice ? (
                          <>
                            <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                            <span className="hidden sm:inline text-[11px] font-bold">
                              {t.srsNaturalVoiceBadge || "Voz IA..."}
                            </span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={16} />
                            {apiKey ? (
                              <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-200/80 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200">
                                <Sparkles size={10} className="text-indigo-500" />
                                {t.srsNaturalVoiceTag || "Voz Natural"}
                              </span>
                            ) : (
                              <span className="hidden sm:inline text-[11px]">
                                {t.srsPlayBrowserVoice || "Ouvir"}
                              </span>
                            )}
                          </>
                        )}
                      </button>

                      {currentCard.sentence.phonetic && (
                        <button
                          type="button"
                          onClick={() => setShowPhonetic(!showPhonetic)}
                          className={`text-xs px-2.5 py-1.5 rounded-xl transition-all font-mono font-medium cursor-pointer ${
                            showPhonetic
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          IPA
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Target Sentence Display */}
                  <div className="py-4">
                    <div className="text-2xl sm:text-3xl font-serif font-medium text-slate-900 dark:text-slate-100 leading-relaxed text-center sm:text-left">
                      {renderHighlightedSentence(currentCard.sentence)}
                    </div>

                    {showPhonetic && currentCard.sentence.phonetic && (
                      <div className="mt-3 text-sm font-mono text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/50 dark:border-amber-900/40">
                        /{currentCard.sentence.phonetic}/
                      </div>
                    )}
                  </div>

                  {/* Element i+1 badge */}
                  {currentCard.sentence.new_element && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        {t.srsElementBadge || 'Elemento i+1'}:
                      </span>
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md font-bold">
                        {currentCard.sentence.new_element}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Divider / Flip Action */}
                {!isFlipped ? (
                  <div className="pt-8 flex flex-col items-center justify-center space-y-3">
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <RotateCw size={18} />
                      {t.srsShowAnswer || 'Mostrar Resposta'}
                    </button>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      {t.srsPressSpace || 'Pressione [Espaço] para virar o card'}
                    </span>
                  </div>
                ) : (
                  /* Back of Card (Configured Content + Anki 4 Rating Buttons) */
                  <div className="space-y-6 pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-800 animate-fade-in">
                    {/* Mode Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {t.srsCardBack || 'VERSO'}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          ({backTypeOptions.find(o => o.id === srsBackType)?.label})
                        </span>
                      </div>

                      {/* Quick mode switcher toggle on the card */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                        {backTypeOptions.map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChangeBackType(opt.id)}
                            title={opt.label}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              srsBackType === opt.id
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            {opt.icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary Back Content according to user configuration */}
                    <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                      {srsBackType === 'full_translation' && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                            {t.srsFullTranslationLabel || 'Tradução Completa da Frase'} ({nativeLanguage}):
                          </span>
                          <p className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                            {currentCard.sentence.translation}
                          </p>
                        </div>
                      )}

                      {srsBackType === 'element_translation' && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                            {t.srsElementTranslationLabel || 'Tradução do Elemento i+1'}:
                          </span>
                          <div className="flex items-baseline gap-3">
                            <span className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
                              {currentCard.sentence.new_element}
                            </span>
                            <span className="text-slate-600">→</span>
                            <span className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-100">
                              {currentCard.sentence.explanation}
                            </span>
                          </div>
                        </div>
                      )}

                      {srsBackType === 'target_definition' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                              {t.srsTargetDefinitionLabel || 'Definição Imersiva no Idioma Alvo'} ({targetLanguage}):
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                              100% Imersão
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-100 italic">
                            "{currentCard.sentence.definition_target || currentCard.sentence.explanation}"
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            Palavra-chave: <strong className="text-indigo-600 dark:text-indigo-400">{currentCard.sentence.new_element}</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Secondary Context Toggle */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowExtraDetails(!showExtraDetails)}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                      >
                        {showExtraDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {showExtraDetails
                          ? (t.srsHideOtherDetails || 'Ocultar outros detalhes')
                          : (t.srsShowOtherDetails || 'Ver outros modos (tradução / definição extra)')}
                      </button>

                      {showExtraDetails && (
                        <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2.5 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 animate-fade-in">
                          {srsBackType !== 'full_translation' && (
                            <div>
                              <strong className="text-slate-600 dark:text-slate-400 block mb-0.5">Tradução Completa:</strong>
                              <span>{currentCard.sentence.translation}</span>
                            </div>
                          )}
                          {srsBackType !== 'element_translation' && (
                            <div>
                              <strong className="text-slate-600 dark:text-slate-400 block mb-0.5">Explicação do Elemento i+1:</strong>
                              <span>{currentCard.sentence.new_element} → {currentCard.sentence.explanation}</span>
                            </div>
                          )}
                          {srsBackType !== 'target_definition' && currentCard.sentence.definition_target && (
                            <div>
                              <strong className="text-slate-600 dark:text-slate-400 block mb-0.5">Definição no Idioma Alvo:</strong>
                              <span className="italic">"{currentCard.sentence.definition_target}"</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 4 Anki Rating Buttons */}
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-bold text-center text-slate-600 dark:text-slate-400">
                        {t.srsRatePrompt || 'Como foi a sua lembrança? (Classifique para a Curva do Esquecimento):'}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {/* 1: Again (Errei) */}
                        <button
                          type="button"
                          onClick={() => handleRate(1)}
                          className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 transition-all cursor-pointer group active:scale-95"
                        >
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                            {t.srsAgain || 'Errei'} <span className="opacity-60 text-[10px]">[1]</span>
                          </span>
                          <span className="text-[11px] font-mono text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                            {buttonIntervals?.[1] || '< 10m'}
                          </span>
                        </button>

                        {/* 2: Hard (Difícil) */}
                        <button
                          type="button"
                          onClick={() => handleRate(2)}
                          className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 transition-all cursor-pointer group active:scale-95"
                        >
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                            {t.srsHard || 'Difícil'} <span className="opacity-60 text-[10px]">[2]</span>
                          </span>
                          <span className="text-[11px] font-mono text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                            {buttonIntervals?.[2] || '1d'}
                          </span>
                        </button>

                        {/* 3: Good (Bom) */}
                        <button
                          type="button"
                          onClick={() => handleRate(3)}
                          className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition-all cursor-pointer group active:scale-95"
                        >
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            {t.srsGood || 'Bom'} <span className="opacity-60 text-[10px]">[3]</span>
                          </span>
                          <span className="text-[11px] font-mono text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                            {buttonIntervals?.[3] || '3d'}
                          </span>
                        </button>

                        {/* 4: Easy (Fácil) */}
                        <button
                          type="button"
                          onClick={() => handleRate(4)}
                          className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 transition-all cursor-pointer group active:scale-95"
                        >
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                            {t.srsEasy || 'Fácil'} <span className="opacity-60 text-[10px]">[4]</span>
                          </span>
                          <span className="text-[11px] font-mono text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                            {buttonIntervals?.[4] || '6d'}
                          </span>
                        </button>
                      </div>

                      <div className="text-[11px] text-center text-slate-600 dark:text-slate-400 pt-1">
                        {t.srsShortcutsHint || 'Atalhos no teclado: [1] Errei • [2] Difícil • [3] Bom • [4] Fácil'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Session Completed Screen */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-sm animate-fade-in">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={44} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  {t.srsSessionDoneTitle || 'Sessão de Revisão Concluída!'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto text-sm">
                  {t.srsSessionDoneDesc || 'Excelente trabalho! Você desafiou a curva do esquecimento e reforçou suas conexões neurais para o longo prazo.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto py-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {sessionStats.reviewed}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
                    {t.srsReviewedCards || 'Cards revisados'}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {sessionStats.goodCount}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
                    {t.srsRememberedCount || 'Lembrados'}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {sessionStats.againCount}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
                    {t.srsAgainCount || 'Para reforçar'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSessionActive(false)}
                  className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer"
                >
                  {t.srsReturnToDeck || 'Voltar ao Deck'}
                </button>
                <button
                  type="button"
                  onClick={() => startReviewSession(true)}
                  className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-2xl transition-all cursor-pointer"
                >
                  {t.srsCramMore || 'Praticar Mais (Modo Livre)'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Deck Overview (When no session is active) */}
      {!sessionActive && (
        <div className="space-y-8 animate-fade-in">
          {/* Top Deck Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>{t.srsDueToday || 'Devidos Hoje'}</span>
                <Clock size={16} className="text-amber-500" />
              </div>
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {stats.dueToday}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                {stats.dueToday === 0 ? 'Tudo em dia para hoje!' : 'Prontos para revisar agora'}
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>{t.srsNewCards || 'Novos (i+1)'}</span>
                <Sparkles size={16} className="text-blue-500" />
              </div>
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {stats.newCards}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Aguardando 1ª repetição
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>{t.srsLearningCards || 'Em Aprendizado'}</span>
                <TrendingUp size={16} className="text-indigo-500" />
              </div>
              <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {stats.learningCards + stats.reviewCards}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Caminho para fixação
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>{t.srsMasteredCards || 'Dominados'}</span>
                <Award size={16} className="text-emerald-500" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {stats.masteredCards}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Intervalo &gt; 21 dias ({retention.rate !== null ? `${retention.rate}%` : '85%'} retenção)
              </p>
            </div>
          </div>

          {/* Action Hero Banner: Start SRS Session */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-200 text-xs font-medium">
                  <BrainCircuit size={14} />
                  <span>Método Anki com Intervalos Exponenciais</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {stats.dueToday > 0
                    ? `${stats.dueToday} ${stats.dueToday === 1 ? 'card pronto' : 'cards prontos'} para revisão hoje`
                    : 'Você está 100% em dia com suas revisões! 🎉'}
                </h3>
                <p className="text-indigo-200 text-xs sm:text-sm leading-relaxed">
                  {stats.dueToday > 0
                    ? 'Pratique agora para interceptar o esquecimento no ponto exato em que a retenção começa a cair.'
                    : 'Todas as suas frases estão consolidadas na memória de longo prazo. Você pode fazer um reforço livre ou gerar novas histórias.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto shrink-0">
                {stats.dueToday > 0 ? (
                  <button
                    type="button"
                    onClick={() => startReviewSession(false)}
                    className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Play size={18} className="fill-white" />
                    <span>{t.srsStartReviewBtn || 'Iniciar Revisão de Hoje'}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startReviewSession(true)}
                      disabled={languageCards.length === 0}
                      className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                    >
                      <RotateCw size={16} />
                      <span>{t.srsCramBtn || 'Praticar Modo Livre'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onNavigateToStudy}
                      className="px-6 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <BookOpen size={16} />
                      <span>{t.srsGenerateNewStory || 'Gerar Nova História i+1'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Retention Progress Chart (Learning -> Mastered over 30 days) */}
          <SRSRetentionChart 
            cards={languageCards} 
            targetLanguage={targetLanguage} 
            reviewLogs={reviewLogs}
            t={t} 
          />

          {/* Ebbinghaus Forgetting Curve Educational Visualizer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {t.srsForgettingCurveTitle || 'A Curva do Esquecimento de Ebbinghaus'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t.srsForgettingCurveSubtitle || 'Como o algoritmo FSRS transforma aprendizado efêmero em retenção permanente.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowForgettingCurveInfo(!showForgettingCurveInfo)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                {showForgettingCurveInfo ? 'Ocultar detalhes' : 'Como funciona?'}
              </button>
            </div>

            {/* Interactive SVG / Graphic of the Spaced Repetition Curve */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono mb-2">
                <span>Retenção (%)</span>
                <span>Tempo / Espaçamento (dias)</span>
              </div>

              {/* Graphic Representation */}
              <div className="relative h-36 w-full flex items-end justify-between gap-2 pt-6">
                {/* Day 0: Initial learning */}
                <div className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">100%</div>
                  <div className="w-full bg-slate-300 dark:bg-slate-700 rounded-t-lg h-[95%]" />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-2">Lido</span>
                </div>

                {/* Day 1: 1st review */}
                <div className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="text-[10px] font-bold text-rose-500 mb-1">60% ➔ 100%</div>
                  <div className="w-full bg-rose-400/80 dark:bg-rose-500/70 rounded-t-lg h-[60%]" />
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-2">1º dia</span>
                </div>

                {/* Day 3: 2nd review */}
                <div className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="text-[10px] font-bold text-amber-500 mb-1">75% ➔ 100%</div>
                  <div className="w-full bg-amber-400/80 dark:bg-amber-500/70 rounded-t-lg h-[75%]" />
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-2">3º dia</span>
                </div>

                {/* Day 7: 3rd review */}
                <div className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="text-[10px] font-bold text-blue-500 mb-1">85% ➔ 100%</div>
                  <div className="w-full bg-blue-400/80 dark:bg-blue-500/70 rounded-t-lg h-[85%]" />
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-2">7º dia</span>
                </div>

                {/* Day 21+: Mastered */}
                <div className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="text-[10px] font-bold text-emerald-500 mb-1">95%+</div>
                  <div className="w-full bg-emerald-500 rounded-t-lg h-[95%]" />
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-2">21d+ (Fixo)</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  💡 <strong>Sem repetição:</strong> O cérebro descarta até 70% das novas palavras em 24h.
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Com o FSRS-5: a retenção se mantém no alvo ({Math.round(desiredRetention * 100)}%) com menos revisões.
                </span>
              </div>
            </div>

            {showForgettingCurveInfo && (
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-xs text-slate-700 dark:text-slate-300 space-y-2 animate-fade-in">
                <p>
                  <strong>Por que o Polyglot i+1 usa o FSRS-5?</strong> Em 1885, Hermann Ebbinghaus descobriu que a perda de memória segue uma curva previsível. O FSRS (Free Spaced Repetition Scheduler) modela individualmente a <em>Estabilidade</em>, a <em>Dificuldade</em> e a <em>Recuperabilidade</em> de cada card — superando o antigo SM-2 em precisão.
                </p>
                <p>
                  Quando você clica em <strong>Difícil</strong>, <strong>Bom</strong> ou <strong>Fácil</strong>, o FSRS calcula o intervalo exato para atingir sua meta de retenção (<strong>{Math.round(desiredRetention * 100)}%</strong>), recompensando revisões bem espaçadas e preservando parte da estabilidade mesmo após um lapso — reduzindo até 20–30% o volume de revisões para a mesma retenção!
                </p>
              </div>
            )}
          </div>

          {/* Cards Explorer / Story Decks */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
                  {t.srsDeckExplorerTitle || 'Deck de Histórias Concluídas'}
                  <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
                    ({languageCards.length} cards no total)
                  </span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {t.srsDeckExplorerSubtitle || 'Cada lição concluída alimenta automaticamente seu deck com frases i+1.'}
                </p>
              </div>

              {/* Story Filter Selector */}
              {storiesList.length > 1 && (
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-slate-600" />
                  <select
                    value={selectedStoryFilter}
                    onChange={(e) => setSelectedStoryFilter(e.target.value)}
                    className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="all">Todas as histórias ({languageCards.length} cards)</option>
                    {storiesList.map(s => (
                      <option key={s.timestamp} value={s.title}>
                        {s.title} ({s.count} cards)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Empty State */}
            {languageCards.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Layers size={32} />
                </div>
                <div className="space-y-1">
                  <h5 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {t.srsNoCardsYet || 'Seu Deck do Anki está vazio'}
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    {t.srsNoCardsDesc || 'Assim que você completar sua primeira história no Polyglot i+1, todas as frases e elementos novos serão automaticamente adicionados aqui para repetição espaçada!'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToStudy}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>{t.srsGenerateFirstStory || 'Criar Minha Primeira História'}</span>
                </button>
              </div>
            ) : (
              /* Stories Deck List */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {storiesList.map(story => {
                  const storyCards = languageCards.filter(c => c.storyTitle === story.title);
                  const storyDueCount = storyCards.filter(c => c.state === 'new' || c.dueDate <= Date.now()).length;
                  const storyMastered = storyCards.filter(c => c.state === 'mastered').length;

                  return (
                    <div
                      key={story.timestamp}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">
                            {story.title}
                          </h5>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">
                            Concluída em {new Date(story.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md">
                          {story.count} cards
                        </span>
                      </div>

                      {/* Mini Breakdown */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-3">
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            {storyDueCount} devidos
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {storyMastered} dominados
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStoryFilter(story.title);
                            startReviewSession(true);
                          }}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Revisar história →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
