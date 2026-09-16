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
  options: string[];
  correctIndex: number;
}

/** Demo content type that renders an interactive true/false choice. */
function createDemoContentType(): ContentType<QuizData> {
  return {
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback: (
      container: HTMLElement,
      data: QuizData,
      callbacks: { onComplete(score?: number): void },
    ) => {
      const question = document.createElement("p");
      question.textContent = data.question;
      container.appendChild(question);

      data.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option;
        button.addEventListener("click", () => {
          callbacks.onComplete(index === data.correctIndex ? 100 : 0);
        });
        container.appendChild(button);
      });
    },
  };

  // Demo record/state shape retained below
  // (contentTypeId/version/payload authored for the story).
  void 0;
}

function createContentInstance(): ContentInstance<QuizData> {
  const contentType = createDemoContentType();

  const record: ContentRecord<QuizData> = {
    id: "blocking-quiz",
    title: "Pause and answer",
    contentTypeId: "quiz",
    data: {
      question: "What is reinforcement learning?",
      options: ["Training without labels", "Nothing"],
      correctIndex: 0,
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

const contentType = createDemoContentType();
const contentInstance = createContentInstance();

const meta: Meta<typeof BlockingOverlay> = {
  title: "Player/BlockingOverlay",
  component: BlockingOverlay,
  args: {
    content: contentInstance,
    contentType,
    onContentComplete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Completing: Story = {
  args: {
    completing: true,
    completingScore: 100,
    onContinue: fn(),
  },
};
