import {
  ProgrammaticActionGuard,
  VideoAdapter,
  VideoAdapterEvent,
  VideoAdapterEventType,
} from "@interlace/core";

/**
 * Native HTML5 `<video>` element adapter.
 * Wraps a video element and provides the VideoAdapter interface.
 *
 * Usage:
 *   const adapter = new NativeVideoAdapter(videoElement);
 *   adapter.on("play", () => console.log("Playing"));
 *   await adapter.play();
 */
export class NativeVideoAdapter implements VideoAdapter {
  private videoElement: HTMLVideoElement;
  private wrapperDiv: HTMLDivElement;
  private overlayNode: HTMLElement | null = null;
  private guard = new ProgrammaticActionGuard();
  private listeners = new Map<
    VideoAdapterEventType,
    Set<(event: VideoAdapterEvent) => void>
  >();

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;

    // Create wrapper div for overlay and fullscreen support
    this.wrapperDiv = document.createElement("div");
    this.wrapperDiv.style.position = "relative";
    this.wrapperDiv.style.display = "inline-block";
    this.wrapperDiv.style.width = videoElement.style.width || "100%";
    this.wrapperDiv.style.height = videoElement.style.height || "auto";

    // Move video into wrapper
    videoElement.parentNode?.replaceChild(this.wrapperDiv, videoElement);
    this.wrapperDiv.appendChild(videoElement);

    // Set video element to fill wrapper
    this.videoElement.style.width = "100%";
    this.videoElement.style.height = "100%";
    this.videoElement.style.display = "block";

    // Initialize event listeners
    this.setupEventListeners();
  }

  /**
   * Set up native video element event listeners.
   */
  private setupEventListeners(): void {
    this.videoElement.addEventListener("play", () => {
      if (this.guard.shouldIgnore("play")) {
        this.guard.markAsTriggered("play");
        return;
      }
      this.emit("play", { type: "play" });
    });

    this.videoElement.addEventListener("pause", () => {
      if (this.guard.shouldIgnore("pause")) {
        this.guard.markAsTriggered("pause");
        return;
      }
      this.emit("pause", { type: "pause" });
    });

    this.videoElement.addEventListener("seeking", () => {
      if (this.guard.shouldIgnore("seek")) {
        this.guard.markAsTriggered("seek");
        return;
      }
      this.emit("seek", { type: "seek" } as any);
    });

    this.videoElement.addEventListener("waiting", () => {
      this.emit("waiting", { type: "waiting" });
    });

    this.videoElement.addEventListener("buffering", () => {
      this.emit("buffering", { type: "buffering" });
    });

    // Also emit buffering when progress event fires and not all data loaded
    this.videoElement.addEventListener("progress", () => {
      if (this.videoElement.buffered.length > 0) {
        const bufferedEnd = this.videoElement.buffered.end(
          this.videoElement.buffered.length - 1,
        );
        const duration = this.videoElement.duration;
        if (bufferedEnd < duration) {
          this.emit("buffering", { type: "buffering" });
        }
      }
    });
  }

  /**
   * Play the video.
   */
  async play(): Promise<void> {
    this.guard.markAsTriggered("play");
    try {
      await this.videoElement.play();
    } catch (err) {
      // Handle autoplay policy and other errors gracefully
      console.error("Failed to play video:", err);
    }
  }

  /**
   * Pause the video.
   */
  async pause(): Promise<void> {
    this.guard.markAsTriggered("pause");
    this.videoElement.pause();
  }

  /**
   * Seek to a specific time (in seconds).
   */
  async seek(targetTime: number): Promise<void> {
    this.guard.markAsTriggered("seek");
    this.videoElement.currentTime = targetTime;
  }

  /**
   * Get current playback time (in seconds).
   */
  getCurrentTime(): number {
    return this.videoElement.currentTime;
  }

  /**
   * Get video duration (in seconds).
   */
  getDuration(): number {
    return this.videoElement.duration || 0;
  }

  /**
   * Mount an overlay element on top of the video.
   * Positioned absolutely within the wrapper div.
   */
  mountOverlay(node: HTMLElement): void {
    // Remove previous overlay if exists
    if (this.overlayNode && this.overlayNode.parentNode) {
      this.overlayNode.parentNode.removeChild(this.overlayNode);
    }

    this.overlayNode = node;
    node.style.position = "absolute";
    node.style.top = "0";
    node.style.left = "0";
    node.style.width = "100%";
    node.style.height = "100%";
    node.style.zIndex = "10";

    this.wrapperDiv.appendChild(node);
  }

  /**
   * Request fullscreen on the wrapper div.
   */
  async requestFullscreen(): Promise<void> {
    try {
      if (this.wrapperDiv.requestFullscreen) {
        await this.wrapperDiv.requestFullscreen();
      } else if ((this.wrapperDiv as any).webkitRequestFullscreen) {
        (this.wrapperDiv as any).webkitRequestFullscreen();
      } else if ((this.wrapperDiv as any).mozRequestFullScreen) {
        (this.wrapperDiv as any).mozRequestFullScreen();
      } else if ((this.wrapperDiv as any).msRequestFullscreen) {
        (this.wrapperDiv as any).msRequestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    }
  }

  /**
   * Exit fullscreen.
   */
  async exitFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement === this.wrapperDiv) {
        await document.exitFullscreen();
      } else if (
        (document as any).webkitFullscreenElement === this.wrapperDiv
      ) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozFullScreenElement === this.wrapperDiv) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msFullscreenElement === this.wrapperDiv) {
        (document as any).msExitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen exit failed:", err);
    }
  }

  /**
   * Register an event listener.
   * Returns an unsubscribe function.
   */
  on(
    eventType: VideoAdapterEventType,
    handler: (event: VideoAdapterEvent) => void,
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(handler);
      }
    };
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit(
    eventType: VideoAdapterEventType,
    event: VideoAdapterEvent,
  ): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  /**
   * Get the wrapper div (for CSS styling or parent access).
   */
  getWrapperElement(): HTMLDivElement {
    return this.wrapperDiv;
  }

  /**
   * Get the underlying video element.
   */
  getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  /**
   * Unmount the adapter and restore the video element to its original state.
   */
  destroy(): void {
    // Remove listeners
    this.listeners.clear();

    // Remove overlay if mounted
    if (this.overlayNode && this.overlayNode.parentNode) {
      this.overlayNode.parentNode.removeChild(this.overlayNode);
    }

    // Restore video element and remove wrapper
    if (this.wrapperDiv.parentNode) {
      this.wrapperDiv.parentNode.replaceChild(
        this.videoElement,
        this.wrapperDiv,
      );
    }

    // Reset video element styles
    this.videoElement.style.width = "";
    this.videoElement.style.height = "";
    this.videoElement.style.display = "";
  }
}
