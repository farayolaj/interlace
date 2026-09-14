import { DEFAULT_STRINGS, type Strings } from "@interlace/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VIDEO_SOURCE_INPUT_STRINGS,
  VideoSourceInput,
  type VideoSourceInputStrings,
} from "./video-source-input";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeFile(name: string, type = "video/mp4"): File {
  return new File([new Blob(["fake-bytes"], { type })], name, { type });
}

/**
 * jsdom does not implement `HTMLInputElement.click` triggering the file
 * picker dialog. The component only relies on the file input's `change`
 * event, so we can dispatch it directly with a `FileList` and skip the
 * "click" entirely.
 */
function dispatchFileChange(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    value: [file],
    configurable: true,
  });
  fireEvent.change(input);
}

describe("VideoSourceInput", () => {
  it("shows the empty state when no value is provided", () => {
    render(
      <VideoSourceInput
        onChange={vi.fn()}
        onUpload={vi.fn(async () => "https://example.com/uploaded.mp4")}
      />,
    );

    expect(screen.getByTestId("video-source-input-empty")).toHaveTextContent(
      "No video selected yet.",
    );
  });

  it("shows the current source when value.src is set", () => {
    render(
      <VideoSourceInput
        value={{ src: "https://example.com/existing.mp4" }}
        onChange={vi.fn()}
        onUpload={vi.fn(async () => "https://example.com/uploaded.mp4")}
      />,
    );

    expect(
      screen.getByTestId("video-source-input-current-src").textContent,
    ).toBe("https://example.com/existing.mp4");
  });

  it("commits the URL draft when the user clicks apply", () => {
    const onChange = vi.fn();
    render(
      <VideoSourceInput
        onChange={onChange}
        onUpload={vi.fn(async () => "https://example.com/uploaded.mp4")}
      />,
    );

    const urlInput = screen.getByTestId(
      "video-source-input-url",
    ) as HTMLInputElement;
    fireEvent.change(urlInput, {
      target: { value: "  https://example.com/x.mp4  " },
    });

    fireEvent.click(screen.getByTestId("video-source-input-apply"));

    expect(onChange).toHaveBeenCalledWith({
      src: "https://example.com/x.mp4",
    });
  });

  it("commits the URL draft when the user presses Enter", () => {
    const onChange = vi.fn();
    render(
      <VideoSourceInput
        onChange={onChange}
        onUpload={vi.fn(async () => "https://example.com/uploaded.mp4")}
      />,
    );

    const urlInput = screen.getByTestId("video-source-input-url");
    fireEvent.change(urlInput, {
      target: { value: "https://example.com/x.mp4" },
    });
    fireEvent.keyDown(urlInput, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({
      src: "https://example.com/x.mp4",
    });
  });

  it("does not commit an empty URL draft", () => {
    const onChange = vi.fn();
    render(
      <VideoSourceInput
        onChange={onChange}
        onUpload={vi.fn(async () => "https://example.com/uploaded.mp4")}
      />,
    );

    const apply = screen.getByTestId(
      "video-source-input-apply",
    ) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);

    fireEvent.click(apply);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("awaits the upload promise and writes the resolved URL to onChange", async () => {
    let resolveUpload: ((url: string) => void) | undefined;
    const onUpload = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const onChange = vi.fn();

    render(<VideoSourceInput onChange={onChange} onUpload={onUpload} />);

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;

    dispatchFileChange(fileInput, makeFile("lecture.mp4"));

    // The onChange must not fire until the host resolves the upload.
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("video-source-input-uploading"),
    ).toBeInTheDocument();

    resolveUpload?.("https://cdn.example.com/lecture.mp4");

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        src: "https://cdn.example.com/lecture.mp4",
      });
    });
  });

  it("surfaces upload failure without crashing the host flow", async () => {
    const onError = vi.fn();
    const onChange = vi.fn();
    const onUpload = vi.fn(async () => {
      throw new Error("network unreachable");
    });

    render(
      <VideoSourceInput
        onChange={onChange}
        onUpload={onUpload}
        onError={onError}
      />,
    );

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;
    dispatchFileChange(fileInput, makeFile("lecture.mp4"));

    await waitFor(() => {
      expect(
        screen.getByTestId("video-source-input-error"),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("video-source-input-error")).toHaveTextContent(
      "network unreachable",
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(onChange).not.toHaveBeenCalled();

    // The component must still be mounted and renderable; the host flow is intact.
    expect(screen.getByTestId("video-source-input-apply")).toBeInTheDocument();
  });

  it("retry re-opens the file picker after a failure", async () => {
    let attempt = 0;
    const onUpload = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("first attempt failed");
      }
      return "https://cdn.example.com/ok.mp4";
    });
    const onChange = vi.fn();

    const { container } = render(
      <VideoSourceInput onChange={onChange} onUpload={onUpload} />,
    );

    const fileInput = container.querySelector(
      '[data-testid="video-source-input-file"]',
    ) as HTMLInputElement;
    dispatchFileChange(fileInput, makeFile("lecture.mp4"));

    await waitFor(() => {
      expect(
        screen.getByTestId("video-source-input-error"),
      ).toBeInTheDocument();
    });

    // Clicking retry clears the error and re-fires the file picker.
    const clickSpy = vi.spyOn(fileInput, "click");
    fireEvent.click(screen.getByTestId("video-source-input-retry"));
    expect(clickSpy).toHaveBeenCalled();

    // Simulate the user picking a file again.
    dispatchFileChange(fileInput, makeFile("lecture.mp4"));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        src: "https://cdn.example.com/ok.mp4",
      });
    });
  });

  it("disables both controls while uploading and re-enables after success", async () => {
    let resolveUpload: ((url: string) => void) | undefined;
    const onUpload = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    render(<VideoSourceInput onChange={vi.fn()} onUpload={onUpload} />);

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;
    const fileButton = screen.getByTestId(
      "video-source-input-file-button",
    ) as HTMLButtonElement;
    const apply = screen.getByTestId(
      "video-source-input-apply",
    ) as HTMLButtonElement;

    dispatchFileChange(fileInput, makeFile("lecture.mp4"));

    expect(fileButton.disabled).toBe(true);
    expect(fileInput.disabled).toBe(true);
    expect(apply.disabled).toBe(true);

    resolveUpload?.("https://cdn.example.com/lecture.mp4");

    await waitFor(() => {
      expect(fileButton.disabled).toBe(false);
    });
    expect(fileInput.disabled).toBe(false);
  });

  it("disables both controls when the disabled prop is true", () => {
    render(
      <VideoSourceInput
        onChange={vi.fn()}
        onUpload={vi.fn(async () => "x")}
        disabled
      />,
    );

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;
    const fileButton = screen.getByTestId(
      "video-source-input-file-button",
    ) as HTMLButtonElement;
    const urlInput = screen.getByTestId(
      "video-source-input-url",
    ) as HTMLInputElement;
    const apply = screen.getByTestId(
      "video-source-input-apply",
    ) as HTMLButtonElement;

    expect(fileInput.disabled).toBe(true);
    expect(fileButton.disabled).toBe(true);
    expect(urlInput.disabled).toBe(true);
    expect(apply.disabled).toBe(true);
  });

  it("applies string overrides", () => {
    render(
      <VideoSourceInput
        onChange={vi.fn()}
        onUpload={vi.fn(async () => "x")}
        strings={{
          noVideoSelectedLabel: "Pick a video to start.",
          uploadButtonLabel: "Pick file",
        }}
      />,
    );

    expect(screen.getByTestId("video-source-input-empty")).toHaveTextContent(
      "Pick a video to start.",
    );
    expect(
      screen.getByTestId("video-source-input-file-button"),
    ).toHaveTextContent("Pick file");
  });

  it("ignores a stale upload resolution after a newer selection starts", async () => {
    const slowUpload = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("https://slow.example.com/x.mp4"), 30);
        }),
    );
    const fastUpload = vi.fn(async () => "https://fast.example.com/x.mp4");
    const onChange = vi.fn();

    const { rerender } = render(
      <VideoSourceInput onChange={onChange} onUpload={slowUpload} />,
    );

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;

    dispatchFileChange(fileInput, makeFile("slow.mp4"));

    // Replace the onUpload prop (host swapped callback) and re-dispatch.
    rerender(<VideoSourceInput onChange={onChange} onUpload={fastUpload} />);
    dispatchFileChange(fileInput, makeFile("fast.mp4"));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        src: "https://fast.example.com/x.mp4",
      });
    });

    // The slow upload is *eventually* ignored. Allow it to settle then assert
    // no further onChange call was made.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall?.[0]).toEqual({ src: "https://fast.example.com/x.mp4" });
  });

  it("normalizes non-Error rejections into Error instances and reports them via onError", async () => {
    const onError = vi.fn();
    const onChange = vi.fn();
    // Hosts hand-write onUpload; rejecting with a non-Error value is realistic.
    const onUpload = vi.fn(async () => {
      throw "boom: 503 from CDN";
    });

    render(
      <VideoSourceInput
        onChange={onChange}
        onUpload={onUpload}
        onError={onError}
      />,
    );

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;
    dispatchFileChange(fileInput, makeFile("lecture.mp4"));

    await waitFor(() => {
      expect(
        screen.getByTestId("video-source-input-error"),
      ).toBeInTheDocument();
    });
    expect(onError).toHaveBeenCalledTimes(1);
    const reported = onError.mock.calls[0]?.[0] as unknown;
    expect(reported).toBeInstanceOf(Error);
    expect((reported as Error).message).toBe("boom: 503 from CDN");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores a stale failing upload if a newer selection has started", async () => {
    const slowFail = vi.fn(
      () =>
        new Promise<string>((_resolve, reject) => {
          setTimeout(() => reject(new Error("slow failure")), 30);
        }),
    );
    const fastOk = vi.fn(async () => "https://fast.example.com/x.mp4");
    const onError = vi.fn();
    const onChange = vi.fn();

    const { rerender } = render(
      <VideoSourceInput
        onChange={onChange}
        onUpload={slowFail}
        onError={onError}
      />,
    );

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;
    dispatchFileChange(fileInput, makeFile("slow.mp4"));

    // Host swaps the upload callback; a new selection starts.
    rerender(
      <VideoSourceInput
        onChange={onChange}
        onUpload={fastOk}
        onError={onError}
      />,
    );
    dispatchFileChange(fileInput, makeFile("fast.mp4"));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        src: "https://fast.example.com/x.mp4",
      });
    });

    // The slow failure settles later. The token check on the catch
    // path must prevent it from surfacing as an error or firing
    // onError.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(onError).not.toHaveBeenCalled();
    expect(screen.queryByTestId("video-source-input-error")).toBeNull();
  });

  it("drops a late resolution that arrives after the component unmounts", async () => {
    let resolveUpload: ((url: string) => void) | undefined;
    const onUpload = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const onChange = vi.fn();

    const { unmount } = render(
      <VideoSourceInput onChange={onChange} onUpload={onUpload} />,
    );

    const fileInput = screen.getByTestId(
      "video-source-input-file",
    ) as HTMLInputElement;
    dispatchFileChange(fileInput, makeFile("lecture.mp4"));

    unmount();

    // Resolving after unmount must not commit to onChange.
    resolveUpload?.("https://cdn.example.com/lecture.mp4");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("VideoSourceInputStrings", () => {
  it("extends the core Strings base (compile-time assignment check)", () => {
    // The line below fails to compile if VideoSourceInputStrings
    // stops extending Strings. It also serves as a runtime smoke
    // test that every core field is present on the defaults.
    const fromCore: Strings = DEFAULT_VIDEO_SOURCE_INPUT_STRINGS;
    expect(fromCore.cancelLabel).toBe(DEFAULT_STRINGS.cancelLabel);
    expect(fromCore.closeLabel).toBe(DEFAULT_STRINGS.closeLabel);
    expect(fromCore.submitLabel).toBe(DEFAULT_STRINGS.submitLabel);
  });

  it("exposes the video-source-specific fields alongside the core base", () => {
    expect(DEFAULT_VIDEO_SOURCE_INPUT_STRINGS.uploadLabel).toBe(
      "Upload a video file",
    );
    expect(DEFAULT_VIDEO_SOURCE_INPUT_STRINGS.uploadButtonLabel).toBe(
      "Choose file",
    );
    expect(DEFAULT_VIDEO_SOURCE_INPUT_STRINGS.applyUrlLabel).toBe("Use URL");
  });

  it("accepts a Partial<VideoSourceInputStrings> override that satisfies the base", () => {
    // A host passing just the video-source-specific fields gets the
    // core defaults for everything else. This is the contract.
    const override: Partial<VideoSourceInputStrings> = {
      uploadLabel: "Upload",
    };
    const merged: VideoSourceInputStrings = {
      ...DEFAULT_VIDEO_SOURCE_INPUT_STRINGS,
      ...override,
    };
    expect(merged.uploadLabel).toBe("Upload");
    // Core fields are still present.
    expect(merged.cancelLabel).toBe(DEFAULT_STRINGS.cancelLabel);
  });
});
