# @interlace/quiz

## 0.2.0

### Minor Changes

- 8aabf79: Editor design refresh and library-wide theming.
  - **Theming:** colours, fonts and corner radius in the editor, player and quiz now come from `--interlace-*` CSS variables. Hosts can set them in CSS, pass the typed `theme` prop (now on `InteractiveVideoPlayer` too, and applied to every surface rather than just the frame and Save button), or override the stable `interlace-*` classes. Core exports the shared tokens, `InterlaceTheme`, `themeToCssVariables` and `ensureInterlaceStyles`.
  - **Content type contract:** optional `getDisplayName`, `getDescription` and `validate`. The quiz implements all three.
  - **Editor:**
    - Unfinished hooks are kept as drafts, no longer replaced by the next new hook.
    - Save is blocked, with a linked list of problems, while any hook has no title, no content type or invalid content.
    - Hook details sits beside the video on wide screens.
    - The content type picker shows readable names and descriptions.
    - Hooks can switch between blocking and non-blocking.
    - Clearer button hierarchy, labels above fields and 32px minimum targets.
    - The timeline has no duplicate Play button, its labels don't overlap or clip, and hooks needing attention are flagged.
    - Fixed content edits overwriting a just-renamed hook's title.
  - **Quiz editor:**
    - The correct answer is a radio on each answer, and answers are labelled.
    - Images are tucked behind "Add image".
    - Row actions are quiet, and errors show inline once a field is touched.
    - New questions start with two answers.

### Patch Changes

- Updated dependencies [f0a2ccf]
- Updated dependencies [8aabf79]
  - @interlacejs/core@0.2.0

## 0.1.3

### Patch Changes

- Fix published package entry points: the `exports` map pointed at `./src/index.ts`, which is not included in the published tarball (only `dist/` ships), breaking resolution in strict resolvers like Vite. The `exports` map now points at the built `dist` files with proper `types`/`import`/`require` conditions, and the `module` field no longer references a non-existent `dist/index.mjs`.
- Updated dependencies
  - @interlacejs/core@0.1.3

## 0.1.1

### Patch Changes

- Add per-package READMEs so every published npm page documents its install, its API surface, and where the full walkthrough lives.
- Updated dependencies
  - @interlacejs/core@0.1.1

## 0.1.0

### Minor Changes

- 809667c: The quiz content type now uses ONE canonical data format: `QuizData = { questions: QuizQuestionSpec[] }`, where each spec carries an `id`, `text`, optional `media`, `options` (option objects with ids), and `correctOptionId`. The legacy flat format (`question`/`options`/`correctIndex`) and all old→new transformation plumbing (`normalizeQuizData`, `RawQuizData`) were removed — every authored document is canonical multi-question. Scoring is one point per correctly answered question: `getMaximumScore(data)` is the question count and playback reports `onComplete(correctCount)` once on the final question. Authoring gains a question list with add/remove and per-question editing; playback shows one question at a time with a "Question i of n" indicator, per-question reveal/lock, and explicit Previous/Next navigation. Version stays 1.

### Patch Changes

- Updated dependencies [c2405af]
- Updated dependencies [bfccabf]
  - @interlace/core@0.1.0
