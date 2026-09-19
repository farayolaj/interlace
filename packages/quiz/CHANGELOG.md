# @interlace/quiz

## 0.1.0

### Minor Changes

- 809667c: The quiz content type now uses ONE canonical data format: `QuizData = { questions: QuizQuestionSpec[] }`, where each spec carries an `id`, `text`, optional `media`, `options` (option objects with ids), and `correctOptionId`. The legacy flat format (`question`/`options`/`correctIndex`) and all old→new transformation plumbing (`normalizeQuizData`, `RawQuizData`) were removed — every authored document is canonical multi-question. Scoring is one point per correctly answered question: `getMaximumScore(data)` is the question count and playback reports `onComplete(correctCount)` once on the final question. Authoring gains a question list with add/remove and per-question editing; playback shows one question at a time with a "Question i of n" indicator, per-question reveal/lock, and explicit Previous/Next navigation. Version stays 1.

### Patch Changes

- Updated dependencies [c2405af]
- Updated dependencies [bfccabf]
  - @interlace/core@0.1.0
