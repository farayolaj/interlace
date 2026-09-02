import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { ContentTypeRegistry } from "@interlace/core";
import type { SerializedInteractiveMediaDocument } from "@interlace/core";
import { QuizEditor } from "../content-types/quiz-editor";
import { InteractiveMediaAuthoring } from "./interactive-media-authoring";

afterEach(() => {
  cleanup();
});

const VIDEO_SRC = "https://example.com/video.mp4";
const VIDEO_DURATION = 60;

function makeQuizDocument(): SerializedInteractiveMediaDocument {
  return {
    video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
    items: [
      {
        id: "c1",
        title: "Quiz 1",
        hook: {
          type: "blocking",
          timestamp: 10,
          placement: { x: 50, y: 50, width: 20, height: 20 },
        },
        content: {
          contentTypeId: "quiz",
          version: 1,
          data: { question: "Q1", options: ["a", "b"], correctIndex: 0 },
        },
      },
    ],
  };
}

/**
 * Builds a tracked quiz content type whose editor renders a single text
 * input bound to `data.question`. Used to assert the slot's render/update
 * lifecycle without depending on QuizEditor's DOM.
 */
function makeTrackedQuizType() {
  const renderForm = (
    container: HTMLElement,
    data: unknown,
    onChange: (next: unknown) => void,
  ) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "quiz-question";
    input.value = (data as { question: string }).question ?? "";
    input.addEventListener("input", () => {
      onChange({ ...(data as object), question: input.value });
    });
    container.appendChild(input);
  };

  const renderEditor = vi.fn(
    (container: HTMLElement, data: unknown, onChange: (next: unknown) => void) => {
      renderForm(container, data, onChange);
    },
  );
  const updateEditor = vi.fn(
    (container: HTMLElement, data: unknown, onChange: (next: unknown) => void) => {
      container.innerHTML = "";
      renderForm(container, data, onChange);
    },
  );
  const unmount = vi.fn();

  const contentType = {
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor,
    updateEditor,
    unmount,
    renderPlayback: () => {},
  };

  return { contentType, renderEditor, updateEditor, unmount };
}

function makeRegistry() {
  const registry = new ContentTypeRegistry();
  registry.register(makeTrackedQuizType().contentType);
  return registry;
}

