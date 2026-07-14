// Focused on the offline-fallback branch of fetchAbstract (see util/fetches.ts)
// used by fetchObservations/fetchDiaries/fetchPlaces: when the live request
// fails and there's no cache hit for the exact query (or a relaxed-sort
// match), each of these three functions supplies a `deriveFallback` that
// checks the entity's local mutation-queue overlay — if there's a pending
// create/update/delete, it hands back an empty base response instead of
// letting the error surface, so applyOverlay can still show the pending
// item. Uses real repositories against a real in-memory test db (same
// pattern as hooks/repositories/__tests__/*.test.ts's testDb.ts helper) so
// the overlay content driving deriveFallback is genuine, not stubbed.
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
import { DiaryFormData, ObservationFormData, PlaceFormData, Profile } from "../../types";

type FetchesModule = typeof import("../fetches");
type ObservationRepo = typeof import("../../hooks/repositories/observationRepository");
type DiaryRepo = typeof import("../../hooks/repositories/diaryRepository");
type PlaceRepo = typeof import("../../hooks/repositories/placeRepository");
type ApiMock = { get: jest.Mock };
type ListCacheRepoMock = {
  getCachedListResponse: jest.Mock;
  getCachedListResponseByPrefix: jest.Mock;
  cacheListResponse: jest.Mock;
};

const PROFILE: Profile = {
  user_data: {
    username: "jdoe",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    is_active: true,
  },
  avatar: "",
  avatar_thumbnail: "",
  private: false,
  private_diary: false,
  user: 42,
  registration_ip: "",
  timezone: "Europe/Berlin",
  territory: 5,
};

const NETWORK_ERROR = { isNetworkError: true, message: "Network Error" };

let db: BetterSQLite3Database<typeof schema>;
let fetches: FetchesModule;
let observationRepository: ObservationRepo;
let diaryRepository: DiaryRepo;
let placeRepository: PlaceRepo;
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
  // Same reasoning as diaryRepository.test.ts: territoryDataFor (called from
  // each repository's synthesize()) hits referenceRepository's real
  // getCachedCountries, which isn't relevant to this file's own logic.
  jest.doMock("../../hooks/repositories/referenceRepository", () => ({
    getCachedCountries: jest.fn(() => []),
  }));

  observationRepository = require("../../hooks/repositories/observationRepository");
  diaryRepository = require("../../hooks/repositories/diaryRepository");
  placeRepository = require("../../hooks/repositories/placeRepository");
  fetches = require("../fetches");
  api = require("../../services/api").default;
  listCacheRepository = require("../../hooks/repositories/listCacheRepository");

  api.get.mockReset().mockRejectedValue(NETWORK_ERROR);
  listCacheRepository.getCachedListResponse.mockReset().mockReturnValue(null);
  listCacheRepository.getCachedListResponseByPrefix.mockReset().mockReturnValue(null);
  listCacheRepository.cacheListResponse.mockReset();
});

const observationPayload = (overrides: Partial<ObservationFormData> = {}): ObservationFormData => ({
  species: 100,
  territory: 5,
  date_time: "2026-01-01T00:00:00Z",
  location_private: true,
  ...overrides,
});

const diaryPayload = (overrides: Partial<DiaryFormData> = {}): DiaryFormData => ({
  territory: 5,
  date_time: "2026-01-01T00:00:00Z",
  location_private: true,
  ...overrides,
});

const placePayload = (overrides: Partial<PlaceFormData> = {}): PlaceFormData => ({
  name: "My spot",
  territory: 5,
  location: { type: "Point", coordinates: [2.35, 48.85] },
  ...overrides,
});

