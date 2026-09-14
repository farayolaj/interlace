import { RenderState } from "@interlace/core";
import React, { useMemo } from "react";
import { Anchor } from "./anchor";
import { CompletedTag } from "./completed-tag";

export interface OverlayLayerProps {
  renderState: RenderState;
  items: any[];
  onAnchorClick?: (contentId: string) => void;
}

/**
 * OverlayLayer - manages 4 fixed z-index layers for overlay content.
 * z-index layers:
 *   1: Anchors (clickable buttons for non-blocking content)
 *   2: Active content area
 *   3: Blocking overlay
 *   4: Completed tags
 */
export const OverlayLayer: React.FC<OverlayLayerProps> = ({
  renderState,
  items,
  onAnchorClick,
}) => {
  // Build a map of items by content ID for easy lookup
  const itemMap = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      map.set(item.content.getId(), item);
    }
    return map;
  }, [items]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {/* Layer 1: Anchors (z-index 11) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          pointerEvents: "auto",
        }}
      >
        {renderState.visibleAnchorIds?.map((contentId) => {
          const item = itemMap.get(contentId);
          if (!item) return null;

          const hook = item.hook;
          if (hook.type !== "non-blocking") return null;

          return (
            <Anchor
              key={contentId}
              id={contentId}
              placement={hook.placement}
              title={item.content.getTitle()}
              isOpened={renderState.openedContentIds.includes(contentId)}
              onClick={() => {
                item.content.open();
                onAnchorClick?.(contentId);
              }}
            />
          );
        })}
      </div>

      {/* Layer 4: Completed Tags (z-index 14) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {renderState.completedTagIds?.map((contentId) => {
          const item = itemMap.get(contentId);
          if (!item) return null;

          const hook = item.hook;
          return (
            <CompletedTag
              key={`completed-${contentId}`}
              id={contentId}
              title={item.content.getTitle()}
              placement={hook.placement}
            />
          );
        })}
      </div>
    </div>
  );
};
