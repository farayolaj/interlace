import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { InspectorPanel, type InspectorPanelEntry } from "./inspector-panel";

const TYPED_BLOCKING: InspectorPanelEntry = {
  id: "hook-1",
  title: "Mid-roll quiz",
  hookType: "blocking",
  timestamp: 18,
  videoDuration: 60,
  contentTypeId: "quiz-editor",
  registeredTypes: ["quiz-editor", "poll"],
};

const PENDING_NON_BLOCKING: InspectorPanelEntry = {
  id: "pending-1",
  title: "New hook",
  hookType: "non-blocking",
  start: 30,
  end: 45,
  videoDuration: 60,
  contentTypeId: null,
  registeredTypes: ["quiz-editor", "poll"],
};

const meta: Meta<typeof InspectorPanel> = {
  title: "Editor/InspectorPanel",
  component: InspectorPanel,
  args: {
    entry: TYPED_BLOCKING,
    onTitleChange: fn(),
    onTimeChange: fn(),
    onContentTypeSelect: fn(),
    onDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A typed hook: read-only content type, no picker. */
export const TypedBlocking: Story = {};

/** A pending hook: the content type picker is shown. */
export const PendingNonBlocking: Story = {
  args: {
    entry: PENDING_NON_BLOCKING,
  },
};

export const WithPlacement: Story = {
  args: {
    placement: { x: 50, y: 50, width: 20, height: 20 },
    onPlacementChange: fn(),
  },
};

export const StringsOverride: Story = {
  args: {
    strings: {
      inspectorHeading: "Hook",
      deleteLabel: "Remove",
      blockingTypeLabel: "Pauses video",
      timestampLabel: "At (s)",
      contentTypeLabel: "Content",
    },
  },
};
