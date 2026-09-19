# @interlace/core

## 0.1.1

### Patch Changes

- Add per-package READMEs so every published npm page documents its install, its API surface, and where the full walkthrough lives.

## 0.1.0

### Minor Changes

- c2405af: Make interactive playback feel finished: completed blocking content now shows a completion feedback surface with a Continue button that resumes playback (playback no longer resumes automatically), blocking content can no longer be dismissed (it plays until interacted with and completed), non-blocking content opened in the overlay has a Skip control and reflects whether it can be taken again, the quiz player advances through multiple questions with explicit Previous / Next buttons (the final question's Next submits the aggregate score) instead of auto-advancing, and answered options get a clear correct/incorrect reveal, and the edit timeline now opens zoomed to the full video duration with no vertical scrolling and plain-wheel zoom control (scroll up zooms in, scroll down zooms out).

### Patch Changes

- bfccabf: `serialize` now writes the authored content payload (`getData()`) into the
  `data` field of each serialized item instead of the runtime `ContentState`
  (`getState()`). The deserialize path already reads this field as the
  content payload, so documents now round-trip with the user's authored data
  intact. The serializer's signature is unchanged.

  Documents serialized by previous versions store the runtime
  `ContentState` string in `data`; `deserialize` will hand that string
  to content types as the authored payload. Re-save authored documents
  after upgrading.
