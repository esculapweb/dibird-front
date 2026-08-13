import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as Device from "expo-device";

import "../services/i18n";
import { registerPushToken, markNotificationsRead } from "../util/fetches";
import { UNREAD_COUNT_KEY } from "../hooks/useUnreadCount";
import { navigateFromNotification } from "../services/navigationRef";
import { routeNotification } from "../util/notificationRoute";
import { setUserProps, track } from "../services/analytics";
import { logError, reportWarning } from "../services/errors";
import { subscribeToReconnect } from "../services/sync/networkStatus";
import { isNotificationPayload, NotificationPayload, AppError } from "../types";

// Tapping a push should mark its underlying notification read, same as
// tapping it in the in-app list (NotificationsScreen.handlePress) — otherwise
// it stays unread and keeps counting toward the badge.
const handleNotificationTap = (
  raw: NotificationPayload,
  queryClient: QueryClient,
) => {
  if (raw.id != null) {
    markNotificationsRead([raw.id])
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      })
      .catch((e) => logError(e as AppError, "markNotificationsRead from push tap"));
  }
  // Shared with the in-app list so the two cannot lead to different screens —
  // see util/notificationRoute.
  routeNotification(raw, navigateFromNotification);
};

type PermissionStatus = "granted" | "denied" | "undetermined";

// The codes expo-notifications gives a token fetch that failed on its way to
// Expo's servers rather than on the device — the same class of failure as a
// refused POST below, and worth the same retry.
const RETRYABLE_TOKEN_ERRORS = [
  "ERR_NOTIFICATIONS_NETWORK_ERROR",
  "ERR_NOTIFICATIONS_SERVER_ERROR",
];

// Fetch the token and register it with the backend. Split out of the effect so
// that both paths — "permission was already granted on a previous run" and
// "the user just granted it from the alerts card" — do the same thing.
const registerToken = async (
  onNeedsRetry: (unsubscribe: () => void) => void,
): Promise<void> => {
  const attemptRegister = async (): Promise<boolean> => {
    let token: string;

    // getExpoPushTokenAsync is a network call of its own (Expo binds the token
    // to the device's current APNs/FCM one on its servers), and it used to be
    // the single step outside a try/catch here: a failure took down whoever was
    // awaiting it — in AlertSettingsScreen the switch never reached save() —
    // and left the registration to the next cold start with nothing logged.
    try {
      const expoToken = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      token = expoToken.data;
    } catch (e) {
      const code = (e as { code?: string }).code;
      const retryable = RETRYABLE_TOKEN_ERRORS.includes(code ?? "");
      // Only what the reconnect will not pick up on its own is worth an event:
      // being offline at a cold start is normal and would drown the rest.
      if (retryable) logError(e, "getExpoPushTokenError");
      else reportWarning(e, "getExpoPushTokenError");
      return !retryable;
    }

    try {
      await registerPushToken(token);
      return true;
    } catch (e) {
      // logError only: an API call that failed is already in Sentry from the
      // interceptor in services/api.ts.
      const error = e as AppError;
      logError(error, "registerPushTokenError API ERROR");
      return !(error.isNetworkError || error.isTimeout);
    }
  };

  // If registration failed purely due to connectivity (e.g. permission
  // was just granted with no signal), retry once the device reconnects
  // instead of leaving the token unregistered until the next cold start.
  if (!(await attemptRegister())) {
    const unsubscribe = subscribeToReconnect(async () => {
      if (await attemptRegister()) unsubscribe();
    });
    onNeedsRetry(unsubscribe);
  }
};

/**
 * Show the system push dialog and register the token.
 *
 * Called **only** from the points where the user themselves asked for the thing
 * notifications are needed for (the alerts card on the main screen, the switch
 * in the alert settings). The dialog used to pop up right after the login, tied
 * to nothing — refusing at such a moment is easier than agreeing, and the share
 * of users with push is the entry to every retention loop.
 *
 * Returns whether the permission was granted. Calling it again after a refusal
 * is harmless: the system does not show a second dialog and returns the
 * previous status.
 */
