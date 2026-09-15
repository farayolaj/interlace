import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentInstance, type ContentRecord, type ContentState } from "@interlace/core";
import { BlockingOverlay } from "./blocking-overlay";
import type { ContentType } from "@interlace/core";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface DemoData {
  question: string;
}

function makeContentType() {
  const renderPlayback = vi.fn(
    (
      container: HTMLElement,
      data: DemoData,
      callbacks: { onComplete(score?: number): void },
    ) => {
      const question = document.createElement("p");
      question.className = "demo-question";
      question.textContent = data.question;
      container.appendChild(question);

      const button = document.createElement("button");
      button.className = "demo-answer";
      button.textContent = "Answer";
      button.addEventListener("click", () => callbacks.onComplete(100));
      container.appendChild(button);
    },
  );
  const unmountPlayback = vi.fn();
  const contentType: ContentType<DemoData> = {
    getId: () => "demo",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback,
    unmountPlayback,
  };
  return { contentType, renderPlayback, unmountPlayback };
}

function makeContent(
  data: DemoData,
  contentType: ContentType<DemoData> = makeContentType().contentType,
): ContentInstance<DemoData> {
  const record: ContentRecord<DemoData> = {
    id: "blocking-1",
    title: "Pause and answer",
    contentTypeId: "demo",
    data,
    state: "open" as ContentState,
    hook: {
      type: "blocking",
      timestamp: 10,
      placement: { x: 10, y: 10, width: 20, height: 10 },
    },
  };
  return new ContentInstance(record, contentType);
}

function renderOverlay(data: DemoData = { question: "What is 2 + 2?" }) {
  const { contentType, renderPlayback, unmountPlayback } = makeContentType();
  const content = makeContent(data, contentType);
  const onClose = vi.fn();
  const onContentComplete = vi.fn();
  const utils = render(
    <BlockingOverlay
      content={content}
      contentType={contentType}
      onClose={onClose}
      onContentComplete={onContentComplete}
    />,
  );
  const overlay = utils.container.querySelector(
    '[role="dialog"]',
  ) as HTMLElement;
  return {
    contentType,
    renderPlayback,
    unmountPlayback,
    content,
    onClose,
    onContentComplete,
    overlay,
    ...utils,
  };
}

describe("BlockingOverlay", () => {
  it("mounts the content type's playback into the overlay body", () => {
    const { renderPlayback, content } = renderOverlay();
    expect(screen.getByText("What is 2 + 2?")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(renderPlayback).toHaveBeenCalledTimes(1);
    expect(renderPlayback).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      content.getData(),
      expect.objectContaining({ onComplete: expect.any(Function) }),
    );
  });

  it("content completion flows through onContentComplete with the score", () => {
    const { onContentComplete } = renderOverlay();
    fireEvent.click(screen.getByText("Answer"));
    expect(onContentComplete).toHaveBeenCalledTimes(1);
    expect(onContentComplete).toHaveBeenCalledWith(100);
  });

  it("unmount tears down the playback session with the same container element", async () => {
    const { renderPlayback, unmountPlayback, unmount } = renderOverlay();
    const mountedContainer = renderPlayback.mock.calls[0]?.[0] as HTMLElement;

    unmount();

    await waitFor(() => {
      expect(unmountPlayback).toHaveBeenCalled();
    });
    expect(unmountPlayback.mock.calls[0]?.[0]).toBe(mountedContainer);
  });

  it("render failures surface through the body without crashing", () => {
    const contentType: ContentType<DemoData> = {
      getId: () => "demo",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {
        throw new Error("boom");
      },
    };
    const record: ContentRecord<DemoData> = {
      id: "blocking-1",
      title: "Pause and answer",
      contentTypeId: "demo",
      data: { question: "What is 2 + 2?" },
      state: "open" as ContentState,
      hook: {
        type: "blocking",
        timestamp: 10,
        placement: { x: 10, y: 10, width: 20, height: 10 },
      },
    };
    const content = new ContentInstance(record, contentType);

    render(
      <BlockingOverlay
        content={content}
        contentType={contentType}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it("the overlay is interactive for content inside pointer-events-none ancestors", () => {
    const { overlay } = renderOverlay();
    // The editor's preview modal mounts the player inside a
    // `pointerEvents: "none"` container; the overlay must re-enable
    // pointer events explicitly.
    expect(overlay.style.pointerEvents).toBe("auto");
  });

  it("does not render a dismiss control (blocking content cannot be dismissed)", () => {
    const { overlay, onClose } = renderOverlay();
    // No Close / Continue / Dismiss affordance: the only interactive
    // elements in the dialog are the content's own.
    expect(
      screen.queryByRole("button", { name: /close/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dismiss/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Answer" })).toBeInTheDocument();
    expect(overlay).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("completing mode renders the completion surface with the score", () => {
    const { contentType } = makeContentType();
    const content = makeContent({ question: "What is 2 + 2?" }, contentType);
    const renderPlayback = vi.fn();
    const completingType: ContentType<DemoData> = {
      getId: () => "demo",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback,
    };

    render(
      <BlockingOverlay
        content={content}
        contentType={completingType}
        onClose={vi.fn()}
        completing
        completingScore={100}
      />,
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("completing mode does not require (or mount) the content body", () => {
    const { contentType, renderPlayback } = makeContentType();
    const content = makeContent({ question: "What is 2 + 2?" }, contentType);

    render(
      <BlockingOverlay
        content={content}
        contentType={contentType}
        onClose={vi.fn()}
        completing
        completingScore={100}
      />,
    );

    expect(renderPlayback).not.toHaveBeenCalled();
    expect(screen.queryByText("What is 2 + 2?")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Answer" }),
    ).not.toBeInTheDocument();
  });
});
