import { describe, expect, it } from "vitest";
import { Hook } from "./types";
import { validateHookOverlaps } from "./validation";

describe("validateHookOverlaps", () => {
  it("detects blocking-vs-blocking overlap violation", () => {
    const hooks: Hook[] = [
      {
        type: "blocking",
        timestamp: 10,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
      {
        type: "blocking",
        timestamp: 10.5,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
    ];

    const violations = validateHookOverlaps(hooks, {
      minBlockingSeparation: 1,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.type).toBe("blocking-overlap");
  });

  it("allows blocking hooks separated by minimum distance", () => {
    const hooks: Hook[] = [
      {
        type: "blocking",
        timestamp: 10,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
      {
        type: "blocking",
        timestamp: 11,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
    ];

    const violations = validateHookOverlaps(hooks, {
      minBlockingSeparation: 1,
    });
    expect(violations).toHaveLength(0);
  });

  it("detects non-blocking spatial overlap during time overlap", () => {
    const hooks: Hook[] = [
      {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 10, y: 10, width: 30, height: 30 },
        revealBehavior: "click",
      },
      {
        type: "non-blocking",
        start: 15,
        end: 25,
        placement: { x: 20, y: 20, width: 30, height: 30 },
        revealBehavior: "click",
      },
    ];

    const violations = validateHookOverlaps(hooks);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.type).toBe("nonblocking-spatial-overlap");
  });

  it("allows non-blocking hooks with spatial overlap but no time overlap", () => {
    const hooks: Hook[] = [
      {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 10, y: 10, width: 30, height: 30 },
        revealBehavior: "click",
      },
      {
        type: "non-blocking",
        start: 20,
        end: 30,
        placement: { x: 20, y: 20, width: 30, height: 30 },
        revealBehavior: "click",
      },
    ];

    const violations = validateHookOverlaps(hooks);
    expect(violations).toHaveLength(0);
  });

  it("allows non-blocking hooks with time overlap but no spatial overlap", () => {
    const hooks: Hook[] = [
      {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 0, y: 0, width: 30, height: 30 },
        revealBehavior: "click",
      },
      {
        type: "non-blocking",
        start: 15,
        end: 25,
        placement: { x: 70, y: 70, width: 30, height: 30 },
        revealBehavior: "click",
      },
    ];

    const violations = validateHookOverlaps(hooks);
    expect(violations).toHaveLength(0);
  });

  it("allows blocking and non-blocking hooks to overlap", () => {
    const hooks: Hook[] = [
      {
        type: "blocking",
        timestamp: 15,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
      {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    ];

    const violations = validateHookOverlaps(hooks);
    expect(violations).toHaveLength(0);
  });
});
