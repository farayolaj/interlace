import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlacementEditor } from "./placement-editor";

afterEach(() => {
  cleanup();
});

describe("PlacementEditor", () => {
  it("renders placement rectangle", () => {
    const placement = { x: 50, y: 50, width: 20, height: 20 };
    const { container } = render(
      <PlacementEditor
        placement={placement}
        onPlacementChange={vi.fn()}
        videoWidth={640}
        videoHeight={360}
      />,
    );

    const editor = container.firstChild;
    expect(editor).toBeInTheDocument();
  });

  it("calls onPlacementChange when position changes", () => {
    const placement = { x: 50, y: 50, width: 20, height: 20 };
    const onPlacementChange = vi.fn();

    const { container } = render(
      <PlacementEditor
        placement={placement}
        onPlacementChange={onPlacementChange}
        videoWidth={640}
        videoHeight={360}
      />,
    );

    // Find input and change value
    const inputs = container.querySelectorAll("input");
    const firstInput = inputs[0];
    if (!firstInput) throw new Error("expected an input");
    fireEvent.change(firstInput, { target: { value: "30" } });

    expect(onPlacementChange).toHaveBeenCalled();
  });

  it("allows direct numerical input of placement values", () => {
    const placement = { x: 50, y: 50, width: 20, height: 20 };
    const onPlacementChange = vi.fn();

    const { container } = render(
      <PlacementEditor
        placement={placement}
        onPlacementChange={onPlacementChange}
        videoWidth={640}
        videoHeight={360}
      />,
    );

    const inputs = container.querySelectorAll("input");
    const firstInput = inputs[0];
    if (!firstInput) throw new Error("expected an input");
    // Change to a specific value via input
    fireEvent.change(firstInput, { target: { value: "75" } });

    // Should pass through the value as entered
    expect(onPlacementChange).toHaveBeenCalled();
    const calls = onPlacementChange.mock.calls;
    if (calls.length > 0) {
      const lastCall = calls[calls.length - 1];
      if (!lastCall) throw new Error("expected a call");
      expect(lastCall[0].x).toBe(75);
    }
  });
});
