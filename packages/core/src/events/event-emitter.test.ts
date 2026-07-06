import { describe, expect, it } from "vitest";
import { EventEmitter } from "./event-emitter";

describe("EventEmitter", () => {
  interface TestEvents {
    foo: { value: number };
    bar: string;
  }

  it("emits and receives events", () => {
    const emitter = new EventEmitter<TestEvents>();
    let received: { value: number } | null = null;

    emitter.on("foo", (event) => {
      received = event;
    });

    emitter.emit("foo", { value: 42 });
    expect(received).toEqual({ value: 42 });
  });

  it("returns unsubscribe function", () => {
    const emitter = new EventEmitter<TestEvents>();
    let callCount = 0;

    const unsubscribe = emitter.on("bar", () => {
      callCount++;
    });

    emitter.emit("bar", "test1");
    expect(callCount).toBe(1);

    unsubscribe();
    emitter.emit("bar", "test2");
    expect(callCount).toBe(1); // Should not have incremented
  });

  it("supports multiple listeners on same event", () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on("bar", () => calls.push("a"));
    emitter.on("bar", () => calls.push("b"));

    emitter.emit("bar", "test");
    expect(calls).toEqual(["a", "b"]);
  });

  it("supports once", () => {
    const emitter = new EventEmitter<TestEvents>();
    let callCount = 0;

    emitter.once("foo", () => {
      callCount++;
    });

    emitter.emit("foo", { value: 1 });
    emitter.emit("foo", { value: 2 });

    expect(callCount).toBe(1);
  });

  it("supports off to remove specific listener", () => {
    const emitter = new EventEmitter<TestEvents>();
    let callCount = 0;

    const listener = () => {
      callCount++;
    };

    emitter.on("bar", listener);
    emitter.emit("bar", "test1");
    expect(callCount).toBe(1);

    emitter.off("bar", listener);
    emitter.emit("bar", "test2");
    expect(callCount).toBe(1);
  });

  it("supports removeAllListeners", () => {
    const emitter = new EventEmitter<TestEvents>();
    let fooCount = 0;
    let barCount = 0;

    emitter.on("foo", () => {
      fooCount++;
    });
    emitter.on("bar", () => {
      barCount++;
    });

    emitter.removeAllListeners();

    emitter.emit("foo", { value: 1 });
    emitter.emit("bar", "test");

    expect(fooCount).toBe(0);
    expect(barCount).toBe(0);
  });

  it("supports removeAllListeners for specific event", () => {
    const emitter = new EventEmitter<TestEvents>();
    let fooCount = 0;
    let barCount = 0;

    emitter.on("foo", () => {
      fooCount++;
    });
    emitter.on("bar", () => {
      barCount++;
    });

    emitter.removeAllListeners("foo");

    emitter.emit("foo", { value: 1 });
    emitter.emit("bar", "test");

    expect(fooCount).toBe(0);
    expect(barCount).toBe(1);
  });
});
