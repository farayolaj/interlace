import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { ContentTypeEditorSlot } from "../components/content-type-editor-slot";
import { ContentTypeRegistry } from "@interlacejs/core";
import { QuizEditor } from "./quiz-editor";
import type { QuizData } from "./quiz-editor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The QuizEditor tests mount directly through `ContentTypeEditorSlot` —
 * which is exactly how the editor composes the content type in production.
 * The editor authors the canonical multi-question shape; every emitted edit
 * is canonical.
 */

function mountQuizEditor({
  data,
  onChange,
}: {
  data: QuizData;
  onChange?: Mock<(next: QuizData) => void>;
}) {
  const registry = new ContentTypeRegistry();
  registry.register(QuizEditor);
  const handleChange: Mock<(next: QuizData) => void> =
    onChange ?? vi.fn<(next: QuizData) => void>();
  const result = render(
    <ContentTypeEditorSlot<QuizData>
      contentTypeId="quiz-editor"
      isOpen={true}
      onClose={vi.fn()}
      registry={registry}
      data={data}
      onChange={handleChange}
    />,
  );
  return { ...result, onChange: handleChange };
}

function lastEmitted(onChange: Mock<(next: QuizData) => void>): QuizData {
  const call = onChange.mock.calls[onChange.mock.calls.length - 1];
  if (!call) throw new Error("expected at least one onChange call");
  return call[0];
}

describe("QuizEditor", () => {
  it("mounts the question input, options list, and correct-answer select", () => {
    const { container } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "What?",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
            ],
            correctOptionId: "opt-0",
          },
        ],
      },
    });

    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const question = editor.querySelector(".quiz-question");
    if (!(question instanceof HTMLInputElement)) {
      throw new Error("expected question input");
    }
    expect(question.value).toBe("What?");
    // One option text input per option (media inputs are separate).
    const optionTexts = editor.querySelectorAll(".quiz-option-text");
    expect(optionTexts.length).toBe(2);
    const select = editor.querySelector("select");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("expected select");
    }
    expect(select.options.length).toBe(2);
  });

  it("reports question edits through onChange with canonical emission", () => {
    const { container, onChange } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
            ],
            correctOptionId: "opt-0",
          },
        ],
      },
    });
    const question = container.querySelector(".quiz-question") as HTMLInputElement | null;
    if (!question) throw new Error("expected question input");
    question.focus();
    fireEvent.input(question, { target: { value: "Hello" } });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({
      questions: [{ text: "Hello" }],
    });
  });

  it("keeps focus in the question input across keystrokes", () => {
    const { container } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
            ],
            correctOptionId: "opt-0",
          },
        ],
      },
    });
    const question = container.querySelector(".quiz-question") as HTMLInputElement | null;
    if (!question) throw new Error("expected question input");
    question.focus();
    fireEvent.input(question, { target: { value: "H" } });
    fireEvent.input(question, { target: { value: "He" } });
    fireEvent.input(question, { target: { value: "Hel" } });
    expect(document.activeElement).toBe(question);
  });

  it("edits a canonical multi-question document and emits canonical data", () => {
    const { container, onChange } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "Q",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
            ],
            correctOptionId: "opt-1",
          },
        ],
      },
    });
    const select = container.querySelector("select") as HTMLSelectElement | null;
    if (!select) throw new Error("expected select");
    expect(select.selectedOptions[0]?.value).toBe("opt-1");

    const question = container.querySelector(".quiz-question") as HTMLInputElement | null;
    if (!question) throw new Error("expected question input");
    fireEvent.input(question, { target: { value: "Edited" } });

    const data = lastEmitted(onChange);
    expect(data.questions[0]?.text).toBe("Edited");
    expect(data.questions[0]?.options).toEqual([
      { id: "opt-0", text: "a" },
      { id: "opt-1", text: "b" },
    ]);
    expect(data.questions[0]?.correctOptionId).toBe("opt-1");
  });

  it("adds a new option via the Add option button with a generated id", () => {
    const { container, onChange } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "Q",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
            ],
            correctOptionId: "opt-0",
          },
        ],
      },
    });
    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const add = Array.from(editor.querySelectorAll("button")).find(
      (b) => b.textContent === "Add option",
    );
    if (!add) throw new Error("expected Add option button");
    fireEvent.click(add);
    expect(onChange).toHaveBeenCalled();
    const data = lastEmitted(onChange);
    expect(data.questions[0]?.options).toEqual([
      { id: "opt-0", text: "a" },
      { id: "opt-1", text: "b" },
      { id: "opt-2", text: "" },
    ]);
    expect(data.questions[0]?.correctOptionId).toBe("opt-0");
  });

  it("removing a non-correct option keeps the remaining options and correctness", async () => {
    const { container, onChange } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "Q",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
              { id: "opt-2", text: "c" },
            ],
            correctOptionId: "opt-2",
          },
        ],
      },
    });
    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const removeButtons = Array.from(
      editor.querySelectorAll(".quiz-option-remove"),
    );
    if (removeButtons[0]) fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      const data = lastEmitted(onChange);
      expect(data.questions[0]?.options.map((o) => o.text)).toEqual(["b", "c"]);
      // Ids are preserved; the correct option (the third originally) keeps
      // its id rather than being shifted.
      expect(data.questions[0]?.correctOptionId).toBe("opt-2");
    });
  });

  it("removing the correct option clears correctOptionId", async () => {
    const { container, onChange } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "Q",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
              { id: "opt-2", text: "c" },
            ],
            correctOptionId: "opt-0",
          },
        ],
      },
    });
    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const removeButtons = Array.from(
      editor.querySelectorAll(".quiz-option-remove"),
    );
    if (removeButtons[0]) fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      const data = lastEmitted(onChange);
      expect(data.questions[0]?.options.map((o) => o.text)).toEqual(["b", "c"]);
      expect(data.questions[0]?.correctOptionId).toBeNull();
    });
  });

  it("reports the correct-answer change via the select", () => {
    const { container, onChange } = mountQuizEditor({
      data: {
        questions: [
          {
            id: "q-0",
            text: "Q",
            options: [
              { id: "opt-0", text: "a" },
              { id: "opt-1", text: "b" },
              { id: "opt-2", text: "c" },
            ],
            correctOptionId: "opt-0",
          },
        ],
      },
    });
    const select = container.querySelector("select") as HTMLSelectElement | null;
    if (!select) throw new Error("expected select");
    fireEvent.change(select, { target: { value: "opt-2" } });
    expect(onChange).toHaveBeenCalled();
    expect(lastEmitted(onChange).questions[0]?.correctOptionId).toBe("opt-2");
  });

  it("returns getMaximumScore() = the question count", () => {
    expect(
      QuizEditor.getMaximumScore({
        questions: [
          { id: "q-0", text: "", options: [], correctOptionId: null },
        ],
      }),
    ).toBe(1);
  });
});