import {
  ContentInstance,
  ContentRecord,
  ContentState,
  ContentType,
  ContentTypeRegistry,
  DEFAULT_STRINGS,
  Hook,
  Placement,
  SerializedInteractiveMediaDocument,
  type Strings as CoreStrings,
} from "@interlace/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";
import type { InteractiveMediaItem } from "../hooks/use-authoring-store";
import { useAuthoringStore } from "../hooks/use-authoring-store";
import { ContentTypeEditor } from "./content-type-editor";
import { InspectorPanel } from "./inspector-panel";
import { KeyframeTimeline } from "./keyframe-timeline";
import { PlacementEditor } from "./placement-editor";
import type { PreviewModalStrings } from "./preview-modal";
import { PreviewModal } from "./preview-modal";
import type { VideoSourceInputStrings } from "./video-source-input";
import { VideoSourceInput } from "./video-source-input";

/**
 * Editor-local strings layered on top of the core `Strings`. Hosts pass
 * `strings?: Partial<EditorStrings>` and may override any subset of the
 * fields; the rest fall back to the defaults exported alongside.
 */
export interface EditorStrings extends CoreStrings {
  /** Heading for the video source step when no document is loaded. */
  videoSourceInputTitle: string;
  /** Title for the preview surface. */
  previewTitle: string;
  /** Label for the button that opens the preview modal. */
  previewLabel: string;
  /** Label for the button that re-opens the video source step on an existing document. */
  replaceVideoLabel: string;
  /** Label for the button that aborts a replace and returns to the authoring surface. */
  replaceCancelLabel: string;
  /** Label for the button that triggers `onSave`. */
  saveLabel: string;
  /** Shown when no item is selected for placement editing. */
  noItemSelectedLabel: string;
  /**
   * Heading for the placement editor section.
   *
   * @deprecated Unused since the placement editor became a video-frame
   * overlay (there is no separate placement section to head). Retained
   * for backward compatibility with hosts passing
   * `strings.placementLabel`. Will be removed in a future major.
   */
  placementLabel: string;
  /** Heading for the timeline area. */
  timelineHeading: string;
  /**
   * Heading for the add-content area.
   *
   * @deprecated Unused since the content type picker moved into the
   * Hook details panel. Retained for backward compatibility with hosts
   * passing `strings.addContentHeading`. Will be removed in a future
   * major.
   */
  addContentHeading: string;
  /** Heading for the Hook section (shown when a hook is selected). */
  hookHeading: string;
  /** Heading for the inline content editor subsection of the Hook section. */
  contentEditorHeading: string;
  /**
   * Label for the button that opens the content editor slot.
   *
   * @deprecated Unused since the slot opens on entry selection. Retained
   * for backward compatibility with hosts passing `strings.editContentLabel`
   * at the 1.0 API freeze. Will be removed in a future major.
   */
  editContentLabel: string;
  /** Shown when a host-supplied onError fires during a load failure. */
  loadErrorTitle: string;
  /** Shown when the video element has not yet reported a duration. */
  durationUnknownLabel: string;
  /**
   * String overrides forwarded to the embedded `VideoSourceInput`. The
   * first screen of the drop-in component is otherwise unreachable to a
   * host passing `strings`. Any field omitted falls back to
   * `DEFAULT_VIDEO_SOURCE_INPUT_STRINGS` in `VideoSourceInput`.
   */
  videoSource?: Partial<VideoSourceInputStrings>;
  /**
   * String overrides forwarded to the preview modal. Any field omitted
   * falls back to `DEFAULT_PREVIEW_MODAL_STRINGS` in `PreviewModal`.
   */
  previewModal?: Partial<PreviewModalStrings>;
}

/**
 * Defaults are derived from core's `DEFAULT_STRINGS` so a host that
 * overrides the core base gets matching inheritance automatically. The
 * editor-specific fields are filled in alongside.
 */
export const DEFAULT_EDITOR_STRINGS: EditorStrings = {
  ...DEFAULT_STRINGS,
  videoSourceInputTitle: "Add a video",
  previewTitle: "Preview",
  previewLabel: "Preview",
  replaceVideoLabel: "Replace video",
  replaceCancelLabel: "Cancel replace",
  saveLabel: "Save",
  noItemSelectedLabel: "Select an item to edit its placement.",
  placementLabel: "Placement",
  timelineHeading: "Hooks",
  addContentHeading: "Add content",
  hookHeading: "Hook",
  contentEditorHeading: "Content",
  editContentLabel: "Edit content",
  loadErrorTitle: "Could not load the document",
  durationUnknownLabel: "Duration unknown",
};

/**
 * Optional theme overrides. Hosts that want to recolor the editor without
 * shipping a CSS file can pass a `theme`; the editor applies these via
 * inline `style` on its root wrapper and on the save button. Anything not
 * provided falls back to a neutral default.
 */
export interface EditorTheme {
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
}

