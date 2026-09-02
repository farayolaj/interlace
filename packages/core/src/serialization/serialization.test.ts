import { describe, expect, it } from "vitest";
import { ContentTypeRegistry } from "../content-type/types";
import { ContentInstance } from "../content/content-instance";
import { ContentState } from "../content/types";
import {
  fakeContentInstance,
  fakeContentRecord,
} from "../fakes/content-instance";
import { fakeContentType } from "../fakes/content-type";
import { Hook } from "../hook/types";
import { deserialize } from "./deserialize";
import { SerializedInteractiveMediaDocument } from "./schema";
import { serialize } from "./serialize";

describe("serialization", () => {
  const createInstance = ({
    id,
    contentTypeId = "quiz",
    hook,
  }: {
    id: string;
    contentTypeId?: string;
    hook?: Hook;
  }): ContentInstance => {
    return fakeContentInstance({
      record: fakeContentRecord({
        id,
        title: `Content ${id}`,
        contentTypeId,
        data: { question: "Test?" },
        state: ContentState.PENDING,
        hook,
      }),
      contentType: fakeContentType({
        getId: () => contentTypeId,
        getVersion: () => 1,
        getMaximumScore: () => 100,
        renderEditor: () => {},
        renderPlayback: () => {},
      }),
    });
  };

  it("round-trips items through serialize/deserialize", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {},
    });

    const items: ContentInstance[] = [
      createInstance({
        id: "c1",
        hook: {
          type: "blocking",
          timestamp: 10,
          placement: { x: 50, y: 50, width: 20, height: 20 },
        },
      }),
    ];

    const serialized = serialize(items, "https://example.com/video.mp4", 60);

    expect(serialized.video.src).toBe("https://example.com/video.mp4");
    expect(serialized.video.duration).toBe(60);
    expect(serialized.items).toHaveLength(1);
    expect(serialized.items[0]?.id).toBe("c1");
    expect(serialized.items[0]?.hook?.type).toBe("blocking");
  });

  it("preserves authored data across round-trip", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {},
    });

    const data = {
      question: "What is X?",
      choices: ["a", "b"],
      answer: 1,
    };

    const instance = fakeContentInstance({
      record: fakeContentRecord({
        id: "c1",
        title: "Content c1",
        contentTypeId: "quiz",
        data,
        state: ContentState.PENDING,
        hook: {
          type: "blocking",
          timestamp: 10,
          placement: { x: 50, y: 50, width: 20, height: 20 },
        },
      }),
      contentType: fakeContentType({
        getId: () => "quiz",
        getVersion: () => 1,
        getMaximumScore: () => 100,
        renderEditor: () => {},
        renderPlayback: () => {},
      }),
    });

    const serialized = serialize([instance], "https://example.com/video.mp4", 60);
    const result = deserialize(serialized, registry);

    expect(result.validationErrors).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.getData()).toEqual(data);
  });

  it("deserializes valid document", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {},
    });

    const doc: SerializedInteractiveMediaDocument = {
      video: { src: "https://example.com/video.mp4", duration: 60 },
      items: [
        {
          id: "c1",
          title: "Quiz 1",
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz",
            version: 1,
            data: { question: "Test?" },
          },
        },
      ],
    };

    const result = deserialize(doc, registry);

    expect(result.validationErrors).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.getId()).toBe("c1");
    expect(result.videoSrc).toBe("https://example.com/video.mp4");
    expect(result.videoDuration).toBe(60);
  });

  it("skips unrecognized content types and emits warning", () => {
    const registry = new ContentTypeRegistry();

    const doc: SerializedInteractiveMediaDocument = {
      video: { src: "https://example.com/video.mp4" },
      items: [
        {
          id: "c1",
          title: "Quiz 1",
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "unknown",
            version: 1,
            data: {},
          },
        },
      ],
    };

    const result = deserialize(doc, registry);

    expect(result.items).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("unrecognized content type");
  });

  it("rejects document with hook overlap", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      getId: () => "quiz",
      getVersion: () => 1,
      getMaximumScore: () => undefined,
      renderEditor: () => {},
      renderPlayback: () => {},
    });

    const doc: SerializedInteractiveMediaDocument = {
      video: { src: "https://example.com/video.mp4" },
      items: [
        {
          id: "c1",
          title: "Quiz 1",
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz",
            version: 1,
            data: {},
          },
        },
        {
          id: "c2",
          title: "Quiz 2",
          hook: {
            type: "blocking",
            timestamp: 10.5,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: {
            contentTypeId: "quiz",
            version: 1,
            data: {},
          },
        },
      ],
    };

    const result = deserialize(doc, registry);

    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(result.validationErrors[0]).toContain("HOOK_OVERLAP");
  });
});
