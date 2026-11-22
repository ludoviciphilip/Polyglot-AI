import React, { useState } from 'react';
import { StoryResponse, Sentence } from '../types';
import { Volume2, ChevronDown, ChevronUp, CheckCircle2, Loader2, Sparkles, Languages, Music, PlayCircle, Info, Download, RefreshCw, Book, BookOpen, AlertTriangle } from 'lucide-react';
import { isExperimentalLanguage } from '../utils/starterVocab';
import {
  speakWithBrowser,
  playNaturalAudio,
  playFullStoryAudio,
  downloadFullStoryAudio
} from '../utils/audio';
import { findTranslationHighlightRange, formatIpa, getElementTranslation } from '../utils/highlightTranslation';

export { playFullStoryAudio, downloadFullStoryAudio };

interface StudyAreaProps {
  story: StoryResponse | null;
  loading: boolean;
  onGenerate: () => void;
  onComplete: (story: StoryResponse) => void;
  onReannotate?: () => Promise<void> | void;
  targetLanguage: string;
  t: any;
  apiKey?: string;
}

const SentenceCard: React.FC<{ 
  sentence: Sentence; 
  targetLanguage: string; 
  t_app: any; 
  isReview: boolean;
  apiKey?: string;
}> = ({ sentence, targetLanguage, t_app, isReview, apiKey: customApiKey }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  const speak = async () => {
    if (isProcessingAudio || !sentence?.original) return;
    setIsProcessingAudio(true);
    try {
      const apiKey = customApiKey?.trim() || "";
      if (!apiKey) {
        speakWithBrowser(sentence.original, targetLanguage);
        return;
      }
      await playNaturalAudio(sentence.original, apiKey);
    } catch {
      speakWithBrowser(sentence.original, targetLanguage);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const renderHighlightedSentence = () => {
    if (!sentence || !sentence.original) return "";
    if (!sentence.new_element || isReview) return sentence.original;
    try {
      const trimmed = sentence.new_element.trim();
      if (!trimmed) return sentence.original;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match whole words using Unicode letter/number boundaries so small words (e.g. 'He') aren't highlighted inside larger words (e.g. 'The')
      const boundaryRegex = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, 'giu');
      const parts = boundaryRegex.test(sentence.original)
        ? sentence.original.split(boundaryRegex)
        : sentence.original.split(new RegExp(`(${escaped})`, 'gi'));

      if (!Array.isArray(parts)) return sentence.original;
      return parts.map((part, index) => {
        if (part.toLowerCase() === trimmed.toLowerCase()) {
          return (
            <span key={index} className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-md border-b-2 border-indigo-400 dark:border-indigo-600 font-semibold">
              {part}
            </span>
          );
        }
        return part;
      });
    } catch {
      return sentence.original;
    }
  };

  const renderHighlightedTranslation = () => {
    if (!sentence || !sentence.translation) return "";
    if (!sentence.new_element || isReview) return sentence.translation;

    const match = findTranslationHighlightRange(sentence);
    if (!match) return sentence.translation;

    const before = sentence.translation.slice(0, match.start);
    const highlighted = sentence.translation.slice(match.start, match.end);
    const after = sentence.translation.slice(match.end);

    return (
      <>
        {before}
        <strong className="not-italic font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-md border-b-2 border-indigo-400 dark:border-indigo-600 inline-block">
          {highlighted}
        </strong>
        {after}
      </>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-all hover:shadow-md">
      <div className="p-6">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h4 className="text-xl md:text-2xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
            {renderHighlightedSentence()}
          </h4>
          <button onClick={speak} disabled={isProcessingAudio} className="p-2 text-slate-400 hover:text-indigo-600 rounded-full transition-all disabled:opacity-50">
            {isProcessingAudio ? <Loader2 className="animate-spin" size={22} /> : <Volume2 size={22} />}
          </button>
        </div>
        
        <div className="flex flex-col gap-3">
          <button onClick={() => setShowTranslation(!showTranslation)} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 w-fit cursor-pointer">
            {showTranslation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showTranslation ? (t_app.hideTranslation || "Hide Translation") : (t_app.showTranslation || "Show Translation")}
          </button>
          
          {showTranslation && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <p className="text-slate-600 dark:text-slate-300 italic p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-l-4 border-indigo-200 dark:border-indigo-800 leading-relaxed">
                {renderHighlightedTranslation()}
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                {!isReview && sentence.definition_target && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Book size={12} /> {t_app.definition || "Definition"} ({targetLanguage})</p>
                    <p className="text-md font-medium text-indigo-900 dark:text-indigo-200 leading-relaxed">"{sentence.definition_target}"</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!isReview && sentence.new_element && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest flex items-center gap-1">
                          <Sparkles size={12} /> {t_app.plusOneElement || "The \"+1\" Element"}
                        </p>
                        {sentence.part_of_speech && (
                          <span className="text-[10px] font-semibold bg-amber-200/80 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {sentence.part_of_speech}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed font-semibold">
                        {sentence.new_element}
                        {getElementTranslation(sentence) && <> → {getElementTranslation(sentence)}</>}
                        {sentence.explanation && <>: <span className="font-normal">{sentence.explanation}</span></>}
                      </p>
                    </div>
                  )}
                  {sentence.phonetic && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Info size={12} /> {t_app.pronunciationIPA || "Pronunciation (IPA)"}</p>
                      <p className="text-lg font-mono text-blue-900 dark:text-blue-200">{formatIpa(sentence.phonetic)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StudyArea: React.FC<StudyAreaProps> = ({ story, loading, onGenerate, onComplete, onReannotate, targetLanguage, t, apiKey }) => {
  const [isPlayingCurrent, setIsPlayingCurrent] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReannotating, setIsReannotating] = useState(false);

  const handleReannotate = async () => {
    if (!onReannotate || isReannotating) return;
    setIsReannotating(true);
    try {
      await onReannotate();
    } finally {
      setIsReannotating(false);
    }
  };

  const handlePlayFull = async () => {
    if (!story || isPlayingCurrent) return;
    setIsPlayingCurrent(true);
    try {
      await playFullStoryAudio(story, targetLanguage, apiKey);
    } catch {
      const sentences = Array.isArray(story.sentences) ? story.sentences : [];
      if (sentences.length > 0) {
        speakWithBrowser(sentences.map(s => s.original).join(". "), targetLanguage);
      }
    } finally {
      setIsPlayingCurrent(false);
    }
  };

  const handleDownloadFull = async () => {
    if (!story || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadFullStoryAudio(story, targetLanguage, apiKey);
    } catch (err: any) {
      alert(`Download Error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500 py-16">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-100 dark:border-indigo-900 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0"></div>
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">{t.generatingLesson || "Crafting your custom lesson with the Natural Method (i+1)..."}</p>
      </div>
    );
  }

  const sentences = Array.isArray(story?.sentences) ? story.sentences : [];

  if (!story || sentences.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 py-16">
        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-6 rounded-3xl text-indigo-600 dark:text-indigo-400"><Languages size={48} /></div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t.noActiveLesson || "No Active Lesson"}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.noActiveLessonDesc || "Generate a custom story tailored to your current vocabulary level."}</p>
        <button onClick={onGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-10 rounded-2xl shadow-xl flex items-center gap-2 cursor-pointer mx-auto">
          <Sparkles size={20} /> {t.generateMyStory || t.generate || "Generate New Lesson"}
        </button>
      </div>
    );
  }

  const newWords = Array.isArray(story?.new_words_to_add) ? story.new_words_to_add : [];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isExperimentalLanguage(targetLanguage) && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
          <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <span className="font-bold mr-1.5 uppercase tracking-wider text-[10px] bg-amber-200/70 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
              {t.experimentalLangBadge || "Experimental"}
            </span>
            {t.experimentalLangNote || "Latin, Ancient Greek, and Shakespearean English are experimental. Accents, IPA, and reconstructed pronunciation may contain inaccuracies."}
          </div>
        </div>
      )}

      {story.hasHighUnknownWords && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-700 dark:text-amber-400 text-xs">
          <Info size={15} className="shrink-0 text-amber-600" />
          <span>{t.highUnknownWordsNotice || "Esta história pode ter mais palavras novas que o ideal."}</span>
        </div>
      )}

      {story.annotationsFailed && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2.5">
            <Info size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{t.annotationsFailedNotice || "As anotações detalhadas desta história não foram geradas."}</span>
          </div>
          {onReannotate && (
            <button
              type="button"
              onClick={handleReannotate}
              disabled={isReannotating}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer text-xs shrink-0"
            >
              {isReannotating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{t.reannotating || "Anotando..."}</span>
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  <span>{t.reannotateBtn || "Anotar de novo"}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{story.level_target || 'Advanced'} {t.level || 'Level'}</span>
            {story.is_review && (
              <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1"><RefreshCw size={10} /> {t.reviewMode || 'Review Mode'}</span>
            )}
            {story.isReopened && (
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                <BookOpen size={10} /> {t.reopenedStoryBadge || "Histórico / Concluída"}
              </span>
            )}
            {story.modelUsed && (
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-mono px-2 py-1 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1" title="Model Used">
                <Sparkles size={10} className="text-indigo-500" />
                {story.modelUsed}
              </span>
            )}
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{story.story_title || (story.is_review ? t.review : t.generate)}</h2>
        </div>
      </header>

      <div className="space-y-6">
        {sentences.map((sentence, idx) => (
          <SentenceCard 
            key={sentence.id || idx} 
            sentence={sentence} 
            targetLanguage={targetLanguage} 
            t_app={t} 
            isReview={!!story.is_review} 
            apiKey={apiKey}
          />
        ))}
      </div>

      <div className="pt-10 border-t border-slate-200 dark:border-slate-800 text-center">
        <div className="bg-indigo-50 dark:bg-slate-900 p-8 rounded-3xl space-y-6 border border-indigo-100 dark:border-slate-800">
          <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-400">
            {story.isReopened
              ? (t.reopenedStoryTitle || "História Já Concluída")
              : story.is_review 
                ? (t.sessionReview || "Session Review") 
                : (t.lessonReview || "Lesson Review")}
          </h3>

          {story.isReopened && (
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto -mt-2">
              {t.reopenedStoryNotice || "Esta história já foi concluída e está salva no seu histórico. Você pode reler o texto e ouvir os áudios livremente."}
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={handlePlayFull} disabled={isPlayingCurrent} className="flex items-center gap-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-6 py-3 rounded-xl border border-indigo-100 dark:border-slate-700 hover:shadow-md transition-all font-medium disabled:opacity-50 cursor-pointer">
              {isPlayingCurrent ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />} {t.listenFullStory || "Listen to Full Story"}
            </button>
            <button onClick={handleDownloadFull} disabled={isDownloading} className="flex items-center gap-2 bg-indigo-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 px-6 py-3 rounded-xl border border-indigo-200 dark:border-slate-700 hover:shadow-md transition-all font-medium disabled:opacity-50 cursor-pointer">
              {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />} {t.downloadAudio || "Download Audio (.wav)"}
            </button>
          </div>

          {!story.is_review && !story.isReopened && newWords.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {newWords.map((word, i) => (<span key={i} className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-slate-700">+ {word}</span>))}
            </div>
          )}
          
          <button 
            onClick={() => onComplete(story)} 
            className={`font-bold py-4 px-12 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 w-full md:w-auto mx-auto cursor-pointer ${
              story.isReopened
                ? "bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            <CheckCircle2 size={24} /> {
              story.isReopened
                ? (t.closeStory || "Fechar História")
                : story.is_review 
                  ? (t.reviewCompleted || "Review Completed") 
                  : (t.lessonCompletedBtn || "Lesson Completed")
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyArea;