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
import { Anchor, BlockingOverlay } from "@interlace/player";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useAuthoringStore } from "../hooks/use-authoring-store";
import type { InteractiveMediaItem } from "../hooks/use-authoring-store";
import { ContentTypeEditorSlot } from "./content-type-editor-slot";
import { ContentTypePicker } from "./content-type-picker";
import { PlacementEditor } from "./placement-editor";
import { Timeline } from "./timeline";
import { VideoSourceInput } from "./video-source-input";
import type {
  VideoSourceInputStrings,
} from "./video-source-input";

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
  /** Label for the button that re-opens the video source step on an existing document. */
  replaceVideoLabel: string;
  /** Label for the button that aborts a replace and returns to the authoring surface. */
  replaceCancelLabel: string;
  /** Label for the button that triggers `onSave`. */
  saveLabel: string;
  /** Shown when no item is selected for placement editing. */
  noItemSelectedLabel: string;
  /** Heading for the placement editor section. */
  placementLabel: string;
  /** Heading for the timeline area. */
  timelineHeading: string;
  /** Heading for the add-content area. */
  addContentHeading: string;
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
  replaceVideoLabel: "Replace video",
  replaceCancelLabel: "Cancel replace",
  saveLabel: "Save",
  noItemSelectedLabel: "Select an item to edit its placement.",
  placementLabel: "Placement",
  timelineHeading: "Hooks",
  addContentHeading: "Add content",
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

const DEFAULT_CONTENT_TYPE_ID = "quiz-editor";
const DEFAULT_PLACEMENT: Placement = { x: 50, y: 50, width: 20, height: 20 };

function makeDefaultData(contentTypeId: string): unknown {
  if (contentTypeId === "quiz" || contentTypeId === "quiz-editor") {
    return { question: "", options: ["", ""], correctIndex: 0 };
  }
  return {};
}

