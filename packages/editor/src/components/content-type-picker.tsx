import React, { useState } from "react";
import { COLORS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";

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
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          backgroundColor: COLORS.surface,
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: `${RADIUS.sm}px`,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: TYPE.base,
          color: COLORS.text,
          transition: "border-color 150ms ease, background-color 150ms ease",
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
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.borderStrong}`,
            borderTop: "none",
            borderRadius: `0 0 ${RADIUS.sm}px ${RADIUS.sm}px`,
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 10,
            boxShadow: SHADOWS.md,
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
                padding: `${SPACE[2]}px ${SPACE[3]}px`,
                cursor: "pointer",
                backgroundColor:
                  selectedType === typeId ? COLORS.accentLighter : COLORS.surface,
                borderBottom: `1px solid ${COLORS.border}`,
                color: selectedType === typeId ? COLORS.accent : COLORS.text,
                fontSize: TYPE.base,
                transition: "background-color 150ms ease",
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
