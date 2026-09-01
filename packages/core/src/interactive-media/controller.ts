import { ContentInstance } from "../content/content-instance";
import { ContentState } from "../content/types";
import { ContentErrorCode, ErrorCode } from "../errors/codes";
import { EventEmitter } from "../events/event-emitter";
import { Hook, isBlockingHook, isNonBlockingHook } from "../hook/types";
import { validateHookOverlaps } from "../hook/validation";

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
    code: ErrorCode;
    message: string;
  };
  contentError: {
    contentId: string;
    code: ContentErrorCode;
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
  openedContentIds: string[];
}

/**
 * Core state machine logic for interactive media playback.
 * Does NOT call the adapter directly; instead emits commands that the player executes.
 */
export class InteractiveMediaController extends EventEmitter<InteractiveMediaControllerEvents> {
  private items: ContentInstance[];
  private lastTickTime: number = -1;
  private hasEnded: boolean = false;
  private videoEndsAt: number = 0;

  constructor(items: ContentInstance[], videoDuration: number) {
    super();
    this.items = items;
    this.videoEndsAt = videoDuration;

    // Validate hook overlaps at construction time
    const hooks = items.map((item) => item.getHook());
    const violations = validateHookOverlaps(hooks);
    if (violations.length > 0) {
      this.emit("error", {
        code: ErrorCode.OVERLAP_VALIDATION_ERROR,
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

    this.lastTickTime = currentTime;

    // Check for video end
    if (currentTime >= this.videoEndsAt && !this.hasEnded) {
      this.hasEnded = true;
      this.handleEnded();
    }

    // Check hook triggers based on playback direction
    if (isPlayingForward) {
      this.transition(currentTime);
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
      const hook = item.getHook();
      if (
        isNonBlockingHook(hook) &&
        item.getState() !== ContentState.COMPLETED
      ) {
        item.skip();
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
      openedContentIds: [],
      activeBlockingContentId: undefined,
    };

    for (const item of this.items) {
      const contentState = item.getState();
      const hook = item.getHook();

      if (currentTime && this.isInFrame(currentTime, hook)) {
        if (isBlockingHook(hook)) {
          if (contentState === ContentState.COMPLETED) {
            state.completedTagIds.push(item.getId());
          } else if (contentState === ContentState.OPEN) {
            state.activeBlockingContentId = item.getId();
          }
        } else {
          if (contentState === ContentState.VISIBLE) {
            state.visibleAnchorIds.push(item.getId());
          }
          if (contentState === ContentState.OPEN) {
            state.openedContentIds.push(item.getId());
          }

          if (contentState === ContentState.COMPLETED) {
            state.completedTagIds.push(item.getId());
          }
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
      const hook = item.getHook();
      if (!isBlockingHook(hook)) {
        continue;
      }

      const contentState = item.getState();
      if (contentState === "completed") {
        continue; // Skip completed content
      }

      const timestamp = hook.timestamp;
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
  private transition(currentTime: number): void {
    for (const item of this.items) {
      const hook = item.getHook();
      const state = item.getState();

      if (state === ContentState.PENDING || state === ContentState.SKIPPED) {
        if (this.isInFrame(currentTime, hook)) {
          // PENDING, SKIPPED -> OPEN
          if (isBlockingHook(hook)) {
            item.open();
            this.emit("requestPause", {});
          } else {
            // PENDING, SKIPPED -> VISIBLE (and possibly OPEN if revealBehavior is immediate)
            item.visible();
            if (hook.revealBehavior === "immediate") {
              item.open();
            }
          }
        }
      } else if (
        state === ContentState.VISIBLE ||
        state === ContentState.OPEN
      ) {
        if (isNonBlockingHook(hook) && !this.isInFrame(currentTime, hook)) {
          // VISIBLE, OPEN -> SKIPPED
          item.skip();
        }
      }
    }
  }

  /**
   * Check if a hook is currently in-frame based on the current time.
   */
  private isInFrame(currentTime: number, hook: Hook): boolean {
    if (isBlockingHook(hook)) {
      return Math.abs(currentTime - hook.timestamp) < 0.016;
    } else {
      return currentTime >= hook.start && currentTime < hook.end;
    }
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
      const maxScore = item.getMaximumScore();

      if (!maxScore) {
        continue;
      }

      denominator += maxScore;

      if (item.getState() === "completed") {
        const score = item.getResultScore();
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
