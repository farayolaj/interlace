# @interlace/player

## 0.1.0

### Minor Changes

- c2405af: Make interactive playback feel finished: completed blocking content now shows a completion feedback surface with a Continue button that resumes playback (playback no longer resumes automatically), blocking content can no longer be dismissed (it plays until interacted with and completed), non-blocking content opened in the overlay has a Skip control and reflects whether it can be taken again, the quiz player advances through multiple questions with explicit Previous / Next buttons (the final question's Next submits the aggregate score) instead of auto-advancing, and answered options get a clear correct/incorrect reveal, and the edit timeline now opens zoomed to the full video duration with no vertical scrolling and plain-wheel zoom control (scroll up zooms in, scroll down zooms out).
- 809667c: The quiz content type now uses ONE canonical data format: `QuizData = { questions: QuizQuestionSpec[] }`, where each spec carries an `id`, `text`, optional `media`, `options` (option objects with ids), and `correctOptionId`. The legacy flat format (`question`/`options`/`correctIndex`) and all old→new transformation plumbing (`normalizeQuizData`, `RawQuizData`) were removed — every authored document is canonical multi-question. Scoring is one point per correctly answered question: `getMaximumScore(data)` is the question count and playback reports `onComplete(correctCount)` once on the final question. Authoring gains a question list with add/remove and per-question editing; playback shows one question at a time with a "Question i of n" indicator, per-question reveal/lock, and explicit Previous/Next navigation. Version stays 1.

### Patch Changes

- Updated dependencies [c2405af]
- Updated dependencies [809667c]
- Updated dependencies [bfccabf]
  - @interlace/core@0.1.0
  - @interlace/quiz@0.1.0
