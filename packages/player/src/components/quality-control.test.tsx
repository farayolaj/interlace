import {
  ContentTypeRegistry,
  type QualityLevel,
  type SerializedInteractiveMediaDocument,
  type VideoAdapterEvent,
  type VideoAdapterEventType,
} from "@interlacejs/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizContentType } from "../content-types/quiz";
import { InteractiveVideoPlayer } from "./interactive-video-player";
import {
  QUALITY_CONTROL_HIDE_DELAY_MS,
  QualityControl,
} from "./quality-control";

const LEVELS: QualityLevel[] = [
  { id: 2, height: 1080, label: "1080p" },
  { id: 1, height: 480, label: "480p" },
  { id: 0, height: 240, label: "240p" },
];

/** Manual-clock adapter implementing the quality capability. */
function makeQualityAdapter(levels: QualityLevel[] = LEVELS) {
  const listeners = new Map<
    VideoAdapterEventType,
    Set<(event: VideoAdapterEvent) => void>
  >();
  const adapter = {
    currentTime: 0,
    /** Opt-in: advance the clock while "playing" (auto-hide tests). */
    autoAdvance: false,
    /** Whether the fake clock advances (like a playing video). */
    running: false,
    levels,
    selected: -1,
    active: null as number | null,
    play: vi.fn(() => adapter.emit("play")),
    pause: vi.fn(() => adapter.emit("pause")),
    seek(time: number) {
      adapter.currentTime = time;
      adapter.emit("programmaticSeek");
    },
    getCurrentTime: () => {
      if (adapter.running) adapter.currentTime += 0.25;
      return adapter.currentTime;
    },
    getDuration: () => 40,
    mountOverlay() {},
    getQualityLevels: () => adapter.levels,
    getQualityLevel: () => adapter.selected,
    getActiveQualityLevel: () => adapter.active,
    setQualityLevel: vi.fn((id: number) => {
      adapter.selected = id;
      adapter.emit("qualitychange");
    }),
    on(type: VideoAdapterEventType, handler: (e: VideoAdapterEvent) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(handler);
      listeners.set(type, set);
      return () => {
        set.delete(handler);
      };
    },
    emit(type: VideoAdapterEventType) {
      if (type === "play") adapter.running = adapter.autoAdvance;
      if (type === "pause") adapter.running = false;
      act(() => {
        listeners.get(type)?.forEach((handler) => handler({ type }));
      });
    },
  };
  return adapter;
}

