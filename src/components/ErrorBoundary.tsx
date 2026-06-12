import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Error Boundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload(); // Hard reset pre istotu
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="mb-4 rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Kritická chyba modulu</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Tento modul narazil na neočakávanú chybu. Aplikácia je chránená a beží ďalej, ale tento konkrétny vizuál zlyhal.
          </p>
          <div className="mb-6 max-w-lg rounded bg-background p-3 text-left text-xs font-mono text-destructive overflow-auto max-h-32 border border-destructive/20 shadow-inner">
            {this.state.error?.message || 'Neznáma chyba'}
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <RefreshCw size={16} /> Obnoviť modul
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
