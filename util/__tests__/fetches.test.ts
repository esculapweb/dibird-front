jest.mock("../../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));
jest.mock("../../services/i18n", () => ({ __esModule: true, default: { language: "en" } }));
jest.mock("../../services/sync/networkStatus", () => ({ isConnected: jest.fn() }));
jest.mock("../../services/sync/notificationSync", () => ({ runNotificationSync: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  downloadAsync: jest.fn(),
}));
jest.mock("../../hooks/repositories/referenceRepository", () => ({
  cacheCountries: jest.fn(),
  getCachedCountries: jest.fn(() => []),
  cacheTimezones: jest.fn(),
  getCachedTimezones: jest.fn(() => []),
}));
jest.mock("../../hooks/repositories/listCacheRepository", () => ({
  cacheListResponse: jest.fn(),
  getCachedListResponse: jest.fn(),
  getCachedListResponseByPrefix: jest.fn(),
}));
jest.mock("../../hooks/repositories/observationRepository", () => ({
  getOverlay: jest.fn(() => ({ pendingCreates: [], patchesById: new Map(), deletedIds: new Set() })),
  applyOverlay: jest.fn((data) => data),
  applyDiaryOverlay: jest.fn((data) => data),
  getUnsyncedItems: jest.fn(() => []),
}));
jest.mock("../../hooks/repositories/diaryRepository", () => ({
  getOverlay: jest.fn(() => ({ pendingCreates: [], patchesById: new Map(), deletedIds: new Set() })),
  applyOverlay: jest.fn((data) => data),
  getDiary: jest.fn(),
  getUnsyncedItems: jest.fn(() => []),
}));
jest.mock("../../hooks/repositories/placeRepository", () => ({
  getOverlay: jest.fn(() => ({ pendingCreates: [], patchesById: new Map(), deletedIds: new Set() })),
  applyOverlay: jest.fn((data) => data),
  applyDropdownOverlay: jest.fn((items) => items),
  getUnsyncedItems: jest.fn(() => []),
}));
jest.mock("../../hooks/repositories/notificationRepository", () => ({
  applyOverlay: jest.fn((data) => data),
  applyPendingUnreadAdjustment: jest.fn((count) => count),
  markIdsReadLocal: jest.fn(),
  markAllReadLocal: jest.fn(),
}));

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sentry from "@sentry/react-native";
import api from "../../services/api";
import { isConnected } from "../../services/sync/networkStatus";
import { runNotificationSync } from "../../services/sync/notificationSync";
import * as referenceRepository from "../../hooks/repositories/referenceRepository";
import * as listCacheRepository from "../../hooks/repositories/listCacheRepository";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import * as diaryRepository from "../../hooks/repositories/diaryRepository";
import * as placeRepository from "../../hooks/repositories/placeRepository";
import * as notificationRepository from "../../hooks/repositories/notificationRepository";
import { emptyPaginatedResponse } from "../../types";
import * as fetches from "../fetches";

const networkError = () => Object.assign(new Error("network down"), { isNetworkError: true });

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
});

describe("sortChecklistSpecies", () => {
  const rows = [
    { type: "species", species_id: 1, name_lang: "Robin" },
    { type: "species", species_id: 2, name_lang: "Blackbird" },
    { type: "species", species_id: 3, name_lang: "Wren" },
  ] as never[];

  const names = (items: never[]) =>
    items.map((i: never) => (i as { name_lang: string }).name_lang);

  it("keeps the server's order for the taxonomic sort", () => {
    // /myapi/checklist2/ answers in taxonomic order and the rows carry no ioc
    // id, so "taxonomic" is the order they arrived in.
    expect(fetches.sortChecklistSpecies(rows, "ioc_id")).toBe(rows);
    expect(fetches.sortChecklistSpecies(rows, null)).toBe(rows);
  });

  it("reverses it for the descending taxonomic sort", () => {
    expect(names(fetches.sortChecklistSpecies(rows, "-ioc_id") as never[])).toEqual([
      "Wren",
      "Blackbird",
      "Robin",
    ]);
  });

  it("sorts by the localized name both ways", () => {
    expect(names(fetches.sortChecklistSpecies(rows, "name") as never[])).toEqual([
      "Blackbird",
      "Robin",
      "Wren",
    ]);
    expect(names(fetches.sortChecklistSpecies(rows, "-name") as never[])).toEqual([
      "Wren",
      "Robin",
      "Blackbird",
    ]);
  });

  it("leaves the caller's array alone", () => {
    fetches.sortChecklistSpecies(rows, "-name");
    expect(names(rows)).toEqual(["Robin", "Blackbird", "Wren"]);
  });
});

describe("sortSpeciesItems", () => {
  const items = [
    { species_id: 1, sp_name_lang: "Robin", ioc_id: 3, seen: false, max_date: "2026-01-02" },
    { species_id: 2, sp_name_lang: "Blackbird", ioc_id: 1, seen: true, max_date: "2026-01-01" },
    { species_id: 3, sp_name_lang: "Wren", ioc_id: 2, seen: false, max_date: null },
  ] as never[];

  it("returns the items unchanged when there's no order", () => {
    expect(fetches.sortSpeciesItems(items, null)).toBe(items);
  });

  it("sorts by name ascending", () => {
    const sorted = fetches.sortSpeciesItems(items, "name");
    expect(sorted.map((i: never) => (i as { sp_name_lang: string }).sp_name_lang)).toEqual([
      "Blackbird",
      "Robin",
      "Wren",
    ]);
  });

  it("sorts by ioc_id descending when every item has one", () => {
    const sorted = fetches.sortSpeciesItems(items, "-ioc_id");
    expect(sorted.map((i: never) => (i as { ioc_id: number }).ioc_id)).toEqual([3, 2, 1]);
  });

  it("leaves the order untouched when sorting by ioc_id but some items lack it", () => {
    const missing = [...items, { species_id: 4, sp_name_lang: "Owl" }] as never[];
    expect(fetches.sortSpeciesItems(missing, "ioc_id")).toBe(missing);
  });

  it("sorts nulls last regardless of direction", () => {
    const sorted = fetches.sortSpeciesItems(items, "date_time");
    expect(sorted.map((i: never) => (i as { species_id: number }).species_id)).toEqual([2, 1, 3]);
  });

  it("breaks ties using subsequent comma-separated fields", () => {
    const tied = [
      { species_id: 1, sp_name_lang: "A", seen: false },
      { species_id: 2, sp_name_lang: "A", seen: true },
    ] as never[];
    const sorted = fetches.sortSpeciesItems(tied, "name,-seen");
    expect(sorted.map((i: never) => (i as { species_id: number }).species_id)).toEqual([2, 1]);
  });
});

