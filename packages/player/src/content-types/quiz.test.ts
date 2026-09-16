import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QuizContentType,
  renderQuizPlayback,
  unmountQuizPlayback,
  type QuizData,
} from "./quiz";

afterEach(() => {
  document.body.innerHTML = "";
});

const QUIZ_DATA: QuizData = {
  question: "What is 2 + 2?",
  options: ["3", "4", "5"],
  correctIndex: 1,
};

/** Canonical-shaped data for the content-type-level surface (`getMaximumScore`, `renderEditor`). */
type CanonicalQuizData = Parameters<typeof QuizContentType.renderEditor>[1];
const CANONICAL_QUIZ_DATA: CanonicalQuizData = {
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
  const navButtons = [
    ...container.querySelectorAll(".quiz-playback-nav button"),
  ] as HTMLButtonElement[];
  // [0] = Previous (absent on the first question), last = Next/Complete.
  const completeButton = navButtons[navButtons.length - 1];
  return { container, onComplete, question, options, completeButton };
}

describe("QuizContentType", () => {
  it("getMaximumScore returns the maximum quiz score", () => {
    expect(QuizContentType.getMaximumScore(CANONICAL_QUIZ_DATA)).toBe(100);
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

  it("selecting the correct option reveals, locks, and completes with the maximum score", () => {
    const { onComplete, options, completeButton } = renderIntoContainer();
    options[1]!.click();
    // No auto-completion: submission is the explicit Complete button.
    expect(onComplete).not.toHaveBeenCalled();
    expect(options.every((option) => option.disabled)).toBe(true);
    expect(completeButton!.disabled).toBe(false);
    completeButton!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(100);
  });

  it("selecting an incorrect option reveals the answer, marks, and completes with zero", () => {
    const { onComplete, options, completeButton } = renderIntoContainer();
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
    completeButton!.click();
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

  it("renders defensively when correctIndex is unset (every answer scores 0)", () => {
    // The load-bearing compatibility case with editor documents that
    // predate an authored answer: unset correctIndex means no option
    // is correct and every answer scores 0.
    const data: QuizData = { question: "Legacy import", options: ["a", "b"] };
    const { onComplete, options, completeButton } = renderIntoContainer(data);
    options[1]!.click();
    completeButton!.click();
    expect(onComplete).toHaveBeenCalledWith(0);
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
  });

  it("renders zero options for non-array data without throwing", () => {
    const bad: QuizData = {
      question: "Broken",
      options: undefined as unknown as string[],
      correctIndex: 1,
    };
    const { onComplete, options } = renderIntoContainer(bad);
    expect(options.length).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("marks no correct option for an out-of-range correctIndex", () => {
    const data: QuizData = {
      question: "Q",
      options: ["a", "b"],
      correctIndex: 7,
    };
    const { onComplete, options, completeButton } = renderIntoContainer(data);
    options[0]!.click();
    completeButton!.click();
    expect(onComplete).toHaveBeenCalledWith(0);
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
  });

  it("renderEditor produces a fallback question input that reports changes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    QuizContentType.renderEditor(container, CANONICAL_QUIZ_DATA, onChange);

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
