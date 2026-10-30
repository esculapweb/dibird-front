jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
}));
jest.mock("../i18n", () => ({
  __esModule: true,
  default: { t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key) },
}));
jest.mock("../sync/networkStatus", () => ({ isConnected: jest.fn() }));
jest.mock("../errors", () => ({ reportWarning: jest.fn() }));
jest.mock("../../util/fetches", () => ({ fetchWantToVisitPlaces: jest.fn() }));
jest.mock("../../hooks/repositories/placeRepository", () => ({ getOverlay: jest.fn() }));

import * as Notifications from "expo-notifications";
import { isConnected } from "../sync/networkStatus";
import { fetchWantToVisitPlaces } from "../../util/fetches";
import * as placeRepository from "../../hooks/repositories/placeRepository";
import {
  schedulePlaceReminder,
  cancelAllPlaceReminders,
  reconcilePlaceReminders,
} from "../placeReminders";

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const getAll = Notifications.getAllScheduledNotificationsAsync as jest.Mock;

const FUTURE = "2099-06-01T08:30:00.000Z";
const PAST = "2000-06-01T08:30:00.000Z";

const place = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Place ${id}`,
  want_to_visit: true,
  visit_reminder_at: FUTURE,
  ...overrides,
});

const emptyOverlay = () => ({
  pendingCreates: [],
  patchesById: new Map(),
  deletedIds: new Set(),
});

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  (placeRepository.getOverlay as jest.Mock).mockReturnValue(emptyOverlay());
  getAll.mockResolvedValue([]);
});

describe("schedulePlaceReminder", () => {
  it("replaces the place's notification with one at the stored moment, tappable to the place", async () => {
    await schedulePlaceReminder(place(3));

    expect(cancel).toHaveBeenCalledWith("place-reminder-3");
    expect(schedule).toHaveBeenCalledWith({
      identifier: "place-reminder-3",
      content: {
        title: "reminder_notification_title",
        body: "reminder_notification_body:Place 3",
        data: { screen: "PlaceDetail", placeId: 3 },
      },
      trigger: { type: "date", date: new Date(FUTURE) },
    });
  });

  // A moment already behind us would fire the instant it is scheduled.
  it.each([
    ["the moment has passed", { visit_reminder_at: PAST }],
    ["there is no moment", { visit_reminder_at: null }],
    ["the place left the list", { want_to_visit: false }],
  ])("only cancels when %s", async (_label, overrides) => {
    await schedulePlaceReminder(place(3, overrides));

    expect(cancel).toHaveBeenCalledWith("place-reminder-3");
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe("cancelAllPlaceReminders", () => {
  it("cancels the place reminders and leaves any other scheduled notification alone", async () => {
    getAll.mockResolvedValue([
      { identifier: "place-reminder-1" },
      { identifier: "something-else" },
      { identifier: "place-reminder-2" },
    ]);

    await cancelAllPlaceReminders();

    expect(cancel.mock.calls.map(([id]) => id).sort()).toEqual([
      "place-reminder-1",
      "place-reminder-2",
    ]);
  });
});

describe("reconcilePlaceReminders", () => {
  // Reconciling against nothing would cancel every reminder on the device.
  it("does nothing offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);

    await reconcilePlaceReminders();

    expect(fetchWantToVisitPlaces).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("schedules the server's reminders and cancels the ones it no longer has", async () => {
    (fetchWantToVisitPlaces as jest.Mock).mockResolvedValue([
      place(1),
      place(2, { visit_reminder_at: PAST }),
    ]);
    getAll.mockResolvedValue([{ identifier: "place-reminder-9" }]);

    await reconcilePlaceReminders();

    expect(cancel).toHaveBeenCalledWith("place-reminder-9");
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0][0].identifier).toBe("place-reminder-1");
  });

  // Until the sync goes through, an offline edit exists only locally.
  it("lets the local unsynced edits win over the server copy", async () => {
    (fetchWantToVisitPlaces as jest.Mock).mockResolvedValue([place(1), place(2)]);
    (placeRepository.getOverlay as jest.Mock).mockReturnValue({
      pendingCreates: [place(-5)],
      patchesById: new Map([[1, place(1, { want_to_visit: false })]]),
      deletedIds: new Set([2]),
    });
    getAll.mockResolvedValue([
      { identifier: "place-reminder-1" },
      { identifier: "place-reminder-2" },
    ]);

    await reconcilePlaceReminders();

    expect(schedule.mock.calls.map(([req]) => req.identifier)).toEqual([
      "place-reminder--5",
    ]);
    expect(cancel).toHaveBeenCalledWith("place-reminder-1");
    expect(cancel).toHaveBeenCalledWith("place-reminder-2");
  });

  it("keeps what is scheduled when the request fails", async () => {
    (fetchWantToVisitPlaces as jest.Mock).mockRejectedValue(new Error("boom"));
    getAll.mockResolvedValue([{ identifier: "place-reminder-1" }]);

    await reconcilePlaceReminders();

    expect(cancel).not.toHaveBeenCalled();
  });
});