describe("fetchAbstract core mechanics (exercised via fetchChecklist)", () => {
  it("fetches live and caches the response", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [{ id: 1 }] } });
    const result = await fetches.fetchChecklist({ territory: 5 }, "-ioc_id", "", 1);

    expect(api.get).toHaveBeenCalledWith(
      "/myapi/checklist2/",
      expect.objectContaining({ params: expect.objectContaining({ territory: 5, o: "-ioc_id", per_page: 100 }) }),
    );
    expect(listCacheRepository.cacheListResponse).toHaveBeenCalled();
    expect(result).toEqual({ results: [{ id: 1 }] });
  });

  it("omits null/undefined filter values from the request params", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: {} });
    await fetches.fetchChecklist({ territory: 5, place: null } as never, null, "", 1);
    const params = (api.get as jest.Mock).mock.calls[0][1].params;
    expect(params).not.toHaveProperty("place");
  });

  it("includes search as `name` only when non-empty, and page only when > 1", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: {} });
    await fetches.fetchChecklist({}, null, "sparrow", 3);
    const params = (api.get as jest.Mock).mock.calls[0][1].params;
    expect(params.name).toBe("sparrow");
    expect(params.page).toBe(3);

    (api.get as jest.Mock).mockClear();
    await fetches.fetchChecklist({}, null, "", 1);
    const params2 = (api.get as jest.Mock).mock.calls[0][1].params;
    expect(params2).not.toHaveProperty("name");
    expect(params2).not.toHaveProperty("page");
  });

  it("falls back to the exact cache match when the request fails", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ results: [{ id: 9 }] });
    const result = await fetches.fetchChecklist({}, null, "", 1);
    expect(result).toEqual({ results: [{ id: 9 }] });
  });

  it("falls back to a differently-sorted cache entry (relaxed match) when there's no exact match", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue({ results: [{ id: 7 }] });
    const result = await fetches.fetchChecklist({}, "-ioc_id", "", 1);
    expect(result).toEqual({ results: [{ id: 7 }] });
  });

  it("rethrows the original error when nothing at all is cached", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);
    await expect(fetches.fetchChecklist({}, null, "", 1)).rejects.toBe(err);
  });

  // An offline request does not fail right away — the socket hangs until the
  // `timeout: 10000` from services/api.ts, and all that time the screen sits on a
  // spinner even though the answer is already in the cache (see the comment in
  // fetchAbstract).
  it("skips the doomed request entirely when offline and the answer is already cached", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ results: [{ id: 9 }] });

    await expect(fetches.fetchChecklist({}, null, "", 1)).resolves.toEqual({ results: [{ id: 9 }] });
    expect(api.get).not.toHaveBeenCalled();
  });

  // The flip side: NetInfo can be wrong (the reachability probe did not pass
  // while our API is available), so with nothing in hand the request still goes
  // out.
  it("still tries the network when offline with nothing cached", async () => {
    const err = networkError();
    (isConnected as jest.Mock).mockReturnValue(false);
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);

    await expect(fetches.fetchChecklist({}, null, "", 1)).rejects.toBe(err);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe("fetchStat (resort + seen-split deriveFallback)", () => {
  it("re-sorts a relaxed cache match using sortSpeciesItems", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue({
      results: [
        { species_id: 1, sp_name_lang: "Robin" },
        { species_id: 2, sp_name_lang: "Blackbird" },
      ],
    });
    const result = await fetches.fetchStat({ territory: 5 }, "name", "", 1);
    expect(result.results.map((i: { species_id: number }) => i.species_id)).toEqual([2, 1]);
  });

  it("derives a seen/unseen split from the cached 'all' tab when this exact tab was never cached", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock)
      .mockReturnValueOnce(undefined) // relaxed match for the "seen" tab itself
      .mockReturnValueOnce({
        results: [
          { species_id: 1, seen: true },
          { species_id: 2, seen: false },
        ],
        pagination: { count: 2 },
      }); // the "all" tab's cache, used to derive from
    const result = await fetches.fetchStat({ territory: 5, seen: true }, null, "", 1);
    expect(result.results).toEqual([{ species_id: 1, seen: true }]);
    expect(result.pagination.count).toBe(1);
  });

  it("does not attempt to derive from the 'all' tab when the target tab already is 'all'", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);
    await expect(fetches.fetchStat({ territory: 5 }, null, "", 1)).rejects.toBe(err);
  });
});

describe.each([
  {
    name: "fetchPlaces",
    fn: fetches.fetchPlaces,
    url: "/myapi/place2/",
    repo: placeRepository,
    itemShape: { id: 1 },
  },
  {
    name: "fetchObservations",
    fn: fetches.fetchObservations,
    url: "/myapi/observation2/",
    repo: observationRepository,
    itemShape: { id: 1 },
  },
  {
    name: "fetchDiaries",
    fn: fetches.fetchDiaries,
    url: "/myapi/diary2/",
    repo: diaryRepository,
    itemShape: { id: 1 },
  },
])("$name (overlay-backed list fetchers)", ({ fn, url, repo }) => {
  it("fetches live, then runs the result through applyOverlay", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [{ id: 1 }] } });
    (repo.applyOverlay as jest.Mock).mockReturnValue({ results: [{ id: 1, overlaid: true }] });

    const result = await fn({ territory: 5 } as never, null, "", 1);

    expect(api.get).toHaveBeenCalledWith(url, expect.anything());
    expect(repo.applyOverlay).toHaveBeenCalledWith({ results: [{ id: 1 }] }, 1);
    expect(result).toEqual({ results: [{ id: 1, overlaid: true }] });
  });

  it("shows an empty-but-overlaid page (instead of erroring) when offline with a pending local change and nothing cached", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);
    (repo.getOverlay as jest.Mock).mockReturnValue({
      pendingCreates: [{ id: -1 }],
      patchesById: new Map(),
      deletedIds: new Set(),
    });

    await fn({} as never, null, "", 1);
    expect(repo.applyOverlay).toHaveBeenCalledWith(emptyPaginatedResponse(), 1);
  });

  it("rethrows when offline with nothing cached and no pending overlay either", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);
    (repo.getOverlay as jest.Mock).mockReturnValue({
      pendingCreates: [],
      patchesById: new Map(),
      deletedIds: new Set(),
    });

    await expect(fn({} as never, null, "", 1)).rejects.toBe(err);
  });
});

