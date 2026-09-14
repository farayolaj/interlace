import React, { ReactNode } from "react";
import { COLORS, RADIUS, SPACE, TYPE } from "../tokens";

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
              padding: `${SPACE[4]}px`,
              backgroundColor: COLORS.errorBg,
              color: COLORS.errorText,
              border: `1px solid ${COLORS.errorBorder}`,
              borderRadius: `${RADIUS.md}px`,
              fontSize: TYPE.md,
              lineHeight: 1.5,
            }}
          >
            <strong>Content Error</strong>
            <p style={{ margin: `${SPACE[1]}px 0 0 0` }}>
              {this.state.error?.message}
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
