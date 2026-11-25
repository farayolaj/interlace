---
"@interlacejs/editor": minor
---

`InterlaceEditor` accepts `playbackSrc` and `attachMedia` to play a different source than `document.video.src` (e.g. an HLS stream through hls.js) in the authoring video and the preview. `playbackSrc` is playback-only: it is never serialized and does not affect dirty tracking. With `attachMedia`, the editor leaves the `<video>`'s `src` unset and calls `attachMedia(video, src)` instead, running the returned cleanup before re-attaching and on unmount or preview close. The loader type is exported as `MediaAttacher`.
