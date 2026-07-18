import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLanguage } from "../store/language-context";
import { stableStringify, roundCoords } from "../util/helpers";
import { subscribeToReconnect } from "../services/sync/networkStatus";
import { FetchFunction, Filters, PaginatedResponse, seenMode, Coords} from "../types";

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
  staleTime?: number;
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
  staleTime,
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
    const rounded = roundCoords(locationCoords);
    if (!rounded) return null;
    return `${rounded[0]},${rounded[1]}`;
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

  const query = useInfiniteQuery<PaginatedResponse<T>>({
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
    staleTime: staleTime ?? 1000 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled,
  });

  // While offline, page 1 can come back from the cache's "relaxed match"
  // fallback (fetchAbstract in util/fetches.ts) — the same page number, but
  // fetched under a different sort and merely resorted client-side, e.g. the
  // nearest-100-by-distance reordered alphabetically rather than the true
  // first-100-by-name. Concatenating that with later pages fetched for real
  // once back online produces a list that's sorted within each page but not
  // across the boundary. Refetch from the server as soon as connectivity
  // returns so every loaded page reflects the actual requested order.
  // query.refetch is intentionally left out of the deps — it's a stable
  // method on the underlying observer, so re-subscribing only when the query
  // identity changes (not on every render) is enough.
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeToReconnect(() => {
      query.refetch();
    });
  }, [enabled, queryKey]);

  return query;
};
