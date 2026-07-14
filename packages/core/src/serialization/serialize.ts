import { ContentInstance } from "../content/content-instance";
import { isBlockingHook, isNonBlockingHook } from "../hook/types";
import {
  SerializedInteractiveMediaDocument,
  SerializedInteractiveMediaItem,
} from "./schema";

/**
 * Serializes InteractiveMediaItems into a document.
 */
export function serialize(
  items: ContentInstance[],
  videoSrc: string,
  videoDuration: number,
): SerializedInteractiveMediaDocument {
  const serializedItems: SerializedInteractiveMediaItem[] = items.map(
    (item) => ({
      id: item.getId(),
      title: item.getTitle(),
      hook: (() => {
        const hook = item.getHook();
        if (isBlockingHook(hook)) {
          return {
            type: "blocking" as const,
            timestamp: hook.timestamp,
            placement: hook.placement,
          };
        } else if (isNonBlockingHook(hook)) {
          return {
            type: "non-blocking" as const,
            start: hook.start,
            end: hook.end,
            placement: hook.placement,
            revealBehavior: hook.revealBehavior,
          };
        }
        throw new Error("Unknown hook type");
      })(),
      content: {
        contentTypeId: item.getContentTypeId(),
        version: item.getContentTypeVersion(),
        data: item.getState(),
      },
    }),
  );

  return {
    video: {
      src: videoSrc,
      duration: videoDuration,
    },
    items: serializedItems,
  };
}
