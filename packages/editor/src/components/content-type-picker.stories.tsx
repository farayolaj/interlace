import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  ContentTypePicker,
  ContentTypePickerProps,
} from "./content-type-picker";

function RenderContentTypePicker(args: ContentTypePickerProps) {
  const [selectedType, setSelectedType] = useState<string | null>(
    args.selectedType,
  );

  return (
    <div style={{ width: 320 }}>
      <ContentTypePicker
        {...args}
        selectedType={selectedType}
        onSelect={(value) => {
          setSelectedType(value);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Editor/ContentTypePicker",
  component: ContentTypePicker,
  args: {
    registeredTypes: ["quiz", "poll", "survey", "reflection"],
    selectedType: null,
    onSelect: () => {},
  },
  render: RenderContentTypePicker,
} satisfies Meta<typeof ContentTypePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Preselected: Story = {
  args: {
    selectedType: "quiz",
  },
};

export const Empty: Story = {
  args: {
    registeredTypes: [],
  },
};
