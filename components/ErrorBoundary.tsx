import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  t?: Record<string, string>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const t = this.props.t;
      return (
        <div className="p-8 max-w-lg mx-auto text-center space-y-6 my-12 bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-950/60 shadow-lg animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t?.errorBoundaryTitle || "Algo deu errado ao exibir a lição"}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {this.state.error?.message || t?.errorBoundaryFallbackMessage || "Ocorreu um erro inesperado no componente."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 text-sm cursor-pointer"
            >
              <RefreshCw size={16} /> {t?.errorBoundaryRetry || "Voltar e tentar novamente"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
