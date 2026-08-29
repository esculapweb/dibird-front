// The hook is the thing that decides *whether* to announce a release, so what
// it announces (and, more importantly, what it stays quiet about) is the whole
// test surface. expo-updates and expo-application stand in for device state:
// which bundle is running and which build it sits on.
jest.mock("../../util/fetches", () => ({ reportAppUpdate: jest.fn() }));
jest.mock("expo-updates", () => ({
  useUpdates: jest.fn(() => ({ isUpdatePending: false })),
  get isEmbeddedLaunch() {
    return mockUpdatesState.isEmbeddedLaunch;
  },
  get updateId() {
    return mockUpdatesState.updateId;
  },
}));
jest.mock("expo-application", () => ({
  get nativeBuildVersion() {
    return mockApplicationState.nativeBuildVersion;
  },
}));
jest.mock("../../util/storageHelper", () => ({
  loadReportedRelease: jest.fn(async (slot: string) => mockStorage[slot] ?? null),
  saveReportedRelease: jest.fn(
    async (slot: string, release: { revision: string }) => {
      mockStorage[slot] = release as StoredRelease;
    },
  ),
}));
// Same controllable stand-in as hooks/__tests__/useSpeciesImagePrefetch.test.tsx.
jest.mock("../../services/sync/networkStatus", () => {
  let listeners: Array<() => void> = [];
  return {
    isConnected: jest.fn(() => mockConnected),
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useUpdates } from "expo-updates";

import { useAppUpdateNotifications } from "../useAppUpdateNotifications";
import { reportAppUpdate } from "../../util/fetches";
import { UNREAD_COUNT_KEY } from "../useUnreadCount";

const mockUpdatesState = {
  isEmbeddedLaunch: true,
  updateId: null as string | null,
};
const mockApplicationState = { nativeBuildVersion: "42" as string | null };
type StoredRelease = { revision: string; done: boolean; firstAskedAt: number };
let mockStorage: Record<string, StoredRelease> = {};
let mockConnected = true;

const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

const report = reportAppUpdate as jest.Mock;
const useUpdatesMock = useUpdates as jest.Mock;

const OTA_ID = "0f7b1c2e-1111-2222-3333-444455556666";

const stored = (
  revision: string,
  overrides: Partial<StoredRelease> = {},
): StoredRelease => ({
  revision,
  done: true,
  firstAskedAt: Date.now(),
  ...overrides,
});

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const render = (isAuthenticated = true) =>
  renderHook(() => useAppUpdateNotifications(isAuthenticated), { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  networkStatusMock.__resetReconnectListeners();
  mockUpdatesState.isEmbeddedLaunch = true;
  mockUpdatesState.updateId = null;
  mockApplicationState.nativeBuildVersion = "42";
  // A device that has already recorded this build: the "first ever launch"
  // path is its own test below.
  mockStorage = { build: stored("42") };
  mockConnected = true;
  report.mockResolvedValue(true);
  useUpdatesMock.mockReturnValue({ isUpdatePending: false });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

it("says nothing while nobody is signed in", async () => {
  mockUpdatesState.isEmbeddedLaunch = false;
  mockUpdatesState.updateId = OTA_ID;

  render(false);

  await waitFor(() => expect(report).not.toHaveBeenCalled());
});

it("announces an OTA update that is already running", async () => {
  mockUpdatesState.isEmbeddedLaunch = false;
  mockUpdatesState.updateId = OTA_ID;

  render();

  await waitFor(() =>
    expect(report).toHaveBeenCalledWith({
      kind: "ota",
      stage: "applied",
      revision: OTA_ID,
    }),
  );
  expect(mockStorage.ota_applied).toEqual(
    expect.objectContaining({ revision: OTA_ID, done: true }),
  );
});

it("stays quiet on a launch running the bundled code", async () => {
  render();

  await waitFor(() => expect(report).not.toHaveBeenCalled());
});

it("announces the same update only once", async () => {
  mockUpdatesState.isEmbeddedLaunch = false;
  mockUpdatesState.updateId = OTA_ID;
  mockStorage.ota_applied = stored(OTA_ID);

  render();

  await waitFor(() => expect(report).not.toHaveBeenCalled());
});

it("announces a downloaded update that is waiting for a restart", async () => {
  useUpdatesMock.mockReturnValue({
    isUpdatePending: true,
    downloadedUpdate: { updateId: OTA_ID },
  });

  render();

  await waitFor(() =>
    expect(report).toHaveBeenCalledWith({
      kind: "ota",
      stage: "pending",
      revision: OTA_ID,
    }),
  );
});

it("does not promise a restart before the download has finished", async () => {
  // An update that exists but is still downloading: restarting now would
  // change nothing, so the notification would be a lie.
  useUpdatesMock.mockReturnValue({
    isUpdatePending: false,
    downloadedUpdate: { updateId: OTA_ID },
  });

  render();

  await waitFor(() => expect(report).not.toHaveBeenCalled());
});

it("announces a new store build", async () => {
  mockApplicationState.nativeBuildVersion = "43";

  render();

  await waitFor(() =>
    expect(report).toHaveBeenCalledWith({
      kind: "build",
      stage: "applied",
      revision: "43",
    }),
  );
});

it("records the build silently when there is nothing to compare against", async () => {
  // A fresh install, or the launch that first shipped this code: neither is an
  // upgrade, and announcing one would greet a newcomer with "what's new".
  mockStorage = {};

  render();

  await waitFor(() =>
    expect(mockStorage.build).toEqual(
      expect.objectContaining({ revision: "42", done: true }),
    ),
  );
  expect(report).not.toHaveBeenCalled();
});

it("keeps the flag unset when the announcement fails, so it retries later", async () => {
  mockApplicationState.nativeBuildVersion = "43";
  report.mockRejectedValueOnce(new Error("offline"));

  render();

  await waitFor(() => expect(report).toHaveBeenCalledTimes(1));
  expect(mockStorage.build).toEqual(
    expect.objectContaining({ revision: "42" }),
  );
});

it("keeps asking while the backend has no notes for the release yet", async () => {
  // Release notes are usually written just after publishing — by then the
  // first devices have already asked. Remembering that "no" as final is what
  // would lose them the announcement for good.
  mockApplicationState.nativeBuildVersion = "43";
  report.mockResolvedValue(false);

  render();

  await waitFor(() => expect(report).toHaveBeenCalledTimes(1));
  expect(mockStorage.build).toEqual(
    expect.objectContaining({ revision: "43", done: false }),
  );
});

it("gives up asking about a release the backend stayed silent about for a week", async () => {
  mockApplicationState.nativeBuildVersion = "43";
  mockStorage.build = stored("43", {
    done: false,
    firstAskedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  });

  render();

  await waitFor(() => expect(report).not.toHaveBeenCalled());
});

it("retries on reconnect", async () => {
  mockApplicationState.nativeBuildVersion = "43";
  mockConnected = false;

  render();

  await waitFor(() => expect(report).not.toHaveBeenCalled());

  mockConnected = true;
  networkStatusMock.__emitReconnect();

  await waitFor(() => expect(report).toHaveBeenCalledTimes(1));
});

it("refreshes the badge as soon as something was announced", async () => {
  mockApplicationState.nativeBuildVersion = "43";
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");

  render();

  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({ queryKey: UNREAD_COUNT_KEY }),
  );
});

it("leaves the badge alone when there was nothing to announce", async () => {
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");

  render();

  await waitFor(() => expect(report).not.toHaveBeenCalled());
  expect(invalidate).not.toHaveBeenCalled();
});
