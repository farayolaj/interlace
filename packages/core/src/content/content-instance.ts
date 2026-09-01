import { ContentType } from "../content-type/types";
import { EventEmitter } from "../events/event-emitter";
import { Hook } from "../hook/types";
import { ContentRecord, ContentState } from "./types";

export interface ContentInstanceEvents {
  visible: { contentId: string };
  opened: { contentId: string };
  completed: { contentId: string; resultScore?: number };
  skipped: { contentId: string };
}

/**
 * Wraps a ContentRecord and its resolved ContentType, managing lifecycle transitions.
 * It's essentially a state machine for content, ensuring that state transitions are valid and emitting events when they occur.
 * This class is used by the InteractiveMediaController to manage content instances during playback.
 */
export class ContentInstance<
  TData = unknown,
> extends EventEmitter<ContentInstanceEvents> {
  private record: ContentRecord<TData>;
  private contentType: ContentType<TData>;

  constructor(record: ContentRecord<TData>, contentType: ContentType<TData>) {
    super();
    this.record = record;
    this.contentType = contentType;
  }

  getId(): string {
    return this.record.id;
  }

  getTitle(): string {
    return this.record.title;
  }

  getContentTypeId(): string {
    return this.record.contentTypeId;
  }

  getContentTypeVersion(): number {
    return this.contentType.getVersion();
  }

  getState(): ContentState {
    return this.record.state;
  }

  getData(): TData {
    return this.record.data;
  }

  getHook(): Hook {
    return this.record.hook;
  }

  getResultScore(): number | undefined {
    return this.record.resultScore;
  }

  getMaximumScore(): number | undefined {
    return this.contentType.getMaximumScore(this.record.data);
  }

  /**
   * Non-blocking content can be made visible without opening it.
   * This is typically used for content that has a visual representation (like an anchor) but doesn't require immediate interaction.
   */
  visible(): void {
    if (this.record.hook.type === "blocking") {
      return;
    }

    if (
      this.record.state === ContentState.PENDING ||
      this.record.state === ContentState.SKIPPED
    ) {
      this.record.state = ContentState.VISIBLE;
      this.emit("visible", { contentId: this.record.id });
    }
  }

  /**
   * Opens the content for interaction.
   */
  open(): void {
    if (
      this.record.state === ContentState.PENDING ||
      this.record.state === ContentState.SKIPPED ||
      this.record.state === ContentState.VISIBLE
    ) {
      this.record.state = ContentState.OPEN;
      this.emit("opened", { contentId: this.record.id });
    }
  }

  /**
   * Marks content as completed with a result score.
   */
  complete(resultScore?: number): void {
    if (this.record.state === ContentState.OPEN) {
      this.record.state = ContentState.COMPLETED;
      this.record.resultScore = resultScore;
      this.emit("completed", { contentId: this.record.id, resultScore });
    }
  }

  /**
   * Marks content as skipped (closed before completion).
   */
  skip(): void {
    if (
      this.record.state === ContentState.PENDING ||
      this.record.state === ContentState.OPEN ||
      this.record.state === ContentState.VISIBLE
    ) {
      this.record.state = ContentState.SKIPPED;
      this.emit("skipped", { contentId: this.record.id });
    }
  }
}
