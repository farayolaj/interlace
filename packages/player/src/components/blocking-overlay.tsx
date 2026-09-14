import { ContentInstance, ContentType } from "@interlace/core";
import React, { useCallback, useEffect, useRef } from "react";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";

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
          backgroundColor: COLORS.surface,
          borderRadius: `${RADIUS.lg}px`,
          padding: `${SPACE[5]}px`,
          maxWidth: "500px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.35)",
        }}
      >
        <h2
          id={`blocking-content-${content.getId()}`}
          style={{
            marginTop: 0,
            fontFamily: FONTS.display,
            fontSize: TYPE.lg,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          {content.getTitle()}
        </h2>

        <div style={{ margin: `${SPACE[4]}px 0` }}>
          <div ref={bodyRef} />
        </div>

        <div
          style={{
            display: "flex",
            gap: `${SPACE[2]}px`,
            justifyContent: "flex-end",
            marginTop: `${SPACE[5]}px`,
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: `${SPACE[2]}px ${SPACE[4]}px`,
              backgroundColor: COLORS.surfaceRaised,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: `${RADIUS.sm}px`,
              cursor: "pointer",
              fontSize: TYPE.md,
              color: COLORS.text,
              transition: "background-color 150ms ease",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: `${SPACE[2]}px ${SPACE[4]}px`,
              backgroundColor: COLORS.accent,
              color: COLORS.white,
              border: "none",
              borderRadius: `${RADIUS.sm}px`,
              cursor: "pointer",
              fontSize: TYPE.md,
              fontWeight: 600,
              transition: "background-color 150ms ease",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
