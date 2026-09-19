import { DEFAULT_STRINGS, type Strings } from "@interlacejs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { COLORS, RADIUS, SPACE, TYPE } from "../tokens";

/**
 * The current video source value held by `VideoSourceInput`. `duration` is
 * optional because the editor usually learns it from the host's `<video>`
 * element after the URL resolves; the component only writes `src` directly.
 */
export interface VideoSourceValue {
  src?: string;
  duration?: number;
}

/**
 * Localized strings consumed by `VideoSourceInput`. Extends the core
 * `Strings` so a host passing a single translation table covers every
 * editor surface. The fields below are the ones specific to the
 * video-source step; everything else (cancel, close, content error, …)
 * is inherited from `Strings`.
 */
export interface VideoSourceInputStrings extends Strings {
  /** Heading for the file upload row. */
  uploadLabel: string;
  /** Label for the trigger button that opens the native file picker. */
  uploadButtonLabel: string;
  /** Shown next to the button while a file is being uploaded. */
  uploadingLabel: string;
  /** Inline error text shown when the upload promise rejects. */
  uploadFailedLabel: string;
  /** Label for the button that re-opens the file picker after a failure. */
  retryLabel: string;
  /** Label for the "direct URL" text input. */
  urlLabel: string;
  /** Placeholder for the URL text input. */
  urlPlaceholder: string;
  /** Label for the button that commits the URL draft. */
  applyUrlLabel: string;
  /** Shown when no video source has been chosen yet. */
  noVideoSelectedLabel: string;
  /** Shown above a known video URL. */
  currentSourceLabel: string;
}

/**
 * Defaults are derived from core's `DEFAULT_STRINGS` so a host that
 * overrides the core base gets matching inheritance automatically; the
 * video-source-specific fields are filled in alongside.
 */
export const DEFAULT_VIDEO_SOURCE_INPUT_STRINGS: VideoSourceInputStrings = {
  ...DEFAULT_STRINGS,
  uploadLabel: "Upload a video file",
  uploadButtonLabel: "Choose file",
  uploadingLabel: "Uploading…",
  uploadFailedLabel: "Upload failed.",
  retryLabel: "Retry",
  urlLabel: "…or paste a video URL",
  urlPlaceholder: "https://example.com/video.mp4",
  applyUrlLabel: "Use URL",
  noVideoSelectedLabel: "No video selected yet.",
  currentSourceLabel: "Current source",
};

export interface VideoSourceInputProps {
  /**
   * The current video source, if any. When `value.src` is set, the
   * component displays the existing source above the inputs and treats the
   * URL draft as a *replacement* candidate. When it is absent, the
   * component behaves as the very first step of a new document.
   */
  value?: VideoSourceValue;
  /**
   * Called when a usable video URL is ready, whether the user pasted it
   * directly or an upload promise resolved. The component awaits the
   * upload promise itself; the host is only ever handed a URL.
   */
  onChange: (next: { src: string; duration?: number }) => void;
  /**
   * Host-supplied upload callback. The component awaits this promise; the
   * resolved string is written into the document. A rejection is surfaced
   * via the inline error state and (optionally) `onError` — it does not
   * crash the authoring flow.
   */
  onUpload: (file: File) => Promise<string>;
  /** Optional callback for upload promise rejections. */
  onError?: (error: Error) => void;
  /** Optional string overrides. */
  strings?: Partial<VideoSourceInputStrings>;
  /** Disables both the URL and file controls. */
  disabled?: boolean;
}

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "error"; message: string };

/**
 * VideoSourceInput - the first step of a new document's authoring flow.
 * Accepts either a direct URL or a file. When a file is provided, the
 * host's `onUpload` callback is invoked and the component awaits the
 * resolved URL before calling `onChange`. Loading and failure states are
 * surfaced inline without crashing the surrounding authoring flow.
 *
 * Token discipline: every file selection bumps an internal counter; if a
 * later selection starts (or the component unmounts) before the previous
 * upload resolves, the stale result is dropped. This prevents a slow
 * upload from overwriting the URL of a fast one chosen after it, and
 * prevents a late resolution from committing into a torn-down tree.
 */
