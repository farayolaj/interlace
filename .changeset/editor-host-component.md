---
"@interlace/editor": major
---

Add `InterlaceEditor` and `VideoSourceInput` as the public authoring surface, and remove the `InteractiveMediaAuthoring` named export.

- `InterlaceEditor` is the single drop-in component a host renders to author an interactive video document; it mirrors `InteractiveVideoPlayer` on the player side. It composes the authoring-time video source step (`VideoSourceInput`), the video preview with the player's `Anchor` + `BlockingOverlay` for a click-to-preview flow, `Timeline`, `PlacementEditor`, `ContentTypePicker`, and `ContentTypeEditorSlot`.
- `VideoSourceInput` accepts a direct URL or a file; for files it calls the host-supplied `onUpload: (file) => Promise<url>` and awaits the resolved URL before writing it into the document. Loading and failure states are surfaced inline without crashing the authoring flow.
- `@interlace/editor` now carries a runtime dependency on `@interlace/player` (added in this release; the editor reuses the player's `Anchor` and `BlockingOverlay` for the authoring preview rather than building a second renderer).
- **Breaking:** the `InteractiveMediaAuthoring` named export and its props type are removed. Hosts that imported it must move to `InterlaceEditor`, whose props are not a drop-in replacement: `contentTypeRegistry` and `onUpload` are now required, `document` replaces `initialDocument`, `onSave` replaces `onSerializedChange`, and the new `adapterType` prop defaults to `"native"`.
- The preview's "click an anchor" flow shows the content title only; it is not a full playback preview (the player's `BlockingOverlay` does not currently accept a children/render prop).
- The preview renders `Anchor` for every item, including blocking hooks, so the authoring view differs visually from what learners see in playback (where anchors appear only for non-blocking items).
- The `adapterType` prop is host-remembered, not persisted into the serialized document; the host must re-supply it on reload.
- "Replace video" keeps the existing items; their timestamps may reference the old video's timeline (a re-encode case).
- New exports: `InterlaceEditor`, `VideoSourceInput`, `EditorStrings`, `EditorTheme`, `VideoSourceInputStrings`, `VideoSourceValue`, `DEFAULT_EDITOR_STRINGS`, `DEFAULT_VIDEO_SOURCE_INPUT_STRINGS`, and the props types for each.
