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

/** Canonical QuizData shape this package defines and maintains. */
export interface QuizData {
  question: QuizQuestion;
  options: QuizOption[];
  correctOptionId: string | null;
}

/**
 * What a document may contain (legacy v1 documents store strings with a
 * numeric correctIndex; authored docs store the canonical shape).
 */
export interface RawQuizData {
  question: string | QuizQuestion;
  options: Array<string | QuizOption>;
  correctIndex?: number;
  correctOptionId?: string;
}
