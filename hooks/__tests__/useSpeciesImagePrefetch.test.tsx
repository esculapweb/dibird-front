jest.mock("../../services/sync/speciesImagePrefetch", () => ({
  runSpeciesImagePrefetch: jest.fn(),
  stopSpeciesImagePrefetchRetries: jest.fn(),
}));
// Same controllable-stand-in reasoning as hooks/__tests__/syncHooks.test.tsx —
// the upstream implementations aren't what's under test here.
jest.mock("../../store/profile-context", () => {
  let listeners: Array<(territory: number | null) => void> = [];
  return {
    registerOnProfileSaved: jest.fn((cb: (territory: number | null) => void) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    }),
    __emitProfileSaved: (territory: number | null) => listeners.forEach((l) => l(territory)),
    __resetProfileSavedListeners: () => {
      listeners = [];
    },
  };
});
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

import { renderHook } from "@testing-library/react-native";

import { useSpeciesImagePrefetch } from "../useSpeciesImagePrefetch";
import {
  runSpeciesImagePrefetch,
  stopSpeciesImagePrefetchRetries,
} from "../../services/sync/speciesImagePrefetch";

const profileContextMock = require("../../store/profile-context") as {
  __emitProfileSaved: (territory: number | null) => void;
  __resetProfileSavedListeners: () => void;
};
const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

const run = runSpeciesImagePrefetch as jest.Mock;
const stop = stopSpeciesImagePrefetchRetries as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  profileContextMock.__resetProfileSavedListeners();
  networkStatusMock.__resetReconnectListeners();
});

it("does nothing when not authenticated, beyond stopping any retries", async () => {
  await renderHook(() => useSpeciesImagePrefetch(false));

  expect(run).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledTimes(1);
});

it("runs once the profile's territory is known", async () => {
  await renderHook(() => useSpeciesImagePrefetch(true));
  expect(run).not.toHaveBeenCalled();

  profileContextMock.__emitProfileSaved(5);
  expect(run).toHaveBeenCalledWith(5);
});

it("re-runs with the latest territory on reconnect", async () => {
  await renderHook(() => useSpeciesImagePrefetch(true));
  profileContextMock.__emitProfileSaved(5);
  run.mockClear();

  networkStatusMock.__emitReconnect();
  expect(run).toHaveBeenCalledWith(5);
});

it("does not trigger a reconnect run before any territory is known", async () => {
  await renderHook(() => useSpeciesImagePrefetch(true));

  networkStatusMock.__emitReconnect();
  expect(run).not.toHaveBeenCalled();
});

it("stops reacting to profile updates and reconnect, and cancels retries, after unmount", async () => {
  const { unmount } = await renderHook(() => useSpeciesImagePrefetch(true));
  profileContextMock.__emitProfileSaved(5);
  run.mockClear();

  await unmount();
  expect(stop).toHaveBeenCalledTimes(1);

  profileContextMock.__emitProfileSaved(9);
  networkStatusMock.__emitReconnect();
  expect(run).not.toHaveBeenCalled();
});
