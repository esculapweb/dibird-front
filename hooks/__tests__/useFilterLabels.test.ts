jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../store/language-context", () => ({ useLanguage: jest.fn() }));
jest.mock("../../store/location-context", () => ({ useLocation: jest.fn() }));
jest.mock("../../util/fetches", () => ({
  fetchMyCountries: jest.fn(),
  fetchMyPlaces: jest.fn(),
  fetchSpecies: jest.fn(),
}));

const mockDropdownQuery = jest.fn();
jest.mock("../useDropdownQuery", () => ({ useDropdownQuery: (args: unknown) => mockDropdownQuery(args) }));

import { renderHook } from "@testing-library/react-native";
import { useLanguage } from "../../store/language-context";
import { useLocation } from "../../store/location-context";
import { useFilterLabels } from "../useFilterLabels";
import { DateFilter } from "../../types";

const queryDataByType: Record<string, Map<number, string> | undefined> = {};

beforeEach(() => {
  jest.clearAllMocks();
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  (useLocation as jest.Mock).mockReturnValue({ locationCoords: null });

  queryDataByType.CountriesDropdown = new Map([[5, "France"]]);
  queryDataByType.PlacesDropdown = new Map([[9, "My Garden"]]);
  queryDataByType.SpeciesDropdown = new Map([[3, "Blue Tit"]]);

  mockDropdownQuery.mockImplementation(({ type }: { type: string }) => ({
    query: { data: queryDataByType[type] },
  }));
});

const dropdownCallByType = (type: string) =>
  mockDropdownQuery.mock.calls.find((c) => c[0].type === type)![0];

it("enables the places/species dropdowns only once a territory is set", async () => {
  await renderHook(() => useFilterLabels(null));
  expect(dropdownCallByType("CountriesDropdown").enabled).toBe(true);
  expect(dropdownCallByType("PlacesDropdown").enabled).toBe(false);
  expect(dropdownCallByType("SpeciesDropdown").enabled).toBe(false);

  jest.clearAllMocks();
  mockDropdownQuery.mockImplementation(({ type }: { type: string }) => ({
    query: { data: queryDataByType[type] },
  }));
  await renderHook(() => useFilterLabels(5));
  expect(dropdownCallByType("PlacesDropdown").enabled).toBe(true);
  expect(dropdownCallByType("SpeciesDropdown").enabled).toBe(true);
});

it("returns an empty string for a null/undefined value", async () => {
  const { result } = await renderHook(() => useFilterLabels(5));
  expect(result.current.getFilterLabel("territory", null)).toBe("");
  expect(result.current.getFilterLabel("territory", undefined)).toBe("");
});

describe("territory/place/species — resolved name or placeholder", () => {
  it("resolves a territory name from the countries dropdown cache", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("territory", 5)).toEqual(["territory", "France"]);
  });

  it("falls back to a placeholder for an unresolved territory id", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("territory", 999)).toEqual(["territory", "..."]);
  });

  it("resolves a place name from the places dropdown cache", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("place", 9)).toEqual(["place", "My Garden"]);
  });

  it("resolves a species name from the species dropdown cache", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("species", 3)).toEqual(["species_single", "Blue Tit"]);
  });

  it("prefers hints.speciesName over the dropdown cache for species", async () => {
    const { result } = await renderHook(() => useFilterLabels(5, { speciesName: "Robin" }));
    expect(result.current.getFilterLabel("species", 3)).toEqual(["species_single", "Robin"]);
  });
});

describe("favourite", () => {
  it("maps truthy/falsy to yes/no", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("favourite", true)).toEqual(["favourite", "yes"]);
    expect(result.current.getFilterLabel("favourite", false)).toEqual(["favourite", "no"]);
  });
});

describe("private/source/radius", () => {
  it("names the privacy side instead of yes/no", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("private", true)).toEqual(["privacy", "private"]);
    expect(result.current.getFilterLabel("private", false)).toEqual(["privacy", "public"]);
  });

  it("labels the community source", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("source", "ebird")).toEqual(["source", "source_ebird"]);
    expect(result.current.getFilterLabel("source", "dibird")).toEqual(["source", "source_dibird"]);
  });

  it("labels both sides of the photo filter", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("has_photo", true)).toEqual(["section_photos", "yes"]);
    expect(result.current.getFilterLabel("has_photo", false)).toEqual(["section_photos", "no"]);
  });

  it("spells the radius out in kilometres", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("radius", 50)).toEqual(["radius", "50 km"]);
  });
});

describe("date", () => {
  const label = async (value: DateFilter) => {
    const { result } = await renderHook(() => useFilterLabels(5));
    return result.current.getFilterLabel("date", value);
  };

  it("formats a full range", async () => {
    expect(await label({ type: "range", from: "2026-01-01", to: "2026-01-31" })).toEqual([
      "period",
      "1/1/2026 – 1/31/2026",
    ]);
  });

  it("formats a from-only range", async () => {
    expect(await label({ type: "range", from: "2026-01-01" })).toEqual(["period", "from 1/1/2026"]);
  });

  it("formats a to-only range", async () => {
    expect(await label({ type: "range", to: "2026-01-31" })).toEqual(["period", "to 1/31/2026"]);
  });

  it("formats a year filter", async () => {
    expect(await label({ type: "year", year: 2025 })).toEqual(["year", "2025"]);
  });

  it("formats today/this_year", async () => {
    expect(await label({ type: "today" })).toEqual(["period", "today"]);
    expect(await label({ type: "this_year" })).toEqual(["period", "this_year"]);
  });

  it("returns an empty string for a falsy or unrecognized filter", async () => {
    expect(await label(null)).toBe("");
    expect(await label({ type: "range" })).toBe("");
    expect(await label({ type: "year" })).toBe("");
  });
});

describe("default branch (unknown keys)", () => {
  it("joins array values with a comma", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("tab", ["seen", "unseen"])).toBe("seen, unseen");
  });

  it("stringifies non-array values", async () => {
    const { result } = await renderHook(() => useFilterLabels(5));
    expect(result.current.getFilterLabel("user_id", 42)).toBe("42");
  });
});
