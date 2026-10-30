import React, { useState } from 'react';
import { User, Globe, Compass, Sparkles, ArrowRight, GraduationCap } from 'lucide-react';
import { CEFRLevel, UILanguage } from '../types';
import { NATIVE_LANGUAGES, TARGET_LANGUAGES, UI_LANGUAGE_TO_NATIVE_NAME, isExperimentalLanguage, getStarterVocabulary } from '../utils/starterVocab';
import { loadEnglishVocab } from '../utils/vocabLoader';
import translations from '../locales';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (data: {
    name: string;
    nativeLanguage: string;
    uiLanguage: UILanguage;
    targetLanguage: string;
    knownWords: string[];
  }) => void;
}

const ENGLISH_LEVELS: { level: CEFRLevel; colSpan?: boolean }[] = [
  { level: 'Pre-A1', colSpan: true },
  { level: 'A1' },
  { level: 'A2' },
  { level: 'B1' },
  { level: 'B2' },
];

const ONBOARDING_TEXTS: Record<UILanguage, {
  badge: string;
  title: string;
  subtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  nativeLabel: string;
  nativeHint: string;
  targetLabel: string;
  targetHint: string;
  startBtn: string;
  note: string;
}> = {
  pt: {
    badge: "Boas-vindas ao Polyglot i+1",
    title: "Configure seu Perfil de Aprendizado",
    subtitle: "Aprenda pelo Método Natural (i+1) com histórias geradas por IA no seu ritmo.",
    nameLabel: "Como devemos te chamar?",
    namePlaceholder: "Ex: Felipe, Maria, Alex...",
    nativeLabel: "Sua Língua Nativa",
    nativeHint: "A IA usará esta língua para traduções, explicações e interface.",
    targetLabel: "Idioma que Você Quer Aprender",
    targetHint: "Você poderá mudar ou explorar outros idiomas a qualquer momento.",
    startBtn: "Começar Minha Jornada",
    note: "Tudo é salvo localmente no seu dispositivo. Você pode exportar seus dados a qualquer momento.",
  },
  en: {
    badge: "Welcome to Polyglot i+1",
    title: "Set Up Your Learning Profile",
    subtitle: "Acquire languages naturally through AI-crafted stories adapted to your vocabulary.",
    nameLabel: "What should we call you?",
    namePlaceholder: "e.g. Alex, Sarah, Jordan...",
    nativeLabel: "Your Native Language",
    nativeHint: "AI will use this language for translations, explanations, and interface.",
    targetLabel: "Language You Want to Learn",
    targetHint: "You can change or switch languages anytime in Settings.",
    startBtn: "Start My Journey",
    note: "Everything is stored locally on your device. You can export backups anytime.",
  },
  es: {
    badge: "Bienvenido a Polyglot i+1",
    title: "Configura tu Perfil de Aprendizaje",
    subtitle: "Aprende con el Método Natural (i+1) a través de historias adaptadas a tu nivel.",
    nameLabel: "¿Cómo te gustaría que te llamemos?",
    namePlaceholder: "Ej: Carlos, Elena, Mateo...",
    nativeLabel: "Tu Idioma Nativo",
    nativeHint: "La IA usará este idioma para traducciones, explicaciones e interfaz.",
    targetLabel: "Idioma que Quieres Aprender",
    targetHint: "Puedes cambiar de idioma en cualquier momento en Configuración.",
    startBtn: "Comenzar Mi Viaje",
    note: "Todo se guarda localmente en tu dispositivo. Puedes exportar copias cuando quieras.",
  },
  fr: {
    badge: "Bienvenue sur Polyglot i+1",
    title: "Configurez votre Profil d'Apprentissage",
    subtitle: "Apprenez avec la Méthode Naturelle (i+1) grâce à des histoires adaptées.",
    nameLabel: "Comment devons-nous vous appeler ?",
    namePlaceholder: "Ex : Camille, Thomas, Julie...",
    nativeLabel: "Votre Langue Maternelle",
    nativeHint: "L'IA utilisera cette langue pour les traductions et l'interface.",
    targetLabel: "Langue que Vous Souhaitez Apprendre",
    targetHint: "Vous pourrez changer de langue à tout moment.",
    startBtn: "Commencer Mon Voyage",
    note: "Toutes les données restent locales sur votre appareil.",
  },
  de: {
    badge: "Willkommen bei Polyglot i+1",
    title: "Richte dein Lernprofil ein",
    subtitle: "Lerne Sprachen nach der Natürlichen Methode (i+1) mit maßgeschneiderten Geschichten.",
    nameLabel: "Wie dürfen wir dich nennen?",
    namePlaceholder: "Z.B. Lukas, Anna, Jonas...",
    nativeLabel: "Deine Muttersprache",
    nativeHint: "Die KI nutzt diese Sprache für Erklärungen, Übersetzungen und Menüs.",
    targetLabel: "Sprache, die du lernen möchtest",
    targetHint: "Du kannst die Zielsprache jederzeit in den Einstellungen ändern.",
    startBtn: "Meine Reise beginnen",
    note: "Alle Daten werden lokal in deinem Browser gespeichert.",
  },
  it: {
    badge: "Benvenuto su Polyglot i+1",
    title: "Configura il tuo Profilo di Studio",
    subtitle: "Impara le lingue con il Metodo Naturale (i+1) attraverso storie su misura.",
    nameLabel: "Come possiamo chiamarti?",
    namePlaceholder: "Es: Marco, Giulia, Leonardo...",
    nativeLabel: "La tua Lingua Madre",
    nativeHint: "L'IA userà questa lingua per traduzioni, spiegazioni e interfaccia.",
    targetLabel: "Lingua che Vuoi Imparare",
    targetHint: "Potrai cambiare lingua in qualsiasi momento nelle impostazioni.",
    startBtn: "Inizia il Mio Viaggio",
    note: "Tutti i tuoi progressi sono salvati localmente sul tuo dispositivo.",
  },
};

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete
}) => {
  const [name, setName] = useState('');
  const [selectedUiLang, setSelectedUiLang] = useState<UILanguage>('pt');
  const [selectedTargetLang, setSelectedTargetLang] = useState('English');
  const [selectedEnglishLevel, setSelectedEnglishLevel] = useState<CEFRLevel | null>(null);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  if (!isOpen) return null;

  const onboardingText = ONBOARDING_TEXTS[selectedUiLang] || ONBOARDING_TEXTS.en;
  const t = translations[selectedUiLang] || translations.en;

  const getLevelDesc = (level: CEFRLevel): string => {
    const key = `onboardingLevel${level.replace('-', '')}Desc` as keyof typeof t;
    return (t[key] as string) || '';
  };

  const handleNativeLangChange = (uiCode: UILanguage) => {
    setSelectedUiLang(uiCode);
    const nativeName = UI_LANGUAGE_TO_NATIVE_NAME[uiCode] || 'Portuguese';
    // If target language is identical to the newly selected native language, swap to English or Spanish
    if (selectedTargetLang === nativeName) {
      setSelectedTargetLang(nativeName === 'English' ? 'Spanish' : 'English');
    }
  };

  const handleTargetLangChange = (lang: string) => {
    setSelectedTargetLang(lang);
    setSelectedEnglishLevel(null);
    setHasAttemptedSubmit(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    if (selectedTargetLang === 'English' && !selectedEnglishLevel) return;

    const finalName = name.trim() || (selectedUiLang === 'pt' ? 'Explorador' : 'Learner');
    const nativeName = UI_LANGUAGE_TO_NATIVE_NAME[selectedUiLang] || 'Portuguese';

    let knownWords: string[];
    if (selectedTargetLang === 'English' && selectedEnglishLevel && selectedEnglishLevel !== 'Pre-A1') {
      setIsLoadingVocab(true);
      try {
        const loaded = await loadEnglishVocab(selectedEnglishLevel);
        knownWords = loaded.length > 0 ? [...loaded] : [...getStarterVocabulary('English')];
      } finally {
        setIsLoadingVocab(false);
      }
    } else {
      knownWords = [...getStarterVocabulary(selectedTargetLang)];
    }

    onComplete({ name: finalName, nativeLanguage: nativeName, uiLanguage: selectedUiLang, targetLanguage: selectedTargetLang, knownWords });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Hero */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white relative shrink-0">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold text-indigo-100">
              <Sparkles size={14} className="text-amber-300" />
              <span>{onboardingText.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {onboardingText.title}
            </h2>
            <p className="text-sm text-indigo-100/90 leading-relaxed max-w-md">
              {onboardingText.subtitle}
            </p>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto max-h-[calc(100dvh-8rem)]">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* 1. User Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <User size={15} className="text-indigo-600 dark:text-indigo-400" />
                <span>{onboardingText.nameLabel}</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={onboardingText.namePlaceholder}
                autoFocus
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
              />
            </div>

            {/* 2. Native Language / UI Language */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Globe size={15} className="text-indigo-600 dark:text-indigo-400" />
                  {onboardingText.nativeLabel}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {NATIVE_LANGUAGES.map((lang) => {
                  const isSelected = selectedUiLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleNativeLangChange(lang.code)}
                      className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30 font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 font-medium'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm truncate">{lang.nativeLabel}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {onboardingText.nativeHint}
              </p>
            </div>

            {/* 3. Target Language to Learn */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Compass size={15} className="text-indigo-600 dark:text-indigo-400" />
                <span>{onboardingText.targetLabel}</span>
              </label>
              <div className="relative">
                <select
                  value={selectedTargetLang}
                  onChange={(e) => handleTargetLangChange(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-semibold cursor-pointer appearance-none"
                >
                  {TARGET_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.flag} {lang.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {onboardingText.targetHint}
              </p>
              {isExperimentalLanguage(selectedTargetLang) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  ⚠️ {translations[selectedUiLang]?.onboardingExperimentalWarning || translations.en.onboardingExperimentalWarning}
                </p>
              )}

              {/* Conditional English level picker */}
              <div
                aria-live="polite"
                className={`transition-all duration-300 overflow-hidden ${
                  selectedTargetLang === 'English' ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <GraduationCap size={15} className="text-indigo-600 dark:text-indigo-400" />
                    <span>{t.onboardingEnglishLevelLabel}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ENGLISH_LEVELS.map((lvl) => {
                      const isSelected = selectedEnglishLevel === lvl.level;
                      return (
                        <button
                          key={lvl.level}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedEnglishLevel(lvl.level)}
                          className={`flex flex-col px-3.5 py-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            lvl.colSpan ? 'col-span-2' : ''
                          } ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30 font-bold shadow-xs'
                              : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 font-medium'
                          }`}
                        >
                          <span className="text-sm font-bold">{lvl.level}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{getLevelDesc(lvl.level)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Validation message */}
                  {hasAttemptedSubmit && selectedTargetLang === 'English' && !selectedEnglishLevel && (
                    <p className="text-xs text-red-500">{t.onboardingLevelRequired}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="pt-3 space-y-3">
              <button
                type="submit"
                disabled={isLoadingVocab}
                className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoadingVocab ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    <span>{t.onboardingLoadingVocab}</span>
                  </>
                ) : (
                  <>
                    <span>{onboardingText.startBtn}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-slate-600 dark:text-slate-400">
                {onboardingText.note}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
