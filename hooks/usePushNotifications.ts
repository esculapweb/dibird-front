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
 * Показать системный диалог о пушах и зарегистрировать токен.
 *
 * Вызывается **только** из точек, где пользователь сам попросил то, ради чего
 * нужны уведомления (карточка алертов на главной, свитч в настройках алертов).
 * Раньше диалог всплывал сразу после логина, ни к чему не привязанный, —
 * отказать в такой момент проще, чем согласиться, а доля с пушами это вход во
 * все retention-петли.
 *
 * Возвращает, выдано ли разрешение. Повторный вызов после отказа безвреден:
 * система второй диалог не покажет и вернёт прежний статус.
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

      // getPermissionsAsync, не request: этот хук монтируется по факту входа в
      // аккаунт, а вход — не повод показывать системный диалог (см.
      // requestPushPermission). Здесь только подхватывается разрешение,
      // выданное раньше, чтобы токен доехал до бэкенда после переустановки,
      // смены токена или отзыва разрешения в настройках ОС.
      const { status } = (await Notifications.getPermissionsAsync()) as {
        status: PermissionStatus;
      };

      // Доля с пушами — вход в retention-петли, поэтому свойство ставится и
      // на отказе; «ещё не спрашивали» при этом остаётся отдельным значением,
      // иначе оно смешалось бы с отказавшими.
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
