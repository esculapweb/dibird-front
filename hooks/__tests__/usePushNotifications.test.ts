jest.mock("@tanstack/react-query", () => ({
  useQueryClient: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "test-project" } } } },
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("../../util/fetches", () => ({
  registerPushToken: jest.fn(),
}));
jest.mock("../../services/navigationRef", () => ({
  navigateFromNotification: jest.fn(),
}));
jest.mock("../../services/errors", () => ({
  logError: jest.fn(),
}));
// Controllable stand-in, same pattern as hooks/__tests__/syncHooks.test.tsx —
// tracks registered callbacks so a test can fire a simulated reconnect.
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

import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { renderHook } from "@testing-library/react-native";
import { registerPushToken } from "../../util/fetches";
import { navigateFromNotification } from "../../services/navigationRef";
import { UNREAD_COUNT_KEY } from "../useUnreadCount";
import { usePushNotifications, handleNotificationNavigation } from "../usePushNotifications";

const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

const requestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const getExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const addNotificationReceivedListener = Notifications.addNotificationReceivedListener as jest.Mock;
const addNotificationResponseReceivedListener =
  Notifications.addNotificationResponseReceivedListener as jest.Mock;
const invalidateQueries = jest.fn();

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  networkStatusMock.__resetReconnectListeners();
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
  (Device as { isDevice: boolean }).isDevice = true;
  requestPermissionsAsync.mockResolvedValue({ status: "granted" });
  getExpoPushTokenAsync.mockResolvedValue({ data: "expo-token" });
  (registerPushToken as jest.Mock).mockResolvedValue(undefined);
  addNotificationReceivedListener.mockReturnValue({ remove: jest.fn() });
  addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
});

describe("handleNotificationNavigation", () => {
  it("routes Community with highlightObsIds", () => {
    handleNotificationNavigation({ screen: "Community", highlightObsIds: [1, 2] });
    expect(navigateFromNotification).toHaveBeenCalledWith("Community", { highlightObsIds: [1, 2] });
  });

  it("routes SpeciesDetail with the species id", () => {
    handleNotificationNavigation({ screen: "SpeciesDetail", speciesId: 42 });
    expect(navigateFromNotification).toHaveBeenCalledWith("SpeciesDetail", { id: 42 });
  });

  it("routes Achievements with the highlight id", () => {
    handleNotificationNavigation({ screen: "Achievements", achievementId: "a1" });
    expect(navigateFromNotification).toHaveBeenCalledWith("Achievements", { highlightId: "a1" });
  });

  it("routes Checklist with no params", () => {
    handleNotificationNavigation({ screen: "Checklist" });
    expect(navigateFromNotification).toHaveBeenCalledWith("Checklist", undefined);
  });
});

describe("usePushNotifications", () => {
  it("does nothing when not authenticated", async () => {
    await renderHook(() => usePushNotifications(false));
    await flush();

    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(addNotificationReceivedListener).not.toHaveBeenCalled();
  });

  it("still wires up notification listeners on a non-device, but never requests permission", async () => {
    (Device as { isDevice: boolean }).isDevice = false;

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(addNotificationReceivedListener).toHaveBeenCalled();
    expect(addNotificationResponseReceivedListener).toHaveBeenCalled();
  });

  it("stops before fetching a token when permission is denied", async () => {
    requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it("registers the push token with the backend when permission is granted", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(registerPushToken).toHaveBeenCalledWith("expo-token");
  });

  it("retries registration once on reconnect after a network-error failure, then unsubscribes", async () => {
    (registerPushToken as jest.Mock)
      .mockRejectedValueOnce({ isNetworkError: true })
      .mockResolvedValueOnce(undefined);

    await renderHook(() => usePushNotifications(true));
    await flush();
    expect(registerPushToken).toHaveBeenCalledTimes(1);

    networkStatusMock.__emitReconnect();
    await flush();
    expect(registerPushToken).toHaveBeenCalledTimes(2);

    // The retry succeeded, so a second reconnect must not trigger a third attempt.
    networkStatusMock.__emitReconnect();
    await flush();
    expect(registerPushToken).toHaveBeenCalledTimes(2);
  });

  it("invalidates the unread-count and notifications queries when a notification is received", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    const onReceived = addNotificationReceivedListener.mock.calls[0][0] as () => void;
    onReceived();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: UNREAD_COUNT_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("navigates when a notification response with a valid payload is tapped", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    const onResponse = addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    onResponse({ notification: { request: { content: { data: { screen: "Checklist" } } } } });

    expect(navigateFromNotification).toHaveBeenCalledWith("Checklist", undefined);
  });

  it("removes both listeners and cancels any pending reconnect subscription on unmount", async () => {
    const receivedRemove = jest.fn();
    const responseRemove = jest.fn();
    addNotificationReceivedListener.mockReturnValue({ remove: receivedRemove });
    addNotificationResponseReceivedListener.mockReturnValue({ remove: responseRemove });
    (registerPushToken as jest.Mock).mockRejectedValue({ isNetworkError: true });

    const { unmount } = await renderHook(() => usePushNotifications(true));
    await flush();

    await unmount();

    expect(receivedRemove).toHaveBeenCalled();
    expect(responseRemove).toHaveBeenCalled();

    // A pending retry subscription must not fire after unmount.
    networkStatusMock.__emitReconnect();
    await flush();
    expect(registerPushToken).toHaveBeenCalledTimes(1);
  });
});
