jest.mock("@tanstack/react-query", () => ({
  useQueryClient: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "test-project" } } } },
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("../../util/fetches", () => ({
  registerPushToken: jest.fn(),
  markNotificationsRead: jest.fn(),
}));
jest.mock("../../services/navigationRef", () => ({
  navigateFromNotification: jest.fn(),
}));
jest.mock("../../services/errors", () => ({
  logError: jest.fn(),
  reportWarning: jest.fn(),
}));
jest.mock("../../services/analytics", () => ({
  setUserProps: jest.fn(),
  track: jest.fn(),
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

import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { act, renderHook } from "@testing-library/react-native";
import { registerPushToken, markNotificationsRead } from "../../util/fetches";
import { reportWarning } from "../../services/errors";
import { navigateFromNotification } from "../../services/navigationRef";
import { UNREAD_COUNT_KEY } from "../useUnreadCount";
import { setUserProps, track } from "../../services/analytics";
import {
  usePushNotifications,
  requestPushPermission,
} from "../usePushNotifications";

const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

const requestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const getPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const getExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const addNotificationReceivedListener = Notifications.addNotificationReceivedListener as jest.Mock;
const addNotificationResponseReceivedListener =
  Notifications.addNotificationResponseReceivedListener as jest.Mock;
const invalidateQueries = jest.fn();

const flush = () => new Promise((resolve) => setImmediate(resolve));

// AppState.addEventListener never fires on its own in a jest environment, so
// the foreground is simulated by hand — same stand-in as in syncHooks.test.tsx.
let appStateListeners: Array<(state: string) => void> = [];
const emitForeground = async () => {
  await act(async () => {
    appStateListeners.forEach((l) => l("background"));
    appStateListeners.forEach((l) => l("active"));
  });
  await flush();
};

beforeEach(() => {
  jest.clearAllMocks();
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
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
  (Device as { isDevice: boolean }).isDevice = true;
  requestPermissionsAsync.mockResolvedValue({ status: "granted" });
  getPermissionsAsync.mockResolvedValue({ status: "granted" });
  getExpoPushTokenAsync.mockResolvedValue({ data: "expo-token" });
  (registerPushToken as jest.Mock).mockResolvedValue(undefined);
  (markNotificationsRead as jest.Mock).mockResolvedValue(undefined);
  addNotificationReceivedListener.mockReturnValue({ remove: jest.fn() });
  addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
  (Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue(null);
});

describe("usePushNotifications", () => {
  it("does nothing when not authenticated", async () => {
    await renderHook(() => usePushNotifications(false));
    await flush();

    expect(getPermissionsAsync).not.toHaveBeenCalled();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(addNotificationReceivedListener).not.toHaveBeenCalled();
  });

  it("still wires up notification listeners on a non-device, but never reads permission", async () => {
    (Device as { isDevice: boolean }).isDevice = false;

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(getPermissionsAsync).not.toHaveBeenCalled();
    expect(addNotificationReceivedListener).toHaveBeenCalled();
    expect(addNotificationResponseReceivedListener).toHaveBeenCalled();
  });

  it("stops before fetching a token when permission is denied", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "denied" });

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

  // A reinstall resets the OS permission while the session survives in the
  // Keychain, so the app comes up signed in with push silently dead. Read only
  // at the cold start, the status granted in the system settings a minute later
  // reached nobody until the next launch.
  it("registers the token when the permission was granted while the app sat in the background", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });

    await renderHook(() => usePushNotifications(true));
    await flush();
    expect(registerPushToken).not.toHaveBeenCalled();

    getPermissionsAsync.mockResolvedValue({ status: "granted" });
    await emitForeground();

    expect(registerPushToken).toHaveBeenCalledWith("expo-token");
    expect(setUserProps).toHaveBeenLastCalledWith({ has_push_token: "yes" });
  });

  it("does not re-register on a foreground that changed nothing", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();
    expect(registerPushToken).toHaveBeenCalledTimes(1);

    await emitForeground();

    expect(registerPushToken).toHaveBeenCalledTimes(1);
  });

  it("stops re-reading the permission after unmount", async () => {
    const { unmount } = await renderHook(() => usePushNotifications(true));
    await flush();

    await unmount();
    await emitForeground();

    expect(getPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  // The token fetch is a network call to Expo's servers of its own. Left to
  // throw, it took down whoever awaited the registration and logged nothing.
  it("survives a failed token fetch without touching the backend", async () => {
    getExpoPushTokenAsync.mockRejectedValue(
      Object.assign(new Error("no token"), { code: "ERR_NOTIF_DEVICE_ID" }),
    );

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(registerPushToken).not.toHaveBeenCalled();
    // logError is __DEV__-only, so a silent push would stay silent in Sentry too.
    expect(reportWarning).toHaveBeenCalled();

    // A device-side failure is permanent — a reconnect must not spin on it.
    networkStatusMock.__emitReconnect();
    await flush();
    expect(getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it("retries the token fetch on reconnect when it failed on the network", async () => {
    getExpoPushTokenAsync
      .mockRejectedValueOnce(
        Object.assign(new Error("offline"), {
          code: "ERR_NOTIFICATIONS_NETWORK_ERROR",
        }),
      )
      .mockResolvedValueOnce({ data: "expo-token" });

    await renderHook(() => usePushNotifications(true));
    await flush();
    expect(registerPushToken).not.toHaveBeenCalled();
    // Offline at a cold start is normal — an event per launch would bury the rest.
    expect(reportWarning).not.toHaveBeenCalled();

    networkStatusMock.__emitReconnect();
    await flush();

    expect(registerPushToken).toHaveBeenCalledWith("expo-token");
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

  it("marks the notification read and refreshes badges when a tapped payload carries an id", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    const onResponse = addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    onResponse({
      notification: { request: { content: { data: { screen: "Checklist", id: 7 } } } },
    });
    await flush();

    expect(markNotificationsRead).toHaveBeenCalledWith([7]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: UNREAD_COUNT_KEY });
  });

  it("does not attempt to mark read when the tapped payload has no id", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    const onResponse = addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    onResponse({ notification: { request: { content: { data: { screen: "Checklist" } } } } });
    await flush();

    expect(markNotificationsRead).not.toHaveBeenCalled();
  });

  it("recovers a cold-start notification via getLastNotificationResponse and navigates", async () => {
    (Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue({
      notification: { request: { content: { data: { screen: "Checklist", id: 9 } } } },
    });

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
    expect(navigateFromNotification).toHaveBeenCalledWith("Checklist", undefined);
    expect(markNotificationsRead).toHaveBeenCalledWith([9]);
  });

  // Both calls throw an UnavailabilityError when the native module does not
  // implement them. Uncaught, that aborted the effect before the two listeners
  // were registered — and then no push tap worked at all, not just the
  // cold-start one.
  it("still registers the tap listeners when the cold-start lookup throws", async () => {
    (Notifications.getLastNotificationResponse as jest.Mock).mockImplementation(
      () => {
        throw new Error("ExpoNotifications.getLastNotificationResponse is not available");
      },
    );

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(reportWarning).toHaveBeenCalled();
    expect(addNotificationResponseReceivedListener).toHaveBeenCalled();

    const onResponse = addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    onResponse({ notification: { request: { content: { data: { screen: "Checklist" } } } } });

    expect(navigateFromNotification).toHaveBeenCalledWith("Checklist", undefined);
  });

  it("does nothing extra when there is no last notification response", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
    expect(navigateFromNotification).not.toHaveBeenCalled();
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

// Push permission is no longer requested just because someone signed in: a
// dialog tied to nothing is easier to dismiss, and the share of users with push
// is the entry to every retention loop. The hook only picks up a permission
// that has already been granted.
describe("usePushNotifications does not prompt", () => {
  it("reads the status instead of requesting it", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(getPermissionsAsync).toHaveBeenCalled();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("stays quiet when permission was never asked for", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  // Three values rather than two: merged into "no", "never asked" would inflate
  // the refusal rate by exactly those the dialog never reached.
  it.each([
    ["granted", "yes"],
    ["denied", "no"],
    ["undetermined", "not_asked"],
  ])("reports %s as has_push_token=%s", async (status, expected) => {
    getPermissionsAsync.mockResolvedValue({ status });

    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(setUserProps).toHaveBeenCalledWith({ has_push_token: expected });
  });

  it("still registers a token that was granted on an earlier run", async () => {
    await renderHook(() => usePushNotifications(true));
    await flush();

    expect(registerPushToken).toHaveBeenCalledWith("expo-token");
  });
});

describe("requestPushPermission", () => {
  it("prompts, registers the token and reports success", async () => {
    const granted = await requestPushPermission();

    expect(requestPermissionsAsync).toHaveBeenCalled();
    expect(registerPushToken).toHaveBeenCalledWith("expo-token");
    expect(track).toHaveBeenCalledWith("push_permission", { granted: "yes" });
    expect(setUserProps).toHaveBeenCalledWith({ has_push_token: "yes" });
    expect(granted).toBe(true);
  });

  it("reports a refusal without going after a token", async () => {
    requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    const granted = await requestPushPermission();

    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("push_permission", { granted: "no" });
    expect(setUserProps).toHaveBeenCalledWith({ has_push_token: "no" });
    expect(granted).toBe(false);
  });

  it("never prompts on a simulator", async () => {
    (Device as { isDevice: boolean }).isDevice = false;

    const granted = await requestPushPermission();

    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(granted).toBe(false);
  });

  // A token that did not make it because of the network is not a user refusal:
  // the caller (the alerts card) must turn the alerts on regardless.
  it("still reports success when the token could not be delivered", async () => {
    (registerPushToken as jest.Mock).mockRejectedValue({ isNetworkError: true });

    const granted = await requestPushPermission();

    expect(granted).toBe(true);
  });
});
