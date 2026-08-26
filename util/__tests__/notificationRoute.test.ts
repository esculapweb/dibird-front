import { routeNotification } from "../notificationRoute";
import type { NotificationPayload } from "../../types";

const navigate = jest.fn();

const route = (payload: NotificationPayload) =>
  routeNotification(payload, navigate);

beforeEach(() => jest.clearAllMocks());

describe("routeNotification", () => {
  it("sends a batch of finds to the feed, with them highlighted", () => {
    route({ screen: "Community", highlightObsIds: [1, 2] });

    expect(navigate).toHaveBeenCalledWith("Community", {
      highlightObsIds: [1, 2],
    });
  });

  // What a single find sends — the commonest alert there is, and the one that
  // used to fall through the push-side switch and leave the app where it was.
  it("sends a single find to its card", () => {
    route({ screen: "CommunityDetail", obsId: 31 });

    expect(navigate).toHaveBeenCalledWith("CommunityDetail", {
      observationId: 31,
    });
  });

  it("sends SpeciesDetail the species id, tagged as coming from a push", () => {
    route({ screen: "SpeciesDetail", speciesId: 42 });

    expect(navigate).toHaveBeenCalledWith("SpeciesDetail", {
      id: 42,
      source: "notification",
    });
  });

  it("sends Achievements the highlight id", () => {
    route({ screen: "Achievements", achievementId: "a1" });

    expect(navigate).toHaveBeenCalledWith("Achievements", {
      highlightId: "a1",
    });
  });

  it("opens the checklist with no params", () => {
    route({ screen: "Checklist" });

    expect(navigate).toHaveBeenCalledWith("Checklist", undefined);
  });

  it("opens the in-app notification list", () => {
    route({ screen: "Notifications" });

    expect(navigate).toHaveBeenCalledWith("Notifications", undefined);
  });

  // A payload the switch does not know is a tap that does nothing at all — the
  // app opens and stays put, with nothing to see anywhere. Keep this list in
  // step with NotificationPayload.
  it.each([
    ["Community"],
    ["CommunityDetail"],
    ["SpeciesDetail"],
    ["Achievements"],
    ["Notifications"],
    ["Checklist"],
  ])("has a branch for the %s payload", (screen) => {
    route({ screen, obsId: 1, speciesId: 1 } as never);

    expect(navigate).toHaveBeenCalled();
  });

  // isNotificationPayload vouches for `screen` alone, so the ids are a claim of
  // the backend's rather than a fact. A detail screen with nothing to load is
  // worse than staying put: it also covers up whatever was underneath.
  it.each([
    ["CommunityDetail", "obsId"],
    ["SpeciesDetail", "speciesId"],
  ])("stays put when %s arrives without its %s", (screen) => {
    route({ screen } as never);

    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores a screen it has never heard of", () => {
    route({ screen: "SomethingNew" } as never);

    expect(navigate).not.toHaveBeenCalled();
  });
});
