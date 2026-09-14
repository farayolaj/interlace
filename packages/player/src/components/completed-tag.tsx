import React from "react";

export interface CompletedTagProps {
  id: string;
  title: string;
  placement: { x: number; y: number; width: number; height: number };
}

/**
 * CompletedTag - visual indicator showing that content has been completed.
 * Displayed as a badge overlay on top of the video.
 */
export const CompletedTag: React.FC<CompletedTagProps> = ({
  id,
  title,
  placement,
}) => {
  return (
    <div
      data-content-id={id}
      style={{
        position: "absolute",
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.width}%`,
        height: `${placement.height}%`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(76, 175, 80, 0.9)",
        color: "#fff",
        fontSize: "12px",
        fontWeight: 700,
        borderRadius: "4px",
        padding: "4px 8px",
        textAlign: "center",
        zIndex: 4,
      }}
    >
      ✓ {title}
    </div>
  );
};
