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

const QUIZ_DATA: QuizData = {
  question: "What is 2 + 2?",
  options: ["3", "4", "5"],
  correctIndex: 1,
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
  return { container, onComplete, question, options };
}

describe("QuizContentType", () => {
  it("getMaximumScore returns the maximum quiz score", () => {
    expect(QuizContentType.getMaximumScore(QUIZ_DATA)).toBe(100);
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

  it("selecting the correct option reports the maximum score and locks the options", () => {
    const { onComplete, options } = renderIntoContainer();
    options[1]!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(100);
    expect(options.every((option) => option.disabled)).toBe(true);
  });

  it("selecting an incorrect option reports a zero score and marks it", () => {
    const { onComplete, options } = renderIntoContainer();
    options[0]!.click();
    expect(onComplete).toHaveBeenCalledWith(0);
    // The correct option is revealed, the wrong selection is marked.
    expect(options[1]!.classList.contains("quiz-playback-option-correct")).toBe(
      true,
    );
    expect(
      options[0]!.classList.contains("quiz-playback-option-incorrect"),
    ).toBe(true);
    // Answering once locks the options.
    options[2]!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
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

  it("renderEditor produces a fallback question input that reports changes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    QuizContentType.renderEditor(container, QUIZ_DATA, onChange);

    const input = container.querySelector(
      ".quiz-question",
    ) as HTMLInputElement;
    expect(input.value).toBe("What is 2 + 2?");
    input.value = "New question";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ question: "New question" }),
    );

    QuizContentType.unmount?.(container);
    expect(container.textContent).toBe("");
  });
});
