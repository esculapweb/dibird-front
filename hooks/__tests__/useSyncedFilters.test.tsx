jest.mock("@react-navigation/native", () => {
  const { useEffect } = require("react");
  return {
    // Screen tests elsewhere run `cb()` synchronously since their focus
    // callbacks are side-effect-only. useSyncedFilters's focus callback
    // calls setFilters during render if invoked that way, which trips
    // React's render-phase-update loop guard — so this defers it to a real
    // effect instead (re-running whenever cb's own dependencies change,
    // approximating "re-focus" on every relevant change).
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock("../../util/storageHelper", () => ({ loadSort: jest.fn() }));
jest.mock("../../store/filters-context", () => ({ useFilters: jest.fn() }));
jest.mock("../../store/location-context", () => ({ useLocation: jest.fn() }));

import { act, renderHook } from "@testing-library/react-native";
import { loadSort } from "../../util/storageHelper";
import { useFilters } from "../../store/filters-context";
import { useLocation } from "../../store/location-context";
import { useSyncedFilters } from "../useSyncedFilters";
import { createNavigationMock, createRouteMock } from "../../screens/test-utils";
import {
  AllowedFilterKey,
  AppStackNavigationProp,
  ScreenWithFilters,
  ScreenWithFiltersOnly,
} from "../../types";

const mockSetTerritory = jest.fn().mockResolvedValue(undefined);
const mockSetDate = jest.fn().mockResolvedValue(undefined);
const mockSetPlace = jest.fn().mockResolvedValue(undefined);
const mockSetSpecies = jest.fn().mockResolvedValue(undefined);
const mockRequestLocation = jest.fn();

const mockNavigation = createNavigationMock() as unknown as AppStackNavigationProp;

const mockFiltersContext = (overrides: Record<string, unknown> = {}) => {
  (useFilters as jest.Mock).mockReturnValue({
    territory: null,
    setTerritory: mockSetTerritory,
    date: null,
    setDate: mockSetDate,
    place: null,
    setPlace: mockSetPlace,
    species: null,
    setSpecies: mockSetSpecies,
    filtersReady: true,
    ...overrides,
  });
};

const mockLocation = (overrides: Record<string, unknown> = {}) => {
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: null,
    permissionStatus: "undetermined",
    requestLocation: mockRequestLocation,
    ...overrides,
  });
};

type Props = Parameters<typeof useSyncedFilters<ScreenWithFiltersOnly>>[0];

const buildProps = (params?: ScreenWithFilters, extra: Partial<Props> = {}): Props => {
  const screenName = (extra.screenName ?? "Diaries") as Props["screenName"];
  return {
    route: createRouteMock(screenName, params) as never,
    navigation: mockNavigation,
    screenName,
    allowedFilters: ["territory", "date", "place", "species", "favourite"] as AllowedFilterKey[],
    ...extra,
  };
};

const renderSyncedFilters = (params?: ScreenWithFilters, extra: Partial<Props> = {}) =>
  renderHook((props: Props) => useSyncedFilters(props), {
    initialProps: buildProps(params, extra),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockFiltersContext();
  mockLocation();
  (loadSort as jest.Mock).mockResolvedValue(null);
});

describe("initial load from filters-context (no route params)", () => {
  it("waits for filtersReady before populating filters", async () => {
    mockFiltersContext({ filtersReady: false, territory: 5 });
    const { result } = await renderSyncedFilters();

    expect(result.current.filters).toEqual({});
    expect(result.current.filtersLoaded).toBe(false);
  });

  it("seeds filters from context once ready, and marks filtersLoaded", async () => {
    mockFiltersContext({ territory: 5, place: 9, species: 3, date: { type: "today" } });
    const { result } = await renderSyncedFilters();

    expect(result.current.filters).toEqual({
      territory: 5,
      place: 9,
      date: { type: "today" },
      species: 3,
    });
    expect(result.current.filtersLoaded).toBe(true);
  });
});

describe("filtersOverride route param", () => {
  it("applies the override filters, splits out speciesName into filterHints, and clears the param", async () => {
    const { result } = await renderSyncedFilters({
      filtersOverride: { territory: 5, species: 3, speciesName: "Robin" },
    });

    expect(result.current.filters).toEqual({ territory: 5, species: 3 });
    expect(result.current.filterHints).toEqual({ speciesName: "Robin" });
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ filtersOverride: undefined });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.filtersLoaded).toBe(true);
  });

  it("uses params.o for sort directly instead of loading the stored sort", async () => {
    await renderSyncedFilters({ filtersOverride: { territory: 5 }, o: "-date_time" });
    expect(loadSort).not.toHaveBeenCalled();
  });

  it("loads the stored sort when params.o is absent", async () => {
    await renderSyncedFilters({ filtersOverride: { territory: 5 } });
    expect(loadSort).toHaveBeenCalledWith("Diaries");
  });
});

