/**
 * Player-facing re-exports of the shared `@interlace/quiz` content type.
 *
 * The implementation (rich playback + canonical authoring) lives in
 * `@interlace/quiz`; the player keeps these names for its public API.
 * `QuizData` is aliased to the legacy-tolerant raw shape so existing
 * player consumers and documents keep working.
 */
export {
  QuizContentType,
  renderQuizPlayback,
  unmountQuizPlayback,
} from "@interlace/quiz";
export type { RawQuizData as QuizData } from "@interlace/quiz";
