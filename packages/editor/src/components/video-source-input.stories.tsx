import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import { VideoSourceInput } from "./video-source-input";
import type { VideoSourceValue } from "./video-source-input";

const meta: Meta<typeof VideoSourceInput> = {
  title: "Editor/VideoSourceInput",
  component: VideoSourceInput,
  args: {
    onChange: fn(),
    onUpload: fn(async (file: File) =>
      `https://cdn.example.com/${encodeURIComponent(file.name)}`,
    ),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithCurrentSource: Story = {
  args: {
    value: { src: "https://example.com/lecture.mp4" },
  },
};

export const UploadFailure: Story = {
  args: {
    onUpload: fn(async () => {
      throw new Error("Upload failed: network unreachable");
    }),
    onError: fn(),
  },
};

export const SlowUpload: Story = {
  args: {
    onUpload: fn(
      (file: File) =>
        new Promise<string>((resolve) =>
          setTimeout(
            () => resolve(`https://cdn.example.com/${file.name}`),
            4000,
          ),
        ),
    ),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const StringsOverride: Story = {
  args: {
    strings: {
      uploadLabel: "Drop a video here",
      uploadButtonLabel: "Pick a file",
      noVideoSelectedLabel: "No video chosen yet.",
      currentSourceLabel: "Currently using",
    },
  },
};

export function WithControlledValue() {
  const [value, setValue] = useState<VideoSourceValue>({});
  return (
    <div style={{ maxWidth: 480 }}>
      <VideoSourceInput
        value={value}
        onChange={(next) => setValue(next)}
        onUpload={async (file) =>
          `https://cdn.example.com/${encodeURIComponent(file.name)}`
        }
      />
      <pre style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
