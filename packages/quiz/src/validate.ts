import type { QuizData } from "./schema";

/**
 * Validates canonical quiz data, returning human-readable error strings
 * indexed per question. An empty array means the document is valid.
 *
 * The legacy flat input format was removed; only the canonical
 * multi-question `QuizData` shape is accepted.
 */
export function validateQuizData(data: QuizData): string[] {
  const errors: string[] = [];

  if (data.questions.length === 0) {
    errors.push("at least one question is required");
    return errors;
  }

  data.questions.forEach((question, index) => {
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