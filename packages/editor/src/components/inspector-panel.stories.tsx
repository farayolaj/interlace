import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { InspectorPanel, type InspectorPanelEntry } from "./inspector-panel";

const BLOCKING: InspectorPanelEntry = {
  id: "c1",
  title: "Mid-roll quiz",
  hookType: "blocking",
  timeLabel: "blocking at 18s",
};

const NON_BLOCKING: InspectorPanelEntry = {
  id: "c2",
  title: "Side poll",
  hookType: "non-blocking",
  timeLabel: "non-blocking 30s – 45s",
};

const meta: Meta<typeof InspectorPanel> = {
  title: "Editor/InspectorPanel",
  component: InspectorPanel,
  args: {
    entry: BLOCKING,
    onTitleChange: fn(),
    onDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Blocking: Story = {};

export const NonBlocking: Story = {
  args: {
    entry: NON_BLOCKING,
  },
};

export const StringsOverride: Story = {
  args: {
    strings: {
      inspectorHeading: "Hook",
      deleteLabel: "Remove",
      blockingTypeLabel: "Pauses video",
    },
  },
};
