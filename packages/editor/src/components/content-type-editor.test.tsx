import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentTypeRegistry } from "@interlace/core";
import { ContentTypeEditor } from "./content-type-editor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface TrackedType {
  renderEditor: ReturnType<typeof vi.fn>;
  updateEditor?: ReturnType<typeof vi.fn>;
  unmount: ReturnType<typeof vi.fn>;
  register: (registry: ContentTypeRegistry) => void;
}

function makeTrackedType(id: string, withUpdate = true): TrackedType {
  const renderEditor = vi.fn((container: HTMLElement, data: unknown) => {
    container.textContent = (data as { question: string }).question;
  });
  const updateEditor = withUpdate
    ? vi.fn((container: HTMLElement, data: unknown) => {
        container.textContent = (data as { question: string }).question;
      })
    : undefined;
  const unmount = vi.fn();
  return {
    renderEditor,
    updateEditor,
    unmount,
    register: (registry: ContentTypeRegistry) => {
      registry.register({
        getId: () => id,
        getVersion: () => 1,
        getMaximumScore: () => 100,
        renderEditor,
        ...(updateEditor ? { updateEditor } : {}),
        unmount,
        renderPlayback: () => {},
      });
    },
  };
}

function makeRegistry(...types: TrackedType[]): ContentTypeRegistry {
  const registry = new ContentTypeRegistry();
  for (const t of types) t.register(registry);
  return registry;
}

describe("ContentTypeEditor", () => {
  it("renders nothing when contentTypeId is null", () => {
    const { container } = render(
      <ContentTypeEditor
        contentTypeId={null}
        registry={makeRegistry()}
        data={{ question: "Q" }}
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[data-testid="content-type-editor"]'),
    ).toBeNull();
  });

  it("mounts the editor into the container and renders the data", () => {
    const tracked = makeTrackedType("quiz");
    const { container } = render(
      <ContentTypeEditor
        contentTypeId="quiz"
        registry={makeRegistry(tracked)}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );
    const body = container.querySelector(
      '[data-testid="content-type-editor"]',
    ) as HTMLElement;
    expect(body?.textContent).toBe("Q1");
    expect(tracked.renderEditor).toHaveBeenCalledTimes(1);
  });

  it("calls updateEditor when data changes", () => {
    const tracked = makeTrackedType("quiz");
    // The registry (and therefore the resolved contentType identity)
    // must be stable across rerenders — a fresh registry per render
    // would look like a type switch and re-run renderEditor.
    const registry = makeRegistry(tracked);
    const onChange = vi.fn();
    const { rerender } = render(
      <ContentTypeEditor
        contentTypeId="quiz"
        registry={registry}
        data={{ question: "Q1" }}
        onChange={onChange}
      />,
    );
    rerender(
      <ContentTypeEditor
        contentTypeId="quiz"
        registry={registry}
        data={{ question: "Q2" }}
        onChange={onChange}
      />,
    );
    expect(tracked.updateEditor).toHaveBeenCalledTimes(1);
    expect(tracked.renderEditor).toHaveBeenCalledTimes(1);
    const body = document.querySelector(
      '[data-testid="content-type-editor"]',
    ) as HTMLElement;
    expect(body?.textContent).toBe("Q2");
  });

  it("unmounts the session when contentTypeId becomes null", () => {
    const tracked = makeTrackedType("quiz");
    const registry = makeRegistry(tracked);
    const { rerender } = render(
      <ContentTypeEditor
        contentTypeId="quiz"
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );
    rerender(
      <ContentTypeEditor
        contentTypeId={null}
        registry={registry}
        data={{ question: "Q1" }}
        onChange={vi.fn()}
      />,
    );
    expect(tracked.unmount).toHaveBeenCalledTimes(1);
  });

  it("remounts via unmount + renderEditor when updateEditor is absent", () => {
    const tracked = makeTrackedType("quiz", false);
    const registry = makeRegistry(tracked);
    const { rerender } = render(
      <ContentTypeEditor
        contentTypeId="quiz"
        registry={registry}
        data={{ question: "v1" }}
        onChange={vi.fn()}
      />,
    );
    rerender(
      <ContentTypeEditor
        contentTypeId="quiz"
        registry={registry}
        data={{ question: "v2" }}
        onChange={vi.fn()}
      />,
    );
    expect(tracked.unmount).toHaveBeenCalledTimes(1);
    expect(tracked.renderEditor).toHaveBeenCalledTimes(2);
    const body = document.querySelector(
      '[data-testid="content-type-editor"]',
    ) as HTMLElement;
    expect(body?.textContent).toBe("v2");
  });

  it("unmounts the previous type on a type switch", () => {
    const quiz = makeTrackedType("quiz");
    const poll = makeTrackedType("poll");
    const registry = makeRegistry(quiz, poll);
    const { rerender } = render(
      <ContentTypeEditor
        contentTypeId="quiz"
        registry={registry}
        data={{ question: "Q" }}
        onChange={vi.fn()}
      />,
    );
    rerender(
      <ContentTypeEditor
        contentTypeId="poll"
        registry={registry}
        data={{ question: "Q" }}
        onChange={vi.fn()}
      />,
    );
    expect(quiz.unmount).toHaveBeenCalledTimes(1);
    expect(poll.renderEditor).toHaveBeenCalledTimes(1);
    const quizUnmountOrder = quiz.unmount.mock.invocationCallOrder[0];
    const pollRenderOrder = poll.renderEditor.mock.invocationCallOrder[0];
    if (quizUnmountOrder === undefined || pollRenderOrder === undefined) {
      throw new Error("expected unmount and render to be called");
    }
    expect(quizUnmountOrder).toBeLessThan(pollRenderOrder);
  });

  it("renders nothing for an unregistered type", () => {
    const { container } = render(
      <ContentTypeEditor
        contentTypeId="missing"
        registry={makeRegistry()}
        data={{ question: "Q" }}
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[data-testid="content-type-editor"]'),
    ).toBeNull();
  });
});
