---
"@interlace/editor": major
"@interlace/player": minor
"@interlace/quiz": minor
---

Move the quiz content type into a dedicated `@interlace/quiz` package with rich media (question and options carry media), an upgraded authoring editor, and canonical data emission on edit. The `QuizData` types exported by the editor and player widened to accept legacy documents; consumers typing against the old flat quiz shape should use `RawQuizData` or the normalized `@interlace/quiz` types.
