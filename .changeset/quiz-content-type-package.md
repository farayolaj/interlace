---
"@interlace/editor": major
"@interlace/player": minor
"@interlace/quiz": minor
---

Move the quiz content type into a dedicated `@interlace/quiz` package with rich media (question and options carry media), an upgraded authoring editor, and canonical data emission on edit. The `QuizData` types exported by the editor and player widened to accept legacy documents; consumers typing against the old flat quiz shape should use `RawQuizData` or the normalized `@interlace/quiz` types.

Add multi-question quiz support: the canonical `QuizData` shape is now `{ questions: QuizQuestionSpec[] }`, with a per-question `id`, `text`, optional `media`, `options`, and `correctOptionId`. All three input shapes — the flat legacy v1 document, the 1-question canonical document, and the new multi-question document — normalize into the canonical multi list. Authoring gains a question list with add/remove and per-question editing; playback shows one question at a time with a "Question i of n" indicator, per-question reveal/lock, a "Next question" affordance, and aggregate scoring (`Math.round(correct / total * 100)`) reported on the final question.