/**
 * Content state and data types.
 */

export type ContentState =
  | "pending"
  | "encountered"
  | "opened"
  | "completed"
  | "skipped";

export interface ContentRecord {
  id: string;
  title: string;
  contentTypeId: string;
  data: any;
  state: ContentState;
  /** Score achieved (only set after completed) */
  resultScore?: number;
  /** Whether this content is locked in place (completed content cannot be re-interacted) */
  locked: boolean;
}
