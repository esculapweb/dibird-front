import { sortOptionsList } from "../sortOptionsList";

describe("sortOptionsList", () => {
  it.each([
    ["Stat", ["name", "-name", "ioc_id", "-ioc_id", "-seen,-date_time", "-seen,date_time"]],
    ["UserStat", ["name", "-name", "ioc_id", "-ioc_id", "-seen,-date_time", "-seen,date_time"]],
    ["Observations", ["-date_time", "date_time", "species_name", "-species_name", "ioc_id", "-ioc_id"]],
    ["DiaryDetail", ["species_name", "-species_name", "ioc_id", "-ioc_id", "-created_at", "created_at"]],
    ["Diaries", ["-date_time", "date_time", "observation_count,name", "-observation_count,name"]],
    [
      "Places",
      [
        "distance",
        "-distance",
        "name",
        "-name",
        "-favourite,name",
        "favourite,name",
        "-species_count,name",
        "species_count,name",
        "-observation_count,name",
        "observation_count,name",
      ],
    ],
    [
      "Community",
      ["-date_time", "date_time", "distance", "-distance", "species_name", "-species_name", "ioc_id", "-ioc_id"],
    ],
    ["PlacesDropdown", ["distance", "-distance", "-favourite,name", "favourite,name", "name", "-name"]],
    ["CountriesDropdown", ["-favourite,name", "favourite,name", "name", "-name"]],
    ["SpeciesDropdown", ["-seen,name", "seen,name", "ioc_id", "-ioc_id", "name", "-name"]],
    ["Rating", ["-observations", "observations", "-last_update", "last_update"]],
    ["RatingsCompare", ["ioc_id", "-ioc_id", "name", "-name"]],
    ["TimezonesDropdown", ["name"]],
  ] as const)("returns the expected option values for %s", (screen, expectedValues) => {
    const options = sortOptionsList(screen);
    expect(options.map((o) => o.value)).toEqual(expectedValues);
  });

  it("gives every option a non-empty label", () => {
    for (const value of [
      "Stat", "Observations", "DiaryDetail", "Diaries", "Places", "Community",
      "PlacesDropdown", "CountriesDropdown", "SpeciesDropdown", "Rating", "RatingsCompare",
    ]) {
      for (const option of sortOptionsList(value)) {
        expect(option.label).toEqual(expect.any(String));
        expect(option.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns an empty array for an unknown screen", () => {
    expect(sortOptionsList("SomeUnknownScreen")).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(sortOptionsList(undefined)).toEqual([]);
  });
});
