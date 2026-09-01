import { ContentType } from "../content-type/types";

export function fakeContentType(overrides?: Partial<ContentType>): ContentType {
  return {
    getId: () => "quiz",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: () => {},
    renderPlayback: () => {},
    ...overrides,
  };
}
