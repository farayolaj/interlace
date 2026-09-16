import { describe, expect, it } from "vitest";
import { QuizContentType } from "./quiz-content-type";
import type { QuizData } from "./schema";
import { validateQuizData } from "./validate";

const SINGLE: QuizData = {
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

const MULTI: QuizData = {
  questions: [
    {
      id: "q-1",
      text: "First?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "4" },
      ],
      correctOptionId: "b",
    },
    {
      id: "q-2",
      text: "Second?",
      options: [
        { id: "c", text: "5" },
        { id: "d", text: "6" },
      ],
      correctOptionId: "d",
    },
  ],
};

describe("QuizContentType registration", () => {
  it("is registered under the editor package's authoring id 'quiz-editor'", () => {
    expect(QuizContentType.getId()).toBe("quiz-editor");
  });

  it("reports data-format version 1", () => {
    expect(QuizContentType.getVersion()).toBe(1);
  });

  it("getMaximumScore is the question count (one point per question)", () => {
    expect(QuizContentType.getMaximumScore(SINGLE)).toBe(1);
    expect(QuizContentType.getMaximumScore(MULTI)).toBe(2);
  });
});

describe("validateQuizData", () => {
  it("returns no errors for a valid single-question document", () => {
    expect(validateQuizData(SINGLE)).toEqual([]);
  });

  it("returns no errors for a valid multi-question document", () => {
    expect(validateQuizData(MULTI)).toEqual([]);
  });

  it("returns no errors for a media-bearing valid document", () => {
    const mediaDoc: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "Which one?",
          media: { src: "q.png", alt: "Question art" },
          options: [
            { id: "a", text: "Alpha", media: { src: "a.png", alt: "A" } },
            { id: "b", text: "Beta" },
          ],
          correctOptionId: "b",
        },
      ],
    };
    expect(validateQuizData(mediaDoc)).toEqual([]);
  });

  it("reports at least one question is required for an empty questions list", () => {
    expect(validateQuizData({ questions: [] })).toEqual([
      "at least one question is required",
    ]);
  });

  it("reports per-question errors with question indices", () => {
    const data: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "  ",
          options: [],
          correctOptionId: null,
        },
        {
          id: "q-1",
          text: "Fine",
          options: [{ id: "a", text: "" }],
          correctOptionId: "a",
        },
      ],
    };

    expect(validateQuizData(data)).toEqual([
      "questions[0].text must be a non-empty string",
      "questions[0].at least one option is required",
      "questions[0].exactly one correct option must be resolvable",
      "questions[1].options[0].text must be a non-empty string",
    ]);
  });

  it("reports per-option errors for empty option text", () => {
    const data: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "Q",
          options: [
            { id: "a", text: "" },
            { id: "b", text: "  " },
          ],
          correctOptionId: "a",
        },
      ],
    };

    expect(validateQuizData(data)).toEqual([
      "questions[0].options[0].text must be a non-empty string",
      "questions[0].options[1].text must be a non-empty string",
    ]);
  });

  it("reports an error when no correct option is resolvable", () => {
    const data: QuizData = {
      questions: [
        {
          id: "q-0",
          text: "Q",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
          correctOptionId: null,
        },
      ],
    };

    expect(validateQuizData(data)).toEqual([
      "questions[0].exactly one correct option must be resolvable",
    ]);
  });

  it("never throws for structurally unusual but valid-shaped documents", () => {
    expect(() =>
      validateQuizData({
        questions: [{ id: "q-0", text: "Q", options: [], correctOptionId: null }],
      }),
    ).not.toThrow();
    // A question with a single option and an explicit correct id is valid.
    expect(
      validateQuizData({
        questions: [
          { id: "q-0", text: "Q", options: [{ id: "a", text: "A" }], correctOptionId: "a" },
        ],
      }),
    ).toEqual([]);
  });
});