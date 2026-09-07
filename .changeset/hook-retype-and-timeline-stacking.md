---
"@interlace/editor": minor
---

Allow re-typing hooks, stack overlapping keyframes into lanes, and deselect from the timeline background.

- Hook details now offers the content type picker for hooks that already have a type: choosing a different type rebuilds the hook with that type's default content (data shapes differ per type) while preserving its time, placement, and title. Selecting the current type is a no-op.
- Overlapping keyframes and range bars stack into vertical lanes on the timeline (greedy interval packing sorted by anchor time); the track grows to fit the lanes, and blocking diamonds occupy their rendered width so two keyframes stack exactly when their shapes would overlap.
- Clicking empty timeline track — not a keyframe, range, or the ruler — deselects the selected hook via the new optional `onDeselect` prop on `KeyframeTimeline`.
