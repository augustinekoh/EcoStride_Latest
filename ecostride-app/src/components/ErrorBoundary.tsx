import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#faf9f6]">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">Oops, something went wrong.</h1>
          <p className="text-slate-600 font-bold mb-6 max-w-md">
            {this.state.error?.message || "An unexpected error occurred in this component."}
          </p>
          <button
            className="bg-[#1d3539] text-white font-bold py-3 px-8 rounded-full active:translate-y-1 transition-all"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
