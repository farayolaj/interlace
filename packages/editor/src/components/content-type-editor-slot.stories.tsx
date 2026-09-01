import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ContentTypeEditorSlot } from "./content-type-editor-slot";

const meta: Meta<typeof ContentTypeEditorSlot> = {
  title: "Editor/ContentTypeEditorSlot",
  component: ContentTypeEditorSlot,
  args: {
    contentTypeId: "quiz",
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
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
