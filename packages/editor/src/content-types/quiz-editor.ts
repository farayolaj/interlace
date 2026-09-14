/**
 * Editor-facing re-exports of the shared `@interlace/quiz` content type.
 *
 * The rich authoring implementation lives in `@interlace/quiz`; the editor
 * keeps the `QuizEditor` name (and the canonical `QuizData` shape plus the
 * legacy-tolerant `RawQuizData`) for its public API.
 */
export { QuizEditorType as QuizEditor } from "@interlace/quiz";
export type { QuizData, RawQuizData } from "@interlace/quiz";
