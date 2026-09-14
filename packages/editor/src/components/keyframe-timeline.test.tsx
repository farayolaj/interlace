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
  vi.restoreAllMocks();
});

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
  const utils = render(<KeyframeTimeline {...props} />);
  const strip = utils.container.querySelector(
    '[data-testid="keyframe-timeline-strip"]',
  ) as HTMLDivElement;
  const restore = stubRect(strip, { width: DURATION * ZOOM, height: 72 });
  return { ...props, ...utils, strip, restore };
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
    // left = timestamp * zoom - half diamond (10*8 - 7).
    expect(kf.style.left).toBe("73px");
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
    expect(kf.style.left).toBe("73px");
    fireEvent.click(
      container.querySelector(
        '[data-testid="keyframe-timeline-zoom-in"]',
      ) as HTMLElement,
    );
    // zoom 8 → 12: left = 10*12 - 7.
    expect(kf.style.left).toBe("113px");
  });

  it("ctrl+wheel zooms via the non-passive listener", () => {
    const { container } = renderTimeline();
    const kf = keyframeEl(container, "b1");
    const scroll = container.querySelector(
      '[data-testid="keyframe-timeline-scroll"]',
    ) as HTMLElement;
    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -100 });
    // zoom 8 → 9.6: left = 10*9.6 - 7 = 89.
    expect(kf.style.left).toBe("89px");
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

  it("the play button reports to onTogglePlay and reflects isPlaying", () => {
    const props = renderTimeline();
    const play = props.container.querySelector(
      '[data-testid="keyframe-timeline-play"]',
    ) as HTMLElement;
    expect(play.textContent).toBe("Play");
    fireEvent.click(play);
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);

    const { container } = renderTimeline({ isPlaying: true });
    const pause = container.querySelector(
      '[data-testid="keyframe-timeline-play"]',
    ) as HTMLElement;
    expect(pause.textContent).toBe("Pause");
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
    // Lane 0: top = 3 + 0*28 + 5 = 8; lane 1: top = 3 + 1*28 + 5 = 36.
    expect(firstTop).toBe("8px");
    expect(secondTop).toBe("36px");
    // The track grows with the lane count (2 lanes → 2*28 + 6 = 62).
    const track = container.querySelector(
      '[data-testid="keyframe-timeline-track"]',
    ) as HTMLElement;
    expect(track.style.height).toBe("62px");
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
    // The range (anchor 10) takes lane 0; the diamond (anchor 15,
    // extent 14/8 = 1.75s → [15, 16.75]) overlaps [10, 30] → lane 1.
    expect(range.style.top).toBe("3px");
    expect(diamond.style.top).toBe("36px");
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
    // t=30 is after lane 0's occupied extent (10 + 14/8 = 11.75s), so
    // both fit in lane 0.
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
});
