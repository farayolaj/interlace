import type {
  QualityCapableAdapter,
  QualityLevel,
  VideoAdapterEvent,
  VideoAdapterEventType,
} from "@interlacejs/core";
import { NativeVideoAdapter } from "@interlacejs/native-adapter";
import Hls, { type ErrorData, type HlsConfig, type Level } from "hls.js";

export interface HlsVideoAdapterOptions {
  /**
   * Video URL. HLS manifests (`.m3u8`) play through hls.js or the
   * browser's native HLS; any other source (e.g. an MP4) plays directly in
   * the `<video>` element, with no quality levels.
   */
  src: string;
  /**
   * Source type. `"auto"` (default) treats URLs whose path ends in `.m3u8`
   * as HLS; set `"hls"` for manifests served from other paths, or
   * `"progressive"` to always play `src` directly.
   */
  type?: "auto" | "hls" | "progressive";
  /**
   * Progressive source (e.g. an MP4) used when HLS cannot play: no hls.js
   * support and no native HLS, or an unrecoverable playback error.
   */
  fallbackSrc?: string;
  /** Extra hls.js configuration. */
  hlsConfig?: Partial<HlsConfig>;
  /**
   * localStorage key under which the viewer's quality choice is remembered
   * (as a height, or "auto"). Not remembered when omitted.
   */
  rememberQualityKey?: string;
}

type Listener = (event: VideoAdapterEvent) => void;

const AUTO = -1;
const HLS_MIME = "application/vnd.apple.mpegurl";

/**
 * HLS video adapter. Extends {@link NativeVideoAdapter} (play/pause/seek,
 * events, overlay mounting, fullscreen and destroy are reused) and adds
 * quality levels via hls.js.
 *
 * - hls.js supported: plays through hls.js and exposes the stream's levels.
 * - Native HLS (Safari/iOS): sets `video.src`; no levels are exposed.
 * - Neither: plays `fallbackSrc`, if given.
 *
 * Usage:
 *   const adapter = new HlsVideoAdapter(video, {
 *     src: "https://cdn.example.com/lesson/master.m3u8",
 *     fallbackSrc: "https://cdn.example.com/lesson.mp4",
 *     rememberQualityKey: "my-app:quality",
 *   });
 */
