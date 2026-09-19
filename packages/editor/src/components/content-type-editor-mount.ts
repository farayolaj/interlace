import type React from "react";
import { useEffect, useRef } from "react";
import { ContentType, ContentTypeRegistry } from "@interlacejs/core";

interface MountedSession<TData> {
  container: HTMLDivElement;
  contentType: ContentType<TData>;
}

export interface UseContentTypeEditorMountOptions<TData = unknown> {
  /** The div the content type renders into. Owned by the calling component. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the editing session is active (slot: `isOpen`; inline editor: has a content type). */
  active: boolean;
  contentTypeId: string | null;
  registry: ContentTypeRegistry;
  data: TData;
  onChange: (newData: TData) => void;
}

/**
 * Shared mount lifecycle for content-type editors (the modal
 * `ContentTypeEditorSlot` and the inline `ContentTypeEditor` both use
 * it).
 *
 * The content type renders into `containerRef` via
 * `renderEditor` / `updateEditor` / `unmount`. On data changes it
 * prefers `updateEditor` (cheap) and falls back to unmount + re-render.
 *
 * A single `mountedSessionRef` captures the live `{ container,
 * contentType }` whenever an effect mounts a session. Every teardown
 * path (deactivation, type switch, component unmount) consumes it, so
 * the contract's `unmount?.(container)` is always called for the
 * session that was mounted — even when the live `contentType` is
 * already undefined by the time the teardown effect runs (e.g. a
 * nulled `contentTypeId`).
 */
export function useContentTypeEditorMount<TData = unknown>({
  containerRef,
  active,
  contentTypeId,
  registry,
  data,
  onChange,
}: UseContentTypeEditorMountOptions<TData>): void {
  const mountedSessionRef = useRef<MountedSession<TData> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const contentType = contentTypeId
    ? (registry.get(contentTypeId) as ContentType<TData> | undefined)
    : undefined;

  useEffect(() => {
    const session = mountedSessionRef.current;

    // Session ended: deactivated, or the content type is no longer
    // available (nulled id / unregistered). Tear down using the
    // captured contentType, not the live prop (which may already be
    // undefined).
    if (session && (!active || !contentType)) {
      session.contentType.unmount?.(session.container);
      mountedSessionRef.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (!active || !contentType) return;

    // Type switch: tear down the previous session before mounting the
    // new one.
    if (session && session.contentType !== contentType) {
      session.contentType.unmount?.(session.container);
      mountedSessionRef.current = null;
    }

    const currentSession = mountedSessionRef.current;
    const isNewSession =
      !currentSession || currentSession.contentType !== contentType;
    if (isNewSession) {
      container.innerHTML = "";
      contentType.renderEditor(container, data, onChangeRef.current);
      mountedSessionRef.current = { container, contentType };
    } else if (contentType.updateEditor) {
      contentType.updateEditor(container, data, onChangeRef.current);
    } else {
      contentType.unmount?.(container);
      container.innerHTML = "";
      contentType.renderEditor(container, data, onChangeRef.current);
      mountedSessionRef.current = { container, contentType };
    }
  }, [active, contentTypeId, contentType, data, containerRef]);

  // Tear down on component unmount (not just deactivation).
  useEffect(() => {
    return () => {
      const session = mountedSessionRef.current;
      if (session) {
        session.contentType.unmount?.(session.container);
        mountedSessionRef.current = null;
      }
    };
  }, []);
}
