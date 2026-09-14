import { ContentInstance, ContentType } from "@interlace/core";
import React, { useCallback, useEffect, useRef } from "react";

export interface BlockingOverlayProps {
  content: ContentInstance;
  /**
   * The content type owning `content` — its `renderPlayback` mounts
   * into the overlay body and its `unmountPlayback` tears it down on
   * close/unmount.
   */
  contentType: ContentType;
  onClose: () => void;
  /**
   * Called with the reported score when the content's playback
   * completes itself via `callbacks.onComplete` (the parent then
   * completes the item through the controller).
   */
  onContentComplete?: (score?: number) => void;
}

/**
 * BlockingOverlay - modal overlay for blocking content.
 * Implements focus trap to keep focus within the overlay.
 * Pauses video while open.
 *
 * Playback mounting (container-identity contract): the content type's
 * `renderPlayback`/`unmountPlayback` receive the same body container
 * element for the overlay's lifetime; React holds the ref stable while
 * the overlay is open.
 */
export const BlockingOverlay: React.FC<BlockingOverlayProps> = ({
  content,
  contentType,
  onClose,
  onContentComplete,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Mount/unmount the content type's playback session. The same body
  // completion callback is ref-stabilized so identity churn cannot
  // tear the session down.
  const onContentCompleteRef = useRef(onContentComplete);
  onContentCompleteRef.current = onContentComplete;

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !contentType) return;

    try {
      contentType.renderPlayback(body, content.getData(), {
        onComplete: (score) => {
          onContentCompleteRef.current?.(score);
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Render failures surface through the overlay's own body rather
      // than crashing the player: show the error in place.
      body.textContent = error.message;
      return;
    }

    return () => {
      contentType.unmountPlayback?.(body);
    };
  }, [contentType, content]);

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
        // Re-enable pointer events explicitly: the editor's preview
        // modal mounts the player inside a `pointerEvents: "none"`
        // container, and a descendant with `auto` re-enables it.
        pointerEvents: "auto",
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
          <div ref={bodyRef} />
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
            type="button"
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
            type="button"
            onClick={onClose}
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
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
