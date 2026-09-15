import type {
  QuizData,
  QuizOption,
  QuizQuestion,
  QuizQuestionSpec,
  RawQuizData,
  RawQuizQuestionSpec,
} from "./schema";

/** Generated option id used when a document omits one. */
function generatedOptionId(index: number): string {
  return `opt-${index}`;
}

/** Generated question id used when a question spec omits one. */
function generatedQuestionId(index: number): string {
  return `q-${index}`;
}

/** Normalizes a flat question value, defaulting malformed input to empty text. */
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
 * Resolves the correct option id for a spec:
 * 1. a `correctOptionId` that references an existing option wins;
 * 2. otherwise a non-negative, in-range legacy `correctIndex` maps to its
 *    option id;
 * 3. otherwise a lone option is treated as the answer;
 * 4. otherwise there is no resolvable answer (`null`).
 */
function resolveCorrectOptionId(
  spec: { correctOptionId?: string | null; correctIndex?: number },
  options: QuizOption[],
): string | null {
  if (
    typeof spec.correctOptionId === "string" &&
    options.some((option) => option.id === spec.correctOptionId)
  ) {
    return spec.correctOptionId;
  }

  const correctIndex = spec.correctIndex;
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

/** Finds the first `q-<n>` id (from `index` upward) not in `taken`. */
function nextFreeQuestionId(index: number, taken: Set<string>): string {
  let candidate = index;
  let id = generatedQuestionId(candidate);
  while (taken.has(id)) {
    candidate += 1;
    id = generatedQuestionId(candidate);
  }
  return id;
}

/**
 * Normalizes one raw question spec. Generated ids are collision-free against
 * every explicit id present in the document and previously generated ids.
 */
function normalizeQuestionSpec(
  raw: unknown,
  index: number,
  takenIds: Set<string>,
): QuizQuestionSpec {
  const spec = (
    raw !== null && typeof raw === "object" ? raw : {}
  ) as Partial<RawQuizQuestionSpec>;

  const options = Array.isArray(spec.options)
    ? spec.options.map((option, optionIndex) =>
        normalizeOption(option, optionIndex),
      )
    : [];

  let id: string;
  if (typeof spec.id === "string" && spec.id.length > 0) {
    id = spec.id;
    takenIds.add(id);
  } else {
    id = nextFreeQuestionId(index, takenIds);
    takenIds.add(id);
  }

  const normalized: QuizQuestionSpec = {
    id,
    text: typeof spec.text === "string" ? spec.text : "",
    options,
    correctOptionId: resolveCorrectOptionId(spec, options),
  };
  if (spec.media !== undefined) {
    normalized.media = spec.media;
  }
  return normalized;
}

/** Normalizes a multi-question `questions` list into canonical specs. */
function normalizeQuestionSpecs(
  rawQuestions: Array<unknown>,
): QuizQuestionSpec[] {
  // Seed with every explicit id so generated ids never collide with them,
  // regardless of position in the list.
  const takenIds = new Set<string>();
  for (const raw of rawQuestions) {
    const spec =
      raw !== null && typeof raw === "object" ? (raw as RawQuizQuestionSpec) : {};
    if (typeof spec.id === "string" && spec.id.length > 0) {
      takenIds.add(spec.id);
    }
  }
  return rawQuestions.map((raw, index) =>
    normalizeQuestionSpec(raw, index, takenIds),
  );
}

/**
 * PURE normalization from a possibly-legacy raw document into the canonical
 * multi-question {@link QuizData} shape. A multi `questions` list (non-empty)
 * normalizes per question; the flat legacy / 1-question canonical shape wraps
 * into a one-element list. Never throws; malformed values degrade to empty
 * defaults and a `null` answer.
 */
export function normalizeQuizData(raw: RawQuizData): QuizData {
  if (Array.isArray(raw.questions) && raw.questions.length > 0) {
    return { questions: normalizeQuestionSpecs(raw.questions) };
  }

  const question = normalizeQuestion(raw.question);
  const options = Array.isArray(raw.options)
    ? raw.options.map((option, index) => normalizeOption(option, index))
    : [];

  const spec: QuizQuestionSpec = {
    id: "q-0",
    text: question.text,
    options,
    correctOptionId: resolveCorrectOptionId(raw, options),
  };
  if (question.media !== undefined) {
    spec.media = question.media;
  }

  return { questions: [spec] };
}

/**
 * Validates a raw document, returning human-readable error strings indexed
 * per question. An empty array means the document is valid.
 */
export function validateQuizData(raw: RawQuizData): string[] {
  const normalized = normalizeQuizData(raw);
  const errors: string[] = [];

  if (normalized.questions.length === 0) {
    errors.push("at least one question is required");
    return errors;
  }

  normalized.questions.forEach((question, index) => {
    if (question.text.trim().length === 0) {
      errors.push(`questions[${index}].text must be a non-empty string`);
    }

    if (question.options.length === 0) {
      errors.push(`questions[${index}].at least one option is required`);
    } else {
      question.options.forEach((option, optionIndex) => {
        if (option.text.trim().length === 0) {
          errors.push(
            `questions[${index}].options[${optionIndex}].text must be a non-empty string`,
          );
        }
      });
    }

    if (question.correctOptionId === null) {
      errors.push(
        `questions[${index}].exactly one correct option must be resolvable`,
      );
    }
  });

  return errors;
}