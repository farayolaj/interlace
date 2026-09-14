import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentErrorBoundary } from "./content-error-boundary";

// Suppress console errors for these tests since we're intentionally testing errors
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe("ContentErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ContentErrorBoundary>
        <div>Test Content</div>
      </ContentErrorBoundary>,
    );

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("displays error fallback on render error", () => {
    const ThrowComponent = () => {
      throw new Error("Test error");
    };

    render(
      <ContentErrorBoundary>
        <ThrowComponent />
      </ContentErrorBoundary>,
    );

    expect(screen.getByText("Content Error")).toBeInTheDocument();
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
  });

  it("calls onError callback on error", () => {
    const onError = vi.fn();

    const ThrowComponent = () => {
      throw new Error("Test error");
    };

    render(
      <ContentErrorBoundary onError={onError}>
        <ThrowComponent />
      </ContentErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test error" }),
    );
  });

  it("renders custom fallback", () => {
    const customFallback = <div>Custom Error UI</div>;

    const ThrowComponent = () => {
      throw new Error("Test error");
    };

    render(
      <ContentErrorBoundary fallback={customFallback}>
        <ThrowComponent />
      </ContentErrorBoundary>,
    );

    expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
  });
});
