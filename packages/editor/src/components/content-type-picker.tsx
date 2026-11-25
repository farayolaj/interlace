import React, { useRef } from "react";
import { COLORS, FONTS, SPACE, TYPE } from "../tokens";
import { useInterlaceStyles } from "./ui";

/** A content type as shown to authors. */
export interface ContentTypeOption {
  id: string;
  /** Readable name; falls back to the id. */
  label?: string;
  /** One-line description shown under the name. */
  description?: string;
}

export interface ContentTypePickerProps {
  /** Registered content type ids (used when `options` is omitted). */
  registeredTypes: string[];
  /** Named options; takes precedence over `registeredTypes`. */
  options?: ContentTypeOption[];
  selectedType: string | null;
  onSelect: (typeId: string) => void;
  /** Accessible name for the group. */
  label?: string;
}

/**
 * ContentTypePicker - a radio group of content types, each shown with
 * its readable name and description. Arrow keys move between choices.
 */
export const ContentTypePicker: React.FC<ContentTypePickerProps> = ({
  registeredTypes,
  options,
  selectedType,
  onSelect,
  label = "Content type",
}) => {
  useInterlaceStyles();
  const items: ContentTypeOption[] =
    options ?? registeredTypes.map((id) => ({ id }));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = items.findIndex((item) => item.id === selectedType);

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    const delta =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + items.length) % items.length;
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid="content-type-picker"
      style={{ display: "grid", gap: SPACE[2] }}
    >
      {items.map((item, index) => {
        const checked = item.id === selectedType;
        // Roving tab stop: the selected choice (or the first) is tabbable.
        const tabbable = checked || (selectedIndex === -1 && index === 0);
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={tabbable ? 0 : -1}
            className="interlace-choice interlace-focusable"
            data-testid={`content-type-option-${item.id}`}
            onClick={() => onSelect(item.id)}
            onKeyDown={handleKeyDown(index)}
          >
            <span
              aria-hidden="true"
              style={{
                flex: "none",
                width: 16,
                height: 16,
                marginTop: 2,
                borderRadius: "50%",
                boxSizing: "border-box",
                border: `2px solid ${checked ? COLORS.accent : COLORS.borderStrong}`,
                boxShadow: checked
                  ? `inset 0 0 0 3px ${COLORS.surface}`
                  : "none",
                background: checked ? COLORS.accent : COLORS.surface,
              }}
            />
            <span style={{ display: "grid", gap: 2 }}>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: TYPE.base - 1,
                  fontWeight: 600,
                }}
              >
                {item.label ?? item.id}
              </span>
              {item.description ? (
                <span style={{ fontSize: TYPE.sm, color: COLORS.textMuted }}>
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
};
