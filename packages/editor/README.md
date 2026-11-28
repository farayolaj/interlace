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
import { InterlaceEditor } from "@interlacejs/editor";
import { QuizContentType } from "@interlacejs/quiz";
import { ContentTypeRegistry } from "@interlacejs/core";

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

Files can be chosen with the button or dragged onto the upload area (non-video files are refused with a message). `onUpload(file, { signal })` resolves to the file's URL. `signal` aborts when the user presses **Cancel upload**; honour it to stop the transfer. After a failed upload, **Retry** calls `onUpload` again with the same file, so an upload you can resume continues where it stopped.

`onDirtyChange` fires when the editor gains or loses unsaved changes, relative to the loaded `document` (or an empty one) and the last `onSave`. Use it to warn before navigating away. Duration corrections the editor makes from the video's metadata do not count as changes.

## Strings

`InterlaceEditor` and its sub-components accept `strings` overrides; the defaults derive from `@interlacejs/core`'s `DEFAULT_STRINGS`, so hosts can localize once.

The defaults are exported (`DEFAULT_EDITOR_STRINGS`, `DEFAULT_VIDEO_SOURCE_INPUT_STRINGS`, `DEFAULT_KEYFRAME_TIMELINE_STRINGS`, …) as the full list of keys to translate. Recent additions:

| Key                  | Default                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `cancelUploadLabel`  | Cancel upload                                                                   |
| `dropHint`           | or drag and drop a video file here                                              |
| `dropActiveLabel`    | Drop the video to upload it                                                     |
| `notAVideoLabel`     | That file isn't a video. Drop or choose a video file.                           |
| `addAtPlayheadLabel` | Adds at the playhead ({time}) — `{time}` is replaced with the playhead position |
| `zoomCaption`        | Zoom                                                                            |

`zoomInLabel` / `zoomOutLabel` now default to "Zoom timeline in" / "Zoom timeline out", and `noItemSelectedLabel` to "Select a hook on the timeline to edit it."

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

### Video adapters (HLS with a quality menu)

Pass `createVideoAdapter` to let an adapter load the video instead. The editor calls it with the `<video>` and `playbackSrc ?? document src` for the authoring video and for the preview, and destroys the adapter on a source change, preview close and unmount; `attachMedia` is then ignored. If the adapter supports quality levels (like `HlsVideoAdapter`), the authoring video gets the player's quality control in its top-right corner, as the preview does.

```tsx
import { HlsVideoAdapter } from "@interlacejs/hls-adapter";

<InterlaceEditor
  {...props}
  playbackSrc={hlsUrl}
  createVideoAdapter={(video, src) =>
    new HlsVideoAdapter(video, {
      src,
      fallbackSrc: mp4Url,
      rememberQualityKey: "my-app:video-quality",
    })
  }
/>;
```

As with `attachMedia`, a new function on each render does not re-create the adapter.

## Layout options and actions from your own UI

| Prop                     | Default | Effect                                                                                                                                                                            |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stickyHeader`           | `false` | Pins the header (status, Preview, Save) to the top of the nearest scrolling container, so Save stays reachable on long pages.                                                     |
| `showReplaceVideoButton` | `true`  | Shows "Replace video" under the video. Hide it to offer the action elsewhere (below).                                                                                             |
| `hideEmptyInspector`     | `false` | In the wide layout, hides the side panel while no hook is selected, so the video and timeline use the full width.                                                                 |
| `showSaveButton`         | `true`  | Shows the built-in Save button. Hide it to save from your own button with the ref handle's `save()`.                                                                              |
| `headerActions`          | —       | Your own controls, shown before Preview and Save (and in the video step's header), e.g. a Cancel button. Give them the `interlace-btn interlace-btn--secondary` classes to match. |

Pass a `ref` to trigger editor actions from your own controls (a menu, a footer):

```tsx
import { InterlaceEditor, type InterlaceEditorHandle } from "@interlacejs/editor";

const editor = useRef<InterlaceEditorHandle>(null);

<InterlaceEditor ref={editor} showReplaceVideoButton={false} {...props} />
<button onClick={() => editor.current?.replaceVideo()}>Replace video</button>
```

`save()`, `openPreview()` and `replaceVideo()` behave like the built-in buttons. They return `false` and do nothing while the video source step is shown.

## Saving

Save is blocked while any hook needs attention: no title, no content type yet, or problems reported by the content type's `validate()`. The editor lists them with links to each hook. Hooks without a content type are kept as drafts on the timeline until you finish or delete them.

## License

ISC
