import {
  DEFAULT_STRINGS,
  type Placement,
  type Strings,
} from "@interlacejs/core";
import React, { useCallback, useRef } from "react";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "../tokens";
import { ContentTypePicker } from "./content-type-picker";
import { PlacementInputs } from "./placement-editor";

/**
 * Localized strings consumed by `InspectorPanel`. Extends the core
 * `Strings` so a host passing a single translation table covers every
 * editor surface.
 */
export interface InspectorPanelStrings extends Strings {
  /** Heading for the panel. */
  inspectorHeading: string;
  /** Label above the title input. */
  titleLabel: string;
  /** Label for the delete button. */
  deleteLabel: string;
  /** Label for the read-only hook-type row. */
  hookTypeLabel: string;
  /** Rendered value for a blocking hook's type row. */
  blockingTypeLabel: string;
  /** Rendered value for a non-blocking hook's type row. */
  nonBlockingTypeLabel: string;
  /** Label above the blocking hook's timestamp input. */
  timestampLabel: string;
  /** Label above a non-blocking hook's start input. */
  startLabel: string;
  /** Label above a non-blocking hook's end input. */
  endLabel: string;
  /** Label above the placement inputs. */
  placementLabel: string;
  /** Label above the content type row. */
  contentTypeLabel: string;
}

export const DEFAULT_INSPECTOR_PANEL_STRINGS: InspectorPanelStrings = {
  ...DEFAULT_STRINGS,
  inspectorHeading: "Hook details",
  titleLabel: "Title",
  deleteLabel: "Delete",
  hookTypeLabel: "Type",
  blockingTypeLabel: "Blocking",
  nonBlockingTypeLabel: "Non-blocking",
  timestampLabel: "Timestamp (s)",
  startLabel: "Start (s)",
  endLabel: "End (s)",
  placementLabel: "Placement",
  contentTypeLabel: "Content type",
};

export interface InspectorPanelEntry {
  id: string;
  title: string;
  hookType: "blocking" | "non-blocking";
  /** Anchor time for a blocking hook (seconds). */
  timestamp?: number;
  /** Range start for a non-blocking hook (seconds). */
  start?: number;
  /** Range end for a non-blocking hook (seconds). */
  end?: number;
  /** Total video duration (bounds for the time inputs). */
  videoDuration: number;
  /**
   * The hook's resolved content type id, or `null` while the hook is
   * pending (newly created, content type not yet chosen).
   */
  contentTypeId: string | null;
  /** Registered content type ids (drives the picker for pending hooks). */
  registeredTypes: string[];
}

export interface InspectorPanelProps {
  entry: InspectorPanelEntry;
  onTitleChange: (title: string) => void;
  onTimeChange: (updates: {
    timestamp?: number;
    start?: number;
    end?: number;
  }) => void;
  /** Called when a pending hook's content type is chosen (materializes it). */
  onContentTypeSelect: (contentTypeId: string) => void;
  placement?: Placement;
  onPlacementChange?: (placement: Placement) => void;
  onDelete: () => void;
  strings?: Partial<InspectorPanelStrings>;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "70px",
  padding: `${SPACE[1]}px ${SPACE[2]}px`,
  border: `1px solid ${COLORS.borderStrong}`,
  borderRadius: RADIUS.sm,
  fontSize: TYPE.sm,
  color: COLORS.text,
};

/**
 * InspectorPanel - the "Hook details" panel for the currently selected
 * hook. Shows the title input, the read-only hook type, editable
 * time/timespan inputs, the manual placement inputs, the content type
 * (a picker for pending hooks; read-only for hooks that already have
 * one — switching an existing hook's type would discard its authored
 * data), and the delete action.
 *
 * The content *editing* surface itself lives in the inline
 * `ContentTypeEditor`, rendered by `InterlaceEditor` directly under
 * this panel when the hook has a content type.
 */
