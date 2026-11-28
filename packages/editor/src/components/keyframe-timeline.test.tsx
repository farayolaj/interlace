import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { firePointer, stubPointerCapture } from "../test-utils/pointer";
import { stubRect } from "../test-utils/stub-rect";
import {
  KeyframeTimeline,
  type KeyframeTimelineEntry,
  type KeyframeTimelineProps,
} from "./keyframe-timeline";

afterEach(() => {
  cleanup();
  restoreClientWidth();
  vi.restoreAllMocks();
});

/**
 * The timeline auto-fits the full video duration to the visible strip width
 * on mount (and on video reload). jsdom reports `clientWidth` as 0, so the
 * scroll viewport width is stubbed on `HTMLElement.prototype` BEFORE render —
 * the mount layout effect then measures it deterministically (480px viewport
 * → fit zoom 8 for the 60s fixture).
 */
const ORIGINAL_CLIENT_WIDTH = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientWidth",
);

function stubClientWidth(width: number): void {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => width,
  });
}

function restoreClientWidth(): void {
  if (ORIGINAL_CLIENT_WIDTH) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientWidth",
      ORIGINAL_CLIENT_WIDTH,
    );
  } else {
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
  }
}

const DURATION = 60;
const ZOOM = 8; // default px/s → strip is 480px wide

function makeEntries(): KeyframeTimelineEntry[] {
  return [
    { id: "b1", title: "Quiz", hookType: "blocking", timestamp: 10 },
    { id: "r1", title: "Poll", hookType: "non-blocking", start: 20, end: 30 },
  ];
}

function baseProps(): KeyframeTimelineProps {
  return {
    entries: makeEntries(),
    videoDuration: DURATION,
    currentTime: 0,
    isPlaying: false,
    onSeek: vi.fn(),
    onTogglePlay: vi.fn(),
    onSelectEntry: vi.fn(),
    onUpdateEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
    onAddEntry: vi.fn(),
  };
}

/**
 * Renders the timeline and stubs the strip's `getBoundingClientRect`
 * (jsdom returns zeros) so the px↔time math is deterministic:
 * 60s × 8px/s = 480px.
 */
function renderTimeline(overrides: Partial<KeyframeTimelineProps> = {}) {
  const props = { ...baseProps(), ...overrides };
  // Fit the viewport (480px) so the mount auto-fit resolves to zoom 8 for
  // the 60s fixture — the same value the tests' math assumes.
  stubClientWidth(DURATION * ZOOM);
  const utils = render(<KeyframeTimeline {...props} />);
  const strip = utils.container.querySelector(
    '[data-testid="keyframe-timeline-strip"]',
  ) as HTMLDivElement;
  const scroll = utils.container.querySelector(
    '[data-testid="keyframe-timeline-scroll"]',
  ) as HTMLDivElement;
  const restore = stubRect(strip, { width: DURATION * ZOOM, height: 72 });
  return { ...props, ...utils, strip, scroll, restore, props };
}

function keyframeEl(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(
    `[data-testid="timeline-keyframe"][data-content-id="${id}"]`,
  ) as HTMLElement | null;
  if (!el) throw new Error(`expected keyframe ${id}`);
  return el;
}

function rangeEl(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(
    `[data-testid="timeline-range"][data-content-id="${id}"]`,
  ) as HTMLElement | null;
  if (!el) throw new Error(`expected range ${id}`);
  return el;
}

function rangeEdge(
  container: HTMLElement,
  id: string,
  edge: "start" | "end",
): HTMLElement {
  const el = rangeEl(container, id).querySelector(
    `[data-testid="timeline-range-${edge}"]`,
  ) as HTMLElement | null;
  if (!el) throw new Error(`expected range ${edge} edge for ${id}`);
  return el;
}

/**
 * firePointer with extra MouseEvent init (shiftKey for snap bypass).
 */
