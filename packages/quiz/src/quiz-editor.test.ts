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

function radiosOf(container: HTMLElement): HTMLInputElement[] {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>(".quiz-option-correct"),
  );
}

function check(radio: HTMLInputElement): void {
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Resolves the control a `<label>` with exactly `text` points at. */
function getByLabelText(root: Element, text: string): Element | null {
  const label = Array.from(root.querySelectorAll("label")).find(
    (l) => l.textContent === text,
  );
  return label?.control ?? null;
}

describe("QuizEditorType", () => {
  it("mounts the question tabs, question input, answer inputs, media inputs, and correct-answer radios", () => {
    const { container } = mountEditor(CANONICAL);

    const question = query<HTMLInputElement>(container, ".quiz-question");
    expect(question.value).toBe("What?");

    const optionTexts = container.querySelectorAll(".quiz-option-text");
    expect(optionTexts.length).toBe(3);

    expect(container.querySelector(".quiz-question-media-src")).not.toBeNull();
    expect(container.querySelector(".quiz-question-media-alt")).not.toBeNull();

    expect(container.querySelector(".quiz-correct-answer")).toBeNull();
    const radios = radiosOf(container);
    expect(radios.length).toBe(3);
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]);

    const tabs = container.querySelectorAll(".quiz-question-tab");
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.textContent).toBe("Question 1");
  });

  it("injects the shared Interlace stylesheet and uses its classes", () => {
    const { container } = mountEditor(CANONICAL);
    expect(document.getElementById("interlace-styles")).not.toBeNull();
    expect(
      query<HTMLButtonElement>(container, ".quiz-add-question").className,
    ).toContain("interlace-btn--secondary");
    expect(
      query<HTMLInputElement>(container, ".quiz-question").className,
    ).toContain("interlace-input");
    const removeOption = query<HTMLButtonElement>(
      container,
      ".quiz-option-remove",
    );
    expect(removeOption.className).toContain("interlace-btn--ghost");
    expect(removeOption.className).not.toContain("interlace-btn--danger");
  });

  it("labels the question, options section and each option", () => {
    const { container } = mountEditor(CANONICAL);
    expect(getByLabelText(container, "Question")).toBe(
      query(container, ".quiz-question"),
    );
    const optionInputs = container.querySelectorAll(".quiz-option-text");
    optionInputs.forEach((input, i) => {
      expect(getByLabelText(container, `Option ${i + 1}`)).toBe(input);
      expect((input as HTMLInputElement).placeholder).toBe("Option text");
    });
    expect(query(container, ".quiz-options-heading").textContent).toBe(
      "Options",
    );
    expect(query(container, ".quiz-options-hint").textContent).toBe(
      "Select the correct answer.",
    );
    const group = query(container, '[role="radiogroup"]');
    expect(group.getAttribute("aria-labelledby")).toBe(
      query(container, ".quiz-options-heading").id,
    );
    expect(
      radiosOf(container).map((r) => r.getAttribute("aria-label")),
    ).toEqual([
      "Mark option 1 as correct",
      "Mark option 2 as correct",
      "Mark option 3 as correct",
    ]);
  });

  it("renders question tabs as an accessible tab list", () => {
    const { container } = mountEditor(MULTI);
    const tablist = query(container, '[role="tablist"]');
    const tabs = Array.from(
      tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
    ]);
    expect(tabs[0]?.className).toContain("interlace-btn--primary");
    expect(tabs[1]?.className).toContain("interlace-btn--secondary");
    const panel = query(container, '[role="tabpanel"]');
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs[0]?.id);

    tabs[0]?.focus();
    tabs[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    const after = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(after[1]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(after[1]);
    expect(query<HTMLInputElement>(container, ".quiz-question").value).toBe(
      "Second",
    );
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
    expect(radiosOf(container).map((r) => r.checked)).toEqual([true]);

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
      options: [
        { id: "q-3-a", text: "" },
        { id: "q-3-b", text: "" },
      ],
      correctOptionId: "q-3-a",
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
    expect(query<HTMLInputElement>(container, ".quiz-question").value).toBe(
      "First",
    );
  });

  it("removes the selected question and selects the first remaining", () => {
    const { container, onChange } = mountEditor(MULTI);
    const tabs = container.querySelectorAll(".quiz-question-tab");
    (tabs[1] as HTMLButtonElement).click(); // select "Second"
    const remove = query<HTMLButtonElement>(container, ".quiz-question-remove");
    expect(remove.getAttribute("aria-label")).toBe("Remove question 2");
    remove.click();

    const data = lastEmitted(onChange);
    expect(data.questions.map((q) => q.id)).toEqual(["q-1"]);
    // First remaining question is now active.
    expect(query<HTMLInputElement>(container, ".quiz-question").value).toBe(
      "First",
    );
  });

  it("does not allow removing the last question", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const remove = query<HTMLButtonElement>(container, ".quiz-question-remove");
    expect(remove.disabled).toBe(true);
    expect(remove.title).toBe("A quiz needs at least one question");
    remove.click();
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".quiz-question-tab").length).toBe(1);
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
      questions: [{ id: "q-0", text: "Q", options: [], correctOptionId: null }],
    });
    const add = query<HTMLButtonElement>(container, ".quiz-add-option");
    add.click();

    const data = lastEmitted(onChange);
    expect(data.questions[0]?.options).toEqual([{ id: "opt-0", text: "" }]);
    expect(data.questions[0]?.correctOptionId).toBe("opt-0");
  });

  it("reports correct-answer changes through the answer radios", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const radios = radiosOf(container);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    check(radios[0]!);

    expect(lastEmitted(onChange).questions[0]?.correctOptionId).toBe("a");
  });

  it("updateEditor moves the checked radio to the new correct answer", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    QuizEditorType.updateEditor?.(
      container,
      {
        questions: [{ ...CANONICAL.questions[0]!, correctOptionId: "b" }],
      },
      onChange,
    );
    expect(radiosOf(container).map((r) => r.checked)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("disables option removal below two options", () => {
    const { container } = mountEditor(MULTI);
    const removes = container.querySelectorAll<HTMLButtonElement>(
      ".quiz-option-remove",
    );
    expect(removes.length).toBe(2);
    removes.forEach((button, i) => {
      expect(button.disabled).toBe(true);
      expect(button.title).toBe("A question needs at least 2 options");
      expect(button.getAttribute("aria-label")).toBe(`Remove option ${i + 1}`);
    });
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

  it("tucks question media behind an Add image button that reveals labelled fields", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const add = query<HTMLButtonElement>(container, ".quiz-question-media-add");
    const panel = query<HTMLElement>(container, ".quiz-question-media-panel");
    expect(add.textContent).toContain("Add image");
    expect(add.getAttribute("aria-expanded")).toBe("false");
    expect(panel.style.display).toBe("none");

    add.click();
    expect(panel.style.display).not.toBe("none");
    expect(add.style.display).toBe("none");
    expect(add.getAttribute("aria-expanded")).toBe("true");
    const src = query<HTMLInputElement>(container, ".quiz-question-media-src");
    expect(document.activeElement).toBe(src);
    expect(getByLabelText(panel, "Image URL")).toBe(src);
    expect(getByLabelText(panel, "Image description (alt text)")).toBe(
      query(container, ".quiz-question-media-alt"),
    );
    // Expanding alone does not change data.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removing an image clears both fields, emits no media and collapses", () => {
    const { container, onChange } = mountEditor({
      questions: [
        {
          ...CANONICAL.questions[0]!,
          media: { src: "q.png", alt: "Q art" },
        },
      ],
    });
    const panel = query<HTMLElement>(container, ".quiz-question-media-panel");
    // Existing media shows the fields expanded automatically.
    expect(panel.style.display).not.toBe("none");
    expect(
      query<HTMLInputElement>(container, ".quiz-question-media-src").value,
    ).toBe("q.png");

    query<HTMLButtonElement>(container, ".quiz-question-media-remove").click();
    expect(lastEmitted(onChange).questions[0]?.media).toBeUndefined();
    expect(panel.style.display).toBe("none");
    expect(
      query<HTMLInputElement>(container, ".quiz-question-media-src").value,
    ).toBe("");
    expect(
      query<HTMLInputElement>(container, ".quiz-question-media-alt").value,
    ).toBe("");
    expect(container.querySelector(".quiz-question-media-preview")).toBeNull();
  });

  it("renders a live question media preview and removes it on empty src", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    query<HTMLButtonElement>(container, ".quiz-question-media-add").click();
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

    // Only the option with media starts expanded.
    const panels = container.querySelectorAll<HTMLElement>(
      ".quiz-option-media-panel",
    );
    expect(panels[0]?.style.display).not.toBe("none");
    expect(panels[1]?.style.display).toBe("none");
    expect(
      container
        .querySelectorAll(".quiz-option-media-add")[1]
        ?.getAttribute("aria-label"),
    ).toBe("Add image to option 2");

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

  it("shows the question error only after the field is blurred", () => {
    const { container } = mountEditor(CANONICAL);
    const question = query<HTMLInputElement>(container, ".quiz-question");
    const error = query<HTMLElement>(container, ".quiz-question-error");

    type(question, "");
    expect(error.style.display).toBe("none");
    expect(question.hasAttribute("aria-invalid")).toBe(false);

    question.dispatchEvent(new Event("blur"));
    expect(error.style.display).not.toBe("none");
    expect(error.textContent).toBe("Add the question text");
    expect(question.getAttribute("aria-invalid")).toBe("true");
    expect(question.getAttribute("aria-describedby")).toBe(error.id);

    type(question, "Fixed");
    expect(error.style.display).toBe("none");
    expect(question.hasAttribute("aria-invalid")).toBe(false);
    expect(question.hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows an option error after blur and keeps it across updateEditor", () => {
    const { container, onChange } = mountEditor(CANONICAL);
    const answers =
      container.querySelectorAll<HTMLInputElement>(".quiz-option-text");
    type(answers[1]!, "");
    answers[1]!.dispatchEvent(new Event("blur"));

    const errors =
      container.querySelectorAll<HTMLElement>(".quiz-option-error");
    expect(errors[1]?.textContent).toBe("Option 2 needs text");
    expect(answers[1]?.getAttribute("aria-invalid")).toBe("true");
    expect(answers[0]?.hasAttribute("aria-invalid")).toBe(false);

    const q = CANONICAL.questions[0]!;
    QuizEditorType.updateEditor?.(
      container,
      {
        questions: [
          {
            ...q,
            options: [
              q.options[0]!,
              { ...q.options[1]!, text: "" },
              q.options[2]!,
            ],
          },
        ],
      },
      onChange,
    );
    expect(errors[1]?.style.display).not.toBe("none");
  });

  it("reports a maximum score of the question count", () => {
    expect(QuizEditorType.getMaximumScore(CANONICAL)).toBe(1);
    expect(QuizEditorType.getMaximumScore(MULTI)).toBe(2);
  });
});
