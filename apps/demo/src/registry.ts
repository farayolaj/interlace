import { ContentTypeRegistry } from "@interlace/core";
import { QuizContentType } from "@interlace/quiz";

/**
 * Registry backing the demo's content surfaces. The quiz content type is
 * registered now so Phase 2's author/watch wiring can resolve it; the
 * placeholders stay static until then.
 */
export const registry = new ContentTypeRegistry();
registry.register(QuizContentType);