import {
  getAnalytics,
  logEvent,
  setUserId,
  setUserProperties,
} from "@react-native-firebase/analytics";

import {
  lifelistBucket,
  setAnalyticsUserId,
  setUserProps,
  track,
} from "../analytics";

const mockLogEvent = logEvent as jest.Mock;
const mockSetUserId = setUserId as jest.Mock;
const mockSetUserProperties = setUserProperties as jest.Mock;
const mockGetAnalytics = getAnalytics as jest.Mock;

describe("analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAnalytics.mockReturnValue({});
    mockLogEvent.mockResolvedValue(undefined);
    mockSetUserId.mockResolvedValue(undefined);
    mockSetUserProperties.mockResolvedValue(undefined);
  });

  describe("track", () => {
    it("sends the event name and params through to Firebase", () => {
      track("deep_link_opened", { screen: "SpeciesDetail", authed: "no" });

      expect(mockLogEvent).toHaveBeenCalledWith({}, "deep_link_opened", {
        screen: "SpeciesDetail",
        authed: "no",
      });
    });

    it("sends undefined params for events that take none", () => {
      track("welcome_viewed");

      expect(mockLogEvent).toHaveBeenCalledWith({}, "welcome_viewed", undefined);
    });

    // Имена стандартных событий Firebase менять нельзя — на них завязаны
    // готовые отчёты и воронки в консоли.
    it.each(["login", "sign_up"] as const)(
      "keeps the standard Firebase name for %s",
      (name) => {
        track(name, { method: "google" });

        expect(mockLogEvent).toHaveBeenCalledWith({}, name, {
          method: "google",
        });
      },
    );

    it("swallows a rejected logEvent instead of failing the caller", async () => {
      mockLogEvent.mockRejectedValue(new Error("network"));
      // logError печатает в DEV — это и есть проверяемое поведение, но в
      // прогоне оно выглядит как предупреждение из ниоткуда.
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

      expect(() => track("observation_created")).not.toThrow();
      // Промис отклоняется на следующем тике — без .catch() внутри track это
      // был бы unhandled rejection посреди сценария логина.
      await Promise.resolve();

      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("swallows a synchronous throw from Firebase", () => {
      mockGetAnalytics.mockImplementation(() => {
        throw new Error("not initialised");
      });

      expect(() => track("welcome_viewed")).not.toThrow();
    });
  });

  describe("setUserProps", () => {
    it("passes properties through", () => {
      setUserProps({ guest_or_registered: "guest" });

      expect(mockSetUserProperties).toHaveBeenCalledWith(
        {},
        { guest_or_registered: "guest" },
      );
    });

    it("swallows a rejection", async () => {
      mockSetUserProperties.mockRejectedValue(new Error("nope"));

      expect(() => setUserProps({ ui_language: "ru" })).not.toThrow();
      await Promise.resolve();
    });
  });

  describe("setAnalyticsUserId", () => {
    it("sets the id", () => {
      setAnalyticsUserId("42");

      expect(mockSetUserId).toHaveBeenCalledWith({}, "42");
    });

    it("clears the id on logout so later events don't stick to it", () => {
      setAnalyticsUserId(null);

      expect(mockSetUserId).toHaveBeenCalledWith({}, null);
    });
  });

  describe("lifelistBucket", () => {
    it.each([
      [0, "0"],
      [-1, "0"],
      [1, "1-10"],
      [10, "1-10"],
      [11, "11-100"],
      [100, "11-100"],
      [101, "100+"],
      [5000, "100+"],
    ] as const)("buckets %s as %s", (count, expected) => {
      expect(lifelistBucket(count)).toBe(expected);
    });
  });
});