const button = () => screen.getByRole("button", { name: /^Quality:/ });
const frame = () => screen.getByTestId("interlace-quality-control");
const items = () => screen.getAllByRole("menuitemradio");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("QualityControl", () => {
  it("renders nothing with fewer than two levels", () => {
    const adapter = makeQualityAdapter([LEVELS[0]!]);
    render(<QualityControl adapter={adapter} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("appears once levels arrive through qualitychange", () => {
    const adapter = makeQualityAdapter([]);
    render(<QualityControl adapter={adapter} />);
    expect(screen.queryByRole("button")).toBeNull();

    adapter.levels = LEVELS;
    adapter.emit("qualitychange");
    expect(button()).toBeInTheDocument();
  });

  it("names the button after the current selection", () => {
    const adapter = makeQualityAdapter();
    render(<QualityControl adapter={adapter} />);
    expect(button()).toHaveAccessibleName("Quality: Auto");
    expect(button()).toHaveAttribute("aria-haspopup", "menu");
    expect(button()).toHaveAttribute("aria-expanded", "false");

    adapter.active = 1;
    adapter.emit("qualitychange");
    expect(button()).toHaveAccessibleName("Quality: Auto (480p)");

    adapter.selected = 2;
    adapter.emit("qualitychange");
    expect(button()).toHaveAccessibleName("Quality: 1080p");
  });

  it("lists Auto, then levels high to low with a data saver label", () => {
    const adapter = makeQualityAdapter();
    adapter.active = 1;
    render(<QualityControl adapter={adapter} />);
    fireEvent.click(button());

    expect(screen.getByRole("menu", { name: "Quality" })).toBeInTheDocument();
    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(items().map((item) => item.textContent)).toEqual([
      "Auto · 480p",
      "1080p",
      "480p",
      "Data saver · 240p",
    ]);
    expect(items()[0]).toHaveAttribute("aria-checked", "true");
    expect(items()[1]).toHaveAttribute("aria-checked", "false");
  });

  it("sorts levels high to low even if the adapter does not", () => {
    const adapter = makeQualityAdapter([...LEVELS].reverse());
    render(<QualityControl adapter={adapter} />);
    fireEvent.click(button());
    expect(items().map((item) => item.textContent)).toEqual([
      "Auto",
      "1080p",
      "480p",
      "Data saver · 240p",
    ]);
  });

  it("selects a level, closes the menu and returns focus", () => {
    const adapter = makeQualityAdapter();
    render(<QualityControl adapter={adapter} />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "480p" }));

    expect(adapter.setQualityLevel).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button()).toHaveFocus();
    expect(button()).toHaveAccessibleName("Quality: 480p");

    fireEvent.click(button());
    expect(screen.getByRole("menuitemradio", { name: "480p" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("supports keyboard navigation", () => {
    const adapter = makeQualityAdapter();
    adapter.selected = 1;
    render(<QualityControl adapter={adapter} />);

    fireEvent.keyDown(button(), { key: "ArrowDown" });
    // Focus starts on the selected item.
    expect(screen.getByRole("menuitemradio", { name: "480p" })).toHaveFocus();

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items()[3]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items()[0]).toHaveFocus(); // wraps
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(items()[3]).toHaveFocus(); // wraps back
    fireEvent.keyDown(menu, { key: "Home" });
    expect(items()[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(items()[3]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowUp" });

    fireEvent.keyDown(menu, { key: "Enter" });
    expect(adapter.setQualityLevel).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button()).toHaveFocus();

    fireEvent.keyDown(button(), { key: "ArrowUp" });
    expect(items()[3]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: " " });
    expect(adapter.setQualityLevel).toHaveBeenLastCalledWith(0);
  });

  it("closes on Escape and returns focus to the button", () => {
    render(<QualityControl adapter={makeQualityAdapter()} />);
    fireEvent.click(button());
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button()).toHaveFocus();
  });

  it("closes on an outside click", () => {
    render(<QualityControl adapter={makeQualityAdapter()} />);
    fireEvent.click(button());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("accepts string overrides", () => {
    render(
      <QualityControl
        adapter={makeQualityAdapter()}
        strings={{
          qualityLabel: "Qualité",
          qualityAutoLabel: "Auto (adaptative)",
          qualityDataSaverLabel: "Économie",
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Qualité: Auto (adaptative)" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(items()[3]).toHaveTextContent("Économie · 240p");
  });

  it("only takes pointer events on the control itself", () => {
    render(<QualityControl adapter={makeQualityAdapter()} />);
    expect(frame()).toHaveStyle({ pointerEvents: "none" });
    expect(button()).toHaveStyle({ pointerEvents: "auto" });
  });

  describe("auto-hide", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    const renderInFrame = () => {
      const adapter = makeQualityAdapter();
      adapter.autoAdvance = true;
      render(<QualityControl adapter={adapter} />);
      vi.spyOn(frame(), "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        right: 640,
        bottom: 360,
        width: 640,
        height: 360,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      return adapter;
    };

    const elapse = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

    it("fades for playback the adapter didn't announce (e.g. resume after a quiz)", () => {
      const adapter = renderInFrame();
      // Adapters suppress play events for their own play() calls.
      adapter.running = true;
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS + 1000);
      expect(frame()).toHaveAttribute("data-visible", "false");

      adapter.running = false;
      elapse(1000);
      expect(frame()).toHaveAttribute("data-visible", "true");
    });

    it("stays visible while paused", () => {
      renderInFrame();
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS * 2);
      expect(frame()).toHaveAttribute("data-visible", "true");
    });

    it("fades out while playing and back in on pointer movement over the video", () => {
      const adapter = renderInFrame();
      adapter.emit("play");
      expect(frame()).toHaveAttribute("data-visible", "true");

      elapse(QUALITY_CONTROL_HIDE_DELAY_MS);
      expect(frame()).toHaveAttribute("data-visible", "false");
      expect(frame()).toHaveStyle({ opacity: "0" });
      expect(button()).toHaveStyle({ pointerEvents: "none" });

      // Movement outside the video frame does not reveal it.
      fireEvent.mouseMove(document, { clientX: 900, clientY: 500 });
      expect(frame()).toHaveAttribute("data-visible", "false");

      fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
      expect(frame()).toHaveAttribute("data-visible", "true");

      // Continued movement restarts the idle timer.
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS - 500);
      fireEvent.mouseMove(document, { clientX: 120, clientY: 100 });
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS - 500);
      expect(frame()).toHaveAttribute("data-visible", "true");
      elapse(500);
      expect(frame()).toHaveAttribute("data-visible", "false");
    });

    it("reveals on touch", () => {
      const adapter = renderInFrame();
      adapter.emit("play");
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS);
      fireEvent.touchStart(document, {
        touches: [{ clientX: 10, clientY: 10 }],
      });
      expect(frame()).toHaveAttribute("data-visible", "true");
    });

    it("shows again when paused", () => {
      const adapter = renderInFrame();
      adapter.emit("play");
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS);
      adapter.emit("pause");
      expect(frame()).toHaveAttribute("data-visible", "true");
    });

    it("stays visible while focused or while the menu is open", () => {
      const adapter = renderInFrame();
      adapter.emit("play");
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS);

      act(() => button().focus());
      expect(frame()).toHaveAttribute("data-visible", "true");
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS * 2);
      expect(frame()).toHaveAttribute("data-visible", "true");

      fireEvent.click(button());
      elapse(QUALITY_CONTROL_HIDE_DELAY_MS * 2);
      expect(frame()).toHaveAttribute("data-visible", "true");

      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
      act(() => button().blur());
      expect(frame()).toHaveAttribute("data-visible", "false");
    });

    it("does not stay pinned by focus left after a mouse selection", () => {
      const adapter = renderInFrame();
      adapter.emit("play");
      const original = Element.prototype.matches;
      const spy = vi
        .spyOn(Element.prototype, "matches")
        .mockImplementation(function (this: Element, selector: string) {
          return selector === ":focus-visible"
            ? false
            : original.call(this, selector);
        });
      try {
        act(() => button().focus());
        elapse(QUALITY_CONTROL_HIDE_DELAY_MS);
        expect(frame()).toHaveAttribute("data-visible", "false");
      } finally {
        spy.mockRestore();
      }
    });
  });
});

describe("InteractiveVideoPlayer quality control", () => {
  const TICK_MS = 16;
  let originalRaf: typeof globalThis.requestAnimationFrame;
  let originalCaf: typeof globalThis.cancelAnimationFrame;

  const doc: SerializedInteractiveMediaDocument = {
    video: { src: "https://example.com/master.m3u8", duration: 40 },
    items: [
      {
        id: "quiz-block",
        title: "Pause and answer",
        hook: {
          type: "blocking",
          timestamp: 10,
          placement: { x: 10, y: 10, width: 40, height: 40 },
        },
        content: {
          contentTypeId: "quiz-editor",
          version: 1,
          data: {
            questions: [
              {
                id: "q-0",
                text: "What is 2 + 2?",
                options: [
                  { id: "opt-0", text: "3" },
                  { id: "opt-1", text: "4" },
                ],
                correctOptionId: "opt-1",
              },
            ],
          },
        },
      },
    ],
  };

  const registry = new ContentTypeRegistry();
  registry.register(QuizContentType);

  const tick = (frames = 1) =>
    act(() => void vi.advanceTimersByTime(TICK_MS * frames));

  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
    originalCaf = globalThis.cancelAnimationFrame;
    vi.useFakeTimers();
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        TICK_MS,
      )) as unknown as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) =>
      clearTimeout(
        handle,
      )) as unknown as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
  });

  it("renders the control for a quality-capable adapter", () => {
    render(
      <InteractiveVideoPlayer
        adapter={makeQualityAdapter()}
        document={doc}
        registry={registry}
      />,
    );
    tick();
    expect(button()).toBeInTheDocument();
  });

  it("does not render for adapters without the quality capability", () => {
    const quality = makeQualityAdapter();
    const plain = {
      play: quality.play,
      pause: quality.pause,
      seek: quality.seek,
      getCurrentTime: quality.getCurrentTime,
      getDuration: quality.getDuration,
      mountOverlay: quality.mountOverlay,
      on: quality.on,
    };
    render(
      <InteractiveVideoPlayer
        adapter={plain}
        document={doc}
        registry={registry}
      />,
    );
    tick();
    expect(screen.queryByRole("button", { name: /^Quality/ })).toBeNull();
  });

  it("can be turned off with showQualityControl={false}", () => {
    render(
      <InteractiveVideoPlayer
        adapter={makeQualityAdapter()}
        document={doc}
        registry={registry}
        showQualityControl={false}
      />,
    );
    tick();
    expect(screen.queryByRole("button", { name: /^Quality/ })).toBeNull();
  });

  it("passes string overrides through", () => {
    render(
      <InteractiveVideoPlayer
        adapter={makeQualityAdapter()}
        document={doc}
        registry={registry}
        strings={{ qualityLabel: "Qualität" }}
      />,
    );
    tick();
    expect(
      screen.getByRole("button", { name: "Qualität: Auto" }),
    ).toBeInTheDocument();
  });

  it("is hidden while a blocking overlay is open", () => {
    const adapter = makeQualityAdapter();
    render(
      <InteractiveVideoPlayer
        adapter={adapter}
        document={doc}
        registry={registry}
      />,
    );
    tick();
    expect(button()).toBeInTheDocument();

    adapter.currentTime = 9.992;
    tick();
    adapter.play();
    adapter.currentTime = 10;
    tick();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Quality/ })).toBeNull();
  });
});
