---
"@interlacejs/editor": minor
---

New `headerActions` prop: host controls (e.g. a Cancel button) shown before Preview and Save, and in the video step's header. New `showSaveButton` prop (default `true`) to hide the built-in Save button and save from host UI with the ref handle's `save()`.

Fix: with `stickyHeader`, the wide layout's pinned video column now stops below the header instead of sliding under it (which hid the top of the video).
