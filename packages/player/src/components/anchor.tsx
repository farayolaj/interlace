import React, { useRef } from "react";
import { COLORS, RADIUS, SHADOWS, SPACE, TYPE } from "../tokens";

export interface AnchorProps {
  id: string;
  placement: { x: number; y: number; width: number; height: number };
  title: string;
  isOpened?: boolean;
  onClick?: () => void;
}

/**
 * Anchor component - a clickable button for non-blocking content.
 * Positioned absolutely with minimum 44px touch target.
 */
export const Anchor = React.forwardRef<HTMLButtonElement, AnchorProps>(
  ({ id, placement, title, isOpened, onClick }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const internalRef =
      (ref as React.MutableRefObject<HTMLButtonElement>) || buttonRef;

    // Ensure minimum 44px touch target
    const minSize = 44;
    const width = Math.max(placement.width, minSize / 100);
    const height = Math.max(placement.height, minSize / 100);

    return (
      <button
        ref={internalRef}
        onClick={onClick}
        aria-label={title}
        data-content-id={id}
        style={{
          position: "absolute",
          left: `${placement.x}%`,
          top: `${placement.y}%`,
          width: `${width}%`,
          height: `${height}%`,
          minWidth: `${minSize}px`,
          minHeight: `${minSize}px`,
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          fontSize: TYPE.md,
          fontWeight: 600,
          border: `2px solid ${COLORS.accent}`,
          borderRadius: `${RADIUS.sm}px`,
          backgroundColor: isOpened ? COLORS.accent : COLORS.surface,
          color: isOpened ? COLORS.white : COLORS.accent,
          cursor: "pointer",
          transition: "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
          boxShadow: isOpened ? "0 4px 8px rgba(0, 102, 204, 0.3)" : SHADOWS.sm,
          zIndex: 2,
          // The anchors layer is pointer-transparent; each anchor
          // re-enables pointer events for itself.
          pointerEvents: "auto",
        }}
      >
        {title}
      </button>
    );
  },
);

Anchor.displayName = "Anchor";
