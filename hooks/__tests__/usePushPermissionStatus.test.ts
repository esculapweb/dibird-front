jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("../../services/errors", () => ({ reportWarning: jest.fn() }));
jest.mock("../usePushNotifications", () => ({
  requestPushPermission: jest.fn(),
}));

import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { act, renderHook } from "@testing-library/react-native";

import { reportWarning } from "../../services/errors";
import { requestPushPermission } from "../usePushNotifications";
import { usePushPermissionStatus } from "../usePushPermissionStatus";

const getPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const originalOS = Platform.OS;

// AppState.addEventListener never fires on its own in jest — same stand-in as in
// hooks/__tests__/syncHooks.test.tsx.
let appStateListeners: Array<(state: string) => void> = [];
const emitAppState = (state: string) =>
  appStateListeners.forEach((l) => l(state));

const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  appStateListeners = [];
  (Device as { isDevice: boolean }).isDevice = true;
  Platform.OS = originalOS;
  getPermissionsAsync.mockResolvedValue({ status: "granted" });
  (requestPushPermission as jest.Mock).mockResolvedValue(true);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, cb) => {
    appStateListeners.push(cb as (state: string) => void);
    return {
      remove: jest.fn(() => {
        appStateListeners = appStateListeners.filter((l) => l !== cb);
      }),
    } as ReturnType<typeof AppState.addEventListener>;
  });
});

it("reads the status on mount", async () => {
  const { result } = await renderHook(() => usePushPermissionStatus());
  await flush();

  expect(result.current.status).toBe("granted");
});

// The case the hook exists for: the permission is changed in the system
// settings, and the app only learns about it on the way back.
it("re-reads the status after a return from the background", async () => {
  getPermissionsAsync.mockResolvedValue({ status: "denied" });

  const { result } = await renderHook(() => usePushPermissionStatus());
  await flush();
  expect(result.current.status).toBe("denied");

  getPermissionsAsync.mockResolvedValue({ status: "granted" });
  await act(async () => {
    emitAppState("background");
    emitAppState("active");
  });

  expect(result.current.status).toBe("granted");
});

it("ignores an 'active' that did not follow a background", async () => {
  await renderHook(() => usePushPermissionStatus());
  await flush();
  expect(getPermissionsAsync).toHaveBeenCalledTimes(1);

  await act(async () => emitAppState("active"));

  expect(getPermissionsAsync).toHaveBeenCalledTimes(1);
});

// Push cannot work on a simulator at all, and a card offering to fix that would
// lead nowhere — so the status stays "nothing to act on".
it("leaves the status unread on a simulator", async () => {
  (Device as { isDevice: boolean }).isDevice = false;

  const { result } = await renderHook(() => usePushPermissionStatus());
  await flush();

  expect(getPermissionsAsync).not.toHaveBeenCalled();
  expect(result.current.status).toBeNull();
});

it("reports a failed read instead of rejecting", async () => {
  getPermissionsAsync.mockRejectedValue(new Error("nope"));

  const { result } = await renderHook(() => usePushPermissionStatus());
  await flush();

  expect(result.current.status).toBeNull();
  expect(reportWarning).toHaveBeenCalled();
});

describe("request", () => {
  it("shows the system dialog and re-reads the status afterwards", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });

    const { result } = await renderHook(() => usePushPermissionStatus());
    await flush();

    getPermissionsAsync.mockResolvedValue({ status: "granted" });
    await act(async () => result.current.request());

    expect(requestPushPermission).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("granted");
  });

  // A refusal the OS has recorded cannot be asked about again — the dialog does
  // not open a second time, so the only way back is the system settings.
  it("sends to the iOS settings once the permission was refused", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "denied" });
    Platform.OS = "ios";
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    const { result } = await renderHook(() => usePushPermissionStatus());
    await flush();
    await act(async () => result.current.request());

    expect(openURL).toHaveBeenCalledWith("app-settings:");
    expect(requestPushPermission).not.toHaveBeenCalled();
  });

  it("opens the app settings on android", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "denied" });
    Platform.OS = "android";
    const openSettings = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePushPermissionStatus());
    await flush();
    await act(async () => result.current.request());

    expect(openSettings).toHaveBeenCalled();
  });
});

it("stops listening on unmount", async () => {
  const { unmount } = await renderHook(() => usePushPermissionStatus());
  await flush();

  await unmount();

  expect(appStateListeners).toHaveLength(0);
});
