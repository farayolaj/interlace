/**
 * Schema types for serialization/deserialization.
 */

export interface SerializedContent {
  contentTypeId: string;
  version: number;
  data: any;
}

export interface SerializedHook {
  type: "blocking" | "non-blocking";
  timestamp?: number; // For blocking
  start?: number; // For non-blocking
  end?: number; // For non-blocking
  placement: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  revealBehavior?: "immediate" | "click"; // For non-blocking
}

export interface SerializedInteractiveMediaItem {
  id: string;
  title: string;
  hook: SerializedHook;
  content: SerializedContent;
}

export interface SerializedInteractiveMediaDocument {
  video: {
    src: string;
    adapterType?: string;
    duration?: number;
  };
  items: SerializedInteractiveMediaItem[];
}
