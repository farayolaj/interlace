# @interlacejs/native-adapter

A HTML5 `<video>` implementation of the [`@interlacejs/core`](https://github.com/farayolaj/interlace) `VideoAdapter` contract.

## What's inside

- **`NativeVideoAdapter`** — wraps an `HTMLVideoElement`: programmatic play/pause/seek, event surfacing, overlay mounting, and fullscreen. The constructor reparents the element into the player's relative wrapper (use `destroy()` to unwrap and restore the original styles).
- **`ProgrammaticActionGuard`** — distinguishes self-triggered events (the library's own play/pause/seek calls) from user-driven ones, preventing event feedback loops.

## Install

```bash
pnpm add @interlacejs/native-adapter @interlacejs/core
```

## Minimal example

```tsx
import { NativeVideoAdapter } from "@interlacejs/native-adapter";
import { InteractiveVideoPlayer } from "@interlacejs/player";

function Watch({ doc }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [adapter, setAdapter] = useState<NativeVideoAdapter>();

  useEffect(() => {
    if (!videoRef.current) return;
    const a = new NativeVideoAdapter(videoRef.current);
    setAdapter(a);
    return () => a.destroy?.();
  }, []);

  return (
    <>
      <video ref={videoRef} src={doc.video.src} controls />
      {adapter && <InteractiveVideoPlayer adapter={adapter} document={doc} registry={registry} />}
    </>
  );
}
```

`registry` is a `ContentTypeRegistry` (see [`@interlacejs/quiz`](https://github.com/farayolaj/interlace) for an example registration).

## License

ISC
