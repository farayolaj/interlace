import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompletedTag } from "./completed-tag";

describe("CompletedTag", () => {
  it("renders completed tag with title", () => {
    const placement = { x: 50, y: 50, width: 20, height: 10 };

    render(
      <CompletedTag
        id="completed-1"
        title="Quiz Complete"
        placement={placement}
      />,
    );

    // Check for checkmark and title
    expect(screen.getByText(/Quiz Complete/i)).toBeInTheDocument();
  });

  it("has correct positioning styles", () => {
    const placement = { x: 25, y: 75, width: 15, height: 8 };

    const { container } = render(
      <CompletedTag id="completed-1" title="Done" placement={placement} />,
    );

    const tag = container.firstChild as HTMLElement;
    expect(tag).toHaveStyle("position: absolute");
    expect(tag).toHaveStyle("left: 25%");
    expect(tag).toHaveStyle("top: 75%");
  });

  it("includes success styling", () => {
    const placement = { x: 50, y: 50, width: 20, height: 10 };

    const { container } = render(
      <CompletedTag id="completed-1" title="Complete" placement={placement} />,
    );

    const tag = container.firstChild as HTMLElement;

    // Uses the Interlace blue accent instead of an extra green.
    expect(tag).toHaveStyle("backgroundColor: #0066cc");
    expect(tag).toHaveStyle("color: #fff");
  });
});
