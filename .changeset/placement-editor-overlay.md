---
"@interlace/editor": major
---

Rework `PlacementEditor` as a video-frame overlay and remove its intrinsic-dimension props.

- `PlacementEditor` no longer renders its own gray placeholder box. It is now a transparent overlay that must be stacked (via a `position: relative` container) directly on top of a `<video>` element; the placement rectangle and resize handles map their percentages against the overlay's own rendered box.
- **Breaking:** the `videoWidth` and `videoHeight` props are removed. Hosts that rendered `PlacementEditor` standalone must now wrap it in a positioned container with a real video underneath. Coordinate math no longer depends on the video's intrinsic pixel dimensions, which also fixes NaN placements when a hook is selected before the video's metadata has loaded.
- Placement changes are now clamped against the frame on every path (drag, 8 resize handles, and the X/Y/W/H numerical inputs), with distinct move and resize policies and a 1% minimum size so a hook can no longer be resized into invisibility.
- The 8 resize handles (4 corners, 4 edges) are announced to assistive tech via `aria-label`; the rectangle is focusable and supports arrow-key nudging (1%, 5% with Shift).
