/**
 * PreloadScheduler manages content preloading with lead time.
 * Requests preload before content is encountered, with interrupt handling on seek.
 */
export class PreloadScheduler {
  private leadTimeMs: number;
  private scheduledPreloads = new Map<string, number>();

  constructor(leadTimeMs: number = 2000) {
    this.leadTimeMs = leadTimeMs;
  }

  /**
   * Get content IDs that should be preloaded at the current time.
   */
  getPreloadQueue(currentTime: number, items: any[]): string[] {
    const queue: string[] = [];
    const cutoffTime = currentTime + this.leadTimeMs / 1000;

    for (const item of items) {
      const contentId = item.content.getId();
      const hook = item.hook;

      // Non-blocking hooks: preload if start is within lead time
      if (hook.type === "non-blocking") {
        if (hook.start <= cutoffTime && hook.start > currentTime) {
          queue.push(contentId);
        }
      }

      // Blocking hooks: preload if timestamp is within lead time
      if (hook.type === "blocking") {
        if (hook.timestamp <= cutoffTime && hook.timestamp > currentTime) {
          queue.push(contentId);
        }
      }
    }

    return queue;
  }

  /**
   * Clear all scheduled preloads (e.g., on seek).
   */
  clear(): void {
    this.scheduledPreloads.clear();
  }

  /**
   * Set lead time in milliseconds.
   */
  setLeadTime(ms: number): void {
    this.leadTimeMs = ms;
  }
}