describe("deep link params (no filtersOverride)", () => {
  it("applies deep-linked filters/sort and marks filtersLoaded synchronously", async () => {
    const { result } = await renderSyncedFilters({ territory: "5", o: "-date_time" } as never);

    expect(result.current.filters).toEqual(
      expect.objectContaining({ territory: 5, place: null, species: null }),
    );
    expect(result.current.sort).toBe("-date_time");
    expect(result.current.filtersLoaded).toBe(true);
  });

  it("does not re-apply an identical deep link on a later render", async () => {
    const params = { territory: "5", o: "-date_time" } as ScreenWithFilters;
    const { result, rerender } = await renderSyncedFilters(params);
    expect(result.current.sort).toBe("-date_time");

    await act(async () => {
      result.current.setSort("date_time");
    });
    expect(result.current.sort).toBe("date_time");

    await rerender(buildProps(params));
    // Same deep-link key as before → not re-applied, so the user's own
    // sort choice isn't clobbered back to the deep-linked "-date_time".
    expect(result.current.sort).toBe("date_time");
  });
});

describe("hasActiveFilters", () => {
  it("is false when no allowed filter has a value", async () => {
    const { result } = await renderSyncedFilters();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("is true once an allowed filter is set", async () => {
    mockFiltersContext({ territory: 5 });
    const { result } = await renderSyncedFilters();
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("ignores filters that aren't in allowedFilters", async () => {
    mockFiltersContext({ territory: 5 });
    const { result } = await renderSyncedFilters(undefined, { allowedFilters: ["species"] });
    expect(result.current.hasActiveFilters).toBe(false);
  });
});

describe("handleClearFilters", () => {
  it("resets all filter-context setters and the local filters, bypassing context resync", async () => {
    mockFiltersContext({ territory: 5, place: 9 });
    const { result } = await renderSyncedFilters();

    await act(async () => {
      await result.current.handleClearFilters();
    });

    expect(mockSetDate).toHaveBeenCalledWith(null);
    expect(mockSetTerritory).toHaveBeenCalledWith(null);
    expect(mockSetPlace).toHaveBeenCalledWith(null);
    expect(mockSetSpecies).toHaveBeenCalledWith(null);
    expect(result.current.filters).toEqual({});
  });
});

describe("removeFilter", () => {
  it("clears both the context value and the local filter for a plain key", async () => {
    mockFiltersContext({ species: 3 });
    const { result } = await renderSyncedFilters();

    await act(async () => {
      result.current.removeFilter("species");
    });

    expect(mockSetSpecies).toHaveBeenCalledWith(null);
    expect(result.current.filters.species).toBeNull();
  });

  it("clears place and species too when removing territory", async () => {
    mockFiltersContext({ territory: 5, place: 9, species: 3 });
    const { result } = await renderSyncedFilters();

    await act(async () => {
      result.current.removeFilter("territory");
    });

    expect(mockSetTerritory).toHaveBeenCalledWith(null);
    expect(mockSetPlace).toHaveBeenCalledWith(null);
    expect(mockSetSpecies).toHaveBeenCalledWith(null);
    expect(result.current.filters).toEqual(
      expect.objectContaining({ territory: null, place: null, species: null }),
    );
  });

  it("does not touch local filters when a filtersOverride param is active (only resets context)", async () => {
    const { result } = await renderSyncedFilters({ filtersOverride: { species: 3 } });

    await act(async () => {
      result.current.removeFilter("species");
    });

    expect(mockSetSpecies).toHaveBeenCalledWith(null);
    expect(result.current.filters.species).toBe(3);
  });
});

describe("focus-effect context resync", () => {
  it("pulls in a territory change from context, clearing place/species", async () => {
    mockFiltersContext({ territory: 5, place: 9, species: 3 });
    const { result, rerender } = await renderSyncedFilters(undefined, {
      allowedFilters: ["territory", "place", "species"] as AllowedFilterKey[],
    });
    expect(result.current.filters).toEqual(
      expect.objectContaining({ territory: 5, place: 9, species: 3 }),
    );

    mockFiltersContext({ territory: 7, place: 9, species: 3 });
    await rerender(buildProps(undefined, { allowedFilters: ["territory", "place", "species"] as AllowedFilterKey[] }));

    expect(result.current.filters).toEqual(
      expect.objectContaining({ territory: 7, place: null, species: null }),
    );
  });

  it("is suppressed while ignoreContextSync is set (e.g. right after handleClearFilters)", async () => {
    mockFiltersContext({ territory: 5 });
    const { result, rerender } = await renderSyncedFilters();

    await act(async () => {
      await result.current.handleClearFilters();
    });
    expect(result.current.filters).toEqual({});

    // Context still reports the old territory (setTerritory is mocked and
    // doesn't actually change what useFilters returns) — a focus resync
    // must not resurrect it while ignoreContextSync is true.
    await rerender(buildProps());
    expect(result.current.filters).toEqual({});
  });

  it("clears a stale species filter once the context species goes back to null", async () => {
    mockFiltersContext({ species: 3 });
    const { result, rerender } = await renderSyncedFilters(undefined, {
      allowedFilters: ["species"] as AllowedFilterKey[],
    });
    expect(result.current.filters.species).toBe(3);

    await act(async () => {
      result.current.handleFiltersApplied({ species: 3, territory: null });
    });

    mockFiltersContext({ species: null });
    await rerender(buildProps(undefined, { allowedFilters: ["species"] as AllowedFilterKey[] }));
    expect(result.current.filters.species).toBeNull();
  });
});

describe("loadAndApplySort", () => {
  it("resolves and applies the stored sort", async () => {
    (loadSort as jest.Mock).mockResolvedValue("-date_time");
    const { result } = await renderSyncedFilters();
    expect(result.current.sort).toBe("-date_time");
    expect(result.current.sortReady).toBe(true);
  });

  it("marks sortReady immediately without loading when allowSort is false", async () => {
    const { result } = await renderSyncedFilters(undefined, { allowSort: false });
    expect(result.current.sortReady).toBe(true);
    expect(loadSort).not.toHaveBeenCalled();
  });

  it("falls back off a distance sort when location permission was denied", async () => {
    // "distance" is only a valid sort option on screens like Places —
    // Diaries doesn't offer it, so use Places here to exercise the actual
    // fallback branch instead of normalizeValue's unrelated invalid-value fallback.
    (loadSort as jest.Mock).mockResolvedValue("distance");
    mockLocation({ permissionStatus: "denied" });
    const { result } = await renderSyncedFilters(undefined, { screenName: "Places" });

    expect(result.current.sort).not.toBe("distance");
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("requests location for a distance sort when permission isn't denied yet (falling back to a non-distance sort until coords arrive)", async () => {
    (loadSort as jest.Mock).mockResolvedValue("distance");
    const { result } = await renderSyncedFilters(undefined, { screenName: "Places" });
    await act(async () => {
      await Promise.resolve();
    });
    // shouldFallback triggers on locationCoords === null regardless of
    // permission — the actual "distance" value only kicks back in once
    // coordinates resolve (see the "auto-apply" describe block below).
    expect(result.current.sort).not.toBe("distance");
    expect(mockRequestLocation).toHaveBeenCalledTimes(1);
  });
});

describe("distance-sort auto-apply once coordinates arrive", () => {
  it("switches to the stored distance sort once locationCoords resolves", async () => {
    (loadSort as jest.Mock).mockResolvedValue("distance");
    mockLocation({ locationCoords: null, permissionStatus: "granted" });
    const { result, rerender } = await renderSyncedFilters(undefined, { screenName: "Places" });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.sort).not.toBe("distance");

    mockLocation({ locationCoords: { lat: 1, lng: 2 }, permissionStatus: "granted" });
    await rerender(buildProps(undefined, { screenName: "Places" }));

    expect(result.current.sort).toBe("distance");
  });

  it("does not override a sort the user explicitly changed", async () => {
    (loadSort as jest.Mock).mockResolvedValue("distance");
    mockLocation({ locationCoords: null, permissionStatus: "granted" });
    const { result, rerender } = await renderSyncedFilters(undefined, { screenName: "Places" });

    await act(async () => {
      result.current.setSort("name");
    });
    expect(result.current.sort).toBe("name");

    mockLocation({ locationCoords: { lat: 1, lng: 2 }, permissionStatus: "granted" });
    await rerender(buildProps(undefined, { screenName: "Places" }));

    expect(result.current.sort).toBe("name");
  });
});

describe("search", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("debounces search into debouncedSearch/isSearchActive", async () => {
    const { result } = await renderSyncedFilters();
    expect(result.current.isSearchActive).toBe(false);

    await act(async () => {
      result.current.setSearch("robin");
    });
    expect(result.current.search).toBe("robin");
    expect(result.current.isSearchActive).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.debouncedSearch).toBe("robin");
    expect(result.current.isSearchActive).toBe(true);
  });

  it("handleClearSearch resets the search field immediately", async () => {
    const { result } = await renderSyncedFilters();
    await act(async () => {
      result.current.setSearch("robin");
    });
    expect(result.current.search).toBe("robin");

    await act(async () => {
      result.current.handleClearSearch();
    });
    expect(result.current.search).toBe("");
  });
});
