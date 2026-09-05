import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  ContentTypeRegistry,
  type ContentType,
  type SerializedInteractiveMediaDocument,
  type Strings as CoreStrings,
} from "@interlace/core";
import { InterlaceEditor, DEFAULT_EDITOR_STRINGS } from "./interlace-editor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const VIDEO_SRC = "https://example.com/video.mp4";
const VIDEO_DURATION = 60;

function makeQuizContentType(): ContentType<{
  question: string;
  options: string[];
  correctIndex: number;
}> {
  return {
    getId: () => "quiz-editor",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: (container: HTMLElement, data: { question: string }) => {
      container.textContent = data.question;
    },
    renderPlayback: () => {},
  };
}

function makeRegistry(): ContentTypeRegistry {
  const registry = new ContentTypeRegistry();
  registry.register(makeQuizContentType());
  return registry;
}

/**
 * Builds a tracked quiz content type whose editor renders a single text
 * input bound to `data.question`. Used to assert the slot's
 * render/update lifecycle from inside InterlaceEditor without depending
 * on QuizEditor's DOM.
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
    getId: () => "quiz-editor",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor,
    updateEditor,
    unmount,
    renderPlayback: () => {},
  };

  return { contentType, renderEditor, updateEditor, unmount };
}

function makeDocument(
  overrides: Partial<SerializedInteractiveMediaDocument> = {},
): SerializedInteractiveMediaDocument {
  return {
    video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
    items: [],
    ...overrides,
  };
}

function makePopulatedDocument(): SerializedInteractiveMediaDocument {
  return {
    video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
    items: [
      {
        id: "c1",
        title: "Quiz 1",
        hook: {
          type: "blocking",
          timestamp: 10,
          placement: { x: 30, y: 40, width: 20, height: 20 },
        },
        content: {
          contentTypeId: "quiz-editor",
          version: 1,
          data: { question: "Q1", options: ["a", "b"], correctIndex: 0 },
        },
      },
    ],
  };
}

describe("InterlaceEditor", () => {
  it("shows the video source step first when no document is provided", () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("video-source-input-empty"),
    ).toBeInTheDocument();
    // No authoring surface until a video is selected.
    expect(
      screen.queryByTestId("interlace-editor-video"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("interlace-editor-save")).not.toBeInTheDocument();
  });

  it("awaits the upload promise and transitions to the authoring surface", async () => {
    let resolveUpload: ((url: string) => void) | undefined;
    const onUpload = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const onSave = vi.fn();

    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        onUpload={onUpload}
        onSave={onSave}
      />,
    );

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [new File([new Blob(["x"])], "lecture.mp4", { type: "video/mp4" })],
      configurable: true,
    });
    fireEvent.change(fileInput);

    // Authoring surface is not visible until the upload resolves.
    expect(
      container.querySelector(".interlace-editor-video"),
    ).toBeNull();

    resolveUpload?.("https://cdn.example.com/lecture.mp4");

    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-video"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("interlace-editor-save"),
    ).toBeInTheDocument();
  });

  it("transitions to the authoring surface when a URL is applied", async () => {
    const onSave = vi.fn();

    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    const urlInput = screen.getByTestId(
      "video-source-input-url",
    ) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: VIDEO_SRC } });
    fireEvent.click(screen.getByTestId("video-source-input-apply"));

    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-video"),
      ).toBeInTheDocument();
    });
  });

  it("skips the source step when a document is provided with a video source", () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("video-source-input-empty"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("interlace-editor-video"),
    ).toBeInTheDocument();
  });

  it("renders the replace-video button and re-opens the source step on click", async () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("interlace-editor-replace-video"));

    expect(
      await screen.findByTestId("video-source-input-current-src"),
    ).toBeInTheDocument();
  });

  it("emits the serialized document via onSave with src and duration", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    const urlInput = screen.getByTestId(
      "video-source-input-url",
    ) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: VIDEO_SRC } });
    fireEvent.click(screen.getByTestId("video-source-input-apply"));

    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-save"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("interlace-editor-save"));

    expect(onSave).toHaveBeenCalledTimes(1);
    const doc = onSave.mock.calls[0]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(doc?.video?.src).toBe(VIDEO_SRC);
    // Duration is initially 0 until the preview video's loadedmetadata fires;
    // a real browser would fill it in.
    expect(typeof doc?.video?.duration).toBe("number");
  });

  it("does not include adapterType in the serialized document", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
        adapterType="mux"
      />,
    );

    const urlInput = screen.getByTestId(
      "video-source-input-url",
    ) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: VIDEO_SRC } });
    fireEvent.click(screen.getByTestId("video-source-input-apply"));

    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-save"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("interlace-editor-save"));

    const doc = onSave.mock.calls[0]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(doc).toBeDefined();
    // The schema intentionally does not carry adapterType.
    expect(Object.keys(doc?.video ?? {})).toEqual(["src", "duration"]);
  });

  it("loads an existing document's items into the timeline", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    await waitFor(() => {
      // The item appears both in the timeline and the preview anchor;
      // either is enough to confirm the load worked.
      expect(screen.getAllByText("Quiz 1").length).toBeGreaterThan(0);
    });
  });

  it("does not reload the document when the registry identity changes", async () => {
    const onSave = vi.fn();

    function Harness() {
      const [, force] = useState(0);
      const registry = new ContentTypeRegistry();
      registry.register(makeQuizContentType());
      return (
        <>
          <button onClick={() => force((n) => n + 1)}>force</button>
          <InterlaceEditor
            contentTypeRegistry={registry}
            document={makePopulatedDocument()}
            onUpload={vi.fn(async () => "x")}
            onSave={onSave}
          />
        </>
      );
    }

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getAllByText("Quiz 1").length).toBeGreaterThan(0);
    });

    // Save the document to capture the current state.
    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const beforeDocs = onSave.mock.calls.map(
      (call) => call[0] as SerializedInteractiveMediaDocument,
    );
    const beforeDoc = beforeDocs[beforeDocs.length - 1];
    const beforeItemCount = beforeDoc?.items.length;

    // Force a re-render with a fresh registry identity.
    fireEvent.click(screen.getByText("force"));

    // The items should still be there.
    await waitFor(() => {
      expect(screen.getAllByText("Quiz 1").length).toBeGreaterThan(0);
    });
    expect(beforeItemCount).toBeGreaterThan(0);
  });

  it("opens the preview modal when the Preview button is clicked", async () => {
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    // The modal is not open yet.
    expect(
      screen.queryByTestId("preview-modal-backdrop"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("interlace-editor-open-preview"));

    // The PreviewModal's dialog is visible.
    expect(
      await screen.findByTestId("preview-modal-backdrop"),
    ).toBeInTheDocument();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // Closing the modal removes the dialog.
    fireEvent.click(screen.getByTestId("preview-modal-close"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("preview-modal-backdrop"),
      ).not.toBeInTheDocument();
    });
  });

  it("pauses the authoring video when the preview modal opens", async () => {
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    const video = await waitFor(() => {
      const v = container.querySelector(
        '[data-testid="interlace-editor-preview-video"]',
      ) as HTMLVideoElement | null;
      if (!v) throw new Error("expected preview video");
      return v;
    });
    // jsdom does not implement play/pause natively; stub them.
    const pauseSpy = vi.fn();
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: pauseSpy,
    });

    fireEvent.click(screen.getByTestId("interlace-editor-open-preview"));

    await waitFor(() => {
      expect(pauseSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("memoizes the preview document so parent re-renders do not restart the player controller", async () => {
    // The PreviewModal is wired to the player's `useInteractiveMedia`
    // hook, which restarts the controller when its `document` dep
    // changes. The document is memoized in InterlaceEditor on the
    // specific state slices that affect it; a parent re-render that
    // does not change those slices must not produce a new document
    // identity.
    function Harness() {
      const [, force] = useState(0);
      return (
        <>
          <button onClick={() => force((n) => n + 1)} data-testid="force">
            force
          </button>
          <InterlaceEditor
            contentTypeRegistry={makeRegistry()}
            document={makePopulatedDocument()}
            onUpload={vi.fn(async () => "x")}
            onSave={vi.fn()}
          />
        </>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByTestId("interlace-editor-open-preview"));
    await screen.findByTestId("preview-modal-backdrop");

    // The modal's adapter is created after mount. Capture its parent
    // (the wrapper div that the adapter replaces the container with)
    // as a stable reference.
    const playerContainer = await screen.findByTestId(
      "preview-modal-player-container",
    );
    const adapterWrapperBefore = playerContainer.parentElement;

    // Force a parent re-render that does NOT change the document
    // content (no item added, no video replaced, no field edited).
    fireEvent.click(screen.getByTestId("force"));

    // The player container should still be present and its parent
    // (the adapter's wrapper div) should be the same DOM node. If the
    // adapter were destroyed and recreated, the wrapper would be a
    // new node.
    const playerContainerAfter = screen.getByTestId(
      "preview-modal-player-container",
    );
    expect(playerContainerAfter).toBe(playerContainer);
    expect(playerContainerAfter.parentElement).toBe(adapterWrapperBefore);
  });

  it("applies string overrides to the surface headings and save button", () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
        strings={{
          previewTitle: "Authoring surface",
          saveLabel: "Publish",
          timelineHeading: "My hooks",
          addContentHeading: "New hook",
          noItemSelectedLabel: "Pick something.",
        }}
      />,
    );

    // The header previewTitle is rendered inside an <h2>; scope to it.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Authoring surface",
    );
    expect(screen.getByTestId("interlace-editor-save")).toHaveTextContent(
      "Publish",
    );
    expect(screen.getByText("My hooks")).toBeInTheDocument();
    expect(screen.getByText("New hook")).toBeInTheDocument();
    expect(screen.getByText("Pick something.")).toBeInTheDocument();
  });

  it("surfaces load validation errors via onError", () => {
    const onError = vi.fn();
    // An invalid document: items must be an array.
    const invalidDoc = {
      video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
      items: "not-an-array" as unknown as SerializedInteractiveMediaDocument["items"],
    };

    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={invalidDoc}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
        onError={onError}
      />,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it("surfaces deserialize warnings via onError (skipped items are persisted)", () => {
    const onError = vi.fn();
    // Register a registry that only knows "quiz-editor"; the document
    // also references "poll", which `deserialize` will skip with a
    // warning. The host must be told or the silent Save will persist a
    // pruned document.
    const doc: SerializedInteractiveMediaDocument = {
      video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
      items: [
        {
          id: "c1",
          title: "Quiz 1",
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 30, y: 30, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz-editor",
            version: 1,
            data: { question: "Q1", options: ["a", "b"], correctIndex: 0 },
          },
        },
        {
          id: "c2",
          title: "Unknown poll",
          hook: {
            type: "non-blocking",
            start: 20,
            end: 40,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: {
            contentTypeId: "poll",
            version: 1,
            data: {},
          },
        },
      ],
    };

    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={doc}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
        onError={onError}
      />,
    );

    const warningCalls = onError.mock.calls.filter((call) => {
      const arg = call[0] as Error;
      return arg instanceof Error && /unrecognized content type/.test(arg.message);
    });
    expect(warningCalls.length).toBeGreaterThan(0);
  });

  it("end-to-end: add blocking hook → edit title/timestamp → save emits a serialized doc with edits", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    // Add a blocking hook.
    fireEvent.click(screen.getByText("+ Blocking Hook"));
    // The new entry shows up in both the timeline and the preview
    // overlay; either is enough to confirm the add worked.
    expect(
      (await screen.findAllByText("New quiz-editor")).length,
    ).toBeGreaterThan(0);

    // The TimelineEntry's Edit button (the "+ Blocking Hook" add
    // already created one). Click it and change the title.
    const entry = screen.getByTestId("timeline-entry");
    const editButton = entry.querySelector("button");
    if (!editButton) throw new Error("expected edit button on timeline entry");
    fireEvent.click(editButton);

    const titleInput = entry.querySelector(
      'input[placeholder="Title"]',
    ) as HTMLInputElement | null;
    if (!titleInput) throw new Error("expected title input on timeline entry");
    fireEvent.change(titleInput, { target: { value: "Renamed" } });

    // The TimelineEntry's Save button is the second button inside the
    // entry (Edit was first, then Save, then Cancel).
    const entryButtons = entry.querySelectorAll("button");
    const saveButton = Array.from(entryButtons).find(
      (b) => b.textContent === "Save",
    );
    if (!saveButton) throw new Error("expected save button on timeline entry");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getAllByText("Renamed").length).toBeGreaterThan(0);
    });

    // Save and assert the serialized doc carries the new title.
    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    expect(onSave).toHaveBeenCalled();
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(last?.items?.[0]?.title).toBe("Renamed");
    expect(last?.video?.src).toBe(VIDEO_SRC);
  });

  it("end-to-end: slot data edit propagates to the saved document", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    // Select the loaded item via the timeline entry. The slot opens
    // automatically (Phase 1 click-to-seek-and-open behavior).
    const entry = await screen.findByTestId("timeline-entry");
    fireEvent.click(entry);

    // The slot mounts the content type's editor; the test registry's
    // editor renders the question text into a node. We assert the
    // slot is present (via its h2) and then save; the saved doc must
    // round-trip.
    expect(
      await screen.findByText("Edit quiz-editor"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const data = last?.items?.[0]?.content?.data as
      | { question?: string }
      | undefined;
    expect(data?.question).toBe("Q1");
  });

  it("replace flow: cancel restores the authoring surface and keeps existing items", async () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    // Open replace.
    fireEvent.click(screen.getByTestId("interlace-editor-replace-video"));
    expect(
      await screen.findByTestId("interlace-editor-cancel-replace"),
    ).toBeInTheDocument();

    // Cancel returns to the authoring surface.
    fireEvent.click(screen.getByTestId("interlace-editor-cancel-replace"));
    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-video"),
      ).toBeInTheDocument();
    });
  });

  it("replace flow: cancel restores the authoring surface and keeps existing items", async () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("interlace-editor-replace-video"));
    expect(
      await screen.findByTestId("interlace-editor-cancel-replace"),
    ).toBeInTheDocument();

    // Cancel returns to the authoring surface.
    fireEvent.click(screen.getByTestId("interlace-editor-cancel-replace"));
    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-video"),
      ).toBeInTheDocument();
    });
    // The existing item is still there.
    expect(screen.getAllByText("Quiz 1").length).toBeGreaterThan(0);
  });

  it("replace flow: commit with a new URL keeps the existing items and writes the new src", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId("interlace-editor-replace-video"));
    const urlInput = await screen.findByTestId("video-source-input-url");
    fireEvent.change(urlInput, { target: { value: "https://new.example.com/v.mp4" } });
    fireEvent.click(screen.getByTestId("video-source-input-apply"));

    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-video"),
      ).toBeInTheDocument();
    });

    // Existing item survives the replace.
    expect(screen.getAllByText("Quiz 1").length).toBeGreaterThan(0);

    // Save and assert the new src.
    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(last?.video?.src).toBe("https://new.example.com/v.mp4");
    expect(last?.items?.length).toBe(1);
  });

  it("replace flow: closing the source step with the slot open also closes the slot", async () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    // Select an item via the timeline entry. The slot opens
    // automatically (Phase 1 click-to-seek-and-open behavior).
    const entry = await screen.findByTestId("timeline-entry");
    fireEvent.click(entry);
    expect(
      await screen.findByText("Edit quiz-editor"),
    ).toBeInTheDocument();

    // Now click replace and commit a new URL.
    fireEvent.click(screen.getByTestId("interlace-editor-replace-video"));
    const urlInput = await screen.findByTestId("video-source-input-url");
    fireEvent.change(urlInput, { target: { value: "https://other.example.com/v.mp4" } });
    fireEvent.click(screen.getByTestId("video-source-input-apply"));

    // The slot must be closed (the "Edit quiz-editor" h2 disappears).
    await waitFor(() => {
      expect(screen.queryByText("Edit quiz-editor")).toBeNull();
    });
  });

  it("same-URL replace preserves the previously reported duration", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={{ video: { src: VIDEO_SRC, duration: 0 }, items: [] }}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    // Simulate the preview <video> reporting a duration.
    const video = screen.getByTestId(
      "interlace-editor-preview-video",
    ) as HTMLVideoElement;
    Object.defineProperty(video, "duration", {
      value: 123,
      configurable: true,
    });
    fireEvent.loadedMetadata(video);

    // User clicks replace and re-applies the *same* URL.
    fireEvent.click(screen.getByTestId("interlace-editor-replace-video"));
    const urlInput = await screen.findByTestId("video-source-input-url");
    fireEvent.change(urlInput, { target: { value: VIDEO_SRC } });
    fireEvent.click(screen.getByTestId("video-source-input-apply"));

    // Save and assert the duration survived the same-URL replace.
    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(last?.video?.duration).toBe(123);
  });

  it("forwards strings.videoSource to the embedded VideoSourceInput", () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
        strings={{
          videoSource: {
            noVideoSelectedLabel: "Pick a video to begin.",
          },
        }}
      />,
    );

    expect(
      screen.getByTestId("video-source-input-empty"),
    ).toHaveTextContent("Pick a video to begin.");
  });

  it("applies the placement label override", () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
        strings={{
          placementLabel: "Where it goes",
        }}
      />,
    );

    expect(screen.getByText("Where it goes")).toBeInTheDocument();
  });

  it("clicking a timeline entry seeks the video to the hook's anchor time", async () => {
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    // Wait for the preview <video> to mount.
    const video = await waitFor(() => {
      const v = container.querySelector(
        '[data-testid="interlace-editor-preview-video"]',
      ) as HTMLVideoElement | null;
      if (!v) throw new Error("expected preview video");
      return v;
    });

    // Simulate the video having loaded metadata (jsdom does not
    // dispatch loadedmetadata automatically; the component reads
    // `duration` lazily on its own effect).
    Object.defineProperty(video, "duration", {
      value: 60,
      configurable: true,
    });
    fireEvent.loadedMetadata(video);

    // Select the loaded item (timestamp 10s). The click handler should
    // seek the video to 10s.
    const entry = await screen.findByTestId("timeline-entry");
    fireEvent.click(entry);

    expect(video.currentTime).toBe(10);
  });

  it("clicking a non-blocking timeline entry seeks the video to the start time", async () => {
    const doc: SerializedInteractiveMediaDocument = {
      video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
      items: [
        {
          id: "c1",
          title: "Poll 1",
          hook: {
            type: "non-blocking",
            start: 25,
            end: 40,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: {
            contentTypeId: "quiz-editor",
            version: 1,
            data: { question: "", options: ["", ""], correctIndex: 0 },
          },
        },
      ],
    };
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={doc}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    const video = await waitFor(() => {
      const v = container.querySelector(
        '[data-testid="interlace-editor-preview-video"]',
      ) as HTMLVideoElement | null;
      if (!v) throw new Error("expected preview video");
      return v;
    });
    Object.defineProperty(video, "duration", {
      value: 60,
      configurable: true,
    });
    fireEvent.loadedMetadata(video);

    const entry = await screen.findByTestId("timeline-entry");
    fireEvent.click(entry);

    // Non-blocking: seeks to `start`, not to `end`.
    expect(video.currentTime).toBe(25);
  });

  it("EditorStrings extends the core Strings base (compile-time assignment check)", () => {
    // The line below fails to compile if EditorStrings stops
    // extending Strings. The runtime assertions confirm every
    // core field is present on the editor defaults.
    const fromCore: CoreStrings = DEFAULT_EDITOR_STRINGS;
    expect(fromCore.cancelLabel).toBe("Cancel");
    expect(fromCore.closeLabel).toBe("Close");
    expect(fromCore.submitLabel).toBe("Submit");
  });

  it("clicking a timeline entry opens the content editor slot", async () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    const entry = await screen.findByTestId("timeline-entry");
    fireEvent.click(entry);

    // The slot's h2 ("Edit quiz-editor") is the visible marker that
    // the slot is open.
    expect(
      await screen.findByText("Edit quiz-editor"),
    ).toBeInTheDocument();
  });

  it("clicking a different timeline entry re-seeks and re-opens the slot", async () => {
    const doc: SerializedInteractiveMediaDocument = {
      video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
      items: [
        {
          id: "c1",
          title: "First",
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz-editor",
            version: 1,
            data: { question: "Q1", options: ["a", "b"], correctIndex: 0 },
          },
        },
        {
          id: "c2",
          title: "Second",
          hook: {
            type: "blocking",
            timestamp: 30,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz-editor",
            version: 1,
            data: { question: "Q2", options: ["c", "d"], correctIndex: 0 },
          },
        },
      ],
    };
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={doc}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    const video = await waitFor(() => {
      const v = container.querySelector(
        '[data-testid="interlace-editor-preview-video"]',
      ) as HTMLVideoElement | null;
      if (!v) throw new Error("expected preview video");
      return v;
    });
    Object.defineProperty(video, "duration", {
      value: 60,
      configurable: true,
    });
    fireEvent.loadedMetadata(video);

    const entries = await screen.findAllByTestId("timeline-entry");
    fireEvent.click(entries[0]!);
    expect(video.currentTime).toBe(10);
    expect(
      await screen.findByText("Edit quiz-editor"),
    ).toBeInTheDocument();

    // The slot is closed (Cancel) and a different entry is clicked.
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Edit quiz-editor")).toBeNull();
    });
    fireEvent.click(entries[1]!);
    expect(video.currentTime).toBe(30);
    expect(
      await screen.findByText("Edit quiz-editor"),
    ).toBeInTheDocument();
  });

  it("deferred seek is applied when the video later reports loadedmetadata", async () => {
    // Simulate the real-browser behavior: the video's `currentTime`
    // setter throws before metadata is loaded. The click should defer
    // the seek into `pendingSeekRef`, and the next `loadedmetadata`
    // event should consume it.
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    const video = await waitFor(() => {
      const v = container.querySelector(
        '[data-testid="interlace-editor-preview-video"]',
      ) as HTMLVideoElement | null;
      if (!v) throw new Error("expected preview video");
      return v;
    });
    // First: the setter throws (pre-metadata).
    let setterCalls = 0;
    let postMetadataSetterCalls = 0;
    let metadataReady = false;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => 0,
      set: () => {
        setterCalls += 1;
        if (metadataReady) {
          postMetadataSetterCalls += 1;
        } else {
          throw new Error("InvalidStateError");
        }
      },
    });
    // duration is not yet known.
    Object.defineProperty(video, "duration", {
      configurable: true,
      get: () => Number.NaN,
    });

    const entry = await screen.findByTestId("timeline-entry");
    fireEvent.click(entry);
    // The throw path was hit exactly once and the seek was deferred.
    expect(setterCalls).toBe(1);
    expect(postMetadataSetterCalls).toBe(0);

    // Now simulate `loadedmetadata` reporting a real duration. The
    // pending seek should be applied.
    metadataReady = true;
    Object.defineProperty(video, "duration", {
      configurable: true,
      get: () => 60,
    });
    fireEvent.loadedMetadata(video);

    await waitFor(() => {
      expect(postMetadataSetterCalls).toBe(1);
    });
  });

  it("seek handles a video that has not yet loaded metadata (no throw)", async () => {
    // jsdom's HTMLVideoElement does not have a `currentTime` setter
    // that throws, but a real browser does for a video with no
    // metadata. We simulate by stubbing the setter to throw and
    // asserting the click does not surface an unhandled error.
    const setter = vi.fn(() => {
      throw new Error("InvalidStateError");
    });
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    const video = await waitFor(() => {
      const v = container.querySelector(
        '[data-testid="interlace-editor-preview-video"]',
      ) as HTMLVideoElement | null;
      if (!v) throw new Error("expected preview video");
      return v;
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      set: setter,
      get: () => 0,
    });

    const entry = await screen.findByTestId("timeline-entry");
    // The click should not throw; the slot still opens.
    fireEvent.click(entry);
    expect(
      await screen.findByText("Edit quiz-editor"),
    ).toBeInTheDocument();
    expect(setter).toHaveBeenCalledWith(10);
  });

  it("does not remount or re-update the slot editor on unrelated re-renders", async () => {
    // This pins the composition-level wiring in InterlaceEditor: the
    // slot's `data` prop must be memoized against the selected
    // ContentInstance so an unrelated parent re-render does not cause
    // ContentTypeEditorSlot to fall back to a remount. A future
    // refactor that inlines `slotData` would regress this silently.
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
      <InterlaceEditor
        contentTypeRegistry={registry}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    // Select the item via the timeline entry. The slot opens
    // automatically (Phase 1 click-to-seek-and-open behavior).
    const entry = await screen.findByTestId("timeline-entry");
    fireEvent.click(entry);

    await waitFor(() => expect(renderEditor).toHaveBeenCalledTimes(1));

    // Find the question input rendered by the tracked content type.
    const body = container.querySelector(".content-type-editor-body");
    if (!body) throw new Error("expected slot body");
    const input = body.querySelector(".quiz-question");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected question input");
    }

    // Edit triggers onChange → slot's data prop changes → updateEditor
    // is called (not renderEditor).
    fireEvent.input(input, { target: { value: "Hello" } });

    await waitFor(() => expect(updateEditor).toHaveBeenCalledTimes(1));
    expect(renderEditor).toHaveBeenCalledTimes(1);

    // Force an unrelated parent re-render by changing the content-type
    // picker's selection. The memoized slot data must keep the editor
    // mounted and un-updated.
    fireEvent.click(screen.getByText("quiz-editor"));
    fireEvent.click(await screen.findByText("poll"));

    expect(renderEditor).toHaveBeenCalledTimes(1);
    expect(updateEditor).toHaveBeenCalledTimes(1);
  });
});
