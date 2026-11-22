import React, { useState } from 'react';
import { Key, ExternalLink, Check, Copy, Sparkles, X, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface ApiKeyTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey?: string;
  onSaveKey?: (newKey: string) => void;
  t: any;
}

export const ApiKeyTutorialModal: React.FC<ApiKeyTutorialModalProps> = ({
  isOpen,
  onClose,
  currentApiKey = '',
  onSaveKey,
  t
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputKey, setInputKey] = useState(currentApiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const studioUrl = 'https://aistudio.google.com/app/apikey';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(studioUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSave = () => {
    if (onSaveKey) {
      onSaveKey(inputKey.trim());
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-start justify-between relative shrink-0">
          <div className="space-y-1 pr-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-md">
              <Sparkles size={14} className="text-amber-300" />
              <span>{t.freeAndQuick || "100% Gratuito & Rápido"}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              {t.howToGetApiKeyTitle || "Como Obter sua Chave Gratuita do Gemini"}
            </h2>
            <p className="text-indigo-100 text-xs md:text-sm max-w-lg">
              {t.howToGetApiKeySubtitle || "Use o Google AI Studio para gerar sua chave pessoal e estudar sem limites nem custos adicionais."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label={t.close || "Fechar"}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200">
          
          {/* Quick link banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0">
                <Key size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Google AI Studio — {t.getApiKey || "Obter chave de API"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  aistudio.google.com/app/apikey
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={studioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <span>{t.openGoogleStudio || "Abrir Google AI Studio"}</span>
                <ExternalLink size={14} />
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                title={t.copyLink || "Copiar link"}
              >
                {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Step by step */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t.stepByStepTutorial || "Passo a Passo (menos de 1 minuto)"}
            </h3>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0">
                  1
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.step1Title || "Acesse o portal oficial do Google AI Studio"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.step1Desc || "Faça login com sua conta Google padrão (Gmail). Nenhuma cobrança ou cartão de crédito é exigido para a cota gratuita."}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0">
                  2
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.step2Title || "Clique no botão \"Create API key\" (Criar chave de API)"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.step2Desc || "Se solicitado, escolha \"Create API key in new project\" ou selecione um projeto existente da sua conta Google."}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0">
                  3
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.step3Title || "Copie a sua chave gerada"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.step3Desc || "Sua chave é uma sequência de caracteres que geralmente inicia com \"AIzaSy...\". Copie-a para a área de transferência."}
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0">
                  4
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.step4Title || "Cole sua chave abaixo ou nas Configurações"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.step4Desc || "Salve sua chave. Ela será armazenada localmente no seu dispositivo e incluída nos seus backups JSON."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Paste & Save directly inside this modal */}
          {onSaveKey && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{t.pasteKeyDirectly || "Cole sua chave aqui para salvar agora:"}</span>
                {savedSuccess && (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 size={13} /> {t.saved || "Salvo com sucesso!"}
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder={t.apiKeyPlaceholder || "AIzaSy..."}
                  className="flex-grow px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!inputKey.trim() || savedSuccess}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {savedSuccess ? <Check size={14} /> : <ArrowRight size={14} />}
                  <span>{t.saveKey || "Salvar Chave"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Security & Privacy Card */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
            <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <p className="font-bold">
                {t.securityPrivacyTitle || "100% Seguro & Privado"}
              </p>
              <p className="leading-relaxed opacity-90">
                {t.securityPrivacyDesc || "Sua chave de API fica armazenada exclusivamente no seu navegador (localStorage) e nos seus backups JSON exportados. Suas requisições vão diretamente para a API oficial do Google Gemini sem intermediários."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            {t.close || "Fechar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyTutorialModal;
