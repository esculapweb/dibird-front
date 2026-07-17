// Regression coverage for the bug where changing a dropdown's sort while
// offline broke the Places/Species pickers: fetchMyPlaces/fetchSpecies used
// to only try an exact-key cache match (which embeds the sort order), so a
// sort change offline was a guaranteed cache miss even though data for the
// same list under a *different* order was cached. These now fall back to a
// relaxed, order-ignoring prefix match (mirroring fetchAbstract's pattern)
// and resort the result client-side — see util/fetches.ts.
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("../../hooks/repositories/listCacheRepository", () => ({
  cacheListResponse: jest.fn(),
  getCachedListResponse: jest.fn(() => null),
  getCachedListResponseByPrefix: jest.fn(() => null),
}));

import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestDb } from "../../hooks/repositories/testDb";
import * as schema from "../../services/db/schema";
import { stableStringify } from "../helpers";
import { PlaceDropdownItem, SpeciesDropdownItem } from "../../types";

type FetchesModule = typeof import("../fetches");
type ApiMock = { get: jest.Mock };
type ListCacheRepoMock = {
  getCachedListResponse: jest.Mock;
  getCachedListResponseByPrefix: jest.Mock;
  cacheListResponse: jest.Mock;
};

const NETWORK_ERROR = { isNetworkError: true, message: "Network Error" };

let db: BetterSQLite3Database<typeof schema>;
let fetches: FetchesModule;
let api: ApiMock;
let listCacheRepository: ListCacheRepoMock;

beforeEach(() => {
  jest.resetModules();
  db = createTestDb();
  jest.doMock("../../services/db/client", () => ({
    db,
    sqliteDb: {},
    runMigrations: jest.fn(async () => {}),
  }));

  fetches = require("../fetches");
  api = require("../../services/api").default;
  listCacheRepository = require("../../hooks/repositories/listCacheRepository");

  api.get.mockReset().mockRejectedValue(NETWORK_ERROR);
  listCacheRepository.getCachedListResponse.mockReset().mockReturnValue(null);
  listCacheRepository.getCachedListResponseByPrefix.mockReset().mockReturnValue(null);
  listCacheRepository.cacheListResponse.mockReset();
});

describe("fetchMyPlaces offline sort fallback", () => {
  const cachedUnderOtherOrder: PlaceDropdownItem[] = [
    { value: 2, label: "Zoo" },
    { value: 1, label: "Aquarium", iconLabel: "star" },
    { value: 3, label: "Museum" },
  ];

  it("still throws when there's no cache at all for the territory", async () => {
    await expect(fetches.fetchMyPlaces(5, null, "name")).rejects.toBe(NETWORK_ERROR);
  });

  it("falls back to a differently-ordered cache entry and resorts by name", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(
      cachedUnderOtherOrder,
    );

    const result = await fetches.fetchMyPlaces(5, null, "name");

    expect(listCacheRepository.getCachedListResponseByPrefix).toHaveBeenCalledWith(
      expect.anything(),
      "places|5|",
    );
    expect(result.map((p) => p.label)).toEqual(["Aquarium", "Museum", "Zoo"]);
  });

  it("resorts by favourite first when requested", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(
      cachedUnderOtherOrder,
    );

    const result = await fetches.fetchMyPlaces(5, null, "-favourite,name");

    expect(result.map((p) => p.label)).toEqual(["Aquarium", "Museum", "Zoo"]);
  });

  it("leaves the cached order untouched for distance sort when cached items don't carry a distance", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(
      cachedUnderOtherOrder,
    );

    const result = await fetches.fetchMyPlaces(5, null, "distance");

    expect(result.map((p) => p.label)).toEqual(["Zoo", "Aquarium", "Museum"]);
  });

  it("resorts by distance offline when the cache was last populated with it (e.g. toggling asc/desc)", async () => {
    const cachedWithDistance: PlaceDropdownItem[] = [
      { value: 2, label: "Zoo", distance: 500 },
      { value: 1, label: "Aquarium", distance: 100 },
      { value: 3, label: "Museum", distance: 250 },
    ];
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(
      cachedWithDistance,
    );

    const asc = await fetches.fetchMyPlaces(5, null, "distance");
    expect(asc.map((p) => p.label)).toEqual(["Aquarium", "Museum", "Zoo"]);

    const desc = await fetches.fetchMyPlaces(5, null, "-distance");
    expect(desc.map((p) => p.label)).toEqual(["Zoo", "Museum", "Aquarium"]);
  });
});

