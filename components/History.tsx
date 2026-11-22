import React, { useState } from 'react';
import { HistoryItem, StoryResponse } from '../types';
import { Clock, Book, ExternalLink, Play, Loader2, Download } from 'lucide-react';
import { playFullStoryAudio, downloadFullStoryAudio, speakWithBrowser } from '../utils/audio';

interface HistoryProps {
  history: HistoryItem[];
  onReopen: (story: StoryResponse) => void;
  targetLanguage: string;
  t: any;
  apiKey?: string;
}

const History: React.FC<HistoryProps> = ({ history, onReopen, targetLanguage, t, apiKey }) => {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat(t?.intlLocale || undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  const handlePlayHistoryAudio = async (idx: number, item: HistoryItem) => {
    if (playingIdx !== null) return;
    setPlayingIdx(idx);
    try {
      await playFullStoryAudio(item, targetLanguage, apiKey);
    } catch {
      const sentences = Array.isArray(item.sentences) ? item.sentences : [];
      if (sentences.length > 0) {
        speakWithBrowser(sentences.map(s => s.original).filter(Boolean).join('. '), targetLanguage);
      }
    } finally {
      setPlayingIdx(null);
    }
  };

  const handleDownloadHistoryAudio = async (idx: number, item: HistoryItem) => {
    if (downloadingIdx !== null) return;
    setDownloadingIdx(idx);
    try {
      await downloadFullStoryAudio(item, targetLanguage, apiKey);
    } catch (err: any) {
      alert(`${t.downloadError || "Download Error:"} ${err.message}`);
    } finally {
      setDownloadingIdx(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t.learningHistory || "Learning History"}</h2>
        <p className="text-slate-500 dark:text-slate-400">{t.revisitBreakthroughs || "Revisit your past breakthroughs"}</p>
      </div>

      {history.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-slate-300 dark:text-slate-600">
            <Clock size={40} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium italic">{t.historyEmpty || "Your story list is currently empty."}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.map((item, idx) => (
            <div key={item.timestamp ? `${item.timestamp}_${idx}` : idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
              <div className="flex items-start gap-4 flex-grow">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-3 rounded-xl shrink-0">
                  <Book size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{item.story_title}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded uppercase">
                      {item.level_target}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Clock size={12} /> {formatDate(item.timestamp)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(item.new_words_to_add || []).slice(0, 3).map((w, i) => (
                      <span key={i} className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                        {w}
                      </span>
                    ))}
                    {(item.new_words_to_add || []).length > 3 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">+{(item.new_words_to_add || []).length - 3} {t.moreWords || "more"}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handlePlayHistoryAudio(idx, item)}
                  disabled={playingIdx !== null}
                  className="p-3 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-full transition-all disabled:opacity-50 cursor-pointer"
                  title={t.listenStory || "Listen to story"}
                >
                  {playingIdx === idx ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
                </button>
                <button 
                  onClick={() => handleDownloadHistoryAudio(idx, item)}
                  disabled={downloadingIdx !== null}
                  className="p-3 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-full transition-all disabled:opacity-50 cursor-pointer"
                  title={t.downloadAudio || "Download audio (.wav)"}
                >
                  {downloadingIdx === idx ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                </button>
                <button 
                  onClick={() => onReopen(item)}
                  className="p-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer"
                  title={t.reopenLesson || "Reopen lesson"}
                >
                  <ExternalLink size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;