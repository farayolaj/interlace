import { describe, expect, it } from "vitest";
import { ContentType } from "../content-type/types";
import { ContentInstance } from "./content-instance";

describe("ContentInstance", () => {
  const createMockContentType = (
    overrides?: Partial<ContentType>,
  ): ContentType => ({
    id: "quiz",
    version: 1,
    isScorable: true,
    getTotalScore: () => 100,
    getResultScore: () => 75,
    ...overrides,
  });

  it("starts in pending state", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    expect(instance.getState()).toBe("pending");
    expect(instance.isLocked()).toBe(false);
  });

  it("transitions through encounter -> open -> complete", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    const events: string[] = [];
    instance.on("encountered", () => events.push("encountered"));
    instance.on("opened", () => events.push("opened"));
    instance.on("completed", (e) => {
      events.push(`completed:${e.resultScore}`);
    });

    instance.encounter();
    expect(instance.getState()).toBe("encountered");

    instance.open();
    expect(instance.getState()).toBe("opened");

    instance.complete(75);
    expect(instance.getState()).toBe("completed");
    expect(instance.getResultScore()).toBe(75);
    expect(instance.isLocked()).toBe(true);

    expect(events).toEqual(["encountered", "opened", "completed:75"]);
  });

  it("locks content after completion", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    instance.encounter();
    instance.open();
    instance.complete(75);

    // Attempting to skip should be ignored
    instance.skip();
    expect(instance.getState()).toBe("completed");
  });

  it("prevents re-opening completed content", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    instance.encounter();
    instance.open();
    instance.complete(75);

    // Attempting to open again should be ignored
    instance.open();
    expect(instance.getState()).toBe("completed");
  });

  it("transitions skip -> locked prevents future operations", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    const events: string[] = [];
    instance.on("skipped", () => events.push("skipped"));
    instance.on("encountered", () => events.push("encountered"));

    instance.encounter();
    instance.skip();

    expect(instance.getState()).toBe("skipped");
    expect(events).toEqual(["encountered", "skipped"]);
  });

  it("allows resetting skipped content on rewind", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    instance.encounter();
    instance.skip();
    expect(instance.getState()).toBe("skipped");

    instance.resetIfSkipped();
    expect(instance.getState()).toBe("pending");

    // Now it can be encountered again
    instance.encounter();
    expect(instance.getState()).toBe("encountered");
  });

  it("does not reset completed content on rewind", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    instance.encounter();
    instance.open();
    instance.complete(75);

    instance.resetIfSkipped();
    expect(instance.getState()).toBe("completed");
  });

  it("supports close to return to encountered state", () => {
    const instance = new ContentInstance(
      {
        id: "c1",
        title: "Quiz 1",
        contentTypeId: "quiz",
        data: {},
        state: "pending",
        locked: false,
      },
      createMockContentType(),
    );

    const events: string[] = [];
    instance.on("closed", () => events.push("closed"));

    instance.encounter();
    instance.open();
    expect(instance.getState()).toBe("opened");

    instance.close();
    expect(instance.getState()).toBe("encountered");
    expect(events).toEqual(["closed"]);
  });
});
