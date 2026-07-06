import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeVideoAdapter } from "./native-video-adapter";

describe("NativeVideoAdapter", () => {
  let videoElement: HTMLVideoElement;
  let adapter: NativeVideoAdapter;

  beforeEach(() => {
    // Create a video element
    videoElement = document.createElement("video");
    videoElement.src = "https://example.com/video.mp4";
    document.body.appendChild(videoElement);

    // Mock HTMLMediaElement methods that jsdom doesn't fully support
    Object.defineProperty(videoElement, "play", {
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(videoElement, "pause", {
      value: vi.fn(),
    });
    Object.defineProperty(videoElement, "currentTime", {
      writable: true,
      value: 0,
    });
    Object.defineProperty(videoElement, "duration", {
      writable: true,
      value: 60,
    });

    adapter = new NativeVideoAdapter(videoElement);
  });

  afterEach(() => {
    adapter.destroy();
    if (videoElement.parentNode) {
      videoElement.parentNode.removeChild(videoElement);
    }
  });

  it("wraps video element in a div", () => {
    expect(adapter.getWrapperElement()).toBeInstanceOf(HTMLDivElement);
    expect(adapter.getWrapperElement().contains(videoElement)).toBe(true);
  });

  it("plays the video", async () => {
    await adapter.play();
    expect(videoElement.play).toHaveBeenCalled();
  });

  it("pauses the video", async () => {
    await adapter.pause();
    expect(videoElement.pause).toHaveBeenCalled();
  });

  it("seeks to a time", async () => {
    await adapter.seek(30);
    expect(videoElement.currentTime).toBe(30);
  });

  it("gets current time", () => {
    videoElement.currentTime = 15;
    expect(adapter.getCurrentTime()).toBe(15);
  });

  it("gets duration", () => {
    expect(adapter.getDuration()).toBe(60);
  });

  it("registers and emits play event", async () => {
    const handler = vi.fn();
    adapter.on("play", handler);

    // Simulate play event
    videoElement.dispatchEvent(new Event("play"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).toHaveBeenCalled();
  });

  it("registers and emits pause event", async () => {
    const handler = vi.fn();
    adapter.on("pause", handler);

    // Simulate pause event
    videoElement.dispatchEvent(new Event("pause"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).toHaveBeenCalled();
  });

  it("suppresses self-triggered play events", async () => {
    const handler = vi.fn();
    adapter.on("play", handler);

    // Mark as triggered (simulating library calling play())
    await adapter.play();
    // Trigger the native event
    videoElement.dispatchEvent(new Event("play"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    // Should not emit because it was self-triggered
    expect(handler).not.toHaveBeenCalled();
  });

  it("suppresses self-triggered pause events", async () => {
    const handler = vi.fn();
    adapter.on("pause", handler);

    // Mark as triggered (simulating library calling pause())
    await adapter.pause();
    // Trigger the native event
    videoElement.dispatchEvent(new Event("pause"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    // Should not emit because it was self-triggered
    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes event listener", async () => {
    const handler = vi.fn();
    const unsubscribe = adapter.on("play", handler);

    unsubscribe();

    // Trigger the event
    videoElement.dispatchEvent(new Event("play"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).not.toHaveBeenCalled();
  });

  it("mounts overlay element", () => {
    const overlay = document.createElement("div");
    overlay.id = "test-overlay";

    adapter.mountOverlay(overlay);

    expect(adapter.getWrapperElement().contains(overlay)).toBe(true);
    expect(overlay.style.position).toBe("absolute");
    expect(overlay.style.zIndex).toBe("10");
  });

  it("replaces previous overlay when mounting new one", () => {
    const overlay1 = document.createElement("div");
    overlay1.id = "overlay1";
    adapter.mountOverlay(overlay1);

    const overlay2 = document.createElement("div");
    overlay2.id = "overlay2";
    adapter.mountOverlay(overlay2);

    expect(adapter.getWrapperElement().contains(overlay1)).toBe(false);
    expect(adapter.getWrapperElement().contains(overlay2)).toBe(true);
  });

  it("returns underlying video element", () => {
    expect(adapter.getVideoElement()).toBe(videoElement);
  });

  it("destroys adapter and restores video element", () => {
    const parent = document.createElement("div");
    parent.appendChild(adapter.getWrapperElement());

    adapter.destroy();

    expect(parent.contains(videoElement)).toBe(true);
    expect(parent.contains(adapter.getWrapperElement())).toBe(false);
  });

  it("emits seek event on seeking", async () => {
    const handler = vi.fn();
    adapter.on("seek", handler);

    videoElement.currentTime = 45;
    videoElement.dispatchEvent(new Event("seeking"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0]?.[0];
    expect(event?.type).toBe("seek");
    // Player can get the actual seek time from adapter.getCurrentTime()
  });

  it("emits waiting event", async () => {
    const handler = vi.fn();
    adapter.on("waiting", handler);

    videoElement.dispatchEvent(new Event("waiting"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).toHaveBeenCalled();
  });
});