function makeHook(hookType: "blocking" | "non-blocking"): Hook {
  if (hookType === "blocking") {
    return { type: "blocking", timestamp: 0, placement: DEFAULT_PLACEMENT };
  }
  return {
    type: "non-blocking",
    start: 0,
    end: 10,
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
  overrides: { title?: string; data?: unknown },
): ContentInstance {
  const record: ContentRecord = {
    id: content.getId(),
    title: overrides.title ?? content.getTitle(),
    contentTypeId: content.getContentTypeId(),
    data: overrides.data !== undefined ? overrides.data : content.getData(),
    state: content.getState(),
    hook: content.getHook(),
  };
  return new ContentInstance(record, contentType);
}

function pickDefaultContentTypeId(registry: ContentTypeRegistry): string {
  const ids = registry.getAll().map((ct) => ct.getId());
  if (ids.includes(DEFAULT_CONTENT_TYPE_ID)) return DEFAULT_CONTENT_TYPE_ID;
  if (ids.includes("quiz")) return "quiz";
  return ids[0] ?? DEFAULT_CONTENT_TYPE_ID;
}

/**
 * Editor preview surface — the `<video>` element with anchored hooks
 * rendered on top. The anchors are the player's `Anchor` component
 * (no second renderer inside the editor) but the click behavior is
 * local: the editor opens a *preview* BlockingOverlay that does not
 * actually score or persist a completion, so the store's items are
 * never mutated by the preview.
 */
function EditorPreview({
  videoRef,
  videoSrc,
  videoDuration,
  items,
  onLoadedMetadata,
  onReplaceVideo,
  strings,
  onAnchorClick,
  previewingContent,
  onClosePreview,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoSrc: string;
  videoDuration: number | undefined;
  items: { content: ContentInstance }[];
  onLoadedMetadata: (duration: number) => void;
  onReplaceVideo: () => void;
  strings: EditorStrings;
  onAnchorClick: (contentId: string) => void;
  previewingContent: ContentInstance | null;
  onClosePreview: () => void;
}) {
  return (
    <div
      className="interlace-editor-preview"
      data-testid="interlace-editor-preview"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <video
        ref={videoRef}
        key={videoSrc}
        src={videoSrc}
        controls
        preload="metadata"
        onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget.duration)}
        data-testid="interlace-editor-preview-video"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          backgroundColor: "#000",
        }}
      />
      <div
        className="interlace-editor-preview-overlay"
        data-testid="interlace-editor-preview-overlay"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {items.map((item) => {
          const hook = item.content.getHook();
          return (
            <Anchor
              key={item.content.getId()}
              id={item.content.getId()}
              placement={hook.placement}
              title={item.content.getTitle()}
              onClick={() => onAnchorClick(item.content.getId())}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
          fontSize: 13,
          color: "#666",
        }}
      >
        <span data-testid="interlace-editor-preview-duration">
          {videoDuration === undefined
            ? strings.durationUnknownLabel
            : `${videoDuration.toFixed(1)}s`}
        </span>
        <button
          type="button"
          onClick={onReplaceVideo}
          data-testid="interlace-editor-replace-video"
          style={{
            padding: "4px 12px",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {strings.replaceVideoLabel}
        </button>
      </div>
      {previewingContent ? (
        <BlockingOverlay
          content={previewingContent}
          onClose={onClosePreview}
          onSubmit={onClosePreview}
        />
      ) : null}
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
 * - Video preview + the player's `Anchor` + `BlockingOverlay` for an
 *   authoring-time preview (no controller is run; the store is not mutated)
 * - `Timeline` for CRUD over hooks
 * - `PlacementEditor` for the selected item's placement
 * - `ContentTypePicker` + `ContentTypeEditorSlot` for adding/editing hooks
 *
 * Behavior:
 * - Video duration is captured from the preview `<video>`'s
 *   `loadedmetadata` and pushed into the store so the serialized
 *   document is not stale.
 * - A "Replace video" button re-opens the source step in replace mode.
 * - `adapterType` is a host-level prop (default `"native"`); it is not
 *   written into the serialized document.
 * - The editor uses the player's `Anchor` directly (not `OverlayLayer`),
 *   so authored items are never mutated by the preview.
 */
export function InterlaceEditor({
  contentTypeRegistry,
  document,
  onUpload,
  onSave,
  strings: stringsOverride,
  theme,
  onError,
  adapterType = "native",
}: InterlaceEditorProps) {
  const strings = { ...DEFAULT_EDITOR_STRINGS, ...stringsOverride };
  const { state, addItem, removeItem, updateItem, loadDocument, serialize, setVideoMetadata } =
    useAuthoringStore(
      document?.video?.src ?? "",
      document?.video?.duration ?? 0,
    );

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [slotOpen, setSlotOpen] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [newItemType, setNewItemType] = useState<string>(() =>
    pickDefaultContentTypeId(contentTypeRegistry),
  );
  const [previewingContentId, setPreviewingContentId] = useState<string | null>(null);
  const nextIdRef = useRef(1);
  const registryRef = useRef(contentTypeRegistry);
  registryRef.current = contentTypeRegistry;
  const loadedInitialDocRef = useRef<SerializedInteractiveMediaDocument | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /**
   * Last reported duration for the *current* `videoSrc`. When the load
   * effect overwrites a freshly observed duration with the document's
   * stale value (cached video fires `loadedmetadata` before the load
   * commits), a follow-up effect re-pushes this value.
   */
  const lastDurationForSrcRef = useRef<{ src: string; duration: number } | null>(null);
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
      loadedInitialDocRef.current = null;
      return;
    }
    if (loadedInitialDocRef.current === document) return;
    loadedInitialDocRef.current = document;
    const { validationErrors, warnings } = loadDocument(
      document,
      registryRef.current,
    );
    if (validationErrors.length > 0) {
      onError?.(new Error(`${strings.loadErrorTitle}: ${validationErrors.join("; ")}`));
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

  const selectedItem = useMemo(
    () =>
      state.items.find((item) => item.content.getId() === selectedItemId) ??
      null,
    [state.items, selectedItemId],
  );
  const selectedContent = selectedItem?.content ?? null;

  const slotContentTypeId = selectedContent?.getContentTypeId() ?? null;

  const slotData = useMemo(
    () => (selectedContent ? selectedContent.getData() : null),
    [selectedContent],
  );

  const registeredTypeIds = useMemo(
    () => contentTypeRegistry.getAll().map((ct) => ct.getId()),
    [contentTypeRegistry],
  );

  const timelineEntries = useMemo(
    () =>
      state.items.map((item) => {
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
      }),
    [state.items],
  );

  const handleSelectEntry = useCallback(
    (id: string) => {
      setSelectedItemId(id);
      // Seek the shared authoring video to the hook's anchor time and
      // open the content editor slot. The slot is opened on every
      // selection — including a re-click after the user closed it —
      // so the editor surface always reflects the selected item.
      const item = state.items.find((it) => it.content.getId() === id);
      if (!item) return;
      const hook = item.content.getHook();
      const target =
        hook.type === "blocking" ? hook.timestamp : hook.start;
      if (!Number.isFinite(target)) {
        setSlotOpen(true);
        return;
      }
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
      setSlotOpen(true);
    },
    [state.items],
  );

  const handleAddEntry = useCallback(
    (hookType: "blocking" | "non-blocking") => {
      const contentType =
        contentTypeRegistry.get(newItemType) ??
        contentTypeRegistry.get(DEFAULT_CONTENT_TYPE_ID) ??
        contentTypeRegistry.getAll()[0];
      if (!contentType) return;
      const id = `new-${nextIdRef.current++}`;
      const hook = makeHook(hookType);
      const item = buildContentInstance(
        id,
        `New ${contentType.getId()}`,
        contentType,
        hook,
        makeDefaultData(contentType.getId()),
      );
      addItem({ content: item, hook });
      setSelectedItemId(id);
      // Align with `handleSelectEntry`: selecting an item opens the
      // content editor slot. The instructor typically adds a hook to
      // immediately fill in its content, so the slot opens here too.
      setSlotOpen(true);
    },
    [newItemType, contentTypeRegistry, addItem],
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      removeItem(id);
      setSelectedItemId((prev) => (prev === id ? null : prev));
      setSlotOpen(false);
    },
    [removeItem],
  );

  const handleUpdateEntry = useCallback(
    (id: string, updates: { title?: string; timestamp?: number; start?: number; end?: number }) => {
      const current = state.items.find((item) => item.content.getId() === id);
      if (!current) return;
      const contentType = contentTypeRegistry.get(current.content.getContentTypeId());
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
        }),
        hook,
      });
    },
    [state.items, contentTypeRegistry, updateItem],
  );

  const handlePlacementChange = useCallback(
    (nextPlacement: Placement) => {
      if (!selectedItemId) return;
      const current = state.items.find(
        (item) => item.content.getId() === selectedItemId,
      );
      if (!current) return;
      updateItem(selectedItemId, {
        content: current.content,
        hook: { ...current.hook, placement: nextPlacement },
      });
    },
    [selectedItemId, state.items, updateItem],
  );

  const handleSlotChange = useCallback(
    (newData: unknown) => {
      if (!selectedItemId) return;
      const current = state.items.find(
        (item) => item.content.getId() === selectedItemId,
      );
      if (!current) return;
      const contentType = contentTypeRegistry.get(current.content.getContentTypeId());
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
      setSlotOpen(false);
      // Close any open preview so the user lands on a clean authoring
      // surface after a replace.
      setPreviewingContentId(null);
    },
    [setVideoMetadata, state.videoSrc, state.videoDuration],
  );

  const handleReplaceVideo = useCallback(() => {
    setReplaceMode(true);
  }, []);

  const handleCancelReplace = useCallback(() => {
    setReplaceMode(false);
  }, []);

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

  const handlePreviewAnchorClick = useCallback((contentId: string) => {
    setPreviewingContentId(contentId);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewingContentId(null);
  }, []);

  const previewingContent = useMemo(() => {
    if (!previewingContentId) return null;
    const item = state.items.find(
      (it) => it.content.getId() === previewingContentId,
    );
    return item?.content ?? null;
  }, [previewingContentId, state.items]);

  const handleSave = useCallback(() => {
    onSave(serialize());
  }, [onSave, serialize]);

  // Styling derived from the optional theme prop.
  const rootStyle: React.CSSProperties = {
    backgroundColor: theme?.backgroundColor ?? "#fff",
    color: theme?.textColor ?? "#222",
    borderColor: theme?.borderColor ?? "#ddd",
  };
  const saveButtonStyle: React.CSSProperties = {
    backgroundColor: theme?.accentColor ?? "#0066cc",
    color: "#fff",
  };
  const surfaceStyle: React.CSSProperties = {
    backgroundColor: theme?.surfaceColor ?? "#fafafa",
    borderColor: theme?.borderColor ?? "#ddd",
  };

  if (showSourceStep) {
    return (
      <div
        className="interlace-editor"
        style={{ ...rootStyle, padding: 16, borderRadius: 8, border: "1px solid" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0 }}>{strings.videoSourceInputTitle}</h2>
          {replaceMode ? (
            <button
              type="button"
              onClick={handleCancelReplace}
              data-testid="interlace-editor-cancel-replace"
              style={{
                padding: "4px 12px",
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {strings.replaceCancelLabel}
            </button>
          ) : null}
        </div>
        <VideoSourceInput
          value={{ src: state.videoSrc || undefined, duration: state.videoDuration || undefined }}
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
      style={{ ...rootStyle, padding: 16, borderRadius: 8, border: "1px solid" }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>{strings.previewTitle}</h2>
        <button
          type="button"
          onClick={handleSave}
          data-testid="interlace-editor-save"
          style={{
            ...saveButtonStyle,
            padding: "8px 16px",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {strings.saveLabel}
        </button>
      </header>

      <EditorPreview
        videoRef={videoRef}
        videoSrc={state.videoSrc}
        videoDuration={state.videoDuration || undefined}
        items={state.items}
        onLoadedMetadata={handlePreviewLoadedMetadata}
        onReplaceVideo={handleReplaceVideo}
        strings={strings}
        onAnchorClick={handlePreviewAnchorClick}
        previewingContent={previewingContent}
        onClosePreview={handleClosePreview}
      />

      <section
        className="interlace-editor-placement"
        data-testid="interlace-editor-placement"
        style={{
          ...surfaceStyle,
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          border: "1px solid",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{strings.placementLabel}</h3>
        {selectedItem ? (
          <PlacementEditor
            placement={selectedItem.hook.placement}
            onPlacementChange={handlePlacementChange}
          />
        ) : (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: theme?.mutedTextColor ?? "#666",
              backgroundColor: theme?.surfaceColor ?? "#f0f0f0",
              borderRadius: 4,
            }}
          >
            {strings.noItemSelectedLabel}
          </div>
        )}
      </section>

      <section
        className="interlace-editor-add-content"
        style={{
          ...surfaceStyle,
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          border: "1px solid",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{strings.addContentHeading}</h3>
        <ContentTypePicker
          registeredTypes={registeredTypeIds}
          selectedType={newItemType}
          onSelect={setNewItemType}
        />
      </section>

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
        <h3 style={{ marginTop: 0 }}>{strings.timelineHeading}</h3>
        <Timeline
          entries={timelineEntries}
          selectedId={selectedItemId ?? undefined}
          onSelectEntry={handleSelectEntry}
          onUpdateEntry={handleUpdateEntry}
          onDeleteEntry={handleDeleteEntry}
          onAddEntry={handleAddEntry}
        />
      </section>

      <ContentTypeEditorSlot
        contentTypeId={slotContentTypeId}
        isOpen={slotOpen && selectedItem != null}
        onClose={() => setSlotOpen(false)}
        onSave={() => setSlotOpen(false)}
        registry={contentTypeRegistry}
        data={slotData}
        onChange={handleSlotChange}
      />
    </div>
  );
}
