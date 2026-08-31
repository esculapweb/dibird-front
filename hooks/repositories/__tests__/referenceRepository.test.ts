import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import * as schema from "../../../services/db/schema";
import { isoToFlagEmoji } from "../../../util/helpers";
import { CountryItem, DropdownItem } from "../../../types";

type ReferenceRepo = typeof import("../referenceRepository");

let db: BetterSQLite3Database<typeof schema>;
let referenceRepository: ReferenceRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["referenceRepository"]);
  referenceRepository = repos.referenceRepository as ReferenceRepo;
});

const FRANCE: CountryItem = { territory_id: 5, name: "France", code: "FR", favourite: false };
const ALBANIA: CountryItem = { territory_id: 3, name: "Albania", code: "AL", favourite: true };
const ZAMBIA: CountryItem = { territory_id: 9, name: "Zambia", code: "ZM", favourite: false };

describe("cacheCountries / getCachedCountries", () => {
  it("caches items and maps them back with a flag icon and no iconLabelRight when not a favourite", () => {
    referenceRepository.cacheCountries([FRANCE]);
    const [result] = referenceRepository.getCachedCountries("name");

    expect(result).toEqual({
      value: 5,
      label: "France",
      code: "FR",
      icon: isoToFlagEmoji("FR"),
      iconLabelRight: undefined,
    });
  });

  it("marks a favourite with iconLabelRight: 'star'", () => {
    referenceRepository.cacheCountries([ALBANIA]);
    const [result] = referenceRepository.getCachedCountries("name");
    expect(result.iconLabelRight).toBe("star");
  });

  it("fully replaces the previous cache rather than merging", () => {
    referenceRepository.cacheCountries([FRANCE]);
    referenceRepository.cacheCountries([ALBANIA]);

    const results = referenceRepository.getCachedCountries("name");
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("Albania");
  });

  it("returns an empty list when nothing has been cached", () => {
    expect(referenceRepository.getCachedCountries("name")).toEqual([]);
  });

  describe("sort orders", () => {
    beforeEach(() => {
      referenceRepository.cacheCountries([FRANCE, ALBANIA, ZAMBIA]);
    });

    it("'name' sorts alphabetically ascending", () => {
      const labels = referenceRepository.getCachedCountries("name").map((c) => c.label);
      expect(labels).toEqual(["Albania", "France", "Zambia"]);
    });

    it("'-name' sorts alphabetically descending", () => {
      const labels = referenceRepository.getCachedCountries("-name").map((c) => c.label);
      expect(labels).toEqual(["Zambia", "France", "Albania"]);
    });

    it("'favourite,name' sorts non-favourites first, favourites last, alphabetical within each group", () => {
      const labels = referenceRepository.getCachedCountries("favourite,name").map((c) => c.label);
      expect(labels).toEqual(["France", "Zambia", "Albania"]);
    });

    it("'-favourite,name' sorts favourites first", () => {
      const labels = referenceRepository.getCachedCountries("-favourite,name").map((c) => c.label);
      expect(labels).toEqual(["Albania", "France", "Zambia"]);
    });

    it("falls back to alphabetical for an unrecognized order string", () => {
      const labels = referenceRepository.getCachedCountries("bogus").map((c) => c.label);
      expect(labels).toEqual(["Albania", "France", "Zambia"]);
    });
  });
});

describe("cacheTimezones / getCachedTimezones", () => {
  const TIMEZONES: DropdownItem[] = [
    { value: "Europe/Paris", label: "Paris" },
    { value: "UTC", label: "UTC" },
    { value: "Asia/Tokyo", label: "Tokyo" },
  ];

  it("caches items and reads them back in their original (insertion) order, not alphabetical", () => {
    referenceRepository.cacheTimezones(TIMEZONES);
    expect(referenceRepository.getCachedTimezones()).toEqual(TIMEZONES);
  });

  it("fully replaces the previous cache rather than merging", () => {
    referenceRepository.cacheTimezones(TIMEZONES);
    referenceRepository.cacheTimezones([{ value: "UTC", label: "UTC" }]);

    expect(referenceRepository.getCachedTimezones()).toEqual([{ value: "UTC", label: "UTC" }]);
  });

  it("returns an empty list when nothing has been cached", () => {
    expect(referenceRepository.getCachedTimezones()).toEqual([]);
  });
});

describe("clearReferenceData", () => {
  it("wipes both countries and timezones", () => {
    referenceRepository.cacheCountries([FRANCE, ALBANIA]);
    referenceRepository.cacheTimezones([{ value: "UTC", label: "UTC" }]);

    referenceRepository.clearReferenceData();

    expect(referenceRepository.getCachedCountries("name")).toEqual([]);
    expect(referenceRepository.getCachedTimezones()).toEqual([]);
  });
});
