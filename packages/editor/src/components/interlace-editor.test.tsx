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

  it("composes the placement editor (selected): overlay inside the video frame, inputs below the toolbar", async () => {
    // Pin Gate 3 Material #2: the positioning context for the placement
    // overlay wraps exactly the video, and the toolbar sits below it.
    // Without this, an in-flow toolbar inside the frame would offset
    // every rectangle by the toolbar's height.
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByTestId("timeline-keyframe"));

    const frame = await screen.findByTestId("interlace-editor-video");
    expect(
      frame.querySelector('[data-testid="interlace-editor-preview-video"]'),
    ).not.toBeNull();
    expect(
      frame.querySelector('[data-testid="placement-editor"]'),
    ).not.toBeNull();
    expect(screen.queryByTestId("placement-editor-inputs")).not.toBeNull();
  });

  it("composes the placement editor (no selection): overlay and inputs absent", () => {
    // Companion to the test above: an empty document has no selected
    // item, so the overlay and the inputs must both be absent.
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );
    const frame = screen.getByTestId("interlace-editor-video");
    expect(
      frame.querySelector('[data-testid="interlace-editor-preview-video"]'),
    ).not.toBeNull();
    expect(frame.querySelector('[data-testid="placement-editor"]')).toBeNull();
    expect(screen.queryByTestId("placement-editor-inputs")).toBeNull();
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

    // Opening the preview modal pauses the authoring video; jsdom's
    // pause is "not implemented" and would log noise, so stub it.
    const authoringVideo = await screen.findByTestId(
      "interlace-editor-preview-video",
    ) as HTMLVideoElement;
    authoringVideo.pause = vi.fn();

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

    // Opening the preview modal pauses the authoring video; jsdom's
    // pause is "not implemented" and would log noise, so stub it.
    const authoringVideo = await screen.findByTestId(
      "interlace-editor-preview-video",
    ) as HTMLVideoElement;
    authoringVideo.pause = vi.fn();

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
          hookHeading: "Selected hook",
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

  it("end-to-end: add blocking hook at playhead → pick type → rename → save emits a serialized doc with edits", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    // Add a blocking hook (lands at the current playhead — 0s here).
    // It starts PENDING (no content type): the Hook section shows the
    // details with the picker, and the content editor is hidden.
    fireEvent.click(screen.getByTestId("keyframe-timeline-add-blocking"));
    expect(
      (await screen.findAllByText("New hook")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("interlace-editor-hook")).toBeInTheDocument();
    expect(screen.queryByTestId("content-type-editor")).toBeNull();

    // Pick the content type in Hook details — this materializes the
    // pending hook into the store.
    fireEvent.click(screen.getByText(/Select content type/i));
    fireEvent.click(await screen.findByText("quiz-editor"));

    // The inline content editor appears once the hook has a type.
    await waitFor(() => {
      expect(screen.getByTestId("content-type-editor")).toBeInTheDocument();
    });

    // Rename through the inspector title input — the update is live.
    const titleInput = screen.getByTestId(
      "inspector-panel-title",
    ) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Renamed" } });

    await waitFor(() => {
      expect(screen.getAllByText("Renamed").length).toBeGreaterThan(0);
    });

    // Save and assert the serialized doc carries the new title and the
    // playhead timestamp.
    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    expect(onSave).toHaveBeenCalled();
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(last?.items?.[0]?.title).toBe("Renamed");
    expect(last?.video?.src).toBe(VIDEO_SRC);
    expect((last?.items?.[0]?.hook as { timestamp?: number }).timestamp).toBe(0);
  });

  it("save does not serialize a pending hook (no content type chosen)", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId("keyframe-timeline-add-blocking"));
    expect(
      (await screen.findAllByText("New hook")).length,
    ).toBeGreaterThan(0);

    // Save without picking a content type: the pending hook is
    // editor-local only and must not reach the host's document.
    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    expect(onSave).toHaveBeenCalled();
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(last?.items).toHaveLength(0);
  });

  it("keeps a pending hook across parent re-renders with an unstable onError", async () => {
    // Gate 5 Material #1: the load effect re-runs whenever the host's
    // inline `onError` changes identity. Neither effect branch may
    // destroy a pending draft on unrelated identity churn (the
    // document branch early-returns on an identity match; the
    // document-less branch clears only on an actual transition).
    // The document identity itself must stay stable — a new document
    // object per render is a documented reload, not churn.
    const doc = makeDocument();
    function Harness() {
      const [, force] = useState(0);
      return (
        <>
          <button onClick={() => force((n) => n + 1)} data-testid="force">
            force
          </button>
          {/* Inline onError: a new identity on every Harness render. */}
          <InterlaceEditor
            contentTypeRegistry={makeRegistry()}
            document={doc}
            onUpload={vi.fn(async () => "x")}
            onSave={vi.fn()}
            onError={(e) => e}
          />
        </>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByTestId("keyframe-timeline-add-blocking"));
    expect(
      (await screen.findAllByText("New hook")).length,
    ).toBeGreaterThan(0);

    // Unrelated parent re-renders (new onError identity per render):
    // the pending draft must survive.
    fireEvent.click(screen.getByTestId("force"));
    expect(
      (await screen.findAllByText("New hook")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("force"));
    expect(
      (await screen.findAllByText("New hook")).length,
    ).toBeGreaterThan(0);
  });

  it("deleting a pending hook removes it without touching the store", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId("keyframe-timeline-add-blocking"));
    expect(
      (await screen.findAllByText("New hook")).length,
    ).toBeGreaterThan(0);

    // Delete the pending hook via Hook details.
    fireEvent.click(screen.getByTestId("inspector-panel-delete"));
    await waitFor(() => {
      expect(screen.queryAllByText("New hook")).toHaveLength(0);
    });

    // The store is untouched.
    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect(last?.items).toHaveLength(0);
  });

  it("carries pending hook placement edits into the materialized item", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId("keyframe-timeline-add-blocking"));
    expect(
      (await screen.findAllByText("New hook")).length,
    ).toBeGreaterThan(0);

    // Move the pending hook's placement via the manual inputs before
    // picking a content type.
    const x = screen.getByTestId(
      "placement-editor-input-x",
    ) as HTMLInputElement;
    fireEvent.change(x, { target: { value: "12" } });

    // Materialize.
    fireEvent.click(screen.getByText(/Select content type/i));
    fireEvent.click(await screen.findByText("quiz-editor"));

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const placement = last?.items?.[0]?.hook?.placement as { x?: number };
    expect(placement.x).toBe(12);
  });

  it("manual time inputs clamp beyond the video duration (blocking timestamp)", async () => {
    // Gate 5 Material #2: manual inputs must not produce times outside
    // the video.
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    fireEvent.click(await screen.findByTestId("timeline-keyframe"));
    const timestamp = screen.getByTestId(
      "inspector-panel-timestamp",
    ) as HTMLInputElement;
    fireEvent.change(timestamp, { target: { value: "100" } });

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    expect((last?.items?.[0]?.hook as { timestamp?: number }).timestamp).toBe(
      60,
    );
  });

  it("manual time inputs clamp beyond the video duration (non-blocking range)", async () => {
    const onSave = vi.fn();
    const nonBlockingDoc: SerializedInteractiveMediaDocument = {
      video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
      items: [
        {
          id: "c1",
          title: "Range",
          hook: {
            type: "non-blocking",
            start: 30,
            end: 45,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: {
            contentTypeId: "quiz-editor",
            version: 1,
            data: { question: "Q", options: ["a", "b"], correctIndex: 0 },
          },
        },
      ],
    };
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={nonBlockingDoc}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    fireEvent.click(await screen.findByTestId("timeline-keyframe"));

    // Start beyond the duration (end valid): the origin is bounded
    // inside the video.
    const start = screen.getByTestId(
      "inspector-panel-start",
    ) as HTMLInputElement;
    fireEvent.change(start, { target: { value: "100" } });

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const first = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const firstHook = first?.items?.[0]?.hook as {
      start?: number;
      end?: number;
    };
    expect(firstHook.start).toBe(59);
    expect(firstHook.end).toBe(60);

    // Both ends beyond the duration: fully clamped inside.
    const end = screen.getByTestId("inspector-panel-end") as HTMLInputElement;
    fireEvent.change(end, { target: { value: "110" } });

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const second = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const secondHook = second?.items?.[0]?.hook as {
      start?: number;
      end?: number;
    };
    expect(secondHook.start).toBe(59);
    expect(secondHook.end).toBe(60);
  });

  it("add-at-playhead clamps the default non-blocking range to the video duration", async () => {
    // Gate 4 Material #1: the default 10s range must not extend past
    // the video end when the playhead sits within 10s of it.
    const onSave = vi.fn();
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    // Move the playhead to 55s of 60s: stub the video's currentTime and
    // fire timeupdate so handleTimeUpdate reads it.
    const video = (await waitFor(() => {
      const v = container.querySelector(
        '[data-testid="interlace-editor-preview-video"]',
      ) as HTMLVideoElement | null;
      if (!v) throw new Error("expected preview video");
      return v;
    })) as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => 55,
      set: vi.fn(),
    });
    fireEvent.timeUpdate(video);

    fireEvent.click(
      screen.getByTestId("keyframe-timeline-add-non-blocking"),
    );

    // Pending hooks are not serialized — pick the content type to
    // materialize before saving.
    fireEvent.click(screen.getByText(/Select content type/i));
    fireEvent.click(await screen.findByText("quiz-editor"));

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const hook = last?.items?.[1]?.hook as { start?: number; end?: number };
    expect(hook.start).toBe(55);
    expect(hook.end).toBe(60); // clamped to duration, not 55 + 10
  });

  it("end-to-end: content editor edits propagate to the saved document", async () => {
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    // Select the loaded item via the timeline keyframe. The Hook
    // section shows the details and — the hook already has a content
    // type — the inline content editor mounts it.
    const entry = await screen.findByTestId("timeline-keyframe");
    fireEvent.click(entry);

    const editor = await screen.findByTestId("content-type-editor");
    expect(editor.textContent).toBe("Q1");

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const data = last?.items?.[0]?.content?.data as
      | { question?: string }
      | undefined;
    expect(data?.question).toBe("Q1");
  });

  it("re-typing a hook resets its content data and preserves time/title", async () => {
    // Phase 6: choosing a different content type rebuilds the hook
    // with the new type's default data; time, placement, and title
    // are preserved.
    const registry = new ContentTypeRegistry();
    registry.register(makeQuizContentType());
    registry.register({
      getId: () => "poll",
      getVersion: () => 1,
      getMaximumScore: () => undefined,
      renderEditor: () => {},
      renderPlayback: () => {},
    });
    const onSave = vi.fn();
    render(
      <InterlaceEditor
        contentTypeRegistry={registry}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={onSave}
      />,
    );

    fireEvent.click(await screen.findByTestId("timeline-keyframe"));

    // The picker shows the current type; choose "poll" to re-type.
    fireEvent.click(screen.getByText("quiz-editor"));
    fireEvent.click(screen.getByText("poll"));

    fireEvent.click(screen.getByTestId("interlace-editor-save"));
    const last = onSave.mock.calls[onSave.mock.calls.length - 1]?.[0] as
      | SerializedInteractiveMediaDocument
      | undefined;
    const item = last?.items?.[0];
    expect(item?.content?.contentTypeId).toBe("poll");
    expect(item?.content?.data).toEqual({});
    expect(item?.title).toBe("Quiz 1");
    expect((item?.hook as { timestamp?: number }).timestamp).toBe(10);
  });

  it("clicking the timeline track background deselects the selected hook", async () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByTestId("timeline-keyframe"));
    expect(
      await screen.findByTestId("interlace-editor-hook"),
    ).toBeInTheDocument();

    // A background click on the track (not on a keyframe) clears the
    // selection; the Hook section disappears.
    fireEvent.pointerDown(screen.getByTestId("keyframe-timeline-track"));
    await waitFor(() => {
      expect(screen.queryByTestId("interlace-editor-hook")).toBeNull();
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

  it("applies the preview label override on the video toolbar", () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makeDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
        strings={{
          previewLabel: "Open preview",
        }}
      />,
    );

    // The placement overlay only renders when an item is selected; the
    // toolbar (duration + replace + preview) is always visible.
    expect(screen.getByTestId("interlace-editor-open-preview")).toHaveTextContent(
      "Open preview",
    );
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
    const entry = await screen.findByTestId("timeline-keyframe");
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

    const entry = await screen.findByTestId("timeline-keyframe");
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

  it("clicking a timeline entry shows the Hook section with the content editor", async () => {
    render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    const entry = await screen.findByTestId("timeline-keyframe");
    fireEvent.click(entry);

    // The Hook section appears with the hook's details, and — the
    // hook already has a content type — the inline content editor
    // mounts.
    expect(
      await screen.findByTestId("interlace-editor-hook"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("content-type-editor")).toBeInTheDocument();
  });

  it("clicking a different timeline entry re-seeks and updates the Hook section", async () => {
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

    const entries = await screen.findAllByTestId("timeline-keyframe");
    fireEvent.click(entries[0]!);
    expect(video.currentTime).toBe(10);
    expect(
      await screen.findByTestId("interlace-editor-hook"),
    ).toBeInTheDocument();

    // A different entry is clicked: re-seek and the Hook section
    // re-renders with that hook's content.
    fireEvent.click(entries[1]!);
    expect(video.currentTime).toBe(30);
    const editor = await screen.findByTestId("content-type-editor");
    expect(editor.textContent).toBe("Q2");
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

    const entry = await screen.findByTestId("timeline-keyframe");
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

    const entry = await screen.findByTestId("timeline-keyframe");
    // The click should not throw; the Hook section still shows.
    fireEvent.click(entry);
    expect(
      await screen.findByTestId("interlace-editor-hook"),
    ).toBeInTheDocument();
    expect(setter).toHaveBeenCalledWith(10);
  });

  it("does not remount or re-update the content editor on unrelated re-renders", async () => {
    // This pins the composition-level wiring in InterlaceEditor: the
    // inline content editor's `data` prop must be memoized against the
    // selected ContentInstance so an unrelated parent re-render does
    // not cause the editor to fall back to a remount. A future
    // refactor that inlines `selectedData` would regress this
    // silently.
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

    // The document identity must be stable across Harness renders — a
    // new object per render would trigger the documented reload path
    // (new ContentInstances → new editor data → updateEditor), which
    // is correct behavior for a changed document, not an unrelated
    // re-render.
    const document = makePopulatedDocument();

    function Harness() {
      const [, force] = useState(0);
      return (
        <>
          <button onClick={() => force((n) => n + 1)} data-testid="force">
            force
          </button>
          <InterlaceEditor
            contentTypeRegistry={registry}
            document={document}
            onUpload={vi.fn(async () => "x")}
            onSave={vi.fn()}
          />
        </>
      );
    }

    const { container } = render(<Harness />);

    // Select the item via the timeline keyframe. The Hook section
    // shows the details and mounts the inline content editor.
    const entry = await screen.findByTestId("timeline-keyframe");
    fireEvent.click(entry);

    await waitFor(() => expect(renderEditor).toHaveBeenCalledTimes(1));

    // The tracked content type renders its input directly into the
    // inline editor's container div.
    const editorBody = container.querySelector(
      '[data-testid="content-type-editor"]',
    );
    if (!editorBody) throw new Error("expected content editor body");
    const input = editorBody.querySelector(".quiz-question");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected question input");
    }

    // Edit triggers onChange → the editor's data prop changes →
    // updateEditor is called (not renderEditor).
    fireEvent.input(input, { target: { value: "Hello" } });

    await waitFor(() => expect(updateEditor).toHaveBeenCalledTimes(1));
    expect(renderEditor).toHaveBeenCalledTimes(1);

    // Force an unrelated parent re-render (registry identity stable,
    // document unchanged). The memoized editor data must keep the
    // editor mounted and un-updated.
    fireEvent.click(screen.getByTestId("force"));

    expect(renderEditor).toHaveBeenCalledTimes(1);
    expect(updateEditor).toHaveBeenCalledTimes(1);
  });
});
