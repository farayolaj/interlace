import {
  ContentInstance,
  ContentRecord,
  ContentState,
  ContentType,
  ContentTypeRegistry,
  DEFAULT_STRINGS,
  Hook,
  type InterlaceTheme,
  Placement,
  SerializedInteractiveMediaDocument,
  type Strings as CoreStrings,
  themeToCssVariables,
} from "@interlacejs/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "../tokens";
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
import { Button, IssueList, SectionHeading, useInterlaceStyles } from "./ui";
import { type MediaAttacher, useAttachMedia } from "./use-attach-media";

/**
 * Editor-local strings layered on top of the core `Strings`. Hosts pass
 * `strings?: Partial<EditorStrings>` and may override any subset of the
 * fields; the rest fall back to the defaults exported alongside.
 */
export interface EditorStrings extends CoreStrings {
  /** Heading for the video source step when no document is loaded. */
  videoSourceInputTitle: string;
  /**
   * Title for the preview surface.
   *
   * @deprecated Unused since the editor header shows the save status
   * instead of a heading. Retained for backward compatibility.
   */
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
  /** Prefix for the video duration under the video. */
  durationLabel: string;
  /** Header status while there are unsaved changes. */
  unsavedChangesLabel: string;
  /** Header status after a save with no further changes. */
  savedLabel: string;
  /** Header badge when hooks need attention; `{count}` is replaced. */
  hooksNeedAttentionLabel: string;
  /** Heading of the list shown when Save is blocked by problems. */
  saveBlockedTitle: string;
  /** Button next to each problem that selects the hook. */
  goToHookLabel: string;
  /** Problem: a hook has no title. */
  needsTitleIssue: string;
  /** Problem: a hook has no content type yet. */
  needsContentTypeIssue: string;
  /** Name shown for hooks without a title. */
  untitledHookLabel: string;
  /** Heading of the details column when no hook is selected. */
  noHookSelectedTitle: string;
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
  noItemSelectedLabel:
    "Select a hook on the timeline to edit it, or add one at the playhead.",
  placementLabel: "Placement",
  timelineHeading: "Hooks",
  addContentHeading: "Add content",
  hookHeading: "Hook",
  contentEditorHeading: "Content",
  editContentLabel: "Edit content",
  loadErrorTitle: "Could not load the document",
  durationUnknownLabel: "Duration unknown",
  durationLabel: "Duration",
  unsavedChangesLabel: "Unsaved changes",
  savedLabel: "All changes saved",
  hooksNeedAttentionLabel: "{count} need attention",
  saveBlockedTitle: "Fix these before saving",
  goToHookLabel: "Go to hook",
  needsTitleIssue: "Add a title",
  needsContentTypeIssue: "Choose a content type",
  untitledHookLabel: "Untitled hook",
  noHookSelectedTitle: "No hook selected",
};

/**
 * Optional theme overrides. Every field becomes a `--interlace-*` CSS
 * variable on the editor's root, so it reaches every surface inside it
 * (timeline, Hook details, content editors, preview). Hosts can set the
 * same variables from CSS instead; see `InterlaceTheme` in core.
 */
export type EditorTheme = InterlaceTheme;

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
  /**
   * Called when the editor gains or loses unsaved changes, relative to the
   * loaded `document` (or an empty document) and the last `onSave`. Covers
   * the video source, items, hooks, placements, content data, and an
   * unmaterialized pending hook. The video duration is excluded: the
   * editor corrects it from the video's metadata without user input.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Optional string overrides. */
  strings?: Partial<EditorStrings>;
  /** Optional theme overrides (see `EditorTheme`). */
  theme?: EditorTheme;
  /** Extra class name for the editor's root element. */
  className?: string;
  /** Optional error callback for upload, load, and runtime failures. */
  onError?: (error: Error) => void;
  /**
   * Host-level adapter type. Defaults to `"native"`. **Not** persisted
   * into the core serialized document; the host must re-supply this on
   * reload. The editor does not pass it to `serialize()`.
   */
  adapterType?: string;
  /**
   * URL to play in the authoring video and the preview instead of
   * `document.video.src` (e.g. an HLS stream of the stored MP4). Playback
   * only: it is never written into the document or the `onSave` output
   * and does not affect dirty tracking.
   */
  playbackSrc?: string;
  /**
   * Host-supplied media loader (e.g. hls.js). When provided, the editor
   * does not set the `<video>` elements' `src` attribute; it calls
   * `attachMedia(video, src)` with `src = playbackSrc ?? document src`
   * once each element mounts and whenever that source changes, and calls
   * the returned cleanup before re-attaching and on unmount (or when the
   * preview closes). Applies to both the authoring video and the preview.
   * The latest function is always used, but a new function identity
   * alone does not re-attach.
   */
  attachMedia?: MediaAttacher;
}

