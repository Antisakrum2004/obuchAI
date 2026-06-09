"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI — receives the error and a retry callback */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * A reusable class-based Error Boundary that catches render errors
 * in its children and displays a friendly glass-style error message
 * with a "Retry" button that resets the boundary.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in development for debugging
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Allow custom fallback
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default glass-style fallback UI
      return (
        <div className="flex items-center justify-center p-8">
          <div
            className="glass rounded-2xl p-8 border border-red-500/20 max-w-md w-full text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(15,15,25,0.95) 100%)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Что-то пошло не так
            </h3>
            <p className="text-sm text-muted-foreground mb-1">
              Произошла ошибка при отображении этого раздела.
            </p>
            {this.state.error.message && (
              <p className="text-xs text-muted-foreground/60 mb-6 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <Button
              onClick={this.handleRetry}
              className="bg-white/5 text-foreground border border-white/10 hover:bg-white/10 gap-2"
              size="sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Попробовать снова
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
