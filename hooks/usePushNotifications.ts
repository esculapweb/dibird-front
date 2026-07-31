import { useEffect, useRef } from "react";
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
import { setUserProps, track } from "../services/analytics";
import { logError } from "../services/errors";
import { subscribeToReconnect } from "../services/sync/networkStatus";
import { isNotificationPayload, NotificationPayload, AppError } from "../types";

export const handleNotificationNavigation = (raw: NotificationPayload) => {
  switch (raw.screen) {
    case "Community":
      navigateFromNotification("Community", {
        highlightObsIds: raw.highlightObsIds,
      });
      break;
    case "SpeciesDetail":
      navigateFromNotification("SpeciesDetail", { id: raw.speciesId });
      break;
    case "Achievements":
      navigateFromNotification("Achievements", {
        highlightId: raw.achievementId,
      });
      break;
    case "Checklist":
      navigateFromNotification("Checklist", undefined);
      break;
  }
};

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
  handleNotificationNavigation(raw);
};

type PermissionStatus = "granted" | "denied" | "undetermined";

// Fetch the token and register it with the backend. Split out of the effect so
// that both paths — "permission was already granted on a previous run" and
// "the user just granted it from the alerts card" — do the same thing.
const registerToken = async (
  onNeedsRetry: (unsubscribe: () => void) => void,
): Promise<void> => {
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  const attemptRegister = async (): Promise<boolean> => {
    try {
      await registerPushToken(token.data);
      return true;
    } catch (e) {
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

  const { status } = (await Notifications.requestPermissionsAsync()) as {
    status: PermissionStatus;
  };

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
        unsubscribeReconnectRef.current = unsubscribe;
      });
    }
    register();

    // addNotificationResponseReceivedListener isn't guaranteed to fire for
    // the tap that cold-launched the app (process wasn't alive yet to
    // subscribe in time), so that case must be recovered separately here.
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      Notifications.clearLastNotificationResponse();
      const raw = lastResponse.notification.request.content.data;
      if (isNotificationPayload(raw)) handleNotificationTap(raw, queryClient);
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
      receivedSub.remove();
      responseSub.remove();
      unsubscribeReconnectRef.current?.();
      unsubscribeReconnectRef.current = null;
    };
  }, [isAuthenticated, queryClient]);
};
