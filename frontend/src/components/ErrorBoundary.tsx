'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Sivlo ran into an unexpected error. Your meeting data on this device is safe.
            Reload the app to continue.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="max-w-lg overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <Button onClick={this.handleReload} aria-label="Reload application">
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
