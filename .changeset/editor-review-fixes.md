---
"@interlacejs/editor": minor
---

- Uploads: drag and drop a video onto the upload area; **Retry** continues with the same file (resumable hosts pick up where they stopped), and a **Cancel upload** button aborts the `signal` now passed to `onUpload(file, { signal })`.
- Clearer timeline: the empty state explains how to add a hook, the add buttons say where new hooks go ("Adds at the playhead (…)"), and the zoom buttons are captioned and named "Zoom timeline in/out", and the last ruler label no longer overlaps the previous one near the end of the video. The select-a-hook hint no longer repeats the timeline's message while there are no hooks.
- New options: `stickyHeader`, `showReplaceVideoButton`, `hideEmptyInspector`, and a `ref` handle (`save()`, `openPreview()`, `replaceVideo()`) for triggering actions from host UI.
