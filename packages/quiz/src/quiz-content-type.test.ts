import { describe, expect, it } from "vitest";
import { QuizContentType } from "./quiz-content-type";
import { QuizEditorType } from "./quiz-editor";
import type { QuizData } from "./schema";
import { getQuizAuthoringIssues } from "./validate";

const READY: QuizData = {
  questions: [
    {
      id: "q-0",
      text: "What is 2 + 2?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "4" },
      ],
      correctOptionId: "b",
    },
  ],
};

describe("QuizContentType metadata", () => {
  it.each([QuizContentType, QuizEditorType])(
    "exposes a display name and description",
    (type) => {
      expect(type.getDisplayName?.()).toBe("Quiz");
      expect(type.getDescription?.()).toBe(
        "Multiple-choice questions that check understanding",
      );
    },
  );
});

describe("QuizContentType.validate", () => {
  it("returns no messages for a ready quiz", () => {
    expect(QuizContentType.validate?.(READY)).toEqual([]);
    expect(QuizEditorType.validate?.(READY)).toEqual([]);
  });

  it("asks for at least one question", () => {
    expect(QuizContentType.validate?.({ questions: [] })).toEqual([
      "Add at least one question",
    ]);
  });

  it("returns friendly per-question messages", () => {
    const data: QuizData = {
      questions: [
        { id: "q-0", text: "  ", options: [], correctOptionId: null },
        {
          id: "q-1",
          text: "Pick one",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
            { id: "c", text: "" },
          ],
          correctOptionId: "a",
        },
        {
          id: "q-2",
          text: "Dangling",
          options: [{ id: "x", text: "X" }],
          correctOptionId: "gone",
        },
      ],
    };
    expect(QuizContentType.validate?.(data)).toEqual([
      "Question 1 needs text",
      "Question 1 needs at least 2 options",
      "Question 1 needs a correct answer",
      "Question 2, option 3 needs text",
      "Question 3 needs at least 2 options",
      "Question 3 needs a correct answer",
    ]);
  });

  it("is backed by getQuizAuthoringIssues", () => {
    expect(getQuizAuthoringIssues({ questions: [] })).toEqual([
      "Add at least one question",
    ]);
  });
});
