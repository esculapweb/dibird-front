import { CommonActions } from "@react-navigation/native";

import {
  navigationRef,
  navigateFromNotification,
  flushPendingNavigation,
  dispatchWhenReady,
} from "../navigationRef";

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
  // Called from the container's onReady, i.e. always with a navigator in place.
  const flushAsOnReady = () => {
    mockIsReady.mockReturnValue(true);
    flushPendingNavigation();
  };

  it("dispatches a previously queued navigation", () => {
    mockIsReady.mockReturnValue(false);
    navigateFromNotification("SpeciesDetail", { id: 5 });
    expect(mockDispatch).not.toHaveBeenCalled();

    flushAsOnReady();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "NAVIGATE", payload: { name: "SpeciesDetail", params: { id: 5 } } }),
    );
  });

  it("only flushes once — the queue is cleared after flushing", () => {
    mockIsReady.mockReturnValue(false);
    navigateFromNotification("SpeciesDetail", { id: 5 });

    flushAsOnReady();
    flushPendingNavigation();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there's no pending navigation", () => {
    expect(() => flushPendingNavigation()).not.toThrow();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // The cold start has no deadline of its own: the splash waits for the DB
  // migrations and the query-cache restore, so seconds can pass between the tap
  // being handled and a navigator existing. The queue must not expire — only the
  // retry after onReady is bounded.
  it("keeps the tap queued however long the launch takes", () => {
    jest.useFakeTimers();
    mockIsReady.mockReturnValue(false);
    navigateFromNotification("SpeciesDetail", { id: 5 });

    jest.advanceTimersByTime(30_000);
    expect(mockDispatch).not.toHaveBeenCalled();

    flushAsOnReady();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  // onReady fires the moment the container has a navigator — but AppStack
  // renders null again while it re-reads the onboarding flag, and a straight
  // dispatch into that gap disappeared (the same hole dispatchWhenReady was
  // written for, see its doc comment).
  it("waits out a navigator that vanishes right after onReady", () => {
    jest.useFakeTimers();
    mockIsReady.mockReturnValue(false);
    navigateFromNotification("SpeciesDetail", { id: 5 });

    // Ready when onReady fires, gone by the time the flush runs.
    flushPendingNavigation();
    expect(mockDispatch).not.toHaveBeenCalled();

    mockIsReady.mockReturnValue(true);
    jest.advanceTimersByTime(100);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});


describe("dispatchWhenReady", () => {
  const reset = CommonActions.reset({
    index: 1,
    routes: [{ name: "Main" }, { name: "SpeciesDetail", params: { id: 5 } }],
  });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("dispatches immediately when the navigator is ready", () => {
    mockIsReady.mockReturnValue(true);
    dispatchWhenReady(reset);

    expect(mockDispatch).toHaveBeenCalledWith(reset);
  });

  // A regression: on signing in AppStack renders null for a second (it re-reads
  // the onboarding flag), and a direct dispatch lost the guest's return to the
  // bird page.
  it("waits for a navigator that mounts a moment later", () => {
    mockIsReady.mockReturnValue(false);
    dispatchWhenReady(reset);
    expect(mockDispatch).not.toHaveBeenCalled();

    mockIsReady.mockReturnValue(true);
    jest.advanceTimersByTime(100);

    expect(mockDispatch).toHaveBeenCalledWith(reset);
  });

  it("gives up instead of retrying forever when no navigator ever appears", () => {
    mockIsReady.mockReturnValue(false);
    dispatchWhenReady(reset);

    jest.advanceTimersByTime(10_000);

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("dispatches once, not on every remaining retry", () => {
    mockIsReady.mockReturnValue(false);
    dispatchWhenReady(reset);

    mockIsReady.mockReturnValue(true);
    jest.advanceTimersByTime(10_000);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});

it("a newer queued navigation overwrites an older unflushed one", () => {
  mockIsReady.mockReturnValue(false);
  navigateFromNotification("SpeciesDetail", { id: 5 });
  navigateFromNotification("Achievements", undefined);

  mockIsReady.mockReturnValue(true);
  flushPendingNavigation();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: "NAVIGATE", payload: { name: "Achievements", params: undefined } }),
  );
});
