/**
 * Interlace design tokens, shared by the editor, player and quiz packages.
 *
 * Every themeable value is a CSS custom property with the default as its
 * fallback, so hosts restyle all Interlace surfaces by setting variables on
 * any ancestor (or `:root`), or by passing a `theme` prop that
 * {@link themeToCssVariables} turns into those same variables. Tokens are
 * plain strings that inline styles accept as-is.
 */

const v = (name: string, fallback: string) =>
  `var(--interlace-${name}, ${fallback})`;

const ACCENT = v("accent", "#0066cc");

/** Mixes the accent with another colour (falls back to the accent itself). */
const mixAccent = (name: string, percent: number, other: string) =>
  v(name, `color-mix(in srgb, ${ACCENT} ${percent}%, ${other})`);

export const COLORS = {
  accent: ACCENT,
  accentHover: mixAccent("accent-hover", 82, "#000"),
  /** Text and icons drawn on the accent colour. */
  accentContrast: v("accent-contrast", "#ffffff"),
  accentLight: mixAccent("accent-soft", 15, "transparent"),
  accentLighter: mixAccent("accent-softer", 8, "transparent"),
  text: v("text", "#0f172a"),
  textMuted: v("text-muted", "#64748b"),
  border: v("border", "#e2e8f0"),
  borderStrong: v("border-strong", "#cbd5e1"),
  surface: v("surface", "#ffffff"),
  surfaceRaised: v("surface-raised", "#f8fafc"),
  ground: v("ground", "#f6f7f9"),
  errorBg: v("danger-soft", "#fef2f2"),
  errorText: v("danger", "#b91c1c"),
  errorBorder: v("danger-border", "#fecaca"),
  warningBg: v("warning-soft", "#fffbeb"),
  warningText: v("warning", "#92400e"),
  warningBorder: v("warning-border", "#fcd34d"),
  /** Quiz reveal state: the correct option. */
  correctBg: ACCENT,
  correctText: v("accent-contrast", "#ffffff"),
  /** Quiz reveal state: a wrong option. */
  incorrectBg: v("danger-soft", "#fef2f2"),
  incorrectText: v("danger", "#b91c1c"),
  incorrectBorder: v("danger-border", "#fecaca"),
  white: "#ffffff",
  black: "#000000",
} as const;

export const FONTS = {
  display: v("font-display", 'Georgia, "Times New Roman", Times, serif'),
  body: v(
    "font-body",
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  ),
} as const;

export const SPACE = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
} as const;

const RADIUS_BASE = v("radius", "8px");

export const RADIUS = {
  sm: `calc(${RADIUS_BASE} / 2)`,
  md: RADIUS_BASE,
  lg: `calc(${RADIUS_BASE} * 1.5)`,
  pill: "999px",
} as const;

export const SHADOWS = {
  sm: "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
  md: "0 4px 12px -2px rgba(15, 23, 42, 0.08)",
  lg: "0 12px 32px -8px rgba(15, 23, 42, 0.18)",
} as const;

export const TYPE = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

/** Minimum height for buttons and inputs (pointer-friendly target size). */
export const CONTROL_HEIGHT = 32;

/** Focus ring drawn by interactive Interlace controls. */
export const FOCUS_RING = `0 0 0 3px ${COLORS.accentLight}`;
