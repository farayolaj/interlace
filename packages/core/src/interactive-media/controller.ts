import { ContentInstance } from "../content/content-instance";
import { ErrorReasonCode } from "../errors/reason-codes";
import { EventEmitter } from "../events/event-emitter";
import { Hook, isBlockingHook, isNonBlockingHook } from "../hook/types";
import { validateHookOverlaps } from "../hook/validation";

export interface InteractiveMediaItem {
  hook: Hook;
  content: ContentInstance;
}

export interface InteractiveMediaControllerEvents {
  progress: {
    currentTime: number;
    isPlayingForward: boolean;
  };
  finished: {
    aggregatedResult: {
      numerator: number;
      denominator: number;
      percentage?: number;
    };
  };
  error: {
    reasonCode: ErrorReasonCode;
    message: string;
  };
  contentError: {
    contentId: string;
    reasonCode: string;
    message: string;
  };
  requestPause: Record<string, never>;
  requestSeek: {
    timeInSeconds: number;
  };
}

export interface RenderState {
  /** Content IDs that should have anchors visible */
  visibleAnchorIds: string[];
  /** Content that is currently blocking playback */
  activeBlockingContentId?: string;
  /** Content IDs that are showing completed tags */
  completedTagIds: string[];
  /** Content that is opened and should render its content */
  openedContentId?: string;
}

/**
 * Core state machine logic for interactive media playback.
 * Does NOT call the adapter directly; instead emits commands that the player executes.
 */
export class InteractiveMediaController extends EventEmitter<InteractiveMediaControllerEvents> {
  private items: InteractiveMediaItem[];
  private lastTickTime: number = -1;
  private hasEnded: boolean = false;
  private videoEndsAt: number = 0;

  constructor(items: InteractiveMediaItem[], videoDuration: number) {
    super();
    this.items = items;
    this.videoEndsAt = videoDuration;

    // Validate hook overlaps at construction time
    const hooks = items.map((item) => item.hook);
    const violations = validateHookOverlaps(hooks);
    if (violations.length > 0) {
      this.emit("error", {
        reasonCode: ErrorReasonCode.OVERLAP_VALIDATION_ERROR,
        message: `Hook overlap validation failed: ${violations.map((v) => v.description).join(", ")}`,
      });
    }
  }

  /**
   * Main tick function called every frame (e.g., from rAF).
   * Pure function relative to time input; checks hooks and emits state changes.
   */
  tick(currentTime: number, isPlayingForward: boolean = true): void {
    // Clamp to video bounds
    currentTime = Math.max(0, Math.min(currentTime, this.videoEndsAt));

    this.emit("progress", { currentTime, isPlayingForward });

    if (this.lastTickTime === currentTime) {
      return; // No time advance, skip hook checks
    }

    const prevTime = this.lastTickTime;
    this.lastTickTime = currentTime;

    // Check for video end
    if (currentTime >= this.videoEndsAt && !this.hasEnded) {
      this.hasEnded = true;
      this.handleEnded();
    }

    // Check hook triggers based on playback direction
    if (isPlayingForward) {
      this.checkForwardHooks(currentTime, prevTime);
    } else {
      this.checkRewindHooks(currentTime);
    }
  }

  /**
   * Handle user-initiated seek. Implements snap-back and rewind rules.
   */
  handleUserSeek(targetTime: number): void {
    const currentTime = this.lastTickTime;

    if (targetTime > currentTime) {
      // Forward seek: snap back to earliest unfinished blocking content
      const earliestBlockingTime = this.findEarliestUnfinishedBlockingTime(
        currentTime,
        targetTime,
      );
      if (earliestBlockingTime !== undefined) {
        // Snap back
        this.emit("requestSeek", { timeInSeconds: earliestBlockingTime });
        return;
      }
    } else if (targetTime < currentTime) {
      // Rewind: reset skipped content to pending, reset completed to inert display
      for (const item of this.items) {
        if (item.content.getState() === "skipped") {
          item.content.resetIfSkipped();
        }
        // Completed content remains locked; just inert display
      }
    }

    // Proceed with the seek
    this.tick(targetTime, targetTime > currentTime);
  }

