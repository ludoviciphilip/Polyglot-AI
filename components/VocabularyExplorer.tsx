import React, { useState, useMemo } from 'react';
import { Search, X, ArrowDownAZ, ArrowUpZA, Plus, Trash2, Sparkles, BookOpen, Check } from 'lucide-react';

interface VocabularyExplorerProps {
  words: string[];
  onChangeWords?: (words: string[]) => void;
  targetLanguage: string;
  t: any;
  allowEdit?: boolean;
}

export const VocabularyExplorer: React.FC<VocabularyExplorerProps> = ({
  words,
  onChangeWords,
  targetLanguage,
  t,
  allowEdit = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'az' | 'za'>('default');
  const [newWordInput, setNewWordInput] = useState('');
  const [copiedWord, setCopiedWord] = useState<string | null>(null);

  // Filter and sort words
  const filteredWords = useMemo(() => {
    let result = words.filter(word => 
      word.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );

    if (sortBy === 'az') {
      result = [...result].sort((a, b) => a.localeCompare(b));
    } else if (sortBy === 'za') {
      result = [...result].sort((a, b) => b.localeCompare(a));
    }

    return result;
  }, [words, searchTerm, sortBy]);

  const handleAddWord = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = newWordInput.trim().toLowerCase();
    if (!trimmed) return;
    
    // Check if word already exists (case-insensitive)
    if (words.some(w => w.toLowerCase() === trimmed)) {
      alert(`"${trimmed}" ${t.wordAlreadyExists || "is already in your known vocabulary list."}`);
      return;
    }

    const updated = [...words, trimmed];
    onChangeWords?.(updated);
    setNewWordInput('');
  };

  const handleRemoveWord = (wordToRemove: string) => {
    const updated = words.filter(w => w !== wordToRemove);
    onChangeWords?.(updated);
  };

  const handleCopyWord = (word: string) => {
    navigator.clipboard?.writeText(word);
    setCopiedWord(word);
    setTimeout(() => setCopiedWord(null), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Search and Sort Control Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-grow">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchVocab || "Search known words..."}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
              title={t.clearFilter || "Clear search"}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 border border-slate-200/50 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSortBy('default')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sortBy === 'default'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {t.sortDefault || "Default"}
          </button>
          <button
            type="button"
            onClick={() => setSortBy('az')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              sortBy === 'az'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title={t.sortAZTitle || "Sort A to Z"}
          >
            <ArrowDownAZ size={14} /> A-Z
          </button>
          <button
            type="button"
            onClick={() => setSortBy('za')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              sortBy === 'za'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title={t.sortZATitle || "Sort Z to A"}
          >
            <ArrowUpZA size={14} /> Z-A
          </button>
        </div>
      </div>

      {/* Quick Add Word (if editing allowed) */}
      {allowEdit && onChangeWords && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newWordInput}
            onChange={(e) => setNewWordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAddWord();
              }
            }}
            placeholder={`${t.newWordPlaceholder || "Add new word to vocabulary..."} (${targetLanguage})`}
            className="flex-grow px-3.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 outline-none text-xs transition-all"
          />
          <button
            type="button"
            onClick={handleAddWord}
            disabled={!newWordInput.trim()}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Plus size={14} /> {t.addWord || "Add Word"}
          </button>
        </div>
      )}

      {/* Filter and stats meta */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          {t.showing || "Showing"}{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-bold">{filteredWords.length}</strong>{' '}
          {t.of || "of"}{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-bold">{words.length}</strong>{' '}
          {t.words || "words"}
        </span>
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <X size={12} /> {t.clearFilter || "Clear search"}
          </button>
        )}
      </div>

      {/* Words Chips Grid */}
      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 max-h-72 overflow-y-auto">
        {filteredWords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filteredWords.map((word, idx) => {
              const isCopied = copiedWord === word;
              return (
                <div
                  key={`${word}-${idx}`}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer"
                  onClick={() => handleCopyWord(word)}
                  title={t.clickToCopy || "Click to copy"}
                >
                  <span className="font-mono">{word}</span>
                  {isCopied ? (
                    <Check size={12} className="text-emerald-500 shrink-0" />
                  ) : allowEdit && onChangeWords ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWord(word);
                      }}
                      className="opacity-40 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-0.5 rounded transition-all ml-0.5 cursor-pointer"
                      title={`${t.removeWord || "Remove"} "${word}"`}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {t.noWordsFound || "No matching words found."}
            </p>
            {searchTerm && (() => {
              const [before, after = ''] = (t.noWordsMatched || 'No words matched "{term}".').split('{term}');
              return (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {before}<span className="text-slate-600 dark:text-slate-300 font-semibold">{searchTerm}</span>{after}
                </p>
              );
            })()}
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t.clearFilter || "Clear search filter"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
