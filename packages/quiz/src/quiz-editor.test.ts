import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { QuizEditorType } from "./quiz-editor";
import type { QuizData, RawQuizData } from "./schema";

afterEach(() => {
  document.body.innerHTML = "";
});

const CANONICAL: QuizData = {
  question: { text: "What?" },
  options: [
    { id: "a", text: "Alpha" },
    { id: "b", text: "Beta" },
    { id: "c", text: "Gamma" },
  ],
  correctOptionId: "c",
};

function query<T extends Element>(container: HTMLElement, selector: string): T {
  const el = container.querySelector(selector);
  if (!el) throw new Error(`expected element for selector ${selector}`);
  return el as T;
}

function mountEditor(raw: QuizData | RawQuizData) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const onChange: Mock<(next: QuizData) => void> = vi.fn();
  QuizEditorType.renderEditor(
    container,
    raw as unknown as QuizData,
    onChange,
  );
  return { container, onChange };
}

function lastEmitted(onChange: Mock<(next: QuizData) => void>): QuizData {
  const call = onChange.mock.calls[onChange.mock.calls.length - 1];
  if (!call) throw new Error("expected at least one onChange call");
  return call[0];
}

function type(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("QuizEditorType", () => {
  it("mounts the question input, option text inputs, media inputs, and correct-answer select", () => {
    const { container } = mountEditor(CANONICAL);

    const question = query<HTMLInputElement>(container, ".quiz-question");
    expect(question.value).toBe("What?");

    const optionTexts = container.querySelectorAll(".quiz-option-text");
    expect(optionTexts.length).toBe(3);

    expect(
      container.querySelector(".quiz-question-media-src"),
    ).not.toBeNull();
    expect(
      container.querySelector(".quiz-question-media-alt"),
    ).not.toBeNull();

    const select = query<HTMLSelectElement>(container, ".quiz-correct-answer");
    expect(select.options.length).toBe(3);
    expect(select.selectedOptions[0]?.value).toBe("c");
  });

  it("emits canonical QuizData when the question text changes", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const question = query<HTMLInputElement>(container, ".quiz-question");
    type(question, "New Q");

    const data = lastEmitted(onChange);
    expect(data.question).toMatchObject({ text: "New Q" });
    expect(data.options).toEqual(CANONICAL.options);
    expect(data.correctOptionId).toBe("c");
  });

  it("keeps focus in the question input across keystrokes", () => {
    const { container } = mountEditor(CANONICAL);
    const question = query<HTMLInputElement>(container, ".quiz-question");
    question.focus();
    type(question, "H");
    type(question, "He");
    type(question, "Hel");
    expect(document.activeElement).toBe(question);
  });

  it("mounts legacy raw documents through normalization and emits canonical on edit", () => {
    const legacy: RawQuizData = {
      question: "Q?",
      options: ["a", "b"],
      correctIndex: 1,
    };
    const { container, onChange } = mountEditor(legacy);

    const question = query<HTMLInputElement>(container, ".quiz-question");
    expect(question.value).toBe("Q?");

    const select = query<HTMLSelectElement>(container, ".quiz-correct-answer");
    expect(select.selectedOptions[0]?.value).toBe("opt-1");

    type(question, "Edited");
    const data = lastEmitted(onChange);
    expect(data.question).toEqual({ text: "Edited" });
    expect(data.options).toEqual([
      { id: "opt-0", text: "a" },
      { id: "opt-1", text: "b" },
    ]);
    expect(data.correctOptionId).toBe("opt-1");
  });

  it("adds an option with a generated id via the Add option button", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const add = query<HTMLButtonElement>(container, ".quiz-add-option");
    add.click();

    const data = lastEmitted(onChange);
    expect(data.options.length).toBe(4);
    expect(data.options[3]).toEqual({ id: "opt-3", text: "" });
    expect(data.correctOptionId).toBe("c");
  });

  it("defaults the first added option to correct when no correctness exists", () => {
    const { container, onChange } = mountEditor({
      question: { text: "Q" },
      options: [],
      correctOptionId: null,
    });
    const add = query<HTMLButtonElement>(container, ".quiz-add-option");
    add.click();

    const data = lastEmitted(onChange);
    expect(data.options).toEqual([{ id: "opt-0", text: "" }]);
    expect(data.correctOptionId).toBe("opt-0");
  });

  it("reports correct-answer changes through the select", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const select = query<HTMLSelectElement>(container, ".quiz-correct-answer");
    select.value = "a";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(lastEmitted(onChange).correctOptionId).toBe("a");
  });

  it("removing a non-correct option keeps the remaining options and correctness", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const removeButtons = container.querySelectorAll(".quiz-option-remove");
    (removeButtons[0] as HTMLButtonElement).click();

    const data = lastEmitted(onChange);
    expect(data.options.map((o) => o.id)).toEqual(["b", "c"]);
    expect(data.options.map((o) => o.text)).toEqual(["Beta", "Gamma"]);
    expect(data.correctOptionId).toBe("c");
  });

  it("removing the correct option clears correctOptionId instead of shifting it", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const removeButtons = container.querySelectorAll(".quiz-option-remove");
    (removeButtons[2] as HTMLButtonElement).click();

    const data = lastEmitted(onChange);
    expect(data.options.map((o) => o.id)).toEqual(["a", "b"]);
    expect(data.correctOptionId).toBeNull();
  });

  it("preserves custom option ids across text edits", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const optionTexts = container.querySelectorAll(".quiz-option-text");
    type(optionTexts[0] as HTMLInputElement, "AlphaPrime");

    const data = lastEmitted(onChange);
    expect(data.options[0]).toEqual({ id: "a", text: "AlphaPrime" });
    expect(data.options[1]?.id).toBe("b");
    expect(data.options[2]?.id).toBe("c");
  });

  it("renders a live question media preview and removes it on empty src", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const srcInput = query<HTMLInputElement>(
      container,
      ".quiz-question-media-src",
    );
    const altInput = query<HTMLInputElement>(
      container,
      ".quiz-question-media-alt",
    );

    type(srcInput, "https://example.com/q.png");
    type(altInput, "Question art");

    const preview = query<HTMLImageElement>(
      container,
      ".quiz-question-media-preview",
    );
    expect(preview.getAttribute("src")).toBe("https://example.com/q.png");
    expect(preview.getAttribute("alt")).toBe("Question art");
    expect(lastEmitted(onChange).question.media).toEqual({
      src: "https://example.com/q.png",
      alt: "Question art",
    });

    type(srcInput, "");
    expect(container.querySelector(".quiz-question-media-preview")).toBeNull();
    expect(lastEmitted(onChange).question.media).toBeUndefined();
  });

  it("renders an option thumbnail preview on mount and drops it on empty src", () => {
    const withMedia: QuizData = {
      question: { text: "Q" },
      options: [
        { id: "a", text: "A", media: { src: "thumb.png", alt: "T" } },
        { id: "b", text: "B" },
      ],
      correctOptionId: "a",
    };
    const { container } = mountEditor(withMedia);

    const firstRowPreview = container.querySelectorAll(
      ".quiz-option-media-preview",
    )[0];
    const thumb = firstRowPreview?.querySelector(
      ".quiz-option-thumb",
    ) as HTMLImageElement | null;
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute("src")).toBe("thumb.png");
    expect(thumb?.getAttribute("alt")).toBe("T");

    const secondRowPreview = container.querySelectorAll(
      ".quiz-option-media-preview",
    )[1];
    expect(secondRowPreview?.querySelector(".quiz-option-thumb")).toBeNull();

    // Emptying the src on the first option removes the thumbnail.
    const mediaSrcs = container.querySelectorAll(".quiz-option-media-src");
    type(mediaSrcs[0] as HTMLInputElement, "");
    const updatedRow = container.querySelectorAll(
      ".quiz-option-media-preview",
    )[0];
    expect(updatedRow?.querySelector(".quiz-option-thumb")).toBeNull();
  });

  it("updateEditor patches in place and preserves focus", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const question = query<HTMLInputElement>(container, ".quiz-question");
    question.focus();

    QuizEditorType.updateEditor?.(
      container,
      { ...CANONICAL, options: [{ ...CANONICAL.options[0]!, text: "Updated" }] },
      onChange,
    );

    // Focus survives the patch (the input is updated in place, not rebuilt).
    expect(document.activeElement).toBe(question);
    const optionTexts = container.querySelectorAll(".quiz-option-text");
    expect((optionTexts[0] as HTMLInputElement).value).toBe("Updated");
    expect(question.value).toBe("What?");
  });
});