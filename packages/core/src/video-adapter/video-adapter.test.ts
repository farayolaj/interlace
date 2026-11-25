import { describe, expect, it } from "vitest";
import {
  ProgrammaticActionGuard,
  supportsQuality,
  type VideoAdapter,
} from "./types";

describe("ProgrammaticActionGuard", () => {
  it("allows ignoring marked actions", () => {
    const guard = new ProgrammaticActionGuard();

    guard.markAsTriggered("seek");
    expect(guard.shouldIgnore("seek")).toBe(true);
  });

  it("does not ignore unmarked actions", () => {
    const guard = new ProgrammaticActionGuard();

    expect(guard.shouldIgnore("seek")).toBe(false);
  });

  it("only ignores each action once", () => {
    const guard = new ProgrammaticActionGuard();

    guard.markAsTriggered("seek");
    expect(guard.shouldIgnore("seek")).toBe(true);
    expect(guard.shouldIgnore("seek")).toBe(false);
  });

  it("distinguishes between different action types", () => {
    const guard = new ProgrammaticActionGuard();

    guard.markAsTriggered("seek");
    expect(guard.shouldIgnore("pause")).toBe(false);
    expect(guard.shouldIgnore("seek")).toBe(true);
  });

  it("clears all marked actions", () => {
    const guard = new ProgrammaticActionGuard();

    guard.markAsTriggered("seek");
    guard.markAsTriggered("pause");
    guard.clear();

    expect(guard.shouldIgnore("seek")).toBe(false);
    expect(guard.shouldIgnore("pause")).toBe(false);
  });

  it("handles multiple marks of same action", () => {
    const guard = new ProgrammaticActionGuard();

    guard.markAsTriggered("seek");
    guard.markAsTriggered("seek");
    expect(guard.shouldIgnore("seek")).toBe(true);
    expect(guard.shouldIgnore("seek")).toBe(false);
  });
});

describe("supportsQuality", () => {
  const base: VideoAdapter = {
    play: () => {},
    pause: () => {},
    seek: () => {},
    getCurrentTime: () => 0,
    getDuration: () => 0,
    mountOverlay: () => {},
    on: () => () => {},
  };

  it("is false for adapters without the quality capability", () => {
    expect(supportsQuality(base)).toBe(false);
  });

  it("is false when only part of the capability is implemented", () => {
    expect(
      supportsQuality({ ...base, getQualityLevels: () => [] } as VideoAdapter),
    ).toBe(false);
  });

  it("is true for adapters implementing every quality method", () => {
    const adapter = {
      ...base,
      getQualityLevels: () => [],
      getQualityLevel: () => -1,
      getActiveQualityLevel: () => null,
      setQualityLevel: () => {},
    };
    expect(supportsQuality(adapter)).toBe(true);
  });
});
