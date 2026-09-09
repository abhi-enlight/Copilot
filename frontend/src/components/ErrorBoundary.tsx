"use client";

// =============================================================================
// ErrorBoundary, React class error boundary
//
// Wraps any subtree to catch React render errors. Uses ErrorInlineBanner for
// user-facing output, never leaks raw exception messages.
//
// Props:
//   children, the subtree to protect
//   context, human label shown in the error, e.g. "Campaign panel"
//   fallback, optional custom fallback node (overrides default banner)
//   onReset, optional callback fired when user clicks Retry (useful for
//                clearing localStorage or resetting parent state)
// =============================================================================

import React, { Component, type ReactNode } from "react";
import ErrorInlineBanner from "@/components/ui/ErrorInlineBanner";

interface Props {
  children: ReactNode;
  /** Human-readable name of the area that failed, e.g. "Campaign panel" */
  context?: string;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  digest?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    // Do NOT capture error.message here, it would leak to state and
    // potentially get rendered somewhere.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log full technical details server-side / console only.
    console.error(
      `[ErrorBoundary][${this.props.context ?? "unknown"}]`,
      error,
      errorInfo
    );
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const area = this.props.context ?? "This section";

      return (
        <div className="p-3 my-2">
          <ErrorInlineBanner
            severity="error"
            title={`${area} ran into a problem`}
            description="Nothing you did caused this. Retry to reload this section, or refresh the page if it keeps happening."
            action={{
              label: "Retry",
              onClick: this.handleReset,
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
