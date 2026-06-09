import { useEffect } from "react";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import "../services/i18n";
import { registerPushToken } from "../util/fetches";
import { UNREAD_COUNT_KEY } from "../hooks/useUnreadCount";
import { navigateFromNotification } from "../services/navigationRef";
import { logError } from "../services/errors";
import { isNotificationPayload, NotificationPayload } from "../types";

export const handleNotificationNavigation = (raw: NotificationPayload) => {
  switch (raw.screen) {
    case "AlertsFeed":
      navigateFromNotification("AlertsFeed", { highlightObsId: raw.obsId });
      break;
    case "SpeciesDetail":
      navigateFromNotification("SpeciesDetail", { id: raw.speciesId });
      break;
    case "Achievements":
      navigateFromNotification("Achievements", {
        highlightId: raw.achievementId,
      });
      break;
    // case 'Checklists':
    //       navigation.navigate('Checklists')
    //       break
  }
};

export const usePushNotifications = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    async function register() {
      const { status } = (await Notifications.requestPermissionsAsync()) as Notifications.NotificationPermissionsStatus & {
        status: "granted" | "denied" | "undetermined";
        granted: boolean;
        canAskAgain: boolean;
        expires: "never" | number;
      };

      if (status !== "granted") return;

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      try {
        await registerPushToken(token.data);
      } catch (e) {
        logError(e, "registerPushTokenError API ERROR");
      }
    }
    register();

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const raw = response.notification.request.content.data;
        if (!isNotificationPayload(raw)) return;
        handleNotificationNavigation(raw);
      },
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [isAuthenticated, queryClient]);
};
