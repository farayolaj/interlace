import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { QuizEditorType } from "./quiz-editor";
import type { QuizData, QuizQuestionSpec } from "./schema";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Canonical single-question input. */
const CANONICAL: QuizData = {
  questions: [
    {
      id: "q-0",
      text: "What?",
      options: [
        { id: "a", text: "Alpha" },
        { id: "b", text: "Beta" },
        { id: "c", text: "Gamma" },
      ],
      correctOptionId: "c",
    },
  ],
};

/** Canonical multi-question input. */
const MULTI: QuizData = {
  questions: [
    {
      id: "q-1",
      text: "First",
      options: [
        { id: "f-a", text: "F A" },
        { id: "f-b", text: "F B" },
      ],
      correctOptionId: "f-b",
    },
    {
      id: "q-2",
      text: "Second",
      options: [{ id: "s-a", text: "S A" }],
      correctOptionId: "s-a",
    },
  ],
};

function query<T extends Element>(container: HTMLElement, selector: string): T {
  const el = container.querySelector(selector);
  if (!el) throw new Error(`expected element for selector ${selector}`);
  return el as T;
}

function mountEditor(data: QuizData) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const onChange: Mock<(next: QuizData) => void> = vi.fn();
  QuizEditorType.renderEditor(container, data, onChange);
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
  it("mounts the question tabs, question input, option text inputs, media inputs, and correct-answer select", () => {
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

    const tabs = container.querySelectorAll(".quiz-question-tab");
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.textContent).toBe("Question 1");
  });

  it("emits canonical multi-question QuizData when the question text changes", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const question = query<HTMLInputElement>(container, ".quiz-question");
    type(question, "New Q");

    const data = lastEmitted(onChange);
    expect(data.questions.length).toBe(1);
    expect(data.questions[0]).toMatchObject({ text: "New Q" });
    expect(data.questions[0]?.options).toEqual(CANONICAL.questions[0]?.options);
    expect(data.questions[0]?.correctOptionId).toBe("c");
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

  it("mounts canonical multi-question data and edits the active question", () => {
    const { container, onChange } = mountEditor(MULTI);
    const tabs = container.querySelectorAll(".quiz-question-tab");
    (tabs[1] as HTMLButtonElement).click();

    const question = query<HTMLInputElement>(container, ".quiz-question");
    expect(question.value).toBe("Second");
    const select = query<HTMLSelectElement>(container, ".quiz-correct-answer");
    expect(select.selectedOptions[0]?.value).toBe("s-a");

    type(question, "Edited");
    const data = lastEmitted(onChange);
    expect(data.questions.length).toBe(2);
    expect(data.questions[1]).toEqual({
      id: "q-2",
      text: "Edited",
      options: [{ id: "s-a", text: "S A" }],
      correctOptionId: "s-a",
    });
    expect(data.questions[0]).toEqual(MULTI.questions[0]);
  });

  it("adds a question with a generated id and selects it", () => {
    const { container, onChange } = mountEditor(MULTI);
    const add = query<HTMLButtonElement>(container, ".quiz-add-question");
    add.click();

    const data = lastEmitted(onChange);
    expect(data.questions.length).toBe(3);
    expect(data.questions[2]).toEqual({
      id: "q-3",
      text: "",
      options: [],
      correctOptionId: null,
    });
    expect(data.questions[0]?.id).toBe("q-1");
    expect(data.questions[1]?.id).toBe("q-2");

    // The newly added (now selected) question's empty body is shown.
    const question = query<HTMLInputElement>(container, ".quiz-question");
    expect(question.value).toBe("");
  });

  it("switching the selected question preserves each question's values", () => {
    const { container, onChange } = mountEditor(MULTI);
    const tabs = container.querySelectorAll(".quiz-question-tab");
    (tabs[1] as HTMLButtonElement).click();

    const question = query<HTMLInputElement>(container, ".quiz-question");
    expect(question.value).toBe("Second");
    const optionTexts = container.querySelectorAll(".quiz-option-text");
    expect(optionTexts.length).toBe(1);
    expect((optionTexts[0] as HTMLInputElement).value).toBe("S A");

    type(question, "Second edited");
    const data = lastEmitted(onChange);
    expect(data.questions[0]?.text).toBe("First"); // untouched
    expect(data.questions[1]?.text).toBe("Second edited");

    // Switch back: first question's values intact.
    const tabsAfter = container.querySelectorAll(".quiz-question-tab");
    (tabsAfter[0] as HTMLButtonElement).click();
    expect(
      query<HTMLInputElement>(container, ".quiz-question").value,
    ).toBe("First");
  });

  it("removes the selected question and selects the first remaining", () => {
    const { container, onChange } = mountEditor(MULTI);
    const tabs = container.querySelectorAll(".quiz-question-tab");
    (tabs[1] as HTMLButtonElement).click(); // select "Second"
    const removeButtons = container.querySelectorAll(".quiz-question-remove");
    (removeButtons[1] as HTMLButtonElement).click();

    const data = lastEmitted(onChange);
    expect(data.questions.map((q) => q.id)).toEqual(["q-1"]);
    // First remaining question is now active.
    expect(query<HTMLInputElement>(container, ".quiz-question").value).toBe(
      "First",
    );
  });

  it("removing a non-active question keeps the current selection", () => {
    const { container, onChange } = mountEditor(MULTI);
    const tabs = container.querySelectorAll(".quiz-question-tab");
    (tabs[1] as HTMLButtonElement).click(); // select "Second"
    const removeButtons = container.querySelectorAll(".quiz-question-remove");
    (removeButtons[0] as HTMLButtonElement).click(); // remove "First"

    const data = lastEmitted(onChange);
    expect(data.questions.map((q) => q.id)).toEqual(["q-2"]);
    // The selection slides to the first remaining question ("Second").
    expect(query<HTMLInputElement>(container, ".quiz-question").value).toBe(
      "Second",
    );
  });

  it("never leaves the form without a question (last remove keeps a stub)", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const removeButtons = container.querySelectorAll(".quiz-question-remove");
    (removeButtons[0] as HTMLButtonElement).click();

    const data = lastEmitted(onChange);
    expect(data.questions.length).toBe(1);
    expect(data.questions[0]).toMatchObject({ text: "", options: [] });

    const tabs = container.querySelectorAll(".quiz-question-tab");
    expect(tabs.length).toBe(1);
  });

  it("adds an option with a generated id via the Add option button", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const add = query<HTMLButtonElement>(container, ".quiz-add-option");
    add.click();

    const data = lastEmitted(onChange);
    const active = data.questions[0]!;
    expect(active.options.length).toBe(4);
    expect(active.options[3]).toEqual({ id: "opt-3", text: "" });
    expect(active.correctOptionId).toBe("c");
  });

  it("defaults the first added option to correct when no correctness exists", () => {
    const { container, onChange } = mountEditor({
      questions: [
        { id: "q-0", text: "Q", options: [], correctOptionId: null },
      ],
    });
    const add = query<HTMLButtonElement>(container, ".quiz-add-option");
    add.click();

    const data = lastEmitted(onChange);
    expect(data.questions[0]?.options).toEqual([{ id: "opt-0", text: "" }]);
    expect(data.questions[0]?.correctOptionId).toBe("opt-0");
  });

  it("reports correct-answer changes through the select", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const select = query<HTMLSelectElement>(container, ".quiz-correct-answer");
    select.value = "a";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(lastEmitted(onChange).questions[0]?.correctOptionId).toBe("a");
  });

  it("removing a non-correct option keeps the remaining options and correctness", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const removeButtons = container.querySelectorAll(".quiz-option-remove");
    (removeButtons[0] as HTMLButtonElement).click();

    const data = lastEmitted(onChange);
    const active = data.questions[0]!;
    expect(active.options.map((o) => o.id)).toEqual(["b", "c"]);
    expect(active.options.map((o) => o.text)).toEqual(["Beta", "Gamma"]);
    expect(active.correctOptionId).toBe("c");
  });

  it("removing the correct option clears correctOptionId instead of shifting it", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const removeButtons = container.querySelectorAll(".quiz-option-remove");
    (removeButtons[2] as HTMLButtonElement).click();

    const data = lastEmitted(onChange);
    const active = data.questions[0]!;
    expect(active.options.map((o) => o.id)).toEqual(["a", "b"]);
    expect(active.correctOptionId).toBeNull();
  });

  it("preserves custom option ids across text edits", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const optionTexts = container.querySelectorAll(".quiz-option-text");
    type(optionTexts[0] as HTMLInputElement, "AlphaPrime");

    const data = lastEmitted(onChange);
    const active = data.questions[0]!;
    expect(active.options[0]).toEqual({ id: "a", text: "AlphaPrime" });
    expect(active.options[1]?.id).toBe("b");
    expect(active.options[2]?.id).toBe("c");
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
    expect(lastEmitted(onChange).questions[0]?.media).toEqual({
      src: "https://example.com/q.png",
      alt: "Question art",
    });

    type(srcInput, "");
    expect(container.querySelector(".quiz-question-media-preview")).toBeNull();
    expect(lastEmitted(onChange).questions[0]?.media).toBeUndefined();
  });

  it("renders an option thumbnail preview on mount and drops it on empty src", () => {
    const withMedia: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "Q",
          options: [
            { id: "a", text: "A", media: { src: "thumb.png", alt: "T" } },
            { id: "b", text: "B" },
          ],
          correctOptionId: "a",
        },
      ],
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

  it("updateEditor patches in place and preserves focus within the active question", () => {
    const { container, onChange } = mountEditor(MULTI);
    const question = query<HTMLInputElement>(container, ".quiz-question");
    question.focus();

    // Patch the ACTIVE question's first option text in place.
    const updated: QuizData = {
      questions: [
        {
          ...MULTI.questions[0]!,
          options: [
            { ...MULTI.questions[0]!.options[0]!, text: "Updated" },
            MULTI.questions[0]!.options[1]!,
          ],
        } as QuizQuestionSpec,
        MULTI.questions[1]!,
      ],
    };
    QuizEditorType.updateEditor?.(container, updated, onChange);

    // Focus survives the patch (the active input is updated in place).
    expect(document.activeElement).toBe(question);
    const optionTexts = container.querySelectorAll(".quiz-option-text");
    expect((optionTexts[0] as HTMLInputElement).value).toBe("Updated");
    expect(question.value).toBe("First");
  });

  it("emits canonical multi through onChange when a non-active question is untouched by edits", () => {
    const { container, onChange } = mountEditor(MULTI);
    const tabs = container.querySelectorAll(".quiz-question-tab");
    (tabs[1] as HTMLButtonElement).click();

    const add = query<HTMLButtonElement>(container, ".quiz-add-option");
    add.click();

    const data = lastEmitted(onChange);
    expect(data.questions[0]?.options).toEqual(MULTI.questions[0]?.options);
    expect(data.questions[1]?.options).toEqual([
      { id: "s-a", text: "S A" },
      { id: "opt-1", text: "" },
    ]);
    expect(data.questions[1]?.correctOptionId).toBe("s-a");
  });

  it("reports a maximum score of the question count", () => {
    expect(QuizEditorType.getMaximumScore(CANONICAL)).toBe(1);
    expect(QuizEditorType.getMaximumScore(MULTI)).toBe(2);
  });
});