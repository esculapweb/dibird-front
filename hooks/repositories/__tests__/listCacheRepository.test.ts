import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import {
  speciesDropdownCacheTable,
  placesDropdownCacheTable,
  statCacheTable,
  taxonListCacheTable,
  taxonDetailCacheTable,
  territoryListCacheTable,
  territoryDetailCacheTable,
} from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";

type ListCacheRepo = typeof import("../listCacheRepository");

let db: BetterSQLite3Database<typeof schema>;
let listCacheRepository: ListCacheRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["listCacheRepository"]);
  listCacheRepository = repos.listCacheRepository as ListCacheRepo;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const allRows = () => db.select().from(speciesDropdownCacheTable).all();

describe("cacheListResponse / getCachedListResponse", () => {
  it("stores a response under its key and reads it back", () => {
    listCacheRepository.cacheListResponse(speciesDropdownCacheTable, "key1", { a: 1 }, 100);
    expect(listCacheRepository.getCachedListResponse(speciesDropdownCacheTable, "key1")).toEqual({ a: 1 });
  });

  it("returns null for a key that was never cached", () => {
    expect(listCacheRepository.getCachedListResponse(speciesDropdownCacheTable, "missing")).toBeNull();
  });

  it("overwrites the existing row (not a duplicate) when the same key is cached again", () => {
    listCacheRepository.cacheListResponse(speciesDropdownCacheTable, "key1", { a: 1 }, 100);
    listCacheRepository.cacheListResponse(speciesDropdownCacheTable, "key1", { a: 2 }, 100);

    expect(allRows()).toHaveLength(1);
    expect(listCacheRepository.getCachedListResponse(speciesDropdownCacheTable, "key1")).toEqual({ a: 2 });
  });
});

describe("getCachedListResponseByPrefix", () => {
  it("returns the most recently updated row among those matching the prefix", async () => {
    listCacheRepository.cacheListResponse(speciesDropdownCacheTable, "species|5|name", { order: "name" }, 100);
    await new Promise((r) => setTimeout(r, 2));
    listCacheRepository.cacheListResponse(speciesDropdownCacheTable, "species|5|ioc_id", { order: "ioc_id" }, 100);

    const result = listCacheRepository.getCachedListResponseByPrefix(speciesDropdownCacheTable, "species|5|");
    expect(result).toEqual({ order: "ioc_id" });
  });

  it("does not match a key under a different prefix", () => {
    listCacheRepository.cacheListResponse(speciesDropdownCacheTable, "species|9|name", { order: "name" }, 100);
    expect(
      listCacheRepository.getCachedListResponseByPrefix(speciesDropdownCacheTable, "species|5|"),
    ).toBeNull();
  });

  it("returns null when nothing has been cached yet", () => {
    expect(
      listCacheRepository.getCachedListResponseByPrefix(speciesDropdownCacheTable, "species|5|"),
    ).toBeNull();
  });
});

describe("eviction", () => {
  it("keeps growing under the cap (maxEntries + hysteresis) without evicting anything", () => {
    for (let i = 0; i < 15; i++) {
      listCacheRepository.cacheListResponse(speciesDropdownCacheTable, `key${i}`, { i }, 1);
    }
    // maxEntries=1, but MIN_HYSTERESIS=20 keeps the real threshold at 21 —
    // 15 rows is still comfortably under it.
    expect(allRows()).toHaveLength(15);
  });

  it("evicts the oldest rows down to exactly maxEntries once the hysteresis threshold is crossed", () => {
    let clock = 0;
    jest.spyOn(Date, "now").mockImplementation(() => ++clock);

    // maxEntries=1 + MIN_HYSTERESIS=20 → threshold is 21; the 22nd insert
    // crosses it and trims back down to maxEntries.
    for (let i = 0; i < 22; i++) {
      listCacheRepository.cacheListResponse(speciesDropdownCacheTable, `key${i}`, { i }, 1);
    }

    const rows = allRows();
    expect(rows).toHaveLength(1);
    // The single survivor is the most recently written key.
    expect(rows[0].key).toBe("key21");
  });
});

describe("clearAllListCaches", () => {
  it("wipes every user-specific cache table, not just the one under test elsewhere in this file", () => {
    listCacheRepository.cacheListResponse(speciesDropdownCacheTable, "species|5|name", { a: 1 }, 100);
    listCacheRepository.cacheListResponse(placesDropdownCacheTable, "places|5|name", { b: 2 }, 100);
    listCacheRepository.cacheListResponse(statCacheTable, "stat|5", { c: 3 }, 100);

    listCacheRepository.clearAllListCaches();

    expect(db.select().from(speciesDropdownCacheTable).all()).toHaveLength(0);
    expect(db.select().from(placesDropdownCacheTable).all()).toHaveLength(0);
    expect(db.select().from(statCacheTable).all()).toHaveLength(0);
  });

  // The catalogue is reference data — the same birds and countries for every
  // user, nothing personal in it, and by far the most expensive thing the app
  // caches. Logging out is not a reason to re-download it, so these four are
  // deliberately left out of ALL_CACHE_TABLES; this pins that decision so a
  // later "wipe everything" doesn't quietly undo it.
  const catalogueTables = [
    ["taxon_list_cache", taxonListCacheTable],
    ["taxon_detail_cache", taxonDetailCacheTable],
    ["territory_list_cache", territoryListCacheTable],
    ["territory_detail_cache", territoryDetailCacheTable],
  ] as const;

  it.each(catalogueTables)("keeps %s, which holds no user data", (_name, table) => {
    listCacheRepository.cacheListResponse(table, "key", { a: 1 }, 100);

    listCacheRepository.clearAllListCaches();

    expect(db.select().from(table).all()).toHaveLength(1);
  });
});
