import type { Placement } from "@interlace/core";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PlacementEditor } from "./placement-editor";

const basePlacement: Placement = {
  x: 12,
  y: 15,
  width: 24,
  height: 18,
};

const meta = {
  title: "Editor/PlacementEditor",
  component: PlacementEditor,
  args: {
    placement: basePlacement,
    videoWidth: 720,
    videoHeight: 405,
    onPlacementChange: () => {},
  },
  render: (args) => {
    const [placement, setPlacement] = useState(args.placement);

    return (
      <PlacementEditor
        {...args}
        placement={placement}
        onPlacementChange={(nextPlacement) => {
          setPlacement(nextPlacement);
        }}
      />
    );
  },
} satisfies Meta<typeof PlacementEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CompactVideo: Story = {
  args: {
    videoWidth: 480,
    videoHeight: 270,
    placement: {
      x: 5,
      y: 10,
      width: 30,
      height: 30,
    },
  },
};
