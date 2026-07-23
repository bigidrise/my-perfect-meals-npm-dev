import React, { Component, ReactNode, ComponentType } from 'react';
import { Link } from 'wouter';

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: undefined, componentStack: undefined });
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const msg = error?.message ?? String(error);
    const stack = error?.stack ?? '(no stack)';
    const compStack = errorInfo?.componentStack ?? '(no component stack)';
    console.error(`[${this.props.pageName || 'Page'}] CRASH — name:`, error?.name ?? 'unknown');
    console.error(`[${this.props.pageName || 'Page'}] CRASH — message:`, msg);
    console.error(`[${this.props.pageName || 'Page'}] CRASH — stack:`, stack);
    console.error(`[${this.props.pageName || 'Page'}] CRASH — componentStack:`, compStack);
    this.setState({ componentStack: compStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, componentStack: undefined });
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack } = this.state;
      const name = error?.name ?? 'Error';
      const msg = error?.message ?? String(error) ?? '(no message)';
      const stack = error?.stack ?? '(no stack)';
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full shadow-lg border space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {this.props.pageName || 'Page'} Crash
                </h1>
                <p className="text-sm text-muted-foreground">{name}: {msg}</p>
              </div>
            </div>

            <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs font-mono text-red-300 overflow-auto max-h-48 whitespace-pre-wrap break-all">
              {stack}
            </div>

            {componentStack && (
              <div className="bg-zinc-900 border border-white/10 rounded-lg p-3 text-xs font-mono text-white/50 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {componentStack}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Retry
              </button>
              <Link
                href="/dashboard"
                className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withPageErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  pageName: string
) {
  return function PageWithErrorBoundary(props: P) {
    return (
      <PageErrorBoundary pageName={pageName}>
        <Component {...props} />
      </PageErrorBoundary>
    );
  };
}
