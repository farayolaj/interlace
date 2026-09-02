import type { Meta, StoryObj } from "@storybook/react";
import { ContentTypeRegistry } from "@interlace/core";
import type { SerializedInteractiveMediaDocument } from "@interlace/core";
import { QuizEditor } from "../content-types/quiz-editor";
import { InteractiveMediaAuthoring } from "./interactive-media-authoring";

const VIDEO_SRC = "https://example.com/video.mp4";
const VIDEO_DURATION = 60;

function makeDefaultRegistry(): ContentTypeRegistry {
  const registry = new ContentTypeRegistry();
  registry.register(QuizEditor);
  registry.register({
    getId: () => "poll",
    getVersion: () => 1,
    getMaximumScore: () => undefined,
    renderEditor: () => {},
    renderPlayback: () => {},
  });
  return registry;
}

function makeSwitchRegistry(): ContentTypeRegistry {
  const registry = new ContentTypeRegistry();
  registry.register({
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: (container: HTMLElement, data: unknown) => {
      container.textContent = (data as { question: string }).question ?? "";
    },
    renderPlayback: () => {},
  });
  registry.register({
    getId: () => "poll",
    getVersion: () => 1,
    getMaximumScore: () => undefined,
    renderEditor: (container: HTMLElement) => {
      container.textContent = "Poll editor";
    },
    renderPlayback: () => {},
  });
  return registry;
}

function makeInitialDocument(): SerializedInteractiveMediaDocument {
  return {
    video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
    items: [
      {
        id: "c1",
        title: "Mid-roll quiz",
        hook: {
          type: "blocking",
          timestamp: 18,
          placement: { x: 50, y: 50, width: 20, height: 20 },
        },
        content: {
          contentTypeId: "quiz-editor",
          version: 1,
          data: {
            question: "What is the capital of France?",
            options: ["Paris", "London", "Berlin"],
            correctIndex: 0,
          },
        },
      },
    ],
  };
}

function makeSwitchDocument(): SerializedInteractiveMediaDocument {
  return {
    video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
    items: [
      {
        id: "c1",
        title: "Quiz item",
        hook: {
          type: "blocking",
          timestamp: 10,
          placement: { x: 50, y: 50, width: 20, height: 20 },
        },
        content: {
          contentTypeId: "quiz",
          version: 1,
          data: { question: "Quiz question" },
        },
      },
      {
        id: "c2",
        title: "Poll item",
        hook: {
          type: "non-blocking",
          start: 20,
          end: 40,
          placement: { x: 50, y: 50, width: 20, height: 20 },
          revealBehavior: "click",
        },
        content: {
          contentTypeId: "poll",
          version: 1,
          data: {},
        },
      },
    ],
  };
}

const meta: Meta<typeof InteractiveMediaAuthoring> = {
  title: "Editor/InteractiveMediaAuthoring",
  component: InteractiveMediaAuthoring,
  args: {
    videoSrc: VIDEO_SRC,
    videoDuration: VIDEO_DURATION,
    registry: makeDefaultRegistry(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InitialDocument: Story = {
  args: {
    initialDocument: makeInitialDocument(),
  },
};

export const SwitchType: Story = {
  args: {
    registry: makeSwitchRegistry(),
    initialDocument: makeSwitchDocument(),
  },
};