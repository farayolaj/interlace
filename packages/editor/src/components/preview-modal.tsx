import {
  ContentTypeRegistry,
  type SerializedInteractiveMediaDocument,
  type VideoAdapter,
} from "@interlace/core";
import { InteractiveVideoPlayer } from "@interlace/player";
import { NativeVideoAdapter } from "@interlace/native-adapter";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PreviewModalStrings {
  /** Heading shown at the top of the modal. */
  title: string;
  /** Label for the close button. */
  closeLabel: string;
  /** Shown while the player is initializing. */
  loadingLabel: string;
}

export const DEFAULT_PREVIEW_MODAL_STRINGS: PreviewModalStrings = {
  title: "Preview",
  closeLabel: "Close",
  loadingLabel: "Loading player…",
};

export interface PreviewModalProps {
  /** Whether the modal is open. The internal `<video>` only mounts when open, so audio stops on close. */
  isOpen: boolean;
  videoSrc: string;
  document: SerializedInteractiveMediaDocument;
  contentTypeRegistry: ContentTypeRegistry;
  onClose: () => void;
  strings?: Partial<PreviewModalStrings>;
  onError?: (error: Error) => void;
}

/**
 * PreviewModal - the "what students will see" surface for the editor.
 *
 * The modal mounts a fresh `<video>` element on open and wraps it in a
 * `NativeVideoAdapter`. The adapter is passed to the player's
 * `InteractiveVideoPlayer` for play / pause / seek control. The player's
 * overlay layer is positioned on top of the video via CSS — the
 * adapter's `mountOverlay` is not used (the player renders its own
 * overlay as a sibling of the video).
 *
 * The `<video>` and the adapter are created in a `useEffect` on `isOpen`,
 * and the adapter's `destroy()` is called on close. This guarantees the
 * modal's audio stops when the user closes it.
 */
export function PreviewModal({
  isOpen,
  videoSrc,
  document,
  contentTypeRegistry,
  onClose,
  strings: stringsOverride,
  onError,
}: PreviewModalProps) {
  const strings = { ...DEFAULT_PREVIEW_MODAL_STRINGS, ...stringsOverride };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [adapter, setAdapter] = useState<VideoAdapter | null>(null);

  // Construct the adapter after the <video> mounts; destroy on close.
  useEffect(() => {
    if (!isOpen) {
      setAdapter(null);
      return;
    }
    const video = videoRef.current;
    if (!video) {
      // Effect re-runs after the <video> mounts; the next pass will
      // pick it up.
      return;
    }
    let native: NativeVideoAdapter | null = null;
    try {
      native = new NativeVideoAdapter(video);
      setAdapter(native);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      setAdapter(null);
      return;
    }
    return () => {
      try {
        native?.destroy();
      } catch {
        // destroy() can throw if the wrapper was already detached;
        // ignore — the DOM is going away anyway.
      }
      setAdapter(null);
    };
  }, [isOpen, videoSrc, onError]);

  // Close on Escape, like a native modal.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close when the user clicks the backdrop, not the modal
      // content.
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="preview-modal-backdrop"
      data-testid="preview-modal-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="preview-modal"
        data-testid="preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={strings.title}
        onClick={handleBackdropClick}
        style={{
          position: "relative",
          backgroundColor: "#000",
          borderRadius: 8,
          padding: 16,
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fff",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>{strings.title}</h3>
          <button
            type="button"
            onClick={onClose}
            data-testid="preview-modal-close"
            aria-label={strings.closeLabel}
            style={{
              padding: "4px 12px",
              backgroundColor: "transparent",
              border: "1px solid #fff",
              color: "#fff",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {strings.closeLabel}
          </button>
        </div>
        <div
          className="preview-modal-content"
          data-testid="preview-modal-content"
          style={{
            position: "relative",
            width: "min(80vw, 960px)",
            aspectRatio: "16 / 9",
            backgroundColor: "#000",
          }}
        >
          <div
            className="preview-modal-video-container"
            data-testid="preview-modal-video-container"
            style={{ width: "100%", height: "100%" }}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              preload="metadata"
              data-testid="preview-modal-video"
              style={{
                width: "100%",
                height: "100%",
                display: "block",
              }}
            />
          </div>
          {adapter ? (
            <div
              className="preview-modal-player-container"
              data-testid="preview-modal-player-container"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >
              <InteractiveVideoPlayer
                adapter={adapter}
                document={document}
                registry={contentTypeRegistry}
                onError={onError}
              />
            </div>
          ) : (
            <div
              data-testid="preview-modal-loading"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: 14,
              }}
            >
              {strings.loadingLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
