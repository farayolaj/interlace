---
"@interlacejs/core": minor
"@interlacejs/editor": minor
"@interlacejs/player": minor
"@interlacejs/quiz": minor
---

Editor design refresh and library-wide theming.

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
