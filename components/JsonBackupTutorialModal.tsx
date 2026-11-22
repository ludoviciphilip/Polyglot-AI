import React from 'react';
import { FileJson, Download, Upload, X, ShieldCheck, CheckCircle2, ArrowRight, Smartphone, Laptop, Sparkles, RefreshCw } from 'lucide-react';

interface JsonBackupTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport?: () => void;
  onTriggerImport?: () => void;
  t: any;
}

export const JsonBackupTutorialModal: React.FC<JsonBackupTutorialModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onTriggerImport,
  t
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-700 text-white flex items-start justify-between relative shrink-0">
          <div className="space-y-1 pr-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-md">
              <FileJson size={14} className="text-emerald-200" />
              <span>{t.backupSystem || "Backup Local e Portátil"}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              {t.backupRestoreTitle || "Como Salvar e Restaurar seu Progresso (JSON)"}
            </h2>
            <p className="text-emerald-100 text-xs md:text-sm max-w-lg">
              {t.backupRestoreSubtitle || "Aprenda a fazer backup dos seus dados, transferir seu aprendizado entre dispositivos e nunca perder seu progresso."}
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
          
          {/* Why backup card */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5 text-sm">
              <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
              {t.whyBackupTitle || "Por que salvar seus dados em JSON?"}
            </p>
            <p className="leading-relaxed opacity-95">
              {t.whyBackupDesc || "O Polyglot i+1 funciona com foco total em privacidade: seus dados ficam armazenados localmente no seu navegador. Exportar um arquivo JSON permite que você crie pontos de restauração e use o app em qualquer computador, tablet ou celular sem criar contas em servidores externos!"}
            </p>
          </div>

          {/* Dual Columns: Export vs Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Export Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                  <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60">
                    <Download size={18} />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {t.howToExportTitle || "1. Como Salvar (Exportar)"}
                  </h3>
                </div>

                <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">{t.clickExportBtn || "Clique em \"Exportar Dados\":"}</strong> {t.exportStep1 || "disponível nas Configurações ou logo abaixo."}
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">{t.downloadJson || "Download automático:"}</strong> {t.exportStep2 || "um arquivo .json com a data atual é salvo nos seus Downloads."}
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">{t.safeStorage || "O que está incluído:"}</strong> {t.exportStep3 || "seu vocabulário completo, nível CECR, dias de sequência, histórico de histórias lidas e sua chave API."}
                  </li>
                </ol>
              </div>

              {onExport && (
                <button
                  type="button"
                  onClick={onExport}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>{t.exportNowBtn || "Exportar Meus Dados Agora"}</span>
                </button>
              )}
            </div>

            {/* Import Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60">
                    <Upload size={18} />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {t.howToImportTitle || "2. Como Restaurar (Importar)"}
                  </h3>
                </div>

                <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">{t.clickImportBtn || "Clique em \"Importar Dados\":"}</strong> {t.importStep1 || "nas Configurações ou pelo botão abaixo."}
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">{t.selectJson || "Selecione o arquivo:"}</strong> {t.importStep2 || "escolha o arquivo .json que você salvou anteriormente."}
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">{t.instantSync || "Restauração imediata:"}</strong> {t.importStep3 || "o aplicativo recarrega todas as suas palavras, lições concluídas e chave de API na mesma hora!"}
                  </li>
                </ol>
              </div>

              {onTriggerImport && (
                <button
                  type="button"
                  onClick={() => {
                    onTriggerImport();
                    onClose();
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Upload size={15} />
                  <span>{t.importNowBtn || "Importar Arquivo JSON"}</span>
                </button>
              )}
            </div>

          </div>

          {/* Cross device sync tip */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-1 text-slate-500 shrink-0 mt-0.5">
              <Laptop size={18} />
              <ArrowRight size={12} />
              <Smartphone size={18} />
            </div>
            <div className="space-y-1 text-slate-600 dark:text-slate-400">
              <p className="font-bold text-slate-900 dark:text-white">
                {t.deviceSyncTipTitle || "Dica: Mudar de Dispositivo ou Navegador"}
              </p>
              <p className="leading-relaxed">
                {t.deviceSyncTipDesc || "Você pode exportar o arquivo JSON no seu computador e importá-lo no celular (ou vice-versa) enviando o arquivo pelo WhatsApp, e-mail ou Google Drive para continuar sua sequência de dias de onde parou."}
              </p>
            </div>
          </div>

          {/* Privacy footer info */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>{t.jsonPrivacyNote || "Os arquivos JSON pertencem a você e ficam 100% sob seu controle local."}</span>
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

export default JsonBackupTutorialModal;
