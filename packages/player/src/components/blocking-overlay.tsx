import { ContentInstance, ContentType } from "@interlace/core";
import React, { useEffect, useRef, useState } from "react";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "../tokens";

export interface BlockingOverlayProps {
  content: ContentInstance;
  /**
   * The content type owning `content` — its `renderPlayback` mounts
   * into the overlay body and its `unmountPlayback` tears it down on
   * close/unmount.
   */
  contentType: ContentType;
  /**
   * Programmatic-only close hook (reserved for the parent's teardown).
   * Blocking content cannot be dismissed by the user: the overlay stays
   * until its content completes (or the player unmounts), so nothing in
   * this component calls `onClose`.
   */
  onClose?: () => void;
  /**
   * Called with the reported score when the content's playback
   * completes itself via `callbacks.onComplete` (the parent then
   * completes the item through the controller).
   */
  onContentComplete?: (score?: number) => void;
  /**
   * Completing mode: the content body is swapped for a completion
   * surface (animated check + "Completed" + score) that persists until
   * the user acknowledges it.
   */
  completing?: boolean;
  /** Score reported by the completed content, shown in completing mode. */
  completingScore?: number;
  /**
   * Completion-acknowledgement control (programmatic owner: the player).
   * The completing surface's ONLY exit is the Continue button that calls
   * this — it is not a dismiss affordance; the parent resumes playback and
   * unmounts the overlay.
   */
  onContinue?: () => void;
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
  onContentComplete,
  completing = false,
  completingScore,
  onContinue,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Drives the completion surface's fade/slide-in transition.
  const [revealed, setRevealed] = useState(false);

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

  // When the overlay enters completing mode, flip `revealed` on the next
  // frame so the CSS transitions animate the check + label in.
  useEffect(() => {
    if (!completing) {
      setRevealed(false);
      return;
    }
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, [completing]);

  // Focus trap: keep focus within overlay. Re-runs when completing mode
  // flips so the completion surface's Continue button joins the trap and
  // receives focus as the surface appears (the content body's focusables
  // are gone by then).
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
  }, [completing]);

  const completionSurface = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: `${SPACE[3]}px`,
        padding: `${SPACE[4]}px 0`,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: COLORS.accentLighter,
          color: COLORS.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: TYPE.xl,
          fontWeight: 600,
          lineHeight: 1,
          opacity: revealed ? 1 : 0,
          transform: revealed ? "scale(1)" : "scale(0.6)",
          transition: "opacity 200ms ease, transform 200ms ease",
        }}
        aria-hidden="true"
      >
        ✓
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: FONTS.display,
          fontSize: TYPE.lg,
          fontWeight: 600,
          color: COLORS.text,
          opacity: revealed ? 1 : 0,
          transform: revealed ? "none" : "translateY(6px)",
          transition: "opacity 250ms ease 120ms, transform 250ms ease 120ms",
        }}
      >
        <span>Completed</span>
        {typeof completingScore === "number" && (
          <span
            aria-label={`completion-score-${completingScore}`}
            style={{
              marginLeft: `${SPACE[2]}px`,
              display: "inline-block",
              padding: `0 ${SPACE[2]}px`,
              borderRadius: `${RADIUS.sm}px`,
              backgroundColor: COLORS.accent,
              color: COLORS.white,
              fontSize: TYPE.sm,
              fontWeight: 600,
              verticalAlign: "middle",
            }}
          >
            Score: {completingScore}/{content.getMaximumScore()}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={onContinue}
        style={{
          marginTop: `${SPACE[3]}px`,
          padding: `${SPACE[2]}px ${SPACE[5]}px`,
          backgroundColor: COLORS.accent,
          color: COLORS.white,
          border: "none",
          borderRadius: `${RADIUS.sm}px`,
          cursor: "pointer",
          fontSize: TYPE.md,
          fontWeight: 600,
          transition: "background-color 150ms ease",
          opacity: revealed ? 1 : 0,
        }}
      >
        Continue
      </button>
    </div>
  );

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

        {completing ? (
          completionSurface
        ) : (
          <div style={{ margin: `${SPACE[4]}px 0` }}>
            <div ref={bodyRef} />
          </div>
        )}
      </div>
    </div>
  );
};
