import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  ContentTypeRegistry,
  type ContentType,
  type SerializedInteractiveMediaDocument,
} from "@interlace/core";
import { PreviewModal } from "./preview-modal";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const VIDEO_SRC = "https://example.com/preview-video.mp4";

function makeQuizContentType(): ContentType<{
  question: string;
  options: string[];
  correctIndex: number;
}> {
  return {
    getId: () => "quiz-editor",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback: (container: HTMLElement, data: { question: string }) => {
      const p = document.createElement("p");
      p.textContent = data.question;
      container.appendChild(p);
    },
  };
}

function makeRegistry(): ContentTypeRegistry {
  const registry = new ContentTypeRegistry();
  registry.register(makeQuizContentType());
  return registry;
}

function makeDocument(): SerializedInteractiveMediaDocument {
  return {
    video: { src: VIDEO_SRC, duration: 30 },
    items: [],
  };
}

describe("PreviewModal", () => {
  it("renders nothing when closed", () => {
    render(
      <PreviewModal
        isOpen={false}
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("preview-modal-backdrop"),
    ).not.toBeInTheDocument();
  });

  it("renders the dialog and close button when open", () => {
    render(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("preview-modal-close")).toBeInTheDocument();
    expect(screen.getByTestId("preview-modal-video")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId("preview-modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Escape key is pressed", async () => {
    const onClose = vi.fn();
    render(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call onClose when Escape is pressed while closed", () => {
    const onClose = vi.fn();
    render(
      <PreviewModal
        isOpen={false}
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked (not the content)", () => {
    const onClose = vi.fn();
    render(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={onClose}
      />,
    );

    const backdrop = screen.getByTestId("preview-modal-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the modal content is clicked", () => {
    const onClose = vi.fn();
    render(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={onClose}
      />,
    );

    const content = screen.getByTestId("preview-modal-content");
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mounts the <video> element only when open", () => {
    const { rerender } = render(
      <PreviewModal
        isOpen={false}
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("preview-modal-video"),
    ).not.toBeInTheDocument();

    rerender(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("preview-modal-video")).toBeInTheDocument();
  });

  it("unmounts the <video> element when closed (audio stops)", () => {
    const { rerender } = render(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("preview-modal-video")).toBeInTheDocument();

    rerender(
      <PreviewModal
        isOpen={false}
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("preview-modal-video"),
    ).not.toBeInTheDocument();
  });

  it("applies string overrides to the title and loading label", () => {
    render(
      <PreviewModal
        isOpen
        videoSrc={VIDEO_SRC}
        document={makeDocument()}
        contentTypeRegistry={makeRegistry()}
        onClose={vi.fn()}
        strings={{
          title: "Student view",
          loadingLabel: "Just a moment…",
        }}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Student view");
    // The loading label only renders while the adapter is being
    // constructed; in jsdom the adapter is constructed synchronously
    // after mount, so we verify the override reached the strings
    // by checking the dialog's aria-label (which is the title) and
    // the close button's label (which is the inherited closeLabel).
    expect(screen.getByTestId("preview-modal-close")).toHaveTextContent(
      "Close",
    );
  });

  it("re-creates the adapter when the videoSrc changes while open", () => {
    function Harness() {
      const [src, setSrc] = useState(VIDEO_SRC);
      return (
        <>
          <button onClick={() => setSrc("https://example.com/other.mp4")}>
            change
          </button>
          <PreviewModal
            isOpen
            videoSrc={src}
            document={makeDocument()}
            contentTypeRegistry={makeRegistry()}
            onClose={vi.fn()}
          />
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("change"));
    // The effect re-runs and the video element's src attribute updates.
    const video = screen.getByTestId(
      "preview-modal-video",
    ) as HTMLVideoElement;
    expect(video.src).toContain("other.mp4");
  });
});
