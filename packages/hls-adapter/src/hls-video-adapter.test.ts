import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { MockHls } = vi.hoisted(() => {
  type Handler = (event: string, data: unknown) => void;

  class MockHls {
    static Events = {
      MANIFEST_PARSED: "hlsManifestParsed",
      LEVEL_SWITCHED: "hlsLevelSwitched",
      ERROR: "hlsError",
    };
    static ErrorTypes = {
      NETWORK_ERROR: "networkError",
      MEDIA_ERROR: "mediaError",
      OTHER_ERROR: "otherError",
    };
    static supported = true;
    static isSupported = () => MockHls.supported;
    static instances: MockHls[] = [];

    config: unknown;
    levels: { height: number; bitrate: number }[] = [];
    currentLevel = -1;
    media: HTMLVideoElement | null = null;
    source: string | null = null;
    handlers = new Map<string, Handler[]>();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    destroy = vi.fn();

    constructor(config?: unknown) {
      this.config = config;
      MockHls.instances.push(this);
    }

    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    }

    attachMedia(media: HTMLVideoElement) {
      this.media = media;
    }

    loadSource(src: string) {
      this.source = src;
    }

    trigger(event: string, data: unknown) {
      this.handlers.get(event)?.forEach((h) => h(event, data));
    }

    parseManifest(levels: { height: number; bitrate: number }[]) {
      this.levels = levels;
      this.trigger(MockHls.Events.MANIFEST_PARSED, { levels });
    }
  }

  return { MockHls };
});

vi.mock("hls.js", () => ({ default: MockHls }));

import { HlsVideoAdapter, isHlsSource } from "./hls-video-adapter";

const LEVELS = [
  { height: 360, bitrate: 800_000 },
  { height: 720, bitrate: 2_800_000 },
  { height: 240, bitrate: 400_000 },
  { height: 720, bitrate: 3_200_000 },
  { height: 1080, bitrate: 5_000_000 },
];

function lastHls(): InstanceType<typeof MockHls> {
  const hls = MockHls.instances[MockHls.instances.length - 1];
  if (!hls) throw new Error("no hls instance");
  return hls;
}

