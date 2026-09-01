import React, { useState } from "react";

export interface ContentTypePickerProps {
  registeredTypes: string[];
  selectedType: string | null;
  onSelect: (typeId: string) => void;
}

/**
 * ContentTypePicker - dropdown for selecting content type when creating new content.
 */
export const ContentTypePicker: React.FC<ContentTypePickerProps> = ({
  registeredTypes,
  selectedType,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "8px 12px",
          backgroundColor: "#fff",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{selectedType || "Select content type..."}</span>
        <span>{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          {registeredTypes.map((typeId) => (
            <div
              key={typeId}
              onClick={() => {
                onSelect(typeId);
                setIsOpen(false);
              }}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: selectedType === typeId ? "#f0f0f0" : "#fff",
                borderBottom: "1px solid #eee",
              }}
            >
              {typeId}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
