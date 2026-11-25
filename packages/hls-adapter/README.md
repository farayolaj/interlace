# @interlacejs/hls-adapter

An HLS implementation of the [`@interlacejs/core`](https://github.com/farayolaj/interlace) `VideoAdapter` contract, built on [hls.js](https://github.com/video-dev/hls.js). It extends `NativeVideoAdapter` from `@interlacejs/native-adapter` (play/pause/seek, `programmaticSeek`, overlay mounting, fullscreen and `destroy()` behave the same) and adds the optional **quality** capability, so `@interlacejs/player` shows its built-in quality menu.

## Install

```bash
pnpm add @interlacejs/hls-adapter @interlacejs/core hls.js
```

`hls.js` (^1.5) is a peer dependency.

## Usage

```tsx
import { HlsVideoAdapter } from "@interlacejs/hls-adapter";
import { InteractiveVideoPlayer } from "@interlacejs/player";

function Watch({ doc, hlsUrl, mp4Url }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [adapter, setAdapter] = useState<HlsVideoAdapter>();

  useEffect(() => {
    if (!videoRef.current) return;
    const a = new HlsVideoAdapter(videoRef.current, {
      src: hlsUrl, // .m3u8 manifest
      fallbackSrc: mp4Url, // optional progressive fallback
      rememberQualityKey: "my-app:video-quality", // optional
    });
    setAdapter(a);
    return () => a.destroy();
  }, [hlsUrl, mp4Url]);

  return (
    <div style={{ position: "relative" }}>
      {/* No src: the adapter sets the source. */}
      <video ref={videoRef} controls />
      {adapter && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <InteractiveVideoPlayer
            adapter={adapter}
            document={doc}
            registry={registry}
          />
        </div>
      )}
    </div>
  );
}
```

Don't set `src` on the `<video>` yourself; the adapter picks the source.

## Options

| Option               | Description                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src`                | Video URL (required): an HLS manifest (`.m3u8`) or a plain video file such as an MP4.                           |
| `type`               | `"auto"` (default: HLS when the URL path ends in `.m3u8`), `"hls"` or `"progressive"`.                          |
| `fallbackSrc`        | Progressive source (e.g. MP4) for browsers without HLS support and for unrecoverable errors.                    |
| `hlsConfig`          | `Partial<HlsConfig>` passed to `new Hls()`.                                                                     |
| `rememberQualityKey` | localStorage key for the viewer's quality choice (stored as a height or `"auto"`). Not remembered when omitted. |

## Playback paths

- **Plain video files** (`src` isn't HLS, e.g. an MP4): played directly in the `<video>` element, like `NativeVideoAdapter`. There is one quality, so `getQualityLevels()` returns `[]` and the player shows no quality menu. You can use this adapter for every video and let it pick the path.
- **hls.js** (`Hls.isSupported()`, most desktop and Android browsers): attaches hls.js and loads `src`. Once the manifest is parsed, levels are exposed one per height (highest bitrate wins), sorted high to low and labelled `720p`, etc. A remembered choice is re-applied (the same height, or the nearest lower one), and `qualitychange` fires.
- **Native HLS** (Safari, iOS): sets `video.src = src`. The browser picks the quality, so `getQualityLevels()` returns `[]` and the player hides its quality menu.
- **Neither**: plays `fallbackSrc`, if given.

## Quality API

`HlsVideoAdapter` implements `QualityCapableAdapter` from `@interlacejs/core`:

```ts
getQualityLevels(): QualityLevel[]; // [] until the manifest loads, and on the native/fallback paths
getQualityLevel(): number; // selected id, -1 = Auto
getActiveQualityLevel(): number | null; // the level playing right now (useful in Auto)
setQualityLevel(id: number): void; // -1 = Auto; persisted under rememberQualityKey
```

`qualitychange` fires when the levels load or are cleared, when the selection changes, and when hls.js switches the level that is playing. `getHls()` returns the hls.js instance (or `null`) if you need lower-level access.

## Error handling

- Fatal network error after the manifest loaded: `hls.startLoad()` is retried once.
- Fatal media error: `hls.recoverMediaError()` is tried once.
- Anything else, or a repeated failure: hls.js is destroyed and the adapter switches to `fallbackSrc` (if given), keeping the current time and paused state. The position is restored with the adapter's own `seek()`, so the player receives `programmaticSeek`, not a user `seek`. Levels become `[]` and `qualitychange` fires.
- On the native HLS path, a `<video>` `error` event switches to `fallbackSrc` in the same way.

## License

ISC
