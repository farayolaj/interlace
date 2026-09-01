import { describe, expect, it } from "vitest";
import { ContentType, ContentTypeRegistry } from "./types";

describe("ContentTypeRegistry", () => {
  it("registers and retrieves a content type", () => {
    const registry = new ContentTypeRegistry();
    const contentType = {
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {},
    } satisfies ContentType;

    registry.register(contentType);
    expect(registry.get("quiz")).toBe(contentType);
  });

  it("throws on duplicate registration", () => {
    const registry = new ContentTypeRegistry();
    const contentType = {
      getId: () => "quiz",
      getVersion: () => 1,
      renderEditor: () => {},
      renderPlayback: () => {},
      getMaximumScore: () => 100,
    } satisfies ContentType;

    registry.register(contentType);
    expect(() => registry.register(contentType)).toThrow(
      'Content type with id "quiz" is already registered',
    );
  });

  it("returns undefined for unregistered type", () => {
    const registry = new ContentTypeRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("checks existence with has()", () => {
    const registry = new ContentTypeRegistry();
    const contentType = {
      getId: () => "quiz",
      getVersion: () => 1,
      renderEditor: () => {},
      renderPlayback: () => {},
      getMaximumScore: () => 100,
    } satisfies ContentType;

    expect(registry.has("quiz")).toBe(false);
    registry.register(contentType);
    expect(registry.has("quiz")).toBe(true);
  });

  it("returns all registered types", () => {
    const registry = new ContentTypeRegistry();
    const ct1 = {
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {},
    } satisfies ContentType;
    const ct2 = {
      getId: () => "poll",
      getVersion: () => 1,
      getMaximumScore: () => undefined,
      renderEditor: () => {},
      renderPlayback: () => {},
    } satisfies ContentType;

    registry.register(ct1);
    registry.register(ct2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(ct1);
    expect(all).toContainEqual(ct2);
  });
});
