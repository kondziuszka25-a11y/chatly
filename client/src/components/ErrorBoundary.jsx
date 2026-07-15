import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl mb-4">
              <AlertTriangle size={32} className="text-rose-400" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-100 mb-2">
              Coś poszło nie tak
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Wystąpił nieoczekiwany błąd w aplikacji. Spróbuj odświeżyć widok.
            </p>

            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-6 text-left overflow-auto max-h-32">
                <p className="text-xs text-rose-400 font-mono break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-medium shadow-md transition-all"
              >
                <RefreshCw size={16} />
                Spróbuj ponownie
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-5 py-2.5 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-sm font-medium transition-all"
              >
                Odśwież stronę
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
