import {
  ContentInstance,
  type ContentRecord,
  type ContentState,
  type ContentType,
} from "@interlace/core";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BlockingOverlay } from "./blocking-overlay";

interface QuizData {
  question: string;
}

function createContentInstance(): ContentInstance<QuizData> {
  const contentType: ContentType<QuizData> = {
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback: () => {},
  };

  const record: ContentRecord<QuizData> = {
    id: "blocking-quiz",
    title: "Pause and answer",
    contentTypeId: "quiz",
    data: {
      question: "What is reinforcement learning?",
    },
    state: "open" as ContentState,
    hook: {
      type: "blocking",
      timestamp: 22,
      placement: {
        x: 12,
        y: 20,
        width: 30,
        height: 24,
      },
    },
  };

  return new ContentInstance(record, contentType);
}

const meta: Meta<typeof BlockingOverlay> = {
  title: "Player/BlockingOverlay",
  component: BlockingOverlay,
  args: {
    content: createContentInstance(),
    onClose: fn(),
    onSubmit: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
