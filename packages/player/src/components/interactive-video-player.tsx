import {
  ContentTypeRegistry,
  RenderState,
  SerializedInteractiveMediaDocument,
  VideoAdapter,
} from "@interlacejs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInteractiveMedia } from "../hooks/use-interactive-media";
import { COLORS, RADIUS, SPACE, TYPE } from "../tokens";
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
  // Completing lifecycle: after an item completes, the overlay stays mounted
  // showing the completion surface + Continue until the user acknowledges it
  // (Continue resumes playback and unmounts the overlay).
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completingScore, setCompletingScore] = useState<number | undefined>(
    undefined,
  );
  const lastAutoOpenedBlockingIdRef = useRef<string | null>(null);

  const { controller, items, initialized, error } = useInteractiveMedia({
    adapter,
    document: doc,
    registry,
    onRenderStateChange: setRenderState,
    onError,
  });

  const handleAnchorClick = useCallback(
    (contentId: string) => {
      adapter.pause();
      setActiveContentId(contentId);
    },
    [adapter],
  );

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
      // Enter the completing lifecycle: the overlay swaps to a completion
      // surface with a Continue button. Playback stays PAUSED until the
      // user acknowledges completion and resumes via Continue.
      setCompletingScore(score ?? 0);
      setCompletingId(activeContentId);
      setActiveContentId(null);
    },
    [controller, items, activeContentId],
  );

  // Continue-gated resume: unmount the completion surface and resume
  // playback. This is the ONLY exit from the completing state.
  const handleContinueAfterCompletion = useCallback(() => {
    setCompletingId(null);
    setCompletingScore(undefined);
    void adapter.play();
  }, [adapter]);

  if (error) {
    return (
      <div
        style={{
          padding: `${SPACE[4]}px`,
          color: COLORS.errorText,
          backgroundColor: COLORS.errorBg,
          border: `1px solid ${COLORS.errorBorder}`,
          borderRadius: `${RADIUS.md}px`,
          fontSize: TYPE.md,
          lineHeight: 1.5,
        }}
      >
        <strong>Player Error:</strong> {error.message}
      </div>
    );
  }

  if (!initialized || !controller) {
    return (
      <div
        style={{
          padding: `${SPACE[4]}px`,
          color: COLORS.textMuted,
          fontSize: TYPE.md,
        }}
      >
        Loading player…
      </div>
    );
  }

  // Controller stores plain ContentInstance[]; overlay components expect
  // { content, hook } pairs.
  const overlayItems = (items ?? []).map((content) => ({
    content,
    hook: content.getHook(),
  }));
  // The overlay renders for the active content, or the completing content
  // while the completion surface is showing.
  const overlayContentId = activeContentId ?? completingId;
  const activeItem = overlayItems.find(
    (item) => item.content.getId() === overlayContentId,
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
            onSkip={() => {
              // Skipping declines the hook for this viewing (the item is
              // marked skipped; per the controller the anchor can be
              // taken again on re-approach) and closes the overlay.
              const item = (items ?? []).find(
                (it) => it.getId() === overlayContentId,
              );
              item?.skip();
              setActiveContentId(null);
              void adapter.play();
            }}
            onContentComplete={handleContentComplete}
            onContinue={handleContinueAfterCompletion}
            completing={
              completingId !== null && completingId === overlayContentId
            }
            completingScore={completingScore}
          />
        )}
      </div>
    </ContentErrorBoundary>
  );
};
