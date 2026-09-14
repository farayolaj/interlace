import type { Placement } from "@interlace/core";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { firePointer, stubPointerCapture } from "../test-utils/pointer";
import { stubRect } from "../test-utils/stub-rect";
import {
  PLACEMENT_MIN_SIZE,
  PlacementEditor,
  PlacementInputs,
  clampPlacement,
} from "./placement-editor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FRAME = { width: 640, height: 360 };

const DEFAULT_PLACEMENT: Placement = { x: 50, y: 50, width: 20, height: 20 };

/**
 * Renders the editor inside a positioned parent that simulates the
 * video frame and stubs the frame's `getBoundingClientRect` so the
 * %↔pixel math is deterministic in jsdom.
 */
function renderEditor(placement: Placement = DEFAULT_PLACEMENT) {
  const onPlacementChange = vi.fn();
  const { container } = render(
    <div
      style={{ position: "relative", width: FRAME.width, height: FRAME.height }}
    >
      <PlacementEditor
        placement={placement}
        onPlacementChange={onPlacementChange}
      />
    </div>,
  );
  const frame = container.querySelector(
    '[data-testid="placement-editor"]',
  ) as HTMLDivElement;
  const restore = stubRect(frame, FRAME);
  return { container, onPlacementChange, frame, restore };
}

/** Last placement emitted through onPlacementChange. */
function lastPlacement(onPlacementChange: ReturnType<typeof vi.fn>): Placement {
  const calls = onPlacementChange.mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error("expected onPlacementChange to have been called");
  return last[0] as Placement;
}

function rectEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector(
    '[data-testid="placement-editor-rect"]',
  ) as HTMLElement | null;
  if (!el) throw new Error("expected placement rect");
  return el;
}

function handleEl(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(
    `[data-testid="placement-editor-handle-${id}"]`,
  ) as HTMLElement | null;
  if (!el) throw new Error(`expected handle ${id}`);
  return el;
}

describe("clampPlacement", () => {
  it("move policy keeps the rectangle fully inside the frame", () => {
    const clamped = clampPlacement(
      { x: 110, y: -5, width: 20, height: 20 },
      "move",
    );
    expect(clamped.x).toBe(80); // 100 - width
    expect(clamped.y).toBe(0);
  });

  it("move policy enforces the minimum size first", () => {
    const clamped = clampPlacement(
      { x: 99, y: 99, width: 0, height: 0 },
      "move",
    );
    expect(clamped.width).toBe(PLACEMENT_MIN_SIZE);
    expect(clamped.height).toBe(PLACEMENT_MIN_SIZE);
    // x clamps to 100 - 1 = 99 → unchanged; y likewise.
    expect(clamped.x).toBe(99);
    expect(clamped.y).toBe(99);
  });

  it("resize policy keeps the origin anchored and clamps size to the frame", () => {
    const clamped = clampPlacement(
      { x: 50, y: 40, width: 200, height: -10 },
      "resize",
    );
    expect(clamped.x).toBe(50);
    expect(clamped.y).toBe(40);
    expect(clamped.width).toBe(50); // 100 - x
    expect(clamped.height).toBe(PLACEMENT_MIN_SIZE);
  });

  it("resize policy repairs an out-of-range origin so both invariants can hold", () => {
    // x=99.5 with MIN=1: the origin is repaired down to 99 so a
    // minimum-size rectangle still fits inside the frame.
    const clamped = clampPlacement(
      { x: 99.5, y: 99.5, width: 5, height: 5 },
      "resize",
    );
    expect(clamped.x).toBe(99);
    expect(clamped.y).toBe(99);
    expect(clamped.width).toBe(PLACEMENT_MIN_SIZE);
    expect(clamped.height).toBe(PLACEMENT_MIN_SIZE);
  });
});

