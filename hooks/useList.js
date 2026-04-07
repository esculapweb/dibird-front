import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLanguage } from "../store/language-context";

const stableStringify = (obj) => {
  if (!obj) return null;

  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        const value = obj[key];

        if (value !== undefined) {
          acc[key] = value;
        }

        return acc;
      }, {}),
  );
};

export const useList = ({
  screenName,
  fetchFunction,
  filters,
  sort,
  search,
  tabsMode,
  extraFilters,
  locationCoords,
  enabled,
}) => {
  const { language } = useLanguage();

  const mergedFilters = useMemo(() => {
    const f = filters ?? {};
    const e = extraFilters ?? {};

    return { ...f, ...e };
  }, [filters, extraFilters]);

  const filtersKey = useMemo(
    () => stableStringify(mergedFilters ?? {}),
    [mergedFilters],
  );

  const locationKey = useMemo(() => {
    if (!locationCoords) return null;
    return `${locationCoords.lat ?? ""},${locationCoords.lng ?? ""}`;
  }, [locationCoords]);

  const queryKey = useMemo(() => {
    return [
      screenName,
      filtersKey,
      sort ?? null,
      search ?? "",
      tabsMode ?? null,
      language,
      locationKey,
    ];
  }, [screenName, filtersKey, sort, search, tabsMode, language, locationKey]);

  return useInfiniteQuery({
    queryKey,

    queryFn: ({ pageParam = 1 }) =>
      fetchFunction(mergedFilters, sort, search, pageParam),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.current < pagination.final
        ? pagination.current + 1
        : undefined;
    },
    keepPreviousData: true,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled,
  });
};
