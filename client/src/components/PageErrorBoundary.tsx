import React, { Component, ReactNode, ComponentType } from 'react';
import { Link } from 'wouter';

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
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
    // Reset error state when navigation occurs (children change)
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.pageName || 'Page'}] Error:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="bg-card rounded-lg p-8 max-w-md w-full text-center shadow-lg border">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2 text-foreground">
              Page Error
            </h1>
            <p className="text-muted-foreground mb-6">
              {this.props.pageName || 'This page'} encountered an error. The rest of the app is still working.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <Link 
                href="/dashboard"
                className="block bg-muted text-muted-foreground px-6 py-3 rounded-lg font-semibold hover:bg-muted/80 transition-colors"
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

// Higher-Order Component to wrap pages with error boundary while preserving props
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
