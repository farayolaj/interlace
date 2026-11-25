import { ensureInterlaceStyles } from "@interlacejs/core";
import React, { useEffect, useId } from "react";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "../tokens";

/**
 * Small styled primitives shared by the editor's surfaces. Visuals come
 * from the shared `interlace-*` classes (see `ensureInterlaceStyles` in
 * core), so hosts restyle them with CSS variables or their own class rules.
 */

/** Injects the shared Interlace stylesheet once per document. */
export function useInterlaceStyles(): void {
  useEffect(() => {
    ensureInterlaceStyles();
  }, []);
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Square icon-only button; pass an `aria-label`. */
  icon?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", icon = false, className, type, ...rest },
    ref,
  ) {
    useInterlaceStyles();
    const classes = [
      "interlace-btn",
      `interlace-btn--${variant}`,
      icon ? "interlace-btn--icon" : null,
      className,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <button ref={ref} type={type ?? "button"} className={classes} {...rest} />
    );
  },
);

export interface FieldProps {
  label: React.ReactNode;
  /** Help text under the control. */
  hint?: React.ReactNode;
  /** Error message; marks the control invalid. */
  error?: React.ReactNode;
  /** Render prop receiving the ids to wire into the control. */
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Label above a control, with optional hint and error text. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  style,
}: FieldProps) {
  useInterlaceStyles();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div
      className={["interlace-field", className].filter(Boolean).join(" ")}
      style={style}
    >
      <label className="interlace-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="interlace-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="interlace-hint"
          style={{ color: COLORS.errorText }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Heading for a panel or group inside the editor. */
export function SectionHeading({
  children,
  level = 3,
  style,
}: {
  children: React.ReactNode;
  level?: 3 | 4;
  style?: React.CSSProperties;
}) {
  const Tag = level === 3 ? "h3" : "h4";
  return (
    <Tag
      style={{
        margin: 0,
        fontFamily: level === 3 ? FONTS.display : FONTS.body,
        fontSize: level === 3 ? TYPE.md : TYPE.sm,
        fontWeight: 600,
        color: COLORS.text,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/** A warning callout listing problems to fix. */
export function IssueList({
  title,
  issues,
  children,
}: {
  title: React.ReactNode;
  issues: React.ReactNode[];
  children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      style={{
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.warningBorder}`,
        background: COLORS.warningBg,
        color: COLORS.warningText,
        fontFamily: FONTS.body,
        fontSize: TYPE.sm,
      }}
    >
      <strong style={{ display: "block", marginBottom: SPACE[1] }}>
        {title}
      </strong>
      <ul style={{ margin: 0, paddingLeft: SPACE[4] }}>
        {issues.map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}
