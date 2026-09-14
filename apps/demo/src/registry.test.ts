import { describe, expect, it } from "vitest";
import { registry } from "./registry";

describe("demo registry", () => {
  it("registers the quiz content type under the editor authoring id", () => {
    expect(registry.has("quiz-editor")).toBe(true);
    expect(registry.get("quiz-editor")?.getId()).toBe("quiz-editor");
  });
});