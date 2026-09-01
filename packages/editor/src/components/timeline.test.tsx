import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "./timeline";

afterEach(() => {
  cleanup();
});

describe("Timeline", () => {
  it("renders add buttons", () => {
    render(
      <Timeline
        entries={[]}
        onSelectEntry={vi.fn()}
        onUpdateEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onAddEntry={vi.fn()}
      />,
    );

    expect(screen.getByText("+ Blocking Hook")).toBeInTheDocument();
    expect(screen.getByText("+ Non-blocking Hook")).toBeInTheDocument();
  });

  it("calls onAddEntry with correct hook type", () => {
    const onAddEntry = vi.fn();

    render(
      <Timeline
        entries={[]}
        onSelectEntry={vi.fn()}
        onUpdateEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onAddEntry={onAddEntry}
      />,
    );

    const buttons = screen.getAllByText(/Blocking Hook|Non-blocking Hook/);
    const blockingButton = buttons.find(
      (b) => b.textContent === "+ Blocking Hook",
    );
    const nonBlockingButton = buttons.find(
      (b) => b.textContent === "+ Non-blocking Hook",
    );

    if (blockingButton) fireEvent.click(blockingButton);
    expect(onAddEntry).toHaveBeenCalledWith("blocking");

    if (nonBlockingButton) fireEvent.click(nonBlockingButton);
    expect(onAddEntry).toHaveBeenCalledWith("non-blocking");
  });

  it("renders timeline entries", () => {
    const entries = [
      {
        id: "c1",
        title: "Quiz 1",
        hookType: "blocking",
        timestamp: 10,
      },
    ];

    render(
      <Timeline
        entries={entries}
        onSelectEntry={vi.fn()}
        onUpdateEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onAddEntry={vi.fn()}
      />,
    );

    expect(screen.getByText("Quiz 1")).toBeInTheDocument();
    expect(screen.getByText(/Blocking at 10s/)).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    render(
      <Timeline
        entries={[]}
        onSelectEntry={vi.fn()}
        onUpdateEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onAddEntry={vi.fn()}
      />,
    );

    const emptyMessage = screen.getByText(/No hooks added yet/);
    expect(emptyMessage).toBeInTheDocument();
  });
});
