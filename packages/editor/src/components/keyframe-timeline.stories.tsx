import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import {
  KeyframeTimeline,
  type KeyframeTimelineEntry,
} from "./keyframe-timeline";

function makeEntries(): KeyframeTimelineEntry[] {
  return [
    { id: "c1", title: "Mid-roll quiz", hookType: "blocking", timestamp: 18 },
    {
      id: "c2",
      title: "Side poll",
      hookType: "non-blocking",
      start: 30,
      end: 45,
    },
    {
      id: "c3",
      title: "Intro check",
      hookType: "blocking",
      timestamp: 5,
    },
  ];
}

const meta: Meta<typeof KeyframeTimeline> = {
  title: "Editor/KeyframeTimeline",
  component: KeyframeTimeline,
  args: {
    entries: makeEntries(),
    videoDuration: 60,
    currentTime: 18,
    onSeek: fn(),
    onSelectEntry: fn(),
    onUpdateEntry: fn(),
    onAddEntry: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    entries: [],
  },
};

export const ZoomedIn: Story = {
  args: {
    // The strip's zoom is internal state; this story pins the default
    // content at a selected keyframe for visual comparison.
    currentTime: 5,
  },
};

/** With `onTogglePlay`, a quiet play/pause icon button is shown. */
export const WithPlayButton: Story = {
  args: {
    isPlaying: true,
    currentTime: 32,
    onTogglePlay: fn(),
  },
};

/** Nearby hooks stack into lanes so markers and labels never overlap. */
export const NearbyHooks: Story = {
  args: {
    entries: [
      { id: "n1", title: "New hook", hookType: "blocking", timestamp: 10 },
      { id: "n2", title: "New hook", hookType: "blocking", timestamp: 10.6 },
      {
        id: "n3",
        title: "A rather long hook title that truncates",
        hookType: "blocking",
        timestamp: 14,
      },
      {
        id: "n4",
        title: "Overlay",
        hookType: "non-blocking",
        start: 12,
        end: 30,
      },
      { id: "n5", title: "Late check", hookType: "blocking", timestamp: 40 },
    ],
  },
};

/** Untitled hooks and hooks flagged as needing attention. */
export const UntitledAndNeedsAttention: Story = {
  args: {
    entries: [
      {
        id: "a1",
        title: "",
        hookType: "blocking",
        timestamp: 8,
        needsAttention: true,
        attentionLabel: "has no content",
      },
      {
        id: "a2",
        title: "Side poll",
        hookType: "non-blocking",
        start: 25,
        end: 45,
        needsAttention: true,
      },
      { id: "a3", title: "Ready quiz", hookType: "blocking", timestamp: 50 },
    ],
    selectedId: "a1",
  },
};

export const StringsOverride: Story = {
  args: {
    strings: {
      addBlockingLabel: "Pause point",
      addNonBlockingLabel: "Overlay",
      addBlockingHint: "Pause the video here",
      addNonBlockingHint: "Show an overlay from here",
      emptyLabel: "Nothing scheduled yet.",
    },
  },
};

/** Fully interactive: drag keyframes, scrub the playhead, zoom. */
export function Interactive() {
  const [entries, setEntries] =
    useState<KeyframeTimelineEntry[]>(makeEntries());
  const [currentTime, setCurrentTime] = useState(18);
  return (
    <>
      <KeyframeTimeline
        entries={entries}
        videoDuration={60}
        currentTime={currentTime}
        onSeek={setCurrentTime}
        onSelectEntry={fn()}
        onUpdateEntry={(id, updates) =>
          setEntries((prev) =>
            prev.map((e) =>
              e.id === id
                ? e.hookType === "blocking"
                  ? { ...e, timestamp: updates.timestamp ?? e.timestamp }
                  : {
                      ...e,
                      start: updates.start ?? e.start,
                      end: updates.end ?? e.end,
                    }
                : e,
            ),
          )
        }
        onDeleteEntry={(id) =>
          setEntries((prev) => prev.filter((e) => e.id !== id))
        }
        onAddEntry={(hookType) =>
          setEntries((prev) => [
            ...prev,
            hookType === "blocking"
              ? {
                  id: `new-${prev.length + 1}`,
                  title: `Hook ${prev.length + 1}`,
                  hookType: "blocking" as const,
                  timestamp: Math.round(currentTime),
                }
              : {
                  id: `new-${prev.length + 1}`,
                  title: `Hook ${prev.length + 1}`,
                  hookType: "non-blocking" as const,
                  start: Math.round(currentTime),
                  end: Math.round(currentTime) + 10,
                },
          ])
        }
      />
      <pre
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "#666",
          fontFamily: "monospace",
        }}
      >
        {`playhead: ${currentTime.toFixed(1)}s`}
      </pre>
    </>
  );
}
