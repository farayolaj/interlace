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
});

describe("normalizeQuizData", () => {
  it("wraps the flat legacy v1 shape into a one-question list", () => {
    const legacy: RawQuizData = {
      question: "What is 2 + 2?",
      options: ["a", "b", "c"],
      correctIndex: 1,
    };

    expect(normalizeQuizData(legacy)).toEqual({
      questions: [
        {
          id: "q-0",
          text: "What is 2 + 2?",
          options: [
            { id: "opt-0", text: "a" },
            { id: "opt-1", text: "b" },
            { id: "opt-2", text: "c" },
          ],
          correctOptionId: "opt-1",
        },
      ],
    });
  });

  it("wraps the 1-question canonical shape into a one-question list idempotently", () => {
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
    expect(first).toEqual({
      questions: [
        {
          id: "q-0",
          text: "Pick one",
          media: { src: "q.jpg", alt: "Q" },
          options: [
            { id: "a", text: "Alpha", media: { src: "a.jpg" } },
            { id: "b", text: "Beta" },
          ],
          correctOptionId: "b",
        },
      ],
    });
    expect(second).toEqual(first);
  });

  it("normalizes a multi-question list idempotently without mutating inputs", () => {
    const multi: RawQuizData = {
      questions: [
        {
          id: "q-1",
          text: "First",
          options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
          correctOptionId: "b",
        },
        {
          id: "q-2",
          text: "Second",
          options: ["x", "y"],
          correctIndex: 0,
        },
      ],
    };
    const inputSnapshot = JSON.stringify(multi);

    const first = normalizeQuizData(multi);
    const second = normalizeQuizData(multi);

    expect(JSON.stringify(multi)).toBe(inputSnapshot);
    expect(first).toEqual({
      questions: [
        {
          id: "q-1",
          text: "First",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
          correctOptionId: "b",
        },
        {
          id: "q-2",
          text: "Second",
          options: [
            { id: "opt-0", text: "x" },
            { id: "opt-1", text: "y" },
          ],
          correctOptionId: "opt-0",
        },
      ],
    });
    expect(second).toEqual(first);
  });

  it("generates collision-free question ids for specs missing ids", () => {
    const raw: RawQuizData = {
      questions: [
        { id: "q-1", text: "Explicit q-1" },
        { text: "No id (would be q-1)" },
        { text: "No id (would be q-2)" },
        { text: "No id" },
      ],
    };

    const normalized = normalizeQuizData(raw);
    expect(normalized.questions.map((q) => q.id)).toEqual([
      "q-1",
      "q-2",
      "q-3",
      "q-4",
    ]);
  });

  it("prefers correctOptionId over a legacy correctIndex per question", () => {
    const raw: RawQuizData = {
      questions: [
        {
          text: "Q",
          options: ["a", "b"],
          correctIndex: 0,
          correctOptionId: "opt-1",
        },
      ],
    };

    expect(normalizeQuizData(raw).questions[0]!.correctOptionId).toBe("opt-1");
  });

  it("falls back from an unknown correctOptionId to correctIndex or null per question", () => {
    const withIndex = normalizeQuizData({
      questions: [
        {
          text: "Q",
          options: ["a", "b"],
          correctOptionId: "nope",
          correctIndex: 1,
        },
      ],
    });
    expect(withIndex.questions[0]!.correctOptionId).toBe("opt-1");

    const withoutIndex = normalizeQuizData({
      questions: [{ text: "Q", options: ["a", "b"], correctOptionId: "nope" }],
    });
    expect(withoutIndex.questions[0]!.correctOptionId).toBeNull();
  });

  it("treats a lone option as the correct answer when nothing is specified", () => {
    const raw: RawQuizData = {
      questions: [{ text: "Q", options: ["only"] }],
    };

    expect(normalizeQuizData(raw).questions[0]!.correctOptionId).toBe("opt-0");
  });

  it("does not throw when the correct answer is missing (correctOptionId null)", () => {
    const raw: RawQuizData = { question: "Q", options: ["a", "b"] };

    expect(() => normalizeQuizData(raw)).not.toThrow();
    expect(normalizeQuizData(raw).questions[0]!.correctOptionId).toBeNull();
  });

  it("does not throw for malformed inputs and degrades to empty defaults", () => {
    const nonArrayOptions = normalizeQuizData({
      question: { text: "Q" },
      options: "not-an-array" as unknown as Array<string>,
    });
    expect(nonArrayOptions.questions[0]!.options).toEqual([]);
    expect(nonArrayOptions.questions[0]!.correctOptionId).toBeNull();

    const emptyShapes = normalizeQuizData({
      question: "",
      options: [{ text: "has no id" } as unknown as string],
    });
    expect(emptyShapes.questions[0]!.text).toEqual("");
    expect(emptyShapes.questions[0]!.options[0]).toEqual({
      id: "opt-0",
      text: "has no id",
    });

    const nullQuestion = normalizeQuizData({
      question: null as unknown as string,
      options: ["a"],
    });
    expect(nullQuestion.questions[0]!.text).toEqual("");
    expect(nullQuestion.questions[0]!.correctOptionId).toBe("opt-0");
  });

  it("drops an out-of-range or negative correctIndex per question", () => {
    const outOfRange = normalizeQuizData({
      questions: [{ text: "Q", options: ["a", "b"], correctIndex: 7 }],
    });
    expect(outOfRange.questions[0]!.correctOptionId).toBeNull();

    const negative = normalizeQuizData({
      questions: [{ text: "Q", options: ["a", "b"], correctIndex: -1 }],
    });
    expect(negative.questions[0]!.correctOptionId).toBeNull();
  });

  it("round-trips: normalized canonical output type-checks as raw input", () => {
    const legacy: RawQuizData = {
      question: "Q?",
      options: ["a", "b"],
      correctIndex: 0,
    };

    // Compile-time pin: canonical output is assignable to RawQuizData.
    const round: RawQuizData = normalizeQuizData(legacy);

    expect(normalizeQuizData(round)).toEqual(normalizeQuizData(legacy));
  });
});

