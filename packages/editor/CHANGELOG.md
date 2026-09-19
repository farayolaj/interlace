# @interlace/editor

## 1.0.1

### Patch Changes

- Add per-package READMEs so every published npm page documents its install, its API surface, and where the full walkthrough lives.
- Updated dependencies
  - @interlacejs/core@0.1.1
  - @interlacejs/player@0.1.1
  - @interlacejs/quiz@0.1.1
  - @interlacejs/native-adapter@0.0.2

## 1.0.0

### Major Changes

- 6f737a6: Add `InterlaceEditor` and `VideoSourceInput` as the public authoring surface, and remove the `InteractiveMediaAuthoring` named export.
  - `InterlaceEditor` is the single drop-in component a host renders to author an interactive video document; it mirrors `InteractiveVideoPlayer` on the player side. It composes the authoring-time video source step (`VideoSourceInput`), the video preview with the player's `Anchor` + `BlockingOverlay` for a click-to-preview flow, `Timeline`, `PlacementEditor`, `ContentTypePicker`, and `ContentTypeEditorSlot`.
  - `VideoSourceInput` accepts a direct URL or a file; for files it calls the host-supplied `onUpload: (file) => Promise<url>` and awaits the resolved URL before writing it into the document. Loading and failure states are surfaced inline without crashing the authoring flow.
  - `@interlace/editor` now carries a runtime dependency on `@interlace/player` (added in this release; the editor reuses the player's `Anchor` and `BlockingOverlay` for the authoring preview rather than building a second renderer).
  - **Breaking:** the `InteractiveMediaAuthoring` named export and its props type are removed. Hosts that imported it must move to `InterlaceEditor`, whose props are not a drop-in replacement: `contentTypeRegistry` and `onUpload` are now required, `document` replaces `initialDocument`, `onSave` replaces `onSerializedChange`, and the new `adapterType` prop defaults to `"native"`.
  - The preview's "click an anchor" flow shows the content title only; it is not a full playback preview (the player's `BlockingOverlay` does not currently accept a children/render prop).
  - The preview renders `Anchor` for every item, including blocking hooks, so the authoring view differs visually from what learners see in playback (where anchors appear only for non-blocking items).
  - The `adapterType` prop is host-remembered, not persisted into the serialized document; the host must re-supply it on reload.
  - "Replace video" keeps the existing items; their timestamps may reference the old video's timeline (a re-encode case).
  - New exports: `InterlaceEditor`, `VideoSourceInput`, `EditorStrings`, `EditorTheme`, `VideoSourceInputStrings`, `VideoSourceValue`, `DEFAULT_EDITOR_STRINGS`, `DEFAULT_VIDEO_SOURCE_INPUT_STRINGS`, and the props types for each.

