import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  ContentTypeRegistry,
  type ContentType,
  type SerializedInteractiveMediaDocument,
} from "@interlace/core";
import { InterlaceEditor } from "./interlace-editor";

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
      screen.queryByTestId("interlace-editor-preview"),
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
      container.querySelector(".interlace-editor-preview"),
    ).toBeNull();

    resolveUpload?.("https://cdn.example.com/lecture.mp4");

    await waitFor(() => {
      expect(
        screen.getByTestId("interlace-editor-preview"),
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
        screen.getByTestId("interlace-editor-preview"),
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
      screen.getByTestId("interlace-editor-preview"),
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

  it("opens the preview BlockingOverlay when an anchor is clicked", async () => {
    const { container } = render(
      <InterlaceEditor
        contentTypeRegistry={makeRegistry()}
        document={makePopulatedDocument()}
        onUpload={vi.fn(async () => "x")}
        onSave={vi.fn()}
      />,
    );

    // The Anchor is rendered inside the preview overlay container.
    const overlay = await screen.findByTestId("interlace-editor-preview-overlay");
    const anchor = overlay.querySelector("button");
    if (!anchor) throw new Error("expected anchor button");
    fireEvent.click(anchor);

    // The BlockingOverlay's dialog role is "dialog".
    await waitFor(() => {
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });
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
});
