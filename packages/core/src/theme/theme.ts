import { CONTROL_HEIGHT, COLORS, FONTS, RADIUS, TYPE } from "./tokens";

/**
 * Theme overrides accepted by Interlace UI components (`theme` prop).
 * Every field maps to a `--interlace-*` CSS custom property, so the same
 * look can be set from CSS instead, e.g. `:root { --interlace-accent: #6f42c1 }`.
 */
export interface InterlaceTheme {
  /** Primary actions, selection and focus. `--interlace-accent` */
  accentColor?: string;
  /** Hover state of accent buttons (derived from the accent when unset). `--interlace-accent-hover` */
  accentHoverColor?: string;
  /** Text drawn on the accent colour. `--interlace-accent-contrast` */
  accentContrastColor?: string;
  /** Main surface (component background). `--interlace-surface` */
  backgroundColor?: string;
  /** Raised/inset surfaces such as panels and the timeline. `--interlace-surface-raised` */
  surfaceColor?: string;
  /** Hairline borders. `--interlace-border` */
  borderColor?: string;
  /** Input and button borders. `--interlace-border-strong` */
  borderStrongColor?: string;
  /** Body text. `--interlace-text` */
  textColor?: string;
  /** Secondary text and labels. `--interlace-text-muted` */
  mutedTextColor?: string;
  /** Destructive actions and errors. `--interlace-danger` */
  dangerColor?: string;
  /** Warnings such as hooks that need attention. `--interlace-warning` */
  warningColor?: string;
  /** Body font stack. `--interlace-font-body` */
  fontFamily?: string;
  /** Heading font stack. `--interlace-font-display` */
  headingFontFamily?: string;
  /** Base corner radius, e.g. `8px` or `0`. `--interlace-radius` */
  radius?: string | number;
}

const THEME_VARIABLES: Record<keyof InterlaceTheme, string> = {
  accentColor: "--interlace-accent",
  accentHoverColor: "--interlace-accent-hover",
  accentContrastColor: "--interlace-accent-contrast",
  backgroundColor: "--interlace-surface",
  surfaceColor: "--interlace-surface-raised",
  borderColor: "--interlace-border",
  borderStrongColor: "--interlace-border-strong",
  textColor: "--interlace-text",
  mutedTextColor: "--interlace-text-muted",
  dangerColor: "--interlace-danger",
  warningColor: "--interlace-warning",
  fontFamily: "--interlace-font-body",
  headingFontFamily: "--interlace-font-display",
  radius: "--interlace-radius",
};

/**
 * Converts a theme into CSS custom properties, ready to spread into a
 * root element's `style`. Unset fields are omitted so CSS-level variables
 * set by the host still apply.
 */
export function themeToCssVariables(
  theme: InterlaceTheme | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!theme) return vars;
  for (const key of Object.keys(THEME_VARIABLES) as (keyof InterlaceTheme)[]) {
    const value = theme[key];
    if (value === undefined || value === "") continue;
    vars[THEME_VARIABLES[key]] =
      key === "radius" && typeof value === "number"
        ? `${value}px`
        : String(value);
  }
  return vars;
}

const STYLE_ELEMENT_ID = "interlace-styles";

/**
 * Shared stylesheet for Interlace controls. Selectors use `:where()` (zero
 * specificity), so any host rule targeting the same `interlace-*` class
 * wins without `!important`.
 */
export const INTERLACE_STYLESHEET = `
:where(.interlace-btn){display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;min-height:${CONTROL_HEIGHT}px;padding:0 12px;border:1px solid transparent;border-radius:${RADIUS.sm};font-family:${FONTS.body};font-size:${TYPE.sm}px;font-weight:600;line-height:1.2;white-space:nowrap;cursor:pointer;text-decoration:none;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}
:where(.interlace-btn:disabled){opacity:.55;cursor:not-allowed}
:where(.interlace-btn--primary){background:${COLORS.accent};color:${COLORS.accentContrast}}
:where(.interlace-btn--primary:hover:not(:disabled)){background:${COLORS.accentHover}}
:where(.interlace-btn--secondary){background:${COLORS.surface};color:${COLORS.text};border-color:${COLORS.borderStrong}}
:where(.interlace-btn--secondary:hover:not(:disabled)){border-color:${COLORS.accent};color:${COLORS.accent}}
:where(.interlace-btn--ghost){background:transparent;color:${COLORS.textMuted}}
:where(.interlace-btn--ghost:hover:not(:disabled)){background:${COLORS.accentLighter};color:${COLORS.text}}
:where(.interlace-btn--danger){background:${COLORS.surface};color:${COLORS.errorText};border-color:${COLORS.errorBorder}}
:where(.interlace-btn--danger:hover:not(:disabled)){background:${COLORS.errorBg}}
:where(.interlace-btn--icon){padding:0;width:${CONTROL_HEIGHT}px}
:where(.interlace-btn:focus-visible,.interlace-input:focus-visible,.interlace-choice:focus-within,.interlace-focusable:focus-visible){outline:2px solid ${COLORS.accent};outline-offset:2px}
:where(.interlace-field){display:flex;flex-direction:column;gap:4px;min-width:0}
:where(.interlace-label){font-family:${FONTS.body};font-size:${TYPE.sm}px;font-weight:600;color:${COLORS.text}}
:where(.interlace-hint){font-family:${FONTS.body};font-size:${TYPE.sm}px;color:${COLORS.textMuted};margin:0}
:where(.interlace-input){box-sizing:border-box;width:100%;min-height:${CONTROL_HEIGHT + 4}px;padding:6px 10px;border:1px solid ${COLORS.borderStrong};border-radius:${RADIUS.sm};background:${COLORS.surface};color:${COLORS.text};font-family:${FONTS.body};font-size:${TYPE.base - 1}px}
:where(.interlace-input::placeholder){color:${COLORS.textMuted};opacity:.8}
:where(.interlace-input[aria-invalid="true"]){border-color:${COLORS.errorText}}
:where(.interlace-choice){display:flex;align-items:flex-start;gap:10px;box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid ${COLORS.borderStrong};border-radius:${RADIUS.md};background:${COLORS.surface};color:${COLORS.text};font-family:${FONTS.body};text-align:left;cursor:pointer}
:where(.interlace-choice:hover){border-color:${COLORS.accent}}
:where(.interlace-choice[aria-checked="true"],.interlace-choice:has(input:checked)){border-color:${COLORS.accent};background:${COLORS.accentLighter}}
:where(.interlace-badge){display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:${RADIUS.pill};font-family:${FONTS.body};font-size:${TYPE.xs}px;font-weight:600;white-space:nowrap}
:where(.interlace-badge--warning){background:${COLORS.warningBg};color:${COLORS.warningText};border:1px solid ${COLORS.warningBorder}}
:where(.interlace-badge--neutral){background:${COLORS.surfaceRaised};color:${COLORS.textMuted};border:1px solid ${COLORS.border}}
`;

/**
 * Injects {@link INTERLACE_STYLESHEET} once per document. Safe to call
 * repeatedly; a no-op outside the browser.
 */
export function ensureInterlaceStyles(doc?: Document): void {
  const target =
    doc ?? (typeof document === "undefined" ? undefined : document);
  if (!target || target.getElementById(STYLE_ELEMENT_ID)) return;
  const style = target.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = INTERLACE_STYLESHEET;
  // First in <head>: host stylesheets that come later win ties.
  target.head.insertBefore(style, target.head.firstChild);
}
