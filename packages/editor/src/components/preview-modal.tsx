import {
  ContentTypeRegistry,
  DEFAULT_STRINGS,
  type SerializedInteractiveMediaDocument,
  type Strings,
  type VideoAdapter,
} from "@interlace/core";
import { InteractiveVideoPlayer } from "@interlace/player";
import { NativeVideoAdapter } from "@interlace/native-adapter";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Localized strings consumed by `PreviewModal`. Extends the core
 * `Strings` so a host passing a single translation table covers every
 * editor surface. The fields below are the ones specific to the
 * preview modal; everything else (cancel, close, content error, …)
 * is inherited from `Strings`.
 */
export interface PreviewModalStrings extends Strings {
  /** Heading shown at the top of the modal. */
  title: string;
  /** Shown while the player is initializing. */
  loadingLabel: string;
}

/**
 * Defaults are derived from core's `DEFAULT_STRINGS` so a host that
 * overrides the core base gets matching inheritance automatically.
 */
export const DEFAULT_PREVIEW_MODAL_STRINGS: PreviewModalStrings = {
  ...DEFAULT_STRINGS,
  title: "Preview",
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
 *
 * `onError` and `onClose` are held in refs so a host-inlined callback
 * does not destroy and recreate the adapter (and thus the player's
 * controller) on every parent re-render while the modal is open.
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
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Hold callbacks in refs so a host-inlined callback does not
  // destroy and recreate the adapter (and thus the player's
  // controller) on every parent re-render.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [adapter, setAdapter] = useState<VideoAdapter | null>(null);
  /**
   * Aspect ratio of the modal's video frame, derived from the
   * underlying video's intrinsic dimensions. `null` until metadata
   * loads; the container falls back to 16:9 in that case. Using the
   * intrinsic ratio prevents distortion of non-16:9 sources (4:3,
   * portrait, etc.) and keeps the player's anchor alignment honest
   * (the % placement system maps to the container box, which is
   * only the video frame when the container hugs the video's
   * aspect).
   */
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // Construct the adapter after the <video> mounts; destroy on close.
  useEffect(() => {
    if (!isOpen) {
      setAdapter(null);
      return;
    }
    const video = videoRef.current;
    if (!video) {
      // Unreachable: the <video> renders iff isOpen, and React commits
      // refs before running passive effects. The check satisfies
      // TypeScript's non-null requirement on the ref.
      return;
    }
    let native: NativeVideoAdapter | null = null;
    try {
      native = new NativeVideoAdapter(video);
      setAdapter(native);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onErrorRef.current?.(error);
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
  }, [isOpen, videoSrc]);

  // Focus management: move focus to the close button on open, restore
  // the previously-focused element on close. The player's own
  // BlockingOverlay traps focus once it appears; this just sets the
  // initial focus when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current =
      (globalThis.document?.activeElement as HTMLElement | null) ?? null;
    closeButtonRef.current?.focus();
    return () => {
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [isOpen]);

  // Close on Escape, like a native modal.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close when the user clicks the backdrop, not the modal
      // content.
      if (e.target === e.currentTarget) onCloseRef.current();
    },
    [],
  );

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        setAspectRatio(v.videoWidth / v.videoHeight);
      }
    },
    [],
  );

  if (!isOpen) return null;

  const containerAspectRatio = aspectRatio ?? 16 / 9;

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
            ref={closeButtonRef}
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
            aspectRatio: String(containerAspectRatio),
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
              onLoadedMetadata={handleLoadedMetadata}
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
                onError={onErrorRef.current}
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
                fontSize: 13,
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
