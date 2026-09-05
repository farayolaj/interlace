// Top-level host component
export { InterlaceEditor } from "./components/interlace-editor";
export type { InterlaceEditorProps, EditorStrings, EditorTheme } from "./components/interlace-editor";
export { DEFAULT_EDITOR_STRINGS } from "./components/interlace-editor";

// Authoring-time video source step
export { VideoSourceInput } from "./components/video-source-input";
export type {
  VideoSourceInputProps,
  VideoSourceValue,
  VideoSourceInputStrings,
} from "./components/video-source-input";
export { DEFAULT_VIDEO_SOURCE_INPUT_STRINGS } from "./components/video-source-input";

// Authoring surface building blocks
export { ContentTypeEditorSlot } from "./components/content-type-editor-slot";
export type { ContentTypeEditorSlotProps } from "./components/content-type-editor-slot";
export { ContentTypePicker } from "./components/content-type-picker";
export type { ContentTypePickerProps } from "./components/content-type-picker";
export { PlacementEditor } from "./components/placement-editor";
export type { PlacementEditorProps } from "./components/placement-editor";
export { Timeline } from "./components/timeline";
export type { TimelineProps } from "./components/timeline";
export { TimelineEntry } from "./components/timeline-entry";
export type { TimelineEntryProps } from "./components/timeline-entry";

// Built-in quiz content type (default for new content)
export { QuizEditor } from "./content-types/quiz-editor";
export type { QuizData } from "./content-types/quiz-editor";

// Authoring store
export { useAuthoringStore } from "./hooks/use-authoring-store";
export type {
  AuthoringStore,
  AuthoringStoreState,
  InteractiveMediaItem,
  LoadDocumentResult,
} from "./hooks/use-authoring-store";
