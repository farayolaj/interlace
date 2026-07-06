// Events
export { EventEmitter } from "./events/event-emitter";
export type { EventListener } from "./events/event-emitter";

// Strings
export { DEFAULT_STRINGS } from "./strings/default-strings";
export type { Strings } from "./strings/default-strings";

// Error codes
export { ContentErrorReasonCode, ErrorReasonCode } from "./errors/reason-codes";

// Hooks
export { isBlockingHook, isNonBlockingHook } from "./hook/types";
export type {
  BlockingHook,
  Hook,
  NonBlockingHook,
  Placement,
} from "./hook/types";
export { validateHookOverlaps } from "./hook/validation";
export type {
  HookOverlapViolation,
  HookValidationOptions,
} from "./hook/validation";

// Content types
export { ContentTypeRegistry } from "./content-type/types";
export type {
  ContentType,
  ContentTypePreloadDescriptor,
} from "./content-type/types";

// Content
export { ContentInstance } from "./content/content-instance";
export type { ContentInstanceEvents } from "./content/content-instance";
export type { ContentRecord, ContentState } from "./content/types";

// Video adapter
export { ProgrammaticActionGuard } from "./video-adapter/types";
export type {
  VideoAdapter,
  VideoAdapterEvent,
  VideoAdapterEventType,
} from "./video-adapter/types";

// Interactive media controller
export { computeAggregatedResult } from "./interactive-media/aggregation";
export type { AggregatedResult } from "./interactive-media/aggregation";
export { InteractiveMediaController } from "./interactive-media/controller";
export type {
  InteractiveMediaControllerEvents,
  InteractiveMediaItem,
  RenderState,
} from "./interactive-media/controller";

// Serialization
export { deserialize } from "./serialization/deserialize";
export type {
  SerializedContent,
  SerializedHook,
  SerializedInteractiveMediaDocument,
  SerializedInteractiveMediaItem,
} from "./serialization/schema";
export { serialize } from "./serialization/serialize";
export { validateDocument } from "./serialization/validate";
export type { ValidationError } from "./serialization/validate";
