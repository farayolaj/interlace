/**
 * Player-facing re-exports of the shared `@interlacejs/quiz` content type.
 *
 * The implementation (rich playback + canonical authoring) lives in
 * `@interlacejs/quiz`; the player keeps these names for its public API.
 * `QuizData` is the canonical single-format multi-question shape.
 */
export {
  QuizContentType,
  renderQuizPlayback,
  unmountQuizPlayback,
} from "@interlacejs/quiz";
export type { QuizData } from "@interlacejs/quiz";