describe.each([
  { name: "fetchPlaces", fn: fetches.fetchPlaces, repo: placeRepository },
  { name: "fetchObservations", fn: fetches.fetchObservations, repo: observationRepository },
  { name: "fetchDiaries", fn: fetches.fetchDiaries, repo: diaryRepository },
])("$name (unsynced filter)", ({ fn, repo }) => {
  it("skips the network/cache entirely and returns the repository's local unsynced set", async () => {
    (repo.getUnsyncedItems as jest.Mock).mockReturnValue([{ id: -1 }, { id: 2 }]);

    const result = await fn({ unsynced: true } as never, null, "", 1);

    expect(api.get).not.toHaveBeenCalled();
    expect(result.results).toEqual([{ id: -1 }, { id: 2 }]);
    expect(result.pagination.count).toBe(2);
  });

  it("returns an empty page beyond page 1, since every unsynced item is already on the first", async () => {
    (repo.getUnsyncedItems as jest.Mock).mockReturnValue([{ id: -1 }]);

    const result = await fn({ unsynced: true } as never, null, "", 2);

    expect(api.get).not.toHaveBeenCalled();
    expect(result.results).toEqual([]);
  });

  it("falls through to the normal live fetch when unsynced isn't set", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [{ id: 1 }] } });
    (repo.applyOverlay as jest.Mock).mockReturnValue({ results: [{ id: 1 }] });

    await fn({} as never, null, "", 1);

    expect(api.get).toHaveBeenCalled();
    expect(repo.getUnsyncedItems).not.toHaveBeenCalled();
  });
});

describe("fetchDiaryObservations (diary-scoped deriveFallback)", () => {
  it("derives an empty page when the local diary snapshot is known to have zero observations", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);
    (diaryRepository.getDiary as jest.Mock).mockReturnValue({ observation_count: 0 });
    (observationRepository.applyDiaryOverlay as jest.Mock).mockImplementation((data) => data);

    const result = await fetches.fetchDiaryObservations({ diary: 5 } as never, null, "", 1);
    expect(result.results).toEqual([]);
  });

  it("does not derive an empty page when the local snapshot has a nonzero (or unknown) count", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);
    (diaryRepository.getDiary as jest.Mock).mockReturnValue({ observation_count: 3 });

    await expect(fetches.fetchDiaryObservations({ diary: 5 } as never, null, "", 1)).rejects.toBe(err);
  });

  it("never derives anything for a diary-less query", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (listCacheRepository.getCachedListResponseByPrefix as jest.Mock).mockReturnValue(undefined);

    await expect(fetches.fetchDiaryObservations({} as never, null, "", 1)).rejects.toBe(err);
    expect(diaryRepository.getDiary).not.toHaveBeenCalled();
  });
});

describe("fetchCommunityObservations", () => {
  it("sends coordinates as request-only params without folding them into the cache key", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });
    await fetches.fetchCommunityObservations({}, null, "", 1, [10, 20]);

    const params = (api.get as jest.Mock).mock.calls[0][1].params;
    expect(params.lng).toBe(10);
    expect(params.lat).toBe(20);

    // Two calls with different coords must still hash to the exact same
    // cache key, since cacheListResponse's key is derived independently of
    // requestOnlyParams — asserted indirectly via both succeeding through
    // the same exact-match cache lookup key shape (same fetchUrl/filters/
    // search/page/extraParams/order).
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ results: [{ id: 1 }] });
    const result = await fetches.fetchCommunityObservations({}, null, "", 1, [99, 99]);
    expect(result).toEqual({ results: [{ id: 1 }] });
  });
});

describe("radius centre coordinates", () => {
  // Online the cache is only written, never read (see cachedRead), so the key
  // is taken from the write.
  const cacheKeyOf = (call: number) =>
    (listCacheRepository.cacheListResponse as jest.Mock).mock.calls[call][1];

  it("folds the centre into the cache key when a radius is filtering the list", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });

    await fetches.fetchCommunityObservations({ radius: 50 }, null, "", 1, [10, 20]);
    await fetches.fetchCommunityObservations({ radius: 50 }, null, "", 1, [11, 21]);

    const params = (api.get as jest.Mock).mock.calls[0][1].params;
    expect(params).toEqual(expect.objectContaining({ lng: 10, lat: 20, radius: 50 }));
    expect(cacheKeyOf(0)).not.toBe(cacheKeyOf(1));
  });

  it("rounds the centre to ~100 m so a standing still device keeps one entry", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });

    await fetches.fetchCommunityObservations({ radius: 50 }, null, "", 1, [10.00001, 20.00002]);
    await fetches.fetchCommunityObservations({ radius: 50 }, null, "", 1, [10.00003, 20.00004]);

    expect((api.get as jest.Mock).mock.calls[0][1].params.lng).toBe(10);
    expect(cacheKeyOf(0)).toBe(cacheKeyOf(1));
  });

  it("keeps the centre out of the key when nothing is filtered by it", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });

    await fetches.fetchCommunityObservations({}, null, "", 1, [10, 20]);
    await fetches.fetchCommunityObservations({}, null, "", 1, [99, 99]);

    expect(cacheKeyOf(0)).toBe(cacheKeyOf(1));
  });

  it("sends the centre for a place radius, distance sort or not", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });

    await fetches.fetchPlaces({ radius: 25 }, "name", "", 1, [10, 20]);

    expect((api.get as jest.Mock).mock.calls[0][1].params).toEqual(
      expect.objectContaining({ lng: 10, lat: 20, radius: 25 }),
    );
  });

  it("leaves a radius without a fix to the server, which logs and ignores it", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });

    await fetches.fetchPlaces({ radius: 25 }, "name", "", 1, null);

    const params = (api.get as jest.Mock).mock.calls[0][1].params;
    expect(params.radius).toBe(25);
    expect(params).not.toHaveProperty("lng");
  });
});

