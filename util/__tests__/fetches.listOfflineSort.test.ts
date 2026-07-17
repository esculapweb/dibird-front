// Regression coverage for the bug where changing sort on a *main list* screen
// (Places, Observations, Diaries, Diary detail, Rating, Ratings compare)
// while offline had no effect: fetchPlaces/fetchObservations/fetchDiaries/
// fetchDiaryObservations/fetchRating/fetchRatingCompare/
// fetchCommunityObservations used to pass no `resort` option to
// fetchAbstract, so a cache hit under a different order (fetchAbstract's
// relaxed prefix match) was returned as-is, silently ignoring the requested
// sort — unlike fetchStat, which already had this covered via
// sortSpeciesItems. See util/fetches.ts's resortPlaceListItems /
// resortObservationItems / resortDiaryObservationItems /
// resortDiaryListItems / resortRatingItems / resortRatingCompareItems.
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("../../hooks/repositories/listCacheRepository", () => ({
  cacheListResponse: jest.fn(),
  getCachedListResponse: jest.fn(() => null),
  getCachedListResponseByPrefix: jest.fn(() => null),
}));
jest.mock("../../hooks/repositories/placeRepository", () => ({
  applyOverlay: jest.fn((data: unknown) => data),
  getOverlay: jest.fn(() => ({
    pendingCreates: [],
    patchesById: new Map(),
    deletedIds: new Set(),
  })),
}));
jest.mock("../../hooks/repositories/observationRepository", () => ({
  applyOverlay: jest.fn((data: unknown) => data),
  applyDiaryOverlay: jest.fn((data: unknown) => data),
  getOverlay: jest.fn(() => ({
    pendingCreates: [],
    patchesById: new Map(),
    deletedIds: new Set(),
  })),
}));
jest.mock("../../hooks/repositories/diaryRepository", () => ({
  applyOverlay: jest.fn((data: unknown) => data),
  getOverlay: jest.fn(() => ({
    pendingCreates: [],
    patchesById: new Map(),
    deletedIds: new Set(),
  })),
}));

import {
  DiaryListItem,
  DiaryObservationItem,
  ObservationItem,
  PlaceItem,
  RatingCompareItem,
  RatingItem,
} from "../../types";

type FetchesModule = typeof import("../fetches");
type ApiMock = { get: jest.Mock };
type ListCacheRepoMock = {
  getCachedListResponse: jest.Mock;
  getCachedListResponseByPrefix: jest.Mock;
  cacheListResponse: jest.Mock;
};

const NETWORK_ERROR = { isNetworkError: true, message: "Network Error" };

let fetches: FetchesModule;
let api: ApiMock;
let listCacheRepository: ListCacheRepoMock;

beforeEach(() => {
  jest.resetModules();
  fetches = require("../fetches");
  api = require("../../services/api").default;
  listCacheRepository = require("../../hooks/repositories/listCacheRepository");

  api.get.mockReset().mockRejectedValue(NETWORK_ERROR);
  listCacheRepository.getCachedListResponse.mockReset().mockReturnValue(null);
  listCacheRepository.getCachedListResponseByPrefix.mockReset().mockReturnValue(null);
  listCacheRepository.cacheListResponse.mockReset();
});

const territoryData = { code: "FR", id: 5, name: "France", segment: "" };

