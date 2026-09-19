import type { SerializedInteractiveMediaDocument } from "@interlacejs/core";
import {
  ContentInstance,
  ContentTypeRegistry,
  Hook,
  serialize as coreSerialize,
  deserialize,
} from "@interlacejs/core";
import { useCallback, useState } from "react";

/**
 * A single interactive media entry being authored: its content instance
 * plus the hook describing when/where it appears.
 */
export interface InteractiveMediaItem {
  content: ContentInstance;
  hook: Hook;
}

export interface AuthoringStoreState {
  items: InteractiveMediaItem[];
  videoSrc: string;
  videoDuration: number;
}

export interface LoadDocumentResult {
  validationErrors: string[];
  warnings: string[];
}

export interface AuthoringStore {
  state: AuthoringStoreState;
  addItem: (item: InteractiveMediaItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, item: InteractiveMediaItem) => void;
  /**
   * Serializes the current items into a document via core's `serialize`.
   * The legacy `adapterType` argument is accepted (and ignored) so existing
   * callers do not break; the new core serializer does not produce it.
   */
  serialize: (adapterType?: unknown) => SerializedInteractiveMediaDocument;
  loadDocument: (
    doc: SerializedInteractiveMediaDocument,
    registry: ContentTypeRegistry,
  ) => LoadDocumentResult;
  setVideoMetadata: (src: string, duration: number) => void;
}

/**
 * Authoring store for managing interactive content creation.
 * Handles document state, serialization, and item management.
 */
export function useAuthoringStore(
  initialVideoSrc: string,
  initialDuration: number,
): AuthoringStore {
  const [state, setState] = useState<AuthoringStoreState>({
    items: [],
    videoSrc: initialVideoSrc,
    videoDuration: initialDuration,
  });

  const addItem = useCallback((item: InteractiveMediaItem) => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.content.getId() !== id),
    }));
  }, []);

  const updateItem = useCallback(
    (id: string, newItem: InteractiveMediaItem) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.content.getId() === id ? newItem : item,
        ),
      }));
    },
    [],
  );

  const doSerialize = useCallback(
    () =>
      coreSerialize(
        state.items.map((item) => item.content),
        state.videoSrc,
        state.videoDuration,
      ),
    [state],
  );

  const loadDocument = useCallback(
    (
      doc: SerializedInteractiveMediaDocument,
      registry: ContentTypeRegistry,
    ): LoadDocumentResult => {
      const { items, videoSrc, videoDuration, validationErrors, warnings } =
        deserialize(doc, registry);
      setState({
        items: items.map((content) => ({ content, hook: content.getHook() })),
        videoSrc,
        videoDuration,
      });
      return { validationErrors, warnings };
    },
    [],
  );

  const setVideoMetadata = useCallback((src: string, duration: number) => {
    setState((prev) => ({
      ...prev,
      videoSrc: src,
      videoDuration: duration,
    }));
  }, []);

  return {
    state,
    addItem,
    removeItem,
    updateItem,
    serialize: doSerialize,
    loadDocument,
    setVideoMetadata,
  };
}
