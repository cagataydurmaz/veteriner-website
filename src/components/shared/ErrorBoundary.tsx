"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback UI */
  fallback?: React.ReactNode;
  /** Section label for the error message (e.g. "Randevu listesi") */
  section?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Wrap any subtree so that a thrown error shows a friendly Turkish fallback
 * instead of crashing the entire page.
 *
 * <ErrorBoundary section="Randevu listesi">
 *   <AppointmentList />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const errorMessage =
      error instanceof Error ? error.message : "Bilinmeyen hata";
    return { hasError: true, errorMessage };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const sectionLabel = this.props.section
        ? `"${this.props.section}" bölümü`
        : "Bu bölüm";

      return (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex flex-col items-center gap-3 text-center my-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-red-500 text-lg">⚠️</span>
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">
              {sectionLabel} yüklenemedi
            </p>
            <p className="text-xs text-red-600 mt-1">
              Sayfayı yenileyin veya daha sonra tekrar deneyin.
            </p>
            {process.env.NODE_ENV === "development" && (
              <p className="text-[10px] text-red-400 mt-1 font-mono break-all">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-900 bg-white border border-red-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Tekrar Dene
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
