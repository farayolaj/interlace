import {
  ContentInstance,
  type ContentRecord,
  type ContentState,
  type ContentType,
  type Hook,
  type RenderState,
} from "@interlace/core";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { OverlayLayer } from "./overlay-layer";

interface DemoData {
  label: string;
}

function createContentInstance(id: string, title: string, hook: Hook) {
  const contentType: ContentType<DemoData> = {
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback: () => {},
  };

  const record: ContentRecord<DemoData> = {
    id,
    title,
    contentTypeId: "quiz",
    data: { label: title },
    state: "pending" as ContentState,
    hook,
  };

  return new ContentInstance(record, contentType);
}

const nonBlockingHook: Hook = {
  type: "non-blocking",
  start: 10,
  end: 40,
  revealBehavior: "click",
  placement: {
    x: 8,
    y: 14,
    width: 20,
    height: 14,
  },
};

const blockingHook: Hook = {
  type: "blocking",
  timestamp: 16,
  placement: {
    x: 55,
    y: 20,
    width: 24,
    height: 16,
  },
};

const items = [
  {
    content: createContentInstance("c1", "Anchor content", nonBlockingHook),
    hook: nonBlockingHook,
  },
  {
    content: createContentInstance("c2", "Completed content", blockingHook),
    hook: blockingHook,
  },
];

const renderState: RenderState = {
  visibleAnchorIds: ["c1"],
  completedTagIds: ["c2"],
  openedContentIds: [],
};

const meta: Meta<typeof OverlayLayer> = {
  title: "Player/OverlayLayer",
  component: OverlayLayer,
  args: {
    renderState,
    items,
    onAnchorClick: fn(),
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
