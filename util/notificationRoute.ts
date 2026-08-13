import type {
  AppStackParamList,
  NotificationPayload,
  NotificationScreen,
} from "../types";

/**
 * How `routeNotification` is given a way to navigate.
 *
 * Generic rather than a plain `(screen, params)` so that the params are checked
 * against the screen — and, because `NotificationScreen` is used as the index,
 * so that a payload pointing at a screen `AppStackParamList` does not have fails
 * to compile here.
 */
export type NotificationNavigate = <K extends NotificationScreen>(
  screen: K,
  params: AppStackParamList[K],
) => void;

/**
 * Where a notification leads.
 *
 * The same payload reaches the app twice — as a push (hooks/usePushNotifications)
 * and as a row in the in-app list (screens/NotificationsScreen) — and both must
 * open the same screen. They used to hold a `switch` each, which is how they
 * drifted: the list learned `CommunityDetail`, the push side never did, and the
 * commonest alert of all opened the app and left it where it was. One switch, two
 * callers, so the next payload can only be added in one place.
 */
export const routeNotification = (
  payload: NotificationPayload,
  navigate: NotificationNavigate,
): void => {
  switch (payload.screen) {
    // Several finds at once: the feed, with them highlighted.
    case "Community":
      navigate("Community", { highlightObsIds: payload.highlightObsIds });
      break;

    // What a single find sends (alert_dispatcher._build_single_text on the
    // backend) — the commonest alert there is.
    case "CommunityDetail":
      // The ids are re-checked because isNotificationPayload vouches for
      // `screen` alone (see types.ts): a card with nothing to load is worse
      // than staying put, since it also takes away the screen underneath.
      if (payload.obsId == null) break;
      navigate("CommunityDetail", { observationId: payload.obsId });
      break;

    case "SpeciesDetail":
      if (payload.speciesId == null) break;
      navigate("SpeciesDetail", { id: payload.speciesId });
      break;

    case "Achievements":
      navigate("Achievements", { highlightId: payload.achievementId });
      break;

    case "Notifications":
      navigate("Notifications", undefined);
      break;

    case "Checklist":
      navigate("Checklist", undefined);
      break;
  }
};
