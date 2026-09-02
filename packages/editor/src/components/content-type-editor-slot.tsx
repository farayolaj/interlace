import React, { useEffect, useRef } from "react";
import { ContentType, ContentTypeRegistry } from "@interlace/core";

export interface ContentTypeEditorSlotProps<TData = unknown> {
  contentTypeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: TData) => void;
  registry: ContentTypeRegistry;
  data: TData;
  onChange: (newData: TData) => void;
}

interface MountedSession<TData> {
  container: HTMLDivElement;
  contentType: ContentType<TData>;
}

/**
 * ContentTypeEditorSlot - modal that mounts the content type's own editing
 * interface via `renderEditor` / `updateEditor` / `unmount`.
 *
 * The content type renders into the body container div. On data changes it
 * prefers `updateEditor` (cheap) and falls back to unmount + re-render.
 *
 * A single `mountedSessionRef` captures the live `{ container, contentType }`
 * whenever an effect mounts a session. Every teardown path (close, type
 * switch, component unmount) consumes it, so the contract's
 * `unmount?.(container)` is always called for the session that was mounted —
 * even when the live `contentType` prop is already undefined by the time the
 * teardown effect runs (e.g. close with a nulled `contentTypeId`).
 */
export function ContentTypeEditorSlot<TData = unknown>({
  contentTypeId,
  isOpen,
  onClose,
  onSave,
  registry,
  data,
  onChange,
}: ContentTypeEditorSlotProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedSessionRef = useRef<MountedSession<TData> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const contentType = contentTypeId
    ? (registry.get(contentTypeId) as ContentType<TData> | undefined)
    : undefined;

  useEffect(() => {
    const session = mountedSessionRef.current;

    // Session ended: the modal closed, or the content type is no longer
    // available (nulled id / unregistered). Tear down using the captured
    // contentType, not the live prop (which may already be undefined).
    if (session && (!isOpen || !contentType)) {
      session.contentType.unmount?.(session.container);
      mountedSessionRef.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (!isOpen || !contentType) return;

    // Type switch: tear down the previous session before mounting the new one.
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
  }, [isOpen, contentTypeId, contentType, data]);

  // Tear down on component unmount (not just close).
  useEffect(() => {
    return () => {
      const session = mountedSessionRef.current;
      if (session) {
        session.contentType.unmount?.(session.container);
        mountedSessionRef.current = null;
      }
    };
  }, []);

  if (!isOpen || !contentTypeId) {
    return null;
  }

  return (
    <div
      className="content-type-editor-slot"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
    >
      <div
        className="content-type-editor-container"
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h2 className="content-type-editor-title" style={{ marginTop: 0 }}>
          Edit {contentTypeId}
        </h2>

        <div
          className="content-type-editor-body"
          style={{ margin: "16px 0", minHeight: "100px" }}
        >
          {contentType ? (
            <div ref={containerRef} />
          ) : (
            <p style={{ color: "#999" }}>
              Content type &quot;{contentTypeId}&quot; is not registered
            </p>
          )}
        </div>

        <div
          className="content-type-editor-footer"
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            marginTop: "24px",
          }}
        >
          <button
            className="content-type-editor-cancel-button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancel
          </button>
          <button
            className="content-type-editor-save-button"
            onClick={() => {
              onSave?.(data);
              onClose();
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}