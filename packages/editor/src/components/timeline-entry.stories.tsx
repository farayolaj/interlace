import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { TimelineEntry } from "./timeline-entry";

const meta: Meta<typeof TimelineEntry> = {
  title: "Editor/TimelineEntry",
  component: TimelineEntry,
  args: {
    id: "entry-1",
    title: "Chapter quiz",
    hookType: "blocking",
    timestamp: 25,
    isSelected: false,
    onSelect: fn(),
    onUpdate: fn(),
    onDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Blocking: Story = {};

export const NonBlockingSelected: Story = {
  args: {
    title: "Inline knowledge check",
    hookType: "non-blocking",
    start: 40,
    end: 58,
    isSelected: true,
  },
};

export const EditModeInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const editButton = canvas.getByRole("button", { name: "Edit" });
    await userEvent.click(editButton);

    await expect(canvas.getByPlaceholderText("Title")).toBeVisible();
    await expect(canvas.getByText("Timestamp (seconds):")).toBeVisible();
  },
};
