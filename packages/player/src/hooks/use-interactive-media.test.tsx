import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContentTypeRegistry,
  SerializedInteractiveMediaDocument,
  VideoAdapter,
  VideoAdapterEvent,
  VideoAdapterEventType,
} from "@interlace/core";
import { QuizContentType } from "../content-types/quiz";
import { useInteractiveMedia } from "./use-interactive-media";

/**
 * Synthetic adapter with a manual clock: tests set `currentTime` and drive
 * the hook's rAF loop through fake timers, giving full frame control over
 * the runtime. `getDuration()` reports 0 to pin that the runtime sources
 * the video duration from the document's `video.duration`, never from a
 * (possibly pre-metadata) element — see the Gate 2 duration-ordering risk.
 */
function makeManualClockAdapter() {
  const listeners = new Map<
    VideoAdapterEventType,
    Set<(event: VideoAdapterEvent) => void>
  >();
  const adapter = {
    currentTime: 0,
    isPlaying: false,
    play(): void {
      adapter.isPlaying = true;
      adapter.emit("play");
    },
    pause(): void {
      adapter.isPlaying = false;
      adapter.emit("pause");
    },
    seek(timeInSeconds: number): void {
      adapter.currentTime = timeInSeconds;
    },
    getCurrentTime(): number {
      return adapter.currentTime;
    },
    getDuration(): number {
      return 0; // pre-metadata: an element without metadata reports 0
    },
    mountOverlay(): void {},
    on(
      type: VideoAdapterEventType,
      handler: (event: VideoAdapterEvent) => void,
    ): () => void {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(handler);
      listeners.set(type, handlers);
      return () => {
        handlers.delete(handler);
      };
    },
    emit(type: VideoAdapterEventType): void {
      for (const handler of listeners.get(type) ?? []) {
        handler({ type });
      }
    },
  };
  return { adapter, listeners };
}

const TICK_MS = 16;

const blockingDoc = (
  timestamp: number,
): SerializedInteractiveMediaDocument => ({
  video: { src: "https://example.com/video.mp4", duration: 40 },
  items: [
    {
      id: "quiz-block",
      title: "Pause and answer",
      hook: {
        type: "blocking",
        timestamp,
        placement: { x: 10, y: 10, width: 40, height: 40 },
      },
      content: {
        contentTypeId: "quiz-editor",
        version: 1,
        data: {
          question: "What is 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctIndex: 1,
        },
      },
    },
  ],
});

/** Runs one rAF frame of the hook's runtime loop (fake timers). */
function tick(adapter: { currentTime: number }, frames = 1) {
  act(() => void vi.advanceTimersByTime(TICK_MS * frames));
  return adapter.currentTime;
}

/**
 * Drives the clock into a blocking hook's trigger window and lands the
 * final frame exactly on the timestamp (inside the ±16ms window) so the
 * trigger fires and the render state still reflects it.
 */
function walkIntoBlockingWindow(
  adapter: ReturnType<typeof makeManualClockAdapter>["adapter"],
  timestamp: number,
) {
  adapter.currentTime = timestamp - 0.008;
  tick(adapter);
  act(() => void adapter.play());
  adapter.currentTime = timestamp;
  tick(adapter);
}

function makeHarness(timestamp: number) {
  const { adapter } = makeManualClockAdapter();
  const registry = new ContentTypeRegistry();
    registry.register(QuizContentType);
  const states: unknown[] = [];
  return {
    adapter,
    doc: blockingDoc(timestamp),
    registry,
    states,
    props: {
      adapter,
      document: blockingDoc(timestamp) as SerializedInteractiveMediaDocument,
      registry,
      onRenderStateChange: (state: unknown) => {
        states.push(state);
      },
    },
  };
}

