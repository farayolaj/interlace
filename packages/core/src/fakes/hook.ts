import { BlockingHook, Hook, NonBlockingHook } from "../hook/types";

export function fakeHook<Type extends Hook["type"]>(
  type: Type,
  overrides?: Partial<
    Omit<Type extends "blocking" ? BlockingHook : NonBlockingHook, "type">
  >,
): Hook {
  if (type === "blocking") {
    return {
      type,
      timestamp: 10,
      placement: { x: 10, y: 10, width: 20, height: 20 },
      ...overrides,
    };
  } else {
    return {
      type: "non-blocking",
      start: 10,
      end: 20,
      placement: { x: 10, y: 10, width: 20, height: 20 },
      revealBehavior: "immediate",
      ...overrides,
    } as NonBlockingHook;
  }
}
