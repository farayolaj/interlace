import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { ContentTypeEditorSlot } from "../components/content-type-editor-slot";
import { ContentTypeRegistry } from "@interlace/core";
import { QuizEditor } from "./quiz-editor";
import type { QuizData } from "./quiz-editor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The QuizEditor tests were originally colocated with
 * `InteractiveMediaAuthoring`. When that component is removed in Phase 3,
 * these tests would be orphaned, so they are ported here and mounted
 * directly through `ContentTypeEditorSlot` — which is exactly how the
 * editor composes the content type in production.
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
    <ContentTypeEditorSlot
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

describe("QuizEditor", () => {
  it("mounts the question input, options list, and correct-answer select", () => {
    const { container } = mountQuizEditor({
      data: { question: "What?", options: ["a", "b"], correctIndex: 0 },
    });

    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const question = editor.querySelector(".quiz-question");
    if (!(question instanceof HTMLInputElement)) {
      throw new Error("expected question input");
    }
    expect(question.value).toBe("What?");
    const options = editor.querySelectorAll('input[type="text"]');
    // The question input + two option inputs.
    expect(options.length).toBe(3);
    const select = editor.querySelector("select");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("expected select");
    }
    expect(select.options.length).toBe(2);
  });

  it("reports question edits through onChange", () => {
    const { container, onChange } = mountQuizEditor({
      data: { question: "", options: ["a", "b"], correctIndex: 0 },
    });
    const question = container.querySelector(".quiz-question") as HTMLInputElement | null;
    if (!question) throw new Error("expected question input");
    question.focus();
    fireEvent.input(question, { target: { value: "Hello" } });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ question: "Hello" });
  });

  it("keeps focus in the question input across keystrokes", () => {
    const { container } = mountQuizEditor({
      data: { question: "", options: ["a", "b"], correctIndex: 0 },
    });
    const question = container.querySelector(".quiz-question") as HTMLInputElement | null;
    if (!question) throw new Error("expected question input");
    question.focus();
    fireEvent.input(question, { target: { value: "H" } });
    fireEvent.input(question, { target: { value: "He" } });
    fireEvent.input(question, { target: { value: "Hel" } });
    expect(document.activeElement).toBe(question);
  });

  it("clamps correctIndex to the valid option range on sync", () => {
    // A 2-option document with correctIndex=5 is invalid; the controller
    // must clamp it to 0 so the emitted data never points at a missing
    // option.
    const { container } = mountQuizEditor({
      data: { question: "Q", options: ["a", "b"], correctIndex: 5 },
    });
    const select = container.querySelector("select") as HTMLSelectElement | null;
    if (!select) throw new Error("expected select");
    expect(select.selectedIndex).toBe(0);
  });

  it("adds a new option via the Add option button", () => {
    const { container, onChange } = mountQuizEditor({
      data: { question: "Q", options: ["a", "b"], correctIndex: 0 },
    });
    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const add = Array.from(editor.querySelectorAll("button")).find(
      (b) => b.textContent === "Add option",
    );
    if (!add) throw new Error("expected Add option button");
    fireEvent.click(add);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    const data = lastCall?.[0] as QuizData | undefined;
    expect(data?.options).toEqual(["a", "b", ""]);
  });

  it("adjusts correctIndex when an option is removed", async () => {
    // Start with 3 options, correctIndex=2 (the third). Remove the first
    // option; the correct answer shifts down to index 1, not 2.
    const { container, onChange } = mountQuizEditor({
      data: { question: "Q", options: ["a", "b", "c"], correctIndex: 2 },
    });
    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const removeButtons = Array.from(editor.querySelectorAll("button")).filter(
      (b) => b.textContent === "Remove",
    );
    if (removeButtons[0]) fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const data = lastCall?.[0] as QuizData | undefined;
      expect(data?.options).toEqual(["b", "c"]);
      expect(data?.correctIndex).toBe(1);
    });
  });

  it("clamps correctIndex to 0 when the removed option was the correct one", async () => {
    // Start with 3 options, correctIndex=0 (the first). Remove the first
    // option; the correct answer was removed, so the controller must
    // clamp to 0 (the new first option) rather than leaving a stale -1.
    const { container, onChange } = mountQuizEditor({
      data: { question: "Q", options: ["a", "b", "c"], correctIndex: 0 },
    });
    const editor = container.querySelector(".quiz-editor");
    if (!editor) throw new Error("expected quiz editor root");
    const removeButtons = Array.from(editor.querySelectorAll("button")).filter(
      (b) => b.textContent === "Remove",
    );
    if (removeButtons[0]) fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const data = lastCall?.[0] as QuizData | undefined;
      expect(data?.options).toEqual(["b", "c"]);
      expect(data?.correctIndex).toBe(0);
    });
  });

  it("reports the correctIndex change via the select", () => {
    const { container, onChange } = mountQuizEditor({
      data: { question: "Q", options: ["a", "b", "c"], correctIndex: 0 },
    });
    const select = container.querySelector("select") as HTMLSelectElement | null;
    if (!select) throw new Error("expected select");
    fireEvent.change(select, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ correctIndex: 2 });
  });

  it("returns getMaximumScore() = 100", () => {
    expect(QuizEditor.getMaximumScore({ question: "", options: [] })).toBe(100);
  });
});
