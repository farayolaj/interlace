import { describe, expect, it } from "vitest";
import { QuizContentType } from "./quiz-content-type";
import {
  normalizeQuizData,
  validateQuizData,
} from "./validate";
import type { QuizData, RawQuizData } from "./schema";

describe("QuizContentType registration", () => {
  it("is registered under the editor package's authoring id 'quiz-editor'", () => {
    expect(QuizContentType.getId()).toBe("quiz-editor");
  });

  it("reports data-format version 1", () => {
    expect(QuizContentType.getVersion()).toBe(1);
  });

  it("reports a maximum score of 100", () => {
    const data: QuizData = {
      question: { text: "Q" },
      options: [{ id: "a", text: "A" }],
      correctOptionId: "a",
    };
    expect(QuizContentType.getMaximumScore(data)).toBe(100);
  });
});

describe("normalizeQuizData", () => {
  it("normalizes the canonical shape idempotently without mutating inputs", () => {
    const canonical: RawQuizData = {
      question: { text: "Pick one", media: { src: "q.jpg", alt: "Q" } },
      options: [
        { id: "a", text: "Alpha", media: { src: "a.jpg" } },
        { id: "b", text: "Beta" },
      ],
      correctOptionId: "b",
    };
    const inputSnapshot = JSON.stringify(canonical);

    const first = normalizeQuizData(canonical);
    const second = normalizeQuizData(canonical);

    expect(JSON.stringify(canonical)).toBe(inputSnapshot);
    expect(first).toEqual(canonical);
    expect(second).toEqual(first);
  });

  it("normalizes the legacy v1 shape (string options + correctIndex) to canonical", () => {
    const legacy: RawQuizData = {
      question: "What is 2 + 2?",
      options: ["a", "b", "c"],
      correctIndex: 1,
    };

    const normalized = normalizeQuizData(legacy);

    expect(normalized).toEqual({
      question: { text: "What is 2 + 2?" },
      options: [
        { id: "opt-0", text: "a" },
        { id: "opt-1", text: "b" },
        { id: "opt-2", text: "c" },
      ],
      correctOptionId: "opt-1",
    });
  });

  it("prefers correctOptionId over a legacy correctIndex", () => {
    const raw: RawQuizData = {
      question: "Q",
      options: ["a", "b"],
      correctIndex: 0,
      correctOptionId: "opt-1",
    };

    expect(normalizeQuizData(raw).correctOptionId).toBe("opt-1");
  });

  it("does not throw when the correct answer is missing (correctOptionId null)", () => {
    const raw: RawQuizData = { question: "Q", options: ["a", "b"] };

    expect(() => normalizeQuizData(raw)).not.toThrow();
    expect(normalizeQuizData(raw).correctOptionId).toBeNull();
  });

  it("falls back from an unknown correctOptionId to legacy correctIndex or null", () => {
    const unknownId = normalizeQuizData({
      question: "Q",
      options: ["a", "b"],
      correctOptionId: "nope",
      correctIndex: 1,
    });
    expect(unknownId.correctOptionId).toBe("opt-1");

    const unknownIdNoIndex = normalizeQuizData({
      question: "Q",
      options: ["a", "b"],
      correctOptionId: "nope",
    });
    expect(unknownIdNoIndex.correctOptionId).toBeNull();
  });

  it("treats a lone option as the correct answer when nothing is specified", () => {
    const raw: RawQuizData = { question: "Q", options: ["only"] };

    expect(normalizeQuizData(raw).correctOptionId).toBe("opt-0");
  });

  it("does not throw for malformed inputs and degrades to empty defaults", () => {
    const nonArrayOptions = normalizeQuizData({
      question: { text: "Q" },
      options: "not-an-array" as unknown as Array<string>,
    });
    expect(nonArrayOptions.options).toEqual([]);
    expect(nonArrayOptions.correctOptionId).toBeNull();

    const emptyShapes = normalizeQuizData({
      question: "",
      options: [{ text: "has no id" } as unknown as string],
    });
    expect(emptyShapes.question).toEqual({ text: "" });
    expect(emptyShapes.options[0]).toEqual({ id: "opt-0", text: "has no id" });

    const nullQuestion = normalizeQuizData({
      question: null as unknown as string,
      options: ["a"],
    });
    expect(nullQuestion.question).toEqual({ text: "" });
    expect(nullQuestion.correctOptionId).toBe("opt-0");
  });

  it("drops an out-of-range or negative correctIndex", () => {
    const outOfRange = normalizeQuizData({
      question: "Q",
      options: ["a", "b"],
      correctIndex: 7,
    });
    expect(outOfRange.correctOptionId).toBeNull();

    const negative = normalizeQuizData({
      question: "Q",
      options: ["a", "b"],
      correctIndex: -1,
    });
    expect(negative.correctOptionId).toBeNull();
  });
});

describe("validateQuizData", () => {
  it("returns no errors for a valid document", () => {
    const raw: RawQuizData = {
      question: "What is 2 + 2?",
      options: [{ id: "a", text: "3" }, { id: "b", text: "4" }],
      correctOptionId: "b",
    };

    expect(validateQuizData(raw)).toEqual([]);
  });

  it("accepts the legacy v1 shape once normalized", () => {
    const legacy: RawQuizData = {
      question: "What is 2 + 2?",
      options: ["3", "4"],
      correctIndex: 1,
    };

    expect(validateQuizData(legacy)).toEqual([]);
  });

  it("reports an error when the question text is empty", () => {
    const raw: RawQuizData = {
      question: { text: "  " },
      options: ["a"],
      correctOptionId: "opt-0",
    };

    expect(validateQuizData(raw)).toEqual([
      "question.text must be a non-empty string",
    ]);
  });

  it("reports an error when there are no options", () => {
    const raw: RawQuizData = {
      question: "Q",
      options: [],
      correctOptionId: "opt-0",
    };

    expect(validateQuizData(raw)).toEqual([
      "at least one option is required",
      "exactly one correct option must be resolvable",
    ]);
  });

  it("reports per-option errors for empty option text", () => {
    const raw: RawQuizData = {
      question: "Q",
      options: [{ id: "a", text: "" }, { id: "b", text: "  " }],
      correctOptionId: "a",
    };

    expect(validateQuizData(raw)).toEqual([
      "options[0].text must be a non-empty string",
      "options[1].text must be a non-empty string",
    ]);
  });

  it("reports an error when no correct option is resolvable", () => {
    const raw: RawQuizData = {
      question: "Q",
      options: ["a", "b"],
    };

    expect(validateQuizData(raw)).toEqual([
      "exactly one correct option must be resolvable",
    ]);
  });
});