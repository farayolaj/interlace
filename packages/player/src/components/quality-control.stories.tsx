import type {
  QualityCapableAdapter,
  QualityLevel,
  VideoAdapter,
  VideoAdapterEvent,
  VideoAdapterEventType,
} from "@interlacejs/core";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { QualityControl, type QualityControlProps } from "./quality-control";

const LEVELS: QualityLevel[] = [
  { id: 3, height: 1080, label: "1080p" },
  { id: 2, height: 720, label: "720p" },
  { id: 1, height: 480, label: "480p" },
  { id: 0, height: 240, label: "240p" },
];

/**
 * Fake quality-capable adapter: Auto settles on 480p, and play/pause are
 * driven by the story so the auto-hide behaviour can be tried out.
 */
class FakeQualityAdapter implements VideoAdapter, QualityCapableAdapter {
  private selected = -1;
  private active: number | null = 1;
  private listeners = new Map<
    VideoAdapterEventType,
    Set<(event: VideoAdapterEvent) => void>
  >();

  play(): void {
    this.emit("play");
  }
  pause(): void {
    this.emit("pause");
  }
  seek(): void {
    this.emit("programmaticSeek");
  }
  getCurrentTime(): number {
    return 0;
  }
  getDuration(): number {
    return 120;
  }
  mountOverlay(): void {}

  getQualityLevels(): QualityLevel[] {
    return LEVELS;
  }
  getQualityLevel(): number {
    return this.selected;
  }
  getActiveQualityLevel(): number | null {
    return this.active;
  }
  setQualityLevel(id: number): void {
    this.selected = id;
    this.active = id === -1 ? 1 : id;
    this.emit("qualitychange");
  }

  on(
    type: VideoAdapterEventType,
    handler: (event: VideoAdapterEvent) => void,
  ): () => void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
    return () => {
      set.delete(handler);
    };
  }

  private emit(type: VideoAdapterEventType): void {
    this.listeners.get(type)?.forEach((handler) => handler({ type }));
  }
}

function Stage(props: QualityControlProps & { autoplay?: boolean }) {
  const { adapter, autoplay } = props;
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const offPlay = adapter.on("play", () => setPlaying(true));
    const offPause = adapter.on("pause", () => setPlaying(false));
    if (autoplay) adapter.play();
    return () => {
      offPlay();
      offPause();
    };
  }, [adapter, autoplay]);

  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <div
        style={{
          position: "relative",
          width: 640,
          maxWidth: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 8,
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #1e293b 0%, #334155 55%, #0f172a 100%)",
        }}
      >
        <QualityControl {...props} />
      </div>
      <button
        type="button"
        onClick={() => (playing ? adapter.pause() : adapter.play())}
      >
        {playing ? "Pause" : "Play"} (playing hides the control after 2.5 s
        idle)
      </button>
    </div>
  );
}

const meta: Meta<typeof Stage> = {
  title: "Player/QualityControl",
  component: Stage,
  args: { adapter: new FakeQualityAdapter() },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Paused: Story = {};

export const Playing: Story = {
  args: { adapter: new FakeQualityAdapter(), autoplay: true },
};
