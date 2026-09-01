import { ContentType } from "@interlace/core";

/**
 * Data shape for quiz content authored through the editor.
 */
export interface QuizData {
  question: string;
  options: string[];
  correctIndex?: number;
}

/**
 * Built-in Quiz editor for creating/editing quiz content.
 *
 * Phase 1: this satisfies the new `ContentType<QuizData>` contract at the
 * type level. `renderEditor`/`renderPlayback`/`unmount` are no-op stubs;
 * behavioural wiring happens in Phase 2.
 */
export const QuizEditor: ContentType<QuizData> = {
  getId: () => "quiz-editor",
  getVersion: () => 1,

  getMaximumScore(data: QuizData): number | undefined {
    return 100;
  },

  async preload(): Promise<void> {
    // No preload needed
  },

  renderEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    // Phase 1: no-op stub; wiring is Phase 2.
  },

  renderPlayback(
    container: HTMLElement,
    data: QuizData,
    callbacks: { onComplete(score?: number): void },
  ): void {
    // Phase 1: no-op stub; wiring is Phase 2.
  },

  unmount(container: HTMLElement): void {
    // Cleanup placeholder
  },
};
