import { ContentType } from "../content-type/types";

export function fakeContentType(overrides?: Partial<ContentType>): ContentType {
  return {
    getId: () => "quiz",
    getVersion: () => 1,
    isScorable: () => true,
    getTotalScore: () => 100,
    getResultScore: () => 75,
    renderEditor: () => {},
    renderPlayback: () => {},
    ...overrides,
  };
}
