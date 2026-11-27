import { DEFAULT_STRINGS, type Strings } from "@interlacejs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "../tokens";
import { Button, Field, SectionHeading } from "./ui";

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
  /** Label for the button that retries a failed upload with the same file. */
  retryLabel: string;
  /** Label for the button that stops an upload in progress. */
  cancelUploadLabel: string;
  /** Hint under the upload button: files can also be dropped there. */
  dropHint: string;
  /** Shown in the drop area while a file is dragged over it. */
  dropActiveLabel: string;
  /** Error shown when the dropped file is not a video. */
  notAVideoLabel: string;
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
  cancelUploadLabel: "Cancel upload",
  dropHint: "or drag and drop a video file here",
  dropActiveLabel: "Drop the video to upload it",
  notAVideoLabel: "That file isn't a video. Choose a video file.",
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
   * crash the authoring flow. `signal` aborts when the user cancels the
   * upload (or the component unmounts); hosts that honour it stop the
   * transfer, others simply have their result ignored.
   */
  onUpload: UploadHandler;
  /** Optional callback for upload promise rejections. */
  onError?: (error: Error) => void;
  /** Optional string overrides. */
  strings?: Partial<VideoSourceInputStrings>;
  /** Disables both the URL and file controls. */
  disabled?: boolean;
}

/** Uploads a file and resolves to its URL. See `VideoSourceInputProps.onUpload`. */
export type UploadHandler = (
  file: File,
  options: { signal: AbortSignal },
) => Promise<string>;

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
  /** The last file chosen, so Retry continues with it (hosts can resume). */
  const lastFileRef = useRef<File | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

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
      uploadAbortRef.current?.abort();
    };
  }, []);

  const handleApplyUrl = useCallback(() => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    onChange({ src: trimmed });
  }, [urlDraft, onChange]);

  const startUpload = useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      uploadAbortRef.current?.abort();
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      const token = ++uploadTokenRef.current;
      setUploadState({ kind: "uploading", fileName: file.name });
      let url: string;
      try {
        url = await onUpload(file, { signal: controller.signal });
      } catch (err) {
        // A newer selection or a cancel already moved on.
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

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Always reset the input so re-selecting the same file re-fires onChange.
      event.target.value = "";
      if (file) void startUpload(file);
    },
    [startUpload],
  );

  const handleRetryUpload = useCallback(() => {
    const file = lastFileRef.current;
    if (file) {
      void startUpload(file);
    } else {
      setUploadState({ kind: "idle" });
      fileInputRef.current?.click();
    }
  }, [startUpload]);

  /** Drag depth, so moving over child elements doesn't end the highlight. */
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const canDrop = !disabled && uploadState.kind !== "uploading";

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canDrop && hasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    },
    [canDrop],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canDrop && hasFiles(event)) return;
      // Required for the drop event to fire.
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [canDrop],
  );

  const handleDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      dragDepthRef.current = 0;
      setIsDragging(false);
      if (!canDrop && hasFiles(event)) return;
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        setUploadState({ kind: "error", message: strings.notAVideoLabel });
        return;
      }
      void startUpload(file);
    },
    [canDrop, startUpload, strings.notAVideoLabel],
  );

  const handleCancelUpload = useCallback(() => {
    uploadTokenRef.current += 1;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadState({ kind: "idle" });
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
        gap: SPACE[4],
        fontFamily: FONTS.body,
        color: COLORS.text,
      }}
    >
      {value?.src ? (
        <div
          style={{
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
            backgroundColor: COLORS.surfaceRaised,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            fontSize: TYPE.sm,
            overflowWrap: "anywhere",
          }}
        >
          <span style={{ color: COLORS.textMuted }}>
            {strings.currentSourceLabel}:
          </span>{" "}
          <code data-testid="video-source-input-current-src">{value.src}</code>
        </div>
      ) : (
        <p data-testid="video-source-input-empty" className="interlace-hint">
          {strings.noVideoSelectedLabel}
        </p>
      )}

      <div
        data-testid="video-source-input-dropzone"
        data-dragging={isDragging || undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: SPACE[2],
          padding: `${SPACE[5]}px ${SPACE[4]}px`,
          border: `2px dashed ${isDragging ? COLORS.accent : COLORS.borderStrong}`,
          borderRadius: RADIUS.md,
          backgroundColor: isDragging
            ? COLORS.accentLighter
            : COLORS.surfaceRaised,
          textAlign: "center",
          transition: "background-color 120ms, border-color 120ms",
        }}
      >
        <SectionHeading>{strings.uploadLabel}</SectionHeading>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelected}
          disabled={isDisabled}
          data-testid="video-source-input-file"
          style={{ display: "none" }}
        />
        <Button
          variant="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          data-testid="video-source-input-file-button"
        >
          {isUploading
            ? `${strings.uploadingLabel} (${uploadState.fileName})`
            : strings.uploadButtonLabel}
        </Button>
        {!isUploading ? (
          <span
            className="interlace-hint"
            data-testid="video-source-input-drop-hint"
            aria-live="polite"
          >
            {isDragging ? strings.dropActiveLabel : strings.dropHint}
          </span>
        ) : null}
        {isUploading ? (
          <span
            data-testid="video-source-input-uploading"
            className="interlace-hint"
            aria-live="polite"
          >
            {strings.uploadingLabel}
          </span>
        ) : null}
        {isUploading ? (
          <Button
            variant="secondary"
            onClick={handleCancelUpload}
            data-testid="video-source-input-cancel"
          >
            {strings.cancelUploadLabel}
          </Button>
        ) : null}
        {hasError ? (
          <div
            data-testid="video-source-input-error"
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: SPACE[2],
              color: COLORS.errorText,
              backgroundColor: COLORS.errorBg,
              padding: `${SPACE[2]}px ${SPACE[3]}px`,
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.errorBorder}`,
              fontSize: TYPE.sm,
            }}
          >
            <span>
              <strong>{strings.uploadFailedLabel}</strong>{" "}
              <span>{uploadState.message}</span>
            </span>
            <Button
              variant="danger"
              onClick={handleRetryUpload}
              data-testid="video-source-input-retry"
            >
              {strings.retryLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <Field label={strings.urlLabel}>
        {({ id }) => (
          <div style={{ display: "flex", gap: SPACE[2], flexWrap: "wrap" }}>
            <input
              id={id}
              type="url"
              className="interlace-input"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder={strings.urlPlaceholder}
              disabled={isDisabled}
              data-testid="video-source-input-url"
              style={{ flex: "1 1 240px", width: "auto" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !applyDisabled) {
                  e.preventDefault();
                  handleApplyUrl();
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={handleApplyUrl}
              disabled={applyDisabled}
              data-testid="video-source-input-apply"
            >
              {strings.applyUrlLabel}
            </Button>
          </div>
        )}
      </Field>
    </div>
  );
}

/** Whether a drag carries files (not text or a link). */
function hasFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}
