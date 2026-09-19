/**
 * Editor-facing re-exports of the shared `@interlacejs/quiz` content type.
 *
 * The rich authoring implementation lives in `@interlacejs/quiz`; the editor
 * keeps the `QuizEditor` name and the canonical `QuizData` shape for its
 * public API (the legacy raw format was removed).
 */
export { QuizEditorType as QuizEditor } from "@interlacejs/quiz";
export type { QuizData } from "@interlacejs/quiz";