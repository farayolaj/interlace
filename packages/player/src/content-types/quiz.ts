/**
 * Player-facing re-exports of the shared `@interlace/quiz` content type.
 *
 * The implementation (rich playback + canonical authoring) lives in
 * `@interlace/quiz`; the player keeps these names for its public API.
 * `QuizData` is the canonical single-format multi-question shape.
 */
export {
  QuizContentType,
  renderQuizPlayback,
  unmountQuizPlayback,
} from "@interlace/quiz";
export type { QuizData } from "@interlace/quiz";