import { describe, expect, it } from "vitest";
import { PreloadScheduler } from "./preload-scheduler";

describe("PreloadScheduler", () => {
  it("returns content IDs for preload queue", () => {
    const scheduler = new PreloadScheduler(2000);

    const items = [
      {
        content: { getId: () => "c1" },
        hook: { type: "non-blocking", start: 11, end: 15 },
      },
      {
        content: { getId: () => "c2" },
        hook: { type: "blocking", timestamp: 12 },
      },
      {
        content: { getId: () => "c3" },
        hook: { type: "non-blocking", start: 5, end: 8 },
      },
    ];

    const queue = scheduler.getPreloadQueue(10, items);

    // Lead time is 2000ms = 2s, so cutoff is 12s
    // Should include c1 (starts at 11, within lead time from 10)
    // Should include c2 (timestamp 12, within lead time)
    // Should not include c3 (already passed at 5)
    expect(queue).toContain("c1");
    expect(queue).toContain("c2");
    expect(queue).not.toContain("c3");
  });

  it("respects lead time window", () => {
    const scheduler = new PreloadScheduler(1000);

    const items = [
      {
        content: { getId: () => "far" },
        hook: { type: "non-blocking", start: 15, end: 18 },
      },
      {
        content: { getId: () => "close" },
        hook: { type: "non-blocking", start: 11, end: 14 },
      },
    ];

    const queue = scheduler.getPreloadQueue(10, items);

    // Lead time is 1000ms = 1s, so cutoff is 11s
    expect(queue).toContain("close");
    expect(queue).not.toContain("far");
  });

  it("clears scheduled preloads", () => {
    const scheduler = new PreloadScheduler(2000);
    scheduler.clear();
    // Should not throw
    expect(true).toBe(true);
  });

  it("updates lead time", () => {
    const scheduler = new PreloadScheduler(2000);
    scheduler.setLeadTime(5000);

    const items = [
      {
        content: { getId: () => "c1" },
        hook: { type: "non-blocking", start: 15, end: 18 },
      },
    ];

    const queue = scheduler.getPreloadQueue(10, items);

    // With 5s lead time, cutoff is 15s, so c1 should be included
    expect(queue).toContain("c1");
  });
});
