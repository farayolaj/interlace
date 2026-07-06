import { isBlockingHook, isNonBlockingHook } from "../hook/types";
import { InteractiveMediaItem } from "../interactive-media/controller";
import {
  SerializedInteractiveMediaDocument,
  SerializedInteractiveMediaItem,
} from "./schema";

/**
 * Serializes InteractiveMediaItems into a document.
 */
export function serialize(
  items: InteractiveMediaItem[],
  videoSrc: string,
  videoDuration: number,
  adapterType?: string,
): SerializedInteractiveMediaDocument {
  const serializedItems: SerializedInteractiveMediaItem[] = items.map(
    (item) => ({
      id: item.content.getId(),
      title: item.content.getTitle(),
      hook: (() => {
        if (isBlockingHook(item.hook)) {
          return {
            type: "blocking" as const,
            timestamp: item.hook.timestamp,
            placement: item.hook.placement,
          };
        } else if (isNonBlockingHook(item.hook)) {
          return {
            type: "non-blocking" as const,
            start: item.hook.start,
            end: item.hook.end,
            placement: item.hook.placement,
            revealBehavior: item.hook.revealBehavior,
          };
        }
        throw new Error("Unknown hook type");
      })(),
      content: {
        contentTypeId: item.content.getContentTypeId(),
        version: 1, // TODO: Track version from content type
        data: item.content.getData(),
      },
    }),
  );

  return {
    video: {
      src: videoSrc,
      adapterType,
      duration: videoDuration,
    },
    items: serializedItems,
  };
}
