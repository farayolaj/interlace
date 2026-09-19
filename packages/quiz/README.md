# @interlacejs/quiz

The canonical quiz content type for [Interlace](https://github.com/farayolaj/interlace): single-choice questions with rich media, authored and played back through one package.

## What's inside

- **`QuizContentType`** — the `ContentType` implementation (editor + playback) registered under the id `quiz-editor`, data-format version 1.
- **`QuizEditorType` / `unmountQuizEditor`** — the authoring surface: question list (add/remove/switch), per-question text and media, option rows with thumbnails, correctness select, and a focus-preserving controller.
- **`renderQuizPlayback` / `unmountQuizPlayback`** — the playback renderer: one question at a time ("Question i of n"), reveal/lock on answer (correct ✓ / incorrect ✕), review-only **Previous**, **Next** gated on answering — and one point per correctly answered question, reported once via `callbacks.onComplete(correctCount)` on the final question.
- **`validateQuizData`** — canonical-only structural validation (≥ 1 question, non-empty text/options, resolvable correctness).

## Install

```bash
pnpm add @interlacejs/quiz @interlacejs/core
```

## One data format

```ts
import type { QuizData, QuizQuestionSpec } from "@interlacejs/quiz";

type QuizData = {
  questions: Array<{
    id: string;              // e.g. "q-0"
    text: string;
    media?: { src: string; alt?: string };
    options: Array<{ id: string; text: string; media?: { src: string; alt?: string } }>;
    correctOptionId: string | null;
  }>;
};
```

Every document — authored, serialized, or played back — uses this shape; there is no separate legacy format.

## Use as a content type

```ts
import { QuizContentType } from "@interlacejs/quiz";
import { ContentTypeRegistry } from "@interlacejs/core";

const registry = new ContentTypeRegistry();
registry.register(QuizContentType); // authoring + playback wired at once
```

Register it in the `registry` you pass to `@interlacejs/editor` (authoring) and `@interlacejs/player` (playback) — the demo's snapshots of this in `apps/demo/src/registry.ts`.

## License

ISC
