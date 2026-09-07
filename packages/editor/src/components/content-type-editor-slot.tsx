import React, { useRef } from "react";
import { ContentTypeRegistry } from "@interlace/core";
import { useContentTypeEditorMount } from "./content-type-editor-mount";

export interface ContentTypeEditorSlotProps<TData = unknown> {
  contentTypeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: TData) => void;
  registry: ContentTypeRegistry;
  data: TData;
  onChange: (newData: TData) => void;
}

/**
 * ContentTypeEditorSlot - modal that mounts the content type's own
 * editing interface via `renderEditor` / `updateEditor` / `unmount`.
 *
 * @deprecated The editor's own composition no longer opens this modal —
 * the content editor renders inline under the timeline
 * (`ContentTypeEditor`). Retained for hosts composing their own modal
 * UX. Will be reconsidered at the next major.
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

  useContentTypeEditorMount<TData>({
    containerRef,
    active: isOpen,
    contentTypeId,
    registry,
    data,
    onChange,
  });

  const contentType = contentTypeId ? registry.get(contentTypeId) : undefined;

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
