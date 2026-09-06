import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InspectorPanel,
  type InspectorPanelEntry,
} from "./inspector-panel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ENTRY: InspectorPanelEntry = {
  id: "c1",
  title: "Mid-roll quiz",
  hookType: "blocking",
  timeLabel: "blocking at 18s",
};

function renderPanel(
  overrides: { entry?: InspectorPanelEntry } = {},
) {
  const onTitleChange = vi.fn();
  const onDelete = vi.fn();
  const utils = render(
    <InspectorPanel
      entry={overrides.entry ?? ENTRY}
      onTitleChange={onTitleChange}
      onDelete={onDelete}
    />,
  );
  return { ...utils, onTitleChange, onDelete };
}

describe("InspectorPanel", () => {
  it("renders the heading, title input, type row, and time label", () => {
    renderPanel();
    expect(screen.getByText("Hook details")).toBeInTheDocument();
    const input = screen.getByTestId(
      "inspector-panel-title",
    ) as HTMLInputElement;
    expect(input.value).toBe("Mid-roll quiz");
    expect(screen.getByTestId("inspector-panel-type")).toHaveTextContent(
      "Blocking",
    );
    expect(screen.getByTestId("inspector-panel-time")).toHaveTextContent(
      "blocking at 18s",
    );
  });

  it("reports the non-blocking type for a non-blocking entry", () => {
    renderPanel({
      entry: { ...ENTRY, hookType: "non-blocking", timeLabel: "20s – 30s" },
    });
    expect(screen.getByTestId("inspector-panel-type")).toHaveTextContent(
      "Non-blocking",
    );
  });

  it("reports title edits through onTitleChange", () => {
    const { onTitleChange } = renderPanel();
    fireEvent.change(screen.getByTestId("inspector-panel-title"), {
      target: { value: "Renamed" },
    });
    expect(onTitleChange).toHaveBeenCalledWith("Renamed");
  });

  it("delete button calls onDelete", () => {
    const { onDelete } = renderPanel();
    fireEvent.click(screen.getByTestId("inspector-panel-delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("Delete key on the panel (not the input) calls onDelete", () => {
    const { onDelete, container } = renderPanel();
    const panel = container.querySelector(
      '[data-testid="inspector-panel"]',
    ) as HTMLElement;
    fireEvent.keyDown(panel, { key: "Delete" });
    expect(onDelete).toHaveBeenCalledTimes(1);

    // The input's own Delete/Backspace must NOT trigger a delete.
    const input = screen.getByTestId("inspector-panel-title");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("applies string overrides", () => {
    render(
      <InspectorPanel
        entry={ENTRY}
        onTitleChange={vi.fn()}
        onDelete={vi.fn()}
        strings={{
          inspectorHeading: "Hook",
          titleLabel: "Name",
          deleteLabel: "Remove",
          blockingTypeLabel: "Pauses video",
        }}
      />,
    );
    expect(screen.getByText("Hook")).toBeInTheDocument();
    expect(screen.getByTestId("inspector-panel-title")).toHaveAttribute(
      "aria-label",
      "Name",
    );
    expect(screen.getByTestId("inspector-panel-delete")).toHaveTextContent(
      "Remove",
    );
    expect(screen.getByTestId("inspector-panel-type")).toHaveTextContent(
      "Pauses video",
    );
  });
});
