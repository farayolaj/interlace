/**
 * Interlace design tokens.
 *
 * These values mirror the demo app's CSS custom properties so the library
 * surfaces feel like a single system. They are duplicated per package to
 * avoid adding runtime cross-package dependencies.
 */

export const COLORS = {
  accent: "#0066cc",
  accentHover: "#0052a3",
  accentLight: "rgba(0, 102, 204, 0.15)",
  accentLighter: "rgba(0, 102, 204, 0.08)",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  surface: "#ffffff",
  surfaceRaised: "#f8fafc",
  ground: "#f6f7f9",
  errorBg: "#fef2f2",
  errorText: "#b91c1c",
  errorBorder: "#fecaca",
  white: "#ffffff",
  black: "#000000",
} as const;

export const FONTS = {
  display: 'Georgia, "Times New Roman", Times, serif',
  body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

export const SPACE = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
} as const;

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const SHADOWS = {
  sm: "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
  md: "0 4px 12px -2px rgba(15, 23, 42, 0.08)",
} as const;

export const TYPE = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 20,
  xl: 24,
} as const;
