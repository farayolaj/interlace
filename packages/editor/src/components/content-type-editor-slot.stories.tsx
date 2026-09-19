import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ContentTypeRegistry } from "@interlacejs/core";
import { ContentTypeEditorSlot } from "./content-type-editor-slot";

const quizRegistry = new ContentTypeRegistry();
quizRegistry.register({
  getId: () => "quiz",
  getVersion: () => 1,
  getMaximumScore: () => 100,
  renderEditor: (container: HTMLElement, data: unknown) => {
    container.textContent = (data as { question: string }).question;
  },
  renderPlayback: () => {},
});

const emptyRegistry = new ContentTypeRegistry();

const meta: Meta<typeof ContentTypeEditorSlot> = {
  title: "Editor/ContentTypeEditorSlot",
  component: ContentTypeEditorSlot,
  args: {
    contentTypeId: "quiz",
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    registry: quizRegistry,
    data: { question: "Sample question" },
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const QuizEditorOpen: Story = {
  args: {
    contentTypeId: "quiz",
    isOpen: true,
    data: { question: "Sample question" },
  },
};

export const MissingType: Story = {
  args: {
    contentTypeId: "missing",
    isOpen: true,
    registry: emptyRegistry,
  },
};