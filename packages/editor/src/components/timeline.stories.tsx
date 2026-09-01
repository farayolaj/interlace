import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Timeline } from "./timeline";

type StoryEntry = {
  id: string;
  title: string;
  hookType: "blocking" | "non-blocking";
  timestamp?: number;
  start?: number;
  end?: number;
};

const defaultEntries: StoryEntry[] = [
  {
    id: "b1",
    title: "Mid-roll quiz",
    hookType: "blocking",
    timestamp: 18,
  },
  {
    id: "n1",
    title: "Learn more card",
    hookType: "non-blocking",
    start: 42,
    end: 60,
  },
];

const meta = {
  title: "Editor/Timeline",
  component: Timeline,
  args: {
    entries: defaultEntries,
    selectedId: "b1",
    onSelectEntry: () => {},
    onUpdateEntry: () => {},
    onDeleteEntry: () => {},
    onAddEntry: () => {},
  },
  render: (args) => {
    const [entries, setEntries] = useState<StoryEntry[]>(args.entries);
    const [selectedId, setSelectedId] = useState<string | undefined>(
      args.selectedId,
    );

    return (
      <Timeline
        entries={entries}
        selectedId={selectedId}
        onSelectEntry={(id) => {
          setSelectedId(id);
        }}
        onUpdateEntry={(id, updates) => {
          setEntries((prev) =>
            prev.map((entry) =>
              entry.id === id ? { ...entry, ...updates } : entry,
            ),
          );
        }}
        onDeleteEntry={(id) => {
          setEntries((prev) => prev.filter((entry) => entry.id !== id));
          setSelectedId((prev) => (prev === id ? undefined : prev));
        }}
        onAddEntry={(hookType) => {
          setEntries((prev) => {
            const nextId = `${hookType[0]}${prev.length + 1}`;
            const nextEntry: StoryEntry =
              hookType === "blocking"
                ? {
                    id: nextId,
                    title: "New blocking hook",
                    hookType,
                    timestamp: 0,
                  }
                : {
                    id: nextId,
                    title: "New non-blocking hook",
                    hookType,
                    start: 0,
                    end: 10,
                  };
            return [...prev, nextEntry];
          });
        }}
      />
    );
  },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    entries: [],
    selectedId: undefined,
  },
};