describe("fetchObservationPlaces (the observations map)", () => {
  beforeEach(() => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });
  });

  it("never forwards the observations screen's sort to the places endpoint", async () => {
    // Regression: the screen keeps one persisted sort across both of its view
    // modes, and PlaceFilterSet has no such choice — the map came up empty
    // with "Select a valid choice. -date_time is not one of the available
    // choices." from the server.
    await fetches.fetchObservationPlaces({}, "-date_time", "", 1);

    expect((api.get as jest.Mock).mock.calls[0][1].params.o).toBe("name");
  });

  it("asks only for places that still have matching observations", async () => {
    await fetches.fetchObservationPlaces({ species: 11 }, null, "", 1);

    expect((api.get as jest.Mock).mock.calls[0][1].params).toEqual(
      expect.objectContaining({ has_observations: true, species: 11 }),
    );
  });

  it("turns the screen's place filter into a place id", async () => {
    await fetches.fetchObservationPlaces({ place: 42 }, null, "", 1);

    const params = (api.get as jest.Mock).mock.calls[0][1].params;
    expect(params.id).toBe(42);
    expect(params).not.toHaveProperty("place");
  });

  it("drops the client-only unsynced filter", async () => {
    await fetches.fetchObservationPlaces({ unsynced: true }, null, "", 1);

    expect((api.get as jest.Mock).mock.calls[0][1].params).not.toHaveProperty(
      "unsynced",
    );
  });

  it("scopes each map to what its own screen is about", async () => {
    await fetches.fetchObservationPlaces({}, null, "", 1);
    await fetches.fetchDiaryPlaces({}, null, "", 1);
    await fetches.fetchPlacesForMap({}, null, "", 1);

    const paramsOf = (call: number) =>
      (api.get as jest.Mock).mock.calls[call][1].params;

    expect(paramsOf(0).has_observations).toBe(true);
    expect(paramsOf(0)).not.toHaveProperty("has_diaries");

    expect(paramsOf(1).has_diaries).toBe(true);
    expect(paramsOf(1)).not.toHaveProperty("has_observations");

    // The Places screen manages places, so an empty one is still a place.
    expect(paramsOf(2)).not.toHaveProperty("has_observations");
    expect(paramsOf(2)).not.toHaveProperty("has_diaries");
  });

  it("never forwards the diaries screen's sort either", async () => {
    await fetches.fetchDiaryPlaces({}, "-date_time", "", 1);

    expect((api.get as jest.Mock).mock.calls[0][1].params.o).toBe("name");
  });

  it("asks for every point at once and has no second page", async () => {
    const first = await fetches.fetchObservationPlaces({}, null, "", 1);
    expect((api.get as jest.Mock).mock.calls[0][1].params.per_page).toBe(2000);
    expect(first).toBeTruthy();

    (api.get as jest.Mock).mockClear();
    const second = await fetches.fetchObservationPlaces({}, null, "", 2);

    // A page 2 would be points silently missing from the map.
    expect(api.get).not.toHaveBeenCalled();
    expect(second.results).toEqual([]);
  });
});

describe("simple cache-through fetchers (try live -> cache -> catch -> cached fallback -> rethrow)", () => {
  const cases: Array<{
    name: string;
    run: () => Promise<unknown>;
    liveData: unknown;
    liveResult: unknown;
    cachedData: unknown;
  }> = [
    {
      name: "fetchPage",
      run: () => fetches.fetchPage("about"),
      liveData: { content: "<p>hi</p>" },
      liveResult: "<p>hi</p>",
      cachedData: "<p>cached</p>",
    },
    {
      name: "fetchDiarySpeciesIds",
      run: () => fetches.fetchDiarySpeciesIds(5),
      liveData: [1, 2, 3],
      liveResult: [1, 2, 3],
      cachedData: [1],
    },
    {
      name: "fetchMapPreview",
      run: () => fetches.fetchMapPreview(5),
      liveData: { uri: "live.png" },
      liveResult: { uri: "live.png" },
      cachedData: { uri: "cached.png" },
    },
    {
      name: "fetchUserProfile",
      run: () => fetches.fetchUserProfile(5),
      liveData: { user: 5 },
      liveResult: { user: 5 },
      cachedData: { user: 5, stale: true },
    },
    {
      name: "fetchMyActivity",
      run: () => fetches.fetchMyActivity({ territory: 5 }),
      liveData: { count: 3 },
      liveResult: { count: 3 },
      cachedData: { count: 1 },
    },
    {
      name: "fetchMyDashboardStat",
      run: () => fetches.fetchMyDashboardStat({ territory: 5 }),
      liveData: { seen: 10 },
      liveResult: { seen: 10 },
      cachedData: { seen: 1 },
    },
    {
      name: "fetchBirdOfDay",
      run: () => fetches.fetchBirdOfDay(5),
      liveData: { species_id: 1 },
      liveResult: { species_id: 1 },
      cachedData: { species_id: 2 },
    },
    {
      name: "fetchRatingCompareHeader",
      run: () => fetches.fetchRatingCompareHeader(1, 2, {}),
      liveData: { profile1: 1 },
      liveResult: { profile1: 1 },
      cachedData: { profile1: 1, stale: true },
    },
    {
      name: "fetchTerritoryDetail",
      run: () => fetches.fetchTerritoryDetail("argentina"),
      liveData: { id_avibase: 6142, name: "Argentina" },
      liveResult: { id_avibase: 6142, name: "Argentina" },
      cachedData: { id_avibase: 6142, name: "Argentina", stale: true },
    },
    {
      name: "fetchTerritoryCompare",
      run: () => fetches.fetchTerritoryCompare("argentina", "chile"),
      liveData: { all_count: 1239 },
      liveResult: { all_count: 1239 },
      cachedData: { all_count: 1200 },
    },
  ];

  test.each(cases)("$name: caches a live response", async ({ run, liveData, liveResult }) => {
    (api.get as jest.Mock).mockResolvedValue({ data: liveData });
    const result = await run();
    expect(result).toEqual(liveResult);
    expect(listCacheRepository.cacheListResponse).toHaveBeenCalled();
  });

  test.each(cases)("$name: falls back to the cache on failure", async ({ run, cachedData }) => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(cachedData);
    const result = await run();
    expect(result).toEqual(cachedData);
  });

  test.each(cases)("$name: rethrows when there's no cache to fall back to", async ({ run }) => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    await expect(run()).rejects.toBe(err);
  });
});

