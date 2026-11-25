import type { VideoAdapter } from "@interlacejs/core";
import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Host-supplied adapter factory. Creates a `VideoAdapter` for `video` that
 * loads `src` itself (for example `HlsVideoAdapter` from
 * `@interlacejs/hls-adapter`). The editor destroys it before creating a new
 * one for another source or element, and on unmount.
 */
export type VideoAdapterFactory = (
  video: HTMLVideoElement,
  src: string,
) => DestroyableVideoAdapter;

/** A `VideoAdapter` the editor can tear down. */
export type DestroyableVideoAdapter = VideoAdapter & { destroy(): void };

/**
 * Keeps an adapter from `createAdapter(video, src)` on the element in
 * `videoRef`, re-creating it only when the element or the source changes
 * (like `useAttachMedia`). Returns the current adapter, or `null` when no
 * factory is given or creation failed.
 *
 * Adapters may wrap the `<video>` in their own element (the native adapter
 * does), so the element must not be a direct keyed child React removes on
 * its own: put the key on a container instead.
 */
export function useVideoAdapter(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
  createAdapter: VideoAdapterFactory | undefined,
  onError?: (error: Error) => void,
): DestroyableVideoAdapter | null {
  const createRef = useRef(createAdapter);
  createRef.current = createAdapter;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const currentRef = useRef<{
    video: HTMLVideoElement;
    src: string;
    adapter: DestroyableVideoAdapter | null;
  } | null>(null);
  const [adapter, setAdapter] = useState<DestroyableVideoAdapter | null>(null);

  useEffect(() => {
    const video = createRef.current && src ? videoRef.current : null;
    const current = currentRef.current;
    if (current?.video === video && current.src === src) return;
    destroy(currentRef);
    if (!video || !createRef.current) {
      if (current) setAdapter(null);
      return;
    }
    let next: DestroyableVideoAdapter | null = null;
    try {
      next = createRef.current(video, src);
    } catch (err) {
      onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
    }
    // A failed pair is remembered too, so the next commit does not retry it.
    currentRef.current = { video, src, adapter: next };
    setAdapter(next);
  });

  useEffect(() => () => destroy(currentRef), []);

  return adapter;
}

function destroy(
  currentRef: RefObject<{ adapter: DestroyableVideoAdapter | null } | null>,
): void {
  const current = currentRef.current;
  currentRef.current = null;
  try {
    current?.adapter?.destroy();
  } catch {
    // A failed teardown must not block creating the next adapter.
  }
}
