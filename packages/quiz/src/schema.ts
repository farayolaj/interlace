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

export interface QuizQuestion {
  text: string;
  media?: QuizMediaRef;
}

/** Rich raw per-question spec (multi-question documents). */
export interface RawQuizQuestionSpec {
  id?: string;
  text?: string;
  media?: QuizMediaRef;
  options?: Array<string | QuizOption>;
  correctIndex?: number;
  correctOptionId?: string | null;
}

/** Canonical per-question shape this package defines and maintains. */
export interface QuizQuestionSpec {
  id: string;
  text: string;
  media?: QuizMediaRef;
  options: QuizOption[];
  correctOptionId: string | null;
}

/** Canonical multi-question QuizData shape this package defines and maintains. */
export interface QuizData {
  questions: QuizQuestionSpec[];
}

/**
 * What a document may contain: the flat legacy v1 shape (`question` string +
 * numeric `correctIndex`), the 1-question canonical shape, and the
 * multi-question shape (`questions`).
 */
export interface RawQuizData {
  question?: string | QuizQuestion;
  options?: Array<string | QuizOption>;
  correctIndex?: number;
  correctOptionId?: string | null;
  questions?: Array<RawQuizQuestionSpec>;
}