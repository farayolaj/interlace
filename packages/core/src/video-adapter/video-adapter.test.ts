import { describe, expect, it } from "vitest";
import { ProgrammaticActionGuard } from "./types";

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
