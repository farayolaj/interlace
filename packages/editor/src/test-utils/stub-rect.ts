import type { MockInstance } from "vitest";

/**
 * Stub `getBoundingClientRect` for a single element.
 *
 * jsdom returns an all-zeros rect for every element, which makes any
 * %↔pixel math (placement drag, timeline zoom/scrub) untestable. This
 * helper assigns an own-property override on the element and returns a
 * restore function.
 *
 * Shared infrastructure for Phase 3 (placement drag) and Phase 4
 * (keyframe timeline drag/zoom/scrub) tests.
 */
export function stubRect(
  el: Element,
  rect: { x?: number; y?: number; width: number; height: number },
): () => void {
  const { x = 0, y = 0, width, height } = rect;
  el.getBoundingClientRect = () => ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  });
  return () => {
    delete (el as unknown as { getBoundingClientRect?: unknown })
      .getBoundingClientRect;
  };
}

export type { MockInstance };
