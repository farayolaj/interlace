import { describe, expect, it } from "vitest";
import { ContentInstance } from "../content/content-instance";
import { ContentState } from "../content/types";
import {
  fakeContentInstance,
  fakeContentRecord,
} from "../fakes/content-instance";
import { fakeContentType } from "../fakes/content-type";
import { Hook } from "../hook/types";
import { InteractiveMediaController } from "./controller";

describe("InteractiveMediaController", () => {
  const createInstance = ({
    id,
    contentTypeId = "quiz",
    hook,
  }: {
    id: string;
    contentTypeId?: string;
    hook?: Hook;
  }): ContentInstance => {
    const record = fakeContentRecord({
      id,
      title: `Content ${id}`,
      contentTypeId,
      data: {},
      state: ContentState.PENDING,
      hook,
    });

    const contentType = fakeContentType({
      getId: () => contentTypeId,
      getVersion: () => 1,
      getMaximumScore: () => 100,
      renderEditor: () => {},
      renderPlayback: () => {},
    });

    return fakeContentInstance({ record, contentType });
  };

  it("triggers blocking hook at timestamp", () => {
    const instance = createInstance({
      id: "c1",
      hook: {
        type: "blocking",
        timestamp: 10,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
    });
    const controller = new InteractiveMediaController([instance], 60);

    const requestPauseCalls: any[] = [];
    controller.on("requestPause", () => requestPauseCalls.push(true));

    controller.tick(5);
    expect(instance.getState()).toBe(ContentState.PENDING);
    expect(requestPauseCalls).toHaveLength(0);

    controller.tick(10);
    expect(instance.getState()).toBe(ContentState.OPEN);
    expect(requestPauseCalls).toHaveLength(1);
  });

  it("encounters non-blocking hook within time range", () => {
    const instance = createInstance({
      id: "c1",
      hook: {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });
    const controller = new InteractiveMediaController([instance], 60);

    controller.tick(5);
    expect(instance.getState()).toBe(ContentState.PENDING);

    controller.tick(15);
    expect(instance.getState()).toBe(ContentState.VISIBLE);
  });

  it("snaps back on forward seek past unfinished blocking content", () => {
    const instance1 = createInstance({
      id: "c1",
      hook: {
        type: "blocking",
        timestamp: 10,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
    });

    const instance2 = createInstance({
      id: "c2",
      hook: {
        type: "blocking",
        timestamp: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
    });

    const controller = new InteractiveMediaController(
      [instance1, instance2],
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

  it("skips content on play past it", () => {
    const instance = createInstance({
      id: "c1",
      hook: {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });
    const controller = new InteractiveMediaController([instance], 60);

    controller.tick(15); // Encounter content
    expect(instance.getState()).toBe(ContentState.VISIBLE);

    controller.tick(25); // Manually skip it
    expect(instance.getState()).toBe(ContentState.SKIPPED);
  });

  it("marks active non-blocking content as skipped at video end", () => {
    const instance = createInstance({
      id: "c1",
      hook: {
        type: "non-blocking",
        start: 50,
        end: 60,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });
    const controller = new InteractiveMediaController([instance], 60);

    const finishedEvents: any[] = [];
    controller.on("finished", (e) => finishedEvents.push(e));

    controller.tick(55); // Encounter
    expect(instance.getState()).toBe(ContentState.VISIBLE);

    controller.tick(60); // Video ends
    expect(instance.getState()).toBe("skipped");
    expect(finishedEvents).toHaveLength(1);
  });

  it("returns render state for visible anchors", () => {
    const instance1 = createInstance({
      id: "c1",
      hook: {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });
    const instance2 = createInstance({
      id: "c2",
      hook: {
        type: "non-blocking",
        start: 30,
        end: 40,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });

    const controller = new InteractiveMediaController(
      [instance1, instance2],
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

  it("keeps a skipped non-blocking hook anchored inside its in-frame window", () => {
    const instance = createInstance({
      id: "c1",
      hook: {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });
    const controller = new InteractiveMediaController([instance], 60);

    controller.tick(15); // Encounter -> VISIBLE
    instance.skip(); // Earlier open went out-of-frame; auto-skipped
    expect(instance.getState()).toBe(ContentState.SKIPPED);

    // Still in-window: the anchor id renders so the hook can be re-taken.
    const inFrame = controller.getRenderState(15);
    expect(inFrame.visibleAnchorIds).toContain("c1");
    expect(inFrame.completedTagIds).not.toContain("c1");
  });

  it("never anchors a completed non-blocking hook (tag only, no re-take)", () => {
    const instance = createInstance({
      id: "c1",
      hook: {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });
    const controller = new InteractiveMediaController([instance], 60);

    controller.tick(15); // Encounter -> VISIBLE
    instance.open();
    instance.complete(100);
    expect(instance.getState()).toBe(ContentState.COMPLETED);

    const inFrame = controller.getRenderState(15);
    expect(inFrame.visibleAnchorIds).not.toContain("c1");
    expect(inFrame.completedTagIds).toContain("c1");
  });

  it("drops the anchor once a skipped hook is out of its window", () => {
    const instance = createInstance({
      id: "c1",
      hook: {
        type: "non-blocking",
        start: 10,
        end: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
        revealBehavior: "click",
      },
    });
    const controller = new InteractiveMediaController([instance], 60);

    controller.tick(15); // Encounter -> VISIBLE
    instance.skip();

    const outOfFrame = controller.getRenderState(25);
    expect(outOfFrame.visibleAnchorIds).not.toContain("c1");
    expect(outOfFrame.completedTagIds).not.toContain("c1");
  });

  it("computes aggregated result", () => {
    const instance1 = createInstance({
      id: "c1",
      hook: {
        type: "blocking",
        timestamp: 10,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
    });
    const instance2 = createInstance({
      id: "c2",
      hook: {
        type: "blocking",
        timestamp: 20,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
    });

    const controller = new InteractiveMediaController(
      [instance1, instance2],
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
