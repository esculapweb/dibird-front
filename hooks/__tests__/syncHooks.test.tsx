// useDiarySync/useObservationSync/usePlaceSync/useNotificationSync are
// verbatim mirrors of each other (see each file's own header comment) — one
// table-driven suite covers all four instead of four near-identical copies.
jest.mock("../../services/sync/diarySync", () => ({
  runDiarySync: jest.fn(),
  stopDiarySyncRetries: jest.fn(),
}));
jest.mock("../../services/sync/observationSync", () => ({
  runObservationSync: jest.fn(),
  stopObservationSyncRetries: jest.fn(),
}));
jest.mock("../../services/sync/observationPhotoSync", () => ({
  runObservationPhotoSync: jest.fn(),
  stopObservationPhotoSyncRetries: jest.fn(),
}));
jest.mock("../../services/sync/placeSync", () => ({
  runPlaceSync: jest.fn(),
  stopPlaceSyncRetries: jest.fn(),
}));
jest.mock("../../services/sync/notificationSync", () => ({
  runNotificationSync: jest.fn(),
  stopNotificationSyncRetries: jest.fn(),
}));
// The upstream NetInfo-backed subscribeToReconnect isn't what's under test
// here (see services/sync/__tests__/networkStatus.test.ts for that) — these
// hooks just need a controllable stand-in that tracks registered callbacks so
// a test can fire a simulated reconnect and confirm cleanup unregisters it.
jest.mock("../../services/sync/networkStatus", () => {
  let listeners: Array<() => void> = [];
  return {
    subscribeToReconnect: jest.fn((cb: () => void) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    }),
    __emitReconnect: () => listeners.forEach((l) => l()),
    __resetReconnectListeners: () => {
      listeners = [];
    },
  };
});
import { AppState } from "react-native";
import { renderHook } from "@testing-library/react-native";
import { useDiarySync } from "../Diary/useDiarySync";
import { useObservationSync } from "../Observation/useObservationSync";
import { usePlaceSync } from "../Place/usePlaceSync";
import { useNotificationSync } from "../Notification/useNotificationSync";
import { runDiarySync, stopDiarySyncRetries } from "../../services/sync/diarySync";
import { runObservationSync, stopObservationSyncRetries } from "../../services/sync/observationSync";
import { runPlaceSync, stopPlaceSyncRetries } from "../../services/sync/placeSync";
import { runNotificationSync, stopNotificationSyncRetries } from "../../services/sync/notificationSync";

const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

// AppState.addEventListener never fires on its own in a jest environment, so
// it's spied and replaced with a controllable stand-in that tracks registered
// listeners — same reasoning as the networkStatus mock above.
let appStateListeners: Array<(state: string) => void> = [];
const emitAppState = (state: string) => appStateListeners.forEach((l) => l(state));

const cases = [
  {
    name: "useDiarySync",
    useHook: useDiarySync,
    run: runDiarySync as jest.Mock,
    stop: stopDiarySyncRetries as jest.Mock,
  },
  {
    name: "useObservationSync",
    useHook: useObservationSync,
    run: runObservationSync as jest.Mock,
    stop: stopObservationSyncRetries as jest.Mock,
  },
  {
    name: "usePlaceSync",
    useHook: usePlaceSync,
    run: runPlaceSync as jest.Mock,
    stop: stopPlaceSyncRetries as jest.Mock,
  },
  {
    name: "useNotificationSync",
    useHook: useNotificationSync,
    run: runNotificationSync as jest.Mock,
    stop: stopNotificationSyncRetries as jest.Mock,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  networkStatusMock.__resetReconnectListeners();
  appStateListeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, cb) => {
    appStateListeners.push(cb as (state: string) => void);
    return {
      remove: jest.fn(() => {
        appStateListeners = appStateListeners.filter((l) => l !== cb);
      }),
    } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe.each(cases)("$name", ({ useHook, run, stop }) => {
  it("does nothing when not authenticated, beyond stopping any retries", async () => {
    await renderHook(() => useHook(false));

    expect(run).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("runs immediately on mount and again on reconnect", async () => {
    await renderHook(() => useHook(true));
    expect(run).toHaveBeenCalledTimes(1);

    networkStatusMock.__emitReconnect();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("re-runs on app foreground after being backgrounded for more than 10 seconds", async () => {
    await renderHook(() => useHook(true));
    expect(run).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(11_000);
    emitAppState("background");
    emitAppState("active");
    jest.advanceTimersByTime(500);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not re-run on a quick background/foreground flicker under the 10 second threshold", async () => {
    await renderHook(() => useHook(true));
    expect(run).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2_000);
    emitAppState("background");
    emitAppState("active");
    jest.advanceTimersByTime(500);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("stops reacting to reconnect and cancels retries after unmount", async () => {
    const { unmount } = await renderHook(() => useHook(true));
    expect(run).toHaveBeenCalledTimes(1);

    await unmount();
    expect(stop).toHaveBeenCalledTimes(1);

    networkStatusMock.__emitReconnect();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
