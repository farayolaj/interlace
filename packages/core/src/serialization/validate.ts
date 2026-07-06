import { validateHookOverlaps } from "../hook/validation";
import {
  SerializedHook,
  SerializedInteractiveMediaDocument,
  SerializedInteractiveMediaItem,
} from "./schema";

export interface ValidationError {
  type: string;
  message: string;
}

/**
 * Validates the structure of a serialized document before instantiation.
 */
export function validateDocument(
  doc: SerializedInteractiveMediaDocument,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check video source
  if (!doc.video || !doc.video.src) {
    errors.push({
      type: "MISSING_VIDEO_SOURCE",
      message: "Document must have a video.src",
    });
  }

  // Check items array
  if (!Array.isArray(doc.items)) {
    errors.push({
      type: "MISSING_ITEMS_ARRAY",
      message: "Document must have an items array",
    });
    return errors; // Can't continue validation without items
  }

  // Track IDs for duplicate detection
  const seenIds = new Set<string>();
  const items = doc.items as SerializedInteractiveMediaItem[];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;

    // Check required fields
    if (!item.id) {
      errors.push({
        type: "MISSING_ITEM_ID",
        message: `Item at index ${i} is missing an id`,
      });
    } else if (seenIds.has(item.id)) {
      errors.push({
        type: "DUPLICATE_ITEM_ID",
        message: `Item id "${item.id}" is duplicated`,
      });
    } else {
      seenIds.add(item.id);
    }

    if (!item.title) {
      errors.push({
        type: "MISSING_ITEM_TITLE",
        message: `Item at index ${i} is missing a title`,
      });
    }

    // Validate hook structure
    if (!item.hook) {
      errors.push({
        type: "MISSING_HOOK",
        message: `Item at index ${i} is missing a hook`,
      });
    } else {
      const hookError = validateHookStructure(item.hook, i);
      errors.push(...hookError);
    }

    // Validate content structure
    if (!item.content) {
      errors.push({
        type: "MISSING_CONTENT",
        message: `Item at index ${i} is missing content`,
      });
    } else {
      if (!item.content.contentTypeId) {
        errors.push({
          type: "MISSING_CONTENT_TYPE_ID",
          message: `Item at index ${i} is missing content.contentTypeId`,
        });
      }
      if (item.content.version === undefined || item.content.version === null) {
        errors.push({
          type: "MISSING_CONTENT_VERSION",
          message: `Item at index ${i} is missing content.version`,
        });
      }
    }
  }

  // Validate hook overlaps
  if (errors.length === 0) {
    // Only check overlaps if structural validation passed
    const hooks: any[] = [];
    for (const item of doc.items) {
      const hook = serializeHookToHook(item.hook);
      if (hook !== null) {
        hooks.push(hook);
      }
    }

    const violations = validateHookOverlaps(hooks);
    if (violations.length > 0) {
      errors.push({
        type: "HOOK_OVERLAP_VIOLATION",
        message: violations.map((v) => v.description).join("; "),
      });
    }
  }

  return errors;
}

/**
 * Validates the structure of a single hook.
 */
function validateHookStructure(
  hook: SerializedHook,
  itemIndex: number,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!hook.type) {
    errors.push({
      type: "MISSING_HOOK_TYPE",
      message: `Item at index ${itemIndex} has hook without type`,
    });
    return errors;
  }

  if (!hook.placement) {
    errors.push({
      type: "MISSING_HOOK_PLACEMENT",
      message: `Item at index ${itemIndex} has hook without placement`,
    });
  } else {
    if (hook.placement.x === undefined || hook.placement.y === undefined) {
      errors.push({
        type: "INVALID_HOOK_PLACEMENT",
        message: `Item at index ${itemIndex} has invalid hook placement (missing x or y)`,
      });
    }
    if (
      hook.placement.width === undefined ||
      hook.placement.height === undefined
    ) {
      errors.push({
        type: "INVALID_HOOK_PLACEMENT",
        message: `Item at index ${itemIndex} has invalid hook placement (missing width or height)`,
      });
    }
  }

  if (hook.type === "blocking") {
    if (hook.timestamp === undefined || hook.timestamp === null) {
      errors.push({
        type: "MISSING_BLOCKING_TIMESTAMP",
        message: `Item at index ${itemIndex} has blocking hook without timestamp`,
      });
    }
  } else if (hook.type === "non-blocking") {
    if (hook.start === undefined || hook.start === null) {
      errors.push({
        type: "MISSING_NONBLOCKING_START",
        message: `Item at index ${itemIndex} has non-blocking hook without start`,
      });
    }
    if (hook.end === undefined || hook.end === null) {
      errors.push({
        type: "MISSING_NONBLOCKING_END",
        message: `Item at index ${itemIndex} has non-blocking hook without end`,
      });
    }
    if (
      hook.revealBehavior &&
      !["immediate", "click"].includes(hook.revealBehavior)
    ) {
      errors.push({
        type: "INVALID_REVEAL_BEHAVIOR",
        message: `Item at index ${itemIndex} has invalid revealBehavior: ${hook.revealBehavior}`,
      });
    }
  }

  return errors;
}

/**
 * Helper to convert serialized hook to Hook type for validation.
 */
function serializeHookToHook(hook: SerializedHook): any {
  if (hook.type === "blocking") {
    return {
      type: "blocking",
      timestamp: hook.timestamp,
      placement: hook.placement,
    };
  } else {
    return {
      type: "non-blocking",
      start: hook.start,
      end: hook.end,
      placement: hook.placement,
      revealBehavior: hook.revealBehavior || "click",
    };
  }
}
