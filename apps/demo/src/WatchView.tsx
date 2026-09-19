import { NativeVideoAdapter } from "@interlacejs/native-adapter";
import { InteractiveVideoPlayer } from "@interlacejs/player";
import type { SerializedInteractiveMediaDocument } from "@interlacejs/core";
import { useEffect, useRef, useState } from "react";
import { getRegistry } from "./registry";
import { SAMPLE_DOC } from "./sample";
import { saveDoc } from "./storage";

export interface WatchViewProps {
  /** The document to play (the saved doc, or the sample when none). */
  doc: SerializedInteractiveMediaDocument;
  /** Called after "Reset to sample" (the host updates its doc state). */
  onResetToSample: () => void;
  onError?: (error: Error) => void;
}

/**
 * Watch mode: renders the video element and wraps it in a
 * `NativeVideoAdapter` (element ownership lives here; the adapter wraps the
 * element in a relative-positioned div on mount and `destroy()` unwraps it
 * on unmount). `InteractiveVideoPlayer` is mounted over the video as a
 * sibling — the player renders its own overlay layer, so the adapter's
 * `mountOverlay` is not used.
 */
function VideoPlayer({
  doc,
  onError,
}: {
  doc: SerializedInteractiveMediaDocument;
  onError?: (error: Error) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [adapter, setAdapter] = useState<NativeVideoAdapter | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const native = new NativeVideoAdapter(video);
    setAdapter(native);
    return () => {
      try {
        native.destroy();
      } catch {
        // destroy() can throw if the wrapper was already detached; the DOM
        // is going away anyway.
      }
      setAdapter(null);
    };
  }, []);

  return (
    <div className="watch-stage">
      <video
        ref={videoRef}
        src={doc.video.src}
        controls
        preload="metadata"
      />
      {adapter ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <InteractiveVideoPlayer
            adapter={adapter}
            document={doc}
            registry={getRegistry()}
            onError={onError}
          />
        </div>
      ) : (
        <div className="watch-loading">Loading player…</div>
      )}
    </div>
  );
}

export function WatchView({ doc, onResetToSample, onError }: WatchViewProps) {
  // Bumping this key remounts the video + adapter + player, which is how
  // "Reset to sample" restarts playback against the sample document even
  // when the doc prop identity is unchanged.
  const [remountKey, setRemountKey] = useState(0);

  const handleReset = () => {
    saveDoc(SAMPLE_DOC);
    setRemountKey((key) => key + 1);
    onResetToSample();
  };

  const isSample = doc === SAMPLE_DOC;

  return (
    <section className="demo-panel">
      <div className="watch-header">
        <div>
          <h2 className="watch-title">Watch</h2>
          <p className="watch-hint">
            {isSample
              ? "Playing: sample trailer"
              : "Playing: your saved document"}
          </p>
        </div>
        <button type="button" className="demo-btn" onClick={handleReset}>
          Reset to sample
        </button>
      </div>
      <VideoPlayer key={remountKey} doc={doc} onError={onError} />
    </section>
  );
}
