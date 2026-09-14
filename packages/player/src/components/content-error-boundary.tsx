import React, { ReactNode } from "react";

export interface ContentErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for content rendering failures.
 * Catches render errors from content components and displays fallback UI.
 */
export class ContentErrorBoundary extends React.Component<
  ContentErrorBoundaryProps,
  State
> {
  constructor(props: ContentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              padding: "16px",
              backgroundColor: "#fee",
              color: "#c33",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          >
            <strong>Content Error</strong>
            <p>{this.state.error?.message}</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