describe("fetchSpecies offline sort fallback", () => {
  const cachedUnderOtherOrder: SpeciesDropdownItem[] = [
    { value: 2, label: "Robin", name_lang: "Robin", seen: false },
    { value: 1, label: "Albatross", name_lang: "Albatross", seen: true },
    { value: 3, label: "Wren", name_lang: "Wren", seen: false },
  ];

  it("still throws when there's no cache at all for the territory", async () => {
    await expect(fetches.fetchSpecies(5, "name")).rejects.toBe(NETWORK_ERROR);
  });

  it("falls back to a differently-ordered cache entry and resorts by name", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(
      cachedUnderOtherOrder,
    );

    const result = await fetches.fetchSpecies(5, "name");

    expect(listCacheRepository.getCachedListResponseByPrefix).toHaveBeenCalledWith(
      expect.anything(),
      `species|5|${stableStringify({})}|`,
    );
    expect(result.map((s) => s.label)).toEqual(["Albatross", "Robin", "Wren"]);
  });

  it("resorts seen-first when requested", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(
      cachedUnderOtherOrder,
    );

    const result = await fetches.fetchSpecies(5, "-seen,name");

    expect(result.map((s) => s.label)).toEqual(["Albatross", "Robin", "Wren"]);
  });

  it("leaves the cached order untouched for ioc_id sort when older cache entries lack it", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(
      cachedUnderOtherOrder,
    );

    const result = await fetches.fetchSpecies(5, "ioc_id");

    expect(result.map((s) => s.label)).toEqual(["Robin", "Albatross", "Wren"]);
  });

  it("resorts by ioc_id when every cached item has it (backend already returns it)", async () => {
    const cachedWithIocId: SpeciesDropdownItem[] = [
      { value: 2, label: "Robin", name_lang: "Robin", seen: false, ioc_id: 300 },
      { value: 1, label: "Albatross", name_lang: "Albatross", seen: true, ioc_id: 10 },
      { value: 3, label: "Wren", name_lang: "Wren", seen: false, ioc_id: 200 },
    ];
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue(cachedWithIocId);

    const result = await fetches.fetchSpecies(5, "ioc_id");

    expect(result.map((s) => s.label)).toEqual(["Albatross", "Wren", "Robin"]);
  });
});

describe("resortPlaceItems / resortSpeciesDropdownItems", () => {
  it("resortPlaceItems sorts by name ascending", () => {
    const items: PlaceDropdownItem[] = [
      { value: 1, label: "Zoo" },
      { value: 2, label: "Aquarium" },
    ];
    expect(fetches.resortPlaceItems(items, "name").map((i) => i.label)).toEqual([
      "Aquarium",
      "Zoo",
    ]);
  });

  it("resortPlaceItems sorts by distance when every item has it", () => {
    const items: PlaceDropdownItem[] = [
      { value: 1, label: "Zoo", distance: 500 },
      { value: 2, label: "Aquarium", distance: 100 },
    ];
    expect(
      fetches.resortPlaceItems(items, "-distance").map((i) => i.label),
    ).toEqual(["Zoo", "Aquarium"]);
  });

  it("resortPlaceItems bails out on distance when any item is missing it", () => {
    const items: PlaceDropdownItem[] = [
      { value: 1, label: "Zoo", distance: 500 },
      { value: 2, label: "Aquarium" },
    ];
    expect(
      fetches.resortPlaceItems(items, "distance").map((i) => i.label),
    ).toEqual(["Zoo", "Aquarium"]);
  });

  it("resortSpeciesDropdownItems sorts seen items first when requested", () => {
    const items: SpeciesDropdownItem[] = [
      { value: 1, label: "Wren", name_lang: "Wren", seen: false },
      { value: 2, label: "Albatross", name_lang: "Albatross", seen: true },
    ];
    expect(
      fetches.resortSpeciesDropdownItems(items, "-seen,name").map((i) => i.label),
    ).toEqual(["Albatross", "Wren"]);
  });

  it("resortSpeciesDropdownItems sorts by ioc_id when every item has it", () => {
    const items: SpeciesDropdownItem[] = [
      { value: 1, label: "Wren", name_lang: "Wren", ioc_id: 50 },
      { value: 2, label: "Albatross", name_lang: "Albatross", ioc_id: 5 },
    ];
    expect(
      fetches.resortSpeciesDropdownItems(items, "ioc_id").map((i) => i.label),
    ).toEqual(["Albatross", "Wren"]);
  });

  it("resortSpeciesDropdownItems bails out on ioc_id when any item is missing it", () => {
    const items: SpeciesDropdownItem[] = [
      { value: 1, label: "Wren", name_lang: "Wren", ioc_id: 50 },
      { value: 2, label: "Albatross", name_lang: "Albatross" },
    ];
    expect(
      fetches.resortSpeciesDropdownItems(items, "ioc_id").map((i) => i.label),
    ).toEqual(["Wren", "Albatross"]);
  });
});
