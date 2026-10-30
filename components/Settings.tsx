
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, CEFRLevel, UILanguage, StorySize, AncientGreekDialect, AncientGreekFocus, ShakespeareanFocus, NoveltyDensity } from '../types';
import { User, Globe, GraduationCap, Save, Bell, Moon, Languages, Info, Download, Upload, Database, BookOpen, ScrollText, BrainCircuit, Feather, Sparkles, Search, Target, Key, Eye, EyeOff, HelpCircle, FileJson, CheckCircle2, ShieldCheck, X, Layers, Volume2 } from 'lucide-react';
import { VocabularyExplorer } from './VocabularyExplorer';
import { ApiKeyTutorialModal } from './ApiKeyTutorialModal';
import { JsonBackupTutorialModal } from './JsonBackupTutorialModal';

import { STARTER_VOCABULARY, resolveNativeLanguage, isExperimentalLanguage } from '../utils/starterVocab';

interface SettingsProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  t: any;
}

const Settings: React.FC<SettingsProps> = ({ profile, setProfile, onExport, onImport, t }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [vocabViewMode, setVocabViewMode] = useState<'interactive' | 'raw'>('interactive');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isApiKeyTutorialOpen, setIsApiKeyTutorialOpen] = useState(false);
  const [isJsonTutorialOpen, setIsJsonTutorialOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep local state in sync when external profile changes (e.g. on JSON import)
  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleSave = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    setSaveStatus('saving');
    setTimeout(() => {
      setProfile(formData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const loadStarterVocabForLanguage = () => {
    const starter = STARTER_VOCABULARY[formData.targetLanguage] || STARTER_VOCABULARY['English'];
    setFormData({
      ...formData,
      knownWords: starter
    });
  };

  const requestNotificationPermission = async () => {
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        setFormData({ ...formData, notificationsEnabled: true });
      } else {
        alert("Permission denied. Enable notifications in your browser settings.");
      }
    } else {
      setFormData({ ...formData, notificationsEnabled: !formData.notificationsEnabled });
    }
  };

  const cefrLevels: CEFRLevel[] = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const languages = [
    'English', 'Shakespearean English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 
    'Japanese', 'Chinese', 'Russian', 'Latin', 'Modern Greek', 'Ancient Greek'
  ];
  const uiLanguages: {code: UILanguage, label: string}[] = [
    {code: 'pt', label: 'Português'},
    {code: 'en', label: 'English'},
    {code: 'es', label: 'Español'},
    {code: 'fr', label: 'Français'},
    {code: 'de', label: 'Deutsch'},
    {code: 'it', label: 'Italiano'}
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center">{t.settings}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-center">{t.customizeExperience || "Customize your experience"}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        {/* Core Profile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <User size={16} /> {t.displayName || "Display Name"}
            </label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <GraduationCap size={16} /> {t.cefr || "CEFR Level"}
            </label>
            <select 
              value={formData.level}
              onChange={(e) => setFormData({...formData, level: e.target.value as CEFRLevel})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              {cefrLevels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Learning Preferences */}
        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen size={20} /> {t.learningPreferences || "Learning Preferences"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t.targetLanguage || "Target Language"}
              </label>
              <select 
                value={formData.targetLanguage}
                onChange={(e) => setFormData({...formData, targetLanguage: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {languages.map(l => <option key={l} value={l}>{l === 'Shakespearean English' ? (t.shakespearean || l) : l}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t.storySize}
              </label>
              <select 
                value={formData.storySize}
                onChange={(e) => setFormData({...formData, storySize: e.target.value as StorySize})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="short">{t.short}</option>
                <option value="standard">{t.standard}</option>
                <option value="medium">{t.medium}</option>
                <option value="long">{t.long}</option>
              </select>
            </div>
          </div>

          {/* New Word Density (i+1) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>{t.noveltyDensityTitle || "New Word Density (i+1)"}</span>
              </label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                {(formData.noveltyDensity || 'high') === 'high'
                  ? (t.noveltyHighTag || "1 new / sentence")
                  : formData.noveltyDensity === 'normal'
                  ? (t.noveltyNormalTag || "~70% sentences")
                  : (t.noveltyLowTag || "~40% sentences")}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.noveltyDensityDesc || "Control how many sentences introduce a new vocabulary element."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* High */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, noveltyDensity: 'high' })}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  (formData.noveltyDensity || 'high') === 'high'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>{t.noveltyHigh || "High"}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      100%
                    </span>
                  </div>
                  <p className="text-xs mt-1.5 text-slate-500 dark:text-slate-400 leading-snug">
                    {t.noveltyHighDesc || "One new word per sentence (100% of sentences)"}
                  </p>
                </div>
              </button>

              {/* Normal */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, noveltyDensity: 'normal' })}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  formData.noveltyDensity === 'normal'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>{t.noveltyNormal || "Normal"}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      ~70%
                    </span>
                  </div>
                  <p className="text-xs mt-1.5 text-slate-500 dark:text-slate-400 leading-snug">
                    {t.noveltyNormalDesc || "About 70% of sentences have a new word; the rest reinforce known words"}
                  </p>
                </div>
              </button>

              {/* Low */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, noveltyDensity: 'low' })}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  formData.noveltyDensity === 'low'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>{t.noveltyLow || "Low"}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      ~40%
                    </span>
                  </div>
                  <p className="text-xs mt-1.5 text-slate-500 dark:text-slate-400 leading-snug">
                    {t.noveltyLowDesc || "About 40% of sentences have a new word (relaxed, extensive reading)"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Strict New Words (Root & Stem Filter) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>{t.strictNewWordsTitle || "Strict Root & Stem Filter"}</span>
              </label>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                (formData.strictNewWords !== false)
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {(formData.strictNewWords !== false) ? (t.strictNewWordsEnabled || "Active") : (t.strictNewWordsDisabled || "Relaxed")}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.strictNewWordsDesc || "Rejects derivations, suffixes, and inflections of already known words (-issimo, -mente, plurals) so only genuinely new roots are introduced."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, strictNewWords: true })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  (formData.strictNewWords !== false)
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-600 font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-sm">{t.strictNewWordsEnabled || "Strict Filter (Active)"}</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, strictNewWords: false })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  (formData.strictNewWords === false)
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-600 font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-sm">{t.strictNewWordsDisabled || "Relaxed (Allow derivations)"}</div>
              </button>
            </div>
          </div>

          {/* Experimental Language Notice */}
          {isExperimentalLanguage(formData.targetLanguage) && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
                <span>{t.experimentalLangBadge || "Idioma Experimental"}</span>
              </div>
              <p className="leading-relaxed">
                {t.experimentalLangNote || "Acentuação, transcrições fonéticas (IPA) e pronúncia reconstruída podem conter imprecisões históricas ou ortográficas."}
              </p>
            </div>
          )}

          {/* Conditional Style Selection for Shakespearean English */}
          {formData.targetLanguage === 'Shakespearean English' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 bg-amber-50/50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-200/70 dark:border-amber-900/40">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Feather size={16} className="text-amber-600 dark:text-amber-400" /> {t.shakespeareanStyle}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, shakespeareanFocus: 'general'})}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center text-center ${(!formData.shakespeareanFocus || formData.shakespeareanFocus === 'general') ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                  >
                    {t.generalShakespearean}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, shakespeareanFocus: 'drama'})}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center text-center ${formData.shakespeareanFocus === 'drama' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                  >
                    {t.dramaShakespearean}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, shakespeareanFocus: 'courtly'})}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center text-center ${formData.shakespeareanFocus === 'courtly' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                  >
                    {t.courtlyShakespearean}
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 italic flex items-center gap-1">
                  <Sparkles size={12} className="shrink-0" />
                  {formData.shakespeareanFocus === 'drama'
                    ? (t.shakespeareanDramaDesc || "Tragedy & epic drama: solemn themes, fate, honor, and poetic soliloquies.")
                    : formData.shakespeareanFocus === 'courtly'
                    ? (t.shakespeareanCourtlyDesc || "Courtly romance and sonnets: wordplay, lyrical elegance, and romantic wit.")
                    : (t.shakespeareanGeneralDesc || "Classic Elizabethan English: archaic pronouns (thou/thee/thy), verbal inflections (-eth/-est), and theatrical cadence.")
                  }
                </p>
              </div>
            </div>
          )}

          {/* Conditional Dialect Selection for Ancient Greek */}
          {formData.targetLanguage === 'Ancient Greek' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ScrollText size={16} /> {t.dialect}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, ancientGreekDialect: 'attic'})}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${formData.ancientGreekDialect === 'attic' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    {t.attic}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, ancientGreekDialect: 'koine'})}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${formData.ancientGreekDialect === 'koine' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    {t.koine}
                  </button>
                </div>
              </div>

              {/* Focus Selection for Attic Greek */}
              {formData.ancientGreekDialect === 'attic' && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300 border-l-2 border-indigo-200 dark:border-indigo-800 pl-4 py-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <BrainCircuit size={16} /> {t.focus}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, ancientGreekFocus: 'general'})}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${formData.ancientGreekFocus === 'general' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                    >
                      {t.generalAttic}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, ancientGreekFocus: 'philosophical'})}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${formData.ancientGreekFocus === 'philosophical' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                    >
                      {t.philosophicalAttic}
                    </button>
                  </div>
                  {formData.ancientGreekFocus === 'philosophical' && (
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1 font-medium italic">
                      {t.philosophicalDesc || "Specialized vocabulary: Plato and Aristotle"}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Localization & Notifications */}
        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Languages size={20} /> {t.localization || "Localization"}
          </h3>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t.interfaceLanguage || "Interface Language"}
            </label>
            <select 
              value={formData.uiLanguage}
              onChange={(e) => {
                const newUi = e.target.value as UILanguage;
                setFormData({
                  ...formData,
                  uiLanguage: newUi,
                  nativeLanguage: resolveNativeLanguage(newUi)
                });
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              {uiLanguages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.nativeLanguageSyncHint || "A IA usará esta língua como idioma nativo nas explicações, traduções e interface."}
            </p>
          </div>
        </div>

        {/* Daily Study Goal */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Target size={20} className="text-indigo-600 dark:text-indigo-400" /> {t.dailyGoal || "Daily Study Goal"}
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              {formData.dailyGoal || 1} {t.dailyGoalTarget || "lessons / day"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.dailyGoalDesc || "Set target lessons to complete each day"}
          </p>

          <div className="grid grid-cols-4 gap-2.5">
            {[1, 2, 3, 5].map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setFormData({ ...formData, dailyGoal: target })}
                className={`py-3 px-3 rounded-xl border text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                  (formData.dailyGoal || 1) === target
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                }`}
              >
                <span>{target}</span>
                <span className="text-[10px] font-normal opacity-80">
                  {target === 1 ? (t.lesson || "lesson") : (t.lessons || "lessons")}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
              {t.customGoal || "Custom goal:"}
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={formData.dailyGoal || 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 50) {
                  setFormData({ ...formData, dailyGoal: val });
                }
              }}
              className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <span className="text-xs text-slate-400">{t.dailyGoalTarget || "lessons / day"}</span>
          </div>
        </div>

        {/* SRS Daily New Cards Limit */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Layers size={20} className="text-indigo-600 dark:text-indigo-400" /> {t.dailyNewCardsLimitTitle || "Limite Diário de Novos Cards SRS"}
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              {(formData.dailyNewCardsLimit === undefined ? 0 : formData.dailyNewCardsLimit) === 0
                ? (t.noLimit || "Sem limite")
                : `${formData.dailyNewCardsLimit ?? 0} ${t.cardsPerDay || "cards / dia"}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.dailyNewCardsLimitDesc || "Controla a introdução de novas frases por dia. Cards de revisão devidos nunca são limitados."}
          </p>

          <div className="grid grid-cols-4 gap-2.5">
            {[0, 10, 20, 30].map((limit) => {
              const currentVal = formData.dailyNewCardsLimit === undefined ? 0 : formData.dailyNewCardsLimit;
              const isSelected = currentVal === limit;
              return (
                <button
                  key={limit}
                  type="button"
                  onClick={() => setFormData({ ...formData, dailyNewCardsLimit: limit })}
                  className={`py-3 px-3 rounded-xl border text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                  }`}
                >
                  <span>{limit === 0 ? "∞" : limit}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    {limit === 0 ? `${t.noLimit || "Sem limite"} (${t.default || "Padrão"})` : (t.cards || "cards")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bell size={20} /> {t.notificationsDisplay || "Notifications & Display"}
          </h3>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">{t.studyNotifications || "Study Notifications"}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.dailyReminders || "Daily reminders"}</p>
            </div>
            <button 
              type="button"
              onClick={requestNotificationPermission}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.notificationsEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Anki Spaced Repetition Settings */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Layers size={20} className="text-indigo-600 dark:text-indigo-400" />
              {t.srsSettingsTitle || "Revisão Espaçada (SRS / Anki)"}
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full">
              Curva do Esquecimento
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t.srsSettingsSubtitle || "Configure como o verso de cada flashcard i+1 é apresentado durante as revisões de repetição espaçada."}
          </p>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              {t.srsCardBackSetting || "Conteúdo Principal do Verso do Card"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, srsBackType: 'full_translation' })}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  (formData.srsBackType || 'full_translation') === 'full_translation'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">📝</span>
                  {(formData.srsBackType || 'full_translation') === 'full_translation' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {t.srsBackFull || "Tradução Completa"}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t.srsBackFullDesc || "Frase inteira no idioma nativo"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, srsBackType: 'element_translation' })}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  formData.srsBackType === 'element_translation'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">🎯</span>
                  {formData.srsBackType === 'element_translation' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {t.srsBackElement || "Tradução do Elemento"}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t.srsBackElementDesc || "Foco no elemento i+1 isolado"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, srsBackType: 'target_definition' })}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  formData.srsBackType === 'target_definition'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">🌐</span>
                  {formData.srsBackType === 'target_definition' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {t.srsBackDefinition || "Definição no Alvo"}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t.srsBackDefinitionDesc || "100% imersão no idioma"}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* SRS Auto Play Audio Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5 pr-4">
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Volume2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                {t.srsAutoPlayAudio || "Áudio Automático nos Cards (TTS)"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.srsAutoPlayAudioDesc || "Reproduz a frase automaticamente com o sintetizador do navegador ao exibir cada card no Anki. No botão manual, usa a voz natural de IA."}
              </p>
            </div>
            <button 
              type="button"
              onClick={() => setFormData({ ...formData, srsAutoPlayAudio: !(formData.srsAutoPlayAudio ?? true) })}
              className={`w-12 h-6 rounded-full transition-all relative shrink-0 cursor-pointer ${(formData.srsAutoPlayAudio ?? true) ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${(formData.srsAutoPlayAudio ?? true) ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Gemini API Key Section */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Key size={20} className="text-amber-500" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {t.apiKey || "Chave de API do Gemini"}
                </h3>
                {formData.apiKey && formData.apiKey.trim().length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={12} />
                    {t.apiKeyConfigured || "Chave Configurada"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Info size={12} />
                    {t.apiKeyMissing || "Nenhuma chave configurada"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.apiKeySubtitle || "Necessária para gerar histórias exclusivas (i+1) e revisões de vocabulário com inteligência artificial."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsApiKeyTutorialOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl border border-indigo-100 dark:border-indigo-900/40 transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              <HelpCircle size={14} />
              <span>{t.howToGetFreeKey || "Como obter chave gratuita"}</span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="relative flex items-center">
              <input
                type={showApiKey ? "text" : "password"}
                value={formData.apiKey || ''}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={t.apiKeyPlaceholder || "Cole sua chave do Google Gemini (ex: AIzaSy...)"}
                className="w-full pl-4 pr-24 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {formData.apiKey && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, apiKey: '' })}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={t.clear || "Limpar"}
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title={showApiKey ? (t.hide || "Ocultar") : (t.show || "Mostrar")}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 pt-0.5">
              <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
              <span>{t.apiKeyHelp || "Sua chave fica salva no seu navegador (localStorage) e no backup JSON que você exportar."}</span>
            </p>
          </div>
        </div>

        {/* Data Management Section */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Database size={20} className="text-indigo-600 dark:text-indigo-400" /> {t.export} / {t.import}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.dataManagementSubtitle || "Exporte seu vocabulário, histórico e chave em formato JSON ou restaure seu progresso."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsJsonTutorialOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl border border-emerald-100 dark:border-emerald-900/40 transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              <FileJson size={14} />
              <span>{t.backupRestoreGuideBtn || "Como salvar & restaurar (Guia)"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={onExport} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-all cursor-pointer">
              <Download size={18} /> {t.export}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-all cursor-pointer">
              <Upload size={18} /> {t.import}
            </button>
            <input type="file" ref={fileInputRef} onChange={onImport} className="hidden" accept=".json" />
          </div>
        </div>

        {/* Vocab List - SEARCH BAR & INTERACTIVE EXPLORER */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" />
                {t.wordsLearned || "Known Vocabulary"} ({formData.knownWords.length})
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.vocabExplorerSubtitle || "Search, filter, or manage vocabulary used by Gemini for precise i+1 generation."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs">
                <button
                  type="button"
                  onClick={() => setVocabViewMode('interactive')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    vocabViewMode === 'interactive'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.interactiveView || "Search & Filter"}
                </button>
                <button
                  type="button"
                  onClick={() => setVocabViewMode('raw')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    vocabViewMode === 'raw'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.rawEdit || "Raw CSV"}
                </button>
              </div>
              <button
                type="button"
                onClick={loadStarterVocabForLanguage}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                title={t.loadStarterVocab}
              >
                <Sparkles size={13} /> {t.loadStarterVocab}
              </button>
            </div>
          </div>

          {vocabViewMode === 'interactive' ? (
            <VocabularyExplorer
              words={formData.knownWords}
              onChangeWords={(newWords) => setFormData({ ...formData, knownWords: newWords })}
              targetLanguage={formData.targetLanguage}
              t={t}
              allowEdit={true}
            />
          ) : (
            <div className="space-y-2">
              <textarea 
                value={formData.knownWords.join(', ')}
                onChange={(e) => setFormData({...formData, knownWords: e.target.value.split(',').map(w => w.trim()).filter(w => w !== '')})}
                rows={8}
                placeholder="word1, word2, word3..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono leading-relaxed"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Info size={12} /> {t.separateCommas || "Separate words with commas. Changes will be saved."}
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 pt-1">
            <Info size={12} /> {t.sendingWordsToAI || "Sending words to Gemini for precise i+1 generation"} ({formData.knownWords.length} {t.words || "words"})
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus !== 'idle'}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-slate-500 cursor-pointer"
        >
          {saveStatus === 'saving' ? (t.saving || 'Saving...') : saveStatus === 'saved' ? (t.saved || 'Saved!') : (
            <><Save size={20} /> {t.saveChanges || "Save Changes"}</>
          )}
        </button>
      </div>

      {/* API Key Step-by-Step Tutorial Modal */}
      <ApiKeyTutorialModal
        isOpen={isApiKeyTutorialOpen}
        onClose={() => setIsApiKeyTutorialOpen(false)}
        currentApiKey={formData.apiKey}
        onSaveKey={(newKey) => {
          setFormData({ ...formData, apiKey: newKey });
          setProfile({ ...formData, apiKey: newKey });
        }}
        t={t}
      />

      {/* JSON Backup & Restore Tutorial Modal */}
      <JsonBackupTutorialModal
        isOpen={isJsonTutorialOpen}
        onClose={() => setIsJsonTutorialOpen(false)}
        onExport={onExport}
        onTriggerImport={() => fileInputRef.current?.click()}
        t={t}
      />
    </div>
  );
};

export default Settings;
