import { ContentType } from "../content-type/types";
import { EventEmitter } from "../events/event-emitter";
import { ContentRecord, ContentState } from "./types";

export interface ContentInstanceEvents {
  encountered: { contentId: string };
  opened: { contentId: string };
  completed: { contentId: string; resultScore: number };
  closed: { contentId: string };
  skipped: { contentId: string };
}

/**
 * Wraps a ContentRecord and its resolved ContentType, managing lifecycle transitions.
 */
export class ContentInstance extends EventEmitter<ContentInstanceEvents> {
  private record: ContentRecord;
  private contentType: ContentType;

  constructor(record: ContentRecord, contentType: ContentType) {
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

  getState(): ContentState {
    return this.record.state;
  }

  getData(): any {
    return this.record.data;
  }

  getResultScore(): number | undefined {
    return this.record.resultScore;
  }

  isLocked(): boolean {
    return this.record.locked;
  }

  isScorable(): boolean {
    return this.contentType.isScorable;
  }

  getTotalScore(): number {
    if (!this.contentType.isScorable || !this.contentType.getTotalScore) {
      return 0;
    }
    return this.contentType.getTotalScore(this.record.data);
  }

  /**
   * Marks content as encountered (seen during forward playback).
   */
  encounter(): void {
    if (this.record.state !== "pending") {
      return; // Already encountered or in another state
    }
    this.record.state = "encountered";
    this.emit("encountered", { contentId: this.record.id });
  }

  /**
   * Opens the content for interaction.
   */
  open(): void {
    if (this.record.state === "completed" || this.record.locked) {
      return; // Cannot reopen completed content
    }
    this.record.state = "opened";
    this.emit("opened", { contentId: this.record.id });
  }

  /**
   * Marks content as completed with a result score.
   */
  complete(resultScore: number): void {
    if (this.record.locked) {
      return; // Already completed
    }
    this.record.state = "completed";
    this.record.resultScore = resultScore;
    this.record.locked = true;
    this.emit("completed", { contentId: this.record.id, resultScore });
  }

  /**
   * Closes opened content without completing it.
   */
  close(): void {
    if (this.record.state === "opened") {
      this.record.state = "encountered";
      this.emit("closed", { contentId: this.record.id });
    }
  }

  /**
   * Marks content as skipped (e.g., hook window closed before completion).
   */
  skip(): void {
    if (this.record.locked) {
      return; // Cannot skip completed content
    }
    this.record.state = "skipped";
    this.emit("skipped", { contentId: this.record.id });
  }

  /**
   * Resets state for rewind scenarios (only works for skipped content).
   */
  resetIfSkipped(): void {
    if (this.record.state === "skipped") {
      this.record.state = "pending";
    }
  }
}
