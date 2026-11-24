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

    const previousTime = this.lastTickTime;
    this.lastTickTime = currentTime;

    // A forward jump past unfinished blocking content (a seek, a scrub while
    // paused, or a dropped frame) must not skip it. Checked here rather than
    // only in handleUserSeek because a tick can observe the new time before
    // the adapter's seek event arrives. The first tick only sets the baseline,
    // so a host that seeks before ticking starts (e.g. resume) is not snapped.
    if (
      previousTime >= 0 &&
      currentTime > previousTime &&
      this.snapBackToBlocking(previousTime, currentTime)
    ) {
      return;
    }

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
    // tick() snaps forward jumps back to unfinished blocking content.
    this.tick(targetTime, targetTime > this.lastTickTime);
  }

  /**
   * Move the playhead baseline without enforcing hooks, for programmatic
   * jumps such as resuming from a saved position. The player calls this on
   * the adapter's "programmaticSeek" event, so hosts using adapter.seek()
   * never need to call it themselves.
   */
  setPosition(timeInSeconds: number): void {
    this.lastTickTime = Math.max(0, Math.min(timeInSeconds, this.videoEndsAt));
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
          // VISIBLE and SKIPPED non-blocking items stay anchored for their
          // whole in-frame window: a skipped hook (out-of-frame auto-skip
          // from an earlier open) remains actionable inside its window and
          // can be re-taken (the anchor-click open path accepts SKIPPED).
          if (
            contentState === ContentState.VISIBLE ||
            contentState === ContentState.SKIPPED
          ) {
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
   * If unfinished blocking content lies in (fromTime, toTime] and toTime is
   * past its frame, open it, pause, and seek back to it. Returns whether it
   * snapped back.
   */
  private snapBackToBlocking(fromTime: number, toTime: number): boolean {
    const timestamp = this.findEarliestUnfinishedBlockingTime(fromTime, toTime);
    if (timestamp === undefined || Math.abs(toTime - timestamp) < 0.016) {
      return false; // Nothing crossed, or still in frame: transition() handles it
    }

    for (const item of this.items) {
      const hook = item.getHook();
      if (
        isBlockingHook(hook) &&
        hook.timestamp === timestamp &&
        item.getState() !== ContentState.COMPLETED
      ) {
        item.open(); // No-op if already open (dismissed without completing)
      }
    }

    this.lastTickTime = timestamp;
    this.emit("requestPause", {});
    this.emit("requestSeek", { timeInSeconds: timestamp });
    return true;
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
