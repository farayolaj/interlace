import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Anchor } from "./anchor";

afterEach(() => {
  cleanup();
});

describe("Anchor", () => {
  it("renders with title and placement", () => {
    const placement = { x: 50, y: 50, width: 20, height: 10 };
    render(
      <Anchor
        id="test-content"
        title="Click Here"
        placement={placement}
        onClick={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Click Here" });
    expect(button).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", () => {
    const onClick = vi.fn();
    const placement = { x: 50, y: 50, width: 20, height: 10 };

    render(
      <Anchor
        id="test-content"
        title="Click"
        placement={placement}
        onClick={onClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Click" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalled();
  });

  it("applies opened styling when isOpened is true", () => {
    const placement = { x: 50, y: 50, width: 20, height: 10 };

    const { rerender } = render(
      <Anchor
        id="test-content"
        title="Click"
        placement={placement}
        isOpened={false}
      />,
    );

    let button = screen.getByRole("button");
    expect(button).toHaveStyle("backgroundColor: #fff");

    rerender(
      <Anchor
        id="test-content"
        title="Click"
        placement={placement}
        isOpened={true}
      />,
    );

    button = screen.getByRole("button");
    expect(button).toHaveStyle("backgroundColor: #0066cc");
  });

  it("ensures minimum 44px touch target", () => {
    const placement = { x: 50, y: 50, width: 5, height: 5 };

    render(
      <Anchor
        id="test-content"
        title="Small"
        placement={placement}
        onClick={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Small" });

    // Check that minWidth and minHeight are set
    expect(button).toHaveStyle("minWidth: 44px");
    expect(button).toHaveStyle("minHeight: 44px");
  });
});
