import React from "react";
import { COLORS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";

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
        backgroundColor: COLORS.accent,
        color: COLORS.white,
        fontSize: TYPE.xs,
        fontWeight: 700,
        borderRadius: `${RADIUS.sm}px`,
        padding: `${SPACE[1]}px ${SPACE[2]}px`,
        textAlign: "center",
        zIndex: 4,
        boxShadow: SHADOWS.sm,
      }}
    >
      ✓ {title}
    </div>
  );
};
