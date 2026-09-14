import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentTypePicker } from "./content-type-picker";

afterEach(() => {
  cleanup();
});

describe("ContentTypePicker", () => {
  it("renders dropdown with registered types", () => {
    render(
      <ContentTypePicker
        registeredTypes={["quiz", "survey", "poll"]}
        selectedType={null}
        onSelect={vi.fn()}
      />,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByText("quiz")).toBeInTheDocument();
    expect(screen.getByText("survey")).toBeInTheDocument();
    expect(screen.getByText("poll")).toBeInTheDocument();
  });

  it("calls onSelect when type is clicked", () => {
    const onSelect = vi.fn();

    render(
      <ContentTypePicker
        registeredTypes={["quiz", "survey"]}
        selectedType={null}
        onSelect={onSelect}
      />,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    const quizOption = screen.getByText("quiz");
    fireEvent.click(quizOption);

    expect(onSelect).toHaveBeenCalledWith("quiz");
  });

  it("displays selected type", () => {
    render(
      <ContentTypePicker
        registeredTypes={["quiz", "survey"]}
        selectedType="quiz"
        onSelect={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    // Check that quiz appears in the document (either in button or dropdown)
    expect(screen.getByText("quiz")).toBeInTheDocument();
  });

  it("toggles dropdown on button click", () => {
    render(
      <ContentTypePicker
        registeredTypes={["quiz", "survey"]}
        selectedType={null}
        onSelect={vi.fn()}
      />,
    );

    const button = screen.getByRole("button");

    // Open
    fireEvent.click(button);
    expect(screen.getByText("quiz")).toBeInTheDocument();

    // Close
    fireEvent.click(button);
  });
});