describe("fetchTerritoryTree (country page tree, public endpoint)", () => {
  // depth -> type, plus the field renames: the public endpoint is the site's,
  // so it answers with d_name/d_name_lang/d_segment/d_status and puts the
  // occurrence in `status`.
  const ROWS = [
    { depth: 2, d_name: "Rheiformes", d_name_lang: "Rheas", d_segment: "rheiformes", thumb: null, d_status: null },
    { depth: 3, d_name: "Rheidae", d_name_lang: "Rhea family", d_segment: "rheidae", thumb: null, d_status: null },
    { depth: 5, d_name: "Rhea americana", d_name_lang: "Greater Rhea", d_segment: "greater-rhea", thumb: "a.jpg", d_status: "NT", status: "Endemic" },
    { depth: 5, d_name: "Rhea pennata", d_name_lang: "Lesser Rhea", d_segment: "lesser-rhea", thumb: null, d_status: "LC" },
    { depth: 2, d_name: "Cathartiformes", d_name_lang: "Condors", d_segment: "cathartiformes", thumb: null, d_status: null },
    { depth: 3, d_name: "Cathartidae", d_name_lang: "Condor family", d_segment: "cathartidae", thumb: null, d_status: null },
    { depth: 5, d_name: "Vultur gryphus", d_name_lang: "Andean Condor", d_segment: "andean-condor", thumb: null, d_status: "VU" },
  ];

  it("asks the public endpoint by the Avibase id", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    await fetches.fetchTerritoryTree(6142);

    expect(api.get).toHaveBeenCalledWith("/api/checklist/", {
      params: { id: 6142 },
    });
  });

  it("maps the site's field names onto the checklist row shape", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: ROWS });
    const items = await fetches.fetchTerritoryTree(6142);

    expect(items.map((i) => i.type)).toEqual([
      "order",
      "family",
      "species",
      "species",
      "order",
      "family",
      "species",
    ]);
    expect(items[2]).toMatchObject({
      latin: "Rhea americana",
      name_lang: "Greater Rhea",
      segment: "greater-rhea",
      thumb: "a.jpg",
      // d_status is the IUCN category; `status` on the wire is the occurrence.
      status: "NT",
      occurrence: "Endemic",
      seen: false,
    });
  });

  // The endpoint sends no counts, but the group rows show them. The response
  // is one page in taxonomic order, so they can be counted here exactly.
  it("counts the species under each group", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: ROWS });
    const items = await fetches.fetchTerritoryTree(6142);

    expect(items[0].total).toBe(2); // Rheiformes
    expect(items[1].total).toBe(2); // Rheidae
    expect(items[4].total).toBe(1); // Cathartiformes
    expect(items[5].total).toBe(1); // Cathartidae
  });

  it("does not let a later order inherit the previous one's count", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: ROWS });
    const items = await fetches.fetchTerritoryTree(6142);

    // A new order closes the previous order *and* its family: without that,
    // the Rhea family would keep collecting condors.
    expect(items[1].total).toBe(2);
    expect(items[4].total).not.toBe(3);
  });

  it("serves the cached tree when the request fails", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue([
      { type: "species", name_lang: "Cached bird" },
    ]);

    await expect(fetches.fetchTerritoryTree(6142)).resolves.toEqual([
      { type: "species", name_lang: "Cached bird" },
    ]);
  });
});

describe("fetchTerritoryList / fetchTerritoryCount / fetchTerritoryRegions", () => {
  it("sends the region filter and keeps it in the cache key", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });
    await fetches.fetchTerritoryList(15)({}, "name", "", 1);

    expect(api.get).toHaveBeenCalledWith(
      "/api/territory/",
      expect.objectContaining({ params: expect.objectContaining({ region: 15 }) }),
    );
    // extraParams (unlike requestOnlyParams) go into the key — a cached page
    // for one region must not be served for another.
    const [, key] = (listCacheRepository.cacheListResponse as jest.Mock).mock
      .calls[0];
    expect(key).toContain("15");
  });

  it("leaves the region out entirely when nothing is chosen", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });
    await fetches.fetchTerritoryList(null)({}, "name", "", 1);

    expect((api.get as jest.Mock).mock.calls[0][1].params).not.toHaveProperty(
      "region",
    );
  });

  it("asks only for the regions the territory filter accepts", async () => {
    // Continents have no territories of their own, and /api/territory/?region=
    // rejects them — offering one would just 400.
    (api.get as jest.Mock).mockResolvedValue({
      data: [[15, { label: "South America" }]],
    });

    await expect(fetches.fetchTerritoryRegions()).resolves.toEqual([
      { id: 15, label: "South America" },
    ]);
    expect(api.get).toHaveBeenCalledWith("/api/region-list/", {
      params: { has_territories: 1 },
    });
  });

  it("falls back to the cached regions when the request fails", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue([
      { id: 21, label: "Western Europe" },
    ]);

    await expect(fetches.fetchTerritoryRegions()).resolves.toEqual([
      { id: 21, label: "Western Europe" },
    ]);
  });

  it("defaults to alphabetical order and passes the name search through", async () => {
    // The server's own default order is neither alphabetical nor stable, so
    // the list has to name one.
    (api.get as jest.Mock).mockResolvedValue({ data: { results: [] } });
    await fetches.fetchTerritoryList()({}, null, "arg", 1);

    expect(api.get).toHaveBeenCalledWith(
      "/api/territory/",
      expect.objectContaining({
        params: expect.objectContaining({ o: "name", name: "arg", per_page: 100 }),
      }),
    );
  });

  it("asks for a single row when all it needs is the total", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { pagination: { count: 249 }, results: [] },
    });

    await expect(fetches.fetchTerritoryCount()).resolves.toBe(249);
    expect(api.get).toHaveBeenCalledWith("/api/territory/", {
      params: { per_page: 1 },
    });
  });
});

describe("fetchTimezones", () => {
  it("caches a live response via the reference repository", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [["UTC", "UTC"]] });
    const result = await fetches.fetchTimezones();
    expect(result).toEqual([{ value: "UTC", label: "UTC" }]);
    expect(referenceRepository.cacheTimezones).toHaveBeenCalledWith([{ value: "UTC", label: "UTC" }]);
  });

  it("falls back to cached timezones on failure", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (referenceRepository.getCachedTimezones as jest.Mock).mockReturnValue([{ value: "UTC", label: "UTC" }]);
    const result = await fetches.fetchTimezones();
    expect(result).toEqual([{ value: "UTC", label: "UTC" }]);
  });

  it("rethrows when there's nothing cached", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (referenceRepository.getCachedTimezones as jest.Mock).mockReturnValue([]);
    await expect(fetches.fetchTimezones()).rejects.toBe(err);
  });
});

