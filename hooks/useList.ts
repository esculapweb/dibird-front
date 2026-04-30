import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLanguage } from "../store/language-context";
import { stableStringify } from "../util/helpers";
import { FetchFunction, Filters, PaginatedResponse, seenMode, LocationCoords, Coords} from "../types";

interface useListProps<T> {
  screenName: string;
  fetchFunction: FetchFunction<T>;
  filters: Filters | null;
  sort: string | null;
  search?: string | null;
  tabsMode?: seenMode;
  extraFilters?: Filters | null;
  locationCoords?: Coords | null;
  enabled: boolean;
}

export const useList = <T>({
  screenName,
  fetchFunction,
  filters,
  sort,
  search,
  tabsMode,
  extraFilters,
  locationCoords,
  enabled,
}: useListProps<T>) => {
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
    return `${locationCoords?.[1] ?? ""},${locationCoords?.[1] ?? ""}`;
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

  return useInfiniteQuery<PaginatedResponse<T>>({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchFunction(mergedFilters, sort, search ?? "", pageParam as number),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.current < pagination.final
        ? pagination.current + 1
        : undefined;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled,
  });
};
