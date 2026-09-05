import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import type { Placement } from "@interlace/core";
import { PlacementEditor } from "./placement-editor";

const DEFAULT_PLACEMENT: Placement = { x: 50, y: 50, width: 20, height: 20 };

/**
 * PlacementEditor is an overlay: it must sit inside a positioned
 * container that hugs the video frame. These stories simulate the
 * frame with a dark "video" surface.
 */
const meta: Meta<typeof PlacementEditor> = {
  title: "Editor/PlacementEditor",
  component: PlacementEditor,
  args: {
    placement: DEFAULT_PLACEMENT,
    onPlacementChange: fn(),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: 640,
          height: 360,
          backgroundColor:
            "linear-gradient(135deg, #1a2a3a 0%, #2a3a4a 100%)",
          backgroundImage:
            "linear-gradient(135deg, #1a2a3a 0%, #2a3a4a 100%)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.4)",
            fontSize: 14,
            letterSpacing: 2,
          }}
        >
          VIDEO FRAME
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CornerPlacement: Story = {
  args: {
    placement: { x: 70, y: 8, width: 26, height: 18 },
  },
};

export const MinimumSize: Story = {
  args: {
    placement: { x: 40, y: 40, width: 1, height: 1 },
  },
};

/** Fully interactive: drag the rectangle or handles, use the inputs. */
export function Interactive() {
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  return (
    <>
      <PlacementEditor
        placement={placement}
        onPlacementChange={setPlacement}
      />
      <pre
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "#666",
          fontFamily: "monospace",
        }}
      >
        {JSON.stringify(placement, null, 2)}
      </pre>
    </>
  );
}
