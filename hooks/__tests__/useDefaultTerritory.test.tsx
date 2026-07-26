jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../repositories/referenceRepository", () => ({
  getCachedCountries: jest.fn(),
}));

import { renderHook } from "@testing-library/react-native";
import { useFilters } from "../../store/filters-context";
import { useProfile } from "../../store/profile-context";
import { getCachedCountries } from "../repositories/referenceRepository";
import { setSession } from "../../util/sessionStore";
import { useDefaultTerritory } from "../useDefaultTerritory";
import { TaxonCountry } from "../../types";

const country = (code: string): TaxonCountry => ({
  code,
  name: code,
  segment: code.toLowerCase(),
  status: "",
  region: null,
});

const cachedCountries = [
  { value: 4, label: "Kenya", code: "KE" },
  { value: 7, label: "United Kingdom", code: "GB" },
];

beforeEach(() => {
  jest.clearAllMocks();
  setSession("lastTerritory", null);
  (useFilters as jest.Mock).mockReturnValue({ territory: null });
  (useProfile as jest.Mock).mockReturnValue({ profile: null });
  (getCachedCountries as jest.Mock).mockReturnValue(cachedCountries);
});

describe("which candidate wins", () => {
  it("prefers the country last saved this session over the filter and the profile", async () => {
    setSession("lastTerritory", 4);
    (useFilters as jest.Mock).mockReturnValue({ territory: 7 });
    (useProfile as jest.Mock).mockReturnValue({ profile: { territory: 9 } });

    const { result } = await renderHook(() => useDefaultTerritory());

    expect(result.current).toBe(4);
  });

  it("prefers the global filter over the profile", async () => {
    (useFilters as jest.Mock).mockReturnValue({ territory: 7 });
    (useProfile as jest.Mock).mockReturnValue({ profile: { territory: 9 } });

    const { result } = await renderHook(() => useDefaultTerritory());

    expect(result.current).toBe(7);
  });

  it("falls back to the profile's country", async () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: { territory: 9 } });

    const { result } = await renderHook(() => useDefaultTerritory());

    expect(result.current).toBe(9);
  });

  it("has no default when nobody has named a country", async () => {
    const { result } = await renderHook(() => useDefaultTerritory());

    expect(result.current).toBeNull();
  });
});

describe("checking the candidate against a species' range", () => {
  it("keeps a candidate the species has been recorded in", async () => {
    setSession("lastTerritory", 4);

    const { result } = await renderHook(() =>
      useDefaultTerritory([country("KE"), country("UG")]),
    );

    expect(result.current).toBe(4);
  });

  it("drops a candidate outside the range instead of trying the next one", async () => {
    setSession("lastTerritory", 4);
    (useProfile as jest.Mock).mockReturnValue({ profile: { territory: 7 } });

    const { result } = await renderHook(() =>
      useDefaultTerritory([country("GB")]),
    );

    expect(result.current).toBeNull();
  });

  it("keeps the candidate when the countries cache can't say which country it is", async () => {
    // Nothing has fetched the countries dropdown on this device yet, so the
    // territory id can't be turned into an ISO code — better the user's own
    // country than an empty required field.
    setSession("lastTerritory", 4);
    (getCachedCountries as jest.Mock).mockReturnValue([]);

    const { result } = await renderHook(() =>
      useDefaultTerritory([country("GB")]),
    );

    expect(result.current).toBe(4);
  });

  it("keeps the candidate when the species carries no country list", async () => {
    setSession("lastTerritory", 4);

    const { result } = await renderHook(() => useDefaultTerritory([]));

    expect(result.current).toBe(4);
  });
});
