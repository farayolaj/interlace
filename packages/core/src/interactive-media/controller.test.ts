import { describe, expect, it } from "vitest";
import { ContentInstance } from "../content/content-instance";
import { InteractiveMediaController } from "./controller";

describe("InteractiveMediaController", () => {
  const createInstance = (
    id: string,
    contentTypeId = "quiz",
  ): ContentInstance => {
    const record = {
      id,
      title: `Content ${id}`,
      contentTypeId,
      data: {},
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

  it("triggers blocking hook at timestamp", () => {
    const instance = createInstance("c1");
    const controller = new InteractiveMediaController(
      [
        {
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: instance,
        },
      ],
      60,
    );

    const requestPauseCalls: any[] = [];
    controller.on("requestPause", () => requestPauseCalls.push(true));

    controller.tick(5);
    expect(instance.getState()).toBe("pending");
    expect(requestPauseCalls).toHaveLength(0);

    controller.tick(10);
    expect(instance.getState()).toBe("opened");
    expect(requestPauseCalls).toHaveLength(1);
  });

  it("encounters non-blocking hook within time range", () => {
    const instance = createInstance("c1");
    const controller = new InteractiveMediaController(
      [
        {
          hook: {
            type: "non-blocking",
            start: 10,
            end: 20,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: instance,
        },
      ],
      60,
    );

    controller.tick(5);
    expect(instance.getState()).toBe("pending");

    controller.tick(15);
    expect(instance.getState()).toBe("encountered");
  });

  it("snaps back on forward seek past unfinished blocking content", () => {
    const instance1 = createInstance("c1");
    const instance2 = createInstance("c2");

    const controller = new InteractiveMediaController(
      [
        {
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: instance1,
        },
        {
          hook: {
            type: "blocking",
            timestamp: 20,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: instance2,
        },
      ],
      60,
    );

    controller.tick(5);

    const seekCalls: number[] = [];
    controller.on("requestSeek", (e) => seekCalls.push(e.timeInSeconds));

    // User seeks forward past first unfinished blocking content
    controller.handleUserSeek(25);

    // Should snap back to first blocking content at timestamp 10
    expect(seekCalls).toContainEqual(10);
  });

  it("resets skipped content on rewind", () => {
    const instance = createInstance("c1");
    const controller = new InteractiveMediaController(
      [
        {
          hook: {
            type: "non-blocking",
            start: 10,
            end: 20,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: instance,
        },
      ],
      60,
    );

    controller.tick(15); // Encounter content
    expect(instance.getState()).toBe("encountered");

    instance.skip(); // Manually skip it
    expect(instance.getState()).toBe("skipped");

    controller.handleUserSeek(5); // Rewind past it
    expect(instance.getState()).toBe("pending"); // Reset for re-encounter
  });

  it("marks active non-blocking content as skipped at video end", () => {
    const instance = createInstance("c1");
    const controller = new InteractiveMediaController(
      [
        {
          hook: {
            type: "non-blocking",
            start: 50,
            end: 60,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: instance,
        },
      ],
      60,
    );

    const finishedEvents: any[] = [];
    controller.on("finished", (e) => finishedEvents.push(e));

    controller.tick(55); // Encounter
    expect(instance.getState()).toBe("encountered");

    controller.tick(60); // Video ends
    expect(instance.getState()).toBe("skipped");
    expect(finishedEvents).toHaveLength(1);
  });

  it("returns render state for visible anchors", () => {
    const instance1 = createInstance("c1");
    const instance2 = createInstance("c2");

    const controller = new InteractiveMediaController(
      [
        {
          hook: {
            type: "non-blocking",
            start: 10,
            end: 20,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: instance1,
        },
        {
          hook: {
            type: "non-blocking",
            start: 30,
            end: 40,
            placement: { x: 50, y: 50, width: 20, height: 20 },
            revealBehavior: "click",
          },
          content: instance2,
        },
      ],
      60,
    );

    controller.tick(15);
    let state = controller.getRenderState(15);
    expect(state.visibleAnchorIds).toContain("c1");
    expect(state.visibleAnchorIds).not.toContain("c2");

    controller.tick(35);
    state = controller.getRenderState(35);
    expect(state.visibleAnchorIds).not.toContain("c1");
    expect(state.visibleAnchorIds).toContain("c2");
  });

  it("computes aggregated result", () => {
    const instance1 = createInstance("c1");
    const instance2 = createInstance("c2");

    const controller = new InteractiveMediaController(
      [
        {
          hook: {
            type: "blocking",
            timestamp: 10,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: instance1,
        },
        {
          hook: {
            type: "blocking",
            timestamp: 20,
            placement: { x: 50, y: 50, width: 20, height: 20 },
          },
          content: instance2,
        },
      ],
      60,
    );

    let finishedResult: any;
    controller.on("finished", (e) => {
      finishedResult = e.aggregatedResult;
    });

    controller.tick(10);
    instance1.complete(75);

    controller.tick(20);
    instance2.skip();

    controller.tick(60);

    expect(finishedResult).toBeDefined();
    expect(finishedResult.numerator).toBe(75);
    expect(finishedResult.denominator).toBe(200);
    expect(finishedResult.percentage).toBe(37.5);
  });
});
