import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { loadSort } from "../util/storageHelper";
import { normalizeValue } from "../util/helpers";
import { parseDeepLinkParams } from "../util/parseDeepLinkParams";

export const useSyncedFilters = ({
  route,
  navigation,
  screenName,
  contextFilters,
  sortOptions,
  allowSort = true,
  permissionStatus,
}) => {
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [sortReady, setSortReady] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filterHints, setFilterHints] = useState({});
  const [ignoreContextSync, setIgnoreContextSync] = useState(false);

  const initFiltersRef = useRef(false);
  const overrideAppliedRef = useRef(false);

  const isDistanceSort = (val) => val === "distance" || val === "-distance";

  useEffect(() => {
    const initFilters = async () => {
      if (route.params?.filtersOverride && !initFiltersRef.current) {
        const { speciesName, ...overrideFilters } =
          route.params.filtersOverride;

        setFilters(overrideFilters);
        setFilterHints({ speciesName });
        setIgnoreContextSync(true);

        initFiltersRef.current = true;

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
          territory: contextFilters.territory ?? null,
          place: contextFilters.place ?? null,
          date: contextFilters.date ?? null,
          species: contextFilters.species ?? null,
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
      setIgnoreContextSync(false);

      if (route.params?.filtersOverride) return;
      if (!filtersLoaded) return;

      setFilters((prev) => {
        if (!prev) return prev;

        let newFilters = { ...prev };
        let changed = false;

        if (!ignoreContextSync) {
          const prevDate = JSON.stringify(prev.date ?? null);
          const contextDate = JSON.stringify(contextFilters.date ?? null);
          if (prevDate !== contextDate) {
            newFilters.date = contextFilters.date ?? null;
            changed = true;
          }

          const prevTerritory = prev.territory ?? null;
          const contextTerritory = contextFilters.territory ?? null;

          if (prevTerritory !== contextTerritory) {
            newFilters.territory = contextTerritory;
            newFilters.place = null;
            newFilters.species = null;
            changed = true;
          } else {
            const prevPlace = prev.place ?? null;
            const contextPlace = contextFilters.place ?? null;

            if (prevPlace !== contextPlace) {
              newFilters.place = contextPlace;
              changed = true;
            }

            const prevSpecies = prev.species ?? null;
            const contextSpecies = contextFilters.species ?? null;

            if (prevSpecies !== contextSpecies) {
              newFilters.species = contextSpecies;
              changed = true;
            }
          }
        }

        return changed ? newFilters : prev;
      });
    }, [
      contextFilters.date,
      contextFilters.territory,
      contextFilters.place,
      contextFilters.species,
      filtersLoaded,
      ignoreContextSync,
    ]),
  );

  return {
    filters,
    setFilters,
    sort,
    setSort,
    sortReady,
    filtersLoaded,
    filterHints,
    ignoreContextSync,
    setIgnoreContextSync,
    overrideAppliedRef,
  };
};
