import { describe, expect, it } from "vitest";
import { ensureInterlaceStyles, themeToCssVariables } from "./theme";
import { COLORS, RADIUS } from "./tokens";

describe("theme", () => {
  it("maps theme fields to CSS variables and skips unset ones", () => {
    expect(
      themeToCssVariables({
        accentColor: "#6f42c1",
        radius: 0,
        fontFamily: "Inter",
      }),
    ).toEqual({
      "--interlace-accent": "#6f42c1",
      "--interlace-radius": "0px",
      "--interlace-font-body": "Inter",
    });
    expect(themeToCssVariables(undefined)).toEqual({});
  });

  it("exposes tokens as CSS variables with defaults", () => {
    expect(COLORS.accent).toBe("var(--interlace-accent, #0066cc)");
    expect(RADIUS.md).toBe("var(--interlace-radius, 8px)");
  });

  it("injects the shared stylesheet once", () => {
    const nodes: { id: string; textContent: string }[] = [];
    const doc = {
      getElementById: (id: string) => nodes.find((n) => n.id === id) ?? null,
      createElement: () => ({ id: "", textContent: "" }),
      head: {
        firstChild: null,
        insertBefore: (node: { id: string; textContent: string }) =>
          nodes.push(node),
      },
    } as unknown as Document;

    ensureInterlaceStyles(doc);
    ensureInterlaceStyles(doc);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.textContent).toContain(".interlace-btn");
  });

  it("does nothing without a document", () => {
    expect(() => ensureInterlaceStyles()).not.toThrow();
  });
});