  /**
   * Handle video reaching end.
   */
  handleEnded(): void {
    // Mark any still-active non-blocking content as skipped
    for (const item of this.items) {
      if (isNonBlockingHook(item.hook)) {
        const isStillActive = item.hook.end >= this.videoEndsAt;
        const isNotCompleted = item.content.getState() !== "completed";

        if (isStillActive && isNotCompleted) {
          item.content.skip();
        }
      }
    }

    // Compute aggregation and emit finished
    const aggregation = this.computeAggregatedResult();
    this.emit("finished", { aggregatedResult: aggregation });
  }

  /**
   * Get current render state (what should be visible on screen).
   */
  getRenderState(currentTime?: number): RenderState {
    const state: RenderState = {
      visibleAnchorIds: [],
      completedTagIds: [],
    };

    for (const item of this.items) {
      const contentState = item.content.getState();

      if (isBlockingHook(item.hook)) {
        if (contentState === "completed") {
          state.completedTagIds.push(item.content.getId());
        }
      } else {
        // Non-blocking
        const isActive =
          currentTime !== undefined &&
          currentTime >= item.hook.start &&
          currentTime < item.hook.end;

        if (isActive) {
          if (contentState === "encountered" || contentState === "opened") {
            state.visibleAnchorIds.push(item.content.getId());
          }
          if (contentState === "opened") {
            state.openedContentId = item.content.getId();
          }
        }

        if (contentState === "completed") {
          state.completedTagIds.push(item.content.getId());
        }
      }
    }

    return state;
  }

  /**
   * Find the earliest unfinished blocking hook's timestamp between currentTime and targetTime.
   * Returns the timestamp to snap back to, or undefined if none found.
   */
  private findEarliestUnfinishedBlockingTime(
    currentTime: number,
    targetTime: number,
  ): number | undefined {
    let earliest: number | undefined;

    for (const item of this.items) {
      if (!isBlockingHook(item.hook)) {
        continue;
      }

      const contentState = item.content.getState();
      if (contentState === "completed" || item.content.isLocked()) {
        continue; // Skip completed/locked content
      }

      const timestamp = item.hook.timestamp;
      if (timestamp > currentTime && timestamp <= targetTime) {
        if (earliest === undefined || timestamp < earliest) {
          earliest = timestamp;
        }
      }
    }

    return earliest;
  }

  /**
   * Check forward hook triggers during forward playback.
   */
  private checkForwardHooks(currentTime: number, prevTime: number): void {
    for (const item of this.items) {
      const hook = item.hook;
      const content = item.content;
      const state = content.getState();

      if (isBlockingHook(hook)) {
        // Blocking hook triggers at exact timestamp
        if (
          state === "pending" &&
          Math.abs(currentTime - hook.timestamp) < 0.016
        ) {
          // Within ~1 frame tolerance (60fps)
          content.encounter();
          content.open();
          this.emit("requestPause", {});
        }
      } else {
        // Non-blocking hook
        // Check if we just entered the time range
        if (prevTime < hook.start && currentTime >= hook.start) {
          if (state === "pending") {
            content.encounter();
            if (hook.revealBehavior === "immediate") {
              content.open();
            }
          }
        }

        // Check if we just exited the time range
        if (prevTime < hook.end && currentTime >= hook.end) {
          if (state !== "completed" && !content.isLocked()) {
            content.skip();
          }
        }
      }
    }
  }

  /**
   * Check rewind behavior.
   */
  private checkRewindHooks(currentTime: number): void {
    // Rewind rules are handled in handleUserSeek, so this is a no-op for now
    // Could add logic for auto-seeking back if needed
  }

  /**
   * Compute aggregated result score.
   */
  private computeAggregatedResult(): {
    numerator: number;
    denominator: number;
    percentage?: number;
  } {
    let numerator = 0;
    let denominator = 0;

    for (const item of this.items) {
      if (!item.content.isScorable()) {
        continue;
      }

      const total = item.content.getTotalScore();
      denominator += total;

      if (item.content.getState() === "completed") {
        const score = item.content.getResultScore();
        if (score !== undefined) {
          numerator += score;
        }
      }
    }

    const result: {
      numerator: number;
      denominator: number;
      percentage?: number;
    } = {
      numerator,
      denominator,
    };

    if (denominator > 0) {
      result.percentage = (numerator / denominator) * 100;
    }

    return result;
  }
}
