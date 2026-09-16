import {
  ContentInstance,
  ContentTypeRegistry,
  deserialize,
  InteractiveMediaController,
  RenderState,
  SerializedInteractiveMediaDocument,
  VideoAdapter,
} from "@interlace/core";
import { useEffect, useRef, useState } from "react";

export interface UseInteractiveMediaOptions {
  adapter: VideoAdapter;
  document: SerializedInteractiveMediaDocument;
  registry: ContentTypeRegistry;
  onRenderStateChange?: (state: RenderState) => void;
  onError?: (error: Error) => void;
}

/**
 * Core React hook for interactive video playback.
 * Manages the controller, rAF loop, and adapter event wiring.
 */
export function useInteractiveMedia(options: UseInteractiveMediaOptions) {
  const {
    adapter,
    document: doc,
    registry,
    onRenderStateChange,
    onError,
  } = options;

  const controllerRef = useRef<InteractiveMediaController | null>(null);
  const rafRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [items, setItems] = useState<ContentInstance[] | null>(null);

  // Initialize controller from document
  useEffect(() => {
    try {
      const result = deserialize(doc, registry);

      if (result.validationErrors.length > 0) {
        throw new Error(
          `Document validation failed: ${result.validationErrors[0]}`,
        );
      }

      const controller = new InteractiveMediaController(
        result.items,
        result.videoDuration,
      );
      controllerRef.current = controller;
      // Expose the deserialized instances so consumers complete items
      // without reaching into the controller's private state.
      setItems(result.items);
      setInitialized(true);

      return () => {
        controllerRef.current = null;
        setItems(null);
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [doc, registry, onError]);

  // Set up adapter event listeners
  useEffect(() => {
    if (!initialized || !controllerRef.current) return;

    const controller = controllerRef.current;

    // Wire adapter pause events to controller
    const unsubscribePause = adapter.on("pause", () => {
      isPlayingRef.current = false;
    });

    // Wire adapter play events to controller
    const unsubscribePlaying = adapter.on("play", () => {
      isPlayingRef.current = true;
    });

    // Wire controller commands to adapter
    const unsubscribeRequestPause = controller.on("requestPause", () => {
      adapter.pause();
    });

    const unsubscribeRequestSeek = controller.on("requestSeek", (event) => {
      adapter.seek(event.timeInSeconds);
    });

    return () => {
      unsubscribePause();
      unsubscribePlaying();
      unsubscribeRequestPause();
      unsubscribeRequestSeek();
    };
  }, [initialized, adapter]);

  // Set up rAF tick loop
  useEffect(() => {
    if (!initialized || !controllerRef.current) return;

    const controller = controllerRef.current;

    const tick = () => {
      const currentTime = adapter.getCurrentTime();
      const isPlayingForward = isPlayingRef.current;

      controller.tick(currentTime, isPlayingForward);

      // Update render state
      const renderState = controller.getRenderState(currentTime);
      onRenderStateChange?.(renderState);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [initialized, adapter, onRenderStateChange]);

  return {
    controller: controllerRef.current,
    /** The deserialized content instances backing the controller. */
    items,
    initialized,
    error,
  };
}
