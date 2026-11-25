import { type RefObject, useEffect, useRef } from "react";

/**
 * Host-supplied media loader. Attaches `src` to `video` (for example
 * through hls.js) instead of the editor setting the element's `src`
 * attribute, and may return a cleanup that detaches it. The editor calls
 * the cleanup before attaching a new source or element, and on unmount.
 */
export type MediaAttacher = (
  video: HTMLVideoElement,
  src: string,
) => void | (() => void);

/**
 * Keeps `attachMedia(video, src)` applied to the element in `videoRef`.
 * The effect runs after every commit and only re-attaches when the
 * element (e.g. a keyed remount) or the source changes, so it follows
 * remounts without the caller listing them as dependencies. The latest
 * `attachMedia` is read from a ref: a host-inlined loader does not
 * re-attach (and drop its player instance) on every render.
 */
export function useAttachMedia(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
  attachMedia: MediaAttacher | undefined,
  onError?: (error: Error) => void,
): void {
  const attachRef = useRef(attachMedia);
  attachRef.current = attachMedia;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const attachedRef = useRef<{
    video: HTMLVideoElement;
    src: string;
    cleanup?: () => void;
  } | null>(null);

  useEffect(() => {
    const video = attachRef.current && src ? videoRef.current : null;
    const current = attachedRef.current;
    if (current?.video === video && current.src === src) return;
    detach(attachedRef);
    if (!video || !attachRef.current) return;
    try {
      const cleanup = attachRef.current(video, src);
      attachedRef.current = {
        video,
        src,
        cleanup: typeof cleanup === "function" ? cleanup : undefined,
      };
    } catch (err) {
      // Remember the failed pair so the next commit does not retry it.
      attachedRef.current = { video, src };
      onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  useEffect(() => () => detach(attachedRef), []);
}

function detach(attachedRef: RefObject<{ cleanup?: () => void } | null>): void {
  const attached = attachedRef.current;
  attachedRef.current = null;
  try {
    attached?.cleanup?.();
  } catch {
    // A failed detach must not block attaching the next source.
  }
}