export class HlsVideoAdapter
  extends NativeVideoAdapter
  implements QualityCapableAdapter
{
  private readonly options: HlsVideoAdapterOptions;
  private hls: Hls | null = null;
  private levels: QualityLevel[] = [];
  private selectedLevel = AUTO;
  private activeLevel: number | null = null;
  private manifestLoaded = false;
  private networkRetried = false;
  private mediaRecovered = false;
  private usingFallback = false;
  private qualityListeners = new Set<Listener>();
  private readonly onVideoError = () => {
    // Only the native path reports failures here; hls.js reports its own.
    if (!this.hls) this.switchToFallback();
  };

  constructor(video: HTMLVideoElement, options: HlsVideoAdapterOptions) {
    super(video);
    this.options = options;
    video.addEventListener("error", this.onVideoError);

    if (!isHlsSource(options)) {
      // Plain video file: play it as-is (one quality, no menu).
      video.src = options.src;
    } else if (Hls.isSupported()) {
      this.attachHls();
    } else if (video.canPlayType(HLS_MIME)) {
      video.src = options.src;
    } else if (options.fallbackSrc) {
      this.usingFallback = true;
      video.src = options.fallbackSrc;
    }
  }

  getQualityLevels(): QualityLevel[] {
    return this.levels.map((level) => ({ ...level }));
  }

  getQualityLevel(): number {
    return this.selectedLevel;
  }

  getActiveQualityLevel(): number | null {
    return this.activeLevel;
  }

  setQualityLevel(id: number): void {
    if (!this.hls) return;
    const level = this.levels.find((l) => l.id === id);
    const next = level ? level.id : AUTO;
    this.selectedLevel = next;
    this.hls.currentLevel = next;
    this.rememberPreference(level ? String(level.height) : "auto");
    this.emitQualityChange();
  }

  on(eventType: VideoAdapterEventType, handler: Listener): () => void {
    if (eventType !== "qualitychange") return super.on(eventType, handler);
    this.qualityListeners.add(handler);
    return () => {
      this.qualityListeners.delete(handler);
    };
  }

  /** The hls.js instance while HLS plays through hls.js, else `null`. */
  getHls(): Hls | null {
    return this.hls;
  }

  destroy(): void {
    this.getVideoElement().removeEventListener("error", this.onVideoError);
    this.hls?.destroy();
    this.hls = null;
    this.qualityListeners.clear();
    super.destroy();
  }

  private attachHls(): void {
    const hls = new Hls(this.options.hlsConfig);
    this.hls = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.manifestLoaded = true;
      this.levels = toQualityLevels(data.levels);
      this.applyRememberedPreference();
      this.emitQualityChange();
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      this.activeLevel = this.toExposedId(data.level);
      this.emitQualityChange();
    });

    hls.on(Hls.Events.ERROR, (_event, data) => this.handleHlsError(data));

    hls.attachMedia(this.getVideoElement());
    hls.loadSource(this.options.src);
  }

  private handleHlsError(data: ErrorData): void {
    if (!data.fatal || !this.hls) return;
    if (
      data.type === Hls.ErrorTypes.NETWORK_ERROR &&
      this.manifestLoaded &&
      !this.networkRetried
    ) {
      this.networkRetried = true;
      this.hls.startLoad();
      return;
    }
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !this.mediaRecovered) {
      this.mediaRecovered = true;
      this.hls.recoverMediaError();
      return;
    }
    this.switchToFallback();
  }

  /**
   * Gives up on HLS: tears hls.js down and plays `fallbackSrc` from the
   * same position, keeping the paused state.
   */
  private switchToFallback(): void {
    const { fallbackSrc } = this.options;
    const video = this.getVideoElement();
    const time = video.currentTime;
    const wasPaused = video.paused;

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.levels = [];
    this.selectedLevel = AUTO;
    this.activeLevel = null;
    this.emitQualityChange();

    if (!fallbackSrc || this.usingFallback) return;
    this.usingFallback = true;
    video.addEventListener(
      "loadedmetadata",
      () => {
        if (time > 0) void this.seek(time);
        if (!wasPaused) {
          Promise.resolve()
            .then(() => video.play())
            .catch((err: unknown) => {
              console.error("Failed to resume fallback video:", err);
            });
        }
      },
      { once: true },
    );
    video.src = fallbackSrc;
  }

  private applyRememberedPreference(): void {
    const stored = this.readPreference();
    if (!stored || stored === "auto" || !this.hls) return;
    const height = Number(stored);
    if (!Number.isFinite(height) || this.levels.length === 0) return;
    // Levels are sorted high → low: take the first at or below the stored
    // height, else the lowest available.
    const level =
      this.levels.find((l) => l.height <= height) ??
      this.levels[this.levels.length - 1]!;
    this.selectedLevel = level.id;
    this.hls.currentLevel = level.id;
  }

  private readPreference(): string | null {
    const key = this.options.rememberQualityKey;
    if (!key) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private rememberPreference(value: string): void {
    const key = this.options.rememberQualityKey;
    if (!key) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private mode, quota): the choice is not kept.
    }
  }

  /** Maps an hls.js level index to the id of the exposed level of the same height. */
  private toExposedId(hlsIndex: number): number | null {
    const height = this.hls?.levels[hlsIndex]?.height;
    if (height === undefined) return null;
    return this.levels.find((l) => l.height === height)?.id ?? null;
  }

  private emitQualityChange(): void {
    const event: VideoAdapterEvent = { type: "qualitychange" };
    this.qualityListeners.forEach((handler) => handler(event));
  }
}

/**
 * One level per height (highest bitrate wins), sorted high → low. Ids are
 * the hls.js level indices, so they can be assigned to `hls.currentLevel`.
 */
function toQualityLevels(levels: Level[]): QualityLevel[] {
  const byHeight = new Map<number, QualityLevel>();
  levels.forEach((level, index) => {
    if (!level.height) return;
    const existing = byHeight.get(level.height);
    if (existing && (existing.bitrate ?? 0) >= (level.bitrate ?? 0)) return;
    byHeight.set(level.height, {
      id: index,
      height: level.height,
      bitrate: level.bitrate || undefined,
      label: `${level.height}p`,
    });
  });
  return [...byHeight.values()].sort((a, b) => b.height - a.height);
}

/** Whether the options describe an HLS manifest rather than a video file. */
export function isHlsSource(
  options: Pick<HlsVideoAdapterOptions, "src" | "type">,
): boolean {
  if (options.type === "hls") return true;
  if (options.type === "progressive") return false;
  let path = options.src;
  try {
    path = new URL(options.src, "http://localhost").pathname;
  } catch {
    // Not a URL: test the raw string.
  }
  return /\.m3u8$/i.test(path);
}
