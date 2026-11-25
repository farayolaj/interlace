import {
  DEFAULT_STRINGS,
  type Placement,
  type Strings,
} from "@interlacejs/core";
import React, { useCallback, useRef, useState } from "react";
import { COLORS, RADIUS, SPACE, TYPE } from "../tokens";
import {
  type ContentTypeOption,
  ContentTypePicker,
} from "./content-type-picker";
import { PlacementInputs } from "./placement-editor";
import {
  Button,
  Field,
  IssueList,
  SectionHeading,
  useInterlaceStyles,
} from "./ui";

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
  /** Placeholder for the title input. */
  titlePlaceholder: string;
  /** Help text under the title input. */
  titleHint: string;
  /** Description of the blocking type, shown in the type switch. */
  blockingTypeDescription: string;
  /** Description of the non-blocking type, shown in the type switch. */
  nonBlockingTypeDescription: string;
  /** Help text under the position & size inputs. */
  placementHint: string;
  /** Button that reveals the content type choices for a typed hook. */
  changeContentTypeLabel: string;
  /** Warning shown while changing an existing hook's content type. */
  changeContentTypeWarning: string;
  /** Button that cancels changing the content type. */
  cancelChangeContentTypeLabel: string;
  /** Heading for the list of problems with this hook. */
  issuesHeading: string;
}

