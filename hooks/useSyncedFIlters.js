import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { loadSort } from "../util/storageHelper";
import { normalizeValue } from "../util/helpers";
import { parseDeepLinkParams } from "../util/parseDeepLinkParams";
import { useFilters } from "../store/filters-context";
import { sortOptionsList } from "../util/sortOptionsList";
import { useDebounce } from "../util/useDebounce";

export const useSyncedFilters = ({
  route,
  navigation,
  screenName,
  allowSort = true,
  permissionStatus = false,
  allowedFilters,
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
  } = useFilters();

  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [sortReady, setSortReady] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const sortOptions = sortOptionsList(screenName);
  const [filterHints, setFilterHints] = useState({});
  const [ignoreContextSync, setIgnoreContextSync] = useState(false);
  const initFiltersRef = useRef(false);
  const overrideAppliedRef = useRef(false);

  const hasActiveFilters = filters
    ? allowedFilters.some((key) => {
        const v = filters[key];
        return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
      })
    : false;

  const isSearchActive = debouncedSearch.length > 0;
  const isDistanceSort = (val) => val === "distance" || val === "-distance";

  const handleFiltersApplied = (newFilters) => {
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
    setFilterModalVisible(false);
  };

  const handleClearSearch = () => setSearch("");

  const handleClearFiltersSearch = () => {
    handleClearSearch();
    handleClearFilters();
  };

  const removeFilter = (key) => {
    setIgnoreContextSync(true);
    if (key === "date") setDate(null);
    if (key === "territory") {
      setTerritory(null);
      setPlace(null);
      setSpecies(null);
    }
    if (key === "place") setPlace(null);
    if (key === "species") setSpecies(null);

    if (!route.params?.filtersOverride && !overrideAppliedRef.current) {
      setFilters((prev) => {
        const newFilters = { ...prev };
        newFilters[key] = undefined;
        if (key === "territory") {
          newFilters.place = undefined;
          newFilters.species = undefined;
        }
        return newFilters;
      });
    }
  };

  useEffect(() => {
    const initFilters = async () => {
      if (route.params?.filtersOverride && !initFiltersRef.current) {
        const { speciesName, ...overrideFilters } =
          route.params.filtersOverride;
        setFilters(overrideFilters);
        setFilterHints({ speciesName });
        setIgnoreContextSync(true);

        initFiltersRef.current = true;
        if (route.params?.o) setSort(route.params.o);

        navigation.setParams({ filtersOverride: undefined });
        setSortReady(true);
        setTimeout(() => {
          setFiltersLoaded(true);
        }, 0);
        return;
      }

      const {
        filters: deepFilters,
        sort: deepSort,
        hasParams,
      } = parseDeepLinkParams(route.params);

      if (hasParams) {
        overrideAppliedRef.current = true;
        setFilters({ ...deepFilters });
        setIgnoreContextSync(true);
        if (deepSort) setSort(deepSort);
        setSortReady(true);
      } else {
        setFilters({
          territory: territory ?? null,
          place: place ?? null,
          date: date ?? null,
          species: species ?? null,
        });

        if (allowSort) {
          const storedSort = await loadSort(screenName);
          const resolved = normalizeValue(
            storedSort,
            sortOptions.map((i) => i.value),
          );
          setSort(
            isDistanceSort(resolved) && permissionStatus === "denied"
              ? (sortOptions.find((o) => !isDistanceSort(o.value))?.value ??
                  resolved)
              : resolved,
          );
          setSortReady(true);
        } else {
          setSortReady(true);
        }
      }

      setFiltersLoaded(true);
    };
    initFilters();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.filtersOverride) return;
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

  return {
    filters,
    filtersLoaded,
    filterModalVisible,
    setFilterModalVisible,
    hasActiveFilters,
    removeFilter,
    filterHints,
    sort,
    setSort,
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
