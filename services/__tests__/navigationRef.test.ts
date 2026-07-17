import { navigationRef, navigateFromNotification, flushPendingNavigation } from "../navigationRef";

const mockDispatch = jest.fn();
const mockIsReady = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (navigationRef as { current: unknown }).current = {
    dispatch: mockDispatch,
    isReady: mockIsReady,
  };
});

afterEach(() => {
  (navigationRef as { current: unknown }).current = null;
});

it("dispatches immediately when the navigator is already ready", () => {
  mockIsReady.mockReturnValue(true);
  navigateFromNotification("SpeciesDetail", { id: 5 });

  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: "NAVIGATE", payload: { name: "SpeciesDetail", params: { id: 5 } } }),
  );
});

it("queues the navigation instead of dispatching when the navigator isn't ready yet", () => {
  mockIsReady.mockReturnValue(false);
  navigateFromNotification("SpeciesDetail", { id: 5 });

  expect(mockDispatch).not.toHaveBeenCalled();
});

describe("flushPendingNavigation", () => {
  it("dispatches a previously queued navigation", () => {
    mockIsReady.mockReturnValue(false);
    navigateFromNotification("SpeciesDetail", { id: 5 });
    expect(mockDispatch).not.toHaveBeenCalled();

    flushPendingNavigation();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "NAVIGATE", payload: { name: "SpeciesDetail", params: { id: 5 } } }),
    );
  });

  it("only flushes once — the queue is cleared after flushing", () => {
    mockIsReady.mockReturnValue(false);
    navigateFromNotification("SpeciesDetail", { id: 5 });

    flushPendingNavigation();
    flushPendingNavigation();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there's no pending navigation", () => {
    expect(() => flushPendingNavigation()).not.toThrow();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

it("a newer queued navigation overwrites an older unflushed one", () => {
  mockIsReady.mockReturnValue(false);
  navigateFromNotification("SpeciesDetail", { id: 5 });
  navigateFromNotification("Achievements", undefined);

  flushPendingNavigation();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: "NAVIGATE", payload: { name: "Achievements", params: undefined } }),
  );
});
