// jest.config.js's setupFiles path only evaluates the async-storage mock
// module without wiring it up as a replacement — see util/__tests__/auth.test.ts's
// identical comment. Using the real (mocked) in-memory implementation here
// (not a bare jest.fn() stub) lets these tests verify actual persistence
// round-trips, not just that some function was called.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as storageHelper from "../storageHelper";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("saveSort / loadSort / clearSort", () => {
  it("round-trips a value for a given screen", async () => {
    await storageHelper.saveSort("Observations", "-date_time");
    expect(await storageHelper.loadSort("Observations")).toBe("-date_time");
  });

  it("keeps different screens' sorts independent", async () => {
    await storageHelper.saveSort("Observations", "-date_time");
    await storageHelper.saveSort("Diaries", "name");

    expect(await storageHelper.loadSort("Observations")).toBe("-date_time");
    expect(await storageHelper.loadSort("Diaries")).toBe("name");
  });

  it("returns null for a screen that was never saved", async () => {
    expect(await storageHelper.loadSort("Never")).toBeNull();
  });

  it("clearSort removes only that screen's entry", async () => {
    await storageHelper.saveSort("Observations", "-date_time");
    await storageHelper.saveSort("Diaries", "name");

    await storageHelper.clearSort("Observations");

    expect(await storageHelper.loadSort("Observations")).toBeNull();
    expect(await storageHelper.loadSort("Diaries")).toBe("name");
  });
});

describe("global filter fields", () => {
  it("saves and loads territory/date/place/species without one clobbering another", async () => {
    await storageHelper.saveGlobalTerritory(5);
    await storageHelper.saveGlobalDateFilter({ type: "today" });
    await storageHelper.saveGlobalPlace(2);
    await storageHelper.saveGlobalSpecies(9);

    expect(await storageHelper.loadGlobalTerritory()).toBe(5);
    expect(await storageHelper.loadGlobalDateFilter()).toEqual({ type: "today" });
    expect(await storageHelper.loadGlobalPlace()).toBe(2);
    expect(await storageHelper.loadGlobalSpecies()).toBe(9);
  });

  it("overwriting one field leaves the others untouched", async () => {
    await storageHelper.saveGlobalTerritory(5);
    await storageHelper.saveGlobalPlace(2);

    await storageHelper.saveGlobalTerritory(7);

    expect(await storageHelper.loadGlobalTerritory()).toBe(7);
    expect(await storageHelper.loadGlobalPlace()).toBe(2);
  });

  it("returns null for any field that was never saved", async () => {
    expect(await storageHelper.loadGlobalTerritory()).toBeNull();
    expect(await storageHelper.loadGlobalDateFilter()).toBeNull();
  });
});

describe("clearAllGlobalFilters", () => {
  it("wipes every global field and the filters_inited flag together", async () => {
    await storageHelper.saveGlobalTerritory(5);
    await storageHelper.saveGlobalPlace(2);
    await AsyncStorage.setItem("filters_inited", "true");

    await storageHelper.clearAllGlobalFilters();

    expect(await storageHelper.loadGlobalTerritory()).toBeNull();
    expect(await storageHelper.loadGlobalPlace()).toBeNull();
    expect(await AsyncStorage.getItem("filters_inited")).toBeNull();
  });
});

describe("initGlobalFilters", () => {
  it("seeds territory from the profile and a default 'this_year' date filter on first run", async () => {
    await storageHelper.initGlobalFilters(5);

    expect(await storageHelper.loadGlobalTerritory()).toBe(5);
    expect(await storageHelper.loadGlobalDateFilter()).toEqual({ type: "this_year" });
    expect(await AsyncStorage.getItem("filters_inited")).toBe("true");
  });

  it("leaves territory unset when the profile has none to seed from", async () => {
    await storageHelper.initGlobalFilters(null);
    expect(await storageHelper.loadGlobalTerritory()).toBeNull();
  });

  it("does not overwrite an already-saved territory, even with a different profile territory", async () => {
    await storageHelper.saveGlobalTerritory(9);
    await storageHelper.initGlobalFilters(5);
    expect(await storageHelper.loadGlobalTerritory()).toBe(9);
  });

  it("does not overwrite an already-saved date filter", async () => {
    await storageHelper.saveGlobalDateFilter({ type: "all" });
    await storageHelper.initGlobalFilters(5);
    expect(await storageHelper.loadGlobalDateFilter()).toEqual({ type: "all" });
  });

  it("is a no-op on a second call, even with different arguments", async () => {
    await storageHelper.initGlobalFilters(5);
    await storageHelper.initGlobalFilters(9);

    expect(await storageHelper.loadGlobalTerritory()).toBe(5);
  });
});

