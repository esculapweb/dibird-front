import {
  setNavigationCallback,
  setTypedNavigationCallback,
  callNavigationCallback,
} from "../navigationCallbacks";

describe("callNavigationCallback", () => {
  it("invokes the registered callback with the given args", () => {
    const fn = jest.fn();
    setNavigationCallback("key-invoke", fn);
    callNavigationCallback("key-invoke", 1, "two");
    expect(fn).toHaveBeenCalledWith(1, "two");
  });

  it("is a no-op when no callback is registered for the key", () => {
    expect(() => callNavigationCallback("key-missing")).not.toThrow();
  });

  it("removes the callback after invoking it once (one-shot semantics)", () => {
    const fn = jest.fn();
    setNavigationCallback("key-once", fn);
    callNavigationCallback("key-once");
    callNavigationCallback("key-once");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("setNavigationCallback", () => {
  it("deletes an existing callback when passed null", () => {
    const fn = jest.fn();
    setNavigationCallback("key-delete", fn);
    setNavigationCallback("key-delete", null);
    callNavigationCallback("key-delete");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("setTypedNavigationCallback", () => {
  it("delegates to the same callback registry", () => {
    const fn = jest.fn();
    setTypedNavigationCallback<[number]>("key-typed", fn);
    callNavigationCallback("key-typed", 42);
    expect(fn).toHaveBeenCalledWith(42);
  });
});
