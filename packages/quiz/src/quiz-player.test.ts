import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizContentType } from "./quiz-content-type";
import { renderQuizPlayback, unmountQuizPlayback } from "./quiz-player";
import type { QuizData, RawQuizData } from "./schema";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Legacy v1 shape (string question/options + numeric correctIndex). */
const LEGACY_DATA: RawQuizData = {
  question: "What is 2 + 2?",
  options: ["3", "4", "5"],
  correctIndex: 1,
};

/** Canonical flat shape with rich media. */
const CANONICAL_DATA: RawQuizData = {
  question: { text: "Pick one", media: { src: "q.png", alt: "Question art" } },
  options: [
    { id: "a", text: "Alpha", media: { src: "a.png", alt: "Alpha art" } },
    { id: "b", text: "Beta" },
  ],
  correctOptionId: "b",
};

/** Canonical multi-question shape. */
const MULTI_DATA: RawQuizData = {
  questions: [
    {
      id: "q-1",
      text: "First question",
      options: [
        { id: "first-right", text: "Right one" },
        { id: "first-wrong", text: "Wrong one" },
      ],
      correctOptionId: "first-right",
    },
    {
      id: "q-2",
      text: "Second question",
      options: [
        { id: "second-right", text: "Correct two" },
        { id: "second-wrong", text: "Wrong two" },
      ],
      correctOptionId: "second-right",
    },
  ],
};

function currentOptions(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll(".quiz-playback-option"),
  ] as HTMLButtonElement[];
}

function renderIntoContainer(data: RawQuizData = LEGACY_DATA) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const onComplete = vi.fn();
  renderQuizPlayback(container, data, { onComplete });
  const indicator = container.querySelector(
    ".quiz-playback-indicator",
  ) as HTMLElement | null;
  const question = container.querySelector(
    ".quiz-playback-question",
  ) as HTMLElement | null;
  const options = currentOptions();
  const nextButton = container.querySelector(
    ".quiz-playback-next",
  ) as HTMLButtonElement | null;
  const prevButton = container.querySelector(
    ".quiz-playback-prev",
  ) as HTMLButtonElement | null;
  return {
    container,
    onComplete,
    indicator,
    question,
    options,
    nextButton,
    prevButton,
  };
}

describe("QuizContentType", () => {
  it("reports a maximum score of 100", () => {
    const data: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "Q",
          options: [{ id: "a", text: "A" }],
          correctOptionId: "a",
        },
      ],
    };
    expect(QuizContentType.getMaximumScore(data)).toBe(100);
  });

  it("is registered as quiz-editor (the editor package's authoring id)", () => {
    expect(QuizContentType.getId()).toBe("quiz-editor");
  });

  it("reports data-format version 1", () => {
    expect(QuizContentType.getVersion()).toBe(1);
  });
});