describe("getLastLoggedInUserId / setLastLoggedInUserId", () => {
  it("round-trips a user id", async () => {
    await storageHelper.setLastLoggedInUserId(42);
    expect(await storageHelper.getLastLoggedInUserId()).toBe(42);
  });

  it("returns null when nothing has been saved yet", async () => {
    expect(await storageHelper.getLastLoggedInUserId()).toBeNull();
  });

  it("survives clearAllGlobalFilters and clearSort — it's a separate key, not swept up by logout's own cleanup", async () => {
    await storageHelper.setLastLoggedInUserId(42);
    await storageHelper.saveGlobalTerritory(5);
    await storageHelper.saveSort("Observations", "-date_time");

    await storageHelper.clearAllGlobalFilters();
    await storageHelper.clearSort("Observations");

    expect(await storageHelper.getLastLoggedInUserId()).toBe(42);
  });
});

describe("error resilience", () => {
  it("save* swallows an AsyncStorage failure instead of throwing", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await expect(storageHelper.saveGlobalTerritory(5)).resolves.toBeUndefined();
  });

  it("load* swallows an AsyncStorage failure and returns null instead of throwing", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk error"));
    await expect(storageHelper.loadGlobalTerritory()).resolves.toBeNull();
  });

  it("clearSort swallows an AsyncStorage failure instead of throwing", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk error"));
    await expect(storageHelper.clearSort("Observations")).resolves.toBeUndefined();
  });
});

describe("onboarding flag", () => {
  it("is not pending until marked, and is cleared again", async () => {
    expect(await storageHelper.isOnboardingPending()).toBe(false);

    await storageHelper.markOnboardingPending();
    expect(await storageHelper.isOnboardingPending()).toBe(true);

    await storageHelper.clearOnboardingPending();
    expect(await storageHelper.isOnboardingPending()).toBe(false);
  });

  // A repeated onboarding annoys more than a missed one.
  it("reads as not pending when the disk can't be read", async () => {
    await storageHelper.markOnboardingPending();
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk error"));
    expect(await storageHelper.isOnboardingPending()).toBe(false);
  });

  it("mark/clear swallow an AsyncStorage failure", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await expect(storageHelper.markOnboardingPending()).resolves.toBeUndefined();

    jest.spyOn(AsyncStorage, "removeItem").mockRejectedValueOnce(new Error("disk error"));
    await expect(storageHelper.clearOnboardingPending()).resolves.toBeUndefined();
  });
});

describe("markFirstObservationTracked", () => {
  // The activation event must go out exactly once per install.
  it("reports true the first time only", async () => {
    expect(await storageHelper.markFirstObservationTracked()).toBe(true);
    expect(await storageHelper.markFirstObservationTracked()).toBe(false);
  });

  it("reports false when the flag can't be saved", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    expect(await storageHelper.markFirstObservationTracked()).toBe(false);
  });
});

describe("loadReportedRelease / saveReportedRelease", () => {
  it("round-trips a release per slot", async () => {
    const release = { revision: "abc", done: true, firstAskedAt: 1000 };
    await storageHelper.saveReportedRelease("build", release);

    expect(await storageHelper.loadReportedRelease("build")).toEqual(release);
    expect(await storageHelper.loadReportedRelease("ota_applied")).toBeNull();
  });

  // Stored by an older build, or tampered with: only a revision is required.
  it("fills in what an older entry lacks, and rejects one without a revision", async () => {
    jest.spyOn(Date, "now").mockReturnValue(5000);
    await storageHelper.saveReportedRelease("ota_pending", { revision: "r1" } as never);
    expect(await storageHelper.loadReportedRelease("ota_pending")).toEqual({
      revision: "r1",
      done: false,
      firstAskedAt: 5000,
    });

    await storageHelper.saveReportedRelease("ota_pending", { done: true } as never);
    expect(await storageHelper.loadReportedRelease("ota_pending")).toBeNull();

    await storageHelper.saveReportedRelease("ota_pending", "r1" as never);
    expect(await storageHelper.loadReportedRelease("ota_pending")).toBeNull();
  });
});

describe("more error resilience", () => {
  it("getLastLoggedInUserId / setLastLoggedInUserId swallow an AsyncStorage failure", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk error"));
    expect(await storageHelper.getLastLoggedInUserId()).toBeNull();

    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await expect(storageHelper.setLastLoggedInUserId(3)).resolves.toBeUndefined();
  });

  it("clearSort swallows a failed write", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await expect(storageHelper.clearSort("Observations")).resolves.toBeUndefined();
  });

  it("saveViewMode / loadViewMode round-trip per screen", async () => {
    await storageHelper.saveViewMode("Places", "map");
    expect(await storageHelper.loadViewMode("Places")).toBe("map");
    expect(await storageHelper.loadViewMode("Diaries")).toBeNull();
  });
});