function firePointerExtra(
  el: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY: number,
  extra: Record<string, unknown> = {},
) {
  return fireEvent(
    el,
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0,
      ...extra,
    }),
  );
}

describe("KeyframeTimeline", () => {
  it("renders zoom-aware ruler ticks (interval 10s at 8px/s)", () => {
    const { container } = renderTimeline();
    expect(
      container.querySelector('[data-testid="keyframe-timeline-tick-0"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="keyframe-timeline-tick-10"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="keyframe-timeline-tick-60"]'),
    ).not.toBeNull();
    // No tick below the interval.
    expect(
      container.querySelector('[data-testid="keyframe-timeline-tick-5"]'),
    ).toBeNull();
  });

  it("renders the blocking keyframe positioned at its timestamp", () => {
    const { container } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    // left = timestamp * zoom - half hit area (10*8 - 16).
    expect(kf.style.left).toBe("64px");
    expect(kf.getAttribute("aria-label")).toContain("Quiz");
  });

  it("renders the non-blocking range spanning start → end", () => {
    const { container } = renderTimeline();
    const range = rangeEl(container, "r1");
    expect(range.style.left).toBe("160px"); // 20 * 8
    expect(range.style.width).toBe("80px"); // (30-20) * 8
  });

  it("clicking a keyframe selects its entry", () => {
    const props = renderTimeline();
    fireEvent.click(keyframeEl(props.container as HTMLElement, "b1"));
    expect(props.onSelectEntry).toHaveBeenCalledWith("b1");
  });

  it("dragging a blocking keyframe updates its timestamp (snapped to seconds)", () => {
    const props = renderTimeline();
    const kf = keyframeEl(props.container as HTMLElement, "b1");
    firePointer(kf, "pointerdown", 80, 20);
    // +3s: 24px at 8px/s → timestamp 13.
    firePointer(kf, "pointermove", 104, 20);
    firePointer(kf, "pointerup", 104, 20);
    expect(props.onUpdateEntry).toHaveBeenCalledWith("b1", { timestamp: 13 });
  });

  it("shift during a keyframe drag bypasses snap", () => {
    const props = renderTimeline();
    const kf = keyframeEl(props.container as HTMLElement, "b1");
    firePointer(kf, "pointerdown", 80, 20);
    // +2.375s unsnapped: 19px (19/8 is float-exact).
    firePointerExtra(kf, "pointermove", 99, 20, { shiftKey: true });
    firePointerExtra(kf, "pointerup", 99, 20, { shiftKey: true });
    expect(props.onUpdateEntry).toHaveBeenCalledWith("b1", {
      timestamp: 12.375,
    });
  });

  it("keyframe drag clamps to the video duration", () => {
    const props = renderTimeline();
    const kf = keyframeEl(props.container as HTMLElement, "b1");
    firePointer(kf, "pointerdown", 80, 20);
    // Far past the strip: raw time 500s → clamped to 60.
    firePointer(kf, "pointermove", 4000, 20);
    firePointer(kf, "pointerup", 4000, 20);
    expect(props.onUpdateEntry).toHaveBeenCalledWith("b1", { timestamp: 60 });
  });

  it("dragging the range body moves both ends and preserves duration", () => {
    const props = renderTimeline();
    const body = keyframeEl(props.container as HTMLElement, "r1");
    firePointer(body, "pointerdown", 162, 24);
    // +5s: 40px.
    firePointer(body, "pointermove", 202, 24);
    firePointer(body, "pointerup", 202, 24);
    expect(props.onUpdateEntry).toHaveBeenCalledWith("r1", {
      start: 25,
      end: 35,
    });
  });

  it("dragging the range start edge resizes the start only", () => {
    const props = renderTimeline();
    const edge = rangeEdge(props.container as HTMLElement, "r1", "start");
    firePointer(edge, "pointerdown", 160, 24);
    // +5s: start 20 → 25 (end stays 30).
    firePointer(edge, "pointermove", 200, 24);
    firePointer(edge, "pointerup", 200, 24);
    expect(props.onUpdateEntry).toHaveBeenCalledWith("r1", { start: 25 });
  });

  it("dragging the range end edge resizes the end only", () => {
    const props = renderTimeline();
    const edge = rangeEdge(props.container as HTMLElement, "r1", "end");
    firePointer(edge, "pointerdown", 240, 24);
    // −5s: end 30 → 25 (start stays 20).
    firePointer(edge, "pointermove", 200, 24);
    firePointer(edge, "pointerup", 200, 24);
    expect(props.onUpdateEntry).toHaveBeenCalledWith("r1", { end: 25 });
  });

  it("enforces the minimum range when the end edge is dragged past the start", () => {
    const props = renderTimeline();
    const edge = rangeEdge(props.container as HTMLElement, "r1", "end");
    // End at 240px; drag far left (raw end 12.5 < start + 1).
    firePointer(edge, "pointerdown", 240, 24);
    firePointer(edge, "pointermove", 100, 24);
    firePointer(edge, "pointerup", 100, 24);
    expect(props.onUpdateEntry).toHaveBeenCalledWith("r1", { end: 21 });
  });

  it("clicking the ruler seeks (snapped)", () => {
    const props = renderTimeline();
    const ruler = props.container.querySelector(
      '[data-testid="keyframe-timeline-ruler"]',
    ) as HTMLElement;
    firePointer(ruler, "pointerdown", 200, 12);
    expect(props.onSeek).toHaveBeenCalledWith(25);
  });

  it("dragging the playhead handle seeks", () => {
    const props = renderTimeline();
    const handle = props.container.querySelector(
      '[data-testid="keyframe-timeline-playhead-handle"]',
    ) as HTMLElement;
    const capture = stubPointerCapture(handle);
    firePointer(handle, "pointerdown", 0, 7);
    // +25s: 200px.
    firePointer(handle, "pointermove", 200, 7);
    firePointer(handle, "pointerup", 200, 7);
    expect(capture.setPointerCapture).toHaveBeenCalled();
    expect(props.onSeek).toHaveBeenCalledWith(25);
  });

  it("playhead keyboard nudges by 1s (5s with shift)", () => {
    const props = renderTimeline();
    const handle = props.container.querySelector(
      '[data-testid="keyframe-timeline-playhead-handle"]',
    ) as HTMLElement;
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(props.onSeek).toHaveBeenCalledWith(1);
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    expect(props.onSeek).toHaveBeenCalledWith(5);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(props.onSeek).toHaveBeenCalledWith(0);
  });

  it("a selected keyframe nudges through onUpdateEntry (1s / 5s)", () => {
    const props = renderTimeline({ selectedId: "b1" });
    const kf = keyframeEl(props.container as HTMLElement, "b1");
    fireEvent.keyDown(kf, { key: "ArrowRight" });
    expect(props.onUpdateEntry).toHaveBeenCalledWith("b1", { timestamp: 11 });
    fireEvent.keyDown(kf, { key: "ArrowRight", shiftKey: true });
    expect(props.onUpdateEntry).toHaveBeenCalledWith("b1", { timestamp: 15 });
    fireEvent.keyDown(kf, { key: "ArrowLeft" });
    expect(props.onUpdateEntry).toHaveBeenCalledWith("b1", { timestamp: 9 });
  });

  it("a selected non-blocking keyframe nudges its whole range", () => {
    const props = renderTimeline({ selectedId: "r1" });
    const body = keyframeEl(props.container as HTMLElement, "r1");
    fireEvent.keyDown(body, { key: "ArrowRight" });
    expect(props.onUpdateEntry).toHaveBeenCalledWith("r1", {
      start: 21,
      end: 31,
    });
  });

  it("zoom buttons reposition keyframes", () => {
    const { container } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    expect(kf.style.left).toBe("64px");
    fireEvent.click(
      container.querySelector(
        '[data-testid="keyframe-timeline-zoom-in"]',
      ) as HTMLElement,
    );
    // zoom 8 → 12: left = 10*12 - 16.
    expect(kf.style.left).toBe("104px");
  });

  it("ctrl+wheel zooms via the non-passive listener", () => {
    const { container } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    const scroll = container.querySelector(
      '[data-testid="keyframe-timeline-scroll"]',
    ) as HTMLElement;
    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -100 });
    // zoom 8 → 9.6: left = 10*9.6 - 16 = 80.
    expect(kf.style.left).toBe("80px");
  });

  it("add buttons report the hook type to onAddEntry", () => {
    const props = renderTimeline();
    fireEvent.click(
      props.container.querySelector(
        '[data-testid="keyframe-timeline-add-blocking"]',
      ) as HTMLElement,
    );
    expect(props.onAddEntry).toHaveBeenCalledWith("blocking");
    fireEvent.click(
      props.container.querySelector(
        '[data-testid="keyframe-timeline-add-non-blocking"]',
      ) as HTMLElement,
    );
    expect(props.onAddEntry).toHaveBeenCalledWith("non-blocking");
  });

  it("add buttons are named by their label, with the hint as a tooltip", () => {
    const { getByRole } = renderTimeline();
    const blocking = getByRole("button", { name: "Blocking hook" });
    expect(blocking.getAttribute("title")).toBe(
      "Add a hook that pauses the video at the playhead",
    );
    expect(blocking.className).toContain("interlace-btn--secondary");
    const nonBlocking = getByRole("button", { name: "Non-blocking hook" });
    expect(nonBlocking.getAttribute("title")).toBe(
      "Add a hook that floats over the video from the playhead",
    );
  });

  it("zoom buttons are labelled icon buttons", () => {
    const { getByRole } = renderTimeline();
    expect(
      getByRole("button", { name: "Zoom timeline out" }).className,
    ).toContain("interlace-btn--icon");
    expect(
      getByRole("button", { name: "Zoom timeline in" }).className,
    ).toContain("interlace-btn--icon");
  });

  it("says where new hooks go and captions the zoom buttons", () => {
    const { getByTestId, getByText } = renderTimeline({ currentTime: 75 });
    expect(getByTestId("keyframe-timeline-add-at").textContent).toBe(
      "Adds at the playhead (1m 15s)",
    );
    expect(getByText("Zoom")).toBeInTheDocument();
  });

  it("the play button reports to onTogglePlay and reflects isPlaying", () => {
    const props = renderTimeline();
    const play = props.container.querySelector(
      '[data-testid="keyframe-timeline-play"]',
    ) as HTMLElement;
    expect(play.getAttribute("aria-label")).toBe("Play");
    fireEvent.click(play);
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);

    const { container } = renderTimeline({ isPlaying: true });
    const pause = container.querySelector(
      '[data-testid="keyframe-timeline-play"]',
    ) as HTMLElement;
    expect(pause.getAttribute("aria-label")).toBe("Pause");
  });

  it("renders no play button without onTogglePlay", () => {
    const { container } = renderTimeline({
      onTogglePlay: undefined,
      isPlaying: undefined,
    });
    expect(
      container.querySelector('[data-testid="keyframe-timeline-play"]'),
    ).toBeNull();
  });

  it("shows the empty state when there are no entries", () => {
    const { container } = renderTimeline({ entries: [] });
    expect(
      container.querySelector('[data-testid="keyframe-timeline-empty"]'),
    ).not.toBeNull();
  });

  it("positions the playhead at the current time", () => {
    const { container } = renderTimeline({ currentTime: 25 });
    const playhead = container.querySelector(
      '[data-testid="keyframe-timeline-playhead"]',
    ) as HTMLElement;
    expect(playhead.style.left).toBe("200px"); // 25 * 8
  });

  it("overlapping keyframes stack into lanes", () => {
    // Two blocking hooks at the same timestamp would render on top of
    // each other; the lane packing assigns them successive rows and
    // the track grows to fit.
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: "First", hookType: "blocking", timestamp: 10 },
      { id: "b2", title: "Second", hookType: "blocking", timestamp: 10 },
    ];
    const { container } = renderTimeline({ entries });
    const diamonds = container.querySelectorAll(
      '[data-testid="timeline-keyframe"]',
    );
    expect(diamonds.length).toBe(2);
    const firstTop = (diamonds[0] as HTMLElement).style.top;
    const secondTop = (diamonds[1] as HTMLElement).style.top;
    // Lane 0: top = 3 + 0*32 = 3; lane 1: top = 3 + 1*32 = 35.
    expect(firstTop).toBe("3px");
    expect(secondTop).toBe("35px");
    // The track grows with the lane count (2 lanes → 2*32 + 6 = 70).
    const track = container.querySelector(
      '[data-testid="keyframe-timeline-track"]',
    ) as HTMLElement;
    expect(track.style.height).toBe("70px");
  });

  it("a blocking keyframe overlapping a range stacks into a lane", () => {
    // The packer is type-generic: a diamond whose extent overlaps a
    // range bar claims the next lane, exactly as a range would.
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: "Quiz", hookType: "blocking", timestamp: 15 },
      { id: "r1", title: "Poll", hookType: "non-blocking", start: 10, end: 30 },
    ];
    const { container } = renderTimeline({ entries });
    const diamond = container.querySelector(
      '[data-testid="timeline-keyframe"]',
    ) as HTMLElement;
    const range = container.querySelector(
      '[data-testid="timeline-range"]',
    ) as HTMLElement;
    // The range ([10, 30]) takes lane 0; the diamond's extent (hit area
    // + label, starting at 15 - 16/8 = 13s) overlaps it → lane 1.
    expect(range.style.top).toBe("7px"); // 3 + 4px inset
    expect(diamond.style.top).toBe("35px");
  });

  it("non-overlapping keyframes share a lane", () => {
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: "First", hookType: "blocking", timestamp: 10 },
      { id: "b2", title: "Second", hookType: "blocking", timestamp: 30 },
    ];
    const { container } = renderTimeline({ entries });
    const diamonds = container.querySelectorAll(
      '[data-testid="timeline-keyframe"]',
    );
    const firstTop = (diamonds[0] as HTMLElement).style.top;
    const secondTop = (diamonds[1] as HTMLElement).style.top;
    // t=30 (extent starting at 28s) is after lane 0's occupied extent
    // (10 + (16 + 5*7 + 8)/8 ≈ 17.4s), so both fit in lane 0.
    expect(firstTop).toBe(secondTop);
  });

  it("clicking the track background calls onDeselect", () => {
    const onDeselect = vi.fn();
    const { container } = renderTimeline({ onDeselect });
    const track = container.querySelector(
      '[data-testid="keyframe-timeline-track"]',
    ) as HTMLElement;

    // A background click (target === the track) deselects.
    fireEvent.pointerDown(track);
    expect(onDeselect).toHaveBeenCalledTimes(1);

    // A pointer-down on a keyframe does not deselect (its own drag
    // handler wins, and the event targets the keyframe).
    const kf = keyframeEl(container, "b1");
    fireEvent.pointerDown(kf);
    expect(onDeselect).toHaveBeenCalledTimes(1);
  });

  it("default zoom fits the whole duration without horizontal overflow", () => {
    // A 100s video in a 480px viewport: the mount auto-fit sets zoom 4.8 so
    // the strip is exactly the viewport width (a non-fitted default of 8px/s
    // would render 800px and require horizontal panning).
    const { container, strip, scroll } = renderTimeline({
      videoDuration: 100,
    });
    expect(strip.style.width).toBe("480px");
    Object.defineProperty(scroll, "scrollWidth", {
      configurable: true,
      value: 480,
    });
    expect(scroll.scrollWidth <= scroll.clientWidth + 1).toBe(true);
    // The fitted ruler still renders ticks across the full duration
    // (interval 15s at zoom 4.8 → the 90s tick is present).
    expect(
      container.querySelector('[data-testid="keyframe-timeline-tick-90"]'),
    ).not.toBeNull();
  });

  it("wheel up zooms in and wheel down zooms out (plain wheel)", () => {
    const { container, scroll } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    expect(kf.style.left).toBe("64px"); // zoom 8 → 10*8 - 16
    fireEvent.wheel(scroll, { deltaY: -100 });
    // zoom 8 → 9.6: left = 10*9.6 - 16.
    expect(kf.style.left).toBe("80px");
    fireEvent.wheel(scroll, { deltaY: 100 });
    // zoom 9.6 → 8: back to the fitted zoom.
    expect(kf.style.left).toBe("64px");
  });

  it("puts the final tick's label inside the strip", () => {
    const { container } = renderTimeline();
    const ticks = [
      ...container.querySelectorAll<HTMLElement>(
        '[data-testid^="keyframe-timeline-tick-"]',
      ),
    ];
    const last = ticks[ticks.length - 1]!;
    expect(last.style.transform).toBe("translateX(-100%)");
    expect(last.textContent).not.toBe("");
    expect(ticks[0]!.style.transform).toBe("");
  });

  it("drops a final label that only nearly touches the previous one", () => {
    // 2m 16s fitted to a 640px timeline (zoom ≈ 4.7): 15s ticks, and the
    // "2m 15s" label lands just after "2m" (the case seen in the admin).
    stubClientWidth(640);
    const { container } = render(
      <KeyframeTimeline {...baseProps()} videoDuration={136} />,
    );
    const tick = (t: number) =>
      container.querySelector<HTMLElement>(
        `[data-testid="keyframe-timeline-tick-${t}"]`,
      )!;
    expect(tick(135).textContent).toBe("");
    expect(tick(120).textContent).toBe("2m");
  });

  it("drops the final tick's label when it would overlap the previous one", () => {
    // 2m 16s zoomed in to 10s ticks: the 2m 10s tick sits 6s before the
    // end, so its left-flipped label would run into "2m".
    const { container, scroll } = renderTimeline({ videoDuration: 136 });
    fireEvent.wheel(scroll, { deltaY: -100 });
    fireEvent.wheel(scroll, { deltaY: -100 });
    fireEvent.wheel(scroll, { deltaY: -100 });
    const tick = (t: number) =>
      container.querySelector<HTMLElement>(
        `[data-testid="keyframe-timeline-tick-${t}"]`,
      )!;
    expect(tick(130).style.transform).toBe("translateX(-100%)");
    expect(tick(130).textContent).toBe(""); // line kept, label dropped
    expect(tick(120).textContent).toBe("2m");
  });

  it("horizontal wheel pans instead of zooming", () => {
    const { container, scroll } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    scroll.scrollLeft = 0;
    fireEvent.wheel(scroll, { deltaX: 40, deltaY: 2 });
    expect(scroll.scrollLeft).toBe(40);
    expect(kf.style.left).toBe("64px"); // zoom unchanged
  });

  it("shift+wheel pans with a mouse wheel", () => {
    const { container, scroll } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    scroll.scrollLeft = 0;
    fireEvent.wheel(scroll, { deltaY: 30, shiftKey: true });
    expect(scroll.scrollLeft).toBe(30);
    expect(kf.style.left).toBe("64px");
  });

  it("small trackpad deltas zoom proportionally", () => {
    const { container, scroll } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    fireEvent.wheel(scroll, { deltaY: -50 });
    // zoom 8 * 1.2^0.5 ≈ 8.764: left = 10*8.764 - 16 ≈ 71.6.
    expect(parseFloat(kf.style.left)).toBeCloseTo(71.64, 1);
  });

  it("wheel zoom keeps the time under the pointer in place", () => {
    const { container, scroll } = renderTimeline();
    const strip = container.querySelector(
      '[data-testid="keyframe-timeline-strip"]',
    ) as HTMLElement;
    scroll.scrollLeft = 0;
    // The strip starts 50px from the viewport's left, shifted by scroll.
    strip.getBoundingClientRect = () =>
      ({ left: 50 - scroll.scrollLeft }) as DOMRect;
    // Pointer over t=10s at zoom 8 (x = 50 + 80).
    fireEvent.wheel(scroll, { deltaY: -100, clientX: 130 });
    // Zoom 9.6: t=10s is at 96px, so scroll by 16px to keep it at x=130.
    expect(scroll.scrollLeft).toBeCloseTo(16, 5);
  });

  it("lanes never compress: the track grows and scrolls vertically past the max", () => {
    const { scroll } = renderTimeline();
    expect(scroll.style.overflowX).toBe("auto");
    expect(scroll.style.overflowY).toBe("auto");
    // Ruler (24) + 4 visible lanes (4*32 + 6).
    expect(scroll.style.maxHeight).toBe("158px");

    // Five overlapping hooks stack into five full-height lanes.
    const entries: KeyframeTimelineEntry[] = [1, 2, 3, 4, 5].map((n) => ({
      id: `b${n}`,
      title: `Q${n}`,
      hookType: "blocking" as const,
      timestamp: 10,
    }));
    const { container } = renderTimeline({ entries });
    const track = container.querySelector(
      '[data-testid="keyframe-timeline-track"]',
    ) as HTMLElement;
    // 5*32 + 6 = 166 (taller than the scroll viewport → scrolls).
    expect(track.style.height).toBe("166px");
  });

  it("renders the keyframe label beside the diamond, truncated with the full title", () => {
    const longTitle =
      "A very long hook title that would never fit in the timeline lane";
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: longTitle, hookType: "blocking", timestamp: 10 },
    ];
    const { container } = renderTimeline({ entries });
    const kf = keyframeEl(container, "b1");
    const label = container.querySelector(
      '[data-testid="timeline-keyframe-label"][data-content-id="b1"]',
    ) as HTMLElement;
    // A sibling of the (hit-area) button, not inside the rotated diamond.
    expect(kf.contains(label)).toBe(false);
    expect(label.textContent).toBe(longTitle);
    expect(label.getAttribute("title")).toBe(longTitle);
    expect(label.style.maxWidth).toBe("140px");
    expect(label.style.textOverflow).toBe("ellipsis");
    expect(label.style.left).toBe("96px"); // 10*8 + 16
  });

  it("the blocking keyframe hit area is 32px around a 14px diamond", () => {
    const { container } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    expect(kf.style.width).toBe("32px");
    expect(kf.style.height).toBe("32px");
    const diamond = kf.querySelector(
      '[data-testid="timeline-keyframe-diamond"]',
    ) as HTMLElement;
    expect(diamond.style.width).toBe("14px");
  });

  it("range edges have 12px grab areas", () => {
    const { container } = renderTimeline();
    expect(rangeEdge(container, "r1", "start").style.width).toBe("12px");
    expect(rangeEdge(container, "r1", "end").style.width).toBe("12px");
  });

  it("near-coincident keyframes go to separate lanes so labels never overlap", () => {
    // 0.6s apart = 4.8px: diamonds alone would nearly coincide and the
    // labels would print over each other ("NewNew hookhook").
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: "New hook", hookType: "blocking", timestamp: 10 },
      { id: "b2", title: "New hook", hookType: "blocking", timestamp: 10.6 },
    ];
    const { container } = renderTimeline({ entries });
    expect(keyframeEl(container, "b1").style.top).toBe("3px");
    expect(keyframeEl(container, "b2").style.top).toBe("35px");
  });

  it("a keyframe whose label would reach a later hook pushes it to a new lane", () => {
    // Without the label in the packing these would share a lane: the
    // label (12 chars ≈ 84px ≈ 10.5s at 8px/s) runs past t=15.
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: "Mid-roll one", hookType: "blocking", timestamp: 10 },
      { id: "b2", title: "Two", hookType: "blocking", timestamp: 15 },
    ];
    const { container } = renderTimeline({ entries });
    expect(keyframeEl(container, "b1").style.top).not.toBe(
      keyframeEl(container, "b2").style.top,
    );
  });

  it("renders 'Untitled hook' for empty titles, in labels and aria-labels", () => {
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: "", hookType: "blocking", timestamp: 10 },
      { id: "r1", title: "  ", hookType: "non-blocking", start: 30, end: 40 },
    ];
    const { container } = renderTimeline({ entries });
    const kf = keyframeEl(container, "b1");
    expect(kf.getAttribute("aria-label")).toBe(
      "Untitled hook — blocking at 10s",
    );
    const label = container.querySelector(
      '[data-testid="timeline-keyframe-label"]',
    ) as HTMLElement;
    expect(label.textContent).toBe("Untitled hook");
    const body = keyframeEl(container, "r1");
    expect(body.getAttribute("aria-label")).toBe(
      "Untitled hook — non-blocking from 30s to 40s",
    );
    expect(body.textContent).toBe("Untitled hook");
  });

  it("the untitled label is overridable through strings", () => {
    const entries: KeyframeTimelineEntry[] = [
      { id: "b1", title: "", hookType: "blocking", timestamp: 10 },
    ];
    const { container } = renderTimeline({
      entries,
      strings: { untitledLabel: "Sans titre" },
    });
    expect(keyframeEl(container, "b1").getAttribute("aria-label")).toContain(
      "Sans titre",
    );
  });

  it("marks hooks that need attention with an indicator and aria-label suffix", () => {
    const entries: KeyframeTimelineEntry[] = [
      {
        id: "b1",
        title: "Quiz",
        hookType: "blocking",
        timestamp: 10,
        needsAttention: true,
      },
      {
        id: "r1",
        title: "Poll",
        hookType: "non-blocking",
        start: 20,
        end: 30,
        needsAttention: true,
        attentionLabel: "has no content",
      },
      { id: "b2", title: "Fine", hookType: "blocking", timestamp: 50 },
    ];
    const { container } = renderTimeline({ entries });
    const kf = keyframeEl(container, "b1");
    expect(
      kf.querySelector('[data-testid="timeline-attention"]'),
    ).not.toBeNull();
    expect(kf.getAttribute("aria-label")).toBe(
      "Quiz — blocking at 10s, needs attention",
    );
    const range = rangeEl(container, "r1");
    expect(
      range.querySelector('[data-testid="timeline-attention"]'),
    ).not.toBeNull();
    expect(keyframeEl(container, "r1").getAttribute("aria-label")).toBe(
      "Poll — non-blocking from 20s to 30s, has no content",
    );
    const fine = keyframeEl(container, "b2");
    expect(fine.querySelector('[data-testid="timeline-attention"]')).toBeNull();
    expect(fine.getAttribute("aria-label")).toBe("Fine — blocking at 50s");
  });

  it("a manual zoom locks the auto-fit: a duration change does not reset it", () => {
    const { container, rerender, props } = renderTimeline({
      videoDuration: 100,
    });
    const kf = keyframeEl(container, "b1");
    // Fit zoom 4.8 → keyframe at 10s: left = 10*4.8 - 16.
    expect(kf.style.left).toBe("32px");

    // Manual zoom in via the slider (4.8 → 7.2).
    fireEvent.click(
      container.querySelector(
        '[data-testid="keyframe-timeline-zoom-in"]',
      ) as HTMLElement,
    );
    const afterManual = kf.style.left; // 10*7.2 - 16 = 56
    expect(afterManual).toBe("56px");

    // The video reloads with a new duration: the auto-fit would reset the
    // zoom to 480/120 = 4, but the userZoomed lock keeps the manual zoom.
    rerender(<KeyframeTimeline {...props} videoDuration={120} />);
    expect(kf.style.left).toBe(afterManual);
  });
});