export function VideoSourceInput({
  value,
  onChange,
  onUpload,
  onError,
  strings: stringsOverride,
  disabled = false,
}: VideoSourceInputProps) {
  const strings = { ...DEFAULT_VIDEO_SOURCE_INPUT_STRINGS, ...stringsOverride };
  const [urlDraft, setUrlDraft] = useState(value?.src ?? "");
  const [uploadState, setUploadState] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTokenRef = useRef(0);

  // Keep the URL draft in sync when the upstream value changes (e.g. a
  // document load). The draft is *not* marked dirty — a late upload
  // resolution that calls `onChange` will still overwrite what the user
  // is currently typing. Callers that want to preserve the user's
  // in-flight draft across value changes should not pass a new
  // `value.src` while a upload is in progress.
  useEffect(() => {
    setUrlDraft(value?.src ?? "");
  }, [value?.src]);

  // Token discipline also covers unmount: bump the counter so any
  // in-flight upload that resolves after the component is gone is
  // dropped instead of committing into a torn-down tree.
  useEffect(() => {
    return () => {
      uploadTokenRef.current += 1;
    };
  }, []);

  const handleApplyUrl = useCallback(() => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    onChange({ src: trimmed });
  }, [urlDraft, onChange]);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Always reset the input so re-selecting the same file re-fires onChange.
      event.target.value = "";
      if (!file) return;

      const token = ++uploadTokenRef.current;
      setUploadState({ kind: "uploading", fileName: file.name });
      let url: string;
      try {
        url = await onUpload(file);
      } catch (err) {
        if (token !== uploadTokenRef.current) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setUploadState({ kind: "error", message: error.message });
        onError?.(error);
        return;
      }
      // Resolution is the only path that calls onChange. A throw from
      // the host's onChange handler is the host's problem and is not
      // surfaced as an upload failure.
      if (token !== uploadTokenRef.current) return;
      setUploadState({ kind: "idle" });
      onChange({ src: url });
    },
    [onUpload, onChange, onError],
  );

  const handleRetryUpload = useCallback(() => {
    setUploadState({ kind: "idle" });
    fileInputRef.current?.click();
  }, []);

  const isUploading = uploadState.kind === "uploading";
  const hasError = uploadState.kind === "error";
  const isDisabled = disabled || isUploading;
  const applyDisabled = isDisabled || urlDraft.trim().length === 0;

  return (
    <div
      className="video-source-input"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `${SPACE[4]}px`,
        padding: `${SPACE[4]}px`,
        border: `1px solid ${COLORS.border}`,
        borderRadius: `${RADIUS.md}px`,
        backgroundColor: COLORS.surfaceRaised,
      }}
    >
      {value?.src ? (
        <div
          style={{
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: `${RADIUS.sm}px`,
            fontSize: TYPE.sm,
            color: COLORS.text,
          }}
        >
          <span style={{ color: COLORS.textMuted }}>
            {strings.currentSourceLabel}:
          </span>{" "}
          <code data-testid="video-source-input-current-src">{value.src}</code>
        </div>
      ) : (
        <p
          data-testid="video-source-input-empty"
          style={{ margin: 0, color: COLORS.textMuted }}
        >
          {strings.noVideoSelectedLabel}
        </p>
      )}

      <div>
        <h4
          style={{
            margin: `0 0 ${SPACE[2]}px 0`,
            fontSize: TYPE.md,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          {strings.uploadLabel}
        </h4>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelected}
          disabled={isDisabled}
          data-testid="video-source-input-file"
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          data-testid="video-source-input-file-button"
          style={{
            padding: `${SPACE[2]}px ${SPACE[4]}px`,
            backgroundColor: isDisabled ? COLORS.borderStrong : COLORS.accent,
            color: COLORS.white,
            border: "none",
            borderRadius: `${RADIUS.sm}px`,
            cursor: isDisabled ? "not-allowed" : "pointer",
            fontSize: TYPE.md,
            fontWeight: 600,
            transition: "background-color 150ms ease",
          }}
        >
          {isUploading
            ? `${strings.uploadingLabel} (${uploadState.fileName})`
            : strings.uploadButtonLabel}
        </button>
        {isUploading ? (
          <span
            data-testid="video-source-input-uploading"
            style={{ marginLeft: `${SPACE[2]}px`, color: COLORS.textMuted, fontSize: TYPE.sm }}
            aria-live="polite"
          >
            {strings.uploadingLabel}
          </span>
        ) : null}
        {hasError ? (
          <div
            data-testid="video-source-input-error"
            role="alert"
            style={{
              marginTop: `${SPACE[2]}px`,
              color: COLORS.errorText,
              backgroundColor: COLORS.errorBg,
              padding: `${SPACE[2]}px`,
              borderRadius: `${RADIUS.sm}px`,
              border: `1px solid ${COLORS.errorBorder}`,
              fontSize: TYPE.sm,
            }}
          >
            <strong>{strings.uploadFailedLabel}</strong>{" "}
            <span>{uploadState.message}</span>
            <button
              type="button"
              onClick={handleRetryUpload}
              data-testid="video-source-input-retry"
              style={{
                marginLeft: `${SPACE[2]}px`,
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.errorBorder}`,
                color: COLORS.errorText,
                borderRadius: `${RADIUS.sm}px`,
                cursor: "pointer",
                fontSize: TYPE.xs,
                fontWeight: 600,
              }}
            >
              {strings.retryLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div>
        <label
          style={{
            display: "block",
            fontSize: TYPE.md,
            fontWeight: 600,
            marginBottom: `${SPACE[1]}px`,
            color: COLORS.text,
          }}
        >
          {strings.urlLabel}
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder={strings.urlPlaceholder}
            disabled={isDisabled}
            data-testid="video-source-input-url"
            style={{
              flex: 1,
              padding: `${SPACE[2]}px ${SPACE[3]}px`,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: `${RADIUS.sm}px`,
              fontSize: TYPE.md,
              color: COLORS.text,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !applyDisabled) {
                e.preventDefault();
                handleApplyUrl();
              }
            }}
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            disabled={applyDisabled}
            data-testid="video-source-input-apply"
            style={{
              padding: `${SPACE[2]}px ${SPACE[4]}px`,
              backgroundColor: applyDisabled ? COLORS.borderStrong : COLORS.accent,
              color: COLORS.white,
              border: "none",
              borderRadius: `${RADIUS.sm}px`,
              cursor: applyDisabled ? "not-allowed" : "pointer",
              fontSize: TYPE.md,
              fontWeight: 600,
              transition: "background-color 150ms ease",
            }}
          >
            {strings.applyUrlLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
