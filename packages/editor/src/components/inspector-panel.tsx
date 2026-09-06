import { DEFAULT_STRINGS, type Strings } from "@interlace/core";
import React, { useCallback, useRef } from "react";

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
}

export const DEFAULT_INSPECTOR_PANEL_STRINGS: InspectorPanelStrings = {
  ...DEFAULT_STRINGS,
  inspectorHeading: "Hook details",
  titleLabel: "Title",
  deleteLabel: "Delete",
  hookTypeLabel: "Type",
  blockingTypeLabel: "Blocking",
  nonBlockingTypeLabel: "Non-blocking",
};

export interface InspectorPanelEntry {
  id: string;
  title: string;
  hookType: "blocking" | "non-blocking";
  /** Human-readable time description, e.g. "blocking at 12s". */
  timeLabel: string;
}

export interface InspectorPanelProps {
  entry: InspectorPanelEntry;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
  strings?: Partial<InspectorPanelStrings>;
}

/**
 * InspectorPanel - the structured editor for the currently selected
 * hook. Shows the title input, a read-only type row, the hook's anchor
 * time, and the delete action. Content editing lives in the
 * `ContentTypeEditorSlot` (opened on selection); the timeline position
 * is edited directly on the `KeyframeTimeline` strip.
 */
export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  entry,
  onTitleChange,
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
      // Delete via keyboard, mirroring the button affordance. The input
      // itself handles its own keys; this only fires when the panel
      // (not the input) has focus.
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        e.preventDefault();
        onDeleteRef.current();
      }
    },
    [],
  );

  return (
    <div
      className="inspector-panel"
      data-testid="inspector-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        backgroundColor: "#fafafa",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 13,
      }}
    >
      <h4 style={{ margin: 0, fontSize: 14 }}>{strings.inspectorHeading}</h4>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {strings.titleLabel}
        <input
          type="text"
          data-testid="inspector-panel-title"
          value={entry.title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label={strings.titleLabel}
          style={{
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 13,
          }}
        />
      </label>
      <div style={{ display: "flex", gap: 16, color: "#556" }}>
        <span>
          {strings.hookTypeLabel}:{" "}
          <strong data-testid="inspector-panel-type">
            {entry.hookType === "blocking"
              ? strings.blockingTypeLabel
              : strings.nonBlockingTypeLabel}
          </strong>
        </span>
        <span data-testid="inspector-panel-time">{entry.timeLabel}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onDelete}
          data-testid="inspector-panel-delete"
          style={{
            padding: "4px 12px",
            backgroundColor: "#fee",
            border: "1px solid #c33",
            borderRadius: 4,
            color: "#c33",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {strings.deleteLabel}
        </button>
      </div>
    </div>
  );
};
