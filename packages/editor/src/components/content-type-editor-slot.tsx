import React from "react";

export interface ContentTypeEditorSlotProps {
  contentTypeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
}

/**
 * ContentTypeEditorSlot - placeholder for content type-specific editing UI.
 * Renderer is provided by the content type itself via renderEditor().
 */
export const ContentTypeEditorSlot: React.FC<ContentTypeEditorSlotProps> = ({
  contentTypeId,
  isOpen,
  onClose,
  onSave,
}) => {
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
          <p style={{ color: "#999" }}>
            Content type editor for &quot;{contentTypeId}&quot; would be
            rendered here
          </p>
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
              onSave?.({});
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
};
