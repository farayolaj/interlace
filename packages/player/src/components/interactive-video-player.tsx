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

  const { controller, items, initialized, error } = useInteractiveMedia({
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
  // reopening it on every render state update; the ref re-arms when the
  // controller leaves the blocking frame (scrub, settle, or completion), so
  // re-seeking a dismissed hook re-opens it instead of leaving the player
  // stuck with a paused video and no overlay.
  useEffect(() => {
    const blockingId = renderState.activeBlockingContentId;
    if (blockingId && blockingId !== lastAutoOpenedBlockingIdRef.current) {
      lastAutoOpenedBlockingIdRef.current = blockingId;
      setActiveContentId(blockingId);
    } else if (!blockingId && lastAutoOpenedBlockingIdRef.current) {
      lastAutoOpenedBlockingIdRef.current = null;
    }
  }, [renderState.activeBlockingContentId]);

  const handleContentComplete = useCallback(
    (score?: number) => {
      if (!controller || !activeContentId) return;
      const item = (items ?? []).find((it) => it.getId() === activeContentId);
      item?.complete(score ?? 0);
      setActiveContentId(null);
    },
    [controller, items, activeContentId],
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
  const overlayItems = (items ?? []).map((content) => ({
    content,
    hook: content.getHook(),
  }));
  const activeItem = overlayItems.find(
    (item) => item.content.getId() === activeContentId,
  );
  const activeContentType = activeItem
    ? registry.get(activeItem.content.getContentTypeId())
    : undefined;

  return (
    <ContentErrorBoundary onError={onError}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <OverlayLayer
          renderState={renderState}
          items={overlayItems}
          onAnchorClick={handleAnchorClick}
        />

        {activeItem && activeContentType && (
          <BlockingOverlay
            content={activeItem.content}
            contentType={activeContentType}
            onClose={handleBlockingClose}
            onContentComplete={handleContentComplete}
          />
        )}
      </div>
    </ContentErrorBoundary>
  );
};
