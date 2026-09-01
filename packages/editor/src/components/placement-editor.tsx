import { Placement } from "@interlace/core";
import React, { useCallback, useState } from "react";

export interface PlacementEditorProps {
  placement: Placement;
  onPlacementChange: (placement: Placement) => void;
  videoWidth?: number;
  videoHeight?: number;
}

/**
 * PlacementEditor - visual component for editing hook placement on video surface.
 * Shows video preview with draggable/resizable placement rectangle.
 */
export const PlacementEditor: React.FC<PlacementEditorProps> = ({
  placement,
  onPlacementChange,
  videoWidth = 640,
  videoHeight = 360,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - (placement.x / 100) * videoWidth,
        y: e.clientY - (placement.y / 100) * videoHeight,
      });
    },
    [placement, videoWidth, videoHeight],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      const x = ((e.clientX - dragOffset.x) / videoWidth) * 100;
      const y = ((e.clientY - dragOffset.y) / videoHeight) * 100;

      onPlacementChange({
        ...placement,
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    },
    [
      isDragging,
      dragOffset,
      videoWidth,
      videoHeight,
      placement,
      onPlacementChange,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: `${videoWidth}px`,
        height: `${videoHeight}px`,
        backgroundColor: "#f0f0f0",
        border: "1px solid #ccc",
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Placement indicator rectangle */}
      <div
        style={{
          position: "absolute",
          left: `${placement.x}%`,
          top: `${placement.y}%`,
          width: `${placement.width}%`,
          height: `${placement.height}%`,
          backgroundColor: "rgba(0, 102, 204, 0.2)",
          border: "2px solid #0066cc",
          borderRadius: "4px",
          boxSizing: "border-box",
        }}
        onMouseDown={handleMouseDown}
      />

      {/* Numerical input controls */}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          left: "8px",
          backgroundColor: "#fff",
          padding: "8px",
          borderRadius: "4px",
          fontSize: "12px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        }}
      >
        <label>
          X:{" "}
          <input
            type="number"
            value={placement.x.toFixed(1)}
            onChange={(e) =>
              onPlacementChange({
                ...placement,
                x: parseFloat(e.target.value) || 0,
              })
            }
            style={{ width: "60px", padding: "2px" }}
          />
        </label>
        <label>
          Y:{" "}
          <input
            type="number"
            value={placement.y.toFixed(1)}
            onChange={(e) =>
              onPlacementChange({
                ...placement,
                y: parseFloat(e.target.value) || 0,
              })
            }
            style={{ width: "60px", padding: "2px" }}
          />
        </label>
        <label>
          W:{" "}
          <input
            type="number"
            value={placement.width.toFixed(1)}
            onChange={(e) =>
              onPlacementChange({
                ...placement,
                width: parseFloat(e.target.value) || 0,
              })
            }
            style={{ width: "60px", padding: "2px" }}
          />
        </label>
        <label>
          H:{" "}
          <input
            type="number"
            value={placement.height.toFixed(1)}
            onChange={(e) =>
              onPlacementChange({
                ...placement,
                height: parseFloat(e.target.value) || 0,
              })
            }
            style={{ width: "60px", padding: "2px" }}
          />
        </label>
      </div>
    </div>
  );
};
