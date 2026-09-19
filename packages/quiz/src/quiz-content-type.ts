import { ContentType } from "@interlacejs/core";
import { QuizEditorType, unmountQuizEditor } from "./quiz-editor";
import { renderQuizPlayback, unmountQuizPlayback } from "./quiz-player";
import type { QuizData } from "./schema";

/**
 * Built-in Quiz content type for Interlace. Authors the canonical
 * {@link QuizData} shape with rich media and plays it back with immediate
 * scoring. Registered id is `quiz-editor` — the id the editor's built-in
 * quiz type authors with — so authored documents resolve without extra
 * registry wiring.
 */
export const QuizContentType: ContentType<QuizData> = {
  getId: () => "quiz-editor",
  getVersion: () => 1,

  getMaximumScore(data): number | undefined {
    return data.questions.length;
  },

  async preload(): Promise<void> {
    // No preload needed for quiz content.
  },

  renderEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    QuizEditorType.renderEditor(container, data, onChange);
  },

  updateEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    QuizEditorType.updateEditor?.(container, data, onChange);
  },

  renderPlayback(
    container: HTMLElement,
    data: QuizData,
    callbacks: { onComplete(score?: number): void },
  ): void {
    renderQuizPlayback(container, data, callbacks);
  },

  unmountPlayback(container: HTMLElement): void {
    unmountQuizPlayback(container);
  },

  unmount(container: HTMLElement): void {
    unmountQuizEditor(container);
  },
};