describe("fetchMyCountries", () => {
  it("caches and returns favourite-annotated territories when not favourites-only", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ territory_id: 5, name: "France", code: "FR", favourite: true }],
    });
    const result = await fetches.fetchMyCountries(false, "name");
    expect(result).toEqual([
      { value: 5, label: "France", code: "FR", icon: "🇫🇷", iconLabelRight: "star" },
    ]);
    expect(referenceRepository.cacheCountries).toHaveBeenCalled();
  });

  it("does not cache the response when favOnly is true", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ territory_id: 5, name: "France", code: "FR", favourite: true }],
    });
    await fetches.fetchMyCountries(true, "name");
    expect(referenceRepository.cacheCountries).not.toHaveBeenCalled();
    expect((api.get as jest.Mock).mock.calls[0][1].params).toEqual({ o: "name", fav_only: true });
  });

  it("only consults the cache fallback when not favourites-only", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    await expect(fetches.fetchMyCountries(true, "name")).rejects.toThrow("boom");
    expect(referenceRepository.getCachedCountries).not.toHaveBeenCalled();
  });
});

describe("fetchMyPlaces", () => {
  it("returns an empty list without hitting the network when there's no territory", async () => {
    const result = await fetches.fetchMyPlaces(null, null, "name");
    expect(result).toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("includes lng/lat only for a distance sort with coords available", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    await fetches.fetchMyPlaces(5, [10, 20], "distance");
    expect((api.get as jest.Mock).mock.calls[0][1].params).toEqual(
      expect.objectContaining({ lng: 10, lat: 20 }),
    );

    (api.get as jest.Mock).mockClear();
    await fetches.fetchMyPlaces(5, [10, 20], "name");
    expect((api.get as jest.Mock).mock.calls[0][1].params).not.toHaveProperty("lng");
  });

  it("applies the dropdown overlay to a live result", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [{ id: 2, name: "Park", favourite: true }] });
    (placeRepository.applyDropdownOverlay as jest.Mock).mockReturnValue(["overlaid"]);
    const result = await fetches.fetchMyPlaces(5, null, "name");
    expect(result).toEqual(["overlaid"]);
  });

  it("falls back to an overlay-only list (a place created offline) when there's no cache at all", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (placeRepository.applyDropdownOverlay as jest.Mock).mockReturnValue([{ value: -1 }]);
    const result = await fetches.fetchMyPlaces(5, null, "name");
    expect(result).toEqual([{ value: -1 }]);
  });

  it("rethrows when there's neither cache nor overlay", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    (placeRepository.applyDropdownOverlay as jest.Mock).mockReturnValue([]);
    await expect(fetches.fetchMyPlaces(5, null, "name")).rejects.toBe(err);
  });
});

describe("fetchSpecies", () => {
  it("returns an empty list without hitting the network when there's no territory", async () => {
    const result = await fetches.fetchSpecies(null, "name");
    expect(result).toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("maps and caches a live response", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { results: [{ species_id: 1, sp_name: "Robin", sp_latin: "x", sp_name_lang: "Robin", seen: true, segment: "robin" }] },
    });
    const result = await fetches.fetchSpecies(5, "name");
    expect(result).toEqual([
      { value: 1, label: "Robin", name: "x", name_lang: "Robin", thumb: undefined, seen: true, segment: "robin" },
    ]);
  });
});

describe("degraded reads (offline cache masking a server failure)", () => {
  const captureMessage = Sentry.captureMessage as jest.Mock;

  const httpError = (status: number) =>
    Object.assign(new Error("boom"), { code: "SERVER_ERROR", status });

  it("still serves the cache on a 500, but flags it in Sentry with the failing source", async () => {
    (api.get as jest.Mock).mockRejectedValue(httpError(500));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ results: [{ id: 9 }] });

    const result = await fetches.fetchChecklist({}, null, "", 1);

    expect(result).toEqual({ results: [{ id: 9 }] });
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage.mock.calls[0][1].tags).toMatchObject({
      degraded_read: "true",
      source: "/myapi/checklist2/",
      fallback_reason: "server",
      http_status: "500",
    });
  });

  it("says nothing when the same cache read is just the app being offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    (api.get as jest.Mock).mockRejectedValue(networkError());
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ results: [{ id: 9 }] });

    await expect(fetches.fetchChecklist({}, null, "", 1)).resolves.toEqual({ results: [{ id: 9 }] });
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("flags a dropdown fetch masked by its own cache", async () => {
    (api.get as jest.Mock).mockRejectedValue(httpError(503));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue([{ value: 1, label: "Robin" }]);

    await expect(fetches.fetchSpecies(5, "name")).resolves.toEqual([{ value: 1, label: "Robin" }]);
    expect(captureMessage.mock.calls[0][1].tags).toMatchObject({ source: "fetchSpecies" });
  });

  it("rethrows a 404 on a detail fetch instead of serving a taxon the server no longer has", async () => {
    const gone = httpError(404);
    (api.get as jest.Mock).mockRejectedValue(gone);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ id: 1, name: "Robin" });

    await expect(fetches.fetchTaxonDetail("robin", 5 as never)).rejects.toBe(gone);
    expect(listCacheRepository.getCachedListResponse).not.toHaveBeenCalled();
  });

  it("keeps serving the cache for a 404 on a list endpoint (stale URL, not a deleted entity)", async () => {
    (api.get as jest.Mock).mockRejectedValue(httpError(404));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ results: [{ id: 9 }] });

    await expect(fetches.fetchChecklist({}, null, "", 1)).resolves.toEqual({ results: [{ id: 9 }] });
    expect(captureMessage.mock.calls[0][1].tags).toMatchObject({ fallback_reason: "client" });
  });
});

describe("profile passthroughs", () => {
  it("fetchMyProfile / updateMyProfile just forward to the API", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { user: 1 } });
    await expect(fetches.fetchMyProfile()).resolves.toEqual({ user: 1 });

    (api.put as jest.Mock).mockResolvedValue({ data: { user: 1, name: "x" } });
    await expect(fetches.updateMyProfile({ user: 1 } as never)).resolves.toEqual({ user: 1, name: "x" });
    expect(api.put).toHaveBeenCalledWith("/myapi/profile/me/", { user: 1 });
  });

  it("deleteMyProfile sends the confirmation email and returns the response status", async () => {
    (api.delete as jest.Mock).mockResolvedValue({ status: 204 });
    const status = await fetches.deleteMyProfile("me@example.com");
    expect(api.delete).toHaveBeenCalledWith("/myapi/profile/delete-me/", { data: { email: "me@example.com" } });
    expect(status).toBe(204);
  });

  it("deleteMyAvatar returns the response status", async () => {
    (api.delete as jest.Mock).mockResolvedValue({ status: 200 });
    await expect(fetches.deleteMyAvatar()).resolves.toBe(200);
  });

  it("patchAvatar builds multipart form data from the image asset", async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { avatar: "a.jpg" } });
    const result = await fetches.patchAvatar({ uri: "file://a.jpg" } as never);
    expect(api.patch).toHaveBeenCalledWith(
      "/myapi/profile/avatar/",
      expect.any(FormData),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } }),
    );
    expect(result).toEqual({ avatar: "a.jpg" });
  });

  it("sendConfirmEmail posts the confirmation key", async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await fetches.sendConfirmEmail("abc123");
    expect(api.post).toHaveBeenCalledWith("/myapi/confirm/email/", { key: "abc123" });
  });
});