export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  entry,
  onTitleChange,
  onTimeChange,
  onContentTypeSelect,
  placement,
  onPlacementChange,
  onDelete,
  strings: stringsOverride,
}) => {
  const strings = { ...DEFAULT_INSPECTOR_PANEL_STRINGS, ...stringsOverride };
  // Latest props for the handlers (stable callbacks, render-time sync —
  // the PlacementEditor pattern).
  const onChangeRef = useRef(onTitleChange);
  onChangeRef.current = onTitleChange;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Delete via keyboard, mirroring the button affordance. The
      // inputs handle their own keys; this only fires when the panel
      // (not an input) has focus.
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        e.preventDefault();
        onDeleteRef.current();
      }
    },
    [],
  );

  const isBlocking = entry.hookType === "blocking";

  return (
    <div
      className="inspector-panel"
      data-testid="inspector-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.surfaceRaised,
        padding: SPACE[3],
        display: "flex",
        flexDirection: "column",
        gap: SPACE[2],
        fontSize: TYPE.sm,
      }}
    >
      <h4
        style={{
          margin: 0,
          fontFamily: FONTS.display,
          fontSize: TYPE.md,
          fontWeight: 600,
          color: COLORS.text,
        }}
      >
        {strings.inspectorHeading}
      </h4>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {strings.titleLabel}
        <input
          type="text"
          data-testid="inspector-panel-title"
          value={entry.title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label={strings.titleLabel}
          style={{
            padding: `${SPACE[2]}px ${SPACE[2]}px`,
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: RADIUS.sm,
            fontSize: TYPE.sm,
            color: COLORS.text,
          }}
        />
      </label>
      <div style={{ display: "flex", gap: 16, color: COLORS.textMuted }}>
        <span>
          {strings.hookTypeLabel}:{" "}
          <strong data-testid="inspector-panel-type">
            {isBlocking ? strings.blockingTypeLabel : strings.nonBlockingTypeLabel}
          </strong>
        </span>
      </div>

      {/* Time / timespan inputs (clamped by the parent's onTimeChange) */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        {isBlocking ? (
          <label>
            {strings.timestampLabel}
            <input
              type="number"
              data-testid="inspector-panel-timestamp"
              value={(entry.timestamp ?? 0).toFixed(1)}
              onChange={(e) =>
                onTimeChange({ timestamp: parseFloat(e.target.value) || 0 })
              }
              style={INPUT_STYLE}
            />
          </label>
        ) : (
          <>
            <label>
              {strings.startLabel}
              <input
                type="number"
                data-testid="inspector-panel-start"
                value={(entry.start ?? 0).toFixed(1)}
                onChange={(e) =>
                  onTimeChange({ start: parseFloat(e.target.value) || 0 })
                }
                style={INPUT_STYLE}
              />
            </label>
            <label>
              {strings.endLabel}
              <input
                type="number"
                data-testid="inspector-panel-end"
                value={(entry.end ?? 0).toFixed(1)}
                onChange={(e) =>
                  onTimeChange({ end: parseFloat(e.target.value) || 0 })
                }
                style={INPUT_STYLE}
              />
            </label>
          </>
        )}
      </div>

      {/* Manual placement inputs */}
      {placement && onPlacementChange ? (
        <div>
          <div
            style={{
              color: COLORS.textMuted,
              marginBottom: SPACE[1],
              fontWeight: 600,
            }}
          >
            {strings.placementLabel}
          </div>
          <PlacementInputs
            placement={placement}
            onPlacementChange={onPlacementChange}
          />
        </div>
      ) : null}

      {/* Content type: picker for pending hooks and for re-typing
          typed hooks (re-typing resets the content data to the new
          type's default shape). */}
      <div>
        <div
          style={{
            color: COLORS.textMuted,
            marginBottom: SPACE[1],
            fontWeight: 600,
          }}
        >
          {strings.contentTypeLabel}
        </div>
        <ContentTypePicker
          registeredTypes={entry.registeredTypes}
          selectedType={entry.contentTypeId ?? null}
          onSelect={onContentTypeSelect}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onDelete}
          data-testid="inspector-panel-delete"
          style={{
            padding: `${SPACE[1]}px ${SPACE[3]}px`,
            backgroundColor: COLORS.errorBg,
            border: `1px solid ${COLORS.errorBorder}`,
            borderRadius: RADIUS.sm,
            color: COLORS.errorText,
            cursor: "pointer",
            fontSize: TYPE.sm,
            fontWeight: 600,
            transition: "background-color 150ms ease",
          }}
        >
          {strings.deleteLabel}
        </button>
      </div>
    </div>
  );
};
