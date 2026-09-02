import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentTypeRegistry } from "@interlace/core";
import { ContentTypeEditorSlot } from "./content-type-editor-slot";

afterEach(() => {
  cleanup();
});

describe("ContentTypeEditorSlot", () => {
  it("renders nothing when closed", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {},
    });

    const { container } = render(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={false}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls renderEditor with the container and data", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: (container: HTMLElement, data: unknown) => {
        container.textContent = (data as { question: string }).question;
      },
      renderPlayback: () => {},
    });

    const { container } = render(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    const body = container.querySelector(".content-type-editor-body");
    expect(body?.textContent).toBe("Q1");
  });

  it("calls updateEditor when data changes", () => {
    const updateEditor = vi.fn(
      (container: HTMLElement, data: unknown) => {
        container.textContent = (data as { question: string }).question;
      },
    );
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: (container: HTMLElement, data: unknown) => {
        container.textContent = (data as { question: string }).question;
      },
      updateEditor,
      renderPlayback: () => {},
    });

    const { container, rerender } = render(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    rerender(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q2" }}
        onChange={vi.fn()}
      />,
    );

    expect(updateEditor).toHaveBeenCalled();
    const body = container.querySelector(".content-type-editor-body");
    expect(body?.textContent).toBe("Q2");
  });

  it("calls unmount on close", () => {
    const unmount = vi.fn();
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      unmount,
      renderPlayback: () => {},
    });

    const { rerender } = render(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    rerender(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={false}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    expect(unmount).toHaveBeenCalled();
  });

  it("remounts via unmount + renderEditor when updateEditor is absent", () => {
    const renderEditor = vi.fn((container: HTMLElement, data: unknown) => {
      container.textContent = (data as { question: string }).question;
    });
    const unmount = vi.fn();
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor,
      unmount,
      renderPlayback: () => {},
    });

    const { container, rerender } = render(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "v1" }}
        onChange={vi.fn()}
      />,
    );

    rerender(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "v2" }}
        onChange={vi.fn()}
      />,
    );

    expect(unmount).toHaveBeenCalledTimes(1);
    expect(renderEditor).toHaveBeenCalledTimes(2);
    const body = container.querySelector(".content-type-editor-body");
    expect(body?.textContent).toBe("v2");
  });

  it("calls unmount on the previous type when contentTypeId switches", () => {
    const quizRenderEditor = vi.fn((container: HTMLElement) => {
      container.textContent = "quiz";
    });
    const quizUnmount = vi.fn();
    const pollRenderEditor = vi.fn((container: HTMLElement) => {
      container.textContent = "poll";
    });
    const pollUnmount = vi.fn();
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: quizRenderEditor,
      unmount: quizUnmount,
      renderPlayback: () => {},
    });
    registry.register({
      getId: () => "poll",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: pollRenderEditor,
      unmount: pollUnmount,
      renderPlayback: () => {},
    });

    const { container, rerender } = render(
      <ContentTypeEditorSlot
        contentTypeId="quiz"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    rerender(
      <ContentTypeEditorSlot
        contentTypeId="poll"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    expect(quizUnmount).toHaveBeenCalledTimes(1);
    expect(pollRenderEditor).toHaveBeenCalledTimes(1);
    const quizUnmountOrder = quizUnmount.mock.invocationCallOrder[0];
    const pollRenderOrder = pollRenderEditor.mock.invocationCallOrder[0];
    if (quizUnmountOrder === undefined || pollRenderOrder === undefined) {
      throw new Error("expected quiz unmount and poll render to be called");
    }
    expect(quizUnmountOrder).toBeLessThan(pollRenderOrder);
    const body = container.querySelector(".content-type-editor-body");
    expect(body?.textContent).toBe("poll");
  });

  it("shows fallback for unknown content type", () => {
    const registry = new ContentTypeRegistry();

    render(
      <ContentTypeEditorSlot
        contentTypeId="unknown"
        isOpen={true}
        onClose={vi.fn()}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/not registered/)).toBeInTheDocument();
  });
});