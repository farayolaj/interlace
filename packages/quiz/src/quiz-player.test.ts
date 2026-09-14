import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizContentType } from "./quiz-content-type";
import {
  renderQuizPlayback,
  unmountQuizPlayback,
} from "./quiz-player";
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

/** Canonical shape with rich media. */
const CANONICAL_DATA: RawQuizData = {
  question: { text: "Pick one", media: { src: "q.png", alt: "Question art" } },
  options: [
    { id: "a", text: "Alpha", media: { src: "a.png", alt: "Alpha art" } },
    { id: "b", text: "Beta" },
  ],
  correctOptionId: "b",
};

function renderIntoContainer(data: RawQuizData = LEGACY_DATA) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const onComplete = vi.fn();
  renderQuizPlayback(container, data, { onComplete });
  const question = container.querySelector(
    ".quiz-playback-question",
  ) as HTMLElement | null;
  const options = [
    ...container.querySelectorAll(".quiz-playback-option"),
  ] as HTMLButtonElement[];
  return { container, onComplete, question, options };
}

describe("QuizContentType", () => {
  it("reports a maximum score of 100", () => {
    const data: QuizData = {
      question: { text: "Q" },
      options: [{ id: "a", text: "A" }],
      correctOptionId: "a",
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
  it("renders the question and one enabled option button per choice (legacy shape)", () => {
    const { question, options } = renderIntoContainer();
    expect(question?.textContent).toBe("What is 2 + 2?");
    expect(options.map((option) => option.textContent)).toEqual(["3", "4", "5"]);
    expect(options.every((option) => !option.disabled)).toBe(true);
  });

  it("renders through a canonical raw shape with question media and thumbnails", () => {
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
    expect(
      options[1]?.querySelector(".quiz-playback-option-media"),
    ).toBeNull();
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

  it("unmountQuizPlayback clears the container and allows re-render", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderQuizPlayback(container, LEGACY_DATA, { onComplete: vi.fn() });
    expect(container.querySelector(".quiz-playback")).not.toBeNull();

    unmountQuizPlayback(container);
    expect(container.textContent).toBe("");

    // Re-render works after unmount.
    renderQuizPlayback(container, LEGACY_DATA, { onComplete: vi.fn() });
    expect(container.querySelector(".quiz-playback-question")).not.toBeNull();
  });

  it("renders defensively when correctness is unresolved (every answer scores 0)", () => {
    // Load-bearing compatibility case with documents that predate an
    // authored answer: no resolvable correct option means nothing is marked
    // correct and every answer scores 0.
    const data: RawQuizData = { question: "Legacy import", options: ["a", "b"] };
    const { onComplete, options } = renderIntoContainer(data);
    options[1]!.click();
    expect(onComplete).toHaveBeenCalledWith(0);
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
  });

  it("renders zero options for non-array data without throwing", () => {
    const bad: RawQuizData = {
      question: "Broken",
      options: undefined as unknown as Array<string>,
      correctIndex: 1,
    };
    const { onComplete, options } = renderIntoContainer(bad);
    expect(options.length).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("marks no correct option for an out-of-range correctIndex", () => {
    const data: RawQuizData = {
      question: "Q",
      options: ["a", "b"],
      correctIndex: 7,
    };
    const { onComplete, options } = renderIntoContainer(data);
    options[0]!.click();
    expect(onComplete).toHaveBeenCalledWith(0);
    expect(
      options.every(
        (option) => !option.classList.contains("quiz-playback-option-correct"),
      ),
    ).toBe(true);
  });

  it("scores by option id in the canonical shape", () => {
    const { onComplete, options } = renderIntoContainer(CANONICAL_DATA);
    options[1]!.click();
    expect(onComplete).toHaveBeenCalledWith(100);
    options[0]!.click();
    expect(onComplete).toHaveBeenCalledTimes(1); // already locked
  });
});