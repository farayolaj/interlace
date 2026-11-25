import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentTypePicker } from "./content-type-picker";

afterEach(() => {
  cleanup();
});

describe("ContentTypePicker", () => {
  it("renders a radio per registered type, named by id when unlabelled", () => {
    render(
      <ContentTypePicker
        registeredTypes={["quiz", "poll"]}
        selectedType={null}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Content type" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "quiz" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "poll" })).toBeInTheDocument();
  });

  it("shows readable names and descriptions from options", () => {
    render(
      <ContentTypePicker
        registeredTypes={["quiz-editor"]}
        options={[
          { id: "quiz-editor", label: "Quiz", description: "Multiple choice" },
        ]}
        selectedType={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: /Quiz/ })).toBeInTheDocument();
    expect(screen.getByText("Multiple choice")).toBeInTheDocument();
    expect(screen.queryByText("quiz-editor")).not.toBeInTheDocument();
  });

  it("calls onSelect with the id when a type is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ContentTypePicker
        registeredTypes={["quiz", "poll"]}
        selectedType={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "poll" }));
    expect(onSelect).toHaveBeenCalledWith("poll");
  });

  it("marks the selected type checked and makes it the tab stop", () => {
    render(
      <ContentTypePicker
        registeredTypes={["quiz", "poll"]}
        selectedType="poll"
        onSelect={vi.fn()}
      />,
    );

    const poll = screen.getByRole("radio", { name: "poll" });
    const quiz = screen.getByRole("radio", { name: "quiz" });
    expect(poll).toHaveAttribute("aria-checked", "true");
    expect(quiz).toHaveAttribute("aria-checked", "false");
    expect(poll).toHaveAttribute("tabindex", "0");
    expect(quiz).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus between choices with arrow keys", () => {
    render(
      <ContentTypePicker
        registeredTypes={["quiz", "poll"]}
        selectedType={null}
        onSelect={vi.fn()}
      />,
    );

    const quiz = screen.getByRole("radio", { name: "quiz" });
    quiz.focus();
    fireEvent.keyDown(quiz, { key: "ArrowDown" });
    expect(screen.getByRole("radio", { name: "poll" })).toHaveFocus();
  });
});
