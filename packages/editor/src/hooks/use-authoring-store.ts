import { ContentInstance, Hook } from "@interlace/core";
import { useCallback, useState } from "react";

/**
 * A single interactive media entry being authored: its content instance
 * plus the hook describing when/where it appears.
 */
export interface InteractiveMediaItem {
  content: ContentInstance;
  hook: Hook;
}

/**
 * Serializes authored items into the document schema, reading hook data from
 * the item pair and content data from the content instance.
 */
function serializeItems(items: InteractiveMediaItem[]) {
  return items.map((item) => ({
    id: item.content.getId(),
    title: item.content.getTitle(),
    hook: item.hook,
    content: {
      contentTypeId: item.content.getContentTypeId(),
      version: item.content.getContentTypeVersion(),
      data: item.content.getData(),
    },
  }));
}

export interface AuthoringStoreState {
  items: InteractiveMediaItem[];
  videoSrc: string;
  videoDuration: number;
}

export interface AuthoringStore {
  state: AuthoringStoreState;
  addItem: (item: InteractiveMediaItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, item: InteractiveMediaItem) => void;
  serialize: (adapterType?: string) => any;
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
    (adapterType?: string) => {
      return {
        video: {
          src: state.videoSrc,
          duration: state.videoDuration,
          ...(adapterType !== undefined ? { adapterType } : {}),
        },
        items: serializeItems(state.items),
      };
    },
    [state],
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
    setVideoMetadata,
  };
}