describe("validateQuizData", () => {
  it("returns no errors for a valid multi-question document", () => {
    const raw: RawQuizData = {
      questions: [
        {
          text: "First?",
          options: [{ id: "a", text: "3" }, { id: "b", text: "4" }],
          correctOptionId: "b",
        },
        {
          text: "Second?",
          options: ["x", "y"],
          correctIndex: 0,
        },
      ],
    };

    expect(validateQuizData(raw)).toEqual([]);
  });

  it("accepts the flat legacy v1 shape once normalized", () => {
    const legacy: RawQuizData = {
      question: "What is 2 + 2?",
      options: ["3", "4"],
      correctIndex: 1,
    };

    expect(validateQuizData(legacy)).toEqual([]);
  });

  it("reports per-question errors with question indices", () => {
    const raw: RawQuizData = {
      questions: [
        {
          text: "  ",
          options: [],
          correctOptionId: "nope",
        },
        {
          text: "Fine",
          options: [{ id: "a", text: "" }],
          correctOptionId: "a",
        },
      ],
    };

    expect(validateQuizData(raw)).toEqual([
      "questions[0].text must be a non-empty string",
      "questions[0].at least one option is required",
      "questions[0].exactly one correct option must be resolvable",
      "questions[1].options[0].text must be a non-empty string",
    ]);
  });

  it("reports per-option errors for empty option text", () => {
    const raw: RawQuizData = {
      questions: [
        {
          text: "Q",
          options: [{ id: "a", text: "" }, { id: "b", text: "  " }],
          correctOptionId: "a",
        },
      ],
    };

    expect(validateQuizData(raw)).toEqual([
      "questions[0].options[0].text must be a non-empty string",
      "questions[0].options[1].text must be a non-empty string",
    ]);
  });

  it("reports an error when no correct option is resolvable", () => {
    const raw: RawQuizData = {
      questions: [{ text: "Q", options: ["a", "b"] }],
    };

    expect(validateQuizData(raw)).toEqual([
      "questions[0].exactly one correct option must be resolvable",
    ]);
  });

  it("does not throw for an empty raw document (degrades to one invalid question)", () => {
    expect(() => validateQuizData({})).not.toThrow();
    expect(validateQuizData({})).toEqual([
      "questions[0].text must be a non-empty string",
      "questions[0].at least one option is required",
      "questions[0].exactly one correct option must be resolvable",
    ]);
  });
});