describe("PlacementEditor", () => {
  it("renders the rectangle at the placement coordinates", () => {
    const { container } = renderEditor({ x: 10, y: 20, width: 30, height: 40 });
    const rect = rectEl(container);
    expect(rect.style.left).toBe("10%");
    expect(rect.style.top).toBe("20%");
    expect(rect.style.width).toBe("30%");
    expect(rect.style.height).toBe("40%");
  });

  it("renders 8 handles with distinct aria-labels and cursor styles", () => {
    const { container } = renderEditor();
    const handles = container.querySelectorAll(
      "[data-testid^='placement-editor-handle-']",
    );
    expect(handles.length).toBe(8);
    const labels = Array.from(handles).map((h) => h.getAttribute("aria-label"));
    expect(new Set(labels).size).toBe(8);
    expect(handles[0]).toHaveStyle({ cursor: "nwse-resize" });
  });

  it("dragging the rectangle moves it", () => {
    const { container, onPlacementChange } = renderEditor();
    const rect = rectEl(container);
    // Frame is 640x360 at (0,0). Start at the placement's center
    // (50%,50% → 320,180); move by +10% of width (64px) and +5% of
    // height (18px).
    firePointer(rect, "pointerdown", 320, 180);
    firePointer(rect, "pointermove", 384, 198);
    firePointer(rect, "pointerup", 384, 198);

    const placement = lastPlacement(onPlacementChange);
    // 198/360*100 carries float noise (55.00000000000001); the
    // contract is the percentage, so compare with a tolerance.
    expect(placement.x).toBeCloseTo(60, 6);
    expect(placement.y).toBeCloseTo(55, 6);
    expect(placement.width).toBe(20);
    expect(placement.height).toBe(20);
  });

  it("move drag clamps x to 100 - width when dragged past the right edge", () => {
    const { container, onPlacementChange } = renderEditor();
    const rect = rectEl(container);
    firePointer(rect, "pointerdown", 320, 180);
    // +60% horizontally: raw x would be 110.
    firePointer(rect, "pointermove", 320 + 0.6 * FRAME.width, 180);
    firePointer(rect, "pointerup", 320 + 0.6 * FRAME.width, 180);

    const placement = lastPlacement(onPlacementChange);
    expect(placement.x).toBe(80); // 100 - 20
    expect(placement.y).toBe(50);
  });

  it("resize via the east handle changes width only", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    const handle = handleEl(container, "e");
    // East edge starts at 30% (192px); drag to 50% (320px) → width 40%.
    firePointer(handle, "pointerdown", 192, 100);
    firePointer(handle, "pointermove", 320, 100);
    firePointer(handle, "pointerup", 320, 100);

    const placement = lastPlacement(onPlacementChange);
    expect(placement.x).toBe(10);
    expect(placement.y).toBe(10);
    expect(placement.width).toBe(40);
    expect(placement.height).toBe(20);
  });

  it("resize via the west handle keeps the right edge anchored", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 20,
      y: 10,
      width: 30,
      height: 20,
    });
    const handle = handleEl(container, "w");
    // West edge starts at 20% (128px); drag to 60% (384px) — past the
    // right edge (50%). Raw width would be negative; the anchored
    // right edge plus the min size resolve it.
    firePointer(handle, "pointerdown", 128, 100);
    firePointer(handle, "pointermove", 384, 100);
    firePointer(handle, "pointerup", 384, 100);

    const placement = lastPlacement(onPlacementChange);
    expect(placement.x).toBe(49); // right (50) - min size (1)
    expect(placement.width).toBe(1); // right (50) - x (49)
    // Right edge is preserved: x + width = 50.
    expect(placement.x + placement.width).toBe(50);
    expect(placement.y).toBe(10);
    expect(placement.height).toBe(20);
  });

  it("resize via the south handle changes height only", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    const handle = handleEl(container, "s");
    // South edge starts at 30% of 360 = 108px; drag to 180px (50%).
    firePointer(handle, "pointerdown", 100, 108);
    firePointer(handle, "pointermove", 100, 180);
    firePointer(handle, "pointerup", 100, 180);

    const placement = lastPlacement(onPlacementChange);
    expect(placement.x).toBe(10);
    expect(placement.y).toBe(10);
    expect(placement.width).toBe(20);
    expect(placement.height).toBe(40);
  });

  it("resize via the north handle keeps the bottom edge anchored", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 10,
      y: 20,
      width: 20,
      height: 30,
    });
    const handle = handleEl(container, "n");
    // North edge starts at 20% of 360 = 72px; drag below the bottom
    // edge (50% of 360 = 180px). Raw height would be negative; the
    // anchored bottom edge plus the min size resolve it.
    firePointer(handle, "pointerdown", 100, 72);
    firePointer(handle, "pointermove", 100, 180);
    firePointer(handle, "pointerup", 100, 180);

    const placement = lastPlacement(onPlacementChange);
    expect(placement.y).toBe(49); // bottom (50) - min size (1)
    expect(placement.height).toBe(1); // bottom (50) - y (49)
    // Bottom edge is preserved: y + height = 50.
    expect(placement.y + placement.height).toBe(50);
    expect(placement.x).toBe(10);
    expect(placement.width).toBe(20);
  });

  it("resize via the south-east corner changes width and height, origin anchored", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    const handle = handleEl(container, "se");
    // SE corner starts at (30%, 30%) → (192px, 108px); drag to (80%, 80%).
    firePointer(handle, "pointerdown", 192, 108);
    firePointer(handle, "pointermove", 512, 288);
    firePointer(handle, "pointerup", 512, 288);

    const placement = lastPlacement(onPlacementChange);
    expect(placement.x).toBe(10);
    expect(placement.y).toBe(10);
    expect(placement.width).toBe(70);
    expect(placement.height).toBe(70);
  });

  it("overshoot: the drag survives the pointer leaving the frame and the clamp still applies", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    });
    const handle = handleEl(container, "e");
    const capture = stubPointerCapture(handle);
    // East edge at 20% (128px); drag far past the right edge of the
    // frame (to 2000px) — pointer capture keeps the events flowing to
    // the handle and the resize clamp pins width at 100 - x.
    firePointer(handle, "pointerdown", 128, 100);
    firePointer(handle, "pointermove", 2000, 100);
    firePointer(handle, "pointerup", 2000, 100);

    expect(capture.setPointerCapture).toHaveBeenCalled();
    const placement = lastPlacement(onPlacementChange);
    expect(placement.x).toBe(0);
    expect(placement.width).toBe(100);
  });

  it("enforces the minimum size when resizing below it", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    });
    const handle = handleEl(container, "e");
    // East edge at 70% (448px); drag left past the west edge (to 40%).
    // Raw width would be negative; the min size clamps it to 1%.
    firePointer(handle, "pointerdown", 448, 200);
    firePointer(handle, "pointermove", 256, 200);
    firePointer(handle, "pointerup", 256, 200);

    const placement = lastPlacement(onPlacementChange);
    expect(placement.width).toBe(PLACEMENT_MIN_SIZE);
  });

  it("arrow keys nudge by 1% and clamp through the move policy", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    });
    const rect = rectEl(container);
    fireEvent.keyDown(rect, { key: "ArrowRight" });
    expect(lastPlacement(onPlacementChange).x).toBe(51);
    fireEvent.keyDown(rect, { key: "ArrowUp" });
    expect(lastPlacement(onPlacementChange).y).toBe(49);
  });

  it("shift + arrow keys nudge by 5%", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    });
    const rect = rectEl(container);
    fireEvent.keyDown(rect, { key: "ArrowRight", shiftKey: true });
    expect(lastPlacement(onPlacementChange).x).toBe(55);
  });

  it("arrow-key nudge clamps at the frame boundary", () => {
    const { container, onPlacementChange } = renderEditor({
      x: 80,
      y: 80,
      width: 20,
      height: 20,
    });
    const rect = rectEl(container);
    fireEvent.keyDown(rect, { key: "ArrowRight" });
    expect(lastPlacement(onPlacementChange).x).toBe(80); // 100 - 20
    fireEvent.keyDown(rect, { key: "ArrowDown" });
    expect(lastPlacement(onPlacementChange).y).toBe(80);
  });
});

