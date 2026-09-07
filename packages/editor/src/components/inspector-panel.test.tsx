import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InspectorPanel,
  type InspectorPanelEntry,
} from "./inspector-panel";
import type { Placement } from "@interlace/core";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TYPED_BLOCKING: InspectorPanelEntry = {
  id: "c1",
  title: "Mid-roll quiz",
  hookType: "blocking",
  timestamp: 18,
  videoDuration: 60,
  contentTypeId: "quiz-editor",
  registeredTypes: ["quiz-editor", "poll"],
};

const PENDING_NON_BLOCKING: InspectorPanelEntry = {
  id: "pending-1",
  title: "New hook",
  hookType: "non-blocking",
  start: 30,
  end: 45,
  videoDuration: 60,
  contentTypeId: null,
  registeredTypes: ["quiz-editor", "poll"],
};

const DEFAULT_PLACEMENT: Placement = { x: 50, y: 50, width: 20, height: 20 };

function renderPanel(
  entry: InspectorPanelEntry,
  overrides: {
    onTitleChange?: (title: string) => void;
    onTimeChange?: (updates: {
      timestamp?: number;
      start?: number;
      end?: number;
    }) => void;
    onContentTypeSelect?: (contentTypeId: string) => void;
    placement?: Placement;
    onPlacementChange?: (placement: Placement) => void;
    onDelete?: () => void;
    strings?: Record<string, string>;
  } = {},
) {
  const onTitleChange = vi.fn();
  const onTimeChange = vi.fn();
  const onContentTypeSelect = vi.fn();
  const onDelete = vi.fn();
  const utils = render(
    <InspectorPanel
      entry={entry}
      onTitleChange={overrides.onTitleChange ?? onTitleChange}
      onTimeChange={overrides.onTimeChange ?? onTimeChange}
      onContentTypeSelect={overrides.onContentTypeSelect ?? onContentTypeSelect}
      placement={overrides.placement}
      onPlacementChange={overrides.onPlacementChange}
      onDelete={overrides.onDelete ?? onDelete}
      strings={overrides.strings}
    />,
  );
  return {
    ...utils,
    onTitleChange: overrides.onTitleChange ?? onTitleChange,
    onTimeChange: overrides.onTimeChange ?? onTimeChange,
    onContentTypeSelect: overrides.onContentTypeSelect ?? onContentTypeSelect,
    onDelete: overrides.onDelete ?? onDelete,
  };
}

describe("InspectorPanel", () => {
  it("renders the heading, title input, and read-only type row", () => {
    renderPanel(TYPED_BLOCKING);
    expect(screen.getByText("Hook details")).toBeInTheDocument();
    const input = screen.getByTestId(
      "inspector-panel-title",
    ) as HTMLInputElement;
    expect(input.value).toBe("Mid-roll quiz");
    expect(screen.getByTestId("inspector-panel-type")).toHaveTextContent(
      "Blocking",
    );
  });

  it("shows the picker with the selected type for a typed hook (re-typing)", () => {
    const { onContentTypeSelect } = renderPanel(TYPED_BLOCKING);
    // The picker button reflects the hook's current type.
    expect(screen.getByText("quiz-editor")).toBeInTheDocument();

    // Choosing a different type re-types the hook (data reset is the
    // parent's concern; the panel just reports the selection).
    fireEvent.click(screen.getByText("quiz-editor"));
    fireEvent.click(screen.getByText("poll"));
    expect(onContentTypeSelect).toHaveBeenCalledWith("poll");
  });

  it("shows the content type picker for a pending hook", () => {
    const { onContentTypeSelect } = renderPanel(PENDING_NON_BLOCKING);
    // Open the picker dropdown and choose a type.
    fireEvent.click(screen.getByText(/Select content type/i));
    fireEvent.click(screen.getByText("poll"));
    expect(onContentTypeSelect).toHaveBeenCalledWith("poll");
  });

  it("blocking: renders the timestamp input and reports time changes", () => {
    const { onTimeChange } = renderPanel(TYPED_BLOCKING);
    const input = screen.getByTestId(
      "inspector-panel-timestamp",
    ) as HTMLInputElement;
    expect(input.value).toBe("18.0");
    fireEvent.change(input, { target: { value: "21" } });
    expect(onTimeChange).toHaveBeenCalledWith({ timestamp: 21 });
  });

  it("non-blocking: renders start/end inputs and reports time changes", () => {
    const { onTimeChange } = renderPanel(PENDING_NON_BLOCKING);
    const start = screen.getByTestId(
      "inspector-panel-start",
    ) as HTMLInputElement;
    const end = screen.getByTestId("inspector-panel-end") as HTMLInputElement;
    expect(start.value).toBe("30.0");
    expect(end.value).toBe("45.0");
    fireEvent.change(start, { target: { value: "32" } });
    expect(onTimeChange).toHaveBeenCalledWith({ start: 32 });
    fireEvent.change(end, { target: { value: "48" } });
    expect(onTimeChange).toHaveBeenCalledWith({ end: 48 });
  });

  it("renders the manual placement inputs when placement is provided", () => {
    const onPlacementChange = vi.fn();
    const { container } = renderPanel(TYPED_BLOCKING, {
      placement: DEFAULT_PLACEMENT,
      onPlacementChange,
    });
    const x = container.querySelector(
      '[data-testid="placement-editor-input-x"]',
    ) as HTMLInputElement;
    expect(x).not.toBeNull();
    fireEvent.change(x, { target: { value: "12" } });
    expect(onPlacementChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 12 }),
    );
  });

  it("omits the placement inputs when placement is not provided", () => {
    const { container } = renderPanel(TYPED_BLOCKING);
    expect(
      container.querySelector('[data-testid="placement-editor-input-x"]'),
    ).toBeNull();
  });

  it("reports title edits through onTitleChange", () => {
    const { onTitleChange } = renderPanel(TYPED_BLOCKING);
    fireEvent.change(screen.getByTestId("inspector-panel-title"), {
      target: { value: "Renamed" },
    });
    expect(onTitleChange).toHaveBeenCalledWith("Renamed");
  });

  it("delete button calls onDelete", () => {
    const { onDelete } = renderPanel(TYPED_BLOCKING);
    fireEvent.click(screen.getByTestId("inspector-panel-delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("Delete key on the panel (not the input) calls onDelete", () => {
    const { container, onDelete } = renderPanel(TYPED_BLOCKING);
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
    renderPanel(TYPED_BLOCKING, {
      strings: {
        inspectorHeading: "Hook",
        titleLabel: "Name",
        deleteLabel: "Remove",
        blockingTypeLabel: "Pauses video",
        timestampLabel: "At (s)",
      },
    });
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
    expect(screen.getByText("At (s)")).toBeInTheDocument();
  });
});