const DEFAULT_PLACEMENT: Placement = { x: 50, y: 50, width: 20, height: 20 };

/** Editor width (px) at which Hook details moves beside the video. */
const WIDE_LAYOUT_MIN_WIDTH = 900;

/** Formats seconds as m:ss (or h:mm:ss). */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

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
  hint,
}: {
  duration: number | undefined;
  strings: EditorStrings;
  onReplaceVideo: () => void;
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
        gap: SPACE[3],
        flexWrap: "wrap",
        padding: `${SPACE[2]}px 0 0`,
        fontSize: TYPE.sm,
        color: COLORS.textMuted,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE[3],
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <span data-testid="interlace-editor-video-duration">
          {duration === undefined || !Number.isFinite(duration)
            ? strings.durationUnknownLabel
            : `${strings.durationLabel} ${formatDuration(duration)}`}
        </span>
        {hint ? (
          <span data-testid="interlace-editor-selection-hint">{hint}</span>
        ) : null}
      </span>
      <Button
        variant="ghost"
        onClick={onReplaceVideo}
        data-testid="interlace-editor-replace-video"
      >
        {strings.replaceVideoLabel}
      </Button>
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
  onDirtyChange,
  strings: stringsOverride,
  theme,
  className,
  onError,
  playbackSrc,
  attachMedia,
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
  const [pendingHooks, setPendingHooks] = useState<PendingHook[]>([]);
  /** Updates one pending hook in place (no-op if it is gone). */
  const updatePendingHook = useCallback(
    (id: string, update: (prev: PendingHook) => PendingHook) => {
      setPendingHooks((prev) =>
        prev.map((pending) => (pending.id === id ? update(pending) : pending)),
      );
    },
    [],
  );
  /** Bumped on each document load; marks where the dirty baseline resets. */
  const [loadVersion, setLoadVersion] = useState(0);
  const [replaceMode, setReplaceMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  /** Authoring-video playhead position in seconds (drives the timeline). */
  const [currentTime, setCurrentTime] = useState(0);
  /** Whether the authoring video is currently playing (drives the timeline's play button). */
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
  /** What the authoring video plays; never serialized. */
  const srcToPlay = playbackSrc ?? state.videoSrc;
  useAttachMedia(videoRef, srcToPlay, attachMedia, onError);

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
        setPendingHooks([]);
      }
      return;
    }
    if (loadedInitialDocRef.current === document) return;
    loadedInitialDocRef.current = document;
    // Loading a different document starts a new authoring session; a
    // pending hooks from the old one are dropped.
    setPendingHooks([]);
    // Batched with loadDocument's setState, so the render that sees the
    // new version also sees the loaded items (the dirty baseline).
    setLoadVersion((v) => v + 1);
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
  const selectedPendingHook = selectedStoreItem
    ? null
    : (pendingHooks.find((pending) => pending.id === selectedItemId) ?? null);
  const isPendingSelected = selectedPendingHook !== null;
  /** The selected hook's time data — store item or pending, unified. */
  const selectedHook: Hook | null = isPendingSelected
    ? selectedPendingHook.hook
    : (selectedStoreItem?.hook ?? null);
  const selectedTitle: string | null = isPendingSelected
    ? selectedPendingHook.title
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
  const contentTypeOptions = useMemo(
    () =>
      contentTypeRegistry.getAll().map((ct) => ({
        id: ct.getId(),
        label: ct.getDisplayName?.() ?? ct.getId(),
        description: ct.getDescription?.(),
      })),
    [contentTypeRegistry],
  );

  /**
   * Problems that block saving, per hook id: a missing title, no content
   * type yet (pending), or messages from the content type's `validate`.
   */
  const { needsTitleIssue, needsContentTypeIssue } = strings;
  const hookIssues = useMemo(() => {
    const issues = new Map<string, string[]>();
    for (const pending of pendingHooks) {
      issues.set(pending.id, [
        ...(pending.title.trim() ? [] : [needsTitleIssue]),
        needsContentTypeIssue,
      ]);
    }
    for (const item of state.items) {
      const list: string[] = [];
      if (!item.content.getTitle().trim()) list.push(needsTitleIssue);
      const contentType = contentTypeRegistry.get(
        item.content.getContentTypeId(),
      );
      try {
        list.push(...(contentType?.validate?.(item.content.getData()) ?? []));
      } catch (err) {
        list.push(err instanceof Error ? err.message : String(err));
      }
      if (list.length > 0) issues.set(item.content.getId(), list);
    }
    return issues;
  }, [
    pendingHooks,
    state.items,
    contentTypeRegistry,
    needsTitleIssue,
    needsContentTypeIssue,
  ]);

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
    // Pending hooks (created at the playhead, content type not yet
    // chosen) are first-class timeline entries — they just are not part
    // of the store until they are materialized.
    const fromPending = pendingHooks.map((pending) => {
      const hook = pending.hook;
      return hook.type === "blocking"
        ? {
            id: pending.id,
            title: pending.title,
            hookType: "blocking" as const,
            timestamp: hook.timestamp,
          }
        : {
            id: pending.id,
            title: pending.title,
            hookType: "non-blocking" as const,
            start: hook.start,
            end: hook.end,
          };
    });
    return [...fromStore, ...fromPending].map((entry) => {
      const issues = hookIssues.get(entry.id) ?? [];
      return {
        ...entry,
        needsAttention: issues.length > 0,
        attentionLabel: issues.length > 0 ? issues.join(", ") : undefined,
      };
    });
  }, [state.items, pendingHooks, hookIssues]);

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

  /**
   * Dirty tracking. The snapshot covers everything the author controls
   * (duration excluded — it is corrected from video metadata). The
   * baseline resets after each document load and on save.
   */
  const authoredSnapshot = useMemo(
    () =>
      JSON.stringify({
        src: previewDocument.video.src,
        items: previewDocument.items,
      }),
    [previewDocument],
  );
  const baselineRef = useRef<{ version: number; snapshot: string } | null>(
    null,
  );
  if (baselineRef.current?.version !== loadVersion) {
    baselineRef.current = { version: loadVersion, snapshot: authoredSnapshot };
  }
  // A save only counts for the document it was made against; a later
  // load supersedes it.
  const [saved, setSaved] = useState<{
    version: number;
    snapshot: string;
  } | null>(null);
  const baselineSnapshot =
    saved?.version === loadVersion
      ? saved.snapshot
      : baselineRef.current.snapshot;
  const isDirty =
    authoredSnapshot !== baselineSnapshot || pendingHooks.length > 0;

  const lastReportedDirtyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastReportedDirtyRef.current === isDirty) return;
    lastReportedDirtyRef.current = isDirty;
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
        : (pendingHooks.find((pending) => pending.id === id)?.hook ?? null);
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
    [state.items, pendingHooks, setCurrentTime],
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
      // Untitled until the author names it (the title is shown to students).
      setPendingHooks((prev) => [...prev, { id, title: "", hook }]);
      setSelectedItemId(id);
    },
    [currentTime, state.videoDuration],
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      if (pendingHooks.some((pending) => pending.id === id)) {
        setPendingHooks((prev) => prev.filter((pending) => pending.id !== id));
        setSelectedItemId((prev) => (prev === id ? null : prev));
        return;
      }
      removeItem(id);
      setSelectedItemId((prev) => (prev === id ? null : prev));
    },
    [pendingHooks, removeItem],
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
      if (pendingHooks.some((pending) => pending.id === id)) {
        // Pending hook: times and title live in editor-local state.
        updatePendingHook(id, (prev) => {
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
    [
      pendingHooks,
      updatePendingHook,
      state.items,
      contentTypeRegistry,
      updateItem,
    ],
  );

  const handlePlacementChange = useCallback(
    (nextPlacement: Placement) => {
      if (!selectedItemId) return;
      if (pendingHooks.some((pending) => pending.id === selectedItemId)) {
        updatePendingHook(selectedItemId, (prev) => ({
          ...prev,
          hook: { ...prev.hook, placement: nextPlacement },
        }));
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
    [
      selectedItemId,
      pendingHooks,
      updatePendingHook,
      state.items,
      contentTypeRegistry,
      updateItem,
    ],
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
      const pending = pendingHooks.find((p) => p.id === selectedItemId);
      if (pending) {
        const id = `hook-${nextIdRef.current++}`;
        const item = buildContentInstance(
          id,
          pending.title,
          contentType,
          pending.hook,
          makeDefaultData(contentType.getId()),
        );
        addItem({ content: item, hook: pending.hook });
        setPendingHooks((prev) => prev.filter((p) => p.id !== pending.id));
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
      pendingHooks,
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
      const pending = pendingHooks.find((p) => p.id === selectedItemId);
      const hook = pending
        ? pending.hook
        : state.items.find((it) => it.content.getId() === selectedItemId)?.hook;
      if (!hook) return;
      const clamped = clampTimeUpdates(hook, updates, state.videoDuration);
      if (pending) {
        updatePendingHook(selectedItemId, (prev) => ({
          ...prev,
          hook: { ...prev.hook, ...clamped } as Hook,
        }));
        return;
      }
      handleUpdateEntry(selectedItemId, clamped);
    },
    [
      selectedItemId,
      pendingHooks,
      updatePendingHook,
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
      setPendingHooks([]);
      setPreviewOpen(false);
    },
    [setVideoMetadata, state.videoSrc, state.videoDuration],
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

  // Save is blocked while any hook has problems; the list stays visible
  // (and shrinks as problems are fixed) once a save has been attempted.
  const [saveAttempted, setSaveAttempted] = useState(false);
  const handleSave = useCallback(() => {
    if (hookIssues.size > 0) {
      setSaveAttempted(true);
      return;
    }
    setSaveAttempted(false);
    onSave(serialize());
    setSaved({ version: loadVersion, snapshot: authoredSnapshot });
  }, [hookIssues, onSave, serialize, authoredSnapshot, loadVersion]);

  /** Switches the selected hook between blocking and non-blocking. */
  const handleHookTypeChange = useCallback(
    (hookType: "blocking" | "non-blocking") => {
      if (!selectedItemId || !selectedHook) return;
      if (selectedHook.type === hookType) return;
      const anchor =
        selectedHook.type === "blocking"
          ? selectedHook.timestamp
          : selectedHook.start;
      const nextHook: Hook = {
        ...makeHook(hookType, anchor, state.videoDuration),
        placement: selectedHook.placement,
      };
      if (pendingHooks.some((pending) => pending.id === selectedItemId)) {
        updatePendingHook(selectedItemId, (prev) => ({
          ...prev,
          hook: nextHook,
        }));
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
      updateItem(selectedItemId, {
        content: rebuildContentInstance(current.content, contentType, {
          hook: nextHook,
        }),
        hook: nextHook,
      });
    },
    [
      selectedItemId,
      selectedHook,
      state.videoDuration,
      state.items,
      pendingHooks,
      updatePendingHook,
      contentTypeRegistry,
      updateItem,
    ],
  );

  // Two columns (video + timeline | Hook details) when the editor is wide.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setIsWide(entry.contentRect.width >= WIDE_LAYOUT_MIN_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showSourceStep]);

  useInterlaceStyles();

  const rootClassName = ["interlace-editor", className]
    .filter(Boolean)
    .join(" ");
  const rootStyle: React.CSSProperties = {
    ...themeToCssVariables(theme),
    boxSizing: "border-box",
    padding: SPACE[4],
    borderRadius: RADIUS.lg,
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TYPE.base - 1,
  };
  const panelStyle: React.CSSProperties = {
    boxSizing: "border-box",
    padding: SPACE[4],
    borderRadius: RADIUS.md,
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.surfaceRaised,
    minWidth: 0,
  };

  if (showSourceStep) {
    return (
      <div ref={rootRef} className={rootClassName} style={rootStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: SPACE[3],
            marginBottom: SPACE[4],
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
            <Button
              variant="secondary"
              onClick={handleCancelReplace}
              data-testid="interlace-editor-cancel-replace"
            >
              {strings.replaceCancelLabel}
            </Button>
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

  const issueCount = hookIssues.size;
  const hookLabel = (id: string) => {
    const entry = timelineEntries.find((e) => e.id === id);
    if (!entry) return strings.untitledHookLabel;
    const time = entry.hookType === "blocking" ? entry.timestamp : entry.start;
    const name = entry.title.trim() || strings.untitledHookLabel;
    return `${name} (${formatDuration(time ?? 0)})`;
  };
  const statusText = isDirty
    ? strings.unsavedChangesLabel
    : saved?.version === loadVersion
      ? strings.savedLabel
      : null;

  const videoSection = (
    <section className="interlace-editor-video" style={{ minWidth: 0 }}>
      {/*
        The positioning context for the placement overlay must wrap
        exactly the video: an in-flow toolbar inside this wrapper would
        offset every rectangle by the toolbar's height (Gate 3
        Material #2). The toolbar therefore sits below the frame.
      */}
      <div
        data-testid="interlace-editor-video"
        style={{
          position: "relative",
          borderRadius: RADIUS.md,
          overflow: "hidden",
          backgroundColor: COLORS.black,
        }}
      >
        {/*
          Keyed on the document src only: a playback-src change re-attaches
          on the same element (no remount, so a host's player instance is
          only torn down through its cleanup).
        */}
        <video
          ref={videoRef}
          key={state.videoSrc}
          src={attachMedia ? undefined : srcToPlay}
          controls
          preload="metadata"
          onLoadedMetadata={(e) =>
            handlePreviewLoadedMetadata(e.currentTarget.duration)
          }
          onTimeUpdate={handleTimeUpdate}
          data-testid="interlace-editor-preview-video"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            backgroundColor: COLORS.black,
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
        // In the wide layout the empty Hook details column says this.
        hint={selectedHook || isWide ? undefined : strings.noItemSelectedLabel}
      />
    </section>
  );

  const timelineSection = (
    <section className="interlace-editor-timeline" style={{ minWidth: 0 }}>
      <SectionHeading style={{ marginBottom: SPACE[2] }}>
        {strings.timelineHeading}
      </SectionHeading>
      <KeyframeTimeline
        entries={timelineEntries}
        selectedId={selectedItemId ?? undefined}
        videoDuration={state.videoDuration || 0}
        currentTime={currentTime}
        onSeek={handleTimelineSeek}
        onSelectEntry={handleSelectEntry}
        onUpdateEntry={handleUpdateEntry}
        onDeleteEntry={handleDeleteEntry}
        onAddEntry={handleAddEntry}
        onDeselect={handleDeselect}
      />
    </section>
  );

  const hookSection =
    selectedItemId && selectedHook ? (
      <section
        className="interlace-editor-hook"
        data-testid="interlace-editor-hook"
        aria-label={strings.hookHeading}
        style={panelStyle}
      >
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
            contentTypeOptions,
            issues: hookIssues.get(selectedItemId),
          }}
          onTitleChange={(title) =>
            handleUpdateEntry(selectedItemId, { title })
          }
          onTimeChange={handleTimeChange}
          onHookTypeChange={handleHookTypeChange}
          onContentTypeSelect={handleContentTypeSelect}
          placement={selectedHook.placement}
          onPlacementChange={handlePlacementChange}
          onDelete={() => handleDeleteEntry(selectedItemId)}
        />
        {/* Content editor: shown once the hook has a content type. A
            newly created hook (pending) hides it until the type is
            chosen in Hook details. */}
        {selectedContentTypeId ? (
          <div
            style={{
              marginTop: SPACE[4],
              paddingTop: SPACE[4],
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            <SectionHeading style={{ marginBottom: SPACE[3] }}>
              {strings.contentEditorHeading}
            </SectionHeading>
            <ContentTypeEditor
              contentTypeId={selectedContentTypeId}
              registry={contentTypeRegistry}
              data={selectedData}
              onChange={handleContentChange}
            />
          </div>
        ) : null}
      </section>
    ) : isWide ? (
      <section
        className="interlace-editor-hook"
        data-testid="interlace-editor-no-hook"
        style={{
          ...panelStyle,
          display: "flex",
          flexDirection: "column",
          gap: SPACE[2],
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          minHeight: 200,
          borderStyle: "dashed",
        }}
      >
        <SectionHeading>{strings.noHookSelectedTitle}</SectionHeading>
        <p className="interlace-hint" style={{ maxWidth: 280 }}>
          {strings.noItemSelectedLabel}
        </p>
      </section>
    ) : null;

  return (
    <div ref={rootRef} className={rootClassName} style={rootStyle}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: SPACE[3],
          flexWrap: "wrap",
          marginBottom: SPACE[4],
        }}
      >
        <div
          role="status"
          aria-live="polite"
          data-testid="interlace-editor-status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE[2],
            flexWrap: "wrap",
            color: COLORS.textMuted,
            fontSize: TYPE.sm,
          }}
        >
          {statusText ? <span>{statusText}</span> : null}
          {issueCount > 0 ? (
            <span className="interlace-badge interlace-badge--warning">
              {strings.hooksNeedAttentionLabel.replace(
                "{count}",
                String(issueCount),
              )}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: SPACE[2] }}>
          <Button
            variant="secondary"
            onClick={handleOpenPreview}
            data-testid="interlace-editor-open-preview"
          >
            {strings.previewLabel}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            data-testid="interlace-editor-save"
          >
            {strings.saveLabel}
          </Button>
        </div>
      </header>

      {saveAttempted && issueCount > 0 ? (
        <div
          style={{ marginBottom: SPACE[4] }}
          data-testid="interlace-editor-save-issues"
        >
          <IssueList
            title={strings.saveBlockedTitle}
            issues={[...hookIssues.entries()].map(([id, issues]) => (
              <span
                key={id}
                style={{
                  display: "inline-flex",
                  gap: SPACE[2],
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  <strong>{hookLabel(id)}</strong>: {issues.join(", ")}
                </span>
                <button
                  type="button"
                  className="interlace-focusable"
                  onClick={() => handleSelectEntry(id)}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    color: "inherit",
                    textDecoration: "underline",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  {strings.goToHookLabel}
                </button>
              </span>
            ))}
          />
        </div>
      ) : null}

      <PreviewModal
        isOpen={previewOpen}
        videoSrc={state.videoSrc}
        playbackSrc={playbackSrc}
        attachMedia={attachMedia}
        document={previewDocument}
        contentTypeRegistry={contentTypeRegistry}
        onClose={handleClosePreview}
        onError={onError}
        strings={strings.previewModal}
      />

      {isWide ? (
        <div
          data-testid="interlace-editor-layout-wide"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 3fr) minmax(320px, 2fr)",
            gap: SPACE[4],
            alignItems: "start",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: SPACE[4],
              position: "sticky",
              top: SPACE[4],
              minWidth: 0,
            }}
          >
            {videoSection}
            {timelineSection}
          </div>
          {hookSection}
        </div>
      ) : (
        <div style={{ display: "grid", gap: SPACE[4] }}>
          <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
            {videoSection}
          </div>
          {timelineSection}
          {hookSection}
        </div>
      )}
    </div>
  );
}
