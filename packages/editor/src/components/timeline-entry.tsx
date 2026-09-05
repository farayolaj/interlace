import React, { useState } from "react";

export interface TimelineEntryProps {
  id: string;
  title: string;
  hookType: "blocking" | "non-blocking";
  timestamp?: number;
  start?: number;
  end?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpdate?: (entry: any) => void;
  onDelete?: () => void;
}

/**
 * TimelineEntry - editable entry in the timeline for creating/editing hooks.
 * Supports both blocking and non-blocking hook creation.
 */
export const TimelineEntry: React.FC<TimelineEntryProps> = ({
  id,
  title,
  hookType,
  timestamp,
  start,
  end,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editTime, setEditTime] = useState(
    hookType === "blocking" ? timestamp || 0 : start || 0,
  );
  const [editEnd, setEditEnd] = useState(end || 0);

  const handleSave = () => {
    if (hookType === "blocking") {
      onUpdate?.({ title: editTitle, timestamp: editTime });
    } else {
      onUpdate?.({ title: editTitle, start: editTime, end: editEnd });
    }
    setIsEditing(false);
  };

  return (
    <div
      onClick={onSelect}
      data-testid="timeline-entry"
      data-content-id={id}
      style={{
        padding: "12px",
        marginBottom: "8px",
        backgroundColor: isSelected ? "#e3f2fd" : "#fff",
        border: `2px solid ${isSelected ? "#0066cc" : "#ddd"}`,
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      {!isEditing ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h4 style={{ margin: "0 0 4px 0" }}>{title}</h4>
            <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
              {hookType === "blocking"
                ? `Blocking at ${timestamp}s`
                : `Non-blocking ${start}s - ${end}s`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              style={{
                padding: "4px 8px",
                fontSize: "12px",
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              style={{
                padding: "4px 8px",
                fontSize: "12px",
                backgroundColor: "#fee",
                border: "1px solid #c33",
                borderRadius: "4px",
                cursor: "pointer",
                color: "#c33",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            style={{
              padding: "6px 8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
          {hookType === "blocking" ? (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Timestamp (seconds):
              </label>
              <input
                type="number"
                value={editTime}
                onChange={(e) => setEditTime(parseFloat(e.target.value))}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  width: "100%",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    marginBottom: "4px",
                  }}
                >
                  Start (s):
                </label>
                <input
                  type="number"
                  value={editTime}
                  onChange={(e) => setEditTime(parseFloat(e.target.value))}
                  style={{
                    padding: "6px 8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    width: "100%",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    marginBottom: "4px",
                  }}
                >
                  End (s):
                </label>
                <input
                  type="number"
                  value={editEnd}
                  onChange={(e) => setEditEnd(parseFloat(e.target.value))}
                  style={{
                    padding: "6px 8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    width: "100%",
                  }}
                />
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              style={{
                flex: 1,
                padding: "6px",
                backgroundColor: "#0066cc",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(false);
              }}
              style={{
                flex: 1,
                padding: "6px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
