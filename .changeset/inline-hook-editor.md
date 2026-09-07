---
"@interlace/editor": major
---

Rework hook editing: the content editor now renders inline under the timeline, and new hooks start without a content type.

- The `InterlaceEditor` no longer opens the content-instance editor in a modal. Selecting a hook shows a Hook section under the timeline containing Hook details (title, hook type, editable time/timespan inputs, the manual placement inputs, and content type selection) followed by the inline content editor.
- **Behavior change:** adding a hook creates it *without* a content type. The content editor stays hidden until a type is chosen in Hook details, which then creates the hook in the document. Hooks that have not been given a content type are editor-local only — `Save` does not serialize them.
- The content-type picker section is removed from its previous position above the timeline; the picker now lives in Hook details for hooks without a content type. Hooks that already have one show their content type as read-only (switching an existing hook's type would discard its authored data).
- **Breaking:** `InspectorPanel`'s props changed (it is now the Hook details panel: `entry` carries the resolved times, video duration, content type id, and registered types; new `onTimeChange` / `onContentTypeSelect` / `placement` props). New `ContentTypeEditor` export: the chrome-free inline surface that mounts a content type's `renderEditor` lifecycle (hosts label and place it).
- `ContentTypeEditorSlot` is deprecated but still exported for hosts composing their own modal UX; the mount lifecycle it shares with the inline editor was extracted so both behave identically.
