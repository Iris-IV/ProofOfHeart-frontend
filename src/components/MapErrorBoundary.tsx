"use client";

import { RefreshCcw, MapIcon } from "lucide-react";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class MapErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Map error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 motion-safe:animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800/30 text-amber-600 dark:text-amber-400">
            <MapIcon size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Map unavailable</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            The map could not be loaded. This may be due to a network issue or missing map data.
            Switch to list view to browse campaigns.
          </p>
          {this.state.error && (
            <div className="mb-6 p-3 bg-white dark:bg-black/40 rounded border border-amber-100 dark:border-amber-900/30 text-sm text-left max-w-xl overflow-auto font-mono text-amber-600">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-amber-500/20 active:scale-95"
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

export default MapErrorBoundary;
