import {
  DEFAULT_STRINGS,
  ensureInterlaceStyles,
  type Strings,
} from "@interlacejs/core";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { COLORS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";

/**
 * Localized strings consumed by `KeyframeTimeline`. Extends the core
 * `Strings` so a host passing a single translation table covers every
 * editor surface.
 */
export interface KeyframeTimelineStrings extends Strings {
  /** Label for the "add blocking hook at playhead" button. */
  addBlockingLabel: string;
  /** Label for the "add non-blocking hook at playhead" button. */
  addNonBlockingLabel: string;
  /** Label for the zoom-in button. */
  zoomInLabel: string;
  /** Label for the zoom-out button. */
  zoomOutLabel: string;
  /** Visible caption next to the zoom buttons. */
  zoomCaption?: string;
  /**
   * Shown next to the add buttons: where a new hook goes. `{time}` is
   * replaced with the playhead position.
   */
  addAtPlayheadLabel?: string;
  /** Label for the play button. */
  playLabel: string;
  /** Label for the pause button. */
  pauseLabel: string;
  /** Accessible label for the playhead slider. */
  playheadLabel: string;
  /** Shown in the track when there are no hooks. */
  emptyLabel: string;
  /** Accessible label for the ruler strip. */
  rulerLabel: string;
  /** Accessible label for the keyframe track. */
  trackLabel: string;
  /** Accessible label prefix for a blocking keyframe (composed with the title + time). */
  blockingKeyframeLabel: string;
  /** Accessible label prefix for a non-blocking range bar. */
  nonBlockingRangeLabel: string;
  /** Tooltip for the "add blocking hook" button (where/how it is added). */
  addBlockingHint?: string;
  /** Tooltip for the "add non-blocking hook" button (where/how it is added). */
  addNonBlockingHint?: string;
  /** Shown (and announced) in place of an empty hook title. */
  untitledLabel?: string;
  /** Appended to a hook's accessible label when it needs attention. */
  needsAttentionLabel?: string;
}

export const DEFAULT_KEYFRAME_TIMELINE_STRINGS: KeyframeTimelineStrings = {
  ...DEFAULT_STRINGS,
  addBlockingLabel: "Blocking hook",
  addNonBlockingLabel: "Non-blocking hook",
  addBlockingHint: "Add a hook that pauses the video at the playhead",
  addNonBlockingHint: "Add a hook that floats over the video from the playhead",
  zoomInLabel: "Zoom timeline in",
  zoomOutLabel: "Zoom timeline out",
  zoomCaption: "Zoom",
  addAtPlayheadLabel: "Adds at the playhead ({time})",
  playLabel: "Play",
  pauseLabel: "Pause",
  playheadLabel: "Playhead",
  emptyLabel:
    "No hooks yet. Move the playhead to where a hook should appear, then choose Blocking hook or Non-blocking hook.",
  rulerLabel: "Timeline ruler",
  trackLabel: "Hook track",
  blockingKeyframeLabel: "blocking at",
  nonBlockingRangeLabel: "non-blocking from",
  untitledLabel: "Untitled hook",
  needsAttentionLabel: "needs attention",
};

export interface KeyframeTimelineEntry {
  id: string;
  title: string;
  hookType: "blocking" | "non-blocking";
  timestamp?: number;
  start?: number;
  end?: number;
  /** Marks the hook with a warning indicator (e.g. missing or invalid content). */
  needsAttention?: boolean;
  /** Announced with the hook when `needsAttention` is set; defaults to `strings.needsAttentionLabel`. */
  attentionLabel?: string;
}

export interface KeyframeTimelineProps {
  entries: KeyframeTimelineEntry[];
  selectedId?: string;
  /** Total video duration in seconds; the strip's time axis. */
  videoDuration: number;
  /** Current playhead position in seconds. */
  currentTime: number;
  /** Whether the authoring video is currently playing (drives the play/pause button). */
  isPlaying?: boolean;
  onSeek: (time: number) => void;
  /**
   * Toggles playback. Omit when the host video already has its own
   * controls; the timeline then renders no play button.
   */
  onTogglePlay?: () => void;
  onSelectEntry: (id: string) => void;
  onUpdateEntry: (
    id: string,
    updates: { timestamp?: number; start?: number; end?: number },
  ) => void;
  onDeleteEntry: (id: string) => void;
  onAddEntry: (hookType: "blocking" | "non-blocking") => void;
  /** Called when the user clicks the track background (not a keyframe, range, or the ruler). */
  onDeselect?: () => void;
  strings?: Partial<KeyframeTimelineStrings>;
}

const MIN_ZOOM = 2; // px per second
const MAX_ZOOM = 100;
const DEFAULT_ZOOM = 8;
const MIN_RANGE = 1; // seconds

const LANE_HEIGHT = 32; // px per lane row (marker hit area + label)
const TRACK_PADDING = 6; // 3px top + 3px bottom padding around the lanes
const MAX_VISIBLE_LANES = 4; // beyond this the track scrolls vertically
const MAX_TRACK_HEIGHT = MAX_VISIBLE_LANES * LANE_HEIGHT + TRACK_PADDING;
const RULER_HEIGHT = 24;
/** Width a tick label needs to the right of its line (px). */
const TICK_LABEL_ROOM = 40; // px height of the ruler strip
const KEYFRAME_SIZE_PX = 14; // visual diamond size
const KEYFRAME_HIT_PX = 32; // interactive hit area around the diamond
const LABEL_MAX_WIDTH_PX = 140; // keyframe labels truncate past this
const LABEL_CHAR_PX = 7; // estimated average glyph width at 12px
const LABEL_GAP_PX = 8; // clearance after a label before the next hook
const RANGE_EDGE_PX = 12; // resize grab area on each end of a range
const RANGE_MIN_WIDTH_PX = RANGE_EDGE_PX * 2; // rendered minimum range width

interface DragState {
  cleanup: () => void;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** Snap to integer seconds unless the user holds Shift (bypass). */
function snapTime(time: number, bypass: boolean): number {
  return bypass ? time : Math.round(time);
}

/** Smallest ruler tick interval (seconds) whose pixel width is readable. */
function tickInterval(zoom: number): number {
  for (const candidate of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) {
    if (candidate * zoom >= 56) return candidate;
  }
  return 600;
}

function formatTick(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** Rendered label width estimate (px), capped at the truncation width. */
function estimateLabelWidth(label: string): number {
  return Math.min(LABEL_MAX_WIDTH_PX, Math.ceil(label.length * LABEL_CHAR_PX));
}

/**
 * The time interval `[start, end]` an entry occupies on the strip:
 * ranges span their start→end (at least their rendered minimum width);
 * blocking keyframes occupy their hit area plus the label to its right
 * (expressed in seconds at the current zoom), so two hooks stack exactly
 * when their rendered marker or label would overlap.
 */
function extentOf(
  entry: KeyframeTimelineEntry,
  zoom: number,
  label: string,
): [number, number] {
  if (entry.hookType === "blocking") {
    const t = entry.timestamp ?? 0;
    const half = KEYFRAME_HIT_PX / 2;
    return [
      t - half / zoom,
      t + (half + estimateLabelWidth(label) + LABEL_GAP_PX) / zoom,
    ];
  }
  const start = entry.start ?? 0;
  const span = (entry.end ?? 0) - start;
  return [start, start + Math.max(RANGE_MIN_WIDTH_PX / zoom, span)];
}

/** Small "!" badge marking a hook that needs attention. */
function AttentionDot({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      data-testid="timeline-attention"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        width: 14,
        height: 14,
        flexShrink: 0,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.warningBg,
        border: `1px solid ${COLORS.warningBorder}`,
        color: COLORS.warningText,
        fontSize: TYPE.xs,
        fontWeight: 700,
        lineHeight: 1,
        pointerEvents: "none",
        ...style,
      }}
    >
      !
    </span>
  );
}

/**
 * KeyframeTimeline - a horizontal, zoomable video-editor timeline.
 *
 * Visual grammar:
 * - Blocking hooks render as point keyframes (diamonds) at their timestamp.
 * - Non-blocking hooks render as range bars spanning start → end; the body
 *   drags to move (duration preserved), the edges drag to resize one side.
 * - A playhead line tracks `currentTime`; dragging it (or clicking the
 *   ruler) seeks via `onSeek`.
 *
 * Interaction:
 * - Drag survives the pointer leaving the strip (pointer capture +
 *   window-level fallbacks — the PlacementEditor pattern).
 * - Drag snapping is to integer seconds; hold Shift to bypass.
 * - Zoom via the +/- buttons or the vertical mouse wheel (anchored at the
 *   pointer); horizontal wheel / Shift+wheel pans. Native non-passive
 *   listener, since React's synthetic onWheel cannot preventDefault.
 * - Keyboard: the playhead is a slider (arrow keys ±1s, ±5s with Shift);
 *   a selected keyframe nudges with the same keys through `onUpdateEntry`.
 *
 * Adding a hook happens at the current playhead (`onAddEntry`), which is
 * the keyframe metaphor: the playhead is the insertion point.
 */
export const KeyframeTimeline: React.FC<KeyframeTimelineProps> = ({
  entries,
  selectedId,
  videoDuration,
  currentTime,
  isPlaying,
  onSeek,
  onTogglePlay,
  onSelectEntry,
  onUpdateEntry,
  onAddEntry,
  onDeselect,
  strings: stringsOverride,
}) => {
  const strings = { ...DEFAULT_KEYFRAME_TIMELINE_STRINGS, ...stringsOverride };
  const untitledLabel =
    strings.untitledLabel ?? DEFAULT_KEYFRAME_TIMELINE_STRINGS.untitledLabel!;
  const titleOf = useCallback(
    (entry: KeyframeTimelineEntry) => entry.title.trim() || untitledLabel,
    [untitledLabel],
  );
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    ensureInterlaceStyles();
  }, []);
  const dragRef = useRef<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  // Once the user manually zooms (slider or wheel), the full-duration
  // auto-fit stops re-asserting itself (even across video reloads).
  const userZoomedRef = useRef(false);
  // Latest props for the native drag listeners.
  const propsRef = useRef({ zoom, videoDuration, currentTime });
  propsRef.current = { zoom, videoDuration, currentTime };

  // Default zoom = the full video duration: on mount and whenever the video
  // duration changes (video reload), compute the zoom that fits the entire
  // duration into the visible strip width. A ResizeObserver keeps the fit
  // honest when the host resizes, but a manual zoom wins from then on.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measureAndFit = () => {
      const width = el.clientWidth;
      if (width <= 0 || videoDuration <= 0) return;
      if (!userZoomedRef.current) {
        setZoom(clampValue(width / videoDuration, MIN_ZOOM, MAX_ZOOM));
      }
    };
    measureAndFit();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => measureAndFit());
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, [videoDuration]);

  const stripWidth = Math.max(videoDuration * zoom, 320);
  const pxToTime = useCallback(
    (clientX: number, stripRect: { left: number }) =>
      (clientX - stripRect.left) / propsRef.current.zoom,
    [],
  );

  const beginDrag = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      onMoveDrag: (ev: PointerEvent, stripRect: DOMRect) => void,
    ) => {
      if (typeof e.button === "number" && e.button !== 0) return;
      if (dragRef.current) return; // one drag at a time
      const strip = stripRef.current;
      const target = e.currentTarget;
      if (!strip) return;
      const stripRect = strip.getBoundingClientRect();
      if (stripRect.width <= 0) return;

      e.preventDefault();
      e.stopPropagation();

      const onMove = (ev: PointerEvent) => onMoveDrag(ev, stripRect);
      const cleanup = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("pointercancel", onUp);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        try {
          target.releasePointerCapture?.(e.pointerId);
        } catch {
          // Capture may already be released; the drag is over anyway.
        }
        dragRef.current = null;
      };
      const onUp = () => {
        cleanup();
      };

      try {
        target.setPointerCapture?.(e.pointerId);
      } catch {
        // Engines without capture still work via the window fallbacks.
      }
      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("pointercancel", onUp);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      dragRef.current = { cleanup };
    },
    [],
  );

  // Tear down an in-flight drag on unmount.
  useEffect(() => {
    return () => {
      dragRef.current?.cleanup();
    };
  }, []);

  const beginPlayheadDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      beginDrag(e, (ev, stripRect) => {
        const t = pxToTime(ev.clientX, stripRect);
        onSeek(
          snapTime(
            clampValue(t, 0, propsRef.current.videoDuration),
            ev.shiftKey,
          ),
        );
      });
    },
    [beginDrag, onSeek, pxToTime],
  );

  const beginKeyframeDrag = useCallback(
    (id: string, startTime: number) => (e: React.PointerEvent<HTMLElement>) => {
      const startX = e.clientX;
      beginDrag(e, (ev) => {
        const dt = (ev.clientX - startX) / propsRef.current.zoom;
        const t = snapTime(
          clampValue(startTime + dt, 0, propsRef.current.videoDuration),
          ev.shiftKey,
        );
        onUpdateEntry(id, { timestamp: t });
      });
    },
    [beginDrag, onUpdateEntry],
  );

  const beginRangeDrag = useCallback(
    (
      id: string,
      edge: "body" | "start" | "end",
      startStart: number,
      startEnd: number,
    ) =>
      (e: React.PointerEvent<HTMLElement>) => {
        const startX = e.clientX;
        const duration = startEnd - startStart;
        beginDrag(e, (ev) => {
          const dt = (ev.clientX - startX) / propsRef.current.zoom;
          if (edge === "body") {
            const nextStart = snapTime(
              clampValue(
                startStart + dt,
                0,
                propsRef.current.videoDuration - duration,
              ),
              ev.shiftKey,
            );
            onUpdateEntry(id, {
              start: nextStart,
              end: nextStart + duration,
            });
          } else if (edge === "start") {
            const nextStart = snapTime(
              clampValue(startStart + dt, 0, startEnd - MIN_RANGE),
              ev.shiftKey,
            );
            onUpdateEntry(id, { start: nextStart });
          } else {
            const nextEnd = snapTime(
              clampValue(
                startEnd + dt,
                startStart + MIN_RANGE,
                propsRef.current.videoDuration,
              ),
              ev.shiftKey,
            );
            onUpdateEntry(id, { end: nextEnd });
          }
        });
      },
    [beginDrag, onUpdateEntry],
  );

  // Wheel on the timeline body:
  // - vertical wheel zooms around the pointer (wheel up = in). A mouse
  //   notch (deltaY 100) is one 1.2x step; trackpads' small deltas zoom
  //   proportionally, so the gesture stays smooth;
  // - horizontal wheel (trackpad swipe, or Shift+wheel on a mouse) pans.
  // React's synthetic onWheel is passive at the root since React 17, so
  // preventDefault (which also stops the page scrolling and the browser's
  // back/forward swipe) needs a native non-passive listener.
  // The time under the pointer when a wheel zoom happened; restored once the
  // new zoom has rendered so that point stays under the pointer.
  const zoomAnchorRef = useRef<{ time: number; clientX: number } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const toPixels = (delta: number, mode: number) =>
      mode === 1 ? delta * 16 : mode === 2 ? delta * el.clientWidth : delta;
    const onWheel = (e: WheelEvent) => {
      const dx = toPixels(e.deltaX, e.deltaMode);
      const dy = toPixels(e.deltaY, e.deltaMode);
      const horizontal = e.shiftKey || Math.abs(dx) > Math.abs(dy);
      if (horizontal) {
        const pan = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        if (pan === 0) return;
        e.preventDefault();
        el.scrollLeft += pan;
        return;
      }
      if (dy === 0) return;
      e.preventDefault();
      userZoomedRef.current = true;
      const strip = stripRef.current;
      const { zoom: currentZoom } = propsRef.current;
      if (strip && currentZoom > 0) {
        const left = strip.getBoundingClientRect().left;
        zoomAnchorRef.current = {
          time: (e.clientX - left) / currentZoom,
          clientX: e.clientX,
        };
      }
      const steps = clampValue(-dy / 100, -3, 3);
      setZoom((z) => clampValue(z * Math.pow(1.2, steps), MIN_ZOOM, MAX_ZOOM));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const el = scrollRef.current;
    const strip = stripRef.current;
    zoomAnchorRef.current = null;
    if (!anchor || !el || !strip) return;
    const left = strip.getBoundingClientRect().left;
    el.scrollLeft += left + anchor.time * zoom - anchor.clientX;
  }, [zoom]);

  const handleZoom = useCallback((direction: 1 | -1) => {
    userZoomedRef.current = true;
    setZoom((z) =>
      clampValue(direction > 0 ? z * 1.5 : z / 1.5, MIN_ZOOM, MAX_ZOOM),
    );
  }, []);

  const handleKeyframeKeyDown = useCallback(
    (entry: KeyframeTimelineEntry) => (e: React.KeyboardEvent<HTMLElement>) => {
      const step = e.shiftKey ? 5 : 1;
      let updates: { timestamp?: number; start?: number; end?: number } | null =
        null;
      // Round the nudge base so keyboard nudges re-align to the
      // seconds grid even after a Shift-bypass drag left a float.
      if (entry.hookType === "blocking") {
        const base = Math.round(entry.timestamp ?? 0);
        if (e.key === "ArrowLeft")
          updates = {
            timestamp: clampValue(
              base - step,
              0,
              propsRef.current.videoDuration,
            ),
          };
        if (e.key === "ArrowRight")
          updates = {
            timestamp: clampValue(
              base + step,
              0,
              propsRef.current.videoDuration,
            ),
          };
      } else {
        const s = Math.round(entry.start ?? 0);
        const en = Math.round(entry.end ?? 0);
        const dur = en - s;
        if (e.key === "ArrowLeft") {
          const next = clampValue(
            s - step,
            0,
            propsRef.current.videoDuration - dur,
          );
          updates = { start: next, end: next + dur };
        }
        if (e.key === "ArrowRight") {
          const next = clampValue(
            s + step,
            0,
            propsRef.current.videoDuration - dur,
          );
          updates = { start: next, end: next + dur };
        }
      }
      if (!updates) return;
      e.preventDefault();
      e.stopPropagation();
      onUpdateEntry(entry.id, updates);
    },
    [onUpdateEntry],
  );

  const handlePlayheadKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const step = e.shiftKey ? 5 : 1;
      let t: number | null = null;
      if (e.key === "ArrowLeft")
        t = clampValue(
          propsRef.current.currentTime - step,
          0,
          propsRef.current.videoDuration,
        );
      if (e.key === "ArrowRight")
        t = clampValue(
          propsRef.current.currentTime + step,
          0,
          propsRef.current.videoDuration,
        );
      if (t == null) return;
      e.preventDefault();
      e.stopPropagation();
      onSeek(t);
    },
    [onSeek],
  );

  const handleRulerSeek = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (typeof e.button === "number" && e.button !== 0) return;
      const strip = stripRef.current;
      if (!strip) return;
      const stripRect = strip.getBoundingClientRect();
      if (stripRect.width <= 0) return;
      const t = (e.clientX - stripRect.left) / propsRef.current.zoom;
      onSeek(
        snapTime(clampValue(t, 0, propsRef.current.videoDuration), e.shiftKey),
      );
    },
    [onSeek],
  );

  /**
   * Greedy interval packing: entries sorted by the start of their
   * rendered extent (marker + label), each placed in the first lane
   * whose last occupant ends at or before its start. Overlapping
   * entries stack into successive lanes; the track height grows to fit
   * them (scrolling past MAX_VISIBLE_LANES). The playhead still spans
   * the full track.
   */
  const layout = useMemo(() => {
    const extents = entries.map(
      (entry) => [entry, extentOf(entry, zoom, titleOf(entry))] as const,
    );
    extents.sort((a, b) => a[1][0] - b[1][0]);
    const laneEnds: number[] = [];
    const lanes = new Map<string, number>();
    for (const [entry, [start, end]] of extents) {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      lanes.set(entry.id, lane);
    }
    return { lanes, laneCount: Math.max(laneEnds.length, 1) };
  }, [entries, zoom, titleOf]);

  const interval = tickInterval(zoom);
  const ticks: number[] = [];
  for (let t = 0; t <= videoDuration; t += interval) {
    ticks.push(Math.round(t * 100) / 100);
  }
  const playheadPx = currentTime * zoom;

  // Lanes keep a fixed, unclipped height; the track grows with the lane
  // count and the strip scrolls vertically past MAX_VISIBLE_LANES.
  const trackHeight = Math.max(
    48,
    layout.laneCount * LANE_HEIGHT + TRACK_PADDING,
  );
  const ariaLabelOf = (entry: KeyframeTimelineEntry, base: string) =>
    entry.needsAttention
      ? `${base}, ${entry.attentionLabel ?? strings.needsAttentionLabel ?? DEFAULT_KEYFRAME_TIMELINE_STRINGS.needsAttentionLabel}`
      : base;

  return (
    <div
      className="keyframe-timeline"
      data-testid="keyframe-timeline"
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.surfaceRaised,
        padding: SPACE[2],
        display: "flex",
        flexDirection: "column",
        gap: SPACE[2],
      }}
    >
      {/* Controls row */}
      <div
        data-testid="keyframe-timeline-controls"
        style={{
          display: "flex",
          gap: SPACE[2],
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {onTogglePlay && (
          <button
            type="button"
            className="interlace-btn interlace-btn--ghost interlace-btn--icon"
            onClick={onTogglePlay}
            data-testid="keyframe-timeline-play"
            aria-label={isPlaying ? strings.pauseLabel : strings.playLabel}
            title={isPlaying ? strings.pauseLabel : strings.playLabel}
          >
            <span aria-hidden="true">{isPlaying ? "❚❚" : "▶"}</span>
          </button>
        )}
        <button
          type="button"
          className="interlace-btn interlace-btn--secondary"
          onClick={() => onAddEntry("blocking")}
          data-testid="keyframe-timeline-add-blocking"
          title={strings.addBlockingHint}
        >
          <span aria-hidden="true">+</span>
          {strings.addBlockingLabel}
        </button>
        <button
          type="button"
          className="interlace-btn interlace-btn--secondary"
          onClick={() => onAddEntry("non-blocking")}
          data-testid="keyframe-timeline-add-non-blocking"
          title={strings.addNonBlockingHint}
        >
          <span aria-hidden="true">+</span>
          {strings.addNonBlockingLabel}
        </button>
        {strings.addAtPlayheadLabel ? (
          <span
            className="interlace-hint"
            data-testid="keyframe-timeline-add-at"
          >
            {strings.addAtPlayheadLabel.replace(
              "{time}",
              formatTick(Math.round(currentTime)),
            )}
          </span>
        ) : null}
        <div style={{ flex: 1 }} />
        {strings.zoomCaption ? (
          <span className="interlace-hint" aria-hidden="true">
            {strings.zoomCaption}
          </span>
        ) : null}
        <button
          type="button"
          className="interlace-btn interlace-btn--secondary interlace-btn--icon"
          onClick={() => handleZoom(-1)}
          data-testid="keyframe-timeline-zoom-out"
          aria-label={strings.zoomOutLabel}
          title={strings.zoomOutLabel}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          className="interlace-btn interlace-btn--secondary interlace-btn--icon"
          onClick={() => handleZoom(1)}
          data-testid="keyframe-timeline-zoom-in"
          aria-label={strings.zoomInLabel}
          title={strings.zoomInLabel}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {/* Scrollable strip: ruler + track + playhead. Horizontal overflow
          is allowed for zoomed-in scoping; past MAX_VISIBLE_LANES the
          track scrolls vertically under a sticky ruler. */}
      <div
        ref={scrollRef}
        data-testid="keyframe-timeline-scroll"
        style={{
          overflowX: "auto",
          overflowY: "auto",
          position: "relative",
          maxHeight: RULER_HEIGHT + MAX_TRACK_HEIGHT,
        }}
      >
        <div
          ref={stripRef}
          data-testid="keyframe-timeline-strip"
          style={{ position: "relative", width: stripWidth, minWidth: "100%" }}
        >
          {/* Ruler */}
          <div
            role="slider"
            className="interlace-focusable"
            aria-label={strings.rulerLabel}
            aria-valuemin={0}
            aria-valuemax={Math.round(videoDuration)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
            data-testid="keyframe-timeline-ruler"
            onPointerDown={(e) => {
              handleRulerSeek(e);
              beginPlayheadDrag(e);
            }}
            onKeyDown={handlePlayheadKeyDown}
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              height: RULER_HEIGHT,
              backgroundColor: COLORS.surfaceRaised,
              borderBottom: `1px solid ${COLORS.border}`,
              cursor: "pointer",
              userSelect: "none",
              touchAction: "none",
            }}
          >
            {ticks.map((t) => {
              // A label at the very end would overflow the strip (and make
              // it scroll sideways), so it sits to the left of its line.
              const atEnd = t > 0 && t * zoom + TICK_LABEL_ROOM > stripWidth;
              return (
                <div
                  key={t}
                  data-testid={`keyframe-timeline-tick-${t}`}
                  style={{
                    position: "absolute",
                    left: t * zoom,
                    top: 0,
                    bottom: 0,
                    ...(atEnd
                      ? {
                          transform: "translateX(-100%)",
                          borderRight: `1px solid ${COLORS.borderStrong}`,
                          paddingRight: SPACE[1],
                        }
                      : {
                          borderLeft: `1px solid ${COLORS.borderStrong}`,
                          paddingLeft: SPACE[1],
                        }),
                    fontSize: TYPE.xs,
                    color: COLORS.textMuted,
                    lineHeight: `${RULER_HEIGHT}px`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatTick(t)}
                </div>
              );
            })}
          </div>

          {/* Track */}
          <div
            role="listbox"
            aria-label={strings.trackLabel}
            data-testid="keyframe-timeline-track"
            onPointerDown={(e) => {
              // Clicking the empty track background (not a keyframe,
              // range, or the ruler) deselects the selected hook.
              if (e.target !== e.currentTarget) return;
              onDeselect?.();
            }}
            style={{
              position: "relative",
              height: trackHeight,
            }}
          >
            {entries.length === 0 ? (
              <p
                data-testid="keyframe-timeline-empty"
                style={{
                  margin: 0,
                  padding: "14px 12px",
                  color: COLORS.textMuted,
                  fontSize: TYPE.sm,
                }}
              >
                {strings.emptyLabel}
              </p>
            ) : (
              entries.map((entry) => {
                const selected = entry.id === selectedId;
                const accent = COLORS.accent;
                const title = titleOf(entry);
                // Lane assignment from the greedy interval packing:
                // overlapping entries stack into successive rows.
                const lane = layout.lanes.get(entry.id) ?? 0;
                const laneTop = TRACK_PADDING / 2 + lane * LANE_HEIGHT;
                if (entry.hookType === "blocking") {
                  const px = (entry.timestamp ?? 0) * zoom;
                  const half = KEYFRAME_HIT_PX / 2;
                  return (
                    <React.Fragment key={entry.id}>
                      {/* The button is the (transparent) hit area; the
                          diamond is a purely visual child. */}
                      <button
                        type="button"
                        className="interlace-focusable"
                        data-testid="timeline-keyframe"
                        data-content-id={entry.id}
                        aria-label={ariaLabelOf(
                          entry,
                          `${title} — ${strings.blockingKeyframeLabel} ${formatTick(Math.round(entry.timestamp ?? 0))}`,
                        )}
                        onClick={() => onSelectEntry(entry.id)}
                        onKeyDown={handleKeyframeKeyDown(entry)}
                        onPointerDown={beginKeyframeDrag(
                          entry.id,
                          entry.timestamp ?? 0,
                        )}
                        style={{
                          position: "absolute",
                          left: px - half,
                          top: laneTop,
                          width: KEYFRAME_HIT_PX,
                          height: KEYFRAME_HIT_PX,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          border: "none",
                          borderRadius: RADIUS.sm,
                          backgroundColor: "transparent",
                          cursor: "grab",
                          touchAction: "none",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          data-testid="timeline-keyframe-diamond"
                          style={{
                            boxSizing: "border-box",
                            width: KEYFRAME_SIZE_PX,
                            height: KEYFRAME_SIZE_PX,
                            transform: "rotate(45deg)",
                            backgroundColor: selected ? accent : COLORS.surface,
                            border: `2px solid ${accent}`,
                            borderRadius: 2,
                            boxShadow: selected ? SHADOWS.sm : "none",
                            pointerEvents: "none",
                          }}
                        />
                        {entry.needsAttention && (
                          <AttentionDot
                            style={{ position: "absolute", top: 0, right: 0 }}
                          />
                        )}
                      </button>
                      <span
                        aria-hidden="true"
                        data-testid="timeline-keyframe-label"
                        data-content-id={entry.id}
                        title={title}
                        onClick={() => onSelectEntry(entry.id)}
                        style={{
                          position: "absolute",
                          left: px + half,
                          top: laneTop,
                          maxWidth: LABEL_MAX_WIDTH_PX,
                          height: KEYFRAME_HIT_PX,
                          lineHeight: `${KEYFRAME_HIT_PX}px`,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: TYPE.xs,
                          color: selected ? COLORS.accent : COLORS.text,
                          fontWeight: selected ? 700 : 400,
                          fontStyle: entry.title.trim() ? "normal" : "italic",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        {title}
                      </span>
                    </React.Fragment>
                  );
                }
                const startPx = (entry.start ?? 0) * zoom;
                const widthPx = Math.max(
                  ((entry.end ?? 0) - (entry.start ?? 0)) * zoom,
                  RANGE_MIN_WIDTH_PX,
                );
                const edgeStyle = (
                  side: "start" | "end",
                ): React.CSSProperties => ({
                  width: RANGE_EDGE_PX,
                  flexShrink: 0,
                  alignSelf: "stretch",
                  display: "flex",
                  justifyContent: side === "start" ? "flex-start" : "flex-end",
                  cursor: "ew-resize",
                  touchAction: "none",
                });
                const edgeGrip = (
                  <span
                    aria-hidden="true"
                    style={{ width: 4, backgroundColor: COLORS.accent }}
                  />
                );
                return (
                  <div
                    key={entry.id}
                    data-testid="timeline-range"
                    data-content-id={entry.id}
                    style={{
                      position: "absolute",
                      left: startPx,
                      width: widthPx,
                      top: laneTop + 4,
                      height: LANE_HEIGHT - 8,
                      backgroundColor: selected
                        ? COLORS.accentLight
                        : COLORS.accentLighter,
                      border: `2px solid ${COLORS.accent}`,
                      borderRadius: RADIUS.sm,
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      overflow: "hidden",
                      touchAction: "none",
                    }}
                  >
                    {/* start edge */}
                    <div
                      role="separator"
                      aria-label={`${title} — resize start`}
                      data-testid="timeline-range-start"
                      onPointerDown={beginRangeDrag(
                        entry.id,
                        "start",
                        entry.start ?? 0,
                        entry.end ?? 0,
                      )}
                      style={edgeStyle("start")}
                    >
                      {edgeGrip}
                    </div>
                    <button
                      type="button"
                      className="interlace-focusable"
                      data-testid="timeline-keyframe"
                      data-content-id={entry.id}
                      aria-label={ariaLabelOf(
                        entry,
                        `${title} — ${strings.nonBlockingRangeLabel} ${formatTick(Math.round(entry.start ?? 0))} to ${formatTick(Math.round(entry.end ?? 0))}`,
                      )}
                      title={title}
                      onClick={() => onSelectEntry(entry.id)}
                      onKeyDown={handleKeyframeKeyDown(entry)}
                      onPointerDown={beginRangeDrag(
                        entry.id,
                        "body",
                        entry.start ?? 0,
                        entry.end ?? 0,
                      )}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        alignSelf: "stretch",
                        display: "flex",
                        alignItems: "center",
                        gap: SPACE[1],
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "grab",
                        fontSize: TYPE.xs,
                        color: COLORS.text,
                        padding: `0 ${SPACE[1]}px`,
                        textAlign: "left",
                        fontWeight: selected ? 700 : 400,
                        fontStyle: entry.title.trim() ? "normal" : "italic",
                        touchAction: "none",
                      }}
                    >
                      {entry.needsAttention && <AttentionDot />}
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title}
                      </span>
                    </button>
                    {/* end edge */}
                    <div
                      role="separator"
                      aria-label={`${title} — resize end`}
                      data-testid="timeline-range-end"
                      onPointerDown={beginRangeDrag(
                        entry.id,
                        "end",
                        entry.start ?? 0,
                        entry.end ?? 0,
                      )}
                      style={edgeStyle("end")}
                    >
                      {edgeGrip}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Playhead */}
          <div
            data-testid="keyframe-timeline-playhead"
            style={{
              position: "absolute",
              left: playheadPx,
              top: 0,
              bottom: 0,
              width: 0,
              zIndex: 3,
              borderLeft: `2px solid ${COLORS.accent}`,
              pointerEvents: "none",
            }}
          >
            <div
              role="slider"
              className="interlace-focusable"
              aria-label={strings.playheadLabel}
              aria-valuemin={0}
              aria-valuemax={Math.round(videoDuration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${currentTime.toFixed(1)}s`}
              tabIndex={0}
              data-testid="keyframe-timeline-playhead-handle"
              onPointerDown={beginPlayheadDrag}
              onKeyDown={handlePlayheadKeyDown}
              style={{
                position: "absolute",
                left: -7,
                top: 0,
                width: 12,
                height: 14,
                backgroundColor: COLORS.accent,
                borderRadius: "2px 2px 4px 4px",
                cursor: "ew-resize",
                pointerEvents: "auto",
                touchAction: "none",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
