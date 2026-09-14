import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Anchor } from "./anchor";

const meta: Meta<typeof Anchor> = {
  title: "Player/Anchor",
  component: Anchor,
  args: {
    id: "anchor-1",
    title: "Open recap quiz",
    placement: {
      x: 12,
      y: 18,
      width: 18,
      height: 12,
    },
    isOpened: false,
    onClick: fn(),
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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Opened: Story = {
  args: {
    isOpened: true,
  },
};
