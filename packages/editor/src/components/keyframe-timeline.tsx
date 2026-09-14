import { DEFAULT_STRINGS, type Strings } from "@interlace/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
}

export const DEFAULT_KEYFRAME_TIMELINE_STRINGS: KeyframeTimelineStrings = {
  ...DEFAULT_STRINGS,
  addBlockingLabel: "+ Blocking at playhead",
  addNonBlockingLabel: "+ Non-blocking at playhead",
  zoomInLabel: "Zoom in",
  zoomOutLabel: "Zoom out",
  playLabel: "Play",
  pauseLabel: "Pause",
  playheadLabel: "Playhead",
  emptyLabel: "No hooks yet. Add one at the playhead to get started.",
  rulerLabel: "Timeline ruler",
  trackLabel: "Hook track",
  blockingKeyframeLabel: "blocking at",
  nonBlockingRangeLabel: "non-blocking from",
};

export interface KeyframeTimelineEntry {
  id: string;
  title: string;
  hookType: "blocking" | "non-blocking";
  timestamp?: number;
  start?: number;
  end?: number;
}

export interface KeyframeTimelineProps {
  entries: KeyframeTimelineEntry[];
  selectedId?: string;
  /** Total video duration in seconds; the strip's time axis. */
  videoDuration: number;
  /** Current playhead position in seconds. */
  currentTime: number;
  /** Whether the authoring video is currently playing (drives the play/pause button). */
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
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

const LANE_HEIGHT = 28; // px per lane row
const KEYFRAME_WIDTH_PX = 14; // rendered diamond width
const RANGE_MIN_WIDTH_PX = 12; // rendered minimum range width

function anchorOf(entry: KeyframeTimelineEntry): number {
  return entry.hookType === "blocking"
    ? (entry.timestamp ?? 0)
    : (entry.start ?? 0);
}

/**
 * The time extent an entry occupies on the strip: ranges span their
 * start→end; blocking keyframes occupy their rendered diamond width
 * (expressed in seconds at the current zoom), so two keyframes stack
 * exactly when their rendered shapes would overlap.
 */
function extentOf(entry: KeyframeTimelineEntry, zoom: number): number {
  if (entry.hookType === "blocking") {
    return KEYFRAME_WIDTH_PX / zoom;
  }
  const span = (entry.end ?? 0) - (entry.start ?? 0);
  return Math.max(RANGE_MIN_WIDTH_PX / zoom, span);
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
 * - Zoom via the +/- buttons or ctrl+wheel (native non-passive listener,
 *   since React's synthetic onWheel cannot preventDefault).
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
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const dragRef = useRef<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  // Latest props for the native drag listeners.
  const propsRef = useRef({ zoom, videoDuration, currentTime });
  propsRef.current = { zoom, videoDuration, currentTime };

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

  // Ctrl+wheel zoom. React's synthetic onWheel is passive at the root
  // since React 17, so preventDefault requires a native non-passive
  // listener.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) =>
        clampValue(e.deltaY < 0 ? z * 1.2 : z / 1.2, MIN_ZOOM, MAX_ZOOM),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleZoom = useCallback((direction: 1 | -1) => {
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
   * Greedy interval packing: entries sorted by anchor time, each
   * placed in the first lane whose last occupant ends at or before
   * its start. Overlapping entries stack into successive lanes; the
   * track height grows to fit them. The playhead still spans the
   * full track.
   */
  const layout = useMemo(() => {
    const sorted = [...entries].sort((a, b) => anchorOf(a) - anchorOf(b));
    const laneEnds: number[] = [];
    const lanes = new Map<string, number>();
    for (const entry of sorted) {
      const start = anchorOf(entry);
      const end = start + extentOf(entry, zoom);
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
  }, [entries, zoom]);

  const interval = tickInterval(zoom);
  const ticks: number[] = [];
  for (let t = 0; t <= videoDuration; t += interval) {
    ticks.push(Math.round(t * 100) / 100);
  }
  const playheadPx = currentTime * zoom;

  return (
    <div
      className="keyframe-timeline"
      data-testid="keyframe-timeline"
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        backgroundColor: "#fafafa",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Controls row */}
      <div
        data-testid="keyframe-timeline-controls"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onTogglePlay}
          data-testid="keyframe-timeline-play"
          aria-label={isPlaying ? strings.pauseLabel : strings.playLabel}
          style={{
            padding: "4px 12px",
            backgroundColor: "#0066cc",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isPlaying ? strings.pauseLabel : strings.playLabel}
        </button>
        <button
          type="button"
          onClick={() => onAddEntry("blocking")}
          data-testid="keyframe-timeline-add-blocking"
          style={{
            padding: "4px 12px",
            backgroundColor: "#4CAF50",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {strings.addBlockingLabel}
        </button>
        <button
          type="button"
          onClick={() => onAddEntry("non-blocking")}
          data-testid="keyframe-timeline-add-non-blocking"
          style={{
            padding: "4px 12px",
            backgroundColor: "#2196F3",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {strings.addNonBlockingLabel}
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          data-testid="keyframe-timeline-zoom-out"
          aria-label={strings.zoomOutLabel}
          style={{
            padding: "4px 10px",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => handleZoom(1)}
          data-testid="keyframe-timeline-zoom-in"
          aria-label={strings.zoomInLabel}
          style={{
            padding: "4px 10px",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          +
        </button>
      </div>

      {/* Scrollable strip: ruler + track + playhead */}
      <div
        ref={scrollRef}
        data-testid="keyframe-timeline-scroll"
        style={{ overflowX: "auto", position: "relative" }}
      >
        <div
          ref={stripRef}
          data-testid="keyframe-timeline-strip"
          style={{ position: "relative", width: stripWidth, minWidth: "100%" }}
        >
          {/* Ruler */}
          <div
            role="slider"
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
              position: "relative",
              height: 24,
              backgroundColor: "#eef2f7",
              borderBottom: "1px solid #d5dde6",
              cursor: "pointer",
              userSelect: "none",
              touchAction: "none",
            }}
          >
            {ticks.map((t) => (
              <div
                key={t}
                data-testid={`keyframe-timeline-tick-${t}`}
                style={{
                  position: "absolute",
                  left: t * zoom,
                  top: 0,
                  bottom: 0,
                  borderLeft: "1px solid #c3cfdc",
                  paddingLeft: 4,
                  fontSize: 10,
                  color: "#5a6b7d",
                  lineHeight: "24px",
                  whiteSpace: "nowrap",
                }}
              >
                {formatTick(t)}
              </div>
            ))}
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
              height: Math.max(48, layout.laneCount * LANE_HEIGHT + 6),
            }}
          >
            {entries.length === 0 ? (
              <p
                data-testid="keyframe-timeline-empty"
                style={{
                  margin: 0,
                  padding: "14px 12px",
                  color: "#999",
                  fontSize: 13,
                }}
              >
                {strings.emptyLabel}
              </p>
            ) : (
              entries.map((entry) => {
                const selected = entry.id === selectedId;
                const accent = selected ? "#e65100" : "#0066cc";
                // Lane assignment from the greedy interval packing:
                // overlapping entries stack into successive rows.
                const lane = layout.lanes.get(entry.id) ?? 0;
                const laneTop = 3 + lane * LANE_HEIGHT;
                if (entry.hookType === "blocking") {
                  const px = (entry.timestamp ?? 0) * zoom;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      data-testid="timeline-keyframe"
                      data-content-id={entry.id}
                      aria-label={`${entry.title} — ${strings.blockingKeyframeLabel} ${formatTick(Math.round(entry.timestamp ?? 0))}`}
                      onClick={() => onSelectEntry(entry.id)}
                      onKeyDown={handleKeyframeKeyDown(entry)}
                      style={{
                        position: "absolute",
                        left: px - 7,
                        top: laneTop + 5,
                        width: 14,
                        height: 14,
                        transform: "rotate(45deg)",
                        backgroundColor: selected ? accent : "#fff",
                        border: `2px solid ${accent}`,
                        borderRadius: 2,
                        cursor: "grab",
                        padding: 0,
                        touchAction: "none",
                      }}
                      onPointerDown={beginKeyframeDrag(
                        entry.id,
                        entry.timestamp ?? 0,
                      )}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: 16,
                          top: -2,
                          transform: "rotate(-45deg)",
                          fontSize: 11,
                          color: "#334",
                          whiteSpace: "nowrap",
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {entry.title}
                      </span>
                    </button>
                  );
                }
                const startPx = (entry.start ?? 0) * zoom;
                const widthPx = Math.max(
                  ((entry.end ?? 0) - (entry.start ?? 0)) * zoom,
                  12,
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
                      top: laneTop,
                      height: LANE_HEIGHT - 4,
                      backgroundColor: selected
                        ? "rgba(230, 81, 0, 0.25)"
                        : "rgba(33, 150, 243, 0.25)",
                      border: `2px solid ${selected ? "#e65100" : "#2196F3"}`,
                      borderRadius: 4,
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
                      aria-label={`${entry.title} — resize start`}
                      data-testid="timeline-range-start"
                      onPointerDown={beginRangeDrag(
                        entry.id,
                        "start",
                        entry.start ?? 0,
                        entry.end ?? 0,
                      )}
                      style={{
                        width: 8,
                        alignSelf: "stretch",
                        cursor: "ew-resize",
                        backgroundColor: selected ? "#e65100" : "#2196F3",
                        touchAction: "none",
                      }}
                    />
                    <button
                      type="button"
                      data-testid="timeline-keyframe"
                      data-content-id={entry.id}
                      aria-label={`${entry.title} — ${strings.nonBlockingRangeLabel} ${formatTick(Math.round(entry.start ?? 0))} to ${formatTick(Math.round(entry.end ?? 0))}`}
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
                        alignSelf: "stretch",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "grab",
                        fontSize: 11,
                        color: "#223",
                        padding: "0 4px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: selected ? 700 : 400,
                        touchAction: "none",
                      }}
                    >
                      {entry.title}
                    </button>
                    {/* end edge */}
                    <div
                      role="separator"
                      aria-label={`${entry.title} — resize end`}
                      data-testid="timeline-range-end"
                      onPointerDown={beginRangeDrag(
                        entry.id,
                        "end",
                        entry.start ?? 0,
                        entry.end ?? 0,
                      )}
                      style={{
                        width: 8,
                        alignSelf: "stretch",
                        cursor: "ew-resize",
                        backgroundColor: selected ? "#e65100" : "#2196F3",
                        touchAction: "none",
                      }}
                    />
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
              borderLeft: "2px solid #e65100",
              pointerEvents: "none",
            }}
          >
            <div
              role="slider"
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
                backgroundColor: "#e65100",
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