export interface InterlaceEditorProps {
  /** Registry of content types available for authoring. */
  contentTypeRegistry: ContentTypeRegistry;
  /**
   * Optional serialized document. Omit for a brand-new document (the
   * editor shows the video source step first). Provide to edit an
   * existing document; the editor calls `deserialize()` + `validate()`
   * on mount and surfaces any warnings via `onError`.
   */
  document?: SerializedInteractiveMediaDocument;
  /**
   * Host-supplied upload callback. Called by the video source step when
   * the user selects a file. The resolved URL is written into the
   * document; the host owns persistence.
   */
  onUpload: (file: File) => Promise<string>;
  /**
   * Receives `authoringStore.serialize()`'s output on save. The host
   * owns persistence — the editor never persists on its own.
   */
  onSave: (doc: SerializedInteractiveMediaDocument) => void;
  /** Optional string overrides. */
  strings?: Partial<EditorStrings>;
  /** Optional theme overrides. */
  theme?: EditorTheme;
  /** Optional error callback for upload, load, and runtime failures. */
  onError?: (error: Error) => void;
  /**
   * Host-level adapter type. Defaults to `"native"`. **Not** persisted
   * into the core serialized document; the host must re-supply this on
   * reload. The editor does not pass it to `serialize()`.
   */
  adapterType?: string;
}

const DEFAULT_PLACEMENT: Placement = { x: 50, y: 50, width: 20, height: 20 };

function makeDefaultData(contentTypeId: string): unknown {
  if (contentTypeId === "quiz" || contentTypeId === "quiz-editor") {
    // Canonical multi-question shape from creation (the single supported
    // quiz format).
    return {
      questions: [
        {
          id: "q-0",
          text: "",
          options: [
            { id: "opt-0", text: "" },
            { id: "opt-1", text: "" },
          ],
          correctOptionId: "opt-0",
        },
      ],
    };
  }
  return {};
}

function makeHook(
  hookType: "blocking" | "non-blocking",
  atTime: number,
  videoDuration: number,
): Hook {
  if (hookType === "blocking") {
    return {
      type: "blocking",
      timestamp: Math.max(0, atTime),
      placement: DEFAULT_PLACEMENT,
    };
  }
  // Origin-first (unifying with `clampTimeUpdates`): the playhead is
  // bounded inside the video so the created range never extends past
  // its end — a playhead exactly at the duration previously produced
  // `end = duration + 1`.
  const start = Math.max(0, Math.min(atTime, videoDuration - 1));
  // The default 10s range is clamped to the video duration, matching
  // every other path that mutates hook times (drag, edges, keyboard).
  // The 1s minimum range wins over the duration bound when the bounds
  // conflict — a 0-length range is worse than a sub-second overflow,
  // and the timeline's own end-edge clamp floors at `start + 1` the
  // same way.
  const end = Math.min(start + 10, Math.max(videoDuration, start + 1));
  return {
    type: "non-blocking",
    start,
    end,
    placement: DEFAULT_PLACEMENT,
    revealBehavior: "click",
  };
}

function buildContentInstance(
  id: string,
  title: string,
  contentType: ContentType,
  hook: Hook,
  data: unknown,
): ContentInstance {
  const record: ContentRecord = {
    id,
    title,
    contentTypeId: contentType.getId(),
    data,
    state: "pending" as ContentState,
    hook,
  };
  return new ContentInstance(record, contentType);
}

function rebuildContentInstance(
  content: ContentInstance,
  contentType: ContentType,
  overrides: { title?: string; data?: unknown; hook?: Hook },
): ContentInstance {
  const record: ContentRecord = {
    id: content.getId(),
    title: overrides.title ?? content.getTitle(),
    contentTypeId: content.getContentTypeId(),
    data: overrides.data !== undefined ? overrides.data : content.getData(),
    state: content.getState(),
    // The hook override is load-bearing: core's `serialize` reads the
    // hook from the instance's record (`content.getHook()`), NOT from
    // the store wrapper's parallel `hook` field. Every time/placement
    // edit must be rebuilt into the record or `Save` persists the old
    // hook.
    hook: overrides.hook ?? content.getHook(),
  };
  return new ContentInstance(record, contentType);
}

/**
 * A hook created at the playhead but not yet given a content type.
 * Pending hooks live only in editor-local state (never in the store —
 * `ContentInstance` requires a registered type), so `Save` does not
 * serialize them. Choosing a content type in Hook details materializes
 * the pending hook into the store.
 */
interface PendingHook {
  id: string;
  title: string;
  hook: Hook;
}

/**
 * Clamps manual time edits to the video bounds with the same policies
 * as the timeline's drag paths: blocking timestamps stay inside
 * `[0, duration]`; non-blocking ranges keep `start < end` with at
 * least a 1s span and both ends inside the video.
 */
function clampTimeUpdates(
  hook: Hook,
  updates: { timestamp?: number; start?: number; end?: number },
  videoDuration: number,
): { timestamp?: number; start?: number; end?: number } {
  if (hook.type === "blocking") {
    const t = updates.timestamp ?? hook.timestamp;
    return { timestamp: Math.max(0, Math.min(t, videoDuration)) };
  }
  const start = updates.start ?? hook.start;
  const end = updates.end ?? hook.end;
  // Origin-first ordering (mirroring `clampPlacement`): bound the start
  // against the video first, then the end against both the start and
  // the video. Without the duration bound on `start`, manual inputs
  // could produce ranges entirely beyond the video (duration 60, start
  // 100, end 110) — a state no timeline drag path can produce.
  const nextStart = Math.max(0, Math.min(start, videoDuration - 1));
  const nextEnd = Math.max(nextStart + 1, Math.min(end, videoDuration));
  return { start: nextStart, end: nextEnd };
}

