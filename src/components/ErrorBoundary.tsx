"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Here you could add error logging to an external service like Sentry
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 motion-safe:animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-800/30 text-red-600 dark:text-red-400">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            An unexpected error occurred while rendering this section. Our team has been notified.
          </p>
          {this.state.error && (
            <div className="mb-6 p-3 bg-white dark:bg-black/40 rounded border border-red-100 dark:border-red-900/30 text-sm text-left max-w-xl overflow-auto font-mono text-red-500">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-red-500/20 active:scale-95"
          >
            <RefreshCcw size={18} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
