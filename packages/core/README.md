# @interlacejs/core

The core of the [Interlace](https://github.com/farayolaj/interlace) interactive-video library: the framework-free pieces both the authoring UI and the playback runtime build on.

## What's inside

- **`InteractiveMediaController`** — the playback state machine: hook triggering, seek snap-back, rewind rules, aggregate scoring, and `finished` emission.
- **`ContentInstance`** — the content lifecycle state machine (`pending → visible → opened → completed/skipped`) with per-item state transitions and score recording.
- **Hooks** — `blocking` (pause at a timestamp) and `non-blocking` (time-window overlay) types with overlap validation.
- **Serialization** — `serialize` / `deserialize` with validation for the portable JSON interactive-video document.
- **`VideoAdapter`** — the interface contract any player implementation must satisfy, plus `ProgrammaticActionGuard` for programmatic-event suppression.
- **`ContentTypeRegistry` + `ContentType`** — the plugin contract for authoring/playback surfaces (the `@interlacejs/quiz` type is one such plugin).

## Install

```bash
pnpm add @interlacejs/core
```

## Minimal example

```ts
import { ContentTypeRegistry, deserialize } from "@interlacejs/core";
import { InteractiveMediaController } from "@interlacejs/core";

const registry = new ContentTypeRegistry();
const result = deserialize(document, registry);

const controller = new InteractiveMediaController(result.items, result.videoDuration);
controller.on("requestPause", () => adapter.pause());

// drive it from your render loop
controller.tick(video.currentTime, isPlaying);
const renderState = controller.getRenderState(video.currentTime);
// renderState.visibleAnchorIds / activeBlockingContentId / completedTagIds
```

## React wrappers and a full demo

The React runtime (`@interlacejs/player`), the authoring UI (`@interlacejs/editor`), and the canonical quiz type (`@interlacejs/quiz`) build on this package. See the [root README](https://github.com/farayolaj/interlace) for the full walkthrough and the `apps/demo` source for a working wiring.

## License

ISC