describe("PlacementInputs", () => {
  function renderInputs(placement: Placement = DEFAULT_PLACEMENT) {
    const onPlacementChange = vi.fn();
    const utils = render(
      <PlacementInputs
        placement={placement}
        onPlacementChange={onPlacementChange}
      />,
    );
    return { ...utils, onPlacementChange };
  }

  function lastInputsPlacement(
    onPlacementChange: ReturnType<typeof vi.fn>,
  ): Placement {
    const calls = onPlacementChange.mock.calls;
    const last = calls[calls.length - 1];
    if (!last)
      throw new Error("expected onPlacementChange to have been called");
    return last[0] as Placement;
  }

  function inputEl(
    container: HTMLElement,
    axis: "x" | "y" | "w" | "h",
  ): HTMLInputElement {
    const el = container.querySelector(
      `[data-testid="placement-editor-input-${axis}"]`,
    ) as HTMLInputElement | null;
    if (!el) throw new Error(`expected ${axis} input`);
    return el;
  }

  it("X input move-clamps so the rectangle stays inside the frame", () => {
    const { container, onPlacementChange } = renderInputs({
      x: 50,
      y: 50,
      width: 30,
      height: 20,
    });
    fireEvent.change(inputEl(container, "x"), { target: { value: "99" } });

    const placement = lastInputsPlacement(onPlacementChange);
    expect(placement.x).toBe(70); // 100 - 30
    expect(placement.width).toBe(30);
  });

  it("Y input move-clamps so the rectangle stays inside the frame", () => {
    const { container, onPlacementChange } = renderInputs({
      x: 50,
      y: 50,
      width: 20,
      height: 30,
    });
    fireEvent.change(inputEl(container, "y"), { target: { value: "95" } });

    const placement = lastInputsPlacement(onPlacementChange);
    expect(placement.y).toBe(70); // 100 - 30
    expect(placement.height).toBe(30);
  });

  it("W input resize-clamps to the remaining frame width", () => {
    const { container, onPlacementChange } = renderInputs({
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    });
    fireEvent.change(inputEl(container, "w"), { target: { value: "200" } });

    const placement = lastInputsPlacement(onPlacementChange);
    expect(placement.x).toBe(50);
    expect(placement.width).toBe(50); // 100 - 50
  });

  it("H input resize-clamps to the remaining frame height", () => {
    const { container, onPlacementChange } = renderInputs({
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    });
    fireEvent.change(inputEl(container, "h"), { target: { value: "200" } });

    const placement = lastInputsPlacement(onPlacementChange);
    expect(placement.y).toBe(50);
    expect(placement.height).toBe(50); // 100 - 50
  });

  it("numerical input NaN (parseFloat || 0) falls back to the minimum size for W/H", () => {
    const { container, onPlacementChange } = renderInputs({
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    });
    fireEvent.change(inputEl(container, "w"), { target: { value: "abc" } });

    const placement = lastInputsPlacement(onPlacementChange);
    expect(placement.width).toBe(PLACEMENT_MIN_SIZE);
  });

  it("numerical input NaN falls back to 0 for X and clamps through the move policy", () => {
    const { container, onPlacementChange } = renderInputs({
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    });
    fireEvent.change(inputEl(container, "x"), { target: { value: "abc" } });

    const placement = lastInputsPlacement(onPlacementChange);
    expect(placement.x).toBe(0);
  });
});
