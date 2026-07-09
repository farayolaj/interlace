import { Hook } from "../hook/types";

export enum ContentState {
  PENDING = "pending",
  VISIBLE = "visible",
  OPEN = "open",
  COMPLETED = "completed",
  SKIPPED = "skipped",
}

export interface ContentRecord<TData = any> {
  id: string;
  title: string;
  contentTypeId: string;
  data: TData;
  state: ContentState;
  /** Score achieved (only set after completed) */
  resultScore?: number;
  hook: Hook;
}
