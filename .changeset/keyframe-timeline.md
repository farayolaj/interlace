---
"@interlace/editor": major
---

Replace the list-style `Timeline` / `TimelineEntry` with a zoomable keyframe timeline and a hook inspector.

- **Breaking:** the `Timeline` and `TimelineEntry` named exports (and their props types) are removed. The new `KeyframeTimeline` component renders hooks the way a video editor does: blocking hooks as point keyframes, non-blocking hooks as draggable range bars, a scrubbable playhead, and zoom controls.
- **Breaking:** the `onAddEntry` contract no longer creates hooks at time zero. New hooks land at the current playhead — the playhead is the keyframe insertion point.
- Clicking a keyframe seeks the authoring video to the hook's anchor time and opens the content editor (the pre-existing select-to-edit contract, now driven from the strip).
- Dragging a keyframe updates its timestamp; dragging a range bar moves both ends (duration preserved) and dragging its edges resizes one side. Drags snap to whole seconds; hold Shift to bypass. Keyboard: arrow keys nudge the selected keyframe or the playhead (1s, or 5s with Shift); the playhead is exposed as an ARIA slider.
- New `InspectorPanel` export: the structured editor for the selected hook (title input, read-only type + time, delete). The editor renders it under the timeline strip.
- `PlacementInputs` (split out of `PlacementEditor` in the previous release) and the `clampPlacement` / `PLACEMENT_MIN_SIZE` helpers are now exported for hosts composing the placement surface standalone.
- New strings: the timeline and inspector accept their own `strings` overrides extending the core `Strings` base (`KeyframeTimelineStrings`, `InspectorPanelStrings`), with defaults derived from `DEFAULT_STRINGS`.
