# Interlace

> Interactive video: author, play back, and score in-video content — quizzes, anchors, completed tags — over any HTML5 video.

Interlace is a TypeScript monorepo library for building interactive video experiences. The editor lets you place **hooks** on the video timeline (blocking pauses, non-blocking overlays), author rich single-choice quizzes, and save the result as a portable JSON document. The player takes that document, renders the interactive layer over native video controls, and reports an aggregate score when content completes.

## Packages

| Package | What it gives you |
| --- | --- |
| [`@interlace/core`](packages/core) | The playback state machine (`InteractiveMediaController`), content lifecycle (`ContentInstance`), hook types + validation, serialization (`serialize`/`deserialize`), and the `VideoAdapter` interface |
| [`@interlace/native-adapter`](packages/native-adapter) | A ready `VideoAdapter` implementation wrapping an HTML5 `<video>` element (overlay mounting, fullscreen, programmatic-event suppression) |
| [`@interlace/player`](packages/player) | The React playback runtime: `InteractiveVideoPlayer`, the `useInteractiveMedia` hook, the overlay system (anchors, blocking overlays, completed tags), completion feedback, and error boundaries |
| [`@interlace/editor`](packages/editor) | The React authoring UI: `InterlaceEditor` (host component), keyframe timeline, hook inspector, placement editor, preview, and content-type slots |
| [`@interlace/quiz`](packages/quiz) | The canonical quiz content type — authoring many questions at once, playback with Previous/Next navigation, one point per question |

Two demo apps live alongside them:

- `apps/demo` — a dual-mode Author/Watch demo, the fastest way to see the whole round trip working
- `apps/storybook` — the components' story gallery (`pnpm --filter @interlace/storybook dev`, port 6006)

## Requirements

- Node.js **>= 24**
- pnpm (the repo pins `pnpm@9` via `packageManager`)

## Quick start

```bash
pnpm install
pnpm build          # builds all packages (core → quiz → player → editor)
pnpm --filter @interlace/demo dev   # open the demo (Author / Watch tabs)
```

The demo starts in **Author** mode: add a video source, place hooks along the timeline, author a quiz, and save — saving hands off to **Watch** mode, which plays the built-in 20-second sample trailer (a blocking quiz at 5s and a click-reveal anchor hook) or your saved document. "Reset to sample" brings the built-in document back.

Other useful scripts (from the repo root):

```bash
pnpm build          # build every package (turbo run build)
pnpm test           # run every suite
pnpm check-types    # typecheck everything
pnpm lint           # lint everything
pnpm --filter @interlace/storybook dev   # component gallery on :6006
```

## Using the library

The mental model: an authoring flow produces a **serialized document** (plain JSON); a playback flow consumes it **with a video adapter and a content-type registry**. Content types are the plugin system — the runtime renders whatever a registered type provides for authoring and playback.

### 1. Register content types

```ts
import { ContentTypeRegistry } from "@interlace/core";
import { QuizContentType } from "@interlace/quiz";

const registry = new ContentTypeRegistry();
registry.register(QuizContentType); // authoring + playback in one object, id "quiz-editor"
```

### 2. Author

```tsx
import { InterlaceEditor } from "@interlace/editor";

<div style={{ width: 960, height: 640 }}>
  <InterlaceEditor
    contentTypeRegistry={registry}
    document={existingDoc}        // optional: omit for a fresh document
    onUpload={async (file) => URL.createObjectURL(file)}   // your upload story
    onSave={(doc) => save(doc)}   // the host owns persistence
    onError={(e) => showError(e.message)}
  />
</div>
```

`onSave` receives the finished document — persist it wherever you like. The editor never persists on its own.

### 3. Play

```tsx
import { InteractiveVideoPlayer } from "@interlace/player";
import { NativeVideoAdapter } from "@interlace/native-adapter";
import { useEffect, useRef, useState } from "react";

function Watch({ doc }: { doc: SerializedInteractiveMediaDocument }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [adapter, setAdapter] = useState<NativeVideoAdapter>();

  useEffect(() => {
    if (!videoRef.current) return;
    const a = new NativeVideoAdapter(videoRef.current);
    setAdapter(a);
    return () => a.destroy?.();
  }, []);

  if (!adapter) return <p>Loading…</p>;

  return (
    <>
      <video ref={videoRef} src={doc.video.src} controls />
      <InteractiveVideoPlayer
        adapter={adapter}
        document={doc}
        registry={registry}
        onError={(e) => showError(e.message)}
      />
    </>
  );
}
```

