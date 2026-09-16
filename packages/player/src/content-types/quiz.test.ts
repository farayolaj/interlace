import { describe, expect, it, vi, afterEach } from "vitest";
import {
  QuizContentType,
  renderQuizPlayback,
  unmountQuizPlayback,
  type QuizData,
} from "./quiz";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Canonical single-question quiz data. */
const QUIZ_DATA: QuizData = {
  questions: [
    {
      id: "q-0",
      text: "What is 2 + 2?",
      options: [
        { id: "opt-0", text: "3" },
        { id: "opt-1", text: "4" },
        { id: "opt-2", text: "5" },
      ],
      correctOptionId: "opt-1",
    },
  ],
};

function renderIntoContainer(data: QuizData = QUIZ_DATA) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const onComplete = vi.fn();
  renderQuizPlayback(container, data, { onComplete });
  const question = container.querySelector(
    ".quiz-playback-question",
  ) as HTMLElement;
  const options = [
    ...container.querySelectorAll(".quiz-playback-option"),
  ] as HTMLButtonElement[];
  const nextButton = container.querySelector(
    ".quiz-playback-next",
  ) as HTMLButtonElement | null;
  return { container, onComplete, question, options, nextButton };
}

describe("QuizContentType", () => {
  it("getMaximumScore returns the question count (one point per question)", () => {
    expect(QuizContentType.getMaximumScore(QUIZ_DATA)).toBe(1);
  });

  it("is registered as quiz-editor (the editor package's authoring id)", () => {
    expect(QuizContentType.getId()).toBe("quiz-editor");
  });

  it("renders the question and one enabled option per choice", () => {
    const { question, options } = renderIntoContainer();
    expect(question.textContent).toBe("What is 2 + 2?");
    expect(options.map((option) => option.textContent)).toEqual([
      "3",
      "4",
      "5",
    ]);
    expect(options.every((option) => !option.disabled)).toBe(true);
  });

  it("selecting the correct option reveals, locks, and completes with 1 via Next", () => {
    const { onComplete, options, nextButton } = renderIntoContainer();
    options[1]!.click();
    // No auto-completion: submission is the explicit Next button.
    expect(onComplete).not.toHaveBeenCalled();
    expect(options.every((option) => option.disabled)).toBe(true);
    expect(nextButton?.disabled).toBe(false);
    nextButton!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(1);
  });

  it("selecting an incorrect option reveals the answer, marks, and completes with zero", () => {
    const { onComplete, options, nextButton } = renderIntoContainer();
    options[0]!.click();
    // The correct option is revealed, the wrong selection is marked.
    expect(options[1]!.classList.contains("quiz-playback-option-correct")).toBe(
      true,
    );
    expect(
      options[0]!.classList.contains("quiz-playback-option-incorrect"),
    ).toBe(true);
    // Answering once locks the options (further clicks change nothing).
    options[2]!.click();
    nextButton!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(0);
  });

  it("unmountPlayback clears the container and allows re-render", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderQuizPlayback(container, QUIZ_DATA, { onComplete: vi.fn() });
    expect(container.querySelector(".quiz-playback")).not.toBeNull();

    unmountQuizPlayback(container);
    expect(container.textContent).toBe("");

    // Re-render works after unmount.
    renderQuizPlayback(container, QUIZ_DATA, { onComplete: vi.fn() });
    expect(container.querySelector(".quiz-playback-question")).not.toBeNull();
  });

  it("renders defensively when correctness is unresolved (correctOptionId null → 0)", () => {
    // No resolvable correct option means nothing is marked correct and the
    // answer contributes no points.
    const data: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "No answer",
          options: [
            { id: "a", text: "a" },
            { id: "b", text: "b" },
          ],
          correctOptionId: null,
        },
      ],
    };
    const { onComplete, options, nextButton } = renderIntoContainer(data);
    options[1]!.click();
    nextButton!.click();
    expect(onComplete).toHaveBeenCalledWith(0);
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
  });

  it("renders zero options for an empty options list without throwing", () => {
    const bad: QuizData = {
      questions: [
        { id: "q-0", text: "Broken", options: [], correctOptionId: null },
      ],
    };
    const { onComplete, options, nextButton } = renderIntoContainer(bad);
    expect(options.length).toBe(0);
    expect(nextButton?.disabled).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("marks no correct option for a correctOptionId referencing a missing option", () => {
    // A canonical document may name a correct option id that does not
    // exist; the renderer treats it as unresolved → every answer scores 0.
    const data: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "Q",
          options: [
            { id: "a", text: "a" },
            { id: "b", text: "b" },
          ],
          correctOptionId: "nope",
        },
      ],
    };
    const { onComplete, options, nextButton } = renderIntoContainer(data);
    options[0]!.click();
    nextButton!.click();
    expect(onComplete).toHaveBeenCalledWith(0);
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
  });

  it("renderEditor produces a question input that reports changes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    QuizContentType.renderEditor(container, QUIZ_DATA, onChange);

    const input = container.querySelector(".quiz-question") as HTMLInputElement;
    expect(input.value).toBe("What is 2 + 2?");
    input.value = "New question";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        questions: [expect.objectContaining({ text: "New question" })],
      }),
    );

    QuizContentType.unmount?.(container);
    expect(container.textContent).toBe("");
  });
});