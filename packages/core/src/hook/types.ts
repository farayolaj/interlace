/**
 * Hook types defining when and where interactive content appears.
 */

export interface Placement {
  /** Percentage from left (0-100) */
  x: number;
  /** Percentage from top (0-100) */
  y: number;
  /** Width as percentage of video (0-100) */
  width: number;
  /** Height as percentage of video (0-100) */
  height: number;
}

export interface BlockingHook {
  type: "blocking";
  /** Timestamp in seconds when content should trigger */
  timestamp: number;
  /** Where to place the content on the video surface */
  placement: Placement;
}

export interface NonBlockingHook {
  type: "non-blocking";
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Where to place the anchor on the video surface */
  placement: Placement;
  /** Whether content shows immediately or an anchor is shown first */
  revealBehavior: "immediate" | "click";
}

export type Hook = BlockingHook | NonBlockingHook;

export function isBlockingHook(hook: Hook): hook is BlockingHook {
  return hook.type === "blocking";
}

export function isNonBlockingHook(hook: Hook): hook is NonBlockingHook {
  return hook.type === "non-blocking";
}
