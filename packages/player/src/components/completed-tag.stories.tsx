import type { Meta, StoryObj } from "@storybook/react";
import { CompletedTag } from "./completed-tag";

const meta = {
  title: "Player/CompletedTag",
  component: CompletedTag,
  args: {
    id: "completed-1",
    title: "Knowledge Check",
    placement: {
      x: 62,
      y: 22,
      width: 20,
      height: 12,
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: 720,
          height: 405,
          border: "1px solid #d0d0d0",
          backgroundColor: "#f5f5f5",
          overflow: "hidden",
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompletedTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
