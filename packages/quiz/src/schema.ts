export interface QuizMediaRef {
  /** Absolute or relative URL of the media asset. */
  src: string;
  /** Accessible description of the media. */
  alt?: string;
}

export interface QuizOption {
  id: string;
  text: string;
  media?: QuizMediaRef;
}

/** Canonical per-question shape this package defines and maintains. */
export interface QuizQuestionSpec {
  id: string;
  text: string;
  media?: QuizMediaRef;
  options: QuizOption[];
  correctOptionId: string | null;
}

/**
 * Canonical single-format QuizData shape this package defines and maintains.
 * There is only ONE format: a `questions` list of fully-authored specs (ids,
 * option objects, explicit correctness). The legacy flat format was removed.
 */
export interface QuizData {
  questions: QuizQuestionSpec[];
}