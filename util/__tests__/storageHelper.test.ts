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
