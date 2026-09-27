import React, { Component, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-exclamation-triangle text-2xl text-red-500" />
            </div>
            <h2 className="text-xl font-extrabold text-[var(--foreground)] mb-2">
              {this.props.fallbackTitle || "Something went wrong"}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-5 py-2 rounded-full bg-[var(--accent)] text-black font-semibold hover:opacity-90 transition-opacity text-sm"
              >
                Try again
              </button>
              <Link
                to="/"
                className="px-5 py-2 rounded-full border border-[var(--border)] text-[var(--foreground)] font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