describe("fetchUnreadCount", () => {
  it("caches the live count and applies any pending local adjustment", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { count: 5 } });
    (notificationRepository.applyPendingUnreadAdjustment as jest.Mock).mockReturnValue(4);

    const result = await fetches.fetchUnreadCount();
    expect(listCacheRepository.cacheListResponse).toHaveBeenCalledWith(
      expect.anything(),
      "unread_count",
      { count: 5 },
      1,
    );
    expect(notificationRepository.applyPendingUnreadAdjustment).toHaveBeenCalledWith(5);
    expect(result).toBe(4);
  });

  it("applies the pending adjustment to the cached count on failure", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({ count: 3 });
    (notificationRepository.applyPendingUnreadAdjustment as jest.Mock).mockReturnValue(2);

    const result = await fetches.fetchUnreadCount();
    expect(notificationRepository.applyPendingUnreadAdjustment).toHaveBeenCalledWith(3);
    expect(result).toBe(2);
  });

  it("rethrows when there's no cached count either", async () => {
    const err = new Error("boom");
    (api.get as jest.Mock).mockRejectedValue(err);
    (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    await expect(fetches.fetchUnreadCount()).rejects.toBe(err);
  });
});

describe("markNotificationsRead", () => {
  it("posts specific ids when given, or {all:true} otherwise, while online", async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await fetches.markNotificationsRead([1, 2]);
    expect(api.post).toHaveBeenCalledWith("/myapi/notifications/read/", { ids: [1, 2] });

    (api.post as jest.Mock).mockClear();
    await fetches.markNotificationsRead();
    expect(api.post).toHaveBeenCalledWith("/myapi/notifications/read/", { all: true });
    expect(notificationRepository.markIdsReadLocal).not.toHaveBeenCalled();
  });

  it("marks locally and triggers a sync when offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await fetches.markNotificationsRead([1, 2]);
    expect(api.post).not.toHaveBeenCalled();
    expect(notificationRepository.markIdsReadLocal).toHaveBeenCalledWith([1, 2]);
    expect(runNotificationSync).toHaveBeenCalledTimes(1);
  });

  it("marks all locally when no ids are given and the network call fails", async () => {
    (api.post as jest.Mock).mockRejectedValue(networkError());
    await fetches.markNotificationsRead();
    expect(notificationRepository.markAllReadLocal).toHaveBeenCalledTimes(1);
    expect(runNotificationSync).toHaveBeenCalledTimes(1);
  });

  it("rethrows a non-network error instead of falling back to a local mark", async () => {
    const err = Object.assign(new Error("validation failed"), { status: 400 });
    (api.post as jest.Mock).mockRejectedValue(err);
    await expect(fetches.markNotificationsRead([1])).rejects.toBe(err);
    expect(notificationRepository.markIdsReadLocal).not.toHaveBeenCalled();
  });
});

describe("push token registration", () => {
  it("registerPushToken sends the token with the current platform", async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await fetches.registerPushToken("tok-1");
    expect(api.post).toHaveBeenCalledWith("/myapi/push-token/", { token: "tok-1", platform: Platform.OS });
  });

  it("unregisterPushToken URL-encodes the token", async () => {
    (api.delete as jest.Mock).mockResolvedValue({});
    await fetches.unregisterPushToken("tok/with slash");
    expect(api.delete).toHaveBeenCalledWith(`/myapi/push-token/${encodeURIComponent("tok/with slash")}/`);
  });
});

describe("reverseGeocoding", () => {
  it("forwards latitude/longitude and returns the response data", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { territory: 5 } });
    const result = await fetches.reverseGeocoding(1.23, 4.56);
    expect(api.get).toHaveBeenCalledWith("/myapi/geocoding/reverse/", {
      params: { latitude: 1.23, longitude: 4.56 },
    });
    expect(result).toEqual({ territory: 5 });
  });
});

describe("GDPR export flow", () => {
  it("exportProfileData / pollExportStatus forward to the API", async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await fetches.exportProfileData();
    expect(api.post).toHaveBeenCalledWith("/myapi/gdpr/");

    (api.get as jest.Mock).mockResolvedValue({ data: { status: "completed" } });
    await expect(fetches.pollExportStatus()).resolves.toEqual({ status: "completed" });
  });

  it("downloadExportFile builds an authorized download URL", async () => {
    (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ uri: "file:///docs/dibird_export.zip" });
    const result = await fetches.downloadExportFile(
      { download_token: "tok-1" } as never,
      "bearer-token",
    );
    expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
      expect.stringContaining("token=tok-1"),
      "file:///docs/dibird_export.zip",
      { headers: { Authorization: "Bearer bearer-token" } },
    );
    expect(result).toEqual({ uri: "file:///docs/dibird_export.zip" });
  });
});

describe("observation CSV import", () => {
  // RN's FormData takes a { uri, name, type } file object that no web Blob
  // type describes; assert on what actually got appended rather than on the
  // opaque FormData instance.
  const appendedForm = () => {
    const form = (api.post as jest.Mock).mock.calls[0][1] as FormData;
    return Object.fromEntries(form.entries());
  };

  it("uploads the file as multipart and reports back the job", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 7, status: "queued" } });

    const result = await fetches.startObservationImport(
      { uri: "file:///tmp/list.csv", name: "list.csv" },
      true,
    );

    expect(result).toEqual({ id: 7, status: "queued" });
    expect((api.post as jest.Mock).mock.calls[0][0]).toBe(
      "/myapi/observation-import/",
    );
    expect((api.post as jest.Mock).mock.calls[0][2]).toEqual({
      headers: { "Content-Type": "multipart/form-data" },
      // Not the client-wide 10 s from services/api.ts: that one cuts off a
      // body still being sent, and a premature timeout looks exactly like
      // being offline to everything downstream.
      timeout: 120000,
    });
    // jsdom's FormData stringifies the RN file object into "[object Object]",
    // so only its presence is observable here — the { uri, name, type } shape
    // itself is a runtime concern, not something this environment can check.
    expect(Object.keys(appendedForm())).toEqual(["file", "make_public"]);
    expect(appendedForm().make_public).toBe("true");
  });

  it("sends make_public as a string flag when the import stays private", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 7 } });

    await fetches.startObservationImport(
      { uri: "file:///tmp/list.csv", name: "list.csv" },
      false,
    );

    expect(appendedForm().make_public).toBe("false");
  });

  it("polls the job status", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 7, status: "running" } });

    const result = await fetches.pollObservationImportStatus();

    expect(result).toEqual({ id: 7, status: "running" });
    expect(api.get).toHaveBeenCalledWith("/myapi/observation-import/status/");
  });
});

