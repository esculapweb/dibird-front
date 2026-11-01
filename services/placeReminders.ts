import * as Notifications from "expo-notifications";

import i18n from "./i18n";
import { isConnected } from "./sync/networkStatus";
import { reportWarning } from "./errors";
import { fetchWantToVisitPlaces } from "../util/fetches";
import * as placeRepository from "../hooks/repositories/placeRepository";
import type { NotificationPayload, PlaceItem } from "../types";

// "Want to visit" reminders are local notifications: the app hands the moment
// to the OS, which fires it on its own — offline, with the app killed, and
// without the backend. The server only stores `visit_reminder_at` so that a
// reinstall or another device can schedule the same reminder again
// (reconcilePlaceReminders). No Android channel of its own: these go to the
// default one, the same as the server pushes.

const ID_PREFIX = "place-reminder-";

const identifierFor = (placeId: number) => `${ID_PREFIX}${placeId}`;

type ReminderPlace = Pick<
  PlaceItem,
  "id" | "name" | "want_to_visit" | "visit_reminder_at"
>;

const reminderDate = (place: ReminderPlace): Date | null => {
  if (!place.want_to_visit || !place.visit_reminder_at) return null;
  const date = new Date(place.visit_reminder_at);
  // A moment already behind us would fire immediately — not a reminder.
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  return date;
};

export const cancelPlaceReminder = async (placeId: number): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifierFor(placeId));
  } catch (e) {
    reportWarning(e, "cancelPlaceReminder");
  }
};

/**
 * Bring the scheduled notification of one place in line with its data:
 * replaced when the place has a future reminder, cancelled otherwise. Safe to
 * call after every change of the place.
 */
export const schedulePlaceReminder = async (
  place: ReminderPlace,
): Promise<void> => {
  await cancelPlaceReminder(place.id);

  const date = reminderDate(place);
  if (!date) return;

  const data: NotificationPayload = { screen: "PlaceDetail", placeId: place.id };

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: identifierFor(place.id),
      content: {
        title: i18n.t("reminder_notification_title"),
        body: i18n.t("reminder_notification_body", { name: place.name }),
        data,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  } catch (e) {
    reportWarning(e, "schedulePlaceReminder");
  }
};

const scheduledReminderIds = async (): Promise<string[]> => {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .map((request) => request.identifier)
    .filter((id) => id.startsWith(ID_PREFIX));
};

/** On logout: the next account on this device must not get these. */
export const cancelAllPlaceReminders = async (): Promise<void> => {
  try {
    const ids = await scheduledReminderIds();
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
  } catch (e) {
    reportWarning(e, "cancelAllPlaceReminders");
  }
};

/**
 * Make the scheduled reminders match the server plus the local unsynced edits.
 *
 * Covers what scheduling on edit cannot: a reinstall, a reminder set on
 * another device, a temp id of an offline-created place replaced by the
 * server one, a place deleted elsewhere. Skipped offline — reconciling against
 * nothing would cancel every reminder.
 */
export const reconcilePlaceReminders = async (): Promise<void> => {
  if (!isConnected()) return;

  try {
    const serverPlaces = await fetchWantToVisitPlaces();

    // Local edits win over the server copy: a reminder set offline is only in
    // the overlay until the sync goes through, and a place un-flagged offline
    // is still flagged on the server.
    const { pendingCreates, patchesById, deletedIds } = placeRepository.getOverlay();
    const byId = new Map<number, ReminderPlace>();
    for (const place of serverPlaces) byId.set(place.id, place);
    for (const place of pendingCreates) byId.set(place.id, place);
    for (const [id, place] of patchesById) byId.set(id, place);
    for (const id of deletedIds) byId.delete(id);

    const wanted = [...byId.values()].filter((place) => reminderDate(place));
    const wantedIds = new Set(wanted.map((place) => identifierFor(place.id)));

    const stale = (await scheduledReminderIds()).filter((id) => !wantedIds.has(id));
    await Promise.all(
      stale.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    // Rescheduled rather than skipped when already there: the name or the
    // moment may have changed on another device.
    await Promise.all(wanted.map(schedulePlaceReminder));
  } catch (e) {
    // An API failure is already in Sentry from the interceptor in
    // services/api.ts; the next pass will try again.
    reportWarning(e, "reconcilePlaceReminders");
  }
};
