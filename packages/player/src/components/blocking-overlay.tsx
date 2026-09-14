import { ContentInstance } from "@interlace/core";
import React, { useCallback, useEffect, useRef } from "react";

export interface BlockingOverlayProps {
  content: ContentInstance;
  onClose: () => void;
  onSubmit?: (result: any) => void;
}

/**
 * BlockingOverlay - modal overlay for blocking content.
 * Implements focus trap to keep focus within the overlay.
 * Pauses video while open.
 */
export const BlockingOverlay: React.FC<BlockingOverlayProps> = ({
  content,
  onClose,
  onSubmit,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap: keep focus within overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const focusableElements = overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    overlay.addEventListener("keydown", handleKeyDown);
    firstElement.focus();

    return () => {
      overlay.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    onSubmit?.({}); // Content-specific result should be passed here
    onClose();
  }, [onClose, onSubmit]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`blocking-content-${content.getId()}`}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h2 id={`blocking-content-${content.getId()}`} style={{ marginTop: 0 }}>
          {content.getTitle()}
        </h2>

        <div style={{ margin: "16px 0" }}>
          {/* Content will be rendered here by parent component */}
          <p style={{ color: "#666" }}>Content rendering placeholder</p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            marginTop: "24px",
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Close
          </button>
          <button
            ref={closeButtonRef}
            onClick={handleSubmit}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};
