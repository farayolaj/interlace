import {
  ContentTypeRegistry,
  type ContentType,
  type SerializedInteractiveMediaDocument,
  type VideoAdapter,
  type VideoAdapterEvent,
  type VideoAdapterEventType,
} from "@interlacejs/core";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useEffect } from "react";
import {
  InteractiveVideoPlayer,
  type InteractiveVideoPlayerProps,
} from "./interactive-video-player";

/**
 * Simulated video adapter: emits play/pause events and advances the clock at
 * 4x speed so hook windows and blocking timestamps trigger quickly in stories.
 */
class MockVideoAdapter implements VideoAdapter {
  private currentTime = 0;
  private duration = 120;
  private isPlaying = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Map<
    VideoAdapterEventType,
    Set<(event: VideoAdapterEvent) => void>
  >();

  play(): void {
    this.isPlaying = true;
    this.emit("play", { type: "play" });
    if (this.intervalId === null) {
      this.intervalId = setInterval(() => {
        this.currentTime = Math.min(this.duration, this.currentTime + 1);
        if (this.currentTime >= this.duration) {
          this.pause();
        }
      }, 250);
    }
  }

  pause(): void {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emit("pause", { type: "pause" });
  }

  seek(timeInSeconds: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, timeInSeconds));
    this.emit("seek", { type: "seek" });
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  mountOverlay(): void {
    // No-op for story-level adapter.
  }

  on(
    eventType: VideoAdapterEventType,
    handler: (event: VideoAdapterEvent) => void,
  ): () => void {
    const listenersForType = this.listeners.get(eventType) ?? new Set();
    listenersForType.add(handler);
    this.listeners.set(eventType, listenersForType);

    // Replay current playback state to late subscribers: the player hook only
    // subscribes after initialization, which happens after mount-time play().
    if (eventType === "play" && this.isPlaying) {
      handler({ type: "play" });
    }

    return () => {
      const current = this.listeners.get(eventType);
      if (!current) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  private emit(eventType: VideoAdapterEventType, event: VideoAdapterEvent): void {
    this.listeners.get(eventType)?.forEach((listener) => {
      listener(event);
    });
  }
}

interface QuizData {
  question: string;
  choices: string[];
  answer: number;
}

function createRegistry() {
  const registry = new ContentTypeRegistry();

  const quizType: ContentType<QuizData> = {
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback: (
      container: HTMLElement,
      data: QuizData,
      callbacks: { onComplete(score?: number): void },
    ) => {
      container.textContent = data.question;
      callbacks.onComplete(75);
    },
  };

  registry.register(quizType);
  return registry;
}

function createDocument(): SerializedInteractiveMediaDocument {
  return {
    video: {
      src: "https://example.com/training.mp4",
      duration: 120,
    },
    items: [
      {
        id: "item-blocking",
        title: "Blocking checkpoint",
        hook: {
          type: "blocking",
          timestamp: 20,
          placement: {
            x: 15,
            y: 12,
            width: 30,
            height: 24,
          },
        },
        content: {
          contentTypeId: "quiz",
          version: 1,
          data: {
            question: "What does API stand for?",
            choices: ["App Protocol Interface", "Application Programming Interface"],
            answer: 1,
          },
        },
      },
      {
        id: "item-anchor",
        title: "Optional deep dive",
        hook: {
          type: "non-blocking",
          start: 0,
          end: 60,
          revealBehavior: "click",
          placement: {
            x: 60,
            y: 18,
            width: 24,
            height: 18,
          },
        },
        content: {
          contentTypeId: "quiz",
          version: 1,
          data: {
            question: "Pick the best architectural pattern.",
            choices: ["Event-driven", "Random polling"],
            answer: 0,
          },
        },
      },
    ],
  };
}

/**
 * Starts mock playback on mount so hook windows and blocking timestamps
 * trigger while the story is viewed.
 */
function AutoPlayingPlayer(props: InteractiveVideoPlayerProps) {
  const { adapter } = props;

  useEffect(() => {
    adapter.play();
    return () => adapter.pause();
  }, [adapter]);

  return <InteractiveVideoPlayer {...props} />;
}

const meta: Meta<typeof InteractiveVideoPlayer> = {
  title: "Player/InteractiveVideoPlayer",
  component: InteractiveVideoPlayer,
  args: {
    adapter: new MockVideoAdapter(),
    registry: createRegistry(),
    document: createDocument(),
    onError: fn(),
  },
  render: (args: InteractiveVideoPlayerProps) => <AutoPlayingPlayer {...args} />,
  decorators: [
    (Story) => (
      <div
        style={{
          width: 900,
          height: 500,
          border: "1px solid #d0d0d0",
          borderRadius: 8,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #eaf2ff 0%, #f6f8fb 100%)",
        }}
      >
        <Story />
      </div>
     ),
   ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
