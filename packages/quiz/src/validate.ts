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
/**
 * Author-facing readiness check for quiz data, used by the content type's
 * `validate`. Returns friendly messages (e.g. "Question 1 needs text"); an
 * empty array means the quiz is ready to save.
 */
export function getQuizAuthoringIssues(data: QuizData): string[] {
  if (data.questions.length === 0) return ["Add at least one question"];

  const issues: string[] = [];
  data.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (question.text.trim().length === 0) {
      issues.push(`${label} needs text`);
    }
    if (question.options.length < 2) {
      issues.push(`${label} needs at least 2 options`);
    }
    question.options.forEach((option, optionIndex) => {
      if (option.text.trim().length === 0) {
        issues.push(`${label}, option ${optionIndex + 1} needs text`);
      }
    });
    const hasCorrect = question.options.some(
      (option) => option.id === question.correctOptionId,
    );
    if (!hasCorrect) issues.push(`${label} needs a correct answer`);
  });
  return issues;
}