describe("renderQuizPlayback", () => {
  it("renders a legacy flat single question as 'Question 1 of 1' with enabled options", () => {
    const { indicator, question, options } = renderIntoContainer();
    expect(indicator?.textContent).toBe("Question 1 of 1");
    expect(question?.textContent).toBe("What is 2 + 2?");
    expect(options.map((option) => option.textContent)).toEqual([
      "3",
      "4",
      "5",
    ]);
    expect(options.every((option) => !option.disabled)).toBe(true);
  });

  it("renders a canonical flat shape with question media and thumbnails", () => {
    const { container, question, options } =
      renderIntoContainer(CANONICAL_DATA);
    expect(question?.textContent).toBe("Pick one");
    expect(options.map((option) => option.textContent)).toEqual([
      "Alpha",
      "Beta",
    ]);

    const questionMedia = container.querySelector(
      ".quiz-playback-question-media",
    ) as HTMLImageElement | null;
    expect(questionMedia).not.toBeNull();
    expect(questionMedia?.getAttribute("src")).toBe("q.png");
    expect(questionMedia?.getAttribute("alt")).toBe("Question art");

    const firstThumb = options[0]?.querySelector(
      ".quiz-playback-option-media",
    ) as HTMLImageElement | null;
    expect(firstThumb).not.toBeNull();
    expect(firstThumb?.getAttribute("src")).toBe("a.png");
    expect(firstThumb?.getAttribute("alt")).toBe("Alpha art");
    expect(options[1]?.querySelector(".quiz-playback-option-media")).toBeNull();
  });

  it("shows 'Question 1 of 2' and renders only the first question's options", () => {
    const { indicator, question, options } = renderIntoContainer(MULTI_DATA);
    expect(indicator?.textContent).toBe("Question 1 of 2");
    expect(question?.textContent).toBe("First question");
    expect(options.map((option) => option.textContent)).toEqual([
      "Right one",
      "Wrong one",
    ]);
    expect(options.every((option) => !option.disabled)).toBe(true);
  });

  it("does not render media elements when src is blank", () => {
    const { container } = renderIntoContainer({
      question: { text: "Q", media: { src: "", alt: "" } },
      options: [{ id: "a", text: "A", media: { src: "" } }],
      correctOptionId: "a",
    });
    expect(container.querySelector(".quiz-playback-question-media")).toBeNull();
    expect(container.querySelector(".quiz-playback-option-media")).toBeNull();
  });

  it("Next is gated on the current answer and does not auto-advance", () => {
    const { options, nextButton, prevButton, indicator, question } =
      renderIntoContainer(MULTI_DATA);
    expect(nextButton?.disabled).toBe(true);
    expect(nextButton?.textContent).toBe("Next");
    expect(prevButton?.style.display).toBe("none");

    options[0]!.click(); // correct on question 1
    expect(nextButton?.disabled).toBe(false);
    // No auto-advance: the view stays on question 1.
    expect(indicator?.textContent).toBe("Question 1 of 2");
    expect(question?.textContent).toBe("First question");
  });

  it("advances to question 2 via Next and shows 'Question 2 of 2'", () => {
    const { options, nextButton } = renderIntoContainer(MULTI_DATA);
    options[1]!.click(); // wrong on question 1 (still allowed)
    nextButton!.click();
    const indicator = document.querySelector(
      ".quiz-playback-indicator",
    ) as HTMLElement | null;
    const question = document.querySelector(
      ".quiz-playback-question",
    ) as HTMLElement | null;
    expect(indicator?.textContent).toBe("Question 2 of 2");
    expect(question?.textContent).toBe("Second question");
    expect(currentOptions().map((option) => option.textContent)).toEqual([
      "Correct two",
      "Wrong two",
    ]);
  });

  it("Previous is absent on the first question and returns review-only to question 1", () => {
    const { options, nextButton, prevButton } = renderIntoContainer(MULTI_DATA);
    expect(prevButton?.style.display).toBe("none");

    options[0]!.click(); // correct on question 1
    nextButton!.click(); // question 2
    expect(prevButton?.style.display).toBe("block");

    // Answer question 2 before going back.
    currentOptions()[1]!.click(); // wrong
    prevButton!.click();

    // Back on question 1: reveal intact, options disabled (review-only).
    const indicator = document.querySelector(
      ".quiz-playback-indicator",
    ) as HTMLElement | null;
    const firstOptions = currentOptions();
    expect(indicator?.textContent).toBe("Question 1 of 2");
    expect(
      firstOptions[0]!.classList.contains("quiz-playback-option-correct"),
    ).toBe(true);
    expect(firstOptions.every((option) => option.disabled)).toBe(true);
  });

  it("changing decisions is impossible after reveal (options locked)", () => {
    const { options, nextButton, prevButton } = renderIntoContainer(MULTI_DATA);
    options[0]!.click(); // answer question 1
    nextButton!.click(); // question 2
    currentOptions()[1]!.click(); // answer question 2
    prevButton!.click(); // back to question 1 review

    const firstOptions = currentOptions();
    // The locked question 1 cannot be re-answered: clicking its (correct)
    // option changes nothing.
    firstOptions[0]!.click();
    firstOptions[1]!.click();
    expect(currentOptions()[0]!.disabled).toBe(true);
    expect(currentOptions()[1]!.disabled).toBe(true);
    // And no decision changed: the correct option is still the revealed one.
    expect(
      currentOptions()[0]!.classList.contains("quiz-playback-option-correct"),
    ).toBe(true);
  });

  it("answers a single question correctly, then Next reports 100 once", () => {
    const { onComplete, options, nextButton } = renderIntoContainer();
    options[1]!.click();
    // Reveal + lock; no auto-complete.
    expect(onComplete).not.toHaveBeenCalled();
    expect(options.every((option) => option.disabled)).toBe(true);
    expect(nextButton?.textContent).toBe("Next");
    expect(nextButton?.disabled).toBe(false);

    nextButton!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(100);

    // Already completed: the footer click does nothing more.
    nextButton!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("answers a single question incorrectly with a zero score and marks it", () => {
    const { onComplete, options, nextButton } = renderIntoContainer();
    options[0]!.click();
    expect(onComplete).not.toHaveBeenCalled();
    // The correct option is revealed, the wrong selection is marked.
    expect(options[1]!.classList.contains("quiz-playback-option-correct")).toBe(
      true,
    );
    expect(
      options[0]!.classList.contains("quiz-playback-option-incorrect"),
    ).toBe(true);
    // Answering once locks the options.
    options[2]!.click();
    expect(onComplete).not.toHaveBeenCalled();

    nextButton!.click(); // Next completes the single question
    expect(onComplete).toHaveBeenCalledWith(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("aggregates partial credit across two questions (one right, one wrong → 50)", () => {
    const { onComplete, options, nextButton } = renderIntoContainer(MULTI_DATA);
    // Question 1: correct.
    options[0]!.click();
    expect(onComplete).not.toHaveBeenCalled();
    nextButton!.click();
    // Question 2: wrong — the footer still gates completion.
    currentOptions()[1]!.click();
    expect(onComplete).not.toHaveBeenCalled();
    expect(nextButton?.textContent).toBe("Next");
    expect(nextButton?.disabled).toBe(false);
    nextButton!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(50);
  });

  it("reports 100 when both questions are answered correctly", () => {
    const { onComplete, options, nextButton } = renderIntoContainer(MULTI_DATA);
    options[0]!.click();
    nextButton!.click();
    currentOptions()[0]!.click();
    nextButton!.click(); // Next completes the final question
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(100);
  });

  it("the final question's Next button is disabled until answered", () => {
    const { options, nextButton } = renderIntoContainer(MULTI_DATA);
    options[0]!.click();
    nextButton!.click();
    // Question 2 (final): Next present but gated until answered.
    expect(nextButton?.textContent).toBe("Next");
    expect(nextButton?.disabled).toBe(true);
    currentOptions()[0]!.click();
    expect(nextButton?.disabled).toBe(false);
  });

  it("fires completion once on the final question", () => {
    const { onComplete, options, nextButton } = renderIntoContainer(MULTI_DATA);
    options[0]!.click();
    nextButton!.click();
    currentOptions()[1]!.click(); // wrong
    nextButton!.click(); // Next completes the quiz
    expect(onComplete).toHaveBeenCalledTimes(1);
    // Re-clicking Next (and the now-locked options) does nothing.
    nextButton!.click();
    currentOptions()[1]!.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("unmountQuizPlayback clears the container and allows re-render", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderQuizPlayback(container, LEGACY_DATA, { onComplete: vi.fn() });
    expect(container.querySelector(".quiz-playback")).not.toBeNull();

    unmountQuizPlayback(container);
    expect(container.textContent).toBe("");

    // Re-render works after unmount.
    renderQuizPlayback(container, MULTI_DATA, { onComplete: vi.fn() });
    expect(container.querySelector(".quiz-playback-question")).not.toBeNull();
  });

  it("renders defensively when correctness is unresolved (every answer scores 0)", () => {
    // Load-bearing compatibility case with documents that predate an
    // authored answer: no resolvable correct option means nothing is marked
    // correct and every answer scores 0.
    const data: RawQuizData = {
      question: "Legacy import",
      options: ["a", "b"],
    };
    const { onComplete, options, nextButton } = renderIntoContainer(data);
    options[1]!.click();
    expect(onComplete).not.toHaveBeenCalled();
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
    nextButton!.click(); // Next completes the quiz
    expect(onComplete).toHaveBeenCalledWith(0);
  });

  it("renders zero options for non-array data without throwing", () => {
    const bad: RawQuizData = {
      question: "Broken",
      options: undefined as unknown as Array<string>,
      correctIndex: 1,
    };
    const { onComplete, options, nextButton } = renderIntoContainer(bad);
    expect(options.length).toBe(0);
    // Nothing answered → Next stays gated → no completion fires.
    expect(nextButton?.disabled).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("marks no correct option for an out-of-range correctIndex", () => {
    const data: RawQuizData = {
      question: "Q",
      options: ["a", "b"],
      correctIndex: 7,
    };
    const { onComplete, options, nextButton } = renderIntoContainer(data);
    options[0]!.click();
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
    nextButton!.click(); // Next completes the quiz
    expect(onComplete).toHaveBeenCalledWith(0);
  });

  it("scores by option id in the canonical flat shape", () => {
    const { onComplete, options, nextButton } =
      renderIntoContainer(CANONICAL_DATA);
    options[1]!.click();
    nextButton!.click(); // Next completes the quiz
    expect(onComplete).toHaveBeenCalledWith(100);
    expect(onComplete).toHaveBeenCalledTimes(1); // once, after Next
  });
});
