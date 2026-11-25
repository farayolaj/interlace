# @interlacejs/editor

The React authoring UI for [Interlace](https://github.com/farayolaj/interlace) interactive videos: build one in your host app with the top-level `InterlaceEditor` component (or drive its pieces directly).

## What's inside

- **`InterlaceEditor`** — the full authoring experience as one component: video-source step, keyframe timeline (fits the video duration, wheel-zoom), hook inspector, placement editor with resize handles, gated preview, and a save flow.
- **`useAuthoringStore`** — the store hook underneath: create/add/update/remove content items, serialize the finished document.
- **Timeline components** — `KeyframeTimeline`, `Timeline`/`TimelineEntry` semantics for blocking and non-blocking hooks.
- **Content-type plumbing** — `ContentTypePicker`, `ContentTypeEditorSlot`, `ContentTypeEditor` mount layer, whatever type your registry holds.

## Install

```bash
pnpm add @interlacejs/editor @interlacejs/core @interlacejs/player @interlacejs/quiz
```

## Minimal example

```tsx
import { InterlaceEditor } from "@interlace/editor";
import { QuizContentType } from "@interlace/quiz";
import { ContentTypeRegistry } from "@interlace/core";

const registry = new ContentTypeRegistry();
registry.register(QuizContentType);

<div style={{ width: 960, height: 640 }}>
  <InterlaceEditor
    contentTypeRegistry={registry}
    document={existingDoc} // optional: omit for a fresh document
    onUpload={async (file) => URL.createObjectURL(file)} // your upload story
    onSave={(doc) => save(doc)} // the host owns persistence
    onError={(e) => showError(e.message)}
    onDirtyChange={(dirty) => setHasUnsavedChanges(dirty)} // optional
  />
</div>;
```

`onSave` receives the serialized document (JSON) ready for the player (`@interlacejs/player`). The editor never persists on its own — bring your own storage.

`onDirtyChange` fires when the editor gains or loses unsaved changes, relative to the loaded `document` (or an empty one) and the last `onSave`. Use it to warn before navigating away. Duration corrections the editor makes from the video's metadata do not count as changes.

## Strings

`InterlaceEditor` and its sub-components accept `strings` overrides; the defaults derive from `@interlacejs/core`'s `DEFAULT_STRINGS`, so hosts can localize once.

## Styling and theming

All Interlace UI (editor, player and quiz) draws its colours, fonts and corner radius from `--interlace-*` CSS custom properties, with the default look as the fallback. There are three ways to restyle it, from broadest to most specific:

1. **CSS variables.** Set them anywhere above the component; no JavaScript needed, and one rule covers the editor, player and quiz together.

   ```css
   :root {
     --interlace-accent: #6f42c1;
     --interlace-radius: 4px;
     --interlace-font-body: "Inter", system-ui, sans-serif;
     --interlace-font-display: "Inter", system-ui, sans-serif;
   }
   ```

   Variables: `accent`, `accent-hover`, `accent-contrast`, `accent-soft`, `text`, `text-muted`, `surface`, `surface-raised`, `border`, `border-strong`, `danger`, `danger-soft`, `warning`, `warning-soft`, `font-body`, `font-display`, `radius` (each prefixed `--interlace-`). Hover and soft tints are derived from the accent when you don't set them.

2. **The `theme` prop.** `InterlaceEditor` and `InteractiveVideoPlayer` accept a typed `theme` (`InterlaceTheme` from `@interlacejs/core`). It is applied as the same variables on the component's root, so it reaches everything inside, including the preview and content editors.

   ```tsx
   <InterlaceEditor theme={{ accentColor: "#6f42c1", radius: 4 }} /* … */ />
   ```

3. **Class names.** Controls carry stable classes (`interlace-btn`, `interlace-btn--primary|secondary|ghost|danger`, `interlace-input`, `interlace-field`, `interlace-label`, `interlace-choice`, `interlace-badge`), and the root takes a `className`. The built-in rules use zero-specificity `:where()` selectors, so your own rules for these classes win without `!important`.

## Playing a different source (HLS)

The document keeps its original `video.src` (e.g. the uploaded MP4), but you can author against another stream. `playbackSrc` replaces the source played by the authoring video and the preview; it is never written into the document or the `onSave` output and does not mark the editor dirty.

For formats the browser can't play natively, pass `attachMedia`. The editor then leaves the `<video>`'s `src` attribute unset and calls `attachMedia(video, playbackSrc ?? document src)` for the authoring video and for the preview's video, calling the returned cleanup before re-attaching (source change, video replaced) and on unmount or preview close. Interlace does not depend on hls.js; you bring the loader:

```tsx
import Hls from "hls.js";
import type { MediaAttacher } from "@interlacejs/editor";

const attachMedia: MediaAttacher = (video, src) => {
  const hls = new Hls();
  hls.attachMedia(video);
  hls.loadSource(src);
  return () => hls.destroy();
};

<InterlaceEditor
  document={doc} // doc.video.src stays the MP4
  playbackSrc={hlsUrl}
  attachMedia={attachMedia}
  /* … */
/>;
```

A new `attachMedia` function on each render does not re-attach; only a change of source or video element does.

## Saving

Save is blocked while any hook needs attention: no title, no content type yet, or problems reported by the content type's `validate()`. The editor lists them with links to each hook. Hooks without a content type are kept as drafts on the timeline until you finish or delete them.

## License

ISC
