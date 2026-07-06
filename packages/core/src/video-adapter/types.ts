/**
 * Video adapter interface that any player implementation must satisfy.
 */

export type VideoAdapterEventType =
  | "pause"
  | "play"
  | "buffering"
  | "waiting"
  | "seek";

export interface VideoAdapterEvent {
  type: VideoAdapterEventType;
}

export interface VideoAdapter {
  /**
   * Programmatically play the video.
   */
  play(): Promise<void> | void;

  /**
   * Programmatically pause the video.
   */
  pause(): void;

  /**
   * Seek to a specific time (in seconds).
   */
  seek(timeInSeconds: number): void;

  /**
   * Get the current playback time in seconds.
   */
  getCurrentTime(): number;

  /**
   * Get the total duration of the video in seconds.
   */
  getDuration(): number;

  /**
   * Mount the overlay layer (anchors, content, completed tags) produced by the player.
   * Called once when the overlay is ready; the adapter is responsible for positioning
   * and keeping it visible/interactive throughout playback and fullscreen.
   */
  mountOverlay(overlayNode: HTMLElement): void;

  /**
   * Register a listener for adapter events.
   * The adapter must emit events for pause, buffering, waiting, and seek.
   *
   * Note: Self-triggered events (resulting from the library's own play/pause/seek calls)
   * must be distinguished and ignored to avoid feedback loops. Use createProgrammaticActionGuard()
   * to manage this contract.
   */
  on(
    eventType: VideoAdapterEventType,
    handler: (event: VideoAdapterEvent) => void,
  ): () => void;
}

/**
 * Helper utility to implement the self-triggered-event-suppression contract.
 * Usage:
 *   const guard = createProgrammaticActionGuard();
 *   adapter.on('seek', (event) => {
 *     if (guard.shouldIgnore('seek')) return;
 *     // Handle user-driven seek...
 *   });
 *   // When making a programmatic seek:
 *   guard.markAsTriggered('seek');
 *   adapter.seek(time);
 */
export class ProgrammaticActionGuard {
  private triggeredActions: Set<VideoAdapterEventType> = new Set();

  markAsTriggered(actionType: VideoAdapterEventType): void {
    this.triggeredActions.add(actionType);
  }

  shouldIgnore(eventType: VideoAdapterEventType): boolean {
    if (this.triggeredActions.has(eventType)) {
      this.triggeredActions.delete(eventType);
      return true;
    }
    return false;
  }

  clear(): void {
    this.triggeredActions.clear();
  }
}