describe("InteractiveMediaAuthoring", () => {
  it("renders the timeline, picker, and placement editor", () => {
    render(
      <InteractiveMediaAuthoring
        videoSrc={VIDEO_SRC}
        videoDuration={VIDEO_DURATION}
        registry={makeRegistry()}
      />,
    );

    expect(screen.getByText("+ Blocking Hook")).toBeInTheDocument();
    expect(screen.getByText("+ Non-blocking Hook")).toBeInTheDocument();
    expect(screen.getByText("Select an item below to edit its placement.")).toBeInTheDocument();
  });

  it("adds a blocking item via the timeline", async () => {
    const onSerializedChange = vi.fn();
    render(
      <InteractiveMediaAuthoring
        videoSrc={VIDEO_SRC}
        videoDuration={VIDEO_DURATION}
        registry={makeRegistry()}
        onSerializedChange={onSerializedChange}
      />,
    );

    fireEvent.click(screen.getByText("+ Blocking Hook"));

    expect(await screen.findByText("New quiz")).toBeInTheDocument();
    await waitFor(() => expect(onSerializedChange).toHaveBeenCalled());
    const calls = onSerializedChange.mock.calls;
    const lastCall = calls[calls.length - 1];
    const lastDoc = lastCall?.[0] as SerializedInteractiveMediaDocument | undefined;
    expect(lastDoc?.items).toHaveLength(1);
  });

  it("opens the slot when an item is selected and edit is triggered", async () => {
    render(
      <InteractiveMediaAuthoring
        videoSrc={VIDEO_SRC}
        videoDuration={VIDEO_DURATION}
        registry={makeRegistry()}
        initialDocument={makeQuizDocument()}
      />,
    );

    fireEvent.click(await screen.findByText("Quiz 1"));
    fireEvent.click(await screen.findByText("Edit Content"));

    expect(await screen.findByText("Edit quiz")).toBeInTheDocument();
  });

  it("does not remount or re-update the slot editor on unrelated re-renders", async () => {
    const { contentType, renderEditor, updateEditor } = makeTrackedQuizType();
    const registry = new ContentTypeRegistry();
    registry.register(contentType);
    registry.register({
      getId: () => "poll",
      getVersion: () => 1,
      getMaximumScore: () => undefined,
      renderEditor: () => {},
      renderPlayback: () => {},
    });

    const { container } = render(
      <InteractiveMediaAuthoring
        videoSrc={VIDEO_SRC}
        videoDuration={VIDEO_DURATION}
        registry={registry}
        initialDocument={makeQuizDocument()}
      />,
    );

    fireEvent.click(await screen.findByText("Quiz 1"));
    fireEvent.click(await screen.findByText("Edit Content"));

    await waitFor(() => expect(renderEditor).toHaveBeenCalledTimes(1));

    const body = container.querySelector(".content-type-editor-body");
    if (!body) throw new Error("expected slot body");
    const input = body.querySelector(".quiz-question");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected question input");
    }

    fireEvent.input(input, { target: { value: "Hello" } });

    await waitFor(() => expect(updateEditor).toHaveBeenCalledTimes(1));
    expect(renderEditor).toHaveBeenCalledTimes(1);

    // Force an unrelated parent re-render by changing the picker selection.
    fireEvent.click(screen.getByText("quiz"));
    fireEvent.click(await screen.findByText("poll"));

    // The memoized slot data must keep the editor mounted and un-updated.
    expect(renderEditor).toHaveBeenCalledTimes(1);
    expect(updateEditor).toHaveBeenCalledTimes(1);
  });

  it("keeps focus in the question input across keystrokes (QuizEditor)", async () => {
    const registry = new ContentTypeRegistry();
    registry.register(QuizEditor);
    const doc: SerializedInteractiveMediaDocument = {
      video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
      items: [
        {
          id: "c1",
          title: "Quiz 1",
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz-editor",
            version: 1,
            data: { question: "", options: ["a", "b"], correctIndex: 0 },
          },
        },
      ],
    };

    const { container } = render(
      <InteractiveMediaAuthoring
        videoSrc={VIDEO_SRC}
        videoDuration={VIDEO_DURATION}
        registry={registry}
        initialDocument={doc}
      />,
    );

    fireEvent.click(await screen.findByText("Quiz 1"));
    fireEvent.click(await screen.findByText("Edit Content"));

    const body = container.querySelector(".content-type-editor-body");
    if (!body) throw new Error("expected slot body");
    const input = body.querySelector(".quiz-question");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected question input");
    }

    input.focus();
    fireEvent.input(input, { target: { value: "H" } });
    fireEvent.input(input, { target: { value: "He" } });

    expect(document.activeElement).toBe(input);
  });

  it("adjusts correctIndex when an option is removed", async () => {
    const registry = new ContentTypeRegistry();
    registry.register(QuizEditor);
    const onSerializedChange = vi.fn();
    const doc: SerializedInteractiveMediaDocument = {
      video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
      items: [
        {
          id: "c1",
          title: "Quiz 1",
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz-editor",
            version: 1,
            data: { question: "Q", options: ["a", "b"], correctIndex: 1 },
          },
        },
      ],
    };

    const { container } = render(
      <InteractiveMediaAuthoring
        videoSrc={VIDEO_SRC}
        videoDuration={VIDEO_DURATION}
        registry={registry}
        initialDocument={doc}
        onSerializedChange={onSerializedChange}
      />,
    );

    fireEvent.click(await screen.findByText("Quiz 1"));
    fireEvent.click(await screen.findByText("Edit Content"));

    const body = container.querySelector(".content-type-editor-body");
    if (!body) throw new Error("expected slot body");
    const editor = body.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor");

    const addButton = Array.from(editor.querySelectorAll("button")).find(
      (b) => b.textContent === "Add option",
    );
    if (!addButton) throw new Error("expected add option button");
    fireEvent.click(addButton);

    const select = editor.querySelector("select");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("expected select");
    }
    fireEvent.change(select, { target: { value: "2" } });

    const removeButtons = Array.from(editor.querySelectorAll("button")).filter(
      (b) => b.textContent === "Remove",
    );
    const firstRemove = removeButtons[0];
    if (!firstRemove) throw new Error("expected remove button");
    fireEvent.click(firstRemove);

    await waitFor(() => {
      const calls = onSerializedChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      const lastDoc = lastCall?.[0] as
        | SerializedInteractiveMediaDocument
        | undefined;
      const data = lastDoc?.items[0]?.content.data as
        | { correctIndex?: number }
        | undefined;
      expect(data?.correctIndex).toBe(1);
    });
  });

  it("emits the loaded document via onSerializedChange", async () => {
    const onSerializedChange = vi.fn();
    render(
      <InteractiveMediaAuthoring
        videoSrc={VIDEO_SRC}
        videoDuration={VIDEO_DURATION}
        registry={makeRegistry()}
        initialDocument={makeQuizDocument()}
        onSerializedChange={onSerializedChange}
      />,
    );

    await waitFor(() => {
      const calls = onSerializedChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      const lastDoc = lastCall?.[0] as
        | SerializedInteractiveMediaDocument
        | undefined;
      expect(lastDoc?.items).toHaveLength(1);
    });

    const docs = onSerializedChange.mock.calls.map(
      (call) => call[0] as SerializedInteractiveMediaDocument,
    );
    expect(docs.every((doc) => doc.items.length === 1)).toBe(true);
  });

  it("does not reload the initial document when the registry identity changes", async () => {
    const { contentType } = makeTrackedQuizType();
    const onSerializedChange = vi.fn();

    function Harness() {
      const [, force] = useState(0);
      const registry = new ContentTypeRegistry();
      registry.register(contentType);
      return (
        <>
          <button onClick={() => force((n) => n + 1)}>force</button>
          <InteractiveMediaAuthoring
            videoSrc={VIDEO_SRC}
            videoDuration={VIDEO_DURATION}
            registry={registry}
            initialDocument={makeQuizDocument()}
            onSerializedChange={onSerializedChange}
          />
        </>
      );
    }

    const { container } = render(<Harness />);
    fireEvent.click(await screen.findByText("Quiz 1"));
    fireEvent.click(await screen.findByText("Edit Content"));

    const body = container.querySelector(".content-type-editor-body");
    if (!body) throw new Error("expected slot body");
    const input = body.querySelector(".quiz-question");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected question input");
    }

    fireEvent.input(input, { target: { value: "Edited" } });
    await waitFor(() => {
      const calls = onSerializedChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      const lastDoc = lastCall?.[0] as
        | SerializedInteractiveMediaDocument
        | undefined;
      const data = lastDoc?.items[0]?.content.data as
        | { question?: string }
        | undefined;
      expect(data?.question).toBe("Edited");
    });

    // Force an unrelated re-render with a fresh registry identity.
    fireEvent.click(screen.getByText("force"));

    const calls = onSerializedChange.mock.calls;
    const lastCall = calls[calls.length - 1];
    const lastDoc = lastCall?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const data = lastDoc?.items[0]?.content.data as
      | { question?: string }
      | undefined;
    expect(data?.question).toBe("Edited");
  });
});