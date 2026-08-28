import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect, RouteProp } from "@react-navigation/native";

import { loadSort } from "../util/storageHelper";
import { normalizeValue } from "../util/helpers";
import { parseDeepLinkParams } from "../util/parseDeepLinkParams";
import { useFilters } from "../store/filters-context";
import { sortOptionsList } from "../util/sortOptionsList";
import { useDebounce } from "./useDebounce";
import { useLocation } from "../store/location-context";
import {
  Filters,
  AllowedFilterKey,
  AllFiltersKey,
  AppStackNavigationProp,
  ScreenWithFiltersOnly,
  ScreenWithFiltersParamList,
  ScreenWithFilters,
} from "../types";

export const useSyncedFilters = <RouteName extends ScreenWithFiltersOnly>({
  route,
  navigation,
  screenName,
  allowSort = true,
  allowedFilters,
}: {
  route: RouteProp<ScreenWithFiltersParamList, RouteName>;
  navigation: AppStackNavigationProp;
  screenName: RouteName;
  allowSort?: boolean;
  allowedFilters: AllowedFilterKey[];
}) => {
  const {
    territory,
    setTerritory,
    date,
    setDate,
    place,
    setPlace,
    species,
    setSpecies,
    filtersReady,
  } = useFilters();

  const params = route.params as ScreenWithFilters | undefined;

  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<string | null>(null);
  const [sortReady, setSortReady] = useState(false);

  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const sortOptions = sortOptionsList(screenName) as {
    label: string;
    value: string;
  }[];
  const [filterHints, setFilterHints] = useState<{
    speciesName?: string;
  }>({});
  const [ignoreContextSync, setIgnoreContextSync] = useState(false);
  const initFiltersRef = useRef(false);
  const overrideAppliedRef = useRef(false);
  const lastDeepLinkKeyRef = useRef<string | null>(null);
  const { locationCoords, permissionStatus, requestLocation } = useLocation();
  const userChangedSortRef = useRef(false);
  const defaultSortRef = useRef<string | null>(null);

  const hasActiveFilters: boolean = filters
    ? allowedFilters.some((key) => {
        const v = filters[key];
        return Array.isArray(v) ? v.length > 0 : v != null;
      })
    : false;

  const isSearchActive: boolean = debouncedSearch.length > 0;
  const isDistanceSort = (val: string | null): boolean =>
    val === "distance" || val === "-distance";

  const handleFiltersApplied = (newFilters: Filters): void => {
    setIgnoreContextSync(false);
    setFilters(newFilters);
  };

  const handleClearFilters = async () => {
    setIgnoreContextSync(true);
    await setDate(null);
    await setTerritory(null);
    await setPlace(null);
    await setSpecies(null);
    setFilters({});
  };

  const handleClearSearch = (): void => setSearch("");

  const handleSetSort = useCallback((val: string | null): void => {
    userChangedSortRef.current = true;
    setSort(val);
  }, []);

  const handleClearFiltersSearch = (): void => {
    handleClearSearch();
    handleClearFilters();
  };

  function resetFilterContext(key: AllFiltersKey): void {
    if (key === "date") setDate(null);
    if (key === "territory") {
      setTerritory(null);
      setPlace(null);
      setSpecies(null);
    }
    if (key === "place") setPlace(null);
    if (key === "species") setSpecies(null);
  }

  function applyFilterRemoval(filters: Filters, key: AllFiltersKey): Filters {
    switch (key) {
      case "date":
        return { ...filters, date: null };
      case "territory":
        return { ...filters, territory: null, place: null, species: null };
      case "place":
        return { ...filters, place: null };
      case "species":
        return { ...filters, species: null };
      case "favourite":
        return { ...filters, favourite: null };
      case "unsynced":
        return { ...filters, unsynced: null };
      case "private":
        return { ...filters, private: null };
      case "source":
        return { ...filters, source: null };
      case "radius":
        return { ...filters, radius: null };
      default:
        return filters;
    }
  }

  const removeFilter = (key: AllFiltersKey): void => {
    setIgnoreContextSync(true);
    resetFilterContext(key);

    if (!params?.filtersOverride && !overrideAppliedRef.current) {
      setFilters((prev) => applyFilterRemoval(prev, key));
    }
  };

  const loadAndApplySort = async () => {
    if (!allowSort) {
      setSortReady(true);
      return;
    }

    const storedSort = (await loadSort(screenName)) as string | null;
    const resolved = normalizeValue(
      storedSort,
      sortOptions.map((i) => i.value),
    );

    defaultSortRef.current = resolved;

    const shouldFallback =
      isDistanceSort(resolved) &&
      (permissionStatus === "denied" || locationCoords === null);

    setSort(
      shouldFallback
        ? (sortOptions.find((o) => !isDistanceSort(o.value))?.value ?? resolved)
        : resolved,
    );
    setSortReady(true);

    if (isDistanceSort(resolved) && permissionStatus !== "denied") {
      requestLocation();
    }
  };

  useEffect(() => {
    const initFilters = async () => {
      if (params?.filtersOverride && !initFiltersRef.current) {
        const { speciesName, ...overrideFilters } = params.filtersOverride;
        setFilters(overrideFilters as Filters);
        setFilterHints({ speciesName });
        setIgnoreContextSync(true);
        initFiltersRef.current = true;

        if (params?.o) {
          setSort(params.o);
          setSortReady(true);
        } else {
          await loadAndApplySort();
        }

        navigation.setParams({ filtersOverride: undefined });
        setTimeout(() => {
          setFiltersLoaded(true);
        }, 0);
        return;
      }

      if (initFiltersRef.current) return;

      const {
        filters: deepFilters,
        sort: deepSort,
        hasParams,
      } = parseDeepLinkParams(params);

      if (hasParams) {
        // Re-navigating to an already mounted screen (e.g. deep link with a
        // new ?o=...) updates route.params without remounting, so we must
        // re-apply whenever the resolved filters/sort actually change.
        const deepLinkKey = JSON.stringify({ deepFilters, deepSort });
        if (lastDeepLinkKeyRef.current === deepLinkKey) return;
        lastDeepLinkKeyRef.current = deepLinkKey;

        overrideAppliedRef.current = true;
        setFilters({ ...deepFilters } as Filters);
        setIgnoreContextSync(true);
        if (deepSort) setSort(deepSort);
        setSortReady(true);
        setFiltersLoaded(true);
        return;
      }

      if (overrideAppliedRef.current) return;
      if (!filtersReady) return;

      setFilters({
        territory: territory ?? null,
        place: place ?? null,
        date: date ?? null,
        species: species ?? null,
      });

      await loadAndApplySort();
      setFiltersLoaded(true);
    };
    initFilters();
  }, [filtersReady, params]);

  useFocusEffect(
    useCallback(() => {
      if (params?.filtersOverride) return;
      if (!filtersLoaded) return;

      setFilters((prev) => {
        if (!prev) return prev;

        let newFilters = { ...prev };
        let changed = false;

        if (!ignoreContextSync) {
          const prevDate = JSON.stringify(prev.date ?? null);
          const contextDate = JSON.stringify(date ?? null);
          if (prevDate !== contextDate) {
            newFilters.date = date ?? null;
            changed = true;
          }

          const prevTerritory = prev.territory ?? null;
          const contextTerritory = territory ?? null;
          if (prevTerritory !== contextTerritory) {
            newFilters.territory = contextTerritory;
            newFilters.place = null;
            newFilters.species = null;
            changed = true;
          } else {
            const prevPlace = prev.place ?? null;
            const contextPlace = place ?? null;
            if (prevPlace !== contextPlace) {
              newFilters.place = contextPlace;
              changed = true;
            }
            const prevSpecies = prev.species ?? null;
            const contextSpecies = species ?? null;
            if (prevSpecies !== contextSpecies) {
              newFilters.species = contextSpecies;
              changed = true;
            }
          }
        }

        if (
          species == null &&
          newFilters.species != null &&
          !ignoreContextSync
        ) {
          newFilters.species = null;
          changed = true;
        }

        return changed ? newFilters : prev;
      });
    }, [date, territory, place, species, filtersLoaded, ignoreContextSync]),
  );

  useEffect(() => {
    if (
      locationCoords &&
      isDistanceSort(defaultSortRef.current) &&
      !userChangedSortRef.current
    ) {
      setSort(defaultSortRef.current);
    }
  }, [locationCoords]);

  return {
    filters,
    filtersLoaded,
    hasActiveFilters,
    removeFilter,
    filterHints,
    sort,
    setSort: handleSetSort,
    sortOptions,
    sortReady,
    search,
    setSearch,
    debouncedSearch,
    isSearchActive,
    handleFiltersApplied,
    handleClearFilters,
    handleClearFiltersSearch,
    handleClearSearch,
  };
};
