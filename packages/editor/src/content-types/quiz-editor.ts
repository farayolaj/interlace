/**
 * Editor-facing re-exports of the shared `@interlace/quiz` content type.
 *
 * The rich authoring implementation lives in `@interlace/quiz`; the editor
 * keeps the `QuizEditor` name and the canonical `QuizData` shape for its
 * public API (the legacy raw format was removed).
 */
export { QuizEditorType as QuizEditor } from "@interlace/quiz";
export type { QuizData } from "@interlace/quiz";