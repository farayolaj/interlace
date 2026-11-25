/**
 * Video adapter interface that any player implementation must satisfy.
 */

export type VideoAdapterEventType =
  | "pause"
  | "play"
  | "buffering"
  | "waiting"
  | "seek"
  | "programmaticSeek"
  | "qualitychange";

export interface VideoAdapterEvent {
  type: VideoAdapterEventType;
}

/**
 * One selectable rendition of an adaptive stream (e.g. an HLS level).
 */
export interface QualityLevel {
  /** Adapter-specific id passed back to `setQualityLevel()`. */
  id: number;
  /** Vertical resolution in pixels. */
  height: number;
  /** Peak bitrate in bits per second, when known. */
  bitrate?: number;
  /** Display label, e.g. "720p". */
  label: string;
}

/**
 * Optional capability for adapters that can switch stream quality.
 * Detect it with {@link supportsQuality}; adapters that implement it emit
 * "qualitychange" whenever the levels load or change, the selection
 * changes, or the level actually playing switches.
 */
export interface QualityCapableAdapter {
  /** Available levels, highest first. `[]` when unknown or not switchable (native HLS, MP4). */
  getQualityLevels(): QualityLevel[];
  /** The selected level id; `-1` means Auto (adaptive). */
  getQualityLevel(): number;
  /** The id of the level currently playing (useful in Auto), or `null` when unknown. */
  getActiveQualityLevel(): number | null;
  /** Select a level by id; `-1` switches back to Auto. */
  setQualityLevel(id: number): void;
}

/**
 * Video adapter contract. Adapters may additionally implement
 * {@link QualityCapableAdapter} (detected with {@link supportsQuality}) to
 * expose stream quality levels; the player then renders a quality control.
 */
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
   * Must emit "programmaticSeek" synchronously once the new time is readable
   * from getCurrentTime(), so the player can tell the jump apart from a user
   * skipping ahead (e.g. resuming from a saved position).
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
   * "seek" is for user-driven seeks only; seeks made through seek() emit
   * "programmaticSeek" instead. Quality-capable adapters also emit
   * "qualitychange" (see {@link QualityCapableAdapter}).
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
 * True when the adapter implements the optional {@link QualityCapableAdapter}
 * capability. An adapter can implement it and still report no levels at
 * runtime (e.g. native HLS playback), so check `getQualityLevels()` too.
 */
export function supportsQuality(
  adapter: VideoAdapter,
): adapter is VideoAdapter & QualityCapableAdapter {
  const candidate = adapter as Partial<QualityCapableAdapter>;
  return (
    typeof candidate.getQualityLevels === "function" &&
    typeof candidate.getQualityLevel === "function" &&
    typeof candidate.getActiveQualityLevel === "function" &&
    typeof candidate.setQualityLevel === "function"
  );
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
