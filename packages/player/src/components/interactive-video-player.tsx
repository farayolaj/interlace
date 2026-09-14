import {
  ContentTypeRegistry,
  RenderState,
  SerializedInteractiveMediaDocument,
  VideoAdapter,
} from "@interlace/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInteractiveMedia } from "../hooks/use-interactive-media";
import { BlockingOverlay } from "./blocking-overlay";
import { ContentErrorBoundary } from "./content-error-boundary";
import { OverlayLayer } from "./overlay-layer";

export interface InteractiveVideoPlayerProps {
  adapter: VideoAdapter;
  document: SerializedInteractiveMediaDocument;
  registry: ContentTypeRegistry;
  onError?: (error: Error) => void;
}

/**
 * InteractiveVideoPlayer - top-level React component for interactive video playback.
 * Integrates:
 * - useInteractiveMedia hook for runtime state management
 * - OverlayLayer for anchor and completed tag rendering
 * - BlockingOverlay for interactive content modals
 * - ContentErrorBoundary for error handling
 */
export const InteractiveVideoPlayer: React.FC<InteractiveVideoPlayerProps> = ({
  adapter,
  document: doc,
  registry,
  onError,
}) => {
  const [renderState, setRenderState] = useState<RenderState>({
    visibleAnchorIds: [],
    completedTagIds: [],
    openedContentIds: [],
  });
  const [activeContentId, setActiveContentId] = useState<string | null>(null);
  const lastAutoOpenedBlockingIdRef = useRef<string | null>(null);

  const { controller, initialized, error } = useInteractiveMedia({
    adapter,
    document: doc,
    registry,
    onRenderStateChange: setRenderState,
    onError,
  });

  const handleAnchorClick = useCallback((contentId: string) => {
    setActiveContentId(contentId);
  }, []);

  const handleBlockingClose = useCallback(() => {
    setActiveContentId(null);
  }, []);

  // Auto-open the blocking overlay when the controller pauses for blocking
  // content. The ref guard keeps a manually closed overlay closed instead of
  // reopening it on every render state update.
  useEffect(() => {
    const blockingId = renderState.activeBlockingContentId;
    if (blockingId && blockingId !== lastAutoOpenedBlockingIdRef.current) {
      lastAutoOpenedBlockingIdRef.current = blockingId;
      setActiveContentId(blockingId);
    }
  }, [renderState.activeBlockingContentId]);

  const handleBlockingSubmit = useCallback(
    (result: any) => {
      if (!controller || !activeContentId) return;

      // Find the content instance and mark it complete
      for (const item of (controller as any).items || []) {
        if (item.getId() === activeContentId) {
          item.complete(result.score || 0);
          break;
        }
      }

      setActiveContentId(null);
    },
    [controller, activeContentId],
  );

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          color: "#c33",
          backgroundColor: "#fee",
          borderRadius: "4px",
        }}
      >
        <strong>Player Error:</strong> {error.message}
      </div>
    );
  }

  if (!initialized || !controller) {
    return (
      <div style={{ padding: "16px", color: "#666" }}>Loading player...</div>
    );
  }

  // Controller stores plain ContentInstance[]; overlay components expect
  // { content, hook } pairs.
  const items = ((controller as any).items || []).map((content: any) => ({
    content,
    hook: content.getHook(),
  }));
  const activeItem = items.find(
    (item: any) => item.content.getId() === activeContentId,
  );

  return (
    <ContentErrorBoundary onError={onError}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <OverlayLayer
          renderState={renderState}
          items={items}
          onAnchorClick={handleAnchorClick}
        />

        {activeItem && (
          <BlockingOverlay
            content={activeItem.content}
            onClose={handleBlockingClose}
            onSubmit={handleBlockingSubmit}
          />
        )}
      </div>
    </ContentErrorBoundary>
  );
};
