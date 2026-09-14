import { ContentType } from "@interlace/core";
import type { QuizData } from "./schema";

/**
 * Built-in Quiz content type for Interlace.
 *
 * Phase 1 skeleton; rich authoring/playback land in Phase 2. Registered id is
 * `quiz-editor` — the id `@interlace/editor`'s built-in QuizEditor authors
 * with — so editor-authored documents resolve without extra registry wiring.
 */
export const QuizContentType: ContentType<QuizData> = {
  getId: () => "quiz-editor",
  getVersion: () => 1,

  getMaximumScore(): number | undefined {
    return 100;
  },

  async preload(): Promise<void> {
    // No preload needed for quiz content.
  },

  // Phase 2 will fill the real surfaces; Phase-1 stubs.
  renderEditor(): void {
    // Phase 2.
  },

  updateEditor(): void {
    // Phase 2.
  },

  renderPlayback(): void {
    // Phase 2.
  },

  unmountPlayback(container: HTMLElement): void {
    // Phase 2.
    void container;
  },

  unmount(container: HTMLElement): void {
    // Phase 2.
    void container;
  },
};