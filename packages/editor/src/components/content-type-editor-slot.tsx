import React, { useRef } from "react";
import { ContentTypeRegistry } from "@interlace/core";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";
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
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
    >
      <div
        className="content-type-editor-container"
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: `${RADIUS.lg}px`,
          padding: `${SPACE[5]}px`,
          maxWidth: "600px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: SHADOWS.md,
        }}
      >
        <h2
          className="content-type-editor-title"
          style={{
            marginTop: 0,
            fontFamily: FONTS.display,
            fontSize: TYPE.lg,
            fontWeight: 600,
          }}
        >
          Edit {contentTypeId}
        </h2>

        <div
          className="content-type-editor-body"
          style={{ margin: "16px 0", minHeight: "100px" }}
        >
          {contentType ? (
            <div ref={containerRef} />
          ) : (
            <p style={{ color: COLORS.textMuted }}>
              Content type &quot;{contentTypeId}&quot; is not registered
            </p>
          )}
        </div>

        <div
          className="content-type-editor-footer"
          style={{
            display: "flex",
            gap: `${SPACE[2]}px`,
            justifyContent: "flex-end",
            marginTop: `${SPACE[5]}px`,
          }}
        >
          <button
            className="content-type-editor-cancel-button"
            onClick={onClose}
            style={{
              padding: `${SPACE[2]}px ${SPACE[4]}px`,
              backgroundColor: COLORS.surfaceRaised,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: `${RADIUS.sm}px`,
              cursor: "pointer",
              fontSize: TYPE.md,
              color: COLORS.text,
              transition: "background-color 150ms ease",
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
              padding: `${SPACE[2]}px ${SPACE[4]}px`,
              backgroundColor: COLORS.accent,
              color: COLORS.white,
              border: "none",
              borderRadius: `${RADIUS.sm}px`,
              cursor: "pointer",
              fontSize: TYPE.md,
              fontWeight: 600,
              transition: "background-color 150ms ease",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
