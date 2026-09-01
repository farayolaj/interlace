import React from "react";
import { TimelineEntry } from "./timeline-entry";

export interface TimelineProps {
  entries: any[];
  selectedId?: string;
  onSelectEntry: (id: string) => void;
  onUpdateEntry: (id: string, updates: any) => void;
  onDeleteEntry: (id: string) => void;
  onAddEntry: (hookType: "blocking" | "non-blocking") => void;
}

/**
 * Timeline - main UI for managing all interactive content items.
 * Shows list of hooks and provides controls for CRUD operations.
 */
export const Timeline: React.FC<TimelineProps> = ({
  entries,
  selectedId,
  onSelectEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddEntry,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 12px 0" }}>Interactive Content</h3>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            onClick={() => onAddEntry("blocking")}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4CAF50",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            + Blocking Hook
          </button>
          <button
            onClick={() => onAddEntry("non-blocking")}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2196F3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            + Non-blocking Hook
          </button>
        </div>

        <div
          style={{
            maxHeight: "400px",
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: "4px",
            padding: "8px",
            backgroundColor: "#fafafa",
          }}
        >
          {entries.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center", margin: "16px 0" }}>
              No hooks added yet. Create one to get started!
            </p>
          ) : (
            entries.map((entry) => (
              <TimelineEntry
                key={entry.id}
                id={entry.id}
                title={entry.title}
                hookType={entry.hookType}
                timestamp={entry.timestamp}
                start={entry.start}
                end={entry.end}
                isSelected={selectedId === entry.id}
                onSelect={() => onSelectEntry(entry.id)}
                onUpdate={(updates) => onUpdateEntry(entry.id, updates)}
                onDelete={() => onDeleteEntry(entry.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