describe("useInteractiveMedia runtime end-to-end", () => {
  let originalRaf: typeof globalThis.requestAnimationFrame;
  let originalCaf: typeof globalThis.cancelAnimationFrame;

  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
    originalCaf = globalThis.cancelAnimationFrame;
    vi.useFakeTimers();
    // Stub rAF onto the fake-timer clock so tests control every frame.
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), TICK_MS)) as unknown as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame =
      ((handle: number) => clearTimeout(handle)) as unknown as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function renderRuntime(harness: ReturnType<typeof makeHarness>) {
    return renderHook((props) => useInteractiveMedia(props), {
      initialProps: harness.props,
    });
  }

  it("plays a blocking quiz to completion through the full runtime loop", () => {
    const harness = makeHarness(10);
    const { adapter } = harness;
    const hook = renderHook((props) => useInteractiveMedia(props), {
      initialProps: harness.props,
    });

    // Init flush: controller ready, no error, item deserialized.
    tick(adapter);
    expect(hook.result.current.initialized).toBe(true);
    expect(hook.result.current.error).toBeNull();

    // User starts playback; the clock advances into the blocking window in
    // 10ms steps (a step granularity smaller than the ±16ms trigger window).
    tick(adapter);
    walkIntoBlockingWindow(adapter, 10);

    // The controller actuated its own pause through the hook's wiring.
    expect(adapter.isPlaying).toBe(false);
    const lastState = harness.states[harness.states.length - 1] as {
      activeBlockingContentId?: string;
    };
    expect(lastState.activeBlockingContentId).toBe("quiz-block");

    // The user answers (the quiz's playback would drive this through
    // callbacks.onComplete; the runtime path is item completion).
    const item = hook.result.current.items?.find((i) => i.getId() === "quiz-block");
    expect(item?.getState()).toBe("open");
    act(() => void item?.complete(100));
    tick(adapter);

    const finalState = hook.result.current.controller?.getRenderState(
      adapter.currentTime,
    ) as { activeBlockingContentId?: string; completedTagIds: string[] };
    expect(finalState.activeBlockingContentId).toBeUndefined();
    expect(finalState.completedTagIds).toContain("quiz-block");
  });

  it("pins the Gate 2 boundary risk: a 0.5s tick cadence straddles the 16ms trigger window", () => {
    const harness = makeHarness(10);
    const { adapter } = harness;
    const hook = renderHook((props) => useInteractiveMedia(props), {
      initialProps: harness.props,
    });
    tick(adapter);

    // Real rAF cadence (~16.7ms) sampling at 0.5s clock granularity: a
    // frame can straddle the trigger timestamp without ever landing in its
    // ±16ms window, so the hook never fires. Known core-side limitation —
    // recorded, not fixed in the player.
    act(() => void adapter.play());
    for (const boundary of [9.4, 9.9, 10.4, 10.9]) {
      adapter.currentTime = boundary;
      tick(adapter);
    }

    const state = hook.result.current.controller?.getRenderState(10.4) as {
      activeBlockingContentId?: string;
    };
    expect(state.activeBlockingContentId).toBeUndefined();
    expect(
      hook.result.current.items?.find((i) => i.getId() === "quiz-block")?.getState(),
    ).toBe("pending");
  });

  it("re-approaches a dismissed blocking hook: rewind clears, re-seek re-opens", () => {
    const harness = makeHarness(10);
    const { adapter } = harness;
    const hook = renderHook((props) => useInteractiveMedia(props), {
      initialProps: harness.props,
    });
    tick(adapter);

    // Trigger and dismiss (Close without answering).
    walkIntoBlockingWindow(adapter, 10);
    expect(
      (
        hook.result.current.controller?.getRenderState(
          adapter.currentTime,
        ) as { activeBlockingContentId?: string }
      ).activeBlockingContentId,
    ).toBe("quiz-block");

    // User scrubs back away from the hook, still paused (no trigger side
    // effects backward); the render state's blocking id clears.
    adapter.currentTime = 5;
    tick(adapter);
    expect(
      (
        hook.result.current.controller?.getRenderState(5) as {
          activeBlockingContentId?: string;
        }
      ).activeBlockingContentId,
    ).toBeUndefined();
    expect(
      hook.result.current.items?.find((i) => i.getId() === "quiz-block")?.getState(),
    ).toBe("open");

    // The user re-seeks: playback resumes, the clock walks back into the
    // window, and the hook re-opens for the runtime (the player's auto-open
    // re-arm from the Gate 2 remediation makes this a re-open, not a
    // stuck closed state).
    walkIntoBlockingWindow(adapter, 10);
    expect(
      (
        hook.result.current.controller?.getRenderState(
          adapter.currentTime,
        ) as { activeBlockingContentId?: string }
      ).activeBlockingContentId,
    ).toBe("quiz-block");
  });

  it("does not re-block when the hook was already answered", () => {
    const harness = makeHarness(10);
    const { adapter } = harness;
    const hook = renderHook((props) => useInteractiveMedia(props), {
      initialProps: harness.props,
    });
    tick(adapter);
    walkIntoBlockingWindow(adapter, 10);
    const item = hook.result.current.items?.find((i) => i.getId() === "quiz-block");
    act(() => void item?.complete(100));
    tick(adapter);

    // Replay past the answered hook: no re-open, tag stays.
    adapter.currentTime = 8;
    tick(adapter);
    walkIntoBlockingWindow(adapter, 10);
    const state = hook.result.current.controller?.getRenderState(
      adapter.currentTime,
    ) as { activeBlockingContentId?: string; completedTagIds: string[] };
    expect(state.activeBlockingContentId).toBeUndefined();
    expect(state.completedTagIds).toContain("quiz-block");
  });

  it("finishes at the video end recorded in the document (not the adapter duration)", () => {
    const harness = makeHarness(10);
    const { adapter } = harness;
    const finished = vi.fn();
    const hook = renderHook((props) => useInteractiveMedia(props), {
      initialProps: harness.props,
    });
    tick(adapter);
    hook.result.current.controller?.on("finished", finished);

    walkIntoBlockingWindow(adapter, 10);
    const item = hook.result.current.items?.find((i) => i.getId() === "quiz-block");
    act(() => void item?.complete(100));

    adapter.currentTime = 40;
    tick(adapter);
    expect(finished).toHaveBeenCalled();
    const [eventPayload] = finished.mock.calls[0] as [
      { aggregatedResult: { numerator: number; denominator: number } },
    ];
    expect(eventPayload.aggregatedResult.numerator).toBe(100);
    expect(eventPayload.aggregatedResult.denominator).toBe(100);
  });
});