describe("taxonomy catalogue", () => {
  const emptyPage = {
    pagination: { count: 0, per_page: 100, current: 1, final: 1, next: null, previous: null },
    results: [],
  };

  const paramsOfLastGet = () => {
    const calls = (api.get as jest.Mock).mock.calls;
    return calls[calls.length - 1][1].params;
  };

  describe("fetchTaxonList", () => {
    it("binds the rank up front and defaults the order to name", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: emptyPage });

      await fetches.fetchTaxonList(4)({}, null, "", 1);

      expect((api.get as jest.Mock).mock.calls[0][0]).toBe("/api/taxon/");
      expect(paramsOfLastGet()).toMatchObject({ rank: 4, o: "name" });
    });

    it("passes the caller's order through when there is one", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: emptyPage });

      await fetches.fetchTaxonList(5)({}, "-name", "", 1);

      expect(paramsOfLastGet()).toMatchObject({ o: "-name" });
    });

    it("scopes the request to a parent when drilling into its children", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: emptyPage });

      await fetches.fetchTaxonList(5, { segment: "corvidae", rank: 4 })({}, null, "", 1);

      expect(paramsOfLastGet()).toMatchObject({
        rank: 5,
        parent: "corvidae",
        parent_rank: 4,
      });
    });

    it("asks for extinct species only when the flag is on", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: emptyPage });

      await fetches.fetchTaxonList(5, null, true)({}, null, "", 1);
      expect(paramsOfLastGet()).toMatchObject({ extinct: true });

      await fetches.fetchTaxonList(5, null, false)({}, null, "", 1);
      expect(paramsOfLastGet().extinct).toBeUndefined();
    });
  });

  // Trait filters ride in extraParams (they change what is being asked for,
  // so they belong in the cache key) and the multi-selects travel joined.
  describe("trait filters", () => {
    const withTraits = async (traits: Parameters<typeof fetches.fetchTaxonList>[3]) => {
      (api.get as jest.Mock).mockResolvedValue({ data: emptyPage });
      await fetches.fetchTaxonList(5, null, false, traits)({}, null, "", 1);
      return paramsOfLastGet();
    };

    it("joins multi-selects with commas and keeps scalars as they are", async () => {
      const params = await withTraits({
        habitat: ["forest", "wetland"],
        mass_min: 20,
      });

      expect(params).toMatchObject({ habitat: "forest,wetland", mass_min: 20 });
    });

    it("drops nulls and empty selections instead of sending them", async () => {
      const params = await withTraits({
        habitat: [],
        mass_min: null,
        trophic_level: ["carnivore"],
      });

      expect(params.habitat).toBeUndefined();
      expect(params.mass_min).toBeUndefined();
      expect(params).toMatchObject({ trophic_level: "carnivore" });
    });

    it("sends nothing extra when there are no traits at all", async () => {
      const params = await withTraits(null);

      expect(params).toMatchObject({ rank: 5 });
      expect(params.habitat).toBeUndefined();
    });
  });

  describe("fetchSpeciesCount", () => {
    it("asks for a single row and returns just the total", async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { pagination: { count: 11250 }, results: [] },
      });

      const result = await fetches.fetchSpeciesCount();

      expect(result).toBe(11250);
      expect(paramsOfLastGet()).toEqual({ rank: 5, per_page: 1 });
    });
  });

  describe("fetchTraitFilters", () => {
    it("caches a live response", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { habitat: ["forest"] } });

      const result = await fetches.fetchTraitFilters();

      expect(result).toEqual({ habitat: ["forest"] });
      expect(listCacheRepository.cacheListResponse).toHaveBeenCalled();
    });

    it("falls back to the cache when the request fails", async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
      (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({
        habitat: ["cached"],
      });

      await expect(fetches.fetchTraitFilters()).resolves.toEqual({
        habitat: ["cached"],
      });
    });

    it("rethrows when there is nothing cached", async () => {
      const err = new Error("boom");
      (api.get as jest.Mock).mockRejectedValue(err);
      (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue(undefined);

      await expect(fetches.fetchTraitFilters()).rejects.toBe(err);
    });
  });

  describe("fetchTaxonDetail", () => {
    it("requests the segment at the given rank and caches it", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { segment: "corvidae" } });

      const result = await fetches.fetchTaxonDetail("corvidae", 4);

      expect(result).toEqual({ segment: "corvidae" });
      expect((api.get as jest.Mock).mock.calls[0][0]).toBe("/api/taxon/corvidae/");
      expect(paramsOfLastGet()).toEqual({ rank: 4 });
      expect(listCacheRepository.cacheListResponse).toHaveBeenCalled();
    });

    it("falls back to the cached detail when the request fails", async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
      (listCacheRepository.getCachedListResponse as jest.Mock).mockReturnValue({
        segment: "cached",
      });

      await expect(fetches.fetchTaxonDetail("corvidae", 4)).resolves.toEqual({
        segment: "cached",
      });
    });
  });

  // Push notifications carry a numeric species id, not a segment; every
  // in-app link already has the segment and skips this round trip.
  describe("fetchTaxonSegmentById", () => {
    it("resolves the segment of the matching species", async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { pagination: { count: 1 }, results: [{ segment: "corvus-corax" }] },
      });

      await expect(fetches.fetchTaxonSegmentById(123)).resolves.toBe("corvus-corax");
      expect(paramsOfLastGet()).toEqual({ rank: 5, taxon_id: 123, per_page: 1 });
    });

    it("fails loudly when the id matches nothing", async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { pagination: { count: 0 }, results: [] },
      });

      await expect(fetches.fetchTaxonSegmentById(123)).rejects.toThrow(
        "Species not found for id 123",
      );
    });
  });
});
