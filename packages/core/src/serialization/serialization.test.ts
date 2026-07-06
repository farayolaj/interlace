import { describe, expect, it } from "vitest";
import { ContentTypeRegistry } from "../content-type/types";
import { ContentInstance } from "../content/content-instance";
import { InteractiveMediaItem } from "../interactive-media/controller";
import { deserialize } from "./deserialize";
import { SerializedInteractiveMediaDocument } from "./schema";
import { serialize } from "./serialize";

describe("serialization", () => {
  const createInstance = (
    id: string,
    contentTypeId = "quiz",
  ): ContentInstance => {
    const record = {
      id,
      title: `Content ${id}`,
      contentTypeId,
      data: { question: "Test?" },
      state: "pending" as const,
      locked: false,
    };

    const contentType = {
      id: contentTypeId,
      version: 1,
      isScorable: true,
      getTotalScore: () => 100,
      getResultScore: () => 100,
    };

    return new ContentInstance(record, contentType);
  };

  it("round-trips items through serialize/deserialize", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      id: "quiz",
      version: 1,
      isScorable: true,
      getTotalScore: () => 100,
    });

    const items: InteractiveMediaItem[] = [
      {
        hook: {
          type: "blocking",
          timestamp: 10,
          placement: { x: 50, y: 50, width: 20, height: 20 },
        },
        content: createInstance("c1"),
      },
    ];

    const serialized = serialize(
      items,
      "https://example.com/video.mp4",
      60,
      "native",
    );

    expect(serialized.video.src).toBe("https://example.com/video.mp4");
    expect(serialized.video.duration).toBe(60);
    expect(serialized.video.adapterType).toBe("native");
    expect(serialized.items).toHaveLength(1);
    expect(serialized.items[0]?.id).toBe("c1");
    expect(serialized.items[0]?.hook?.type).toBe("blocking");
  });

  it("deserializes valid document", () => {
    const registry = new ContentTypeRegistry();
    registry.register({
      id: "quiz",
      version: 1,
      isScorable: true,
      getTotalScore: () => 100,
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
    expect(result.items[0]?.content?.getId()).toBe("c1");
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
      id: "quiz",
      version: 1,
      isScorable: true,
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
