import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";

/**
 * jsdom's PointerEvent does not inherit MouseEvent init, so
 * `fireEvent.pointerDown(el, { clientX })` produces events without
 * coordinates. Dispatch real MouseEvents typed as pointer events —
 * React's synthetic handlers and components' native listeners both
 * match by event type, and MouseEvent reliably carries clientX/Y.
 *
 * Shared vocabulary for Phase 3 (placement drag) and Phase 4
 * (timeline drag/scrub) tests.
 */
export function firePointer(
  el: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY: number,
) {
  return fireEvent(
    el,
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0,
    }),
  );
}

/**
 * jsdom does not implement pointer capture; stub it so a component's
 * capture request (the mechanism that keeps drags alive outside the
 * frame) can be asserted.
 *
 * Shared vocabulary for Phase 3 and Phase 4 drag tests.
 */
export function stubPointerCapture(el: HTMLElement) {
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  el.setPointerCapture = setPointerCapture;
  el.releasePointerCapture = releasePointerCapture;
  return { setPointerCapture, releasePointerCapture };
}
