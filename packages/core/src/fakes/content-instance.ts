import { ContentType } from "../content-type/types";
import { ContentInstance } from "../content/content-instance";
import { ContentRecord, ContentState } from "../content/types";
import { fakeContentType } from "./content-type";
import { fakeHook } from "./hook";

export function fakeContentRecord(
  overrides?: Partial<ContentRecord>,
): ContentRecord {
  return {
    id: "c1",
    title: "Quiz 1",
    contentTypeId: "quiz",
    data: {},
    hook: fakeHook(overrides?.hook?.type ?? "blocking", overrides?.hook),
    state: ContentState.PENDING,
    resultScore: undefined,
    ...overrides,
  };
}

export function fakeContentInstance(overrides?: {
  record?: Partial<ContentRecord>;
  contentType?: Partial<ContentType>;
}): ContentInstance {
  const record = fakeContentRecord(overrides?.record);
  const contentType = fakeContentType(overrides?.contentType);
  return new ContentInstance(record, contentType);
}
