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
    document={existingDoc}        // optional: omit for a fresh document
    onUpload={async (file) => URL.createObjectURL(file)}   // your upload story
    onSave={(doc) => save(doc)}   // the host owns persistence
    onError={(e) => showError(e.message)}
  />
</div>
```

`onSave` receives the serialized document (JSON) ready for the player (`@interlacejs/player`). The editor never persists on its own — bring your own storage.

## Strings and theming

Both `InterlaceEditor` and sub-components accept `strings`/`theme` overrides; the built-in default strings derive from `@interlacejs/core`'s `DEFAULT_STRINGS` so hosts can localize once.

See the [root README](https://github.com/farayolaj/interlace) for the document format and the `apps/demo` for a working wiring.

## License

ISC