const place = (overrides: Partial<PlaceItem> = {}): PlaceItem => ({
  id: 1,
  name: "Zoo",
  favourite: false,
  location: { type: "Point", coordinates: [0, 0] },
  distance: null,
  preview: null,
  diary_count: 0,
  observation_count: 0,
  species_count: 0,
  territory: 5,
  territory_data: territoryData,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("resortPlaceListItems", () => {
  it("sorts by name", () => {
    const items = [place({ id: 1, name: "Zoo" }), place({ id: 2, name: "Aquarium" })];
    expect(fetches.resortPlaceListItems(items, "name").map((p) => p.name)).toEqual([
      "Aquarium",
      "Zoo",
    ]);
  });

  it("sorts by favourite then name", () => {
    const items = [
      place({ id: 1, name: "Zoo", favourite: false }),
      place({ id: 2, name: "Aquarium", favourite: true }),
    ];
    expect(
      fetches.resortPlaceListItems(items, "-favourite,name").map((p) => p.name),
    ).toEqual(["Aquarium", "Zoo"]);
  });

  it("sorts by species_count and observation_count", () => {
    const items = [
      place({ id: 1, name: "Zoo", species_count: 3, observation_count: 10 }),
      place({ id: 2, name: "Aquarium", species_count: 8, observation_count: 2 }),
    ];
    expect(
      fetches.resortPlaceListItems(items, "-species_count,name").map((p) => p.name),
    ).toEqual(["Aquarium", "Zoo"]);
    expect(
      fetches.resortPlaceListItems(items, "-observation_count,name").map((p) => p.name),
    ).toEqual(["Zoo", "Aquarium"]);
  });

  it("bails out on distance when any item is missing it", () => {
    const items = [place({ id: 1, name: "Zoo", distance: 500 }), place({ id: 2, name: "Aquarium" })];
    expect(fetches.resortPlaceListItems(items, "distance").map((p) => p.name)).toEqual([
      "Zoo",
      "Aquarium",
    ]);
  });
});

describe("fetchPlaces offline sort fallback", () => {
  it("resorts a differently-ordered cache entry when offline", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue({
      pagination: { count: 2, per_page: 100, current: 1, final: 1, next: null, previous: null },
      results: [place({ id: 1, name: "Zoo" }), place({ id: 2, name: "Aquarium" })],
    });

    const result = await fetches.fetchPlaces({}, "name");

    expect(result.results.map((p) => p.name)).toEqual(["Aquarium", "Zoo"]);
  });
});

const owner = {
  avatar: "",
  first_name: "Jane",
  id: 42,
  last_name: "Doe",
  private: false,
  timezone_id: "",
  username: "jdoe",
};

const observation = (overrides: Partial<ObservationItem> = {}): ObservationItem => ({
  created_at: "2026-01-01T00:00:00Z",
  id: 1,
  notes: null,
  quantity: null,
  time: null,
  date_time: "2026-01-01T00:00:00Z",
  diary: null,
  is_owner: true,
  owner,
  place: null,
  place_data: null,
  private: false,
  species: 1,
  species_data: { id: 1, name: "", name_lang: "Robin", segment: "", thumb: null },
  territory_data: territoryData,
  updated_at: "2026-01-01T00:00:00Z",
  external_source: null,
  external_username: null,
  location_private: true,
  distance: null,
  ...overrides,
});

describe("resortObservationItems", () => {
  it("sorts by species_name (species_data.name_lang)", () => {
    const items = [
      observation({ id: 1, species_data: { id: 1, name: "", name_lang: "Wren", segment: "", thumb: null } }),
      observation({ id: 2, species_data: { id: 2, name: "", name_lang: "Albatross", segment: "", thumb: null } }),
    ];
    expect(
      fetches.resortObservationItems(items, "species_name").map((o) => o.species_data.name_lang),
    ).toEqual(["Albatross", "Wren"]);
  });

  it("sorts by date_time", () => {
    const items = [
      observation({ id: 1, date_time: "2026-02-01T00:00:00Z" }),
      observation({ id: 2, date_time: "2026-01-01T00:00:00Z" }),
    ];
    expect(fetches.resortObservationItems(items, "date_time").map((o) => o.id)).toEqual([2, 1]);
  });

  it("leaves the order untouched for ioc_id, which isn't reproducible offline", () => {
    const items = [
      observation({ id: 1, species_data: { id: 1, name: "", name_lang: "Wren", segment: "", thumb: null } }),
      observation({ id: 2, species_data: { id: 2, name: "", name_lang: "Albatross", segment: "", thumb: null } }),
    ];
    expect(fetches.resortObservationItems(items, "ioc_id").map((o) => o.id)).toEqual([1, 2]);
  });
});

describe("fetchObservations offline sort fallback", () => {
  it("resorts a differently-ordered cache entry when offline", async () => {
    listCacheRepository.getCachedListResponseByPrefix.mockReturnValue({
      pagination: { count: 2, per_page: 100, current: 1, final: 1, next: null, previous: null },
      results: [
        observation({ id: 1, species_data: { id: 1, name: "", name_lang: "Wren", segment: "", thumb: null } }),
        observation({ id: 2, species_data: { id: 2, name: "", name_lang: "Albatross", segment: "", thumb: null } }),
      ],
    });

    const result = await fetches.fetchObservations({}, "species_name");

    expect(result.results.map((o) => o.species_data.name_lang)).toEqual(["Albatross", "Wren"]);
  });
});

const diaryObservation = (
  overrides: Partial<DiaryObservationItem> = {},
): DiaryObservationItem => ({
  created_at: "2026-01-01T00:00:00Z",
  id: 1,
  notes: null,
  quantity: null,
  time: null,
  species_data: { id: 1, name: "", name_lang: "Robin", segment: "", thumb: null },
  ...overrides,
});

describe("resortDiaryObservationItems", () => {
  it("sorts by species_name and created_at", () => {
    const items = [
      diaryObservation({ id: 1, species_data: { id: 1, name: "", name_lang: "Wren", segment: "", thumb: null } }),
      diaryObservation({ id: 2, species_data: { id: 2, name: "", name_lang: "Albatross", segment: "", thumb: null } }),
    ];
    expect(
      fetches.resortDiaryObservationItems(items, "species_name").map((o) => o.species_data.name_lang),
    ).toEqual(["Albatross", "Wren"]);
  });
});

const diary = (overrides: Partial<DiaryListItem> = {}): DiaryListItem => ({
  date_time: "2026-01-01T00:00:00Z",
  id: 1,
  name: "My diary",
  observation_count: 0,
  place: null,
  place_data: null,
  private: false,
  location_private: true,
  profile: 42,
  territory: 5,
  territory_data: territoryData,
  observation_data: [],
  ...overrides,
});

describe("resortDiaryListItems", () => {
  it("sorts by observation_count then name", () => {
    const items = [
      diary({ id: 1, name: "Zoo trip", observation_count: 3 }),
      diary({ id: 2, name: "Aquarium trip", observation_count: 8 }),
    ];
    expect(
      fetches.resortDiaryListItems(items, "-observation_count,name").map((d) => d.name),
    ).toEqual(["Aquarium trip", "Zoo trip"]);
  });
});

const rating = (overrides: Partial<RatingItem> = {}): RatingItem => ({
  avatar: null,
  first_name: "Jane",
  last_name: "Doe",
  username: "jdoe",
  native_territory: null,
  profile_id: 1,
  seen_qty: 10,
  territory_code: null,
  territory_name: null,
  last_update: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("resortRatingItems", () => {
  it("sorts by seen_qty (observations)", () => {
    const items = [
      rating({ profile_id: 1, seen_qty: 5 }),
      rating({ profile_id: 2, seen_qty: 20 }),
    ];
    expect(fetches.resortRatingItems(items, "-observations").map((r) => r.profile_id)).toEqual([
      2, 1,
    ]);
  });

  it("sorts by last_update", () => {
    const items = [
      rating({ profile_id: 1, last_update: "2026-01-01T00:00:00Z" }),
      rating({ profile_id: 2, last_update: "2026-02-01T00:00:00Z" }),
    ];
    expect(fetches.resortRatingItems(items, "-last_update").map((r) => r.profile_id)).toEqual([
      2, 1,
    ]);
  });
});

const ratingCompare = (overrides: Partial<RatingCompareItem> = {}): RatingCompareItem => ({
  in_object: [true, false],
  name_lang: "Robin",
  name_latin: "",
  taxon_id: 100,
  thumb: null,
  segment: "",
  ...overrides,
});

describe("resortRatingCompareItems", () => {
  it("sorts by name", () => {
    const items = [
      ratingCompare({ name_lang: "Wren", taxon_id: 1 }),
      ratingCompare({ name_lang: "Albatross", taxon_id: 2 }),
    ];
    expect(fetches.resortRatingCompareItems(items, "name").map((r) => r.name_lang)).toEqual([
      "Albatross",
      "Wren",
    ]);
  });

  it("sorts by ioc_id (taxon_id), always available and numeric", () => {
    const items = [
      ratingCompare({ name_lang: "Wren", taxon_id: 200 }),
      ratingCompare({ name_lang: "Albatross", taxon_id: 10 }),
    ];
    expect(fetches.resortRatingCompareItems(items, "ioc_id").map((r) => r.name_lang)).toEqual([
      "Albatross",
      "Wren",
    ]);
  });
});
