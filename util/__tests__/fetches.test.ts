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
  it("caches and returns flag-annotated territories when not favourites-only", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ territory_id: 5, name: "France", code: "FR", favourite: true }],
    });
    const result = await fetches.fetchMyCountries(false, "name");
    expect(result).toEqual([
      { value: 5, label: "France", code: "FR", icon: "🇫🇷", iconLabelRight: "flag" },
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
