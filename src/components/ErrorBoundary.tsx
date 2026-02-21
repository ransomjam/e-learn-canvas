import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/**
 * Catches render-time errors (including failed lazy-chunk loads) and shows a
 * recovery UI instead of a blank white screen.
 *
 * On mobile with spotty connections the most common failure mode is a
 * "ChunkLoadError" when Vite's dynamic import() fails.  We detect that and
 * offer a one-click reload.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Loading CSS chunk') ||
      error.message?.includes('error loading dynamically imported module');

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    // A full page reload fetches fresh asset manifests
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
          {this.state.isChunkError ? (
            <>
              <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">Page failed to load</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                This usually happens on a slow connection or after an app update. Tap below to reload.
              </p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                An unexpected error occurred. Try reloading the page.
              </p>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Reload page
            </button>
            <button
              onClick={this.handleGoHome}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
