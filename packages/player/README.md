# @interlacejs/player

The React playback runtime for [Interlace](https://github.com/farayolaj/interlace) interactive videos: render the interactive layer (anchors, blocking content, completed tags) over any video stream backed by a `VideoAdapter`.

## What's inside

- **`InteractiveVideoPlayer`** — the top-level component: controller wiring, overlay layers, blocking-overlays with completion feedback and a Continue acknowledgment, playback-resume, and render-state-driven rendering.
- **`useInteractiveMedia`** — the hook underneath: adapter event wiring, the rAF tick loop, and the deserialized content instances.
- **Overlay components** — `Anchor` (with a Skip affordance), `BlockingOverlay` (focus-trapped; cannot be dismissed — blocks until completed), `CompletedTag`, and `ContentErrorBoundary`.
- **`PreloadScheduler`** — content preloading with configurable lead time.

## Install

```bash
pnpm add @interlacejs/player @interlacejs/core @interlacejs/native-adapter
```

## Minimal example

```tsx
import { InteractiveVideoPlayer } from "@interlacejs/player";
import { NativeVideoAdapter } from "@interlacejs/native-adapter";
import { QuizContentType } from "@interlacejs/quiz";
import { ContentTypeRegistry } from "@interlacejs/core";

const registry = new ContentTypeRegistry();
registry.register(QuizContentType);

<InteractiveVideoPlayer
  adapter={adapter}            // a VideoAdapter (NativeVideoAdapter works)
  document={doc}               // SerializedInteractiveMediaDocument
  registry={registry}
  onError={(e) => showError(e)}
/>
```

Behavior notes:

- Blocking hooks pause the video and open content; only completion lets playback continue (the completion surface needs **Continue** click). Blocking content cannot be dismissed.
- Non-blocking hooks stay anchored inside their time window, can be opened or **skipped** (skip hides it for that window visit; re-approaching the window re-arms it), and completion swaps the anchor for a tag that cannot be re-taken.

## Types and authoring

Documents are produced by [`@interlacejs/editor`](https://github.com/farayolaj/interlace) but they are plain JSON — see the [root README](https://github.com/farayolaj/interlace) for the full document shape and the `apps/demo` source for a working wiring.

## License

ISC