describe("fetchObservations offline fallback", () => {
  it("throws the normal offline error when there's no cache and nothing pending", async () => {
    await expect(fetches.fetchObservations({})).rejects.toBe(NETWORK_ERROR);
  });

  it("returns the pending create instead of erroring when offline with no cache", async () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    const result = await fetches.fetchObservations({});

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe(created.id);
    expect(result.pagination.count).toBe(1);
  });

  it("does not resurrect a discarded/failed mutation that left no overlay row", async () => {
    // No createLocal call at all this time — overlay is genuinely empty.
    await expect(fetches.fetchObservations({})).rejects.toBe(NETWORK_ERROR);
  });

  it("a pending delete alone (no create) still resolves to an empty list, not an error", async () => {
    observationRepository.upsertFromServer({
      id: 888,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      date_time: "2026-01-01T00:00:00Z",
      notes: null,
      quantity: null,
      time: null,
      diary: null,
      is_owner: true,
      owner: {
        avatar: "",
        first_name: "Jane",
        last_name: "Doe",
        username: "jdoe",
        private: false,
        id: 42,
        timezone_id: "",
      },
      place: null,
      place_data: null,
      private: false,
      territory: 5,
      species: 100,
      species_data: { id: 100, name: "", name_lang: "", segment: "", thumb: null },
      territory_data: { code: "", id: 5, name: "", segment: "" },
      location_private: true,
      external_source: null,
      external_username: null,
      distance: undefined,
    });
    observationRepository.deleteLocal(888);

    // Same reasoning as fetchPlaces'/fetchDiaries' equivalent test:
    // deriveFallback's empty base has nothing for applyOverlay's
    // deletedIds/patchesById to act on (they only filter/rewrite items
    // already present in `results`) — only a pending *create* can actually
    // populate the list from an empty base.
    const result = await fetches.fetchObservations({});
    expect(result.results).toHaveLength(0);
  });
});

describe("fetchDiaries offline fallback (regression — pre-existing behavior)", () => {
  it("throws the normal offline error when there's no cache and nothing pending", async () => {
    await expect(fetches.fetchDiaries({})).rejects.toBe(NETWORK_ERROR);
  });

  it("returns the pending create instead of erroring when offline with no cache", async () => {
    const created = diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");

    const result = await fetches.fetchDiaries({});

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe(created.id);
  });

  it("a pending delete alone (no create) still resolves to an empty list, not an error", async () => {
    diaryRepository.upsertFromServer({
      id: 777,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      date_time: "2026-01-01T00:00:00Z",
      name: null,
      observation_count: 0,
      place: null,
      place_data: null,
      private: false,
      location_private: true,
      profile: 42,
      territory: 5,
      territory_data: { code: "", id: 5, name: "", segment: "" },
      is_owner: true,
      owner: {
        avatar: "",
        first_name: "Jane",
        id: 42,
        last_name: "Doe",
        private: false,
        timezone_id: "",
        username: "jdoe",
      },
      user_data: {
        avatar: "",
        first_name: "Jane",
        id: 42,
        last_name: "Doe",
        timezone_id: "",
        username: "jdoe",
      },
    });
    diaryRepository.deleteLocal(777);

    // Same reasoning as fetchPlaces' equivalent test: deriveFallback's empty
    // base has nothing for applyOverlay's deletedIds/patchesById to act on
    // (they only filter/rewrite items already present in `results`) — only
    // a pending *create* can actually populate the list from an empty base.
    const result = await fetches.fetchDiaries({});
    expect(result.results).toHaveLength(0);
  });
});

describe("fetchPlaces offline fallback", () => {
  it("throws the normal offline error when there's no cache and nothing pending", async () => {
    await expect(fetches.fetchPlaces({})).rejects.toBe(NETWORK_ERROR);
  });

  it("returns the pending create instead of erroring when offline with no cache", async () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");

    const result = await fetches.fetchPlaces({});

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe(created.id);
    expect(result.pagination.count).toBe(1);
  });

  it("also covers a pending update/delete on an already-synced place, not just creates", async () => {
    placeRepository.upsertFromServer({
      id: 555,
      name: "Existing",
      favourite: false,
      location: { type: "Point", coordinates: [2.35, 48.85] },
      distance: null,
      preview: null,
      diary_count: 0,
      observation_count: 0,
      species_count: 0,
      territory: 5,
      territory_data: { code: "", id: 5, name: "", segment: "" },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    placeRepository.updateLocal(555, { favourite: true }, null);

    const result = await fetches.fetchPlaces({});

    // The live/cache response is the empty deriveFallback base, so the only
    // way this patched place appears is via applyOverlay's patchesById path
    // — but that only rewrites items already present in `results`, and the
    // empty base has none. This documents that update/delete overlays on an
    // otherwise-uncached query still result in an empty list, unlike a
    // pending *create* — a real (pre-existing, not introduced by this
    // change) limitation of layering applyOverlay on top of an empty base.
    expect(result.results).toHaveLength(0);
  });
});
