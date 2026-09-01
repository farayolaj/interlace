import { describe, expect, it } from "vitest";
import { fakeContentInstance } from "../fakes/content-instance";
import { fakeHook } from "../fakes/hook";
import { ContentState } from "./types";

describe("ContentInstance", () => {
  it("starts in pending state", () => {
    const instance = fakeContentInstance({
      record: {
        state: ContentState.PENDING,
      },
    });

    expect(instance.getState()).toBe(ContentState.PENDING);
  });

  it("transitions through visible -> open -> complete for non-blocking instance", () => {
    const instance = fakeContentInstance({
      record: {
        state: ContentState.PENDING,
        hook: fakeHook("non-blocking"),
      },
    });
    const events: string[] = [];
    instance.on("visible", () => events.push("visible"));
    instance.on("opened", () => events.push("opened"));
    instance.on("completed", (e) => {
      events.push(`completed:${e.resultScore}`);
    });

    instance.visible();
    expect(instance.getState()).toBe(ContentState.VISIBLE);

    instance.open();
    expect(instance.getState()).toBe(ContentState.OPEN);

    instance.complete(75);
    expect(instance.getState()).toBe(ContentState.COMPLETED);
    expect(instance.getResultScore()).toBe(75);

    expect(events).toEqual(["visible", "opened", "completed:75"]);
  });

  it("locks content after completion", () => {
    const instance = fakeContentInstance();

    instance.visible();
    instance.open();
    instance.complete(75);

    // Attempting to skip should be ignored
    instance.skip();
    expect(instance.getState()).toBe(ContentState.COMPLETED);
  });

  it("prevents re-opening completed content", () => {
    const instance = fakeContentInstance();

    instance.visible();
    instance.open();
    instance.complete(75);

    // Attempting to open again should be ignored
    instance.open();
    expect(instance.getState()).toBe(ContentState.COMPLETED);
  });

  it("transitions skip -> locked prevents future operations", () => {
    const instance = fakeContentInstance();

    const events: string[] = [];
    instance.on("skipped", () => events.push("skipped"));

    instance.open();
    instance.skip();

    expect(instance.getState()).toBe(ContentState.SKIPPED);
    expect(events).toEqual(["skipped"]);
  });

  it("allows reopening skipped content on rewind", () => {
    const instance = fakeContentInstance();

    instance.visible();
    instance.skip();
    expect(instance.getState()).toBe(ContentState.SKIPPED);

    instance.open();
    expect(instance.getState()).toBe(ContentState.OPEN);
  });
});
