// Top-level host component
export {
  DEFAULT_EDITOR_STRINGS,
  InterlaceEditor,
} from "./components/interlace-editor";
export type {
  EditorStrings,
  EditorTheme,
  InterlaceEditorProps,
} from "./components/interlace-editor";

// Authoring-time video source step
export {
  DEFAULT_VIDEO_SOURCE_INPUT_STRINGS,
  VideoSourceInput,
} from "./components/video-source-input";
export type {
  VideoSourceInputProps,
  VideoSourceInputStrings,
  VideoSourceValue,
} from "./components/video-source-input";

// Authoring surface building blocks
export { ContentTypeEditor } from "./components/content-type-editor";
export type { ContentTypeEditorProps } from "./components/content-type-editor";
export { ContentTypeEditorSlot } from "./components/content-type-editor-slot";
export type { ContentTypeEditorSlotProps } from "./components/content-type-editor-slot";
export { ContentTypePicker } from "./components/content-type-picker";
export type { ContentTypePickerProps } from "./components/content-type-picker";
export {
  clampPlacement,
  PLACEMENT_MIN_SIZE,
  PlacementEditor,
  PlacementInputs,
} from "./components/placement-editor";
export type {
  PlacementEditorProps,
  PlacementInputsProps,
} from "./components/placement-editor";

// Keyframe timeline + inspector
export {
  DEFAULT_INSPECTOR_PANEL_STRINGS,
  InspectorPanel,
} from "./components/inspector-panel";
export type {
  InspectorPanelEntry,
  InspectorPanelProps,
  InspectorPanelStrings,
} from "./components/inspector-panel";
export {
  DEFAULT_KEYFRAME_TIMELINE_STRINGS,
  KeyframeTimeline,
} from "./components/keyframe-timeline";
export type {
  KeyframeTimelineEntry,
  KeyframeTimelineProps,
  KeyframeTimelineStrings,
} from "./components/keyframe-timeline";

// Authoring store
export { useAuthoringStore } from "./hooks/use-authoring-store";
export type {
  AuthoringStore,
  AuthoringStoreState,
  InteractiveMediaItem,
  LoadDocumentResult,
} from "./hooks/use-authoring-store";
