import { NativeVideoAdapter } from "@interlace/native-adapter";
import { InteractiveVideoPlayer } from "@interlace/player";
import type { SerializedInteractiveMediaDocument } from "@interlace/core";
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
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        backgroundColor: "#000",
      }}
    >
      <video
        ref={videoRef}
        src={doc.video.src}
        controls
        preload="metadata"
        style={{ width: "100%", height: "100%", display: "block" }}
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
          }}
        >
          Loading player...
        </div>
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

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: 600 }}>Watch</span>
        <button
          type="button"
          onClick={handleReset}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            cursor: "pointer",
          }}
        >
          Reset to sample
        </button>
      </div>
      <VideoPlayer key={remountKey} doc={doc} onError={onError} />
    </div>
  );
}