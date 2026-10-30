import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[MooScript] Render crash:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background text-on-surface p-6 text-center"
      >
        <h1 className="text-xl font-bold">Terjadi kesalahan tak terduga</h1>
        <p className="text-sm text-text-muted max-w-md">
          Proyek Anda tersimpan otomatis di browser. Muat ulang aplikasi untuk melanjutkan.
        </p>
        <pre className="font-mono text-xs text-text-muted max-w-full overflow-auto">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          Muat Ulang
        </button>
      </div>
    );
  }
}
