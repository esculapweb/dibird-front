jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";

import { setAuthReturn, takeAuthReturn } from "../authReturn";

const STORAGE_KEY = "auth_return";
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  // The module variable survives the import between tests — it is drained so that
  // the disk tests check the disk itself.
  await takeAuthReturn();
});

describe("setAuthReturn", () => {
  it("keeps a catalogue screen and hands it back once", async () => {
    await setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    expect(await takeAuthReturn()).toEqual({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
    });
    // Taken means forgotten: a second sign-in must not teleport anywhere.
    expect(await takeAuthReturn()).toBeNull();
  });

  // AppStack has no such screens, there is nothing to restore.
  it("drops a screen that is not part of the catalogue", async () => {
    await setAuthReturn({ name: "ObservationEditor" });

    expect(await takeAuthReturn()).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears a previously stored intent when called with null", async () => {
    await setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });
    await setAuthReturn(null);

    expect(await takeAuthReturn()).toBeNull();
  });
});

// Email signup leads out of the app (CheckEmail → mail client → confirm-email
// deep link), and by the time of the return the process is already killed:
// without the disk the return did not work on exactly the longest path.
describe("surviving a process restart", () => {
  // A restart = nothing in memory, something on disk. `beforeEach` has already
  // drained the module variable, so seeding the storage directly is enough — that
  // way the test checks the disk path rather than the same in-memory cache.
  const seed = (stored: Record<string, unknown>) =>
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

  it("writes the intent to disk, timestamped", async () => {
    const before = Date.now();
    await setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw as string)).toEqual({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
      savedAt: expect.any(Number),
    });
    expect(JSON.parse(raw as string).savedAt).toBeGreaterThanOrEqual(before);
  });

  it("restores an intent that only exists on disk", async () => {
    await seed({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
      savedAt: Date.now(),
    });

    expect(await takeAuthReturn()).toEqual({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
    });
  });

  it("forgets an intent older than a day", async () => {
    await seed({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
      savedAt: Date.now() - DAY - 1000,
    });

    expect(await takeAuthReturn()).toBeNull();
  });

  it("honours an intent that is just inside the window", async () => {
    await seed({ name: "SpeciesDetail", savedAt: Date.now() - DAY + 60_000 });

    expect(await takeAuthReturn()).toEqual({
      name: "SpeciesDetail",
      params: undefined,
    });
  });

  it("erases the stored intent even when it was too old to use", async () => {
    await seed({ name: "SpeciesDetail", savedAt: 0 });

    await takeAuthReturn();

    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores a stored screen that is no longer part of the catalogue", async () => {
    await seed({ name: "SomeRemovedScreen", savedAt: Date.now() });

    expect(await takeAuthReturn()).toBeNull();
  });

  it("survives a corrupted payload instead of throwing into the login flow", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "{not json");

    expect(await takeAuthReturn()).toBeNull();
  });
});

// The warm path (Apple/Google right in the sheet) is served by the module
// variable: the app is never left, and there is no point waiting for the disk
// there.
describe("when the disk is unavailable", () => {
  it("still returns the intent from memory", async () => {
    jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValueOnce(new Error("disk full"));

    await setAuthReturn({ name: "TerritoryDetail", params: { segment: "fr" } });

    expect(await takeAuthReturn()).toEqual({
      name: "TerritoryDetail",
      params: { segment: "fr" },
    });
  });
});
