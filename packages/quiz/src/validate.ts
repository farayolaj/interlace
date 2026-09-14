import type {
  QuizData,
  QuizOption,
  QuizQuestion,
  RawQuizData,
} from "./schema";

/** Generated option id used when a document omits one. */
function generatedOptionId(index: number): string {
  return `opt-${index}`;
}

/** Normalizes a question value, defaulting malformed input to empty text. */
function normalizeQuestion(question: RawQuizData["question"]): QuizQuestion {
  if (typeof question === "string") {
    return { text: question };
  }
  if (question !== null && typeof question === "object") {
    const normalized: QuizQuestion = {
      text: typeof question.text === "string" ? question.text : "",
    };
    if (question.media !== undefined) {
      normalized.media = question.media;
    }
    return normalized;
  }
  return { text: "" };
}

/** Normalizes a single option value, generating an id/text when missing. */
function normalizeOption(
  option: string | QuizOption,
  index: number,
): QuizOption {
  if (typeof option === "string") {
    return { id: generatedOptionId(index), text: option };
  }
  const normalized: QuizOption = {
    id: typeof option?.id === "string" ? option.id : generatedOptionId(index),
    text: typeof option?.text === "string" ? option.text : "",
  };
  if (option?.media !== undefined) {
    normalized.media = option.media;
  }
  return normalized;
}

/**
 * Resolves the correct option id:
 * 1. a `correctOptionId` that references an existing option wins;
 * 2. otherwise a non-negative, in-range legacy `correctIndex` maps to its
 *    option id;
 * 3. otherwise a lone option is treated as the answer;
 * 4. otherwise there is no resolvable answer (`null`).
 */
function resolveCorrectOptionId(
  raw: RawQuizData,
  options: QuizOption[],
): string | null {
  if (
    typeof raw.correctOptionId === "string" &&
    options.some((option) => option.id === raw.correctOptionId)
  ) {
    return raw.correctOptionId;
  }

  const correctIndex = raw.correctIndex;
  if (
    typeof correctIndex === "number" &&
    Number.isInteger(correctIndex) &&
    correctIndex >= 0 &&
    correctIndex < options.length
  ) {
    return options[correctIndex]!.id;
  }

  if (options.length === 1) {
    return options[0]!.id;
  }

  return null;
}

/**
 * PURE normalization from a possibly-legacy raw document into the canonical
 * {@link QuizData} shape. Never throws; malformed values degrade to empty
 * defaults and a `null` answer.
 */
export function normalizeQuizData(raw: RawQuizData): QuizData {
  const question = normalizeQuestion(raw.question);
  const options = Array.isArray(raw.options)
    ? raw.options.map((option, index) => normalizeOption(option, index))
    : [];

  return {
    question,
    options,
    correctOptionId: resolveCorrectOptionId(raw, options),
  };
}

/**
 * Validates a raw document, returning human-readable error strings. An empty
 * array means the document is valid.
 */
export function validateQuizData(raw: RawQuizData): string[] {
  const normalized = normalizeQuizData(raw);
  const errors: string[] = [];

  if (normalized.question.text.trim().length === 0) {
    errors.push("question.text must be a non-empty string");
  }

  if (normalized.options.length === 0) {
    errors.push("at least one option is required");
  } else {
    normalized.options.forEach((option, index) => {
      if (option.text.trim().length === 0) {
        errors.push(`options[${index}].text must be a non-empty string`);
      }
    });
  }

  if (normalized.correctOptionId === null) {
    errors.push("exactly one correct option must be resolvable");
  }

  return errors;
}
