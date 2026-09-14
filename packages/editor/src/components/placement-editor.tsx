import { Placement } from "@interlace/core";
import React, { useCallback, useEffect, useRef } from "react";
import { COLORS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";

/**
 * PlacementEditor - an overlay for positioning a hook's placement
 * rectangle on the video frame. Must be stacked (via a `position:
 * relative` container) directly on top of a `<video>` element; the
 * overlay maps placement percentages against its *own* rendered box,
 * which equals the video frame when the container hugs the video.
 *
 * Interaction model:
 * - Drag the rectangle to move it (pointer capture keeps the drag
 *   alive when the pointer leaves the frame, so the bounds clamps
 *   are reachable by overshooting past the video edge).
 * - Drag any of the 8 handles (4 corners + 4 edges) to resize. The
 *   opposite edge stays anchored on west/north handles.
 * - Arrow keys on the focused rectangle nudge by 1% (5% with Shift).
 * - The X/Y/W/H numerical inputs clamp through the same policy as
 *   the pointer paths.
 *
 * Clamping policy (`clampPlacement`): move keeps the rectangle fully
 * inside the frame; resize keeps the origin anchored and enforces a
 * minimum size so a hook can never be resized into invisibility.
 */

export interface PlacementEditorProps {
  placement: Placement;
  onPlacementChange: (placement: Placement) => void;
}

/** Minimum rectangle size in percent of the frame, per axis. */
export const PLACEMENT_MIN_SIZE = 1;

type DragIntent = "move" | "resize";
type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Centralized bounds policy for every placement change path (drag,
 * handles, keyboard nudge, numerical inputs).
 *
 * - "move": the rectangle must stay fully inside the frame —
 *   `x ∈ [0, 100 − width]`, `y ∈ [0, 100 − height]`.
 * - "resize": the origin stays anchored —
 *   `width ∈ [MIN, 100 − x]`, `height ∈ [MIN, 100 − y]`. An
 *   out-of-range origin (possible from a loaded document with bad
 *   data) is repaired first so both the bounds and the minimum size
 *   can hold simultaneously.
 */
export function clampPlacement(next: Placement, intent: DragIntent): Placement {
  if (intent === "move") {
    const width = Math.max(PLACEMENT_MIN_SIZE, next.width);
    const height = Math.max(PLACEMENT_MIN_SIZE, next.height);
    return {
      ...next,
      width,
      height,
      x: clampValue(next.x, 0, 100 - width),
      y: clampValue(next.y, 0, 100 - height),
    };
  }
  const x = clampValue(next.x, 0, 100 - PLACEMENT_MIN_SIZE);
  const y = clampValue(next.y, 0, 100 - PLACEMENT_MIN_SIZE);
  return {
    ...next,
    x,
    y,
    width: clampValue(next.width, PLACEMENT_MIN_SIZE, 100 - x),
    height: clampValue(next.height, PLACEMENT_MIN_SIZE, 100 - y),
  };
}

/**
 * Raw (unclamped) resize candidate for one handle. West/north handles
 * keep the opposite edge anchored; the pre-guard prevents negative
 * sizes before `clampPlacement`'s resize policy runs.
 */
function resizeCandidate(
  handle: HandleId,
  start: Placement,
  px: number,
  py: number,
): Placement {
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const anchorX = Math.min(px, right - PLACEMENT_MIN_SIZE);
  const anchorY = Math.min(py, bottom - PLACEMENT_MIN_SIZE);
  switch (handle) {
    case "e":
      return { ...start, width: px - start.x };
    case "w":
      return { ...start, x: anchorX, width: right - anchorX };
    case "s":
      return { ...start, height: py - start.y };
    case "n":
      return { ...start, y: anchorY, height: bottom - anchorY };
    case "se":
      return { ...start, width: px - start.x, height: py - start.y };
    case "ne":
      return {
        ...start,
        width: px - start.x,
        y: anchorY,
        height: bottom - anchorY,
      };
    case "sw":
      return {
        ...start,
        x: anchorX,
        width: right - anchorX,
        height: py - start.y,
      };
    case "nw":
      return {
        ...start,
        x: anchorX,
        width: right - anchorX,
        y: anchorY,
        height: bottom - anchorY,
      };
  }
}

const HANDLE_SIZE = 10; // px

interface HandleDef {
  id: HandleId;
  label: string;
  cursor: string;
  style: React.CSSProperties;
}

const HANDLE_DEFS: HandleDef[] = [
  {
    id: "nw",
    label: "Resize north-west",
    cursor: "nwse-resize",
    style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  },
  {
    id: "n",
    label: "Resize north",
    cursor: "ns-resize",
    style: { top: -HANDLE_SIZE / 2, left: "50%", marginLeft: -HANDLE_SIZE / 2 },
  },
  {
    id: "ne",
    label: "Resize north-east",
    cursor: "nesw-resize",
    style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  },
  {
    id: "e",
    label: "Resize east",
    cursor: "ew-resize",
    style: {
      top: "50%",
      right: -HANDLE_SIZE / 2,
      marginTop: -HANDLE_SIZE / 2,
    },
  },
  {
    id: "se",
    label: "Resize south-east",
    cursor: "nwse-resize",
    style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  },
  {
    id: "s",
    label: "Resize south",
    cursor: "ns-resize",
    style: {
      bottom: -HANDLE_SIZE / 2,
      left: "50%",
      marginLeft: -HANDLE_SIZE / 2,
    },
  },
  {
    id: "sw",
    label: "Resize south-west",
    cursor: "nesw-resize",
    style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  },
  {
    id: "w",
    label: "Resize west",
    cursor: "ew-resize",
    style: {
      top: "50%",
      left: -HANDLE_SIZE / 2,
      marginTop: -HANDLE_SIZE / 2,
    },
  },
];

interface DragState {
  cleanup: () => void;
}

/**
 * PlacementEditor overlay. See the interface doc for the interaction
 * model. All %↔pixel conversion happens against this component's own
 * frame layer (`getBoundingClientRect`), which equals the video frame
 * when the parent stacks it over the video with `position: relative`.
 */
export const PlacementEditor: React.FC<PlacementEditorProps> = ({
  placement,
  onPlacementChange,
}) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // Latest props, read from the native pointer listeners (which would
  // otherwise close over stale values).
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const onPlacementChangeRef = useRef(onPlacementChange);
  onPlacementChangeRef.current = onPlacementChange;

  // Ensure a drag in progress is cleaned up if the component unmounts
  // mid-drag (e.g. the parent removes the selected item or the
  // editor is torn down). Without this, the target and window
  // listeners would leak and dragRef.current would stay set, blocking
  // future drags on a remounted instance.
  useEffect(() => {
    return () => {
      dragRef.current?.cleanup();
    };
  }, []);

  const beginDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>, handle: HandleId | "move") => {
      // Reject non-primary buttons. jsdom has no PointerEvent
      // constructor, so fireEvent falls back to a generic event where
      // `button` is undefined — only reject when a real number says
      // it is not the primary button.
      if (typeof e.button === "number" && e.button !== 0) return;
      if (dragRef.current) return; // one drag at a time
      const frame = frameRef.current;
      const target = e.currentTarget;
      if (!frame) return;
      const frameRect = frame.getBoundingClientRect();
      if (frameRect.width <= 0 || frameRect.height <= 0) return;

      e.preventDefault();
      e.stopPropagation();

      const start = placementRef.current;
      const startPointerPct = {
        x: ((e.clientX - frameRect.left) / frameRect.width) * 100,
        y: ((e.clientY - frameRect.top) / frameRect.height) * 100,
      };
      const intent: DragIntent = handle === "move" ? "move" : "resize";

      const onMove = (ev: PointerEvent) => {
        const px = ((ev.clientX - frameRect.left) / frameRect.width) * 100;
        const py = ((ev.clientY - frameRect.top) / frameRect.height) * 100;
        let candidate: Placement;
        if (handle === "move") {
          candidate = {
            ...start,
            x: start.x + (px - startPointerPct.x),
            y: start.y + (py - startPointerPct.y),
          };
        } else {
          candidate = resizeCandidate(handle, start, px, py);
        }
        onPlacementChangeRef.current(clampPlacement(candidate, intent));
      };

      const cleanup = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("pointercancel", onUp);
        // Window-level fallbacks (added in beginDrag below) — they
        // catch the release when the pointer is over an element that
        // did not receive the captured events, or when capture itself
        // is unsupported.
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        try {
          target.releasePointerCapture?.(pointerId);
        } catch {
          // Capture may already be released (e.g. pointercancel);
          // nothing to do — the drag is over either way.
        }
        dragRef.current = null;
      };
      const onUp = () => {
        cleanup();
      };

      const pointerId = e.pointerId;
      try {
        // Pointer capture retargets all subsequent pointer events to
        // `target`, so the drag survives the pointer leaving the
        // frame — required for the bounds clamps to be reachable by
        // overshooting past the video edge.
        target.setPointerCapture?.(pointerId);
      } catch {
        // jsdom and some engines do not implement pointer capture;
        // the native listeners below still work for in-frame drags.
      }
      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("pointercancel", onUp);
      // Window-level fallbacks: if pointer capture is unavailable
      // and the pointer is released off-target, `pointerup` never
      // reaches `target`, so the target listeners alone would leave
      // the drag stuck. The window listeners guarantee cleanup runs.
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      dragRef.current = { cleanup };
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 5 : 1;
      let next: Placement | null = null;
      switch (e.key) {
        case "ArrowLeft":
          next = { ...placementRef.current, x: placementRef.current.x - step };
          break;
        case "ArrowRight":
          next = { ...placementRef.current, x: placementRef.current.x + step };
          break;
        case "ArrowUp":
          next = { ...placementRef.current, y: placementRef.current.y - step };
          break;
        case "ArrowDown":
          next = { ...placementRef.current, y: placementRef.current.y + step };
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
      onPlacementChangeRef.current(clampPlacement(next, "move"));
    },
    [],
  );

  return (
    <div
      ref={frameRef}
      className="placement-editor"
      data-testid="placement-editor"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <div
        tabIndex={0}
        role="application"
        aria-label={`Placement: x ${placement.x.toFixed(0)}%, y ${placement.y.toFixed(0)}%, width ${placement.width.toFixed(0)}%, height ${placement.height.toFixed(0)}%. Arrow keys nudge.`}
        data-testid="placement-editor-rect"
        onPointerDown={(e) => beginDrag(e, "move")}
        onKeyDown={handleKeyDown}
        style={{
          position: "absolute",
          left: `${placement.x}%`,
          top: `${placement.y}%`,
          width: `${placement.width}%`,
          height: `${placement.height}%`,
          backgroundColor: COLORS.accentLight,
          border: `2px solid ${COLORS.accent}`,
          borderRadius: `${RADIUS.sm}px`,
          boxSizing: "border-box",
          cursor: "move",
          pointerEvents: "auto",
          touchAction: "none",
          transition: "box-shadow 150ms ease",
          boxShadow: SHADOWS.sm,
        }}
      >
        {HANDLE_DEFS.map((handle) => (
          <div
            key={handle.id}
            role="separator"
            aria-label={handle.label}
            aria-orientation="horizontal"
            data-testid={`placement-editor-handle-${handle.id}`}
            onPointerDown={(e) => beginDrag(e, handle.id)}
            style={{
              position: "absolute",
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              backgroundColor: COLORS.surface,
              border: `2px solid ${COLORS.accent}`,
              borderRadius: `${RADIUS.sm}px`,
              boxSizing: "border-box",
              cursor: handle.cursor,
              pointerEvents: "auto",
              touchAction: "none",
              ...handle.style,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export interface PlacementInputsProps {
  placement: Placement;
  onPlacementChange: (placement: Placement) => void;
}

const PLACEMENT_INPUT_STYLE: React.CSSProperties = {
  width: "60px",
  padding: `${SPACE[1]}px`,
  border: `1px solid ${COLORS.borderStrong}`,
  borderRadius: RADIUS.sm,
  fontSize: TYPE.sm,
  color: COLORS.text,
};

/**
 * PlacementInputs - numerical X/Y/W/H editor for a placement. Lives
 * separately from `PlacementEditor` so the overlay frame does not have
 * to host a control panel that would otherwise occlude the video's
 * native controls. Hosts render this in their own toolbar (the
 * editor's `InterlaceEditor` puts it in a row below the video toolbar;
 * standalone hosts compose it however they like).
 *
 * X/Y edits use the "move" policy (position clamped so the rect stays
 * inside the frame). W/H edits use the "resize" policy (size clamped,
 * with the 1% minimum).
 */
export const PlacementInputs: React.FC<PlacementInputsProps> = ({
  placement,
  onPlacementChange,
}) => {
  // Latest props, read from the native event handlers (which would
  // otherwise close over stale values).
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const onChangeRef = useRef(onPlacementChange);
  onChangeRef.current = onPlacementChange;

  const commit = useCallback(
    (partial: Partial<Placement>, intent: DragIntent) => {
      onChangeRef.current(
        clampPlacement({ ...placementRef.current, ...partial }, intent),
      );
    },
    [],
  );

  return (
    <div
      data-testid="placement-editor-inputs"
      style={{
        display: "flex",
        gap: SPACE[2],
        padding: `${SPACE[2]}px 0`,
        fontSize: TYPE.xs,
        alignItems: "center",
        flexWrap: "wrap",
        color: COLORS.textMuted,
      }}
    >
      <label>
        X:{" "}
        <input
          type="number"
          data-testid="placement-editor-input-x"
          value={placement.x.toFixed(1)}
          onChange={(e) =>
            commit({ x: parseFloat(e.target.value) || 0 }, "move")
          }
          style={PLACEMENT_INPUT_STYLE}
        />
      </label>
      <label>
        Y:{" "}
        <input
          type="number"
          data-testid="placement-editor-input-y"
          value={placement.y.toFixed(1)}
          onChange={(e) =>
            commit({ y: parseFloat(e.target.value) || 0 }, "move")
          }
          style={PLACEMENT_INPUT_STYLE}
        />
      </label>
      <label>
        W:{" "}
        <input
          type="number"
          data-testid="placement-editor-input-w"
          value={placement.width.toFixed(1)}
          onChange={(e) =>
            commit({ width: parseFloat(e.target.value) || 0 }, "resize")
          }
          style={PLACEMENT_INPUT_STYLE}
        />
      </label>
      <label>
        H:{" "}
        <input
          type="number"
          data-testid="placement-editor-input-h"
          value={placement.height.toFixed(1)}
          onChange={(e) =>
            commit({ height: parseFloat(e.target.value) || 0 }, "resize")
          }
          style={PLACEMENT_INPUT_STYLE}
        />
      </label>
    </div>
  );
};