- aa5213e: Rework hook editing: the content editor now renders inline under the timeline, and new hooks start without a content type.
  - The `InterlaceEditor` no longer opens the content-instance editor in a modal. Selecting a hook shows a Hook section under the timeline containing Hook details (title, hook type, editable time/timespan inputs, the manual placement inputs, and content type selection) followed by the inline content editor.
  - **Behavior change:** adding a hook creates it _without_ a content type. The content editor stays hidden until a type is chosen in Hook details, which then creates the hook in the document. Hooks that have not been given a content type are editor-local only — `Save` does not serialize them.
  - The content-type picker section is removed from its previous position above the timeline; the picker now lives in Hook details for hooks without a content type. Hooks that already have one show their content type as read-only (switching an existing hook's type would discard its authored data).
  - **Breaking:** `InspectorPanel`'s props changed (it is now the Hook details panel: `entry` carries the resolved times, video duration, content type id, and registered types; new `onTimeChange` / `onContentTypeSelect` / `placement` props). New `ContentTypeEditor` export: the chrome-free inline surface that mounts a content type's `renderEditor` lifecycle (hosts label and place it).
  - `ContentTypeEditorSlot` is deprecated but still exported for hosts composing their own modal UX; the mount lifecycle it shares with the inline editor was extracted so both behave identically.

- 976a675: Replace the list-style `Timeline` / `TimelineEntry` with a zoomable keyframe timeline and a hook inspector.
  - **Breaking:** the `Timeline` and `TimelineEntry` named exports (and their props types) are removed. The new `KeyframeTimeline` component renders hooks the way a video editor does: blocking hooks as point keyframes, non-blocking hooks as draggable range bars, a scrubbable playhead, and zoom controls.
  - **Breaking:** the `onAddEntry` contract no longer creates hooks at time zero. New hooks land at the current playhead — the playhead is the keyframe insertion point.
  - Clicking a keyframe seeks the authoring video to the hook's anchor time and opens the content editor (the pre-existing select-to-edit contract, now driven from the strip).
  - Dragging a keyframe updates its timestamp; dragging a range bar moves both ends (duration preserved) and dragging its edges resizes one side. Drags snap to whole seconds; hold Shift to bypass. Keyboard: arrow keys nudge the selected keyframe or the playhead (1s, or 5s with Shift); the playhead is exposed as an ARIA slider.
  - New `InspectorPanel` export: the structured editor for the selected hook (title input, read-only type + time, delete). The editor renders it under the timeline strip.
  - `PlacementInputs` (split out of `PlacementEditor` in the previous release) and the `clampPlacement` / `PLACEMENT_MIN_SIZE` helpers are now exported for hosts composing the placement surface standalone.
  - New strings: the timeline and inspector accept their own `strings` overrides extending the core `Strings` base (`KeyframeTimelineStrings`, `InspectorPanelStrings`), with defaults derived from `DEFAULT_STRINGS`.

- e6fcb74: Rework `PlacementEditor` as a video-frame overlay and remove its intrinsic-dimension props.
  - `PlacementEditor` no longer renders its own gray placeholder box. It is now a transparent overlay that must be stacked (via a `position: relative` container) directly on top of a `<video>` element; the placement rectangle and resize handles map their percentages against the overlay's own rendered box.
  - **Breaking:** the `videoWidth` and `videoHeight` props are removed. Hosts that rendered `PlacementEditor` standalone must now wrap it in a positioned container with a real video underneath. Coordinate math no longer depends on the video's intrinsic pixel dimensions, which also fixes NaN placements when a hook is selected before the video's metadata has loaded.
  - **Breaking:** the X/Y/W/H numerical input panel has been split out of `PlacementEditor` into a new `PlacementInputs` component. Hosts that want the inputs should render `<PlacementInputs>` in their own toolbar area (the editor's `InterlaceEditor` renders it in a row below the video toolbar). Keeping the inputs out of the overlay frame stops them from occluding the video's native playback controls.
  - Placement changes are now clamped against the frame on every path (drag, 8 resize handles, and the X/Y/W/H numerical inputs via `PlacementInputs`), with distinct move and resize policies and a 1% minimum size so a hook can no longer be resized into invisibility.
  - The 8 resize handles (4 corners, 4 edges) are announced to assistive tech via `aria-label`; the rectangle is focusable and supports arrow-key nudging (1%, 5% with Shift).

- 809667c: The quiz content type now uses ONE canonical data format: `QuizData = { questions: QuizQuestionSpec[] }`, where each spec carries an `id`, `text`, optional `media`, `options` (option objects with ids), and `correctOptionId`. The legacy flat format (`question`/`options`/`correctIndex`) and all old→new transformation plumbing (`normalizeQuizData`, `RawQuizData`) were removed — every authored document is canonical multi-question. Scoring is one point per correctly answered question: `getMaximumScore(data)` is the question count and playback reports `onComplete(correctCount)` once on the final question. Authoring gains a question list with add/remove and per-question editing; playback shows one question at a time with a "Question i of n" indicator, per-question reveal/lock, and explicit Previous/Next navigation. Version stays 1.

### Minor Changes

- c2405af: Make interactive playback feel finished: completed blocking content now shows a completion feedback surface with a Continue button that resumes playback (playback no longer resumes automatically), blocking content can no longer be dismissed (it plays until interacted with and completed), non-blocking content opened in the overlay has a Skip control and reflects whether it can be taken again, the quiz player advances through multiple questions with explicit Previous / Next buttons (the final question's Next submits the aggregate score) instead of auto-advancing, and answered options get a clear correct/incorrect reveal, and the edit timeline now opens zoomed to the full video duration with no vertical scrolling and plain-wheel zoom control (scroll up zooms in, scroll down zooms out).
- af4641d: Allow re-typing hooks, stack overlapping keyframes into lanes, and deselect from the timeline background.
  - Hook details now offers the content type picker for hooks that already have a type: choosing a different type rebuilds the hook with that type's default content (data shapes differ per type) while preserving its time, placement, and title. Selecting the current type is a no-op.
  - Overlapping keyframes and range bars stack into vertical lanes on the timeline (greedy interval packing sorted by anchor time); the track grows to fit the lanes, and blocking diamonds occupy their rendered width so two keyframes stack exactly when their shapes would overlap.
  - Clicking empty timeline track — not a keyframe, range, or the ruler — deselects the selected hook via the new optional `onDeselect` prop on `KeyframeTimeline`.

### Patch Changes

- Updated dependencies [c2405af]
- Updated dependencies [809667c]
- Updated dependencies [bfccabf]
  - @interlace/core@0.1.0
  - @interlace/player@0.1.0
  - @interlace/quiz@0.1.0
  - @interlace/native-adapter@0.0.1