export const DEFAULT_INSPECTOR_PANEL_STRINGS: InspectorPanelStrings = {
  ...DEFAULT_STRINGS,
  inspectorHeading: "Hook details",
  titleLabel: "Title",
  deleteLabel: "Delete",
  hookTypeLabel: "Type",
  blockingTypeLabel: "Blocking",
  nonBlockingTypeLabel: "Non-blocking",
  timestampLabel: "Pauses at (seconds)",
  startLabel: "Starts at (seconds)",
  endLabel: "Ends at (seconds)",
  placementLabel: "Position & size (%)",
  contentTypeLabel: "Content type",
  titlePlaceholder: "e.g. Check your understanding",
  titleHint: "Students see this above the content.",
  blockingTypeDescription: "Pauses the video until answered",
  nonBlockingTypeDescription: "Floats over the video for a time range",
  placementHint: "Drag the box on the video, or type exact values.",
  changeContentTypeLabel: "Change type",
  changeContentTypeWarning:
    "Choosing a different type clears this hook's content.",
  cancelChangeContentTypeLabel: "Keep current type",
  issuesHeading: "This hook needs attention",
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
  /** Readable names/descriptions for the picker; ids are used when omitted. */
  contentTypeOptions?: ContentTypeOption[];
  /** Problems to fix before this hook can be saved. */
  issues?: string[];
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
  /**
   * Switches between blocking and non-blocking. When omitted the type is
   * shown read-only.
   */
  onHookTypeChange?: (hookType: "blocking" | "non-blocking") => void;
  strings?: Partial<InspectorPanelStrings>;
}

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
  onHookTypeChange,
  strings: stringsOverride,
}) => {
  useInterlaceStyles();
  const [changingType, setChangingType] = useState(false);
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
  const issues = entry.issues ?? [];
  const showPicker = entry.contentTypeId === null || changingType;
  const selectedOption = entry.contentTypeOptions?.find(
    (option) => option.id === entry.contentTypeId,
  );
  const timeInput = (
    testId: string,
    value: number | undefined,
    key: "timestamp" | "start" | "end",
  ) =>
    function TimeInput({
      id,
      describedBy,
    }: {
      id: string;
      describedBy: string | undefined;
    }) {
      return (
        <input
          id={id}
          type="number"
          className="interlace-input"
          inputMode="decimal"
          min={0}
          max={entry.videoDuration || undefined}
          step={0.1}
          aria-describedby={describedBy}
          data-testid={testId}
          value={(value ?? 0).toFixed(1)}
          onChange={(e) =>
            onTimeChange({ [key]: parseFloat(e.target.value) || 0 })
          }
        />
      );
    };

  return (
    <div
      className="inspector-panel"
      data-testid="inspector-panel"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE[4],
        fontSize: TYPE.sm,
        outline: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE[2],
        }}
      >
        <SectionHeading>{strings.inspectorHeading}</SectionHeading>
        <Button
          variant="danger"
          onClick={onDelete}
          data-testid="inspector-panel-delete"
        >
          {strings.deleteLabel}
        </Button>
      </div>

      {issues.length > 0 ? (
        <IssueList title={strings.issuesHeading} issues={issues} />
      ) : null}

      <Field label={strings.titleLabel} hint={strings.titleHint}>
        {({ id, describedBy }) => (
          <input
            id={id}
            type="text"
            className="interlace-input"
            data-testid="inspector-panel-title"
            value={entry.title}
            placeholder={strings.titlePlaceholder}
            aria-describedby={describedBy}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        )}
      </Field>

      <div className="interlace-field">
        <span className="interlace-label" id={`${entry.id}-type-label`}>
          {strings.hookTypeLabel}
        </span>
        {onHookTypeChange ? (
          <div
            role="radiogroup"
            aria-labelledby={`${entry.id}-type-label`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: SPACE[2],
            }}
          >
            {(
              [
                [
                  "blocking",
                  strings.blockingTypeLabel,
                  strings.blockingTypeDescription,
                ],
                [
                  "non-blocking",
                  strings.nonBlockingTypeLabel,
                  strings.nonBlockingTypeDescription,
                ],
              ] as const
            ).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={entry.hookType === value}
                className="interlace-choice interlace-focusable"
                data-testid={`inspector-panel-type-${value}`}
                onClick={() => {
                  if (entry.hookType !== value) onHookTypeChange(value);
                }}
                style={{ flexDirection: "column", gap: 2 }}
              >
                <strong style={{ fontSize: TYPE.sm }}>{label}</strong>
                <span style={{ fontSize: TYPE.sm, color: COLORS.textMuted }}>
                  {description}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <span
          data-testid="inspector-panel-type"
          style={
            onHookTypeChange
              ? {
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0 0 0 0)",
                }
              : { fontWeight: 600 }
          }
        >
          {isBlocking
            ? strings.blockingTypeLabel
            : strings.nonBlockingTypeLabel}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: SPACE[3],
        }}
      >
        {isBlocking ? (
          <Field label={strings.timestampLabel}>
            {timeInput(
              "inspector-panel-timestamp",
              entry.timestamp,
              "timestamp",
            )}
          </Field>
        ) : (
          <>
            <Field label={strings.startLabel}>
              {timeInput("inspector-panel-start", entry.start, "start")}
            </Field>
            <Field label={strings.endLabel}>
              {timeInput("inspector-panel-end", entry.end, "end")}
            </Field>
          </>
        )}
      </div>

      {placement && onPlacementChange ? (
        <div
          className="interlace-field"
          role="group"
          aria-label={strings.placementLabel}
        >
          <span className="interlace-label">{strings.placementLabel}</span>
          <PlacementInputs
            placement={placement}
            onPlacementChange={onPlacementChange}
          />
          <p className="interlace-hint">{strings.placementHint}</p>
        </div>
      ) : null}

      <div className="interlace-field">
        <span className="interlace-label">{strings.contentTypeLabel}</span>
        {showPicker ? (
          <>
            {changingType ? (
              <p
                className="interlace-hint"
                style={{ color: COLORS.warningText }}
              >
                {strings.changeContentTypeWarning}
              </p>
            ) : null}
            <ContentTypePicker
              registeredTypes={entry.registeredTypes}
              options={entry.contentTypeOptions}
              selectedType={entry.contentTypeId ?? null}
              label={strings.contentTypeLabel}
              onSelect={(typeId) => {
                setChangingType(false);
                if (typeId !== entry.contentTypeId) onContentTypeSelect(typeId);
              }}
            />
            {changingType ? (
              <div>
                <Button variant="ghost" onClick={() => setChangingType(false)}>
                  {strings.cancelChangeContentTypeLabel}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE[2],
              padding: `${SPACE[2]}px ${SPACE[3]}px`,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              background: COLORS.surface,
            }}
          >
            <span style={{ display: "grid", gap: 2 }}>
              <strong data-testid="inspector-panel-content-type">
                {selectedOption?.label ?? entry.contentTypeId}
              </strong>
              {selectedOption?.description ? (
                <span style={{ color: COLORS.textMuted }}>
                  {selectedOption.description}
                </span>
              ) : null}
            </span>
            <Button
              variant="ghost"
              onClick={() => setChangingType(true)}
              data-testid="inspector-panel-change-type"
            >
              {strings.changeContentTypeLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
