import type { Meta, StoryObj } from "@storybook/react";
import { ContentErrorBoundary } from "./content-error-boundary";

const ThrowingChild = () => {
  throw new Error("Simulated render failure");
};

const HealthyChild = () => <div>Playback content is rendering correctly.</div>;

const meta = {
  title: "Player/ContentErrorBoundary",
  component: ContentErrorBoundary,
  args: {
    children: <HealthyChild />,
  },
} satisfies Meta<typeof ContentErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const ErrorFallback: Story = {
  args: {
    children: <ThrowingChild />,
  },
};

export const CustomFallback: Story = {
  args: {
    children: <ThrowingChild />,
    fallback: (
      <div style={{ padding: 12, backgroundColor: "#fff8dc", borderRadius: 4 }}>
        Custom fallback from story args.
      </div>
    ),
  },
};
