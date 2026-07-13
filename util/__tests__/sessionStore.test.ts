import { setSession, getSession } from "../sessionStore";

describe("getSession", () => {
  it("returns null for a key that was never set", () => {
    expect(getSession("session-missing")).toBeNull();
  });
});

describe("setSession / getSession", () => {
  it("stores and retrieves a value for a key", () => {
    setSession("session-value", { id: 1 });
    expect(getSession("session-value")).toEqual({ id: 1 });
  });

  it("overwrites a previously stored value for the same key", () => {
    setSession("session-overwrite", "first");
    setSession("session-overwrite", "second");
    expect(getSession("session-overwrite")).toBe("second");
  });
});
