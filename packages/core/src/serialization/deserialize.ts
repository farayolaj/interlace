import { ContentTypeRegistry } from "../content-type/types";
import { ContentInstance } from "../content/content-instance";
import { ContentRecord } from "../content/types";
import { Hook } from "../hook/types";
import { InteractiveMediaItem } from "../interactive-media/controller";
import {
  SerializedContent,
  SerializedHook,
  SerializedInteractiveMediaDocument,
} from "./schema";
import { validateDocument } from "./validate";

export interface DeserializationOptions {
  onUnrecognizedContentType?: (id: string, data: SerializedContent) => void;
}

/**
 * Deserializes a document into InteractiveMediaItems.
 * Returns items and metadata including any errors or warnings.
 */
export function deserialize(
  doc: SerializedInteractiveMediaDocument,
  registry: ContentTypeRegistry,
  options: DeserializationOptions = {},
): {
  items: InteractiveMediaItem[];
  videoDuration: number;
  videoSrc: string;
  validationErrors: string[];
  warnings: string[];
} {
  // Step 1: Structural validation
  const validationErrors = validateDocument(doc);
  const errorMessages = validationErrors.map((e) => `${e.type}: ${e.message}`);

  if (errorMessages.length > 0) {
    return {
      items: [],
      videoDuration: doc.video?.duration ?? 0,
      videoSrc: doc.video?.src ?? "",
      validationErrors: errorMessages,
      warnings: [],
    };
  }

  // Step 2: Deserialize items
  const items: InteractiveMediaItem[] = [];
  const warnings: string[] = [];

  for (const serializedItem of doc.items) {
    const hook = deserializeHook(serializedItem.hook);
    if (!hook) {
      warnings.push(
        `Skipping item ${serializedItem.id}: invalid hook structure`,
      );
      continue;
    }

    const contentType = registry.get(serializedItem.content.contentTypeId);
    if (!contentType) {
      warnings.push(
        `Skipping item ${serializedItem.id}: unrecognized content type "${serializedItem.content.contentTypeId}"`,
      );
      options.onUnrecognizedContentType?.(
        serializedItem.id,
        serializedItem.content,
      );
      continue;
    }

    // Handle version migrations
    let data = serializedItem.content.data;
    if (serializedItem.content.version < contentType.version) {
      if (contentType.migrate) {
        try {
          data = contentType.migrate(data, serializedItem.content.version);
        } catch (err) {
          warnings.push(
            `Error migrating content ${serializedItem.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
      } else {
        warnings.push(
          `Skipping item ${serializedItem.id}: version mismatch (data v${serializedItem.content.version}, type v${contentType.version}) and no migration available`,
        );
        continue;
      }
    } else if (serializedItem.content.version > contentType.version) {
      warnings.push(
        `Content ${serializedItem.id} has newer version (${serializedItem.content.version}) than registered type (${contentType.version})`,
      );
    }

    const record: ContentRecord = {
      id: serializedItem.id,
      title: serializedItem.title,
      contentTypeId: serializedItem.content.contentTypeId,
      data,
      state: "pending",
      locked: false,
    };

    const instance = new ContentInstance(record, contentType);
    items.push({ hook, content: instance });
  }

  return {
    items,
    videoDuration: doc.video?.duration ?? 0,
    videoSrc: doc.video?.src ?? "",
    validationErrors: errorMessages,
    warnings,
  };
}

/**
 * Helper to deserialize a serialized hook back into a Hook type.
 */
function deserializeHook(serialized: SerializedHook): Hook | null {
  if (serialized.type === "blocking") {
    if (serialized.timestamp === undefined) return null;
    if (!serialized.placement) return null;

    return {
      type: "blocking",
      timestamp: serialized.timestamp,
      placement: serialized.placement,
    };
  } else if (serialized.type === "non-blocking") {
    if (serialized.start === undefined || serialized.end === undefined)
      return null;
    if (!serialized.placement) return null;

    return {
      type: "non-blocking",
      start: serialized.start,
      end: serialized.end,
      placement: serialized.placement,
      revealBehavior: serialized.revealBehavior ?? "click",
    };
  }

  return null;
}
