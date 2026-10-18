import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    window.location.href = isAdminPath ? '/admin' : '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Terjadi kesalahan tidak terduga pada antarmuka.';
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-[500px] w-full flex items-center justify-center p-6 text-white font-sans">
          <div className="bg-[#1c1d23] border border-white/[0.08] rounded-[28px] max-w-lg w-full p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                {this.props.fallbackTitle || 'Terjadi Kendala Memuat Halaman'}
              </h2>
              <p className="text-xs text-rose-300 font-mono bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 text-left break-all select-all">
                {errorMsg}
              </p>
            </div>

            {errorStack && (
              <details className="text-left text-xs bg-black/40 border border-white/[0.06] rounded-xl p-3">
                <summary className="text-[11px] text-gray-400 hover:text-gray-200 cursor-pointer font-medium select-none">
                  Lihat Stack Trace / Detail Teknis
                </summary>
                <pre className="mt-2 text-[10px] text-gray-400 font-mono overflow-x-auto max-h-40 whitespace-pre-wrap select-all">
                  {errorStack}
                </pre>
              </details>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-semibold transition-all border border-white/[0.06] flex items-center gap-2 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Ke Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
