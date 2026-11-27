---
"@interlacejs/editor": minor
---

- Uploads: **Retry** continues with the same file (resumable hosts pick up where they stopped), and a **Cancel upload** button aborts the `signal` now passed to `onUpload(file, { signal })`.
- Clearer timeline: the empty state explains how to add a hook, the add buttons say where new hooks go ("Adds at the playhead (…)"), and the zoom buttons are captioned and named "Zoom timeline in/out". The select-a-hook hint no longer repeats the timeline's message while there are no hooks.
- New options: `stickyHeader`, `showReplaceVideoButton`, `hideEmptyInspector`, and a `ref` handle (`save()`, `openPreview()`, `replaceVideo()`) for triggering actions from host UI.