export const requestPushPermission = async (): Promise<boolean> => {
  if (!Device.isDevice) return false;

  let status: PermissionStatus;
  // Every caller awaits this from an event handler with no catch of its own —
  // a rejection here would abort the rest of the handler (the alerts stay off,
  // the location is never asked for) over a dialog that did not open.
  try {
    ({ status } = (await Notifications.requestPermissionsAsync()) as {
      status: PermissionStatus;
    });
  } catch (e) {
    reportWarning(e, "requestPermissionsAsync");
    return false;
  }

  setUserProps({ has_push_token: status === "granted" ? "yes" : "no" });
  track("push_permission", { granted: status === "granted" ? "yes" : "no" });

  if (status !== "granted") return false;

  // Registration failures are already logged inside; a token that could not be
  // delivered right now must not read as "permission denied" to the caller.
  await registerToken(() => {});
  return true;
};

export const usePushNotifications = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();
  const unsubscribeReconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Remembered between the runs of `register` below: a foreground that changed
    // nothing then costs one native call and no request.
    let lastStatus: PermissionStatus | null = null;

    async function register() {
      if (!Device.isDevice) {
        return null;
      }

      // getPermissionsAsync, not request: this hook mounts as a consequence of
      // signing in, and signing in is no reason to show a system dialog (see
      // requestPushPermission). All that happens here is picking up a permission
      // granted earlier, so that the token reaches the backend after a reinstall,
      // a token change or a permission revoked in the OS settings.
      const { status } = (await Notifications.getPermissionsAsync()) as {
        status: PermissionStatus;
      };

      if (status === lastStatus) return;
      lastStatus = status;

      // The share of users with push is the entry to the retention loops, so the
      // property is set on a refusal too; "never asked" stays a separate value at
      // that, otherwise it would blend in with those who refused.
      setUserProps({
        has_push_token:
          status === "granted"
            ? "yes"
            : status === "denied"
              ? "no"
              : "not_asked",
      });

      if (status !== "granted") return;

      await registerToken((unsubscribe) => {
        // A previous run may have left a retry of its own pending.
        unsubscribeReconnectRef.current?.();
        unsubscribeReconnectRef.current = unsubscribe;
      });
    }

    const runRegister = () =>
      register().catch((e) => reportWarning(e, "usePushNotifications register"));

    runRegister();

    // The permission is granted outside the app as readily as inside it — in the
    // system settings, or by a reinstall, which resets it while the session
    // survives in the Keychain. Read only at the cold start, it left the token
    // unregistered until the next one: Expo goes on pushing to the APNs token of
    // the install that is gone, and the backend drops the row on the first
    // DeviceNotRegistered that comes back.
    let prevAppState = AppState.currentState;
    const appStateSub = AppState.addEventListener("change", (state) => {
      const wasBackground =
        prevAppState === "background" || prevAppState === "inactive";
      prevAppState = state;

      if (state === "active" && wasBackground) runRegister();
    });

    // addNotificationResponseReceivedListener isn't guaranteed to fire for
    // the tap that cold-launched the app (process wasn't alive yet to
    // subscribe in time), so that case must be recovered separately here.
    //
    // In a try/catch because both calls throw an UnavailabilityError when the
    // native module does not implement them (Expo Go, an older runtime under a
    // newer JS bundle after an OTA). Uncaught, that took the rest of the effect
    // with it — the two listeners below were never registered, and push taps
    // stopped working entirely, not just the cold-start one.
    try {
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) {
        Notifications.clearLastNotificationResponse();
        const raw = lastResponse.notification.request.content.data;
        if (isNotificationPayload(raw)) handleNotificationTap(raw, queryClient);
      }
    } catch (e) {
      reportWarning(e, "getLastNotificationResponse");
    }

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const raw = response.notification.request.content.data;
        if (!isNotificationPayload(raw)) return;
        handleNotificationTap(raw, queryClient);
      },
    );

    return () => {
      appStateSub.remove();
      receivedSub.remove();
      responseSub.remove();
      unsubscribeReconnectRef.current?.();
      unsubscribeReconnectRef.current = null;
    };
  }, [isAuthenticated, queryClient]);
};
