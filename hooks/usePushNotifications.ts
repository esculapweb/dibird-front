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

export const usePushNotifications = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();
  const unsubscribeReconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function register() {
      if (!Device.isDevice) {
        return null;
      }

      const { status } =
        (await Notifications.requestPermissionsAsync()) as Notifications.NotificationPermissionsStatus & {
          status: "granted" | "denied" | "undetermined";
          granted: boolean;
          canAskAgain: boolean;
          expires: "never" | number;
        };

      if (status !== "granted") return;

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
        unsubscribeReconnectRef.current = subscribeToReconnect(async () => {
          if (await attemptRegister()) {
            unsubscribeReconnectRef.current?.();
            unsubscribeReconnectRef.current = null;
          }
        });
      }
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
