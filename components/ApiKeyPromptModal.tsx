import React, { useState } from 'react';
import { Key, Sparkles, Settings as SettingsIcon, X, HelpCircle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ApiKeyPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToSettings: () => void;
  onOpenTutorial: () => void;
  onSaveKeyAndProceed: (key: string) => void;
  actionType: 'story' | 'review' | 'general';
  t: any;
}

export const ApiKeyPromptModal: React.FC<ApiKeyPromptModalProps> = ({
  isOpen,
  onClose,
  onGoToSettings,
  onOpenTutorial,
  onSaveKeyAndProceed,
  actionType,
  t
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSaveAndProceed = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setErrorMsg(t.apiKeyRequiredPrompt || "Por favor, insira uma chave de API válida.");
      return;
    }
    setErrorMsg('');
    onSaveKeyAndProceed(trimmed);
  };

  const actionTitle = actionType === 'review' 
    ? (t.reviewNeedsKey || "Chave Necessária para Revisar")
    : (t.lessonNeedsKey || "Chave Necessária para Gerar Lição");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with Warm Attention Color */}
        <div className="p-6 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white flex items-start justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shrink-0">
              <Key size={24} className="text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/20 text-[11px] font-bold text-amber-200 mb-1">
                <Sparkles size={12} />
                <span>Google Gemini AI</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight">
                {t.apiKeyRequiredTitle || "Cadastre sua Chave Gratuita do Gemini"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label={t.close || "Fechar"}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-slate-700 dark:text-slate-300">
          
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {t.apiKeyPromptNotice || "Para gerar histórias no Método Natural (i+1) e criar revisões personalizadas para seu nível, é necessário cadastrar sua chave de API do Google Gemini. É 100% gratuito e rápido!"}
          </p>

          {/* Quick key paste box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>{t.pasteKeyHerePrompt || "Cole sua chave da API abaixo:"}</span>
              <button
                type="button"
                onClick={onOpenTutorial}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <HelpCircle size={12} />
                <span>{t.howToGetAKey || "Como pegar grátis?"}</span>
              </button>
            </label>

            <div className="space-y-2">
              <input
                type="text"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={t.apiKeyPlaceholder || "AIzaSy..."}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {errorMsg && (
                <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveAndProceed}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>{t.saveAndGenerate || "Salvar Chave e Continuar"}</span>
            </button>
          </div>

          {/* Action links */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenTutorial}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all cursor-pointer"
            >
              <HelpCircle size={14} />
              <span>{t.viewStepByStepGuide || "Ver Tutorial Passo a Passo"}</span>
            </button>

            <button
              type="button"
              onClick={onGoToSettings}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <SettingsIcon size={14} />
              <span>{t.goToSettings || "Abrir Configurações"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>{t.apiKeySecurityBrief || "Sua chave é salva apenas localmente no navegador e nos backups JSON."}</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ApiKeyPromptModal;
