import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentInstance, isBlockingHook } from "@interlace/core";
import type { ContentRecord, ContentState, ContentType } from "@interlace/core";
import { useAuthoringStore } from "./use-authoring-store";

/**
 * Builds a real `ContentInstance` (constructed from the exported class, so it
 * matches the store's `InteractiveMediaItem.content` type) wrapped in a
 * blocking-hook `InteractiveMediaItem`.
 */
function makeBlockingItem(id: string, timestamp: number) {
  const record: ContentRecord = {
    id,
    title: `Quiz ${id}`,
    contentTypeId: "quiz",
    data: {},
    state: "pending" as ContentState,
    hook: {
      type: "blocking",
      timestamp,
      placement: { x: 50, y: 50, width: 20, height: 20 },
    },
  };
  const contentType: ContentType = {
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback: () => {},
  };
  return {
    hook: record.hook,
    content: new ContentInstance(record, contentType),
  };
}

describe("useAuthoringStore", () => {
  it("initializes with video metadata", () => {
    const { result } = renderHook(() =>
      useAuthoringStore("https://example.com/video.mp4", 60),
    );

    expect(result.current.state.videoSrc).toBe("https://example.com/video.mp4");
    expect(result.current.state.videoDuration).toBe(60);
    expect(result.current.state.items).toEqual([]);
  });

  it("adds items", () => {
    const { result } = renderHook(() =>
      useAuthoringStore("https://example.com/video.mp4", 60),
    );

    const mockItem = makeBlockingItem("c1", 10);

    act(() => {
      result.current.addItem(mockItem);
    });

    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0]).toBe(mockItem);
  });

  it("removes items", () => {
    const { result } = renderHook(() =>
      useAuthoringStore("https://example.com/video.mp4", 60),
    );

    const mockItem = makeBlockingItem("c1", 10);

    act(() => {
      result.current.addItem(mockItem);
    });

    act(() => {
      result.current.removeItem("c1");
    });

    expect(result.current.state.items).toHaveLength(0);
  });

  it("updates items", () => {
    const { result } = renderHook(() =>
      useAuthoringStore("https://example.com/video.mp4", 60),
    );

    const mockItem = makeBlockingItem("c1", 10);

    act(() => {
      result.current.addItem(mockItem);
    });

    const updatedItem = {
      ...mockItem,
      hook: { ...mockItem.hook, timestamp: 20 },
    };

    act(() => {
      result.current.updateItem("c1", updatedItem);
    });

    const item = result.current.state.items[0];
    if (!item) throw new Error("expected an item");
    const hook = item.hook;
    if (!isBlockingHook(hook)) throw new Error("expected a blocking hook");
    expect(hook.timestamp).toBe(20);
  });

  it("serializes document", () => {
    const { result } = renderHook(() =>
      useAuthoringStore("https://example.com/video.mp4", 60),
    );

    const mockItem = makeBlockingItem("c1", 10);

    act(() => {
      result.current.addItem(mockItem);
    });

    const doc = result.current.serialize("native");

    expect(doc.video.src).toBe("https://example.com/video.mp4");
    expect(doc.video.duration).toBe(60);
    expect(doc.video.adapterType).toBe("native");
    expect(doc.items).toHaveLength(1);
  });

  it("updates video metadata", () => {
    const { result } = renderHook(() =>
      useAuthoringStore("https://example.com/video.mp4", 60),
    );

    act(() => {
      result.current.setVideoMetadata("https://example.com/new-video.mp4", 120);
    });

    expect(result.current.state.videoSrc).toBe(
      "https://example.com/new-video.mp4",
    );
    expect(result.current.state.videoDuration).toBe(120);
  });
});
