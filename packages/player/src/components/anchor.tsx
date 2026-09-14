import React, { useRef } from "react";

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
          padding: "8px 12px",
          fontSize: "14px",
          fontWeight: 600,
          border: "2px solid #0066cc",
          borderRadius: "4px",
          backgroundColor: isOpened ? "#0066cc" : "#fff",
          color: isOpened ? "#fff" : "#0066cc",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: isOpened ? "0 4px 8px rgba(0, 102, 204, 0.3)" : "none",
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