The player mounts its overlay (anchor buttons, completed tags, blocking content) over the video. Blocking hooks pause the video until the content is completed; the completion surface stays until the viewer clicks **Continue**. Non-blocking hooks stay anchored inside their time window, can be opened, skipped, and are indicated as taken once completed — they cannot be retaken.

### Document format

A serialized document is JSON: the video source/duration plus one entry per hook.

```json
{
  "video": { "src": "https://example.com/video.mp4", "duration": 120 },
  "items": [
    {
      "id": "quiz-1",
      "title": "Knowledge check",
      "hook": {
        "type": "blocking",
        "timestamp": 30,
        "placement": { "x": 10, "y": 10, "width": 40, "height": 40 }
      },
      "content": { "contentTypeId": "quiz-editor", "version": 1, "data": { "questions": [ ... ] } }
    }
  ]
}
```

Hook types:

- **blocking** — `timestamp` + `placement`. Pauses the video at the timestamp and opens the content; playback continues only after the viewer completes it (Continue acknowledges, then resumes).
- **non-blocking** — `start`/`end` + `placement` + `revealBehavior` (`"click"` shows an anchor the viewer can take or skip; `"immediate"` opens the content right away). Anchors stay visible across the whole window and are re-armed when the video returns to the window.

### Writing your own content type

Anything that satisfies the `ContentType` contract can join the registry:

```ts
import type { ContentType } from "@interlace/core";

registry.register({
  getId: () => "custom-widget",
  getVersion: () => 1,
  getMaximumScore: (data) => 100,          // optional scoring
  preload: async () => {},
  renderEditor: (container, data, onChange) => { /* authoring UI */ },
  renderPlayback: (container, data, callbacks) => { /* playback UI; call callbacks.onComplete(score) once */ },
});
```

## Project structure

```
interlace/
├── apps/
│   ├── demo/               # Author/Watch demo app (Vite)
│   └── storybook/          # Component story gallery
├── packages/
│   ├── core/               # State machine, hooks, serialization, adapter contract
│   ├── native-adapter/     # HTML5 <video> adapter
│   ├── player/             # React playback runtime
│   ├── editor/             # React authoring UI
│   ├── quiz/               # Canonical quiz content type
│   ├── eslint-config/      # Shared ESLint config (@repo/*)
│   └── typescript-config/  # Shared tsconfig (@repo/*)
├── turbo.json              # Task pipeline (build/dev/test/lint/check-types)
└── pnpm-workspace.yaml
```

## Development

```bash
pnpm install                  # set up
pnpm build                    # build all packages
pnpm test                     # run all suites (vitest per package)
pnpm check-types && pnpm lint # typecheck + lint

# work on one package only
pnpm --filter @interlace/player test
pnpm --filter @interlace/editor build   # turbo handles the core/quiz→player→editor order

# demo / storybook while developing
pnpm --filter @interlace/demo dev
pnpm --filter @interlace/storybook dev
```

Test commands are `vitest run` per package; suites live next to their sources (`packages/*/src/*.test.*`). If you change a package that others consume, run `pnpm build` first — packages resolve each other's `dist` output.

## Contributing

1. **Fork / branch, then make your change** in the relevant package. Follow the existing style: React components with inline token-based styling (`packages/*/src/tokens.ts`), tests colocated with sources, conventional commits (`feat:`, `fix:`, `chore:`, `test:`…).
2. **Validate**: run `pnpm check-types`, `pnpm test`, and `pnpm build`. Anything user-facing should touch a story in `apps/storybook` if it's a component.
3. **Add a changeset** in `.changeset/` (or update the pending one) describing the user-facing change and the affected packages — this repo versions via changesets with `pnpm changeset`.
4. **Keep behavior contracts**: the packages' public exports, the `ContentType` contract, pointer-events layering in the player, and the serialized document format are load-bearing — if you change their semantics, say so in the changeset.

Good first contributions: more content types (the registry is deliberately small), more stories, and demo polish.

## License

ISC
