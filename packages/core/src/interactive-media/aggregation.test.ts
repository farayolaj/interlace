import { describe, expect, it } from "vitest";
import { ContentInstance } from "../content/content-instance";
import { computeAggregatedResult } from "./aggregation";

describe("computeAggregatedResult", () => {
  const createInstance = (
    id: string,
    isScorable: boolean,
    totalScore: number,
    state: string,
    resultScore?: number,
  ): ContentInstance => {
    const record = {
      id,
      title: `Content ${id}`,
      contentTypeId: "test",
      data: {},
      state: state as any,
      resultScore,
      locked: false,
    };

    const contentType = {
      id: "test",
      version: 1,
      isScorable,
      getTotalScore: () => totalScore,
      getResultScore: () => resultScore ?? 0,
    };

    const instance = new ContentInstance(record, contentType);
    // Override state to match desired state
    instance["record"].state = state as any;
    return instance;
  };

  it("sums completed scorable content", () => {
    const instances = [
      createInstance("c1", true, 100, "completed", 75),
      createInstance("c2", true, 100, "completed", 85),
    ];

    const result = computeAggregatedResult(instances);
    expect(result.numerator).toBe(160);
    expect(result.denominator).toBe(200);
    expect(result.percentage).toBe(80);
  });

  it("excludes non-scorable content entirely", () => {
    const instances = [
      createInstance("c1", true, 100, "completed", 75),
      createInstance("c2", false, 100, "completed", 100), // Should be ignored
    ];

    const result = computeAggregatedResult(instances);
    expect(result.numerator).toBe(75);
    expect(result.denominator).toBe(100);
    expect(result.percentage).toBe(75);
  });

  it("counts skipped scorable content in denominator only", () => {
    const instances = [
      createInstance("c1", true, 100, "completed", 75),
      createInstance("c2", true, 100, "skipped"), // 0 to numerator, 100 to denominator
    ];

    const result = computeAggregatedResult(instances);
    expect(result.numerator).toBe(75);
    expect(result.denominator).toBe(200);
    expect(result.percentage).toBe(37.5);
  });

  it("returns undefined percentage when denominator is 0", () => {
    const instances: ContentInstance[] = [];

    const result = computeAggregatedResult(instances);
    expect(result.numerator).toBe(0);
    expect(result.denominator).toBe(0);
    expect(result.percentage).toBeUndefined();
  });

  it("handles mix of completed, skipped, and non-scorable", () => {
    const instances = [
      createInstance("c1", true, 100, "completed", 80),
      createInstance("c2", true, 100, "skipped"),
      createInstance("c3", false, 100, "completed", 100),
      createInstance("c4", true, 50, "completed", 50),
    ];

    const result = computeAggregatedResult(instances);
    expect(result.numerator).toBe(130); // 80 + 0 (skipped) + 50
    expect(result.denominator).toBe(250); // 100 + 100 (skipped) + 50
    expect(result.percentage).toBe(52);
  });
});
