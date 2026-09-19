import { ContentTypeRegistry } from "@interlacejs/core";
import { QuizContentType } from "@interlacejs/quiz";

/**
 * Registry backing the demo's content surfaces. The quiz content type is
 * registered once and shared by the author (editor) and watch (player)
 * modes.
 */
export const registry = new ContentTypeRegistry();
registry.register(QuizContentType);

/** Returns the shared demo registry (created once at module load). */
export function getRegistry(): ContentTypeRegistry {
  return registry;
}