/**
 * Toolbar below the video frame showing the current duration, an
 * optional selection hint, a button to replace the video (re-opens the
 * source step in replace mode), and a button that opens the preview
 * modal. This toolbar must stay OUTSIDE the video's positioning
 * context: the placement overlay (Phase 3) maps its percentages against
 * the `position: relative` wrapper that hugs exactly the `<video>`
 * element, and an in-flow toolbar inside that wrapper would offset
 * every rectangle by the toolbar's height.
 */
function EditorVideoToolbar({
  duration,
  strings,
  onReplaceVideo,
  onOpenPreview,
  theme,
  hint,
}: {
  duration: number | undefined;
  strings: EditorStrings;
  onReplaceVideo: () => void;
  onOpenPreview: () => void;
  theme?: EditorTheme;
  /** Shown next to the duration when no item is selected. */
  hint?: string;
}) {
  return (
    <div
      data-testid="interlace-editor-video-toolbar"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: `${SPACE[2]}px 0`,
        fontSize: TYPE.sm,
        color: theme?.mutedTextColor ?? COLORS.textMuted,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span data-testid="interlace-editor-video-duration">
          {duration === undefined || !Number.isFinite(duration)
            ? strings.durationUnknownLabel
            : `${duration.toFixed(1)}s`}
        </span>
        {hint ? (
          <span data-testid="interlace-editor-selection-hint">{hint}</span>
        ) : null}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onReplaceVideo}
          data-testid="interlace-editor-replace-video"
          style={{
            padding: `${SPACE[1]}px ${SPACE[3]}px`,
            backgroundColor: "transparent",
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: RADIUS.sm,
            cursor: "pointer",
            fontSize: TYPE.sm,
            color: COLORS.text,
            transition: "background-color 150ms ease, border-color 150ms ease",
          }}
        >
          {strings.replaceVideoLabel}
        </button>
        <button
          type="button"
          onClick={onOpenPreview}
          data-testid="interlace-editor-open-preview"
          style={{
            padding: `${SPACE[1]}px ${SPACE[3]}px`,
            backgroundColor: theme?.accentColor ?? COLORS.accent,
            color: COLORS.white,
            border: "none",
            borderRadius: RADIUS.sm,
            cursor: "pointer",
            fontSize: TYPE.sm,
            fontWeight: 600,
            transition: "background-color 150ms ease",
          }}
        >
          {strings.previewLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * InterlaceEditor - the top-level component a host app actually renders
 * to author an interactive video document. Mirrors `InteractiveVideoPlayer`
 * on the player side: it is the single drop-in surface for the editor.
 *
 * The component composes:
 * - `VideoSourceInput` (shown first when the document has no video source)
 * - An authoring-time video surface (a `<video>` element) used by the
 *   placement editor (Phase 3) and the timeline playhead (Phase 4)
 * - `PreviewModal` for the gated "what students will see" surface
 *   (replaces the prior always-on preview). The modal mounts
 *   `InteractiveVideoPlayer` + a fresh `NativeVideoAdapter` over its
 *   own `<video>`, so the student view and the authoring view are
 *   decoupled.
 * - `KeyframeTimeline` for keyframe-style hook CRUD
 * - `PlacementEditor` for the selected item's placement
 * - `InspectorPanel` (Hook details) plus the inline `ContentTypeEditor`
 *   for editing the selected hook; new hooks are added at the playhead
 *   and re-typed from Hook details
 *
 * Behavior:
 * - Video duration is captured from the preview `<video>`'s
 *   `loadedmetadata` and pushed into the store so the serialized
 *   document is not stale.
 * - A "Replace video" button re-opens the source step in replace mode.
 * - A "Preview" button opens the modal; opening the modal pauses the
 *   authoring video so the two surfaces do not play in parallel.
 * - `adapterType` is a host-level prop (default `"native"`); it is not
 *   written into the serialized document.
 */
export function InterlaceEditor({
  contentTypeRegistry,
  document,
  onUpload,
  onSave,
  strings: stringsOverride,
  theme,
  onError,
}: InterlaceEditorProps) {
  const strings = { ...DEFAULT_EDITOR_STRINGS, ...stringsOverride };
  const {
    state,
    addItem,
    removeItem,
    updateItem,
    loadDocument,
    serialize,
    setVideoMetadata,
  } = useAuthoringStore(
    document?.video?.src ?? "",
    document?.video?.duration ?? 0,
  );

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  /**
   * A hook created at the playhead that has no content type yet. Lives
   * only in editor-local state — it appears in the timeline and Hook
   * details, but `Save` does not serialize it. Choosing a content type
   * in Hook details materializes it into the store.
   */
  const [pendingHook, setPendingHook] = useState<PendingHook | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  /** Authoring-video playhead position in seconds (drives the timeline). */
  const [currentTime, setCurrentTime] = useState(0);
  /** Whether the authoring video is currently playing (drives the timeline's play button). */
  const [isPlaying, setIsPlaying] = useState(false);
  const nextIdRef = useRef(1);
  const registryRef = useRef(contentTypeRegistry);
  registryRef.current = contentTypeRegistry;
  const loadedInitialDocRef = useRef<SerializedInteractiveMediaDocument | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /**
   * Last reported duration for the *current* `videoSrc`. When the load
   * effect overwrites a freshly observed duration with the document's
   * stale value (cached video fires `loadedmetadata` before the load
   * commits), a follow-up effect re-pushes this value.
   */
  const lastDurationForSrcRef = useRef<{
    src: string;
    duration: number;
  } | null>(null);
  /**
   * Pending seek target. Set when `handleSelectEntry`'s `video.currentTime`
   * setter throws (the video has not loaded metadata yet) and consumed by
   * `handlePreviewLoadedMetadata` once the video is ready. Without this,
   * selecting a hook before the preview's `<video>` has metadata silently
   * does nothing, and the user has to click again after `loadedmetadata`
   * fires.
   */
  const pendingSeekRef = useRef<number | null>(null);

  // Load the initial document once per document identity. The effect is
  // keyed on the document only (not the registry) so a consumer that
  // recreates the registry on every render does not reload and wipe
  // in-progress edits.
  useEffect(() => {
    if (!document) {
      // Clear the pending hook only on an actual transition out of a
      // document. The effect re-runs on unrelated identity churn (e.g.
      // a host-inlined `onError` callback), and must not destroy a
      // draft on those runs.
      if (loadedInitialDocRef.current !== null) {
        loadedInitialDocRef.current = null;
        setPendingHook(null);
      }
      return;
    }
    if (loadedInitialDocRef.current === document) return;
    loadedInitialDocRef.current = document;
    // Loading a different document starts a new authoring session; a
    // pending hook from the old one is dropped.
    setPendingHook(null);
    const { validationErrors, warnings } = loadDocument(
      document,
      registryRef.current,
    );
    if (validationErrors.length > 0) {
      onError?.(
        new Error(`${strings.loadErrorTitle}: ${validationErrors.join("; ")}`),
      );
    }
    // Warnings are *not* cosmetic: `deserialize` skips items that produce
    // them (unrecognized content type, invalid hook, version mismatch
    // without `migrate`). The store ends up pruned, and a later Save
    // persists the pruned document. Surface them through `onError` so the
    // host can decide what to do (re-register, migrate, refuse to save).
    for (const warning of warnings) {
      onError?.(new Error(warning));
    }
  }, [document, loadDocument, onError, strings.loadErrorTitle]);

  // Repair: if the document load commits *after* the preview video
  // already reported metadata, re-push the observed duration. Without
  // this, a cached video that fires `loadedmetadata` before the load
  // effect's setState commits would have its real duration overwritten
  // by the document's stale value and `loadedmetadata` would never
  // re-fire (the `<video>`'s `key` is unchanged, no remount).
  useEffect(() => {
    const last = lastDurationForSrcRef.current;
    if (!last) return;
    if (last.src !== state.videoSrc) return;
    if (Math.abs(last.duration - state.videoDuration) < 0.001) return;
    setVideoMetadata(last.src, last.duration);
  }, [state.videoSrc, state.videoDuration, setVideoMetadata]);

  const hasVideo = Boolean(state.videoSrc);
  const showSourceStep = !hasVideo || replaceMode;

  const selectedStoreItem = useMemo(
    () =>
      state.items.find((item) => item.content.getId() === selectedItemId) ??
      null,
    [state.items, selectedItemId],
  );
  const isPendingSelected =
    !selectedStoreItem &&
    pendingHook != null &&
    pendingHook.id === selectedItemId;
  /** The selected hook's time data — store item or pending, unified. */
  const selectedHook: Hook | null = isPendingSelected
    ? (pendingHook?.hook ?? null)
    : (selectedStoreItem?.hook ?? null);
  const selectedTitle: string | null = isPendingSelected
    ? (pendingHook?.title ?? null)
    : (selectedStoreItem?.content.getTitle() ?? null);
  /**
   * `null` for a pending hook (content type not yet chosen) — the
   * Hook details panel shows the picker in that case, and the inline
   * content editor is hidden.
   */
  const selectedContentTypeId: string | null = isPendingSelected
    ? null
    : (selectedStoreItem?.content.getContentTypeId() ?? null);
  const selectedContent = selectedStoreItem?.content ?? null;

  const selectedData = useMemo(
    () => (selectedContent ? selectedContent.getData() : null),
    [selectedContent],
  );

  const registeredTypeIds = useMemo(
    () => contentTypeRegistry.getAll().map((ct) => ct.getId()),
    [contentTypeRegistry],
  );

  const timelineEntries = useMemo(() => {
    const fromStore = state.items.map((item) => {
      const hook = item.hook;
      if (hook.type === "blocking") {
        return {
          id: item.content.getId(),
          title: item.content.getTitle(),
          hookType: "blocking" as const,
          timestamp: hook.timestamp,
        };
      }
      return {
        id: item.content.getId(),
        title: item.content.getTitle(),
        hookType: "non-blocking" as const,
        start: hook.start,
        end: hook.end,
      };
    });
    // The pending hook (created at the playhead, content type not yet
    // chosen) is a first-class timeline entry — it just is not part of
    // the store until it is materialized.
    if (!pendingHook) return fromStore;
    const hook = pendingHook.hook;
    return [
      ...fromStore,
      hook.type === "blocking"
        ? {
            id: pendingHook.id,
            title: pendingHook.title,
            hookType: "blocking" as const,
            timestamp: hook.timestamp,
          }
        : {
            id: pendingHook.id,
            title: pendingHook.title,
            hookType: "non-blocking" as const,
            start: hook.start,
            end: hook.end,
          },
    ];
  }, [state.items, pendingHook]);

  /**
   * The serialized document fed to the preview modal. Memoized on the
   * specific state slices that affect its content so a parent
   * re-render that does not change the document does not restart the
   * player's controller.
   */
  const previewDocument = useMemo<SerializedInteractiveMediaDocument>(() => {
    if (!state.videoSrc) {
      return { video: { src: "" }, items: [] };
    }
    return {
      video: {
        src: state.videoSrc,
        duration: state.videoDuration,
      },
      items: state.items.map((item) => ({
        id: item.content.getId(),
        title: item.content.getTitle(),
        hook: item.hook,
        content: {
          contentTypeId: item.content.getContentTypeId(),
          version: item.content.getContentTypeVersion(),
          data: item.content.getData(),
        },
      })),
    };
    // The memo is intentionally keyed on the document's content
    // slices only. `state.items` is a new array reference on every
    // store update; the controller will restart when items change,
    // which is the correct semantic (the document did change).
  }, [state.videoSrc, state.videoDuration, state.items]);

  const handleSelectEntry = useCallback(
    (id: string) => {
      setSelectedItemId(id);
      // Seek the shared authoring video to the hook's anchor time so
      // the preview and placement overlay show the frame the hook is
      // attached to. Pending hooks (no content type yet) are seekable
      // too — their times live in editor-local state.
      const item = state.items.find((it) => it.content.getId() === id);
      const hook = item
        ? item.content.getHook()
        : pendingHook?.id === id
          ? pendingHook.hook
          : null;
      if (!hook) return;
      const target = hook.type === "blocking" ? hook.timestamp : hook.start;
      if (!Number.isFinite(target)) return;
      const video = videoRef.current;
      if (video) {
        try {
          video.currentTime = Math.max(0, target);
        } catch {
          // The video has not loaded metadata yet. Defer the seek
          // until `loadedmetadata` fires; the consuming handler is
          // `handlePreviewLoadedMetadata` below.
          pendingSeekRef.current = Math.max(0, target);
        }
      } else {
        // No live video element (e.g. source step shown). Defer until
        // the <video> mounts; same consumer.
        pendingSeekRef.current = Math.max(0, target);
      }
      // Keep the timeline playhead in sync immediately; the video's own
      // `timeupdate` confirms once the seek lands.
      setCurrentTime(Math.max(0, target));
    },
    [state.items, pendingHook, setCurrentTime],
  );

  /** Clicking the timeline track background deselects the hook. */
  const handleDeselect = useCallback(() => {
    setSelectedItemId(null);
  }, []);

  const handleAddEntry = useCallback(
    (hookType: "blocking" | "non-blocking") => {
      const id = `pending-${nextIdRef.current++}`;
      // The keyframe metaphor: new hooks land at the current playhead,
      // clamped to the video's duration. They start WITHOUT a content
      // type — Hook details picks one and materializes the hook into
      // the store. Until then the hook is editor-local only and `Save`
      // does not serialize it.
      const hook = makeHook(hookType, currentTime, state.videoDuration);
      setPendingHook({ id, title: "New hook", hook });
      setSelectedItemId(id);
    },
    [currentTime, state.videoDuration],
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      if (pendingHook?.id === id) {
        setPendingHook(null);
        setSelectedItemId((prev) => (prev === id ? null : prev));
        return;
      }
      removeItem(id);
      setSelectedItemId((prev) => (prev === id ? null : prev));
    },
    [pendingHook, removeItem],
  );

  const handleUpdateEntry = useCallback(
    (
      id: string,
      updates: {
        title?: string;
        timestamp?: number;
        start?: number;
        end?: number;
      },
    ) => {
      if (pendingHook?.id === id) {
        // Pending hook: times and title live in editor-local state.
        setPendingHook((prev) => {
          if (!prev || prev.id !== id) return prev;
          const hook = prev.hook;
          const nextHook =
            hook.type === "blocking"
              ? { ...hook, timestamp: updates.timestamp ?? hook.timestamp }
              : {
                  ...hook,
                  start: updates.start ?? hook.start,
                  end: updates.end ?? hook.end,
                };
          return {
            ...prev,
            title:
              typeof updates.title === "string" ? updates.title : prev.title,
            hook: nextHook,
          };
        });
        return;
      }
      const current = state.items.find((item) => item.content.getId() === id);
      if (!current) return;
      const contentType = contentTypeRegistry.get(
        current.content.getContentTypeId(),
      );
      if (!contentType) return;
      const title =
        typeof updates.title === "string"
          ? updates.title
          : current.content.getTitle();
      let hook = current.hook;
      if (hook.type === "blocking") {
        hook = { ...hook, timestamp: updates.timestamp ?? hook.timestamp };
      } else {
        hook = {
          ...hook,
          start: updates.start ?? hook.start,
          end: updates.end ?? hook.end,
        };
      }
      updateItem(id, {
        content: rebuildContentInstance(current.content, contentType, {
          title,
          hook,
        }),
        hook,
      });
    },
    [pendingHook, state.items, contentTypeRegistry, updateItem],
  );

  const handlePlacementChange = useCallback(
    (nextPlacement: Placement) => {
      if (!selectedItemId) return;
      if (pendingHook?.id === selectedItemId) {
        setPendingHook((prev) =>
          prev && prev.id === selectedItemId
            ? { ...prev, hook: { ...prev.hook, placement: nextPlacement } }
            : prev,
        );
        return;
      }
      const current = state.items.find(
        (item) => item.content.getId() === selectedItemId,
      );
      if (!current) return;
      const contentType = contentTypeRegistry.get(
        current.content.getContentTypeId(),
      );
      if (!contentType) return;
      const nextHook = { ...current.hook, placement: nextPlacement };
      updateItem(selectedItemId, {
        content: rebuildContentInstance(current.content, contentType, {
          hook: nextHook,
        }),
        hook: nextHook,
      });
    },
    [selectedItemId, pendingHook, state.items, contentTypeRegistry, updateItem],
  );

  /** Content editor onChange for a materialized (typed) hook. */
  const handleContentChange = useCallback(
    (newData: unknown) => {
      if (!selectedItemId) return;
      const current = state.items.find(
        (item) => item.content.getId() === selectedItemId,
      );
      if (!current) return;
      const contentType = contentTypeRegistry.get(
        current.content.getContentTypeId(),
      );
      if (!contentType) return;
      const updatedContent = rebuildContentInstance(
        current.content,
        contentType,
        { data: newData },
      );
      const updatedItem: InteractiveMediaItem = {
        content: updatedContent,
        hook: current.hook,
      };
      updateItem(selectedItemId, updatedItem);
    },
    [selectedItemId, state.items, contentTypeRegistry, updateItem],
  );

  /**
   * Materializes a pending hook into the store once its content type
   * is chosen in Hook details (a clean store id is generated and
   * selected so the inline content editor appears immediately), or
   * re-types an existing hook: the authored data is reset to the new
   * type's default shape (data shapes differ per type) while the
   * hook's time, placement, and title are preserved. Selecting the
   * current type is a no-op.
   */
  const handleContentTypeSelect = useCallback(
    (typeId: string) => {
      if (!selectedItemId) return;
      const contentType = contentTypeRegistry.get(typeId);
      if (!contentType) return;
      if (pendingHook?.id === selectedItemId) {
        const id = `hook-${nextIdRef.current++}`;
        const item = buildContentInstance(
          id,
          pendingHook.title,
          contentType,
          pendingHook.hook,
          makeDefaultData(contentType.getId()),
        );
        addItem({ content: item, hook: pendingHook.hook });
        setPendingHook(null);
        setSelectedItemId(id);
        return;
      }
      const current = state.items.find(
        (item) => item.content.getId() === selectedItemId,
      );
      if (!current) return;
      if (current.content.getContentTypeId() === typeId) return;
      const rebuilt = buildContentInstance(
        current.content.getId(),
        current.content.getTitle(),
        contentType,
        current.hook,
        makeDefaultData(contentType.getId()),
      );
      updateItem(selectedItemId, { content: rebuilt, hook: current.hook });
    },
    [
      pendingHook,
      selectedItemId,
      contentTypeRegistry,
      addItem,
      state.items,
      updateItem,
    ],
  );

  /** Manual time edits from Hook details (clamped, pending-aware). */
  const handleTimeChange = useCallback(
    (updates: { timestamp?: number; start?: number; end?: number }) => {
      if (!selectedItemId) return;
      const isPending = pendingHook?.id === selectedItemId;
      const hook = isPending
        ? pendingHook?.hook
        : state.items.find((it) => it.content.getId() === selectedItemId)?.hook;
      if (!hook) return;
      const clamped = clampTimeUpdates(hook, updates, state.videoDuration);
      if (isPending) {
        setPendingHook((prev) =>
          prev && prev.id === selectedItemId
            ? { ...prev, hook: { ...prev.hook, ...clamped } as Hook }
            : prev,
        );
        return;
      }
      handleUpdateEntry(selectedItemId, clamped);
    },
    [
      selectedItemId,
      pendingHook,
      state.items,
      state.videoDuration,
      handleUpdateEntry,
    ],
  );

  const handleVideoSourceChange = useCallback(
    (next: { src: string; duration?: number }) => {
      // Same-URL replace: the `<video>`'s `key` is unchanged so
      // `loadedmetadata` will not re-fire. Preserve any duration the
      // preview element already reported, otherwise the document is
      // silently reset to duration 0.
      const preserveDuration =
        next.src === state.videoSrc ? state.videoDuration : 0;
      const duration = next.duration ?? preserveDuration;
      setVideoMetadata(next.src, duration);
      setReplaceMode(false);
      // A video replace changes the timeline the pending hook's anchor
      // times reference — drop it, matching the document-load path
      // (both start a new authoring session for hook times). Also
      // close any open preview so the user lands on a clean surface.
      setPendingHook(null);
      setPreviewOpen(false);
    },
    [setVideoMetadata, setPendingHook, state.videoSrc, state.videoDuration],
  );

  const handleReplaceVideo = useCallback(() => {
    setReplaceMode(true);
  }, []);

  const handleCancelReplace = useCallback(() => {
    setReplaceMode(false);
  }, []);

  /** Mirrors the authoring video's playhead into the timeline. */
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setCurrentTime(e.currentTarget.currentTime);
    },
    [],
  );

  /**
   * Timeline-initiated seek (playhead drag, ruler click, keyboard).
   * Sets the video's time when it can, defers through the pending-seek
   * mechanism when it cannot, and always keeps the playhead responsive
   * immediately so the strip does not lag behind the pointer.
   */
  const handleTimelineSeek = useCallback((time: number) => {
    const t = Math.max(0, time);
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = t;
      } catch {
        // Video not ready; the pending-seek mechanism applies it once
        // metadata loads.
        pendingSeekRef.current = t;
      }
    } else {
      pendingSeekRef.current = t;
    }
    setCurrentTime(t);
  }, []);

  /** Play/pause for the authoring video (drives the timeline button). */
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        const p = video.play() as unknown as Promise<void> | undefined;
        p?.catch?.(() => {
          // Autoplay policy or engine restriction; the button state
          // corrects on the next play/pause event.
        });
      } catch {
        // jsdom and some engines throw synchronously.
      }
    } else {
      try {
        video.pause();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleOpenPreview = useCallback(() => {
    setPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  // When the preview modal opens, pause the authoring video so the
  // student view (in the modal) and the authoring surface do not
  // play in parallel. When the modal closes, leave the authoring
  // video paused — the user can press play to resume.
  useEffect(() => {
    if (previewOpen && videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // The video may not be ready yet; ignore.
      }
    }
  }, [previewOpen]);

  const handlePreviewLoadedMetadata = useCallback(
    (duration: number) => {
      // Track the last reported duration per src so the load-effect
      // repair pass can re-push it after the document commits its
      // potentially-stale value.
      if (state.videoSrc) {
        lastDurationForSrcRef.current = {
          src: state.videoSrc,
          duration,
        };
      }
      // Push the actual video duration into the store so the serialized
      // document is not stale.
      setVideoMetadata(state.videoSrc, duration);
      // Consume any pending seek that was deferred because the
      // <video> was not ready when `handleSelectEntry` fired. Now that
      // metadata is loaded, the setter is safe to call.
      const pending = pendingSeekRef.current;
      if (pending != null && videoRef.current) {
        try {
          videoRef.current.currentTime = pending;
        } catch {
          // Defensive: if the setter still throws, leave the ref alone
          // so the next metadata event (e.g. after a remount) can
          // re-attempt.
        }
        pendingSeekRef.current = null;
      }
    },
    [state.videoSrc, setVideoMetadata],
  );

  const handleSave = useCallback(() => {
    onSave(serialize());
  }, [onSave, serialize]);

  // Styling derived from the optional theme prop.
  const rootStyle: React.CSSProperties = {
    backgroundColor: theme?.backgroundColor ?? COLORS.surface,
    color: theme?.textColor ?? COLORS.text,
    borderColor: theme?.borderColor ?? COLORS.border,
  };
  const saveButtonStyle: React.CSSProperties = {
    backgroundColor: theme?.accentColor ?? COLORS.accent,
    color: COLORS.white,
  };
  const surfaceStyle: React.CSSProperties = {
    backgroundColor: theme?.surfaceColor ?? COLORS.surfaceRaised,
    borderColor: theme?.borderColor ?? COLORS.border,
  };

  if (showSourceStep) {
    return (
      <div
        className="interlace-editor"
        style={{
          ...rootStyle,
          padding: 16,
          borderRadius: 8,
          border: "1px solid",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: FONTS.display,
              fontSize: TYPE.lg,
              fontWeight: 600,
            }}
          >
            {strings.videoSourceInputTitle}
          </h2>
          {replaceMode ? (
            <button
              type="button"
              onClick={handleCancelReplace}
              data-testid="interlace-editor-cancel-replace"
              style={{
                padding: `${SPACE[1]}px ${SPACE[3]}px`,
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: RADIUS.sm,
                cursor: "pointer",
                fontSize: TYPE.sm,
                color: COLORS.text,
                transition: "background-color 150ms ease",
              }}
            >
              {strings.replaceCancelLabel}
            </button>
          ) : null}
        </div>
        <VideoSourceInput
          value={{
            src: state.videoSrc || undefined,
            duration: state.videoDuration || undefined,
          }}
          onChange={handleVideoSourceChange}
          onUpload={onUpload}
          onError={onError}
          strings={strings.videoSource}
        />
      </div>
    );
  }

  return (
    <div
      className="interlace-editor"
      style={{
        ...rootStyle,
        padding: 16,
        borderRadius: 8,
        border: "1px solid",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: FONTS.display,
            fontSize: TYPE.lg,
            fontWeight: 600,
          }}
        >
          {strings.previewTitle}
        </h2>
        <button
          type="button"
          onClick={handleSave}
          data-testid="interlace-editor-save"
          style={{
            ...saveButtonStyle,
            padding: `${SPACE[2]}px ${SPACE[4]}px`,
            border: "none",
            borderRadius: RADIUS.sm,
            cursor: "pointer",
            fontSize: TYPE.md,
            fontWeight: 600,
            boxShadow: SHADOWS.sm,
            transition: "background-color 150ms ease",
          }}
        >
          {strings.saveLabel}
        </button>
      </header>

      {/*
        The positioning context for the placement overlay must wrap
        exactly the video: an in-flow toolbar inside this wrapper would
        offset every rectangle by the toolbar's height (Gate 3
        Material #2). The toolbar therefore sits below the frame.
      */}
      <section
        className="interlace-editor-video"
        style={{
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div
          data-testid="interlace-editor-video"
          style={{ position: "relative" }}
        >
          <video
            ref={videoRef}
            key={state.videoSrc}
            src={state.videoSrc}
            controls
            preload="metadata"
            onLoadedMetadata={(e) =>
              handlePreviewLoadedMetadata(e.currentTarget.duration)
            }
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            data-testid="interlace-editor-preview-video"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              backgroundColor: "#000",
            }}
          />
          {selectedHook ? (
            <PlacementEditor
              placement={selectedHook.placement}
              onPlacementChange={handlePlacementChange}
            />
          ) : null}
        </div>
        <EditorVideoToolbar
          duration={state.videoDuration || undefined}
          strings={strings}
          onReplaceVideo={handleReplaceVideo}
          onOpenPreview={handleOpenPreview}
          theme={theme}
          hint={selectedHook ? undefined : strings.noItemSelectedLabel}
        />
      </section>

      <PreviewModal
        isOpen={previewOpen}
        videoSrc={state.videoSrc}
        document={previewDocument}
        contentTypeRegistry={contentTypeRegistry}
        onClose={handleClosePreview}
        onError={onError}
        strings={strings.previewModal}
      />

      <section
        className="interlace-editor-timeline"
        style={{
          ...surfaceStyle,
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          border: "1px solid",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            fontFamily: FONTS.display,
            fontSize: TYPE.md,
            fontWeight: 600,
          }}
        >
          {strings.timelineHeading}
        </h3>
        <KeyframeTimeline
          entries={timelineEntries}
          selectedId={selectedItemId ?? undefined}
          videoDuration={state.videoDuration || 0}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSeek={handleTimelineSeek}
          onTogglePlay={handleTogglePlay}
          onSelectEntry={handleSelectEntry}
          onUpdateEntry={handleUpdateEntry}
          onDeleteEntry={handleDeleteEntry}
          onAddEntry={handleAddEntry}
          onDeselect={handleDeselect}
        />
      </section>

      {selectedItemId && selectedHook ? (
        <section
          className="interlace-editor-hook"
          data-testid="interlace-editor-hook"
          style={{
            ...surfaceStyle,
            marginTop: 16,
            padding: 16,
            borderRadius: 8,
            border: "1px solid",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              fontFamily: FONTS.display,
              fontSize: TYPE.md,
              fontWeight: 600,
            }}
          >
            {strings.hookHeading}
          </h3>
          {/* Hook details: title, type, time/timespan, manual placement
              inputs, content type selection. */}
          <InspectorPanel
            entry={{
              id: selectedItemId,
              title: selectedTitle ?? "",
              hookType: selectedHook.type,
              timestamp:
                selectedHook.type === "blocking"
                  ? selectedHook.timestamp
                  : undefined,
              start:
                selectedHook.type === "non-blocking"
                  ? selectedHook.start
                  : undefined,
              end:
                selectedHook.type === "non-blocking"
                  ? selectedHook.end
                  : undefined,
              videoDuration: state.videoDuration || 0,
              contentTypeId: selectedContentTypeId,
              registeredTypes: registeredTypeIds,
            }}
            onTitleChange={(title) =>
              handleUpdateEntry(selectedItemId, { title })
            }
            onTimeChange={handleTimeChange}
            onContentTypeSelect={handleContentTypeSelect}
            placement={selectedHook.placement}
            onPlacementChange={handlePlacementChange}
            onDelete={() => handleDeleteEntry(selectedItemId)}
          />
          {/* Content editor: shown once the hook has a content type. A
              newly created hook (pending) hides it until the type is
              chosen in Hook details. */}
          {selectedContentTypeId ? (
            <div style={{ marginTop: 12 }}>
              <h4
                style={{
                  margin: `0 0 ${SPACE[1]}px 0`,
                  fontSize: TYPE.sm,
                  color: theme?.mutedTextColor ?? COLORS.textMuted,
                  fontWeight: 600,
                }}
              >
                {strings.contentEditorHeading}
              </h4>
              <ContentTypeEditor
                contentTypeId={selectedContentTypeId}
                registry={contentTypeRegistry}
                data={selectedData}
                onChange={handleContentChange}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