describe("HlsVideoAdapter", () => {
  let video: HTMLVideoElement;
  let adapter: HlsVideoAdapter | null;
  let paused: boolean;

  beforeEach(() => {
    MockHls.supported = true;
    MockHls.instances = [];
    window.localStorage.clear();
    paused = true;
    video = document.createElement("video");
    document.body.appendChild(video);
    Object.defineProperty(video, "play", {
      value: vi.fn(() => {
        paused = false;
        return Promise.resolve();
      }),
    });
    Object.defineProperty(video, "pause", { value: vi.fn() });
    Object.defineProperty(video, "paused", { get: () => paused });
    Object.defineProperty(video, "currentTime", { writable: true, value: 0 });
    Object.defineProperty(video, "canPlayType", { value: vi.fn(() => "") });
    adapter = null;
  });

  afterEach(() => {
    adapter?.destroy();
    video.remove();
  });

  const create = (
    options: Partial<ConstructorParameters<typeof HlsVideoAdapter>[1]> = {},
  ) => {
    adapter = new HlsVideoAdapter(video, {
      src: "https://cdn.test/master.m3u8",
      ...options,
    });
    return adapter;
  };

  describe("hls.js path", () => {
    it("attaches hls.js to the video and loads the manifest", () => {
      create({ hlsConfig: { maxBufferLength: 10 } });
      const hls = lastHls();
      expect(hls.config).toEqual({ maxBufferLength: 10 });
      expect(hls.media).toBe(video);
      expect(hls.source).toBe("https://cdn.test/master.m3u8");
      expect(adapter!.getHls()).toBe(hls);
    });

    it("keeps the native adapter behaviour (wrapper, programmatic seek)", async () => {
      const a = create();
      expect(a.getWrapperElement().contains(video)).toBe(true);
      const onSeek = vi.fn();
      a.on("programmaticSeek", onSeek);
      await a.seek(12);
      expect(video.currentTime).toBe(12);
      expect(onSeek).toHaveBeenCalledTimes(1);
    });

    it("exposes no levels before the manifest is parsed", () => {
      const a = create();
      expect(a.getQualityLevels()).toEqual([]);
      expect(a.getQualityLevel()).toBe(-1);
      expect(a.getActiveQualityLevel()).toBeNull();
    });

    it("exposes levels deduped by height, sorted high to low, labelled", () => {
      const a = create();
      const onQuality = vi.fn();
      a.on("qualitychange", onQuality);
      lastHls().parseManifest(LEVELS);

      expect(a.getQualityLevels()).toEqual([
        { id: 4, height: 1080, bitrate: 5_000_000, label: "1080p" },
        { id: 3, height: 720, bitrate: 3_200_000, label: "720p" },
        { id: 0, height: 360, bitrate: 800_000, label: "360p" },
        { id: 2, height: 240, bitrate: 400_000, label: "240p" },
      ]);
      expect(onQuality).toHaveBeenCalledWith({ type: "qualitychange" });
    });

    it("selects a level, persists it and emits qualitychange", () => {
      const a = create({ rememberQualityKey: "q" });
      lastHls().parseManifest(LEVELS);
      const onQuality = vi.fn();
      a.on("qualitychange", onQuality);

      a.setQualityLevel(0);
      expect(lastHls().currentLevel).toBe(0);
      expect(a.getQualityLevel()).toBe(0);
      expect(window.localStorage.getItem("q")).toBe("360");
      expect(onQuality).toHaveBeenCalledTimes(1);

      a.setQualityLevel(-1);
      expect(lastHls().currentLevel).toBe(-1);
      expect(a.getQualityLevel()).toBe(-1);
      expect(window.localStorage.getItem("q")).toBe("auto");
    });

    it("does not persist without rememberQualityKey", () => {
      const a = create();
      lastHls().parseManifest(LEVELS);
      a.setQualityLevel(0);
      expect(window.localStorage.length).toBe(0);
    });

    it("applies a remembered height, falling back to the nearest lower level", () => {
      window.localStorage.setItem("q", "480");
      const a = create({ rememberQualityKey: "q" });
      lastHls().parseManifest(LEVELS);
      expect(a.getQualityLevel()).toBe(0); // 360p
      expect(lastHls().currentLevel).toBe(0);
    });

    it("uses the lowest level when the remembered height is below all levels", () => {
      window.localStorage.setItem("q", "144");
      const a = create({ rememberQualityKey: "q" });
      lastHls().parseManifest(LEVELS);
      expect(a.getQualityLevel()).toBe(2); // 240p
    });

    it("stays on Auto when Auto is remembered", () => {
      window.localStorage.setItem("q", "auto");
      const a = create({ rememberQualityKey: "q" });
      lastHls().parseManifest(LEVELS);
      expect(a.getQualityLevel()).toBe(-1);
      expect(lastHls().currentLevel).toBe(-1);
    });

    it("survives unavailable storage", () => {
      const getItem = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(() => {
          throw new Error("denied");
        });
      const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("denied");
        });
      const a = create({ rememberQualityKey: "q" });
      expect(() => lastHls().parseManifest(LEVELS)).not.toThrow();
      expect(() => a.setQualityLevel(0)).not.toThrow();
      getItem.mockRestore();
      setItem.mockRestore();
    });

    it("tracks the active level (mapped by height) and emits qualitychange", () => {
      const a = create();
      lastHls().parseManifest(LEVELS);
      const onQuality = vi.fn();
      a.on("qualitychange", onQuality);

      // Index 1 is a 720p duplicate; it maps to the exposed 720p level (id 3).
      lastHls().trigger(MockHls.Events.LEVEL_SWITCHED, { level: 1 });
      expect(a.getActiveQualityLevel()).toBe(3);
      expect(onQuality).toHaveBeenCalledTimes(1);
    });

    it("unsubscribes qualitychange listeners", () => {
      const a = create();
      const onQuality = vi.fn();
      const off = a.on("qualitychange", onQuality);
      off();
      lastHls().parseManifest(LEVELS);
      expect(onQuality).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    const fatal = (type: string) => ({ fatal: true, type, details: "x" });

    it("ignores non-fatal errors", () => {
      create({ fallbackSrc: "https://cdn.test/video.mp4" });
      lastHls().trigger(MockHls.Events.ERROR, {
        fatal: false,
        type: MockHls.ErrorTypes.NETWORK_ERROR,
      });
      expect(lastHls().destroy).not.toHaveBeenCalled();
    });

    it("retries a fatal network error once after the manifest loaded, then falls back", () => {
      const a = create({ fallbackSrc: "https://cdn.test/video.mp4" });
      const hls = lastHls();
      hls.parseManifest(LEVELS);

      hls.trigger(
        MockHls.Events.ERROR,
        fatal(MockHls.ErrorTypes.NETWORK_ERROR),
      );
      expect(hls.startLoad).toHaveBeenCalledTimes(1);
      expect(hls.destroy).not.toHaveBeenCalled();

      hls.trigger(
        MockHls.Events.ERROR,
        fatal(MockHls.ErrorTypes.NETWORK_ERROR),
      );
      expect(hls.startLoad).toHaveBeenCalledTimes(1);
      expect(hls.destroy).toHaveBeenCalled();
      expect(a.getHls()).toBeNull();
      expect(video.src).toBe("https://cdn.test/video.mp4");
    });

    it("falls back straight away when the manifest fails to load", () => {
      create({ fallbackSrc: "https://cdn.test/video.mp4" });
      const hls = lastHls();
      hls.trigger(
        MockHls.Events.ERROR,
        fatal(MockHls.ErrorTypes.NETWORK_ERROR),
      );
      expect(hls.startLoad).not.toHaveBeenCalled();
      expect(video.src).toBe("https://cdn.test/video.mp4");
    });

    it("recovers a fatal media error once, then falls back preserving time and playback", async () => {
      const a = create({ fallbackSrc: "https://cdn.test/video.mp4" });
      const hls = lastHls();
      hls.parseManifest(LEVELS);
      const onQuality = vi.fn();
      const onSeek = vi.fn();
      const onProgrammaticSeek = vi.fn();
      a.on("qualitychange", onQuality);
      a.on("seek", onSeek);
      a.on("programmaticSeek", onProgrammaticSeek);

      hls.trigger(MockHls.Events.ERROR, fatal(MockHls.ErrorTypes.MEDIA_ERROR));
      expect(hls.recoverMediaError).toHaveBeenCalledTimes(1);

      paused = false;
      video.currentTime = 42;
      hls.trigger(MockHls.Events.ERROR, fatal(MockHls.ErrorTypes.MEDIA_ERROR));
      expect(hls.recoverMediaError).toHaveBeenCalledTimes(1);
      expect(hls.destroy).toHaveBeenCalled();
      expect(a.getQualityLevels()).toEqual([]);
      expect(a.getQualityLevel()).toBe(-1);
      expect(onQuality).toHaveBeenCalledTimes(1);
      expect(video.src).toBe("https://cdn.test/video.mp4");

      video.currentTime = 0;
      paused = true;
      video.dispatchEvent(new Event("loadedmetadata"));
      video.dispatchEvent(new Event("seeking"));
      await Promise.resolve();
      await Promise.resolve();

      expect(video.currentTime).toBe(42);
      expect(onProgrammaticSeek).toHaveBeenCalledTimes(1);
      expect(onSeek).not.toHaveBeenCalled();
      expect(video.play).toHaveBeenCalled();
    });

    it("keeps a paused video paused after falling back", async () => {
      create({ fallbackSrc: "https://cdn.test/video.mp4" });
      const hls = lastHls();
      video.currentTime = 7;
      hls.trigger(MockHls.Events.ERROR, fatal(MockHls.ErrorTypes.OTHER_ERROR));
      video.dispatchEvent(new Event("loadedmetadata"));
      await Promise.resolve();
      expect(video.currentTime).toBe(7);
      expect(video.play).not.toHaveBeenCalled();
    });

    it("clears levels even without a fallback source", () => {
      const a = create();
      const hls = lastHls();
      hls.parseManifest(LEVELS);
      hls.trigger(MockHls.Events.ERROR, fatal(MockHls.ErrorTypes.OTHER_ERROR));
      expect(hls.destroy).toHaveBeenCalled();
      expect(a.getQualityLevels()).toEqual([]);
      expect(video.getAttribute("src")).toBeNull();
    });
  });

  describe("native HLS path", () => {
    beforeEach(() => {
      MockHls.supported = false;
      (video.canPlayType as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) =>
          type === "application/vnd.apple.mpegurl" ? "maybe" : "",
      );
    });

    it("plays the manifest natively and exposes no levels", () => {
      const a = create();
      expect(MockHls.instances).toHaveLength(0);
      expect(video.src).toBe("https://cdn.test/master.m3u8");
      expect(a.getQualityLevels()).toEqual([]);
      expect(a.getHls()).toBeNull();
    });

    it("switches to the fallback source on a video error", () => {
      create({ fallbackSrc: "https://cdn.test/video.mp4" });
      video.dispatchEvent(new Event("error"));
      expect(video.src).toBe("https://cdn.test/video.mp4");
    });

    it("does not loop when the fallback itself errors", () => {
      create({ fallbackSrc: "https://cdn.test/video.mp4" });
      video.dispatchEvent(new Event("error"));
      video.src = "https://cdn.test/other.mp4";
      video.dispatchEvent(new Event("error"));
      expect(video.src).toBe("https://cdn.test/other.mp4");
    });
  });

  describe("refreshSource (expired links)", () => {
    const expired = (code = 403) => ({
      fatal: true,
      type: MockHls.ErrorTypes.NETWORK_ERROR,
      details: "fragLoadError",
      response: { code, text: "Forbidden" },
    });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it("reloads the stream from fresh URLs at the same position and play state", async () => {
      const refreshSource = vi.fn(async () => ({
        src: "https://cdn.test/fresh/master.m3u8",
        fallbackSrc: "https://cdn.test/fresh.mp4",
      }));
      const a = create({
        fallbackSrc: "https://cdn.test/video.mp4",
        refreshSource,
      });
      const first = lastHls();
      first.parseManifest(LEVELS);
      const onProgrammaticSeek = vi.fn();
      a.on("programmaticSeek", onProgrammaticSeek);
      paused = false;
      video.currentTime = 1234;

      first.trigger(MockHls.Events.ERROR, expired());
      expect(refreshSource).toHaveBeenCalledTimes(1);
      await flush();

      expect(first.destroy).toHaveBeenCalled();
      const second = lastHls();
      expect(second).not.toBe(first);
      expect(second.source).toBe("https://cdn.test/fresh/master.m3u8");
      expect(second.media).toBe(video);
      expect(a.getHls()).toBe(second);

      video.currentTime = 0;
      video.dispatchEvent(new Event("loadedmetadata"));
      await flush();
      expect(video.currentTime).toBe(1234);
      expect(onProgrammaticSeek).toHaveBeenCalled();
      expect(video.play).toHaveBeenCalled();
    });

    it("uses the refreshed fallback if the stream fails later", async () => {
      create({
        fallbackSrc: "https://cdn.test/video.mp4",
        refreshSource: async () => ({
          src: "https://cdn.test/fresh/master.m3u8",
          fallbackSrc: "https://cdn.test/fresh.mp4",
        }),
      });
      lastHls().trigger(MockHls.Events.ERROR, expired(401));
      await flush();
      lastHls().trigger(MockHls.Events.ERROR, {
        fatal: true,
        type: MockHls.ErrorTypes.OTHER_ERROR,
      });
      expect(video.src).toBe("https://cdn.test/fresh.mp4");
    });

    it("refreshes a plain video's expired link, resuming where it is when the links arrive", async () => {
      const refreshSource = vi.fn(async () => ({
        src: "https://cdn.test/lecture.mp4?sig=2",
      }));
      create({ src: "https://cdn.test/lecture.mp4?sig=1", refreshSource });
      video.currentTime = 48;
      video.dispatchEvent(new Event("error"));
      expect(refreshSource).toHaveBeenCalledTimes(1);
      video.currentTime = 50; // buffered video kept playing meanwhile
      await flush();
      expect(video.src).toBe("https://cdn.test/lecture.mp4?sig=2");
      video.dispatchEvent(new Event("loadedmetadata"));
      expect(video.currentTime).toBe(50);
    });

    it("refreshes at most once per cooldown, then handles errors as usual", async () => {
      const refreshSource = vi.fn(async () => ({
        src: "https://cdn.test/fresh/master.m3u8",
        fallbackSrc: "https://cdn.test/fresh.mp4",
      }));
      create({ fallbackSrc: "https://cdn.test/video.mp4", refreshSource });
      lastHls().trigger(MockHls.Events.ERROR, expired());
      await flush();
      // Still 403 with fresh links: not an expiry problem.
      lastHls().trigger(MockHls.Events.ERROR, expired());
      expect(refreshSource).toHaveBeenCalledTimes(1);
      expect(video.src).toBe("https://cdn.test/fresh.mp4");
    });

    it("falls back when the refresh fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      create({
        fallbackSrc: "https://cdn.test/video.mp4",
        refreshSource: async () => {
          throw new Error("offline");
        },
      });
      lastHls().trigger(MockHls.Events.ERROR, expired());
      await flush();
      expect(video.src).toBe("https://cdn.test/video.mp4");
      expect(error).toHaveBeenCalled();
    });

    it("refreshes on a 403 before hls.js gives up", async () => {
      const refreshSource = vi.fn(async () => ({
        src: "https://cdn.test/fresh/master.m3u8",
      }));
      create({ refreshSource });
      lastHls().parseManifest(LEVELS);
      lastHls().trigger(MockHls.Events.ERROR, {
        ...expired(),
        fatal: false,
        details: "levelLoadError",
      });
      expect(refreshSource).toHaveBeenCalledTimes(1);
      await flush();
      expect(lastHls().source).toBe("https://cdn.test/fresh/master.m3u8");
    });

    it("refreshes when hls.js gives up on a status-0 failure (storage 403 without CORS)", () => {
      const refreshSource = vi.fn(async () => ({
        src: "https://cdn.test/fresh/master.m3u8",
      }));
      create({ refreshSource });
      const hls = lastHls();
      hls.parseManifest(LEVELS);
      hls.trigger(MockHls.Events.ERROR, { ...expired(0), fatal: false });
      expect(refreshSource).not.toHaveBeenCalled();
      hls.trigger(MockHls.Events.ERROR, expired(0));
      expect(refreshSource).toHaveBeenCalledTimes(1);
      expect(hls.startLoad).not.toHaveBeenCalled();
    });

    it("leaves non-fatal errors other than 401/403 to hls.js", () => {
      const refreshSource = vi.fn();
      create({ refreshSource });
      lastHls().trigger(MockHls.Events.ERROR, {
        ...expired(500),
        fatal: false,
      });
      expect(refreshSource).not.toHaveBeenCalled();
    });

    it("ignores a refresh that finishes after destroy", async () => {
      let resolve!: (v: { src: string }) => void;
      const a = create({
        refreshSource: () => new Promise((r) => (resolve = r)),
      });
      lastHls().trigger(MockHls.Events.ERROR, expired());
      a.destroy();
      adapter = null;
      const count = MockHls.instances.length;
      resolve({ src: "https://cdn.test/fresh/master.m3u8" });
      await flush();
      expect(MockHls.instances).toHaveLength(count);
    });
  });

  describe("non-HLS sources", () => {
    it("plays an MP4 directly even where hls.js is supported", () => {
      const a = create({ src: "https://cdn.test/lecture.mp4" });
      expect(video.src).toBe("https://cdn.test/lecture.mp4");
      expect(MockHls.instances).toHaveLength(0);
      expect(a.getQualityLevels()).toEqual([]);
    });

    it("treats signed .m3u8 URLs with query strings as HLS", () => {
      create({ src: "https://api.test/hls/token/master.m3u8?x=1" });
      expect(MockHls.instances).toHaveLength(1);
    });

    it("lets type override detection", () => {
      create({ src: "https://cdn.test/stream?id=9", type: "hls" });
      expect(MockHls.instances).toHaveLength(1);
      adapter?.destroy();
      adapter = null;

      create({ src: "https://cdn.test/master.m3u8", type: "progressive" });
      expect(video.src).toBe("https://cdn.test/master.m3u8");
      expect(MockHls.instances).toHaveLength(1);
    });

    it("isHlsSource checks the URL path", () => {
      expect(isHlsSource({ src: "https://a.test/v/master.m3u8" })).toBe(true);
      expect(isHlsSource({ src: "https://a.test/v.M3U8?sig=1" })).toBe(true);
      expect(isHlsSource({ src: "https://a.test/v.mp4?f=x.m3u8" })).toBe(false);
      expect(isHlsSource({ src: "/local/video.webm" })).toBe(false);
    });
  });

  describe("MP4-only browsers", () => {
    beforeEach(() => {
      MockHls.supported = false;
    });

    it("plays the fallback source", () => {
      const a = create({ fallbackSrc: "https://cdn.test/video.mp4" });
      expect(video.src).toBe("https://cdn.test/video.mp4");
      expect(a.getQualityLevels()).toEqual([]);
    });

    it("leaves the video alone without a fallback source", () => {
      create();
      expect(video.getAttribute("src")).toBeNull();
    });
  });

  describe("destroy", () => {
    it("destroys hls.js and unwraps the video", () => {
      const parent = video.parentNode;
      const a = create();
      const hls = lastHls();
      const onQuality = vi.fn();
      a.on("qualitychange", onQuality);
      a.destroy();
      adapter = null;

      expect(hls.destroy).toHaveBeenCalled();
      expect(video.parentNode).toBe(parent);
      expect(a.getHls()).toBeNull();
    });

    it("stops reacting to video errors", () => {
      MockHls.supported = false;
      (video.canPlayType as ReturnType<typeof vi.fn>).mockReturnValue("maybe");
      const a = create({ fallbackSrc: "https://cdn.test/video.mp4" });
      a.destroy();
      adapter = null;
      video.src = "https://cdn.test/x.mp4";
      video.dispatchEvent(new Event("error"));
      expect(video.src).toBe("https://cdn.test/x.mp4");
    });
  });
});
