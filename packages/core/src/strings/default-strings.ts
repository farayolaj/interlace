/**
 * Default English strings for UI labels and messages.
 */

export interface Strings {
  // Anchor labels
  anchorOpenLabel: string;
  anchorOpenedLabel: string;

  // Blocking overlay
  blockingOverlayLoadingLabel: string;

  // Completed tag
  completedTagLabel: string;

  // Content error fallback
  contentErrorLabel: string;
  contentErrorDescription: string;

  // Content type picker
  contentTypePickerLabel: string;
  contentTypePickerPlaceholder: string;

  // Timeline
  timelineLabel: string;

  // General
  closeLabel: string;
  submitLabel: string;
  cancelLabel: string;
}

export const DEFAULT_STRINGS: Strings = {
  // Anchor labels
  anchorOpenLabel: "Open",
  anchorOpenedLabel: "Completed",

  // Blocking overlay
  blockingOverlayLoadingLabel: "Loading...",

  // Completed tag
  completedTagLabel: "Completed",

  // Content error fallback
  contentErrorLabel: "Content Error",
  contentErrorDescription:
    "An error occurred while rendering this content. Please try again or contact support.",

  // Content type picker
  contentTypePickerLabel: "Select Content Type",
  contentTypePickerPlaceholder: "Choose a content type...",

  // Timeline
  timelineLabel: "Timeline",

  // General
  closeLabel: "Close",
  submitLabel: "Submit",
  cancelLabel: "Cancel",
};
