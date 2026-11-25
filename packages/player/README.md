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
  adapter={adapter} // a VideoAdapter (NativeVideoAdapter works)
  document={doc} // SerializedInteractiveMediaDocument
  registry={registry}
  onError={(e) => showError(e)}
/>;
```

Behavior notes:

- Blocking hooks pause the video and open content; only completion lets playback continue (the completion surface needs **Continue** click). Blocking content cannot be dismissed.
- Non-blocking hooks stay anchored inside their time window, can be opened or **skipped** (skip hides it for that window visit; re-approaching the window re-arms it), and completion swaps the anchor for a tag that cannot be re-taken.

## Quality menu

When the adapter implements the optional quality capability (`supportsQuality(adapter)` from `@interlacejs/core`, e.g. [`@interlacejs/hls-adapter`](https://github.com/farayolaj/interlace/tree/main/packages/hls-adapter)) and reports at least two levels, the player draws a quality button in the top-right corner of the video frame. It opens a menu with **Auto** (showing the level playing, e.g. "Auto · 480p"), each level from high to low, and "Data saver" on the lowest one.

- It stays visible while the video is paused, the menu is open, or the button has focus. While playing, it fades out after 2.5 s without pointer movement over the video and comes back on movement, touch or keyboard focus.
- It is hidden while content (such as a blocking quiz) is open, and only the button and menu take pointer events.
- It follows the menu-button pattern: arrow keys, Home/End, Enter/Space to select, Escape or an outside click to close.

```tsx
<InteractiveVideoPlayer
  adapter={hlsAdapter}
  document={doc}
  registry={registry}
  showQualityControl // default true; pass false to hide it
  strings={{
    qualityLabel: "Qualité",
    qualityAutoLabel: "Auto",
    qualityDataSaverLabel: "Économie de données",
  }}
/>
```

`QualityControl` is also exported if you want to place it yourself.

## Types and authoring

Documents are produced by [`@interlacejs/editor`](https://github.com/farayolaj/interlace) but they are plain JSON — see the [root README](https://github.com/farayolaj/interlace) for the full document shape and the `apps/demo` source for a working wiring.

## Theming

Pass `theme` (an `InterlaceTheme` from `@interlacejs/core`) or set `--interlace-*` CSS variables on any ancestor. See the editor README's "Styling and theming" section for the full list.

## License

ISC
